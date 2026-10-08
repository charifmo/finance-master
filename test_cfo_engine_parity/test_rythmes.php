<?php
/**
 * v37.30 — UN RYTHME PAR LIGNE DE DÉTAIL, CÔTÉ SERVEUR.
 *   « Hri » se fait une fois par cycle, « L7m » à la semaine, « Psy » à la
 *   quinzaine. Chaque ligne de détail porte son rythme ; sans rythme, elle hérite
 *   de sa catégorie (la parité avec l'ancien moteur le garantit pour les données
 *   existantes). Cette suite vérifie, à la main :
 *     - le net mensuel de secours, ligne par ligne, mois par mois ;
 *     - la `valeur` résumée (équivalent dans l'unité de la catégorie) ;
 *     - le CFO qui change le total d'une catégorie aux rythmes mêlés : chaque
 *       ligne suit le même ratio et GARDE son rythme ; une sous-ligne modifiée
 *       met la valeur résumée à jour.
 */
require_once __DIR__ . '/../cfo_intent_engine.php';

$ko = 0;
function v($titre, $attendu, $obtenu) {
    global $ko; $ok = $attendu === $obtenu; if (!$ok) $ko++;
    printf("  %s %-60s %s\n", $ok ? '✅' : '❌', $titre, $ok ? '' : "attendu=" . json_encode($attendu) . " obtenu=" . json_encode($obtenu));
}
function jeudis(int $m, int $an, int $jdp): int {
    $d = mktime(12, 0, 0, $m - 1, $jdp, $an); $fin = mktime(12, 0, 0, $m, $jdp - 1, $an); $n = 0;
    for (; $d <= $fin; $d = strtotime('+1 day', $d)) if ((int)date('w', $d) === 4) $n++;
    return $n;
}
//  La fixture de parité, où « Alimentation » (/ sem) reçoit des lignes aux rythmes mêlés
function etat() {
    $fd = json_decode(file_get_contents(__DIR__ . '/fixture.json'));
    cfo_sanitize_finance_data($fd);
    $alim = $fd->donneesAnnuelles->{'2026'}->chargesVariables->alimentation;
    $alim->periode = 'semaine';
    $alim->details = [
        (object)['id' => 1, 'nom' => 'L7m',   'montant' => 150,  'periode' => 'semaine'],
        (object)['id' => 2, 'nom' => 'Psy',   'montant' => 400,  'periode' => 'quinzaine'],
        (object)['id' => 3, 'nom' => 'Hri',   'montant' => 1000, 'periode' => 'cycle'],
        (object)['id' => 4, 'nom' => 'khdra', 'montant' => 100],                         // hérite : / sem
    ];
    $alim->exceptions = [];
    return $fd;
}

echo "\n  RYTHMES PAR LIGNE (serveur)\n  " . str_repeat('─', 66) . "\n";
$fd = etat();
$jdp = cfo_jour_de_paie($fd);
$alim = $fd->donneesAnnuelles->{'2026'}->chargesVariables->alimentation;
v('une ligne sans rythme hérite de sa catégorie (« semaine »)', 'semaine', cfo_periode_detail($alim->details[3], $alim));
$fact = $fd->donneesAnnuelles->{'2026'}->chargesVariables->factures;
v('  → et d\'une catégorie « mois » : « cycle »', 'cycle', cfo_periode_detail(($fact->details ?? [(object)[]])[0], $fact));
$couts = []; $attendus = [];
for ($m = 1; $m <= 12; $m++) { $n = jeudis($m, 2026, $jdp); $couts[] = cfo_cout_variable_cycle($alim, $m, 2026, $jdp); $attendus[] = (float)(250 * $n + 400 * $n / 2 + 1000); }
v('coût du cycle = (150 + 100) × N + 400 × N/2 + 1 000, mois par mois', $attendus, $couts);

//  Le net mensuel de secours : référence = la même fixture où Alimentation devient
//  « / mois » sans ligne, avec pour chaque mois une exception = son coût calculé à la main.
$net = cfo_compute_monthly_net_courant($fd, 2026);
$ref = etat(); $ra = $ref->donneesAnnuelles->{'2026'}->chargesVariables->alimentation;
$ra->periode = 'mois'; $ra->details = []; $ra->exceptions = [];
for ($m = 1; $m <= 12; $m++) $ra->exceptions[] = (object)['moisDebut' => $m, 'moisFin' => $m, 'nouvelleValeur' => $attendus[$m - 1]];
$attenduNet = cfo_compute_monthly_net_courant($ref, 2026);
v('net mensuel de secours = coût ligne par ligne, chaque mois', array_map(fn($x) => $x['net'], $attenduNet), array_map(fn($x) => $x['net'], $net));

//  La valeur résumée : l'équivalent hebdomadaire sur une année réelle
$nMoy = cfo_semaines_annee(2026, $jdp) / 12;
$eq = (float)round((150 * $nMoy + 400 * $nMoy / 2 + 1000 + 100 * $nMoy) / $nMoy);
v('valeur résumée (rythmes mêlés) = équivalent / sem sur l\'année, arrondi', $eq, cfo_valeur_equivalente($alim, 2026, $jdp));
$uni = (object)['periode' => 'semaine', 'details' => [(object)['montant' => 600], (object)['montant' => 400.5]]];
v('  → rythmes uniformes : la somme brute, exactement comme avant', 1000.5, cfo_valeur_equivalente($uni, 2026, $jdp));

//  Le CFO change le total d'Alimentation : chaque ligne suit le même ratio, garde son rythme
$fd = etat();
$alim = $fd->donneesAnnuelles->{'2026'}->chargesVariables->alimentation;
$avant = cfo_valeur_equivalente($alim, 2026, $jdp);
$r = cfo_compile(json_decode('[{"function":"update_variable_expense","args":{"name":"Alimentation","amount":' . (2 * $avant) . ',"years":[2026]}}]'), $fd, ['anneeContexte' => 2026]);
$alim = $fd->donneesAnnuelles->{'2026'}->chargesVariables->alimentation;
v('« Alimentation × 2 » par le CFO : écriture acceptée', 'ok', $r['status']);
v('  → chaque ligne doublée', [300, 800, 2000, 200], array_map(fn($d) => (int)$d->montant, $alim->details));
v('  → chaque ligne garde son rythme (khdra hérite toujours)', ['semaine', 'quinzaine', 'cycle', null], array_map(fn($d) => $d->periode ?? null, $alim->details));
v('  → la valeur résumée = le total demandé', (float)(2 * $avant), (float)$alim->valeur);

//  Une sous-ligne modifiée : la valeur résumée suit (équivalent, pas la somme brute)
$fd = etat();
$r = cfo_compile(json_decode('[{"function":"update_variable_expense","args":{"name":"Alimentation","amount":1200,"sub_target":"Hri","years":[2026]}}]'), $fd, ['anneeContexte' => 2026]);
$alim = $fd->donneesAnnuelles->{'2026'}->chargesVariables->alimentation;
$eq2 = (float)round((150 * $nMoy + 400 * $nMoy / 2 + 1200 + 100 * $nMoy) / $nMoy);
v('« Hri à 1 200 » : la ligne change, son rythme reste « cycle »', [1200, 'cycle'], [(int)$alim->details[2]->montant, $alim->details[2]->periode]);
v('  → valeur résumée = équivalent / sem (et non 150+400+1200+100)', $eq2, (float)$alim->valeur);

echo "  " . str_repeat('─', 66) . "\n";
printf("  %s — %d contrôle(s) en échec\n\n", $ko ? '❌ ÉCHEC' : '✅ TOUT PASSE', $ko);
exit($ko ? 1 : 0);
