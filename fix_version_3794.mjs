/* v37.94 Janvier suivant — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.93 Épargne progressive";`, `const CURRENT_VERSION = "37.94 Janvier suivant";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.93 Épargne progressive", date: "2026-11-02", changes: [`,
`                    const CHANGELOG = [
        { version: "37.94 Janvier suivant", date: "2026-11-02", changes: [
            "🧹 « J'APPUIE SUR RECALCULER, MAIS IL RESTE TOUT ÇA SANS NETTOYAGE » — les virements du 28 décembre 2027 (9 100 d'Assafa vers le Courant, 6 000 du Courant vers Assafa : un aller-retour d'anciens calculs) alimentent le cycle de JANVIER 2028 ; votre 2028 existe déjà, et la v37.92 ne les retirait que si l'année suivante manquait.",
            "✅ DÉSORMAIS — « Alimenter le Courant » pour une année traite aussi le cycle de janvier suivant (son virement se pose le jour de paie de décembre) : les anciens virements salaire ↔ Courant de ce cycle sont retirés et, si l'année suivante existe, le montant juste est calculé et posé — le plan affiche « Janvier 2028 ».",
            "PREUVE — la suite « Le Courant alimenté au juste besoin » : avec 2028 présent, 13 cycles calculés, le vieux 9 100 du 28 décembre retiré, « Janvier 2028 » affiché. Rejouée sur la v37.93 : en échec.",
        ] },
        { version: "37.93 Épargne progressive", date: "2026-11-02", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.94');
