<?php
declare(strict_types=1);
/**
 * ============================================================================
 *  cfo_veille_decouvertes.php — LES SOURCES PROPOSÉES, DEPUIS L'ÉCRAN (v37.142)
 * ----------------------------------------------------------------------------
 *  GET                                      → toutes les propositions, sources suivies, compteurs
 *  POST {action:"lister", lieux:[…]}        → celles d'UN bien (ses lieux → sa clé), 50 propositions au plus
 *  POST {action:"exemples", cle}            → les exemples d'une source (10 au plus) et son historique
 *  POST {action:"accepter"|"ignorer"|"une_fois"|"pause"|"reprendre", cle, raison?}
 *  POST {action:"modifier", cle, type, langue, frequence, mode, flux?, requetes, biens, confiance, note, nom, locale, accepter?}
 *  POST {action:"ajouter", url, nom, type, langue, frequence, note, confiance, biens|lieux, confirmer?}
 *       → l'ajout manuel amélioré : normalisé, doublon SIGNALÉ (jamais écrasé)
 *  Les POST exigent X-Requested-With et la même origine (comme cfo_veille_sources.php).
 *  Aucun appel réseau ici : on ne lit que la base de la collecte. Rien ne s'active
 *  sans votre décision ; l'activation a lieu au cycle de collecte suivant.
 *  L'ajout manuel historique (écran « 📰 Sources ») reste inchangé.
 * ============================================================================
 */
require_once __DIR__ . '/cfo_veille_serveur.php';
require_once __DIR__ . '/cfo_veille_collecte_lib.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function vdx_sortie(array $p, int $code = 200): void {
    http_response_code($code);
    echo json_encode($p, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR);
    exit;
}

$methode = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($methode !== 'GET' && $methode !== 'POST') vdx_sortie(['status' => 'error', 'error' => 'METHODE', 'message' => 'GET ou POST.'], 405);
if ($methode === 'POST') {
    if (($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') === '') vdx_sortie(['status' => 'error', 'error' => 'ENTETE_MANQUANT', 'message' => 'En-tête X-Requested-With absent.'], 400);
    $hote = $_SERVER['HTTP_HOST'] ?? '';
    $origine = $_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
    if ($origine !== '') {
        $hO = parse_url($origine, PHP_URL_HOST);
        if ($hO !== null && strcasecmp((string)$hO, (string)preg_replace('/:\d+$/', '', $hote)) !== 0)
            vdx_sortie(['status' => 'error', 'error' => 'ORIGINE_ETRANGERE', 'message' => "Requête émise depuis « {$hO} »."], 403);
    }
}
$raison = null;
$pdo = vc_pdo($raison);
if (!$pdo) vdx_sortie(['status' => 'error', 'error' => 'STOCKAGE_INDISPONIBLE', 'message' => "Base de la veille injoignable ($raison)."], 503);
$conf = cfo_vp_config(false);
$cfg = $conf['cfg'] ?? ['sources' => []];

try {
    vc_schema($pdo);
    if ($methode === 'GET') vdx_sortie(['status' => 'ok', 'bien' => null] + vd_lister($pdo));
    $corps = json_decode((string)file_get_contents('php://input'), true);
    if (!is_array($corps)) vdx_sortie(['status' => 'error', 'error' => 'CORPS_ILLISIBLE', 'message' => 'JSON attendu.'], 400);
    $action = (string)($corps['action'] ?? '');
    $bienDe = function () use ($corps): ?string {
        $l = cfo_vp_valider(['lieux' => $corps['lieux'] ?? [], 'sujets' => []])['lieux'] ?? [];
        return $l ? vc_cle_bien($l) : null;
    };
    if ($action === 'lister') {
        $bien = $bienDe();
        if (!empty($corps['actualiser'])) vd_mettre_a_jour($pdo, cfo_vp_config(true)['cfg'] ?? $cfg);   // aucune requête réseau : la base seule
        vdx_sortie(['status' => 'ok', 'bien' => $bien] + vd_lister($pdo, $bien));
    }
    $cle = trim((string)($corps['cle'] ?? ''));
    if ($action === 'exemples') {
        if ($cle === '') vdx_sortie(['status' => 'error', 'error' => 'CLE_MANQUANTE', 'message' => 'Source attendue.'], 400);
        vdx_sortie(['status' => 'ok', 'cle' => $cle, 'exemples' => vd_exemples($pdo, $cle), 'historique' => vd_historique($pdo, $cle)]);
    }
    if ($action === 'ajouter') {
        $in = $corps;
        if (empty($in['biens']) && !empty($corps['lieux']) && ($b = $bienDe())) $in['biens'] = [$b];
        $r = vd_ajouter($pdo, $cfg, $in);
        if (isset($r['erreur'])) vdx_sortie(['status' => 'error', 'error' => $r['code'], 'message' => $r['erreur']] + (isset($r['doublon']) ? ['doublon' => $r['doublon']] : []),
                                            $r['code'] === 'DOUBLON' ? 409 : ($r['code'] === 'A_CONFIRMER' ? 409 : 400));
        vdx_sortie(['status' => 'ok', 'source' => $r['source'], 'message' => 'Source ajoutée : elle sera interrogée au prochain cycle de collecte.']);
    }
    if (in_array($action, ['accepter', 'ignorer', 'une_fois', 'pause', 'reprendre', 'modifier'], true)) {
        if ($cle === '') vdx_sortie(['status' => 'error', 'error' => 'CLE_MANQUANTE', 'message' => 'Source attendue.'], 400);
        $in = $corps;
        if ($action === 'modifier' && empty($in['biens']) && !empty($corps['lieux']) && ($b = $bienDe())) $in['biens'] = [$b];
        $r = vd_decider($pdo, $cle, $action, $in);
        if (isset($r['erreur'])) vdx_sortie(['status' => 'error', 'error' => $r['code'], 'message' => $r['erreur']], $r['code'] === 'INCONNUE' ? 404 : ($r['code'] === 'TRANSITION' || $r['code'] === 'EXCLUE' ? 409 : 400));
        vdx_sortie(['status' => 'ok', 'source' => $r['source']]);
    }
    vdx_sortie(['status' => 'error', 'error' => 'ACTION_INCONNUE', 'message' => 'Actions : lister, exemples, accepter, ignorer, une_fois, pause, reprendre, modifier, ajouter.'], 400);
} catch (Throwable $e) {
    vdx_sortie(['status' => 'error', 'error' => 'ERREUR', 'message' => mb_substr($e->getMessage(), 0, 300)], 500);
}
