/* v37.101 Un seul système — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.100 Frise → Journal";`, `const CURRENT_VERSION = "37.101 Un seul système";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.100 Frise → Journal", date: "2026-11-04", changes: [`,
`                    const CHANGELOG = [
        { version: "37.101 Un seul système", date: "2026-11-04", changes: [
            "🧩 MES APPLIS EN HAUT DU MENU — la rangée de vos applis (💰 Finance, 🩺 Santé, puis 🧠 Psy, ✈️ Voyage) est en haut du menu de gauche, la même dans chaque appli ; celle où vous êtes est entourée. Un toucher pour passer de l'une à l'autre.",
            "🩺 SANTÉ PREND L'HABILLAGE DE FINANCE (Santé 1.2) — le même menu vertical sombre à gauche, la même barre du haut, les mêmes boutons ; sur le téléphone, le menu s'ouvre avec ☰. Santé se met aussi à jour toute seule quand une nouvelle version est publiée.",
        ] },
        { version: "37.100 Frise → Journal", date: "2026-11-04", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.101');
