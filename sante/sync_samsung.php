<?php
/**
 * Santé Master — WEBHOOK SAMSUNG HEALTH / HEALTH CONNECT (Galaxy S24+).
 *   POST JSON, un jour ou une liste de jours. Noms acceptés : date ; steps|pas ; active_calories|kcal_actives ;
 *   heart_rate_avg|fc_moy ; resting_heart_rate|fc_repos ; sleep_minutes|sommeil_min ; weight|poids.
 *   Jeton OBLIGATOIRE : en-tête X-Sante-Token (ou ?token=) égal à 'sante_samsung_token' dans ../db_config.php.
 *   Sans jeton configuré, le webhook refuse tout (rien ne s'écrit sans autorisation).
 *   Chaque jour passe par le moteur (sync_samsung_health) : bornes vérifiées, rien d'inventé.
 */
require_once __DIR__ . '/sante_store.php';
require_once __DIR__ . '/sante_intent_engine.php';
require_once __DIR__ . '/sante_hc.php';
header('Content-Type: application/json; charset=utf-8');
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['ok' => false, 'erreur' => 'POST attendu']); exit; }
//  v1.5 — jetons valides : db_config.php (sante_samsung_token), SANTE_SAMSUNG_TOKEN, ou celui créé depuis l'appli (sante_jeton.php)
$valides = sante_jetons_valides();
$recu = (string)($_SERVER['HTTP_X_SANTE_TOKEN'] ?? ($_GET['token'] ?? ''));
if (!$valides) { http_response_code(503); echo json_encode(['ok' => false, 'erreur' => "jeton non configuré : onglet Samsung & Poids → « Préparer ma synchro automatique »"]); exit; }
$bon = false; foreach ($valides as $v) if ($recu !== '' && hash_equals($v, $recu)) $bon = true;
if (!$bon) { http_response_code(403); echo json_encode(['ok' => false, 'erreur' => 'jeton invalide']); exit; }
$p = json_decode((string)file_get_contents('php://input'), true);
if (!is_array($p)) { http_response_code(400); echo json_encode(['ok' => false, 'erreur' => 'JSON attendu']); exit; }

//  v1.5 — l'appli Android « HC Webhook » (Health Connect → ici) : son format tel quel, envois incrémentaux
if (sante_hc_est_payload($p)) {
    [$t] = sante_lire();
    $etat = json_decode($t, true) ?: [];
    $etat = sante_normaliser($etat); $etat = json_decode(json_encode($etat), true);
    $r = sante_hc_integrer($p, $etat);
    $etat['sync_auto'] = ['derniere' => gmdate('Y-m-d\TH:i:s\Z'), 'source' => 'HC Webhook ' . mb_substr((string)($p['app_version'] ?? ''), 0, 20), 'jours' => count($r['dates'])];
    $c = $r['calls'] ? sante_compiler($r['calls'], $etat) : ['status' => 'ok', 'etat' => sante_normaliser($etat), 'journal' => []];
    if ($c['status'] !== 'ok') { http_response_code(422); echo json_encode(['ok' => false, 'journal' => $c['journal']], JSON_UNESCAPED_UNICODE); exit; }
    $w = sante_ecrire($c['etat']);
    if (!$w['ok']) http_response_code(500);
    echo json_encode(['ok' => $w['ok'], 'source' => 'hc_webhook', 'jours' => count($r['dates']), 'dates' => $r['dates'], 'ignores' => $r['ignores']], JSON_UNESCAPED_UNICODE);
    exit;
}
$jours = array_is_list($p) ? $p : (isset($p['jours']) && is_array($p['jours']) ? $p['jours'] : [$p]);
$A = ['date' => ['date', 'day', 'jour'], 'pas' => ['pas', 'steps', 'step_count'], 'kcal_actives' => ['kcal_actives', 'active_calories', 'active_energy_kcal'],
      'fc_moy' => ['fc_moy', 'heart_rate_avg', 'avg_heart_rate'], 'fc_repos' => ['fc_repos', 'resting_heart_rate'], 'sommeil_min' => ['sommeil_min', 'sleep_minutes', 'sleep_duration_min'],
      'poids' => ['poids', 'weight', 'weight_kg']];
$calls = [];
foreach ($jours as $j) {
    if (!is_array($j)) continue;
    $args = [];
    foreach ($A as $cle => $noms) foreach ($noms as $n) if (array_key_exists($n, $j) && $j[$n] !== null && $j[$n] !== '') { $args[$cle] = $j[$n]; break; }
    if (isset($args['date'])) $args['date'] = substr((string)$args['date'], 0, 10);
    if (count($args) > (isset($args['date']) ? 1 : 0)) $calls[] = ['function' => 'sync_samsung_health', 'args' => $args];
}
if (!$calls) { http_response_code(422); echo json_encode(['ok' => false, 'erreur' => 'aucune donnée reconnue']); exit; }
[$t] = sante_lire();
$r = sante_compiler($calls, json_decode($t, true) ?: []);
if ($r['status'] !== 'ok') { http_response_code(422); echo json_encode(['ok' => false, 'journal' => $r['journal']], JSON_UNESCAPED_UNICODE); exit; }
$w = sante_ecrire($r['etat']);
echo json_encode(['ok' => $w['ok'], 'jours' => count($calls), 'journal' => $r['journal']], JSON_UNESCAPED_UNICODE);
