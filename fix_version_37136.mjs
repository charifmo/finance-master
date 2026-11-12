/* v37.136 Une revue qui trie mieux — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.135 Les sources connues, reconnues";`, `const CURRENT_VERSION = "37.136 Une revue qui trie mieux";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.135 Les sources connues, reconnues", date: "2026-11-12", changes: [`,
`                    const CHANGELOG = [
        { version: "37.136 Une revue qui trie mieux", date: "2026-11-12", changes: [
            "📰 « LE RÉSULTAT EST NUL, POURQUOI ? » (Terrain Nord) — cinq défauts trouvés dans la revue, corrigés : (1) les pages de Marrakech Alaan donnaient des titres collés « 4 ديسمبر 2024بالفيديو.. titre…résumé… » et « sans date » : le titre est maintenant l'intertitre de la carte, le résumé son paragraphe, et la DATE écrite dans le texte est lue (mois arabes marocains et orientaux, français, chiffres) — un article de 2023 est donc reconnu comme vieux (au-delà de 2 ans : écarté) ; (2) l'IA donnait 3/3 à tout ce qui cite la commune (terrains de proximité, assainissement, session du conseil) : 3 exige maintenant un PROJET ou une DÉCISION qui touche la valeur foncière, citer la commune sans enjeu vaut 1, un article de plus de 18 mois vaut au plus 1, les doublons d'un même fait valent 1 — et l'IA connaît la date du jour ; (3) dix articles « Grand Stade · Mondial 2030 » prenaient dix places : une même histoire n'en prend plus qu'une (les échos passent après les autres sujets) ; (4) le bonus « presse locale » ne vaut plus que pour un article qui nomme le lieu — Le360 ou Le Desk ne perdent plus face aux échos locaux ; (5) un lien Google Actualités s'affiche avec le nom du journal (« 🔗 kech24.com »), plus « 🔗 news.google.com ».",
            "PREUVE — test_veille_presse.php (112) : dates écrites (« 4 ديسمبر 2024 », « 14 نونبر 2023 », « 1er mars 2026 », « 04/12/2024 », dates impossibles refusées), trois formes de cartes de Marrakech Alaan, six échos « Grand Stade » aux titres variés → l'article du Le360 (7,5 MMDH, accès aux stades) et le plan de mobilité du Desk retenus (ce contrôle ÉCHOUE avec l'ancienne version) ; test_veille_presse.mjs (90) : consigne de tri stricte, lien « 🔗 almarrakchia.net ».",
        ] },
        { version: "37.135 Les sources connues, reconnues", date: "2026-11-12", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.136');
