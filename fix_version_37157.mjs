/* v37.157 Le Relevé interactif — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.156 Calendrier : chaque ✕ visible";`, `const CURRENT_VERSION = "37.157 Le Relevé interactif";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.156 Calendrier : chaque ✕ visible", date: "2026-11-27", changes: [`,
`                    const CHANGELOG = [
        { version: "37.157 Le Relevé interactif", date: "2026-11-27", changes: [
            "👆 « JE VEUX QUE CE SOIT PLUS INTERACTIF, COMME LA FRISE : JE CLIQUE SUR UN TRUC, IL ME DONNE DES OPTIONS — ALLER DANS LA PARTIE MODIFIABLE, MODIFIER LA DATE, LA VALEUR OU LE NOM, ET ÇA SE MODIFIE DIRECT COMME SI JE L'AVAIS CHANGÉ LÀ-BAS ; MÊME CHOSE POUR LE DELETE » — chaque ligne prévue du Relevé de comptes sait maintenant ce qu'elle représente, et un clic ouvre sa fenêtre.",
            "CE QU'ON PEUT FAIRE — un flux du Calendrier (« ⚠️ Medoc Ma femme ») : nom, montant, mois, jour ; 🗑️ supprimer. Un virement : montant, mois, jour ; supprimer. Une épargne ou un revenu : le nom, le jour, et le montant DE CE MOIS (le montant de base ne bouge pas) ; « 🗑️ Retirer ce mois-ci » (la ligne reste au budget). Une créance attendue : montant et date. Partout : « ↗ Ouvrir dans … » (Calendrier, mois déplié ; Patrimoine & Objectifs ; Budget Structurel ; Créances). Une ligne qui regroupe (Total Charges Fixes, Factures, enveloppes de la semaine) le dit et renvoie au Budget. C'est l'élément lui-même qui change : Relevé, Budget, Calendrier et projection suivent ; supprimer demande une confirmation (« Oui, supprimer »).",
            "PREUVE — test_releve_interactif.mjs (vrai navigateur, vrai CSS : la fenêtre doit passer DEVANT le Relevé) : flux renommé, 3 500, le 12 → le Calendrier et le Relevé le montrent ; épargne de novembre 3 000 → 1 500 puis retirée ce mois-ci (décembre intact) ; virement déplacé au 5 décembre ; salaire de novembre seul à 18 000 ; créance au 24/11 ; flux supprimé ; ligne regroupée → Budget ; virement → Calendrier, décembre déplié.",
        ] },
        { version: "37.156 Calendrier : chaque ✕ visible", date: "2026-11-27", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.157');
