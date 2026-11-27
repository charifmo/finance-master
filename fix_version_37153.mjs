/* v37.153 L'épargne variable se voit au Budget — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.152 Les restes du cycle d'avant";`, `const CURRENT_VERSION = "37.153 L'épargne variable se voit au Budget";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.152 Les restes du cycle d'avant", date: "2026-11-27", changes: [`,
`                    const CHANGELOG = [
        { version: "37.153 L'épargne variable se voit au Budget", date: "2026-11-27", changes: [
            "📅 « D'OÙ VIENT CE VIREMENT DE 22 K ? JE NE LE VOIS NULLE PART » — « Y'EN A PAS !! » : le Relevé du cycle de décembre montrait « 💎 Transfert → Alimentation Dépenses Annuelles & Projets 22 210 », le Budget Structurel « 3 000 DH /mois ». Les deux disaient vrai : décembre a une exception (« ⚖️ Adapter au potentiel » met dans chaque mois ce qui y reste), que le Relevé applique — mais le bloc Épargne du Budget n'affichait que le montant de base, sans trace des mois qui varient.",
            "DÉSORMAIS — sous le montant d'une épargne qui varie : « 📅 variable : déc. 22 210 DH · adaptée au potentiel » (au bureau et au téléphone) ; un clic ouvre Patrimoine & Objectifs, où ces mois se règlent (« Montant variable selon le mois », « ↩ retirer » l'adaptation). PREUVE — test_epargne_variable_visible.mjs : décembre 22 210 et novembre 3 000 au moteur, le résumé à l'écran sur la seule ligne qui varie, le clic.",
        ] },
        { version: "37.152 Les restes du cycle d'avant", date: "2026-11-27", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.153');
