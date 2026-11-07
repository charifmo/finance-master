/* v37.104 Catégorie par recherche — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.103 Exceptionnelles rangées";`, `const CURRENT_VERSION = "37.104 Catégorie par recherche";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.103 Exceptionnelles rangées", date: "2026-11-06", changes: [`,
`                    const CHANGELOG = [
        { version: "37.104 Catégorie par recherche", date: "2026-11-07", changes: [
            "🔍 CHOISIR UNE CATÉGORIE EN CHERCHANT — la longue liste déroulante est remplacée partout (saisie, saisie rapide, « autre… » dans « À vérifier », journal : filtre, clic sur la catégorie, modifier ; frise) par un panneau avec une recherche déjà active : « dies » → diesel skoda (Voiture) ; « voiture » → la mère et toutes ses lignes ; accents et majuscules ne comptent pas ; plusieurs mots (« eau villa ») sont tous retrouvés.",
            "📱 Au téléphone, le panneau s'ouvre en haut de l'écran : le clavier ne cache ni la recherche ni les résultats. Sans recherche, toute la liste, rangée comme avant ; ↑ ↓ Entrée au clavier, Échap ou un appui à côté pour fermer.",
        ] },
        { version: "37.103 Exceptionnelles rangées", date: "2026-11-06", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.104');
