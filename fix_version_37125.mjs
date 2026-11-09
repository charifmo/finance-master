/* v37.125 La veille qui se souvient — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.124 Le menu au premier plan";`, `const CURRENT_VERSION = "37.125 La veille qui se souvient";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.124 Le menu au premier plan", date: "2026-11-09", changes: [`,
`                    const CHANGELOG = [
        { version: "37.125 La veille qui se souvient", date: "2026-11-09", changes: [
            "🎯 « IL FAUT CHAMBOULER : IL N'A PAS TROUVÉ L'ARTICLE DU 360 ! » — une requête « Marrakech (A OR B OR C…) » ne remonte que les premiers résultats du mélange, différents d'une fois à l'autre. Chaque grand projet a maintenant SA requête, sur les 6 derniers mois : « \\"Grand Stade\\" Marrakech », « \\"Mondial 2030\\" Marrakech », « \\"plan de mobilité\\" Marrakech », LGV, contournement… (en arabe aussi).",
            "🧠 LA MÉMOIRE DE LA VEILLE — un article retenu une fois pour un bien est gardé 180 jours et revient aux recherches suivantes, même si les moteurs ne le rendent plus : la veille s'enrichit au lieu de repartir de zéro. La carte dit « 🧠 mémoire de la veille : N articles déjà trouvés pour ce bien » ; l'IA voit « (déjà trouvé le …) ».",
            "📌 Consigne de l'IA : CHAQUE article noté 3/3 doit apparaître dans « Ce qui bouge », avec sa date et son numéro — aucun ne manque.",
        ] },
        { version: "37.124 Le menu au premier plan", date: "2026-11-09", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.125');
