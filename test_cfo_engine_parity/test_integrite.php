<?php
/**
 * v37.0 — INTÉGRITÉ DES DONNÉES ÉCRITES.
 *   Couvre la cause racine trouvée lors de ce chantier : cfo_sanitize_finance_data
 *   supprimait la clé `nom` de chaque ligne d'épargne, alors que c'est
 *   précisément celle que le template Vue affiche (index.html:2408 / 3569).
 *   Chaque commit du CFO vidait donc le champ « Nom de l'objectif » de toutes
 *   les lignes, de tous les exercices.
 */
require_once __DIR__ . '/../cfo_intent_engine.php';

$ko = 0;
function v($titre, $attendu, $obtenu, $detail = '') {
    global $ko; $ok = $attendu === $obtenu; if (!$ok) $ko++;
    printf("  %s %-56s %s\n", $ok ? '✅' : '❌', $titre, $ok ? '' : "attendu=" . json_encode($attendu, JSON_UNESCAPED_UNICODE) . " obtenu=" . json_encode($obtenu, JSON_UNESCAPED_UNICODE) . " $detail");
}
function etat() {
    $fd = json_decode(file_get_contents(__DIR__ . '/fixture.json'));
    $fd->comptes[] = (object)['id'=>9,'label'=>'Épargne Long Terme','type'=>'epargne','solde'=>0];
    $fd->donneesAnnuelles->{'2027'} = json_decode(json_encode($fd->donneesAnnuelles->{'2026'}));
    return $fd;
}

echo "\n  INTÉGRITÉ DES DONNÉES ÉCRITES\n";
echo "  " . str_repeat('─', 74) . "\n";

// 1. La clé affichée par l'interface survit au nettoyage d'état
$fd = etat();
$fd->donneesAnnuelles->{'2027'}->epargne = [
    (object)['id'=>1,'nom'=>'Mon virement','label'=>'Mon virement','valeur'=>7000,'exceptions'=>[]]];
cfo_sanitize_finance_data($fd);
$ep = $fd->donneesAnnuelles->{'2027'}->epargne[0];
v('épargne : la clé `nom` (affichée par Vue) survit au nettoyage', true, property_exists($ep, 'nom'));
v('  → et garde sa valeur', 'Mon virement', $ep->nom ?? null);
v('  → `label` reste synchronisé', 'Mon virement', $ep->label ?? null);

// 2. Les revenus/charges continuent de purger `nom` (leur interface lit `label`)
$fd = etat();
$rv = oget($fd->donneesAnnuelles->{'2027'}, 'revenus');
$k = okeys($rv)[0];
oset(oget($rv, $k), 'nom', 'synonyme parasite');
cfo_sanitize_finance_data($fd);
v('revenus : `nom` reste purgé (l\'interface y lit `label`)', false, property_exists(oget($rv, $k), 'nom'));

// 3. Auto-nommage contextuel à l'écriture
$fd = etat();
$fd->donneesAnnuelles->{'2027'}->epargne = [
    (object)['id'=>101,'nom'=>'','label'=>'','valeur'=>'4 000 DH','sourceCompte'=>'','linkedAccountId'=>9,'exceptions'=>null],
    (object)['id'=>102,'nom'=>'','label'=>'','valeur'=>-500,'sourceCompte'=>'cpt_999','linkedAccountId'=>777,'exceptions'=>[]]];
$r = cfo_compile(json_decode('[{"function":"update_fixed_expense","args":{"name":"Loyer","amount":4500,"year":2027}}]'), $fd, ['anneeContexte'=>2027]);
$e = $fd->donneesAnnuelles->{'2027'}->epargne;
v('libellé vide → nommé d\'après le compte de destination', 'Virement vers Épargne Long Terme', $e[0]->nom ?? null);
v('montant texte « 4 000 DH » → nombre', 4000.0, (float)($e[0]->valeur ?? -1));
v('compte source vide → courant', 'courant', $e[0]->sourceCompte ?? null);
v('exceptions null → tableau', true, is_array($e[0]->exceptions ?? null));
v('virement négatif → ramené à 0', 0.0, (float)($e[1]->valeur ?? -1));
// `?? ` confondrait une propriété absente et une propriété à null : on teste les deux.
v('compte lié inexistant → délié (propriété conservée)', true, property_exists($e[1], 'linkedAccountId'));
v('  → et mise à null', null, $e[1]->linkedAccountId);
v('compte source inexistant → courant', 'courant', $e[1]->sourceCompte ?? null);
v('corrections rapportées, jamais silencieuses', true, count($r['integrite_corrections'] ?? []) > 0);

// 4. Le scellé prime : un exercice non ciblé n'est pas « réparé » non plus
$fd = etat();
$fd->donneesAnnuelles->{'2026'}->epargne[] = (object)['id'=>55,'nom'=>'','label'=>'','valeur'=>3000,'exceptions'=>[]];
cfo_sanitize_finance_data($fd);                     // référence après nettoyage, comme le scellé
$av = md5((string)json_encode($fd->donneesAnnuelles->{'2026'}));
cfo_compile(json_decode('[{"function":"update_fixed_expense","args":{"name":"Loyer","amount":4600,"year":2027}}]'), $fd, ['anneeContexte'=>2027]);
v('exercice non ciblé : pas touché, même pour être réparé', $av, md5((string)json_encode($fd->donneesAnnuelles->{'2026'})));

echo "  " . str_repeat('─', 74) . "\n";
printf("  %s — %d contrôle(s) en échec\n\n", $ko ? '❌ ÉCHEC' : '✅ TOUT PASSE', $ko);
exit($ko ? 1 : 0);
