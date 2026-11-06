<?php
/**
 * Santé Master — le chat de l'onglet « Médecin-Chef IA » (v1.6). La page envoie la question ici (même site, donc
 * derrière le mot de passe de Caddy) ; on la relaie au webhook n8n de l'agent avec l'authentification reçue : le
 * workflow la compare à FINANCE_USER / FINANCE_PASS et refuse tout appel qui ne vient pas de la page.
 *   Adresse du webhook : SANTE_CMO_WEBHOOK, ou db_config.php 'sante_cmo_webhook', sinon http://127.0.0.1:5678/webhook/sante-cmo.
 */
require_once __DIR__ . '/sante_store.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['output' => 'POST attendu']); exit; }
$auth = (string)($_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? ''));
if (stripos($auth, 'basic ') !== 0) { http_response_code(403); echo json_encode(['output' => "Accès non authentifié : la page doit être derrière le mot de passe du site, et Caddy doit transmettre l'en-tête Authorization à PHP."], JSON_UNESCAPED_UNICODE); exit; }
$brut = (string)file_get_contents('php://input');
if (strlen($brut) > 400000) { http_response_code(413); echo json_encode(['output' => 'Demande trop volumineuse.', 'erreur' => 'demande trop volumineuse'], JSON_UNESCAPED_UNICODE); exit; }
$corps = json_decode($brut, true);
//  v1.9 — la vérification d'un protocole rangé (écran de tri) : le mode et les lignes partent tels quels
$verif = is_array($corps) && ($corps['mode'] ?? '') === 'verifier_protocole' && is_array($corps['elements'] ?? null);
$q = is_array($corps) ? trim((string)($corps['question'] ?? '')) : '';
if (!$verif && $q === '') { http_response_code(400); echo json_encode(['output' => 'Question vide.'], JSON_UNESCAPED_UNICODE); exit; }
$envoi = $verif ? ['mode' => 'verifier_protocole', 'titre' => mb_substr((string)($corps['titre'] ?? ''), 0, 200), 'elements' => array_slice($corps['elements'], 0, 400)]
                : ['question' => mb_substr($q, 0, 4000), 'source' => 'web', 'session_id' => 'sante-web'];
$cfg = sante_db_config() ?? [];
$url = (string)(getenv('SANTE_CMO_WEBHOOK') ?: ($cfg['sante_cmo_webhook'] ?? 'http://127.0.0.1:5678/webhook/sante-cmo'));
$ctx = stream_context_create(['http' => ['method' => 'POST', 'timeout' => $verif ? 180 : 120, 'ignore_errors' => true,
    'header' => "Content-Type: application/json\r\nAuthorization: $auth\r\n",
    'content' => json_encode($envoi, JSON_UNESCAPED_UNICODE)]]);
$rep = @file_get_contents($url, false, $ctx);
$code = 0; foreach (($http_response_header ?? []) as $h) if (preg_match('#^HTTP/\S+\s+(\d{3})#', $h, $m)) $code = (int)$m[1];
if ($rep === false || $code === 0) { http_response_code(502); echo json_encode(['output' => "Le Médecin-Chef IA est injoignable ($url) : vérifiez que son workflow est publié (sudo bash install.sh sante).", 'erreur' => "Médecin-Chef IA injoignable : publiez-le (sudo bash install.sh sante)"], JSON_UNESCAPED_UNICODE); exit; }
if ($code === 404) { http_response_code(502); echo json_encode(['output' => "Webhook « sante-cmo » introuvable dans n8n : publiez l'agent (sudo bash install.sh sante).", 'erreur' => "agent pas encore publié dans n8n (sudo bash install.sh sante)"], JSON_UNESCAPED_UNICODE); exit; }
http_response_code($code >= 200 && $code < 300 ? 200 : $code);
echo $rep;
