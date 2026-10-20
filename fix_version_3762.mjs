/* v37.62 Boutons — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.61 Saisie";`, `const CURRENT_VERSION = "37.62 Boutons";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.61 Saisie", date: "2026-10-20", changes: [`,
`                    const CHANGELOG = [
        { version: "37.62 Boutons", date: "2026-10-20", changes: [
            "🧹 TROIS BOUTONS FLOTTANTS — « laisse juste brain, journal et + » : au téléphone, 🧠 (CFO), 📑 (relevé) et ➕ (saisie rapide), sur UNE rangée en bas à droite, au-dessus des onglets. Avant : cinq boutons, dont une colonne au milieu de l'écran posée sur les montants du journal.",
            "🪄 Merlin quitte le téléphone (il reste au pied de la barre latérale, sur ordinateur). 💾 aussi : il ne clignotait que pendant les 2 secondes qui précèdent l'envoi AUTOMATIQUE au VPS ; un conflit entre appareils a son bandeau (« Imposer la version de cet appareil ») ; « Enregistrer maintenant » reste dans les Réglages.",
            "PREUVE — nouvelle suite « Boutons flottants » : 12 contrôles (trois boutons, une rangée, le milieu de l'écran libre, chacun répond, l'envoi au VPS toujours automatique). Rejouée sur la v37.61 : 6 contrôles en échec — dont un montant du journal caché sous un bouton. Cinq défauts réintroduits exprès : tous attrapés.",
        ] },
        { version: "37.61 Saisie", date: "2026-10-20", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.62 Boutons');
