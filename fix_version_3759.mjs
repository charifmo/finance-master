/* v37.59 Rangees — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.58 Lecons-IA";`, `const CURRENT_VERSION = "37.59 Rangees";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.58 Lecons-IA", date: "2026-10-16", changes: [`,
`                    const CHANGELOG = [
        { version: "37.59 Rangees", date: "2026-10-18", changes: [
            "🚨 LE DÉCALAGE CAPTURE ↔ IMPORT — Attijari Mobile, écran « Compte chèque » : l'OCR lisait la colonne des libellés, PUIS celle des montants ; l'application les recollait dans l'ordre. Le premier libellé (« AWBGAB… », sous le bouton « Remonter ») écarté, CHAQUE montant glissait d'une ligne : « Carrefour » recevait le montant du retrait GAB, « VIR WEB » celui de la pharmacie (ignorée comme virement), « G2ABVSHOP » celui du virement reçu…",
            "📐 CHAQUE MONTANT SUR SA LIGNE — chaque ligne lue par l'OCR est rangée à sa HAUTEUR sur la capture : un montant rejoint le libellé qui est à son niveau, l'ordre de lecture ne décide plus. L'écran « Compte chèque » est reconnu (Attijari, libellé d'abord). Un écran inconnu : des montants restés en colonne vont aux opérations datées, jamais à un bout d'interface. « Remonter » n'est plus un libellé ; « CB17 10 26 » donne sa date d'achat ; l'icône ↗ lue « 2) » et une année lue « 2020 » sont écartées.",
            "🧾 L'ANTI-DOUBLON COMPARE LE COMMERÇANT — « PAIEMENT CB 17 10 26 MCDO » et « … Carrefour », même jour, même montant, passaient pour la même opération (les 10 premiers signes suffisaient) : l'achat restait « déjà traité », jamais ajouté. Désormais « PAIEMENT CB » et la date d'achat ne comptent plus.",
            "✏️ VOS IMPORTS DÉCALÉS RÉPARÉS — réimportez la même capture : une ligne de même compte, même date, même montant au centime, déjà importée sous le libellé de sa voisine, est proposée « ✏️ Corriger » (l'opération du journal reprend son vrai libellé et sa catégorie — sauf une catégorie choisie par vous) ou « 🗑 Retirer » (un retrait, un virement ajouté à tort). Jamais un second ajout. Une opération du journal déjà liée à une ligne de banque n'est plus rapprochée d'une autre du même montant.",
            "PREUVE — nouvelle suite « Banque : chaque montant sur sa ligne » : 30 contrôles (le texte que l'OCR a VRAIMENT rendu sur l'écran « Compte chèque », contenu fictif ; les lignes de l'OCR rangées par hauteur ; le VRAI OCR sur une maquette fictive, pleine résolution et WhatsApp ; un import décalé réparé). Rejouée sur la v37.58 : 24 contrôles en échec (et la section des rangées n'y tourne pas). Seize défauts réintroduits exprès : quinze attrapés ; le seizième (abaisser le seuil de 50 % de chevauchement vertical) ne change rien de visible sur ces écrans. Votre capture, lue en local (jamais dans le dépôt) : les 11 opérations justes.",
        ] },
        { version: "37.58 Lecons-IA", date: "2026-10-16", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.59 Rangees');
