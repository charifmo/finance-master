/**
 * fix_pilotage_crash_v2491.mjs
 * v24.91 Pilotage-CrashFix
 *
 * Op 1 : renommer _joursCyclePasse → joursCyclePasse (préfixe _ réservé Vue)
 * Op 2 : ajouter getDepensesCycle au return (manquant → crash template)
 * Op 3 : Version bump → "24.91 Pilotage-CrashFix"
 * Op 4 : Changelog
 */

import { readFileSync, writeFileSync } from 'fs';

const FILE = 'C:/Users/HP/finance/index.html';
let html = readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n');

let opCount = 0;

function check(label, needle) {
    if (!html.includes(needle)) {
        console.error(`\n❌ ANCHOR NOT FOUND: ${label}`);
        console.error(`   Preview: ${JSON.stringify(needle.slice(0, 200))}`);
        process.exit(1);
    }
}

function replace(label, from, to) {
    check(label, from);
    const before = html;
    html = html.split(from).join(to);
    if (html === before) {
        console.error(`\n❌ NO CHANGE: ${label}`);
        process.exit(1);
    }
    opCount++;
    console.log(`✅ Op ${opCount} — ${label}`);
}

// ── Op 1 : _joursCyclePasse → joursCyclePasse (3 occurrences) ─────────────────
replace(
    'Op1a - rename const _joursCyclePasse',
    `const _joursCyclePasse = computed(() => {`,
    `const joursCyclePasse = computed(() => {`
);
replace(
    'Op1b - rename usage in joursDepuisDernierePaie',
    `const joursDepuisDernierePaie = computed(() => isCyclePasse.value ? _joursCyclePasse.value : _cyclePaieInfo.value.joursDepuis);`,
    `const joursDepuisDernierePaie = computed(() => isCyclePasse.value ? joursCyclePasse.value : _cyclePaieInfo.value.joursDepuis);`
);
replace(
    'Op1c - rename in return statement',
    `isCyclePasse, _joursCyclePasse,`,
    `isCyclePasse, joursCyclePasse,`
);

// ── Op 2 : ajouter getDepensesCycle au return ─────────────────────────────────
replace(
    'Op2 - expose getDepensesCycle in return (crash fix)',
    `totalRevenusBase, totalFixes, totalVariables, totalEpargne, nomDuMois, moisOuverts, toggleMois, getDepensesMois,`,
    `totalRevenusBase, totalFixes, totalVariables, totalEpargne, nomDuMois, moisOuverts, toggleMois, getDepensesMois, getDepensesCycle,`
);

// ── Op 3 : Version bump ───────────────────────────────────────────────────────
replace(
    'Op3 - Version bump',
    `const CURRENT_VERSION = "24.90 Journal-Nettoyage";`,
    `const CURRENT_VERSION = "24.91 Pilotage-CrashFix";`
);

// ── Op 4 : Changelog ─────────────────────────────────────────────────────────
replace(
    'Op4 - Changelog entry v24.91',
    `const CHANGELOG = [`,
    `const CHANGELOG = [
        { version: "24.91 Pilotage-CrashFix", date: "2026-05-30", changes: [
            "Fix crash : getDepensesCycle manquait dans le return setup() → TypeError dans le template Pilotage",
            "Fix warning Vue : _joursCyclePasse renommé joursCyclePasse (préfixe _ réservé Vue internals)"
        ] },`
);

// ── Écriture ──────────────────────────────────────────────────────────────────
writeFileSync(FILE, html.replace(/\n/g, '\r\n'), 'utf8');
console.log(`\n🎉 v24.91 Pilotage-CrashFix — ${opCount} opérations appliquées !`);
