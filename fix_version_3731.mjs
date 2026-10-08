/* v37.31 Prevu-Par-Defaut — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.30 Rythmes-Par-Ligne";`, `const CURRENT_VERSION = "37.31 Prevu-Par-Defaut";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.30 Rythmes-Par-Ligne", date: "2026-10-08", changes: [`,
`                    const CHANGELOG = [
        { version: "37.31 Prevu-Par-Defaut", date: "2026-10-08", changes: [
            "UNE SEMAINE ÉCOULÉE SANS SAISIE COMPTE SON PRÉVU — dès que le dimanche est passé, chaque ligne « / sem » (Marjane, L7m…) et chaque charge sans ligne (Sorties, Essence…) laissée vide compte son prévu de la semaine comme RÉALISÉ. Le Reste à dépenser, les Rayons X et le Pilotage en tiennent compte. La semaine en cours et les semaines à venir restent vierges (v37.28).",
            "VISIBLE ET CORRIGEABLE — dans la semaine écoulée, la case montre le prévu retenu (texte pâli, « ✓ au prévu »), et une note le dit : « les lignes laissées vides comptent leur prévu ». On y entre : la case se vide, le prévu reste en invite, on tape le vrai montant — 0 pour « rien dépensé » ; « +50 » part du prévu ; vider la case lui rend son prévu.",
            "PAS DE DOUBLE COMPTAGE — pas de prévu par défaut pour : une ligne /15 j ou /cycle (suivie sur le cycle) ; une ligne qui a un ticket daté cette semaine-là ; une catégorie saisie en vrac cette semaine-là (« Autre », ou un ticket non ventilé) ; une catégorie qui porte encore un ancien total de cycle. Moteur : engagé = max(saisi, tickets) + prévus retenus.",
            "RIEN N'EST ÉCRIT — le prévu retenu est calculé, pas stocké : il suit le prévu si on le modifie, et « effacer tout le cycle » ne touche que vos saisies. Rayons X : « ✓ Rien saisi ce cycle : les semaines écoulées comptent leur prévu » ou « ✓ + X au prévu » ; ⓘ : « dont au prévu (semaines écoulées sans saisie) ».",
            "TICKETS DU CYCLE = TICKETS DE SES SEMAINES — comme les saisies (règle du jeudi, v37.27) : un ticket du lundi 5 oct. compte dans le cycle qui commence le jeudi 8 (il ne comptait nulle part).",
            "PREUVE — suite nouvelle « Semaine écoulée sans saisie » (22 contrôles, horloges fixes mercredi 21 et dimanche 18 oct. 23 h) ; la suite « Reste à dépenser » joue désormais ses règles de saisie au dimanche 11 (aucune semaine écoulée) et la navigation par semaine au mercredi 14 (avec le prévu retenu). Douze défauts réintroduits exprès : tous attrapés.",
        ] },
        { version: "37.30 Rythmes-Par-Ligne", date: "2026-10-08", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.31 Prevu-Par-Defaut');
