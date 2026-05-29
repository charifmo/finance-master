import { readFileSync, writeFileSync } from 'fs';

const filePath = 'C:/Users/HP/finance/index.html';
let html = readFileSync(filePath, 'utf8');
html = html.replace(/\r\n/g, '\n');

let ops = 0;
const check = (label, ok) => {
    if (!ok) { console.error('❌ ' + label); process.exit(1); }
    ops++;
    console.log('✅ ' + label);
};

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 1 : journalHybride computed — Réalisé + T0 + Prévu
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_AFTER_SOLDE_INIT = `                        return Math.round((base - paidRev + paidChg) * 100) / 100;
                    });

                    const getMonthlyVariableValue`;
const NEW_AFTER_SOLDE_INIT = `                        return Math.round((base - paidRev + paidChg) * 100) / 100;
                    });

                    // v24.0 Journal Hybride : Réalisé → T0 → Prévu Restant
                    const journalHybride = computed(() => {
                        calculationTick.value;
                        const an = moisBudgetaire.value.an;
                        const mois = moisBudgetaire.value.mois;
                        const dAnnee = donneesAnnuelles.value[an];
                        const jdp = Number((soldesInitiaux.value || {}).jourDePaie) || 27;
                        const soldeInit = soldeInitialCycleActuel.value;
                        const treso = tresoActuelleCourante.value;
                        if (!dAnnee) return { entries: [], soldeAtterrissage: treso };

                        const paidItems = [], unpaidItems = [];

                        // Revenus
                        Object.values(dAnnee.revenus || {}).forEach(r => {
                            const due = Number(r.base || 0);
                            if (!due) return;
                            const paid = isItemPaid(r, due);
                            const amt = paid ? (getPaidAmount(r, due) || due) : due;
                            (paid ? paidItems : unpaidItems).push({
                                libelle: r.label || 'Revenu',
                                montant: amt, type: 'credit',
                                jourPrevu: Number(r.jourPrevu || jdp),
                                etat: paid ? 'realise' : 'prevu'
                            });
                        });

                        // Charges fixes
                        Object.values(dAnnee.chargesFixes || {}).forEach(f => {
                            const due = Number(f.valeur || 0);
                            if (!due) return;
                            const paid = isItemPaid(f, due);
                            const amt = paid ? (getPaidAmount(f, due) || due) : due;
                            (paid ? paidItems : unpaidItems).push({
                                libelle: f.label || 'Charge fixe',
                                montant: amt, type: 'debit',
                                jourPrevu: Number(f.jourPrevu || 10),
                                etat: paid ? 'realise' : 'prevu'
                            });
                        });

                        // Charges variables (items individuels, mensuel uniquement)
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
                                        etat: paid ? 'realise' : 'prevu'
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
                                    etat: paid ? 'realise' : 'prevu'
                                });
                            }
                        });

                        // Dépenses irrégulières du mois
                        getDepensesMois(mois, an).forEach(dep => {
                            const due = Number(dep.montant || 0);
                            if (!due) return;
                            const paid = isItemPaid(dep, due);
                            const amt = paid ? (getPaidAmount(dep, due) || due) : due;
                            (paid ? paidItems : unpaidItems).push({
                                libelle: dep.nom || dep.label || 'Dépense',
                                montant: amt, type: 'debit',
                                jourPrevu: 20,
                                etat: paid ? 'realise' : 'prevu'
                            });
                        });

                        paidItems.sort((a, b) => a.jourPrevu - b.jourPrevu);
                        unpaidItems.sort((a, b) => a.jourPrevu - b.jourPrevu);

                        const entries = [];
                        entries.push({ type: 'initial', libelle: 'Solde Initial du Cycle', montant: soldeInit, soldeApres: soldeInit, jourPrevu: jdp, etat: 'realise' });

                        let soldeCourant = soldeInit;
                        paidItems.forEach(item => {
                            soldeCourant = Math.round((soldeCourant + (item.type === 'credit' ? item.montant : -item.montant)) * 100) / 100;
                            entries.push({ ...item, soldeApres: soldeCourant });
                        });

                        // Pivot T0 : ancrage sur le solde bancaire réel
                        entries.push({ type: 'separator', libelle: 'AUJOURD\'HUI', montant: treso, soldeApres: treso, jourPrevu: null, etat: 't0' });

                        let soldeProj = treso;
                        unpaidItems.forEach(item => {
                            soldeProj = Math.round((soldeProj + (item.type === 'credit' ? item.montant : -item.montant)) * 100) / 100;
                            entries.push({ ...item, soldeApres: soldeProj });
                        });

                        return { entries, soldeAtterrissage: soldeProj };
                    });

                    const getMonthlyVariableValue`;
check('Op1 journalHybride computed', html.includes(OLD_AFTER_SOLDE_INIT));
html = html.replace(OLD_AFTER_SOLDE_INIT, NEW_AFTER_SOLDE_INIT);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 2 : Inline journal — remplacer Mode Transactions par Hybride + Classique
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_INLINE_JOURNAL = `                            <!-- Tableau : Mode Transactions -->
                            <div v-if="!releveModeEvolution" class="overflow-auto max-h-[600px] custom-scroll">
                                <table v-if="releveCompte.length > 0" class="w-full min-w-[500px] text-sm border-collapse">
                                    <thead class="bg-gray-50 sticky top-0 z-10">
                                        <tr>
                                            <th class="p-2 text-left font-black text-[10px] uppercase tracking-widest text-gray-500 w-20">Période</th>
                                            <th v-if="releveShowCompte" class="p-2 text-left font-black text-[10px] uppercase tracking-widest text-gray-500">Compte</th>
                                            <th class="p-2 text-left font-black text-[10px] uppercase tracking-widest text-gray-500">Libellé</th>
                                            <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-green-600 w-24">Entrant</th>
                                            <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-red-500 w-24">Sortant</th>
                                            <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-gray-500 w-24">Solde</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr v-for="(e, i) in releveCompteGrouped" :key="i"
                                            :class="[e.type === 'initial' ? 'border-b-2 border-blue-300 bg-blue-50' : (e._gMois % 2 === 0 ? 'border-b border-gray-100 hover:bg-white bg-white' : 'border-b border-indigo-100 bg-indigo-50/60 hover:bg-indigo-100/60'), e._isNewMonth && e.type !== 'initial' ? 'border-t-2 border-indigo-300' : '']">
                                            <td class="p-2 font-bold text-gray-600 whitespace-nowrap text-xs">{{ e.mois }}</td>
                                            <td v-if="releveShowCompte" class="p-2 text-xs font-bold whitespace-nowrap" :class="e._compteKey && e._compteKey.startsWith('ep_') ? 'text-purple-600' : 'text-blue-600'">{{ e._compteLabel }}</td>
                                            <td class="p-2 text-xs" :class="e.type === 'initial' ? 'font-black text-blue-700 uppercase tracking-wider' : 'text-gray-700'">{{ e.libelle }}</td>
                                            <td class="p-2 text-right font-bold text-green-600 text-xs tabular-nums">{{ e.type === 'credit' ? formatMAD(e.montant) : (e.type === 'initial' && e.montant ? formatMAD(e.montant) : '') }}</td>
                                            <td class="p-2 text-right font-bold text-red-500 text-xs tabular-nums">{{ e.type === 'debit' ? formatMAD(e.montant) : '' }}</td>
                                            <td class="p-2 text-right font-black text-xs tabular-nums" :class="e.type === 'initial' ? 'text-blue-700' : (e.soldeApres < 0 ? 'text-red-600' : 'text-gray-800')">{{ formatMAD(e.soldeApres) }}</td>
                                        </tr>
                                    </tbody>
                                </table>
                                <p v-else class="text-center text-gray-400 py-12 font-bold text-sm">Aucun mouvement enregistré.</p>
                            </div>`;
const NEW_INLINE_JOURNAL = `                            <!-- Tableau : Mode Transactions — v24.0 Journal Hybride -->
                            <div v-if="!releveModeEvolution" class="overflow-auto max-h-[600px] custom-scroll">
                                <!-- Journal Hybride : cycle actuel (pas de filtre cycle passé) -->
                                <table v-if="!releveActiveCycle" class="w-full min-w-[400px] text-sm border-collapse">
                                    <thead class="bg-gray-50 sticky top-0 z-10">
                                        <tr>
                                            <th class="p-2 text-left font-black text-[10px] uppercase tracking-widest text-gray-400 w-10">J.</th>
                                            <th class="p-2 text-left font-black text-[10px] uppercase tracking-widest text-gray-500">Libellé</th>
                                            <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-green-600 w-24">Entrant</th>
                                            <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-red-500 w-24">Sortant</th>
                                            <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-gray-500 w-24">Solde</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <template v-for="(e, i) in journalHybride.entries" :key="i">
                                            <tr v-if="e.type === 'separator'" class="bg-cyan-50 border-y-2 border-cyan-400">
                                                <td colspan="5" class="py-1.5 px-3 text-center">
                                                    <span class="text-[10px] font-black uppercase tracking-widest text-cyan-700">⏰ AUJOURD'HUI</span>
                                                    <span class="text-[10px] font-bold text-cyan-500 ml-2">Solde réel : {{ formatMAD(tresoActuelleCourante) }}</span>
                                                </td>
                                            </tr>
                                            <tr v-else-if="e.type === 'initial'" class="bg-blue-50 border-b-2 border-blue-300">
                                                <td class="p-2 text-[10px] font-bold text-blue-400">J.{{ e.jourPrevu }}</td>
                                                <td colspan="3" class="p-2 text-xs font-black text-blue-700 uppercase tracking-wider">{{ e.libelle }}</td>
                                                <td class="p-2 text-right font-black text-xs tabular-nums text-blue-700">{{ formatMAD(e.soldeApres) }}</td>
                                            </tr>
                                            <tr v-else :class="['border-b transition-all', e.etat === 'prevu' ? 'opacity-50 border-dashed border-gray-200 bg-white' : (e.type === 'credit' ? 'border-gray-100 bg-green-50/30 hover:bg-green-50/60' : 'border-gray-100 bg-white hover:bg-gray-50')]">
                                                <td class="p-2 text-[10px] text-gray-400 font-bold whitespace-nowrap">{{ e.jourPrevu ? 'j.' + e.jourPrevu : '' }}</td>
                                                <td class="p-2 text-xs text-gray-700"><span v-if="e.etat === 'prevu'" class="inline-block text-[8px] font-black bg-amber-100 text-amber-600 px-1 rounded mr-1">⏳</span>{{ e.libelle }}</td>
                                                <td class="p-2 text-right font-bold text-green-600 text-xs tabular-nums">{{ e.type === 'credit' ? formatMAD(e.montant) : '' }}</td>
                                                <td class="p-2 text-right font-bold text-red-500 text-xs tabular-nums">{{ e.type === 'debit' ? formatMAD(e.montant) : '' }}</td>
                                                <td class="p-2 text-right font-black text-xs tabular-nums" :class="e.soldeApres < 0 ? 'text-red-600' : 'text-gray-800'">{{ formatMAD(e.soldeApres) }}</td>
                                            </tr>
                                        </template>
                                    </tbody>
                                    <tfoot>
                                        <tr class="bg-indigo-50 border-t-2 border-indigo-400 sticky bottom-0">
                                            <td colspan="4" class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-indigo-700">🏁 Atterrissage projeté au 26</td>
                                            <td class="p-2 text-right font-black text-sm tabular-nums" :class="journalHybride.soldeAtterrissage < 0 ? 'text-red-600' : 'text-indigo-700'">{{ formatMAD(journalHybride.soldeAtterrissage) }}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                                <!-- Journal Classique : cycle passé sélectionné -->
                                <table v-else-if="releveCompte.length > 0" class="w-full min-w-[500px] text-sm border-collapse">
                                    <thead class="bg-gray-50 sticky top-0 z-10">
                                        <tr>
                                            <th class="p-2 text-left font-black text-[10px] uppercase tracking-widest text-gray-500 w-20">Période</th>
                                            <th v-if="releveShowCompte" class="p-2 text-left font-black text-[10px] uppercase tracking-widest text-gray-500">Compte</th>
                                            <th class="p-2 text-left font-black text-[10px] uppercase tracking-widest text-gray-500">Libellé</th>
                                            <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-green-600 w-24">Entrant</th>
                                            <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-red-500 w-24">Sortant</th>
                                            <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-gray-500 w-24">Solde</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr v-for="(e, i) in releveCompteGrouped" :key="i"
                                            :class="[e.type === 'initial' ? 'border-b-2 border-blue-300 bg-blue-50' : (e._gMois % 2 === 0 ? 'border-b border-gray-100 hover:bg-white bg-white' : 'border-b border-indigo-100 bg-indigo-50/60 hover:bg-indigo-100/60'), e._isNewMonth && e.type !== 'initial' ? 'border-t-2 border-indigo-300' : '']">
                                            <td class="p-2 font-bold text-gray-600 whitespace-nowrap text-xs">{{ e.mois }}</td>
                                            <td v-if="releveShowCompte" class="p-2 text-xs font-bold whitespace-nowrap" :class="e._compteKey && e._compteKey.startsWith('ep_') ? 'text-purple-600' : 'text-blue-600'">{{ e._compteLabel }}</td>
                                            <td class="p-2 text-xs" :class="e.type === 'initial' ? 'font-black text-blue-700 uppercase tracking-wider' : 'text-gray-700'">{{ e.libelle }}</td>
                                            <td class="p-2 text-right font-bold text-green-600 text-xs tabular-nums">{{ e.type === 'credit' ? formatMAD(e.montant) : (e.type === 'initial' && e.montant ? formatMAD(e.montant) : '') }}</td>
                                            <td class="p-2 text-right font-bold text-red-500 text-xs tabular-nums">{{ e.type === 'debit' ? formatMAD(e.montant) : '' }}</td>
                                            <td class="p-2 text-right font-black text-xs tabular-nums" :class="e.type === 'initial' ? 'text-blue-700' : (e.soldeApres < 0 ? 'text-red-600' : 'text-gray-800')">{{ formatMAD(e.soldeApres) }}</td>
                                        </tr>
                                    </tbody>
                                </table>
                                <p v-else class="text-center text-gray-400 py-12 font-bold text-sm">Aucun mouvement enregistré.</p>
                            </div>`;
check('Op2 inline journal hybrid', html.includes(OLD_INLINE_JOURNAL));
html = html.replace(OLD_INLINE_JOURNAL, NEW_INLINE_JOURNAL);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 3 : Modal journal — remplacer Mode Transactions par Hybride + Classique
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_MODAL_JOURNAL = `                <!-- Tableau : Mode Transactions — v18.00 overflow-x-auto -->
                <div v-if="!releveModeEvolution" class="flex-1 overflow-auto">
                    <table v-if="releveCompte.length > 0" class="w-full min-w-[500px] text-sm border-collapse">
                        <thead class="bg-gray-50 sticky top-0 z-10">
                            <tr>
                                <th class="p-2 text-left font-black text-[10px] uppercase tracking-widest text-gray-500 w-20">Période</th>
                                <th v-if="releveShowCompte" class="p-2 text-left font-black text-[10px] uppercase tracking-widest text-gray-500">Compte</th>
                                <th class="p-2 text-left font-black text-[10px] uppercase tracking-widest text-gray-500">Libellé</th>
                                <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-green-600 w-24">Entrant</th>
                                <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-red-500 w-24">Sortant</th>
                                <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-gray-500 w-24">Solde</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="(e, i) in releveCompteGrouped" :key="i"
                                :class="[e.type === 'initial' ? 'border-b-2 border-blue-300 bg-blue-50' : (e._gMois % 2 === 0 ? 'border-b border-gray-100 hover:bg-white bg-white' : 'border-b border-indigo-100 bg-indigo-50/60 hover:bg-indigo-100/60'), e._isNewMonth && e.type !== 'initial' ? 'border-t-2 border-indigo-300' : '']">
                                <td class="p-2 font-bold text-gray-600 whitespace-nowrap text-xs">{{ e.mois }}</td>
                                <td v-if="releveShowCompte" class="p-2 text-xs font-bold whitespace-nowrap" :class="e._compteKey && e._compteKey.startsWith('ep_') ? 'text-purple-600' : 'text-blue-600'">{{ e._compteLabel }}</td>
                                <td class="p-2 text-xs" :class="e.type === 'initial' ? 'font-black text-blue-700 uppercase tracking-wider' : 'text-gray-700'">{{ e.libelle }}</td>
                                <td class="p-2 text-right font-bold text-green-600 text-xs tabular-nums">{{ e.type === 'credit' ? formatMAD(e.montant) : (e.type === 'initial' && e.montant ? formatMAD(e.montant) : '') }}</td>
                                <td class="p-2 text-right font-bold text-red-500 text-xs tabular-nums">{{ e.type === 'debit' ? formatMAD(e.montant) : '' }}</td>
                                <td class="p-2 text-right font-black text-xs" :class="e.type === 'initial' ? 'text-blue-700' : (e.soldeApres < 0 ? 'text-red-600' : 'text-gray-800')">{{ formatMAD(e.soldeApres) }}</td>
                            </tr>
                        </tbody>
                    </table>
                    <p v-else class="text-center text-gray-400 py-8 font-bold">Aucun mouvement enregistré.</p>
                </div>`;
const NEW_MODAL_JOURNAL = `                <!-- Tableau : Mode Transactions — v24.0 Journal Hybride -->
                <div v-if="!releveModeEvolution" class="flex-1 overflow-auto">
                    <!-- Journal Hybride : cycle actuel -->
                    <table v-if="!releveActiveCycle" class="w-full min-w-[400px] text-sm border-collapse">
                        <thead class="bg-gray-50 sticky top-0 z-10">
                            <tr>
                                <th class="p-2 text-left font-black text-[10px] uppercase tracking-widest text-gray-400 w-10">J.</th>
                                <th class="p-2 text-left font-black text-[10px] uppercase tracking-widest text-gray-500">Libellé</th>
                                <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-green-600 w-28">Entrant</th>
                                <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-red-500 w-28">Sortant</th>
                                <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-gray-500 w-28">Solde</th>
                            </tr>
                        </thead>
                        <tbody>
                            <template v-for="(e, i) in journalHybride.entries" :key="i">
                                <tr v-if="e.type === 'separator'" class="bg-cyan-50 border-y-2 border-cyan-400">
                                    <td colspan="5" class="py-2 px-4 text-center">
                                        <span class="text-[10px] font-black uppercase tracking-widest text-cyan-700">⏰ AUJOURD'HUI</span>
                                        <span class="text-[10px] font-bold text-cyan-500 ml-2">Solde réel : {{ formatMAD(tresoActuelleCourante) }}</span>
                                    </td>
                                </tr>
                                <tr v-else-if="e.type === 'initial'" class="bg-blue-50 border-b-2 border-blue-300">
                                    <td class="p-2 text-[10px] font-bold text-blue-400">J.{{ e.jourPrevu }}</td>
                                    <td colspan="3" class="p-2 text-xs font-black text-blue-700 uppercase tracking-wider">{{ e.libelle }}</td>
                                    <td class="p-2 text-right font-black text-xs tabular-nums text-blue-700">{{ formatMAD(e.soldeApres) }}</td>
                                </tr>
                                <tr v-else :class="['border-b transition-all', e.etat === 'prevu' ? 'opacity-50 border-dashed border-gray-200 bg-white' : (e.type === 'credit' ? 'border-gray-100 bg-green-50/30 hover:bg-green-50/60' : 'border-gray-100 bg-white hover:bg-gray-50')]">
                                    <td class="p-2 text-[10px] text-gray-400 font-bold whitespace-nowrap">{{ e.jourPrevu ? 'j.' + e.jourPrevu : '' }}</td>
                                    <td class="p-2 text-xs text-gray-700"><span v-if="e.etat === 'prevu'" class="inline-block text-[8px] font-black bg-amber-100 text-amber-600 px-1 rounded mr-1">⏳</span>{{ e.libelle }}</td>
                                    <td class="p-2 text-right font-bold text-green-600 text-xs tabular-nums">{{ e.type === 'credit' ? formatMAD(e.montant) : '' }}</td>
                                    <td class="p-2 text-right font-bold text-red-500 text-xs tabular-nums">{{ e.type === 'debit' ? formatMAD(e.montant) : '' }}</td>
                                    <td class="p-2 text-right font-black text-xs tabular-nums" :class="e.soldeApres < 0 ? 'text-red-600' : 'text-gray-800'">{{ formatMAD(e.soldeApres) }}</td>
                                </tr>
                            </template>
                        </tbody>
                        <tfoot>
                            <tr class="bg-indigo-50 border-t-2 border-indigo-400">
                                <td colspan="4" class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-indigo-700">🏁 Atterrissage projeté au 26</td>
                                <td class="p-2 text-right font-black text-sm tabular-nums" :class="journalHybride.soldeAtterrissage < 0 ? 'text-red-600' : 'text-indigo-700'">{{ formatMAD(journalHybride.soldeAtterrissage) }}</td>
                            </tr>
                        </tfoot>
                    </table>
                    <!-- Journal Classique : cycle passé sélectionné -->
                    <table v-else-if="releveCompte.length > 0" class="w-full min-w-[500px] text-sm border-collapse">
                        <thead class="bg-gray-50 sticky top-0 z-10">
                            <tr>
                                <th class="p-2 text-left font-black text-[10px] uppercase tracking-widest text-gray-500 w-20">Période</th>
                                <th v-if="releveShowCompte" class="p-2 text-left font-black text-[10px] uppercase tracking-widest text-gray-500">Compte</th>
                                <th class="p-2 text-left font-black text-[10px] uppercase tracking-widest text-gray-500">Libellé</th>
                                <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-green-600 w-24">Entrant</th>
                                <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-red-500 w-24">Sortant</th>
                                <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-gray-500 w-24">Solde</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="(e, i) in releveCompteGrouped" :key="i"
                                :class="[e.type === 'initial' ? 'border-b-2 border-blue-300 bg-blue-50' : (e._gMois % 2 === 0 ? 'border-b border-gray-100 hover:bg-white bg-white' : 'border-b border-indigo-100 bg-indigo-50/60 hover:bg-indigo-100/60'), e._isNewMonth && e.type !== 'initial' ? 'border-t-2 border-indigo-300' : '']">
                                <td class="p-2 font-bold text-gray-600 whitespace-nowrap text-xs">{{ e.mois }}</td>
                                <td v-if="releveShowCompte" class="p-2 text-xs font-bold whitespace-nowrap" :class="e._compteKey && e._compteKey.startsWith('ep_') ? 'text-purple-600' : 'text-blue-600'">{{ e._compteLabel }}</td>
                                <td class="p-2 text-xs" :class="e.type === 'initial' ? 'font-black text-blue-700 uppercase tracking-wider' : 'text-gray-700'">{{ e.libelle }}</td>
                                <td class="p-2 text-right font-bold text-green-600 text-xs tabular-nums">{{ e.type === 'credit' ? formatMAD(e.montant) : (e.type === 'initial' && e.montant ? formatMAD(e.montant) : '') }}</td>
                                <td class="p-2 text-right font-bold text-red-500 text-xs tabular-nums">{{ e.type === 'debit' ? formatMAD(e.montant) : '' }}</td>
                                <td class="p-2 text-right font-black text-xs tabular-nums" :class="e.type === 'initial' ? 'text-blue-700' : (e.soldeApres < 0 ? 'text-red-600' : 'text-gray-800')">{{ formatMAD(e.soldeApres) }}</td>
                            </tr>
                        </tbody>
                    </table>
                    <p v-else class="text-center text-gray-400 py-8 font-bold">Aucun mouvement enregistré.</p>
                </div>`;
check('Op3 modal journal hybrid', html.includes(OLD_MODAL_JOURNAL));
html = html.replace(OLD_MODAL_JOURNAL, NEW_MODAL_JOURNAL);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 4 : Pilotage — ajouter Solde d'Atterrissage dans le bloc jourDePaie
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_JOURDEPAY_BLOCK = `                                <p class="text-[9px] text-blue-400 mt-0.5 font-black">🏦 Base cycle : {{ formatMAD(soldeInitialCycleActuel) }}</p>
                            </div>`;
const NEW_JOURDEPAY_BLOCK = `                                <p class="text-[9px] text-blue-400 mt-0.5 font-black">🏦 Base cycle : {{ formatMAD(soldeInitialCycleActuel) }}</p>
                                <p class="text-[9px] mt-0.5 font-black" :class="journalHybride.soldeAtterrissage >= 0 ? 'text-emerald-400' : 'text-red-400'">🏁 Atterrissage : {{ formatMAD(journalHybride.soldeAtterrissage) }}</p>
                            </div>`;
check('Op4 atterrissage in Pilotage', html.includes(OLD_JOURDEPAY_BLOCK));
html = html.replace(OLD_JOURDEPAY_BLOCK, NEW_JOURDEPAY_BLOCK);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 5 : return statement — exposer journalHybride
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_RETURN_SOLDE = `                        // v23.10 Prorata-T0
                        prorataVariableT0, provisionsFuturesT0, margeT0, elementsDuMoisPayes, elementsDuMoisTotal, soldeInitialCycleActuel,`;
const NEW_RETURN_SOLDE = `                        // v23.10 Prorata-T0
                        prorataVariableT0, provisionsFuturesT0, margeT0, elementsDuMoisPayes, elementsDuMoisTotal, soldeInitialCycleActuel,
                        // v24.0 Journal-Hybride
                        journalHybride,`;
check('Op5 return journalHybride', html.includes(OLD_RETURN_SOLDE));
html = html.replace(OLD_RETURN_SOLDE, NEW_RETURN_SOLDE);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 6 : Changelog
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_CHANGELOG_V24 = `const CHANGELOG = [\n                        { version: "23.40 Anti-Spaghetti",`;
const NEW_CHANGELOG_V24 = `const CHANGELOG = [\n                        { version: "24.0 Journal-Hybride", date: "2026-05-29 — Journal Realise + T0 + Prevu", changes: [\n                            "ARCHITECTURE : journalHybride computed remplace la copie theorique du budget. Trois sections : Realise (items coches), pivot T0 ancre sur tresoActuelleCourante, Prevu Restant (items non coches, opacite 50% + badge En attente).",\n                            "GARANTIE MATH : soldeInitialCycleActuel + Realises = tresoActuelleCourante (Clean Cut v23.40). Le journal part du solde initial, reconstruit le chemin et atterrit sur le solde reel a T0.",\n                            "UI : Separateur cyan AUJOURD'HUI, footer indigo Atterrissage projete au 26. Cycle passe selectionne = bascule sur Journal Classique (bilanJournal). Affiché inline + modal."\n                        ] },\n                        { version: "23.40 Anti-Spaghetti",`;
check('Op6 changelog v24.0', html.includes(OLD_CHANGELOG_V24));
html = html.replace(OLD_CHANGELOG_V24, NEW_CHANGELOG_V24);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 7 : Version bump → 24.0 Journal-Hybride
// ═══════════════════════════════════════════════════════════════════════════════
check('Op7 version string', html.includes('const CURRENT_VERSION = "23.40 Anti-Spaghetti"'));
html = html.replace('const CURRENT_VERSION = "23.40 Anti-Spaghetti"', 'const CURRENT_VERSION = "24.0 Journal-Hybride"');

writeFileSync(filePath, html, 'utf8');
console.log(`\n🎉 Done — ${ops}/7 ops. Fichier écrit.`);
