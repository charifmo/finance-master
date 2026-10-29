/* v37.79 Dates — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.78 Journal → Pilotage";`, `const CURRENT_VERSION = "37.79 Dates";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.78 Journal → Pilotage", date: "2026-10-29", changes: [`,
`                    const CHANGELOG = [
        { version: "37.79 Dates", date: "2026-10-29", changes: [
            "📅 PLUS AUCUN « J.X » — « Il faut enlever de partout ces J-X ! » Après le Relevé, les derniers « j.6 » et « 📅 j.18 » deviennent des dates : badges des lignes du Pilotage (« 📅 6 nov. »), Respiration et atterrissage du Pilotage théorique, charges fixes échues, épargne au téléphone. Le mois vient du cycle : un jour au moins égal au jour de paie appartient au mois précédent (le cycle de décembre court du 27 nov. au 26 déc.).",
            "🗓️ LE CALENDRIER SE LIT COMME UNE DATE — la case de jour d'un choc ou d'un virement : « 📅 le [1] déc. » au lieu de « 📅 j. [1] ».",
            "⏳ L'EN-TÊTE DU PILOTAGE — « 29 jours avant la paie du 27 nov. » au lieu de « J−29 ».",
            "PREUVE — nouvelle suite « Des dates, partout » : plus aucun « j.N », « 📅 j. » ni « J−N » à l'écran, conversion d'un jour de cycle (bascule au jour de paie, fin de mois, changement d'année), badges du Pilotage, en-tête, case du Calendrier. Suite « Cycle réalisé » : ses badges attendent désormais une date. Rejouée sur la v37.78 : en échec.",
        ] },
        { version: "37.78 Journal → Pilotage", date: "2026-10-29", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.79 Dates');
