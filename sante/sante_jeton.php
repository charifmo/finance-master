<?php
/**
 * Santé Master — LE JETON DE LA SYNCHRO AUTOMATIQUE (v1.5), sans toucher à db_config.php.
 *   GET : le jeton en place (ou null) ; POST {"action":"creer"} : le crée s'il n'existe pas (renouveler : en refait un).
 *   Réservé à une requête AUTHENTIFIÉE en amont (basic_auth de Caddy) : sans authentification, refus.
 *   Le jeton est rangé à côté des données, dans sante_jeton_samsung.php (un .php : servi, il n'affiche rien ; ignoré par git).
 */
require_once __DIR__ . '/sante_store.php';
require_once __DIR__ . '/sante_hc.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
$utilisateur = sante_auth_amont();
if ($utilisateur === null) { http_response_code(403); echo json_encode(['ok' => false, 'erreur' => "accès non authentifié : cette page doit être derrière le mot de passe du site (basic_auth)"], JSON_UNESCAPED_UNICODE); exit; }
$jetons = sante_jetons_valides();
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $c = json_decode((string)file_get_contents('php://input'), true) ?: [];
    if (!$jetons || ($c['action'] ?? '') === 'renouveler') {
        $j = sante_creer_jeton();
        if ($j === null) { http_response_code(500); echo json_encode(['ok' => false, 'erreur' => "impossible d'écrire " . sante_jeton_fichier()], JSON_UNESCAPED_UNICODE); exit; }
        $jetons = [$j];
    }
}
echo json_encode(['ok' => true, 'jeton' => $jetons ? end($jetons) : null, 'utilisateur' => $utilisateur], JSON_UNESCAPED_UNICODE);
