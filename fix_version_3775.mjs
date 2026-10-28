/* v37.75 Vos comptes — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.74 Jour exact";`, `const CURRENT_VERSION = "37.75 Vos comptes";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.74 Jour exact", date: "2026-10-28", changes: [`,
`                    const CHANGELOG = [
        { version: "37.75 Vos comptes", date: "2026-10-28", changes: [
            "🏦 VOS COMPTES, D'UN COUP D'ŒIL — « Cet écran n'est pas révélateur de l'état de mes comptes pour ce cycle : ajouter la somme sur chaque compte à l'instant. » Dans la Météo du Pilotage, « Fin de cycle » devient « Vos comptes » : pour chaque compte réel (plus seulement ceux qui paient quelque chose ce cycle), trois colonnes — AUJOURD'HUI (le solde réel), AU PLUS BAS d'ici la fin du cycle (et le jour), FIN DE CYCLE. Un compte qui plonge en cours de cycle puis remonte avant la fin ne passe plus inaperçu.",
            "🔁 LES VIREMENTS À PRÉVOIR, EN GRAND — une case blanche, un virement par ligne : le montant, VERS quel compte, DEPUIS quel compte (ou « aucun compte ne couvre seul ce montant — à répartir »), avant quelle date, et jusqu'où le compte descendrait sans lui. Tous les comptes concernés y figurent, plus de « (+ 1 autre compte) ».",
            "📱 LA BONNE VERSION SUR LE TÉLÉPHONE — « Toujours il ne reconnaît pas [la capture Attijari]. » Rejouée sur l'appli à jour, la même capture est reconnue : n° du compte chèque lu, Compte Courant retrouvé. « Sans RIB visible » est le comportement d'avant la v37.71 : un onglet de téléphone resté ouvert garde l'appli du jour où il a été ouvert. L'appli vérifie maintenant sa version à l'ouverture et à chaque retour sur l'onglet : plus récente sur le serveur, elle se recharge seule — sauf saisie non enregistrée, où un bandeau propose de le faire. Le RIB et le n° de compte étaient déjà reconnus l'un pour l'autre.",
            "PREUVE — nouvelle suite « Vos comptes » : une ligne par compte liquide (pas la Bourse), aujourd'hui = solde réel, point bas daté et en rouge, fin de cycle ; la grande case (vers, depuis, avant le, sinon « aucun compte ne couvre seul ») ; version plus récente → rechargement une seule fois, bandeau sans boucle, jamais de rechargement sur une saisie non enregistrée. Rejouée sur la v37.74 : en échec ; défauts réintroduits exprès : attrapés. Suite « Atterrissage de chaque compte » mise à jour (le Livret et le Coffre y figurent désormais).",
        ] },
        { version: "37.74 Jour exact", date: "2026-10-28", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.75 Vos comptes');
