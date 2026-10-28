/* v37.74 Jour exact — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.73 Attente CFO";`, `const CURRENT_VERSION = "37.74 Jour exact";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.73 Attente CFO", date: "2026-10-28", changes: [`,
`                    const CHANGELOG = [
        { version: "37.74 Jour exact", date: "2026-10-28", changes: [
            "📅 LE JOUR EXACT DANS LE CALENDRIER PLURIANNUEL — « Il faut ajouter une case jour exact du mois. » Chaque choc et chaque virement interne a maintenant sa case « 📅 j. », sur le bureau comme sur le téléphone. Vide : sans jour précis, comme avant. Le Relevé, la Météo et les cycles savaient déjà placer un flux à son jour — mais on ne pouvait pas le saisir : un nouveau choc prenait en silence le jour de sa création, un virement tombait le 20.",
            "🗓️ BORNÉE AU MOIS — 31 saisi en novembre devient le 30 ; février compte 28 ou 29 jours selon l'année. Une case vidée retire le jour (le flux redevient « sans jour précis »).",
            "💶 APRÈS LA PAIE, ON LE VOIT — un jour au moins égal à votre jour de paie fait compter le flux dans le cycle suivant (la règle existait déjà dans les calculs, elle n'était écrite nulle part) : la ligne l'affiche, « après paie → Décembre ». C'est aussi le cas des chocs déjà créés un jour de fin de mois.",
            "PREUVE — nouvelle suite « Jour exact » (16 contrôles) : cases présentes et préremplies, saisie, borne du mois, case vidée, 0 refusé, passage au cycle suivant pour les chocs et les virements, téléphone. Rejouée sur la v37.73 : en échec ; défauts réintroduits exprès (pas de borne, case vidée qui laisse le jour, badge absent) : attrapés.",
        ] },
        { version: "37.73 Attente CFO", date: "2026-10-28", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.74 Jour exact');
