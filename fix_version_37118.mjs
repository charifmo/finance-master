/* v37.118 Du voyage au Flux — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.117 Un seul voyage, son budget";`, `const CURRENT_VERSION = "37.118 Du voyage au Flux";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.117 Un seul voyage, son budget", date: "2026-11-08", changes: [`,
`                    const CHANGELOG = [
        { version: "37.118 Du voyage au Flux", date: "2026-11-08", changes: [
            "⚡ « VOIR DANS LE FLUX → » — dans le bloc « Voyage · absence », un bouton ouvre le Flux (Prévisionnel) directement sur la ligne « Voyage … » : son mois est déplié, la ligne surlignée. Sur téléphone, l'onglet Flux s'ouvre au même endroit.",
        ] },
        { version: "37.117 Un seul voyage, son budget", date: "2026-11-08", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.118');
