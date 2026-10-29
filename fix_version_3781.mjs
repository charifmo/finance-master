/* v37.81 Journal visible — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.80 Même jour";`, `const CURRENT_VERSION = "37.81 Journal visible";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.80 Même jour", date: "2026-10-29", changes: [`,
`                    const CHANGELOG = [
        { version: "37.81 Journal visible", date: "2026-10-29", changes: [
            "🧾 CE QUE LE JOURNAL A DÉJÀ RÉGLÉ SE VOIT SUR SA LIGNE — « Toujours ce problème d'élec. » Depuis la v37.78 le journal règle la ligne (221 DH de « Société Régionale Mult » rangés sur « elect »), mais la case restait vide, « Saisir », sans rien dire : on ne voyait ni que les 221 étaient comptés, ni qu'il en reste 129 sur 350. Désormais la ligne affiche « 🧾 221 réglés », et la case vide propose « 221 🧾 ». Si le prévu (350) est plus haut que ce qui a été payé (221), le bouton ✓ de la ligne la clôture.",
            "PREUVE — la suite « Le journal règle sa ligne du Pilotage » vérifie le cas rapporté (prévu 350, 221 payés : badge et case). Rejouée sur la v37.80 : en échec.",
        ] },
        { version: "37.80 Même jour", date: "2026-10-29", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.81');
