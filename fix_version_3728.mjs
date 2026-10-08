/* v37.28 Cases-Vierges — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.27 Semaine-Glissante";`, `const CURRENT_VERSION = "37.28 Cases-Vierges";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.27 Semaine-Glissante", date: "2026-10-08", changes: [`,
`                    const CHANGELOG = [
        { version: "37.28 Cases-Vierges", date: "2026-10-08", changes: [
            "ZÉRO PAR DÉFAUT — les cases de saisie (Marjane, Hri, « Autre », les catégories sans poste) sont VIDES tant que vous n'avez rien tapé : simple invite « 0 », droite et pâle. Plus aucune estimation « ≈ 172 » en italique dans une case, qui la faisait passer pour déjà remplie ; plus de total de tickets dans l'invite non plus (il reste lisible sur la ligne : « 🧾 450 »).",
            "LE PRÉVU À CÔTÉ, JAMAIS DEDANS — chaque poste affiche « Prévu : 400 DH » en petit texte gris sous son nom, chaque ligne « Prévu : 1 000 DH » (le budget de la semaine), puis « · reste 750 » dès qu'une dépense est saisie. Le total d'une ligne et celui de la semaine valent ce qui a été saisi : 0 DH sans saisie, sans « ≈ ».",
            "RAYONS X — l'en-tête d'une catégorie montre ce qui est DÉPENSÉ (0 DH sans saisie) et, à part, « Prévu : 4 300 DH » ; la barre et le reste en découlent. L'estimation du moteur n'y est plus présentée comme une dépense : elle est nommée en une ligne (« le Reste à dépenser en déduit par prudence … ; rien n'est écrit dans vos cases »).",
            "AUCUN PRÉ-REMPLISSAGE — la semaine sans saisie vaut 0, y compris la semaine en cours ; la vieille agrégation automatique des tickets vers le compteur (orpheline depuis la v37.24) est retirée : plus rien n'écrit dans vos saisies à votre place. Le grand Reste à dépenser garde sa prudence tant que rien n'est saisi, dite en clair dessous (« estimé au prorata ») et détaillée dans ⓘ.",
            "PREUVE — la suite « Reste à dépenser » passe à 90 contrôles : toutes les cases vides avec l'invite « 0 », « Prévu : X DH » hors de la case, aucun « ≈ » dans la zone de saisie, Rayons X à 0 DH sans saisie, une saisie ne remplit que sa case, vider une case la rend vierge. Rejouée sur la v37.27 : 12 échecs. Huit défauts réintroduits exprès (estimation hebdo, invite = budget, valeur pré-remplie, case unique pré-remplie, en-tête Rayons X estimé, réel = engagé, Prévu retiré, agrégation ré-exposée) : tous attrapés.",
        ] },
        { version: "37.27 Semaine-Glissante", date: "2026-10-08", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.28 Cases-Vierges');
