/* v37.85 Épargne au potentiel — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.84 Revenu négatif";`, `const CURRENT_VERSION = "37.85 Épargne au potentiel";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.84 Revenu négatif", date: "2026-10-30", changes: [`,
`                    const CHANGELOG = [
        { version: "37.85 Épargne au potentiel", date: "2026-10-30", changes: [
            "⚖️ L'ÉPARGNE S'ADAPTE AU POTENTIEL DE CHAQUE MOIS — « Il faut une épargne non stable : de janvier à juin 2027 mon potentiel est négatif. » Le CFO avait créé une SECONDE ligne « Epargne urgence » vers le même compte au lieu de modifier « Urgence » : l'ancienne n'était pas supprimée, les deux se sommaient — de janvier à juin, 9 000 DH d'épargne pour 4 638 DH de potentiel.",
            "✅ DÉSORMAIS — dans Patrimoine & Objectifs, chaque ligne d'épargne a un bouton « ⚖️ Adapter au potentiel » (plafond facultatif) : une exception par période, valeur du mois = potentiel − les autres lignes, jamais sous zéro, à partir du mois en cours ; « Retirer l'adaptation » défait tout. Le CFO lit le potentiel de chaque mois (lecture_moteur.potentiel_epargne) et peut remplacer les exceptions de la ligne EXISTANTE (update_recurring_savings) ; une ligne qui doublerait une ligne existante vers le même compte est refusée.",
            "PREUVE — nouvelle suite « L'épargne s'adapte au potentiel » : potentiel 2027, adaptation en deux périodes, plus aucun mois négatif, retrait, exceptions écrites par le moteur PHP, mois invalides refusés, doublon refusé.",
        ] },
        { version: "37.84 Revenu négatif", date: "2026-10-30", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.85');
