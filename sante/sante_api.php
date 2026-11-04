<?php
/**
 * Santé Master — L'API du Médecin-Chef IA (n8n).
 *   GET  ?lecture=1[&date=AAAA-MM-JJ] : ce que le CMO lit (indicateurs calculés, journée, poids, catalogue).
 *   POST { calls: [{ function, args }], mode: "simulate" | "commit" } : simulate rend le compte rendu sans rien
 *        écrire ; commit applique le lot (tout ou rien) et l'enregistre.
 */
require_once __DIR__ . '/sante_store.php';
require_once __DIR__ . '/sante_intent_engine.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
[$t] = sante_lire();
$etat = json_decode($t, true) ?: [];
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $d = $_GET['date'] ?? null;
    echo json_encode(sante_lecture($etat, sante_date_ok($d) ? $d : null), JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION);
    exit;
}
$corps = json_decode((string)file_get_contents('php://input'), true);
if (!is_array($corps) || !is_array($corps['calls'] ?? null)) { http_response_code(400); echo json_encode(['status' => 'error', 'erreur' => '{ calls: [...] } attendu']); exit; }
$r = sante_compiler($corps['calls'], $etat);
$sortie = ['status' => $r['status'], 'journal' => $r['journal']];
if ($r['status'] === 'ok' && ($corps['mode'] ?? 'simulate') === 'commit') {
    $w = sante_ecrire($r['etat']);
    $sortie['enregistre'] = $w['ok']; if (!$w['ok']) { $sortie['status'] = 'error'; $sortie['erreur'] = $w['erreur'] ?? 'écriture refusée'; }
} else $sortie['enregistre'] = false;
echo json_encode($sortie, JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION);
