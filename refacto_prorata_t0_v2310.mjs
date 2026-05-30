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
// ██ Op 1 : vueTemporelle ref — mise à jour commentaire + valeur initiale
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_VUE_REF = `const vueTemporelle = ref('cycle'); // 'cycle' | 'semaine'`;
const NEW_VUE_REF = `const vueTemporelle = ref('cycle'); // 'cycle' | 'semaine' | 'at0'`;
check('Op1 vueTemporelle ref', html.includes(OLD_VUE_REF));
html = html.replace(OLD_VUE_REF, NEW_VUE_REF);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 2 : ok() filter — ajouter cas 'at0' (jourPrevu <= today)
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_OK = `// v23.00 : filtre temporel (semaine vs cycle complet)
                        const ok = (item) => vueTemporelle.value !== 'semaine' || isFluxCetteSemaine(item.jourPrevu);`;
const NEW_OK = `// v23.10 : filtre temporel (at0 | semaine | cycle)
                        const _todayDayOk = new Date().getDate();
                        const ok = (item) => {
                            if (vueTemporelle.value === 'at0')
                                return !item.jourPrevu || item.jourPrevu <= _todayDayOk;
                            if (vueTemporelle.value === 'semaine')
                                return isFluxCetteSemaine(item.jourPrevu);
                            return true;
                        };`;
check('Op2 ok() filter', html.includes(OLD_OK));
html = html.replace(OLD_OK, NEW_OK);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 3 : revenusEnAttenteCourant — ajouter filtre 'at0'
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_REV_FILTER = `            // Filtre temporel si vueTemporelle === 'semaine'\n                            if (vueTemporelle.value === 'semaine' && !isFluxCetteSemaine(r.jourPrevu)) return s;`;
const NEW_REV_FILTER = `            // Filtre temporel selon vue
                            if (vueTemporelle.value === 'semaine' && !isFluxCetteSemaine(r.jourPrevu)) return s;
                            if (vueTemporelle.value === 'at0' && r.jourPrevu && r.jourPrevu > new Date().getDate()) return s;`;
check('Op3 revenus filter', html.includes(OLD_REV_FILTER));
html = html.replace(OLD_REV_FILTER, NEW_REV_FILTER);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 4 : Nouveaux computeds T0 — insérés entre revenusEnAttente et cashDispoP
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_CASH_START = `                    const cashDispoPourConso = computed(() => {`;
const NEW_CASH_START = `                    // ── v23.10 : Computeds Prorata-T0 ──────────────────────────────────────
                    const prorataVariableT0 = computed(() =>
                        budgetConsoTheoriqueMois.value * progressCyclePaie.value
                    );

                    const provisionsFuturesT0 = computed(() => {
                        calculationTick.value;
                        const mb = moisBudgetaire.value;
                        const d = donneesAnnuelles.value[mb.an];
                        if (!d) return 0;
                        const today = new Date().getDate();
                        let total = 0;
                        Object.values(d.chargesFixes || {}).forEach(f => {
                            const due = getDueFixe(f, mb.an);
                            if (due > 0 && !isItemPaid(f, due) && f.jourPrevu && f.jourPrevu > today) total += due;
                        });
                        Object.values(d.chargesVariables || {}).forEach(cat => {
                            if (cat.periode !== 'mois') return;
                            const m = cat.details?.length
                                ? cat.details.reduce((s, dt) => s + Number(dt.montant || 0), 0)
                                : Number(cat.valeur || 0);
                            if (m > 0 && !isItemPaid(cat, m) && cat.jourPrevu && cat.jourPrevu > today) total += m;
                        });
                        (d.epargne || []).forEach(ep => {
                            const m = Number(ep.valeur || 0);
                            if (m > 0 && !isItemPaid(ep, m) && ep.jourPrevu && ep.jourPrevu > today) total += m;
                        });
                        return total;
                    });

                    const margeT0 = computed(() =>
                        cashDispoPourConso.value - prorataVariableT0.value - provisionsFuturesT0.value
                    );

                    const cashDispoPourConso = computed(() => {`;
check('Op4 new T0 computeds', html.includes(OLD_CASH_START));
html = html.replace(OLD_CASH_START, NEW_CASH_START);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 5 : Exposer dans le return
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_RET = `// v23.00 ERP-Edition
                        revenusEnAttenteCourant, vueTemporelle, soldeBancaireReel, ecartRapprochement, regulariserEcart,`;
const NEW_RET = `// v23.00 ERP-Edition
                        revenusEnAttenteCourant, vueTemporelle, soldeBancaireReel, ecartRapprochement, regulariserEcart,
                        // v23.10 Prorata-T0
                        prorataVariableT0, provisionsFuturesT0, margeT0,`;
check('Op5 return expose', html.includes(OLD_RET));
html = html.replace(OLD_RET, NEW_RET);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 6 : Toggle UI — 3 boutons (at0 + semaine + cycle) + nouvelles couleurs
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_TOGGLE = `<!-- v23.00 Toggle Vue Temporelle -->
                                <div class="flex items-center bg-slate-800 rounded-xl p-0.5 border border-slate-700">
                                    <button @click="vueTemporelle = 'semaine'" :class="['px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all', vueTemporelle === 'semaine' ? 'bg-amber-500 text-white shadow' : 'text-slate-400 hover:text-white']">📅 Cette semaine</button>
                                    <button @click="vueTemporelle = 'cycle'" :class="['px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all', vueTemporelle === 'cycle' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white']">🗓️ Fin de cycle</button>
                                </div>`;
const NEW_TOGGLE = `<!-- v23.10 Toggle Vue Temporelle (3 états) -->
                                <div class="flex items-center bg-slate-900 rounded-xl p-0.5 border border-slate-600 gap-0.5">
                                    <button @click="vueTemporelle = 'at0'" :class="['px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap', vueTemporelle === 'at0' ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/50' : 'text-slate-400 hover:text-violet-300']">⏱️ À T0</button>
                                    <button @click="vueTemporelle = 'semaine'" :class="['px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap', vueTemporelle === 'semaine' ? 'bg-amber-500 text-white shadow-lg shadow-amber-900/50' : 'text-slate-400 hover:text-amber-300']">📅 Cette sem.</button>
                                    <button @click="vueTemporelle = 'cycle'" :class="['px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap', vueTemporelle === 'cycle' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/50' : 'text-slate-400 hover:text-emerald-300']">🗓️ Fin cycle</button>
                                </div>`;
check('Op6 toggle UI', html.includes(OLD_TOGGLE));
html = html.replace(OLD_TOGGLE, NEW_TOGGLE);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 7 : KPI3 — remplacement complet (meilleures couleurs + T0 aware)
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_KPI3 = `<div class="relative group cursor-default">
                                <div :class="['p-4 rounded-2xl border text-center transition-all', cashDispoPourConso >= 0 ? 'bg-blue-900/20 border-blue-700 group-hover:border-blue-500' : 'bg-red-900/20 border-red-700 group-hover:border-red-500']">
                                    <p class="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">📊 Budget Conso Restant</p>
                                    <p :class="['text-2xl font-black tracking-tighter', cashDispoPourConso >= 0 ? 'text-blue-400' : 'text-red-400']">{{ formatMAD(cashDispoPourConso) }}</p>
                                    <p class="text-[9px] text-gray-500 mt-1">
                                        <template v-if="budgetSemaineReel !== null">Soit {{ formatMAD(budgetSemaineReel) }} / sem · J−{{ joursRestantsAvantPaie }}</template>
                                        <template v-else>Configurer le jour de paie</template>
                                    </p>
                                </div>
                                <div class="absolute top-full left-0 right-0 mt-1.5 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                    <div class="w-3 h-3 bg-slate-950 border-t border-l border-slate-600 rotate-45 mx-auto -mb-[7px] relative z-10"></div>
                                    <div class="bg-slate-950 border border-slate-600 rounded-xl shadow-2xl p-3.5 text-left text-[11px] min-w-[230px]">
                                        <!-- ── Bloc Réalité ── -->
                                        <p class="font-black uppercase tracking-widest text-blue-300 mb-2 text-[10px] border-b border-slate-700 pb-1.5">📊 DISPONIBLE RÉEL</p>
                                        <div class="space-y-1.5 mb-3">
                                            <div class="flex justify-between gap-3">
                                                <span class="text-emerald-400">💰 Tréso instantanée</span>
                                                <span class="font-black text-white">{{ formatMAD(tresoActuelleCourante) }}</span>
                                            </div>
                                            <div v-if="revenusEnAttenteCourant > 0" class="flex justify-between gap-3">
                                                <span class="text-sky-400">📥 + Revenus en attente</span>
                                                <span class="font-black text-sky-200">+ {{ formatMAD(revenusEnAttenteCourant) }}</span>
                                            </div>
                                            <div class="flex justify-between gap-3">
                                                <span class="text-orange-400">➖ Obligations du cycle</span>
                                                <span class="font-black text-white">− {{ formatMAD(resteAPayerCourant) }}</span>
                                            </div>
                                            <div :class="['flex justify-between gap-3 border-t border-slate-700 pt-1.5 mt-1.5 font-black', cashDispoPourConso >= 0 ? 'text-blue-300' : 'text-red-300']">
                                                <span>= Total Conso Restant</span>
                                                <span>{{ formatMAD(cashDispoPourConso) }}</span>
                                            </div>
                                            <div v-if="budgetSemaineReel !== null" class="flex justify-between gap-3 border-t border-slate-700 pt-1.5 mt-1.5">
                                                <span class="text-amber-400">🗓️ Budget / sem autorisé</span>
                                                <span class="font-black text-amber-300">{{ formatMAD(budgetSemaineReel) }}</span>
                                            </div>
                                        </div>
                                        <!-- ── Bloc Cible Théorique ── -->
                                        <div v-if="chargesVarHebdoDetail.length > 0" class="border-t border-slate-700 pt-2">
                                            <div class="flex justify-between gap-3 mb-1.5">
                                                <p class="font-black uppercase tracking-widest text-purple-300 text-[10px]">🎯 BESOIN HEBDO THÉORIQUE</p>
                                                <span class="font-black text-purple-300">{{ formatMAD(besoinVariableHebdoTheorique) }}</span>
                                            </div>
                                            <div v-for="c in chargesVarHebdoDetail" :key="c.label" class="flex justify-between gap-3 pl-3 text-[10px]">
                                                <span class="text-slate-400">↳ {{ c.label }}</span>
                                                <span class="font-bold text-slate-200">{{ formatMAD(c.valeur) }}</span>
                                            </div>
                                            <div v-if="budgetSemaineReel !== null" class="mt-2 pt-1.5 border-t border-slate-800">
                                                <div :class="['flex justify-between gap-3 text-[10px] font-black', (budgetSemaineReel - besoinVariableHebdoTheorique) >= 0 ? 'text-emerald-400' : 'text-red-400']">
                                                    <span>{{ (budgetSemaineReel - besoinVariableHebdoTheorique) >= 0 ? '✅ Marge hebdo' : '⚠️ Dépassement' }}</span>
                                                    <span>{{ formatMAD(Math.abs(budgetSemaineReel - besoinVariableHebdoTheorique)) }}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>`;

const NEW_KPI3 = `<div class="relative group cursor-default">
                                <!-- ── Carte KPI3 : contenu selon mode ── -->
                                <div :class="['p-4 rounded-2xl border text-center transition-all',
                                    vueTemporelle === 'at0'
                                        ? (margeT0 >= 0 ? 'bg-violet-900/30 border-violet-600 group-hover:border-violet-400' : 'bg-red-900/30 border-red-600 group-hover:border-red-400')
                                        : (cashDispoPourConso >= 0 ? 'bg-emerald-900/30 border-emerald-600 group-hover:border-emerald-400' : 'bg-red-900/30 border-red-600 group-hover:border-red-400')]">
                                    <!-- Titre dynamique -->
                                    <p class="text-[9px] font-black uppercase tracking-widest text-gray-300 mb-1">
                                        <template v-if="vueTemporelle === 'at0'">⏱️ Prorata Variables T0</template>
                                        <template v-else>📊 Budget Conso Restant</template>
                                    </p>
                                    <!-- Valeur principale -->
                                    <p :class="['text-2xl font-black tracking-tighter',
                                        vueTemporelle === 'at0'
                                            ? (margeT0 >= 0 ? 'text-violet-300' : 'text-red-400')
                                            : (cashDispoPourConso >= 0 ? 'text-emerald-300' : 'text-red-400')]">
                                        <template v-if="vueTemporelle === 'at0'">{{ formatMAD(prorataVariableT0) }}</template>
                                        <template v-else>{{ formatMAD(cashDispoPourConso) }}</template>
                                    </p>
                                    <!-- Sous-label -->
                                    <p class="text-[9px] text-gray-400 mt-1 font-bold">
                                        <template v-if="vueTemporelle === 'at0'">
                                            <span :class="margeT0 >= 0 ? 'text-emerald-400' : 'text-red-400'">
                                                {{ margeT0 >= 0 ? '✅ +' : '⚠️ ' }}{{ formatMAD(Math.abs(margeT0)) }} {{ margeT0 >= 0 ? 'avance' : 'retard' }}
                                            </span>
                                        </template>
                                        <template v-else>
                                            <template v-if="budgetSemaineReel !== null">Soit {{ formatMAD(budgetSemaineReel) }} / sem · J−{{ joursRestantsAvantPaie }}</template>
                                            <template v-else>Survol = détail</template>
                                        </template>
                                    </p>
                                </div>
                                <!-- ── Tooltip ── -->
                                <div class="absolute top-full left-0 right-0 mt-1.5 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                    <!-- Tooltip T0 -->
                                    <template v-if="vueTemporelle === 'at0'">
                                        <div class="w-3 h-3 bg-violet-950 border-t border-l border-violet-500 rotate-45 mx-auto -mb-[7px] relative z-10"></div>
                                        <div class="bg-violet-950 border border-violet-500 rounded-xl shadow-2xl p-3.5 text-left text-[11px] min-w-[240px]">
                                            <p class="font-black uppercase tracking-widest text-violet-200 mb-2 text-[10px] border-b border-violet-800 pb-1.5">⏱️ DIAGNOSTIC T0 — INSTANT PRÉSENT</p>
                                            <!-- Cash dispo réel -->
                                            <div class="space-y-1.5 mb-2">
                                                <p class="text-[9px] font-black text-violet-300 uppercase tracking-widest">💰 Cash Dispo Actuel</p>
                                                <div class="flex justify-between gap-3 pl-2">
                                                    <span class="text-emerald-300">Tréso courante</span>
                                                    <span class="font-black text-white">{{ formatMAD(tresoActuelleCourante) }}</span>
                                                </div>
                                                <div v-if="revenusEnAttenteCourant > 0" class="flex justify-between gap-3 pl-2">
                                                    <span class="text-sky-300">+ Revenus échus</span>
                                                    <span class="font-black text-sky-200">+ {{ formatMAD(revenusEnAttenteCourant) }}</span>
                                                </div>
                                                <div class="flex justify-between gap-3 pl-2">
                                                    <span class="text-orange-300">− Obligations échues</span>
                                                    <span class="font-black text-orange-200">− {{ formatMAD(resteAPayerCourant) }}</span>
                                                </div>
                                                <div :class="['flex justify-between gap-3 border-t border-violet-800 pt-1 mt-1 font-black', cashDispoPourConso >= 0 ? 'text-emerald-300' : 'text-red-400']">
                                                    <span>= Dispo net</span>
                                                    <span>{{ formatMAD(cashDispoPourConso) }}</span>
                                                </div>
                                            </div>
                                            <!-- VS théorique -->
                                            <div class="space-y-1.5 mb-2 border-t border-violet-800 pt-2">
                                                <p class="text-[9px] font-black text-violet-300 uppercase tracking-widest">📐 Besoin Théorique T0</p>
                                                <div class="flex justify-between gap-3 pl-2">
                                                    <span class="text-purple-300">Prorata variables ({{ Math.round(progressCyclePaie * 100) }}% cycle)</span>
                                                    <span class="font-black text-white">{{ formatMAD(prorataVariableT0) }}</span>
                                                </div>
                                                <div v-if="provisionsFuturesT0 > 0" class="flex justify-between gap-3 pl-2">
                                                    <span class="text-amber-300">+ Provisions futures</span>
                                                    <span class="font-black text-amber-200">+ {{ formatMAD(provisionsFuturesT0) }}</span>
                                                </div>
                                                <div class="flex justify-between gap-3 border-t border-violet-800 pt-1 mt-1 font-black text-violet-200">
                                                    <span>= Total à couvrir</span>
                                                    <span>{{ formatMAD(prorataVariableT0 + provisionsFuturesT0) }}</span>
                                                </div>
                                            </div>
                                            <!-- Résultat -->
                                            <div :class="['flex justify-between gap-3 rounded-lg px-3 py-2 font-black text-[12px]', margeT0 >= 0 ? 'bg-emerald-900/50 text-emerald-300' : 'bg-red-900/50 text-red-300']">
                                                <span>{{ margeT0 >= 0 ? '✅ Marge d\'avance' : '⚠️ Retard de tréso' }}</span>
                                                <span>{{ margeT0 >= 0 ? '+' : '' }}{{ formatMAD(margeT0) }}</span>
                                            </div>
                                        </div>
                                    </template>
                                    <!-- Tooltip Semaine/Cycle (inchangé) -->
                                    <template v-else>
                                        <div class="w-3 h-3 bg-slate-950 border-t border-l border-slate-600 rotate-45 mx-auto -mb-[7px] relative z-10"></div>
                                        <div class="bg-slate-950 border border-slate-600 rounded-xl shadow-2xl p-3.5 text-left text-[11px] min-w-[230px]">
                                            <p class="font-black uppercase tracking-widest text-emerald-300 mb-2 text-[10px] border-b border-slate-700 pb-1.5">📊 DISPONIBLE RÉEL</p>
                                            <div class="space-y-1.5 mb-3">
                                                <div class="flex justify-between gap-3">
                                                    <span class="text-emerald-400">💰 Tréso instantanée</span>
                                                    <span class="font-black text-white">{{ formatMAD(tresoActuelleCourante) }}</span>
                                                </div>
                                                <div v-if="revenusEnAttenteCourant > 0" class="flex justify-between gap-3">
                                                    <span class="text-sky-400">📥 + Revenus en attente</span>
                                                    <span class="font-black text-sky-200">+ {{ formatMAD(revenusEnAttenteCourant) }}</span>
                                                </div>
                                                <div class="flex justify-between gap-3">
                                                    <span class="text-orange-400">➖ Obligations</span>
                                                    <span class="font-black text-white">− {{ formatMAD(resteAPayerCourant) }}</span>
                                                </div>
                                                <div :class="['flex justify-between gap-3 border-t border-slate-700 pt-1.5 mt-1.5 font-black', cashDispoPourConso >= 0 ? 'text-emerald-300' : 'text-red-300']">
                                                    <span>= Total Conso Restant</span>
                                                    <span>{{ formatMAD(cashDispoPourConso) }}</span>
                                                </div>
                                                <div v-if="budgetSemaineReel !== null" class="flex justify-between gap-3 border-t border-slate-700 pt-1.5 mt-1.5">
                                                    <span class="text-amber-400">🗓️ Budget / sem autorisé</span>
                                                    <span class="font-black text-amber-300">{{ formatMAD(budgetSemaineReel) }}</span>
                                                </div>
                                            </div>
                                            <div v-if="chargesVarHebdoDetail.length > 0" class="border-t border-slate-700 pt-2">
                                                <div class="flex justify-between gap-3 mb-1.5">
                                                    <p class="font-black uppercase tracking-widest text-purple-300 text-[10px]">🎯 BESOIN HEBDO THÉORIQUE</p>
                                                    <span class="font-black text-purple-300">{{ formatMAD(besoinVariableHebdoTheorique) }}</span>
                                                </div>
                                                <div v-for="c in chargesVarHebdoDetail" :key="c.label" class="flex justify-between gap-3 pl-3 text-[10px]">
                                                    <span class="text-slate-400">↳ {{ c.label }}</span>
                                                    <span class="font-bold text-slate-200">{{ formatMAD(c.valeur) }}</span>
                                                </div>
                                                <div v-if="budgetSemaineReel !== null" class="mt-2 pt-1.5 border-t border-slate-800">
                                                    <div :class="['flex justify-between gap-3 text-[10px] font-black', (budgetSemaineReel - besoinVariableHebdoTheorique) >= 0 ? 'text-emerald-400' : 'text-red-400']">
                                                        <span>{{ (budgetSemaineReel - besoinVariableHebdoTheorique) >= 0 ? '✅ Marge hebdo' : '⚠️ Dépassement' }}</span>
                                                        <span>{{ formatMAD(Math.abs(budgetSemaineReel - besoinVariableHebdoTheorique)) }}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </template>
                                </div>
                            </div>`;

check('Op7 KPI3 card', html.includes(OLD_KPI3));
html = html.replace(OLD_KPI3, NEW_KPI3);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 8 : Comptes editor — Budget Structurel → lecture seule
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_COMPTE_INPUT = `                          <div class="text-right shrink-0">
                                        <input type="number" v-model.number="compte.solde" @change="handleDataChange"
                                            :class="['w-32 text-base font-black text-right tabular-nums bg-transparent border-b-2 outline-none transition-colors', compte.solde >= 0 ? 'text-gray-800 border-transparent hover:border-gray-300 focus:border-blue-500' : 'text-red-600 border-red-200 hover:border-red-400 focus:border-red-500']"
                                            step="100" />`;
const NEW_COMPTE_INPUT = `                          <div class="text-right shrink-0">
                                        <p :class="['text-base font-black tabular-nums', compte.solde >= 0 ? 'text-gray-700' : 'text-red-600']">{{ formatMAD(compte.solde) }}</p>
                                        <p class="text-[9px] text-slate-400 mt-0.5">✏️ Éditable dans Trésorerie</p>`;
check('Op8 comptes read-only in parametres', html.includes(OLD_COMPTE_INPUT));
html = html.replace(OLD_COMPTE_INPUT, NEW_COMPTE_INPUT);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 9 : Trésorerie — remplacer affichage read-only par input éditable
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_TRSO_DISPLAY = `                                <p :class="['text-lg font-black tabular-nums', c.solde >= 0 ? 'text-gray-800' : 'text-red-600']">{{ formatMAD(c.solde) }}</p>`;
const NEW_TRSO_DISPLAY = `                                <div class="text-right">
                                    <input type="number" v-model.number="c.solde" @change="handleDataChange"
                                        :class="['w-36 text-lg font-black text-right tabular-nums bg-transparent border-b-2 outline-none transition-colors', c.solde >= 0 ? 'text-gray-800 border-gray-300 hover:border-gray-500 focus:border-emerald-500' : 'text-red-600 border-red-300 hover:border-red-500 focus:border-red-600']"
                                        step="100" />
                                    <p class="text-[9px] text-emerald-600 font-bold mt-0.5">✏️ Éditable</p>
                                </div>`;
check('Op9 Trésorerie editable input', html.includes(OLD_TRSO_DISPLAY));
html = html.replace(OLD_TRSO_DISPLAY, NEW_TRSO_DISPLAY);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 10 : Version bump → 23.10 Prorata-T0
// ═══════════════════════════════════════════════════════════════════════════════
check('Op10 version anchor', html.includes('"23.00 ERP-Edition"'));
html = html.replace('"23.00 ERP-Edition"', '"23.10 Prorata-T0"');

writeFileSync(filePath, html, 'utf8');
console.log(`\n🎉 Done — ${ops}/10 ops. Fichier écrit.`);
