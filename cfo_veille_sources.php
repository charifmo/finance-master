<?php
declare(strict_types=1);
/**
 * ============================================================================
 *  cfo_veille_sources.php — LES MÉDIAS DE LA REVUE DE PRESSE, DEPUIS L'ÉCRAN (v37.40)
 * ----------------------------------------------------------------------------
 *  GET                                   → la liste effective, l'origine de chaque média
 *  POST {action:"enregistrer", sources}  → remplace VOS réglages (liste complète)
 *  POST {action:"reinitialiser"}         → revient à la liste d'origine
 *  POST {action:"tester", source}        → interroge ce média maintenant (Google + flux)
 *  Les POST exigent X-Requested-With et la même origine.
 *
 *  Chaque média est CONTRÔLÉ : un vrai nom de domaine public (ni IP, ni
 *  localhost), un flux RSS éventuel situé SUR ce domaine et marquant {q}.
 *  Le serveur ne va donc chercher que chez les médias que vous avez déclarés.
 * ============================================================================
 */
require_once __DIR__ . '/cfo_veille_serveur.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function vs_sortie(array $p, int $code = 200): void {
    http_response_code($code);
    echo json_encode($p, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR);
    exit;
}
function vs_etat(): array {
    $c = cfo_vp_config();
    if (!$c) vs_sortie(['status' => 'error', 'error' => 'SOURCES_ABSENTES', 'message' => 'veille_sources.json absent ou illisible.'], 503);
    return ['status' => 'ok', 'sources' => $c['cfg']['sources'], 'supprimees' => $c['supprimees'], 'stockage' => $c['stockage'],
            'raison' => $c['raison'], 'maj' => $c['maj'], 'max' => CFO_VP_MAX_SOURCES];
}

$methode = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($methode === 'GET') vs_sortie(vs_etat());
if ($methode !== 'POST') vs_sortie(['status' => 'error', 'error' => 'METHODE', 'message' => 'GET ou POST.'], 405);
if (($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') === '') vs_sortie(['status' => 'error', 'error' => 'ENTETE_MANQUANT', 'message' => 'En-tête X-Requested-With absent.'], 400);
$hote = $_SERVER['HTTP_HOST'] ?? '';
$origine = $_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
if ($origine !== '') {
    $hO = parse_url($origine, PHP_URL_HOST);
    if ($hO !== null && strcasecmp((string)$hO, (string)preg_replace('/:\d+$/', '', $hote)) !== 0) {
        vs_sortie(['status' => 'error', 'error' => 'ORIGINE_ETRANGERE', 'message' => "Requête émise depuis « {$hO} »."], 403);
    }
}
$corps = json_decode((string)file_get_contents('php://input'), true) ?: [];
$action = $corps['action'] ?? '';
$def = cfo_vp_defauts();
if (!$def) vs_sortie(['status' => 'error', 'error' => 'SOURCES_ABSENTES', 'message' => 'veille_sources.json absent ou illisible.'], 503);

if ($action === 'tester') {
    $v = cfo_vp_valider_source($corps['source'] ?? null);
    if (isset($v['erreur'])) vs_sortie(['status' => 'error', 'error' => 'SOURCE_INVALIDE', 'message' => $v['erreur']], 400);
    if (!function_exists('curl_multi_init')) vs_sortie(['status' => 'error', 'error' => 'CURL_ABSENT', 'message' => "L'extension curl de PHP est requise."], 503);
    $s = $v['source'];
    $cfg = $def; $cfg['sources'] = [$s];
    $req = cfo_vp_requetes_test($cfg, $s);
    $rep = cfo_vp_telecharger($req, max(2, min(20, (int)($def['delai_s'] ?? 8))));
    $res = [];
    foreach ($req as $i => $r) {
        $x = $rep[$i];
        $d = ['canal' => $r['type'] === 'flux' ? 'flux' : 'google', 'q' => $r['q']];
        if ($x['http'] < 200 || $x['http'] >= 300) { $d += ['statut' => 'erreur', 'erreur' => $x['erreur'] ?: ('HTTP ' . $x['http'])]; }
        else {
            $lus = cfo_vp_lire_rss($x['corps'], $r, $cfg);
            if ($lus === null) $d += ['statut' => 'illisible', 'erreur' => 'pas un flux RSS'];
            else {
                usort($lus, fn($a, $b) => ($b['ts'] ?? 0) <=> ($a['ts'] ?? 0));
                $d += ['statut' => $lus ? 'ok' : 'vide', 'n' => count($lus),
                       'exemple' => $lus ? ['titre' => $lus[0]['titre'], 'date' => $lus[0]['date']] : null];
            }
        }
        $res[$d['canal']] = $d;
    }
    vs_sortie(['status' => 'ok', 'domaine' => $s['domaine'], 'google' => $res['google'] ?? null, 'flux' => $res['flux'] ?? null]);
}

if ($action !== 'enregistrer' && $action !== 'reinitialiser') {
    vs_sortie(['status' => 'error', 'error' => 'ACTION_INCONNUE', 'message' => 'Actions : enregistrer, reinitialiser, tester.'], 400);
}
$raison = null;
$pdo = cfo_vp_pdo($raison);
if (!$pdo) vs_sortie(['status' => 'error', 'error' => 'STOCKAGE_INDISPONIBLE',
                      'message' => "Vos réglages ne peuvent pas être enregistrés ($raison) : la liste d'origine reste appliquée."], 503);
try {
    if ($action === 'reinitialiser') {
        cfo_vp_ecrire_perso($pdo, null);
        vs_sortie(vs_etat());
    }
    $l = cfo_vp_valider_liste($corps['sources'] ?? null);
    if ($l['erreurs']) {
        vs_sortie(['status' => 'error', 'error' => 'SOURCES_INVALIDES', 'erreurs' => $l['erreurs'],
                   'message' => reset($l['erreurs'])], 400);
    }
    cfo_vp_ecrire_perso($pdo, ['sources' => $l['sources'],
                               'defauts_connus' => array_values(array_column($def['sources'] ?? [], 'domaine')),
                               'maj' => gmdate('c')]);
    vs_sortie(vs_etat());
} catch (Throwable $e) {
    vs_sortie(['status' => 'error', 'error' => 'ECRITURE_ECHOUEE', 'message' => $e->getMessage()], 500);
}
