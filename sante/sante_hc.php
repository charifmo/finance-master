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

const SANTE_HC_TYPES = ['steps', 'active_calories', 'weight', 'sleep', 'heart_rate', 'resting_heart_rate'];
const SANTE_HC_ZONE = 'Africa/Casablanca';

/**
 * Format B (v1.15) : l'appli « Health Connect Webhook » installée sur le téléphone range ses mesures sous
 * { metadata: { app_version, schema_version, sync_timestamp, device_model, os_version, timezone }, data: { steps: [ { start_time,
 * end_time, unit, source, recording_method, value } … ], … } }. Convertit en format A (celui de la doc de l'appli de Naveen MC,
 * lu par sante_hc_integrer) : chaque mesure reçoit une clé stable « source courte | début » (un renvoi remplace), la valeur est
 * ramenée en kg / kcal, le fuseau de l'envoi sert aux heures « Z ».
 */
function sante_hc_est_format_b($p): bool {
    return is_array($p) && !array_is_list($p) && is_array($p['metadata'] ?? null) && is_array($p['data'] ?? null) && !array_is_list($p['data']);
}
function sante_hc_convertir_b(array $p): array {
    $m = $p['metadata']; $zone = is_string($m['timezone'] ?? null) ? $m['timezone'] : 'UTC';
    $out = ['timestamp' => (string)($m['sync_timestamp'] ?? gmdate('c')), 'app_version' => (string)($m['app_version'] ?? ''), 'timezone' => $zone];
    if (!empty($p['test']) || !empty($m['test'])) $out['test'] = true;
    $norm = fn($k) => preg_replace('/[^a-z]/', '', strtolower((string)$k));
    $cle = function ($r) { $deb = (string)($r['start_time'] ?? ($r['time'] ?? '')); return 's' . substr(md5((string)($r['source'] ?? '')), 0, 6) . '|' . preg_replace('/[^0-9TZ]/', '', substr($deb, 0, 23)); };
    $kcal = function ($r) { $v = (float)$r['value']; $u = strtolower((string)($r['unit'] ?? 'kcal')); return $u === 'cal' ? $v / 1000 : ($u === 'kj' ? $v / 4.184 : ($u === 'j' ? $v / 4184 : $v)); };
    $kg = function ($r) { $v = (float)$r['value']; $u = strtolower((string)($r['unit'] ?? 'kg')); return in_array($u, ['g', 'gram', 'grams'], true) ? $v / 1000 : (in_array($u, ['lb', 'lbs', 'pound', 'pounds'], true) ? $v * 0.45359237 : $v); };
    foreach ($p['data'] as $type => $liste) {
        if (!is_array($liste) || !array_is_list($liste)) continue;
        $t = $norm($type);
        foreach ($liste as $r) {
            if (!is_array($r)) continue;
            $meta = ['id' => $cle($r)]; $deb = $r['start_time'] ?? ($r['time'] ?? null); $fin = $r['end_time'] ?? $deb;
            if (in_array($t, ['steps', 'stepscount', 'step'], true) && is_numeric($r['value'] ?? null)) $out['steps'][] = ['count' => (float)$r['value'], 'start_time' => $deb, 'end_time' => $fin, 'metadata' => $meta];
            elseif (in_array($t, ['activecalories', 'activecaloriesburned', 'activeenergy', 'activeenergyburned', 'caloriesactive'], true) && is_numeric($r['value'] ?? null)) $out['active_calories'][] = ['calories' => $kcal($r), 'start_time' => $deb, 'end_time' => $fin, 'metadata' => $meta];
            elseif (in_array($t, ['heartrate', 'heartratesamples', 'heartratebpm'], true) && is_numeric($r['value'] ?? ($r['bpm'] ?? null))) $out['heart_rate'][] = ['bpm' => (float)($r['value'] ?? $r['bpm']), 'time' => $deb, 'metadata' => $meta];
            elseif (in_array($t, ['restingheartrate', 'restingheartratebpm'], true) && is_numeric($r['value'] ?? null)) $out['resting_heart_rate'][] = ['bpm' => (float)$r['value'], 'time' => $deb, 'metadata' => $meta];
            elseif (in_array($t, ['weight', 'bodyweight'], true) && is_numeric($r['value'] ?? null)) $out['weight'][] = ['kilograms' => $kg($r), 'time' => $deb, 'metadata' => $meta];
            elseif (in_array($t, ['sleep', 'sleepsession', 'sleepsessions', 'sleepstage', 'sleepstages'], true)) {
                if (preg_match('/awake|out_?of_?bed/i', (string)($r['stage'] ?? ($r['type'] ?? '')))) continue;      // l'éveil ne compte pas comme sommeil
                $a = sante_hc_local($deb, [], 'x', $zone); $b = sante_hc_local($fin, [], 'x', $zone);
                $dur = $a && $b && $b[2] > $a[2] ? $b[2] - $a[2] : (is_numeric($r['value'] ?? null) ? (float)$r['value'] * (strtolower((string)($r['unit'] ?? '')) === 'min' ? 60 : 1) : null);
                if ($dur) $out['sleep'][] = ['session_end_time' => $fin, 'duration_seconds' => $dur, 'metadata' => $meta];
            }
        }
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
        $j['hc'][$type][$cle] = $v;
        $touches[$date][$type] = true;
    };
    $cle = fn($r, $repli) => is_array($r['metadata'] ?? null) && is_string($r['metadata']['id'] ?? null) && $r['metadata']['id'] !== '' ? 'id:' . substr($r['metadata']['id'], 0, 60) : $repli;

    //  pas et kcal actives : un total « Quotidien » (20 h et plus) remplace la journée ; sinon une tranche
    foreach (['steps' => ['count', 'pas'], 'active_calories' => ['calories', 'kcal']] as $type => [$champ, $nom]) {
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
    //  poids et FC au repos : la dernière mesure du jour
    foreach (['weight' => ['kilograms', &$poids], 'resting_heart_rate' => ['bpm', &$repos]] as $type => [$champ, &$cible]) {
        foreach ((array)($p[$type] ?? []) as $r) {
            $a = is_array($r) ? sante_hc_local($r['time'] ?? null, $r['metadata'] ?? [], 'zone_offset_seconds', $zone) : null;
            if (!$a || !is_numeric($r[$champ] ?? null)) { $ignores++; continue; }
            if (!isset($cible[$a[0]]) || $a[2] >= $cible[$a[0]][0]) $cible[$a[0]] = [$a[2], (float)$r[$champ]];
        }
    }
    unset($cible);
    //  les totaux des jours touchés
    $calls = [];
    $dates = array_unique(array_merge(array_keys($touches), array_keys($poids), array_keys($repos)));
    sort($dates);
    foreach ($dates as $d) {
        $hc = $etat['journal'][$d]['hc'] ?? [];
        $args = ['date' => $d];
        if (!empty($touches[$d]['pas'])) $args['pas'] = (int)round(sante_hc_somme_sources($hc['pas'] ?? []));
        if (!empty($touches[$d]['kcal'])) $args['kcal_actives'] = (int)round(sante_hc_somme_sources($hc['kcal'] ?? []));
        if (!empty($touches[$d]['fc']) && !empty($hc['fc'])) $args['fc_moy'] = (int)round(array_sum($hc['fc']) / count($hc['fc']));
        if (!empty($touches[$d]['sommeil'])) $args['sommeil_min'] = (int)round(array_sum($hc['sommeil'] ?? []));
        if (isset($poids[$d]) && $poids[$d][1] >= 20 && $poids[$d][1] <= 400) $args['poids'] = round($poids[$d][1], 1);
        if (isset($repos[$d]) && $repos[$d][1] >= 25 && $repos[$d][1] <= 150) $args['fc_repos'] = (int)round($repos[$d][1]);
        //  hors bornes : la valeur est écartée (le reste du jour passe), plutôt que de refuser tout l'envoi
        foreach (['pas' => [0, 100000], 'kcal_actives' => [0, 10000], 'sommeil_min' => [0, 1440]] as $k => [$lo, $hi]) if (isset($args[$k]) && ($args[$k] < $lo || $args[$k] > $hi)) unset($args[$k]);
        if (count($args) > 1) $calls[] = ['function' => 'sync_samsung_health', 'args' => $args];
    }
    return ['calls' => $calls, 'dates' => array_map(fn($c) => $c['args']['date'], $calls), 'ignores' => $ignores];
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
 * Somme d'un jour de pas / kcal : les morceaux d'une même source (clé « …sXXXXXX|début ») s'additionnent ; si plusieurs
 * sources ont écrit (téléphone ET montre comptent les mêmes pas), on garde la plus complète au lieu de tout additionner.
 */
function sante_hc_somme_sources(array $morceaux): float {
    $par = [];
    foreach ($morceaux as $k => $v) { $g = preg_match('/^(?:id:)?(s[0-9a-f]{6})\|/', (string)$k, $m) ? $m[1] : '_'; $par[$g] = ($par[$g] ?? 0) + (float)$v; }
    return $par ? max($par) : 0.0;
}
