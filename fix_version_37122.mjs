/* v37.122 Toute la frise — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.121 La zone dans toute la presse";`, `const CURRENT_VERSION = "37.122 Toute la frise";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.121 La zone dans toute la presse", date: "2026-11-09", changes: [`,
`                    const CHANGELOG = [
        { version: "37.122 Toute la frise", date: "2026-11-09", changes: [
            "🧾 « OÙ SONT LES CHARGES VARIABLES COMME FACTURES ? ICI JE DOIS POUVOIR TOUT VOIR » — la frise du cycle a maintenant un bloc Factures : une ligne par facture (électricité, téléphone, internet, eau, abonnements…), réglé / prévu sur le cycle ; les opérations restées dans « Factures » sans ligne : « Autres factures ». Comme les autres lignes : toucher pour voir les opérations (➕ Ajouter, modifier), ✏️ / double-clic pour changer le prévu.",
        ] },
        { version: "37.121 La zone dans toute la presse", date: "2026-11-09", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.122');
