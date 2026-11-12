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
 *
 *  v37.42 : aucun flux RSS de journal n'est lu (ils n'en ont pas d'ouvert) :
 *  Google et Bing Actualités restreints au site, sa page de recherche et sa
 *  page d'accueil lues en HTML. curl n'est plus requis : sans lui, les
 *  sources passent une à une, dans un budget de temps (budget_s).
 * ============================================================================
 */
require_once __DIR__ . '/cfo_veille_serveur.php';   // v37.40 : vos réglages (PostgreSQL) + réseau
if (is_file(__DIR__ . '/cfo_veille_collecte_lib.php')) require_once __DIR__ . '/cfo_veille_collecte_lib.php';   // v37.134 : la collecte continue (absente : revue comme avant)

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
// v37.42 : curl n'est plus requis — sans lui, les sources sont lues une à une (plus lent, même résultat)
$reseau = cfo_vp_prerequis();
if ($reseau['mode_reseau'] === 'impossible') vp_sortie(['status' => 'error', 'error' => 'RESEAU_IMPOSSIBLE', 'commande' => $reseau['commande'],
    'message' => 'Le PHP du serveur ne peut pas joindre le web (ni curl, ni allow_url_fopen). Sur le VPS : ' . ($reseau['commande'] ?: 'activer allow_url_fopen')], 503);

$t = cfo_vp_valider($corps);
if (!$t['lieux'] && !$t['sujets']) vp_sortie(['status' => 'error', 'error' => 'TERMES_VIDES', 'message' => 'Aucun lieu ni sujet exploitable.'], 400);
//  v37.137 — « LES RÉSULTATS DES RÉSEAUX SOCIAUX NE SONT PAS LÀ » : DuckDuckGo bloque l'adresse du serveur (page de consentement), Bing (web)
//  ne rend rien. Avec une clé Brave Search (API officielle), Brave REMPLACE DuckDuckGo pour les réseaux sociaux, forums et annonces —
//  dans le plafond d'appels du mois (réservé AVANT l'appel ; plafond atteint : DuckDuckGo comme avant).
$brave = function_exists('cfo_vp_brave_config') ? cfo_vp_brave_config() : null;
$braveInfo = ['actif' => false, 'appels' => 0, 'raison' => $brave ? '' : 'pas de clé'];
if ($brave) {
    $cfgB = $cfg; $cfgB['moteurs'] = array_values(array_filter($cfg['moteurs'] ?? [], fn($m) => ($m['format'] ?? '') !== 'html_ddg'));
    $cfgB['moteurs'][] = cfo_vp_moteur_brave();
    $reqB = cfo_vp_requetes($cfgB, $t['lieux'], $t['sujets']);
    $nB = count(array_filter($reqB, fn($r) => ($r['format'] ?? '') === 'brave_json'));
    $pdoB = function_exists('vc_pdo') ? vc_pdo() : null;
    $okB = false;
    if ($nB > 0 && $pdoB) {
        try { vc_schema($pdoB); $okB = vc_reserver_brave($pdoB, $nB, (int)$brave['max_mois']); }
        catch (Throwable $e) { $braveInfo['raison'] = 'budget illisible : ' . mb_substr($e->getMessage(), 0, 120); }
    } elseif ($nB > 0) $braveInfo['raison'] = 'base indisponible (le plafond ne peut pas être compté)';
    if ($okB) { $cfg = $cfgB; $braveInfo = ['actif' => true, 'appels' => $nB, 'raison' => '']; }
    elseif ($nB > 0 && $braveInfo['raison'] === '') $braveInfo['raison'] = 'plafond du mois atteint';
}
$requetes = cfo_vp_requetes($cfg, $t['lieux'], $t['sujets']);
$delai = max(2, min(20, (int)($cfg['delai_s'] ?? 8)));
$budget = max(5, min(25, (int)($cfg['budget_s'] ?? 20)));
$debut = microtime(true);

/* ── Avec curl, toutes en parallèle (le délai total est celui de la plus lente) ; sans curl, une à une ── */
$reponses = cfo_vp_telecharger($requetes, $delai, $budget);

$articles = []; $diag = []; $couverture = []; $trouves = [];
foreach ($requetes as $i => $r) {
    // v37.42 : un moteur est lu comme sa liste de résultats, une page de journal en HTML — jamais un RSS de journal
    $b = cfo_vp_bilan($r, $reponses[$i], $cfg);
    $trouves[$i] = $b['articles'];
    array_push($articles, ...$b['articles']); unset($b['articles']);
    $d = ['source' => $r['nom'], 'canal' => $r['canal'], 'libelle' => $r['libelle'], 'q' => $r['q'], 'http' => $reponses[$i]['http']] + $b;
    $diag[] = $d;
    // v37.41-42 : le bilan de chaque média local, porte par porte — jamais d'échec silencieux
    if (!empty($r['domaine'])) {
        $couverture[$r['domaine']]['nom'] = $r['media'] ?? $r['nom'];
        $couverture[$r['domaine']]['domaine'] = $r['domaine'];
        $couverture[$r['domaine']]['canaux'][] = ['canal' => $r['canal'], 'nom' => cfo_vp_nom_canal($r)] + array_intersect_key($b, array_flip(['statut', 'n', 'mode', 'erreur']));
        $couverture[$r['domaine']]['_req'] = $r;
        if (!empty($r['groupe'])) $couverture[$r['domaine']]['groupe'] = $r['groupe'];
    }
}

//  v37.125 — la mémoire de la veille de CE bien (ses lieux) : les articles déjà trouvés reviennent, même si le moteur ne les rend plus
$fMem = null; $memoire = [];
if ($t['lieux']) {
    $dMem = __DIR__ . '/pending/veille_memoire';
    if (!is_dir($dMem)) @mkdir($dMem, 0775, true);
    $fMem = $dMem . '/' . substr(sha1(implode('|', array_map('cfo_vp_norm', $t['lieux']))), 0, 20) . '.json';
    $memoire = is_file($fMem) ? (json_decode((string)@file_get_contents($fMem), true) ?: []) : [];
}
$frais = count($articles);
$deja = [];
foreach ($articles as $a) $deja[(string)$a['url']] = true;
foreach (cfo_vp_memoire_articles($memoire) as $a) if (!isset($deja[$a['url']])) { $articles[] = $a; $deja[$a['url']] = true; }
//  v37.134 — LA COLLECTE CONTINUE : les requêtes de ce bien sont enregistrées (le cron les rejoue chaque jour, sans limite de 20 s) ;
//  ce qu'elles ont accumulé jusqu'ici rejoint les candidats. Sans base : la revue fonctionne comme avant.
$collecte = null;
if ($t['lieux'] && function_exists('vc_revue')) {
    $pdoV = vc_pdo($raisonV);
    if ($pdoV) {
        try {
            $rv = vc_revue($pdoV, $t['lieux'], $t['sujets'], $requetes, $trouves, $cfg);
            foreach ($rv['corpus'] as $a) if (!isset($deja[$a['url']])) { $articles[] = $a; $deja[$a['url']] = true; }
            $collecte = $rv['etat'] + ['corpus' => count($rv['corpus'])];
        } catch (Throwable $e) { $collecte = ['erreur' => mb_substr($e->getMessage(), 0, 200)]; }
    } else $collecte = ['erreur' => (string)$raisonV];
}
$retenus = cfo_vp_selection($articles, $t['lieux'], $t['sujets'], $cfg);
//  v37.123 — « élargir les articles, puis les revérifier avec l'IA » : jusqu'à max_candidats (50), Marrakech sans sujet compris ;
//  l'appli les fait noter par l'IA et ne garde que ceux qui comptent pour CE bien (repli : « articles », le tri habituel)
$maxC = max((int)($cfg['max_articles'] ?? 20), min(80, (int)($cfg['max_candidats'] ?? 50)));
$candidats = cfo_vp_selection($articles, $t['lieux'], $t['sujets'], ['max_articles' => $maxC, 'quota_zone' => (int)round($maxC * 0.4), 'large' => true] + $cfg);
if ($fMem) {
    $brut = [];
    foreach ($articles as $a) $brut[(string)$a['url']] = $a;
    $aGarder = array_values(array_filter(array_map(fn($c) => $brut[(string)$c['url']] ?? null, $candidats)));
    $tmp = $fMem . '.' . getmypid() . '.tmp';
    if (@file_put_contents($tmp, json_encode(cfo_vp_memoire_maj($memoire, $aGarder), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)) !== false) @rename($tmp, $fMem); else @unlink($tmp);
}
//  v37.111 — une source = un site, une page / un groupe précis, ou une famille (réseaux sociaux, forums, annonces)
foreach ($couverture as $dom => &$c) { $c['retenus'] = cfo_vp_retenus_de($retenus, $c['_req']); unset($c['_req']); }
unset($c);
vp_sortie([
    'status' => 'ok',
    'articles' => $retenus,
    'candidats' => $candidats,
    'memoire' => ['articles' => count($memoire), 'frais' => $frais],
    'collecte' => $collecte,
    'brave' => $braveInfo,
    'lus' => count($articles),
    'requetes' => $diag,
    'couverture' => array_values($couverture),
    'sources_ok' => count(array_filter($diag, fn($d) => in_array($d['statut'], ['ok', 'vide'], true))),
    'sources_ko' => count(array_filter($diag, fn($d) => in_array($d['statut'], ['erreur', 'illisible'], true))),
    'sources_sautees' => count(array_filter($diag, fn($d) => $d['statut'] === 'saute')),
    'reseau' => array_intersect_key($reseau, array_flip(['mode_reseau', 'manquants', 'commande'])),
    'duree_ms' => (int)round((microtime(true) - $debut) * 1000),
    'termes' => $t,
]);
