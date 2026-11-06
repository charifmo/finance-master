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
                foreach ($jour['hc'][$t] as $k => $v) { if (count($m) >= 1500) break; if (is_string($k) && strlen($k) <= 70 && is_numeric($v)) $m[$k] = (float)$v; }
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
