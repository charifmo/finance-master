/* v37.50 Compte-Par-Ligne — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.49 Categorisation";`, `const CURRENT_VERSION = "37.50 Compte-Par-Ligne";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.49 Categorisation", date: "2026-10-13", changes: [`,
`                    const CHANGELOG = [
        { version: "37.50 Compte-Par-Ligne", date: "2026-10-14", changes: [
            "UN COMPTE PAR LIGNE — chaque charge fixe et chaque charge variable a sa puce « 🏦 » : « par défaut » (le compte de sa famille, réglé en tête de section) ou le compte de CETTE ligne (ex. « Syndic magasin » sur le Courant pendant que les autres charges fixes partent d'Assafa). Sur mobile, l'encart « ← Prélevé sur » devient ce choix. Tant que rien n'est choisi, aucun chiffre ne bouge (vérifié au dirham sur vos données).",
            "PARTOUT LA MÊME RÈGLE — le Relevé (cycle en cours et cycles futurs : une ligne « 💳 Total Charges Fixes » par compte), le reste à payer et les cartes par compte, l'enveloppe conso (chaque compte porte le reste de SES catégories), les tâches du Pilotage, le surplus et la Météo (une charge payée par un compte d'épargne passe à part, comme une dépense exceptionnelle), la projection et le CFO côté serveur. Le vieux champ « sourceCompte » de ces lignes, à « courant » partout, reste ignoré.",
            "AJOUTER UNE LIGNE, PARTOUT — « + Ajouter un revenu / une charge fixe / une charge variable » toujours visible, discret : la ligne naît avec son nom prêt à taper, dans l'année affichée ET les suivantes. Un montant tapé est repris par les années suivantes encore à 0 (jamais par-dessus un montant saisi).",
            "DOUBLE-CLIC POUR RENOMMER — sur un revenu, une charge, une épargne, un compte : Entrée garde, Échap annule ; les années suivantes qui portaient le même nom suivent. Le bouton « ✏️ Éditer noms » disparaît ; « Scinder » et « Supprimer » rejoignent les options de la ligne (« Gérer périodes »), la suppression demande confirmation.",
            "PREUVE — nouvelle suite « Un compte par ligne » : 27 contrôles calculés à la main (Loyer 3 000 sur Assafa, Syndic magasin 300 sur le Courant, Voiture sur Assafa : reste à payer, Relevé d'octobre et de novembre, enveloppe, cartes, tâches, surplus 10 900 puis 11 200 quand le Syndic passe sur l'épargne, CFO PHP au dirham ; double-clic, ajout, montant, compte, suppression, épargne, comptes, mobile). Rejouée sur la v37.49 : 9 contrôles en échec. Seize défauts réintroduits exprès : tous attrapés.",
        ] },
        { version: "37.49 Categorisation", date: "2026-10-13", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.50 Compte-Par-Ligne');
