<?php
/**
 * v36.0 — DISCIPLINE DE RÉSOLUTION, TOUTES POCHES.
 *   Vérifie que comptes, objectifs, actifs et épargne obéissent aux mêmes
 *   règles : nom approximatif accepté, homonyme proche bloqué au lieu d'être
 *   tranché au hasard, cible introuvable refusée sans écriture, et cible
 *   résolue toujours rapportée.
 */
require_once __DIR__ . '/../cfo_intent_engine.php';

function etat() {
    $fd = json_decode(file_get_contents(__DIR__ . '/fixture.json'));
    $fd->donneesAnnuelles->{'2027'} = json_decode(json_encode($fd->donneesAnnuelles->{'2026'}));
    $fd->comptes[] = (object)['id'=>90,'label'=>"Fonds d'urgence",'type'=>'epargne','solde'=>1000];
    $fd->comptes[] = (object)['id'=>91,'label'=>'Bourse / CTO','type'=>'investissement','solde'=>5000];
    $fd->comptes[] = (object)['id'=>92,'label'=>'Livret A','type'=>'epargne','solde'=>100];
    $fd->comptes[] = (object)['id'=>93,'label'=>'Livret B','type'=>'epargne','solde'=>200];
    $fd->masterAssets[] = (object)['id'=>77,'name'=>'Local Bouskoura 2','value'=>500000];
    // Le nettoyage d'état s'exécute au début de CHAQUE compilation, y compris
    // celles qui finissent en clarification. Il est légitime et n'est jamais
    // persisté (une réponse sans _internal ne peut pas être enregistrée). On le
    // joue ici pour que « aucune écriture » porte sur les seules écritures métier.
    cfo_sanitize_finance_data($fd);
    return $fd;
}
$ko = 0;
function verdict($titre, $attendu, $obtenu, $detail = '') {
    global $ko;
    $ok = $attendu === $obtenu;
    if (!$ok) $ko++;
    printf("  %s %-52s %s\n", $ok ? '✅' : '❌', $titre, $ok ? '' : "attendu=$attendu obtenu=$obtenu $detail");
}
function run($calls, $fd) { return cfo_compile(json_decode($calls), $fd, ['anneeContexte'=>2027]); }

echo "\n  DISCIPLINE DE RÉSOLUTION — comptes / objectifs / actifs / épargne\n";
echo "  " . str_repeat('─', 78) . "\n";

// 1. Nom approximatif accepté, sur chaque poche
$fd = etat();
$r = run('[{"function":"adjust_account_balance","args":{"account":"CTO","amount":300}}]', $fd);
verdict('compte : "CTO" résolu', 'ok', $r['status']);
verdict('  → cible rapportée', 'Bourse / CTO', $r['resolutions'][0]['resolu'] ?? '?');

$fd = etat();
$r = run('[{"function":"add_funds_to_goal","args":{"name":"Voyage","amount":500}}]', $fd);
verdict('objectif : "Voyage" résolu', 'ok', $r['status']);

$fd = etat();
$r = run('[{"function":"update_asset_valuation","args":{"asset_name":"Foncier","new_value":700000}}]', $fd);
verdict('actif : "Foncier" résolu', 'ok', $r['status']);
verdict('  → cible rapportée', 'Foncier Nord', $r['resolutions'][0]['resolu'] ?? '?');

// 2. Correspondance EXACTE : elle doit l'emporter sur un sur-ensemble, sans
//    déclencher d'ambiguïté — « Local Bouskoura » désigne sans équivoque
//    l'actif de ce nom, même si « Local Bouskoura 2 » existe aussi.
$fd = etat();
$r = run('[{"function":"update_asset_valuation","args":{"asset_name":"Local Bouskoura","new_value":1234}}]', $fd);
verdict('actif : nom exact l\'emporte sur le sur-ensemble', 'Local Bouskoura', $r['resolutions'][0]['resolu'] ?? '?');
$touche = null;
foreach ($fd->masterAssets as $x) if (($x->name ?? '') === 'Local Bouskoura 2') $touche = $x->value ?? null;
verdict('  → l\'homonyme plus long n\'a pas bougé', 500000, (int)$touche);

// 2bis. Homonymes vraiment ex æquo → blocage, jamais un choix au hasard
$fd = etat();
$avant = md5((string)json_encode($fd));
$r = run('[{"function":"adjust_account_balance","args":{"account":"Livret","amount":100}}]', $fd);
verdict('compte ambigu "Livret" → bloqué', 'needs_clarification', $r['status']);
verdict('  → aucune écriture', $avant, md5((string)json_encode($fd)));
verdict('  → ambiguïté signalée', true, (bool)($r['clarifications_needed'][0]['ambiguous'] ?? false));

// 3. Cible introuvable → refus, zéro écriture, suggestions
foreach ([
    'compte'   => '[{"function":"adjust_account_balance","args":{"account":"Zzz","amount":10}}]',
    'objectif' => '[{"function":"add_funds_to_goal","args":{"name":"Zzz","amount":10}}]',
    'actif'    => '[{"function":"update_asset_valuation","args":{"asset_name":"Zzz","new_value":10}}]',
] as $poche => $json) {
    $fd = etat(); $avant = md5((string)json_encode($fd));
    $r = run($json, $fd);
    verdict("$poche introuvable → refus", 'needs_clarification', $r['status']);
    verdict("  → aucune écriture", $avant, md5((string)json_encode($fd)));
    $err = $r['clarifications_needed'][0]['error'] ?? '';
    verdict("  → suggère des cibles réelles", true, strpos($err, '"') !== false && strlen($err) > 30, $err);
}

// 4. Étanchéité : homonyme dans un autre exercice ne détourne plus rien
$fd = etat();
$fd->donneesAnnuelles->{'2026'}->epargne = [ (object)['id'=>111,'nom'=>'Long Terme','valeur'=>1000,'exceptions'=>[]] ];
$fd->donneesAnnuelles->{'2027'}->epargne = [ (object)['id'=>222,'nom'=>'Long Terme','valeur'=>2000,'exceptions'=>[]] ];
$r = run('[{"function":"update_recurring_savings","args":{"name":"Long Terme","amount":7000,"year":2027}}]', $fd);
verdict('épargne homonyme 2026/2027 → écrit en 2027', 'ok', $r['status']);
verdict('  → 2026 intact', 1000, (int)$fd->donneesAnnuelles->{'2026'}->epargne[0]->valeur);
verdict('  → 2027 modifié', 7000, (int)$fd->donneesAnnuelles->{'2027'}->epargne[0]->valeur);

// 5. Ligne absente de l'exercice visé mais présente ailleurs → message utile
$fd = etat();
$fd->donneesAnnuelles->{'2027'}->epargne = [];
$r = run('[{"function":"update_recurring_savings","args":{"name":"Fonds Urgence","amount":500,"year":2027}}]', $fd);
$msg = $r['clarifications_needed'][0]['error'] ?? '';
verdict('ligne absente de 2027 → refus explicite', 'needs_clarification', $r['status']);
verdict('  → message nomme l\'exercice qui la contient', true, strpos($msg, '2026') !== false, $msg);

echo "  " . str_repeat('─', 78) . "\n";
printf("  %s — %d contrôle(s) en échec\n\n", $ko ? '❌ ÉCHEC' : '✅ TOUT PASSE', $ko);
exit($ko ? 1 : 0);
