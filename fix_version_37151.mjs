/* v37.151 TNR léger · moyen · full — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.150 Une charge fixe selon X mois";`, `const CURRENT_VERSION = "37.151 Tests légers, moyens ou complets";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.150 Une charge fixe selon X mois", date: "2026-11-26", changes: [`,
`                    const CHANGELOG = [
        { version: "37.151 Tests légers, moyens ou complets", date: "2026-11-26", changes: [
            "⏱️ « OPTIMISE LES TESTS : NE REJOUE PAS TOUS LES TNR SAUF SI C'EST COMPLEXE ET QUE ÇA TOUCHE À TOUT — 3 NIVEAUX : LÉGER, MOYEN, FULL » — les trois niveaux existaient (v37.146) mais ne triaient presque rien : le « léger » d'un changement de l'écran Finance retenait 95 suites sur 99 (il lisait les phrases du changelog et des mots que presque toutes les suites citent : chargesFixes, valeur, donneesAnnuelles…), et le « moyen » rejouait tout le domaine Finance, soit presque le complet.",
            "DÉSORMAIS — bash run_tests.sh leger | moyen | full (ou 1 | 2 | 3 ; sans argument : automatique). Léger : les suites qui nomment ce qui a changé + un socle rapide ; le changelog et les commentaires ne comptent plus, un identifiant cité par plus de 10 % des suites est écarté (et c'est dit). Moyen : le léger + un socle moyen de 23 suites (moteur, projection, cycle, Relevé, CFO). Full automatique seulement si le noyau des tests change, si deux domaines ont un changement de fond, ou au-delà de 3 000 lignes. Durée estimée affichée ; PLAN=1 montre le choix sans rien exécuter. Sur le changement de la v37.150 : léger 37 suites ≈ 68 s, moyen 45 ≈ 71 s, full 119 ≈ 208 s.",
            "AU PASSAGE — « Pilotage Réalisé (suivi par cycle) » échouait le dernier jour d'un cycle (le 26, paie le 27) : son échéance « dans la semaine » retombait au début du cycle suivant. Son horloge est figée au 12 du mois. PREUVE — test_choisir_suites.mjs (17 contrôles, dépôt git jetable) : moyen ≠ tout le domaine ; cœur Finance + cœur Santé → full ; un identifiant commun ne trie rien ; une phrase du changelog ne désigne rien ; léger / moyen / full = 1 / 2 / 3.",
        ] },
        { version: "37.150 Une charge fixe selon X mois", date: "2026-11-26", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.151');
