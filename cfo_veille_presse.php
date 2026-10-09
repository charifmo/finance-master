<?php
declare(strict_types=1);
/**
 * ============================================================================
 *  cfo_veille_presse.php — REVUE DE PRESSE LOCALE (v37.39)
 * ----------------------------------------------------------------------------
 *  POST (JSON) {action:"revue", lieux:[…], sujets:[…]}  + en-tête X-Requested-With
 *
 *  Appelé par la Recherche Éclair AVANT l'agent : interroge Google Actualités
 *  (restreint à la presse locale et nationale, en français et en arabe) et les
 *  flux de recherche des sites marrakchis, puis rend les articles datés et
 *  sourcés, triés par pertinence pour CE bien. Lecture seule.
 *
 *  Le navigateur n'envoie que des TERMES (nettoyés, plafonnés) ; les URL sont
 *  construites ici à partir de veille_sources.json. Aucune URL arbitraire :
 *  rien à détourner vers le réseau interne.
 *
 *  Une source qui ne répond pas, ou qui ne parle pas RSS, est comptée et dite
 *  (« diagnostic ») — jamais remplacée par du contenu inventé.
 * ============================================================================
 */
require_once __DIR__ . '/cfo_veille_lib.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function vp_sortie(array $p, int $code = 200): void {
    http_response_code($code);
    echo json_encode($p, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') vp_sortie(['status' => 'error', 'error' => 'METHODE', 'message' => 'POST {action:"revue"} attendu.'], 405);
if (($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') === '') vp_sortie(['status' => 'error', 'error' => 'ENTETE_MANQUANT', 'message' => 'En-tête X-Requested-With absent.'], 400);
$hote = $_SERVER['HTTP_HOST'] ?? '';
$origine = $_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
if ($origine !== '') {
    $hO = parse_url($origine, PHP_URL_HOST);
    if ($hO !== null && strcasecmp((string)$hO, (string)preg_replace('/:\d+$/', '', $hote)) !== 0) {
        vp_sortie(['status' => 'error', 'error' => 'ORIGINE_ETRANGERE', 'message' => "Requête émise depuis « {$hO} »."], 403);
    }
}
$corps = json_decode((string)file_get_contents('php://input'), true) ?: [];
if (($corps['action'] ?? '') !== 'revue') vp_sortie(['status' => 'error', 'error' => 'ACTION_INCONNUE', 'message' => 'Action attendue : {action:"revue"}.'], 400);

$cfg = json_decode((string)@file_get_contents(__DIR__ . '/veille_sources.json'), true);
if (!is_array($cfg)) vp_sortie(['status' => 'error', 'error' => 'SOURCES_ABSENTES', 'message' => 'veille_sources.json absent ou illisible.'], 503);
if (!function_exists('curl_multi_init')) vp_sortie(['status' => 'error', 'error' => 'CURL_ABSENT', 'message' => "L'extension curl de PHP est requise (apt install php-curl)."], 503);

$t = cfo_vp_valider($corps);
if (!$t['lieux'] && !$t['sujets']) vp_sortie(['status' => 'error', 'error' => 'TERMES_VIDES', 'message' => 'Aucun lieu ni sujet exploitable.'], 400);
$requetes = cfo_vp_requetes($cfg, $t['lieux'], $t['sujets']);
$delai = max(2, min(20, (int)($cfg['delai_s'] ?? 8)));
$debut = microtime(true);

/* ── Toutes les requêtes en parallèle : le délai total est celui de la plus lente ── */
$mh = curl_multi_init(); $poignees = [];
foreach ($requetes as $i => $r) {
    $ch = curl_init($r['url']);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_MAXREDIRS => 3,
        CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS, CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
        CURLOPT_TIMEOUT => $delai, CURLOPT_CONNECTTIMEOUT => min(5, $delai), CURLOPT_ENCODING => '',
        CURLOPT_USERAGENT => 'Mozilla/5.0 (compatible; FinanceMaster-Veille/1.0)',
        CURLOPT_HTTPHEADER => ['Accept: application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5']]);
    curl_multi_add_handle($mh, $ch); $poignees[$i] = $ch;
}
do { $st = curl_multi_exec($mh, $actifs); if ($actifs) curl_multi_select($mh, 1.0); } while ($actifs && $st === CURLM_OK);

$articles = []; $diag = [];
foreach ($poignees as $i => $ch) {
    $r = $requetes[$i];
    $corpsR = (string)curl_multi_getcontent($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_multi_remove_handle($mh, $ch); curl_close($ch);
    $d = ['source' => $r['nom'], 'libelle' => $r['libelle'], 'q' => $r['q'], 'http' => $code];
    if ($code < 200 || $code >= 300) { $d['statut'] = 'erreur'; $d['erreur'] = $err ?: ('HTTP ' . $code); $diag[] = $d; continue; }
    $lus = cfo_vp_lire_rss($corpsR, $r, $cfg);
    if ($lus === null) { $d['statut'] = 'illisible'; $d['erreur'] = "pas un flux RSS"; $diag[] = $d; continue; }
    $d['statut'] = $lus ? 'ok' : 'vide'; $d['n'] = count($lus);
    $diag[] = $d;
    array_push($articles, ...$lus);
}
curl_multi_close($mh);

$retenus = cfo_vp_selection($articles, $t['lieux'], $t['sujets'], $cfg);
vp_sortie([
    'status' => 'ok',
    'articles' => $retenus,
    'lus' => count($articles),
    'requetes' => $diag,
    'sources_ok' => count(array_filter($diag, fn($d) => in_array($d['statut'], ['ok', 'vide'], true))),
    'sources_ko' => count(array_filter($diag, fn($d) => !in_array($d['statut'], ['ok', 'vide'], true))),
    'duree_ms' => (int)round((microtime(true) - $debut) * 1000),
    'termes' => $t,
]);
