<?php
declare(strict_types=1);
/**
 * ============================================================================
 *  cfo_memoire_garde.php — GARDE-MÉMOIRE (v37.38)
 * ----------------------------------------------------------------------------
 *  POST (JSON) {action:"garantir"}   + en-tête X-Requested-With
 *
 *  Relit les échanges récents de chat_history (web ET Telegram), repère chaque
 *  demande de mémorisation (« mémorise… », « retiens… », ou une réponse du CFO
 *  qui affirme « j'ai mémorisé »), la découpe en entités, cherche chacune dans
 *  finance_vectors et ÉCRIT celles qui manquent — par le même webhook
 *  d'ingestion que l'outil memory_writer. Chaque écriture est ensuite RELUE en
 *  base : le reçu dit ce que la base contient, pas ce qu'un service a répondu.
 *
 *  POURQUOI ICI ET PAS DANS n8n : la garantie ne peut pas dépendre du modèle
 *  qui a oublié l'écriture, et ce fichier se déploie par un simple `git pull`.
 *  Il n'accepte AUCUN texte de l'appelant : il ne lit que chat_history, ce que
 *  l'utilisateur a réellement écrit au CFO. Rien à injecter par cette porte.
 *
 *  EXACTEMENT UNE FOIS : un registre (table cfo_memoire_garde, créée au premier
 *  appel) retient chaque échange traité. Deux onglets qui appellent en même
 *  temps ne peuvent pas écrire deux fois : le premier qui inscrit l'échange le
 *  traite, l'autre passe.
 *
 *  JAMAIS DE RÉSURRECTION : une règle que l'utilisateur a effacée depuis la
 *  Supervision IA est dans vectors_supprimes.jsonl — c'est une décision, le
 *  garde-fou ne la réécrit pas.
 *
 *  Première passe : les 30 derniers jours (de quoi rattraper l'Actif Est).
 *  Ensuite : depuis le dernier échange lu.
 * ============================================================================
 */
require_once __DIR__ . '/cfo_memoire_lib.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function gm_sortie(array $p, int $code = 200): void {
    http_response_code($code);
    echo json_encode($p, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR);
    exit;
}

/* ── Verrous d'appel : même origine, comme la suppression d'une règle ─────── */
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    gm_sortie(['status' => 'error', 'error' => 'METHODE', 'message' => 'POST {action:"garantir"} attendu.'], 405);
}
if (($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') === '') {
    gm_sortie(['status' => 'error', 'error' => 'ENTETE_MANQUANT', 'message' => 'En-tête X-Requested-With absent : requête rejetée (protection CSRF).'], 400);
}
$hote = $_SERVER['HTTP_HOST'] ?? '';
$origine = $_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
if ($origine !== '') {
    $hOrigine = parse_url($origine, PHP_URL_HOST);
    if ($hOrigine !== null && strcasecmp((string)$hOrigine, (string)preg_replace('/:\d+$/', '', $hote)) !== 0) {
        gm_sortie(['status' => 'error', 'error' => 'ORIGINE_ETRANGERE', 'message' => "Requête émise depuis « {$hOrigine} », qui n'est pas « {$hote} »."], 403);
    }
}
$corps = json_decode((string)file_get_contents('php://input'), true) ?: [];
if (($corps['action'] ?? '') !== 'garantir') {
    gm_sortie(['status' => 'error', 'error' => 'ACTION_INCONNUE', 'message' => 'Action attendue : {action:"garantir"}.'], 400);
}

/* ── Configuration et connexion (mêmes règles que get_ai_memory.php) ──────── */
$cfgFile = __DIR__ . '/db_config.php';
if (!file_exists($cfgFile)) gm_sortie(['status' => 'error', 'error' => 'CONFIG_ABSENTE', 'message' => 'db_config.php introuvable.'], 503);
$cfg = include $cfgFile;
if (!is_array($cfg)) gm_sortie(['status' => 'error', 'error' => 'CONFIG_INVALIDE', 'message' => 'db_config.php ne retourne pas un tableau.'], 503);
if (!extension_loaded('pdo_pgsql')) gm_sortie(['status' => 'error', 'error' => 'PDO_PGSQL_ABSENT', 'message' => "L'extension pdo_pgsql n'est pas chargée."], 503);

$pdo = null; $echecs = [];
foreach (array_values(array_unique(array_filter([$cfg['host'] ?? null, 'localhost', '127.0.0.1', 'postgres', 'postgres-psy', 'db']))) as $h) {
    try {
        $pdo = new PDO(sprintf('pgsql:host=%s;port=%s;dbname=%s', $h, $cfg['port'] ?? '5432', $cfg['dbname'] ?? ''),
                       $cfg['user'] ?? '', $cfg['password'] ?? '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT => 4]);
        break;
    } catch (Throwable $e) { $echecs[$h] = $e->getMessage(); $pdo = null; }
}
if (!$pdo) gm_sortie(['status' => 'error', 'error' => 'POSTGRES_INJOIGNABLE', 'message' => "Aucun hôte Postgres n'a répondu.", 'hotes_tentes' => $echecs], 503);

// Le même webhook que l'outil memory_writer du workflow n8n : une seule porte d'écriture.
$INGEST = (string)($cfg['memory_ingest_url'] ?? 'https://n8n.beau.ink/webhook/finance-memory-ingest');
const GM_FENETRE_JOURS = 30;     // première passe
const GM_ECRITURES_MAX = 6;      // par appel : le reste attend l'appel suivant
const GM_TENTATIVES_MAX = 5;
@set_time_limit(180);

/* ── Outils ────────────────────────────────────────────────────────────────── */
function gm_colonnes(PDO $pdo, string $table): array {
    $st = $pdo->prepare('SELECT column_name FROM information_schema.columns WHERE table_name = :t');
    $st->execute([':t' => $table]);
    return array_map(fn($r) => $r['column_name'], $st->fetchAll(PDO::FETCH_ASSOC));
}
function gm_col(array $dispo, array $cands): ?string {
    foreach ($cands as $c) if (in_array($c, $dispo, true)) return $c;
    return null;
}
/** {"type":"human","data":{"content":"…"}} — ou une variante : on cherche le contenu où il peut être. */
function gm_message($brut): array {
    $d = (is_array($brut) || is_object($brut)) ? (array)$brut : json_decode((string)$brut, true);
    if (!is_array($d)) return ['auteur' => '', 'contenu' => (string)$brut];
    $type = strtolower((string)($d['type'] ?? ($d['data']['type'] ?? ($d['role'] ?? ''))));
    $contenu = $d['data']['content'] ?? ($d['content'] ?? ($d['text'] ?? ''));
    if (!is_string($contenu)) $contenu = json_encode($contenu, JSON_UNESCAPED_UNICODE);
    $auteur = (strpos($type, 'human') !== false || strpos($type, 'user') !== false) ? 'human'
            : ((strpos($type, 'ai') !== false || strpos($type, 'assistant') !== false) ? 'ai' : $type);
    return ['auteur' => $auteur, 'contenu' => (string)$contenu];
}
/** POST vers le webhook d'ingestion. Le succès se lit dans la réponse, puis se VÉRIFIE en base. */
function gm_ingerer(string $url, array $corps): array {
    $json = json_encode($corps, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $code = 0; $brut = false; $err = null;
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $json, CURLOPT_RETURNTRANSFER => true,
                                CURLOPT_HTTPHEADER => ['Content-Type: application/json'], CURLOPT_TIMEOUT => 25, CURLOPT_CONNECTTIMEOUT => 8]);
        $brut = curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        if ($brut === false) $err = curl_error($ch);
        curl_close($ch);
    } else {
        $ctx = stream_context_create(['http' => ['method' => 'POST', 'header' => "Content-Type: application/json\r\n",
                                                 'content' => $json, 'timeout' => 25, 'ignore_errors' => true]]);
        $brut = @file_get_contents($url, false, $ctx);
        if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s?/', $http_response_header[0], $mm)) $code = (int)$mm[1];
        if ($brut === false) $err = 'connexion impossible';
    }
    $d = is_string($brut) ? json_decode($brut, true) : null;
    if (is_string($d)) $d = json_decode($d, true);       // le nœud Respond renvoie parfois du JSON dans une chaîne
    $ok = $code >= 200 && $code < 300 && is_array($d) && ($d['status'] ?? null) === 'ok';
    return ['ok' => $ok, 'erreur' => $ok ? null : ($err ?: ('HTTP ' . $code . ($brut ? ' — ' . mb_substr((string)$brut, 0, 160) : '')))];
}

try {
    /* Registre : un échange traité n'est plus jamais retraité. */
    $pdo->exec("CREATE TABLE IF NOT EXISTS cfo_memoire_garde (
                    cle        TEXT PRIMARY KEY,
                    session_id TEXT,
                    traite_le  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    recu       JSONB NOT NULL DEFAULT '{}'::jsonb)");

    $dv = gm_colonnes($pdo, 'finance_vectors');
    $cTxtV = gm_col($dv, ['text', 'content', 'document', 'page_content', 'texte']);
    $cIdV = gm_col($dv, ['id']);
    if (!$cTxtV) gm_sortie(['status' => 'error', 'error' => 'TABLE_VECTEURS', 'message' => "finance_vectors absente ou sans colonne de texte."], 503);
    $dc = gm_colonnes($pdo, 'chat_history');
    $cMsg = gm_col($dc, ['message', 'messages', 'content', 'data']);
    $cSes = gm_col($dc, ['session_id', 'sessionid', 'session']);
    $cAt  = gm_col($dc, ['created_at', 'createdat', 'inserted_at', 'timestamp']);
    $cId  = gm_col($dc, ['id']);
    if (!$cMsg || !$cSes) gm_sortie(['status' => 'error', 'error' => 'TABLE_CHAT', 'message' => "chat_history absente ou sans colonnes session/message."], 503);

    $memoire = [];
    $chargerMemoire = function () use ($pdo, $cTxtV, $cIdV, &$memoire) {
        $st = $pdo->query('SELECT ' . ($cIdV ? '"' . $cIdV . '"::text AS id, ' : '') . '"' . $cTxtV . '" AS t FROM finance_vectors LIMIT 5000');
        $memoire = [];
        foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $k => $r) $memoire[$r['id'] ?? ('#' . $k)] = (string)$r['t'];
    };
    $chargerMemoire();
    $supprimes = [];
    $arch = __DIR__ . '/vectors_supprimes.jsonl';
    if (is_readable($arch)) foreach (file($arch, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $l) {
        $d = json_decode($l, true);
        if (is_array($d) && !empty($d['texte'])) $supprimes[] = (string)$d['texte'];
    }

    $ecritesAppel = 0;
    /** Écrit une entité, puis la RELIT. Met à jour son statut. */
    $ecrire = function (array &$e, string $session) use ($pdo, $cTxtV, $cIdV, $INGEST, &$memoire, $chargerMemoire, &$ecritesAppel) {
        // Écrite entre-temps (par un échange voisin, ou par le CFO) ? Rien à faire.
        $best = cfo_gm_meilleur($e['texte'], array_values($memoire));
        if ($best['taux'] >= CFO_GM_SEUIL) {
            $e['statut'] = 'en_memoire'; $e['regle_id'] = array_keys($memoire)[$best['index']]; unset($e['erreur']);
            return;
        }
        if ($ecritesAppel >= GM_ECRITURES_MAX) { $e['statut'] = 'en_attente'; return; }
        $ecritesAppel++;
        $r = gm_ingerer($INGEST, ['texte' => $e['a_ecrire'], 'categorie' => $e['categorie'], 'session_id' => 'garde_memoire:' . $session]);
        if (!$r['ok']) { $e['statut'] = 'echec'; $e['erreur'] = $r['erreur']; return; }
        $chargerMemoire();
        $st = $pdo->prepare('SELECT ' . ($cIdV ? '"' . $cIdV . '"::text' : "''") . ' FROM finance_vectors WHERE "' . $cTxtV . '" = :t LIMIT 1');
        $st->execute([':t' => $e['a_ecrire']]);
        $id = $st->fetchColumn();
        if ($id === false) {
            $b = cfo_gm_meilleur($e['texte'], array_values($memoire));
            $id = $b['taux'] >= CFO_GM_SEUIL ? array_keys($memoire)[$b['index']] : false;
        }
        if ($id === false) { $e['statut'] = 'echec'; $e['erreur'] = "Le webhook a répondu « ok » mais la règle est introuvable en base."; return; }
        $e['statut'] = 'ecrite'; $e['regle_id'] = (string)$id; unset($e['erreur']);
    };
    $finaliser = function (array &$recu) {
        $restants = array_filter($recu['entites'], fn($e) => in_array($e['statut'], ['echec', 'en_attente', 'a_ecrire'], true));
        $recu['a_reprendre'] = $restants && $recu['tentatives'] < GM_TENTATIVES_MAX;
        $recu['en_memoire_apres'] = count(array_filter($recu['entites'], fn($e) => in_array($e['statut'], ['en_memoire', 'ecrite'], true)));
    };
    $recus = [];

    /* ── 1. Reprises : écritures échouées ou différées ─────────────────────── */
    $st = $pdo->query("SELECT cle, recu FROM cfo_memoire_garde WHERE cle <> '__curseur__' AND recu->>'a_reprendre' = 'true' ORDER BY traite_le LIMIT 20");
    foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $recu = json_decode((string)$row['recu'], true);
        if (!is_array($recu)) continue;
        // verrou optimiste : un seul appel prend la reprise
        $up = $pdo->prepare("UPDATE cfo_memoire_garde SET recu = jsonb_set(recu, '{tentatives}', to_jsonb(CAST(:n AS int))), traite_le = NOW()
                              WHERE cle = :c AND COALESCE((recu->>'tentatives')::int, 0) = :t");
        $up->execute([':n' => (int)$recu['tentatives'] + 1, ':c' => $row['cle'], ':t' => (int)$recu['tentatives']]);
        if ($up->rowCount() !== 1) continue;
        $recu['tentatives']++;
        foreach ($recu['entites'] as &$e) if (in_array($e['statut'], ['echec', 'en_attente', 'a_ecrire'], true)) $ecrire($e, (string)$recu['session_id']);
        unset($e);
        $finaliser($recu);
        $pdo->prepare('UPDATE cfo_memoire_garde SET recu = CAST(:r AS jsonb) WHERE cle = :c')
            ->execute([':r' => json_encode($recu, JSON_UNESCAPED_UNICODE), ':c' => $row['cle']]);
        $recu['reprise'] = true;
        $recus[] = $recu;
    }

    /* ── 2. Les échanges nouveaux ──────────────────────────────────────────── */
    $curseur = $pdo->query("SELECT recu->>'curseur' FROM cfo_memoire_garde WHERE cle = '__curseur__'")->fetchColumn();
    $premiere = ($curseur === false || $curseur === null);
    $sel = '"' . $cSes . '"::text AS s, "' . $cMsg . '"::text AS m' . ($cAt ? ', "' . $cAt . '"::text AS d' : '') . ($cId ? ', "' . $cId . '"::text AS i' : '');
    if ($cAt) {
        $sql = 'SELECT ' . $sel . ' FROM chat_history WHERE "' . $cAt . '" >= '
             . ($premiere ? "NOW() - INTERVAL '" . GM_FENETRE_JOURS . " days'" : 'CAST(:depuis AS timestamptz)')
             . ' ORDER BY "' . $cAt . '" ASC' . ($cId ? ', "' . $cId . '" ASC' : '') . ' LIMIT 2000';
        $st = $pdo->prepare($sql);
        $st->execute($premiere ? [] : [':depuis' => $curseur]);
        $lignes = $st->fetchAll(PDO::FETCH_ASSOC);
    } else {
        $lignes = array_reverse($pdo->query('SELECT ' . $sel . ' FROM chat_history ORDER BY "' . ($cId ?: $cMsg) . '" DESC LIMIT 300')->fetchAll(PDO::FETCH_ASSOC));
    }
    $msgs = [];
    foreach ($lignes as $r) {
        $m = gm_message($r['m']);
        $msgs[] = ['s' => (string)$r['s'], 'd' => (string)($r['d'] ?? ''), 'i' => (string)($r['i'] ?? ''), 'auteur' => $m['auteur'], 'contenu' => $m['contenu']];
    }
    // La réponse d'un échange : même session, même instant (une seule requête
    // INSERT écrit les deux lignes), sinon la réponse suivante de la session.
    $echanges = [];
    foreach ($msgs as $k => $h) {
        if ($h['auteur'] !== 'human' || strpos($h['s'], 'market_intel_') === 0) continue;
        $rep = null;
        foreach ($msgs as $k2 => $a) if ($k2 !== $k && $a['auteur'] === 'ai' && $a['s'] === $h['s'] && $a['d'] !== '' && $a['d'] === $h['d']) { $rep = $a['contenu']; break; }
        if ($rep === null) for ($k2 = $k + 1; $k2 < count($msgs); $k2++) {
            if ($msgs[$k2]['s'] !== $h['s']) continue;
            if ($msgs[$k2]['auteur'] === 'ai') $rep = $msgs[$k2]['contenu'];
            break;
        }
        $echanges[] = ['cle' => sha1($h['s'] . '|' . $h['d'] . '|' . $h['i'] . '|' . $h['contenu']), 'session' => $h['s'],
                       'date' => $h['d'], 'question' => $h['contenu'], 'reponse' => (string)$rep];
    }
    // Le registre est la SEULE déduplication : l'inscription atomique (ON CONFLICT
    // DO NOTHING) décide qui traite un échange — un échange déjà traité, ou pris
    // à l'instant par un appel concurrent, est sauté. Pas de pré-lecture : elle
    // ouvrirait une fenêtre entre « je regarde » et « je prends ».
    $demandes = 0;
    foreach ($echanges as $x) {
        $plan = cfo_gm_plan($x['question'], $x['reponse'], $memoire, $supprimes);
        if (!$plan['demande'] || !$plan['entites']) continue;
        $recu = ['session_id' => $x['session'], 'date' => $x['date'], 'source' => $plan['source'],
                 'extrait' => mb_substr(cfo_gm_sans_consigne($x['question']), 0, 140), 'entites' => $plan['entites'], 'tentatives' => 1];
        // On inscrit l'échange AVANT d'écrire : un second appel concurrent le trouvera pris.
        $ins = $pdo->prepare('INSERT INTO cfo_memoire_garde (cle, session_id, recu) VALUES (:c, :s, CAST(:r AS jsonb)) ON CONFLICT (cle) DO NOTHING');
        $ins->execute([':c' => $x['cle'], ':s' => $x['session'], ':r' => json_encode($recu, JSON_UNESCAPED_UNICODE)]);
        if ($ins->rowCount() !== 1) continue;
        $demandes++;
        foreach ($recu['entites'] as &$e) if ($e['statut'] === 'a_ecrire') $ecrire($e, $x['session']);
        unset($e);
        $finaliser($recu);
        $pdo->prepare('UPDATE cfo_memoire_garde SET recu = CAST(:r AS jsonb), traite_le = NOW() WHERE cle = :c')
            ->execute([':r' => json_encode($recu, JSON_UNESCAPED_UNICODE), ':c' => $x['cle']]);
        $recus[] = $recu;
    }
    if ($cAt && $msgs) {
        $max = max(array_map(fn($m) => $m['d'], $msgs));
        $pdo->prepare("INSERT INTO cfo_memoire_garde (cle, recu) VALUES ('__curseur__', jsonb_build_object('curseur', CAST(:d AS text)))
                       ON CONFLICT (cle) DO UPDATE SET recu = EXCLUDED.recu, traite_le = NOW()")->execute([':d' => $max]);
    } elseif ($premiere) {
        $pdo->exec("INSERT INTO cfo_memoire_garde (cle, recu) VALUES ('__curseur__', jsonb_build_object('curseur', NOW()::text)) ON CONFLICT (cle) DO NOTHING");
    }

    $compte = fn(string $s) => array_sum(array_map(fn($r) => count(array_filter($r['entites'], fn($e) => $e['statut'] === $s)), $recus));
    gm_sortie(['status' => 'ok', 'premiere_passe' => $premiere, 'echanges_lus' => count($echanges), 'demandes' => $demandes,
               'ecrites' => $compte('ecrite'), 'echecs' => $compte('echec'), 'en_attente' => $compte('en_attente'), 'recus' => $recus]);
} catch (Throwable $e) {
    gm_sortie(['status' => 'error', 'error' => 'GARDE_ECHOUEE', 'message' => $e->getMessage()], 500);
}
