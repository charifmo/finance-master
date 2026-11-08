/* v37.117 Un seul voyage, son budget — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.116 Le voyage garde son compte";`, `const CURRENT_VERSION = "37.117 Un seul voyage, son budget";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.116 Le voyage garde son compte", date: "2026-11-08", changes: [`,
`                    const CHANGELOG = [
        { version: "37.117 Un seul voyage, son budget", date: "2026-11-08", changes: [
            "✈️ VOTRE LIGNE « VOYAGE … » EST REPRISE, PLUS DOUBLÉE — une ligne « Voyage Marrakech » déjà dans le Flux (créée à la main, avec son budget de 1 500 DH) restait à côté de celle créée en déclarant l'absence (0 DH) : le ruban lisait la seconde, « aucun budget prévu ». Déclarer une absence reprend désormais la ligne existante (même destination, même année, mois proche) ; les deux lignes déjà présentes sont fusionnées au chargement — la vôtre reste, avec son budget, sur le compte choisi dans « payé par ».",
            "💰 La case « budget » du voyage montre et règle le montant de la ligne du Flux ; changer les dates ou la destination ne le remet plus à 0.",
        ] },
        { version: "37.116 Le voyage garde son compte", date: "2026-11-08", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.117');
