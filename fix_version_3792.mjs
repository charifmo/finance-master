/* v37.92 Nettoyage avant calcul — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.91 Épargne avec réserve";`, `const CURRENT_VERSION = "37.92 Nettoyage avant calcul";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.91 Épargne avec réserve", date: "2026-11-02", changes: [`,
`                    const CHANGELOG = [
        { version: "37.92 Nettoyage avant calcul", date: "2026-11-02", changes: [
            "🧹 « EST-CE QUE L'APPLI SUPPRIME L'EXISTANT AVANT DE METTRE À JOUR ? JE NE VEUX PAS DE RÉSIDUS DES CALCULS PASSÉS. » — « Alimenter le Courant » retirait déjà les virements salaire ↔ Courant des cycles recalculés. Il retire désormais aussi ceux posés fin décembre pour le cycle de janvier SUIVANT quand l'année suivante n'existe pas encore (les 9 100 → Courant et 6 000 → Assafa du 28 décembre : un aller-retour d'anciens calculs). Relancé, il remplace ses propres virements sans les garder comme « anciens » : « Annuler » ramène à l'état d'avant le PREMIER calcul. Le fil du CFO dit combien d'anciens virements ont été retirés avant de poser les nouveaux.",
            "PREUVE — la suite « Le Courant alimenté au juste besoin » : 13 anciens virements retirés (dont le résidu du 28 décembre), relancé sans doublon, Annuler après deux calculs revient aux 14 virements d'origine. Rejouée sur la v37.91 : en échec.",
        ] },
        { version: "37.91 Épargne avec réserve", date: "2026-11-02", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.92');
