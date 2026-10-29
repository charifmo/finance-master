/* v37.82 Graphiques — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.81 Journal visible";`, `const CURRENT_VERSION = "37.82 Graphiques";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.81 Journal visible", date: "2026-10-29", changes: [`,
`                    const CHANGELOG = [
        { version: "37.82 Graphiques", date: "2026-10-29", changes: [
            "📈 LA TRAJECTOIRE, COMPTE PAR COMPTE — « Je veux ce graphique sélectionnable par compte. » Sous « Trajectoire de vos comptes », une pastille par compte réel (le Courant d'abord) : on coche un ou plusieurs comptes, le graphique trace une courbe par compte (le solde en fin de mois, en rouge quand il passe sous zéro), et le « point bas » suit la sélection (le compte, le jour). « Vue d'ensemble » rend le graphique d'avant. La sélection est mémorisée.",
            "📊 L'ANNÉE, TYPE DE CHARGES PAR TYPE DE CHARGES — « Le même graphique pour les charges, sélectionnable par type de charges. » Sous « L'année mois par mois », une pastille par type (mensualités de crédit, charges fixes, factures, conso, dépenses ponctuelles, épargne) : on coche, le graphique ne garde que ça. UN seul type coché : il se détaille ligne par ligne — chaque charge de ce type, mois par mois (les huit plus grosses, puis « Autres »). « Tous » rend le graphique d'avant. Mémorisé.",
            "PREUVE — nouvelle suite « Les deux graphiques du Bilan » : ce que Chart.js dessine vraiment — une pastille par compte réel, une courbe par compte coché avec ses vrais soldes, point bas de la sélection (Épargne LT − 5 000 le 15 nov.), mémorisation ; types de charges : deux types empilés, un seul détaillé (Nounou 2 500 et Syndic 300 sur 12 mois), retour à « Tous ». Rejouée sur la v37.81 : en échec ; défauts réintroduits exprès : attrapés.",
        ] },
        { version: "37.81 Journal visible", date: "2026-10-29", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.82');
