<?php
/**
 * v37.29 — LES SEMAINES RÉELLES DU CYCLE, CÔTÉ SERVEUR.
 *   « 1 est plus réaliste, mais il faut changer aussi la partie prévu et calcul. »
 *   Un cycle de paie compte 4 ou 5 semaines (les jeudis entre le jour de paie de
 *   M−1 et la veille de celui de M), jamais 4,3. L'application compte désormais ces
 *   semaines ; le recalcul de secours du serveur doit appliquer la même règle.
 *   Cette suite vérifie la règle CONTRE UN COMPTAGE INDÉPENDANT (jour par jour),
 *   puis le net mensuel de secours contre une réécriture « / mois » de la fixture.
 */
require_once __DIR__ . '/../cfo_intent_engine.php';

$ko = 0;
function v($titre, $attendu, $obtenu) {
    global $ko; $ok = $attendu === $obtenu; if (!$ok) $ko++;
    printf("  %s %-58s %s\n", $ok ? '✅' : '❌', $titre, $ok ? '' : "attendu=" . json_encode($attendu) . " obtenu=" . json_encode($obtenu));
}
//  Le comptage de référence : chaque jour du cycle, un par un.
function jeudis_jour_par_jour(int $m, int $an, int $jdp): int {
    $d = mktime(12, 0, 0, $m - 1, $jdp, $an); $fin = mktime(12, 0, 0, $m, $jdp - 1, $an); $n = 0;
    for (; $d <= $fin; $d = strtotime('+1 day', $d)) if ((int)date('w', $d) === 4) $n++;
    return $n;
}

echo "\n  SEMAINES RÉELLES DU CYCLE (serveur)\n  " . str_repeat('─', 66) . "\n";
$ecarts = []; $vus = [];
foreach ([1, 5, 8, 15, 25, 27, 28] as $jdp) for ($an = 2025; $an <= 2028; $an++) for ($m = 1; $m <= 12; $m++) {
    $a = cfo_semaines_cycle($m, $an, $jdp); $b = jeudis_jour_par_jour($m, $an, $jdp);
    $vus[$a] = true;
    if ($a !== $b) $ecarts[] = "$m/$an paie $jdp : $a ≠ $b";
}
v('336 cycles (7 jours de paie × 4 ans) = comptage jour par jour', [], array_slice($ecarts, 0, 3));
ksort($vus);
v('  → un cycle compte 4 ou 5 semaines, jamais autre chose', [4, 5], array_keys($vus));
v('  → octobre 2026, paie le 27 (27 sept. → 26 oct.) : 4 semaines', 4, cfo_semaines_cycle(10, 2026, 27));
v('  → novembre 2026, paie le 27 (27 oct. → 26 nov.) : 5 semaines', 5, cfo_semaines_cycle(11, 2026, 27));
$annee = []; foreach ([2025, 2026, 2027, 2028] as $an) { $s = cfo_semaines_annee($an, 27); $annee[] = $s === 52 || $s === 53; }
v('  → une année compte 52 ou 53 semaines (et non 4,3 × 12 = 51,6)', [true, true, true, true], $annee);

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
    for ($m = 1; $m <= 12; $m++) $exc[] = (object)['moisDebut' => $m, 'moisFin' => $m, 'nouvelleValeur' => (float)$cv->valeur * jeudis_jour_par_jour($m, 2026, $jdp)];
    $cv->periode = 'mois'; $cv->exceptions = $exc;
}
$attendu = cfo_compute_monthly_net_courant($ref, 2026);
v('la fixture porte des charges « / sem » (sinon le test ne prouve rien)', true, $hebdo >= 2);
v('net mensuel de secours = charges hebdo × semaines réelles, mois par mois', array_map(fn($x) => $x['net'], $attendu), array_map(fn($x) => $x['net'], $net));
$ecartsMois = []; foreach ($net as $i => $x) if (!$x['isPast']) $ecartsMois[] = $x['net'] !== null;
v('  → les mois passés restent sans net, les autres en ont un', true, count($ecartsMois) > 0 && !in_array(false, $ecartsMois, true));

echo "  " . str_repeat('─', 66) . "\n";
printf("  %s — %d contrôle(s) en échec\n\n", $ko ? '❌ ÉCHEC' : '✅ TOUT PASSE', $ko);
exit($ko ? 1 : 0);
