/* v37.27 Semaine-Glissante — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.26 Saisie-Par-Poste";`, `const CURRENT_VERSION = "37.27 Semaine-Glissante";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.26 Saisie-Par-Poste", date: "2026-10-07", changes: [`,
`                    const CHANGELOG = [
        { version: "37.27 Semaine-Glissante", date: "2026-10-08", changes: [
            "PAR SEMAINE, PAS PAR CYCLE — les postes sont des budgets hebdomadaires (Marjane : 400 / semaine) : on les saisit désormais à la semaine. La carte « Par semaine » s'ouvre sur la SEMAINE EN COURS (lundi → dimanche) ; les flèches ‹ › passent à la semaine passée ou à venir, « ↩ Cette semaine » ramène à la semaine en cours. Chaque ligne montre le reste de la semaine ; chaque poste, son prévu hebdomadaire, sa jauge et ses tickets datés de CETTE semaine.",
            "UNE SEMAINE APPARTIENT AU CYCLE OÙ TOMBE SON JEUDI (la majorité de ses jours). Le Reste à dépenser du cycle additionne les semaines qui lui appartiennent : saisir la semaine passée ou une semaine à venir (un achat payé d'avance) le met à jour. Une semaine d'un autre cycle le dit (« appartient au cycle précédent ») et ne change pas le Reste à dépenser affiché.",
            "PAS D'ESTIMATION TROMPEUSE — tant que rien n'est déclaré, la semaine EN COURS est estimée (≈, au prorata des jours écoulés) ; une semaine passée ou à venir sans saisie vaut 0, jamais « tout dépensé ».",
            "RIEN DE PERDU — chaque semaine est rangée sous son lundi dans le même compteur que le cycle (S2026-10-05 → alimentation::1, …) : rien de nouveau à sauvegarder. Les saisies de cycle d'avant (v37.23 à v37.26) restent comptées et sont rappelées sous la ligne (« saisis sur tout le cycle… · retirer »). La règle ne change pas : par catégorie, l'engagé est le plus grand entre les saisies et les tickets datés, jamais leur somme. « ↩ effacer tout le cycle » vide aussi les semaines du cycle.",
            "PREUVE — la suite « Reste à dépenser » (78 contrôles), jouée sur une horloge FIXE (mercredi 14 octobre 2026) pour que le calendrier ne dépende plus du jour du test : navigation ‹ ›, semaine passée, à venir, cycle précédent / suivant (frontières de début ET de fin), tickets rangés dans leur semaine, effacement du cycle. Rejouée sur la v37.26 : échec ; trois défauts réintroduits exprès (rattachement par le lundi, par le dimanche, flèches sans effet) sont attrapés.",
        ] },
        { version: "37.26 Saisie-Par-Poste", date: "2026-10-07", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.27 Semaine-Glissante');
