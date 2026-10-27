<?php
/**
 * v37.29 — LES SEMAINES RÉELLES DU CYCLE, CÔTÉ SERVEUR.
 *   « 1 est plus réaliste, mais il faut changer aussi la partie prévu et calcul. »
 *   Un cycle de paie compte 4 ou 5 semaines (les jeudis entre le jour de paie de
 *   M−1 et la veille de celui de M), jamais 4,3. L'application compte désormais ces
 *   semaines ; le recalcul de secours du serveur doit appliquer la même règle.
 *   Cette suite vérifie la règle CONTRE UN COMPTAGE INDÉPENDANT (jour par jour),
 *   puis le net mensuel de secours contre une réécriture « / mois » de la fixture.
 *
 *   v37.65 — LES SEMAINES COUPÉES PAR LA PAIE : un cycle compte ses JOURS ÷ 7 (31 jours =
 *   4 sem. 3 j), comme l'application ; le comptage de référence compte les jours.
 */
require_once __DIR__ . '/../cfo_intent_engine.php';

$ko = 0;
function v($titre, $attendu, $obtenu) {
    global $ko; $ok = $attendu === $obtenu; if (!$ok) $ko++;
    printf("  %s %-58s %s\n", $ok ? '✅' : '❌', $titre, $ok ? '' : "attendu=" . json_encode($attendu) . " obtenu=" . json_encode($obtenu));
}
//  Le comptage de référence : chaque jour du cycle, un par un.
function jours_jour_par_jour(int $m, int $an, int $jdp): int {
    $d = mktime(12, 0, 0, $m - 1, $jdp, $an); $fin = mktime(12, 0, 0, $m, $jdp - 1, $an); $n = 0;
    for (; $d <= $fin; $d = strtotime('+1 day', $d)) $n++;
    return $n;
}

echo "\n  SEMAINES DU CYCLE = SES JOURS ÷ 7 (serveur)\n  " . str_repeat('─', 66) . "\n";
$ecarts = []; $vus = [];
foreach ([1, 5, 8, 15, 25, 27, 28] as $jdp) for ($an = 2025; $an <= 2028; $an++) for ($m = 1; $m <= 12; $m++) {
    $a = cfo_semaines_cycle($m, $an, $jdp); $j = jours_jour_par_jour($m, $an, $jdp);
    $vus[$j] = true;
    if (abs($a - $j / 7) > 1e-9 || cfo_jours_cycle($m, $an, $jdp) !== $j) $ecarts[] = "$m/$an paie $jdp : $a ≠ $j / 7";
}
v('336 cycles (7 jours de paie × 4 ans) : jours ÷ 7 = comptage jour par jour', [], array_slice($ecarts, 0, 3));
ksort($vus);
v('  → un cycle compte 28, 29, 30 ou 31 jours (février 2028 : 29)', [28, 29, 30, 31], array_keys($vus));
v('  → octobre 2026, paie le 27 (27 sept. → 26 oct.) : 30 jours, 30 / 7 semaine', 30 / 7, cfo_semaines_cycle(10, 2026, 27));
v('  → novembre 2026, paie le 27 (27 oct. → 26 nov.) : 31 jours, 31 / 7 semaine', 31 / 7, cfo_semaines_cycle(11, 2026, 27));
$annee = []; foreach ([2025, 2026, 2027, 2028] as $an) { $annee[] = (int)round(cfo_semaines_annee($an, 27) * 7); }
v('  → une année compte 365 jours, 366 en 2028 (et non 4,3 × 12 = 51,6 semaines)', [365, 365, 365, 366], $annee);

//  Le net mensuel de secours : une charge « / sem » = valeur × les semaines du cycle.
//  Référence : la MÊME fixture où chaque charge hebdo devient « / mois », avec pour
//  chaque mois une exception valant valeur × semaines réelles — chemin mensuel, intact.
$fd = json_decode(file_get_contents(__DIR__ . '/fixture.json'));
cfo_sanitize_finance_data($fd);
$net = cfo_compute_monthly_net_courant($fd, 2026);
$ref = json_decode(file_get_contents(__DIR__ . '/fixture.json'));
cfo_sanitize_finance_data($ref);
$jdp = (int)$ref->soldesInitiaux->jourDePaie; $hebdo = 0;
foreach ($ref->donneesAnnuelles->{'2026'}->chargesVariables as $cv) {
    if (($cv->periode ?? '') !== 'semaine') continue;
    $hebdo++; $exc = [];
    for ($m = 1; $m <= 12; $m++) $exc[] = (object)['moisDebut' => $m, 'moisFin' => $m, 'nouvelleValeur' => (float)$cv->valeur * jours_jour_par_jour($m, 2026, $jdp) / 7];
    $cv->periode = 'mois'; $cv->exceptions = $exc;
}
$attendu = cfo_compute_monthly_net_courant($ref, 2026);
v('la fixture porte des charges « / sem » (sinon le test ne prouve rien)', true, $hebdo >= 2);
v('net mensuel de secours = charges hebdo × jours du cycle ÷ 7, mois par mois', array_map(fn($x) => $x['net'], $attendu), array_map(fn($x) => $x['net'], $net));
$ecartsMois = []; foreach ($net as $i => $x) if (!$x['isPast']) $ecartsMois[] = $x['net'] !== null;
v('  → les mois passés restent sans net, les autres en ont un', true, count($ecartsMois) > 0 && !in_array(false, $ecartsMois, true));

echo "  " . str_repeat('─', 66) . "\n";
printf("  %s — %d contrôle(s) en échec\n\n", $ko ? '❌ ÉCHEC' : '✅ TOUT PASSE', $ko);
exit($ko ? 1 : 0);
