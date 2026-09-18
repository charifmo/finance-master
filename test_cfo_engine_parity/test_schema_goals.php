<?php
/**
 * v36.0 — Les deux schémas d'un Smart Goal ne doivent JAMAIS diverger.
 *   L'app lit en priorité les clés v19 (libelle/montant_cible/montant_actuel)
 *   et retombe sur le legacy (name/target/current). Si le moteur laisse les
 *   deux jeux désaccordés, l'écran affiche une valeur et la base en contient
 *   une autre. Ce test parcourt tous les chemins d'écriture d'objectif.
 */
require_once __DIR__ . '/../cfo_intent_engine.php';

$FIXTURE = __DIR__ . '/fixture.json';
$echecs = 0; $verifs = 0;

function verifier(string $cas, $fd) {
    global $echecs, $verifs;
    foreach ((oget($fd, 'wealthGoals') ?: []) as $i => $g) {
        // Un objectif que le moteur n'a pas touché reste au schéma legacy : normal.
        if (oget($g, 'libelle') === null && oget($g, 'montant_cible') === null) continue;
        $verifs++;
        $paires = [
            'libelle/name'            => [oget($g,'libelle'),        oget($g,'name')],
            'montant_cible/target'    => [oget($g,'montant_cible'),  oget($g,'target')],
            'montant_actuel/current'  => [oget($g,'montant_actuel'), oget($g,'current')],
        ];
        foreach ($paires as $quoi => $pq) {
            if ($pq[0] != $pq[1]) {
                printf("  ❌ %-42s objectif[%d] %s : %s != %s\n", $cas, $i, $quoi,
                       json_encode($pq[0]), json_encode($pq[1]));
                $echecs++;
            }
        }
        if (oget($g,'versement_mensuel') === null) {
            printf("  ❌ %-42s objectif[%d] versement_mensuel absent\n", $cas, $i); $echecs++;
        }
    }
}

$scenarios = [
    'create_smart_goal complet' => '[{"function":"create_smart_goal","args":{"name":"Retraite","target_amount":300000,"initial_funding":25000,"versement_mensuel":3000,"date_cible":"2035-06"}}]',
    'create_smart_goal minimal'  => '[{"function":"create_smart_goal","args":{"name":"Sabbatique","target_amount":80000}}]',
    'create sur objectif existant (dedup)' => '[{"function":"create_smart_goal","args":{"name":"Voyage Paris","target_amount":90000,"initial_funding":5000}}]',
    'add_funds_to_goal'          => '[{"function":"add_funds_to_goal","args":{"name":"Voyage Paris","amount":4000}}]',
    'add_funds + versement'      => '[{"function":"add_funds_to_goal","args":{"name":"Voyage Paris","amount":1000,"versement_mensuel":900}}]',
    'update_smart_goal cible'    => '[{"function":"update_smart_goal","args":{"name":"Voyage Paris","target_amount":120000}}]',
    'update_smart_goal versement'=> '[{"function":"update_smart_goal","args":{"name":"Voyage Paris","versement_mensuel":1750}}]',
    'update_smart_goal renommage'=> '[{"function":"update_smart_goal","args":{"name":"Voyage Paris","new_name":"Voyage Amsterdam"}}]',
    'update via alias francais'  => '[{"function":"update_smart_goal","args":{"objectif":"Voyage Paris","montant_cible":"150 000 DH","mensualite":"2 100"}}]',
];

echo "\n  COHÉRENCE DES DEUX SCHÉMAS D'OBJECTIF (v19 ↔ legacy)\n";
echo "  " . str_repeat('─', 72) . "\n";
foreach ($scenarios as $cas => $json) {
    $fd = json_decode(file_get_contents($FIXTURE));
    $r  = cfo_compile(json_decode($json), $fd, []);
    $st = $r['status'] ?? '?';
    if (!in_array($st, ['ok','partial_error'], true)) {
        printf("  ❌ %-42s status=%s %s\n", $cas, $st, json_encode($r['error'] ?? $r['clarifications_needed'] ?? null, JSON_UNESCAPED_UNICODE));
        $echecs++; continue;
    }
    verifier($cas, $fd);
    printf("  ✅ %-42s %s\n", $cas, $st);
}
echo "  " . str_repeat('─', 72) . "\n";
printf("  %d objectif(s) vérifié(s), %d écart(s) de schéma\n\n", $verifs, $echecs);
exit($echecs ? 1 : 0);
