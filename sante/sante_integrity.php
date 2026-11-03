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
        'bilans' => [], 'poids' => [], 'journal' => new stdClass(), 'supplements' => [], 'protocole' => [],
    ];
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
    return $o;
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
    $j = [];
    foreach ((array)($e['journal'] ?? []) as $date => $jour) {
        if (!sante_date_ok($date) || !is_array($jour)) continue;
        $c = [];
        foreach (SANTE_CHECKLIST as $k) $c[$k] = !empty(($jour['checklist'] ?? [])[$k]);
        $jo = ['checklist' => $c, 'repas' => [], 'activite' => [], 'samsung' => []];
        foreach ((array)($jour['repas'] ?? []) as $r) if (is_array($r) && is_array($r['items'] ?? null)) $jo['repas'][] = $r;
        foreach (['pas', 'zone2_min', 'marches_post', 'soleus_min', 'machines'] as $k) if (isset(($jour['activite'] ?? [])[$k])) $jo['activite'][$k] = $k === 'machines' ? !empty($jour['activite'][$k]) : sante_num($jour['activite'][$k]);
        foreach (['pas', 'kcal_actives', 'fc_moy', 'fc_repos', 'sommeil_min', 'poids'] as $k) if (isset(($jour['samsung'] ?? [])[$k]) && sante_num($jour['samsung'][$k]) !== null) $jo['samsung'][$k] = sante_num($jour['samsung'][$k]);
        $j[$date] = $jo;
    }
    ksort($j);
    $o['journal'] = $j ?: new stdClass();
    $o['supplements'] = array_values(array_filter(array_map(fn($s) => is_array($s) && !empty($s['nom'])
        ? ['nom' => mb_substr((string)$s['nom'], 0, 60), 'dose' => mb_substr((string)($s['dose'] ?? ''), 0, 60), 'moment' => mb_substr((string)($s['moment'] ?? ''), 0, 60), 'actif' => !isset($s['actif']) || !empty($s['actif'])]
        : null, (array)($e['supplements'] ?? []))));
    $o['protocole'] = array_values(array_filter(array_map(fn($x) => is_string($x) ? mb_substr($x, 0, 300) : null, (array)($e['protocole'] ?? []))));
    return $o;
}
