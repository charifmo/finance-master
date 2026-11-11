/* v37.128 Les quinzaines, case par case — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.127 Les sous-catégories à leur place";`, `const CURRENT_VERSION = "37.128 Les quinzaines, case par case";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.127 Les sous-catégories à leur place", date: "2026-11-11", changes: [`,
`                    const CHANGELOG = [
        { version: "37.128 Les quinzaines, case par case", date: "2026-11-11", changes: [
            "📅 « ON NE PEUT RENTRER LES CHARGES EN DEMI-CYCLE QU'EN TOTAL DU CYCLE » (Pilotage, Météo, sous chaque catégorie) — chaque poste « / 15 j » (Psy, djaj, samak…) a maintenant UNE CASE PAR QUINZAINE : « 1ʳᵉ quinzaine · 27 oct. → 9 nov. », « 2ᵉ quinzaine · 10 nov. → 26 nov. », la quinzaine en cours marquée ●. Chaque case se remplit depuis N'IMPORTE QUELLE semaine affichée (plus besoin de naviguer jusqu'à la bonne semaine) ; ✓ = payée au prévu en un geste, ✕ = vidée ; « +50 » / « -20 » corrigent. Un poste « / cycle » (Hri) a sa case « Tout le cycle ». La case montre la somme des semaines de sa quinzaine ; retaper un montant le remplace (il va dans une seule semaine de la quinzaine, celle qui le portait déjà, sinon la semaine affichée, sinon la première).",
            "🔍 « APPART AGADIR PAYÉ SUR RÉALISÉ, NON PAYÉ SUR LA FRISE — IL FAUT UN AUDIT POUR TOUT ALIGNER » — la frise ne lisait que les opérations du journal ; le Réalisé compte aussi la case cochée et le « + ajouter ». Désormais la frise prend LE MÊME chiffre que le Réalisé (le plus grand des deux) : dépenses exceptionnelles (Appart Aga, Nejar…), factures, et sous-catégories « / cycle » et « / 15 j ». Pour une sous-catégorie à la semaine cochée dans le Réalisé au-delà des semaines tapées, la frise l'affiche (« 🟣 Réalisé : 2 000 DH réglés — dont 400 DH cochés sans semaine ») et le met dans ses alertes.",
            "PREUVE — test_rythmes : une case par quinzaine (2 pour Psy, 1 pour Hri), 2ᵉ quinzaine tapée depuis la 1ʳᵉ semaine → 400 dans SA première semaine, ✓ au prévu, 200 + 150 déjà tapés → la case dit 350 et retaper 300 donne 300 (pas 650), ✕ vide, sur des cycles de 31 et 30 jours. test_depenses_exceptionnelles K2 : cochée sans opération 0 → 300 dans la frise, « + ajouter 45 » → 345 des deux côtés, décochée → 0. test_frise_cycle : Marjane, Hri et une facture cochés dans le Réalisé, alignés dans la frise.",
        ] },
        { version: "37.127 Les sous-catégories à leur place", date: "2026-11-11", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.128');
