<?php
/**
 * Santé Master — CALCULS, RÈGLE DE GILBERT, INTÉGRITÉ, MOTEUR D'INTENTIONS (PHP).
 *   Décor FICTIF ; aucune donnée personnelle.
 */
require_once __DIR__ . '/../sante/sante_intent_engine.php';
$ko = 0; $n = 0;
function v(string $t, bool $ok, $d = '') { global $ko, $n; $n++; if (!$ok) $ko++; printf("  %s %-78s %s\n", $ok ? '✅' : '❌', $t, $ok ? '' : (is_string($d) ? $d : json_encode($d, JSON_UNESCAPED_UNICODE))); }
echo "\n  SANTÉ MASTER — CALCULS, GILBERT, MOTEUR\n  " . str_repeat('─', 80) . "\n";
$B = fn(array $vals, string $date = '2026-04-02') => ['date' => $date, 'valeurs' => $vals];

// ── A. Gilbert ──
$g = sante_gilbert($B(['bili_t' => ['v' => 15.7, 'max' => 14], 'bili_c' => ['v' => 3.4, 'max' => 3.4], 'bili_l' => ['v' => 12.3], 'asat' => ['v' => 24, 'max' => 50], 'alat' => ['v' => 27, 'max' => 50], 'ggt' => ['v' => 26, 'max' => 60]]));
v('A. bilirubine 15,7 (> 14), conjuguée 3,4 (= norme), ASAT/ALAT/GGT normales → « Profil Gilbert »', $g['statut'] === 'gilbert' && str_contains($g['message'], 'Gilbert'), $g);
$g = sante_gilbert($B(['bili_t' => ['v' => 15.7, 'max' => 14], 'bili_c' => ['v' => 3.0], 'asat' => ['v' => 24], 'alat' => ['v' => 72, 'max' => 50], 'ggt' => ['v' => 26]]));
v('  → avec ALAT 72 (> 50) : ALERTE, pas de badge bénin', $g['statut'] === 'alerte' && str_contains($g['message'], 'ALAT'), $g);
$g = sante_gilbert($B(['bili_t' => ['v' => 20, 'max' => 14], 'bili_c' => ['v' => 6, 'max' => 3.4], 'asat' => ['v' => 24], 'alat' => ['v' => 27], 'ggt' => ['v' => 26]]));
v('  → bilirubine CONJUGUÉE élevée : ALERTE (foie / voies biliaires)', $g['statut'] === 'alerte' && str_contains($g['message'], 'conjuguée'), $g);
$g = sante_gilbert($B(['bili_t' => ['v' => 16, 'max' => 14]]));
v('  → bilirubine élevée sans ASAT/ALAT/GGT : incomplet (on ne conclut pas)', $g['statut'] === 'incomplet', $g);
v('  → bilirubine normale : normal ; absente : incomplet', sante_gilbert($B(['bili_t' => ['v' => 9]]))['statut'] === 'normal' && sante_gilbert($B([]))['statut'] === 'incomplet');
v('  → GGT 61 au-dessus de sa norme 60 : alerte', sante_gilbert($B(['bili_t' => ['v' => 16, 'max' => 14], 'asat' => ['v' => 20], 'alat' => ['v' => 20], 'ggt' => ['v' => 61]]))['statut'] === 'alerte');

// ── B. Ratios et index ──
v('B. TG/HDL = 2,17 / 0,40 = 5,43 ; non-HDL = 2,10 − 0,40 = 1,70 g/L', sante_ratio_tg_hdl(2.17, 0.40) === 5.43 && sante_non_hdl(2.10, 0.40) === 1.7);
v('  → HOMA-IR : glycémie 1,00 g/L (5,551 mmol/L) × insuline 10 / 22,5 = 2,47', sante_homa_ir(1.00, 10) === 2.47, sante_homa_ir(1.00, 10));
v('  → TyG : ln(217 × 100 / 2) = 9,29', sante_tyg(2.17, 1.00) === 9.29, sante_tyg(2.17, 1.00));
v('  → HDL ou glycémie absents : null (rien d\'inventé)', sante_ratio_tg_hdl(2.17, null) === null && sante_homa_ir(null, 10) === null && sante_tyg(2.17, null) === null);
$s = sante_score2(50, 'H', true, 140, 5.5 / 2.586, 1.3 / 2.586, 'low'); $s2 = sante_score2(50, 'H', true, 140, 5.5 / 2.586, 1.3 / 2.586, 'very_high');
v('  → SCORE2, exemple publié (H 50 ans, fumeur, PAS 140, CT 5,5, HDL 1,3) : 5,9 % (faible) et 14 % (très haut)', $s['risque'] === 5.9 && $s2['risque'] === 14.0, [$s, $s2]);
v('  → SCORE2 sans PAS ni HDL : « à compléter », jamais un chiffre', sante_score2(44, 'H', false, null, 2.0, null)['risque'] === null && str_contains(sante_score2(44, 'H', false, null, 2.0, null)['raison'], 'HDL'));
v('  → SCORE2 hors 40-69 ans : refusé', sante_score2(35, 'H', false, 120, 2, 0.5)['risque'] === null);
v('  → âge révolu : né le 07/01/1980 → 46 ans le 02/04/2026, 45 ans le 06/01/2026', sante_age('1980-01-07', '2026-04-02') === 46 && sante_age('1980-01-07', '2026-01-06') === 45);

// ── C. Énergie et poids ──
v('C. métabolisme de base (Mifflin) : H 110 kg, 175 cm, 44 ans = 1 100 + 1 093,75 − 220 + 5 = 1 979 kcal', sante_bmr(110, 175, 44) === 1979, sante_bmr(110, 175, 44));
v('  → bilan : 2 000 ingérées − (1 779 + 500 actives) = −279 (déficit)', sante_bilan_energie(2000, 1779, 500) === ['depense' => 2279, 'net' => -279]);
$p = sante_projection_poids([['date' => '2026-10-01', 'kg' => 100], ['date' => '2026-10-29', 'kg' => 98]], 90, null, '2026-10-29');
v('  → projection par pesées : −2 kg en 28 j (0,5 kg/sem) → 8 kg en 112 j → 90 kg le 18/02/2027', $p['date'] === '2027-02-18' && $p['kg_semaine'] === -0.5 && $p['source'] === 'pesées', $p);
$p = sante_projection_poids([['date' => '2026-10-29', 'kg' => 98]], 90, -550, '2026-10-29');
v('  → une seule pesée, déficit moyen 550 kcal/j : 8 kg × 7 700 / 550 = 112 j → 18/02/2027', $p['date'] === '2027-02-18' && $p['source'] === 'déficit moyen', $p);
v('  → poids sous l\'objectif : atteint', !empty(sante_projection_poids([['date' => '2026-10-29', 'kg' => 89]], 90)['atteint']));

// ── D. Repas ──
$items = array_map('sante_item', [['nom' => 'salade', 'g' => 150], ['nom' => 'poulet', 'g' => 120], ['nom' => "pain d'orge", 'g' => 60]]);
$sc = sante_score_sequencage($items, true);
v('D. salade → poulet → pain d\'orge + marche : 50 + 20 + 15 + 15 = 100', $sc['score'] === 100, $sc);
v('  → valeurs calculées par la table : poulet 120 g = 198 kcal, 37,2 g de protéines', $items[1]['kcal'] == 198 && $items[1]['prot'] == 37.2, $items[1]);
$sc = sante_score_sequencage(array_map('sante_item', [['nom' => 'pain de mie', 'g' => 60], ['nom' => 'biscuits', 'g' => 30], ['nom' => 'poulet', 'g' => 100]]), false);
v('  → mie de pain → biscuits → poulet, sans marche : 50 − 20 − 20 = 10', $sc['score'] === 10, $sc);
v('  → aliment inconnu : non « connu », valeurs fournies seulement', sante_item(['nom' => 'tajine mystère', 'g' => 300])['connu'] === false);

// ── E. Intégrité ──
$e = sante_normaliser(['bilans' => [['date' => '2026-13-40', 'valeurs' => ['tg' => 2]], ['date' => '2026-04-02', 'valeurs' => ['tg' => '2,17', 'inconnu' => 5, 'hb' => 'abc']]], 'poids' => [['date' => '2026-10-01', 'kg' => 5000]]]);
v('E. intégrité : date impossible écartée, biomarqueur inconnu et valeur illisible retirés, poids absurde ignoré', count($e['bilans']) === 1 && $e['bilans'][0]['valeurs'] === ['tg' => ['v' => 2.17]] && $e['poids'] === [], $e['bilans']);
//  v1.4 — provenance des valeurs, documents, plans, réalisé : gardés ; le reste rejeté
$e2 = sante_normaliser(['bilans' => [['date' => '2026-05-15', 'documents' => [['id' => 'd1', 'nom' => 'bilan.pdf', 'type' => 'pdf', 'importe_le' => '2026-11-04'], ['id' => '../x', 'nom' => 'pirate']],
        'valeurs' => ['tg' => ['v' => 2.05, 'doc' => 'd1', 'edite' => true], 'hdl' => ['v' => 0.4, 'doc' => '<script>']]]],
    'plans' => ['nutrition' => ['titre' => 'Plan', 'source' => 'plan.docx', 'importe_le' => '2026-11-01', 'items' => [['id' => 'n1', 'jour' => 'lundi', 'moment' => 'diner', 'texte' => ' soupe '], ['jour' => 'jamais', 'moment' => 'goûter', 'texte' => 'x y'], ['texte' => '']]],
                'exercice' => ['items' => [['id' => 'e1', 'jour' => 'tous', 'texte' => 'marche', 'duree_min' => '45'], ['id' => 'e2', 'texte' => 'nage', 'duree_min' => 9999]]], 'autre' => ['items' => [['texte' => 'z']]]],
    'journal' => ['2026-11-02' => ['plan_fait' => ['n1' => true, 'e1' => false, 'x y' => true]]]]);
$b2 = $e2['bilans'][0];
v('  → v1.4 : la valeur garde son document et « corrigée » ; un id de document douteux est écarté', $b2['valeurs']['tg'] === ['v' => 2.05, 'doc' => 'd1', 'edite' => true] && $b2['valeurs']['hdl'] === ['v' => 0.4]
    && $b2['documents'] === [['id' => 'd1', 'nom' => 'bilan.pdf', 'type' => 'pdf', 'importe_le' => '2026-11-04']], $b2);
$pn = $e2['plans']['nutrition'] ?? null; $pe = $e2['plans']['exercice'] ?? null;
v('  → plans : jour / repas inconnus ramenés à « tous » / « déjeuner », ligne vide retirée, durée absurde ignorée, type inconnu rejeté', $pn && count($pn['items']) === 2 && $pn['items'][0] === ['id' => 'n1', 'jour' => 'lundi', 'texte' => 'soupe', 'moment' => 'diner']
    && $pn['items'][1]['jour'] === 'tous' && $pn['items'][1]['moment'] === 'dejeuner' && $pe['items'][0]['duree_min'] == 45 && !isset($pe['items'][1]['duree_min']) && !isset($e2['plans']['autre']), $e2['plans']);
$e3 = sante_normaliser(['plans' => ['protocole' => ['titre' => 'Protocole', 'corrections' => 3, 'corrections_avant' => 11, 'items' => [
        ['id' => 'a1', 'texte' => 'Marche Zone 2', 'moment' => 'reveil', 'heure' => '07:15', 'detail' => 'Zone 2 = 105-125 bpm', 'repas' => false],
        ['id' => 'a2', 'texte' => 'Machines', 'jours' => ['lundi', 'jeudi', 'funday'], 'moment' => 'nulle_part', 'heure' => '25:99'],
        ['id' => 'a3', 'texte' => 'Pesée', 'frequence' => 'semaine'], ['id' => 'a4', 'texte' => 'X', 'frequence' => 'annee']]]],
    'regles' => [['id' => 'r1', 'section' => 'Alimentation — À éviter', 'texte' => 'Sucre rapide'], ['texte' => '']],
    'cibles' => ['tg' => ['op' => '<', 'v' => '1,5'], 'inconnu' => ['op' => '<', 'v' => 1], 'hdl' => ['op' => '=', 'v' => 1]],
    'objectifs_suivi' => [['libelle' => 'Triglycérides', 'depart' => '2,10', 'cible' => '<1,5']],
    'lecons_plan' => [['cle' => 'echauffement 5 min', 'bucket' => 'action', 'moment' => 'matin', 'date' => '2026-11-05'], ['cle' => 'x', 'bucket' => 'pirate'], ['bucket' => 'action']],
    'supplements' => [['nom' => 'Oméga-3', 'dose' => '2 capsules = 1000 mg', 'moment' => 'Au petit-déjeuner', 'pourquoi' => 'TG', 'notes' => 'Frigo', 'actif' => false]]]);
$pr = $e3['plans']['protocole'] ?? null;
v('  → v1.8 protocole : moment, heure, détail, jours, fréquence gardés ; moment / heure / jour / fréquence invalides corrigés ou retirés', $pr && $pr['items'][0]['moment'] === 'reveil' && $pr['items'][0]['heure'] === '07:15' && $pr['items'][0]['detail'] === 'Zone 2 = 105-125 bpm'
    && $pr['items'][1]['jours'] === ['lundi', 'jeudi'] && $pr['items'][1]['moment'] === 'journee' && !isset($pr['items'][1]['heure']) && $pr['items'][2]['frequence'] === 'semaine' && !isset($pr['items'][3]['frequence']) && $pr['corrections'] === 3 && $pr['corrections_avant'] === 11, $pr);
v('  → règles, cibles (catalogue seulement, opérateur < ou >), objectifs, leçons (une leçon sans rien de valide est écartée), suppléments enrichis', count($e3['regles']) === 1 && $e3['regles'][0]['section'] === 'Alimentation — À éviter' && $e3['cibles'] === ['tg' => ['op' => '<', 'v' => 1.5]]
    && $e3['objectifs_suivi'][0]['cible'] === '<1,5' && count($e3['lecons_plan']) === 1 && $e3['lecons_plan'][0]['moment'] === 'matin' && $e3['lecons_plan'][0]['bucket'] === 'action'
    && $e3['supplements'][0]['pourquoi'] === 'TG' && $e3['supplements'][0]['actif'] === false && $e3['supplements'][0]['dose'] === '2 capsules = 1000 mg', [$e3['cibles'], $e3['lecons_plan'], $e3['supplements']]);
v('  → réalisé : seuls les « vrai » aux identifiants sûrs sont gardés ; sans plan, « plans » reste un objet JSON', $e2['journal']['2026-11-02']['plan_fait'] === ['n1' => true] && json_encode(sante_normaliser([])['plans']) === '{}', $e2['journal']);

// ── F. Moteur ──
$etat = sante_normaliser(['profil' => ['naissance' => '1980-01-07', 'sexe' => 'H'], 'objectifs' => ['poids_kg' => 90]]);
$r = sante_compiler([['function' => 'add_lab_panel', 'args' => ['date' => '2026-04-02', 'valeurs' => [['marqueur' => 'Triglycérides', 'valeur' => '2,17', 'max' => 1.5], ['marqueur' => 'ApoB', 'valeur' => 1.42], ['marqueur' => 'Bilirubine totale', 'valeur' => 15.7, 'max' => 14], ['marqueur' => 'ASAT', 'valeur' => 24], ['marqueur' => 'ALAT', 'valeur' => 27], ['marqueur' => 'GGT', 'valeur' => 26], ['marqueur' => 'Bilirubine conjuguée', 'valeur' => 3.4, 'max' => 3.4]]]]], $etat);
v('F. add_lab_panel : noms du compte rendu résolus, indicateurs rendus (Gilbert reconnu)', $r['status'] === 'ok' && count($r['etat']['bilans'][0]['valeurs']) === 7 && $r['journal'][0]['indicateurs']['gilbert']['statut'] === 'gilbert', $r['journal']);
$etat = $r['etat'];
$r2 = sante_compiler([['function' => 'add_lab_panel', 'args' => ['date' => '2026-04-02', 'valeurs' => ['hb' => 14]]]], $etat);
v('  → même date : refusé (utilise update_biomarker)', $r2['status'] === 'error' && str_contains($r2['journal'][0]['erreur'], 'update_biomarker'));
$r2 = sante_compiler([['function' => 'add_lab_panel', 'args' => ['date' => '2026-06-01', 'valeurs' => ['Machin' => 3]]]], $etat);
v('  → biomarqueur inconnu : refusé, liste des connus fournie', $r2['status'] === 'error' && str_contains($r2['journal'][0]['erreur'], 'Machin') && !empty($r2['journal'][0]['connus']));
$r2 = sante_compiler([['function' => 'update_biomarker', 'args' => ['date' => '2026-04-02', 'marqueur' => 'vitamine d', 'valeur' => 27.5, 'min' => 30]]], $etat);
v('  → update_biomarker : vitamine D 27,5 ajoutée au bilan du 02/04', $r2['status'] === 'ok' && $r2['etat']['bilans'][0]['valeurs']['vitd']['v'] == 27.5);
$r2 = sante_compiler([['function' => 'log_daily_nutrition', 'args' => ['date' => '2026-11-03', 'moment' => 'dejeuner', 'items' => [['nom' => 'salade', 'g' => 150], ['nom' => 'poulet', 'g' => 120], ['nom' => "pain d'orge", 'g' => 60]], 'marche_post' => true]]], $etat);
$j = $r2['etat']['journal']['2026-11-03'] ?? [];
v('  → log_daily_nutrition : calories par la table, score 100, cases « déjeuner séquencé » et « marche » cochées', $r2['status'] === 'ok' && $j['repas'][0]['score'] === 100 && $j['checklist']['dej_seq'] && $j['checklist']['dej_marche'] && $j['repas'][0]['totaux']['kcal'] === 359, $j['repas'][0]['totaux'] ?? $r2['journal']);
$r2 = sante_compiler([['function' => 'log_daily_nutrition', 'args' => ['moment' => 'diner', 'items' => [['nom' => 'plat inconnu', 'g' => 300]]]]], $etat);
v('  → aliment hors table sans valeurs : refusé (le modèle ne devine pas)', $r2['status'] === 'error' && str_contains($r2['journal'][0]['erreur'], 'plat inconnu'));
$r2 = sante_compiler([['function' => 'log_workout_activity', 'args' => ['date' => '2026-11-03', 'zone2_min' => 42, 'machines' => true, 'soleus_min' => 10]]], $etat);
$j = $r2['etat']['journal']['2026-11-03'];
v('  → log_workout_activity : Zone 2 42 min coche la case, séance machines, soleus', $r2['status'] === 'ok' && $j['checklist']['zone2'] && $j['activite']['machines'] === true && $j['checklist']['soleus']);
$r2 = sante_compiler([['function' => 'sync_samsung_health', 'args' => ['date' => '2026-11-03', 'pas' => 10450, 'kcal_actives' => 610, 'fc_repos' => 61, 'poids' => 104.2]]], $etat);
v('  → sync_samsung_health : pas, kcal actives, FC, et la pesée rejoint la courbe de poids', $r2['status'] === 'ok' && $r2['etat']['journal']['2026-11-03']['samsung']['pas'] == 10450 && end($r2['etat']['poids'])['kg'] == 104.2);
$r2 = sante_compiler([['function' => 'sync_samsung_health', 'args' => ['fc_repos' => 400]]], $etat);
v('  → FC de repos 400 : hors bornes, refusé', $r2['status'] === 'error');
$r2 = sante_compiler([['function' => 'update_supplement_protocol', 'args' => ['action' => 'add', 'nom' => 'Berbérine', 'dose' => '500 mg']], ['function' => 'update_supplement_protocol', 'args' => ['action' => 'update', 'nom' => 'berberine', 'moment' => 'midi']]], $etat);
v('  → update_supplement_protocol : ajout puis mise à jour (nom retrouvé sans accent)', $r2['status'] === 'ok' && $r2['etat']['supplements'][0]['moment'] === 'midi');
$r2 = sante_compiler([['function' => 'update_health_goal', 'args' => ['poids_kg' => 90, 'tg_gl' => 1.5, 'apob_gl' => 1.0, 'vitd_ngml' => 35]]], $etat);
v('  → update_health_goal : objectifs posés', $r2['status'] === 'ok' && $r2['etat']['objectifs']['vitd_ngml'] == 35);
$r2 = sante_compiler([['function' => 'update_health_goal', 'args' => ['poids_kg' => 90]], ['function' => 'update_health_goal', 'args' => ['poids_kg' => 9]]], $etat);
v('  → un lot dont un appel est refusé : TOUT est annulé (état d\'avant)', $r2['status'] === 'error' && $r2['etat']['objectifs']['poids_kg'] == 90 && $etat['objectifs']['poids_kg'] == 90);
$r2 = sante_compiler([['function' => 'log_workout_activity', 'args' => ['zone2_min' => 40, 'pas' => -5]]], $etat);
v('  → un appel refusé à mi-chemin ne laisse rien derrière lui (zone2 non écrite)', $r2['status'] === 'error' && !isset(((array)$r2['etat']['journal'])[sante_aujourdhui()]));
$r2 = sante_compiler([['function' => 'prescrire_medicament', 'args' => []]], $etat);
v('  → fonction hors catalogue : ERROR_OUT_OF_CATALOG', $r2['status'] === 'error' && $r2['journal'][0]['erreur'] === 'ERROR_OUT_OF_CATALOG');
$l = sante_lecture($etat, '2026-11-03');
v('G. lecture du CMO : dernier bilan avec statuts, indicateurs, règle « tu lis, tu ne calcules pas »', $l['dernier_bilan']['valeurs']['Triglycérides']['statut'] === 'haut' && $l['dernier_bilan']['indicateurs']['gilbert']['statut'] === 'gilbert' && str_contains($l['regle'], 'ne calcules pas'));

echo $ko === 0 ? "\n  ✅ TOUT PASSE — $n contrôles\n" : "\n  ❌ $ko contrôle(s) en échec sur $n\n";
exit($ko === 0 ? 0 : 1);
