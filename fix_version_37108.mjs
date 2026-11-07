/* v37.108 Le voyage à la saisie — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.107 La frise à portée de doigt";`, `const CURRENT_VERSION = "37.108 Le voyage à la saisie";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.107 La frise à portée de doigt", date: "2026-11-07", changes: [`,
`                    const CHANGELOG = [
        { version: "37.108 Le voyage à la saisie", date: "2026-11-07", changes: [
            "✈️ LE VOYAGE DÉCLARÉ A SA LIGNE — dans « ✈️ Voyage · absence » (Pilotage), une destination (et un budget, facultatif) avec les dates : la dépense exceptionnelle « Voyage Marrakech » est créée d'office dans le Flux, à la date du départ, avec sa catégorie. Elle suit les changements (destination, dates, budget) ; effacer le voyage la retire si rien n'y a été dépensé.",
            "🧳 À LA SAISIE, PENDANT LE VOYAGE — un rappel « ✈️ Vous êtes en voyage — Marrakech (du … au …) » et une case « Dépense du voyage » : cochée, la dépense va dans la ligne du voyage (catégorie et compte), sans règles ni IA ; décochée, le traitement normal. La case reste comme vous l'avez laissée d'une saisie à l'autre ; hors des dates, plus de rappel.",
            "🧠 Ce qui est rangé par la case « voyage » n'apprend rien : après le retour, « diesel » reste « diesel skoda ». Le budget du voyage se consomme au fur et à mesure (Relevé, frise).",
        ] },
        { version: "37.107 La frise à portée de doigt", date: "2026-11-07", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.108');
