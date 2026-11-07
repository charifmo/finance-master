/* v37.106 La saisie apprend — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.105 Le compte suit la catégorie";`, `const CURRENT_VERSION = "37.106 La saisie apprend";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.105 Le compte suit la catégorie", date: "2026-11-07", changes: [`,
`                    const CHANGELOG = [
        { version: "37.106 La saisie apprend", date: "2026-11-07", changes: [
            "⚡ VOS HABITUDES EN UN APPUI — champ de saisie vide : vos saisies les plus fréquentes et récentes (celles du même jour de la semaine devant), avec leur montant habituel (« diesel skoda · 300 DH »). Un appui remplit tout — la catégorie et le compte suivent —, Entrée et c'est enregistré.",
            "⌨️ L'AUTOCOMPLÉTION — dès 2 lettres (« voy »), vos libellés passés : « Voyage marrakech station service · 60 DH ». Un appui complète, en gardant le montant déjà tapé. Accents et majuscules ne comptent pas.",
            "💡 LE MONTANT HABITUEL — un libellé connu tapé sans montant : « 💡 25 DH d'habitude », un appui le met.",
            "🧠 Tout s'apprend de vos saisies des 6 derniers mois (hors imports bancaires), au fur et à mesure : chaque saisie enrichit la suivante. L'interrupteur de l'apprentissage coupe aussi ces aides.",
        ] },
        { version: "37.105 Le compte suit la catégorie", date: "2026-11-07", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.106');
