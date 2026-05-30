/**
 * refacto_pilotage_v2230.mjs
 * 4 chantiers : Pilotage→Réalisé, checkboxes revenus, tréso actuelle, Créances tracker
 */

import { readFileSync, writeFileSync } from 'fs';

const FILE = 'C:/Users/HP/finance/index.html';
let html = readFileSync(FILE, 'utf8');

let log = [];
const replace = (desc, from, to) => {
  if (!html.includes(from)) {
    log.push(`❌ NOT FOUND: ${desc}`);
    return;
  }
  html = html.replace(from, to);
  log.push(`✅ OK: ${desc}`);
};

// ══════════════════════════════════════════════════════════
// 1. VERSION BUMP
// ══════════════════════════════════════════════════════════
replace('version bump',
  'const CURRENT_VERSION = "22.21 Saisie-Zen";',
  'const CURRENT_VERSION = "22.30 Pilotage-Réalisé";'
);

// ══════════════════════════════════════════════════════════
// 2. SIDEBAR DESKTOP — retirer Pilotage de Prévi
// ══════════════════════════════════════════════════════════
replace('sidebar: remove pilotage from previsionnel',
  `                    <button @click="activeTab = 'pilotage'" :class="['w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors text-sm font-bold', activeTab === 'pilotage' ? 'bg-blue-600 shadow-lg shadow-blue-900/50' : 'hover:bg-slate-800 text-slate-300']">🎯 Pilotage Mensuel</button>\n`,
  ``
);

// ══════════════════════════════════════════════════════════
// 2b. SIDEBAR DESKTOP — ajouter Pilotage en 1er dans Réalisé
// ══════════════════════════════════════════════════════════
replace('sidebar: add pilotage first in reel',
  `                    <!-- ─── Onglets mode RÉALISÉ (Phase 3) ─── -->
                    <template v-if="appMode === 'reel'">
                    <button @click="activeTab = 'saisie'"`,
  `                    <!-- ─── Onglets mode RÉALISÉ (Phase 3) ─── -->
                    <template v-if="appMode === 'reel'">
                    <button @click="activeTab = 'pilotage'" :class="['w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors text-sm font-bold', activeTab === 'pilotage' ? 'bg-emerald-600 shadow-lg shadow-emerald-900/50' : 'hover:bg-slate-800 text-slate-300']">🎯 Pilotage Mensuel</button>
                    <button @click="activeTab = 'saisie'"`
);

// ══════════════════════════════════════════════════════════
// 3. MODE SWITCH — reset activeTab on switch
// ══════════════════════════════════════════════════════════
// Sidebar desktop toggle buttons
replace('sidebar mode switch: prévi → réalisé',
  `@click="appMode = 'reel'"
                                :class="appMode === 'reel'`,
  `@click="appMode = 'reel'; activeTab = 'pilotage'"
                                :class="appMode === 'reel'"`
);
replace('sidebar mode switch: réalisé → prévi',
  `@click="appMode = 'previsionnel'"
                                :class="appMode === 'previsionnel'`,
  `@click="appMode = 'previsionnel'; activeTab = 'dashboard'"
                                :class="appMode === 'previsionnel'"`
);
// Top-bar Réalisé mobile toggle
replace('topbar réalisé: prévi toggle',
  `<button @click="appMode = 'previsionnel'" class="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-800 transition-colors">🔮 Prévi</button>`,
  `<button @click="appMode = 'previsionnel'; activeTab = 'dashboard'" class="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-800 transition-colors">🔮 Prévi</button>`
);
// Bottom-nav toggles
replace('bottom-nav: prévi → réalisé',
  `<button @click="appMode = 'reel'"
                        class="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors bg-emerald-50 text-emerald-600 border-l border-gray-200">
                    <span class="text-lg">📊</span>
                    <span class="text-[8px] font-black uppercase tracking-wider">Réalisé</span>
                </button>`,
  `<button @click="appMode = 'reel'; activeTab = 'pilotage'"
                        class="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors bg-emerald-50 text-emerald-600 border-l border-gray-200">
                    <span class="text-lg">📊</span>
                    <span class="text-[8px] font-black uppercase tracking-wider">Réalisé</span>
                </button>`
);
replace('bottom-nav: réalisé → prévi',
  `<button @click="appMode = 'previsionnel'"
                        class="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors bg-indigo-50 text-indigo-600 border-l border-gray-200">
                    <span class="text-lg">🔮</span>
                    <span class="text-[8px] font-black uppercase tracking-wider">Prévi</span>
                </button>`,
  `<button @click="appMode = 'previsionnel'; activeTab = 'dashboard'"
                        class="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors bg-indigo-50 text-indigo-600 border-l border-gray-200">
                    <span class="text-lg">🔮</span>
                    <span class="text-[8px] font-black uppercase tracking-wider">Prévi</span>
                </button>`
);

// ══════════════════════════════════════════════════════════
// 4. BOTTOM-NAV RÉALISÉ — ajouter Pilotage en 1er
// ══════════════════════════════════════════════════════════
replace('bottom-nav: add pilotage first in reel',
  `            <template v-if="appMode === 'reel'">
                <button @click="activeTab = 'saisie'"`,
  `            <template v-if="appMode === 'reel'">
                <button @click="activeTab = 'pilotage'"
                        :class="['flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors', activeTab === 'pilotage' ? 'text-emerald-600 bg-emerald-50' : 'text-gray-500']">
                    <span class="text-lg">🎯</span>
                    <span class="text-[8px] font-black uppercase tracking-wider">Pilotage</span>
                </button>
                <button @click="activeTab = 'saisie'"`
);

// ══════════════════════════════════════════════════════════
// 5. PILOTAGE — remplacer toggle "Paie Globale" par checklist revenus
// ══════════════════════════════════════════════════════════
replace('pilotage: replace salaireRecu toggle with revenues checklist',
  `                        <!-- Bouton paie + checklist (onglet dédié : tout visible directement) -->
                        <div class="space-y-4">
                            <button @click="soldesInitiaux.salaireRecu = !soldesInitiaux.salaireRecu; handleDataChange()" :class="['w-full p-3 rounded-xl border-2 transition-all font-black text-sm uppercase tracking-widest shadow-sm', soldesInitiaux.salaireRecu ? 'bg-green-600/20 border-green-500 text-green-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500']">
                                💰 Paie Globale reçue ? {{ soldesInitiaux.salaireRecu ? 'OUI ✅' : 'NON' }}
                            </button>

                            <div class="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden text-left shadow-lg">`,
  `                        <!-- Checklist Revenus + Dépenses — v22.30 -->
                        <div class="space-y-4">
                            <!-- 🟢 Entrées d'Argent — checklist par source de revenu -->
                            <div class="bg-slate-800 rounded-2xl border border-green-800/50 overflow-hidden text-left shadow-lg">
                                <div class="flex items-center justify-between px-5 py-3 border-b border-slate-700 bg-green-900/20">
                                    <div class="flex items-center gap-3">
                                        <span class="text-green-400 text-lg">🟢</span>
                                        <span class="text-sm font-black uppercase tracking-widest text-white">Entrées d'Argent</span>
                                    </div>
                                    <span class="text-sm font-black text-green-400">{{ formatMAD(tresoEntrees) }}</span>
                                </div>
                                <div class="p-4 space-y-2">
                                    <div v-for="(rev, key) in donneesAnnuelles[soldesInitiaux.anneeActuelle].revenus" :key="'rev_' + key"
                                         class="flex items-center justify-between p-3 bg-slate-900/90 rounded-xl group border border-slate-700 hover:border-green-500 transition-all">
                                        <label class="flex items-center gap-3 cursor-pointer flex-1">
                                            <input type="checkbox"
                                                   :checked="isItemPaid(rev, Number(rev.base || 0))"
                                                   @change="toggleItemPaid(rev, Number(rev.base || 0)); handleDataChange()"
                                                   class="w-5 h-5 rounded border-slate-600 bg-slate-800 text-green-500 focus:ring-green-500 cursor-pointer"/>
                                            <span :class="['text-sm font-bold transition-all', isItemPaid(rev, Number(rev.base || 0)) ? 'text-slate-500 line-through' : 'text-slate-200 group-hover:text-green-300']">{{ rev.label }}</span>
                                        </label>
                                        <span :class="['text-sm font-black ml-4', isItemPaid(rev, Number(rev.base || 0)) ? 'text-green-400' : 'text-slate-400']">{{ formatMAD(Number(rev.base || 0)) }}</span>
                                    </div>
                                    <div v-if="!donneesAnnuelles[soldesInitiaux.anneeActuelle] || !Object.keys(donneesAnnuelles[soldesInitiaux.anneeActuelle].revenus || {}).length" class="text-center py-4 text-slate-500 text-sm">Aucune entrée configurée</div>
                                </div>
                            </div>

                            <div class="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden text-left shadow-lg">`
);

// ══════════════════════════════════════════════════════════
// 6. PILOTAGE HEADER — ajouter métriques Trésorerie actuelle
// ══════════════════════════════════════════════════════════
replace('pilotage: add tréso metrics in header',
  `                    <div class="flex flex-col md:flex-row justify-between items-start md:items-end border-b pb-4 mb-6 gap-4">
                        <div>
                            <h2 class="text-2xl font-bold text-gray-800">🎯 Pilotage du Mois Courant</h2>
                            <p class="text-sm text-gray-500 mt-1">Simulation et pointage des factures pour <b>{{ nomDuMois(soldesInitiaux.moisActuel) }} {{ soldesInitiaux.anneeActuelle }}</b>.</p>
                        </div>
                        <div class="bg-gray-900 text-white p-4 rounded-2xl shadow-lg border border-gray-700 text-right">
                            <p class="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Budget Conso Restant</p>
                            <p class="text-3xl font-black tracking-tighter text-blue-400">{{ formatMAD(budgetConsoRestant) }}</p>
                        </div>
                    </div>`,
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
                    </div>`
);

// ══════════════════════════════════════════════════════════
// 7. MOVE PILOTAGE BLOCK : Prévi → Réalisé panel
// ══════════════════════════════════════════════════════════
// Marker: start of pilotage block (16 spaces)
const PILOTAGE_START = `                <!-- ═══ ONGLET PILOTAGE MENSUEL ═══ -->`;
const PILOTAGE_END_NEXT = `                <div v-if="activeTab === 'irregulieres'" class="max-w-4xl mx-auto space-y-6">`;

const iStart = html.indexOf(PILOTAGE_START);
const iEnd = html.indexOf(PILOTAGE_END_NEXT);

if (iStart === -1 || iEnd === -1) {
  log.push(`❌ PILOTAGE MOVE FAILED — start=${iStart} end=${iEnd}`);
} else {
  const pilotageBlock = html.slice(iStart, iEnd);
  // Remove block from current location
  html = html.slice(0, iStart) + html.slice(iEnd);

  // Insert into Réalisé panel, before <!-- ─── Onglet SAISIE ─── -->
  const REEL_INSERT_BEFORE = `                <!-- ─── Onglet SAISIE ─── -->`;
  const iInsert = html.indexOf(REEL_INSERT_BEFORE);
  if (iInsert === -1) {
    log.push('❌ RÉALISÉ INSERT POINT NOT FOUND');
  } else {
    html = html.slice(0, iInsert) + pilotageBlock + '\n' + html.slice(iInsert);
    log.push(`✅ OK: pilotage block moved (${pilotageBlock.length} chars)`);
  }
}

// ══════════════════════════════════════════════════════════
// 8. ASSURANCES → CRÉANCES & REMBOURSEMENTS
// ══════════════════════════════════════════════════════════
replace('tracker: title',
  `<span class="text-[10px] font-black uppercase tracking-widest text-gray-400">🛡️ Tracker Assurances</span>`,
  `<span class="text-[10px] font-black uppercase tracking-widest text-gray-400">🔄 Créances & Remboursements en attente</span>`
);
replace('tracker: count badge',
  `assurance{{ assurancesStats.count > 1 ? 's' : '' }}`,
  `créance{{ assurancesStats.count > 1 ? 's' : '' }}`
);
replace('tracker: add button label',
  `{{ showAssuranceForm ? '✕ Annuler' : '+ Ajouter une assurance' }}`,
  `{{ showAssuranceForm ? '✕ Annuler' : '+ Ajouter une créance' }}`
);
replace('tracker: form title new',
  `'⚡ Nouvelle assurance'`,
  `'⚡ Nouvelle créance'`
);
replace('tracker: form title edit',
  `'✏️ Modifier l\\'assurance'`,
  `'✏️ Modifier la créance'`
);
// Form labels
replace('tracker: label Assureur',
  `<label class="text-[9px] font-black uppercase tracking-widest text-gray-500 block mb-1">Assureur</label>`,
  `<label class="text-[9px] font-black uppercase tracking-widest text-gray-500 block mb-1">Débiteur/Source</label>`
);
replace('tracker: label Type',
  `<label class="text-[9px] font-black uppercase tracking-widest text-gray-500 block mb-1">Type</label>`,
  `<label class="text-[9px] font-black uppercase tracking-widest text-gray-500 block mb-1">Catégorie</label>`
);
replace('tracker: label Bénéficiaire',
  `<label class="text-[9px] font-black uppercase tracking-widest text-gray-500 block mb-1">Bénéficiaire</label>`,
  `<label class="text-[9px] font-black uppercase tracking-widest text-gray-500 block mb-1">Concerne/Référence</label>`
);
// Empty state
replace('tracker: empty icon',
  `<p class="text-3xl mb-2">🛡️</p>
                                    <p class="text-sm font-bold">Aucune assurance enregistrée</p>
                                    <p class="text-xs mt-1">Ajoutez vos assurances pour suivre cotisations et remboursements.</p>`,
  `<p class="text-3xl mb-2">🔄</p>
                                    <p class="text-sm font-bold">Aucune créance enregistrée</p>
                                    <p class="text-xs mt-1">Ajoutez vos créances et remboursements attendus.</p>`
);

// ══════════════════════════════════════════════════════════
// 9. JS — ajouter computed tresoActuelleMois + prorataSemainesRestantes
// ══════════════════════════════════════════════════════════
replace('JS: add tresoActuelleMois + prorataSemainesRestantes after budgetConsoRestant',
  `                    const budgetConsoRestant = computed(() => {
                        calculationTick.value; const semRest = Number((soldesInitiaux.value || {}).semainesRestantes || 0);
                        const dActuelle = donneesAnnuelles.value[soldesInitiaux.value.anneeActuelle];
                        if (!dActuelle) return 0;
                        return Object.values(dActuelle.chargesVariables || {}).filter(c => c?.periode === 'semaine').reduce((acc, curr) => acc + (Number(curr?.valeur||0)*semRest), 0);
                    });`,
  `                    const budgetConsoRestant = computed(() => {
                        calculationTick.value; const semRest = Number((soldesInitiaux.value || {}).semainesRestantes || 0);
                        const dActuelle = donneesAnnuelles.value[soldesInitiaux.value.anneeActuelle];
                        if (!dActuelle) return 0;
                        return Object.values(dActuelle.chargesVariables || {}).filter(c => c?.periode === 'semaine').reduce((acc, curr) => acc + (Number(curr?.valeur||0)*semRest), 0);
                    });

                    // v22.30 — Trésorerie actuelle du mois (entrées cochées − sorties cochées)
                    const tresoActuelleMois = computed(() => {
                        calculationTick.value;
                        const an = soldesInitiaux.value.anneeActuelle;
                        const dActuelle = donneesAnnuelles.value[an];
                        if (!dActuelle) return 0;
                        // Entrées cochées
                        let entrees = 0;
                        Object.values(dActuelle.revenus || {}).forEach(rev => {
                            const base = Number(rev.base || 0);
                            if (isItemPaid(rev, base)) entrees += base;
                        });
                        // Sorties cochées
                        let sorties = 0;
                        Object.values(dActuelle.chargesFixes || {}).forEach(f => {
                            const due = getDueFixe(f, an);
                            if (isItemPaid(f, due)) sorties += due;
                        });
                        Object.values(dActuelle.chargesVariables || {}).filter(c => c?.periode === 'mois').forEach(cat => {
                            (cat.details || []).forEach(f => { if (isItemPaid(f, Number(f.montant || 0))) sorties += Number(f.montant || 0); });
                        });
                        getDepensesMois(soldesInitiaux.value.moisActuel, an).forEach(dep => {
                            const m = Number(dep.montant || 0);
                            if (m > 0 && isItemPaid(dep, m)) sorties += m;
                        });
                        return entrees - sorties;
                    });
                    // Entrées cochées seules (pour affichage dans checklist revenus)
                    const tresoEntrees = computed(() => {
                        calculationTick.value;
                        const an = soldesInitiaux.value.anneeActuelle;
                        const dActuelle = donneesAnnuelles.value[an];
                        if (!dActuelle) return 0;
                        let entrees = 0;
                        Object.values(dActuelle.revenus || {}).forEach(rev => {
                            const base = Number(rev.base || 0);
                            if (isItemPaid(rev, base)) entrees += base;
                        });
                        return entrees;
                    });
                    // Prorata tréso / semaines restantes
                    const prorataSemainesRestantes = computed(() => {
                        const sem = Number((soldesInitiaux.value || {}).semainesRestantes || 0);
                        if (!sem) return null;
                        return tresoActuelleMois.value / sem;
                    });`
);

// ══════════════════════════════════════════════════════════
// 10. RETURN — exporter les nouveaux computed
// ══════════════════════════════════════════════════════════
replace('return: add tresoActuelleMois, tresoEntrees, prorataSemainesRestantes',
  `budgetConsoRestant, elementsDuMoisPayes, elementsDuMoisTotal,`,
  `budgetConsoRestant, tresoActuelleMois, tresoEntrees, prorataSemainesRestantes, elementsDuMoisPayes, elementsDuMoisTotal,`
);

// ══════════════════════════════════════════════════════════
// WRITE
// ══════════════════════════════════════════════════════════
writeFileSync(FILE, html, 'utf8');

console.log('\n=== RAPPORT ===');
log.forEach(l => console.log(l));
console.log(`\nFinal size: ${html.length} chars | ${html.split('\n').length} lines`);
