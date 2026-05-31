import { readFileSync, writeFileSync } from 'fs';

const SRC  = 'C:/Users/HP/finance/index.html';
let html = readFileSync(SRC, 'utf8').replace(/\r\n/g, '\n');
const orig = html;

let errors = 0;
const check = (label, str) => {
    if (!html.includes(str)) { console.error('❌ ANCHOR NOT FOUND:', label); errors++; }
    else console.log('✅', label);
};
const replace = (label, from, to) => {
    if (!html.includes(from)) { console.error('❌ REPLACE ANCHOR NOT FOUND:', label); errors++; return; }
    html = html.split(from).join(to);
    console.log('✅ REPLACED:', label);
};

// ──────────────────────────────────────────────────────────────────────────────
// VÉRIFICATION DES ANCRES
// ──────────────────────────────────────────────────────────────────────────────

check('Ancre releveEvolution filtre ancien',
    `                        let aFs = releveAnneesFiltres.value;
                        let mFs = releveMoisFiltres.value;
                        // v23.20 : cycle override pour mode évolution
                        const _acEv = releveActiveCycle.value;`);

check('Ancre releveCompte filtre ancien',
    `                        let aFs = releveAnneesFiltres.value;
                        let mFs = releveMoisFiltres.value;
                        // v23.20 : si un cycle est sélectionné, dériver aFs/mFs depuis le cycle
                        const _acRel = releveActiveCycle.value;`);

if (errors > 0) { console.error(`\n${errors} ancre(s) manquante(s) — abandon.`); process.exit(1); }

// ──────────────────────────────────────────────────────────────────────────────
// FIX 1 : releveEvolution — brancher sur moisSelectionnes × anneesSelectionnees
// ──────────────────────────────────────────────────────────────────────────────

replace(
    'Fix releveEvolution : relier aux badges actifs',
    `                        let aFs = releveAnneesFiltres.value;
                        let mFs = releveMoisFiltres.value;
                        // v23.20 : cycle override pour mode évolution
                        const _acEv = releveActiveCycle.value;`,
    `                        // v26.73 : brancher sur les badges multi-sélection (moisSelectionnes × anneesSelectionnees)
                        let aFs = anneesSelectionnees.value;
                        let mFs = moisSelectionnes.value;
                        // conserver l'override cycle (releveActiveCycle) pour compatibilité
                        const _acEv = releveActiveCycle.value;`
);

// ──────────────────────────────────────────────────────────────────────────────
// FIX 2 : releveCompte — même correction
// ──────────────────────────────────────────────────────────────────────────────

replace(
    'Fix releveCompte : relier aux badges actifs',
    `                        let aFs = releveAnneesFiltres.value;
                        let mFs = releveMoisFiltres.value;
                        // v23.20 : si un cycle est sélectionné, dériver aFs/mFs depuis le cycle
                        const _acRel = releveActiveCycle.value;`,
    `                        // v26.73 : brancher sur les badges multi-sélection (moisSelectionnes × anneesSelectionnees)
                        let aFs = anneesSelectionnees.value;
                        let mFs = moisSelectionnes.value;
                        // conserver l'override cycle pour compatibilité
                        const _acRel = releveActiveCycle.value;`
);

// ──────────────────────────────────────────────────────────────────────────────
// BUMP VERSION
// ──────────────────────────────────────────────────────────────────────────────

replace(
    'Bump version 26.72 → 26.73',
    'v26.72 Objectif-Epargne-Fix',
    'v26.73 Releve-Filter-Fix'
);

// ──────────────────────────────────────────────────────────────────────────────
// SAUVEGARDE
// ──────────────────────────────────────────────────────────────────────────────

if (errors > 0) { console.error(`\n${errors} erreur(s) — fichier NON modifié.`); process.exit(1); }
if (html === orig) { console.warn('\n⚠️  Aucun changement détecté — vérifier les ancres.'); process.exit(1); }

writeFileSync(SRC, html.replace(/\n/g, '\r\n'), 'utf8');
console.log('\n✅ index.html mis à jour → v26.73 Releve-Filter-Fix');
