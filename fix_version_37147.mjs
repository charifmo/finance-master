/* v37.147 Les factures se clôturent aussi dans la frise — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.146 Trois niveaux de tests";`, `const CURRENT_VERSION = "37.147 Les factures se clôturent aussi dans la frise";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.146 Trois niveaux de tests", date: "2026-11-14", changes: [`,
`                    const CHANGELOG = [
        { version: "37.147 Les factures se clôturent aussi dans la frise", date: "2026-11-14", changes: [
            "🔒 « POURQUOI JE NE PEUX PAS CLÔTURER ICI ? » (Factures dans la frise) — une facture, ou une dépense exceptionnelle, se clôt par le verrou du Réalisé (« Clôturer pour ce cycle », posé sur la ligne) ; la frise n'avait que celui de la Météo. Chaque facture a maintenant son 🔓 / 🔒 dans la frise et dans son aperçu : clôturée d'un côté, elle l'est de l'autre ; grisée, « 🔒 Clôturé · réglé / prévu · N libérés ».",
            "🏢 « JOUETS ABDELJALIL, HABITS ABDELJALIL, HABITS CHARIF… IL NE DOIT RIEN MANQUER À LA FRISE » — elle montre maintenant TOUT ce que le Réalisé pointe : 🏢 Charges fixes, 💎 Épargne, 🔄 Virements internes, 💰 Revenus (reçu / attendu), en plus de la consommation, des factures et de l'exceptionnel. Chaque ligne : réglé / prévu sur le cycle (le même chiffre que le Réalisé), un repère à sa date prévue, son compte, son 🔓 / 🔒 ; ✏️ ouvre la petite fenêtre (nom, montant).",
            "🧪 Le choix automatique des tests ne prend plus une simple mention d'un fichier dans le changelog pour un fichier chargé par l'écran (une suite modifiée relançait 90 suites au lieu de quelques-unes).",
            "PREUVE — test_frise_cycle.mjs : la facture Élec clôturée depuis la frise l'est dans le Réalisé, puis rouverte ; blocs Charges fixes, Épargne, Revenus, chacun avec son compte et son verrou ; une charge fixe clôturée et rouverte depuis la frise ; ✏️ → 350 enregistré. test_choisir_suites.mjs (13).",
        ] },
        { version: "37.146 Trois niveaux de tests", date: "2026-11-14", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.147');
