<?php
/**
 * Santé Master — SYNCHRO AUTOMATIQUE DEPUIS LE TÉLÉPHONE : l'appli Android « HC Webhook »
 * (github.com/mcnaveen/health-connect-webhook, Play Store com.hcwebhook.app) lit Samsung Health via Health Connect
 * et POSTe ici, à intervalle, à heure fixe ou d'un appui sur son widget « Synchroniser ».
 *
 * Format reçu (docs/webhook.md de l'appli) : { timestamp, app_version, timezone, steps[], active_calories[], weight[],
 * sleep[], heart_rate[], resting_heart_rate[], deleted[]… } ; heures ISO-8601 (heure locale avec décalage, ou « Z »
 * + metadata.*zone_offset_seconds). Les envois sont INCRÉMENTAUX (seulement le nouveau depuis la dernière synchro) et
 * peuvent être renvoyés : on range chaque morceau sous une clé (id Health Connect, sinon son heure) puis on refait
 * le total du jour — un renvoi remplace, il ne s'additionne pas.
 *   pas / kcal actives : « Quotidien » (réglage par défaut de l'appli) = un total par jour, il remplace ; sinon des
 *                        tranches, additionnées ;
 *   FC : moyenne du jour des tranches (moyenne de chaque minute) ; FC au repos : la dernière du jour ;
 *   sommeil : minutes par jour de RÉVEIL, chaque séance une fois ; les siestes (moins de 90 min finies entre 10 h et 20 h)
 *             sont écartées ; poids : la dernière pesée du jour.
 * Les morceaux restent 8 jours dans journal[date].hc (le temps des renvois), les totaux dans journal[date].samsung.
 */
require_once __DIR__ . '/sante_lib.php';

const SANTE_HC_TYPES = ['steps', 'active_calories', 'weight', 'sleep', 'heart_rate', 'resting_heart_rate',
    //  v1.16 — les autres mesures de Health Connect (envoyées par l'appli si on les a cochées)
    'distance', 'total_calories', 'exercise', 'oxygen_saturation', 'blood_pressure', 'hydration', 'body_fat', 'height', 'heart_rate_variability'];
const SANTE_HC_ZONE = 'Africa/Casablanca';

/**
 * Format B (v1.15) : l'appli « Health Connect Webhook » installée sur le téléphone range ses mesures sous
 * { metadata: { app_version, schema_version, sync_timestamp, device_model, os_version, timezone }, data: { steps: [ { start_time,
 * end_time, unit, source, recording_method, value } … ], … } }. Convertit en format A (celui de la doc de l'appli de Naveen MC,
 * lu par sante_hc_integrer) : chaque mesure reçoit une clé stable « source courte | début » (un renvoi remplace), la valeur est
 * ramenée en kg / kcal, le fuseau de l'envoi sert aux heures « Z ».
 */
function sante_hc_est_format_b($p): bool {
    //  v1.16 — « data »: {} (rien de neuf depuis la dernière synchro) devient un tableau VIDE en PHP : c'est bien le format B
    return is_array($p) && !array_is_list($p) && is_array($p['metadata'] ?? null) && is_array($p['data'] ?? null) && ($p['data'] === [] || !array_is_list($p['data']));
}
function sante_hc_convertir_b(array $p): array {
    $m = $p['metadata']; $zone = is_string($m['timezone'] ?? null) ? $m['timezone'] : 'UTC';
    $out = ['timestamp' => (string)($m['sync_timestamp'] ?? gmdate('c')), 'app_version' => (string)($m['app_version'] ?? ''), 'timezone' => $zone];
    if (!empty($p['test']) || !empty($m['test'])) $out['test'] = true;
    $norm = fn($k) => preg_replace('/[^a-z]/', '', strtolower((string)$k));
    //  v1.17 — la clé porte aussi la FIN de la mesure : les pas de plusieurs sources se comparent minute par minute
    $chiffres = fn($t) => preg_replace('/[^0-9TZ]/', '', substr((string)$t, 0, 23));
    $cle = function ($r) use ($chiffres, &$out) {
        $src = (string)($r['source'] ?? ''); $h = 's' . substr(md5($src), 0, 6);
        if (!isset($out['_sources'][$h]) && count($out['_sources'] ?? []) < 12) $out['_sources'][$h] = sante_hc_nom_source($src);
        $deb = $r['start_time'] ?? ($r['time'] ?? ''); $fin = $r['end_time'] ?? null;
        return $h . '|' . $chiffres($deb) . ($fin !== null && $fin !== $deb ? '|' . $chiffres($fin) : '');
    };
    $kcal = function ($r) { $v = (float)$r['value']; $u = strtolower((string)($r['unit'] ?? 'kcal')); return $u === 'cal' ? $v / 1000 : ($u === 'kj' ? $v / 4.184 : ($u === 'j' ? $v / 4184 : $v)); };
    $kg = function ($r) { $v = (float)$r['value']; $u = strtolower((string)($r['unit'] ?? 'kg')); return in_array($u, ['g', 'gram', 'grams'], true) ? $v / 1000 : (in_array($u, ['lb', 'lbs', 'pound', 'pounds'], true) ? $v * 0.45359237 : $v); };
    //  v1.16 — longueurs et volumes : ramenés en mètres et en millilitres (unité absente : devinée d'après l'ordre de grandeur)
    $m = function ($r, string $defaut) { $v = (float)$r['value']; $u = strtolower((string)($r['unit'] ?? $defaut)); return in_array($u, ['km', 'kilometer', 'kilometers'], true) ? $v * 1000 : (in_array($u, ['cm', 'centimeter', 'centimeters'], true) ? $v / 100 : (in_array($u, ['mi', 'mile', 'miles'], true) ? $v * 1609.344 : (in_array($u, ['ft', 'feet'], true) ? $v * 0.3048 : $v))); };
    $ml = function ($r) { $v = (float)$r['value']; $u = strtolower((string)($r['unit'] ?? '')); return in_array($u, ['l', 'liter', 'liters', 'litre', 'litres'], true) ? $v * 1000 : (in_array($u, ['ml', 'milliliter', 'milliliters'], true) ? $v : ($v < 20 ? $v * 1000 : $v)); };
    $champ = function ($r, array $noms) { foreach ($noms as $n) { if (is_numeric($r[$n] ?? null)) return (float)$r[$n]; if (is_array($r['value'] ?? null) && is_numeric($r['value'][$n] ?? null)) return (float)$r['value'][$n]; } return null; };
    $duree = function ($deb, $fin) use ($zone) { $a = sante_hc_local($deb, [], 'x', $zone); $b = sante_hc_local($fin, [], 'x', $zone); return $a && $b && $b[2] > $a[2] ? $b[2] - $a[2] : null; };
    foreach ($p['data'] as $type => $liste) {
        if (!is_array($liste) || !array_is_list($liste)) continue;
        $t = $norm($type);
        $tk = substr(preg_replace('/[^a-z0-9_]/', '', strtolower((string)$type)), 0, 40) ?: 'x';
        $out['_recu'][$tk] = count($liste);
        foreach ($liste as $r) {
            if (!is_array($r)) continue;
            //  v1.24 — quelles applis écrivent quoi dans Health Connect (Samsung Health, la montre, le téléphone seul…)
            $out['_vus'][$tk][sante_hc_nom_source((string)($r['source'] ?? ''))] = true;
            $meta = ['id' => $cle($r)]; $deb = $r['start_time'] ?? ($r['time'] ?? null); $fin = $r['end_time'] ?? $deb;
            if (in_array($t, ['steps', 'stepscount', 'step'], true) && is_numeric($r['value'] ?? null)) $out['steps'][] = ['count' => (float)$r['value'], 'start_time' => $deb, 'end_time' => $fin, 'metadata' => $meta];
            elseif (in_array($t, ['activecalories', 'activecaloriesburned', 'activeenergy', 'activeenergyburned', 'caloriesactive'], true) && is_numeric($r['value'] ?? null)) $out['active_calories'][] = ['calories' => $kcal($r), 'start_time' => $deb, 'end_time' => $fin, 'metadata' => $meta];
            elseif (in_array($t, ['heartrate', 'heartratesamples', 'heartratebpm'], true) && is_numeric($r['value'] ?? ($r['bpm'] ?? null))) $out['heart_rate'][] = ['bpm' => (float)($r['value'] ?? $r['bpm']), 'time' => $deb, 'metadata' => $meta];
            elseif (in_array($t, ['restingheartrate', 'restingheartratebpm'], true) && is_numeric($r['value'] ?? null)) $out['resting_heart_rate'][] = ['bpm' => (float)$r['value'], 'time' => $deb, 'metadata' => $meta];
            elseif (in_array($t, ['weight', 'bodyweight'], true) && is_numeric($r['value'] ?? null)) $out['weight'][] = ['kilograms' => $kg($r), 'time' => $deb, 'metadata' => $meta];
            //  v1.16 — distance, calories totales, séances, SpO2, tension, hydratation, masse grasse, taille, VFC
            elseif (in_array($t, ['distance', 'distancewalked', 'distancewalkingrunning'], true) && is_numeric($r['value'] ?? null)) $out['distance'][] = ['meters' => $m($r, 'm'), 'start_time' => $deb, 'end_time' => $fin, 'metadata' => $meta];
            elseif (in_array($t, ['totalcalories', 'totalcaloriesburned', 'caloriestotal'], true) && is_numeric($r['value'] ?? null)) $out['total_calories'][] = ['calories' => $kcal($r), 'start_time' => $deb, 'end_time' => $fin, 'metadata' => $meta];
            elseif (in_array($t, ['exercise', 'exercisesession', 'exercisesessions', 'workout', 'workouts'], true)) {
                $s = $duree($deb, $fin) ?? (is_numeric($r['value'] ?? null) ? (float)$r['value'] * (preg_match('/^(s|sec|seconds?)$/', strtolower((string)($r['unit'] ?? 'min'))) ? 1 : 60) : null);
                if ($s) $out['exercise'][] = ['duration_seconds' => $s, 'start_time' => $deb, 'type' => (string)($r['exercise_type'] ?? ($r['type'] ?? ($r['title'] ?? ''))), 'metadata' => $meta];
            }
            elseif (in_array($t, ['oxygensaturation', 'spo2', 'bloodoxygen'], true) && is_numeric($r['value'] ?? ($r['percentage'] ?? null))) $out['oxygen_saturation'][] = ['percentage' => (float)($r['value'] ?? $r['percentage']), 'time' => $deb, 'metadata' => $meta];
            elseif (in_array($t, ['bloodpressure'], true) && ($sy = $champ($r, ['systolic', 'systolic_mmhg', 'sys'])) !== null && ($di = $champ($r, ['diastolic', 'diastolic_mmhg', 'dia'])) !== null) $out['blood_pressure'][] = ['systolic' => $sy, 'diastolic' => $di, 'time' => $deb, 'metadata' => $meta];
            elseif (in_array($t, ['hydration', 'water'], true) && is_numeric($r['value'] ?? null)) $out['hydration'][] = ['milliliters' => $ml($r), 'start_time' => $deb, 'end_time' => $fin, 'metadata' => $meta];
            elseif (in_array($t, ['bodyfat', 'bodyfatpercentage'], true) && is_numeric($r['value'] ?? null)) $out['body_fat'][] = ['percentage' => (float)$r['value'], 'time' => $deb, 'metadata' => $meta];
            elseif (in_array($t, ['height', 'bodyheight'], true) && is_numeric($r['value'] ?? null)) { $h = $m($r, (float)$r['value'] > 3 ? 'cm' : 'm'); $out['height'][] = ['meters' => $h, 'time' => $deb, 'metadata' => $meta]; }
            elseif (in_array($t, ['heartratevariability', 'heartratevariabilityrmssd', 'hrv', 'hrvrmssd'], true) && is_numeric($r['value'] ?? null)) $out['heart_rate_variability'][] = ['ms' => (float)$r['value'], 'time' => $deb, 'metadata' => $meta];
            //  v1.17 — les autres mesures « une valeur à un instant » : la dernière du jour est gardée
            elseif (is_numeric($r['value'] ?? null) && ($g = sante_hc_mesure_simple($t, $r, $kg, $kcal)) !== null) $out['mesures'][] = ['champ' => $g[0], 'valeur' => $g[1], 'time' => $deb, 'metadata' => $meta];
            elseif (in_array($t, ['sleep', 'sleepsession', 'sleepsessions', 'sleepstage', 'sleepstages'], true)) {
                if (preg_match('/awake|out_?of_?bed/i', (string)($r['stage'] ?? ($r['type'] ?? '')))) continue;      // l'éveil ne compte pas comme sommeil
                $a = sante_hc_local($deb, [], 'x', $zone); $b = sante_hc_local($fin, [], 'x', $zone);
                $dur = $a && $b && $b[2] > $a[2] ? $b[2] - $a[2] : (is_numeric($r['value'] ?? null) ? (float)$r['value'] * (strtolower((string)($r['unit'] ?? '')) === 'min' ? 60 : 1) : null);
                if ($dur) $out['sleep'][] = ['session_end_time' => $fin, 'duration_seconds' => $dur, 'metadata' => $meta];
            }
        }
    }
    //  v1.24 — deux mesures de la même source sur le même intervalle dans un envoi (téléphone et montre passés par Samsung
    //  Health) avaient la même clé : la dernière écrasait l'autre. On garde la plus grande (les deux comptent les mêmes pas).
    foreach (['steps' => 'count', 'active_calories' => 'calories', 'distance' => 'meters', 'total_calories' => 'calories', 'hydration' => 'milliliters'] as $type => $champ) {
        if (empty($out[$type])) continue;
        $par = [];
        foreach ($out[$type] as $r) { $k = $r['metadata']['id']; if (!isset($par[$k]) || $r[$champ] > $par[$k][$champ]) $par[$k] = $r; }
        $out[$type] = array_values($par);
    }
    return $out;
}

/** Est-ce un envoi de HC Webhook ? (racine avec timestamp/app_version, ou une de ses listes ; ou le format B) */
function sante_hc_est_payload($p): bool {
    if (!is_array($p) || array_is_list($p)) return false;
    if (sante_hc_est_format_b($p)) return true;
    if (isset($p['app_version']) && isset($p['timestamp'])) return true;
    foreach (SANTE_HC_TYPES as $t) if (isset($p[$t]) && is_array($p[$t]) && array_is_list($p[$t])) return true;
    return false;
}

/** Heure ISO-8601 → [date locale, « HH:MM » locale, horodatage] ; « Z » : décalage de la mesure, sinon le fuseau de l'envoi, sinon Casablanca. */
function sante_hc_local($t, $meta = [], string $champOffset = 'zone_offset_seconds', string $zone = ''): ?array {
    if (!is_string($t) || $t === '') return null;
    try { $d = new DateTimeImmutable($t); } catch (Exception $e) { return null; }
    if (!preg_match('/[+-]\d{2}:?\d{2}$/', $t)) {                       // UTC (« Z ») : ramené à l'heure du téléphone
        $off = is_array($meta) ? ($meta[$champOffset] ?? ($meta['zone_offset_seconds'] ?? ($meta['start_zone_offset_seconds'] ?? null))) : null;
        if (is_numeric($off)) { $s = (int)$off; $d = $d->setTimezone(new DateTimeZone(sprintf('%s%02d:%02d', $s < 0 ? '-' : '+', intdiv(abs($s), 3600), intdiv(abs($s) % 3600, 60)))); }
        else { try { $d = $d->setTimezone(new DateTimeZone($zone && $zone !== 'UTC' ? $zone : SANTE_HC_ZONE)); } catch (Exception $e) { $d = $d->setTimezone(new DateTimeZone(SANTE_HC_ZONE)); } }
    }
    return [$d->format('Y-m-d'), $d->format('H:i'), $d->getTimestamp()];
}

/**
 * Range l'envoi dans l'état (morceaux de journal[date].hc) et rend les appels sync_samsung_health des jours touchés.
 * → ['calls' => [...], 'dates' => [...], 'ignores' => n]
 */
function sante_hc_integrer(array $p, array &$etat): array {
    $zone = is_string($p['timezone'] ?? null) ? $p['timezone'] : '';
    if (!is_array($etat['journal'] ?? null)) $etat['journal'] = [];
    $touches = []; $ignores = 0; $poids = []; $repos = [];
    $morceau = function (string $date, string $type, string $cle, float $v) use (&$etat, &$touches) {
        $j = &$etat['journal'][$date];
        if (!is_array($j)) $j = [];
        if (!isset($j['hc']) || !is_array($j['hc'])) $j['hc'] = [];
        if (!isset($j['hc'][$type]) || !is_array($j['hc'][$type])) $j['hc'][$type] = [];
        if (preg_match('/^(id:s[0-9a-f]{6}\|[0-9TZ]+)\|/', $cle, $mm)) unset($j['hc'][$type][$mm[1]]);
        $j['hc'][$type][$cle] = $v;
        $touches[$date][$type] = true;
    };
    $cle = fn($r, $repli) => is_array($r['metadata'] ?? null) && is_string($r['metadata']['id'] ?? null) && $r['metadata']['id'] !== '' ? 'id:' . substr($r['metadata']['id'], 0, 60) : $repli;

    //  pas et kcal actives : un total « Quotidien » (20 h et plus) remplace la journée ; sinon une tranche
    foreach (['steps' => ['count', 'pas'], 'active_calories' => ['calories', 'kcal'], 'distance' => ['meters', 'dist'], 'total_calories' => ['calories', 'kcalt'], 'hydration' => ['milliliters', 'eau']] as $type => [$champ, $nom]) {
        foreach ((array)($p[$type] ?? []) as $r) {
            if (!is_array($r) || !is_numeric($r[$champ] ?? null)) { $ignores++; continue; }
            $a = sante_hc_local($r['start_time'] ?? null, $r['metadata'] ?? [], 'start_zone_offset_seconds', $zone);
            $b = sante_hc_local($r['end_time'] ?? null, $r['metadata'] ?? [], 'end_zone_offset_seconds', $zone);
            if (!$a) { $ignores++; continue; }
            $v = (float)$r[$champ];
            if ($b && $b[2] - $a[2] >= 20 * 3600) { $etat['journal'][$a[0]]['hc'][$nom] = []; $morceau($a[0], $nom, 'jour', $v); }
            else { if (isset($etat['journal'][$a[0]]['hc'][$nom]['jour'])) unset($etat['journal'][$a[0]]['hc'][$nom]['jour']); $morceau($a[0], $nom, $cle($r, 't:' . $a[1]), $v); }
        }
    }
    //  fréquence cardiaque : chaque tranche (moyenne) ou mesure, rangée par heure de début
    foreach ((array)($p['heart_rate'] ?? []) as $r) {
        $v = is_array($r) ? ($r['avg'] ?? ($r['bpm'] ?? null)) : null;
        $a = is_array($r) ? sante_hc_local($r['time'] ?? null, $r['metadata'] ?? [], 'zone_offset_seconds', $zone) : null;
        if (!is_numeric($v) || !$a || $v < 25 || $v > 230) { $ignores++; continue; }
        $morceau($a[0], 'fc', $cle($r, 't:' . $a[1]), round((float)$v, 1));
    }
    //  sommeil : par jour de réveil, une séance = une clé ; siestes écartées
    foreach ((array)($p['sleep'] ?? []) as $r) {
        $fin = is_array($r) ? ($r['session_end_time'] ?? ($r['end_time'] ?? null)) : null;
        $b = sante_hc_local($fin, $r['metadata'] ?? [], 'end_zone_offset_seconds', $zone);
        $dur = is_array($r) && is_numeric($r['duration_seconds'] ?? null) ? (float)$r['duration_seconds'] : null;
        if ($dur === null && $b) { $a = sante_hc_local($r['session_start_time'] ?? ($r['start_time'] ?? null), $r['metadata'] ?? [], 'start_zone_offset_seconds', $zone); if ($a) $dur = $b[2] - $a[2]; }
        if (!$b || !$dur || $dur <= 0 || $dur > 24 * 3600) { $ignores++; continue; }
        $h = (int)substr($b[1], 0, 2);
        if ($dur < 90 * 60 && $h >= 10 && $h < 20) { $ignores++; continue; }   // sieste
        $morceau($b[0], 'sommeil', $cle($r, 'fin:' . $b[1]), round($dur / 60));
    }
    //  v1.16 — séances d'exercice : minutes, par jour de début, une séance = une clé
    foreach ((array)($p['exercise'] ?? []) as $r) {
        $a = is_array($r) ? sante_hc_local($r['start_time'] ?? null, $r['metadata'] ?? [], 'start_zone_offset_seconds', $zone) : null;
        $s = is_array($r) && is_numeric($r['duration_seconds'] ?? null) ? (float)$r['duration_seconds'] : null;
        if (!$a || !$s || $s <= 0 || $s > 24 * 3600) { $ignores++; continue; }
        $morceau($a[0], 'exo', $cle($r, 't:' . $a[1]), round($s / 60, 1));
    }
    //  v1.16 — VFC : moyenne du jour
    foreach ((array)($p['heart_rate_variability'] ?? []) as $r) {
        $a = is_array($r) ? sante_hc_local($r['time'] ?? null, $r['metadata'] ?? [], 'zone_offset_seconds', $zone) : null;
        if (!$a || !is_numeric($r['ms'] ?? null) || $r['ms'] <= 0 || $r['ms'] > 300) { $ignores++; continue; }
        $morceau($a[0], 'vfc', $cle($r, 't:' . $a[1]), round((float)$r['ms'], 1));
    }
    //  poids, FC au repos, SpO2, tension, masse grasse : la dernière mesure du jour ; la taille : la plus récente de l'envoi
    $spo2 = []; $tension = []; $graisse = []; $taille = null; $simples = [];
    foreach ((array)($p['mesures'] ?? []) as $r) {
        $a = is_array($r) ? sante_hc_local($r['time'] ?? null, $r['metadata'] ?? [], 'zone_offset_seconds', $zone) : null;
        $b = is_array($r) ? (SANTE_BORNES_SAMSUNG[$r['champ'] ?? ''] ?? null) : null;
        if (!$a || !$b || !is_numeric($r['valeur'] ?? null) || $r['valeur'] < $b[0] || $r['valeur'] > $b[1]) { $ignores++; continue; }
        if (!isset($simples[$a[0]][$r['champ']]) || $a[2] >= $simples[$a[0]][$r['champ']][0]) $simples[$a[0]][$r['champ']] = [$a[2], round((float)$r['valeur'], 1)];
    }
    foreach ((array)($p['height'] ?? []) as $r) {
        $a = is_array($r) ? sante_hc_local($r['time'] ?? null, $r['metadata'] ?? [], 'zone_offset_seconds', $zone) : null;
        if (!is_array($r) || !is_numeric($r['meters'] ?? null)) { $ignores++; continue; }
        $ts = $a ? $a[2] : 0;
        if ($taille === null || $ts >= $taille[0]) $taille = [$ts, (float)$r['meters'] * 100];
    }
    foreach ((array)($p['blood_pressure'] ?? []) as $r) {
        $a = is_array($r) ? sante_hc_local($r['time'] ?? null, $r['metadata'] ?? [], 'zone_offset_seconds', $zone) : null;
        if (!$a || !is_numeric($r['systolic'] ?? null) || !is_numeric($r['diastolic'] ?? null)) { $ignores++; continue; }
        if (!isset($tension[$a[0]]) || $a[2] >= $tension[$a[0]][0]) $tension[$a[0]] = [$a[2], (float)$r['systolic'], (float)$r['diastolic']];
    }
    foreach (['weight' => ['kilograms', &$poids], 'resting_heart_rate' => ['bpm', &$repos], 'oxygen_saturation' => ['percentage', &$spo2], 'body_fat' => ['percentage', &$graisse]] as $type => [$champ, &$cible]) {
        foreach ((array)($p[$type] ?? []) as $r) {
            $a = is_array($r) ? sante_hc_local($r['time'] ?? null, $r['metadata'] ?? [], 'zone_offset_seconds', $zone) : null;
            if (!$a || !is_numeric($r[$champ] ?? null)) { $ignores++; continue; }
            if (!isset($cible[$a[0]]) || $a[2] >= $cible[$a[0]][0]) $cible[$a[0]] = [$a[2], (float)$r[$champ]];
        }
    }
    unset($cible);
    //  les totaux des jours touchés
    $calls = [];
    $dates = array_unique(array_merge(array_keys($touches), array_keys($poids), array_keys($repos), array_keys($spo2), array_keys($tension), array_keys($graisse), array_keys($simples)));
    sort($dates);
    foreach ($dates as $d) {
        $hc = $etat['journal'][$d]['hc'] ?? [];
        $args = ['date' => $d];
        if (!empty($touches[$d]['pas'])) $args['pas'] = (int)round(sante_hc_somme_sources($hc['pas'] ?? []));
        if (!empty($touches[$d]['kcal'])) $args['kcal_actives'] = (int)round(sante_hc_somme_sources($hc['kcal'] ?? []));
        if (!empty($touches[$d]['fc']) && !empty($hc['fc'])) { $args['fc_moy'] = (int)round(array_sum($hc['fc']) / count($hc['fc'])); $args['fc_min'] = (int)round(min($hc['fc'])); $args['fc_max'] = (int)round(max($hc['fc']));
            //  v1.20 — Samsung Health n'écrit pas de « FC au repos » dans Health Connect : estimée d'après la fréquence cardiaque
            //  du jour (la moyenne des 10 % de mesures les plus basses), dès 30 mesures
            if (count($hc['fc']) >= 30) { $v = array_values($hc['fc']); sort($v); $bas = array_slice($v, 0, max(3, (int)floor(count($v) / 10))); $args['fc_repos_est'] = (int)round(array_sum($bas) / count($bas)); } }
        if (!empty($touches[$d]['dist'])) $args['distance_km'] = round(sante_hc_somme_sources($hc['dist'] ?? []) / 1000, 2);
        if (!empty($touches[$d]['kcalt'])) $args['kcal_totales'] = (int)round(sante_hc_somme_sources($hc['kcalt'] ?? []));
        if (!empty($touches[$d]['eau'])) $args['hydratation_ml'] = (int)round(sante_hc_somme_sources($hc['eau'] ?? []));
        if (!empty($touches[$d]['exo'])) $args['exercice_min'] = (int)round(array_sum($hc['exo'] ?? []));
        if (!empty($touches[$d]['vfc']) && !empty($hc['vfc'])) $args['vfc_ms'] = (int)round(array_sum($hc['vfc']) / count($hc['vfc']));
        foreach ($simples[$d] ?? [] as $k => [, $v]) $args[$k] = $v;
        if (isset($spo2[$d]) && $spo2[$d][1] >= 50 && $spo2[$d][1] <= 100) $args['spo2'] = round($spo2[$d][1], 1);
        if (isset($graisse[$d]) && $graisse[$d][1] >= 2 && $graisse[$d][1] <= 80) $args['graisse_pct'] = round($graisse[$d][1], 1);
        if (isset($tension[$d]) && $tension[$d][1] >= 60 && $tension[$d][1] <= 260 && $tension[$d][2] >= 30 && $tension[$d][2] <= 160) { $args['tension_sys'] = (int)round($tension[$d][1]); $args['tension_dia'] = (int)round($tension[$d][2]); }
        if (!empty($touches[$d]['sommeil'])) $args['sommeil_min'] = (int)round(array_sum($hc['sommeil'] ?? []));
        if (isset($poids[$d]) && $poids[$d][1] >= 20 && $poids[$d][1] <= 400) $args['poids'] = round($poids[$d][1], 1);
        if (isset($repos[$d]) && $repos[$d][1] >= 25 && $repos[$d][1] <= 150) $args['fc_repos'] = (int)round($repos[$d][1]);
        //  hors bornes : la valeur est écartée (le reste du jour passe), plutôt que de refuser tout l'envoi
        foreach (['pas' => [0, 100000], 'kcal_actives' => [0, 10000], 'sommeil_min' => [0, 1440], 'distance_km' => [0, 300], 'kcal_totales' => [0, 20000], 'hydratation_ml' => [0, 15000], 'exercice_min' => [0, 1440]] as $k => [$lo, $hi]) if (isset($args[$k]) && ($args[$k] < $lo || $args[$k] > $hi)) unset($args[$k]);
        if (count($args) > 1) $calls[] = ['function' => 'sync_samsung_health', 'args' => $args];
    }
    //  v1.16 — ce que le téléphone a envoyé, type par type (affiché dans l'appli : on voit ce qui manque)
    $recu = [];
    foreach (SANTE_HC_TYPES as $t) if (!empty($p[$t]) && is_array($p[$t])) $recu[$t] = count($p[$t]);
    if (!empty($p['_recu']) && is_array($p['_recu'])) $recu = $p['_recu'];
    //  v1.17 — les pas du dernier jour touché, source par source (pour voir d'où vient un écart avec Samsung Health)
    $noms = array_merge((array)($etat['sync_auto']['sources'] ?? []), (array)($p['_sources'] ?? []));
    $detail = null;
    $joursPas = array_keys(array_filter($touches, fn($t) => !empty($t['pas'])));
    if ($joursPas) {
        $d = max($joursPas); $par = [];
        foreach ((array)($etat['journal'][$d]['hc']['pas'] ?? []) as $k => $v) {
            $h = preg_match('/^(?:id:)?(s[0-9a-f]{6})\|/', (string)$k, $m) ? $m[1] : '_';
            $nom = $h === '_' ? 'total du jour' : ('s000000' === $h ? 'plus tôt (montre + téléphone fusionnés)' : ($noms[$h] ?? 'source ' . substr($h, 1, 4)));
            $par[$nom] = ($par[$nom] ?? 0) + (float)$v;
        }
        $detail = ['date' => $d, 'sources' => array_map(fn($x) => (int)round($x), $par), 'retenu' => (int)round(sante_hc_somme_sources($etat['journal'][$d]['hc']['pas'] ?? []))];
    }
    $taille_cm = $taille && $taille[1] >= 100 && $taille[1] <= 250 ? round($taille[1]) : null;
    return ['calls' => $calls, 'dates' => array_map(fn($c) => $c['args']['date'], $calls), 'ignores' => $ignores, 'recu' => $recu, 'taille_cm' => $taille_cm, 'sources' => array_slice($noms, -12, 12, true), 'detail_pas' => $detail];
}

/** Le jeton du webhook : db_config.php (sante_samsung_token), la variable d'environnement, ou celui créé depuis l'appli. */
function sante_jeton_fichier(): string {
    $f = getenv('SANTE_DATA_FILE');
    $dir = $f ? dirname($f) : dirname(sante_fichier());
    return $dir . '/sante_jeton_samsung.php';            // un .php : servi, il n'affiche rien ; jamais versionné
}
function sante_jetons_valides(): array {
    $cfg = function_exists('sante_db_config') ? (sante_db_config() ?? []) : [];
    $j = [(string)($cfg['sante_samsung_token'] ?? ''), (string)(getenv('SANTE_SAMSUNG_TOKEN') ?: '')];
    $f = sante_jeton_fichier();
    if (is_file($f)) { $x = include $f; if (is_string($x)) $j[] = $x; }
    return array_values(array_filter($j, fn($x) => strlen($x) >= 16));
}
function sante_creer_jeton(): ?string {
    $j = bin2hex(random_bytes(24));
    $f = sante_jeton_fichier();
    if (@file_put_contents($f, "<?php\n// Jeton du webhook Samsung (créé depuis Santé Master). Ne pas versionner.\nreturn '" . $j . "';\n", LOCK_EX) === false) return null;
    @chmod($f, 0600);
    return $j;
}

/**
 * L'authentification faite EN AMONT (basic_auth de Caddy sur /finance/) : si une requête atteint PHP avec un en-tête
 * Authorization Basic, Caddy a déjà vérifié le mot de passe (sinon il aurait répondu 401). Même preuve que get_ai_memory.php.
 */
function sante_auth_amont(): ?string {
    foreach (['PHP_AUTH_USER', 'REMOTE_USER', 'REDIRECT_REMOTE_USER'] as $k) if (!empty($_SERVER[$k])) return (string)$_SERVER[$k];
    $h = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
    if (stripos((string)$h, 'basic ') === 0) { $d = base64_decode(substr((string)$h, 6), true); if ($d !== false && strpos($d, ':') !== false) return explode(':', $d, 2)[0]; }
    return null;
}

/** Les données de démonstration du bouton « Test » de l'appli : une montre « Pixel Watch » et l'appli Google Fit imaginaires. */
function sante_hc_est_demo($p): bool {
    if (!is_array($p) || array_is_list($p)) return false;
    if (!empty($p['test'])) return true;
    foreach (SANTE_HC_TYPES as $t) foreach ((array)($p[$t] ?? []) as $r) {
        $m = is_array($r) ? ($r['metadata'] ?? null) : null;
        if (is_array($m) && ($m['data_origin'] ?? '') === 'com.google.android.apps.fitness' && (($m['device']['model'] ?? '') === 'Pixel Watch')) return true;
    }
    return false;
}

/**
 * Somme d'un jour de pas / kcal / distance. Plusieurs sources (téléphone ET montre) comptent souvent les MÊMES pas :
 * chaque mesure (clé « sXXXXXX|début|fin ») est répartie sur ses minutes, puis, pour chaque minute, on garde la source
 * qui en compte le plus, et on additionne les minutes — comme Samsung Health qui fusionne téléphone et montre.
 * v1.17 : la comparaison se faisait par heure (v1.16) ou sur la journée entière (v1.15), ce qui perdait les moments où
 * une seule source comptait dans une heure partagée. Clés sans heure exploitable (total « jour », anciens formats) :
 * regroupées comme avant.
 */
function sante_hc_somme_sources(array $morceaux): float {
    $min = []; $autres = [];                            // [minute][source] => pas ; [groupe][source] => pas
    $ts = function (string $c): ?int { if (!preg_match('/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/', $c, $m)) return null; return gmmktime((int)$m[4], (int)$m[5], (int)$m[6], (int)$m[2], (int)$m[3], (int)$m[1]); };
    foreach ($morceaux as $k => $v) {
        $k = (string)$k; $v = (float)$v;
        if (preg_match('/^(?:id:)?(s[0-9a-f]{6})\|([0-9TZ]+)(?:\|([0-9TZ]+))?$/', $k, $m) && ($a = $ts($m[2])) !== null) {
            $src = $m[1]; $b = isset($m[3]) ? $ts($m[3]) : null;
            if ($b === null || $b <= $a || $b - $a > 86400) { $q = intdiv($a, 60); $min[$q][$src] = ($min[$q][$src] ?? 0) + $v; continue; }
            for ($q = intdiv($a, 60), $fin = intdiv($b - 1, 60); $q <= $fin; $q++) {
                $part = (min($b, ($q + 1) * 60) - max($a, $q * 60)) / ($b - $a);
                if ($part > 0) $min[$q][$src] = ($min[$q][$src] ?? 0) + $v * $part;
            }
        } else {
            $src = preg_match('/^(?:id:)?(s[0-9a-f]{6})\|/', $k, $m) ? $m[1] : '_';
            $g = preg_match('/^t:(\d{2})/', $k, $m) ? 'local' . $m[1] : 'x';
            $autres[$g][$src] = ($autres[$g][$src] ?? 0) + $v;
        }
    }
    $total = 0.0;
    foreach ($min as $s) $total += max($s);
    foreach ($autres as $s) $total += max($s);
    return $total;
}

/**
 * v1.24 — garde le résumé des 30 derniers envois du téléphone (backups/hc_envois.json, à côté des sauvegardes, derrière le
 * mot de passe du site) : par type, combien de mesures, de quelles applis, quels champs, la plus ancienne et la plus récente,
 * et combien datent d'AVANT l'envoi précédent (arrivées en retard). C'est ce qui dit si une mesure manque côté téléphone
 * (jamais envoyée) ou côté serveur (reçue mais mal comptée). Lu par « php sante/hc_diagnostic.php ».
 */
function sante_hc_noter_envoi($brut, string $dossier): void {
    if (!is_array($brut) || !is_dir($dossier) || !is_writable($dossier)) return;
    $f = $dossier . '/hc_envois.json';
    $L = is_file($f) ? (json_decode((string)@file_get_contents($f), true) ?: []) : [];
    $avant = $L ? (string)($L[count($L) - 1]['recu_le'] ?? '') : '';
    $data = is_array($brut['data'] ?? null) ? $brut['data'] : array_filter($brut, fn($v) => is_array($v) && array_is_list($v));
    $types = [];
    foreach ($data as $t => $liste) {
        if (!is_array($liste) || !array_is_list($liste)) continue;
        $x = ['n' => count($liste), 'sources' => [], 'champs' => [], 'debut' => null, 'fin' => null, 'somme' => 0, 'en_retard' => 0, 'exemples' => []];
        foreach ($liste as $i => $r) {
            if (!is_array($r)) continue;
            $src = (string)($r['source'] ?? ($r['metadata']['data_origin'] ?? ''));
            $x['sources'][$src] = ($x['sources'][$src] ?? 0) + 1;
            foreach (array_keys($r) as $k) $x['champs'][(string)$k] = true;
            $deb = (string)($r['start_time'] ?? ($r['time'] ?? '')); $fin = (string)($r['end_time'] ?? $deb);
            if ($deb !== '' && ($x['debut'] === null || strcmp($deb, $x['debut']) < 0)) $x['debut'] = $deb;
            if ($fin !== '' && ($x['fin'] === null || strcmp($fin, $x['fin']) > 0)) $x['fin'] = $fin;
            $v = $r['value'] ?? ($r['count'] ?? null); if (is_numeric($v)) $x['somme'] += (float)$v;
            if ($avant !== '' && ($t2 = strtotime($fin)) && ($t1 = strtotime($avant)) && $t2 < $t1) $x['en_retard']++;
            if ($i < 2 || $i >= count($liste) - 2) $x['exemples'][] = mb_substr(json_encode($r, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), 0, 400);
        }
        $x['champs'] = array_keys($x['champs']); $x['somme'] = round($x['somme'], 1);
        $types[mb_substr((string)$t, 0, 40)] = $x;
    }
    $L[] = ['recu_le' => gmdate('Y-m-d\TH:i:s\Z'), 'metadata' => is_array($brut['metadata'] ?? null) ? array_slice($brut['metadata'], 0, 12) : array_intersect_key($brut, ['timestamp' => 1, 'app_version' => 1, 'timezone' => 1]), 'types' => $types];
    $L = array_slice($L, -30);
    $tmp = $f . '.' . getmypid() . '.tmp';
    if (@file_put_contents($tmp, json_encode($L, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT)) !== false) @rename($tmp, $f); else @unlink($tmp);
}

/** v1.17 — nom lisible d'une source Health Connect (paquet Android) */
function sante_hc_nom_source(string $s): string {
    $l = strtolower($s);
    if ($l === '') return 'source inconnue';
    if (str_contains($l, 'wear') || str_contains($l, 'watch')) return 'montre';
    if (str_contains($l, 'shealth') || str_contains($l, 'samsung')) return 'Samsung Health';
    if (str_contains($l, 'healthconnect.phone') || str_contains($l, 'phone')) return 'téléphone';
    if (str_contains($l, 'fitness') || str_contains($l, 'fit')) return 'Google Fit';
    $p = explode('.', $s);
    return mb_substr(implode('.', array_slice($p, -2)), 0, 30);
}

/** v1.17 — les mesures « une valeur à un instant » de Health Connect → [champ, valeur dans l'unité de Santé Master] */
function sante_hc_mesure_simple(string $t, array $r, callable $kg, callable $kcal): ?array {
    $v = (float)$r['value']; $u = strtolower((string)($r['unit'] ?? ''));
    if (in_array($t, ['vomax', 'vomaxmlkgmin', 'vo'], true)) return ['vo2max', $v];
    if (in_array($t, ['respiratoryrate', 'respiratoryratebpm'], true)) return ['freq_resp', $v];
    if (in_array($t, ['bodytemperature', 'temperature', 'skintemperature'], true)) return ['temperature', str_contains($u, 'f') && !str_contains($u, 'c') ? ($v - 32) * 5 / 9 : $v];
    if (in_array($t, ['bloodglucose', 'glucose'], true)) return ['glycemie', str_contains($u, 'mmol') || ($u === '' && $v < 35) ? $v * 18.0182 : $v];
    if (in_array($t, ['leanbodymass', 'leanmass'], true)) return ['masse_maigre', $kg($r)];
    if (in_array($t, ['waistcircumference', 'waist'], true)) return ['tour_taille', in_array($u, ['m', 'meter', 'meters'], true) || ($u === '' && $v < 3) ? $v * 100 : (in_array($u, ['in', 'inch', 'inches'], true) ? $v * 2.54 : $v)];
    if (in_array($t, ['basalmetabolicrate', 'restingenergy', 'restingcalories', 'restingenergyburned', 'bmr', 'basalenergy'], true)) return ['kcal_repos', $kcal($r)];
    return null;
}
