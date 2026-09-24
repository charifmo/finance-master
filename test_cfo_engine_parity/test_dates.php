<?php
/**
 * v37.5 — DATE CIBLE : convertir, jamais ignorer en silence.
 *   Régression observée deux fois en production. « met une date cible pr chaque
 *   objectif » ne renvoyait AUCUNE réponse : la v36.0 n'acceptait que le format
 *   AAAA-MM et rejetait « 2027-12-31 » sans rien dire. Le champ disparaissait,
 *   l'opération échouait faute de champ modifiable, et le message réclamait…
 *   date_cible. Le modèle reessayait en boucle jusqu'à épuiser ses itérations,
 *   et l'agent mourait sans produire de sortie.
 */
require_once __DIR__ . '/../cfo_intent_engine.php';

$ko = 0;
function v($titre, $attendu, $obtenu) {
    global $ko; $ok = $attendu === $obtenu; if (!$ok) $ko++;
    printf("  %s %-40s %s\n", $ok ? '✅' : '❌', $titre, $ok ? '' : "attendu=" . json_encode($attendu) . " obtenu=" . json_encode($obtenu));
}
function etat() {
    $fd = json_decode(file_get_contents(__DIR__ . '/fixture.json'));
    $fd->wealthGoals = [(object)['name'=>'Épargne Long Terme','libelle'=>'Épargne Long Terme',
                                 'target'=>84000,'current'=>0,'versement_mensuel'=>7000]];
    cfo_sanitize_finance_data($fd);
    return $fd;
}

echo "\n  CONVERSION DES DATES CIBLES\n  " . str_repeat('─', 66) . "\n";
foreach ([
    '2027-12' => '2027-12', '2027-12-31' => '2027-12', '2027-12-31T00:00:00' => '2027-12',
    '31/12/2027' => '2027-12', '12/2027' => '2027-12', '2027/03/15' => '2027-03',
    'décembre 2027' => '2027-12', 'Décembre 2027' => '2027-12', 'dec 2027' => '2027-12',
    'December 2027' => '2027-12', 'janvier 2028' => '2028-01', '2027-1' => '2027-01',
    'fin 2027' => '2027-12', '2027' => '2027-12',
] as $entree => $attendu) {
    v('« ' . $entree . ' »', $attendu, cfo_coerce_mois($entree));
}

echo "\n  REFUS EXPLICITES (jamais silencieux)\n  " . str_repeat('─', 66) . "\n";
foreach (['la semaine prochaine', 'abc', '', '2027-13', '1800-05', '9999-99'] as $mauvais) {
    v('« ' . $mauvais .' » refusé', null, cfo_coerce_mois($mauvais));
}

echo "\n  BOUT EN BOUT — le scénario exact de la panne\n  " . str_repeat('─', 66) . "\n";
$fd = etat();
$r = cfo_compile(json_decode('[{"function":"update_smart_goal","args":{"name":"Épargne Long Terme","date_cible":"2027-12-31"}}]'), $fd, ['anneeContexte'=>2027]);
v('update_smart_goal avec « 2027-12-31 »', 'ok', $r['status']);
v('  → date écrite au format de l\'app', '2027-12', oget($fd->wealthGoals[0], 'date_cible'));
v('  → conversion rapportée', true, strpos(json_encode($r['arguments_normalises'] ?? [], JSON_UNESCAPED_UNICODE), '2027-12') !== false);

// Date illisible : refus NOMMANT le champ, pour que le modèle corrige en un tour
$fd = etat(); $avant = md5((string)json_encode($fd));
$r = cfo_compile(json_decode('[{"function":"update_smart_goal","args":{"name":"Épargne Long Terme","date_cible":"la semaine prochaine"}}]'), $fd, []);
v('date illisible → refus explicite', 'ERROR_ARGUMENTS_INCOMPLETS', $r['error'] ?? null);
$msg = json_encode($r['arguments_invalides'] ?? [], JSON_UNESCAPED_UNICODE);
v('  → le message NOMME date_cible', true, strpos($msg, 'date_cible') !== false);
v('  → il donne les formats acceptés', true, strpos($msg, 'AAAA-MM') !== false);
v('  → aucune écriture', $avant, md5((string)json_encode($fd)));

// Le cas qui faisait boucler : date seule, sur plusieurs objectifs
$fd = etat();
$fd->wealthGoals[] = (object)['name'=>"Fonds d'urgence",'libelle'=>"Fonds d'urgence",'target'=>50000,'current'=>17749,'versement_mensuel'=>4000];
$r = cfo_compile(json_decode('[
  {"function":"update_smart_goal","args":{"name":"Épargne Long Terme","date_cible":"2027-12-31"}},
  {"function":"update_smart_goal","args":{"name":"Fonds d\'urgence","date_cible":"septembre 2027"}}]'), $fd, ['anneeContexte'=>2027]);
v('« une date cible par objectif » (2 appels)', 'ok', $r['status']);
v('  → objectif 1', '2027-12', oget($fd->wealthGoals[0], 'date_cible'));
v('  → objectif 2', '2027-09', oget($fd->wealthGoals[1], 'date_cible'));

echo "  " . str_repeat('─', 66) . "\n";
printf("  %s — %d contrôle(s) en échec\n\n", $ko ? '❌ ÉCHEC' : '✅ TOUT PASSE', $ko);
exit($ko ? 1 : 0);
