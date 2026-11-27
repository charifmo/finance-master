/* v37.156 Calendrier : chaque ✕ visible — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.155 Ce que l'appli pose, affiché chaque mois";`, `const CURRENT_VERSION = "37.156 Calendrier : chaque ✕ visible";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.155 Ce que l'appli pose, affiché chaque mois", date: "2026-11-27", changes: [`,
`                    const CHANGELOG = [
        { version: "37.156 Calendrier : chaque ✕ visible", date: "2026-11-27", changes: [
            "✕ « L'AFFICHAGE N'EST PAS OK, JE NE PEUX PAS SUPPRIMER LE VIREMENT ! » — au Calendrier, la ligne d'un virement (deux comptes aux noms longs, le jour, « après paie → Janvier », le montant) ne passait jamais à la ligne : le ✕ sortait de l'écran, à droite. Celle d'un flux exceptionnel (« Paiement Notaire & Travaux ») cachait le sien derrière une barre de défilement horizontale.",
            "DÉSORMAIS — les deux lignes passent à la ligne quand la place manque ; les comptes se partagent la largeur ; le montant et le ✕ restent ensemble à droite ; le ✕ est un vrai bouton encadré de rouge, toujours visible (plus de demi-transparence au survol). PREUVE — test_calendrier_lignes.mjs (vrai CSS Tailwind) : à 1280 et 820 px, le ✕ des 2 virements et du flux de décembre est entier dans sa ligne, sans défilement ; au téléphone (onglet flux), chaque ✕ entier et pas de défilement de côté ; un clic supprime le virement.",
        ] },
        { version: "37.155 Ce que l'appli pose, affiché chaque mois", date: "2026-11-27", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.156');
