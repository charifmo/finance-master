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
// ██ Op 1 : Ajouter pilotageViewedCycle + computeds (après moisBudgetaire)
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_MOIS_BUDGETAIRE = `                    const moisBudgetaire = computed(() => ({
                        mois: _cyclePaieInfo.value.prochainMois,
                        an: _cyclePaieInfo.value.prochainAn,
                    }));
                    // Label du cycle actuel ex: "27 Mai → 26 Juin"
                    const cycleLabel = computed(() => {`;
const NEW_MOIS_BUDGETAIRE = `                    const moisBudgetaire = computed(() => ({
                        mois: _cyclePaieInfo.value.prochainMois,
                        an: _cyclePaieInfo.value.prochainAn,
                    }));
                    // v23.30 Retro-Clean : navigation des cycles passés pour régularisation
                    const pilotageViewedCycle = ref(null); // "5-2026" = Mai 2026, null = cycle actuel
                    const pilotageViewedMois = computed(() =>
                        pilotageViewedCycle.value ? Number(pilotageViewedCycle.value.split('-')[0]) : moisBudgetaire.value.mois
                    );
                    const pilotageViewedAn = computed(() =>
                        pilotageViewedCycle.value ? Number(pilotageViewedCycle.value.split('-')[1]) : moisBudgetaire.value.an
                    );
                    const isPilotageRetro = computed(() => pilotageViewedCycle.value !== null);
                    const pilotageCycleLabel = computed(() => {
                        if (!pilotageViewedCycle.value) return cycleLabel.value;
                        const cy = cyclesDisponibles.value.find(c => c.key === pilotageViewedCycle.value);
                        return cy ? cy.nom : cycleLabel.value;
                    });
                    // Label du cycle actuel ex: "27 Mai → 26 Juin"
                    const cycleLabel = computed(() => {`;
check('Op1 pilotageViewedCycle + computeds', html.includes(OLD_MOIS_BUDGETAIRE));
html = html.replace(OLD_MOIS_BUDGETAIRE, NEW_MOIS_BUDGETAIRE);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 2 : Insérer navigateur de cycles + bannière ⚠️ dans le Pilotage
//           Ancre : entre le bloc jourDePaie et la Checklist
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_AFTER_JOURDEPAY = `                        </div>

                        <!-- Checklist Revenus + Dépenses — v22.30 -->
                        <div class="space-y-4">`;
const NEW_AFTER_JOURDEPAY = `                        </div>

                        <!-- v23.30 : Navigateur de cycles pour régularisation rétro -->
                        <div class="flex items-center gap-1.5 bg-slate-900/40 rounded-xl px-3 py-2 border border-slate-700/60">
                            <button @click="pilotageViewedCycle = null"
                                :class="pilotageViewedCycle === null ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white'"
                                class="text-[9px] font-black px-2.5 py-1.5 rounded-lg transition-all whitespace-nowrap shrink-0">🗓️ Actuel</button>
                            <div class="flex gap-1 overflow-x-auto flex-1" style="scrollbar-width:thin">
                                <button v-for="cy in cyclesDisponibles" :key="cy.key"
                                    @click="pilotageViewedCycle = cy.key"
                                    :class="pilotageViewedCycle === cy.key ? 'bg-amber-500 text-white ring-2 ring-amber-300' : 'bg-slate-700 text-slate-400 hover:text-amber-300 hover:bg-slate-600'"
                                    class="text-[9px] font-black px-2 py-1.5 rounded-lg transition-all whitespace-nowrap shrink-0">
                                    {{ cy.nom }}
                                </button>
                            </div>
                        </div>
                        <!-- Bannière Mode Régularisation -->
                        <div v-if="isPilotageRetro" class="flex items-center gap-3 bg-amber-900/20 border border-amber-500/40 rounded-xl px-4 py-3">
                            <span class="text-base shrink-0">⚠️</span>
                            <div class="flex-1 min-w-0">
                                <p class="text-amber-300 font-black text-[10px] uppercase tracking-widest">Mode Régularisation</p>
                                <p class="text-amber-200/60 text-[9px] mt-0.5">Vous modifiez un cycle passé. Les changements impacteront les soldes suivants.</p>
                            </div>
                            <button @click="pilotageViewedCycle = null" class="text-[9px] font-black text-amber-400 bg-amber-900/40 px-2 py-1 rounded-lg hover:bg-amber-800/50 transition-all whitespace-nowrap shrink-0">Cycle actuel</button>
                        </div>

                        <!-- Checklist Revenus + Dépenses — v22.30 -->
                        <div class="space-y-4">`;
check('Op2 navigateur + bannière Pilotage', html.includes(OLD_AFTER_JOURDEPAY));
html = html.replace(OLD_AFTER_JOURDEPAY, NEW_AFTER_JOURDEPAY);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 3 : Checklist header — utiliser pilotageCycleLabel au lieu de cycleLabel
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_CHECKLIST_HEADER = `                                        <span class="text-sm font-black uppercase tracking-widest text-white">Checklist — {{ cycleLabel }}</span>`;
const NEW_CHECKLIST_HEADER = `                                        <span class="text-sm font-black uppercase tracking-widest text-white">Checklist — {{ pilotageCycleLabel }}</span>`;
check('Op3 checklist header label', html.includes(OLD_CHECKLIST_HEADER));
html = html.replace(OLD_CHECKLIST_HEADER, NEW_CHECKLIST_HEADER);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 4 : Flux Exceptionnels — utiliser pilotageViewedMois/An pour getDepensesMois
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_FLUX_EXC = `                                    <div v-if="getDepensesMois(moisBudgetaire.mois, moisBudgetaire.an).length > 0">
                                        <p class="text-[9px] text-red-400 font-black uppercase tracking-widest mb-2 border-b border-red-900/50 pb-1 mt-2">⚠️ Flux Exceptionnels — {{ cycleLabel }}</p>
                                        <div class="space-y-1.5">
                                            <div v-for="dep in getDepensesMois(moisBudgetaire.mois, moisBudgetaire.an)" :key="'dep'+dep.id" class="flex items-center justify-between p-3 bg-slate-900/90 rounded-xl group border border-slate-700 hover:border-red-500 transition-all">`;
const NEW_FLUX_EXC = `                                    <div v-if="getDepensesMois(pilotageViewedMois, pilotageViewedAn).length > 0">
                                        <p class="text-[9px] text-red-400 font-black uppercase tracking-widest mb-2 border-b border-red-900/50 pb-1 mt-2">⚠️ Flux Exceptionnels — {{ pilotageCycleLabel }}</p>
                                        <div class="space-y-1.5">
                                            <div v-for="dep in getDepensesMois(pilotageViewedMois, pilotageViewedAn)" :key="'dep'+dep.id" class="flex items-center justify-between p-3 bg-slate-900/90 rounded-xl group border border-slate-700 hover:border-red-500 transition-all">`;
check('Op4 getDepensesMois → pilotageViewedMois/An', html.includes(OLD_FLUX_EXC));
html = html.replace(OLD_FLUX_EXC, NEW_FLUX_EXC);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 5 : return statement — exposer les nouveaux éléments v23.30
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_RETURN_CYCLE = `releveActiveCycle, cyclesDisponibles, historiqueCycles, viewedCycleKey, cloturerCycle,`;
const NEW_RETURN_CYCLE = `releveActiveCycle, cyclesDisponibles, historiqueCycles, viewedCycleKey, cloturerCycle,
                        // v23.30 Retro-Clean
                        pilotageViewedCycle, pilotageViewedMois, pilotageViewedAn, isPilotageRetro, pilotageCycleLabel,`;
check('Op5 return statement v23.30', html.includes(OLD_RETURN_CYCLE));
html = html.replace(OLD_RETURN_CYCLE, NEW_RETURN_CYCLE);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 6 : Changelog
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_CHANGELOG_23 = `const CHANGELOG = [\n                        { version: "23.20 Cycle-Ledger",`;
const NEW_CHANGELOG_23 = `const CHANGELOG = [\n                        { version: "23.30 Retro-Clean", date: "2026-05-29 — Navigation rétro-cycles", changes: [\n                            "CHANTIER 1 : Pas de verrou sur les cycles passés — checkboxes toujours actives.",\n                            "CHANTIER 2 : Navigateur de cycles scrollable dans le Pilotage (pilotageViewedCycle). Flux Exceptionnels filtrés par le cycle sélectionné.",\n                            "CHANTIER 3 : Bannière ⚠️ Mode Régularisation (orange) remplace tout verrou rouge. handleDataChange() déclenche le recalcul en cascade."\n                        ] },\n                        { version: "23.20 Cycle-Ledger",`;
check('Op6 changelog', html.includes(OLD_CHANGELOG_23));
html = html.replace(OLD_CHANGELOG_23, NEW_CHANGELOG_23);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 7 : Version bump → 23.30 Retro-Clean
// ═══════════════════════════════════════════════════════════════════════════════
check('Op7 version string', html.includes('"23.20 Cycle-Ledger"'));
html = html.replace('"23.20 Cycle-Ledger"', '"23.30 Retro-Clean"');

writeFileSync(filePath, html, 'utf8');
console.log(`\n🎉 Done — ${ops}/7 ops. Fichier écrit.`);
