/* v37.99 Mes applis — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.98 Aujourd'hui";`, `const CURRENT_VERSION = "37.99 Mes applis";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.98 Aujourd'hui", date: "2026-11-03", changes: [`,
`                    const CHANGELOG = [
        { version: "37.99 Mes applis", date: "2026-11-04", changes: [
            "🧩 MES APPLIS — un bouton dans chaque appli (écran Aujourd'hui, menu, barre du téléphone ; en-tête de Santé) ouvre le choix : Finance, Santé, puis Psy et Voyage (« bientôt »). L'appli où vous êtes est marquée « ici ».",
            "📱 UNE PAGE D'ACCUEIL — /finance/accueil.html : les tuiles de toutes vos applis, à ajouter sur l'écran d'accueil du téléphone.",
            "➕ AJOUTER UNE APPLI = UNE LIGNE dans apps.json (nom, icône, adresse) : elle apparaît partout, sans toucher aux applis existantes.",
        ] },
        { version: "37.98 Aujourd'hui", date: "2026-11-03", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.99');
