<?php
/**
 * v37.8 — Moteur PHP : (1) un id de compte texte (acc_…) désigne bien un compte,
 *   (2) un objectif adossé à un compte ne se « crédite » pas à la main.
 *   Cas vécu : l'IA a porté l'objectif Lissage à 24 000 / 24 000 alors que son
 *   compte finissait l'année à 19 400 — puis a relu ce chiffre comme de l'argent.
 */
require_once __DIR__ . '/../cfo_intent_engine.php';

$ko = 0;
function v(string $t, bool $ok, string $d = '') { global $ko; if (!$ok) $ko++; printf("  %s %-60s %s\n", $ok ? '✅' : '❌', $t, $ok ? '' : $d); }

echo "\n  OBJECTIFS ADOSSÉS & CLÉS DE COMPTE (moteur PHP)\n  " . str_repeat('─', 72) . "\n";

$C = 'cpt_acc_x_cour'; $ids = ['acc_x_cour', 'acc_x_lt', '1778756866808'];
v('id texte sans préfixe → cpt_',       cfo_norm_key_c('acc_x_lt', $C, $ids) === 'cpt_acc_x_lt');
v('id du courant sans préfixe → courant', cfo_norm_key_c('acc_x_cour', $C, $ids) === $C);
v('id numérique → cpt_',                cfo_norm_key_c('1778756866808', $C, $ids) === 'cpt_1778756866808');
v("'courant' → courant",               cfo_norm_key_c('courant', $C, $ids) === $C);
v('clé préfixée inchangée',             cfo_norm_key_c('cpt_acc_x_lt', $C, $ids) === 'cpt_acc_x_lt');
v('épargne virtuelle inchangée',        cfo_norm_key_c('ep_42', $C, $ids) === 'ep_42');

// Objectif adossé au compte « Depenses Annuels » (id 7 dans la fixture)
$fx = json_decode(file_get_contents(__DIR__ . '/fixture.json'));
$fx->wealthGoals = [ (object)['libelle' => 'Lissage', 'name' => 'Lissage', 'montant_cible' => 24000, 'target' => 24000,
                              'montant_actuel' => 0, 'current' => 0, 'versement_mensuel' => 2000, 'comptesLies' => ['cpt_7']] ];

$fd = json_decode(json_encode($fx));
$r = cfo_compile(json_decode('[{"function":"add_funds_to_goal","args":{"name":"Lissage","amount":24000}}]'), $fd, []);
$g = $fd->wealthGoals[0];
v('add_funds sur objectif adossé : refusé', ($r['ops_summary']['errors'] ?? 0) >= 1, json_encode($r['ops_summary'] ?? $r['status'] ?? null));
v('  → montant déclaré inchangé', (float)($g->current ?? 0) == 0 && (float)($g->montant_actuel ?? 0) == 0);
$raison = json_encode($r['error_ops'] ?? [], JSON_UNESCAPED_UNICODE);
v('  → la raison nomme le compte et le bon geste', strpos($raison, 'Depenses Annuels') !== false && strpos($raison, 'adjust_account_balance') !== false, $raison);

$fd = json_decode(json_encode($fx));
$r = cfo_compile(json_decode('[{"function":"update_smart_goal","args":{"name":"Lissage","target_amount":30000}}]'), $fd, []);
v('changer la cible d\'un objectif adossé : autorisé', ($r['ops_summary']['success'] ?? 0) === 1 && (float)$fd->wealthGoals[0]->target == 30000,
  json_encode($r['ops_summary'] ?? null));

$fd = json_decode(json_encode($fx)); $fd->wealthGoals[0]->comptesLies = [];
$r = cfo_compile(json_decode('[{"function":"add_funds_to_goal","args":{"name":"Lissage","amount":5000}}]'), $fd, []);
v('objectif NON adossé : add_funds fonctionne comme avant', (float)$fd->wealthGoals[0]->current == 5000, json_encode($r['ops_summary'] ?? null));

echo $ko ? "\n  ❌ $ko contrôle(s) en échec\n" : "\n  ✅ TOUT PASSE — 0 contrôle(s) en échec\n";
exit($ko ? 1 : 0);
