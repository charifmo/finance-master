<?php
/**
 * v37.37 — LE VIREMENT QUI FINANCE LES CHARGES FIXES SORT DU NET DU COURANT (serveur).
 *   Le net mensuel de secours du CFO (cfo_compute_monthly_net_courant), miroir de la
 *   colonne NET du « Surplus Détaillé », suit la même règle que l'application : un
 *   virement interne qui QUITTE le Courant est une sortie, un virement qui y ARRIVE
 *   une entrée ; un virement entre deux autres comptes ne le touche pas. Vérifié par
 *   écart avec la même fixture SANS virement — l'écart attendu se calcule de tête.
 */
require_once __DIR__ . '/../cfo_intent_engine.php';

$ko = 0;
function v($titre, $attendu, $obtenu) {
    global $ko; $ok = $attendu === $obtenu; if (!$ok) $ko++;
    printf("  %s %-60s %s\n", $ok ? '✅' : '❌', $titre, $ok ? '' : "attendu=" . json_encode($attendu) . " obtenu=" . json_encode($obtenu));
}
function etat(array $virements) {
    $fd = json_decode(file_get_contents(__DIR__ . '/fixture.json'));
    cfo_sanitize_finance_data($fd);
    $fd->comptes[] = (object)['id' => 2, 'label' => 'Compte Principale ASSAFA', 'type' => 'epargne', 'solde' => 1000];
    $fd->donneesAnnuelles->{'2026'}->virementsInternes = array_map(fn($x) => (object)$x, $virements);
    return $fd;
}
$net = fn($fd) => array_column(cfo_compute_monthly_net_courant($fd, 2026), 'net', 'mois');

echo "\n  LE VIREMENT VERS LE COMPTE DES CHARGES SORT DU NET DU COURANT (serveur)\n  " . str_repeat('─', 66) . "\n";
$sans = $net(etat([]));
$avec = $net(etat([
    ['id' => 1, 'mois' => 11, 'sourceCompte' => 'courant', 'destinationCompte' => 'cpt_2', 'montant' => 15000],
    ['id' => 2, 'mois' => 12, 'sourceCompte' => 'courant', 'destinationCompte' => 'cpt_2', 'montant' => 15000],
    ['id' => 3, 'mois' => 12, 'sourceCompte' => 'cpt_2', 'destinationCompte' => 'courant', 'montant' => 500],
    ['id' => 4, 'mois' => 10, 'sourceCompte' => 'cpt_7', 'destinationCompte' => 'cpt_2', 'montant' => 4000],
]));
v('novembre : Courant → Assafa 15 000 → net − 15 000', -15000, $avec[11] - $sans[11]);
v('décembre : − 15 000 + 500 (Assafa → Courant) → net − 14 500', -14500, $avec[12] - $sans[12]);
v('octobre : Dépenses annuels → Assafa (hors Courant) → net inchangé', 0, $avec[10] - $sans[10]);
v('les autres mois ne bougent pas', array_diff_key($sans, [10 => 1, 11 => 1, 12 => 1]), array_diff_key($avec, [10 => 1, 11 => 1, 12 => 1]));

echo "  " . str_repeat('─', 66) . "\n";
printf("  %s — %d contrôle(s) en échec\n\n", $ko ? '❌ ÉCHEC' : '✅ TOUT PASSE', $ko);
exit($ko ? 1 : 0);
