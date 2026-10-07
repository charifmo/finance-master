/* v37.26 Saisie-Par-Poste — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.25 Saisie-Accessible";`, `const CURRENT_VERSION = "37.26 Saisie-Par-Poste";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.25 Saisie-Accessible", date: "2026-10-06", changes: [`,
`                    const CHANGELOG = [
        { version: "37.26 Saisie-Par-Poste", date: "2026-10-07", changes: [
            "PAS DE TOTAL À ÉDITER : UNE CASE PAR POSTE — une catégorie qui a des sous-catégories (Alimentation : Marjane, lhrri, khdra, kfta, sqata, dessert, Nuggets, samak…) n'a plus de case « total ». Sa ligne affiche le total en LECTURE ; le bouton ✎ la déplie sur une case par poste, plus « Autre » pour le hors-liste. Une catégorie sans poste garde sa case unique.",
            "SAISIR SANS LA SOURIS — au clic, le contenu d'une case est sélectionné : on tape, Entrée valide et passe au poste SUIVANT (le dernier referme le clavier). « +50 » puis Entrée AJOUTE 50 au poste (« -20 » retire) : on met à jour sans refaire l'addition de tête. Un texte invalide est refusé, le poste garde sa valeur ; vider une case retire la saisie du poste.",
            "CHAQUE POSTE SE SITUE — son budget du cycle (ex. Marjane : prévu 1 720), une jauge fine qui passe au rose au-delà, ses tickets datés s'il y en a ; avant toute saisie, l'estimation du moteur en grisé (≈ 598).",
            "RIEN DE PERDU — les saisies sont rangées dans le MÊME compteur du cycle (alimentation::1, alimentation::2…) : rien de nouveau à sauvegarder ni à fusionner. Un ancien total saisi en v37.23/24 reste compté : il devient la ligne « Autre ». La règle ne change pas : engagé = le plus grand entre le total des postes et les tickets datés, jamais leur somme.",
            "PREUVE — la suite « Reste à dépenser » (63 contrôles) : une case par poste, Entrée = suivant, « +50 », texte refusé, vider un poste, tickets, ancien total devenu « Autre », saisie au doigt sur S24+. Rejouée sur la v37.25 : échec ; trois défauts réintroduits exprès (postes non comptés, « +50 » sans effet, Entrée sans suivant) sont attrapés.",
        ] },
        { version: "37.25 Saisie-Accessible", date: "2026-10-06", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.26 Saisie-Par-Poste');
