<?php
/**
 * v37.72 — Moteur du CFO : UN VIREMENT À FAIRE SE PROGRAMME, IL NE CHANGE PAS LES SOLDES D'AUJOURD'HUI.
 *   Cas vécu : pour une alerte de découvert à venir, le CFO a modifié les soldes ACTUELS de deux comptes
 *   (adjust_account_balance ×2) — et depuis le mauvais compte. Aucun virement n'avait eu lieu à la banque.
 *   Décor fictif : Compte Courant, Compte Salaire (900), Réserve (901).
 */
require_once __DIR__ . '/../cfo_intent_engine.php';

$ko = 0;
function v(string $t, bool $ok, string $d = '') { global $ko; if (!$ok) $ko++; printf("  %s %-60s %s\n", $ok ? '✅' : '❌', $t, $ok ? '' : $d); }
echo "\n  UN VIREMENT À FAIRE SE PROGRAMME (moteur PHP)\n  " . str_repeat('─', 72) . "\n";

$base = json_encode([
    'soldesInitiaux' => ['anneeActuelle' => 2026, 'moisActuel' => 11, 'jourDePaie' => 27],
    'comptes' => [['id' => 'acc_cc', 'label' => 'Compte Courant', 'type' => 'liquide', 'solde' => 5000],
                  ['id' => 900, 'label' => 'Compte Salaire', 'type' => 'liquide', 'solde' => 3000],
                  ['id' => 901, 'label' => 'Réserve', 'type' => 'liquide', 'solde' => 8000]],
    'donneesAnnuelles' => ['2026' => ['revenus' => new stdClass, 'chargesFixes' => new stdClass, 'chargesVariables' => new stdClass, 'depensesIrregulieres' => [], 'epargne' => [], 'virementsInternes' => []]],
    'wealthGoals' => [], 'masterAssets' => [],
]);
$compiler = function (string $calls) use ($base) { $fd = json_decode($base); $r = cfo_compile(json_decode($calls), $fd, ['anneeContexte' => 2026]); return [$r, $fd]; };
$soldes = fn($fd) => array_map(fn($c) => (float)$c->solde, $fd->comptes);
$vir = fn($fd) => $fd->donneesAnnuelles->{'2026'}->virementsInternes;

// 1. adjust_account_balance sans « déjà fait en banque » : refusé, aucun solde ne bouge
[$r, $fd] = $compiler('[{"function":"adjust_account_balance","args":{"account":"Compte Courant","amount":-2000}},{"function":"adjust_account_balance","args":{"account":"Compte Salaire","amount":2000}}]');
$raison = json_encode($r['arguments_invalides'] ?? [], JSON_UNESCAPED_UNICODE);
v('1. deux adjust_account_balance sans deja_fait_en_banque : REFUSÉS', ($r['error'] ?? '') === 'ERROR_ARGUMENTS_INCOMPLETS' && $soldes($fd) === [5000.0, 3000.0, 8000.0], json_encode([$r['error'] ?? null, $soldes($fd)]));
v('  → le refus renvoie vers plan_transfer', strpos($raison, 'plan_transfer') !== false && strpos($raison, 'deja_fait_en_banque') !== false, $raison);
[$r, $fd] = $compiler('[{"function":"adjust_account_balance","args":{"account":"Compte Courant","amount":-2000,"deja_fait_en_banque":false}}]');
v('  → deja_fait_en_banque = false : refusé aussi', ($r['error'] ?? '') === 'ERROR_ARGUMENTS_INCOMPLETS' && $soldes($fd)[0] === 5000.0, json_encode($r['error'] ?? null));

// 2. Un virement DÉJÀ fait à la banque : accepté (deux appels, atomiques)
[$r, $fd] = $compiler('[{"function":"adjust_account_balance","args":{"account":"Compte Courant","amount":-2000,"deja_fait_en_banque":true}},{"function":"adjust_account_balance","args":{"account":"Compte Salaire","amount":2000,"deja_fait":"oui"}}]');
v('2. virement déjà fait (deja_fait_en_banque = true / « oui ») : soldes 3 000 et 5 000', ($r['ops_summary']['success'] ?? 0) === 2 && $soldes($fd) === [3000.0, 5000.0, 8000.0], json_encode([$r['ops_summary'] ?? $r, $soldes($fd)]));

// 3. plan_transfer : programmé à sa date, aucun solde touché
[$r, $fd] = $compiler('[{"function":"plan_transfer","args":{"from_account":"Réserve","to_account":"Compte Salaire","amount":7631,"month":11,"day":8}}]');
$v = $vir($fd);
v('3. plan_transfer Réserve → Compte Salaire 7 631 le 8 nov. : programmé dans virementsInternes',
  ($r['ops_summary']['success'] ?? 0) === 1 && count($v) === 1 && $v[0]->sourceCompte === 'cpt_901' && $v[0]->destinationCompte === 'cpt_900' && (float)$v[0]->montant === 7631.0 && $v[0]->mois === 11 && $v[0]->jourPrevu === 8, json_encode([$r['ops_summary'] ?? $r, $v]));
v('  → AUCUN solde modifié (les soldes restent ceux de la banque)', $soldes($fd) === [5000.0, 3000.0, 8000.0], json_encode($soldes($fd)));
$rel = json_encode($r['operations_appliquees'] ?? [], JSON_UNESCAPED_UNICODE);
v('  → le relevé dit « soldes_touches : false », de / vers en clair', strpos($rel, '"soldes_touches":false') !== false && strpos($rel, '"de":"Réserve"') !== false, $rel);

// 4. Virement permanent : plusieurs mois
[$r, $fd] = $compiler('[{"function":"plan_transfer","args":{"from_account":"Compte Salaire","to_account":"courant","amount":14100,"months":[11,12],"day":28}}]');
v('4. virement permanent (mois 11 et 12, le 28) : deux virements programmés vers le Courant',
  count($vir($fd)) === 2 && array_map(fn($x) => $x->mois, $vir($fd)) === [11, 12] && $vir($fd)[0]->destinationCompte === 'courant', json_encode($vir($fd)));   // v37.73 : le Courant s'écrit « courant » (clé de l'écran)

// 5. Garde-fous
[$r, $fd] = $compiler('[{"function":"plan_transfer","args":{"from_account":"Compte Courant","to_account":"Compte Courant","amount":500,"month":12}}]');
v('5. même compte au départ et à l\'arrivée : refusé', ($r['ops_summary']['errors'] ?? 0) === 1 && count($vir($fd)) === 0, json_encode($r['ops_summary'] ?? $r));
[$r, $fd] = $compiler('[{"function":"plan_transfer","args":{"from_account":"Réserve","to_account":"Compte Salaire","amount":0,"month":12}}]');
v('  → montant nul : refusé, rien de programmé', ($r['status'] ?? '') === 'error' && count($vir($fd)) === 0, json_encode([$r['error'] ?? null, $r['ops_summary'] ?? null]));

// 6. Le catalogue dit au modèle comment faire
$cat = json_encode(cfo_arg_spec()['adjust_account_balance'] + ['p' => cfo_arg_spec()['plan_transfer']], JSON_UNESCAPED_UNICODE);
v('6. le catalogue : adjust « UNIQUEMENT … DÉJÀ FAITE », plan_transfer « AUCUN solde n\'est modifié »',
  strpos($cat, 'UNIQUEMENT pour une opération DÉJÀ FAITE') !== false && strpos($cat, "AUCUN solde n'est modifié") !== false && in_array('plan_transfer', cfo_catalog_names(), true));

echo $ko === 0 ? "\n  ✅ TOUT PASSE — 0 contrôle(s) en échec\n" : "\n  ❌ $ko contrôle(s) en échec\n";
exit($ko === 0 ? 0 : 1);
