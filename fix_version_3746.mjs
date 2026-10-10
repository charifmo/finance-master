/* v37.46 Variables-Hebdo — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.45 Bilan-Metier";`, `const CURRENT_VERSION = "37.46 Variables-Hebdo";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.45 Bilan-Metier", date: "2026-10-10", changes: [`,
`                    const CHANGELOG = [
        { version: "37.46 Variables-Hebdo", date: "2026-10-10", changes: [
            "LES CHARGES VARIABLES SORTENT CHAQUE SEMAINE, PLUS D'UN BLOC LE 15 — le Relevé de comptes déduisait tout le budget variable d'un cycle en une seule ligne au j.15 (« 🛒 Total Charges Variables … 9 686 DH »). Le solde paraissait confortable jusqu'au 14 puis plongeait d'un coup ; le point bas et les dates « virer avant le … » en étaient faussés.",
            "UNE LIGNE PAR SEMAINE — sur les semaines réelles du cycle (celles dont le jeudi tombe dans le cycle : 4 ou 5, la règle de la saisie par semaine). Cycle en cours : l'enveloppe RESTANTE sur les semaines pas finies, au prorata des jours qui leur restent, la semaine en cours datée d'aujourd'hui (« semaine en cours (jusqu'au 11 oct.) »). Cycles à venir : le budget variable en parts égales, chaque semaine datée de son lundi (« semaine du 12 oct. au 18 oct. »).",
            "LE TOTAL NE BOUGE PAS D'UN CENTIME — seul le calendrier des sorties change : la fin de cycle, l'atterrissage, le bandeau, la Météo et le Bilan gardent leurs chiffres. Le point bas, lui, devient réaliste, et la trajectoire du Bilan descend semaine après semaine.",
            "PREUVE — nouvelle suite « Charges variables : une déduction par semaine au Relevé » : 17 contrôles dans un vrai navigateur (semaines recalculées à la main, dates, libellés, prorata, somme au centime, cycle à venir, cas limites du premier et du dernier jour du cycle). Rejouée sur la v37.45 : le bloc au 15 est là, aucune ligne hebdomadaire. Sept défauts réintroduits exprès : tous attrapés.",
        ] },
        { version: "37.45 Bilan-Metier", date: "2026-10-10", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.46 Variables-Hebdo');
