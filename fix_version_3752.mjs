/* v37.52 Categorisation-Auto — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.51 Cloture";`, `const CURRENT_VERSION = "37.52 Categorisation-Auto";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.51 Cloture", date: "2026-10-14", changes: [`,
`                    const CHANGELOG = [
        { version: "37.52 Categorisation-Auto", date: "2026-10-14", changes: [
            "PLUS AUCUN BOUTON À PRESSER — les règles d'abord ; ce qu'elles ne savent pas (inconnu OU doute) part à l'IA d'office ; si l'IA ne répond pas (injoignable, réponse illisible, catégorie inventée, « aucune »), une catégorie PAR DÉFAUT est posée : la meilleure piste des règles, sinon votre catégorie la plus utilisée, sinon « Dépense exceptionnelle ». Plus rien ne reste « Non catégorisé ».",
            "PARTOUT, PAS SEULEMENT À LA SAISIE — une transaction arrivée sans catégorie (agent, import, autre appareil, version d'avant) est traitée dès l'ouverture : la règle sûre appliquée (« mcdonald s » → cafe Resto Wknd), le reste à l'IA, une demande à la fois, une seule fois par transaction et par session.",
            "LA DARIJA, MÊME ÉCRITE AUTREMENT — lettres doublées et article « l / el » ramenés à la même racine : « Hri » est votre ligne « lhrri » (sûr, sans IA). Jamais devant une voyelle ni un chiffre : « lait », « l7m » restent eux-mêmes.",
            "« À VÉRIFIER » — le panneau ne demande plus rien : il montre ce qui a été rangé à l'essai (« ✓ Alimentation · par défaut », le motif) ; ✓ confirme et devient une règle, « autre… » corrige, « 🤖 relancer l'IA » sur une ligne rangée par défaut. Le journal dit « · par défaut ».",
            "PREUVE — nouvelle suite « Catégorisation automatique » : 21 contrôles (Hri, mcdonald s, zzqx par l'IA, panne → par défaut, afriquia gardée en Voiture, sans libellé, une demande par session, panneau, journal, relance, saisie sûre / inconnue / doute, confirmation). Rejouée sur la v37.51 : 20 contrôles en échec. Quinze défauts réintroduits exprès : tous attrapés. La suite v37.49 suit la nouvelle règle (plus de bouton, l'IA en panne range par défaut).",
        ] },
        { version: "37.51 Cloture", date: "2026-10-14", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.52 Categorisation-Auto');
