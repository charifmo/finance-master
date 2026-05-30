/**
 * fix_freeze_retro_v2440.mjs
 * v24.40 Freeze-Retro — Gel des calculs temporels en mode cycle passé
 *
 * Op 1 : Insert isCyclePasse + _joursCyclePasse computeds
 * Op 2 : joursRestantsAvantPaie / joursDepuisDernierePaie / progressCyclePaie  → freeze
 * Op 3 : prorataVariableT0 → full budget en cycle passé
 * Op 4 : Expose isCyclePasse + _joursCyclePasse in return setup()
 * Op 5 : Toggle vueTemporelle → v-if="!isCyclePasse"
 * Op 6 : KPI3 retro card → isCyclePasse + "Transféré au cycle suivant"
 * Op 7 : KPI3 tooltip → v-if="!isCyclePasse"
 * Op 8 : KPI2 Reste à Payer → Finito - Cycle Clos en mode passé
 * Op 9 : Version bump + Changelog
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

// ── Op 1 : isCyclePasse + _joursCyclePasse ───────────────────────────────────
replace(
    'Op1 - Insert isCyclePasse + _joursCyclePasse',
    `const isPilotageRetro = computed(() => pilotageViewedCycle.value !== null);`,
    `const isPilotageRetro = computed(() => pilotageViewedCycle.value !== null);
                    // v24.40 Cycle chronologiquement passé (vs cycle reel courant)
                    const isCyclePasse = computed(() => {
                        if (!pilotageViewedCycle.value) return false;
                        const [vMois, vAn] = pilotageViewedCycle.value.split('-').map(Number);
                        const cMois = moisBudgetaire.value.mois;
                        const cAn = moisBudgetaire.value.an;
                        return vAn < cAn || (vAn === cAn && vMois < cMois);
                    });
                    // v24.40 Nombre total de jours du cycle passe visualise
                    const _joursCyclePasse = computed(() => {
                        if (!isCyclePasse.value) return 0;
                        const m = pilotageViewedMois.value;
                        const a = pilotageViewedAn.value;
                        const jdp = jourDePaie.value;
                        const debut = new Date(a, m - 2, jdp);
                        const fin = new Date(a, m - 1, jdp);
                        return Math.round((fin - debut) / 864e5);
                    });`
);

// ── Op 2 : Freeze temporal computeds ─────────────────────────────────────────
replace(
    'Op2 - Freeze joursRestantsAvantPaie / joursDepuisDernierePaie / progressCyclePaie',
    `const joursRestantsAvantPaie = computed(() => _cyclePaieInfo.value.joursAvant);
                    const joursDepuisDernierePaie = computed(() => _cyclePaieInfo.value.joursDepuis);
                    const progressCyclePaie = computed(() => _cyclePaieInfo.value.progress);`,
    `// v24.40 Freeze-Retro : valeurs gelees en cycle passe (cycle est mort, le temps ne court plus)
                    const joursRestantsAvantPaie = computed(() => isCyclePasse.value ? 0 : _cyclePaieInfo.value.joursAvant);
                    const joursDepuisDernierePaie = computed(() => isCyclePasse.value ? _joursCyclePasse.value : _cyclePaieInfo.value.joursDepuis);
                    const progressCyclePaie = computed(() => isCyclePasse.value ? 100 : _cyclePaieInfo.value.progress);`
);

// ── Op 3 : prorataVariableT0 → full budget en cycle passé ────────────────────
replace(
    'Op3 - prorataVariableT0 freeze',
    `// ── v23.10 : Computeds Prorata-T0 ──────────────────────────────────────
                    const prorataVariableT0 = computed(() =>
                        budgetConsoTheoriqueMois.value * progressCyclePaie.value
                    );`,
    `// ── v23.10 : Computeds Prorata-T0 ──────────────────────────────────────
                    // v24.40 Freeze-Retro : 100% du budget consomme en cycle passe (pas de prorata temporel)
                    const prorataVariableT0 = computed(() =>
                        isCyclePasse.value
                            ? budgetConsoTheoriqueMois.value
                            : budgetConsoTheoriqueMois.value * progressCyclePaie.value
                    );`
);

// ── Op 4 : Expose isCyclePasse + _joursCyclePasse in return setup() ──────────
replace(
    'Op4 - Expose isCyclePasse in return setup()',
    `// v24.30 KPI-Retro-Fix
                        soldeCloturePilotageRetro,`,
    `// v24.30 KPI-Retro-Fix
                        soldeCloturePilotageRetro,
                        // v24.40 Freeze-Retro
                        isCyclePasse, _joursCyclePasse,`
);

// ── Op 5 : Toggle vueTemporelle → isCyclePasse ───────────────────────────────
replace(
    'Op5 - Toggle vueTemporelle uses isCyclePasse',
    `<!-- v23.10 Toggle Vue Temporelle (3 états) — masqué en mode Rétro (v24.10) -->
                                <div v-if="!isPilotageRetro" class="flex items-center bg-slate-900 rounded-xl p-0.5 border border-slate-600 gap-0.5">`,
    `<!-- v23.10 Toggle Vue Temporelle (3 états) — masqué en cycle passé (v24.40) -->
                                <div v-if="!isCyclePasse" class="flex items-center bg-slate-900 rounded-xl p-0.5 border border-slate-600 gap-0.5">`
);

// ── Op 6 : KPI3 retro card → isCyclePasse + "Transféré" ──────────────────────
replace(
    'Op6 - KPI3 retro card uses isCyclePasse + Transféré',
    `<!-- ── Carte KPI3 Rétro : Solde de Clôture (v24.30) ── -->
                                <div v-if="isPilotageRetro" :class="['p-4 rounded-2xl border text-center transition-all', soldeCloturePilotageRetro >= 0 ? 'bg-indigo-900/30 border-indigo-600' : 'bg-red-900/30 border-red-600']">
                                    <p class="text-[9px] font-black uppercase tracking-widest text-gray-300 mb-1">🏁 Solde de Clôture</p>
                                    <p :class="['text-2xl font-black tracking-tighter', soldeCloturePilotageRetro >= 0 ? 'text-indigo-300' : 'text-red-400']">{{ formatMAD(soldeCloturePilotageRetro) }}</p>
                                    <p class="text-[9px] text-gray-400 mt-1 font-bold">Reporté au cycle suivant</p>
                                </div>`,
    `<!-- ── Carte KPI3 Rétro : Solde de Clôture (v24.40 Freeze-Retro) ── -->
                                <div v-if="isCyclePasse" :class="['p-4 rounded-2xl border text-center transition-all', soldeCloturePilotageRetro >= 0 ? 'bg-indigo-900/30 border-indigo-600' : 'bg-red-900/30 border-red-600']">
                                    <p class="text-[9px] font-black uppercase tracking-widest text-gray-300 mb-1">🏁 Solde de Clôture</p>
                                    <p :class="['text-2xl font-black tracking-tighter', soldeCloturePilotageRetro >= 0 ? 'text-indigo-300' : 'text-red-400']">{{ formatMAD(soldeCloturePilotageRetro) }}</p>
                                    <p class="text-[9px] text-gray-400 mt-1 font-bold">Transféré au cycle suivant</p>
                                </div>`
);

// ── Op 7 : KPI3 tooltip → isCyclePasse ───────────────────────────────────────
replace(
    'Op7 - KPI3 tooltip uses isCyclePasse',
    `<!-- ── Tooltip ── -->
                                <div v-if="!isPilotageRetro" class="absolute top-full left-0 right-0 mt-1.5 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">`,
    `<!-- ── Tooltip — masqué en cycle passé (v24.40) ── -->
                                <div v-if="!isCyclePasse" class="absolute top-full left-0 right-0 mt-1.5 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">`
);

// ── Op 8 : KPI2 Reste à Payer — Finito badge en cycle passé ──────────────────
replace(
    'Op8 - KPI2 Finito badge',
    `                            <!-- KPI 2 : Reste à Payer — Tous comptes avec détail par compte -->
                            <div class="relative group cursor-default">
                                <div :class="['p-4 rounded-2xl border text-center transition-all', resteAPayerTotalGlobal > 0 ? 'bg-orange-900/20 border-orange-700 group-hover:border-orange-500' : 'bg-green-900/20 border-green-700 group-hover:border-green-500']">
                                    <p class="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">🔴 Reste à Payer</p>
                                    <p :class="['text-2xl font-black tracking-tighter', resteAPayerTotalGlobal > 0 ? 'text-orange-400' : 'text-green-400']">{{ formatMAD(resteAPayerTotalGlobal) }}</p>
                                    <p class="text-[9px] mt-1 font-bold" :class="resteAPayerTotalGlobal === 0 ? 'text-emerald-400' : 'text-gray-500'">
                                    <template v-if="resteAPayerTotalGlobal === 0">✅ Tout est réglé</template>
                                    <template v-else>Tous comptes — non payés</template>
                                </p>
                                </div>`,
    `                            <!-- KPI 2 : Reste à Payer — Tous comptes (Finito en cycle passé v24.40) -->
                            <div class="relative group cursor-default">
                                <!-- Carte KPI2 Cycle Passé : Finito - Cycle Clos -->
                                <div v-if="isCyclePasse" class="p-4 rounded-2xl border text-center transition-all bg-green-900/30 border-green-600 group-hover:border-green-400">
                                    <p class="text-[9px] font-black uppercase tracking-widest text-gray-300 mb-1">🔴 Reste à Payer</p>
                                    <p class="text-2xl font-black tracking-tighter text-emerald-300">{{ formatMAD(0) }}</p>
                                    <p class="text-[9px] mt-1 font-bold text-emerald-400">🏁 Finito — Cycle Clos</p>
                                </div>
                                <!-- Carte KPI2 normale (cycle actuel) -->
                                <div v-else :class="['p-4 rounded-2xl border text-center transition-all', resteAPayerTotalGlobal > 0 ? 'bg-orange-900/20 border-orange-700 group-hover:border-orange-500' : 'bg-green-900/20 border-green-700 group-hover:border-green-500']">
                                    <p class="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">🔴 Reste à Payer</p>
                                    <p :class="['text-2xl font-black tracking-tighter', resteAPayerTotalGlobal > 0 ? 'text-orange-400' : 'text-green-400']">{{ formatMAD(resteAPayerTotalGlobal) }}</p>
                                    <p class="text-[9px] mt-1 font-bold" :class="resteAPayerTotalGlobal === 0 ? 'text-emerald-400' : 'text-gray-500'">
                                    <template v-if="resteAPayerTotalGlobal === 0">✅ Tout est réglé</template>
                                    <template v-else>Tous comptes — non payés</template>
                                </p>
                                </div>`
);

// ── Op 9 : Version bump + Changelog ──────────────────────────────────────────
replace(
    'Op9a - Version bump',
    `const CURRENT_VERSION = "24.30 KPI-Retro-Fix";`,
    `const CURRENT_VERSION = "24.40 Freeze-Retro";`
);

replace(
    'Op9b - Changelog entry v24.40',
    `const CHANGELOG = [`,
    `const CHANGELOG = [
        { version: "24.40 Freeze-Retro", date: "2026-05-30", changes: [
            "Nouveau computed isCyclePasse (chronologique) remplace isPilotageRetro dans le template Pilotage",
            "Gel des computed temporels en cycle passe : joursRestants=0, joursDepuis=total cycle, progress=100",
            "prorataVariableT0 = budget complet en cycle passe (plus de prorata new Date())",
            "KPI2 Reste a Payer : carte dediee Finito - Cycle Clos en cycle passe",
            "KPI3 retro : sous-titre Transfere au cycle suivant",
            "Toggle vueTemporelle et tooltip T0 masques par isCyclePasse"
        ] },`
);

// ── Écriture ──────────────────────────────────────────────────────────────────
writeFileSync(FILE, html.replace(/\n/g, '\r\n'), 'utf8');
console.log(`\n🎉 v24.40 Freeze-Retro — ${opCount} opérations appliquées !`);
