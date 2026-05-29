/**
 * fix_kpi_retro_v2430.mjs
 * v24.30 KPI-Retro-Fix
 *
 * Op 1 : Insert soldeCloturePilotageRetro computed after isPilotageRetro
 * Op 2 : KPI3 retro card — soldeCloturePilotageRetro + title "Solde de Clôture"
 * Op 3 : Expose soldeCloturePilotageRetro in return setup()
 * Op 4 : Version bump → "24.30 KPI-Retro-Fix"
 * Op 5 : Changelog entry
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

// ── Op 1 : Insert soldeCloturePilotageRetro computed ─────────────────────────
replace(
    'Op1 - Insert soldeCloturePilotageRetro computed',
    `const isPilotageRetro = computed(() => pilotageViewedCycle.value !== null);`,
    `const isPilotageRetro = computed(() => pilotageViewedCycle.value !== null);
                    // v24.30 Solde de cloture reel du cycle retro visualise
                    const soldeCloturePilotageRetro = computed(() => {
                        calculationTick.value;
                        if (!pilotageViewedCycle.value) return 0;
                        const [mStr, aStr] = pilotageViewedCycle.value.split('-');
                        const mois = Number(mStr), an = Number(aStr);
                        const dAnnee = donneesAnnuelles.value[an];
                        if (!dAnnee) return 0;
                        const moisNoms = ['','Janvier','Février','Mars','Avril','Mai','Juin','Juillet',
                            'Août','Septembre','Octobre','Novembre','Décembre'];
                        const j = bilanJournal.value;
                        const courantCpt = (comptes.value || []).find(c => c.type === 'courant' || c.type === 'liquide');
                        const courantKey = courantCpt ? 'cpt_' + courantCpt.id : Object.keys(j)[0];
                        let soldeInit = 0;
                        if (courantKey && j[courantKey]) {
                            for (const e of j[courantKey]) {
                                if (e.type === 'initial') { soldeInit = e.soldeApres; continue; }
                                if (!e.mois || e.mois === '—') continue;
                                const ep = e.mois.split(' ');
                                const eAn = Number(ep[1] || 0);
                                const eMois = moisNoms.indexOf(ep[0]);
                                if (eAn > an || (eAn === an && eMois >= mois)) break;
                                soldeInit = e.soldeApres;
                            }
                        }
                        let totalRevDue = 0, totalRevPaid = 0;
                        Object.values(dAnnee.revenus || {}).forEach(r => { const due = Number(r.base || 0); totalRevDue += due; totalRevPaid += getPaidAmount(r, due); });
                        let totalFixDue = 0, totalFixPaid = 0;
                        Object.values(dAnnee.chargesFixes || {}).forEach(f => { const due = Number(f.valeur || 0); totalFixDue += due; totalFixPaid += getPaidAmount(f, due); });
                        let totalVarDue = 0, totalVarPaid = 0;
                        Object.values(dAnnee.chargesVariables || {}).forEach(cv => {
                            if ((cv.details || []).length > 0) {
                                cv.details.forEach(d => { const due = Number(d.montant || 0); totalVarDue += due; totalVarPaid += getPaidAmount(d, due); });
                            } else {
                                const due = Number(cv.valeur || 0); totalVarDue += due; totalVarPaid += getPaidAmount(cv, due);
                            }
                        });
                        let totalEp = 0;
                        const _ep = dAnnee.epargne;
                        if (Array.isArray(_ep)) _ep.forEach(e => { totalEp += Number(e.valeur || 0); });
                        else Object.values(_ep || {}).forEach(e => { totalEp += Number(e.valeur || 0); });
                        let totalIrreg = 0;
                        getDepensesMois(mois, an).forEach(dep => { totalIrreg += getPaidAmount(dep, Number(dep.montant || 0)) || Number(dep.montant || 0); });
                        return Math.round((soldeInit + (totalRevPaid || totalRevDue) - (totalFixPaid || totalFixDue) - (totalVarPaid || totalVarDue) - totalEp - totalIrreg) * 100) / 100;
                    });`
);

// ── Op 2 : KPI3 retro card — soldeCloturePilotageRetro + title ────────────────
replace(
    'Op2 - KPI3 retro card uses soldeCloturePilotageRetro',
    `<!-- ── Carte KPI3 Rétro : Solde Fin de Cycle (v24.10) ── -->
                                <div v-if="isPilotageRetro" :class="['p-4 rounded-2xl border text-center transition-all', journalHybride.soldeAtterrissage >= 0 ? 'bg-indigo-900/30 border-indigo-600' : 'bg-red-900/30 border-red-600']">
                                    <p class="text-[9px] font-black uppercase tracking-widest text-gray-300 mb-1">🏁 Solde Fin de Cycle</p>
                                    <p :class="['text-2xl font-black tracking-tighter', journalHybride.soldeAtterrissage >= 0 ? 'text-indigo-300' : 'text-red-400']">{{ formatMAD(journalHybride.soldeAtterrissage) }}</p>
                                    <p class="text-[9px] text-gray-400 mt-1 font-bold">Reporté au cycle suivant</p>
                                </div>`,
    `<!-- ── Carte KPI3 Rétro : Solde de Clôture (v24.30) ── -->
                                <div v-if="isPilotageRetro" :class="['p-4 rounded-2xl border text-center transition-all', soldeCloturePilotageRetro >= 0 ? 'bg-indigo-900/30 border-indigo-600' : 'bg-red-900/30 border-red-600']">
                                    <p class="text-[9px] font-black uppercase tracking-widest text-gray-300 mb-1">🏁 Solde de Clôture</p>
                                    <p :class="['text-2xl font-black tracking-tighter', soldeCloturePilotageRetro >= 0 ? 'text-indigo-300' : 'text-red-400']">{{ formatMAD(soldeCloturePilotageRetro) }}</p>
                                    <p class="text-[9px] text-gray-400 mt-1 font-bold">Reporté au cycle suivant</p>
                                </div>`
);

// ── Op 3 : Expose soldeCloturePilotageRetro in return setup() ─────────────────
replace(
    'Op3 - Expose soldeCloturePilotageRetro in return setup()',
    `// v24.20 Journal-Hybride-Universel
                        journalHybridePourReleve,`,
    `// v24.20 Journal-Hybride-Universel
                        journalHybridePourReleve,
                        // v24.30 KPI-Retro-Fix
                        soldeCloturePilotageRetro,`
);

// ── Op 4 : Version bump ───────────────────────────────────────────────────────
replace(
    'Op4 - Version bump',
    `const CURRENT_VERSION = "24.20 Journal-Hybride-Universel";`,
    `const CURRENT_VERSION = "24.30 KPI-Retro-Fix";`
);

// ── Op 5 : Changelog entry ────────────────────────────────────────────────────
replace(
    'Op5 - Changelog entry v24.30',
    `const CHANGELOG = [`,
    `const CHANGELOG = [
        { version: "24.30 KPI-Retro-Fix", date: "2026-05-30", changes: [
            "KPI3 retro card : soldeCloturePilotageRetro remplace journalHybride.soldeAtterrissage",
            "Calcul correct du solde de cloture pour le cycle pilotageViewedCycle",
            "Titre carte retro : Solde de Cloture au lieu de Solde Fin de Cycle"
        ] },`
);

// ── Écriture ──────────────────────────────────────────────────────────────────
writeFileSync(FILE, html.replace(/\n/g, '\r\n'), 'utf8');
console.log(`\n🎉 v24.30 KPI-Retro-Fix — ${opCount} opérations appliquées !`);
