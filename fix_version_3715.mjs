/* v37.15 Releve-Cycle — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};

sub('CURRENT_VERSION',
    `const CURRENT_VERSION = "37.14 Mois-Budgetaire";`,
    `const CURRENT_VERSION = "37.15 Releve-Cycle";`);

sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.14 Mois-Budgetaire", date: "2026-09-28", changes: [`,
`                    const CHANGELOG = [
        { version: "37.15 Releve-Cycle", date: "2026-09-28", changes: [
            "LE DÉSORDRE ANNONCÉ N'EXISTAIT PAS, ET IL FALLAIT LE DIRE AVANT DE TOUCHER AU CODE — mesuré sur le cas exact du ticket (paie le 27, cycle « 27 sep → 26 oct ») : le salaire du j.27 est DÉJÀ la première ligne du Relevé, pas la dernière. Le tri du journal ramenait depuis longtemps chaque jour à son rang depuis la paie, si bien que le j.1 se range bien APRÈS le j.27. Cette version verrouille ce comportement par un contrôle automatique pour qu'il ne se reperde pas, mais elle ne le corrige pas : il n'y avait rien à corriger.",
            "CE QUI ÉTAIT VRAIMENT CASSÉ, ET C'EST PIRE QU'UN PROBLÈME D'ORDRE — les créances déclarées (Assurances) étaient rangées sur leur mois CIVIL. Une créance datée du 28 septembre, avec une paie le 27, atterrissait donc sur le cycle de SEPTEMBRE : un cycle déjà refermé, que le Relevé n'affiche plus. Mesuré : la ligne n'apparaissait dans AUCUN des cycles visibles. Elle ne s'affichait pas au mauvais endroit — elle disparaissait, et son montant manquait à l'atterrissage.",
            "LA RÈGLE, MAINTENANT LA MÊME PARTOUT — une date tombée le jour de paie ou après appartient au cycle qui s'ouvre ce jour-là, donc au mois budgétaire SUIVANT. C'est exactement ce que getDepensesCycle appliquait déjà aux dépenses irrégulières ; les créances suivent enfin la même règle, via un unique cycleBudgetaireDe(jour, mois, an).",
            "TROIS COPIES D'UNE MÊME FORMULE, IL N'EN RESTE QU'UNE — le rang d'un jour dans le cycle était recalculé à trois endroits (_pSort du Pilotage, _cSort du Relevé, _rangDansCycle de la checklist), avec deux écritures différentes. Les trois délèguent désormais à rangDansCycle, posé à côté de jourDePaie. Un contrôle automatique refuse qu'une quatrième copie réapparaisse.",
            "LE BILAN RESTE SUR L'AXE CALENDAIRE, ET C'EST VOULU — sa projection est mensuelle au sens civil (janvier à décembre), pas cyclique. Une créance encaissée le 28 septembre arrive bien en septembre dans le patrimoine. Les deux écrans peuvent donc différer d'un mois sur la ligne de bascule : ce n'est pas une divergence, ce sont deux axes de temps distincts, et les totaux de fin d'année restent identiques.",
            "PREUVE DE NON-RÉGRESSION — la nouvelle suite bâtit son jeu de données autour de la date du jour (paie posée à hier, pour que le cycle enjambe deux mois civils) et vérifie dans un vrai navigateur que le cycle s'ouvre sur un flux du jour de paie, qu'il se ferme sur un petit numéro de jour, que la créance du jour tombe dans le cycle en cours et dans aucun autre, et qu'elle pèse au dirham près sur l'atterrissage. Rejouée sur le code d'avant, elle tombe six fois.",
        ] },
        { version: "37.14 Mois-Budgetaire", date: "2026-09-28", changes: [`);

writeFileSync(F, src);
console.log('✔ version 37.15 Releve-Cycle');
