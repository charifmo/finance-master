<?php
declare(strict_types=1);
/**
 * ============================================================================
 *  cfo_relais.php — LA RÉPONSE DU CFO NE SE PERD PLUS (v37.115)
 * ----------------------------------------------------------------------------
 *  « Ça tourne puis ça donne une erreur, car j'ai reçu un appel : je ne veux pas
 *  attendre des minutes sans pouvoir utiliser mon téléphone. »
 *
 *  Avant : le téléphone parlait à n8n en direct. Un appel, une autre appli, l'écran
 *  verrouillé : le navigateur suspend l'onglet, la connexion tombe, et la réponse du
 *  CFO — qui arrive quand même — n'a plus personne pour la recevoir.
 *
 *  Maintenant la question passe par ici. Le VPS la transmet à n8n et ATTEND la
 *  réponse à la place du téléphone — même si le téléphone s'en va (ignore_user_abort) —,
 *  puis la garde (pending/reponses/<rid>.json, 24 h). Revenu sur l'appli, le téléphone
 *  la relit : la réponse s'affiche comme si de rien n'était.
 *
 *    POST {…la question, telle qu'envoyée à n8n…, rid, cible}  + X-Requested-With
 *         → la réponse de n8n (même code HTTP, même corps). n8n injoignable d'ici :
 *           502 {error:"RELAIS_INJOIGNABLE"} — l'appli repasse alors en direct.
 *    GET  ?rid=X → {etat: en_cours|fini|erreur|inconnu, http, corps, erreur, depuis_ms}
 *
 *  L'adresse de n8n n'est JAMAIS libre : le chemin vient de l'appli mais doit être
 *  /webhook/<nom> ; l'hôte est celui de ce serveur, ou 'cfo_webhook_interne' dans
 *  db_config.php (ex. http://127.0.0.1:5678 si le VPS joint mal son propre domaine).
 * ============================================================================
 */

const CFO_RELAIS_DUREE_MAX = 900;          // 15 min au plus pour une réponse
const CFO_RELAIS_GARDE = 86400;             // réponses gardées 24 h

function cfo_relais_dossier(): string {
    $d = __DIR__ . '/pending/reponses';
    if (!is_dir($d)) @mkdir($d, 0775, true);
    return $d;
}
function cfo_relais_rid($v): ?string { return is_string($v) && preg_match('/^[A-Za-z0-9_\-]{8,64}$/', $v) ? $v : null; }
function cfo_relais_fichier(string $rid): string { return cfo_relais_dossier() . '/' . $rid . '.json'; }
function cfo_relais_ecrire(string $rid, array $etat): void {
    $f = cfo_relais_fichier($rid); $tmp = $f . '.' . getmypid() . '.tmp';
    if (@file_put_contents($tmp, json_encode($etat, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR)) !== false) @rename($tmp, $f); else @unlink($tmp);
}
function cfo_relais_lire(string $rid): ?array {
    $f = cfo_relais_fichier($rid);
    if (!is_file($f)) return null;
    $e = json_decode((string)@file_get_contents($f), true);
    return is_array($e) ? $e : null;
}
function cfo_relais_menage(): void {
    foreach (glob(cfo_relais_dossier() . '/*.json') ?: [] as $f) if (@filemtime($f) < time() - CFO_RELAIS_GARDE) @unlink($f);
}
/** L'adresse de n8n : base configurée, ou ce serveur ; le chemin doit être /webhook/<nom>. */
function cfo_relais_cible(string $chemin, array $cfg, array $serveur): ?string {
    if (!preg_match('#^/webhook(?:-test)?/[A-Za-z0-9_\-/]{1,120}$#', $chemin) || str_contains($chemin, '..')) return null;
    $base = is_string($cfg['cfo_webhook_interne'] ?? null) ? rtrim($cfg['cfo_webhook_interne'], '/') : '';
    if ($base !== '') {
        if (!preg_match('#^https?://[A-Za-z0-9.\-\[\]:]+$#', $base)) return null;
        return $base . $chemin;
    }
    $hote = strtolower((string)($serveur['HTTP_HOST'] ?? ''));
    if (!preg_match('/^[a-z0-9.\-]+(:\d{1,5})?$/', $hote)) return null;
    $https = (!empty($serveur['HTTPS']) && $serveur['HTTPS'] !== 'off') || strtolower((string)($serveur['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
    return ($https ? 'https' : 'http') . '://' . $hote . $chemin;
}

if (PHP_SAPI === 'cli' || basename((string)($_SERVER['SCRIPT_FILENAME'] ?? '')) !== basename(__FILE__)) return;   // inclus (tests)

header('Cache-Control: no-store');
$sortie = function (array $p, int $code = 200) { http_response_code($code); header('Content-Type: application/json; charset=utf-8'); echo json_encode($p, JSON_UNESCAPED_UNICODE); exit; };
$methode = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($methode === 'GET') {
    $rid = cfo_relais_rid($_GET['rid'] ?? null);
    if (!$rid) $sortie(['etat' => 'inconnu', 'erreur' => 'rid invalide'], 400);
    $e = cfo_relais_lire($rid);
    if (!$e) $sortie(['etat' => 'inconnu']);
    $e['depuis_ms'] = (int)round((microtime(true) - (float)($e['debut'] ?? microtime(true))) * 1000);
    unset($e['debut']);
    $sortie($e);
}
if ($methode !== 'POST') $sortie(['status' => 'error', 'error' => 'METHODE'], 405);
if (($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') === '') $sortie(['status' => 'error', 'error' => 'ENTETE_MANQUANT'], 400);
$origine = (string)($_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? ''));
if ($origine !== '') {
    $hO = parse_url($origine, PHP_URL_HOST);
    if ($hO !== null && strcasecmp((string)$hO, (string)preg_replace('/:\d+$/', '', (string)($_SERVER['HTTP_HOST'] ?? ''))) !== 0) $sortie(['status' => 'error', 'error' => 'ORIGINE_ETRANGERE'], 403);
}
$brut = (string)file_get_contents('php://input');
$corps = json_decode($brut, true);
if (!is_array($corps)) $sortie(['status' => 'error', 'error' => 'JSON_ATTENDU'], 400);
$rid = cfo_relais_rid($corps['rid'] ?? null);
if (!$rid) $sortie(['status' => 'error', 'error' => 'RID_INVALIDE'], 400);
$cfg = is_file(__DIR__ . '/db_config.php') ? (include __DIR__ . '/db_config.php') : [];
$url = cfo_relais_cible((string)($corps['cible'] ?? '/webhook/finance-cfo-web'), is_array($cfg) ? $cfg : [], $_SERVER);
if (!$url) $sortie(['status' => 'error', 'error' => 'CIBLE_REFUSEE', 'message' => 'Adresse du CFO refusée par le relais.'], 400);
unset($corps['rid'], $corps['cible']);

//  À partir d'ici, le téléphone peut partir : on va jusqu'au bout et on garde la réponse
ignore_user_abort(true);
@set_time_limit(CFO_RELAIS_DUREE_MAX + 30);
cfo_relais_menage();
$debut = microtime(true);
cfo_relais_ecrire($rid, ['etat' => 'en_cours', 'debut' => $debut, 'session' => substr((string)($corps['session_id'] ?? ''), 0, 128)]);
$entetes = ['Content-Type: application/json', 'X-Finance-Relais: 1'];
if (!empty($_SERVER['HTTP_AUTHORIZATION'])) $entetes[] = 'Authorization: ' . $_SERVER['HTTP_AUTHORIZATION'];   // le mot de passe du site, si n8n est derrière
$envoi = json_encode($corps, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
$http = 0; $rep = ''; $err = ''; $type = 'application/json';
if (function_exists('curl_init')) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $envoi, CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => $entetes,
        CURLOPT_TIMEOUT => CFO_RELAIS_DUREE_MAX, CURLOPT_CONNECTTIMEOUT => 10, CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS]);
    $rep = curl_exec($ch);
    if ($rep === false) { $err = curl_error($ch); $rep = ''; }
    $http = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $type = (string)(curl_getinfo($ch, CURLINFO_CONTENT_TYPE) ?: $type);
    curl_close($ch);
} else {
    $ctx = stream_context_create(['http' => ['method' => 'POST', 'header' => implode("\r\n", $entetes), 'content' => $envoi, 'timeout' => CFO_RELAIS_DUREE_MAX, 'ignore_errors' => true, 'follow_location' => 0]]);
    $rep = @file_get_contents($url, false, $ctx);
    if ($rep === false) { $err = 'connexion impossible'; $rep = ''; }
    foreach (($http_response_header ?? []) as $h) {
        if (preg_match('#^HTTP/\S+\s+(\d{3})#', $h, $m)) $http = (int)$m[1];
        elseif (stripos($h, 'content-type:') === 0) $type = trim(substr($h, 13));
    }
}
if ($http === 0) {
    cfo_relais_ecrire($rid, ['etat' => 'erreur', 'debut' => $debut, 'erreur' => 'n8n injoignable depuis le VPS (' . ($err ?: 'pas de réponse') . ')']);
    $sortie(['status' => 'error', 'error' => 'RELAIS_INJOIGNABLE', 'message' => 'Le VPS ne joint pas le CFO à ' . $url . ' : ' . ($err ?: 'pas de réponse') . '. Dans db_config.php : \'cfo_webhook_interne\' => \'http://127.0.0.1:5678\'.'], 502);
}
cfo_relais_ecrire($rid, ['etat' => 'fini', 'debut' => $debut, 'http' => $http, 'corps' => $rep, 'duree_ms' => (int)round((microtime(true) - $debut) * 1000)]);
http_response_code($http);
header('Content-Type: ' . (preg_match('#^[\w.+\-]+/[\w.+\-]+(;\s*charset=[\w\-]+)?$#i', $type) ? $type : 'application/json'));
header('X-Finance-Relais: ' . $rid);
echo $rep;
