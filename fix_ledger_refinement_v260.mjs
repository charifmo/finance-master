// fix_ledger_refinement_v260.mjs
// v26.0 Ledger-Refinement — sorties agrégées par macro-catégorie, revenus détaillés,
//                           purge des lignes initiales à 0 DH, nettoyage des styles "passé"
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
// OP 1 : _mkLegs — SORTIES AGRÉGÉES par macro-catégorie (revenus restent détaillés)
// ─────────────────────────────────────────────────────────────
replace('1) _mkLegs — sorties agrégées par macro-catégorie',
`                            // Charges fixes → compteChargesFixes (débit) — UNE LIGNE PAR CHARGE FIXE
                            Object.values(dA.chargesFixes || {}).forEach(f => {
                                if (mode === 'realized-in') return; // v25.98 : AUCUNE sortie dans le passé
                                const amt = _amt(f, f.valeur);
                                if (amt > 0) out.push({ account: _fxSrc, libelle: '🔒 ' + (f.label || f.nom || 'Charge fixe'), montant: amt, type: 'debit', jourPrevu: Number(f.jourPrevu || 10), internal: false });
                            });
                            // Charges variables → compteChargesVariables (débit) — UNE LIGNE PAR CATÉGORIE
                            Object.values(dA.chargesVariables || {}).forEach(cv => {
                                if (mode === 'realized-in') return; // v25.98 : AUCUNE sortie dans le passé
                                const amt = _varAmt(cv);
                                if (amt > 0) out.push({ account: _varSrc, libelle: '📊 ' + (cv.label || cv.nom || 'Charge variable'), montant: amt, type: 'debit', jourPrevu: Number(cv.jourPrevu || 15), internal: false });
                            });
                            // Dépenses exceptionnelles du cycle (règle du 27) → sourceCompte (débit) — UNE LIGNE PAR DÉPENSE
                            getDepensesCycle(m, a).forEach(dep => {
                                if (mode === 'realized-in') return; // v25.98 : AUCUNE sortie dans le passé
                                const due = Number(dep.montant || 0); if (!due) return;
                                let amt;
                                if (mode === 'full') amt = due;
                                else { if (isItemPaid(dep, due)) amt = 0; else { const r = due - (getPaidAmount(dep, due) || 0); amt = r > 0 ? r : 0; } }
                                amt = Math.round(amt * 100) / 100;
                                if (amt > 0) out.push({ account: _normKey(dep.sourceCompte), libelle: '⚠️ ' + (dep.nom || dep.label || 'Dépense'), montant: amt, type: 'debit', jourPrevu: Number(dep.jourPrevu || 20), internal: false });
                            });
                            // Épargne → transfert interne : UNE LIGNE prélèvement + UNE LIGNE versement PAR ÉPARGNE
                            const epArr = Array.isArray(dA.epargne) ? dA.epargne : Object.values(dA.epargne || {});
                            epArr.forEach(e => {
                                if (mode === 'realized-in') return; // v25.98 : l'épargne est un transfert, jamais un revenu encaissé
                                const v = _effVal(e, e.valeur, m); if (v <= 0) return;
                                if (mode !== 'full' && isItemPaid(e, v)) return; // déjà virée → exclue (radar forward-only)
                                const amt = Math.round(v * 100) / 100;
                                const lbl = e.nom || e.label || 'Épargne';
                                const _jr = Number(e.jourPrevu || jdp);
                                out.push({ account: _normKey(e.sourceCompte || 'courant'), libelle: '💎 ' + lbl + ' (prélèvement)', montant: amt, type: 'debit', jourPrevu: _jr, internal: true });
                                out.push({ account: e.linkedAccountId ? _normKey(e.linkedAccountId) : ('ep_' + e.id), libelle: '💎 ' + lbl + ' (versement)', montant: amt, type: 'credit', jourPrevu: _jr, internal: true });
                            });
                            return out;`,
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
                            return out;`);

// ─────────────────────────────────────────────────────────────
// OP 2 : Pré-calcul de l'ensemble des comptes RÉELLEMENT impactés (vue Global)
// ─────────────────────────────────────────────────────────────
replace('2) précalcul _impacted (comptes touchés par des flux)',
`                        const entries = [];
                        let solde = opening;

                        for (let _ci = 0; _ci < _activeCycles.length; _ci++) {`,
`                        // v26.0 Ledger-Refinement : comptes réellement impactés par des flux dans la sélection (vue Global)
                        const _impacted = new Set();
                        if (_rFiltres.length === 0) {
                            _activeCycles.forEach(cyc => {
                                const _isCur = (cyc.m === curM && cyc.a === curA);
                                _viewLegs(_mkLegs(cyc.m, cyc.a, _isCur ? 'remaining' : 'full')).forEach(l => _impacted.add(l.account));
                                if (_isCur) _viewLegs(_mkLegs(cyc.m, cyc.a, 'realized-in')).forEach(l => _impacted.add(l.account));
                            });
                        }

                        const entries = [];
                        let solde = opening;

                        for (let _ci = 0; _ci < _activeCycles.length; _ci++) {`);

// ─────────────────────────────────────────────────────────────
// OP 3 : Purge des lignes initiales à 0 DH (vue Global)
// ─────────────────────────────────────────────────────────────
replace('3) purge lignes initiales fantômes à 0 DH',
`                                (comptes.value || []).forEach(c => {
                                    const _s = Number(c.solde); const _sv = Number.isFinite(_s) ? _s : 0;
                                    entries.push({ type: 'initial', libelle: "⏰ AUJOURD'HUI", montant: _sv, soldeApres: _sv, jourPrevu: null, etat: 't0', compteKey: 'cpt_' + c.id, soldeCompteApres: _sv });
                                });
                                const _ep0 = Array.isArray((donneesAnnuelles.value[cyc.a] || {}).epargne) ? donneesAnnuelles.value[cyc.a].epargne : Object.values((donneesAnnuelles.value[cyc.a] || {}).epargne || {});
                                _ep0.forEach(e => {
                                    const _s = Number(e.valeur); const _sv = Number.isFinite(_s) ? _s : 0;
                                    entries.push({ type: 'initial', libelle: "⏰ AUJOURD'HUI", montant: _sv, soldeApres: _sv, jourPrevu: null, etat: 't0', compteKey: 'ep_' + e.id, soldeCompteApres: _sv });
                                });`,
`                                (comptes.value || []).forEach(c => {
                                    const _s = Number(c.solde); const _sv = Number.isFinite(_s) ? _s : 0;
                                    if (_sv === 0 && !_impacted.has('cpt_' + c.id)) return; // v26.0 : purge des lignes fantômes à 0 DH (compte vide & non impacté)
                                    entries.push({ type: 'initial', libelle: "⏰ AUJOURD'HUI", montant: _sv, soldeApres: _sv, jourPrevu: null, etat: 't0', compteKey: 'cpt_' + c.id, soldeCompteApres: _sv });
                                });
                                const _ep0 = Array.isArray((donneesAnnuelles.value[cyc.a] || {}).epargne) ? donneesAnnuelles.value[cyc.a].epargne : Object.values((donneesAnnuelles.value[cyc.a] || {}).epargne || {});
                                _ep0.forEach(e => {
                                    const _s = Number(e.valeur); const _sv = Number.isFinite(_s) ? _s : 0;
                                    if (_sv === 0 && !_impacted.has('ep_' + e.id)) return; // v26.0 : purge des livrets vides & non impactés
                                    entries.push({ type: 'initial', libelle: "⏰ AUJOURD'HUI", montant: _sv, soldeApres: _sv, jourPrevu: null, etat: 't0', compteKey: 'ep_' + e.id, soldeCompteApres: _sv });
                                });`);

// ─────────────────────────────────────────────────────────────
// OP 4 : Nettoyage des styles "passé" — INLINE (séparateur + ligne réalisée)
// ─────────────────────────────────────────────────────────────
replace('4) styles passé inline — neutre',
`                                            <!-- v25.90 : séparateur "Déjà Réalisé" -->
                                            <tr v-else-if="e.type === 'sep_realise'" class="bg-emerald-50 border-y border-emerald-300">
                                                <td colspan="5" class="py-1 px-3 text-center">
                                                    <span class="text-[10px] font-black uppercase tracking-widest text-emerald-700">{{ e.libelle }}</span>
                                                </td>
                                            </tr>
                                            <!-- v25.90 : ligne réalisée (rentrée/dépense déjà pointée — Booking, Assurance…) -->
                                            <tr v-else-if="e.etat === 'realise'" :class="['border-b', e.type === 'credit' ? 'border-emerald-100 bg-emerald-50/50' : 'border-orange-100 bg-orange-50/40']">
                                                <td class="p-2 text-[10px] text-emerald-700 font-black whitespace-nowrap">{{ e.jourPrevu ? 'j.' + e.jourPrevu : '✓' }}</td>
                                                <td class="p-2 text-xs text-gray-900 font-medium">
                                                    <span v-if="releveComptesFiltres.length === 0 && e.compteKey" class="inline-block text-[8px] font-black bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded mr-1 align-middle">{{ getNomCompte(e.compteKey) }}</span>{{ e.libelle }}
                                                </td>
                                                <td class="p-2 text-right font-black text-emerald-700 text-xs tabular-nums">{{ e.type === 'credit' ? formatMAD(e.montant) : '' }}</td>
                                                <td class="p-2 text-right font-black text-orange-600 text-xs tabular-nums">{{ e.type === 'debit' ? formatMAD(e.montant) : '' }}</td>
                                                <td class="p-2 text-right text-xs text-gray-600 tabular-nums">—</td>
                                            </tr>`,
`                                            <!-- v26.0 Ledger-Refinement : séparateur "Déjà Encaissé" — neutre (plus de vert criard) -->
                                            <tr v-else-if="e.type === 'sep_realise'" class="bg-gray-100 border-y border-gray-300">
                                                <td colspan="5" class="py-1 px-3 text-center">
                                                    <span class="text-[10px] font-black uppercase tracking-widest text-gray-500">{{ e.libelle }}</span>
                                                </td>
                                            </tr>
                                            <!-- v26.0 : ligne déjà réalisée — affichage simple/neutre, sans solde cumulé (déjà inclus dans T0) -->
                                            <tr v-else-if="e.etat === 'realise'" class="border-b border-gray-100 bg-gray-50/50">
                                                <td class="p-2 text-[10px] text-gray-400 font-bold whitespace-nowrap">{{ e.jourPrevu ? 'j.' + e.jourPrevu : '✓' }}</td>
                                                <td class="p-2 text-xs text-gray-500 font-medium">
                                                    <span v-if="releveComptesFiltres.length === 0 && e.compteKey" class="inline-block text-[8px] font-black bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded mr-1 align-middle">{{ getNomCompte(e.compteKey) }}</span>{{ e.libelle }}
                                                </td>
                                                <td class="p-2 text-right font-bold text-gray-500 text-xs tabular-nums">{{ e.type === 'credit' ? formatMAD(e.montant) : '' }}</td>
                                                <td class="p-2 text-right font-bold text-gray-500 text-xs tabular-nums">{{ e.type === 'debit' ? formatMAD(e.montant) : '' }}</td>
                                                <td class="p-2 text-right text-xs text-gray-300 tabular-nums">✓</td>
                                            </tr>`);

// ─────────────────────────────────────────────────────────────
// OP 5 : Nettoyage des styles "passé" — MODAL (séparateur + ligne réalisée)
// ─────────────────────────────────────────────────────────────
replace('5) styles passé modal — neutre',
`                                <!-- v25.90 : séparateur "Déjà Réalisé" -->
                                <tr v-else-if="e.type === 'sep_realise'" class="bg-emerald-50 border-y border-emerald-300">
                                    <td colspan="5" class="py-1.5 px-4 text-center">
                                        <span class="text-[10px] font-black uppercase tracking-widest text-emerald-700">{{ e.libelle }}</span>
                                    </td>
                                </tr>
                                <!-- v25.90 : ligne réalisée (Booking / Assurance / charges pointées) -->
                                <tr v-else-if="e.etat === 'realise'" :class="['border-b', e.type === 'credit' ? 'border-emerald-100 bg-emerald-50/50' : 'border-orange-100 bg-orange-50/40']">
                                    <td class="p-2 text-[10px] text-emerald-700 font-black whitespace-nowrap">{{ e.jourPrevu ? 'j.' + e.jourPrevu : '✓' }}</td>
                                    <td class="p-2 text-xs text-gray-900 font-medium">
                                        <span v-if="releveComptesFiltres.length === 0 && e.compteKey" class="inline-block text-[8px] font-black bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded mr-1 align-middle">{{ getNomCompte(e.compteKey) }}</span>{{ e.libelle }}
                                    </td>
                                    <td class="p-2 text-right font-black text-emerald-700 text-xs tabular-nums">{{ e.type === 'credit' ? formatMAD(e.montant) : '' }}</td>
                                    <td class="p-2 text-right font-black text-orange-600 text-xs tabular-nums">{{ e.type === 'debit' ? formatMAD(e.montant) : '' }}</td>
                                    <td class="p-2 text-right text-xs text-gray-600 tabular-nums">—</td>
                                </tr>`,
`                                <!-- v26.0 Ledger-Refinement : séparateur "Déjà Encaissé" — neutre -->
                                <tr v-else-if="e.type === 'sep_realise'" class="bg-gray-100 border-y border-gray-300">
                                    <td colspan="5" class="py-1.5 px-4 text-center">
                                        <span class="text-[10px] font-black uppercase tracking-widest text-gray-500">{{ e.libelle }}</span>
                                    </td>
                                </tr>
                                <!-- v26.0 : ligne déjà réalisée — affichage simple/neutre, sans solde cumulé -->
                                <tr v-else-if="e.etat === 'realise'" class="border-b border-gray-100 bg-gray-50/50">
                                    <td class="p-2 text-[10px] text-gray-400 font-bold whitespace-nowrap">{{ e.jourPrevu ? 'j.' + e.jourPrevu : '✓' }}</td>
                                    <td class="p-2 text-xs text-gray-500 font-medium">
                                        <span v-if="releveComptesFiltres.length === 0 && e.compteKey" class="inline-block text-[8px] font-black bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded mr-1 align-middle">{{ getNomCompte(e.compteKey) }}</span>{{ e.libelle }}
                                    </td>
                                    <td class="p-2 text-right font-bold text-gray-500 text-xs tabular-nums">{{ e.type === 'credit' ? formatMAD(e.montant) : '' }}</td>
                                    <td class="p-2 text-right font-bold text-gray-500 text-xs tabular-nums">{{ e.type === 'debit' ? formatMAD(e.montant) : '' }}</td>
                                    <td class="p-2 text-right text-xs text-gray-300 tabular-nums">✓</td>
                                </tr>`);

// ─────────────────────────────────────────────────────────────
// OP 6 : Version + changelog
// ─────────────────────────────────────────────────────────────
replace('6) version + changelog',
`                    const CURRENT_VERSION = "25.98 Inflows-Radar-Fix";
                    const CHANGELOG = [
        { version: "25.98 Inflows-Radar-Fix", date: "2026-05-30", changes: [`,
`                    const CURRENT_VERSION = "26.0 Ledger-Refinement";
                    const CHANGELOG = [
        { version: "26.0 Ledger-Refinement", date: "2026-05-30", changes: [
            "FILTRE ASYMÉTRIQUE : les ENTRÉES (revenus/remboursements) restent détaillées ligne par ligne, mais les SORTIES sont désormais AGRÉGÉES par macro-catégorie × compte → 💳 Total Charges Fixes, 🛒 Total Charges Variables, 🎯 Total Épargne, ⚠️ Total Flux Exceptionnels — fini l'encombrement facture par facture",
            "PURGE des lignes initiales fantômes : en vue Global, une ligne ⏰ AUJOURD'HUI n'est affichée pour un compte/livret QUE s'il a un solde réel ≠ 0 ou s'il est réellement impacté par un flux de la sélection (plus de lignes à 0 DH en haut du tableau)",
            "NETTOYAGE des styles du passé : la section ✅ Déjà Encaissé et ses lignes réalisées passent en gris neutre (plus de vert/orange criard ni de soldes contradictoires) — affichage simple, chaîne de solde fluide",
            "Note de version : demande intitulée V26.0 — numérotée 26.0 (continuité après 25.98)"
        ] },
        { version: "25.98 Inflows-Radar-Fix", date: "2026-05-30", changes: [`);

// ─────────────────────────────────────────────────────────────
fs.writeFileSync(FILE, html.replace(/\n/g, '\r\n'), 'utf8');
console.log('\n✅ ' + opCount + ' opérations appliquées — v26.0 Ledger-Refinement');
