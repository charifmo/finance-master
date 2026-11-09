/* v37.124 Le menu au premier plan — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.123 La presse revérifiée par l'IA";`, `const CURRENT_VERSION = "37.124 Le menu au premier plan";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.123 La presse revérifiée par l'IA", date: "2026-11-09", changes: [`,
`                    const CHANGELOG = [
        { version: "37.124 Le menu au premier plan", date: "2026-11-09", changes: [
            "🏷️ « QUAND JE CLIQUE SUR LA CATÉGORIE, LE MENU NE SORT PAS » — dans le détail d'une case de la frise, le sélecteur de catégorie s'ouvrait DERRIÈRE le panneau. Il passe maintenant au premier plan, partout (frise, journal, saisie).",
        ] },
        { version: "37.123 La presse revérifiée par l'IA", date: "2026-11-09", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.124');
