/* v37.36 Epargne-Du-Mois — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.35 Virements-Visibles";`, `const CURRENT_VERSION = "37.36 Epargne-Du-Mois";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.35 Virements-Visibles", date: "2026-10-09", changes: [`,
`                    const CHANGELOG = [
        { version: "37.36 Epargne-Du-Mois", date: "2026-10-09", changes: [
            "L'ÉPARGNE D'OCTOBRE N'EST PLUS À 0 — deux objectifs (2 000 + 5 000), une exception de novembre à décembre : la modale « Surplus Détaillé » affichait 0 pour octobre. Le repli sur le montant de base fonctionnait (rien coché : 7 000) ; le 0 venait des virements d'octobre déjà POINTÉS dans le Pilotage — la colonne ne montrait, pour le mois en cours, que l'épargne restant à verser, alors que le brut part du solde réel d'où l'épargne versée est déjà sortie. Elle montre désormais l'épargne DU MOIS (exception si une règle couvre le mois, sinon montant de base, par l'évaluateur unique), marquée ✓ pour la part déjà versée, avec une ligne d'explication ; le brut du mois en cours y remet l'épargne versée : Brut − Épargne = Net sur chaque ligne.",
            "LE NET NE CHANGE PAS — sauf une avance partielle sur un objectif, jusque-là retirée deux fois (sortie du solde réel, puis soustraite encore en entier).",
            "UN TRANSFERT N'EST PAS DE L'ÉPARGNE — le KPI « Épargne générée » ajoutait à l'épargne toute charge fixe dont le libellé contenait « virement » (heuristique ancienne), à sa valeur brute : une charge « Virement Assafa » de 1 500 gonflait l'épargne de 4 500 d'ici décembre. « virement » sort des mots-clés, et une charge d'épargne codée en charge fixe vaut sa valeur du mois (exceptions comprises).",
            "LES VIREMENTS INTERNES ONT LEUR TIROIR — dans la checklist, ils étaient rangés avec l'épargne (v37.35) et gonflaient la ligne « 💎 Épargne » de la Progression. Ils ont désormais leur nature, leur tiroir « 🔄 Virements internes » et leur badge « 🔄 Virement ».",
            "PREUVE — suite nouvelle « L'épargne du mois, même déjà versée » (20 contrôles, montants à la main) : base hors exception (octobre, 2027), exception (novembre, décembre), KPI, Relevé, versée en entier (net inchangé, ✓), avance partielle, charge « Virement Assafa », charge d'épargne suspendue, virement interne. Rejouée sur la v37.35, elle retrouve le 0 d'octobre, l'avance retirée deux fois et le virement compté en épargne. Onze défauts réintroduits exprès : tous attrapés.",
        ] },
        { version: "37.35 Virements-Visibles", date: "2026-10-09", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.36 Epargne-Du-Mois');
