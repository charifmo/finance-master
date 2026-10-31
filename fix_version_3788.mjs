/* v37.88 Compte chèque seul — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.87 Total Attijari";`, `const CURRENT_VERSION = "37.88 Compte chèque";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.87 Total Attijari", date: "2026-10-31", changes: [`,
`                    const CHANGELOG = [
        { version: "37.88 Compte chèque", date: "2026-10-31", changes: [
            "🏦 LE COMPTE COURANT SUIT LE COMPTE CHÈQUE, JAMAIS « MES COMPTES » — « Il doit prendre le compte courant, pas Mes comptes ! » Un ancien réglage « Solde suivi : Mes comptes » (le TOTAL de tous vos comptes Attijari) faisait chercher le mauvais solde. Ce choix n'existe plus : à l'import, le solde proposé est toujours celui du « Compte chèque » (5 107,80 sur votre capture), même si l'ancien réglage traîne dans vos données. Le sélecteur « Solde suivi » du calibrage est retiré.",
            "PREUVE — les suites « Calibrage » et « Banque » rejouent l'ancien réglage : le solde du compte chèque est pris, jamais le total.",
        ] },
        { version: "37.87 Total Attijari", date: "2026-10-31", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.88');
