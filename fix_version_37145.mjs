/* v37.145 Des tests plus rapides — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.144 La frise verrouille, compte juste et se règle sur place";`, `const CURRENT_VERSION = "37.145 Des tests plus rapides";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.144 La frise verrouille, compte juste et se règle sur place", date: "2026-11-14", changes: [`,
`                    const CHANGELOG = [
        { version: "37.145 Des tests plus rapides", date: "2026-11-14", changes: [
            "🌀 « RÉDUIRE LES ANIMATIONS » (réglage du téléphone ou de l'ordinateur) est respecté partout : plus de pulsations ni de clignotements en boucle. Ils redessinaient l'écran sans arrêt — batterie au téléphone, et un quart de cœur de processeur par page ouverte dans les tests. Sans ce réglage, rien ne change.",
            "⏱️ Tests : l'OCR réel des suites Banque mémorisé entre deux exécutions (même image envoyée à Tesseract → même lecture ; le code change ce qu'il envoie → l'OCR repasse) ; les navigateurs de test lancés en « animations réduites » ; « Deux PC » attend l'effet plutôt que 3 s fixes ; les tests de volume Santé allégés (mêmes preuves).",
        ] },
        { version: "37.144 La frise verrouille, compte juste et se règle sur place", date: "2026-11-14", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.145');
