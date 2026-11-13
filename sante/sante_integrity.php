<?php
/**
 * Santé Master — L'INTÉGRITÉ DE L'ÉTAT. Tout ce qui entre (appli, Médecin-Chef IA, webhook Samsung, import)
 * repasse par sante_normaliser() : forme attendue, dates AAAA-MM-JJ, nombres réels, rien d'inventé.
 */
require_once __DIR__ . '/sante_lib.php';

const SANTE_SCHEMA = 1;
const SANTE_CHECKLIST = ['zone2', 'cafe_mct', 'dej_seq', 'dej_marche', 'din_seq', 'din_marche', 'soleus', 'supplements'];

function sante_etat_defaut(): array {
    return [
        '_schema' => SANTE_SCHEMA,
        'profil' => ['nom' => '', 'sexe' => 'H', 'naissance' => null, 'taille_cm' => null, 'fumeur' => false, 'pas_systolique' => null,
                     'region_score2' => 'moderate', 'pas_objectif' => 10000, 'seances_machines_semaine' => 2, 'terrain' => [], 'suivi' => ''],
        'objectifs' => ['poids_kg' => null, 'tg_gl' => 1.50, 'apob_gl' => 1.00, 'vitd_ngml' => 35],
        'bilans' => [], 'poids' => [], 'journal' => new stdClass(), 'supplements' => [], 'protocole' => [], 'plans' => new stdClass(),
        'compo' => [], 'seances' => [],
    ];
}

/**
 * v1.26 — LA COMPOSITION CORPORELLE (une mesure par jour) : chaque valeur dans ses bornes, sinon retirée ; une ligne sans
 * aucune valeur de composition est retirée. Unités : kg, %, kcal ; graisse viscérale en niveau.
 */
const SANTE_COMPO = ['kg' => [20, 400], 'graisse_pct' => [2, 75], 'graisse_kg' => [1, 250], 'muscle_kg' => [5, 150], 'masse_maigre_kg' => [15, 250],
                     'muscle_total_kg' => [10, 250], 'eau_kg' => [10, 150], 'bmr_kcal' => [500, 5000], 'graisse_viscerale' => [1, 60]];
function sante_norm_compo($x): ?array {
    if (!is_array($x) || !sante_date_ok($x['date'] ?? null)) return null;
    $o = ['date' => $x['date']];
    foreach (SANTE_COMPO as $k => [$a, $b]) { $v = sante_num($x[$k] ?? null); if ($v !== null && $v >= $a && $v <= $b) $o[$k] = round($v, 1); }
    if (count(array_diff_key($o, ['date' => 1, 'kg' => 1])) === 0) return null;
    $o['source'] = mb_substr((string)($x['source'] ?? 'samsung'), 0, 30);
    return $o;
}
/**
 * v1.26 — UNE SÉANCE (export Samsung Health ou synchro) : identifiant, date, heure, nom, durée, et ce qui est connu
 * (distance, kcal, FC, vitesse, pas, dénivelé, VO₂ max, zones de FC, temps par km), chacun dans ses bornes.
 */
function sante_norm_seance($x): ?array {
    if (!is_array($x) || !sante_date_ok($x['date'] ?? null)) return null;
    $id = (string)($x['id'] ?? '');
    if (!preg_match('/^[A-Za-z0-9_.:-]{1,64}$/', $id)) return null;
    $duree = sante_num($x['duree_s'] ?? null);
    if ($duree === null || $duree < 60 || $duree > 86400) return null;
    $o = ['id' => $id, 'date' => $x['date'], 'heure' => preg_match('/^\d{2}:\d{2}$/', (string)($x['heure'] ?? '')) ? $x['heure'] : null,
          'nom' => mb_substr(trim(strip_tags((string)($x['nom'] ?? 'Séance'))), 0, 40) ?: 'Séance', 'duree_s' => (int)round($duree)];
    $t = sante_num($x['type'] ?? null); if ($t !== null) $o['type'] = (int)$t;
    foreach (['distance_m' => [1, 500000, 0], 'kcal' => [1, 10000, 0], 'fc_moy' => [30, 230, 0], 'fc_max' => [30, 240, 0], 'fc_min' => [25, 230, 0], 'vitesse_kmh' => [0.1, 120, 1],
              'vitesse_max_kmh' => [0.1, 150, 1], 'denivele_m' => [0, 10000, 0], 'pas' => [1, 200000, 0], 'vo2max' => [10, 90, 1], 'fc_max_ref' => [100, 240, 0]] as $k => [$a, $b, $dec]) {
        $v = sante_num($x[$k] ?? null); if ($v !== null && $v >= $a && $v <= $b) $o[$k] = $dec ? round($v, $dec) : (int)round($v);
    }
    if (is_array($x['zones_s'] ?? null) && count($x['zones_s']) === 5) {
        $z = array_map(fn($v) => max(0, min(86400, (int)round((float)$v))), array_values($x['zones_s']));
        if (array_sum($z) > 0) $o['zones_s'] = $z;
    }
    if (is_array($x['par_km'] ?? null)) {
        $k = [];
        foreach (array_slice(array_values($x['par_km']), 0, 200) as $p) {
            if (!is_array($p) || ($km = sante_num($p['km'] ?? null)) === null || $km <= 0 || $km > 1 || ($d = sante_num($p['duree_s'] ?? null)) === null || $d <= 0 || $d > 86400) continue;
            $fc = sante_num($p['fc'] ?? null);
            $k[] = ['km' => round($km, 3), 'duree_s' => (int)round($d), 'fc' => $fc !== null && $fc >= 30 && $fc <= 240 ? (int)round($fc) : null];
        }
        if ($k) $o['par_km'] = $k;
    }
    $o['source'] = mb_substr((string)($x['source'] ?? 'samsung'), 0, 30);
    return $o;
}
function sante_date_ok($d): bool { return is_string($d) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $d) && checkdate((int)substr($d, 5, 2), (int)substr($d, 8, 2), (int)substr($d, 0, 4)); }
function sante_uid(): string { return bin2hex(random_bytes(6)); }

/** Une valeur de biomarqueur : { v, u?, min?, max? } — nombre obligatoire. */
function sante_norm_valeur($x): ?array {
    if (!is_array($x)) { $v = sante_num($x); return $v === null ? null : ['v' => $v]; }
    $v = sante_num($x['v'] ?? ($x['valeur'] ?? null)); if ($v === null) return null;
    $o = ['v' => $v];
    if (isset($x['u']) && is_string($x['u'])) $o['u'] = mb_substr($x['u'], 0, 20);
    foreach (['min', 'max'] as $k) if (array_key_exists($k, $x) && sante_num($x[$k]) !== null) $o[$k] = sante_num($x[$k]);
    //  v1.4 — la provenance : le document importé dont vient la valeur (son id), et « corrigée à la main »
    if (isset($x['doc']) && is_string($x['doc']) && preg_match('/^[A-Za-z0-9_-]{1,40}$/', $x['doc'])) $o['doc'] = $x['doc'];
    if (!empty($x['edite'])) $o['edite'] = true;
    //  v1.21 — la ligne du document d'où vient la valeur (preuve, et matière de la validation par l'IA)
    if (isset($x['ligne']) && is_string($x['ligne']) && trim($x['ligne']) !== '') $o['ligne'] = mb_substr(trim($x['ligne']), 0, 200);
    return $o;
}
function sante_norm_bilan($b): ?array {
    if (!is_array($b) || !sante_date_ok($b['date'] ?? null)) return null;
    $M = sante_catalogue()['marqueurs']; $vals = [];
    foreach ((array)($b['valeurs'] ?? []) as $k => $x) { if (!isset($M[$k])) continue; $n = sante_norm_valeur($x); if ($n) $vals[$k] = $n; }
    $o = ['id' => (string)($b['id'] ?? sante_uid()), 'date' => $b['date'], 'labo' => mb_substr((string)($b['labo'] ?? ''), 0, 80),
          'source' => mb_substr((string)($b['source'] ?? 'saisie'), 0, 30), 'valeurs' => $vals];
    if (sante_num($b['pas_systolique'] ?? null) !== null) $o['pas_systolique'] = sante_num($b['pas_systolique']);
    if (!empty($b['note'])) $o['note'] = mb_substr((string)$b['note'], 0, 500);
    //  v1.4 — les documents (PDF, photos, texte) dont viennent les valeurs de ce bilan : supprimer un document retire ses valeurs
    $docs = [];
    foreach ((array)($b['documents'] ?? []) as $d) {
        if (!is_array($d) || !isset($d['id']) || !is_string($d['id']) || !preg_match('/^[A-Za-z0-9_-]{1,40}$/', $d['id'])) continue;
        $docs[] = ['id' => $d['id'], 'nom' => mb_substr((string)($d['nom'] ?? 'document'), 0, 160), 'type' => mb_substr((string)($d['type'] ?? ''), 0, 20),
                   'importe_le' => sante_date_ok($d['importe_le'] ?? null) ? $d['importe_le'] : null];
    }
    if ($docs) $o['documents'] = $docs;
    return $o;
}

/** v1.4 — Un plan (nutrition ou exercice) : titre, document d'origine, éléments rangés par jour (et par repas). */
const SANTE_JOURS_PLAN = ['tous', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const SANTE_MOMENTS_PLAN = ['petit_dejeuner', 'dejeuner', 'collation', 'diner'];
//  v1.8 — le protocole (« Ma journée ») : moments de toute la journée
const SANTE_MOMENTS_PROTOCOLE = ['reveil', 'matin', 'petit_dejeuner', 'dejeuner', 'apres_midi', 'collation', 'diner', 'soir', 'coucher', 'journee'];
function sante_norm_plan($p, string $type): ?array {
    if (!is_array($p)) return null;
    $items = [];
    foreach ((array)($p['items'] ?? []) as $x) {
        if (!is_array($x) || trim((string)($x['texte'] ?? '')) === '') continue;
        $i = ['id' => is_string($x['id'] ?? null) && preg_match('/^[A-Za-z0-9_-]{1,40}$/', $x['id']) ? $x['id'] : sante_uid(),
              'jour' => in_array($x['jour'] ?? '', SANTE_JOURS_PLAN, true) ? $x['jour'] : 'tous', 'texte' => mb_substr(trim((string)$x['texte']), 0, 200)];
        if ($type === 'nutrition') $i['moment'] = in_array($x['moment'] ?? '', SANTE_MOMENTS_PLAN, true) ? $x['moment'] : 'dejeuner';
        elseif (($d = sante_num($x['duree_min'] ?? null)) !== null && $d > 0 && $d <= 600) $i['duree_min'] = $d;
        if ($type === 'protocole') {
            $i['moment'] = in_array($x['moment'] ?? '', SANTE_MOMENTS_PROTOCOLE, true) ? $x['moment'] : 'journee';
            if (is_string($x['heure'] ?? null) && preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $x['heure'])) $i['heure'] = $x['heure'];
            if (!empty($x['detail']) && is_string($x['detail'])) $i['detail'] = mb_substr($x['detail'], 0, 1500);
            $jours = array_values(array_intersect(SANTE_JOURS_PLAN, (array)($x['jours'] ?? [])));
            $jours = array_values(array_diff($jours, ['tous']));
            if ($jours && count($jours) < 7) $i['jours'] = $jours;
            if (in_array($x['frequence'] ?? '', ['semaine', 'mois'], true)) $i['frequence'] = $x['frequence'];
            if (!empty($x['repas'])) $i['repas'] = true;
        }
        $items[] = $i;
        if (count($items) >= 300) break;
    }
    if (!$items) return null;
    $o = ['titre' => mb_substr((string)($p['titre'] ?? ''), 0, 120), 'source' => mb_substr((string)($p['source'] ?? ''), 0, 160),
          'importe_le' => sante_date_ok($p['importe_le'] ?? null) ? $p['importe_le'] : null, 'items' => $items];
    foreach (['corrections', 'corrections_avant'] as $k) if (sante_num($p[$k] ?? null) !== null) $o[$k] = (int)sante_num($p[$k]);
    return $o;
}
/** v1.24 — { type: { d: dernière fois reçu, s: { appli qui l'écrit: dernière fois } } } : ce que le téléphone envoie vraiment */
function sante_hc_vus_fusionner(array $ancien, array $nouveau, string $quand): array {
    $date = fn($d) => is_string($d) && preg_match('/^\d{4}-\d{2}-\d{2}T[\d:]{8}/', $d) ? substr($d, 0, 30) : null;
    $o = [];
    foreach ($ancien as $t => $v) {
        if ($v instanceof stdClass) $v = (array)$v;
        if (!is_string($t) || !preg_match('/^[a-z0-9_]{1,40}$/', $t) || !is_array($v) || !($d = $date($v['d'] ?? null))) continue;
        $s = [];
        foreach ((array)($v['s'] ?? []) as $n => $dn) if (is_string($n) && $n !== '' && ($dn = $date($dn))) $s[mb_substr($n, 0, 30)] = $dn;
        $o[$t] = ['d' => $d, 's' => $s];
    }
    if ($date($quand)) foreach ($nouveau as $t => $sources) {
        if (!is_string($t) || !preg_match('/^[a-z0-9_]{1,40}$/', $t) || !is_array($sources)) continue;
        $s = $o[$t]['s'] ?? [];
        foreach (array_keys($sources) as $n) $s[mb_substr((string)$n, 0, 30)] = $quand;
        arsort($s);
        $o[$t] = ['d' => $quand, 's' => array_slice($s, 0, 6, true)];
    }
    foreach ($o as &$v) $v['s'] = (object)$v['s'];
    return array_slice($o, -30, 30, true);
}

/**
 * v1.23 — LES MORCEAUX REÇUS DU TÉLÉPHONE, SANS LIMITE QUI JETTE. Une journée de montre + téléphone dépasse vite 1 200 mesures
 * par type. Au-delà, les plus anciennes sont regroupées en une valeur par minute sous la source « s000000 » (fusion) :
 *   · pas, kcal, distance, kcal totales, eau : pour chaque minute, la source qui en compte le plus — la règle même du total
 *     (sante_hc_somme_sources), donc le total ne change pas ; un renvoi d'une mesure déjà regroupée ne compte pas double
 *     (même minute : on garde le plus grand) ; une source arrivée en retard pour ces minutes est comparée, minute par minute ;
 *   · fréquence cardiaque : la moyenne de la minute ;
 *   · les 300 plus récentes restent telles quelles (un renvoi immédiat les remplace) ; plafond 2 000 : les plus ANCIENNES partent.
 */
const SANTE_HC_SEUIL = 1200, SANTE_HC_RECENTES = 300, SANTE_HC_PLAFOND = 2000, SANTE_HC_FUSION = 's000000';
function sante_hc_temps(string $c): ?int {
    if (!preg_match('/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/', $c, $m)) return null;
    return gmmktime((int)$m[4], (int)$m[5], (int)$m[6], (int)$m[2], (int)$m[3], (int)$m[1]);
}
function sante_hc_compacter(array $m, string $type): array {
    if (count($m) <= SANTE_HC_SEUIL) return $m;
    $additif = in_array($type, ['pas', 'kcal', 'dist', 'kcalt', 'eau'], true);
    if (!$additif && $type !== 'fc') return array_slice($m, -SANTE_HC_PLAFOND, null, true);
    $dates = [];
    foreach ($m as $k => $v) if (preg_match('/^(?:id:)?(s[0-9a-f]{6})\|([0-9TZ]+)(?:\|([0-9TZ]+))?$/', (string)$k, $x) && ($a = sante_hc_temps($x[2])) !== null) $dates[$k] = [$x[1], $a, isset($x[3]) ? sante_hc_temps($x[3]) : null];
    if (count($dates) <= SANTE_HC_RECENTES) return array_slice($m, -SANTE_HC_PLAFOND, null, true);
    $ordre = $dates; uasort($ordre, fn($p, $q) => $p[1] <=> $q[1]);
    $recentes = array_slice(array_keys($ordre), -SANTE_HC_RECENTES);
    $garder = array_flip($recentes);
    $min = [];                                                          // [minute][source] => valeur (additif) ou [somme, n] (FC)
    foreach ($ordre as $k => [$src, $a, $b]) {
        if (isset($garder[$k])) continue;
        $v = $m[$k];
        if ($additif && $b !== null && $b > $a && $b - $a <= 86400) {
            for ($q = intdiv($a, 60), $fin = intdiv($b - 1, 60); $q <= $fin; $q++) {
                $part = (min($b, ($q + 1) * 60) - max($a, $q * 60)) / ($b - $a);
                if ($part > 0) $min[$q][$src] = ($min[$q][$src] ?? 0) + $v * $part;
            }
        } elseif ($additif) { $q = intdiv($a, 60); $min[$q][$src] = ($min[$q][$src] ?? 0) + $v; }
        else { $q = intdiv($a, 60); $min[$q]['fc'] = [($min[$q]['fc'][0] ?? 0) + $v, ($min[$q]['fc'][1] ?? 0) + 1]; }
    }
    $out = [];
    foreach ($m as $k => $v) if (!isset($dates[$k])) $out[$k] = $v;      // clés sans heure (« jour », « t:HH:MM ») : telles quelles
    ksort($min);
    foreach ($min as $q => $s) {
        $val = $additif ? max($s) : $s['fc'][0] / $s['fc'][1];
        $out[SANTE_HC_FUSION . '|' . gmdate('Ymd\THis', $q * 60) . 'Z|' . gmdate('Ymd\THis', ($q + 1) * 60) . 'Z'] = round($val, 3);
    }
    foreach ($recentes as $k) $out[$k] = $m[$k];
    return array_slice($out, -SANTE_HC_PLAFOND, null, true);
}

function sante_normaliser($e): array {
    $d = sante_etat_defaut();
    $e = is_array($e) ? $e : [];
    $o = $d;
    $p = is_array($e['profil'] ?? null) ? $e['profil'] : [];
    $o['profil'] = array_merge($d['profil'], array_intersect_key($p, $d['profil']));
    $o['profil']['sexe'] = ($o['profil']['sexe'] ?? 'H') === 'F' ? 'F' : 'H';
    if (!sante_date_ok($o['profil']['naissance'])) $o['profil']['naissance'] = null;
    foreach (['taille_cm', 'pas_systolique', 'pas_objectif', 'seances_machines_semaine'] as $k) $o['profil'][$k] = sante_num($o['profil'][$k]);
    $o['profil']['fumeur'] = !empty($o['profil']['fumeur']);
    if (!in_array($o['profil']['region_score2'], ['low', 'moderate', 'high', 'very_high'], true)) $o['profil']['region_score2'] = 'moderate';
    $o['profil']['terrain'] = array_values(array_filter(array_map(fn($x) => is_string($x) ? mb_substr($x, 0, 200) : null, (array)$o['profil']['terrain'])));
    $ob = is_array($e['objectifs'] ?? null) ? $e['objectifs'] : [];
    foreach ($d['objectifs'] as $k => $v) $o['objectifs'][$k] = array_key_exists($k, $ob) ? sante_num($ob[$k]) : $v;
    $o['bilans'] = array_values(array_filter(array_map('sante_norm_bilan', (array)($e['bilans'] ?? []))));
    usort($o['bilans'], fn($a, $b) => strcmp($a['date'], $b['date']));
    $o['poids'] = [];
    foreach ((array)($e['poids'] ?? []) as $x) if (is_array($x) && sante_date_ok($x['date'] ?? null) && ($kg = sante_num($x['kg'] ?? null)) !== null && $kg > 20 && $kg < 400)
        $o['poids'][] = ['date' => $x['date'], 'kg' => $kg, 'source' => mb_substr((string)($x['source'] ?? 'saisie'), 0, 30)];
    usort($o['poids'], fn($a, $b) => strcmp($a['date'], $b['date']));
    //  v1.26 — composition corporelle (une par jour, la dernière lue l'emporte) et séances (une par identifiant)
    $cp = [];
    foreach ((array)($e['compo'] ?? []) as $x) if ($c = sante_norm_compo($x)) $cp[$c['date']] = $c;
    ksort($cp); $o['compo'] = array_values($cp);
    $se = [];
    foreach ((array)($e['seances'] ?? []) as $x) if ($s = sante_norm_seance($x)) $se[$s['id']] = $s;
    usort($se, fn($a, $b) => strcmp($a['date'] . ($a['heure'] ?? ''), $b['date'] . ($b['heure'] ?? '')));
    $o['seances'] = array_values($se);
    $j = [];
    foreach ((array)($e['journal'] ?? []) as $date => $jour) {
        if (!sante_date_ok($date) || !is_array($jour)) continue;
        $c = [];
        foreach (SANTE_CHECKLIST as $k) $c[$k] = !empty(($jour['checklist'] ?? [])[$k]);
        $jo = ['checklist' => $c, 'repas' => [], 'activite' => [], 'samsung' => []];
        foreach ((array)($jour['repas'] ?? []) as $r) if (is_array($r) && is_array($r['items'] ?? null)) $jo['repas'][] = $r;
        foreach (['pas', 'zone2_min', 'marches_post', 'soleus_min', 'machines'] as $k) if (isset(($jour['activite'] ?? [])[$k])) $jo['activite'][$k] = $k === 'machines' ? !empty($jour['activite'][$k]) : sante_num($jour['activite'][$k]);
        foreach (SANTE_CHAMPS_SAMSUNG as $k) if (isset(($jour['samsung'] ?? [])[$k]) && sante_num($jour['samsung'][$k]) !== null) $jo['samsung'][$k] = sante_num($jour['samsung'][$k]);
        //  v1.4 — ce qui a été RÉALISÉ du plan ce jour-là : { id d'élément du plan: true }
        $pf = [];
        foreach ((array)($jour['plan_fait'] ?? []) as $id => $fait) if (!empty($fait) && is_string($id) && preg_match('/^[A-Za-z0-9_-]{1,40}$/', $id)) $pf[$id] = true;
        if ($pf) $jo['plan_fait'] = $pf;
        //  v1.5 — les morceaux reçus de HC Webhook (pour qu'un renvoi remplace au lieu d'additionner) : 8 derniers jours seulement
        if (is_array($jour['hc'] ?? null) && $date >= gmdate('Y-m-d', time() - 8 * 86400)) {
            $hc = [];
            foreach (['pas', 'kcal', 'fc', 'sommeil', 'dist', 'kcalt', 'eau', 'exo', 'vfc'] as $t) if (is_array($jour['hc'][$t] ?? null)) {
                $m = [];
                foreach ($jour['hc'][$t] as $k => $v) if (is_string($k) && strlen($k) <= 70 && is_numeric($v)) $m[$k] = (float)$v;
                //  v1.23 — plus aucune mesure du jour jetée : au-delà de 1 200, les plus anciennes sont regroupées minute par minute
                //  (avant : seules les 1 500 PREMIÈRES étaient gardées — montre + téléphone y arrivent vers 9 h, le reste était perdu)
                $m = sante_hc_compacter($m, $t);
                if ($m) $hc[$t] = $m;
            }
            if ($hc) $jo['hc'] = $hc;
        }
        $j[$date] = $jo;
    }
    ksort($j);
    $o['journal'] = $j ?: new stdClass();
    $o['supplements'] = array_values(array_filter(array_map(fn($s) => is_array($s) && !empty($s['nom'])
        ? array_filter(['nom' => mb_substr((string)$s['nom'], 0, 80), 'dose' => mb_substr((string)($s['dose'] ?? ''), 0, 160), 'moment' => mb_substr((string)($s['moment'] ?? ''), 0, 200), 'actif' => !isset($s['actif']) || !empty($s['actif']),
                        'pourquoi' => mb_substr((string)($s['pourquoi'] ?? ''), 0, 500), 'notes' => mb_substr((string)($s['notes'] ?? ''), 0, 800)], fn($v) => $v !== '')
        : null, (array)($e['supplements'] ?? []))));
    $o['protocole'] = array_values(array_filter(array_map(fn($x) => is_string($x) ? mb_substr($x, 0, 300) : null, (array)($e['protocole'] ?? []))));
    //  v1.5 — la dernière synchro automatique reçue du téléphone (affichée dans l'onglet Samsung & Poids)
    if (is_array($e['sync_auto'] ?? null) && is_string($e['sync_auto']['derniere'] ?? null) && preg_match('/^\d{4}-\d{2}-\d{2}T[\d:]{8}/', $e['sync_auto']['derniere']))
        $o['sync_auto'] = ['derniere' => substr($e['sync_auto']['derniere'], 0, 30), 'source' => mb_substr((string)($e['sync_auto']['source'] ?? ''), 0, 60), 'jours' => (int)($e['sync_auto']['jours'] ?? 0)]
        + (!empty($e['sync_auto']['erreur']) ? ['erreur' => mb_substr((string)$e['sync_auto']['erreur'], 0, 400)] : [])
        //  v1.16 — ce que le téléphone a envoyé la dernière fois ({ type: nombre de mesures })
        //  v1.17 — nom lisible de chaque source, et les pas du dernier jour source par source
        + (is_array($e['sync_auto']['sources'] ?? null) ? ['sources' => (object)array_slice(array_map(fn($n) => mb_substr((string)$n, 0, 30), array_filter($e['sync_auto']['sources'], fn($n, $k) => is_string($k) && preg_match('/^s[0-9a-f]{6}$/', $k), ARRAY_FILTER_USE_BOTH)), -12, 12, true)] : [])
        + (is_array($e['sync_auto']['detail_pas'] ?? null) && sante_date_ok($e['sync_auto']['detail_pas']['date'] ?? null) ? ['detail_pas' => ['date' => $e['sync_auto']['detail_pas']['date'], 'retenu' => (int)($e['sync_auto']['detail_pas']['retenu'] ?? 0),
            'sources' => (object)array_slice(array_map('intval', array_filter((array)($e['sync_auto']['detail_pas']['sources'] ?? []), 'is_numeric')), 0, 12, true)]] : [])
        //  v1.24 — chaque type déjà reçu : quand pour la dernière fois, et de quelles applis
        + (!empty($e['sync_auto']['vus']) && ($vus = sante_hc_vus_fusionner((array)$e['sync_auto']['vus'], [], '')) ? ['vus' => (object)$vus] : [])
        + (is_array($e['sync_auto']['recu'] ?? null) ? ['recu' => (object)array_slice(array_filter(array_map(fn($n) => is_numeric($n) ? (int)$n : null, $e['sync_auto']['recu']), fn($n, $k) => $n !== null && is_string($k) && preg_match('/^[a-z0-9_]{1,40}$/', $k), ARRAY_FILTER_USE_BOTH), 0, 30, true)] : []);
    $pl = is_array($e['plans'] ?? null) ? $e['plans'] : [];
    $o['plans'] = new stdClass();
    foreach (['nutrition', 'exercice', 'protocole'] as $t) if (($n = sante_norm_plan($pl[$t] ?? null, $t)) !== null) { $o['plans'] = (array)$o['plans']; $o['plans'][$t] = $n; }
    //  v1.8 — ce que l'import d'un protocole range ailleurs que dans les cases du jour
    $o['regles'] = [];
    foreach ((array)($e['regles'] ?? []) as $r) if (is_array($r) && trim((string)($r['texte'] ?? '')) !== '' && count($o['regles']) < 400)
        $o['regles'][] = ['id' => is_string($r['id'] ?? null) && preg_match('/^[A-Za-z0-9_-]{1,40}$/', $r['id']) ? $r['id'] : sante_uid(), 'section' => mb_substr((string)($r['section'] ?? ''), 0, 120), 'texte' => mb_substr(trim((string)$r['texte']), 0, 700)];
    $M = sante_catalogue()['marqueurs']; $o['cibles'] = new stdClass(); $cib = [];
    foreach ((array)($e['cibles'] ?? []) as $k => $c) if (isset($M[$k]) && is_array($c) && in_array($c['op'] ?? '', ['<', '>'], true) && sante_num($c['v'] ?? null) !== null) $cib[$k] = ['op' => $c['op'], 'v' => sante_num($c['v'])];
    if ($cib) $o['cibles'] = $cib;
    $o['objectifs_suivi'] = [];
    foreach ((array)($e['objectifs_suivi'] ?? []) as $x) if (is_array($x) && trim((string)($x['libelle'] ?? '')) !== '' && count($o['objectifs_suivi']) < 60)
        $o['objectifs_suivi'][] = ['libelle' => mb_substr(trim((string)$x['libelle']), 0, 80), 'depart' => mb_substr((string)($x['depart'] ?? ''), 0, 40), 'cible' => mb_substr((string)($x['cible'] ?? ''), 0, 60)];
    $o['lecons_plan'] = [];
    foreach ((array)($e['lecons_plan'] ?? []) as $l) {
        if (!is_array($l) || !is_string($l['cle'] ?? null) || $l['cle'] === '' || count($o['lecons_plan']) >= 600) continue;
        $x = ['cle' => mb_substr($l['cle'], 0, 120)];
        if (in_array($l['bucket'] ?? '', ['action', 'supplement', 'regle', 'objectif', 'ignorer'], true)) $x['bucket'] = $l['bucket'];
        if (in_array($l['moment'] ?? '', SANTE_MOMENTS_PROTOCOLE, true)) $x['moment'] = $l['moment'];
        if (is_string($l['texte'] ?? null) && trim($l['texte']) !== '') $x['texte'] = mb_substr(trim($l['texte']), 0, 200);
        if (sante_date_ok($l['date'] ?? null)) $x['date'] = $l['date'];
        if (count($x) > 1) $o['lecons_plan'][] = $x;
    }
    return $o;
}
