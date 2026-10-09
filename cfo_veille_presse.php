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
require_once __DIR__ . '/cfo_veille_serveur.php';   // v37.40 : vos réglages (PostgreSQL) + réseau

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

// v37.40 : la liste d'origine, à laquelle s'appliquent vos réglages faits depuis l'écran
$conf = cfo_vp_config();
$cfg = $conf['cfg'] ?? null;
if (!is_array($cfg)) vp_sortie(['status' => 'error', 'error' => 'SOURCES_ABSENTES', 'message' => 'veille_sources.json absent ou illisible.'], 503);
if (!function_exists('curl_multi_init')) vp_sortie(['status' => 'error', 'error' => 'CURL_ABSENT', 'message' => "L'extension curl de PHP est requise (apt install php-curl)."], 503);

$t = cfo_vp_valider($corps);
if (!$t['lieux'] && !$t['sujets']) vp_sortie(['status' => 'error', 'error' => 'TERMES_VIDES', 'message' => 'Aucun lieu ni sujet exploitable.'], 400);
$requetes = cfo_vp_requetes($cfg, $t['lieux'], $t['sujets']);
$delai = max(2, min(20, (int)($cfg['delai_s'] ?? 8)));
$debut = microtime(true);

/* ── Toutes les requêtes en parallèle : le délai total est celui de la plus lente ── */
$reponses = cfo_vp_telecharger($requetes, $delai);

$articles = []; $diag = []; $couverture = [];
foreach ($requetes as $i => $r) {
    $corpsR = $reponses[$i]['corps']; $code = $reponses[$i]['http']; $err = $reponses[$i]['erreur'];
    $d = ['source' => $r['nom'], 'libelle' => $r['libelle'], 'q' => $r['q'], 'http' => $code];
    if ($code < 200 || $code >= 300) { $d['statut'] = 'erreur'; $d['erreur'] = $err ?: ('HTTP ' . $code); }
    else {
        // v37.41 : RSS s'il y en a un ; sinon, pour la recherche d'un site, sa page HTML de résultats
        $lu = cfo_vp_lire_reponse($corpsR, $r, $cfg);
        if ($lu['articles'] === null) { $d['statut'] = 'illisible'; $d['erreur'] = $r['type'] === 'flux' ? 'ni RSS, ni page de résultats lisible' : 'pas un flux RSS'; }
        else { $d['statut'] = $lu['articles'] ? 'ok' : 'vide'; $d['n'] = count($lu['articles']); $d['mode'] = $lu['mode']; array_push($articles, ...$lu['articles']); }
    }
    $diag[] = $d;
    // v37.41 : le bilan de chaque média local — jamais d'échec silencieux
    if (!empty($r['domaine'])) {
        $couverture[$r['domaine']]['nom'] = $r['media'] ?? $r['nom'];
        $couverture[$r['domaine']]['domaine'] = $r['domaine'];
        $couverture[$r['domaine']][$r['type'] === 'flux' ? 'site' : 'google'] = array_intersect_key($d, array_flip(['statut', 'n', 'mode', 'erreur']));
    }
}

$retenus = cfo_vp_selection($articles, $t['lieux'], $t['sujets'], $cfg);
foreach ($couverture as $dom => &$c) {
    $c['retenus'] = count(array_filter($retenus, fn($a) => $a['domaine'] === $dom || substr($a['domaine'], -strlen($dom) - 1) === '.' . $dom));
}
unset($c);
vp_sortie([
    'status' => 'ok',
    'articles' => $retenus,
    'lus' => count($articles),
    'requetes' => $diag,
    'couverture' => array_values($couverture),
    'sources_ok' => count(array_filter($diag, fn($d) => in_array($d['statut'], ['ok', 'vide'], true))),
    'sources_ko' => count(array_filter($diag, fn($d) => !in_array($d['statut'], ['ok', 'vide'], true))),
    'duree_ms' => (int)round((microtime(true) - $debut) * 1000),
    'termes' => $t,
]);
