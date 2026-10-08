/* v37.30 Rythmes-Par-Ligne — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.29 Semaines-Reelles";`, `const CURRENT_VERSION = "37.30 Rythmes-Par-Ligne";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.29 Semaines-Reelles", date: "2026-10-08", changes: [`,
`                    const CHANGELOG = [
        { version: "37.30 Rythmes-Par-Ligne", date: "2026-10-08", changes: [
            "UN RYTHME PAR SOUS-CATÉGORIE — dans le détail d'une charge variable, chaque ligne a désormais son sélecteur : /sem, /15j ou /cycle. Le ravitaillement (« Hri ») une fois par cycle, la viande (« L7m ») à la semaine, le « Psy » à la quinzaine. Sur un cycle de N semaines réelles (v37.29) : /sem → montant × N, /15j → montant × N/2, /cycle → montant × 1.",
            "AUCUNE DONNÉE NE BOUGE — une ligne sans rythme hérite de sa catégorie (« / sem » → /sem, « / mois » → /cycle) : Factures, Alimentation… gardent exactement leurs montants. « + Nouvelle ligne » prend le rythme de la catégorie.",
            "LA LIGNE DEVIENT LA SOURCE DE VÉRITÉ — le budget d'une catégorie est calculé ligne par ligne partout : Pilotage, Reste à dépenser, Prévisionnel (chaque mois avec ses semaines), surplus, journal, relevé, contrôle, graphiques, indépendance financière. La valeur affichée à côté du titre devient un résumé (l'équivalent dans l'unité de la catégorie) ; le calcul exact du cycle en cours et du suivant s'affiche dessous.",
            "RAYONS X — chaque étiquette du budget prévu dit son rythme : [🛍️ Hri : 1 000 DH / cycle] [🥩 L7m : 150 DH / sem] [Psy : 400 DH / 15 j], triées par poids dans le cycle ; au survol, ce que la ligne pèse sur le cycle.",
            "LA SEMAINE SANS FAUX DÉPASSEMENT — une ligne /15j ou /cycle se suit sur le CYCLE (« Prévu : 1 000 DH / cycle · 1 000 ce cycle ») ; la ligne de la catégorie affiche « Prévu : 250 DH + 2 000 / cycle ». La semaine du ravitaillement, la dépense compte comme PRÉVUE dans la limite de l'enveloppe restante : plus de « dépassé » ce jour-là ; au-delà de l'enveloppe, oui.",
            "SERVEUR (CFO) — même règle dans cfo_intent_engine.php (net mensuel de secours, valeur résumée) ; quand le CFO change le total d'une catégorie aux rythmes mêlés, chaque ligne suit le même ratio et garde son rythme. Parité 27/27 intacte avec l'ancien moteur (lignes héritées).",
            "PREUVE — deux suites nouvelles (37 + 12 contrôles), calculs faits à la main, cycles de 5 et de 4 semaines : héritage, coût du cycle, Prévisionnel des 12 mois, surplus, journal, Rayons X, semaine du ravitaillement, cycle complet tenu au dirham près, éditeur (sélecteurs, nouvelle ligne, valeur résumée). Onze défauts réintroduits exprès côté application et quatre côté serveur : tous attrapés.",
        ] },
        { version: "37.29 Semaines-Reelles", date: "2026-10-08", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.30 Rythmes-Par-Ligne');
