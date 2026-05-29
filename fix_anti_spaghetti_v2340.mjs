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
// ██ Op 1 : Inline Relevé — remplacer timeline scrollable par sélecteurs Année + Cycle
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_INLINE_TIMELINE = `                                    <!-- v23.20 : Timeline Cycles (remplace filtres Années+Mois) -->
                                    <div class="flex items-center gap-1.5 w-full">
                                        <button @click.stop="releveActiveCycle = null; releveAnneesFiltres = []; releveMoisFiltres = []"
                                            :class="releveActiveCycle === null ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'"
                                            class="text-[9px] font-black px-2 py-1.5 rounded-lg transition-all whitespace-nowrap shrink-0">Tout</button>
                                        <div class="flex gap-1 overflow-x-auto pb-0.5 flex-1" style="scrollbar-width:thin">
                                            <button v-for="cy in cyclesDisponibles" :key="cy.key" @click.stop="releveActiveCycle = cy.key"
                                                :class="releveActiveCycle === cy.key ? 'bg-indigo-600 text-white ring-2 ring-indigo-300' : 'bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-700'"
                                                class="text-[9px] font-black px-2 py-1.5 rounded-lg transition-all whitespace-nowrap shrink-0">
                                                {{ cy.label }}
                                            </button>
                                        </div>
                                    </div>`;
const NEW_INLINE_TIMELINE = `                                    <!-- v23.40 : Sélecteurs Année + Cycle (remplace timeline scrollable) -->
                                    <div class="flex items-center gap-3 flex-wrap w-full">
                                        <div class="flex items-center gap-1.5">
                                            <label class="text-[9px] font-black text-gray-500 uppercase tracking-widest">Année</label>
                                            <select :value="releveActiveCycle ? ((cyclesDisponibles.find(c => c.key === releveActiveCycle) || {}).an || '') : (releveAnneesFiltres[0] || '')"
                                                @change="releveActiveCycle = null; releveAnneesFiltres = $event.target.value ? [Number($event.target.value)] : []; releveMoisFiltres = []"
                                                class="text-xs font-bold bg-white border border-gray-200 rounded-lg px-2 py-1 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer">
                                                <option value="">Toutes</option>
                                                <option v-for="a in releveAnneesDisponibles" :key="a" :value="a">{{ a }}</option>
                                            </select>
                                        </div>
                                        <div class="flex items-center gap-1.5">
                                            <label class="text-[9px] font-black text-gray-500 uppercase tracking-widest">Période</label>
                                            <select :value="releveActiveCycle || ''"
                                                @change="releveActiveCycle = $event.target.value || null; releveAnneesFiltres = []; releveMoisFiltres = []"
                                                class="text-xs font-bold bg-white border border-gray-200 rounded-lg px-2 py-1 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer">
                                                <option value="">Tous les cycles</option>
                                                <option v-for="cy in cyclesDisponibles" :key="cy.key" :value="cy.key">{{ cy.nom }}</option>
                                            </select>
                                        </div>
                                        <span v-if="releveActiveCycle" class="text-[9px] text-indigo-500 font-bold">
                                            {{ (cyclesDisponibles.find(c => c.key === releveActiveCycle) || {}).label }}
                                        </span>
                                        <button v-if="releveActiveCycle || releveAnneesFiltres.length" @click.stop="releveActiveCycle = null; releveAnneesFiltres = []; releveMoisFiltres = []"
                                            class="text-[9px] font-bold text-gray-400 hover:text-gray-600 ml-auto">✕ Tout</button>
                                    </div>`;
check('Op1 inline timeline → selects', html.includes(OLD_INLINE_TIMELINE));
html = html.replace(OLD_INLINE_TIMELINE, NEW_INLINE_TIMELINE);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 2 : Modal Relevé — remplacer timeline scrollable par sélecteurs
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_MODAL_TIMELINE = `                            <!-- v23.20 : Timeline Cycles dans la modale -->
                            <div class="flex items-center gap-1.5 max-w-xs">
                                <button @click="releveActiveCycle = null; releveAnneesFiltres = []; releveMoisFiltres = []"
                                    :class="releveActiveCycle === null ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'"
                                    class="text-[9px] font-black px-2 py-1.5 rounded-lg transition-all whitespace-nowrap shrink-0">Tout</button>
                                <div class="flex gap-1 overflow-x-auto" style="scrollbar-width:thin;max-width:220px">
                                    <button v-for="cy in cyclesDisponibles" :key="cy.key" @click="releveActiveCycle = cy.key"
                                        :class="releveActiveCycle === cy.key ? 'bg-indigo-600 text-white ring-2 ring-indigo-300' : 'bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-700'"
                                        class="text-[9px] font-black px-2 py-1.5 rounded-lg transition-all whitespace-nowrap shrink-0">
                                        {{ cy.label }}
                                    </button>
                                </div>
                            </div>`;
const NEW_MODAL_TIMELINE = `                            <!-- v23.40 : Sélecteurs Année + Cycle dans la modale -->
                            <div class="flex items-center gap-2">
                                <select :value="releveActiveCycle ? ((cyclesDisponibles.find(c => c.key === releveActiveCycle) || {}).an || '') : (releveAnneesFiltres[0] || '')"
                                    @change="releveActiveCycle = null; releveAnneesFiltres = $event.target.value ? [Number($event.target.value)] : []; releveMoisFiltres = []"
                                    class="text-xs font-bold bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                                    <option value="">Toutes années</option>
                                    <option v-for="a in releveAnneesDisponibles" :key="a" :value="a">{{ a }}</option>
                                </select>
                                <select :value="releveActiveCycle || ''"
                                    @change="releveActiveCycle = $event.target.value || null; releveAnneesFiltres = []; releveMoisFiltres = []"
                                    class="text-xs font-bold bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                                    <option value="">Tous les cycles</option>
                                    <option v-for="cy in cyclesDisponibles" :key="cy.key" :value="cy.key">{{ cy.nom }}</option>
                                </select>
                            </div>`;
check('Op2 modal timeline → selects', html.includes(OLD_MODAL_TIMELINE));
html = html.replace(OLD_MODAL_TIMELINE, NEW_MODAL_TIMELINE);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 3 : Pilotage — remplacer navigateur scrollable par sélecteur compact
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_PILOTAGE_NAV = `                        <!-- v23.30 : Navigateur de cycles pour régularisation rétro -->
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
                        </div>`;
const NEW_PILOTAGE_NAV = `                        <!-- v23.40 : Sélecteur de cycle compact -->
                        <div class="flex items-center gap-3 bg-slate-900/40 rounded-xl px-4 py-2.5 border border-slate-700/60">
                            <span class="text-[9px] font-black uppercase tracking-widest text-slate-400 shrink-0">📅 Cycle</span>
                            <select :value="pilotageViewedCycle || ''"
                                @change="pilotageViewedCycle = $event.target.value || null"
                                class="flex-1 bg-slate-800 text-slate-200 text-xs font-bold border border-slate-600 rounded-lg px-2 py-1.5 focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer">
                                <option value="">🗓️ Cycle actuel</option>
                                <option v-for="cy in cyclesDisponibles" :key="cy.key" :value="cy.key">{{ cy.nom }}</option>
                            </select>
                            <span v-if="isPilotageRetro" class="text-[9px] font-bold text-amber-400 shrink-0">⚠️ Rétro</span>
                        </div>`;
check('Op3 pilotage navigator → select', html.includes(OLD_PILOTAGE_NAV));
html = html.replace(OLD_PILOTAGE_NAV, NEW_PILOTAGE_NAV);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 4 : Inline journal — renommer colonnes thead + border-collapse
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_INLINE_THEAD = `                                <table v-if="releveCompte.length > 0" class="w-full min-w-[500px] text-sm">
                                    <thead class="bg-gray-50 sticky top-0 z-10">
                                        <tr>
                                            <th class="p-2 text-left font-black text-[10px] uppercase tracking-widest text-gray-500">Mois</th>
                                            <th v-if="releveShowCompte" class="p-2 text-left font-black text-[10px] uppercase tracking-widest text-gray-500">Compte</th>
                                            <th class="p-2 text-left font-black text-[10px] uppercase tracking-widest text-gray-500">Libellé</th>
                                            <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-red-500">Débit</th>
                                            <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-green-600">Crédit</th>
                                            <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-gray-500">Solde</th>
                                        </tr>
                                    </thead>`;
const NEW_INLINE_THEAD = `                                <table v-if="releveCompte.length > 0" class="w-full min-w-[500px] text-sm border-collapse">
                                    <thead class="bg-gray-50 sticky top-0 z-10">
                                        <tr>
                                            <th class="p-2 text-left font-black text-[10px] uppercase tracking-widest text-gray-500 w-20">Période</th>
                                            <th v-if="releveShowCompte" class="p-2 text-left font-black text-[10px] uppercase tracking-widest text-gray-500">Compte</th>
                                            <th class="p-2 text-left font-black text-[10px] uppercase tracking-widest text-gray-500">Libellé</th>
                                            <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-green-600 w-24">Entrant</th>
                                            <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-red-500 w-24">Sortant</th>
                                            <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-gray-500 w-24">Solde</th>
                                        </tr>
                                    </thead>`;
check('Op4 inline journal thead rename', html.includes(OLD_INLINE_THEAD));
html = html.replace(OLD_INLINE_THEAD, NEW_INLINE_THEAD);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 5 : Inline journal — inverser colonnes Entrant / Sortant dans le tbody
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_INLINE_TBODY = `                                            <td class="p-2 text-right font-bold text-red-500 text-xs tabular-nums">{{ e.type === 'debit' ? formatMAD(e.montant) : '' }}</td>
                                            <td class="p-2 text-right font-bold text-green-600 text-xs tabular-nums">{{ e.type === 'credit' ? formatMAD(e.montant) : (e.type === 'initial' && e.montant ? formatMAD(e.montant) : '') }}</td>`;
const NEW_INLINE_TBODY = `                                            <td class="p-2 text-right font-bold text-green-600 text-xs tabular-nums">{{ e.type === 'credit' ? formatMAD(e.montant) : (e.type === 'initial' && e.montant ? formatMAD(e.montant) : '') }}</td>
                                            <td class="p-2 text-right font-bold text-red-500 text-xs tabular-nums">{{ e.type === 'debit' ? formatMAD(e.montant) : '' }}</td>`;
check('Op5 inline journal tbody swap', html.includes(OLD_INLINE_TBODY));
html = html.replace(OLD_INLINE_TBODY, NEW_INLINE_TBODY);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 6 : Modal journal — renommer colonnes thead + border-collapse
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_MODAL_THEAD = `                    <table v-if="releveCompte.length > 0" class="w-full min-w-[500px] text-sm">
                        <thead class="bg-gray-50 sticky top-0 z-10">
                            <tr>
                                <th class="p-2 text-left font-black text-[10px] uppercase tracking-widest text-gray-500">Mois</th>
                                <th v-if="releveShowCompte" class="p-2 text-left font-black text-[10px] uppercase tracking-widest text-gray-500">Compte</th>
                                <th class="p-2 text-left font-black text-[10px] uppercase tracking-widest text-gray-500">Libellé</th>
                                <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-gray-500">Débit</th>
                                <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-gray-500">Crédit</th>
                                <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-gray-500">Solde</th>
                            </tr>
                        </thead>`;
const NEW_MODAL_THEAD = `                    <table v-if="releveCompte.length > 0" class="w-full min-w-[500px] text-sm border-collapse">
                        <thead class="bg-gray-50 sticky top-0 z-10">
                            <tr>
                                <th class="p-2 text-left font-black text-[10px] uppercase tracking-widest text-gray-500 w-20">Période</th>
                                <th v-if="releveShowCompte" class="p-2 text-left font-black text-[10px] uppercase tracking-widest text-gray-500">Compte</th>
                                <th class="p-2 text-left font-black text-[10px] uppercase tracking-widest text-gray-500">Libellé</th>
                                <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-green-600 w-24">Entrant</th>
                                <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-red-500 w-24">Sortant</th>
                                <th class="p-2 text-right font-black text-[10px] uppercase tracking-widest text-gray-500 w-24">Solde</th>
                            </tr>
                        </thead>`;
check('Op6 modal journal thead rename', html.includes(OLD_MODAL_THEAD));
html = html.replace(OLD_MODAL_THEAD, NEW_MODAL_THEAD);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 7 : Modal journal — inverser colonnes + ajouter tabular-nums dans le tbody
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_MODAL_TBODY = `                                <td class="p-2 text-right font-bold text-red-500 text-xs">{{ e.type === 'debit' ? formatMAD(e.montant) : '' }}</td>
                                <td class="p-2 text-right font-bold text-green-600 text-xs">{{ e.type === 'credit' ? formatMAD(e.montant) : (e.type === 'initial' && e.montant ? formatMAD(e.montant) : '') }}</td>`;
const NEW_MODAL_TBODY = `                                <td class="p-2 text-right font-bold text-green-600 text-xs tabular-nums">{{ e.type === 'credit' ? formatMAD(e.montant) : (e.type === 'initial' && e.montant ? formatMAD(e.montant) : '') }}</td>
                                <td class="p-2 text-right font-bold text-red-500 text-xs tabular-nums">{{ e.type === 'debit' ? formatMAD(e.montant) : '' }}</td>`;
check('Op7 modal journal tbody swap', html.includes(OLD_MODAL_TBODY));
html = html.replace(OLD_MODAL_TBODY, NEW_MODAL_TBODY);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 8 : Ajouter soldeInitialCycleActuel computed (Clean Cut)
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_AFTER_ELEMENTS_TOTAL = `                        count += getDepensesMois((soldesInitiaux.value || {}).moisActuel || 4, (soldesInitiaux.value || {}).anneeActuelle || 2026).length;
                        return count;
                    });

                    const getMonthlyVariableValue`;
const NEW_AFTER_ELEMENTS_TOTAL = `                        count += getDepensesMois((soldesInitiaux.value || {}).moisActuel || 4, (soldesInitiaux.value || {}).anneeActuelle || 2026).length;
                        return count;
                    });

                    // v23.40 Clean Cut : Solde Initial du Cycle = Solde réel − revenus encaissés + charges payées
                    const soldeInitialCycleActuel = computed(() => {
                        calculationTick.value;
                        const base = tresoActuelleCourante.value;
                        const an = moisBudgetaire.value.an;
                        const mois = moisBudgetaire.value.mois;
                        const dAnnee = donneesAnnuelles.value[an];
                        if (!dAnnee) return base;
                        let paidRev = 0, paidChg = 0;
                        Object.values(dAnnee.revenus || {}).forEach(r => {
                            const amt = getPaidAmount(r, Number(r.base || 0));
                            if (amt > 0) paidRev += amt;
                        });
                        Object.values(dAnnee.chargesFixes || {}).forEach(f => {
                            const amt = getPaidAmount(f, Number(f.valeur || 0));
                            if (amt > 0) paidChg += amt;
                        });
                        Object.values(dAnnee.chargesVariables || {}).forEach(cv => {
                            (cv.details || []).forEach(d => {
                                const amt = getPaidAmount(d, Number(d.montant || 0));
                                if (amt > 0) paidChg += amt;
                            });
                        });
                        getDepensesMois(mois, an).forEach(dep => {
                            const amt = getPaidAmount(dep, Number(dep.montant || 0));
                            if (amt > 0) paidChg += amt;
                        });
                        return Math.round((base - paidRev + paidChg) * 100) / 100;
                    });

                    const getMonthlyVariableValue`;
check('Op8 soldeInitialCycleActuel computed', html.includes(OLD_AFTER_ELEMENTS_TOTAL));
html = html.replace(OLD_AFTER_ELEMENTS_TOTAL, NEW_AFTER_ELEMENTS_TOTAL);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 9 : Afficher la Base Cycle (Clean Cut) dans le bloc jourDePaie du Pilotage
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_JOURDEPAY_INFO = `                            <div class="ml-auto text-right">
                                <p class="text-[10px] font-black uppercase tracking-widest text-emerald-400">⏳ J−{{ joursRestantsAvantPaie }} avant la prochaine paie</p>
                                <p class="text-[9px] text-slate-500 mt-0.5 font-bold">Cycle : {{ cycleLabel }}</p>
                            </div>`;
const NEW_JOURDEPAY_INFO = `                            <div class="ml-auto text-right">
                                <p class="text-[10px] font-black uppercase tracking-widest text-emerald-400">⏳ J−{{ joursRestantsAvantPaie }} avant la prochaine paie</p>
                                <p class="text-[9px] text-slate-500 mt-0.5 font-bold">Cycle : {{ cycleLabel }}</p>
                                <p class="text-[9px] text-blue-400 mt-0.5 font-black">🏦 Base cycle : {{ formatMAD(soldeInitialCycleActuel) }}</p>
                            </div>`;
check('Op9 display soldeInitialCycleActuel in Pilotage', html.includes(OLD_JOURDEPAY_INFO));
html = html.replace(OLD_JOURDEPAY_INFO, NEW_JOURDEPAY_INFO);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 10 : return statement — exposer soldeInitialCycleActuel
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_RETURN_ELEMENTS = `                        // v23.10 Prorata-T0
                        prorataVariableT0, provisionsFuturesT0, margeT0, elementsDuMoisPayes, elementsDuMoisTotal,`;
const NEW_RETURN_ELEMENTS = `                        // v23.10 Prorata-T0
                        prorataVariableT0, provisionsFuturesT0, margeT0, elementsDuMoisPayes, elementsDuMoisTotal, soldeInitialCycleActuel,`;
check('Op10 return soldeInitialCycleActuel', html.includes(OLD_RETURN_ELEMENTS));
html = html.replace(OLD_RETURN_ELEMENTS, NEW_RETURN_ELEMENTS);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 11 : Changelog
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_CHANGELOG_2340 = `const CHANGELOG = [\n                        { version: "23.30 Retro-Clean",`;
const NEW_CHANGELOG_2340 = `const CHANGELOG = [\n                        { version: "23.40 Anti-Spaghetti", date: "2026-05-29 — UI epuree + moteur Clean Cut", changes: [\n                            "CHANTIER 1 : Suppression des timelines scrollables. Deux selecteurs propres Annee + Periode dans le Releve (inline et modal). Selecteur compact dans le Pilotage.",\n                            "CHANTIER 2 : Moteur Clean Cut — soldeInitialCycleActuel = solde reel banque − revenus coches + charges cochees. Affiche dans le Pilotage (Base cycle).",\n                            "CHANTIER 3 : Journal repare — colonnes renommees Periode/Libelle/Entrant(vert)/Sortant(rouge)/Solde. border-collapse + tabular-nums. Entrant avant Sortant."\n                        ] },\n                        { version: "23.30 Retro-Clean",`;
check('Op11 changelog', html.includes(OLD_CHANGELOG_2340));
html = html.replace(OLD_CHANGELOG_2340, NEW_CHANGELOG_2340);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 12 : Version bump → 23.40 Anti-Spaghetti
// ═══════════════════════════════════════════════════════════════════════════════
check('Op12 version string', html.includes('const CURRENT_VERSION = "23.30 Retro-Clean"'));
html = html.replace('const CURRENT_VERSION = "23.30 Retro-Clean"', 'const CURRENT_VERSION = "23.40 Anti-Spaghetti"');

writeFileSync(filePath, html, 'utf8');
console.log(`\n🎉 Done — ${ops}/12 ops. Fichier écrit.`);
