<?php
/**
 * Santé Master — LA SYNCHRO AUTOMATIQUE « HC Webhook » (Health Connect → sync_samsung.php) : envois au format de l'appli
 * (docs/webhook.md), incrémentaux et renvoyés. Décor FICTIF.
 */
putenv('SANTE_DATA_FILE=' . sys_get_temp_dir() . '/sante_hc_test_' . getmypid() . '.json');
require_once __DIR__ . '/../sante/sante_store.php';
require_once __DIR__ . '/../sante/sante_intent_engine.php';
require_once __DIR__ . '/../sante/sante_hc.php';
$ko = 0; $n = 0;
function v(string $t, bool $ok, $d = '') { global $ko, $n; $n++; if (!$ok) $ko++; echo '  ' . ($ok ? '✅' : '❌') . ' ' . str_pad($t, 78) . ' ' . ($ok ? '' : mb_substr(is_string($d) ? $d : json_encode($d, JSON_UNESCAPED_UNICODE), 0, 500)) . "\n"; }
echo "\n  SANTÉ MASTER — SYNCHRO AUTOMATIQUE HC WEBHOOK\n  " . str_repeat('─', 80) . "\n";
$appliquer = function (array $p, array $etat) { $etat = json_decode(json_encode(sante_normaliser($etat)), true); $r = sante_hc_integrer($p, $etat); $c = $r['calls'] ? sante_compiler($r['calls'], $etat) : ['status' => 'ok', 'etat' => sante_normaliser($etat)]; return [$c['status'] === 'ok' ? json_decode(json_encode($c['etat']), true) : null, $r]; };
$J = fn($d) => gmdate('Y-m-d', time() - $d * 86400);
$d1 = $J(1); $d2 = $J(2);
v('A. reconnaît un envoi HC Webhook (racine timestamp / app_version), pas l\'ancien format « un jour »', sante_hc_est_payload(['timestamp' => 'x', 'app_version' => '1.9', 'timezone' => 'UTC']) && !sante_hc_est_payload(['date' => $d1, 'steps' => 8000]) && !sante_hc_est_payload([['date' => $d1]]));
//  1er envoi : pas « Quotidien » (minuit → minuit, heure locale), kcal, FC par minute, sommeil, poids en « Z » + décalage, FC repos
$p1 = ['timestamp' => gmdate('c'), 'app_version' => '1.9.40', 'timezone' => 'Africa/Casablanca',
    'steps' => [['count' => 8123, 'start_time' => "{$d1}T00:00:00+01:00", 'end_time' => "{$d1}T23:59:59.999+01:00"]],
    'active_calories' => [['calories' => 412.6, 'start_time' => "{$d1}T00:00:00+01:00", 'end_time' => "{$d1}T23:59:59+01:00"]],
    'heart_rate' => [['avg' => 70, 'min' => 65, 'max' => 80, 'bpm' => 70, 'time' => "{$d1}T08:00:00+01:00"], ['avg' => 80, 'bpm' => 80, 'time' => "{$d1}T08:01:00+01:00"]],
    'sleep' => [['session_end_time' => "{$d1}T06:30:00+01:00", 'duration_seconds' => 7 * 3600, 'stages' => [], 'metadata' => ['id' => 'nuit-1']],
                ['session_end_time' => "{$d1}T14:40:00+01:00", 'duration_seconds' => 40 * 60, 'metadata' => ['id' => 'sieste']]],
    'weight' => [['kilograms' => 97.04, 'time' => gmdate('Y-m-d', strtotime($d1) - 86400) . 'T23:30:00Z', 'metadata' => ['zone_offset_seconds' => 3600]]],
    'resting_heart_rate' => [['bpm' => 58, 'time' => "{$d1}T07:00:00+01:00"]]];
[$e1, $r1] = $appliquer($p1, []);
$s1 = $e1['journal'][$d1]['samsung'] ?? [];
v('B. un envoi : pas 8 123 et kcal 413 (totaux « Quotidien »), FC moyenne 75, FC repos 58', ($s1['pas'] ?? 0) == 8123 && ($s1['kcal_actives'] ?? 0) == 413 && ($s1['fc_moy'] ?? 0) == 75 && ($s1['fc_repos'] ?? 0) == 58, $s1);
v('  → sommeil 420 min (la nuit), la sieste de 40 min l\'après-midi écartée', ($s1['sommeil_min'] ?? 0) == 420, $s1);
v('  → pesée 23:30 « Z » + 1 h (décalage de la mesure) = le jour suivant en local ; elle rejoint la courbe', ($s1['poids'] ?? 0) == 97 && in_array(['date' => $d1, 'kg' => 97.0, 'source' => 'samsung'], $e1['poids'], false), [$s1, $e1['poids']]);
//  2e envoi (incrémental) : nouveau total quotidien de pas, une minute de FC de plus, la MÊME nuit renvoyée
$p2 = ['timestamp' => gmdate('c'), 'app_version' => '1.9.40', 'timezone' => 'Africa/Casablanca',
    'steps' => [['count' => 10250, 'start_time' => "{$d1}T00:00:00+01:00", 'end_time' => "{$d1}T23:59:59+01:00"]],
    'heart_rate' => [['avg' => 90, 'time' => "{$d1}T08:02:00+01:00"], ['avg' => 80, 'time' => "{$d1}T08:01:00+01:00"]],
    'sleep' => [['session_end_time' => "{$d1}T06:30:00+01:00", 'duration_seconds' => 7 * 3600, 'metadata' => ['id' => 'nuit-1']]]];
[$e2] = $appliquer($p2, $e1);
$s2 = $e2['journal'][$d1]['samsung'];
v('C. envoi suivant : le total quotidien REMPLACE (10 250) ; la nuit renvoyée n\'est pas comptée deux fois (420)', $s2['pas'] == 10250 && $s2['sommeil_min'] == 420 && $s2['kcal_actives'] == 413, $s2);
v('  → FC : la minute renvoyée remplace, la nouvelle s\'ajoute : (70 + 80 + 90) / 3 = 80', $s2['fc_moy'] == 80, $e2['journal'][$d1]['hc']['fc'] ?? null);
//  pas en tranches (réglage « fenêtres de N minutes ») : additionnées, un renvoi de tranche remplace
$tr = fn($h, $n) => ['count' => $n, 'start_time' => "{$d2}T{$h}:00+01:00", 'end_time' => "{$d2}T{$h}:59+01:00"];
[$e3] = $appliquer(['timestamp' => 'x', 'app_version' => '1', 'steps' => [$tr('08:00', 1000), $tr('09:00', 2000)]], $e2);
[$e4] = $appliquer(['timestamp' => 'x', 'app_version' => '1', 'steps' => [$tr('09:00', 2500), $tr('10:00', 500)]], $e3);
v('D. pas en tranches : additionnées (1 000 + 2 500 + 500 = 4 000), la tranche de 9 h renvoyée remplace', $e4['journal'][$d2]['samsung']['pas'] == 4000, $e4['journal'][$d2]);
[$e5, $r5] = $appliquer(['timestamp' => 'x', 'app_version' => '1.9', 'timezone' => 'UTC'], $e4);
v('E. un envoi vide (test de connexion de l\'appli) : accepté, rien ne change', $e5 !== null && $r5['calls'] === [] && $e5['journal'][$d1]['samsung'] == $e4['journal'][$d1]['samsung']);
[$e6, $r6] = $appliquer(['timestamp' => 'x', 'app_version' => '1', 'steps' => [['count' => 999999, 'start_time' => "{$d2}T00:00:00+01:00", 'end_time' => "{$d2}T23:59:00+01:00"]], 'weight' => [['kilograms' => 'abc', 'time' => 'hier']]], $e4);
v('  → valeurs absurdes (999 999 pas, poids illisible) : écartées, l\'envoi n\'échoue pas', $e6 !== null && $e6['journal'][$d2]['samsung']['pas'] == 4000 && $r6['ignores'] === 1, [$r6, $e6['journal'][$d2]['samsung'] ?? null]);
$vieux = $J(20);
$e7 = json_decode(json_encode(sante_normaliser(['journal' => [$vieux => ['hc' => ['pas' => ['jour' => 5]]], $d1 => $e4['journal'][$d1]]])), true);
v('F. les morceaux ne restent que 8 jours (les totaux, eux, restent)', !isset($e7['journal'][$vieux]['hc']) && isset($e7['journal'][$d1]['hc']['fc']));
//  v1.15 — le format de l'appli réellement installée : { metadata, data: { steps: [ { start_time, end_time, unit, source, recording_method, value } ] } }
$srcTel = 'com.android.healthconnect.phone.j1ed985a04c873383a77768f335b9fe26'; $srcMontre = 'com.samsung.android.wear.watch';
$pasB = function ($src, $debut, $n, $v) use ($d1) { $o = []; for ($i = 0; $i < $n; $i++) { $s = strtotime("$d1 $debut UTC") + $i * 24; $o[] = ['start_time' => gmdate('Y-m-d\TH:i:s', $s) . '.597Z', 'end_time' => gmdate('Y-m-d\TH:i:s', $s + 24) . '.597Z', 'unit' => 'steps', 'source' => $src, 'recording_method' => 'automatically_recorded', 'value' => (float)$v]; } return $o; };
$B = ['metadata' => ['app_version' => '1.0', 'schema_version' => 1, 'sync_timestamp' => gmdate('Y-m-d\TH:i:s') . '.660Z', 'device_model' => 'SM-S926B', 'os_version' => 'Android 17', 'timezone' => 'Africa/Casablanca'],
      'data' => ['steps' => array_merge($pasB($srcTel, '10:00:00', 100, 12), $pasB($srcMontre, '10:00:00', 100, 12), $pasB($srcTel, '12:00:00', 50, 20)),
                 'heart_rate' => [['start_time' => "{$d1}T08:00:00.000Z", 'end_time' => "{$d1}T08:00:00.000Z", 'unit' => 'bpm', 'source' => $srcTel, 'value' => 70.0], ['start_time' => "{$d1}T08:00:20.000Z", 'end_time' => "{$d1}T08:00:20.000Z", 'unit' => 'bpm', 'source' => $srcTel, 'value' => 90.0]],
                 'weight' => [['start_time' => "{$d1}T06:00:00.000Z", 'end_time' => "{$d1}T06:00:00.000Z", 'unit' => 'kg', 'source' => $srcTel, 'value' => 96.4]],
                 'active_calories' => [['start_time' => "{$d1}T10:00:00.000Z", 'end_time' => "{$d1}T10:30:00.000Z", 'unit' => 'kcal', 'source' => $srcTel, 'value' => 150.0], ['start_time' => "{$d1}T11:00:00.000Z", 'end_time' => "{$d1}T11:30:00.000Z", 'unit' => 'cal', 'source' => $srcTel, 'value' => 50000.0]]]];
v('G. format de l\'appli installée (metadata + data) : reconnu comme un envoi de santé', sante_hc_est_payload($B) && sante_hc_est_format_b($B) && !sante_hc_est_format_b($p1));
$conv = sante_hc_convertir_b($B);
v('  → converti : 250 mesures de pas, 2 de FC, 1 pesée, 2 de calories ; fuseau et version repris', count($conv['steps']) === 250 && count($conv['heart_rate']) === 2 && count($conv['weight']) === 1 && count($conv['active_calories']) === 2 && $conv['timezone'] === 'Africa/Casablanca' && $conv['app_version'] === '1.0', array_map('count', array_intersect_key($conv, array_flip(['steps', 'heart_rate', 'weight', 'active_calories']))));
[$eB, $rB] = $appliquer($conv, []);
$sB = $eB['journal'][$d1]['samsung'] ?? [];
v('  → pas : téléphone et montre comptent les mêmes pas → la source la plus complète (100×12 + 50×20 = 2 200), pas la somme (3 400)', ($sB['pas'] ?? 0) == 2200, $sB);
v('  → FC moyenne 80 ; pesée 96,4 ; kcal : 150 + 50 000 cal (= 50 kcal) = 200', ($sB['fc_moy'] ?? 0) == 80 && ($sB['poids'] ?? 0) == 96.4 && ($sB['kcal_actives'] ?? 0) == 200, $sB);
[$eB2] = $appliquer($conv, $eB);
v('  → le même envoi renvoyé : rien n\'est compté deux fois', ($eB2['journal'][$d1]['samsung']['pas'] ?? 0) == 2200 && ($eB2['journal'][$d1]['samsung']['kcal_actives'] ?? 0) == 200);
@unlink(getenv('SANTE_DATA_FILE'));
echo $ko === 0 ? "\n  ✅ TOUT PASSE — $n contrôles\n" : "\n  ❌ $ko contrôle(s) en échec sur $n\n";
exit($ko === 0 ? 0 : 1);
