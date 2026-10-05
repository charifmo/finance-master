/* v37.22 Liste-de-Courses — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.21 Rayons-X";`, `const CURRENT_VERSION = "37.22 Liste-de-Courses";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.21 Rayons-X", date: "2026-10-05", changes: [`,
`                    const CHANGELOG = [
        { version: "37.22 Liste-de-Courses", date: "2026-10-05", changes: [
            "🧾 LA LISTE DE COURSES DANS LES RAYONS X — survoler (ou toucher) « Alimentation » rappelle d'abord le budget PRÉVU, sous-catégorie par sous-catégorie : [🛍️ Hri : 800 DH] [🥩 L7m : 400 DH] [🧺 Marché : 350 DH]. Un « ticket » clair dans le panneau sombre, le plus gros poste d'abord ; au-delà de 8 postes, « +N » déplie. Puis, séparées par un pointillé, les « Dépenses réelles de la semaine ».",
            "CE QUI RESTE PAR POSTE — une dépense saisie sur une sous-catégorie (Saisie → catégorie « Hri ») remplit son étiquette : verte tant que le poste tient, rose au-delà ; l'achat porte le nom de son poste dans la liste. Les achats saisis sur la catégorie elle-même sont annoncés « non répartis » plutôt que de laisser croire qu'un poste est intact.",
            "LES CHIFFRES TOMBENT JUSTE — les postes viennent de la même ligne du Prévisionnel que l'enveloppe (même année budgétaire) : leur somme est le budget affiché, au dirham. Si une exception change le budget de ce mois, les postes sont ramenés à ce budget, et c'est écrit. Un emoji est déduit du nom (darija et français : l7m 🥩, djaj 🍗, khdra 🥬, 7lib 🥛, essence ⛽…), sinon 🏷️.",
            "PREUVE — la suite « Rayons X » gagne 13 contrôles : postes et emojis, Σ postes = budget, dépensé par poste + non réparti = total, bloc placé avant les dépenses réelles, remplissage de l'étiquette, repli « +N », exception du mois. Rejouée sur la v37.21 : échec ; trois défauts réintroduits exprès sont attrapés.",
        ] },
        { version: "37.21 Rayons-X", date: "2026-10-05", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.22 Liste-de-Courses');
