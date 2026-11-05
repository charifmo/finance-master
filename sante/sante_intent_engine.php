<?php
/**
 * Santé Master — LE MOTEUR D'INTENTIONS (calqué sur cfo_intent_engine.php).
 *
 *   Le Médecin-Chef IA (CMO) n'écrit jamais dans les données et ne calcule rien de tête : il appelle UNE des
 *   fonctions du catalogue ci-dessous. Le moteur valide chaque argument, résout les noms (biomarqueurs,
 *   aliments), calcule (calories, macros, score de séquençage, indicateurs) avec sante_lib.php, applique et
 *   rend un compte rendu avant/après. Hors catalogue : refusé. Argument invalide : refusé, état intact.
 */
require_once __DIR__ . '/sante_integrity.php';

function sante_catalogue_fonctions(): array {
    return [
        'add_lab_panel' => ['desc' => "Ajoute un bilan sanguin daté. valeurs = { biomarqueur: valeur } ou [{ marqueur, valeur, min?, max?, unite? }] — noms du compte rendu acceptés (« Triglycérides », « ApoB »…).",
            'requis' => ['date', 'valeurs'], 'optionnels' => ['labo', 'pas_systolique', 'note']],
        'update_biomarker' => ['desc' => "Corrige ou ajoute UN biomarqueur dans le bilan de cette date (le bilan doit exister).",
            'requis' => ['date', 'marqueur', 'valeur'], 'optionnels' => ['min', 'max', 'unite']],
        'log_daily_nutrition' => ['desc' => "Note un repas : items dans l'ORDRE où ils ont été mangés [{ nom, g }] ; le moteur calcule calories, macros et score de séquençage (fibres → protéines → glucides, marche après). Aliment inconnu : fournir kcal/prot/glu/lip/fib et categorie (valeurs « estimées »).",
            'requis' => ['moment', 'items'], 'optionnels' => ['date', 'marche_post']],
        'log_workout_activity' => ['desc' => "Note l'activité du jour : pas, zone2_min (marche Zone 2 à jeun), machines (séance bas du corps, true/false), marches_post (nombre de marches de 15 min après repas), soleus_min.",
            'requis' => [], 'au_moins_un' => ['pas', 'zone2_min', 'machines', 'marches_post', 'soleus_min'], 'optionnels' => ['date', 'pas', 'zone2_min', 'machines', 'marches_post', 'soleus_min']],
        'sync_samsung_health' => ['desc' => "Données Samsung Health / Health Connect d'un jour : pas, kcal_actives, fc_moy, fc_repos, sommeil_min, poids (kg) ; et aussi fc_min, fc_max, distance_km, kcal_totales, exercice_min, spo2 (%), tension_sys, tension_dia, hydratation_ml, graisse_pct, vfc_ms ; taille_cm met à jour le profil.",
            'requis' => [], 'au_moins_un' => array_merge(SANTE_CHAMPS_SAMSUNG, ['taille_cm']), 'optionnels' => array_merge(['date', 'taille_cm'], SANTE_CHAMPS_SAMSUNG)],
        'update_supplement_protocol' => ['desc' => "Protocole de suppléments : action add | update | remove, nom, dose?, moment?, actif?",
            'requis' => ['action', 'nom'], 'optionnels' => ['dose', 'moment', 'actif']],
        'update_health_goal' => ['desc' => "Objectifs : poids_kg, tg_gl, apob_gl, vitd_ngml, pas_objectif, seances_machines_semaine.",
            'requis' => [], 'au_moins_un' => ['poids_kg', 'tg_gl', 'apob_gl', 'vitd_ngml', 'pas_objectif', 'seances_machines_semaine'], 'optionnels' => ['poids_kg', 'tg_gl', 'apob_gl', 'vitd_ngml', 'pas_objectif', 'seances_machines_semaine']],
    ];
}

function sante_aujourdhui(): string { $z = new DateTime('now', new DateTimeZone('Africa/Casablanca')); return $z->format('Y-m-d'); }

/** Nom lu sur un compte rendu → clé du catalogue (null si inconnu). */
function sante_resoudre_marqueur(string $nom): ?string {
    $M = sante_catalogue()['marqueurs']; $n = sante_norm($nom);
    if (isset($M[$nom])) return $nom;
    foreach ($M as $k => $m) { if (sante_norm($m['libelle']) === $n) return $k; foreach ($m['alias'] ?? [] as $a) if (sante_norm($a) === $n) return $k; }
    return null;
}
function &sante_jour(array &$etat, string $date): array {
    if (!is_array($etat['journal'])) $etat['journal'] = [];
    if (!isset($etat['journal'][$date])) $etat['journal'][$date] = ['checklist' => array_fill_keys(SANTE_CHECKLIST, false), 'repas' => [], 'activite' => [], 'samsung' => []];
    return $etat['journal'][$date];
}

/** Applique UN appel. Renvoie [ok, compte rendu]. L'état n'est modifié que si ok (le travail se fait sur une copie). */
function sante_appliquer(array &$etat, string $fn, array $a): array {
    $t = $etat;
    [$ok, $cr] = sante_appliquer_sur($t, $fn, $a);
    if ($ok) $etat = $t;
    return [$ok, $cr];
}
function sante_appliquer_sur(array &$etat, string $fn, array $a): array {
    $cat = sante_catalogue_fonctions();
    if (!isset($cat[$fn])) return [false, ['erreur' => 'ERROR_OUT_OF_CATALOG', 'message' => "« $fn » n'est pas dans le catalogue.", 'catalogue' => array_keys($cat)]];
    $def = $cat[$fn];
    foreach ($def['requis'] as $r) if (!array_key_exists($r, $a) || $a[$r] === null || $a[$r] === '') return [false, ['erreur' => "argument requis manquant : $r"]];
    if (!empty($def['au_moins_un']) && !array_filter($def['au_moins_un'], fn($k) => array_key_exists($k, $a) && $a[$k] !== null && $a[$k] !== ''))
        return [false, ['erreur' => 'aucun champ fourni : ' . implode(', ', $def['au_moins_un'])]];
    $date = $a['date'] ?? sante_aujourdhui();
    if (!sante_date_ok($date)) return [false, ['erreur' => "date invalide : $date (AAAA-MM-JJ)"]];
    switch ($fn) {
    case 'add_lab_panel': {
        $vals = []; $inconnus = [];
        $liste = $a['valeurs'];
        if (is_array($liste) && array_is_list($liste)) {
            foreach ($liste as $x) {
                $k = is_array($x) ? sante_resoudre_marqueur((string)($x['marqueur'] ?? ($x['nom'] ?? ''))) : null;
                if (!$k) { $inconnus[] = is_array($x) ? (string)($x['marqueur'] ?? ($x['nom'] ?? '?')) : '?'; continue; }
                $n = sante_norm_valeur(['v' => $x['valeur'] ?? ($x['v'] ?? null), 'min' => $x['min'] ?? null, 'max' => $x['max'] ?? null, 'u' => $x['unite'] ?? ($x['u'] ?? null)]);
                if (!$n) return [false, ['erreur' => "valeur illisible pour $k"]];
                $vals[$k] = array_filter($n, fn($v) => $v !== null);
            }
        } elseif (is_array($liste)) {
            foreach ($liste as $nom => $x) {
                $k = sante_resoudre_marqueur((string)$nom);
                if (!$k) { $inconnus[] = (string)$nom; continue; }
                $n = sante_norm_valeur($x);
                if (!$n) return [false, ['erreur' => "valeur illisible pour $k"]];
                $vals[$k] = $n;
            }
        } else return [false, ['erreur' => 'valeurs doit être un objet ou une liste']];
        if ($inconnus) return [false, ['erreur' => 'biomarqueur(s) inconnu(s) : ' . implode(', ', $inconnus), 'connus' => array_keys(sante_catalogue()['marqueurs'])]];
        if (!$vals) return [false, ['erreur' => 'aucune valeur']];
        foreach ($etat['bilans'] as $b) if ($b['date'] === $date) return [false, ['erreur' => "un bilan existe déjà le $date : utilise update_biomarker"]];
        $b = sante_norm_bilan(['date' => $date, 'labo' => $a['labo'] ?? '', 'source' => 'cmo', 'valeurs' => $vals, 'pas_systolique' => $a['pas_systolique'] ?? null, 'note' => $a['note'] ?? null]);
        $etat['bilans'][] = $b; usort($etat['bilans'], fn($x, $y) => strcmp($x['date'], $y['date']));
        return [true, ['bilan' => $date, 'marqueurs' => count($vals), 'indicateurs' => sante_indicateurs($b, $etat['profil'])]];
    }
    case 'update_biomarker': {
        $k = sante_resoudre_marqueur((string)$a['marqueur']);
        if (!$k) return [false, ['erreur' => 'biomarqueur inconnu : ' . $a['marqueur']]];
        $n = sante_norm_valeur(['v' => $a['valeur'], 'min' => $a['min'] ?? null, 'max' => $a['max'] ?? null, 'u' => $a['unite'] ?? null]);
        if (!$n) return [false, ['erreur' => 'valeur illisible']];
        foreach ($etat['bilans'] as $i => $b) if ($b['date'] === $date) {
            $avant = $b['valeurs'][$k]['v'] ?? null;
            $etat['bilans'][$i]['valeurs'][$k] = array_merge($b['valeurs'][$k] ?? [], array_filter($n, fn($v) => $v !== null));
            return [true, ['bilan' => $date, 'marqueur' => $k, 'avant' => $avant, 'apres' => $n['v'], 'indicateurs' => sante_indicateurs($etat['bilans'][$i], $etat['profil'])]];
        }
        return [false, ['erreur' => "aucun bilan le $date : utilise add_lab_panel"]];
    }
    case 'log_daily_nutrition': {
        $moment = (string)$a['moment'];
        if (!in_array($moment, ['petit_dejeuner', 'dejeuner', 'diner', 'collation'], true)) return [false, ['erreur' => 'moment : petit_dejeuner | dejeuner | diner | collation']];
        if (!is_array($a['items']) || !$a['items']) return [false, ['erreur' => 'items vide']];
        $items = []; $sansValeur = [];
        foreach ($a['items'] as $it) {
            if (!is_array($it) || empty($it['nom'])) return [false, ['erreur' => 'chaque item : { nom, g }']];
            $x = sante_item($it);
            if (!$x['connu'] && sante_num($it['kcal'] ?? null) === null) $sansValeur[] = $x['nom'];
            $items[] = $x;
        }
        if ($sansValeur) return [false, ['erreur' => 'aliment(s) inconnu(s) de la table : ' . implode(', ', $sansValeur) . ' — fournis kcal, prot, glu, lip, fib et categorie (fibres|proteines|glucides|lipides|mixte), ils seront marqués « estimés ».']];
        $marche = !empty($a['marche_post']);
        $sc = sante_score_sequencage($items, $marche); $tot = sante_totaux_repas($items);
        $j = &sante_jour($etat, $date);
        $j['repas'][] = ['id' => sante_uid(), 'moment' => $moment, 'items' => $items, 'marche_post' => $marche, 'score' => $sc['score'], 'score_detail' => $sc['detail'], 'totaux' => $tot];
        if ($moment === 'dejeuner') { if ($sc['score'] >= 65) $j['checklist']['dej_seq'] = true; if ($marche) $j['checklist']['dej_marche'] = true; }
        if ($moment === 'diner') { if ($sc['score'] >= 65) $j['checklist']['din_seq'] = true; if ($marche) $j['checklist']['din_marche'] = true; }
        return [true, ['date' => $date, 'moment' => $moment, 'totaux' => $tot, 'score_sequencage' => $sc, 'estimes' => array_values(array_map(fn($i) => $i['nom'], array_filter($items, fn($i) => !$i['connu'])))]];
    }
    case 'log_workout_activity': {
        $j = &sante_jour($etat, $date); $ch = [];
        foreach (['pas', 'zone2_min', 'marches_post', 'soleus_min'] as $k) if (array_key_exists($k, $a)) {
            $v = sante_num($a[$k]); if ($v === null || $v < 0) return [false, ['erreur' => "$k : nombre positif attendu"]];
            $ch[$k] = ['avant' => $j['activite'][$k] ?? null, 'apres' => $v]; $j['activite'][$k] = $v;
        }
        if (array_key_exists('machines', $a)) { $ch['machines'] = ['avant' => $j['activite']['machines'] ?? null, 'apres' => !empty($a['machines'])]; $j['activite']['machines'] = !empty($a['machines']); }
        if (($j['activite']['zone2_min'] ?? 0) >= 40) $j['checklist']['zone2'] = true;
        if (($j['activite']['soleus_min'] ?? 0) > 0) $j['checklist']['soleus'] = true;
        return [true, ['date' => $date, 'changements' => $ch]];
    }
    case 'sync_samsung_health': {
        $j = &sante_jour($etat, $date); $ch = [];
        $bornes = SANTE_BORNES_SAMSUNG;
        if (array_key_exists('taille_cm', $a) && $a['taille_cm'] !== null && $a['taille_cm'] !== '') {
            $t = sante_num($a['taille_cm']); if ($t === null || $t < 100 || $t > 250) return [false, ['erreur' => 'taille_cm hors bornes (100-250) : ' . json_encode($a['taille_cm'])]];
            $ch['taille_cm'] = ['avant' => $etat['profil']['taille_cm'] ?? null, 'apres' => $t]; $etat['profil']['taille_cm'] = $t;
        }
        foreach ($bornes as $k => [$lo, $hi]) if (array_key_exists($k, $a) && $a[$k] !== null && $a[$k] !== '') {
            $v = sante_num($a[$k]); if ($v === null || $v < $lo || $v > $hi) return [false, ['erreur' => "$k hors bornes ($lo-$hi) : " . json_encode($a[$k])]];
            $ch[$k] = ['avant' => $j['samsung'][$k] ?? null, 'apres' => $v]; $j['samsung'][$k] = $v;
        }
        if (isset($j['samsung']['pas']) && !isset($a['_sans_pas_activite'])) $j['activite']['pas'] = max((float)($j['activite']['pas'] ?? 0), (float)$j['samsung']['pas']);
        if (isset($ch['poids'])) {
            $etat['poids'] = array_values(array_filter($etat['poids'], fn($p) => !($p['date'] === $date && $p['source'] === 'samsung')));
            $etat['poids'][] = ['date' => $date, 'kg' => $ch['poids']['apres'], 'source' => 'samsung'];
            usort($etat['poids'], fn($x, $y) => strcmp($x['date'], $y['date']));
        }
        return [true, ['date' => $date, 'changements' => $ch]];
    }
    case 'update_supplement_protocol': {
        $act = (string)$a['action']; $nom = trim((string)$a['nom']); $i = null;
        foreach ($etat['supplements'] as $k => $s) if (sante_norm($s['nom']) === sante_norm($nom)) $i = $k;
        if ($act === 'add') {
            if ($i !== null) return [false, ['erreur' => "« $nom » est déjà au protocole : utilise update"]];
            $etat['supplements'][] = ['nom' => $nom, 'dose' => (string)($a['dose'] ?? ''), 'moment' => (string)($a['moment'] ?? ''), 'actif' => !isset($a['actif']) || !empty($a['actif'])];
            return [true, ['ajoute' => $nom]];
        }
        if ($i === null) return [false, ['erreur' => "« $nom » n'est pas au protocole"]];
        if ($act === 'remove') { $etat['supplements'] = array_values(array_filter($etat['supplements'], fn($s, $k) => $k !== $i, ARRAY_FILTER_USE_BOTH)); return [true, ['retire' => $nom]]; }
        if ($act === 'update') {
            $avant = $etat['supplements'][$i];
            foreach (['dose', 'moment'] as $k) if (array_key_exists($k, $a)) $etat['supplements'][$i][$k] = (string)$a[$k];
            if (array_key_exists('actif', $a)) $etat['supplements'][$i]['actif'] = !empty($a['actif']);
            return [true, ['avant' => $avant, 'apres' => $etat['supplements'][$i]]];
        }
        return [false, ['erreur' => 'action : add | update | remove']];
    }
    case 'update_health_goal': {
        $ch = [];
        $bornes = ['poids_kg' => [30, 300], 'tg_gl' => [0.2, 5], 'apob_gl' => [0.2, 3], 'vitd_ngml' => [10, 150]];
        foreach ($bornes as $k => [$lo, $hi]) if (array_key_exists($k, $a)) {
            $v = sante_num($a[$k]); if ($v === null || $v < $lo || $v > $hi) return [false, ['erreur' => "$k hors bornes ($lo-$hi)"]];
            $ch[$k] = ['avant' => $etat['objectifs'][$k] ?? null, 'apres' => $v]; $etat['objectifs'][$k] = $v;
        }
        foreach (['pas_objectif' => [1000, 50000], 'seances_machines_semaine' => [0, 14]] as $k => [$lo, $hi]) if (array_key_exists($k, $a)) {
            $v = sante_num($a[$k]); if ($v === null || $v < $lo || $v > $hi) return [false, ['erreur' => "$k hors bornes ($lo-$hi)"]];
            $ch[$k] = ['avant' => $etat['profil'][$k] ?? null, 'apres' => $v]; $etat['profil'][$k] = $v;
        }
        return [true, ['changements' => $ch]];
    }
    }
    return [false, ['erreur' => 'non géré']];
}

/** Un lot d'appels, tout ou rien : un seul refus et l'état reste celui d'avant. */
function sante_compiler(array $calls, array $etat): array {
    $etat = sante_normaliser($etat);
    $copie = $etat; $journal = [];
    foreach ($calls as $i => $c) {
        $fn = is_array($c) ? (string)($c['function'] ?? ($c['name'] ?? '')) : '';
        $args = is_array($c) ? (array)($c['args'] ?? ($c['arguments'] ?? [])) : [];
        [$ok, $cr] = sante_appliquer($etat, $fn, $args);
        $journal[] = ['appel' => $i, 'function' => $fn, 'ok' => $ok] + $cr;
        if (!$ok) return ['status' => 'error', 'journal' => $journal, 'etat' => $copie];
    }
    return ['status' => 'ok', 'journal' => $journal, 'etat' => sante_normaliser($etat)];
}

/** Ce que le CMO LIT (jamais recalculé par lui) : dernier bilan et ses indicateurs, objectifs, journée, poids. */
function sante_lecture(array $etat, ?string $date = null): array {
    $etat = sante_normaliser($etat); $date = $date ?: sante_aujourdhui();
    $dernier = $etat['bilans'] ? $etat['bilans'][count($etat['bilans']) - 1] : null;
    $M = sante_catalogue()['marqueurs'];
    $valeurs = [];
    if ($dernier) foreach ($dernier['valeurs'] as $k => $x) { [$mn, $mx] = sante_bornes($dernier, $k); $valeurs[$M[$k]['libelle']] = ['valeur' => $x['v'], 'unite' => $x['u'] ?? $M[$k]['unite'], 'min' => $mn, 'max' => $mx, 'statut' => sante_statut($dernier, $k)]; }
    $j = (array)(((array)$etat['journal'])[$date] ?? []);
    $kg = $etat['poids'] ? $etat['poids'][count($etat['poids']) - 1]['kg'] : null;
    $age = sante_age($etat['profil']['naissance'], $date);
    $bmr = sante_bmr($kg, sante_num($etat['profil']['taille_cm']), $age, $etat['profil']['sexe']);
    $ingere = 0; foreach ((array)($j['repas'] ?? []) as $r) $ingere += (float)($r['totaux']['kcal'] ?? 0);
    return [
        'regle' => 'Tu lis, tu ne calcules pas : chaque chiffre ci-dessous vient du moteur. Pour agir, appelle une fonction du catalogue. Ce suivi ne remplace pas l’avis du médecin.',
        'date' => $date, 'age' => $age, 'profil' => $etat['profil'], 'objectifs' => $etat['objectifs'],
        'dernier_bilan' => $dernier ? ['date' => $dernier['date'], 'valeurs' => $valeurs, 'indicateurs' => sante_indicateurs($dernier, $etat['profil'])] : null,
        'bilans_dates' => array_column($etat['bilans'], 'date'),
        'aujourdhui' => ['checklist' => $j['checklist'] ?? null, 'activite' => $j['activite'] ?? null, 'samsung' => $j['samsung'] ?? null,
                         'calories_ingerees' => (int)$ingere, 'bmr' => $bmr, 'bilan_energie' => sante_bilan_energie($ingere ?: null, $bmr, $j['samsung']['kcal_actives'] ?? null)],
        'poids' => ['dernier' => $kg, 'projection' => sante_projection_poids($etat['poids'], $etat['objectifs']['poids_kg'], null, $date)],
        'supplements' => $etat['supplements'],
        //  v1.4 — les plans (nutrition, exercice) : ce qui est prévu aujourd'hui, ce qui est coché fait, la semaine en cours
        'plans' => array_map(fn($p) => ['titre' => $p['titre'], 'suivi' => sante_suivi_plan($p, $etat['journal'], $date)], (array)$etat['plans']),
        //  v1.8 — le reste du protocole importé : règles à respecter, objectifs (cibles des biomarqueurs)
        'regles' => array_slice(array_map(fn($r) => ($r['section'] ? $r['section'] . ' : ' : '') . $r['texte'], $etat['regles'] ?? []), 0, 120),
        'objectifs_suivi' => $etat['objectifs_suivi'] ?? [], 'cibles' => $etat['cibles'] ?? new stdClass(),
        'catalogue' => array_map(fn($d) => $d['desc'], sante_catalogue_fonctions()),
    ];
}
