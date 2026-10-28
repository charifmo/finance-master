<?php
/**
 * v37.70 — Moteur du CFO : UNE ÉPARGNE VA TOUJOURS SUR UN VRAI COMPTE.
 *   Cas vécu : pour faire partir les épargnes du compte du salaire, elles ont été recréées sans
 *   compte de destination — des poches fantômes (« Urgence ») à côté des vrais comptes.
 *   Décor fictif : Compte Courant, Compte Salaire (900), Compte urgence (901), Épargne Long Terme.
 */
require_once __DIR__ . '/../cfo_intent_engine.php';

$ko = 0;
function v(string $t, bool $ok, string $d = '') { global $ko; if (!$ok) $ko++; printf("  %s %-60s %s\n", $ok ? '✅' : '❌', $t, $ok ? '' : $d); }
echo "\n  UNE ÉPARGNE VA TOUJOURS SUR UN VRAI COMPTE (moteur PHP)\n  " . str_repeat('─', 72) . "\n";

$base = json_encode([
    'soldesInitiaux' => ['anneeActuelle' => 2026, 'moisActuel' => 11, 'jourDePaie' => 27],
    'comptes' => [['id' => 'acc_cc', 'label' => 'Compte Courant', 'type' => 'liquide', 'solde' => 1000],
                  ['id' => 900, 'label' => 'Compte Salaire', 'type' => 'liquide', 'solde' => 1000],
                  ['id' => 901, 'label' => 'Compte urgence', 'type' => 'liquide', 'solde' => 0],
                  ['id' => 'acc_lt', 'label' => 'Épargne Long Terme', 'type' => 'epargne', 'solde' => 0]],
    'donneesAnnuelles' => ['2026' => ['revenus' => new stdClass, 'chargesFixes' => new stdClass, 'chargesVariables' => new stdClass, 'depensesIrregulieres' => [],
        'epargne' => [['id' => 1, 'nom' => 'Urgence', 'label' => 'Urgence', 'valeur' => 1000, 'sourceCompte' => 'courant', 'linkedAccountId' => 901, 'exceptions' => [['id' => 5, 'moisDebut' => 12, 'moisFin' => 12, 'nouvelleValeur' => 0]]],
                      ['id' => 2, 'nom' => 'Long Terme', 'label' => 'Long Terme', 'valeur' => 500, 'sourceCompte' => 'courant', 'linkedAccountId' => null, 'exceptions' => []]]]],
    'wealthGoals' => [], 'masterAssets' => [],
]);
$compiler = function (string $calls) use ($base) { $fd = json_decode($base); $r = cfo_compile(json_decode($calls), $fd, ['anneeContexte' => 2026]); return [$r, $fd]; };
$ep = fn($fd) => $fd->donneesAnnuelles->{'2026'}->epargne;
$trouve = fn($fd, $nom) => array_values(array_filter($ep($fd), fn($e) => $e->nom === $nom))[0] ?? null;

// 1. Sans destination, aucun compte ne correspond : refusé, rien n'est créé
[$r, $fd] = $compiler('[{"function":"set_recurring_savings","args":{"name":"Voyage Japon","fixed_amount":800,"source_account":"Compte Salaire"}}]');
$raison = json_encode($r['error_ops'] ?? [], JSON_UNESCAPED_UNICODE);
v('1. « Voyage Japon » sans destination ni compte du même nom : REFUSÉ', ($r['ops_summary']['errors'] ?? 0) >= 1 && $trouve($fd, 'Voyage Japon') === null, json_encode($r['ops_summary'] ?? $r));
v('  → la raison demande destination_account (le compte qui reçoit)', strpos($raison, 'destination_account') !== false && strpos($raison, 'poche fantôme') !== false, $raison);

// 2. Sans destination, mais le nom désigne un seul compte : déduit
[$r, $fd] = $compiler('[{"function":"set_recurring_savings","args":{"name":"Epargne urgence","fixed_amount":2000,"source_account":"Compte Salaire"}}]');
$e = $trouve($fd, 'Epargne urgence');
v('2. « Epargne urgence » depuis le Compte Salaire : destination déduite = Compte urgence', $e !== null && (string)$e->linkedAccountId === '901' && $e->sourceCompte === 'cpt_900', json_encode($e));

// 3. Destination donnée en toutes lettres (approximative)
[$r, $fd] = $compiler('[{"function":"set_recurring_savings","args":{"name":"Retraite","fixed_amount":700,"destination_account":"long terme"}}]');
$e = $trouve($fd, 'Retraite');
v('3. destination_account « long terme » → Épargne Long Terme (id texte gardé)', $e !== null && $e->linkedAccountId === 'acc_lt', json_encode($e));

// 4. Changer la source SUR PLACE : même id, exceptions et destination gardées, sans montant
[$r, $fd] = $compiler('[{"function":"update_recurring_savings","args":{"name":"Urgence","source_account":"Compte Salaire"}}]');
$e = $trouve($fd, 'Urgence');
v('4. update_recurring_savings « Urgence » → source Compte Salaire, sans montant : accepté', ($r['ops_summary']['success'] ?? 0) === 1, json_encode($r['ops_summary'] ?? $r));
v('  → même ligne (id 1), même destination (901), même exception, même montant',
  $e && (int)$e->id === 1 && $e->sourceCompte === 'cpt_900' && (string)$e->linkedAccountId === '901' && count($e->exceptions) === 1 && (float)$e->valeur === 1000.0 && count($ep($fd)) === 2, json_encode($e));

// 5. Une ligne sans destination est rattachée dès qu'on la touche
[$r, $fd] = $compiler('[{"function":"update_recurring_savings","args":{"name":"Long Terme","amount":600}}]');
$e = $trouve($fd, 'Long Terme');
v('5. « Long Terme » (sans destination) modifiée : rattachée à Épargne Long Terme', $e && $e->linkedAccountId === 'acc_lt' && (float)$e->valeur === 600.0, json_encode($e));

// 6. Destination = source : refusé
[$r, $fd] = $compiler('[{"function":"update_recurring_savings","args":{"name":"Urgence","destination_account":"Compte Courant"}}]');
v('6. destination = source (Compte Courant → Compte Courant) : refusé', ($r['ops_summary']['errors'] ?? 0) >= 1 && (string)$trouve($fd, 'Urgence')->linkedAccountId === '901', json_encode($r['ops_summary'] ?? $r));

// 7. Le catalogue dit au modèle comment faire
$cat = json_encode(cfo_arg_spec(), JSON_UNESCAPED_UNICODE);
v('7. le catalogue : destination_account (set et update), « ne supprime pas la ligne pour la recréer »',
  substr_count($cat, '"destination_account"') >= 2 && strpos($cat, 'ne supprime pas la ligne pour la recréer') !== false);

echo $ko === 0 ? "\n  ✅ TOUT PASSE — 0 contrôle(s) en échec\n" : "\n  ❌ $ko contrôle(s) en échec\n";
exit($ko === 0 ? 0 : 1);
