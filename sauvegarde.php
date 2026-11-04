<?php
/**
 * v37.96 — LA SAUVEGARDE HORS DU VPS, ET L'ALERTE SI QUELQUE CHOSE TOMBE.
 *
 *   Tout vivait sur un seul serveur : s'il était perdu, tout l'était. Désormais, chaque nuit :
 *     1. l'état de Finance Master (et de Santé Master) est copié, compressé, dans un dossier HORS du site
 *        (/var/backups/finance-master par défaut), 30 jours gardés ;
 *     2. la copie est ENVOYÉE dans votre conversation Telegram avec le bot du CFO : elle quitte le VPS.
 *   Toutes les heures, une surveillance vérifie que les données se lisent, que la dernière sauvegarde a moins
 *   de 26 h et que n8n répond — sinon un message Telegram (au plus un toutes les 6 h par problème).
 *
 *   Ligne de commande seulement (jamais par le site) :
 *     php sauvegarde.php quotidienne        sauvegarde + envoi Telegram
 *     php sauvegarde.php surveillance       contrôles + alerte si besoin
 *     php sauvegarde.php restaurer <fichier.json.gz> --oui   remet un état sauvegardé (l'état actuel est sauvegardé avant)
 *   Réglages : /etc/finance-master/sauvegarde.conf (JSON, lisible par root seul), écrit par « sudo bash install.sh sauvegarde » :
 *     { bot_token, chat_id, dossier?, api?, n8n_sante? } — FM_SAUVEGARDE_CONF pour un autre fichier (tests).
 */
if (PHP_SAPI !== 'cli' && !defined('SAUVEGARDE_BIBLIOTHEQUE')) { http_response_code(404); exit; }

function sv_conf(): array {
    $f = getenv('FM_SAUVEGARDE_CONF') ?: '/etc/finance-master/sauvegarde.conf';
    $c = is_readable($f) ? json_decode((string)file_get_contents($f), true) : null;
    $c = is_array($c) ? $c : [];
    return $c + ['dossier' => '/var/backups/finance-master', 'api' => 'https://api.telegram.org', 'n8n_sante' => 'http://127.0.0.1:5678/healthz', 'garder' => 30];
}
function sv_etat_fichier(): string { return getenv('FM_SAUVEGARDE_ETAT') ?: __DIR__ . '/pending/sauvegarde_etat.json'; }
function sv_db(): ?PDO {
    $f = __DIR__ . '/db_config.php';
    if (!is_file($f) || !extension_loaded('pdo_pgsql')) return null;
    $c = include $f;
    if (!is_array($c)) return null;
    try { return new PDO(sprintf('pgsql:host=%s;port=%s;dbname=%s', $c['host'], $c['port'], $c['dbname']), $c['user'], $c['password'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT => 5]); }
    catch (Throwable $e) { return null; }
}
/** L'état d'une appli : la table si elle a une ligne, sinon le fichier. [texte|null, source] */
function sv_lire(string $table, string $fichier): array {
    $pdo = sv_db();
    if ($pdo) {
        try { $r = $pdo->query("SELECT data::text AS t FROM $table WHERE id = 1")->fetch(PDO::FETCH_ASSOC); if ($r && trim((string)$r['t']) !== '') return [$r['t'], 'postgres']; }
        catch (Throwable $e) { /* table absente : le fichier */ }
    }
    if (is_file($fichier)) { $t = (string)file_get_contents($fichier); if (trim($t) !== '') return [$t, 'fichier']; }
    return [null, 'absent'];
}
function sv_sources(): array {
    return [
        'finance' => sv_lire('finance_state', getenv('FM_FINANCE_FICHIER') ?: __DIR__ . '/finance_data.json'),
        'sante'   => sv_lire('sante_state', getenv('SANTE_DATA_FILE') ?: __DIR__ . '/sante/sante_data.json'),
    ];
}
/** Envoi Telegram (sendMessage / sendDocument). */
function sv_telegram(array $c, string $methode, array $champs): array {
    if (empty($c['bot_token']) || empty($c['chat_id'])) return ['ok' => false, 'description' => 'bot_token ou chat_id absent de sauvegarde.conf'];
    $ch = curl_init(rtrim($c['api'], '/') . '/bot' . $c['bot_token'] . '/' . $methode);
    curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => ['chat_id' => $c['chat_id']] + $champs, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 60]);
    $r = curl_exec($ch); $e = curl_error($ch); curl_close($ch);
    $j = is_string($r) ? json_decode($r, true) : null;
    return is_array($j) ? $j : ['ok' => false, 'description' => $e ?: 'réponse illisible'];
}
function sv_ecrire_etat(array $maj): array {
    $f = sv_etat_fichier(); $e = is_file($f) ? (json_decode((string)file_get_contents($f), true) ?: []) : [];
    $e = array_replace_recursive($e, $maj);
    @mkdir(dirname($f), 0775, true); @file_put_contents($f, json_encode($e, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    return $e;
}

function sv_quotidienne(): array {
    $c = sv_conf(); $S = sv_sources(); $paquet = ['date' => date('c'), 'version' => 1];
    $resume = [];
    foreach ($S as $nom => [$t, $src]) {
        if ($t === null) { $resume[] = "$nom : absent"; continue; }
        $d = json_decode($t, true);
        if (!is_array($d)) return sv_ecrire_etat(['derniere' => ['ok' => false, 'quand' => date('c'), 'erreur' => "$nom : JSON illisible"]])['derniere'];
        $paquet[$nom] = $d;
        $resume[] = $nom === 'finance' ? 'Finance (' . count((array)($d['comptes'] ?? [])) . ' comptes, ' . count((array)($d['donneesAnnuelles'] ?? [])) . ' années)' : 'Santé (' . count((array)($d['bilans'] ?? [])) . ' bilans)';
    }
    if (count($paquet) <= 2) return sv_ecrire_etat(['derniere' => ['ok' => false, 'quand' => date('c'), 'erreur' => 'aucune donnée à sauvegarder']])['derniere'];
    @mkdir($c['dossier'], 0700, true);
    $nomF = 'finance-master_' . date('Ymd_His') . '.json.gz';
    $chemin = rtrim($c['dossier'], '/') . '/' . $nomF;
    $gz = gzencode(json_encode($paquet, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION), 9);
    if ($gz === false || file_put_contents($chemin, $gz) === false) return sv_ecrire_etat(['derniere' => ['ok' => false, 'quand' => date('c'), 'erreur' => 'écriture impossible dans ' . $c['dossier']]])['derniere'];
    @chmod($chemin, 0600);
    $L = glob(rtrim($c['dossier'], '/') . '/finance-master_*.json.gz') ?: [];
    sort($L);
    foreach (array_slice($L, 0, max(0, count($L) - (int)$c['garder'])) as $x) @unlink($x);
    $tg = sv_telegram($c, 'sendDocument', ['document' => new CURLFile($chemin, 'application/gzip', $nomF),
        'caption' => '💾 Sauvegarde du ' . date('d/m/Y H:i') . ' — ' . implode(' · ', $resume) . '. Gardez ce message : c\'est votre copie hors du serveur.']);
    $ok = !empty($tg['ok']);
    return sv_ecrire_etat(['derniere' => ['ok' => $ok, 'quand' => date('c'), 'fichier' => $nomF, 'octets' => strlen($gz), 'locales' => min(count($L), (int)$c['garder']),
                                          'telegram' => $ok ? 'envoyée' : ('échec : ' . ($tg['description'] ?? '?')), 'resume' => $resume]])['derniere'];
}

function sv_surveillance(?int $maintenant = null): array {
    $c = sv_conf(); $maintenant = $maintenant ?? time(); $pb = [];
    foreach (sv_sources() as $nom => [$t, $src]) {
        if ($nom === 'sante' && $t === null) continue;                 // Santé Master pas encore utilisé
        if ($t === null || !is_array(json_decode($t, true))) $pb[$nom] = "les données de $nom ne se lisent plus ($src)";
    }
    $e = is_file(sv_etat_fichier()) ? (json_decode((string)file_get_contents(sv_etat_fichier()), true) ?: []) : [];
    $d = $e['derniere'] ?? null;
    if (!$d) $pb['sauvegarde'] = 'aucune sauvegarde n\'a encore tourné';
    elseif (empty($d['ok'])) $pb['sauvegarde'] = 'la dernière sauvegarde a échoué : ' . ($d['erreur'] ?? $d['telegram'] ?? '?');
    elseif ($maintenant - strtotime($d['quand']) > 26 * 3600) $pb['sauvegarde'] = 'la dernière sauvegarde date de plus de 26 h';
    if (!empty($c['n8n_sante'])) {
        $ch = curl_init($c['n8n_sante']); curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10, CURLOPT_NOBODY => false]);
        curl_exec($ch); $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        if ($code < 200 || $code >= 400) $pb['n8n'] = 'n8n ne répond pas (CFO et Telegram hors service)' . ($code ? " — code $code" : '');
    }
    //  au plus une alerte toutes les 6 h par problème ; un message quand il est résolu
    $deja = $e['alertes'] ?? []; $envoyes = []; $nouv = [];
    foreach ($pb as $k => $m) {
        $nouv[$k] = $deja[$k] ?? 0;
        if ($maintenant - (int)$nouv[$k] >= 6 * 3600) { $r = sv_telegram($c, 'sendMessage', ['text' => '🚨 Finance Master : ' . $m . '.']); if (!empty($r['ok'])) { $nouv[$k] = $maintenant; $envoyes[] = $k; } }
    }
    foreach (array_diff(array_keys($deja), array_keys($pb)) as $k) sv_telegram($c, 'sendMessage', ['text' => '✅ Finance Master : résolu — ' . $k . '.']);
    $f = sv_etat_fichier(); $tout = is_file($f) ? (json_decode((string)file_get_contents($f), true) ?: []) : [];
    $tout['alertes'] = $nouv; $tout['surveillance'] = ['quand' => date('c', $maintenant), 'problemes' => $pb];
    @mkdir(dirname($f), 0775, true); @file_put_contents($f, json_encode($tout, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    return ['problemes' => $pb, 'alertes_envoyees' => $envoyes];
}

/** Remet un état sauvegardé, APRÈS avoir sauvegardé l'état actuel. */
function sv_restaurer(string $fichier): array {
    $p = is_file($fichier) ? json_decode((string)gzdecode((string)file_get_contents($fichier)), true) : null;
    if (!is_array($p) || (!isset($p['finance']) && !isset($p['sante']))) return ['ok' => false, 'erreur' => 'fichier de sauvegarde illisible'];
    $avant = sv_quotidienne();
    $pdo = sv_db(); $fait = [];
    foreach (['finance' => ['finance_state', getenv('FM_FINANCE_FICHIER') ?: __DIR__ . '/finance_data.json'], 'sante' => ['sante_state', getenv('SANTE_DATA_FILE') ?: __DIR__ . '/sante/sante_data.json']] as $nom => [$table, $f]) {
        if (!isset($p[$nom])) continue;
        $t = json_encode($p[$nom], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
        if ($pdo) $pdo->prepare("INSERT INTO $table (id, data, updated_at) VALUES (1, CAST(:d AS jsonb), now()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()")->execute([':d' => $t]);
        file_put_contents($f, $t); $fait[] = $nom;
    }
    return ['ok' => true, 'restaure' => $fait, 'sauvegarde_avant' => $avant['fichier'] ?? null];
}

/** Pour install.sh : le jeton du bot « CFO » dans un export DÉCHIFFRÉ des identifiants n8n (jamais affiché). */
function sv_jeton_bot(array $creds): ?string {
    $tg = array_values(array_filter($creds, fn($c) => is_array($c) && ($c['type'] ?? '') === 'telegramApi'));
    $cfo = array_values(array_filter($tg, fn($c) => stripos((string)($c['name'] ?? ''), 'cfo') !== false));
    $l = count($cfo) === 1 ? $cfo : (count($tg) === 1 ? $tg : []);
    return $l ? ((string)($l[0]['data']['accessToken'] ?? '') ?: null) : null;
}
/** Pour install.sh : le chat Telegram — TELEGRAM_CHAT_IDS (n8n), sinon la dernière conversation vue par le CFO. */
function sv_chat_id(string $envIds, string $dossierEtapes): ?string {
    $ids = array_values(array_filter(preg_split('/[\s,;]+/', $envIds)));
    if ($ids) return $ids[0];
    $L = glob(rtrim($dossierEtapes, '/') . '/tg_*.json') ?: [];
    usort($L, fn($a, $b) => filemtime($b) - filemtime($a));
    return $L ? substr(basename($L[0], '.json'), 3) : null;
}

if (PHP_SAPI === 'cli' && !defined('SAUVEGARDE_BIBLIOTHEQUE') && realpath($argv[0] ?? '') === __FILE__) {
    $cmd = $argv[1] ?? '';
    if ($cmd === 'quotidienne') { $r = sv_quotidienne(); echo json_encode($r, JSON_UNESCAPED_UNICODE), "\n"; exit(empty($r['ok']) ? 1 : 0); }
    if ($cmd === 'surveillance') { $r = sv_surveillance(); echo json_encode($r, JSON_UNESCAPED_UNICODE), "\n"; exit(0); }
    if ($cmd === 'restaurer') {
        if (!in_array('--oui', $argv, true) || empty($argv[2])) { fwrite(STDERR, "usage : php sauvegarde.php restaurer <fichier.json.gz> --oui\n"); exit(2); }
        $r = sv_restaurer($argv[2]); echo json_encode($r, JSON_UNESCAPED_UNICODE), "\n"; exit(empty($r['ok']) ? 1 : 0);
    }
    if ($cmd === 'jeton') { $c = json_decode((string)file_get_contents('php://stdin'), true); $j = sv_jeton_bot(is_array($c) ? (isset($c['id']) ? [$c] : $c) : []); if (!$j) exit(1); echo $j; exit(0); }
    if ($cmd === 'chat') { $id = sv_chat_id((string)($argv[2] ?? ''), (string)($argv[3] ?? __DIR__ . '/pending/etapes')); if (!$id) exit(1); echo $id; exit(0); }
    fwrite(STDERR, "usage : php sauvegarde.php quotidienne | surveillance | restaurer <fichier> --oui\n"); exit(2);
}
