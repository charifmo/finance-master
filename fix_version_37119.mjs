/* v37.119 Le prévu au bon endroit — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.118 Du voyage au Flux";`, `const CURRENT_VERSION = "37.119 Le prévu au bon endroit";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.118 Du voyage au Flux", date: "2026-11-08", changes: [`,
`                    const CHANGELOG = [
        { version: "37.119 Le prévu au bon endroit", date: "2026-11-09", changes: [
            "🥬 « KHDRA 200 / SEM, ET IL CALCULE 181 CETTE SEMAINE ! » — les jours d'absence (voyage) retiraient leur part du cycle de TOUTES ses semaines (−10 % chacune : le « présence 90 % »). Ils sont maintenant retirés des jours d'absence eux-mêmes : une semaine sans voyage garde ses 200, la semaine du voyage perd seulement ses jours absents. Le total du cycle ne change pas.",
            "✏️ DE LA FRISE AU PRÉVU — double-clic sur le nom d'une ligne de la frise (ou son ✏️, ou « ✏️ Changer le prévu » dans le détail d'une case) : une charge variable ouvre le Budget Structurel, sa catégorie dépliée, la ligne surlignée et son montant prêt à changer ; une dépense exceptionnelle ouvre le Calendrier Pluriannuel (le Flux sur téléphone), son mois déplié, la ligne surlignée.",
        ] },
        { version: "37.118 Du voyage au Flux", date: "2026-11-08", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.119');
