/* v37.77 Lisible — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.76 Dictionnaire";`, `const CURRENT_VERSION = "37.77 Lisible";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.76 Dictionnaire", date: "2026-10-28", changes: [`,
`                    const CHANGELOG = [
        { version: "37.77 Lisible", date: "2026-10-29", changes: [
            "📅 LE RELEVÉ DONNE LA DATE — « Mettre les jours du mois au lieu des J-X. » Chaque ligne porte sa date : « lun. 30 nov. » au lieu de « j.30 ». Le mois vient du cycle de la ligne : un jour au moins égal au jour de paie appartient au mois précédent (le cycle de décembre court du 27 nov. au 26 déc.).",
            "❓ POURQUOI CE POINT BAS — « Pourquoi il me dit que le Courant sera négatif le 30 nov. ? » Sous chaque compte qui passe sous zéro (Sécurité des comptes, grande case des virements) : les sorties qui y mènent, depuis quand, les plus grosses, et les prochaines entrées qui le font remonter. Le cas rapporté : la paie du 27 nov. ouvre le cycle de décembre, dont les budgets de la semaine sont pris sur le Courant dès le 27 et le 30 nov., alors que ses entrées (loyers, CNSS) n'arrivent que les 5 et 6 déc. — le salaire, lui, tombe sur un autre compte. Un virement à la paie depuis ce compte l'évite.",
            "🧮 LE GROS CHIFFRE, EXPLIQUÉ — « Comment rendre le 14 k plus compréhensible ? » Sous le Reste à dépenser, le calcul en clair : le budget conso du cycle moins ce qui est déjà dépensé ; et quand il est plafonné, les deux montants et le plus petit retenu — ce que le compte peut réellement payer d'ici la paie, factures et charges déduites.",
            "⚠️ OÙ L'ON A DÉPASSÉ — « Voir où sont les alertes, dans quelles cases j'ai dépassé. » Les dépassements du cycle (les mêmes que « À surveiller » de la frise) s'affichent dans la Météo, avec « voir dans la frise » ; au téléphone, leur nombre est sur le bouton de la frise.",
            "🔎 LE ZOOM — un compte de « Vos comptes » se clique : son Relevé s'ouvre, ligne à ligne, filtré sur lui.",
            "PREUVE — nouvelle suite « Le cycle se lit comme le Relevé » : dates (bascule au jour de paie, fin de mois, changement d'année), Relevé daté, pourquoi d'un point bas (radar et grande case), dépassements dans la Météo et ouverture de la frise, zoom vers le Relevé. Rejouée sur la v37.76 : en échec ; défauts réintroduits exprès : attrapés.",
        ] },
        { version: "37.76 Dictionnaire", date: "2026-10-28", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.77 Lisible');
