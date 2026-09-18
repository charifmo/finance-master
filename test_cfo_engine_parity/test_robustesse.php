<?php
/**
 * v36.0 — MATRICE DE ROBUSTESSE DU CATALOGUE.
 *   Quatre axes, sur CHAQUE fonction du catalogue — la couverture est dérivée
 *   de cfo_catalog_names(), donc une fonction ajoutée sans cas de test fait
 *   échouer la suite au lieu de passer inaperçue.
 *     A. args canoniques        → doit aboutir
 *     B. alias + montants sales → doit aboutir à l'IDENTIQUE de A
 *     C. requis manquant        → doit refuser SANS rien écrire
 *     D. étanchéité 2026/2027   → l'exercice non ciblé ne doit pas bouger
 */
require_once __DIR__ . '/../cfo_intent_engine.php';

function etat_neuf() {
    $fd = json_decode(file_get_contents(__DIR__ . '/fixture.json'));
    $fd->donneesAnnuelles->{'2027'} = json_decode(json_encode($fd->donneesAnnuelles->{'2026'}));
    // Le nettoyage d'état (cfo_sanitize_finance_data) normalise légitimement
    // TOUS les exercices et s'exécute au début de chaque compilation. On le
    // joue une fois ici pour que la référence d'étanchéité porte sur les seules
    // écritures métier — c'est exactement où le scellé du moteur se place.
    cfo_sanitize_finance_data($fd);
    return $fd;
}
function empreinte_annee($fd, $yr) { return md5((string)json_encode(oget(oget($fd,'donneesAnnuelles'), (string)$yr))); }
function empreinte_globale($fd) { return md5((string)json_encode($fd)); }

/** [canonique, alias-sale, requis-manquant] par fonction. */
$CAS = [
'create_smart_goal' => [
    ['name'=>'Retraite','target_amount'=>300000,'initial_funding'=>25000,'versement_mensuel'=>3000,'years'=>[2027]],
    ['goal_name'=>'Retraite','cible'=>'300 000 DH','depart'=>'25 000','versement'=>'3 000 DH','annee'=>'2027'],
    ['name'=>'Retraite']],
'update_smart_goal' => [
    ['name'=>'Voyage Paris','target_amount'=>90000,'versement_mensuel'=>1200,'years'=>[2027]],
    ['objectif'=>'Voyage Paris','montant_cible'=>'90 000 DH','mensualite'=>'1 200','annee'=>2027],
    []],
'add_funds_to_goal' => [
    ['name'=>'Voyage Paris','amount'=>5000,'years'=>[2027]],
    ['objectif'=>'Voyage Paris','montant'=>'5 000 DH','annee'=>'2027'],
    ['name'=>'Voyage Paris']],
'set_recurring_savings' => [
    ['name'=>'Long Terme CTO','fixed_amount'=>7000,'source_account'=>'courant','years'=>[2027]],
    ['nom'=>'Long Terme CTO','montant'=>'7 000 DH','compte_source'=>'courant','annee'=>'2027'],
    ['fixed_amount'=>7000]],
'update_recurring_savings' => [
    ['name'=>'Fonds Urgence','amount'=>2500,'years'=>[2027]],
    ['nom'=>'Fonds Urgence','montant'=>'2 500 DH','annee'=>2027],
    ['name'=>'Fonds Urgence']],
'remove_recurring_savings' => [
    ['name'=>'Fonds Urgence','years'=>[2027]],
    ['nom'=>'Fonds Urgence','annee'=>'2027'],
    []],
'update_asset_valuation' => [
    ['asset_name'=>'Local Bouskoura','new_value'=>1200000,'years'=>[2027]],
    ['actif'=>'Local Bouskoura','nouvelle_valeur'=>'1 200 000 DH','annee'=>2027],
    ['asset_name'=>'Local Bouskoura']],
'add_fixed_expense' => [
    ['name'=>'Assurance Auto','amount'=>450,'years'=>[2027]],
    ['libelle'=>'Assurance Auto','montant'=>'450 DH','annee'=>'2027'],
    ['name'=>'Assurance Auto']],
'update_fixed_expense' => [
    ['name'=>'Loyer','amount'=>4800,'years'=>[2027]],
    ['charge'=>'Loyer','montant'=>'4 800 DH','annee'=>2027],
    ['name'=>'Loyer']],
'remove_fixed_expense' => [
    ['name'=>'Loyer','years'=>[2027]],
    ['charge'=>'Loyer','annee'=>'2027'],
    []],
'add_variable_expense' => [
    ['name'=>'Sorties','amount'=>600,'period'=>'mois','years'=>[2027]],
    ['libelle'=>'Sorties','montant'=>'600 DH','periode'=>'mois','annee'=>2027],
    ['name'=>'Sorties']],
'update_variable_expense' => [
    ['name'=>'Courses','amount'=>3200,'years'=>[2027]],
    ['charge'=>'Courses','montant'=>'3 200 DH','annee'=>'2027'],
    ['name'=>'Courses']],
'add_income' => [
    ['name'=>'Freelance','amount'=>5000,'years'=>[2027]],
    ['libelle'=>'Freelance','montant'=>'5 000 DH','annee'=>2027],
    ['name'=>'Freelance']],
'update_income' => [
    ['name'=>'Salaire','amount'=>21000,'years'=>[2027]],
    ['revenu'=>'Salaire','montant'=>'21 000 DH','annee'=>'2027'],
    ['name'=>'Salaire']],
'add_one_off_expense' => [
    ['name'=>'Vidange','amount'=>1800,'month'=>5,'years'=>[2027]],
    ['libelle'=>'Vidange','montant'=>'1 800 DH','mois'=>'5','annee'=>2027],
    ['name'=>'Vidange']],
'create_account' => [
    ['label'=>'Livret Vert','balance'=>12000,'years'=>[2027]],
    ['nom'=>'Livret Vert','solde'=>'12 000 DH','annee'=>'2027'],
    ['balance'=>12000]],
'adjust_account_balance' => [
    ['account'=>'Compte Courant','amount'=>1500,'years'=>[2027]],
    ['compte'=>'Compte Courant','montant'=>'1 500 DH','annee'=>2027],
    ['account'=>'Compte Courant']],
'set_initial_balance' => [
    ['account'=>'courant','amount'=>60000,'years'=>[2027]],
    ['compte'=>'courant','solde'=>'60 000 DH','annee'=>'2027'],
    ['account'=>'courant']],
'clone_year' => [
    ['from_year'=>2026,'to_year'=>2030],
    ['annee_source'=>'2026','annee_cible'=>'2030'],
    ['from_year'=>2026]],
];

$manquantes = array_diff(cfo_catalog_names(), array_keys($CAS));
if ($manquantes) { echo "❌ Fonctions du catalogue sans cas de test : " . implode(', ', $manquantes) . "\n"; exit(1); }

$ko = 0;
printf("\n  MATRICE DE ROBUSTESSE — %d fonctions × 4 axes\n", count($CAS));
echo "  " . str_repeat('─', 88) . "\n";
printf("  %-26s %-11s %-11s %-13s %s\n", 'FONCTION', 'CANONIQUE', 'ALIAS', 'REQUIS MANQ.', 'ÉTANCHÉITÉ 2026');
echo "  " . str_repeat('─', 88) . "\n";

foreach ($CAS as $fn => $trio) {
    list($canon, $alias, $incomplet) = $trio;

    // A — canonique
    $fdA = etat_neuf();
    $emp2026 = empreinte_annee($fdA, 2026);
    $rA = cfo_compile([ (object)['function'=>$fn, 'args'=>(object)$canon] ], $fdA, ['anneeContexte'=>2027]);
    $okA = in_array($rA['status'] ?? '', ['ok'], true);

    // B — alias sales : même état final attendu
    $fdB = etat_neuf();
    $rB = cfo_compile([ (object)['function'=>$fn, 'args'=>(object)$alias] ], $fdB, ['anneeContexte'=>2027]);
    $okB = ($rB['status'] ?? '') === 'ok';
    // Les identifiants générés (cfo_uid) diffèrent d'un run à l'autre : on les neutralise.
    // Identifiants générés : horodatés (cfo_uid) ou suffixés en base36 sur 4
    // caractères (cfo_build_ops). Les deux formes sont neutralisées, sinon deux
    // exécutions identiques ne peuvent jamais se comparer.
    $norm = function ($fd) {
        $j = (string)json_encode($fd);
        $j = preg_replace('/\d{10,}/', '<uid>', $j);
        $j = preg_replace('/([a-z0-9]+)_[a-z0-9]{4}(?=")/', '$1_<sfx>', $j);
        return $j;
    };
    $identique = $okA && $okB && ($norm($fdA) === $norm($fdB));

    // C — requis manquant : refus, zéro écriture
    $fdC = etat_neuf(); $avantC = empreinte_globale($fdC);
    $rC = cfo_compile([ (object)['function'=>$fn, 'args'=>(object)$incomplet] ], $fdC, ['anneeContexte'=>2027]);
    $refus = (($rC['status'] ?? '') === 'error') && (($rC['error'] ?? '') === 'ERROR_ARGUMENTS_INCOMPLETS');
    $intact = empreinte_globale($fdC) === $avantC;
    $okC = $refus && $intact;

    // D — étanchéité : 2026 ne doit pas bouger (sauf clone_year, qui LIT 2026)
    $okD = (empreinte_annee($fdA, 2026) === $emp2026);

    foreach ([[$okA,'A'],[$identique,'B'],[$okC,'C'],[$okD,'D']] as $t) if (!$t[0]) $ko++;
    printf("  %-26s %-11s %-11s %-13s %s\n", $fn,
        $okA ? '✅' : '❌ '.($rA['status'] ?? '?'),
        $identique ? '✅' : ($okB ? '❌ diverge' : '❌ '.($rB['status'] ?? '?')),
        $okC ? '✅' : ($refus ? '❌ a ecrit' : '❌ '.($rC['error'] ?? $rC['status'] ?? '?')),
        $okD ? '✅' : '❌ 2026 MODIFIE');
}
echo "  " . str_repeat('─', 88) . "\n";

// ── E. VALEURS ABERRANTES — aucune ne doit produire de donnée inventée ──
//    Trouvées lors d'une revue adversariale de la v36.0 : create_objectif
//    remplaçait une cible ≤ 0 par 10 000 DH sortis de nulle part, un mois à 99
//    était stocké tel quel, et une épargne sans montant ni pourcentage créait
//    une ligne à 0 DH que personne n'avait demandée.
$ABERRANTS = [
  'cible d\'objectif à 0'          => '[{"function":"create_smart_goal","args":{"name":"Zero","target_amount":0}}]',
  'cible d\'objectif négative'      => '[{"function":"create_smart_goal","args":{"name":"Neg","target_amount":-5000}}]',
  'mois hors bornes (99)'          => '[{"function":"add_one_off_expense","args":{"name":"X","amount":100,"month":99}}]',
  'mois hors bornes (0)'           => '[{"function":"add_one_off_expense","args":{"name":"X","amount":100,"month":0}}]',
  'épargne sans montant ni %'      => '[{"function":"set_recurring_savings","args":{"name":"Poche vide"}}]',
  'valorisation négative'          => '[{"function":"update_asset_valuation","args":{"asset_name":"Local Bouskoura","new_value":-1}}]',
  'versement mensuel négatif'      => '[{"function":"create_smart_goal","args":{"name":"V","target_amount":1000,"versement_mensuel":-50}}]',
  'montant illisible'              => '[{"function":"add_fixed_expense","args":{"name":"X","amount":"beaucoup"}}]',
];
$koE = 0;
echo "\n  VALEURS ABERRANTES — refus attendu, zéro écriture\n";
echo "  " . str_repeat('─', 88) . "\n";
foreach ($ABERRANTS as $titre => $json) {
    $fd = etat_neuf(); $avant = empreinte_globale($fd);
    $r = cfo_compile(json_decode($json), $fd, ['anneeContexte'=>2027]);
    $refuse = ($r['status'] ?? '') === 'error';
    $intact = empreinte_globale($fd) === $avant;
    if (!$refuse || !$intact) { $koE++; $ko++; }
    printf("  %-34s %s  %s\n", $titre,
        $refuse ? '✅ refusé   ' : '❌ ACCEPTÉ ('.($r['status'] ?? '?').')',
        $intact ? '✅ état intact' : '❌ A ÉCRIT');
}
echo "  " . str_repeat('─', 88) . "\n";
printf("  %s — %d contrôle(s) en échec sur %d\n\n", $ko ? '❌ ÉCHEC' : '✅ TOUT PASSE', $ko, count($CAS) * 4 + count($ABERRANTS) * 2);
exit($ko ? 1 : 0);
