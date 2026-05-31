// fix_workflow_creances_v2650.mjs
// v26.50 Workflow-Creances-Fix
import fs from 'node:fs';
const FILE = 'C:/Users/HP/finance/index.html';
let html = fs.readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n');
let opCount = 0;
const check = (label, str) => { if (!html.includes(str)) { console.error('❌ ANCHOR MISSING: ' + label); process.exit(1); } };
const replace = (label, from, to) => { check(label, from); const n = html.split(from).length - 1; html = html.split(from).join(to); opCount++; console.log('✔ ' + label + ' (' + n + ' occ)'); };

// ── OP1 : _mkLegs chocs — exclure les sourceAssurance (déjà dans assurances_tracker) ──
replace('1) _mkLegs chocs — exclure sourceAssurance',
`                            // ===== CHOCS EXCEPTIONNELS + CRÉANCES FUTURES : DÉTAILLÉS ligne par ligne =====
                            getDepensesCycle(m, a).forEach(dep => {
                                const rawDue = Number(dep.montant || 0); if (rawDue === 0) return;
                                const isCreance = rawDue < 0; // montant négatif = créance / remboursement à recevoir`,
`                            // ===== CHOCS EXCEPTIONNELS : DÉTAILLÉS ligne par ligne (créances via assurances_tracker) =====
                            getDepensesCycle(m, a).forEach(dep => {
                                if (dep.sourceAssurance) return; // géré directement via assurances_tracker — pas de doublon
                                const rawDue = Number(dep.montant || 0); if (rawDue === 0) return;
                                const isCreance = rawDue < 0; // entrée exceptionnelle hors créances assurances`);

// ── OP2 : _mkLegs fin — ajouter section créances déclarées avant return out ──
replace('2) _mkLegs — section créances déclarées',
`                                out.push({ account: _dst, libelle: '💎 Versement reçu — ' + lbl, montant: amt, type: 'credit', jourPrevu: _jr, internal: true });
                            });
                            return out;`,
`                                out.push({ account: _dst, libelle: '💎 Versement reçu — ' + lbl, montant: amt, type: 'credit', jourPrevu: _jr, internal: true });
                            });
                            // ===== CRÉANCES DÉCLARÉES : assurances_tracker (remboursement:true) — ligne détaillée par créance =====
                            (_si.assurances_tracker || []).forEach(c => {
                                if (!c.remboursement) return; // uniquement "Déclaré" (coché)
                                if (!c.dateRemboursement) return;
                                const _dr = new Date(c.dateRemboursement);
                                if ((_dr.getMonth() + 1) !== m || _dr.getFullYear() !== a) return; // filtre cycle exact
                                const amt = Math.round(Number(c.montantRembourse || c.montant || 0) * 100) / 100;
                                if (amt <= 0) return;
                                const _lbl = '💰 Créance : ' + (c.libelle || ((c.assureur || '') + (c.type ? ' ' + c.type : '')) || 'Remboursement');
                                out.push({ account: _normKey(c.compteDepot || 'courant'), libelle: _lbl, montant: amt, type: 'credit', jourPrevu: _dr.getDate(), internal: false });
                            });
                            return out;`);

// ── OP3 : _syncAssuranceCashflow — cleanup only, plus d'injection dans depensesIrregulieres ──
replace('3) _syncAssuranceCashflow — cleanup only',
`                    const _syncAssuranceCashflow = (item) => {
                        const compteDepot = item.compteDepot || configAssurances.value.compte_depot_defaut || '';
                        let remYear = Number(soldesInitiaux.value.anneeActuelle);
                        let remMois = new Date().getMonth() + 1;
                        if (item.dateRemboursement) {
                            const dr = new Date(item.dateRemboursement);
                            remYear = dr.getFullYear();
                            remMois = dr.getMonth() + 1;
                        }
                        if (!donneesAnnuelles.value[remYear]) remYear = Number(soldesInitiaux.value.anneeActuelle);
                        // Supprimer l'ancienne entrée (toutes années)
                        Object.values(donneesAnnuelles.value).forEach(d => {
                            if (!Array.isArray(d.depensesIrregulieres)) return;
                            const fi = d.depensesIrregulieres.findIndex(x => x.sourceAssurance === item.id);
                            if (fi !== -1) d.depensesIrregulieres.splice(fi, 1);
                        });
                        const d = donneesAnnuelles.value[remYear];
                        if (!d) return;
                        if (!Array.isArray(d.depensesIrregulieres)) d.depensesIrregulieres = [];
                        const assurLabel = (item.assureur || '') + (item.type ? ' ' + item.type : '') + (item.libelle ? ' – ' + item.libelle : '') + ' (' + (item.beneficiaire || '') + ')';
                        d.depensesIrregulieres.push({
                            id: 'cashf_' + Date.now(),
                            nom: '🛡️ ' + assurLabel,
                            montant: -(Number(item.montantRembourse || item.montant || 0)),
                            mois: remMois, annee: remYear,
                            paye: false,      // ← CRITIQUE : false pour que _chocEffectif l'inclue
                            montantPaye: 0,
                            sourceCompte: compteDepot,
                            sourceAssurance: item.id
                        });
                    };`,
`                    const _syncAssuranceCashflow = (item) => {
                        // v26.50 Workflow-Creances-Fix : ne plus injecter dans depensesIrregulieres (suppression du double-clic)
                        // Les créances Déclarées s'injectent directement dans journalHybridePourReleve via assurances_tracker
                        // Cette fonction nettoie uniquement les anciennes entrées potentiellement existantes
                        Object.values(donneesAnnuelles.value).forEach(d => {
                            if (!Array.isArray(d.depensesIrregulieres)) return;
                            const fi = d.depensesIrregulieres.findIndex(x => x.sourceAssurance === item.id);
                            if (fi !== -1) d.depensesIrregulieres.splice(fi, 1);
                        });
                    };`);

// ── OP4 : toggleAssuranceRembourse — simplifier (cleanup dans les 2 directions) ──
replace('4) toggleAssuranceRembourse — simplifier',
`                    const toggleAssuranceRembourse = (item) => {
                        item.remboursement = !item.remboursement;
                        if (item.remboursement) {
                            _syncAssuranceCashflow(item);
                        } else {
                            // Retirer le flux cash-flow de toutes les années
                            Object.values(donneesAnnuelles.value).forEach(d => {
                                if (!Array.isArray(d.depensesIrregulieres)) return;
                                const fi = d.depensesIrregulieres.findIndex(x => x.sourceAssurance === item.id);
                                if (fi !== -1) d.depensesIrregulieres.splice(fi, 1);
                            });
                        }
                        handleDataChange();
                    };`,
`                    const toggleAssuranceRembourse = (item) => {
                        item.remboursement = !item.remboursement;
                        _syncAssuranceCashflow(item); // cleanup dans les deux directions (plus d'injection)
                        handleDataChange();
                    };`);

// ── OP5 : message créance card — supprimer "Flux injecté dans Flux Exceptionnels" ──
replace('5) message créance card — update',
`                                            <p v-if="item.remboursement" class="text-[9px] text-green-600 font-bold mt-0.5">✔ Flux injecté dans les Flux Exceptionnels — à confirmer manuellement quand reçu</p>`,
`                                            <p v-if="item.remboursement" class="text-[9px] text-green-600 font-bold mt-0.5">✔ Créance déclarée — visible directement dans le journal prévisionnel (aucune action supplémentaire requise)</p>`);

// ── OP6 : Inline table thead — ajouter colonne Compte ──
replace('6) inline thead — colonne Compte',
`                                    <thead class="bg-gray-50 sticky top-0 z-10">
                                        <tr>
                                            <th class="p-2 text-left font-black text-[10px] uppercase tracking-widest text-gray-400 w-10">J.</th>
                                            <th class="p-2 text-left font-black text-[10px] uppercase tracking-widest text-gray-500">Libellé</th>
                                            <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-green-600 w-24">Entrant</th>
                                            <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-red-500 w-24">Sortant</th>
                                            <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-gray-500 w-24">Solde</th>
                                        </tr>
                                    </thead>`,
`                                    <thead class="bg-gray-50 sticky top-0 z-10">
                                        <tr>
                                            <th class="p-2 text-left font-black text-[10px] uppercase tracking-widest text-gray-400 w-10">J.</th>
                                            <th class="p-2 text-left font-black text-[10px] uppercase tracking-widest text-blue-600 w-28">Compte</th>
                                            <th class="p-2 text-left font-black text-[10px] uppercase tracking-widest text-gray-500">Libellé</th>
                                            <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-green-600 w-24">Entrant</th>
                                            <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-red-500 w-24">Sortant</th>
                                            <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-gray-500 w-24">Solde</th>
                                        </tr>
                                    </thead>`);

// ── OP7 : Inline tbody — 6 colonnes ──
replace('7) inline tbody — 6 colonnes',
`                                    <tbody>
                                        <template v-for="(e, i) in journalHybridePourReleve.entries" :key="i">
                                            <tr v-if="e.type === 'separator'" class="bg-cyan-50 border-y-2 border-cyan-400">
                                                <td colspan="5" class="py-1.5 px-3 text-center">
                                                    <span class="text-[10px] font-black uppercase tracking-widest text-cyan-700">⏰ AUJOURD'HUI</span>
                                                    <span class="text-[10px] font-bold text-cyan-500 ml-2">Solde réel : {{ formatMAD(tresoActuelleCourante) }}</span>
                                                </td>
                                            </tr>
                                            <tr v-else-if="e.type === 'initial'" class="bg-blue-50 border-b-2 border-blue-300">
                                                <td class="p-2 text-[10px] font-bold text-blue-400">{{ e.jourPrevu ? 'J.' + e.jourPrevu : '' }}</td>
                                                <td colspan="3" class="p-2 text-xs font-black text-blue-700 uppercase tracking-wider"><span v-if="releveComptesFiltres.length === 0 && e.compteKey" class="inline-block text-[8px] font-black bg-blue-200 text-blue-900 px-1.5 py-0.5 rounded mr-1 align-middle normal-case tracking-normal">{{ getNomCompte(e.compteKey) }}</span>{{ e.libelle }}</td>
                                                <td class="p-2 text-right font-black text-xs tabular-nums text-blue-700">{{ formatMAD(e.soldeCompteApres ?? e.soldeApres) }}</td>
                                            </tr>
                                            <!-- v25.90 Multi-Ledger-Core : séparateur de cycle (multi-cycle) -->
                                            <tr v-else-if="e.type === 'cycle_sep'" class="bg-indigo-50 border-y-2 border-indigo-300">
                                                <td colspan="5" class="py-1.5 px-3 text-center">
                                                    <span class="text-[10px] font-black uppercase tracking-widest text-indigo-700">{{ e.libelle }}</span>
                                                    <span v-if="e.soldeApres !== null && e.soldeApres !== undefined" class="text-[10px] font-bold text-indigo-500 ml-2">Solde entrée : {{ formatMAD(e.soldeApres) }}</span>
                                                </td>
                                            </tr>
                                            <!-- v26.10 Multi-Ledger-Correction : séparateur "Déjà Encaissé" (entrées reçues, visibles) -->
                                            <tr v-else-if="e.type === 'sep_realise'" class="bg-emerald-50 border-y border-emerald-200">
                                                <td colspan="5" class="py-1 px-3 text-center">
                                                    <span class="text-[10px] font-black uppercase tracking-widest text-emerald-700">{{ e.libelle }}</span>
                                                </td>
                                            </tr>
                                            <!-- v26.10 : entrée déjà reçue (paye:true) — détaillée et visible ; colonne Solde = ✓ reçu (montant déjà inclus dans T0) -->
                                            <tr v-else-if="e.etat === 'realise'" class="border-b border-emerald-100 bg-emerald-50/40">
                                                <td class="p-2 text-[10px] text-emerald-600 font-bold whitespace-nowrap">{{ e.jourPrevu ? 'j.' + e.jourPrevu : '✓' }}</td>
                                                <td class="p-2 text-xs text-gray-800 font-medium">
                                                    <span v-if="releveComptesFiltres.length === 0 && e.compteKey" class="inline-block text-[8px] font-black bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded mr-1 align-middle">{{ getNomCompte(e.compteKey) }}</span>{{ e.libelle }}
                                                </td>
                                                <td class="p-2 text-right font-black text-emerald-700 text-xs tabular-nums">{{ e.type === 'credit' ? formatMAD(e.montant) : '' }}</td>
                                                <td class="p-2 text-right font-black text-red-500 text-xs tabular-nums">{{ e.type === 'debit' ? formatMAD(e.montant) : '' }}</td>
                                                <td class="p-2 text-right text-[10px] text-emerald-500 font-bold tabular-nums">✓ reçu</td>
                                            </tr>
                                            <!-- v25.90 Multi-Ledger-Core : ligne standard (avec badge compte en vue Global + solde par compte) -->
                                            <tr v-else :class="['border-b transition-all', e.type === 'credit' ? 'border-gray-100 bg-green-50/30 hover:bg-green-50/60' : 'border-gray-100 bg-white hover:bg-gray-50']">
                                                <td class="p-2 text-[10px] text-gray-900 font-black whitespace-nowrap">{{ e.jourPrevu ? 'j.' + e.jourPrevu : '' }}</td>
                                                <td class="p-2 text-xs text-gray-900 font-medium">
                                                    <span v-if="releveComptesFiltres.length === 0 && e.compteKey" class="inline-block text-[8px] font-black bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded mr-1 align-middle">{{ getNomCompte(e.compteKey) }}</span>{{ e.libelle }}
                                                </td>
                                                <td class="p-2 text-right font-black text-green-700 text-xs tabular-nums">{{ e.type === 'credit' ? formatMAD(e.montant) : '' }}</td>
                                                <td class="p-2 text-right font-black text-red-600 text-xs tabular-nums">{{ e.type === 'debit' ? formatMAD(e.montant) : '' }}</td>
                                                <td class="p-2 text-right font-black text-xs tabular-nums" :class="(e.soldeCompteApres ?? e.soldeApres) < 0 ? 'text-red-700' : 'text-gray-900'">{{ formatMAD(e.soldeCompteApres ?? e.soldeApres) }}</td>
                                            </tr>
                                        </template>
                                    </tbody>`,
`                                    <tbody>
                                        <template v-for="(e, i) in journalHybridePourReleve.entries" :key="i">
                                            <tr v-if="e.type === 'separator'" class="bg-cyan-50 border-y-2 border-cyan-400">
                                                <td colspan="6" class="py-1.5 px-3 text-center">
                                                    <span class="text-[10px] font-black uppercase tracking-widest text-cyan-700">⏰ AUJOURD'HUI</span>
                                                    <span class="text-[10px] font-bold text-cyan-500 ml-2">Solde réel : {{ formatMAD(tresoActuelleCourante) }}</span>
                                                </td>
                                            </tr>
                                            <tr v-else-if="e.type === 'initial'" class="bg-blue-50 border-b-2 border-blue-300">
                                                <td class="p-2 text-[10px] font-bold text-blue-400">{{ e.jourPrevu ? 'J.' + e.jourPrevu : '' }}</td>
                                                <td class="p-2"><span v-if="e.compteKey" class="inline-block text-[8px] font-black bg-blue-200 text-blue-900 px-1.5 py-0.5 rounded whitespace-nowrap">{{ getNomCompte(e.compteKey) }}</span></td>
                                                <td colspan="3" class="p-2 text-xs font-black text-blue-700 uppercase tracking-wider">{{ e.libelle }}</td>
                                                <td class="p-2 text-right font-black text-xs tabular-nums text-blue-700">{{ formatMAD(e.soldeCompteApres ?? e.soldeApres) }}</td>
                                            </tr>
                                            <tr v-else-if="e.type === 'cycle_sep'" class="bg-indigo-50 border-y-2 border-indigo-300">
                                                <td colspan="6" class="py-1.5 px-3 text-center">
                                                    <span class="text-[10px] font-black uppercase tracking-widest text-indigo-700">{{ e.libelle }}</span>
                                                    <span v-if="e.soldeApres !== null && e.soldeApres !== undefined" class="text-[10px] font-bold text-indigo-500 ml-2">Solde entrée : {{ formatMAD(e.soldeApres) }}</span>
                                                </td>
                                            </tr>
                                            <tr v-else-if="e.type === 'sep_realise'" class="bg-emerald-50 border-y border-emerald-200">
                                                <td colspan="6" class="py-1 px-3 text-center">
                                                    <span class="text-[10px] font-black uppercase tracking-widest text-emerald-700">{{ e.libelle }}</span>
                                                </td>
                                            </tr>
                                            <tr v-else-if="e.etat === 'realise'" class="border-b border-emerald-100 bg-emerald-50/40">
                                                <td class="p-2 text-[10px] text-emerald-600 font-bold whitespace-nowrap">{{ e.jourPrevu ? 'j.' + e.jourPrevu : '✓' }}</td>
                                                <td class="p-2"><span v-if="e.compteKey" class="inline-block text-[8px] font-black bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded whitespace-nowrap">{{ getNomCompte(e.compteKey) }}</span></td>
                                                <td class="p-2 text-xs text-gray-800 font-medium">{{ e.libelle }}</td>
                                                <td class="p-2 text-right font-black text-emerald-700 text-xs tabular-nums">{{ e.type === 'credit' ? formatMAD(e.montant) : '' }}</td>
                                                <td class="p-2 text-right font-black text-red-500 text-xs tabular-nums">{{ e.type === 'debit' ? formatMAD(e.montant) : '' }}</td>
                                                <td class="p-2 text-right text-[10px] text-emerald-500 font-bold tabular-nums">✓ reçu</td>
                                            </tr>
                                            <tr v-else :class="['border-b transition-all', e.type === 'credit' ? 'border-gray-100 bg-green-50/30 hover:bg-green-50/60' : 'border-gray-100 bg-white hover:bg-gray-50']">
                                                <td class="p-2 text-[10px] text-gray-900 font-black whitespace-nowrap">{{ e.jourPrevu ? 'j.' + e.jourPrevu : '' }}</td>
                                                <td class="p-2"><span v-if="e.compteKey" class="inline-block text-[8px] font-black bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded whitespace-nowrap">{{ getNomCompte(e.compteKey) }}</span></td>
                                                <td class="p-2 text-xs text-gray-900 font-medium">{{ e.libelle }}</td>
                                                <td class="p-2 text-right font-black text-green-700 text-xs tabular-nums">{{ e.type === 'credit' ? formatMAD(e.montant) : '' }}</td>
                                                <td class="p-2 text-right font-black text-red-600 text-xs tabular-nums">{{ e.type === 'debit' ? formatMAD(e.montant) : '' }}</td>
                                                <td class="p-2 text-right font-black text-xs tabular-nums" :class="(e.soldeCompteApres ?? e.soldeApres) < 0 ? 'text-red-700' : 'text-gray-900'">{{ formatMAD(e.soldeCompteApres ?? e.soldeApres) }}</td>
                                            </tr>
                                        </template>
                                    </tbody>`);

// ── OP8 : Inline tfoot ──
replace('8) inline tfoot — colspan 4→5',
`                                    <tr class="bg-indigo-50 border-t-2 border-indigo-400 sticky bottom-0">
                                            <td colspan="4" class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-indigo-700">🏁 Atterrissage Projeté</td>`,
`                                    <tr class="bg-indigo-50 border-t-2 border-indigo-400 sticky bottom-0">
                                            <td colspan="5" class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-indigo-700">🏁 Atterrissage Projeté</td>`);

// ── OP9 : Modal thead — ajouter colonne Compte ──
replace('9) modal thead — colonne Compte',
`                        <thead class="bg-gray-50 sticky top-0 z-10">
                            <tr>
                                <th class="p-2 text-left font-black text-[10px] uppercase tracking-widest text-gray-400 w-10">J.</th>
                                <th class="p-2 text-left font-black text-[10px] uppercase tracking-widest text-gray-500">Libellé</th>
                                <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-green-600 w-28">Entrant</th>
                                <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-red-500 w-28">Sortant</th>
                                <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-gray-500 w-28">Solde</th>
                            </tr>
                        </thead>`,
`                        <thead class="bg-gray-50 sticky top-0 z-10">
                            <tr>
                                <th class="p-2 text-left font-black text-[10px] uppercase tracking-widest text-gray-400 w-10">J.</th>
                                <th class="p-2 text-left font-black text-[10px] uppercase tracking-widest text-blue-600 w-28">Compte</th>
                                <th class="p-2 text-left font-black text-[10px] uppercase tracking-widest text-gray-500">Libellé</th>
                                <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-green-600 w-28">Entrant</th>
                                <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-red-500 w-28">Sortant</th>
                                <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-gray-500 w-28">Solde</th>
                            </tr>
                        </thead>`);

// ── OP10 : Modal tbody — 6 colonnes ──
replace('10) modal tbody — 6 colonnes',
`                            <template v-for="(e, i) in journalHybridePourReleve.entries" :key="i">
                                <tr v-if="e.type === 'separator'" class="bg-cyan-50 border-y-2 border-cyan-400">
                                    <td colspan="5" class="py-2 px-4 text-center">
                                        <span class="text-[10px] font-black uppercase tracking-widest text-cyan-700">⏰ AUJOURD'HUI</span>
                                        <span class="text-[10px] font-bold text-cyan-500 ml-2">Solde réel : {{ formatMAD(tresoActuelleCourante) }}</span>
                                    </td>
                                </tr>
                                <tr v-else-if="e.type === 'initial'" class="bg-blue-50 border-b-2 border-blue-300">
                                    <td class="p-2 text-[10px] font-bold text-blue-400">{{ e.jourPrevu ? 'J.' + e.jourPrevu : '' }}</td>
                                    <td colspan="3" class="p-2 text-xs font-black text-blue-700 uppercase tracking-wider"><span v-if="releveComptesFiltres.length === 0 && e.compteKey" class="inline-block text-[8px] font-black bg-blue-200 text-blue-900 px-1.5 py-0.5 rounded mr-1 align-middle normal-case tracking-normal">{{ getNomCompte(e.compteKey) }}</span>{{ e.libelle }}</td>
                                    <td class="p-2 text-right font-black text-xs tabular-nums text-blue-700">{{ formatMAD(e.soldeCompteApres ?? e.soldeApres) }}</td>
                                </tr>
                                <!-- v25.90 Multi-Ledger-Core : séparateur de cycle -->
                                <tr v-else-if="e.type === 'cycle_sep'" class="bg-indigo-50 border-y-2 border-indigo-300">
                                    <td colspan="5" class="py-1.5 px-4 text-center">
                                        <span class="text-[10px] font-black uppercase tracking-widest text-indigo-700">{{ e.libelle }}</span>
                                        <span v-if="e.soldeApres !== null && e.soldeApres !== undefined" class="text-[10px] font-bold text-indigo-500 ml-2">Solde entrée : {{ formatMAD(e.soldeApres) }}</span>
                                    </td>
                                </tr>
                                <!-- v26.10 Multi-Ledger-Correction : séparateur "Déjà Encaissé" (entrées reçues, visibles) -->
                                <tr v-else-if="e.type === 'sep_realise'" class="bg-emerald-50 border-y border-emerald-200">
                                    <td colspan="5" class="py-1.5 px-4 text-center">
                                        <span class="text-[10px] font-black uppercase tracking-widest text-emerald-700">{{ e.libelle }}</span>
                                    </td>
                                </tr>
                                <!-- v26.10 : entrée déjà reçue (paye:true) — détaillée et visible ; colonne Solde = ✓ reçu -->
                                <tr v-else-if="e.etat === 'realise'" class="border-b border-emerald-100 bg-emerald-50/40">
                                    <td class="p-2 text-[10px] text-emerald-600 font-bold whitespace-nowrap">{{ e.jourPrevu ? 'j.' + e.jourPrevu : '✓' }}</td>
                                    <td class="p-2 text-xs text-gray-800 font-medium">
                                        <span v-if="releveComptesFiltres.length === 0 && e.compteKey" class="inline-block text-[8px] font-black bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded mr-1 align-middle">{{ getNomCompte(e.compteKey) }}</span>{{ e.libelle }}
                                    </td>
                                    <td class="p-2 text-right font-black text-emerald-700 text-xs tabular-nums">{{ e.type === 'credit' ? formatMAD(e.montant) : '' }}</td>
                                    <td class="p-2 text-right font-black text-red-500 text-xs tabular-nums">{{ e.type === 'debit' ? formatMAD(e.montant) : '' }}</td>
                                    <td class="p-2 text-right text-[10px] text-emerald-500 font-bold tabular-nums">✓ reçu</td>
                                </tr>
                                <!-- v25.90 Multi-Ledger-Core : ligne standard avec badge compte (vue Global) + solde par compte -->
                                <tr v-else :class="['border-b transition-all', e.type === 'credit' ? 'border-gray-100 bg-green-50/30 hover:bg-green-50/60' : 'border-gray-100 bg-white hover:bg-gray-50']">
                                    <td class="p-2 text-[10px] text-gray-900 font-black whitespace-nowrap">{{ e.jourPrevu ? 'j.' + e.jourPrevu : '' }}</td>
                                    <td class="p-2 text-xs text-gray-900 font-medium">
                                        <span v-if="releveComptesFiltres.length === 0 && e.compteKey" class="inline-block text-[8px] font-black bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded mr-1 align-middle">{{ getNomCompte(e.compteKey) }}</span>{{ e.libelle }}
                                    </td>
                                    <td class="p-2 text-right font-black text-green-700 text-xs tabular-nums">{{ e.type === 'credit' ? formatMAD(e.montant) : '' }}</td>
                                    <td class="p-2 text-right font-black text-red-600 text-xs tabular-nums">{{ e.type === 'debit' ? formatMAD(e.montant) : '' }}</td>
                                    <td class="p-2 text-right font-black text-xs tabular-nums" :class="(e.soldeCompteApres ?? e.soldeApres) < 0 ? 'text-red-700' : 'text-gray-900'">{{ formatMAD(e.soldeCompteApres ?? e.soldeApres) }}</td>
                                </tr>
                            </template>`,
`                            <template v-for="(e, i) in journalHybridePourReleve.entries" :key="i">
                                <tr v-if="e.type === 'separator'" class="bg-cyan-50 border-y-2 border-cyan-400">
                                    <td colspan="6" class="py-2 px-4 text-center">
                                        <span class="text-[10px] font-black uppercase tracking-widest text-cyan-700">⏰ AUJOURD'HUI</span>
                                        <span class="text-[10px] font-bold text-cyan-500 ml-2">Solde réel : {{ formatMAD(tresoActuelleCourante) }}</span>
                                    </td>
                                </tr>
                                <tr v-else-if="e.type === 'initial'" class="bg-blue-50 border-b-2 border-blue-300">
                                    <td class="p-2 text-[10px] font-bold text-blue-400">{{ e.jourPrevu ? 'J.' + e.jourPrevu : '' }}</td>
                                    <td class="p-2"><span v-if="e.compteKey" class="inline-block text-[8px] font-black bg-blue-200 text-blue-900 px-1.5 py-0.5 rounded whitespace-nowrap">{{ getNomCompte(e.compteKey) }}</span></td>
                                    <td colspan="3" class="p-2 text-xs font-black text-blue-700 uppercase tracking-wider">{{ e.libelle }}</td>
                                    <td class="p-2 text-right font-black text-xs tabular-nums text-blue-700">{{ formatMAD(e.soldeCompteApres ?? e.soldeApres) }}</td>
                                </tr>
                                <tr v-else-if="e.type === 'cycle_sep'" class="bg-indigo-50 border-y-2 border-indigo-300">
                                    <td colspan="6" class="py-1.5 px-4 text-center">
                                        <span class="text-[10px] font-black uppercase tracking-widest text-indigo-700">{{ e.libelle }}</span>
                                        <span v-if="e.soldeApres !== null && e.soldeApres !== undefined" class="text-[10px] font-bold text-indigo-500 ml-2">Solde entrée : {{ formatMAD(e.soldeApres) }}</span>
                                    </td>
                                </tr>
                                <tr v-else-if="e.type === 'sep_realise'" class="bg-emerald-50 border-y border-emerald-200">
                                    <td colspan="6" class="py-1.5 px-4 text-center">
                                        <span class="text-[10px] font-black uppercase tracking-widest text-emerald-700">{{ e.libelle }}</span>
                                    </td>
                                </tr>
                                <tr v-else-if="e.etat === 'realise'" class="border-b border-emerald-100 bg-emerald-50/40">
                                    <td class="p-2 text-[10px] text-emerald-600 font-bold whitespace-nowrap">{{ e.jourPrevu ? 'j.' + e.jourPrevu : '✓' }}</td>
                                    <td class="p-2"><span v-if="e.compteKey" class="inline-block text-[8px] font-black bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded whitespace-nowrap">{{ getNomCompte(e.compteKey) }}</span></td>
                                    <td class="p-2 text-xs text-gray-800 font-medium">{{ e.libelle }}</td>
                                    <td class="p-2 text-right font-black text-emerald-700 text-xs tabular-nums">{{ e.type === 'credit' ? formatMAD(e.montant) : '' }}</td>
                                    <td class="p-2 text-right font-black text-red-500 text-xs tabular-nums">{{ e.type === 'debit' ? formatMAD(e.montant) : '' }}</td>
                                    <td class="p-2 text-right text-[10px] text-emerald-500 font-bold tabular-nums">✓ reçu</td>
                                </tr>
                                <tr v-else :class="['border-b transition-all', e.type === 'credit' ? 'border-gray-100 bg-green-50/30 hover:bg-green-50/60' : 'border-gray-100 bg-white hover:bg-gray-50']">
                                    <td class="p-2 text-[10px] text-gray-900 font-black whitespace-nowrap">{{ e.jourPrevu ? 'j.' + e.jourPrevu : '' }}</td>
                                    <td class="p-2"><span v-if="e.compteKey" class="inline-block text-[8px] font-black bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded whitespace-nowrap">{{ getNomCompte(e.compteKey) }}</span></td>
                                    <td class="p-2 text-xs text-gray-900 font-medium">{{ e.libelle }}</td>
                                    <td class="p-2 text-right font-black text-green-700 text-xs tabular-nums">{{ e.type === 'credit' ? formatMAD(e.montant) : '' }}</td>
                                    <td class="p-2 text-right font-black text-red-600 text-xs tabular-nums">{{ e.type === 'debit' ? formatMAD(e.montant) : '' }}</td>
                                    <td class="p-2 text-right font-black text-xs tabular-nums" :class="(e.soldeCompteApres ?? e.soldeApres) < 0 ? 'text-red-700' : 'text-gray-900'">{{ formatMAD(e.soldeCompteApres ?? e.soldeApres) }}</td>
                                </tr>
                            </template>`);

// ── OP11 : Modal tfoot ──
replace('11) modal tfoot — colspan 4→5',
`                            <tr class="bg-indigo-50 border-t-2 border-indigo-400">
                                <td colspan="4" class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-indigo-700">🏁 Atterrissage Projeté</td>`,
`                            <tr class="bg-indigo-50 border-t-2 border-indigo-400">
                                <td colspan="5" class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-indigo-700">🏁 Atterrissage Projeté</td>`);

// ── OP12 : Version ──
replace('12) version',
`                    const CURRENT_VERSION = "26.40 Core-Ledger-Rebuild";
                    const CHANGELOG = [
        { version: "26.40 Core-Ledger-Rebuild", date: "2026-05-31", changes: [`,
`                    const CURRENT_VERSION = "26.50 Workflow-Creances-Fix";
                    const CHANGELOG = [
        { version: "26.50 Workflow-Creances-Fix", date: "2026-05-31", changes: [
            "COLONNE COMPTE : les deux tables du journal (inline + modal) ont désormais une colonne dédiée 'Compte' avant 'Libellé' — le badge du compte apparaît sur chaque ligne, toujours visible quelle que soit la vue (Global, single, multi-select)",
            "ZÉRO DOUBLE-CLIC : _syncAssuranceCashflow ne pousse plus jamais dans depensesIrregulieres — les créances Déclarées (remboursement:true) s'injectent directement dans journalHybridePourReleve via assurances_tracker",
            "FILTRE ABSOLU : seules les créances avec remboursement:true ET dateRemboursement dans le cycle affiché sont injectées comme crédits détaillés (💰 Créance : ...) dans le journal prévisionnel",
            "NETTOYAGE : les anciens cashf_ dans depensesIrregulieres (sourceAssurance) sont exclus du moteur chocs (guard if dep.sourceAssurance return) pour éviter tout doublon",
            "Note : demande intitulée V26.50 — numérotée 26.50 Workflow-Creances-Fix"
        ] },
        { version: "26.40 Core-Ledger-Rebuild", date: "2026-05-31", changes: [`);

fs.writeFileSync(FILE, html.replace(/\n/g, '\r\n'), 'utf8');
console.log('\n✅ ' + opCount + ' opérations appliquées — v26.50 Workflow-Creances-Fix');
