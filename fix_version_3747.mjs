/* v37.47 Surplus-Perimetre — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.46 Variables-Hebdo";`, `const CURRENT_VERSION = "37.47 Surplus-Perimetre";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.46 Variables-Hebdo", date: "2026-10-10", changes: [`,
`                    const CHANGELOG = [
        { version: "37.47 Surplus-Perimetre", date: "2026-10-11", changes: [
            "LE SURPLUS, ENFIN DANS LE BON PÉRIMÈTRE — il ne regardait QUE le Compte Courant : les charges fixes payées par Assafa en sortaient, le virement Courant → Assafa y entrait comme une sortie, et toute ligne d'épargne partie du Courant était de l'« épargne » — y compris « Compte Principale ASSAFA », l'argent des charges fixes (en 2027 : 33 250 DH d'« épargne » au lieu de 13 250, et un brut gonflé d'autant).",
            "BRUT · ÉPARGNE · NET, comme il se doit — BRUT : ce qui reste sur les comptes de fonctionnement (Courant + Assafa) après TOUTES leurs charges. ÉPARGNE : ce qui quitte ces comptes vers un compte d'épargne (ligne d'épargne ou virement interne), moins ce qui y revient (une reprise s'affiche « + »). NET = BRUT − ÉPARGNE. Un virement entre deux comptes de fonctionnement n'est ni une charge ni de l'épargne : il s'annule. Une dépense payée par un compte d'épargne (Dépenses annuelles…) n'entre pas dans le brut : l'épargne qui l'a provisionnée est déjà comptée.",
            "QUELS COMPTES ? DÉDUIT DE LEUR FONCTION, OU COCHÉ — par défaut : le compte courant, le compte des charges fixes, celui des charges variables, et tout compte qui reçoit un revenu (chez vous : Compte Courant + Compte Principale ASSAFA). Dans Budget Structurel › Architecture des comptes, une case « 🔄 Fonctionnement » par compte force le choix ; « ↺ auto » revient à la déduction. Vous pouvez renommer, retyper ou ajouter des comptes : le surplus suit.",
            "UNE SEULE DÉFINITION PARTOUT — la bulle « Surplus détaillé » dit maintenant quels comptes elle compte ; la Météo et le Bilan appliquent la même règle (leur marge d'un mois = le surplus net de ce mois) et le Bilan montre à part les dépenses payées par l'épargne ; le CFO (serveur) calcule le même net, au dirham.",
            "PREUVE — nouvelle suite « Surplus : périmètre de fonctionnement » : 22 contrôles, montants calculés à la main sur un décor calqué sur vos comptes (Courant, Assafa, Dépenses annuelles, Compte urgence, Long terme), la case cochée / décochée / auto, la bulle, la Météo, le Bilan et le CFO (PHP). Deux suites mises à jour à la nouvelle définition, chiffres recalculés à la main (le net y égale le mouvement Courant + Assafa du Relevé). Rejouée sur la v37.46 : 11 échecs sur 12. Quatorze défauts réintroduits exprès : tous attrapés.",
        ] },
        { version: "37.46 Variables-Hebdo", date: "2026-10-10", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.47 Surplus-Perimetre');
