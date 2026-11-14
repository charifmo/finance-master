/* v37.146 Trois niveaux de TNR — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.145 Des tests plus rapides";`, `const CURRENT_VERSION = "37.146 Trois niveaux de tests";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.145 Des tests plus rapides", date: "2026-11-14", changes: [`,
`                    const CHANGELOG = [
        { version: "37.146 Trois niveaux de tests", date: "2026-11-14", changes: [
            "🧪 TROIS NIVEAUX DE TNR, CHOISIS SELON L'IMPACT DU CHANGEMENT (bash run_tests.sh) — niveau 1 « ciblé » : les suites qui touchent ce qui a changé (une suite modifiée, un fichier qu'elle nomme, un identifiant des lignes changées de l'écran, un fichier chargé par l'écran) + un socle rapide ; niveau 2 « domaine » : tout Finance, Santé ou Veille si un fichier cœur (moteur, stockage, intégrité, données de test) ou un gros morceau d'écran change ; niveau 3 « complet » si le noyau commun change. Un domaine que rien ne touche n'est pas testé : Santé inchangée, Santé non testée. « bash run_tests.sh 1 | 2 | 3 » force un niveau ; sante | finance | veille | tout restent possibles.",
            "Mesuré : une ligne de la frise → 16 suites sur 97 (≈ 53 s au lieu de ≈ 200 s) ; sante_samsung.js → les 7 suites Santé qui le lisent ou ouvrent l'écran qui le charge. PREUVE — test_choisir_suites.mjs (12) sur un dépôt git jetable.",
        ] },
        { version: "37.145 Des tests plus rapides", date: "2026-11-14", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.146');
