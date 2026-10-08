/* v37.29 Semaines-Reelles — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.28 Cases-Vierges";`, `const CURRENT_VERSION = "37.29 Semaines-Reelles";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.28 Cases-Vierges", date: "2026-10-08", changes: [`,
`                    const CHANGELOG = [
        { version: "37.29 Semaines-Reelles", date: "2026-10-08", changes: [
            "FIN DU « × 4,3 » — un cycle de paie compte 4 ou 5 semaines, jamais 4,3 : les jeudis entre le jour de paie du mois précédent et la veille du suivant (la règle de la saisie par semaine). Une charge « / sem » coûte désormais valeur × les semaines RÉELLES de son cycle ; une charge « / mois » se répartit sur ses 4 ou 5 semaines. Sur l'année : 52 ou 53 semaines (et non 4,3 × 12 = 51,6).",
            "POURQUOI — avec 4,3, tenir exactement son prévu chaque semaine pendant un cycle de 5 semaines affichait un FAUX dépassement (5 × 3 097 = 15 485 pour un budget de 13 317) ; dans un cycle de 4 semaines, 929 DH n'étaient portés par aucune semaine. Désormais : prévu tenu chaque semaine = budget du cycle tenu, au dirham près.",
            "PARTOUT, Y COMPRIS LÀ OÙ L'ON SAISIT LE PRÉVU — section Charges variables (bureau et téléphone) : « Octobre : 4 sem. → 5 948 DH · Novembre : 5 sem. → 7 435 DH » remplace « Impact mensuel calculé (x4.3) » ; une charge mensuelle affiche sa part par semaine. Prévisionnel : chaque mois avec SES semaines (« 3 097 DH par semaine × 4 semaines ce cycle »). Pilotage, Reste à dépenser, Rayons X, surplus mois par mois et annuel, journal de trésorerie, relevé, graphiques, indépendance financière (mois moyen = semaines de l'année ÷ 12). La Météo dit « sem. 2/4 ».",
            "DEUX DÉFAUTS DU MÊME CALCUL CORRIGÉS — journal de trésorerie : l'exception d'une charge « / sem » remplaçait le montant du mois par la valeur HEBDO (non multipliée) ; contrôle budget vs réalisé : les sous-lignes d'une charge « / sem » étaient comptées comme mensuelles.",
            "SERVEUR (CFO) — l'application envoie déjà son net mensuel au CFO ; le recalcul de secours de cfo_intent_engine.php applique désormais la même règle (cfo_semaines_cycle). La parité avec l'ancien moteur JS figé déclare cet écart, et lui seul, comme voulu.",
            "PREUVE — deux suites nouvelles (28 + 8 contrôles), contre un comptage INDÉPENDANT jour par jour : 144 cycles côté application, 336 côté serveur ; un cycle de 5 semaines ET un de 4 (horloges fixes) où le prévu tenu chaque semaine tombe pile sur le budget ; Prévisionnel des 12 mois ; section Charges variables ; surplus ; journal avec exception. Dix défauts réintroduits exprès côté application (dont la règle du lundi, le rang de semaine, l'exception non multipliée) et deux côté serveur : tous attrapés. Les suites existantes calculent maintenant leurs attendus avec les semaines réelles.",
        ] },
        { version: "37.28 Cases-Vierges", date: "2026-10-08", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.29 Semaines-Reelles');
