/* v37.20 Pulse-Hebdo — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.19 Sync-Coherente";`, `const CURRENT_VERSION = "37.20 Pulse-Hebdo";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.19 Sync-Coherente", date: "2026-10-05", changes: [`,
`                    const CHANGELOG = [
        { version: "37.20 Pulse-Hebdo", date: "2026-10-05", changes: [
            "LE PULSE HEBDOMADAIRE — le « X DH / jour » de la Météo était anxiogène : la vraie vie ne se lisse pas au jour le jour. À sa place, deux chiffres de la semaine calendaire (lundi → dimanche), qui croisent le Prévu et le Réalisé.",
            "🕊️ LIBERTÉ — l'enveloppe hebdo du Prévisionnel (catégories hebdo, + mensuelles non planifiées ÷ 4,3 ; factures exclues) moins les dépenses réelles saisies de lundi à aujourd'hui. Une jauge en 7 cases (L → D) : le remplissage est l'enveloppe consommée, le repère blanc est le jour ; si le remplissage dépasse le repère, la pastille passe à « Plus vite que la semaine », puis « Enveloppe dépassée ». Détail par catégorie sur grand écran.",
            "PLAFOND DE TRÉSORERIE — la Liberté ne promet jamais plus que le cash ne permet, au rythme régulier jusqu'à la paie (cash ÷ jours avant la paie × jours restants d'ici dimanche). Quand le cash est serré, un lundi, elle vaut exactement le « X par semaine » du conseil de la Météo : les deux ne se contredisent plus.",
            "🔒 SANCTUAIRE — ce qui reste à payer dans les 7 prochains jours (charges fixes, factures, épargne, exceptionnel, retards compris), payés exclus : au dirham près le total de la carte Urgence. Payer une ligne la retire aussitôt. Tuile sombre et verrouillée : cet argent n'est pas à dépenser.",
            "LE FILET DU CYCLE — le reste à vivre jusqu'à la paie et la moyenne par jour ne disparaissent pas : ils descendent en une ligne discrète sous les tuiles. Le conseil de la Météo parle désormais en semaines.",
            "HONNÊTETÉ — si votre réel est saisi par catégorie sans dates (bloc T0), la tuile le dit au lieu d'afficher une semaine vide ; les dépenses saisies hors budget conso (factures…) sont signalées, pas comptées ; une semaine qui enjambe le 31 décembre est lue sur les deux années.",
            "PREUVE — nouvelle suite « Pulse hebdomadaire » : enveloppe, dépensé, Liberté, plafond, jauge, rythme, Sanctuaire = Urgence (recalcul indépendant), une ligne payée qui sort au dirham, rendu bureau et S24+. Rejouée sur la v37.19 : 3 échecs (sur 3 contrôles atteignables) ; trois défauts réintroduits exprès sont tous attrapés.",
        ] },
        { version: "37.19 Sync-Coherente", date: "2026-10-05", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.20 Pulse-Hebdo');
