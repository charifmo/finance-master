/**
 * fix_pilotage_math_v2241.mjs
 * Correction mathématique critique du Pilotage Transparent
 */

import { readFileSync, writeFileSync } from 'fs';

const FILE = 'C:/Users/HP/finance/index.html';
let html = readFileSync(FILE, 'utf8');
const log = [];
const replace = (desc, from, to) => {
  if (!html.includes(from)) { log.push(`❌ NOT FOUND: ${desc}`); return; }
  html = html.replace(from, to);
  log.push(`✅ OK: ${desc}`);
};

// ══════════════════════════════════════════════════════════
// 1. VERSION
// ══════════════════════════════════════════════════════════
replace('version',
  'const CURRENT_VERSION = "22.40 Pilotage-Transparent";',
  'const CURRENT_VERSION = "22.41 Pilotage-Math";'
);

// ══════════════════════════════════════════════════════════
// 2. JS — Remplacer le bloc resteAPayer
//    - resteAPayerTotal (mauvais : incluait variables) → resteAPayerIncompressible (fixes + chocs)
//    - resteAPayerParCompte : retirer les variables
//    - prorataSemainesRestantes : corriger (utilise maintenant cashDispoPourConso)
//    - Ajouter cashDispoPourConso et budgetSemaineReel
// ══════════════════════════════════════════════════════════
replace('JS: corriger le bloc resteAPayer + ajouter cashDispoParConso + budgetSemaineReel',
  `                    const resteAPayerTotal = computed(() => {
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
                    });`,
  `// v22.41 — Reste à Payer INCOMPRESSIBLE = Fixes + Chocs uniquement (PAS les variables)
                    const resteAPayerIncompressible = computed(() => {
                        return resteAPayerFixes.value + resteAPayerIrregulier.value;
                    });
                    // Détail par compte source (Courant vs Épargne/Projet) — fixes + chocs seulement
                    const resteAPayerParCompte = computed(() => {
                        calculationTick.value;
                        const an = soldesInitiaux.value.anneeActuelle;
                        const dActuelle = donneesAnnuelles.value[an];
                        if (!dActuelle) return { courant: 0, autres: [] };
                        let courant = 0;
                        const autresMap = {};
                        // Charges fixes non payées
                        Object.values(dActuelle.chargesFixes || {}).forEach(f => {
                            const due = getDueFixe(f, an);
                            if (due > 0 && !isItemPaid(f, due)) {
                                const src = f.sourceCompte || 'courant';
                                if (src === 'courant') courant += due;
                                else { autresMap[src] = (autresMap[src] || 0) + due; }
                            }
                        });
                        // Chocs mois courant non payés
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
                    });
                    // v22.41 — Cash disponible pour la consommation (tréso - factures obligatoires)
                    const cashDispoPourConso = computed(() => {
                        return tresoActuelleMois.value - resteAPayerIncompressible.value;
                    });
                    // Budget par semaine réel (cash dispo ÷ semaines restantes)
                    const budgetSemaineReel = computed(() => {
                        const sem = Number((soldesInitiaux.value || {}).semainesRestantes || 0);
                        if (!sem) return null;
                        return cashDispoPourConso.value / sem;
                    });`
);

// ══════════════════════════════════════════════════════════
// 3. JS — prorataSemainesRestantes : corriger (utilise cashDispoParConso)
// ══════════════════════════════════════════════════════════
replace('JS: corriger prorataSemainesRestantes',
  `                    // Prorata tréso / semaines restantes
                    const prorataSemainesRestantes = computed(() => {
                        const sem = Number((soldesInitiaux.value || {}).semainesRestantes || 0);
                        if (!sem) return null;
                        return tresoActuelleMois.value / sem;
                    });`,
  `                    // prorataSemainesRestantes gardé pour compatibilité (alias budgetSemaineReel)
                    const prorataSemainesRestantes = computed(() => budgetSemaineReel?.value ?? null);`
);

// ══════════════════════════════════════════════════════════
// 4. RETURN — remplacer resteAPayerTotal par les nouvelles variables
// ══════════════════════════════════════════════════════════
replace('return: update exports',
  'resteAPayerFixes, resteAPayerVariables, resteAPayerIrregulier, resteAPayerTotal, resteAPayerParCompte,',
  'resteAPayerFixes, resteAPayerVariables, resteAPayerIrregulier, resteAPayerIncompressible, resteAPayerParCompte, cashDispoPourConso, budgetSemaineReel,'
);

// ══════════════════════════════════════════════════════════
// 5. TEMPLATE — Remplacer les 3 cartes KPI (v22.40 → v22.41)
// ══════════════════════════════════════════════════════════
replace('template: corriger les 3 KPI cards',
  `                            <!-- KPI 1 : Trésorerie Actuelle -->
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
                            </div>`,
  `                            <!-- KPI 1 : Trésorerie Actuelle (liquide pointé) -->
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
                                                <span class="text-green-400">+ Entrées pointées</span>
                                                <span class="font-black text-white">{{ formatMAD(tresoEntrees) }}</span>
                                            </div>
                                            <div class="flex justify-between gap-3">
                                                <span class="text-red-400">− Sorties pointées</span>
                                                <span class="font-black text-white">{{ formatMAD(tresoEntrees - tresoActuelleMois) }}</span>
                                            </div>
                                            <div :class="['flex justify-between gap-3 border-t border-slate-700 pt-1.5 mt-1.5 font-black', tresoActuelleMois >= 0 ? 'text-emerald-300' : 'text-red-300']">
                                                <span>= Tréso disponible</span>
                                                <span>{{ formatMAD(tresoActuelleMois) }}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- KPI 2 : Reste à Payer INCOMPRESSIBLE (fixes + chocs, PAS les variables) -->
                            <div class="relative group cursor-default">
                                <div :class="['p-4 rounded-2xl border text-center transition-all', resteAPayerIncompressible > 0 ? 'bg-orange-900/20 border-orange-700 group-hover:border-orange-500' : 'bg-green-900/20 border-green-700 group-hover:border-green-500']">
                                    <p class="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">🔴 Reste à Payer</p>
                                    <p :class="['text-2xl font-black tracking-tighter', resteAPayerIncompressible > 0 ? 'text-orange-400' : 'text-green-400']">{{ formatMAD(resteAPayerIncompressible) }}</p>
                                    <p class="text-[9px] text-gray-500 mt-1">Fixes + Chocs — charges exigibles</p>
                                </div>
                                <div class="absolute top-full left-0 right-0 mt-1.5 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                    <div class="w-3 h-3 bg-slate-950 border-t border-l border-slate-600 rotate-45 mx-auto -mb-[7px] relative z-10"></div>
                                    <div class="bg-slate-950 border border-slate-600 rounded-xl shadow-2xl p-3.5 text-left text-[11px]">
                                        <p class="font-black uppercase tracking-widest text-slate-300 mb-2 text-[10px]">🔍 Détail charges exigibles</p>
                                        <div class="space-y-1.5">
                                            <div class="flex justify-between gap-3">
                                                <span class="text-orange-300">🏢 Fixes en attente</span>
                                                <span class="font-black text-white">{{ formatMAD(resteAPayerFixes) }}</span>
                                            </div>
                                            <div class="flex justify-between gap-3">
                                                <span class="text-red-300">⚠️ Chocs en attente</span>
                                                <span class="font-black text-white">{{ formatMAD(resteAPayerIrregulier) }}</span>
                                            </div>
                                            <div class="flex justify-between gap-3 border-t border-slate-700 pt-1.5 mt-1.5 font-black text-orange-300">
                                                <span>= Total exigible</span>
                                                <span>{{ formatMAD(resteAPayerIncompressible) }}</span>
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

                            <!-- KPI 3 : Budget Conso = cashDispoPourConso (VRAI reste à vivre) -->
                            <div class="relative group cursor-default">
                                <div :class="['p-4 rounded-2xl border text-center transition-all', cashDispoPourConso >= 0 ? 'bg-blue-900/20 border-blue-700 group-hover:border-blue-500' : 'bg-red-900/20 border-red-700 group-hover:border-red-500']">
                                    <p class="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">📊 Budget Conso Restant</p>
                                    <p :class="['text-2xl font-black tracking-tighter', cashDispoPourConso >= 0 ? 'text-blue-400' : 'text-red-400']">{{ formatMAD(cashDispoPourConso) }}</p>
                                    <p class="text-[9px] text-gray-500 mt-1">
                                        <template v-if="budgetSemaineReel !== null">Soit {{ formatMAD(budgetSemaineReel) }} / semaine</template>
                                        <template v-else>Définir les semaines restantes</template>
                                    </p>
                                </div>
                                <div class="absolute top-full left-0 right-0 mt-1.5 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                    <div class="w-3 h-3 bg-slate-950 border-t border-l border-slate-600 rotate-45 mx-auto -mb-[7px] relative z-10"></div>
                                    <div class="bg-slate-950 border border-slate-600 rounded-xl shadow-2xl p-3.5 text-left text-[11px]">
                                        <p class="font-black uppercase tracking-widest text-slate-300 mb-2 text-[10px]">🔍 Calcul Budget Conso</p>
                                        <div class="space-y-1.5">
                                            <div class="flex justify-between gap-3">
                                                <span class="text-emerald-400">💰 Tréso actuelle</span>
                                                <span class="font-black text-white">{{ formatMAD(tresoActuelleMois) }}</span>
                                            </div>
                                            <div class="flex justify-between gap-3">
                                                <span class="text-orange-400">➖ Reste à payer exigible</span>
                                                <span class="font-black text-white">− {{ formatMAD(resteAPayerIncompressible) }}</span>
                                            </div>
                                            <div :class="['flex justify-between gap-3 border-t border-slate-700 pt-1.5 mt-1.5 font-black', cashDispoPourConso >= 0 ? 'text-blue-300' : 'text-red-300']">
                                                <span>= Disponible conso</span>
                                                <span>{{ formatMAD(cashDispoPourConso) }}</span>
                                            </div>
                                            <div v-if="budgetSemaineReel !== null" class="flex justify-between gap-3 border-t border-slate-700 pt-1.5 mt-1.5">
                                                <span class="text-amber-400">📅 Budget / semaine</span>
                                                <span class="font-black text-amber-300">{{ formatMAD(budgetSemaineReel) }}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>`
);

// ══════════════════════════════════════════════════════════
// WRITE
// ══════════════════════════════════════════════════════════
writeFileSync(FILE, html, 'utf8');
console.log('\n=== RAPPORT ===');
log.forEach(l => console.log(l));
console.log(`\nFinal: ${html.length} chars | ${html.split('\n').length} lines`);
