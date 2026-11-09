/* v37.120 Ajouter depuis la frise — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.119 Le prévu au bon endroit";`, `const CURRENT_VERSION = "37.120 Ajouter depuis la frise";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.119 Le prévu au bon endroit", date: "2026-11-09", changes: [`,
`                    const CHANGELOG = [
        { version: "37.120 Ajouter depuis la frise", date: "2026-11-09", changes: [
            "➕ « AJOUTER » DANS LE DÉTAIL D'UNE CASE DE LA FRISE — montant, libellé (le nom du poste proposé), date (dans la période de la case : aujourd'hui s'il y tombe) : l'opération est enregistrée dans CE poste, sur le compte de sa catégorie, sans quitter la frise ; la liste, le total et la case suivent aussitôt.",
        ] },
        { version: "37.119 Le prévu au bon endroit", date: "2026-11-09", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.120');
