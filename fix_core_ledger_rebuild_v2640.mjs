// fix_core_ledger_rebuild_v2640.mjs
// v26.40 Core-Ledger-Rebuild — réécriture totale du moteur de journal :
//   • T0 pivot UNIQUE en tête (pas répété à chaque cycle)
//   • Censure totale du passé (zéro section "Déjà Réalisé", zéro realized-in)
//   • _viewLegs corrigé pour multi-select (_rFiltres.length > 1)
//   • Créances futures (montant < 0) incluses comme crédits
import fs from 'node:fs';
const FILE = 'C:/Users/HP/finance/index.html';
let html = fs.readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n');
let opCount = 0;
const check = (label, str) => {
    if (!html.includes(str)) { console.error('❌ ANCHOR MISSING: ' + label); process.exit(1); }
};
const replace = (label, from, to) => {
    check(label, from);
    const n = html.split(from).length - 1;
    html = html.split(from).join(to);
    opCount++;
    console.log('✔ ' + label + ' (' + n + ' occurrence' + (n > 1 ? 's' : '') + ')');
};

// ─────────────────────────────────────────────────────────────
// OP 1 : _mkLegs chocs — inclure les créances (montant < 0) comme crédits
// ─────────────────────────────────────────────────────────────
replace('1) _mkLegs chocs — créances incluses',
`                            // ===== CHOCS EXCEPTIONNELS : DÉTAILLÉS ligne par ligne (JAMAIS regroupés — on garde la trace) =====
                            getDepensesCycle(m, a).forEach(dep => {
                                const due = Number(dep.montant || 0); if (!due) return;
                                let amt;
                                if (mode === 'full') amt = due;
                                else { if (isItemPaid(dep, due)) amt = 0; else { const r = due - (getPaidAmount(dep, due) || 0); amt = r > 0 ? r : 0; } }
                                amt = Math.round(amt * 100) / 100;
                                if (amt > 0) out.push({ account: _normKey(dep.sourceCompte), libelle: '⚠️ ' + (dep.nom || dep.label || 'Dépense'), montant: amt, type: 'debit', jourPrevu: Number(dep.jourPrevu || 20), internal: false });
                            });`,
`                            // ===== CHOCS EXCEPTIONNELS + CRÉANCES FUTURES : DÉTAILLÉS ligne par ligne =====
                            getDepensesCycle(m, a).forEach(dep => {
                                const rawDue = Number(dep.montant || 0); if (rawDue === 0) return;
                                const isCreance = rawDue < 0; // montant négatif = créance / remboursement à recevoir
                                const due = Math.abs(rawDue);
                                let amt;
                                if (mode === 'full') amt = due;
                                else { if (isItemPaid(dep, due)) amt = 0; else { const r = due - (getPaidAmount(dep, due) || 0); amt = r > 0 ? r : 0; } }
                                amt = Math.round(amt * 100) / 100;
                                if (amt > 0) out.push({ account: _normKey(dep.sourceCompte), libelle: (isCreance ? '💚 ' : '⚠️ ') + (dep.nom || dep.label || (isCreance ? 'Créance' : 'Dépense')), montant: amt, type: isCreance ? 'credit' : 'debit', jourPrevu: Number(dep.jourPrevu || 20), internal: false });
                            });`);

// ─────────────────────────────────────────────────────────────
// OP 2 : _viewLegs — correction multi-select (_rFiltres.length > 1 était ignoré)
// ─────────────────────────────────────────────────────────────
replace('2) _viewLegs — correction multi-select',
`                        // ── Filtre des legs selon le compte affiché (single ou Global) ──
                        const _viewLegs = (lgs) => {
                            if (_rFiltres.length === 1) return lgs.filter(l => l.account === _rFiltres[0]);
                            // v26.10 Multi-Ledger-Correction : vue Global → on AFFICHE les transferts internes (double écriture
                            // débit compte source / crédit compte destination). Chaque ligne garde son solde isolé par compte.
                            return lgs;
                        };`,
`                        // ── Filtre des legs selon le compte affiché (single, multi-select, ou Global) ──
                        const _viewLegs = (lgs) => {
                            if (_rFiltres.length === 0) return lgs; // Global : tous les legs (transferts internes inclus)
                            return lgs.filter(l => _rFiltres.includes(l.account)); // single ou multi-select : comptes sélectionnés
                        };`);

// ─────────────────────────────────────────────────────────────
// OP 3 : Moteur principal — censure totale passé + T0 unique en tête + atterrissage multi-select
// ─────────────────────────────────────────────────────────────
replace('3) moteur principal — censure passé + T0 unique + atterrissage',
`                        // comptes réellement impactés par un flux de la sélection (pour purger les pivots à 0 DH inactifs)
                        const _impacted = new Set();
                        _activeCycles.forEach(cyc => {
                            const _isCur = (cyc.m === curM && cyc.a === curA);
                            _viewLegs(_mkLegs(cyc.m, cyc.a, _isCur ? 'remaining' : 'full')).forEach(l => _impacted.add(l.account));
                            if (_isCur) _viewLegs(_mkLegs(cyc.m, cyc.a, 'realized-in')).forEach(l => _impacted.add(l.account));
                        });

                        const entries = [];

                        for (let _ci = 0; _ci < _activeCycles.length; _ci++) {
                            const cyc = _activeCycles[_ci];
                            const isCurrent = (cyc.m === curM && cyc.a === curA);

                            // Séparateur inter-cycle (sauf le premier) — pas de solde global dans la colonne
                            if (_ci > 0) {
                                entries.push({ type: 'cycle_sep', libelle: '📅 ' + _mNL[cyc.m] + ' ' + cyc.a, soldeApres: (_rFiltres.length === 1 ? (Number(soldes[_rFiltres[0]]) || 0) : null), jourPrevu: null });
                            }

                            // ── CHANTIER 2 : ENTRÉES DÉJÀ REÇUES (paye:true) — détaillées, AVANT les pivots. Ne touchent PAS le dict (déjà dans T0) ──
                            if (isCurrent) {
                                const inLegs = _viewLegs(_mkLegs(cyc.m, cyc.a, 'realized-in'));
                                inLegs.sort((x, y) => _cSort(x.jourPrevu) - _cSort(y.jourPrevu));
                                if (inLegs.length > 0) {
                                    entries.push({ type: 'sep_realise', libelle: '✅ Déjà Réalisé (entrées reçues)', soldeApres: null, jourPrevu: null });
                                    inLegs.forEach(l => {
                                        entries.push({ libelle: l.libelle, montant: l.montant, type: l.type, jourPrevu: l.jourPrevu, etat: 'realise', soldeApres: null, compteKey: l.account, soldeCompteApres: null });
                                    });
                                }
                            }

                            // ── CHANTIER 1 : PIVOT ⏰ AUJOURD'HUI / 🔮 — UNE ligne PAR COMPTE en Global (jamais de somme), solde isolé du dict ──
                            const _pivotLabel = isCurrent ? "⏰ AUJOURD'HUI" : ("🔮 " + _mNL[cyc.m] + ' ' + cyc.a);
                            if (_rFiltres.length === 0) {
                                _accountKeys().forEach(k => {
                                    const sv = Number(soldes[k]) || 0;
                                    if (sv === 0 && !_impacted.has(k)) return; // purge des pivots à 0 DH non impactés
                                    entries.push({ type: 'initial', libelle: _pivotLabel, montant: sv, soldeApres: sv, jourPrevu: null, etat: isCurrent ? 't0' : 'projete', compteKey: k, soldeCompteApres: sv });
                                });
                            } else {
                                const k = _rFiltres[0];
                                const sv = Number(soldes[k]) || 0;
                                entries.push({ type: 'initial', libelle: _pivotLabel, montant: sv, soldeApres: sv, jourPrevu: null, etat: isCurrent ? 't0' : 'projete', compteKey: k, soldeCompteApres: sv });
                            }

                            // ── CHANTIER 3+4 : flux à venir (paye:false). Chaque ligne : soldes[cible] += flux → colonne Solde = soldes[cible] ──
                            const dispLegs = _viewLegs(_mkLegs(cyc.m, cyc.a, isCurrent ? 'remaining' : 'full'));
                            dispLegs.sort((x, y) => _cSort(x.jourPrevu) - _cSort(y.jourPrevu));
                            dispLegs.forEach(l => {
                                const soldeCompteApres = _apply(l.account, l.montant, l.type);
                                entries.push({ libelle: l.libelle, montant: l.montant, type: l.type, jourPrevu: l.jourPrevu, etat: 'prevu', soldeApres: soldeCompteApres, compteKey: l.account, soldeCompteApres });
                            });

                            // ── Avance silencieuse vers le cycle suivant (cycles intermédiaires non affichés) ──
                            if (_ci < _activeCycles.length - 1) {
                                const nextCyc = _activeCycles[_ci + 1];
                                let _nm = cyc.m, _na = cyc.a, _g2 = 0;
                                if (_nm === 12) { _nm = 1; _na++; } else { _nm++; }
                                while (!(_nm === nextCyc.m && _na === nextCyc.a) && _g2++ < 36) {
                                    _advanceCycle(_nm, _na, 'full');
                                    if (_nm === 12) { _nm = 1; _na++; } else { _nm++; }
                                }
                            }
                        }

                        // Atterrissage : solde isolé du compte (single) ou patrimoine total projeté (Global) — résumé de pied de tableau uniquement
                        return { entries, soldeAtterrissage: (_rFiltres.length === 1 ? (Number(soldes[_rFiltres[0]]) || 0) : _sumSoldes()) };`,
`                        // comptes réellement impactés par un flux de la sélection (pour purger les pivots T0 à 0 DH inactifs)
                        const _impacted = new Set();
                        _activeCycles.forEach(cyc => {
                            const _isCur = (cyc.m === curM && cyc.a === curA);
                            _viewLegs(_mkLegs(cyc.m, cyc.a, _isCur ? 'remaining' : 'full')).forEach(l => _impacted.add(l.account));
                        });

                        const entries = [];

                        for (let _ci = 0; _ci < _activeCycles.length; _ci++) {
                            const cyc = _activeCycles[_ci];
                            const isCurrent = (cyc.m === curM && cyc.a === curA);

                            // Séparateur inter-cycle (sauf le premier) — solde du compte filtré ou null en Global
                            if (_ci > 0) {
                                const _sepSolde = _rFiltres.length > 0 ? (Number(soldes[_rFiltres[_rFiltres.length - 1]]) || 0) : null;
                                entries.push({ type: 'cycle_sep', libelle: '📅 ' + _mNL[cyc.m] + ' ' + cyc.a, soldeApres: _sepSolde, jourPrevu: null });
                            }

                            // ── PIVOT T0 : UNIQUE, en tête du PREMIER cycle seulement ──
                            // Les cycles suivants reçoivent uniquement un séparateur 📅 (soldes non réinitialisés, simulation continue)
                            if (_ci === 0) {
                                const _pivotLabel = isCurrent ? "⏰ AUJOURD'HUI" : ("🔮 " + _mNL[cyc.m] + ' ' + cyc.a);
                                if (_rFiltres.length === 0) {
                                    // Global : une ligne T0 par compte actif (solde isolé — jamais de somme)
                                    _accountKeys().forEach(k => {
                                        const sv = Number(soldes[k]) || 0;
                                        if (sv === 0 && !_impacted.has(k)) return;
                                        entries.push({ type: 'initial', libelle: _pivotLabel, montant: sv, soldeApres: sv, jourPrevu: null, etat: isCurrent ? 't0' : 'projete', compteKey: k, soldeCompteApres: sv });
                                    });
                                } else {
                                    // Single ou multi-select : une ligne T0 par compte sélectionné (corrige bug "dernier compte actif")
                                    _rFiltres.forEach(k => {
                                        const sv = Number(soldes[k]) || 0;
                                        entries.push({ type: 'initial', libelle: _pivotLabel, montant: sv, soldeApres: sv, jourPrevu: null, etat: isCurrent ? 't0' : 'projete', compteKey: k, soldeCompteApres: sv });
                                    });
                                }
                            }

                            // ── Flux futurs (paye:false) ── soldes[compte] += flux → Solde = soldes[compte] ──
                            const dispLegs = _viewLegs(_mkLegs(cyc.m, cyc.a, isCurrent ? 'remaining' : 'full'));
                            dispLegs.sort((x, y) => _cSort(x.jourPrevu) - _cSort(y.jourPrevu));
                            dispLegs.forEach(l => {
                                const soldeCompteApres = _apply(l.account, l.montant, l.type);
                                entries.push({ libelle: l.libelle, montant: l.montant, type: l.type, jourPrevu: l.jourPrevu, etat: 'prevu', soldeApres: soldeCompteApres, compteKey: l.account, soldeCompteApres });
                            });

                            // ── Avance silencieuse vers le cycle suivant (cycles intermédiaires non affichés) ──
                            if (_ci < _activeCycles.length - 1) {
                                const nextCyc = _activeCycles[_ci + 1];
                                let _nm = cyc.m, _na = cyc.a, _g2 = 0;
                                if (_nm === 12) { _nm = 1; _na++; } else { _nm++; }
                                while (!(_nm === nextCyc.m && _na === nextCyc.a) && _g2++ < 36) {
                                    _advanceCycle(_nm, _na, 'full');
                                    if (_nm === 12) { _nm = 1; _na++; } else { _nm++; }
                                }
                            }
                        }

                        // Atterrissage : somme des comptes sélectionnés (single/multi) ou patrimoine total (Global)
                        const _soldeAtterr = _rFiltres.length === 0 ? _sumSoldes() : _rFiltres.reduce((s, k) => s + (Number(soldes[k]) || 0), 0);
                        return { entries, soldeAtterrissage: _soldeAtterr };`);

// ─────────────────────────────────────────────────────────────
// OP 4 : Version + changelog
// ─────────────────────────────────────────────────────────────
replace('4) version + changelog',
`                    const CURRENT_VERSION = "26.30 Strict-Forward-Ledger";
                    const CHANGELOG = [
        { version: "26.30 Strict-Forward-Ledger", date: "2026-05-31", changes: [`,
`                    const CURRENT_VERSION = "26.40 Core-Ledger-Rebuild";
                    const CHANGELOG = [
        { version: "26.40 Core-Ledger-Rebuild", date: "2026-05-31", changes: [
            "CENSURE TOTALE DU PASSÉ : suppression de la section 'Déjà Réalisé' (realized-in) — le journal commence directement par ⏰ AUJOURD'HUI suivi uniquement des flux futurs (paye:false)",
            "PIVOT T0 UNIQUE : les lignes ⏰ AUJOURD'HUI apparaissent UNIQUEMENT en tête du premier cycle. Les cycles suivants reçoivent seulement un séparateur 📅 --- CYCLE DE JUILLET --- sans réinitialiser les soldes (simulation continue)",
            "_viewLegs CORRIGÉ : gestion stricte de single / multi-select / Global. Plus de bug 'dernier compte sélectionné' — chaque filtre affiche le bon T0 isolé",
            "CRÉANCES FUTURES incluses : les dépenses irrégulières à montant négatif (remboursements, créances) apparaissent maintenant comme entrées 💚 dans le journal (paye:false uniquement)",
            "ATTERRISSAGE MULTI-SELECT : en sélection multiple, l'atterrissage = somme des soldes finaux des comptes sélectionnés (jamais la somme globale de tous les comptes)",
            "Note de version : demande intitulée V26.40 — numérotée 26.40 Core-Ledger-Rebuild (continuité après 26.30)"
        ] },
        { version: "26.30 Strict-Forward-Ledger", date: "2026-05-31", changes: [`);

// ─────────────────────────────────────────────────────────────
fs.writeFileSync(FILE, html.replace(/\n/g, '\r\n'), 'utf8');
console.log('\n✅ ' + opCount + ' opérations appliquées — v26.40 Core-Ledger-Rebuild');
