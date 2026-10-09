/* v37.34 Pointage-Sans-Double — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.33 Atterrissage-Comptes";`, `const CURRENT_VERSION = "37.34 Pointage-Sans-Double";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.33 Atterrissage-Comptes", date: "2026-10-09", changes: [`,
`                    const CHANGELOG = [
        { version: "37.34 Pointage-Sans-Double", date: "2026-10-09", changes: [
            "DOUBLE COMPTAGE CORRIGÉ — une entrée exceptionnelle (prime de 23 781 DH) cochée dans le Réalisé apparaissait à 47 562 DH dans le Relevé. La case enregistrait le montant SIGNÉ (− 23 781) ; le moteur, qui raisonne en valeur absolue, lisait « − 23 781 réglés sur 23 781 » : pas réglée, reste 23 781 − (− 23 781) = 47 562, projetés en plus du solde où la prime était déjà. Un pointage se lit désormais en MONTANT, quel que soit l'écran qui pose la question ; les primes déjà cochées avec la version précédente se lisent juste, sans migration.",
            "UN FLUX POINTÉ SORT DES CHOCS À VENIR — même prévu pour un cycle futur (reçu ou payé en avance) : le Relevé, le radar jusqu'en décembre et le tableau des flux ne le reprojettent plus. Reçu en partie : seul le reste est projeté.",
            "LES ENTRÉES EN VERT — une rentrée exceptionnelle s'affiche « + 23 781 DH » en vert (plus « − 23 781 DH »), dans la checklist comme dans l'ancienne checklist du téléphone.",
            "LA CHECKLIST EN TIROIRS — « À traiter » se range par nature : 🟢 Entrées d'Argent, 🏢 Charges fixes, 🛒 Charges variables, 💎 Épargne & virements, ⚡ Flux exceptionnels. Fermés d'office, chaque en-tête dit l'essentiel (combien, en retard, sous 7 jours, le montant) ; ouvert / fermé est mémorisé (v37.32) ; la carte « Urgence » ouvre les tiroirs qui portent l'urgent. Dans un tiroir, uniquement ce qui RESTE à faire, par date.",
            "CE QUI EST FAIT S'EN VA — une ligne cochée quitte son tiroir pour « ✅ Déjà validé », en bas, replié et grisé (on y décoche pour remettre à traiter). Les listes en doublon sous la file (« Entrées d'Argent », « Vue détaillée par catégorie ») disparaissent : chaque ligne n'existe plus qu'à un endroit. Les postes suspendus du mois sont dits en une ligne.",
            "PREUVE — suite nouvelle « Un flux pointé n'est plus projeté · la checklist en tiroirs » (36 contrôles, montants à la main) : la prime pointée par la v37.33 (76 343 → 28 781), pointée dans la nouvelle checklist, reçue en partie, un flux de décembre reçu en avance, une dépense ; tiroirs, déjà validé, mémoire, téléphone. Rejouée sur la v37.33, elle retrouve le 47 562 du Relevé. Quinze défauts réintroduits exprès : tous attrapés.",
        ] },
        { version: "37.33 Atterrissage-Comptes", date: "2026-10-09", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.34 Pointage-Sans-Double');
