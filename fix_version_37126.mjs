/* v37.126 La frise au téléphone — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.125 La veille qui se souvient";`, `const CURRENT_VERSION = "37.126 La frise au téléphone";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.125 La veille qui se souvient", date: "2026-11-09", changes: [`,
`                    const CHANGELOG = [
        { version: "37.126 La frise au téléphone", date: "2026-11-09", changes: [
            "📱 LA FRISE ADAPTÉE AU TÉLÉPHONE — chaque ligne sur deux étages : le nom ENTIER au-dessus (plus « Super marc… », « Medecin (re… »), les cases sur toute la largeur en dessous, un peu plus hautes et lisibles ; le nom de la catégorie et son total sur une ligne, sa jauge en dessous. Sur ordinateur, la présentation ne change pas.",
            "🟦 LA SEMAINE EN COURS SURLIGNÉE SUR TOUTE SA COLONNE — un fond bleuté translucide, de haut en bas de chaque catégorie (lignes « / sem » comme lignes « sur le cycle »), sur téléphone comme sur ordinateur ; sa case dans l'axe des semaines est encadrée.",
        ] },
        { version: "37.125 La veille qui se souvient", date: "2026-11-09", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.126');
