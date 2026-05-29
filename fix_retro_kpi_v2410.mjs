/**
 * fix_retro_kpi_v2410.mjs
 * v24.10 Retro-KPI — 6 opérations chirurgicales
 *
 * Op 1 : Toggle vueTemporelle → masqué quand isPilotageRetro
 * Op 2 : KPI 2 sous-titre → "✅ Tout est réglé" quand resteAPayerTotalGlobal === 0
 * Op 3 : KPI 3 → carte Rétro (v-if) + carte normale (v-else)
 * Op 4 : Tooltip KPI 3 → masqué quand isPilotageRetro
 * Op 5 : Version bump → "24.10 Retro-KPI"
 * Op 6 : Entrée CHANGELOG
 */

import { readFileSync, writeFileSync } from 'fs';

const FILE = 'C:/Users/HP/finance/index.html';
let html = readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n');

let opCount = 0;

function check(label, needle) {
    if (!html.includes(needle)) {
        console.error(`\n❌ ANCHOR NOT FOUND: ${label}`);
        console.error(`   Looking for: ${JSON.stringify(needle.slice(0, 120))}…`);
        process.exit(1);
    }
}

function replace(label, from, to) {
    check(label, from);
    const before = html;
    html = html.split(from).join(to);
    if (html === before) {
        console.error(`\n❌ REPLACE HAD NO EFFECT: ${label}`);
        process.exit(1);
    }
    opCount++;
    console.log(`✅ Op ${opCount} — ${label}`);
}

// ── Op 1 : Masquer le toggle vueTemporelle en mode Rétro ─────────────────────
replace(
    'Toggle vueTemporelle → v-if="!isPilotageRetro"',
    `<!-- v23.10 Toggle Vue Temporelle (3 états) -->
                                <div class="flex items-center bg-slate-900 rounded-xl p-0.5 border border-slate-600 gap-0.5">`,
    `<!-- v23.10 Toggle Vue Temporelle (3 états) — masqué en mode Rétro (v24.10) -->
                                <div v-if="!isPilotageRetro" class="flex items-center bg-slate-900 rounded-xl p-0.5 border border-slate-600 gap-0.5">`
);

// ── Op 2 : KPI 2 sous-titre conditionnel ─────────────────────────────────────
replace(
    'KPI2 sous-titre → conditionnel "Tout est réglé"',
    `<p class="text-[9px] text-gray-500 mt-1">Tous comptes — non payés</p>`,
    `<p class="text-[9px] mt-1 font-bold" :class="resteAPayerTotalGlobal === 0 ? 'text-emerald-400' : 'text-gray-500'">
                                    <template v-if="resteAPayerTotalGlobal === 0">✅ Tout est réglé</template>
                                    <template v-else>Tous comptes — non payés</template>
                                </p>`
);

// ── Op 3 : KPI 3 — carte Rétro (v-if) + carte normale (v-else) ───────────────
replace(
    'KPI3 → carte Rétro + v-else sur carte normale',
    `<!-- ── Carte KPI3 : contenu selon mode ── -->
                                <div :class="['p-4 rounded-2xl border text-center transition-all',
                                    vueTemporelle === 'at0'
                                        ? (margeT0 >= 0 ? 'bg-violet-900/30 border-violet-600 group-hover:border-violet-400' : 'bg-red-900/30 border-red-600 group-hover:border-red-400')
                                        : (cashDispoPourConso >= 0 ? 'bg-emerald-900/30 border-emerald-600 group-hover:border-emerald-400' : 'bg-red-900/30 border-red-600 group-hover:border-red-400')]">`,
    `<!-- ── Carte KPI3 Rétro : Solde Fin de Cycle (v24.10) ── -->
                                <div v-if="isPilotageRetro" :class="['p-4 rounded-2xl border text-center transition-all', journalHybride.soldeAtterrissage >= 0 ? 'bg-indigo-900/30 border-indigo-600' : 'bg-red-900/30 border-red-600']">
                                    <p class="text-[9px] font-black uppercase tracking-widest text-gray-300 mb-1">🏁 Solde Fin de Cycle</p>
                                    <p :class="['text-2xl font-black tracking-tighter', journalHybride.soldeAtterrissage >= 0 ? 'text-indigo-300' : 'text-red-400']">{{ formatMAD(journalHybride.soldeAtterrissage) }}</p>
                                    <p class="text-[9px] text-gray-400 mt-1 font-bold">Reporté au cycle suivant</p>
                                </div>
                                <!-- ── Carte KPI3 : contenu selon mode ── -->
                                <div v-else :class="['p-4 rounded-2xl border text-center transition-all',
                                    vueTemporelle === 'at0'
                                        ? (margeT0 >= 0 ? 'bg-violet-900/30 border-violet-600 group-hover:border-violet-400' : 'bg-red-900/30 border-red-600 group-hover:border-red-400')
                                        : (cashDispoPourConso >= 0 ? 'bg-emerald-900/30 border-emerald-600 group-hover:border-emerald-400' : 'bg-red-900/30 border-red-600 group-hover:border-red-400')]">`
);

// ── Op 4 : Masquer le tooltip KPI 3 en mode Rétro ────────────────────────────
replace(
    'Tooltip KPI3 → v-if="!isPilotageRetro"',
    `<!-- ── Tooltip ── -->
                                <div class="absolute top-full left-0 right-0 mt-1.5 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">`,
    `<!-- ── Tooltip ── -->
                                <div v-if="!isPilotageRetro" class="absolute top-full left-0 right-0 mt-1.5 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">`
);

// ── Op 5 : Version bump ───────────────────────────────────────────────────────
replace(
    'Version bump → "24.10 Retro-KPI"',
    `const CURRENT_VERSION = "24.0 Journal-Hybride";`,
    `const CURRENT_VERSION = "24.10 Retro-KPI";`
);

// ── Op 6 : Entrée CHANGELOG ───────────────────────────────────────────────────
replace(
    'Changelog entry v24.10',
    `const CHANGELOG = [`,
    `const CHANGELOG = [
        { version: "24.10 Retro-KPI", date: "2026-05-29", changes: [
            "Toggle vueTemporelle masque en mode Retro (isPilotageRetro)",
            "KPI3 Retro : carte Solde Fin de Cycle avec journalHybride.soldeAtterrissage et sous-titre Reporte au cycle suivant",
            "KPI3 normal : v-else sur la carte existante",
            "Tooltip KPI3 masque en mode Retro",
            "KPI2 : sous-titre conditionnel Tout est regle quand resteAPayerTotalGlobal === 0"
        ] },`
);

// ── Écriture ──────────────────────────────────────────────────────────────────
writeFileSync(FILE, html.replace(/\n/g, '\r\n'), 'utf8');
console.log(`\n🎉 v24.10 Retro-KPI — ${opCount} opérations appliquées avec succès !`);
console.log(`📄 Fichier mis à jour : ${FILE}`);
