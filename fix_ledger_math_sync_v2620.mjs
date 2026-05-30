// fix_ledger_math_sync_v2620.mjs
// v26.20 Ledger-Math-Sync — vraie agrégation (reduce) des charges fixes/variables par compte,
//                           chocs + épargne DÉTAILLÉS (double écriture), épargne paye:true censurée,
//                           section "Déjà Réalisé" = revenus reçus uniquement.
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
// OP 1 : _mkLegs — vraie agrégation reduce (charges) + chocs/épargne détaillés (double écriture)
// ─────────────────────────────────────────────────────────────
replace('1) _mkLegs — reduce charges + chocs/épargne détaillés',
`                            // v26.0 Ledger-Refinement : SORTIES AGRÉGÉES par macro-catégorie × compte (les revenus restent détaillés ci-dessus)
                            // 💳 Total Charges Fixes (compte source unique)
                            let _totFix = 0;
                            Object.values(dA.chargesFixes || {}).forEach(f => {
                                if (mode === 'realized-in') return; // aucune sortie dans le passé
                                _totFix += _amt(f, f.valeur);
                            });
                            _totFix = Math.round(_totFix * 100) / 100;
                            if (_totFix > 0) out.push({ account: _fxSrc, libelle: '💳 Total Charges Fixes', montant: _totFix, type: 'debit', jourPrevu: 10, internal: false });
                            // 🛒 Total Charges Variables (compte source unique)
                            let _totVar = 0;
                            Object.values(dA.chargesVariables || {}).forEach(cv => {
                                if (mode === 'realized-in') return;
                                _totVar += _varAmt(cv);
                            });
                            _totVar = Math.round(_totVar * 100) / 100;
                            if (_totVar > 0) out.push({ account: _varSrc, libelle: '🛒 Total Charges Variables', montant: _totVar, type: 'debit', jourPrevu: 15, internal: false });
                            // ⚠️ Total Flux Exceptionnels (Chocs) — agrégés par compte source
                            const _chocAcc = {};
                            getDepensesCycle(m, a).forEach(dep => {
                                if (mode === 'realized-in') return;
                                const due = Number(dep.montant || 0); if (!due) return;
                                let amt;
                                if (mode === 'full') amt = due;
                                else { if (isItemPaid(dep, due)) amt = 0; else { const r = due - (getPaidAmount(dep, due) || 0); amt = r > 0 ? r : 0; } }
                                amt = Math.round(amt * 100) / 100;
                                if (amt > 0) { const _k = _normKey(dep.sourceCompte); _chocAcc[_k] = (_chocAcc[_k] || 0) + amt; }
                            });
                            Object.keys(_chocAcc).forEach(_k => {
                                const _v = Math.round(_chocAcc[_k] * 100) / 100;
                                if (_v > 0) out.push({ account: _k, libelle: '⚠️ Total Flux Exceptionnels', montant: _v, type: 'debit', jourPrevu: 20, internal: false });
                            });
                            // 🎯 Total Épargne — transfert interne agrégé (prélèvement par source + versement par destination)
                            const epArr = Array.isArray(dA.epargne) ? dA.epargne : Object.values(dA.epargne || {});
                            const _epOut = {}, _epIn = {};
                            epArr.forEach(e => {
                                if (mode === 'realized-in') return; // l'épargne est un transfert, jamais un revenu encaissé
                                const v = _effVal(e, e.valeur, m); if (v <= 0) return;
                                if (mode !== 'full' && isItemPaid(e, v)) return; // déjà virée → exclue (radar forward-only)
                                const amt = Math.round(v * 100) / 100;
                                const _src = _normKey(e.sourceCompte || 'courant');
                                const _dst = e.linkedAccountId ? _normKey(e.linkedAccountId) : ('ep_' + e.id);
                                _epOut[_src] = (_epOut[_src] || 0) + amt;
                                _epIn[_dst] = (_epIn[_dst] || 0) + amt;
                            });
                            Object.keys(_epOut).forEach(_k => { const _v = Math.round(_epOut[_k] * 100) / 100; if (_v > 0) out.push({ account: _k, libelle: '🎯 Total Épargne (prélèvement)', montant: _v, type: 'debit', jourPrevu: jdp, internal: true }); });
                            Object.keys(_epIn).forEach(_k => { const _v = Math.round(_epIn[_k] * 100) / 100; if (_v > 0) out.push({ account: _k, libelle: '🎯 Total Épargne (versement)', montant: _v, type: 'credit', jourPrevu: jdp, internal: true }); });
                            return out;`,
`                            // v26.20 Ledger-Math-Sync : realized-in = revenus encaissés uniquement (déjà poussés ci-dessus) → AUCUNE sortie
                            if (mode === 'realized-in') return out;

                            // ===== CHARGES FIXES : VRAIE AGRÉGATION MATHÉMATIQUE (reduce) → UNE seule ligne par compte =====
                            const _fixByAcc = Object.values(dA.chargesFixes || {}).reduce((acc, f) => {
                                const amt = _amt(f, f.valeur);
                                if (amt > 0) acc[_fxSrc] = Math.round(((acc[_fxSrc] || 0) + amt) * 100) / 100;
                                return acc;
                            }, {});
                            Object.keys(_fixByAcc).forEach(k => { if (_fixByAcc[k] > 0) out.push({ account: k, libelle: '💳 Total Charges Fixes', montant: _fixByAcc[k], type: 'debit', jourPrevu: 10, internal: false }); });

                            // ===== CHARGES VARIABLES : VRAIE AGRÉGATION MATHÉMATIQUE (reduce) → UNE seule ligne par compte =====
                            const _varByAcc = Object.values(dA.chargesVariables || {}).reduce((acc, cv) => {
                                const amt = _varAmt(cv);
                                if (amt > 0) acc[_varSrc] = Math.round(((acc[_varSrc] || 0) + amt) * 100) / 100;
                                return acc;
                            }, {});
                            Object.keys(_varByAcc).forEach(k => { if (_varByAcc[k] > 0) out.push({ account: k, libelle: '🛒 Total Charges Variables', montant: _varByAcc[k], type: 'debit', jourPrevu: 15, internal: false }); });

                            // ===== CHOCS EXCEPTIONNELS : DÉTAILLÉS ligne par ligne (JAMAIS regroupés — on garde la trace) =====
                            getDepensesCycle(m, a).forEach(dep => {
                                const due = Number(dep.montant || 0); if (!due) return;
                                let amt;
                                if (mode === 'full') amt = due;
                                else { if (isItemPaid(dep, due)) amt = 0; else { const r = due - (getPaidAmount(dep, due) || 0); amt = r > 0 ? r : 0; } }
                                amt = Math.round(amt * 100) / 100;
                                if (amt > 0) out.push({ account: _normKey(dep.sourceCompte), libelle: '⚠️ ' + (dep.nom || dep.label || 'Dépense'), montant: amt, type: 'debit', jourPrevu: Number(dep.jourPrevu || 20), internal: false });
                            });

                            // ===== ÉPARGNE : DÉTAILLÉE + DOUBLE ÉCRITURE ; paye:true CENSURÉ à 100% (déjà dans les T0) =====
                            const epArr = Array.isArray(dA.epargne) ? dA.epargne : Object.values(dA.epargne || {});
                            epArr.forEach(e => {
                                const v = _effVal(e, e.valeur, m); if (v <= 0) return;
                                if (mode !== 'full' && isItemPaid(e, v)) return; // transfert déjà réalisé → censuré 100% (jamais affiché)
                                const amt = Math.round(v * 100) / 100;
                                const lbl = e.nom || e.label || 'Épargne';
                                const _jr = Number(e.jourPrevu || jdp);
                                const _src = _normKey(e.sourceCompte || 'courant');
                                const _dst = e.linkedAccountId ? _normKey(e.linkedAccountId) : ('ep_' + e.id);
                                // Ligne 1 — DÉBIT sur le compte SOURCE (l'argent sort)
                                out.push({ account: _src, libelle: '💎 Transfert → ' + lbl, montant: amt, type: 'debit', jourPrevu: _jr, internal: true });
                                // Ligne 2 — CRÉDIT sur le compte DESTINATION (l'argent arrive)
                                out.push({ account: _dst, libelle: '💎 Versement reçu — ' + lbl, montant: amt, type: 'credit', jourPrevu: _jr, internal: true });
                            });
                            return out;`);

// ─────────────────────────────────────────────────────────────
// OP 2 : CHANTIER 4 — libellé de la section des entrées reçues → "✅ Déjà Réalisé"
// ─────────────────────────────────────────────────────────────
replace('2) libellé section Déjà Réalisé',
`                                    entries.push({ type: 'sep_realise', libelle: '✅ Déjà Encaissé ce cycle', soldeApres: solde, jourPrevu: null });`,
`                                    entries.push({ type: 'sep_realise', libelle: '✅ Déjà Réalisé (entrées reçues)', soldeApres: solde, jourPrevu: null });`);

// ─────────────────────────────────────────────────────────────
// OP 3 : Version + changelog
// ─────────────────────────────────────────────────────────────
replace('3) version + changelog',
`                    const CURRENT_VERSION = "26.10 Multi-Ledger-Correction";
                    const CHANGELOG = [
        { version: "26.10 Multi-Ledger-Correction", date: "2026-05-30", changes: [`,
`                    const CURRENT_VERSION = "26.20 Ledger-Math-Sync";
                    const CHANGELOG = [
        { version: "26.20 Ledger-Math-Sync", date: "2026-05-30", changes: [
            "VRAIE AGRÉGATION (reduce) : les charges fixes et variables futures (paye:false) sont réellement ADDITIONNÉES par compte — UNE seule ligne 💳 Total Charges Fixes et UNE seule ligne 🛒 Total Charges Variables, contenant la somme exacte (fini le simple renommage de libellés)",
            "SYNCHRONISATION DU SOLDE : le montant affiché sur chaque ligne correspond exactement au delta appliqué au solde isolé du compte concerné — aucune opération invisible en arrière-plan",
            "CHOCS + ÉPARGNE DÉTAILLÉS : les dépenses exceptionnelles et les transferts d'épargne restent ligne par ligne (jamais regroupés) pour tracer les gros mouvements",
            "ÉPARGNE — double écriture stricte : un transfert futur (paye:false) génère 2 lignes (débit compte source + crédit compte destination). Un transfert déjà réalisé (paye:true) est CENSURÉ à 100% (déjà inclus dans les soldes T0)",
            "Section ✅ Déjà Réalisé restaurée avant ⏰ AUJOURD'HUI : uniquement les revenus/créances reçus (paye:true), détaillés ligne par ligne ; toutes les charges passées restent censurées",
            "Note de version : demande intitulée V26.20 — numérotée 26.20 (continuité après 26.10)"
        ] },
        { version: "26.10 Multi-Ledger-Correction", date: "2026-05-30", changes: [`);

// ─────────────────────────────────────────────────────────────
fs.writeFileSync(FILE, html.replace(/\n/g, '\r\n'), 'utf8');
console.log('\n✅ ' + opCount + ' opérations appliquées — v26.20 Ledger-Math-Sync');
