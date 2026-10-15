/* v37.56 Tickets-Cumules — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.55 Calibrage-RIB";`, `const CURRENT_VERSION = "37.56 Tickets-Cumules";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.55 Calibrage-RIB", date: "2026-10-15", changes: [`,
`                    const CHANGELOG = [
        { version: "37.56 Tickets-Cumules", date: "2026-10-15", changes: [
            "🧾 LES TICKETS MARJANE SE CUMULENT — le Pilotage affichait « Marjane · 180 » alors que le journal en comptait 180 + 176 + 80 + 80. Les tickets de 176 et 80, saisis avant le rangement automatique, étaient posés sur la catégorie MÈRE « Alimentation » : une ligne ne compte que les tickets rangés SUR elle. Un ticket sur la catégorie mère dont le libellé dit SÛREMENT une de ses lignes est maintenant rattaché à cette ligne, tout seul, une fois (journal, Pilotage, Rayons X). Jamais un choix fait à la main, un ticket « à vérifier » ou un doute.",
            "PREUVE — nouvelle suite « Tickets cumulés » : 10 contrôles (rejouée sur la v37.55 : en échec). Cinq défauts réintroduits exprès : quatre attrapés, le cinquième est sans effet (doublon d'une autre garde). Sur vos données : les deux tickets Marjane passent sur la ligne Marjane.",
        ] },
        { version: "37.55 Calibrage-RIB", date: "2026-10-15", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.56 Tickets-Cumules');
