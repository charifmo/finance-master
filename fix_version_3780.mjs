/* v37.80 Même jour — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.79 Dates";`, `const CURRENT_VERSION = "37.80 Même jour";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.79 Dates", date: "2026-10-29", changes: [`,
`                    const CHANGELOG = [
        { version: "37.80 Même jour", date: "2026-10-29", changes: [
            "🔁 LE MÊME JOUR, L'ARGENT ARRIVE AVANT DE PARTIR — « Pourquoi c'est désynchronisé ? » Le Relevé de ce cycle finissait positif, la grande case réclamait un virement : elle regarde plus loin, jusqu'au 26 déc. Le 27 nov., la paie ouvre le cycle suivant, son premier morceau de semaine part du Courant dès le 27… et le virement d'Assafa n'arrivait que le 28 — sous zéro un seul jour. Désormais, le même jour, les entrées (salaire, virement reçu) passent avant les dépenses : un virement posé le jour de paie couvre les dépenses de ce jour.",
            "⏭️ LA GRANDE CASE DIT OÙ ELLE REGARDE — quand le compte passe sous zéro après la fin du cycle affiché : « c'est au début du cycle suivant, après le 26 nov. — Vos comptes et le Relevé de ce cycle s'arrêtent avant ». Même mention dans Sécurité des comptes.",
            "💡 ET QUEL VIREMENT AVANCER — quand la première entrée qui suit le creux est un virement qui suffit, et que le creux tombe après la paie : « Plutôt : avancez ce virement du 28 nov. au 27 nov. — le compte ne passe plus sous zéro ». Jamais avant la paie : rien ne dit alors que l'argent du virement est déjà là.",
            "PREUVE — nouvelle suite « Le même jour » : creux du 27 nov. reproduit (fin de cycle positive), « après le cycle » et « avancez du 28 au 27 nov. » dans le radar et la grande case, virement posé le 27 : plus de creux, plus de case. Rejouée sur la v37.79 : en échec ; défauts réintroduits exprès : attrapés.",
        ] },
        { version: "37.79 Dates", date: "2026-10-29", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.80');
