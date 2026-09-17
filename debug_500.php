<?php
/**
 * ============================================================================
 *  debug_500.php — diagnostic de l'erreur 500 sur pending_commit.php
 * ----------------------------------------------------------------------------
 *  USAGE, sur le VPS :   cd /var/www/finance && php debug_500.php
 *
 *  CLI UNIQUEMENT. Le script refuse de s'exécuter via le web : il affiche des
 *  chemins, des extraits de configuration et des messages d'erreur bruts, rien
 *  de tout cela n'a à être joignable depuis Internet. À supprimer une fois le
 *  diagnostic terminé (rm debug_500.php).
 *
 *  Il réutilise le VRAI chargeur d'état de pending_commit.php (inclus en mode
 *  CLI, qui ne joue pas le routage HTTP) — pas une copie qui pourrait diverger.
 * ============================================================================
 */
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    exit("debug_500.php : CLI uniquement. Lancez « php debug_500.php » en SSH.\n");
}

ini_set('display_errors', '1');
ini_set('display_startup_errors', '1');
error_reporting(E_ALL);

$LIGNE = str_repeat('─', 74);
function titre($t) { global $LIGNE; echo "\n$LIGNE\n  $t\n$LIGNE\n"; }
function ok($m)  { echo "  ✅ $m\n"; }
function ko($m)  { echo "  ❌ $m\n"; }
function info($m){ echo "     $m\n"; }

echo "\n  DIAGNOSTIC pending_commit.php — ", date('c'), "\n";

/* ── 1. Environnement ────────────────────────────────────────────────────── */
titre('1. ENVIRONNEMENT PHP');
info('PHP            : ' . PHP_VERSION);
info('memory_limit   : ' . ini_get('memory_limit'));
info('max_execution  : ' . ini_get('max_execution_time') . 's');
foreach (['pdo_pgsql','mbstring','json','intl'] as $ext) {
    extension_loaded($ext) ? ok("extension $ext chargée") : ko("extension $ext ABSENTE" . ($ext === 'intl' ? ' (non bloquant : repli sur table d\'accents)' : ''));
}

/* ── 2. Fichiers ─────────────────────────────────────────────────────────── */
titre('2. FICHIERS ET PERMISSIONS');
foreach (['cfo_intent_engine.php','pending_commit.php','save_data.php','db_config.php'] as $f) {
    $p = __DIR__ . '/' . $f;
    if (!file_exists($p))      { ko("$f ABSENT ($p)"); continue; }
    if (!is_readable($p))      { ko("$f présent mais NON LISIBLE par " . get_current_user()); continue; }
    ok(sprintf('%-24s %7d o   %s   %s', $f, filesize($p), substr(sprintf('%o', fileperms($p)), -4),
        function_exists('posix_getpwuid') ? (posix_getpwuid(fileowner($p))['name'] ?? '?') : fileowner($p)));
}
$pend = __DIR__ . '/pending';
if (!is_dir($pend))            ko("dossier pending/ ABSENT ($pend)");
elseif (!is_writable($pend))   ko("dossier pending/ NON INSCRIPTIBLE — c'est une cause directe de HTTP 500");
else                           ok('dossier pending/ inscriptible');

/* ── 3. Chargement du moteur ─────────────────────────────────────────────── */
titre('3. CHARGEMENT DU MOTEUR');
try {
    require_once __DIR__ . '/pending_commit.php';   // CLI → définit les fonctions, ne route pas
    ok('pending_commit.php + cfo_intent_engine.php chargés');
    ok('catalogue : ' . count(cfo_catalog_names()) . ' fonctions');
} catch (Throwable $e) {
    ko(get_class($e) . ' : ' . $e->getMessage());
    info($e->getFile() . ':' . $e->getLine());
    exit(1);
}

/* ── 4. État financier ───────────────────────────────────────────────────── */
titre('4. LECTURE DE L\'ÉTAT FINANCIER');
list($fd, $src) = cfo_load_finance_state();
info("source : $src");
if (!is_object($fd)) {
    ko('état illisible → l\'endpoint répond 503 (pas 500). Vérifier db_config.php / la table finance_state.');
    exit(1);
}
ok('état chargé — ' . number_format(strlen(json_encode($fd)) / 1024, 1) . ' Ko');
if ($src === 'file' && file_exists(__DIR__ . '/db_config.php')) {
    ko('db_config.php existe mais Postgres n\'a PAS répondu → repli sur finance_data.json.');
    info('L\'app tourne donc sur le fichier plat, pas sur la base. C\'est précisément ce que');
    info('la v16.3 (« Bilan Indestructible ») cherchait à éviter. Le fichier est gitignored,');
    info('donc un git reset ne l\'efface pas — mais la persistance Postgres est inopérante.');
    info('Corriger l\'hôte dans db_config.php, puis relancer ce script pour confirmer.');
}
$annees = isset($fd->donneesAnnuelles) ? array_keys(get_object_vars($fd->donneesAnnuelles)) : [];
info('exercices : ' . (count($annees) ? implode(', ', $annees) : 'AUCUN'));
info('masterAssets : ' . (isset($fd->masterAssets) && is_array($fd->masterAssets) ? count($fd->masterAssets) . ' actif(s)' : 'absent'));
if (isset($fd->masterAssets) && is_array($fd->masterAssets)) {
    foreach ($fd->masterAssets as $a) info('   · ' . (oget($a, 'name') ?: oget($a, 'nom') ?: '(sans nom)'));
}

/* ── 5. Compilation du payload réel ──────────────────────────────────────── */
titre('5. COMPILATION DU PAYLOAD');
$PAYLOAD = '{"session_id":"debug_500","calls":[{"function":"update_asset_valuation","args":{"asset_name":"projet_studio","new_value":1092000}},{"function":"update_fixed_expense","args":{"name":"Credit Studio","amount":5445}}]}';
$body = json_decode($PAYLOAD);
info('payload : ' . count($body->calls) . ' appel(s)');
$t0 = microtime(true);
try {
    $res = cfo_compile($body->calls, $fd, []);
    $int = $res['_internal'] ?? null; unset($res['_internal']);
    ok(sprintf('compilation OK en %.3f s — pic mémoire %.1f Mo', microtime(true) - $t0, memory_get_peak_usage(true) / 1048576));
    info('status      : ' . ($res['status'] ?? '?'));
    info('ops_summary : ' . json_encode($res['ops_summary'] ?? null));
    if (!empty($res['error_ops']))             info('error_ops   : ' . json_encode($res['error_ops'], JSON_UNESCAPED_UNICODE));
    if (!empty($res['clarifications_needed'])) info('clarifs     : ' . json_encode($res['clarifications_needed'], JSON_UNESCAPED_UNICODE));
    if ($int) info('has_effective : ' . var_export($int['has_effective'], true) . ' → pending ' . ($int['has_effective'] ? 'sera écrit' : 'NON écrit'));
} catch (Throwable $e) {
    ko('>>> C\'EST ICI QUE ÇA CASSE <<<');
    ko(get_class($e) . ' : ' . $e->getMessage());
    info('FICHIER : ' . $e->getFile());
    info('LIGNE   : ' . $e->getLine());
    echo "\n  Trace :\n";
    foreach (array_slice($e->getTrace(), 0, 8) as $i => $f) {
        printf("    #%d %s() @ %s:%s\n", $i, $f['function'] ?? '?', basename($f['file'] ?? '?'), $f['line'] ?? '?');
    }
    exit(1);
}

/* ── 6. Appel HTTP réel ──────────────────────────────────────────────────── */
titre('6. APPEL HTTP RÉEL (boucle locale)');
$url = 'https://n8n.beau.ink/finance/pending_commit.php';
$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_POST => true, CURLOPT_POSTFIELDS => $PAYLOAD,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 30,
]);
$out  = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err  = curl_error($ch);
curl_close($ch);
if ($err) { ko("curl : $err"); }
else {
    ($code >= 200 && $code < 300) ? ok("HTTP $code") : ko("HTTP $code  ← le corps ci-dessous donne la cause exacte");
    echo "\n", substr($out, 0, 2000), "\n";
}

titre('FIN — pensez à supprimer ce script : rm ' . __DIR__ . '/debug_500.php');
