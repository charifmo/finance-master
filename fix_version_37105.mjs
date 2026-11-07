/* v37.105 Le compte suit la catégorie — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.104 Catégorie par recherche";`, `const CURRENT_VERSION = "37.105 Le compte suit la catégorie";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.104 Catégorie par recherche", date: "2026-11-07", changes: [`,
`                    const CHANGELOG = [
        { version: "37.105 Le compte suit la catégorie", date: "2026-11-07", changes: [
            "🔗 LE COMPTE SUIT LA CATÉGORIE — changer la catégorie d'une opération (journal, frise) ou la trouver à la saisie met le compte qui va avec : celui de la ligne du budget qui la porte (le compte choisi sur la charge, ou celui de sa famille ; la source d'une épargne ou d'une dépense exceptionnelle, comme « Voyage Marrakech »). L'écran dit pourquoi (« 🔗 compte de « Voyage Marrakech » »). Un compte que vous avez choisi vous-même ne bouge plus.",
            "⚡ LA FRISE DU CYCLE MONTRE LES DÉPENSES EXCEPTIONNELLES — un bloc « ⚡ Dépenses exceptionnelles » : chaque dépense prévue dans le cycle (Flux), réel / prévu, un repère à sa date ; « Autres » pour ce qui est rangé dans « Dépense exceptionnelle » sans ligne prévue ; un dépassement s'affiche dans les alertes ; toucher une ligne montre ses opérations.",
            "🧠 L'APPRENTISSAGE RETIENT VOS COMPTES — prenez un autre compte que celui de la catégorie : c'est retenu (« diesel skoda se paiera avec Compte Courant, sans vous redemander »), dans le journal comme à la saisie. Revenir au compte de la ligne efface ce choix. « Ce que l'appli a appris de vous » montre les « 💳 Comptes par catégorie », 🗑 pour oublier.",
        ] },
        { version: "37.104 Catégorie par recherche", date: "2026-11-07", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.105');
