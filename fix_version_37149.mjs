/* v37.149 Les centimes en exposant mieux lus — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.148 La saisie des montants ne repart plus de zéro";`, `const CURRENT_VERSION = "37.149 Les centimes en exposant mieux lus";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.148 La saisie des montants ne repart plus de zéro", date: "2026-11-17", changes: [`,
`                    const CHANGELOG = [
        { version: "37.149 Les centimes en exposant mieux lus", date: "2026-11-17", changes: [
            "🔍 « POURQUOI ILLISIBLE ? » (import Attijari Mobile : « Solde Compte chèque illisible sur cette capture ») — le solde « 2 168,⁸⁶ DH » (vert sur blanc, centimes en petit exposant) était lu « 2 168, 56P\\" » ; la relecture des centimes (trois essais, deux d'accord) n'en voyait qu'un rendre « 86 » (les autres : rien, ou « 8 », le « 6 » perdu à l'agrandissement). Désormais cinq essais, et les lectures à DEUX chiffres décident ; une lecture à un chiffre ne vaut plus « 80 » face à elles (avec plus d'essais, « 80 » l'aurait emporté : un solde faux). Toujours illisible plutôt qu'inventé quand les lectures se contredisent.",
            "PREUVE — test_banque_reel.mjs (B0) : neuf cas du vote (86 face à six « 8 » → 86, jamais 80 ; deux lectures à égalité, une seule sans confirmation, un chiffre qui contredit → illisible). Vérifié sur la vraie capture : « Compte chèque » 2 168,86 lu. Les quatre suites Banque passent.",
        ] },
        { version: "37.148 La saisie des montants ne repart plus de zéro", date: "2026-11-17", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.149');
