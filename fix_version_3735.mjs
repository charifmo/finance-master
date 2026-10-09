/* v37.35 Virements-Visibles — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.34 Pointage-Sans-Double";`, `const CURRENT_VERSION = "37.35 Virements-Visibles";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.34 Pointage-Sans-Double", date: "2026-10-09", changes: [`,
`                    const CHANGELOG = [
        { version: "37.35 Virements-Visibles", date: "2026-10-09", changes: [
            "LES VIREMENTS INTERNES BOUGENT LES SOLDES — le Calendrier pluriannuel les saisissait, mais le moteur du Relevé ne les lisait pas : 60 000 DH de l'Épargne Long Terme vers les Dépenses annuelles, en novembre, n'apparaissaient nulle part, et les Dépenses annuelles semblaient finir à découvert (le radar réclamait même un virement de sauvetage). Chaque virement du cycle génère désormais DEUX lignes, le même jour : « 🔄 Virement → Dépenses annuelles » en sortie sur la source, « 🔄 Virement reçu ← Épargne Long Terme » en entrée sur la destination. Relevé, atterrissage du cycle, radar jusqu'en décembre, Météo et KPI « Dépenses annuelles » en tiennent compte.",
            "LA RÈGLE DU CALENDRIER — un virement du mois M appartient au cycle M, comme un flux exceptionnel sans jour ; il se place le 20, et AVANT les dépenses du même jour : il finance ce qu'on paie avec.",
            "FAIT = PLUS PROJETÉ — chaque virement du cycle rejoint la checklist, tiroir « 💎 Épargne & virements » (« Virement Courant → Dépenses annuelles », badge « 🔄 Virement »). Coché, il est déjà dans les deux soldes : le Relevé ne le projette plus (même règle que les flux exceptionnels, v37.34).",
            "UN MOIS FERMÉ DIT CE QU'IL CONTIENT — l'en-tête d'un mois du Calendrier n'affichait que le total NET des flux exceptionnels, et seulement s'il était positif : un mois avec un seul virement, ou avec plus d'entrées que de sorties, restait muet. Il affiche désormais les sorties (« 7 150 DH », rouge), les entrées (« + 5 000 DH », vert) et les virements (« 🔄 1 Virement », montant au survol) — chacun seulement s'il existe.",
            "PREUVE — suite nouvelle « Les virements internes bougent les soldes » (19 contrôles, montants à la main) : octobre (deux jambes), novembre (60 000, avant l'assurance qu'ils financent), fin d'année, radar, KPI Dépenses annuelles, pointage, en-têtes d'octobre, novembre, décembre et d'un mois vide. Rejouée sur la v37.34, elle retrouve le virement absent et le faux découvert de − 5 150. Douze défauts réintroduits exprès : onze attrapés, le douzième ne change rien au résultat (le reste dû est déjà nul).",
        ] },
        { version: "37.34 Pointage-Sans-Double", date: "2026-10-09", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.35 Virements-Visibles');
