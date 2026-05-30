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

// ═══════════════════════════════════════════════════════════════════════════
// Op 1 : Nouvelle computed besoinVariableHebdoTheorique + chargesVarHebdo
//         Insérée juste après budgetSemaineReel
// ═══════════════════════════════════════════════════════════════════════════
const ANCHOR_AFTER = `                    // ── v22.95 Cashflow-Timing ───────────────────────────────────────────────`;

const NEW_COMPUTEDS = `// ── v22.97 Conso-Target ─────────────────────────────────────────────────
                    // Liste des catégories variables HEBDOMADAIRES pour le tooltip
                    const chargesVarHebdoDetail = computed(() => {
                        calculationTick.value;
                        const mb = moisBudgetaire.value;
                        const d = donneesAnnuelles.value[mb.an];
                        if (!d) return [];
                        return Object.values(d.chargesVariables || {})
                            .filter(c => c.periode === 'semaine' && Number(c.valeur || 0) > 0)
                            .map(c => ({ label: c.label || '?', valeur: Number(c.valeur || 0) }));
                    });

                    const besoinVariableHebdoTheorique = computed(() =>
                        chargesVarHebdoDetail.value.reduce((s, c) => s + c.valeur, 0)
                    );

                    `;

check('Op 1 anchor', html.includes(ANCHOR_AFTER));
html = html.replace(ANCHOR_AFTER, NEW_COMPUTEDS + ANCHOR_AFTER);

// ═══════════════════════════════════════════════════════════════════════════
// Op 2 : Exposer dans le return
// ═══════════════════════════════════════════════════════════════════════════
const OLD_RET = `// v22.95 Cashflow-Timing
                        isFluxCetteSemaine, revenusBudgetairesTries, chargesFixesBudgetairesTriees,`;
const NEW_RET = `// v22.95 Cashflow-Timing
                        isFluxCetteSemaine, revenusBudgetairesTries, chargesFixesBudgetairesTriees,
                        // v22.97 Conso-Target
                        besoinVariableHebdoTheorique, chargesVarHebdoDetail,`;

check('Op 2 anchor', html.includes(OLD_RET));
html = html.replace(OLD_RET, NEW_RET);

// ═══════════════════════════════════════════════════════════════════════════
// Op 3 : Remplacer le tooltip de la 3ème carte KPI (Budget Conso Restant)
// ═══════════════════════════════════════════════════════════════════════════
const OLD_TOOLTIP = `<div class="bg-slate-950 border border-slate-600 rounded-xl shadow-2xl p-3.5 text-left text-[11px]">\n                                        <p class="font-black uppercase tracking-widest text-slate-300 mb-2 text-[10px]">🔍 Calcul Budget Conso</p>\n                                        <div class="space-y-1.5">\n                                            <div class="flex justify-between gap-3">\n                                                <span class="text-emerald-400">💰 Tréso courant</span>\n                                                <span class="font-black text-white">{{ formatMAD(tresoActuelleCourante) }}</span>\n                                            </div>\n                                            <div class="flex justify-between gap-3">\n                                                <span class="text-orange-400">➖ Obligations courant</span>\n                                                <span class="font-black text-white">− {{ formatMAD(resteAPayerCourant) }}</span>\n                                            </div>\n                                            <div :class="['flex justify-between gap-3 border-t border-slate-700 pt-1.5 mt-1.5 font-black', cashDispoPourConso >= 0 ? 'text-blue-300' : 'text-red-300']">\n                                                <span>= Disponible conso</span>\n                                                <span>{{ formatMAD(cashDispoPourConso) }}</span>\n                                            </div>\n                                            <div v-if="budgetSemaineReel !== null" class="flex justify-between gap-3 border-t border-slate-700 pt-1.5 mt-1.5">\n                                                <span class="text-amber-400">📅 Budget / sem (J−{{ joursRestantsAvantPaie }})</span>\n                                                <span class="font-black text-amber-300">{{ formatMAD(budgetSemaineReel) }}</span>\n                                            </div>\n                                        </div>\n                                    </div>`;

const NEW_TOOLTIP = `<div class="bg-slate-950 border border-slate-600 rounded-xl shadow-2xl p-3.5 text-left text-[11px] min-w-[230px]">\n                                        <!-- ── Bloc Réalité ── -->\n                                        <p class="font-black uppercase tracking-widest text-blue-300 mb-2 text-[10px] border-b border-slate-700 pb-1.5">📊 DISPONIBLE RÉEL</p>\n                                        <div class="space-y-1.5 mb-3">\n                                            <div class="flex justify-between gap-3">\n                                                <span class="text-emerald-400">💰 Tréso courante</span>\n                                                <span class="font-black text-white">{{ formatMAD(tresoActuelleCourante) }}</span>\n                                            </div>\n                                            <div class="flex justify-between gap-3">\n                                                <span class="text-orange-400">➖ Obligations</span>\n                                                <span class="font-black text-white">− {{ formatMAD(resteAPayerCourant) }}</span>\n                                            </div>\n                                            <div :class="['flex justify-between gap-3 border-t border-slate-700 pt-1.5 mt-1.5 font-black', cashDispoPourConso >= 0 ? 'text-blue-300' : 'text-red-300']">\n                                                <span>= Total Conso Restant</span>\n                                                <span>{{ formatMAD(cashDispoPourConso) }}</span>\n                                            </div>\n                                            <div v-if="budgetSemaineReel !== null" class="flex justify-between gap-3 border-t border-slate-700 pt-1.5 mt-1.5">\n                                                <span class="text-amber-400">🗓️ Budget / sem autorisé</span>\n                                                <span class="font-black text-amber-300">{{ formatMAD(budgetSemaineReel) }}</span>\n                                            </div>\n                                        </div>\n                                        <!-- ── Bloc Cible Théorique ── -->\n                                        <div v-if="chargesVarHebdoDetail.length > 0" class="border-t border-slate-700 pt-2">\n                                            <div class="flex justify-between gap-3 mb-1.5">\n                                                <p class="font-black uppercase tracking-widest text-purple-300 text-[10px]">🎯 BESOIN HEBDO THÉORIQUE</p>\n                                                <span class="font-black text-purple-300">{{ formatMAD(besoinVariableHebdoTheorique) }}</span>\n                                            </div>\n                                            <div v-for="c in chargesVarHebdoDetail" :key="c.label" class="flex justify-between gap-3 pl-3 text-[10px]">\n                                                <span class="text-slate-400">↳ {{ c.label }}</span>\n                                                <span class="font-bold text-slate-200">{{ formatMAD(c.valeur) }}</span>\n                                            </div>\n                                            <div v-if="budgetSemaineReel !== null" class="mt-2 pt-1.5 border-t border-slate-800">\n                                                <div :class="['flex justify-between gap-3 text-[10px] font-black', (budgetSemaineReel - besoinVariableHebdoTheorique) >= 0 ? 'text-emerald-400' : 'text-red-400']">\n                                                    <span>{{ (budgetSemaineReel - besoinVariableHebdoTheorique) >= 0 ? '✅ Marge hebdo' : '⚠️ Dépassement' }}</span>\n                                                    <span>{{ formatMAD(Math.abs(budgetSemaineReel - besoinVariableHebdoTheorique)) }}</span>\n                                                </div>\n                                            </div>\n                                        </div>\n                                    </div>`;

check('Op 3 anchor', html.includes(OLD_TOOLTIP));
html = html.replace(OLD_TOOLTIP, NEW_TOOLTIP);

// ═══════════════════════════════════════════════════════════════════════════
// Op 4 : Version bump → 22.97 Conso-Target
// ═══════════════════════════════════════════════════════════════════════════
const OLD_VER = `"22.96 Cashflow-Global"`;
const NEW_VER = `"22.97 Conso-Target"`;
check('Op 4 anchor', html.includes(OLD_VER));
html = html.replace(OLD_VER, NEW_VER);

writeFileSync(filePath, html, 'utf8');
console.log(`\n🎉 Done — ${ops}/4 ops. Fichier écrit.`);
