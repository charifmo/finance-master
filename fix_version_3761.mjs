/* v37.61 Saisie — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.60 Apprentissage";`, `const CURRENT_VERSION = "37.61 Saisie";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.60 Apprentissage", date: "2026-10-19", changes: [`,
`                    const CHANGELOG = [
        { version: "37.61 Saisie", date: "2026-10-20", changes: [
            "🔢 LE MONTANT LU JUSTE — « Marjane 1 250 » enregistrait 1 DH, « 7up 10 » 7 DH, « iam 4g 50 » 4 DH, « 1.250 loyer » 1,25 DH, « café 15dh » le libellé « café dh ». Désormais : un nombre collé à des lettres est un nom, « 1 250 » et « 1.250 » sont des milliers, le nombre en fin (sinon en tête) de texte est le montant, DH / MAD / درهم avalés, chiffres arabes (١٥٠) compris.",
            "🧹 RIEN DE PÉRIMÉ — effacer le nombre (« 50 café » → « café ») laissait 50 DH prêt à partir ; effacer le libellé le gardait ; le libellé changé dans « ⚙️ Ajuster » ne changeait pas la catégorie ; « — Catégorie — » rangeait « à la main » dans « non catégorisé » (désormais « 🤖 Automatique »).",
            "🕘 LA BONNE HEURE — la page restée ouverte, la saisie prenait l'heure du formulaire précédent (hier matin au lieu de ce soir : mauvais jour, mauvais cycle). « Maintenant » = l'instant de la validation, tant que vous n'avez pas choisi une date.",
            "📅 LA BONNE ANNÉE, JAMAIS UNE SAISIE PERDUE — une saisie datée d'une autre année tombait dans l'année AFFICHÉE (le 2 janvier compté en janvier de l'année d'avant) ; l'année absente, elle disparaissait et le formulaire se vidait. Désormais l'année de la date, créée au besoin (copie de la plus proche, comme « Ajouter une année ») ; un échec garde le formulaire et le dit.",
            "⚡ LA SAISIE RAPIDE (le ➕) — le clavier s'ouvre tout de suite ; un seul champ puis l'étiquette (💵 montant, 🏦 compte, 📅 Maintenant) et « ⚙️ Ajuster » pour le reste : 4 éléments à l'écran au lieu de 9. L'import des captures reste en tête.",
            "↶ ANNULER — après chaque saisie : « ✓ café · 15 DH → cafe Resto Wknd · Compte Courant » et « ↶ Annuler » (6 secondes). « ⚠️ Déjà saisi aujourd'hui à 08:10 » quand le même libellé au même montant l'est déjà. Le COMPTE de votre dernière saisie du même libellé est repris (« · appris »).",
            "🗂️ UNE SEULE LISTE DE CATÉGORIES — la saisie montrait six lignes vides « — », des catégories de revenus, « Misc », les lignes à plat ; elle propose désormais la liste du journal (familles, leurs lignes). Téléphone : les filtres du journal repliés (« ⚙️ Filtres »), la page assez longue pour que les boutons flottants ne cachent plus le bas, « N op. ce cycle » en tête, « 0 DH » au lieu de « −0 DH ».",
            "PREUVE — nouvelle suite « Saisie » : 26 contrôles, au téléphone (390 px), vos gestes rejoués. Rejouée sur la v37.60 : 15 contrôles en échec (et plusieurs sections n'y tournent pas). Vingt-trois défauts réintroduits exprès : tous attrapés.",
        ] },
        { version: "37.60 Apprentissage", date: "2026-10-19", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.61 Saisie');
