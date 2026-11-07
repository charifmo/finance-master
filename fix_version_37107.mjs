/* v37.107 La frise à portée de doigt — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.106 La saisie apprend";`, `const CURRENT_VERSION = "37.107 La frise à portée de doigt";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.106 La saisie apprend", date: "2026-11-07", changes: [`,
`                    const CHANGELOG = [
        { version: "37.107 La frise à portée de doigt", date: "2026-11-07", changes: [
            "📈 PENDANT LA SAISIE, LA FRISE EN UN APPUI — au téléphone, 📈 rejoint la rangée des boutons flottants de l'écran Saisie (📈 🧠 📑 ➕) ; dans la saisie rapide, « 📈 Frise » dans l'en-tête ; sur ordinateur, une pastille « 📈 Frise du cycle » en bas à droite.",
            "✅ DÉJÀ SAISIE = PLUS ATTENDUE — une dépense exceptionnelle (« Four maman ») saisie dans sa catégorie restait projetée dans le Relevé, comptée deux fois. Une opération rangée dans sa catégorie, dans son cycle, la règle désormais : le Relevé, l'atterrissage, le radar et le Pilotage ne l'attendent plus (le reste seulement, si elle est payée en partie). Même chose pour une charge variable mensuelle sans ligne de détail.",
            "🔢 LES CURSEURS NE CACHENT PLUS LES CHIFFRES — dans la frise, les repères (séance payée ●, prochaine ○, date prévue) passent derrière « 452 DH sur le cycle », translucides ; les chiffres ont un léger fond blanc. Le trait « aujourd'hui » de l'axe ne coupe plus les dates.",
        ] },
        { version: "37.106 La saisie apprend", date: "2026-11-07", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.107');
