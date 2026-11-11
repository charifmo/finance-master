/* v37.127 Les sous-catégories sous leur catégorie — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.126 La frise au téléphone";`, `const CURRENT_VERSION = "37.127 Les sous-catégories à leur place";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.126 La frise au téléphone", date: "2026-11-09", changes: [`,
`                    const CHANGELOG = [
        { version: "37.127 Les sous-catégories à leur place", date: "2026-11-11", changes: [
            "🥩 « YA PAS L7M NI DJAJ NI AUCUNE SOUS-CATÉGORIE ! » (Pilotage mensuel, Alimentation dépliée) — les postes « / 15 j » et « / cycle » (lhrri, kfta+l7m+djaj, samak, Nuggets, djaj, Œufs…) n'étaient que dans un bloc « Sur tout le cycle » replié, tout en bas de la liste des catégories : on ne le voyait pas. Ils sont maintenant SOUS leur catégorie, juste sous les postes de la semaine, ouverts d'office, chacun avec son prévu, son avancement et sa case de saisie. Le bloc du bas disparaît ; replier se mémorise par catégorie.",
        ] },
        { version: "37.126 La frise au téléphone", date: "2026-11-09", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.127');
