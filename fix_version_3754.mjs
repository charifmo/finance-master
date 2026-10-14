/* v37.54 Banque-Reel — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.53 Banque";`, `const CURRENT_VERSION = "37.54 Banque-Reel";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.53 Banque", date: "2026-10-14", changes: [`,
`                    const CHANGELOG = [
        { version: "37.54 Banque-Reel", date: "2026-10-14", changes: [
            "📱 LE TÉLÉPHONE D'ABORD — « Touchez pour choisir vos captures » ouvre la GALERIE (images seulement, plusieurs à la fois ; le texte / CSV a son petit bouton à part). « 🏦 Importer mes captures bancaires » en tête de la saisie rapide (le ➕). Le ➕ était CACHÉ sous la baguette Merlin depuis la v34.08 : baguette et 💾 passent à gauche. 🪄 📑 🧠 ne couvrent plus les champs de la saisie rapide ni de l'import. La revue tient dans l'écran (compte sur sa ligne, actions lisibles). Une photo HEIC que le navigateur ne lit pas : « image illisible… envoyez une capture d'écran », au lieu d'un échec muet.",
            "🔎 VOS VRAIES CAPTURES — Attijari : les centimes en EXPOSANT (« 4 318,³⁵ ») relus seuls, trois fois, deux lectures d'accord font foi (vos 4 213,32 ne deviennent plus 4 213,52). Saham en thème SOMBRE : montants verts et dates grises lus d'un coup. Bank Assafa : la barre du bas et ses icônes ne deviennent plus un libellé ; l'opération coupée en bas d'écran est laissée. « DH » / « MAD » en exposant lus « ph », « mao », « \\"\\"° » : avalés.",
            "🖥️ ATTIJARINET EN CAPTURE PC — le jour seul dans sa colonne prend le mois de « OCTOBRE 2026 » ; un jour mal lu (« pis » pour 08) est complété par la seconde lecture ; « MARRAKECH ENNAKHIL 07/10 08H08 » (lieu, date, heure, sans CB) = un retrait ; « Total des mouvements » d'une période plus longue que la capture : « débits de la période… (capture partielle) », plus de faux ✓.",
            "🛡️ VIREMENTS — l'OCR colle les mots (« Emission vrtinstantane n174182 ») : c'est toujours un virement, jamais une dépense ajoutée au journal (votre −6 000 du 29/08 l'aurait été). Deux lectures de la même ligne (« 9/08 » et « 29/08 ») : une seule opération.",
            "🔒 DÉPÔT PUBLIC — les exemples de RIB de l'appli et les captures de test sont FICTIFS (identité « KARIM TESTEUR ») : vos vraies captures ne sont jamais dans le dépôt.",
            "PREUVE — nouvelle suite « Banque : vraies captures » : 40 contrôles (le VRAI OCR sur 4 captures pleine résolution et sur 3 envoyées par WhatsApp, les textes que l'OCR rend vraiment, le parcours au téléphone à 390 px). Rejouée sur la v37.53 : 18 contrôles en échec. Trente-trois défauts réintroduits exprès : tous attrapés. Vos 3 vraies captures, lues en local : tout juste (soldes, dates, montants, décisions).",
        ] },
        { version: "37.53 Banque", date: "2026-10-14", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.54 Banque-Reel');
