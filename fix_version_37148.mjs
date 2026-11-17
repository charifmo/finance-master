/* v37.148 La saisie des montants ne repart plus de zéro — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.147 Les factures se clôturent aussi dans la frise";`, `const CURRENT_VERSION = "37.148 La saisie des montants ne repart plus de zéro";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.147 Les factures se clôturent aussi dans la frise", date: "2026-11-14", changes: [`,
`                    const CHANGELOG = [
        { version: "37.148 La saisie des montants ne repart plus de zéro", date: "2026-11-17", changes: [
            "⌨️ « LA SAISIE NE SE FAIT PAS DANS LA PARTIE SAISIE » (Pilotage mensuel, les champs « Saisir ») — depuis la v37.133, chaque chiffre tapé était écrit au journal puis la case vidée ; le champ, qui affiche cette case, était remis à zéro à chaque touche : « 300 » donnait « 3 » puis « 0 » (le « 3 » en journal, le suivant repartait de rien). Le champ garde maintenant ce que vous tapez pendant que le journal suit chaque touche ; en le quittant, il montre à nouveau ce que le journal a réglé. Même correction pour les champs de la Saisie plus ancienne (charges fixes, dépenses).",
            "↕️ Et la ligne que l'on tape ne saute plus : à « 300 » sur 99 prévus, elle passait aussitôt dans « Déjà validé » et, son tiroir devenu vide, le champ disparaissait sous les doigts. Elle reste en place jusqu'à ce que vous quittiez le champ.",
            "✏️ « JE CLIQUE SUR MODIFIER, ÇA NE DONNE RIEN, C'EST BLOQUÉ ! » (Créances et remboursements) — le formulaire de modification s'ouvre en HAUT de la section ; avec la liste en dessous, on cliquait sur ✏️ et rien ne bougeait à l'écran. ✏️ amène maintenant le formulaire à l'écran, au centre, son premier champ prêt.",
            "PREUVE — test_journal_regle.mjs (section F) : « 300 » tapé touche par touche sur « tel » (99 prévus, 49 déjà réglés) → le champ montre 3, 30, 300 ; réglé 300 (opération de 251 au journal) ; ligne validée en quittant le champ. Les contrôles d'avant posaient la valeur d'un coup, jamais touche par touche : ils ne pouvaient pas voir le défaut (échec confirmé sur la v37.147).",
        ] },
        { version: "37.147 Les factures se clôturent aussi dans la frise", date: "2026-11-14", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.148');
