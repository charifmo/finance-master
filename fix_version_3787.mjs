/* v37.87 Total sans virgule — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.86 Solde Attijari";`, `const CURRENT_VERSION = "37.87 Total Attijari";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.86 Solde Attijari", date: "2026-10-31", changes: [`,
`                    const CHANGELOG = [
        { version: "37.87 Total Attijari", date: "2026-10-31", changes: [
            "🏦 « SOLDE MES COMPTES ILLISIBLE » — votre compte suit le TOTAL « Mes comptes ». Relu sur votre vraie capture avec l'OCR de l'appli : le total « 5 212,11 DH » (gros caractères) est rendu « 521211DH » — la virgule est perdue — donc jamais reconnu comme un montant ; le compte chèque (5 107,80) était, lui, bien lu. Désormais : un montant de l'en-tête collé à sa devise, sans virgule, vaut ses deux derniers chiffres en centimes (521211DH → 5 212,11 DH).",
            "PREUVE — la suite « Solde Attijari » rejoue le texte exact rendu par l'OCR (« 521211DH © »). Rejouée sur la v37.86 : en échec.",
        ] },
        { version: "37.86 Solde Attijari", date: "2026-10-31", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.87');
