/* v37.129 Hors budget, expliqué — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.128 Les quinzaines, case par case";`, `const CURRENT_VERSION = "37.129 Hors budget, expliqué";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.128 Les quinzaines, case par case", date: "2026-11-11", changes: [`,
`                    const CHANGELOG = [
        { version: "37.129 Hors budget, expliqué", date: "2026-11-11", changes: [
            "❓ « J'AI PAS COMPRIS C'EST QUOI HORS BUDGET CONSO ! » (Pilotage, Météo, sous les catégories) — le lien dit maintenant ce que c'est : « + 19 461 DH dépensés hors de ces catégories (factures, voyage, exceptionnel…, dont X DH non catégorisés) : pas dans le Reste à dépenser ». Le panneau range chaque opération SOUS SA CATÉGORIE (Factures, Voyage Marrakech, Appart Aga…), avec le nombre d'opérations et le total ; les NON CATÉGORISÉES en tête, en ambre. Toucher une ligne ouvre le Journal sur CETTE opération, le choix de catégorie déjà ouvert : on la réaffecte en un geste.",
            "🏷️ « IL N'Y A PAS DE FILTRE (NON CATÉGORISÉ) POUR LES RÉAFFECTER » — le filtre de catégorie du Journal commence par « 🔎 À trier · ⚠️ Non catégorisé » : les opérations sans catégorie, en « divers », ou dans une catégorie qui n'existe plus. Le panneau de la Météo y mène directement (« 🏷️ Les reclasser dans le Journal »).",
            "PREUVE — test_rayons_x : deux opérations dans des catégories disparues → « dont 173 DH non catégorisés », groupe « ⚠️ Non catégorisé · 2 op. » en tête puis Factures ; toucher « Mcdonald's » ouvre le Journal avec son choix de catégorie ; le filtre « Non catégorisé » montre exactement ces deux opérations.",
        ] },
        { version: "37.128 Les quinzaines, case par case", date: "2026-11-11", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.129');
