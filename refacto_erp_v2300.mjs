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
// ██ CHANTIER 1 : Revenus en attente + cashDispoPourConso corrigé
// ═══════════════════════════════════════════════════════════════════════════════

// Op 1 : Insérer revenusEnAttenteCourant avant cashDispoPourConso
const OLD_CASH_COMPUTED = `const cashDispoPourConso = computed(() => {
                        return tresoActuelleCourante.value - resteAPayerCourant.value;
                    });`;

const NEW_CASH_COMPUTED = `// ── v23.00 : Revenus non encore reçus → compte courant ──────────────────
                    const revenusEnAttenteCourant = computed(() => {
                        calculationTick.value;
                        const mb = moisBudgetaire.value;
                        const d = donneesAnnuelles.value[mb.an];
                        if (!d) return 0;
                        return Object.values(d.revenus || {}).reduce((s, r) => {
                            const base = Number(r.base || 0);
                            if (base <= 0 || isItemPaid(r, base)) return s;
                            const dest = r.destinationCompte || 'courant';
                            if (dest !== 'courant') return s;
                            // Filtre temporel si vueTemporelle === 'semaine'
                            if (vueTemporelle.value === 'semaine' && !isFluxCetteSemaine(r.jourPrevu)) return s;
                            return s + base;
                        }, 0);
                    });

                    const cashDispoPourConso = computed(() => {
                        return tresoActuelleCourante.value
                            + revenusEnAttenteCourant.value
                            - resteAPayerCourant.value;
                    });`;

check('C1-Op1 cashDispoPourConso anchor', html.includes(OLD_CASH_COMPUTED));
html = html.replace(OLD_CASH_COMPUTED, NEW_CASH_COMPUTED);

// Op 2 : Exposer revenusEnAttenteCourant + vueTemporelle dans le return
const OLD_RET_TIMING = `// v22.97 Conso-Target
                        besoinVariableHebdoTheorique, chargesVarHebdoDetail,`;
const NEW_RET_TIMING = `// v22.97 Conso-Target
                        besoinVariableHebdoTheorique, chargesVarHebdoDetail,
                        // v23.00 ERP-Edition
                        revenusEnAttenteCourant, vueTemporelle, soldeBancaireReel, ecartRapprochement, regulariserEcart,`;

check('C1-Op2 return anchor', html.includes(OLD_RET_TIMING));
html = html.replace(OLD_RET_TIMING, NEW_RET_TIMING);

// Op 3 : Mettre à jour le tooltip KPI3 — ajouter ligne revenus en attente
const OLD_TOOLTIP_REEL = `<p class="font-black uppercase tracking-widest text-blue-300 mb-2 text-[10px] border-b border-slate-700 pb-1.5">📊 DISPONIBLE RÉEL</p>\n                                        <div class="space-y-1.5 mb-3">\n                                            <div class="flex justify-between gap-3">\n                                                <span class="text-emerald-400">💰 Tréso courante</span>\n                                                <span class="font-black text-white">{{ formatMAD(tresoActuelleCourante) }}</span>\n                                            </div>\n                                            <div class="flex justify-between gap-3">\n                                                <span class="text-orange-400">➖ Obligations</span>\n                                                <span class="font-black text-white">− {{ formatMAD(resteAPayerCourant) }}</span>\n                                            </div>\n                                            <div :class="['flex justify-between gap-3 border-t border-slate-700 pt-1.5 mt-1.5 font-black', cashDispoPourConso >= 0 ? 'text-blue-300' : 'text-red-300']">\n                                                <span>= Total Conso Restant</span>\n                                                <span>{{ formatMAD(cashDispoPourConso) }}</span>\n                                            </div>\n                                            <div v-if="budgetSemaineReel !== null" class="flex justify-between gap-3 border-t border-slate-700 pt-1.5 mt-1.5">\n                                                <span class="text-amber-400">🗓️ Budget / sem autorisé</span>\n                                                <span class="font-black text-amber-300">{{ formatMAD(budgetSemaineReel) }}</span>\n                                            </div>\n                                        </div>`;

const NEW_TOOLTIP_REEL = `<p class="font-black uppercase tracking-widest text-blue-300 mb-2 text-[10px] border-b border-slate-700 pb-1.5">📊 DISPONIBLE RÉEL</p>\n                                        <div class="space-y-1.5 mb-3">\n                                            <div class="flex justify-between gap-3">\n                                                <span class="text-emerald-400">💰 Tréso instantanée</span>\n                                                <span class="font-black text-white">{{ formatMAD(tresoActuelleCourante) }}</span>\n                                            </div>\n                                            <div v-if="revenusEnAttenteCourant > 0" class="flex justify-between gap-3">\n                                                <span class="text-sky-400">📥 + Revenus en attente</span>\n                                                <span class="font-black text-sky-200">+ {{ formatMAD(revenusEnAttenteCourant) }}</span>\n                                            </div>\n                                            <div class="flex justify-between gap-3">\n                                                <span class="text-orange-400">➖ Obligations du cycle</span>\n                                                <span class="font-black text-white">− {{ formatMAD(resteAPayerCourant) }}</span>\n                                            </div>\n                                            <div :class="['flex justify-between gap-3 border-t border-slate-700 pt-1.5 mt-1.5 font-black', cashDispoPourConso >= 0 ? 'text-blue-300' : 'text-red-300']">\n                                                <span>= Total Conso Restant</span>\n                                                <span>{{ formatMAD(cashDispoPourConso) }}</span>\n                                            </div>\n                                            <div v-if="budgetSemaineReel !== null" class="flex justify-between gap-3 border-t border-slate-700 pt-1.5 mt-1.5">\n                                                <span class="text-amber-400">🗓️ Budget / sem autorisé</span>\n                                                <span class="font-black text-amber-300">{{ formatMAD(budgetSemaineReel) }}</span>\n                                            </div>\n                                        </div>`;

check('C1-Op3 tooltip reel anchor', html.includes(OLD_TOOLTIP_REEL));
html = html.replace(OLD_TOOLTIP_REEL, NEW_TOOLTIP_REEL);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ CHANTIER 2 : Toggle vueTemporelle + filtrage dans resteAPayerDetailParCompte
// ═══════════════════════════════════════════════════════════════════════════════

// Op 4 : Ajouter vueTemporelle ref + soldeBancaireReel avant jourDePaie computed
const OLD_JDPAIE = `const jourDePaie = computed(() => Number(soldesInitiaux.value.jourDePaie) || 27);`;
const NEW_JDPAIE = `// v23.00 ERP-Edition — refs ERP
                    const vueTemporelle = ref('cycle'); // 'cycle' | 'semaine'
                    const soldeBancaireReel = ref(0);   // saisie rapprochement bancaire

                    const jourDePaie = computed(() => Number(soldesInitiaux.value.jourDePaie) || 27);`;

check('C2-Op4 jourDePaie anchor', html.includes(OLD_JDPAIE));
html = html.replace(OLD_JDPAIE, NEW_JDPAIE);

// Op 5 : Ajouter filtreTemporel au début de resteAPayerDetailParCompte + ajouter ecartRapprochement + regulariserEcart
// Insert after the existing resteAPayerDetailParCompte computed (after return Object.values...)
const OLD_RESTE_SORT = `                        return Object.values(groupsMap).sort((a, b) => {
                            if (a.key === 'courant') return -1;
                            if (b.key === 'courant') return 1;
                            return b.montant - a.montant;
                        });
                    });

                    const resteAPayerCourant`;

const NEW_RESTE_SORT = `                        return Object.values(groupsMap).sort((a, b) => {
                            if (a.key === 'courant') return -1;
                            if (b.key === 'courant') return 1;
                            return b.montant - a.montant;
                        });
                    });

                    // v23.00 : Rapprochement bancaire ──────────────────────────────────────────
                    const ecartRapprochement = computed(() => {
                        const saisi = Number(soldeBancaireReel.value || 0);
                        if (saisi === 0) return null;
                        return saisi - tresoActuelleCourante.value;
                    });
                    const regulariserEcart = () => {
                        const ecart = ecartRapprochement.value;
                        if (ecart === null || ecart === 0) return;
                        const mb = moisBudgetaire.value;
                        const d = donneesAnnuelles.value[mb.an];
                        if (!d) return;
                        if (!d.depensesExceptionnelles) d.depensesExceptionnelles = {};
                        if (!d.depensesExceptionnelles[mb.mois]) d.depensesExceptionnelles[mb.mois] = [];
                        d.depensesExceptionnelles[mb.mois].push({
                            id: Date.now(),
                            nom: 'Régularisation bancaire',
                            montant: ecart,
                            sourceCompte: 'courant',
                        });
                        soldeBancaireReel.value = 0;
                        calculationTick.value++;
                        handleDataChange();
                    };

                    const resteAPayerCourant`;

check('C2-Op5 resteAPayerSort anchor', html.includes(OLD_RESTE_SORT));
html = html.replace(OLD_RESTE_SORT, NEW_RESTE_SORT);

// Op 6 : Ajouter passFiltreTemporel dans resteAPayerDetailParCompte (au début du computed)
const OLD_RAPDC_START = `const resteAPayerDetailParCompte = computed(() => {
                        calculationTick.value;
                        const mb = moisBudgetaire.value;
                        const an = mb.an;
                        const mois = mb.mois;
                        const dActuelle = donneesAnnuelles.value[an];
                        if (!dActuelle) return [];
                        const cptsList = comptes.value || [];
                        const groupsMap = {};`;

const NEW_RAPDC_START = `const resteAPayerDetailParCompte = computed(() => {
                        calculationTick.value;
                        const mb = moisBudgetaire.value;
                        const an = mb.an;
                        const mois = mb.mois;
                        const dActuelle = donneesAnnuelles.value[an];
                        if (!dActuelle) return [];
                        const cptsList = comptes.value || [];
                        const groupsMap = {};
                        // v23.00 : filtre temporel (semaine vs cycle complet)
                        const ok = (item) => vueTemporelle.value !== 'semaine' || isFluxCetteSemaine(item.jourPrevu);`;

check('C2-Op6 resteAPayerStart anchor', html.includes(OLD_RAPDC_START));
html = html.replace(OLD_RAPDC_START, NEW_RAPDC_START);

// Op 7 : Ajouter ok() guard dans les 5 boucles de resteAPayerDetailParCompte
// 7a : chargesFixes
const OLD_FIXES_GUARD = `if (due > 0 && !isItemPaid(f, due)) {\n                                const grp = getOrCreate(f.sourceCompte || 'courant');`;
const NEW_FIXES_GUARD = `if (due > 0 && !isItemPaid(f, due) && ok(f)) {\n                                const grp = getOrCreate(f.sourceCompte || 'courant');`;
check('C2-Op7a fixes guard anchor', html.includes(OLD_FIXES_GUARD));
html = html.replace(OLD_FIXES_GUARD, NEW_FIXES_GUARD);

// 7b : chargesVariables items (sub-details — use cat as jourPrevu carrier)
const OLD_VAR_GUARD = `if (m > 0 && !isItemPaid(f, m)) {\n                                        const grp = getOrCreate(src);`;
const NEW_VAR_GUARD = `if (m > 0 && !isItemPaid(f, m) && ok(cat)) {\n                                        const grp = getOrCreate(src);`;
check('C2-Op7b var guard anchor', html.includes(OLD_VAR_GUARD));
html = html.replace(OLD_VAR_GUARD, NEW_VAR_GUARD);

// 7c : dépenses irrégulières
const OLD_DEP_GUARD = `if (m > 0 && !isItemPaid(dep, m)) {\n                                const grp = getOrCreate(dep.sourceCompte || 'courant');`;
const NEW_DEP_GUARD = `if (m > 0 && !isItemPaid(dep, m) && ok(dep)) {\n                                const grp = getOrCreate(dep.sourceCompte || 'courant');`;
check('C2-Op7c dep guard anchor', html.includes(OLD_DEP_GUARD));
html = html.replace(OLD_DEP_GUARD, NEW_DEP_GUARD);

// 7d : virements
const OLD_VIR_GUARD = `if (m > 0 && !isItemPaid(vir, m)) {\n                                const grp = getOrCreate(vir.sourceCompte || 'courant');`;
const NEW_VIR_GUARD = `if (m > 0 && !isItemPaid(vir, m) && ok(vir)) {\n                                const grp = getOrCreate(vir.sourceCompte || 'courant');`;
check('C2-Op7d vir guard anchor', html.includes(OLD_VIR_GUARD));
html = html.replace(OLD_VIR_GUARD, NEW_VIR_GUARD);

// 7e : épargne
const OLD_EP_GUARD = `if (isItemPaid(ep, m)) return;\n                            const src = ep.sourceCompte || 'courant';`;
const NEW_EP_GUARD = `if (isItemPaid(ep, m)) return;\n                            if (!ok(ep)) return;\n                            const src = ep.sourceCompte || 'courant';`;
check('C2-Op7e ep guard anchor', html.includes(OLD_EP_GUARD));
html = html.replace(OLD_EP_GUARD, NEW_EP_GUARD);

// Op 8 : Toggle UI dans le header du Pilotage Réalisé (après la span "Survol = détail")
const OLD_PILOTAGE_HDR = `<span class="text-[9px] font-black uppercase tracking-widest text-gray-400 bg-gray-100 px-2 py-1 rounded-lg border border-gray-200 self-start mt-1">Survol = détail</span>
                        </div>

                        <!-- ⏳ v22.50 Jauge Cycle de Paie -->`;

const NEW_PILOTAGE_HDR = `<div class="flex items-center gap-2 self-start mt-1 flex-wrap">
                                <span class="text-[9px] font-black uppercase tracking-widest text-gray-400 bg-gray-100 px-2 py-1 rounded-lg border border-gray-200">Survol = détail</span>
                                <!-- v23.00 Toggle Vue Temporelle -->
                                <div class="flex items-center bg-slate-800 rounded-xl p-0.5 border border-slate-700">
                                    <button @click="vueTemporelle = 'semaine'" :class="['px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all', vueTemporelle === 'semaine' ? 'bg-amber-500 text-white shadow' : 'text-slate-400 hover:text-white']">📅 Cette semaine</button>
                                    <button @click="vueTemporelle = 'cycle'" :class="['px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all', vueTemporelle === 'cycle' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white']">🗓️ Fin de cycle</button>
                                </div>
                            </div>
                        </div>

                        <!-- ⏳ v22.50 Jauge Cycle de Paie -->`;

check('C2-Op8 toggle UI anchor', html.includes(OLD_PILOTAGE_HDR));
html = html.replace(OLD_PILOTAGE_HDR, NEW_PILOTAGE_HDR);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ CHANTIER 3 : Trésorerie — Contenu + Rapprochement Bancaire
// ═══════════════════════════════════════════════════════════════════════════════

const OLD_TRESORERIE = `                <div v-if="activeTab === 'tresorerie'" class="max-w-4xl mx-auto space-y-4 md:space-y-6">
                    <h2 class="text-xl md:text-2xl font-bold text-gray-800 border-b pb-4">💰 Trésorerie Réelle</h2>
                    <div class="p-8 md:p-12 text-center text-slate-400 italic border-2 border-dashed border-slate-300 rounded-2xl bg-white text-sm">En construction — Phase 5.</div>
                </div>`;

const NEW_TRESORERIE = `                <div v-if="activeTab === 'tresorerie'" class="max-w-4xl mx-auto space-y-4 md:space-y-6">
                    <h2 class="text-xl md:text-2xl font-bold text-gray-800 border-b pb-4">💰 Trésorerie Réelle</h2>

                    <!-- Comptes résumé (lecture seule depuis Trésorerie) -->
                    <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                        <div class="px-6 py-4 border-b border-gray-100 bg-slate-50">
                            <h3 class="font-black uppercase tracking-widest text-gray-700 text-sm">🏦 État des Comptes</h3>
                            <p class="text-[10px] text-gray-400 mt-0.5">Pour modifier les soldes, utilisez ⚙️ Budget Structurel.</p>
                        </div>
                        <div class="divide-y divide-gray-100">
                            <div v-for="c in comptes" :key="c.id" class="px-6 py-3 flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                    <span class="text-lg">{{ c.icone || '🏦' }}</span>
                                    <div>
                                        <p class="font-black text-gray-800 text-sm">{{ c.label }}</p>
                                        <span :class="['text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full', c.type === 'courant' ? 'bg-red-100 text-red-700' : c.type === 'epargne' ? 'bg-green-100 text-green-700' : c.type === 'investissement' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700']">{{ c.type }}</span>
                                    </div>
                                </div>
                                <p :class="['text-lg font-black tabular-nums', c.solde >= 0 ? 'text-gray-800' : 'text-red-600']">{{ formatMAD(c.solde) }}</p>
                            </div>
                        </div>
                    </div>

                    <!-- ⚖️ Rapprochement Bancaire -->
                    <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                        <div class="px-6 py-4 border-b border-gray-100 bg-emerald-50">
                            <h3 class="font-black uppercase tracking-widest text-emerald-800 text-sm">⚖️ Rapprochement Bancaire</h3>
                            <p class="text-[10px] text-emerald-600 mt-0.5">Comparez le solde calculé par l'app avec votre relevé bancaire réel.</p>
                        </div>
                        <div class="p-6 space-y-4">
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div class="bg-slate-50 rounded-xl p-4 border border-slate-200">
                                    <p class="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Solde Calculé par l'app</p>
                                    <p :class="['text-2xl font-black', tresoActuelleCourante >= 0 ? 'text-emerald-700' : 'text-red-600']">{{ formatMAD(tresoActuelleCourante) }}</p>
                                    <p class="text-[9px] text-slate-400 mt-1">Compte courant — mis à jour au pointage</p>
                                </div>
                                <div class="bg-white rounded-xl p-4 border-2 border-dashed border-emerald-300">
                                    <p class="text-[10px] font-black uppercase tracking-widest text-emerald-700 mb-2">Solde Réel en Banque</p>
                                    <div class="flex items-center gap-2">
                                        <input type="number" v-model.number="soldeBancaireReel" step="100" placeholder="Ex: 45 200" class="flex-1 p-2 border-2 border-emerald-200 rounded-lg text-lg font-black text-emerald-800 outline-none focus:border-emerald-500 text-right bg-emerald-50"/>
                                        <span class="text-sm font-bold text-slate-400 shrink-0">DH</span>
                                    </div>
                                </div>
                            </div>

                            <!-- Résultat écart -->
                            <div v-if="ecartRapprochement !== null" :class="['rounded-xl p-4 border', Math.abs(ecartRapprochement) < 1 ? 'bg-emerald-50 border-emerald-300' : 'bg-amber-50 border-amber-300']">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <p class="text-[10px] font-black uppercase tracking-widest text-gray-500">Écart constaté</p>
                                        <p :class="['text-2xl font-black mt-1', Math.abs(ecartRapprochement) < 1 ? 'text-emerald-700' : ecartRapprochement > 0 ? 'text-blue-700' : 'text-red-600']">
                                            {{ ecartRapprochement >= 0 ? '+' : '' }}{{ formatMAD(ecartRapprochement) }}
                                        </p>
                                        <p class="text-[9px] text-gray-400 mt-0.5">{{ Math.abs(ecartRapprochement) < 1 ? '✅ Comptes équilibrés' : (ecartRapprochement > 0 ? '↑ Banque > App (revenus non pointés ou dépense non saisie)' : '↓ Banque < App (dépense non saisie ou erreur de saisie)') }}</p>
                                    </div>
                                    <button v-if="Math.abs(ecartRapprochement) >= 1" @click="regulariserEcart" class="ml-4 px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-black transition-colors shadow-md">
                                        ⚠️ Régulariser<br><span class="text-[10px] font-bold">{{ formatMAD(Math.abs(ecartRapprochement)) }}</span>
                                    </button>
                                </div>
                            </div>
                            <p v-else class="text-[11px] text-slate-400 italic text-center">Saisissez votre solde bancaire pour démarrer le rapprochement.</p>
                        </div>
                    </div>
                </div>`;

check('C3 Trésorerie anchor', html.includes(OLD_TRESORERIE));
html = html.replace(OLD_TRESORERIE, NEW_TRESORERIE);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ CHANTIER 4 : Tooltips KPI Pilotage Théorique
// ═══════════════════════════════════════════════════════════════════════════════

const OLD_THEO_GRID = `<!-- KPI Grid 3 colonnes — accents indigo/purple/cyan -->
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div class="bg-gradient-to-br from-indigo-50 to-indigo-100 border border-indigo-200 rounded-2xl p-4">
                                <p class="text-[10px] font-black uppercase tracking-widest text-indigo-700 mb-1">🎯 Revenus Cibles</p>
                                <p class="text-2xl font-black text-indigo-900">{{ formatMAD(revenusTheoriquesMois) }}</p>
                                <p class="text-[10px] text-indigo-500 mt-1 font-bold">Somme des bases prévues</p>
                            </div>
                            <div class="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-2xl p-4">
                                <p class="text-[10px] font-black uppercase tracking-widest text-purple-700 mb-1">📌 Engagements Prévus</p>
                                <p class="text-2xl font-black text-purple-900">{{ formatMAD(engagementsTheoriquesMois) }}</p>
                                <p class="text-[10px] text-purple-500 mt-1 font-bold">
                                    Fix {{ formatMAD(engagementsTheoriquesDetail.fixes) }} ·
                                    Ép. {{ formatMAD(engagementsTheoriquesDetail.epargne) }} ·
                                    Chocs {{ formatMAD(engagementsTheoriquesDetail.chocs) }}
                                </p>
                            </div>
                            <div class="bg-gradient-to-br from-cyan-50 to-sky-100 border border-cyan-200 rounded-2xl p-4">
                                <p class="text-[10px] font-black uppercase tracking-widest text-cyan-700 mb-1">🛒 Budget Conso Standard</p>
                                <p class="text-2xl font-black text-cyan-900">{{ formatMAD(budgetConsoTheoriqueMois) }}</p>
                                <p class="text-[10px] text-cyan-500 mt-1 font-bold">≈ {{ formatMAD(rythmeTheoriqueSemaine) }} / semaine</p>
                            </div>
                        </div>`;

const NEW_THEO_GRID = `<!-- KPI Grid 3 colonnes — accents indigo/purple/cyan — v23.00 tooltips -->
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <!-- Carte 1 : Revenus Cibles -->
                            <div class="relative group cursor-default">
                                <div class="bg-gradient-to-br from-indigo-50 to-indigo-100 border border-indigo-200 rounded-2xl p-4 group-hover:border-indigo-400 transition-all">
                                    <p class="text-[10px] font-black uppercase tracking-widest text-indigo-700 mb-1">🎯 Revenus Cibles</p>
                                    <p class="text-2xl font-black text-indigo-900">{{ formatMAD(revenusTheoriquesMois) }}</p>
                                    <p class="text-[10px] text-indigo-500 mt-1 font-bold">Survol = détail</p>
                                </div>
                                <div class="absolute top-full left-0 right-0 mt-1.5 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                    <div class="w-3 h-3 bg-indigo-950 border-t border-l border-indigo-400 rotate-45 mx-auto -mb-[7px] relative z-10"></div>
                                    <div class="bg-indigo-950 border border-indigo-400 rounded-xl shadow-2xl p-3 text-left text-[11px]">
                                        <p class="font-black text-indigo-200 uppercase tracking-widest text-[9px] mb-2">Sources de revenus prévues</p>
                                        <div v-for="r in pilotageTheoLignes.revenus" :key="r.nom" class="flex justify-between gap-3 py-0.5">
                                            <span class="text-indigo-300 truncate max-w-[150px]">{{ r.nom }}<span v-if="r.jourPrevu" class="text-indigo-500 ml-1 text-[9px]">j.{{ r.jourPrevu }}</span></span>
                                            <span class="font-black text-white">{{ formatMAD(r.montant) }}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <!-- Carte 2 : Engagements Prévus -->
                            <div class="relative group cursor-default">
                                <div class="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-2xl p-4 group-hover:border-purple-400 transition-all">
                                    <p class="text-[10px] font-black uppercase tracking-widest text-purple-700 mb-1">📌 Engagements Prévus</p>
                                    <p class="text-2xl font-black text-purple-900">{{ formatMAD(engagementsTheoriquesMois) }}</p>
                                    <p class="text-[10px] text-purple-500 mt-1 font-bold">Survol = détail</p>
                                </div>
                                <div class="absolute top-full left-0 right-0 mt-1.5 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                    <div class="w-3 h-3 bg-purple-950 border-t border-l border-purple-400 rotate-45 mx-auto -mb-[7px] relative z-10"></div>
                                    <div class="bg-purple-950 border border-purple-400 rounded-xl shadow-2xl p-3 text-left text-[11px]">
                                        <p class="font-black text-purple-200 uppercase tracking-widest text-[9px] mb-1">🏢 Charges Fixes</p>
                                        <div v-for="f in pilotageTheoLignes.fixes" :key="f.nom" class="flex justify-between gap-3 py-0.5 pl-2">
                                            <span class="text-purple-300 truncate max-w-[140px]">{{ f.nom }}<span v-if="f.jourPrevu" class="text-purple-500 ml-1 text-[9px]">j.{{ f.jourPrevu }}</span></span>
                                            <span class="font-black text-white">{{ formatMAD(f.montant) }}</span>
                                        </div>
                                        <p class="font-black text-purple-200 uppercase tracking-widest text-[9px] mb-1 mt-2">💰 Épargne</p>
                                        <div v-for="e in pilotageTheoLignes.epargne" :key="e.nom" class="flex justify-between gap-3 py-0.5 pl-2">
                                            <span class="text-purple-300 truncate max-w-[140px]">{{ e.nom }}</span>
                                            <span class="font-black text-white">{{ formatMAD(e.montant) }}</span>
                                        </div>
                                        <div v-if="pilotageTheoLignes.chocs.length > 0">
                                            <p class="font-black text-purple-200 uppercase tracking-widest text-[9px] mb-1 mt-2">⚠️ Chocs</p>
                                            <div v-for="c in pilotageTheoLignes.chocs" :key="c.nom" class="flex justify-between gap-3 py-0.5 pl-2">
                                                <span class="text-purple-300 truncate max-w-[140px]">{{ c.nom }}</span>
                                                <span class="font-black text-white">{{ formatMAD(c.montant) }}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <!-- Carte 3 : Budget Conso Standard -->
                            <div class="relative group cursor-default">
                                <div class="bg-gradient-to-br from-cyan-50 to-sky-100 border border-cyan-200 rounded-2xl p-4 group-hover:border-cyan-400 transition-all">
                                    <p class="text-[10px] font-black uppercase tracking-widest text-cyan-700 mb-1">🛒 Budget Conso Standard</p>
                                    <p class="text-2xl font-black text-cyan-900">{{ formatMAD(budgetConsoTheoriqueMois) }}</p>
                                    <p class="text-[10px] text-cyan-500 mt-1 font-bold">Survol = détail</p>
                                </div>
                                <div class="absolute top-full left-0 right-0 mt-1.5 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                    <div class="w-3 h-3 bg-cyan-950 border-t border-l border-cyan-400 rotate-45 mx-auto -mb-[7px] relative z-10"></div>
                                    <div class="bg-cyan-950 border border-cyan-400 rounded-xl shadow-2xl p-3 text-left text-[11px]">
                                        <p class="font-black text-cyan-200 uppercase tracking-widest text-[9px] mb-2">Catégories de consommation</p>
                                        <div v-for="v in pilotageTheoLignes.variables" :key="v.nom" class="flex justify-between gap-3 py-0.5">
                                            <span class="text-cyan-300 truncate max-w-[140px]">{{ v.nom }}<span v-if="v.jourPrevu" class="text-cyan-500 ml-1 text-[9px]">j.{{ v.jourPrevu }}</span></span>
                                            <span class="font-black text-white">{{ formatMAD(v.montant) }}</span>
                                        </div>
                                        <div class="flex justify-between gap-3 border-t border-cyan-800 pt-1.5 mt-1.5 font-black text-cyan-300">
                                            <span>≈ / semaine</span>
                                            <span class="text-white">{{ formatMAD(rythmeTheoriqueSemaine) }}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>`;

check('C4 théo KPI grid anchor', html.includes(OLD_THEO_GRID));
html = html.replace(OLD_THEO_GRID, NEW_THEO_GRID);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Version bump
// ═══════════════════════════════════════════════════════════════════════════════
check('Version anchor', html.includes('"22.97 Conso-Target"'));
html = html.replace('"22.97 Conso-Target"', '"23.00 ERP-Edition"');

writeFileSync(filePath, html, 'utf8');
console.log(`\n🎉 Done — ${ops}/16 ops. Fichier écrit.`);
