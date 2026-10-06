/* v37.25 Saisie-Accessible — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.24 Une-Seule-Saisie";`, `const CURRENT_VERSION = "37.25 Saisie-Accessible";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.24 Une-Seule-Saisie", date: "2026-10-06", changes: [`,
`                    const CHANGELOG = [
        { version: "37.25 Saisie-Accessible", date: "2026-10-06", changes: [
            "VOTRE SIGNALEMENT : « je ne peux pas changer les valeurs ». Reproduit à la souris réelle : survoler le NOM d'une catégorie ouvrait le panneau d'audit SOUS la ligne, par-dessus les cases « déjà dépensé » des lignes suivantes — visibles, mais impossibles à cliquer. Désormais, au bureau, le panneau s'ouvre à GAUCHE de la carte (sur le verdict) : la colonne des cases n'est plus jamais recouverte, et on peut glisser d'un nom à n'importe quelle case.",
            "DES CASES QUI ONT L'AIR DE CASES — les montants grisés « ≈ 2 051 » (l'estimation du moteur) ressemblaient à des champs désactivés. Les cases ont maintenant un fond sombre, un contour franc, un crayon ✎ et une invite en italique ; au clic, le contour passe en blanc.",
            "PREUVE — la suite « Reste à dépenser » vérifie que le panneau de chaque catégorie s'ouvre à gauche de la carte sans recouvrir aucune case, et rejoue le parcours exact : survol du nom d'Alimentation, glissement jusqu'à la case de Sorties, saisie de 777. Rejouée sur la v37.24 : échec.",
        ] },
        { version: "37.24 Une-Seule-Saisie", date: "2026-10-06", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.25 Saisie-Accessible');
