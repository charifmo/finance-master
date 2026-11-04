/* v37.98 Aujourd'hui — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.97 Recalibrer l'année";`, `const CURRENT_VERSION = "37.98 Aujourd'hui";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.97 Recalibrer l'année", date: "2026-11-03", changes: [`,
`                    const CHANGELOG = [
        { version: "37.98 Aujourd'hui", date: "2026-11-03", changes: [
            "☀️ L'ÉCRAN « AUJOURD'HUI » — à l'ouverture, trois chiffres et une action : ce qu'il vous reste à dépenser jusqu'à la paie (et par semaine), le plus bas que touchera votre compte courant et à quelle date, l'épargne du mois face à ce que le mois permet. Puis UNE chose à faire : tout recalculer si un garde-fou saute (compte sous zéro, virement en double…), importer vos captures si vos soldes sont vieux, sinon noter vos dépenses. En bas : Noter · Captures · CFO.",
            "🎓 MODE EXPERT — tout le reste (budget, calendrier, relevés, patrimoine…) d'un toucher ; le choix est retenu sur l'appareil (le PC peut rester en expert, le téléphone en simple). « ☀️ Aujourd'hui » dans le menu pour revenir.",
            "⚡ LE CFO RÉPOND TOUT DE SUITE AUX QUESTIONS CHIFFRÉES — « combien de dépenses chaque mois et les irrégulières ? », « combien il me reste à dépenser ? », « mon point bas ? », « le solde de mon compte salaire ? », « mon épargne ? », « mes revenus ? » : la réponse est lue dans l'appli, sans IA, en une seconde. « 🤖 Demander au CFO quand même » reste là ; une demande d'action ou un « pourquoi » part toujours au CFO.",
            "🗣️ MOTS SIMPLES — « Gérer Périodes » devient « Montant variable selon le mois », « Fonctionnement » devient « Compte du quotidien ».",
        ] },
        { version: "37.97 Recalibrer l'année", date: "2026-11-03", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.98');
