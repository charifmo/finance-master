/* v37.55 Calibrage-RIB — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.54 Banque-Reel";`, `const CURRENT_VERSION = "37.55 Calibrage-RIB";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.54 Banque-Reel", date: "2026-10-14", changes: [`,
`                    const CHANGELOG = [
        { version: "37.55 Calibrage-RIB", date: "2026-10-15", changes: [
            "💰 LE BON SOLDE — l'import proposait le total « Mes comptes » (3 945) quand le solde du « Compte chèque » n'était pas lu. Plus jamais : le solde SUIVI ou rien, avec « ⚠️ Solde « Compte chèque » illisible sur cette capture : solde non mis à jour ». « Mes comptes » est nommé pour ce qu'il est : le TOTAL de vos comptes Attijari.",
            "🎯 UN SEUL BOUTON — « Calibrer avec une capture » en tête du Calibrage (Trésorerie), plusieurs captures à la fois : l'écran « Détails du compte » de votre appli suffit (RIB + n° de compte). Un compte reconnu est complété ; un inconnu demande une fois « À quel compte ? ». Plus de bouton par compte.",
            "🔗 LE N° ET LE RIB RAPPROCHÉS — l'accueil Attijari montre « 000999B… », le RIB contient « 0009992… » (la lettre devient un chiffre dans un RIB marocain). Calibré une fois avec le RIB, le compte est reconnu à chaque import, SANS question, même quand l'OCR lit « 8 » pour « B ».",
            "📄 « DÉTAILS DU COMPTE » LU — RIB à clé de contrôle vérifiée, banque déduite de son code (007 Attijari, 362 Assafa, 022 Saham), n° de compte gardé seulement s'il colle au RIB, solde ; aucune opération inventée. « PAIEMENT CB 141026 » : la date d'achat lue sans séparateurs.",
            "PREUVE — nouvelle suite « Banque : calibrer une fois » : 27 contrôles (le VRAI OCR sur un écran « Détails du compte » fictif, en 248 px comme envoyé par WhatsApp, puis l'accueil reconnu sans question). Rejouée sur la v37.54 : 6 contrôles en échec (et ses sections B, C, D n'y tournent pas). Dix-neuf défauts réintroduits exprès : tous attrapés. Vos captures réelles, lues en local : RIB reconnu, accueil sans question, solde 3 839,78.",
        ] },
        { version: "37.54 Banque-Reel", date: "2026-10-14", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.55 Calibrage-RIB');
