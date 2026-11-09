/* v37.121 La zone dans toute la presse — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.120 Ajouter depuis la frise";`, `const CURRENT_VERSION = "37.121 La zone dans toute la presse";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.120 Ajouter depuis la frise", date: "2026-11-09", changes: [`,
`                    const CHANGELOG = [
        { version: "37.121 La zone dans toute la presse", date: "2026-11-09", changes: [
            "🏟️ « POURQUOI IL NE TROUVE PAS LE360 : MONDIAL 2030, 7,5 MILLIARDS POUR LES ACCÈS AUX STADES DE MARRAKECH ? » — la zone n'était cherchée que dans la presse marrakchie ; la presse nationale seulement avec le nom exact du lieu. Les catalyseurs du bien (Grand Stade, LGV, contournement…) sont maintenant cherchés avec « Marrakech » dans TOUTE la presse (Google FR et AR, Bing), avec leurs synonymes : Grand Stade ↔ Mondial 2030 ↔ stades, LGV ↔ grande vitesse, contournement ↔ rocade.",
            "🚌 « ET CET ARTICLE ? » (Le Desk : le plan de mobilité du Grand Marrakech) — les grands projets de la zone sont cherchés à chaque fois, même si la fiche du bien n'en parle pas : plan de mobilité, PMUD, Grand Marrakech, Marrakech Mobility, projets structurants, Mondial 2030, tramway, BHNS (réglables dans veille_sources.json).",
            "📰 Jusqu'à 20 articles, dont 6 places GARDÉES pour ces articles de contexte : ceux qui nomment le lieu ne prennent plus toutes les places. Ils sont marqués « (contexte zone) » pour l'IA, qui doit dire ce que chacun change pour CE bien.",
        ] },
        { version: "37.120 Ajouter depuis la frise", date: "2026-11-09", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.121');
