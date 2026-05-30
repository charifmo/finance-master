/**
 * fix_releve_v2461.mjs
 * v24.61 Relevé-PerCompte
 *
 * Op 1 : journalHybride — attacher sourceCompte sur les items dépenses irrégulières
 * Op 2 : journalHybridePourReleve — cas Compte Courant : journal hybride filtré courant seulement
 * Op 3 : Version bump → "24.61 Relevé-PerCompte"
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

// ── Op 1 : journalHybride — sourceCompte sur les dépenses irrégulières ────────
replace(
    'Op1 - journalHybride dépenses push attache sourceCompte',
    `                            (paid ? paidItems : unpaidItems).push({
                                libelle: dep.nom || dep.label || 'Dépense',
                                montant: amt, type: 'debit',
                                jourPrevu: 20,
                                etat: paid ? 'realise' : 'prevu'
                            });`,
    `                            (paid ? paidItems : unpaidItems).push({
                                libelle: dep.nom || dep.label || 'Dépense',
                                montant: amt, type: 'debit',
                                jourPrevu: 20,
                                etat: paid ? 'realise' : 'prevu',
                                sourceCompte: dep.sourceCompte || 'courant'
                            });`
);

// ── Op 2 : journalHybridePourReleve — cas Compte Courant filtré ───────────────
replace(
    'Op2 - journalHybridePourReleve courant-specific filtered hybrid',
    `                        if (!releveActiveCycle.value) return journalHybride.value;
                        const [mStr, aStr] = releveActiveCycle.value.split('-');`,
    `                        // Compte Courant sélectionné → journal hybride filtré (items courant seulement)
                        if (_rFiltres.length === 1 && _rFiltres[0] === _rCourantKey) {
                            const _rBase = journalHybride.value;
                            const _rFiltered = [];
                            let _rSolde = 0;
                            _rBase.entries.forEach(_re => {
                                if (_re.type === 'initial') { _rSolde = _re.soldeApres; _rFiltered.push({..._re}); return; }
                                if (_re.type === 'separator') { _rSolde = _re.soldeApres; _rFiltered.push({..._re}); return; }
                                if ((_re.sourceCompte || 'courant') !== 'courant') return;
                                _rSolde = Math.round((_rSolde + (_re.type === 'credit' ? _re.montant : -_re.montant)) * 100) / 100;
                                _rFiltered.push({..._re, soldeApres: _rSolde});
                            });
                            return { entries: _rFiltered, soldeAtterrissage: _rSolde };
                        }
                        if (!releveActiveCycle.value) return journalHybride.value;
                        const [mStr, aStr] = releveActiveCycle.value.split('-');`
);

// ── Op 3 : Version bump ───────────────────────────────────────────────────────
replace(
    'Op3 - Version bump',
    `const CURRENT_VERSION = "24.60 Relevé-Fix";`,
    `const CURRENT_VERSION = "24.61 Relevé-PerCompte";`
);

// ── Op 4 : Changelog ─────────────────────────────────────────────────────────
replace(
    'Op4 - Changelog entry v24.61',
    `const CHANGELOG = [`,
    `const CHANGELOG = [
        { version: "24.61 Relevé-PerCompte", date: "2026-05-30", changes: [
            "journalHybride : sourceCompte attaché aux items dépenses irrégulières (dep.sourceCompte || courant)",
            "journalHybridePourReleve : Compte Courant sélectionné → hybrid filtré courant seulement (exclut items sourceCompte != courant)",
            "Séparateur AUJOURD'HUI ancre sur tresoActuelleCourante même en vue filtrée"
        ] },`
);

// ── Écriture ──────────────────────────────────────────────────────────────────
writeFileSync(FILE, html.replace(/\n/g, '\r\n'), 'utf8');
console.log(`\n🎉 v24.61 Relevé-PerCompte — ${opCount} opérations appliquées !`);
