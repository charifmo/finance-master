<?php
/**
 * Santé Master — GET : l'état servi (en-tête X-Sante-Version) ; POST : l'état complet, normalisé avant écriture.
 *   X-Sante-Base (version connue du client) : si le serveur a changé depuis, 409 au lieu d'écraser.
 */
require_once __DIR__ . '/sante_store.php';
require_once __DIR__ . '/sante_integrity.php';
require_once __DIR__ . '/sante_reparation.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Access-Control-Expose-Headers: X-Sante-Version, X-Sante-Mode, X-Sante-Reparation');

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    //  v1.21 — une ancienne version a effacé les données de la v1.20 ? on les rétablit depuis la dernière copie (une fois)
    $rep = null;
    try { $rep = sante_reparer_retour_ancienne_version(); } catch (Throwable $e) { error_log('[sante_reparation] ' . $e->getMessage()); }
    if ($rep && $rep['ok']) header('X-Sante-Reparation: ' . $rep['copie']);
    [$t, $mode] = sante_lire();
    header('X-Sante-Version: ' . sante_version($t));
    header('X-Sante-Mode: ' . $mode);
    echo $t === '{}' ? json_encode(sante_etat_defaut(), JSON_UNESCAPED_UNICODE) : $t;
    exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['ok' => false, 'erreur' => 'GET ou POST']); exit; }
$corps = json_decode((string)file_get_contents('php://input'), true);
if (!is_array($corps)) { http_response_code(400); echo json_encode(['ok' => false, 'erreur' => 'JSON attendu']); exit; }
$r = sante_ecrire(sante_normaliser($corps), $_SERVER['HTTP_X_SANTE_BASE'] ?? null);
if (!empty($r['conflit'])) http_response_code(409); elseif (!$r['ok']) http_response_code(500);
if (!empty($r['version'])) header('X-Sante-Version: ' . $r['version']);
echo json_encode($r, JSON_UNESCAPED_UNICODE);
