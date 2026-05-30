/**
 * fix_journal_nettoyage_v2490.mjs
 * v24.90 Journal-Nettoyage
 *
 * Op 1 : journalHybride chargesVariables — agréger les détails par catégorie
 *         (une seule ligne par catégorie au lieu de N lignes par détail)
 * Op 2 : journalHybridePourReleve courant — solde initial = tresoActuelleCourante
 *         (pas la reconstitution négative pré-salaire)
 * Op 3 : Version bump → "24.90 Journal-Nettoyage"
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

// ── Op 1 : journalHybride — agréger chargesVariables par catégorie ─────────────
replace(
    'Op1 - journalHybride chargesVariables agrégé par catégorie (plus de détails explosés)',
    `                        // Charges variables (items individuels, mensuel uniquement)
                        Object.values(dAnnee.chargesVariables || {}).forEach(cv => {
                            if ((cv.details || []).length > 0) {
                                cv.details.forEach(d => {
                                    const due = Number(d.montant || 0);
                                    if (!due) return;
                                    const paid = isItemPaid(d, due);
                                    const amt = paid ? (getPaidAmount(d, due) || due) : due;
                                    (paid ? paidItems : unpaidItems).push({
                                        libelle: (cv.label ? cv.label + ' · ' : '') + (d.label || d.nom || ''),
                                        montant: amt, type: 'debit',
                                        jourPrevu: 15,
                                        etat: paid ? 'realise' : 'prevu',
                                        sourceCompte: soldesInitiaux.value.compteChargesVariables || 'courant'
                                    });
                                });
                            } else {
                                const due = Number(cv.valeur || 0);
                                if (!due) return;
                                const paid = isItemPaid(cv, due);
                                const amt = paid ? (getPaidAmount(cv, due) || due) : due;
                                (paid ? paidItems : unpaidItems).push({
                                    libelle: cv.label || 'Variable',
                                    montant: amt, type: 'debit',
                                    jourPrevu: 15,
                                    etat: paid ? 'realise' : 'prevu',
                                    sourceCompte: soldesInitiaux.value.compteChargesVariables || 'courant'
                                });
                            }
                        });`,
    `                        // Charges variables — v24.90 : agrégé par catégorie (détails groupés)
                        Object.values(dAnnee.chargesVariables || {}).forEach(cv => {
                            const _cvSrc = soldesInitiaux.value.compteChargesVariables || 'courant';
                            if ((cv.details || []).length > 0) {
                                let _paidAmt = 0, _unpaidAmt = 0;
                                cv.details.forEach(d => {
                                    const due = Number(d.montant || 0);
                                    if (!due) return;
                                    if (isItemPaid(d, due)) _paidAmt += getPaidAmount(d, due) || due;
                                    else _unpaidAmt += due;
                                });
                                if (_paidAmt > 0) paidItems.push({ libelle: cv.label || 'Variable', montant: _paidAmt, type: 'debit', jourPrevu: 15, etat: 'realise', sourceCompte: _cvSrc });
                                if (_unpaidAmt > 0) unpaidItems.push({ libelle: cv.label || 'Variable', montant: _unpaidAmt, type: 'debit', jourPrevu: 15, etat: 'prevu', sourceCompte: _cvSrc });
                            } else {
                                const due = Number(cv.valeur || 0);
                                if (!due) return;
                                const paid = isItemPaid(cv, due);
                                const amt = paid ? (getPaidAmount(cv, due) || due) : due;
                                (paid ? paidItems : unpaidItems).push({ libelle: cv.label || 'Variable', montant: amt, type: 'debit', jourPrevu: 15, etat: paid ? 'realise' : 'prevu', sourceCompte: _cvSrc });
                            }
                        });`
);

// ── Op 2 : journalHybridePourReleve courant — solde initial = tresoActuelleCourante
replace(
    'Op2 - journalHybridePourReleve courant initial balance = tresoActuelleCourante (pas pré-salaire)',
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
                        }`,
    `                        // Compte Courant sélectionné → journal hybride filtré (items courant seulement)
                        if (_rFiltres.length === 1 && _rFiltres[0] === _rCourantKey) {
                            const _rBase = journalHybride.value;
                            const _rFiltered = [];
                            // v24.90 : solde initial = tresoActuelleCourante (solde réel, positif)
                            const _rTreso = tresoActuelleCourante.value;
                            let _rSolde = _rTreso;
                            _rBase.entries.forEach(_re => {
                                if (_re.type === 'initial') { _rFiltered.push({..._re, soldeApres: _rTreso}); return; }
                                if (_re.type === 'separator') { _rSolde = _re.soldeApres; _rFiltered.push({..._re}); return; }
                                if ((_re.sourceCompte || 'courant') !== 'courant') return;
                                _rSolde = Math.round((_rSolde + (_re.type === 'credit' ? _re.montant : -_re.montant)) * 100) / 100;
                                _rFiltered.push({..._re, soldeApres: _rSolde});
                            });
                            return { entries: _rFiltered, soldeAtterrissage: _rSolde };
                        }`
);

// ── Op 3 : Version bump ───────────────────────────────────────────────────────
replace(
    'Op3 - Version bump',
    `const CURRENT_VERSION = "24.80 Macro-Accounts";`,
    `const CURRENT_VERSION = "24.90 Journal-Nettoyage";`
);

// ── Op 4 : Changelog ─────────────────────────────────────────────────────────
replace(
    'Op4 - Changelog entry v24.90',
    `const CHANGELOG = [`,
    `const CHANGELOG = [
        { version: "24.90 Journal-Nettoyage", date: "2026-05-30", changes: [
            "journalHybride chargesVariables : agrégé par catégorie — 1 ligne par catégorie (réalisé + prévu), plus d'explosion par détail",
            "journalHybridePourReleve Compte Courant : solde initial = tresoActuelleCourante (solde réel positif, pas la reconstitution pré-salaire négative)"
        ] },`
);

// ── Écriture ──────────────────────────────────────────────────────────────────
writeFileSync(FILE, html.replace(/\n/g, '\r\n'), 'utf8');
console.log(`\n🎉 v24.90 Journal-Nettoyage — ${opCount} opérations appliquées !`);
