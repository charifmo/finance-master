/* v37.78 Journal → Pilotage — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.77 Lisible";`, `const CURRENT_VERSION = "37.78 Journal → Pilotage";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.77 Lisible", date: "2026-10-29", changes: [`,
`                    const CHANGELOG = [
        { version: "37.78 Journal → Pilotage", date: "2026-10-29", changes: [
            "🧾 UNE FACTURE DÉJÀ PAYÉE N'EST PLUS « À SAISIR » — « Facture élec déjà saisie, mais elle apparaît à 0 dans la partie saisie. » L'opération importée de la banque était bien rangée sur « elect », mais une ligne du Pilotage ne se réglait que par sa propre case ou par un « pointage » à l'import : le journal disait payé, le Pilotage « Saisir », et le Relevé projetait encore la facture à sa date — alors qu'elle avait déjà quitté le compte (comptée deux fois).",
            "✅ DÉSORMAIS — pour une ligne du Pilotage (charge fixe, ligne d'une catégorie mensuelle comme les factures, épargne), les opérations du journal rangées sur sa catégorie et datées dans le cycle la règlent (un jour au moins égal au jour de paie ouvre le cycle suivant). La case et le journal ne s'additionnent pas : c'est le plus grand des deux qui compte — le même paiement vu deux fois. Payée en partie (Orange 49 pour 99 prévus) : le reste reste attendu. Une opération rangée « par défaut » (libellé inconnu) ne règle rien ; les postes de la semaine (courses…) gardent leur saisie.",
            "PREUVE — nouvelle suite « Le journal règle sa ligne du Pilotage » : facture réglée par l'import, réglée en partie, cycle précédent et « par défaut » sans effet, poste de la semaine non concerné, case + journal sans double compte, Relevé qui ne projette plus ce qui est payé. Rejouée sur la v37.77 : 6 en échec ; défauts réintroduits exprès : attrapés.",
        ] },
        { version: "37.77 Lisible", date: "2026-10-29", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.78');
