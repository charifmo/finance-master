/**
 * fix_pilotage_align_v2570.mjs
 * v25.70 Pilotage-Align  (demande utilisateur intitulée "V25.50 Pilotage-Align" ;
 *   numérotation poursuivie en 25.70 car 25.50/25.60 existent déjà — version monotone)
 *
 * CHANTIER 1 : Alignement des règles temporelles dans le Pilotage.
 *   Les éléments suspendus ce mois-ci NE sont plus EXCLUS de la checklist : ils
 *   restent visibles, montant forcé à 0, avec un badge ⏸️ Suspendu ce mois + opacité.
 *
 * CHANTIER 2 : Épargne cochable dans la checklist Pilotage (desktop).
 *   - Nouveau computed epargneBudgetairePilotage (cycle courant)
 *   - Bloc HTML 🎯 Épargne avec checkbox toggleItemPaid (immutabilité v25.40 respectée)
 *   - _mkLegs : une épargne pointée disparaît des projections futures (mode 'remaining')
 */

import { readFileSync, writeFileSync } from 'fs';

const FILE = 'C:/Users/HP/finance/index.html';
let html = readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n');

let opCount = 0;

function check(label, needle) {
    if (!html.includes(needle)) {
        console.error(`\n❌ ANCHOR NOT FOUND: ${label}`);
        console.error(`   Preview: ${JSON.stringify(needle.slice(0, 200))}`);
        process.exit(1);
    }
}

function replace(label, from, to) {
    check(label, from);
    const before = html;
    html = html.split(from).join(to);
    if (html === before) {
        console.error(`\n❌ NO CHANGE: ${label}`);
        process.exit(1);
    }
    opCount++;
    console.log(`✅ Op ${opCount} — ${label}`);
}

// ── Op 1 : revenusBudgetairesTries — ne plus exclure les revenus suspendus ────
replace(
    'Op1 - revenusBudgetairesTries : afficher les revenus suspendus (0)',
    `                        return Object.values(d.revenus || {})
                            .filter(r => getDueRevenu(r, mb.an) > 0)
                            .slice().sort((a, b) => (a.jourPrevu || 99) - (b.jourPrevu || 99));`,
    `                        // v25.70 Pilotage-Align : ne plus EXCLURE les revenus suspendus —
                        // ils restent visibles dans la checklist (montant forcé à 0 par getDueRevenu)
                        return Object.values(d.revenus || {})
                            .slice().sort((a, b) => (a.jourPrevu || 99) - (b.jourPrevu || 99));`
);

// ── Op 2 : nouveau computed epargneBudgetairePilotage ─────────────────────────
replace(
    'Op2 - computed epargneBudgetairePilotage',
    `                    // v24.50 Pilotage-Sync : cycle-aware — utilise pilotageViewedAn en mode retro
                    // filtre les charges avec jourPrevu >= jourDePaie (appartiennent au cycle suivant)
                    const chargesFixesBudgetairesTriees = computed(() => {`,
    `                    // v25.70 Pilotage-Align : objectifs d'épargne pointables dans la checklist (cycle courant)
                    const epargneBudgetairePilotage = computed(() => {
                        calculationTick.value;
                        const an = isCyclePasse.value ? pilotageViewedAn.value : moisBudgetaire.value.an;
                        const d = donneesAnnuelles.value[an];
                        if (!d) return [];
                        const arr = Array.isArray(d.epargne) ? d.epargne : Object.values(d.epargne || {});
                        return arr.slice().sort((a, b) => (a.jourPrevu || 99) - (b.jourPrevu || 99));
                    });

                    // v24.50 Pilotage-Sync : cycle-aware — utilise pilotageViewedAn en mode retro
                    // filtre les charges avec jourPrevu >= jourDePaie (appartiennent au cycle suivant)
                    const chargesFixesBudgetairesTriees = computed(() => {`
);

// ── Op 3 : _mkLegs — une épargne pointée disparaît du futur ───────────────────
replace(
    'Op3 - _mkLegs épargne honore isItemPaid (mode remaining)',
    `                            epArr.forEach(e => {
                                const v = _effVal(e, e.valeur, m); if (v <= 0) return;
                                bump(_normKey(e.sourceCompte || 'courant'), 'epOut', v);
                                bump(e.linkedAccountId ? _normKey(e.linkedAccountId) : ('ep_' + e.id), 'epIn', v);
                            });`,
    `                            epArr.forEach(e => {
                                const v = _effVal(e, e.valeur, m); if (v <= 0) return;
                                // v25.70 Pilotage-Align : épargne pointée (cochée) → retirée du futur (mode 'remaining')
                                if (mode !== 'full' && isItemPaid(e, v)) return;
                                bump(_normKey(e.sourceCompte || 'courant'), 'epOut', v);
                                bump(e.linkedAccountId ? _normKey(e.linkedAccountId) : ('ep_' + e.id), 'epIn', v);
                            });`
);

// ── Op 4 : Desktop — ligne revenu (suspendu vs actif) ─────────────────────────
replace(
    'Op4 - Desktop revenus : état suspendu à 0 + badge',
    `                                    <div v-for="(rev, key) in revenusBudgetairesTries" :key="'rev_' + key"
                                         class="flex items-center justify-between p-3 bg-slate-900/90 rounded-xl group border border-slate-700 hover:border-green-500 transition-all">
                                        <label class="flex items-center gap-3 cursor-pointer flex-1">
                                            <input type="checkbox"
                                                   :checked="isItemPaid(rev, getDueRevenu(rev, moisBudgetaire.an))"
                                                   @change="toggleItemPaid(rev, getDueRevenu(rev, moisBudgetaire.an)); handleDataChange()"
                                                   class="w-5 h-5 rounded border-slate-600 bg-slate-800 text-green-500 focus:ring-green-500 cursor-pointer"/>
                                            <span :class="['text-sm font-bold transition-all', isItemPaid(rev, getDueRevenu(rev, moisBudgetaire.an)) ? 'text-slate-500 line-through' : 'text-slate-200 group-hover:text-green-300']">{{ rev.label }}</span>
                                             <span v-if="isFluxCetteSemaine(rev.jourPrevu) && !isItemPaid(rev, getDueRevenu(rev, moisBudgetaire.an))" class="text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded-full ml-1">⏳ Cette sem.</span>
                                             <span v-if="rev.jourPrevu && !isItemPaid(rev, getDueRevenu(rev, moisBudgetaire.an))" class="text-[9px] text-slate-500 font-bold ml-1">j.{{ rev.jourPrevu }}</span>
                                        </label>
                                        <span :class="['text-sm font-black ml-4', isItemPaid(rev, getDueRevenu(rev, moisBudgetaire.an)) ? 'text-green-400' : 'text-slate-400']">{{ formatMAD(getDueRevenu(rev, moisBudgetaire.an)) }}</span>
                                    </div>`,
    `                                    <div v-for="(rev, key) in revenusBudgetairesTries" :key="'rev_' + key"
                                         :class="['flex items-center justify-between p-3 rounded-xl group border transition-all', getDueRevenu(rev, moisBudgetaire.an) <= 0 ? 'bg-slate-900/40 border-slate-800 opacity-60' : 'bg-slate-900/90 border-slate-700 hover:border-green-500']">
                                        <!-- v25.70 Pilotage-Align : revenu suspendu ce mois → affiché à 0, non cochable -->
                                        <template v-if="getDueRevenu(rev, moisBudgetaire.an) <= 0">
                                            <div class="flex items-center gap-3 flex-1">
                                                <span class="text-sm font-bold text-slate-400">{{ rev.label }}</span>
                                                <span class="text-[9px] font-black bg-slate-700/40 text-slate-400 border border-slate-600/60 px-1.5 py-0.5 rounded-full">⏸️ Suspendu ce mois</span>
                                            </div>
                                            <span class="text-sm font-black ml-4 text-slate-600">{{ formatMAD(0) }}</span>
                                        </template>
                                        <template v-else>
                                            <label class="flex items-center gap-3 cursor-pointer flex-1">
                                                <input type="checkbox"
                                                       :checked="isItemPaid(rev, getDueRevenu(rev, moisBudgetaire.an))"
                                                       @change="toggleItemPaid(rev, getDueRevenu(rev, moisBudgetaire.an)); handleDataChange()"
                                                       class="w-5 h-5 rounded border-slate-600 bg-slate-800 text-green-500 focus:ring-green-500 cursor-pointer"/>
                                                <span :class="['text-sm font-bold transition-all', isItemPaid(rev, getDueRevenu(rev, moisBudgetaire.an)) ? 'text-slate-500 line-through' : 'text-slate-200 group-hover:text-green-300']">{{ rev.label }}</span>
                                                 <span v-if="isFluxCetteSemaine(rev.jourPrevu) && !isItemPaid(rev, getDueRevenu(rev, moisBudgetaire.an))" class="text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded-full ml-1">⏳ Cette sem.</span>
                                                 <span v-if="rev.jourPrevu && !isItemPaid(rev, getDueRevenu(rev, moisBudgetaire.an))" class="text-[9px] text-slate-500 font-bold ml-1">j.{{ rev.jourPrevu }}</span>
                                            </label>
                                            <span :class="['text-sm font-black ml-4', isItemPaid(rev, getDueRevenu(rev, moisBudgetaire.an)) ? 'text-green-400' : 'text-slate-400']">{{ formatMAD(getDueRevenu(rev, moisBudgetaire.an)) }}</span>
                                        </template>
                                    </div>`
);

// ── Op 5 : Desktop — badge ⏸️ Suspendu sur les charges fixes à 0 ──────────────
replace(
    'Op5 - Desktop charges fixes : badge suspendu',
    `                                                    <span :class="['text-sm font-bold transition-all', isItemPaid(f, getDueFixe(f, moisBudgetaire.an)) ? 'text-slate-500 line-through' : 'text-slate-200 group-hover:text-orange-300']">{{ f.label }}</span>
                                                 <span v-if="isFluxCetteSemaine(f.jourPrevu) && !isItemPaid(f, getDueFixe(f, moisBudgetaire.an))" class="text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded-full ml-1">⏳ Cette sem.</span>`,
    `                                                    <span :class="['text-sm font-bold transition-all', isItemPaid(f, getDueFixe(f, moisBudgetaire.an)) ? 'text-slate-500 line-through' : 'text-slate-200 group-hover:text-orange-300']">{{ f.label }}</span>
                                                 <span v-if="getDueFixe(f, moisBudgetaire.an) <= 0" class="text-[9px] font-black bg-slate-700/40 text-slate-400 border border-slate-600/60 px-1.5 py-0.5 rounded-full ml-1">⏸️ Suspendu ce mois</span>
                                                 <span v-if="isFluxCetteSemaine(f.jourPrevu) && !isItemPaid(f, getDueFixe(f, moisBudgetaire.an))" class="text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded-full ml-1">⏳ Cette sem.</span>`
);

// ── Op 6 : Desktop — bloc 🎯 Épargne cochable (avant Flux Exceptionnels) ───────
replace(
    'Op6 - Desktop : bloc Épargne checklist',
    `                                    <div v-if="getDepensesCycle(pilotageViewedMois, pilotageViewedAn).length > 0">
                                        <p class="text-[9px] text-red-400 font-black uppercase tracking-widest mb-2 border-b border-red-900/50 pb-1 mt-2">⚠️ Flux Exceptionnels — {{ pilotageCycleLabel }}</p>`,
    `                                    <div v-if="epargneBudgetairePilotage.length > 0">
                                        <p class="text-[9px] text-purple-400 font-black uppercase tracking-widest mb-2 border-b border-purple-900/50 pb-1 mt-2">🎯 Épargne &amp; Virements</p>
                                        <div class="space-y-1.5">
                                            <div v-for="ep in epargneBudgetairePilotage" :key="'ep'+ep.id"
                                                 :class="['flex items-center justify-between p-3 rounded-xl group border transition-all', getDueFixe(ep, moisBudgetaire.an) <= 0 ? 'bg-slate-900/40 border-slate-800 opacity-60' : 'bg-slate-900/90 border-slate-700 hover:border-purple-500']">
                                                <!-- v25.70 Pilotage-Align : épargne pointable ; suspendue → 0 + badge -->
                                                <template v-if="getDueFixe(ep, moisBudgetaire.an) <= 0">
                                                    <div class="flex items-center gap-3 flex-1">
                                                        <span class="text-sm font-bold text-slate-400">{{ ep.nom || ep.label || 'Épargne' }}</span>
                                                        <span class="text-[9px] font-black bg-slate-700/40 text-slate-400 border border-slate-600/60 px-1.5 py-0.5 rounded-full">⏸️ Suspendu ce mois</span>
                                                    </div>
                                                    <span class="text-sm font-black ml-4 text-slate-600">{{ formatMAD(0) }}</span>
                                                </template>
                                                <template v-else>
                                                    <label class="flex items-center gap-3 cursor-pointer flex-1">
                                                        <input type="checkbox" :checked="isItemPaid(ep, getDueFixe(ep, moisBudgetaire.an))" @change="toggleItemPaid(ep, getDueFixe(ep, moisBudgetaire.an)); handleDataChange()" class="w-5 h-5 rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500 cursor-pointer"/>
                                                        <span :class="['text-sm font-bold transition-all', isItemPaid(ep, getDueFixe(ep, moisBudgetaire.an)) ? 'text-slate-500 line-through' : 'text-slate-200 group-hover:text-purple-300']">{{ ep.nom || ep.label || 'Épargne' }}</span>
                                                        <span v-if="ep.jourPrevu && !isItemPaid(ep, getDueFixe(ep, moisBudgetaire.an))" class="text-[9px] text-slate-500 font-bold ml-1">j.{{ ep.jourPrevu }}</span>
                                                    </label>
                                                    <span :class="['text-sm font-black ml-4', isItemPaid(ep, getDueFixe(ep, moisBudgetaire.an)) ? 'text-purple-400' : 'text-slate-400']">{{ formatMAD(getDueFixe(ep, moisBudgetaire.an)) }}</span>
                                                </template>
                                            </div>
                                        </div>
                                    </div>
                                    <div v-if="getDepensesCycle(pilotageViewedMois, pilotageViewedAn).length > 0">
                                        <p class="text-[9px] text-red-400 font-black uppercase tracking-widest mb-2 border-b border-red-900/50 pb-1 mt-2">⚠️ Flux Exceptionnels — {{ pilotageCycleLabel }}</p>`
);

// ── Op 7 : Mobile — ligne revenu (suspendu vs actif) ──────────────────────────
replace(
    'Op7 - Mobile revenus : état suspendu à 0 + badge',
    `                                        <div v-for="(rev, key) in donneesAnnuelles[soldesInitiaux.anneeActuelle].revenus" :key="'mrev_'+key"
                                             class="flex items-center gap-3 p-2.5 bg-slate-900/80 rounded-xl border border-slate-700">
                                            <input type="checkbox"
                                                   :checked="isItemPaid(rev, getDueRevenu(rev, moisBudgetaire.an))"
                                                   @change="toggleItemPaid(rev, getDueRevenu(rev, moisBudgetaire.an)); handleDataChange()"
                                                   class="w-5 h-5 rounded border-slate-600 bg-slate-800 text-green-500 cursor-pointer shrink-0"/>
                                            <span :class="['text-xs font-bold flex-1', isItemPaid(rev, getDueRevenu(rev, moisBudgetaire.an)) ? 'text-slate-500 line-through' : 'text-slate-200']">{{ rev.label }}</span>
                                            <span :class="['text-xs font-black', isItemPaid(rev, getDueRevenu(rev, moisBudgetaire.an)) ? 'text-green-400' : 'text-slate-500']">{{ formatMAD(getDueRevenu(rev, moisBudgetaire.an)) }}</span>
                                        </div>`,
    `                                        <div v-for="(rev, key) in donneesAnnuelles[soldesInitiaux.anneeActuelle].revenus" :key="'mrev_'+key"
                                             :class="['flex items-center gap-3 p-2.5 rounded-xl border', getDueRevenu(rev, moisBudgetaire.an) <= 0 ? 'bg-slate-900/40 border-slate-800 opacity-60' : 'bg-slate-900/80 border-slate-700']">
                                            <!-- v25.70 Pilotage-Align : revenu suspendu → 0 + badge, non cochable -->
                                            <template v-if="getDueRevenu(rev, moisBudgetaire.an) <= 0">
                                                <span class="text-xs font-bold flex-1 text-slate-400">{{ rev.label }}</span>
                                                <span class="text-[9px] font-black bg-slate-700/40 text-slate-400 border border-slate-600/60 px-1.5 py-0.5 rounded-full">⏸️ Suspendu</span>
                                            </template>
                                            <template v-else>
                                                <input type="checkbox"
                                                       :checked="isItemPaid(rev, getDueRevenu(rev, moisBudgetaire.an))"
                                                       @change="toggleItemPaid(rev, getDueRevenu(rev, moisBudgetaire.an)); handleDataChange()"
                                                       class="w-5 h-5 rounded border-slate-600 bg-slate-800 text-green-500 cursor-pointer shrink-0"/>
                                                <span :class="['text-xs font-bold flex-1', isItemPaid(rev, getDueRevenu(rev, moisBudgetaire.an)) ? 'text-slate-500 line-through' : 'text-slate-200']">{{ rev.label }}</span>
                                                <span :class="['text-xs font-black', isItemPaid(rev, getDueRevenu(rev, moisBudgetaire.an)) ? 'text-green-400' : 'text-slate-500']">{{ formatMAD(getDueRevenu(rev, moisBudgetaire.an)) }}</span>
                                            </template>
                                        </div>`
);

// ── Op 8 : Exposer epargneBudgetairePilotage dans le return de setup() ─────────
replace(
    'Op8 - expose epargneBudgetairePilotage',
    `                        isFluxCetteSemaine, revenusBudgetairesTries, chargesFixesBudgetairesTriees, chargesVarMensuellePilotage,`,
    `                        isFluxCetteSemaine, revenusBudgetairesTries, chargesFixesBudgetairesTriees, chargesVarMensuellePilotage, epargneBudgetairePilotage,`
);

// ── Op 9 : Version bump ───────────────────────────────────────────────────────
replace(
    'Op9 - Version bump',
    `const CURRENT_VERSION = "25.60 Journal-Agrégé";`,
    `const CURRENT_VERSION = "25.70 Pilotage-Align";`
);

// ── Op 10 : Changelog ─────────────────────────────────────────────────────────
replace(
    'Op10 - Changelog entry v25.70',
    `const CHANGELOG = [`,
    `const CHANGELOG = [
        { version: "25.70 Pilotage-Align", date: "2026-05-30", changes: [
            "Checklist Pilotage : un élément suspendu ce mois (règle d'exception → 0) reste VISIBLE avec montant à 0, opacité réduite et badge ⏸️ Suspendu ce mois (revenus + charges fixes), au lieu d'être masqué",
            "revenusBudgetairesTries ne filtre plus les revenus à 0 — comportement aligné sur les charges fixes",
            "🎯 Épargne pointable dans la checklist (desktop) : nouveau bloc avec checkbox toggleItemPaid (immutabilité des comptes v25.40 respectée)",
            "Journal de projection : une épargne pointée (cochée) disparaît des cycles futurs (mode 'remaining' de _mkLegs), comme une facture cochée",
            "Note de version : demande intitulée V25.50 — numérotée 25.70 pour rester monotone (25.50/25.60 déjà publiées)"
        ] },`
);

// ── Écriture ──────────────────────────────────────────────────────────────────
writeFileSync(FILE, html.replace(/\n/g, '\r\n'), 'utf8');
console.log(`\n🎉 v25.70 Pilotage-Align — ${opCount} opérations appliquées !`);
