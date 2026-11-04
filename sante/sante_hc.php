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

/** Est-ce un envoi de HC Webhook ? (racine avec timestamp/app_version, ou une de ses listes) */
function sante_hc_est_payload($p): bool {
    if (!is_array($p) || array_is_list($p)) return false;
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
        $morceau($a[0], 'fc', 't:' . $a[1], round((float)$v, 1));
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
        if (!empty($touches[$d]['pas'])) $args['pas'] = (int)round(array_sum($hc['pas'] ?? []));
        if (!empty($touches[$d]['kcal'])) $args['kcal_actives'] = (int)round(array_sum($hc['kcal'] ?? []));
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
