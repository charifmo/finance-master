/* v37.21 Rayons-X — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.20 Pulse-Hebdo";`, `const CURRENT_VERSION = "37.21 Rayons-X";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.20 Pulse-Hebdo", date: "2026-10-05", changes: [`,
`                    const CHANGELOG = [
        { version: "37.21 Rayons-X", date: "2026-10-05", changes: [
            "🔍 RAYONS X — dans la Liberté, chaque catégorie (Courses, Voiture…) est une tuile : au survol (souris) ou au toucher (téléphone), un panneau liste les vraies dépenses de la semaine qui composent son total — date, libellé, compte payeur, montant — puis le reste. La somme des lignes est le total affiché, au dirham : le budget s'audite d'un geste. Clic = épingler, Échap ou toucher ailleurs = fermer. Le lien « hors budget conso » s'audite de la même façon.",
            "LE PANNEAU NE SE CACHE JAMAIS — il est téléporté dans la page (position fixe, z-index 9999), recalé dans l'écran et retourné au-dessus de la ligne s'il manque de place en dessous : aucune carte, aucun flou ni aucun débordement ne peut le rogner.",
            "QUEL COMPTE PAIE QUOI — chaque compte a un monogramme : sa couleur (stable depuis la v37.18) + 2-3 lettres, avec le nom de la banque quand le libellé la contient (« Compte Principale Assafa » → AS Assafa, « Épargne CIH » → CIH). Le même carré partout : pastilles de routage de l'Inbox et du Prévisionnel, Liberté (« sur CO Courant »), Sanctuaire, lignes du panneau. Un achat payé depuis un autre compte que celui des variables est marqué « ≠ prévu ».",
            "SANCTUAIRE PAR COMPTE — une barre partagée aux couleurs des comptes, puis une ligne par compte payeur : « Assafa 8 131 DH · 4 prélèvements · dont 1 120 en retard ». Survol/toucher → les prélèvements de ce compte (date, nature, montant) : on sait combien laisser sur quel compte. Rangement = la règle du Relevé, et Σ des comptes = carte Urgence.",
            "CARTE LIBERTÉ ALLÉGÉE — un chiffre vedette (le « DH » en retrait), une jauge fine, une ligne de légende, UNE seule note (la plus importante), puis les catégories en lignes avec anneau de progression au lieu d'une pile de barres grises. Au bureau, le Sanctuaire passe sous le verdict et la Liberté occupe la colonne de droite : deux colonnes de même hauteur. Au téléphone, les tuiles défilent au doigt et la Météo garde de la place sous elle.",
            "PREUVE — nouvelle suite « Rayons X & routage » (36 contrôles) : lignes = transactions de la semaine et Σ = total pour chaque catégorie, compte de chaque ligne, Sanctuaire par compte = règle du Relevé, même monogramme dans les trois vues, panneau dans <body> réellement au-dessus de tout, survol / épinglage / Échap / toucher. Rejouée sur la v37.20 : échec ; quatre défauts réintroduits exprès sont tous attrapés.",
        ] },
        { version: "37.20 Pulse-Hebdo", date: "2026-10-05", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.21 Rayons-X');
