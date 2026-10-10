/* v37.45 Bilan-Metier — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.44 Interface-Desktop";`, `const CURRENT_VERSION = "37.45 Bilan-Metier";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.44 Interface-Desktop", date: "2026-10-10", changes: [`,
`                    const CHANGELOG = [
        { version: "37.45 Bilan-Metier", date: "2026-10-10", changes: [
            "LE BILAN, RELU PAR UN DIRECTEUR FINANCIER — l'onglet « Bilan & Simulation » empilait cinq cartes qui répétaient le bandeau (le surplus rebaptisé « Reste à vivre moyen », une « Patrimoine NET » qui n'était que la somme des comptes, sans aucune dette retranchée), deux anneaux qui CACHAIENT le déficit (une part négative ne se dessine pas : un budget à −20 000 DH par mois y paraissait plein et équilibré), une courbe tirée d'un autre moteur que le Relevé et un panneau « Audit détaillé » vide. Tout cela est remplacé.",
            "UN VERDICT ET QUATRE SIGNAUX VITAUX, chacun avec son repère : le solde mensuel du budget (repère : au moins 5 % des ressources), le taux d'épargne RÉEL (l'épargne programmée moins le déficit qui la ronge ; repère : 10 %, très bien à 20 %), le taux d'endettement (celui du bandeau ; repère : 33 %, zone rouge au-delà de 40 %) et l'épargne de précaution en mois de dépenses (objectif des Paramètres). Le verdict dit chaque signal en une phrase, le pire d'abord.",
            "LA TRAJECTOIRE DES COMPTES SUR 12 MOIS — le Relevé de comptes déroulé : fin de mois du compte courant (en rouge sous zéro), de tous les comptes, et le point bas daté. Le premier mois tombe sur la « Fin de cycle » de la Météo, décembre sur le « Patrimoine global projeté » du bandeau. Quand le courant plonge mais que les autres comptes le couvrent, le verdict dit de prévoir les virements.",
            "OÙ PART L'ARGENT — chaque poste en DH par mois et en % des ressources, les mensualités de crédit à part (elles étaient noyées dans les charges fixes), le détail au clic ; le total engagé, ce qui reste ou ce qui manque. Et L'ANNÉE MOIS PAR MOIS : les ressources face aux sorties, poste par poste. Postes et mois viennent du modèle de la Météo (respirationDuMois) : mêmes libellés, mêmes couleurs, mêmes montants.",
            "LA BARRE LATÉRALE — tout le menu défilait d'un bloc : à 1280×720, le bas sortait de l'écran. Les onglets défilent désormais seuls ; le pied reste toujours visible : les outils nommés (🧠 CFO, 📑 Relevé, 🪄 Merlin — ce n'étaient que trois émojis), l'état de la sauvegarde en une ligne (● Enregistré · heure ; un clic réenregistre ; plus de gros bouton, la sauvegarde est automatique), annuler / rétablir, et « ⋯ » : exporter, importer, PDF, Google Drive, nouveautés. La version ouvre les nouveautés (le changelog n'est plus un faux onglet).",
            "PARAMÈTRES › SAUVEGARDE & DONNÉES — le journal technique, le test de connexion, Google Drive et « Restaurer les données du 7 avril (V10) » y sont rangés ; ce dernier, qui écrase les données du serveur, était un bouton rouge à portée de clic sur chaque écran : il est dans une « zone sensible » et demande toujours confirmation.",
            "PREUVE — nouvelle suite « Bilan métier & barre latérale » : 49 contrôles dans un vrai navigateur, chaque chiffre recoupé avec le moteur qui fait foi (la Météo, le bandeau, le Relevé), deux scénarios en direct (une dépense de 24 000 DH ; des revenus multipliés par 4), la barre à 1280×720, 1366×768, 1440×900 et repliée. « Interface de bureau » mise à jour (33 contrôles : lisibilité, contrastes, débordements sur les 13 écrans). Rejouée sur la v37.44 : les 5 sections échouent. __MUTANTS__",
        ] },
        { version: "37.44 Interface-Desktop", date: "2026-10-10", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.45 Bilan-Metier');
