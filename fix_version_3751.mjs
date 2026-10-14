/* v37.51 Cloture — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.50 Compte-Par-Ligne";`, `const CURRENT_VERSION = "37.51 Cloture";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.50 Compte-Par-Ligne", date: "2026-10-14", changes: [`,
`                    const CHANGELOG = [
        { version: "37.51 Cloture", date: "2026-10-14", changes: [
            "🔒 CLÔTURER UNE CASE DU PILOTAGE — chaque ligne « À traiter » a son petit cadenas : la case est close pour le cycle, à ce qui a été réglé (eau 54 / 300 : 54 réglés, 246 libérés). Plus rien n'est attendu : le reste quitte le Relevé, le reste à payer par compte, l'urgence, la progression, le surplus. Close à 0 (rien payé) : 0 réglé, pas son dû. Revenus compris : « plus rien à recevoir ».",
            "RIEN NE SE BLOQUE — dans « Déjà validé », chaque ligne garde un champ « + ajouter » (« -20 » corrige), même close. Au-delà du dû elle le dit : « dépassement +34 », montant en rouge. Une ligne close affiche « 🔒 clôturé · 246 libérés ». Décocher une case close la rouvre avec ce qui a été réglé.",
            "🔒 DANS LA MÉTÉO — sur chaque poste : une ligne / sem se clôt pour la semaine affichée, une ligne / 15 j ou / cycle pour le cycle, une catégorie sans poste pour la semaine. Close et vide, elle vaut 0 (plus « au prévu ») ; ce qui reste de son prévu est libéré : il sort de l'enveloppe conso, du Reste à dépenser et du Relevé. La saisie reste ouverte : au-delà du prévu, « dépassement ». Un second 🔒 rouvre ; « effacer tout le cycle » efface aussi ses clôtures.",
            "SANS CLÔTURE, RIEN NE BOUGE — vérifié au dirham sur vos données (Relevé, soldes, reste à payer, tâches, surplus 2026/2027, respiration, Bilan).",
            "PREUVE — nouvelle suite « Clôturer une case » : 46 contrôles calculés à la main (Œufs 30 / 50 clos : 20 libérés puis dépassement +20 ; semaine écoulée ; Hri / cycle 400 libérés ; SORTIES ; rechargement ; eau 54 / 300 ; « + ajouter » ; décocher ; tel close à 0 ; LOYER avec avance ; SALAIRE). Rejouée sur la v37.50 : 30 contrôles en échec. Vingt-quatre défauts réintroduits exprès : tous attrapés.",
        ] },
        { version: "37.50 Compte-Par-Ligne", date: "2026-10-14", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.51 Cloture');
