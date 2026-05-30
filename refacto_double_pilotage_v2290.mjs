import { readFileSync, writeFileSync } from 'fs';

const filePath = 'C:/Users/HP/finance/index.html';
let html = readFileSync(filePath, 'utf8');

// Normalize CRLF → LF
html = html.replace(/\r\n/g, '\n');

let ops = 0;
const expected = 4;

// ═══════════════════════════════════════════════════════════════════════════
// Op 1 : Ajouter les computeds théoriques après budgetSemaineReel
// ═══════════════════════════════════════════════════════════════════════════
const OLD_BUDGET_SEMAINE = `const budgetSemaineReel = computed(() => {
                        const jours = joursRestantsAvantPaie.value;
                        if (!jours) return null;
                        return cashDispoPourConso.value / (jours / 7);
                    });`;

const NEW_BUDGET_SEMAINE = OLD_BUDGET_SEMAINE + `

                    // ═══════════════════════════════════════════════════════════
                    // v22.90 Double-Pilotage — VUE THÉORIQUE (mode prévisionnel)
                    // Ignore totalement isItemPaid + tresoActuelleCourante.
                    // Calcule ce qui DEVRAIT se passer sur le cycle de paie.
                    // ═══════════════════════════════════════════════════════════
                    const revenusTheoriquesMois = computed(() => {
                        calculationTick.value;
                        const mb = moisBudgetaire.value;
                        const dActuelle = donneesAnnuelles.value[mb.an];
                        if (!dActuelle) return 0;
                        return Object.values(dActuelle.revenus || {})
                            .reduce((s, r) => s + Number(r.base || 0), 0);
                    });

                    const engagementsTheoriquesDetail = computed(() => {
                        calculationTick.value;
                        const mb = moisBudgetaire.value;
                        const an = mb.an;
                        const mois = mb.mois;
                        const dActuelle = donneesAnnuelles.value[an];
                        if (!dActuelle) return { fixes: 0, epargne: 0, chocs: 0, total: 0 };
                        let fixes = 0, epargne = 0, chocs = 0;
                        Object.values(dActuelle.chargesFixes || {}).forEach(f => {
                            fixes += getDueFixe(f, an);
                        });
                        const epArr = Array.isArray(dActuelle.epargne)
                            ? dActuelle.epargne
                            : Object.values(dActuelle.epargne || {});
                        epArr.forEach(ep => { epargne += Number(ep.valeur || 0); });
                        getDepensesMois(mois, an).forEach(dep => { chocs += Number(dep.montant || 0); });
                        return { fixes, epargne, chocs, total: fixes + epargne + chocs };
                    });

                    const engagementsTheoriquesMois = computed(() => engagementsTheoriquesDetail.value.total);

                    const budgetConsoTheoriqueMois = computed(() => {
                        calculationTick.value;
                        const mb = moisBudgetaire.value;
                        const dActuelle = donneesAnnuelles.value[mb.an];
                        if (!dActuelle) return 0;
                        let total = 0;
                        Object.values(dActuelle.chargesVariables || {})
                            .filter(c => c?.periode === 'mois')
                            .forEach(cat => {
                                if (cat.details && cat.details.length) {
                                    cat.details.forEach(d => { total += Number(d.montant || 0); });
                                } else {
                                    total += Number(cat.valeur || 0);
                                }
                            });
                        return total;
                    });

                    const rythmeTheoriqueSemaine = computed(() => {
                        const info = _cyclePaieInfo.value;
                        const totalCycleJours = Math.max(1, info.joursAvant + info.joursDepuis);
                        const semaines = totalCycleJours / 7;
                        if (!semaines) return 0;
                        return budgetConsoTheoriqueMois.value / semaines;
                    });

                    // Listes en lecture seule pour la vue théorique (groupées par compte)
                    const _pilotageTheoLignes = computed(() => {
                        calculationTick.value;
                        const mb = moisBudgetaire.value;
                        const an = mb.an;
                        const mois = mb.mois;
                        const dActuelle = donneesAnnuelles.value[an];
                        const out = { revenus: [], fixes: [], variables: [], epargne: [], chocs: [] };
                        if (!dActuelle) return out;
                        Object.values(dActuelle.revenus || {}).forEach(r => {
                            const m = Number(r.base || 0);
                            if (m > 0) out.revenus.push({ nom: r.label || r.nom || '?', montant: m });
                        });
                        Object.values(dActuelle.chargesFixes || {}).forEach(f => {
                            const due = getDueFixe(f, an);
                            if (due > 0) out.fixes.push({ nom: f.label || '?', montant: due });
                        });
                        Object.values(dActuelle.chargesVariables || {})
                            .filter(c => c?.periode === 'mois')
                            .forEach(cat => {
                                if (cat.details && cat.details.length) {
                                    cat.details.forEach(d => {
                                        const m = Number(d.montant || 0);
                                        if (m > 0) out.variables.push({ nom: d.nom || cat.label || '?', montant: m });
                                    });
                                } else {
                                    const m = Number(cat.valeur || 0);
                                    if (m > 0) out.variables.push({ nom: cat.label || '?', montant: m });
                                }
                            });
                        const epArr = Array.isArray(dActuelle.epargne)
                            ? dActuelle.epargne
                            : Object.values(dActuelle.epargne || {});
                        epArr.forEach(ep => {
                            const m = Number(ep.valeur || 0);
                            if (m > 0) out.epargne.push({ nom: ep.nom || ep.label || '?', montant: m });
                        });
                        getDepensesMois(mois, an).forEach(dep => {
                            const m = Number(dep.montant || 0);
                            if (m > 0) out.chocs.push({ nom: dep.label || dep.nom || '?', montant: m });
                        });
                        return out;
                    });`;

if (html.includes(OLD_BUDGET_SEMAINE)) {
    html = html.replace(OLD_BUDGET_SEMAINE, NEW_BUDGET_SEMAINE);
    ops++;
    console.log('✅ Op 1 : computeds théoriques ajoutés');
} else {
    console.error('❌ Op 1 FAILED : OLD_BUDGET_SEMAINE introuvable');
    process.exit(1);
}

// ═══════════════════════════════════════════════════════════════════════════
// Op 2 : Exposer les nouveaux computeds dans le return
// ═══════════════════════════════════════════════════════════════════════════
const OLD_RETURN = `cashDispoPourConso, budgetSemaineReel,`;
const NEW_RETURN = `cashDispoPourConso, budgetSemaineReel,
                        // v22.90 Double-Pilotage
                        revenusTheoriquesMois, engagementsTheoriquesMois, engagementsTheoriquesDetail,
                        budgetConsoTheoriqueMois, rythmeTheoriqueSemaine, _pilotageTheoLignes,`;

if (html.includes(OLD_RETURN)) {
    html = html.replace(OLD_RETURN, NEW_RETURN);
    ops++;
    console.log('✅ Op 2 : return étendu');
} else {
    console.error('❌ Op 2 FAILED');
    process.exit(1);
}

// ═══════════════════════════════════════════════════════════════════════════
// Op 3 : Ajouter le bouton "Pilotage Théorique" dans la sidebar prévisionnel
//         + le bloc template du pilotage théorique
// ═══════════════════════════════════════════════════════════════════════════
const OLD_SIDEBAR = `                    <template v-if="appMode === 'previsionnel'">
                    <button @click="activeTab = 'dashboard'"`;

const NEW_SIDEBAR = `                    <template v-if="appMode === 'previsionnel'">
                    <button @click="activeTab = 'pilotageTheo'" :class="['w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors text-sm font-bold', activeTab === 'pilotageTheo' ? 'bg-gradient-to-r from-indigo-600 to-purple-700 shadow-lg shadow-indigo-900/50' : 'hover:bg-slate-800 text-slate-300']">🔮 Pilotage Théorique</button>
                    <button @click="activeTab = 'dashboard'"`;

if (html.includes(OLD_SIDEBAR)) {
    html = html.replace(OLD_SIDEBAR, NEW_SIDEBAR);
    ops++;
    console.log('✅ Op 3 : bouton sidebar Pilotage Théorique ajouté');
} else {
    console.error('❌ Op 3 FAILED');
    process.exit(1);
}

// ═══════════════════════════════════════════════════════════════════════════
// Op 4 : Insérer le bloc template Pilotage Théorique juste avant
//         <div v-if="activeTab === 'pilotage'" ...> (le réalisé)
// ═══════════════════════════════════════════════════════════════════════════
const ANCHOR_PILOTAGE_REEL = `                <div v-if="activeTab === 'pilotage'" class="max-w-4xl mx-auto space-y-6">
                    <!-- v22.40 — Header Pilotage Transparent -->`;

const PILOTAGE_THEO_BLOCK = `                <!-- ═══════════════════════════════════════════════════════════════
                     v22.90 Double-Pilotage — VUE THÉORIQUE (mode prévisionnel)
                     Lecture seule, basée uniquement sur le budget structurel.
                     ═══════════════════════════════════════════════════════════════ -->
                <div v-if="activeTab === 'pilotageTheo' && appMode === 'previsionnel'" class="max-w-4xl mx-auto space-y-6">
                    <div class="border-b pb-5 mb-6">
                        <div class="flex items-start justify-between mb-4">
                            <div>
                                <h2 class="text-2xl font-bold text-gray-800">🔮 Pilotage Théorique</h2>
                                <p class="text-sm text-gray-500 mt-0.5">Budget cible — Cycle <b>{{ cycleLabel }}</b></p>
                            </div>
                            <span class="text-[9px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-200 self-start mt-1">Vue Prévi · Lecture seule</span>
                        </div>

                        <!-- Jauge cycle (identique au Réalisé mais accent indigo) -->
                        <div class="mb-4 bg-gradient-to-br from-indigo-900/80 to-purple-900/70 rounded-2xl border border-indigo-700 p-4">
                            <div class="flex items-center justify-between mb-2.5">
                                <div class="text-left">
                                    <p class="text-[9px] font-black uppercase tracking-widest text-indigo-300">📅 Dernière paie</p>
                                    <p class="text-white text-xs font-black mt-0.5">{{ dernierePaieLabel }}</p>
                                </div>
                                <div class="text-center">
                                    <p class="text-xl font-black text-white">⏳ J−{{ joursRestantsAvantPaie }}</p>
                                    <p class="text-indigo-200 text-[9px] font-bold">{{ formatMAD(rythmeTheoriqueSemaine) }} / sem cible</p>
                                </div>
                                <div class="text-right">
                                    <p class="text-[9px] font-black uppercase tracking-widest text-indigo-300">Prochaine paie 📅</p>
                                    <p class="text-white text-xs font-black mt-0.5">{{ prochainePaieLabel }}</p>
                                </div>
                            </div>
                            <div class="w-full bg-indigo-950/60 rounded-full h-2.5 overflow-hidden">
                                <div :style="{ width: progressCyclePaie + '%' }" class="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-indigo-400 to-purple-400"></div>
                            </div>
                            <div class="flex justify-between text-[9px] text-indigo-300 mt-1.5 font-bold">
                                <span>{{ joursDepuisDernierePaie }}j écoulés</span>
                                <span>{{ progressCyclePaie }}% du cycle</span>
                                <span>{{ joursRestantsAvantPaie }}j restants</span>
                            </div>
                        </div>

                        <!-- KPI Grid 3 colonnes — accents indigo/purple/cyan -->
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
                        </div>
                    </div>

                    <!-- Listes lecture seule — ventilation par nature -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <!-- Revenus prévus -->
                        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                            <h3 class="text-sm font-black uppercase tracking-widest text-emerald-700 mb-3">💰 Revenus Prévus</h3>
                            <div v-if="_pilotageTheoLignes.revenus.length === 0" class="text-xs text-slate-400 italic">Aucun revenu défini</div>
                            <ul class="space-y-1.5">
                                <li v-for="(r, i) in _pilotageTheoLignes.revenus" :key="'r'+i" class="flex justify-between text-xs py-1 border-b border-slate-100 last:border-0">
                                    <span class="text-slate-700 truncate max-w-[180px]">{{ r.nom }}</span>
                                    <span class="font-bold text-emerald-700">{{ formatMAD(r.montant) }}</span>
                                </li>
                            </ul>
                        </div>
                        <!-- Charges Fixes -->
                        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                            <h3 class="text-sm font-black uppercase tracking-widest text-orange-700 mb-3">🏢 Charges Fixes</h3>
                            <div v-if="_pilotageTheoLignes.fixes.length === 0" class="text-xs text-slate-400 italic">Aucune charge fixe</div>
                            <ul class="space-y-1.5">
                                <li v-for="(f, i) in _pilotageTheoLignes.fixes" :key="'f'+i" class="flex justify-between text-xs py-1 border-b border-slate-100 last:border-0">
                                    <span class="text-slate-700 truncate max-w-[180px]">{{ f.nom }}</span>
                                    <span class="font-bold text-orange-700">{{ formatMAD(f.montant) }}</span>
                                </li>
                            </ul>
                        </div>
                        <!-- Charges Variables -->
                        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                            <h3 class="text-sm font-black uppercase tracking-widest text-cyan-700 mb-3">🧾 Charges Variables</h3>
                            <div v-if="_pilotageTheoLignes.variables.length === 0" class="text-xs text-slate-400 italic">Aucune charge variable</div>
                            <ul class="space-y-1.5">
                                <li v-for="(v, i) in _pilotageTheoLignes.variables" :key="'v'+i" class="flex justify-between text-xs py-1 border-b border-slate-100 last:border-0">
                                    <span class="text-slate-700 truncate max-w-[180px]">{{ v.nom }}</span>
                                    <span class="font-bold text-cyan-700">{{ formatMAD(v.montant) }}</span>
                                </li>
                            </ul>
                        </div>
                        <!-- Épargne + Chocs -->
                        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                            <h3 class="text-sm font-black uppercase tracking-widest text-purple-700 mb-3">💎 Épargne &amp; Chocs</h3>
                            <div v-if="_pilotageTheoLignes.epargne.length === 0 && _pilotageTheoLignes.chocs.length === 0" class="text-xs text-slate-400 italic">Rien de prévu</div>
                            <ul class="space-y-1.5">
                                <li v-for="(e, i) in _pilotageTheoLignes.epargne" :key="'e'+i" class="flex justify-between text-xs py-1 border-b border-slate-100 last:border-0">
                                    <span class="text-slate-700 truncate max-w-[180px]">💰 {{ e.nom }}</span>
                                    <span class="font-bold text-purple-700">{{ formatMAD(e.montant) }}</span>
                                </li>
                                <li v-for="(c, i) in _pilotageTheoLignes.chocs" :key="'c'+i" class="flex justify-between text-xs py-1 border-b border-slate-100 last:border-0">
                                    <span class="text-slate-700 truncate max-w-[180px]">⚠️ {{ c.nom }}</span>
                                    <span class="font-bold text-amber-600">{{ formatMAD(c.montant) }}</span>
                                </li>
                            </ul>
                        </div>
                    </div>

                    <!-- Note explicative -->
                    <div class="bg-indigo-50/60 border border-indigo-200 rounded-xl p-3 text-[11px] text-indigo-800 leading-snug">
                        ℹ️ <b>Vue théorique</b> : ces chiffres ignorent l'état des pointages et le solde bancaire réel. Pour voir l'écart avec la réalité, bascule sur <b class="text-emerald-700">📊 Réalisé</b>.
                    </div>
                </div>

`;

if (html.includes(ANCHOR_PILOTAGE_REEL)) {
    html = html.replace(ANCHOR_PILOTAGE_REEL, PILOTAGE_THEO_BLOCK + ANCHOR_PILOTAGE_REEL);
    ops++;
    console.log('✅ Op 4 : bloc template Pilotage Théorique inséré');
} else {
    console.error('❌ Op 4 FAILED : anchor pilotage réel introuvable');
    process.exit(1);
}

// ═══════════════════════════════════════════════════════════════════════════
// Op 5 : Version bump 22.80 Pilotage-Ledger → 22.90 Double-Pilotage
// ═══════════════════════════════════════════════════════════════════════════
const OLD_VERSION = `"22.80 Pilotage-Ledger"`;
const NEW_VERSION = `"22.90 Double-Pilotage"`;

if (html.includes(OLD_VERSION)) {
    html = html.replace(OLD_VERSION, NEW_VERSION);
    ops++;
    console.log('✅ Op 5 : version → 22.90 Double-Pilotage');
} else {
    console.error('❌ Op 5 FAILED : version introuvable');
    process.exit(1);
}

writeFileSync(filePath, html, 'utf8');
console.log(`\n🎉 Done — ${ops}/${expected + 1} ops appliquées. Fichier écrit.`);
