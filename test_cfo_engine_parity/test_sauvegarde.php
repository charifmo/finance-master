<?php
/**
 * v37.96 — SAUVEGARDE HORS DU VPS (Telegram) ET SURVEILLANCE, contre un FAUX Telegram (php -S) : envoi du fichier,
 * contenu restaurable, rotation, alerte une fois puis « résolu », échec d'envoi signalé, restauration avec
 * sauvegarde préalable, lecture du jeton du bot « CFO » et du chat. Décor fictif, aucun vrai jeton.
 */
$ko = 0; $n = 0;
function v(string $t, bool $ok, $d = '') { global $ko, $n; $n++; if (!$ok) $ko++; printf("  %s %-78s %s\n", $ok ? '✅' : '❌', $t, $ok ? '' : (is_string($d) ? $d : json_encode($d, JSON_UNESCAPED_UNICODE))); }
echo "\n  SAUVEGARDE HORS DU VPS ET SURVEILLANCE\n  " . str_repeat('─', 80) . "\n";
$R = dirname(__DIR__);
$t = sys_get_temp_dir() . '/fm_sauvegarde_' . bin2hex(random_bytes(4)); mkdir($t); mkdir("$t/etapes");
$journal = "$t/telegram.log";
file_put_contents("$t/mock.php", '<?php
$p = parse_url($_SERVER["REQUEST_URI"], PHP_URL_PATH);
if ($p === "/healthz") { http_response_code(is_file(__DIR__ . "/n8n_ko") ? 502 : 200); echo "ok"; return; }
$f = []; foreach ($_FILES as $k => $x) $f[$k] = ["nom" => $x["name"], "octets" => $x["size"], "contenu" => base64_encode(file_get_contents($x["tmp_name"]))];
file_put_contents(__DIR__ . "/telegram.log", json_encode(["chemin" => $p, "post" => $_POST, "fichiers" => $f]) . "\n", FILE_APPEND);
header("Content-Type: application/json");
echo is_file(__DIR__ . "/tg_ko") ? json_encode(["ok" => false, "description" => "Bad Request: chat not found"]) : json_encode(["ok" => true]);');
$port = 24000 + random_int(0, 2000);
$srv = proc_open(['php', '-S', "127.0.0.1:$port", "$t/mock.php"], [['file', '/dev/null', 'r'], ['file', '/dev/null', 'w'], ['file', '/dev/null', 'w']], $pp, $t);
usleep(500000);
file_put_contents("$t/finance.json", json_encode(['comptes' => [['id' => 'a', 'label' => 'Compte Fictif']], 'donneesAnnuelles' => ['2026' => ['revenus' => []]]]));
file_put_contents("$t/sante.json", json_encode(['profil' => ['nom' => 'FICTIF'], 'bilans' => [['date' => '2026-01-01']]]));
file_put_contents("$t/conf.json", json_encode(['bot_token' => 'JETON_TEST', 'chat_id' => '42', 'api' => "http://127.0.0.1:$port", 'dossier' => "$t/backups", 'n8n_sante' => "http://127.0.0.1:$port/healthz", 'garder' => 3]));
$env = ['FM_SAUVEGARDE_CONF' => "$t/conf.json", 'FM_SAUVEGARDE_ETAT' => "$t/etat.json", 'FM_FINANCE_FICHIER' => "$t/finance.json", 'SANTE_DATA_FILE' => "$t/sante.json", 'PATH' => getenv('PATH')];
$cmd = function (array $a) use ($R, $env) {
    $p = proc_open(array_merge(['php', "$R/sauvegarde.php"], $a), [['pipe', 'r'], ['pipe', 'w'], ['pipe', 'w']], $pp, $R, $env);
    fclose($pp[0]); $o = stream_get_contents($pp[1]); stream_get_contents($pp[2]); $c = proc_close($p);
    return [$c, json_decode(trim($o), true), $o];
};
$tg = fn() => array_map(fn($l) => json_decode($l, true), array_filter(explode("\n", (string)@file_get_contents($journal))));
try {
    [$c, $r] = $cmd(['quotidienne']);
    $L = glob("$t/backups/finance-master_*.json.gz");
    $envoi = $tg()[0] ?? [];
    v('A. sauvegarde quotidienne : fichier compressé hors du site, envoyé au bot (sendDocument, chat 42)', $c === 0 && $r['ok'] && count($L) === 1 && $envoi['chemin'] === '/botJETON_TEST/sendDocument' && $envoi['post']['chat_id'] === '42' && !empty($envoi['fichiers']['document']), [$c, $r, $envoi['chemin'] ?? null]);
    $p = json_decode(gzdecode(base64_decode($envoi['fichiers']['document']['contenu'])), true);
    v('  → le fichier reçu par Telegram contient Finance ET Santé, restaurables tels quels', $p['finance']['comptes'][0]['label'] === 'Compte Fictif' && $p['sante']['profil']['nom'] === 'FICTIF');
    v('  → la légende dit ce qui est sauvegardé ; l\'état est noté (pour la surveillance)', str_contains($envoi['post']['caption'], '1 comptes') && str_contains($envoi['post']['caption'], 'Santé (1 bilans)') && json_decode(file_get_contents("$t/etat.json"), true)['derniere']['telegram'] === 'envoyée');
    for ($i = 0; $i < 3; $i++) { sleep(1); $cmd(['quotidienne']); }
    v('  → rotation : 4 sauvegardes faites, les 3 plus récentes gardées', count(glob("$t/backups/finance-master_*.json.gz")) === 3);
    @unlink($journal);
    [, $s] = $cmd(['surveillance']);
    v('B. surveillance, tout va bien : aucun problème, aucun message', $s['problemes'] === [] && $tg() === [], $s);
    touch("$t/n8n_ko");
    [, $s] = $cmd(['surveillance']); [, $s2] = $cmd(['surveillance']);
    $m = $tg();
    v('  → n8n tombe : UNE alerte Telegram (pas une par heure)', isset($s['problemes']['n8n']) && $s['alertes_envoyees'] === ['n8n'] && $s2['alertes_envoyees'] === [] && count($m) === 1 && str_contains($m[0]['post']['text'], 'n8n ne répond pas'), [$s, $s2, count($m)]);
    unlink("$t/n8n_ko"); @unlink($journal);
    [, $s] = $cmd(['surveillance']);
    v('  → n8n revient : message « résolu »', $s['problemes'] === [] && str_contains($tg()[0]['post']['text'] ?? '', 'résolu'));
    touch("$t/tg_ko");
    [$c, $r] = $cmd(['quotidienne']);
    v('C. Telegram refuse l\'envoi : la sauvegarde est marquée en échec (raison gardée)', $c === 1 && $r['ok'] === false && str_contains($r['telegram'], 'chat not found'), $r);
    unlink("$t/tg_ko"); @unlink($journal);
    [, $s] = $cmd(['surveillance']);
    v('  → la surveillance l\'alerte à l\'heure suivante', isset($s['problemes']['sauvegarde']) && str_contains($s['problemes']['sauvegarde'], 'échoué'), $s);
    $L = glob("$t/backups/finance-master_*.json.gz"); sort($L);
    file_put_contents("$t/finance.json", json_encode(['comptes' => [], 'abime' => true]));
    [$c] = $cmd(['restaurer', $L[0]]);
    v('D. restaurer sans --oui : refusé', $c === 2);
    sleep(1);
    [$c, $r] = $cmd(['restaurer', $L[0], '--oui']);
    v('  → avec --oui : l\'état revient, et l\'état abîmé a été sauvegardé AVANT', $c === 0 && json_decode(file_get_contents("$t/finance.json"), true)['comptes'][0]['label'] === 'Compte Fictif' && !empty($r['sauvegarde_avant']), $r);
    $p = proc_open(['php', "$R/sauvegarde.php", 'jeton'], [['pipe', 'r'], ['pipe', 'w'], ['pipe', 'w']], $pp, $R, $env);
    fwrite($pp[0], json_encode([['name' => 'Telegram santé account', 'type' => 'telegramApi', 'data' => ['accessToken' => 'AUTRE']], ['name' => 'CFO V2 Telegram API', 'type' => 'telegramApi', 'data' => ['accessToken' => 'BON']], ['name' => 'OpenAi', 'type' => 'openAiApi', 'data' => ['apiKey' => 'x']]])); fclose($pp[0]);
    $jeton = stream_get_contents($pp[1]); proc_close($p);
    v('E. jeton du bot : celui de l\'identifiant « CFO », pas celui du bot santé', $jeton === 'BON', $jeton);
    touch("$t/etapes/tg_777.json"); sleep(1); touch("$t/etapes/tg_-1001234.json"); touch("$t/etapes/web_1.json");
    $ch = fn($e) => trim(shell_exec('php ' . escapeshellarg("$R/sauvegarde.php") . ' chat ' . escapeshellarg($e) . ' ' . escapeshellarg("$t/etapes")));
    v('  → chat : TELEGRAM_CHAT_IDS d\'abord (555), sinon la dernière conversation Telegram vue (-1001234)', $ch('555,666') === '555' && $ch('') === '-1001234');
    $src = file_get_contents("$R/sauvegarde.php");
    v('F. jamais par le site (404 hors ligne de commande) ; réglages lus hors du dépôt, root seul', str_contains($src, "PHP_SAPI !== 'cli'") && str_contains($src, '/etc/finance-master/sauvegarde.conf') && str_contains(file_get_contents("$R/install.sh"), 'chmod 600 "${conf}"'));
} finally {
    proc_terminate($srv);
    exec('rm -rf ' . escapeshellarg($t));
}
echo $ko === 0 ? "\n  ✅ TOUT PASSE — $n contrôles\n" : "\n  ❌ $ko contrôle(s) en échec sur $n\n";
exit($ko === 0 ? 0 : 1);
