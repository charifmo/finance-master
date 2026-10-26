/* v37.63 Projection — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.62 Boutons";`, `const CURRENT_VERSION = "37.63 Projection";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.62 Boutons", date: "2026-10-20", changes: [`,
`                    const CHANGELOG = [
        { version: "37.63 Projection", date: "2026-10-26", changes: [
            "📍 LE PATRIMOINE PROJETÉ, TOUJOURS EN HAUT À DROITE — « Patrimoine Global Projeté (Fin AAAA) », son détail des comptes au survol et le clic qui ouvre le relevé de chaque compte : rien n'avait été retiré (bloc identique depuis la v37.46), mais sous ~1 300 px de large la ligne de l'en-tête passait à la ligne et le bloc tombait À GAUCHE, sous l'année, méconnaissable. Désormais « Année : » (le libellé long au-delà de 1 536 px) laisse la place : à 1 265 px tout tient sur une ligne ; plus étroit, le bloc reste collé à droite.",
            "👆 « ⓘ » le signale ; le détail s'ouvre au survol, et aussi au toucher / au clavier (tablette) ; un clic sur un compte ouvre son relevé sur le même horizon et le détail se referme.",
            "PREUVE — nouvelle suite « En-tête » : 8 contrôles (1 265 px, 1 024 px, survol, clic, toucher). Rejouée sur la v37.62 : 4 en échec (à 1 265 px, le bloc à 561 px du bord droit, sur la ligne d'en dessous). Quatre défauts réintroduits exprès : tous attrapés. Aucun test ne gardait cet en-tête : c'est corrigé.",
        ] },
        { version: "37.62 Boutons", date: "2026-10-20", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.63 Projection');
