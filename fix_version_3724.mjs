/* v37.24 Une-Seule-Saisie — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.23 Reste-a-Depenser";`, `const CURRENT_VERSION = "37.24 Une-Seule-Saisie";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.23 Reste-a-Depenser", date: "2026-10-06", changes: [`,
`                    const CHANGELOG = [
        { version: "37.24 Une-Seule-Saisie", date: "2026-10-06", changes: [
            "UN SEUL ENDROIT POUR REGARDER ET AGIR — la v37.23 laissait deux saisies de la conso sur la même page : l'ancien bloc « Réalisé à T0 — conso engagée » et le panneau de la Météo. Le bloc a quitté la page ; la carte « 💸 Reste à dépenser » l'absorbe.",
            "TAPER SUR LA LIGNE — chaque catégorie de la carte porte son champ « ✍️ Déjà dépensé » : on clique sur la ligne « Alimentation », on tape 1500, le grand chiffre et le rythme bougent en direct. Tant que rien n'est tapé, l'invite grisée montre ce qui compte (le total des tickets, ou ≈ l'estimation). Vider le champ rend la catégorie à l'estimation ; « ↩ tout effacer » remet le cycle à zéro.",
            "LES RAYONS X DEVIENNENT UN PUR AUDIT — survoler (ou toucher) le NOM d'une catégorie montre la liste de courses prévue, les tickets datés et ce qui a été retenu (total saisi ou tickets, le plus grand). Plus aucun champ dans le panneau.",
            "ⓘ COMMENT EST CALCULÉ CE CHIFFRE — l'ancienne bulle « Disponible réel » vit à côté du titre de la carte : 🅰️ budget du cycle − déjà dépensé − estimé = reste au budget ; 🅱️ solde + revenus à venir − charges à payer = cash ; le plus petit des deux, puis ÷ jours × 7.",
            "LE MODE VOYAGE RESTE — seul contenu de l'ancien bloc sans équivalent ailleurs : dates d'absence et catégories suspendues, dans un petit volet « ✈️ Voyage · absence », replié tant qu'aucun voyage ne touche le cycle. « ⚡ Depuis le réel » disparaît : les tickets comptent d'eux-mêmes depuis la v37.23.",
            "PREUVE — la suite « Reste à dépenser » (41 contrôles) vérifie : plus de bloc T0, un champ par ligne, saisie en direct sans panneau, panneau sans champ, calcul ⓘ terme à terme, Voyage intact, saisie au doigt sur S24+. Rejouée sur la v37.23 : échec ; deux défauts réintroduits exprès (saisie seulement à la sortie du champ, suspension Voyage perdue) sont attrapés.",
        ] },
        { version: "37.23 Reste-a-Depenser", date: "2026-10-06", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.24 Une-Seule-Saisie');
