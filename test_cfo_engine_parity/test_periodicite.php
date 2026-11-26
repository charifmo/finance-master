<?php
/**
 * v37.150 — UNE CHARGE FIXE SELON X MOIS, CÔTÉ SERVEUR (le moteur du CFO).
 *   Le net mensuel de secours (cfo_compute_monthly_net_courant) et le reliquat suivent le même rythme que l'application :
 *   un syndic de 900 chaque trimestre (dès mars) coûte 900 en mars, juin, sept., déc. et rien les autres mois ;
 *   « par mois », il vaut 300. Vérifié par écart avec la même ligne à 300 chaque mois.
 */
require_once __DIR__ . '/../cfo_intent_engine.php';

$ko = 0;
function v($titre, $attendu, $obtenu) {
    global $ko; $ok = $attendu === $obtenu; if (!$ok) $ko++;
    printf("  %s %-66s %s\n", $ok ? '✅' : '❌', $titre, $ok ? '' : "attendu=" . json_encode($attendu) . " obtenu=" . json_encode($obtenu));
}
function etat(?array $per, float $valeur) {
    $fd = json_decode(file_get_contents(__DIR__ . '/fixture.json'));
    cfo_sanitize_finance_data($fd);
    $fd->soldesInitiaux->anneeActuelle = 2026; $fd->soldesInitiaux->moisActuel = 1;
    $f = (object)['label' => 'Syndic test', 'valeur' => $valeur, 'jourPrevu' => 10, 'exceptions' => []];
    if ($per) $f->periodicite = (object)$per;
    $fd->donneesAnnuelles->{'2026'}->chargesFixes->syndicTest = $f;
    return $fd;
}
$net = fn($fd) => array_column(cfo_compute_monthly_net_courant($fd, 2026), 'net', 'mois');

echo "\n  UNE CHARGE FIXE SELON X MOIS (serveur)\n  " . str_repeat('─', 72) . "\n";
v('rythmes : trimestre dès mars → 3, 6, 9, 12 ; « tous les 5 mois » n\'en est pas un',
  [[3, 6, 9, 12], 12], [array_values(array_filter(range(1, 12), fn($m) => cfo_mois_de_paiement((object)['periodicite' => (object)['tous' => 3, 'depart' => 3]], $m))),
   count(array_filter(range(1, 12), fn($m) => cfo_mois_de_paiement((object)['periodicite' => (object)['tous' => 5, 'depart' => 1]], $m)))]);
$mens = $net(etat(null, 300));
$trim = $net(etat(['tous' => 3, 'depart' => 3], 900));
$ecarts = []; foreach ($mens as $m => $x) if ($x !== null && $trim[$m] !== null) $ecarts[$m] = $trim[$m] - $x;
v('net : −600 en mars, juin, sept., déc. (900 au lieu de 300) ; +300 les 8 autres mois',
  [1 => 300, 2 => 300, 3 => -600, 4 => 300, 5 => 300, 6 => -600, 7 => 300, 8 => 300, 9 => -600, 10 => 300, 11 => 300, 12 => -600], $ecarts);
v('  → sur l\'année, le même coût (4 × 900 = 12 × 300)', 0, array_sum($ecarts));
v('reliquat (mois moyen) : identique — 900 le trimestre comptent 300 par mois', round(cfo_compute_reliquat(etat(null, 300), 2026), 2), round(cfo_compute_reliquat(etat(['tous' => 3, 'depart' => 3], 900), 2026), 2));

echo "  " . str_repeat('─', 72) . "\n";
printf("  %s — %d contrôle(s) en échec\n\n", $ko ? '❌ ÉCHEC' : '✅ TOUT PASSE', $ko);
exit($ko ? 1 : 0);
