/* v37.66 Frise — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.65 Semaines";`, `const CURRENT_VERSION = "37.66 Frise";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.65 Semaines", date: "2026-10-27", changes: [`,
`                    const CHANGELOG = [
        { version: "37.66 Frise", date: "2026-10-27", changes: [
            "↩️ VOS SAISIES D'AVANT LA PAIE RESTENT DANS LEUR CYCLE (schéma 21) — « Pourquoi il y a déjà de l'info rentrée sur ce cycle alors qu'il vient de commencer ? Ce sont des infos d'hier et d'avant. » La v37.65 avait re-rangé la saisie du lundi 26 oct. (semaine où tombe la paie du mardi 27) sous le jour de paie : elle comptait dans le nouveau cycle. C'était une erreur : ce qui a été tapé avant la paie concerne les jours d'avant. Ces saisies (et leurs cases closes) reviennent au lundi, une seule fois, au chargement — seulement pour les données passées par la v37.65 ; rien d'autre ne bouge.",
            "UN TITRE QUI DIT CE QU'ON VOIT — « Début du cycle · mar. 27 oct. → dim. 1 nov. · 6 j », « Cycle précédent · lun. 26 oct. · 1 j », « Fin du cycle · … » : plus de note « semaine coupée » à déchiffrer. La semaine ne montre plus que ses postes « / sem » (son anneau, son reste et son prévu aussi) ; les postes « / 15 j » et « / cycle » ont leur bloc « 📅 Sur tout le cycle » (replié, mémorisé) : enveloppe du cycle, engagé, reste, saisie et clôture.",
            "LES SÉANCES TOUTES LES 2 SEMAINES — un cycle de 31 jours en couvre ≈ 2,2 : après la dernière séance payée, la prochaine (+ 14 jours) est annoncée. Avant la paie et plus grosse que le reste de l'enveloppe : « ⚠️ Prochaine séance ≈ 23 nov. : elle dépasserait l'enveloppe de 314 DH » ; après la paie : « ↪ … au cycle suivant » ; sinon « couverte ». Une seule note pour le bloc quand rien n'est encore payé.",
            "📈 LA FRISE DU CYCLE (à la demande, bouton « Frise du cycle » de la Météo) — l'axe du cycle avec ses morceaux de semaine (coupés par la paie signalés) et le trait d'aujourd'hui ; pour chaque catégorie, son engagé sur son budget et l'attendu à date ; pour chaque sous-catégorie « / sem », une case par morceau (tenu, en cours, au prévu, dépassé, à venir) ; pour les postes « / 15 j » et « / cycle », la barre de l'enveloppe et les séances (payées, prévues, au cycle suivant). En tête : les dépassements et chevauchements. Rien n'est calculé tant qu'elle est fermée.",
            "PREUVE — nouvelle suite « Sur tout le cycle, séances à la quinzaine, frise du cycle » : 24 contrôles (paie le 27, jeudi 12 nov., calculs faits à la main : Psy 400 / 15 j → enveloppe 886, payé 27 oct. et 9 nov., prochaine ≈ 23 nov. → 314 DH de trop). Rejouée sur la v37.65 : 8 en échec. Défauts réintroduits exprès (8 : séance à 7 jours, jamais « dépasserait », jamais « au cycle suivant », frise calculée fermée, info affichée ligne par ligne, case jamais dépassée, Psy laissé dans la semaine, trait d’aujourd’hui décalé d’un jour) : tous attrapés. La suite « Semaines coupées » vérifie maintenant que la saisie du 26 oct. reste en octobre (schéma 20 rendu au lundi, schéma 19 et 21 intouchés).",
        ] },
        { version: "37.65 Semaines", date: "2026-10-27", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.66 Frise');
