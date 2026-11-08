/* v37.116 Le voyage garde son compte — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.115 La réponse ne se perd plus";`, `const CURRENT_VERSION = "37.116 Le voyage garde son compte";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.115 La réponse ne se perd plus", date: "2026-11-08", changes: [`,
`                    const CHANGELOG = [
        { version: "37.116 Le voyage garde son compte", date: "2026-11-08", changes: [
            "✈️ UNE ABSENCE DÉCLARÉE : LE COMPTE EST PROPOSÉ, ET IL RESTE — la ligne « Voyage … » créée dans le Flux prend d'office le compte du dernier voyage, sinon celui que vos dépenses exceptionnelles utilisent le plus (Dépenses Annuelles & Projets…), plus le courant par défaut. « Payé par » le montre à côté de la destination ; changer les dates, la destination ou le budget, ou recharger l'appli, ne le change pas.",
        ] },
        { version: "37.115 La réponse ne se perd plus", date: "2026-11-08", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.116');
