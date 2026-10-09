/* v37.37 Surplus-Courant-Reel — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.36 Epargne-Du-Mois";`, `const CURRENT_VERSION = "37.37 Surplus-Courant-Reel";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.36 Epargne-Du-Mois", date: "2026-10-09", changes: [`,
`                    const CHANGELOG = [
        { version: "37.37 Surplus-Courant-Reel", date: "2026-10-09", changes: [
            "LE VIREMENT QUI FINANCE LES CHARGES FIXES SORT DU SURPLUS — « Pourquoi + 22 966 DH en novembre ? » Le surplus est calculé au périmètre Compte Courant : il retirait les charges fixes (payées par Assafa) mais ignorait le virement Courant → Assafa qui les finance (15 000 / mois). Ces 15 000 disparaissaient, et le surplus gonflait d'autant, chaque mois. Un virement interne qui QUITTE le Courant est désormais une sortie du brut, un virement qui y ARRIVE une entrée — ce n'est pas de l'épargne : la colonne Épargne ne bouge pas.",
            "UNE SEULE VÉRITÉ — le net d'un mois futur de la modale « Surplus Détaillé » égale désormais le mouvement du Courant au Relevé, ligne pour ligne. « Surplus » et « Reste à vivre moyen » suivent. Un virement déjà fait (pointé) est dans le solde réel : il ne sort qu'une fois. Tous comptes confondus (KPI annuels Entrées / Sorties), un virement interne s'annule : il reste ignoré.",
            "LE CFO AUSSI — son net mensuel de secours (cfo_compute_monthly_net_courant, utilisé pour l'épargne « % du reliquat ») applique la même règle.",
            "PREUVE — suite nouvelle « Le virement vers le compte des charges sort du surplus » (10 contrôles, montants à la main : novembre, décembre, octobre pointé, KPI moyen, égalité avec le Relevé, KPI annuels inchangés) et sa jumelle serveur (4 contrôles). Rejouées sur la v37.36, elles retrouvent les 15 000 manquants (net 21 000 contre 6 000 au Relevé). Neuf défauts réintroduits exprès : tous attrapés.",
        ] },
        { version: "37.36 Epargne-Du-Mois", date: "2026-10-09", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.37 Surplus-Courant-Reel');
