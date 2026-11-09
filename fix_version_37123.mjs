/* v37.123 La presse revérifiée par l'IA — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.122 Toute la frise";`, `const CURRENT_VERSION = "37.123 La presse revérifiée par l'IA";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.122 Toute la frise", date: "2026-11-09", changes: [`,
`                    const CHANGELOG = [
        { version: "37.123 La presse revérifiée par l'IA", date: "2026-11-09", changes: [
            "🔎 « ÉLARGIR LES ARTICLES, PUIS LES REVÉRIFIER AVEC L'IA AVANT LE RÉSULTAT FINAL » — la Recherche Éclair ramasse maintenant jusqu'à 50 candidats (y compris des articles sur Marrakech sans mot-clé reconnu) ; un premier passage de l'IA note chacun de 0 à 3 pour CE bien, avec une raison (3 : nomme le bien ou un projet qui change son accès, son zonage, son prix ; 2 : projet majeur de la zone ; 1 : Marrakech en général ; 0 : hors sujet). Seuls les 2 et 3 (20 au plus, les mieux notés d'abord) vont à l'analyse finale, avec leur note.",
            "🤖 La carte le dit : « Vérifiés par l'IA : 42 articles trouvés → 17 gardés pour CE bien, 25 écartés » ; chaque article lu montre ses étoiles et la raison. L'IA de tri muette ou illisible : le tri habituel, et c'est dit.",
        ] },
        { version: "37.122 Toute la frise", date: "2026-11-09", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.123');
