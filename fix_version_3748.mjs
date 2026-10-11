/* v37.48 Semaine-Partielle — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.47 Surplus-Perimetre";`, `const CURRENT_VERSION = "37.48 Semaine-Partielle";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.47 Surplus-Perimetre", date: "2026-10-11", changes: [`,
`                    const CHANGELOG = [
        { version: "37.48 Semaine-Partielle", date: "2026-10-11", changes: [
            "UNE SEMAINE SAISIE EN PARTIE — quand la semaine se termine, chaque ligne compte pour ce qu'elle est : TAPÉE, ce que vous avez tapé (Œufs 45 sur 50 → 45, pas 50 ; 0 → 0) ; avec un ticket rangé dessus, le ticket ; VIDE, son prévu. Le prévu ne remplace que les cases laissées vides.",
            "CORRIGÉ — un montant dans « Autre » ou un ticket non rangé sur une ligne (ex. les tickets « Marjane » du 10 oct. posés sur Alimentation, pas sur la ligne Marjane) faisait passer TOUTE la catégorie « en vrac » : ses lignes vides comptaient 0 au lieu de leur prévu. Chez vous, samak (vide) aurait compté 0 au lieu de 75 à la clôture de dimanche. « Autre » est hors de la liste, un ticket non rangé aussi : ils s'ajoutent à la catégorie sans vider les lignes.",
            "LA SEMAINE EN COURS ANNONCE SA CLÔTURE — une note dit ce que les lignes encore vides compteront dimanche soir (chez vous cette semaine : cafe Resto Wknd 400 · samak 75 · Ghsil voiture 40, soit 515 DH). Rien dépensé sur l'une d'elles ? Tapez 0. Lundi, la note de semaine écoulée prend le relais, et l'engagé du cycle monte exactement de ce montant.",
            "PREUVE — nouvelle suite « Semaine saisie en partie » : 22 contrôles calculés à la main (dimanche soir puis lundi matin : Œufs 45, Marjane 180, Samak 75, un ticket non rangé, « Autre », 0 tapé, case vidée, ticket rangé, affichage). La suite de la v37.31 suit la nouvelle règle pour « Autre ». Rejouée sur la v37.47 : 13 contrôles en échec. Neuf défauts réintroduits exprès : tous attrapés.",
        ] },
        { version: "37.47 Surplus-Perimetre", date: "2026-10-11", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.48 Semaine-Partielle');
