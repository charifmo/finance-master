/* v37.32 Memoire-Et-Alerte — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.31 Prevu-Par-Defaut";`, `const CURRENT_VERSION = "37.32 Memoire-Et-Alerte";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.31 Prevu-Par-Defaut", date: "2026-10-08", changes: [`,
`                    const CHANGELOG = [
        { version: "37.32 Memoire-Et-Alerte", date: "2026-10-08", changes: [
            "L'INTERFACE SE SOUVIENT — les mois dépliés du Calendrier pluriannuel, les « lignes de calcul » et « périodes » de chaque ligne du Budget Structurel, les accordéons (Pilotage, simulateur, audit, téléphone), les postes dépliés de la Météo : tout reste comme vous l'avez laissé, d'une session à l'autre.",
            "PAR APPAREIL, HORS DES DONNÉES — cet état vit dans le localStorage du navigateur (finance_ui_v1), plus dans les données financières : déplier un tiroir ne marque plus les données « modifiées », n'est plus envoyé au serveur, et le PC du bureau ne referme pas ce que le téléphone a ouvert. Sans choix enregistré, un tiroir garde son comportement d'avant (un panneau de périodes que le CFO vient de remplir s'ouvre toujours).",
            "LE DÉCOUVERT D'ABORD — un bloc rouge en tête de la Météo, avant le Reste à dépenser, pour chaque compte qui finit le cycle dans le rouge : son nom, ce qui manque en gros (− 2 644 DH), et l'action de sauvetage « ➜ Virer X depuis Y avant le Z » (le compte du radar, sinon celui qui atterrit le plus haut et couvre l'écart). Aucun compte ne couvre ? On le dit. Le découvert du courant ne tient qu'à la conso entière ? « ou : tenez-vous au Reste à dépenser ». Le paragraphe ne répète plus le découvert.",
            "MOINS DE BRUIT — la carte « Reste à dépenser » perd ses tuiles « ≈ par semaine » et « par jour » ; le nombre de jours avant la paie rejoint la ligne « d'ici la paie du … (dans N j) ». L'explication ⓘ et les Rayons X n'affichent plus non plus de « par semaine ».",
            "PREUVE — suite nouvelle « L'interface se souvient · le découvert d'abord » (22 contrôles) : tiroirs rouverts après rechargement (bureau et téléphone), données intactes, défaut du CFO respecté ; découvert du courant avec virement, sans donneur, « évitable », découvert d'un autre compte, ciel dégagé. Dix défauts réintroduits exprès : tous attrapés. Un défaut réel trouvé en route : un tiroir ouvert pour la première fois ne se redessinait qu'au rechargement (lecture non suivie par Vue).",
        ] },
        { version: "37.31 Prevu-Par-Defaut", date: "2026-10-08", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.32 Memoire-Et-Alerte');
