/**
 * refacto_pilotage_v2240.mjs
 * Pilotage Transparent : Reste à Payer + Tooltips KPI
 */

import { readFileSync, writeFileSync } from 'fs';

const FILE = 'C:/Users/HP/finance/index.html';
let html = readFileSync(FILE, 'utf8');

let log = [];
const replace = (desc, from, to) => {
  if (!html.includes(from)) { log.push(`❌ NOT FOUND: ${desc}`); return; }
  html = html.replace(from, to);
  log.push(`✅ OK: ${desc}`);
};

// ══════════════════════════════════════════════════════════
// 1. VERSION
// ══════════════════════════════════════════════════════════
replace('version bump',
  'const CURRENT_VERSION = "22.30 Pilotage-Réalisé";',
  'const CURRENT_VERSION = "22.40 Pilotage-Transparent";'
);

// ══════════════════════════════════════════════════════════
// 2. JS COMPUTED — Reste à Payer (fixes, variables, chocs)
//    Insérer après prorataSemainesRestantes
// ══════════════════════════════════════════════════════════
replace('JS: add resteAPayer computed',
  `                    // Prorata tréso / semaines restantes
                    const prorataSemainesRestantes = computed(() => {
                        const sem = Number((soldesInitiaux.value || {}).semainesRestantes || 0);
                        if (!sem) return null;
                        return tresoActuelleMois.value / sem;
                    });`,
  `                    // Prorata tréso / semaines restantes
                    const prorataSemainesRestantes = computed(() => {
                        const sem = Number((soldesInitiaux.value || {}).semainesRestantes || 0);
                        if (!sem) return null;
                        return tresoActuelleMois.value / sem;
                    });

                    // v22.40 — Reste à Payer (non cochés du mois courant)
                    const resteAPayerFixes = computed(() => {
                        calculationTick.value;
                        const an = soldesInitiaux.value.anneeActuelle;
                        const dActuelle = donneesAnnuelles.value[an];
                        if (!dActuelle) return 0;
                        let total = 0;
                        Object.values(dActuelle.chargesFixes || {}).forEach(f => {
                            const due = getDueFixe(f, an);
                            if (due > 0 && !isItemPaid(f, due)) total += due;
                        });
                        return total;
                    });
                    const resteAPayerVariables = computed(() => {
                        calculationTick.value;
                        const an = soldesInitiaux.value.anneeActuelle;
                        const dActuelle = donneesAnnuelles.value[an];
                        if (!dActuelle) return 0;
                        let total = 0;
                        Object.values(dActuelle.chargesVariables || {}).filter(c => c?.periode === 'mois').forEach(cat => {
                            if (cat.details && cat.details.length) {
                                cat.details.forEach(f => {
                                    if (!isItemPaid(f, Number(f.montant || 0))) total += Number(f.montant || 0);
                                });
                            } else {
                                // Pas de détail → budget entier considéré non pointé
                                total += Number(cat.valeur || 0);
                            }
                        });
                        return total;
                    });
                    const resteAPayerIrregulier = computed(() => {
                        calculationTick.value;
                        const an = soldesInitiaux.value.anneeActuelle;
                        const mois = soldesInitiaux.value.moisActuel;
                        let total = 0;
                        getDepensesMois(mois, an).forEach(dep => {
                            const m = Number(dep.montant || 0);
                            if (m > 0 && !isItemPaid(dep, m)) total += m;
                        });
                        return total;
                    });
                    const resteAPayerTotal = computed(() => {
                        return resteAPayerFixes.value + resteAPayerVariables.value + resteAPayerIrregulier.value;
                    });
                    // Détail par compte source (Courant vs Épargne/Projet)
                    const resteAPayerParCompte = computed(() => {
                        calculationTick.value;
                        const an = soldesInitiaux.value.anneeActuelle;
                        const dActuelle = donneesAnnuelles.value[an];
                        if (!dActuelle) return { courant: 0, autres: [] };
                        let courant = 0;
                        const autresMap = {};
                        // Charges fixes
                        Object.values(dActuelle.chargesFixes || {}).forEach(f => {
                            const due = getDueFixe(f, an);
                            if (due > 0 && !isItemPaid(f, due)) {
                                const src = f.sourceCompte || 'courant';
                                if (src === 'courant') courant += due;
                                else { autresMap[src] = (autresMap[src] || 0) + due; }
                            }
                        });
                        // Charges variables mois
                        Object.values(dActuelle.chargesVariables || {}).filter(c => c?.periode === 'mois').forEach(cat => {
                            if (cat.details && cat.details.length) {
                                cat.details.forEach(f => {
                                    if (!isItemPaid(f, Number(f.montant || 0))) {
                                        const src = f.sourceCompte || 'courant';
                                        if (src === 'courant') courant += Number(f.montant || 0);
                                        else { autresMap[src] = (autresMap[src] || 0) + Number(f.montant || 0); }
                                    }
                                });
                            } else {
                                courant += Number(cat.valeur || 0);
                            }
                        });
                        // Chocs mois courant
                        const mois = soldesInitiaux.value.moisActuel;
                        getDepensesMois(mois, an).forEach(dep => {
                            const m = Number(dep.montant || 0);
                            if (m > 0 && !isItemPaid(dep, m)) {
                                const src = dep.sourceCompte || 'courant';
                                if (src === 'courant') courant += m;
                                else { autresMap[src] = (autresMap[src] || 0) + m; }
                            }
                        });
                        // Résoudre les labels des autres comptes
                        const cptsList = comptes.value || [];
                        const autres = Object.entries(autresMap).map(([key, montant]) => {
                            let label = key;
                            if (key.startsWith('cpt_')) {
                                const id = parseInt(key.replace('cpt_', ''));
                                const cpt = cptsList.find(c => c.id === id);
                                label = cpt ? cpt.label : key;
                            } else if (key.startsWith('ep_')) {
                                const epId = key.replace('ep_', '');
                                const ep = (donneesAnnuelles.value[an]?.epargne || []).find(e => String(e.id) === epId);
                                label = ep ? (ep.label || ep.nom) : key;
                            }
                            return { label, montant };
                        });
                        return { courant, autres };
                    });`
);

// ══════════════════════════════════════════════════════════
// 3. RETURN — exporter les nouveaux computed
// ══════════════════════════════════════════════════════════
replace('return: add resteAPayer computed',
  'budgetConsoRestant, tresoActuelleMois, tresoEntrees, prorataSemainesRestantes,',
  'budgetConsoRestant, tresoActuelleMois, tresoEntrees, prorataSemainesRestantes, resteAPayerFixes, resteAPayerVariables, resteAPayerIrregulier, resteAPayerTotal, resteAPayerParCompte,'
);

// ══════════════════════════════════════════════════════════
// 4. TEMPLATE — Remplacer toute la zone KPI du header Pilotage
//    (titre + Budget Conso card + grid 2-col Tréso+Semaine)
//    → titre + grid 3-col avec tooltips
// ══════════════════════════════════════════════════════════
replace('template: new KPI header with tooltips',
  `                    <div class="border-b pb-4 mb-6">
                        <div class="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-4">
                            <div>
                                <h2 class="text-2xl font-bold text-gray-800">🎯 Pilotage du Mois Courant</h2>
                                <p class="text-sm text-gray-500 mt-1">Simulation et pointage des factures pour <b>{{ nomDuMois(soldesInitiaux.moisActuel) }} {{ soldesInitiaux.anneeActuelle }}</b>.</p>
                            </div>
                            <div class="bg-gray-900 text-white p-4 rounded-2xl shadow-lg border border-gray-700 text-right shrink-0">
                                <p class="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Budget Conso Restant</p>
                                <p class="text-3xl font-black tracking-tighter text-blue-400">{{ formatMAD(budgetConsoRestant) }}</p>
                            </div>
                        </div>
                        <!-- v22.30 — Métriques trésorerie en temps réel -->
                        <div class="grid grid-cols-2 gap-3">
                            <div :class="['p-4 rounded-2xl border text-center', tresoActuelleMois >= 0 ? 'bg-emerald-900/30 border-emerald-700' : 'bg-red-900/20 border-red-700']">
                                <p class="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">💰 Tréso Actuelle (cochées)</p>
                                <p :class="['text-2xl font-black tracking-tighter', tresoActuelleMois >= 0 ? 'text-emerald-400' : 'text-red-400']">{{ formatMAD(tresoActuelleMois) }}</p>
                                <p class="text-[9px] text-gray-500 mt-1">Entrées − Sorties pointées</p>
                            </div>
                            <div class="bg-slate-900/50 border border-slate-700 p-4 rounded-2xl text-center">
                                <p class="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">📅 Budget / Semaine restante</p>
                                <p class="text-2xl font-black tracking-tighter text-amber-400">
                                    <template v-if="prorataSemainesRestantes !== null">{{ formatMAD(prorataSemainesRestantes) }}</template>
                                    <template v-else><span class="text-sm text-slate-500">— sem. restantes</span></template>
                                </p>
                                <p class="text-[9px] text-gray-500 mt-1">{{ soldesInitiaux.semainesRestantes || 0 }} semaine{{ (soldesInitiaux.semainesRestantes || 0) !== 1 ? 's' : '' }} restante{{ (soldesInitiaux.semainesRestantes || 0) !== 1 ? 's' : '' }}</p>
                            </div>
                        </div>
                    </div>`,
  `                    <!-- v22.40 — Header Pilotage Transparent -->
                    <div class="border-b pb-5 mb-6">
                        <div class="flex items-start justify-between mb-4">
                            <div>
                                <h2 class="text-2xl font-bold text-gray-800">🎯 Pilotage du Mois Courant</h2>
                                <p class="text-sm text-gray-500 mt-0.5">Pointage des factures — <b>{{ nomDuMois(soldesInitiaux.moisActuel) }} {{ soldesInitiaux.anneeActuelle }}</b></p>
                            </div>
                            <span class="text-[9px] font-black uppercase tracking-widest text-gray-400 bg-gray-100 px-2 py-1 rounded-lg border border-gray-200 self-start mt-1">Survol = détail</span>
                        </div>

                        <!-- KPI Grid 3 colonnes -->
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">

                            <!-- KPI 1 : Trésorerie Actuelle -->
                            <div class="relative group cursor-default">
                                <div :class="['p-4 rounded-2xl border text-center transition-all', tresoActuelleMois >= 0 ? 'bg-emerald-900/20 border-emerald-700 group-hover:border-emerald-500' : 'bg-red-900/20 border-red-700 group-hover:border-red-500']">
                                    <p class="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">💰 Tréso Actuelle</p>
                                    <p :class="['text-2xl font-black tracking-tighter', tresoActuelleMois >= 0 ? 'text-emerald-400' : 'text-red-400']">{{ formatMAD(tresoActuelleMois) }}</p>
                                    <p class="text-[9px] text-gray-500 mt-1">Entrées − Sorties pointées</p>
                                </div>
                                <div class="absolute top-full left-0 right-0 mt-1.5 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                    <div class="w-3 h-3 bg-slate-950 border-t border-l border-slate-600 rotate-45 mx-auto -mb-[7px] relative z-10"></div>
                                    <div class="bg-slate-950 border border-slate-600 rounded-xl shadow-2xl p-3.5 text-left text-[11px]">
                                        <p class="font-black uppercase tracking-widest text-slate-300 mb-2 text-[10px]">🔍 Calcul Trésorerie</p>
                                        <div class="space-y-1.5">
                                            <div class="flex justify-between gap-3">
                                                <span class="text-green-400">+ Entrées cochées</span>
                                                <span class="font-black text-white">{{ formatMAD(tresoEntrees) }}</span>
                                            </div>
                                            <div class="flex justify-between gap-3">
                                                <span class="text-red-400">− Sorties cochées</span>
                                                <span class="font-black text-white">{{ formatMAD(tresoEntrees - tresoActuelleMois) }}</span>
                                            </div>
                                            <div :class="['flex justify-between gap-3 border-t border-slate-700 pt-1.5 mt-1.5 font-black', tresoActuelleMois >= 0 ? 'text-emerald-300' : 'text-red-300']">
                                                <span>= Disponible</span>
                                                <span>{{ formatMAD(tresoActuelleMois) }}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- KPI 2 : Reste à Payer -->
                            <div class="relative group cursor-default">
                                <div :class="['p-4 rounded-2xl border text-center transition-all', resteAPayerTotal > 0 ? 'bg-orange-900/20 border-orange-700 group-hover:border-orange-500' : 'bg-green-900/20 border-green-700 group-hover:border-green-500']">
                                    <p class="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">🔴 Reste à Payer</p>
                                    <p :class="['text-2xl font-black tracking-tighter', resteAPayerTotal > 0 ? 'text-orange-400' : 'text-green-400']">{{ formatMAD(resteAPayerTotal) }}</p>
                                    <p class="text-[9px] text-gray-500 mt-1">Fixes + Variables + Chocs non cochés</p>
                                </div>
                                <div class="absolute top-full left-0 right-0 mt-1.5 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                    <div class="w-3 h-3 bg-slate-950 border-t border-l border-slate-600 rotate-45 mx-auto -mb-[7px] relative z-10"></div>
                                    <div class="bg-slate-950 border border-slate-600 rounded-xl shadow-2xl p-3.5 text-left text-[11px]">
                                        <p class="font-black uppercase tracking-widest text-slate-300 mb-2 text-[10px]">🔍 Détail par nature</p>
                                        <div class="space-y-1.5">
                                            <div class="flex justify-between gap-3">
                                                <span class="text-orange-300">🏢 Fixes en attente</span>
                                                <span class="font-black text-white">{{ formatMAD(resteAPayerFixes) }}</span>
                                            </div>
                                            <div class="flex justify-between gap-3">
                                                <span class="text-blue-300">🧾 Variables en attente</span>
                                                <span class="font-black text-white">{{ formatMAD(resteAPayerVariables) }}</span>
                                            </div>
                                            <div class="flex justify-between gap-3">
                                                <span class="text-red-300">⚠️ Chocs en attente</span>
                                                <span class="font-black text-white">{{ formatMAD(resteAPayerIrregulier) }}</span>
                                            </div>
                                            <div class="flex justify-between gap-3 border-t border-slate-700 pt-1.5 mt-1.5 font-black text-orange-300">
                                                <span>= Total</span>
                                                <span>{{ formatMAD(resteAPayerTotal) }}</span>
                                            </div>
                                            <!-- Répartition par compte source -->
                                            <div v-if="resteAPayerParCompte.courant > 0 || resteAPayerParCompte.autres.length" class="border-t border-slate-700 pt-1.5 mt-1.5">
                                                <p class="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1.5">📤 Depuis</p>
                                                <div class="space-y-1">
                                                    <div v-if="resteAPayerParCompte.courant > 0" class="flex justify-between gap-3">
                                                        <span class="text-slate-300">💳 Compte Courant</span>
                                                        <span class="font-black text-slate-200">{{ formatMAD(resteAPayerParCompte.courant) }}</span>
                                                    </div>
                                                    <div v-for="cpt in resteAPayerParCompte.autres" :key="cpt.label" class="flex justify-between gap-3">
                                                        <span class="text-violet-300">🏦 {{ cpt.label }}</span>
                                                        <span class="font-black text-slate-200">{{ formatMAD(cpt.montant) }}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- KPI 3 : Budget Conso Restant -->
                            <div class="relative group cursor-default">
                                <div class="p-4 rounded-2xl border bg-slate-900/40 border-slate-700 text-center transition-all group-hover:border-blue-600">
                                    <p class="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">📊 Budget Conso</p>
                                    <p class="text-2xl font-black tracking-tighter text-blue-400">{{ formatMAD(budgetConsoRestant) }}</p>
                                    <p class="text-[9px] text-gray-500 mt-1">
                                        <template v-if="prorataSemainesRestantes !== null">≈ {{ formatMAD(prorataSemainesRestantes) }} / sem.</template>
                                        <template v-else>Budget hebdo variable</template>
                                    </p>
                                </div>
                                <div class="absolute top-full left-0 right-0 mt-1.5 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                    <div class="w-3 h-3 bg-slate-950 border-t border-l border-slate-600 rotate-45 mx-auto -mb-[7px] relative z-10"></div>
                                    <div class="bg-slate-950 border border-slate-600 rounded-xl shadow-2xl p-3.5 text-left text-[11px]">
                                        <p class="font-black uppercase tracking-widest text-slate-300 mb-2 text-[10px]">🔍 Calcul Budget Conso</p>
                                        <div class="space-y-1.5">
                                            <div class="flex justify-between gap-3">
                                                <span class="text-slate-400">Charges variables/sem.</span>
                                                <span class="font-black text-white">× {{ soldesInitiaux.semainesRestantes || 0 }} sem.</span>
                                            </div>
                                            <div class="flex justify-between gap-3 border-t border-slate-700 pt-1.5 mt-1.5 font-black text-blue-300">
                                                <span>= Budget courses/loisirs</span>
                                                <span>{{ formatMAD(budgetConsoRestant) }}</span>
                                            </div>
                                            <p v-if="prorataSemainesRestantes !== null" class="text-[10px] text-amber-400 font-black border-t border-slate-700 pt-1.5 mt-1.5">
                                                💡 Soit {{ formatMAD(prorataSemainesRestantes) }} par semaine restante (basé sur Tréso actuelle)
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div><!-- /KPI Grid -->
                    </div><!-- /header -->`
);

// ══════════════════════════════════════════════════════════
// WRITE
// ══════════════════════════════════════════════════════════
writeFileSync(FILE, html, 'utf8');

console.log('\n=== RAPPORT ===');
log.forEach(l => console.log(l));
console.log(`\nFinal size: ${html.length} chars | ${html.split('\n').length} lines`);
