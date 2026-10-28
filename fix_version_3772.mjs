/* v37.72 Virements — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.71 Attijari";`, `const CURRENT_VERSION = "37.72 Virements";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.71 Attijari", date: "2026-10-28", changes: [`,
`                    const CHANGELOG = [
        { version: "37.72 Virements", date: "2026-10-28", changes: [
            "🔒 UN VIREMENT À FAIRE SE PROGRAMME, IL NE CHANGE PAS LES SOLDES D'AUJOURD'HUI — « C'est le CFO qui faisait ce problème en changeant le compte courant au lieu d'initier dans le futur un transfert vers le compte concerné. » Deux fois, le CFO a « réglé » un besoin de trésorerie à venir en modifiant les soldes actuels de deux comptes — la seconde fois depuis un autre compte que l'option choisie. Aucun de ces virements n'avait eu lieu à la banque. Son moteur refuse désormais toute correction de solde qui n'est pas déclarée déjà faite à la banque, et le refus lui dit quoi faire à la place.",
            "📅 PROGRAMMER UN VIREMENT — nouvelle fonction du CFO : un virement futur entre deux comptes, à son mois et à son jour (un ou plusieurs mois pour un virement permanent), inscrit au calendrier des virements : le Relevé, la Météo et l'atterrissage le comptent à sa date, et aucun solde ne bouge. Ses consignes : un virement à faire se programme ; l'option choisie est exécutée telle quelle, vérifiée dans le relevé de la simulation avant de demander OUI.",
            "↩️ LES SOLDES REMIS — les deux transferts enregistrés par le CFO sont annulés une fois au chargement (schéma 24), compte par compte, seulement si le solde est exactement celui qu'ils ont laissé : le Courant revient au solde de votre banque, « depenses annuels » aussi, et ASSAFA récupère ce qui lui avait été retiré. Le journal technique le dit.",
            "PREUVE — nouvelle suite « Un virement à faire se programme » (moteur du CFO, 11 contrôles) : correction de solde refusée sans « déjà fait en banque », acceptée quand c'est le cas, virement programmé sans toucher aux soldes, virement permanent sur plusieurs mois, garde-fous. Rejouée sur la v37.71 : 8 en échec ; trois défauts réintroduits exprès (verrou absent, virement qui touche les soldes, un seul mois) : attrapés. Suite « corrections approuvées » complétée (soldes corrigés au dirham près, jamais rejoués). Vérifié sur vos données : Courant et « depenses annuels » reviennent exactement aux soldes de votre banque.",
        ] },
        { version: "37.71 Attijari", date: "2026-10-28", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.72 Virements');
