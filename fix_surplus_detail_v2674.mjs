import { readFileSync, writeFileSync } from 'fs';

const SRC  = 'C:/Users/HP/finance/index.html';
let html = readFileSync(SRC, 'utf8').replace(/\r\n/g, '\n');
const orig = html;

let errors = 0;
const check = (label, str) => {
    if (!html.includes(str)) { console.error('❌ ANCHOR NOT FOUND:', label); errors++; }
    else console.log('✅', label);
};
const replace = (label, from, to) => {
    if (!html.includes(from)) { console.error('❌ REPLACE ANCHOR NOT FOUND:', label); errors++; return; }
    html = html.split(from).join(to);
    console.log('✅ REPLACED:', label);
};

// ──────────────────────────────────────────────────────────────────────────────
// ANCRES
// ──────────────────────────────────────────────────────────────────────────────
check('Ancre surplusParMois computed', `                    const surplusParMois = computed(() => {
                        calculationTick.value;
                        const d = donneesAnnuelles.value[anneeAffichage.value];
                        if (!d) return [];
                        return Array.from({ length: 12 }, (_, i) => {
                            const mNum = i + 1;`);

check('Ancre surplusMensuelBase', `                    const surplusMensuelBase = computed(() => {
                        const arr = surplusParMois.value;
                        if (!arr.length) return 0;
                        return arr.reduce((s, r) => s + r.brut, 0) / arr.length;
                    });`);

check('Ancre surplusStats', `                    const surplusStats = computed(() => {
                        const arr = surplusParMois.value;
                        if (!arr.length) return { moyBrut: 0, moyEpargne: 0, moyNet: 0 };
                        const n = arr.length;
                        return {
                            moyBrut:    arr.reduce((s, r) => s + r.brut, 0) / n,
                            moyEpargne: arr.reduce((s, r) => s + r.epargne, 0) / n,
                            moyNet:     arr.reduce((s, r) => s + r.net, 0) / n,
                        };
                    });`);

check('Ancre template desktop v-for surplusParMois',
    `                                    <div v-for="row in surplusParMois" :key="row.mNum" class="grid grid-cols-[52px_1fr_1fr_1fr] px-3 py-1 hover:bg-gray-800 transition-colors items-center">`);

check('Ancre template mobile v-for surplusParMois',
    `                                <div v-for="row in surplusParMois" :key="row.mNum" class="grid grid-cols-[44px_1fr_1fr_1fr] px-2 py-0.5 items-center">`);

if (errors > 0) { console.error(`\n${errors} ancre(s) manquante(s) — abandon.`); process.exit(1); }

// ──────────────────────────────────────────────────────────────────────────────
// FIX 1 : surplusParMois — masquer mois passés, cycle courant = flux réels
// ──────────────────────────────────────────────────────────────────────────────
replace('FIX1 surplusParMois',
`                    const surplusParMois = computed(() => {
                        calculationTick.value;
                        const d = donneesAnnuelles.value[anneeAffichage.value];
                        if (!d) return [];
                        return Array.from({ length: 12 }, (_, i) => {
                            const mNum = i + 1;
                            let rev = 0;
                            Object.values(d.revenus || {}).forEach(r => {
                                let v = Number(r?.base || 0);
                                (r?.exceptions || []).forEach(e => { if (mNum >= e.moisDebut && mNum <= e.moisFin) v = Number(e.nouvelleValeur || 0); });
                                rev += v;
                            });
                            let fix = 0;
                            Object.values(d.chargesFixes || {}).forEach(f => {
                                let v = Number(f?.valeur || 0);
                                (f?.exceptions || []).forEach(e => { if (mNum >= e.moisDebut && mNum <= e.moisFin) v = Number(e.nouvelleValeur || 0); });
                                fix += v;
                            });
                            let vari = 0;
                            Object.values(d.chargesVariables || {}).forEach(c => {
                                let v = getMonthlyVariableValue(c || {});
                                (c?.exceptions || []).forEach(e => { if (mNum >= e.moisDebut && mNum <= e.moisFin) v = Number(e.nouvelleValeur || 0); });
                                vari += v;
                            });
                            const epArr = (Array.isArray(d.epargne) ? d.epargne : Object.values(d.epargne || {})).filter(Boolean);
                            let ep = 0;
                            epArr.forEach(obj => {
                                let v = Number(obj.valeur || 0);
                                (obj.exceptions || []).forEach(e => { if (mNum >= e.moisDebut && mNum <= e.moisFin) v = Number(e.nouvelleValeur || 0); });
                                ep += v;
                            });
                            const brut = rev - fix - vari;
                            return { mNum, brut, epargne: ep, net: brut - ep };
                        });
                    });`,
`                    const surplusParMois = computed(() => {
                        calculationTick.value;
                        const d = donneesAnnuelles.value[anneeAffichage.value];
                        if (!d) return [];
                        // v26.74 : masquer mois passés — cycle courant = flux réels payés uniquement
                        const curM = moisBudgetaire.value.mois, curA = moisBudgetaire.value.an;
                        const isViewCurYear  = anneeAffichage.value === curA;
                        const isViewPastYear = anneeAffichage.value < curA;
                        return Array.from({ length: 12 }, (_, i) => {
                            const mNum = i + 1;
                            const isPast    = isViewPastYear || (isViewCurYear && mNum < curM);
                            const isCurrent = isViewCurYear && mNum === curM;
                            if (isPast) return { mNum, brut: null, epargne: null, net: null, isPast: true, isCurrent: false };
                            const epArr = (Array.isArray(d.epargne) ? d.epargne : Object.values(d.epargne || {})).filter(Boolean);
                            if (isCurrent) {
                                // Cycle courant : uniquement les flux réellement enregistrés (paye:true)
                                let rev = 0;
                                Object.values(d.revenus || {}).forEach(r => {
                                    let v = Number(r?.base || 0);
                                    (r?.exceptions || []).forEach(e => { if (mNum >= e.moisDebut && mNum <= e.moisFin) v = Number(e.nouvelleValeur || 0); });
                                    if (v > 0 && isItemPaid(r, v)) rev += v;
                                });
                                let fix = 0;
                                Object.values(d.chargesFixes || {}).forEach(f => {
                                    let v = Number(f?.valeur || 0);
                                    (f?.exceptions || []).forEach(e => { if (mNum >= e.moisDebut && mNum <= e.moisFin) v = Number(e.nouvelleValeur || 0); });
                                    if (v > 0 && isItemPaid(f, v)) fix += v;
                                });
                                let vari = 0;
                                Object.values(d.chargesVariables || {}).forEach(c => {
                                    if ((c?.details || []).length > 0) {
                                        c.details.forEach(det => { const dv = Number(det.montant || 0); if (isItemPaid(det, dv)) vari += dv; });
                                    } else {
                                        let v = getMonthlyVariableValue(c || {});
                                        (c?.exceptions || []).forEach(e => { if (mNum >= e.moisDebut && mNum <= e.moisFin) v = Number(e.nouvelleValeur || 0); });
                                        if (v > 0 && isItemPaid(c, v)) vari += v;
                                    }
                                });
                                let ep = 0;
                                epArr.forEach(obj => {
                                    let v = Number(obj.valeur || 0);
                                    (obj.exceptions || []).forEach(e => { if (mNum >= e.moisDebut && mNum <= e.moisFin) v = Number(e.nouvelleValeur || 0); });
                                    if (isItemPaid(obj, v)) ep += v;
                                });
                                const brut = rev - fix - vari;
                                return { mNum, brut, epargne: ep, net: brut - ep, isPast: false, isCurrent: true };
                            }
                            // Mois futur : valeurs théoriques
                            let rev = 0;
                            Object.values(d.revenus || {}).forEach(r => {
                                let v = Number(r?.base || 0);
                                (r?.exceptions || []).forEach(e => { if (mNum >= e.moisDebut && mNum <= e.moisFin) v = Number(e.nouvelleValeur || 0); });
                                rev += v;
                            });
                            let fix = 0;
                            Object.values(d.chargesFixes || {}).forEach(f => {
                                let v = Number(f?.valeur || 0);
                                (f?.exceptions || []).forEach(e => { if (mNum >= e.moisDebut && mNum <= e.moisFin) v = Number(e.nouvelleValeur || 0); });
                                fix += v;
                            });
                            let vari = 0;
                            Object.values(d.chargesVariables || {}).forEach(c => {
                                let v = getMonthlyVariableValue(c || {});
                                (c?.exceptions || []).forEach(e => { if (mNum >= e.moisDebut && mNum <= e.moisFin) v = Number(e.nouvelleValeur || 0); });
                                vari += v;
                            });
                            let ep = 0;
                            epArr.forEach(obj => {
                                let v = Number(obj.valeur || 0);
                                (obj.exceptions || []).forEach(e => { if (mNum >= e.moisDebut && mNum <= e.moisFin) v = Number(e.nouvelleValeur || 0); });
                                ep += v;
                            });
                            const brut = rev - fix - vari;
                            return { mNum, brut, epargne: ep, net: brut - ep, isPast: false, isCurrent: false };
                        });
                    });`
);

// ──────────────────────────────────────────────────────────────────────────────
// FIX 2 : surplusMensuelBase — exclure les mois passés de la moyenne
// ──────────────────────────────────────────────────────────────────────────────
replace('FIX2 surplusMensuelBase',
`                    const surplusMensuelBase = computed(() => {
                        const arr = surplusParMois.value;
                        if (!arr.length) return 0;
                        return arr.reduce((s, r) => s + r.brut, 0) / arr.length;
                    });`,
`                    const surplusMensuelBase = computed(() => {
                        // v26.74 : exclure mois passés (isPast) de la moyenne
                        const arr = surplusParMois.value.filter(r => !r.isPast);
                        if (!arr.length) return 0;
                        return arr.reduce((s, r) => s + r.brut, 0) / arr.length;
                    });`
);

// ──────────────────────────────────────────────────────────────────────────────
// FIX 3 : surplusStats — exclure les mois passés de la moyenne
// ──────────────────────────────────────────────────────────────────────────────
replace('FIX3 surplusStats',
`                    const surplusStats = computed(() => {
                        const arr = surplusParMois.value;
                        if (!arr.length) return { moyBrut: 0, moyEpargne: 0, moyNet: 0 };
                        const n = arr.length;
                        return {
                            moyBrut:    arr.reduce((s, r) => s + r.brut, 0) / n,
                            moyEpargne: arr.reduce((s, r) => s + r.epargne, 0) / n,
                            moyNet:     arr.reduce((s, r) => s + r.net, 0) / n,
                        };
                    });`,
`                    const surplusStats = computed(() => {
                        // v26.74 : exclure mois passés de la moyenne (seulement mois courant + futurs)
                        const arr = surplusParMois.value.filter(r => !r.isPast);
                        if (!arr.length) return { moyBrut: 0, moyEpargne: 0, moyNet: 0 };
                        const n = arr.length;
                        return {
                            moyBrut:    arr.reduce((s, r) => s + r.brut, 0) / n,
                            moyEpargne: arr.reduce((s, r) => s + r.epargne, 0) / n,
                            moyNet:     arr.reduce((s, r) => s + r.net, 0) / n,
                        };
                    });`
);

// ──────────────────────────────────────────────────────────────────────────────
// FIX 4 : Template desktop — masquer passés, current = marqué + signe dynamique
// ──────────────────────────────────────────────────────────────────────────────
replace('FIX4 template desktop surplusParMois',
`                                    <div v-for="row in surplusParMois" :key="row.mNum" class="grid grid-cols-[52px_1fr_1fr_1fr] px-3 py-1 hover:bg-gray-800 transition-colors items-center">
                                        <span class="text-[9px] font-bold text-gray-400 whitespace-nowrap">{{ nomDuMois(row.mNum).slice(0,4) }}</span>
                                        <span class="text-[9px] font-black tabular-nums text-right text-emerald-400 whitespace-nowrap">+{{ formatMAD(row.brut) }}</span>
                                        <span class="text-[9px] font-black tabular-nums text-right text-purple-400 whitespace-nowrap">{{ row.epargne > 0 ? '-' : '' }}{{ formatMAD(row.epargne) }}</span>
                                        <span class="text-[9px] font-black tabular-nums text-right whitespace-nowrap" :class="row.net >= 0 ? 'text-blue-300' : 'text-rose-400'">{{ row.net >= 0 ? '+' : '' }}{{ formatMAD(row.net) }}</span>
                                    </div>`,
`                                    <div v-for="row in surplusParMois" v-if="!row.isPast" :key="row.mNum"
                                         :class="['grid grid-cols-[52px_1fr_1fr_1fr] px-3 py-1 hover:bg-gray-800 transition-colors items-center', row.isCurrent ? 'bg-blue-900/30 border-l-2 border-blue-400' : '']">
                                        <span class="text-[9px] font-bold whitespace-nowrap" :class="row.isCurrent ? 'text-blue-200' : 'text-gray-400'">{{ nomDuMois(row.mNum).slice(0,4) }}{{ row.isCurrent ? ' ✓' : '' }}</span>
                                        <span class="text-[9px] font-black tabular-nums text-right whitespace-nowrap" :class="row.brut >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ row.brut >= 0 ? '+' : '' }}{{ formatMAD(row.brut) }}</span>
                                        <span class="text-[9px] font-black tabular-nums text-right text-purple-400 whitespace-nowrap">{{ row.epargne > 0 ? '-' : '' }}{{ formatMAD(row.epargne) }}</span>
                                        <span class="text-[9px] font-black tabular-nums text-right whitespace-nowrap" :class="row.net >= 0 ? 'text-blue-300' : 'text-rose-400'">{{ row.net >= 0 ? '+' : '' }}{{ formatMAD(row.net) }}</span>
                                    </div>`
);

// ──────────────────────────────────────────────────────────────────────────────
// FIX 5 : Template mobile — même correction
// ──────────────────────────────────────────────────────────────────────────────
replace('FIX5 template mobile surplusParMois',
`                                <div v-for="row in surplusParMois" :key="row.mNum" class="grid grid-cols-[44px_1fr_1fr_1fr] px-2 py-0.5 items-center">
                                    <span class="text-[8px] font-bold text-gray-400 whitespace-nowrap">{{ nomDuMois(row.mNum).slice(0,4) }}</span>
                                    <span class="text-[8px] font-black tabular-nums text-right text-emerald-400 whitespace-nowrap">+{{ formatMAD(row.brut) }}</span>
                                    <span class="text-[8px] font-black tabular-nums text-right text-purple-400 whitespace-nowrap">{{ row.epargne > 0 ? '-' : '' }}{{ formatMAD(row.epargne) }}</span>
                                    <span class="text-[8px] font-black tabular-nums text-right whitespace-nowrap" :class="row.net >= 0 ? 'text-blue-300' : 'text-rose-400'">{{ row.net >= 0 ? '+' : '' }}{{ formatMAD(row.net) }}</span>
                                </div>`,
`                                <div v-for="row in surplusParMois" v-if="!row.isPast" :key="row.mNum"
                                     :class="['grid grid-cols-[44px_1fr_1fr_1fr] px-2 py-0.5 items-center', row.isCurrent ? 'bg-blue-900/30 border-l-2 border-blue-400' : '']">
                                    <span class="text-[8px] font-bold whitespace-nowrap" :class="row.isCurrent ? 'text-blue-200' : 'text-gray-400'">{{ nomDuMois(row.mNum).slice(0,4) }}{{ row.isCurrent ? ' ✓' : '' }}</span>
                                    <span class="text-[8px] font-black tabular-nums text-right whitespace-nowrap" :class="row.brut >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ row.brut >= 0 ? '+' : '' }}{{ formatMAD(row.brut) }}</span>
                                    <span class="text-[8px] font-black tabular-nums text-right text-purple-400 whitespace-nowrap">{{ row.epargne > 0 ? '-' : '' }}{{ formatMAD(row.epargne) }}</span>
                                    <span class="text-[8px] font-black tabular-nums text-right whitespace-nowrap" :class="row.net >= 0 ? 'text-blue-300' : 'text-rose-400'">{{ row.net >= 0 ? '+' : '' }}{{ formatMAD(row.net) }}</span>
                                </div>`
);

// ──────────────────────────────────────────────────────────────────────────────
// BUMP VERSION
// ──────────────────────────────────────────────────────────────────────────────
replace('Bump version 26.73 → 26.74',
    'v26.73 Releve-Filter-Fix',
    'v26.74 Surplus-Real-Fix'
);

// ──────────────────────────────────────────────────────────────────────────────
// SAUVEGARDE
// ──────────────────────────────────────────────────────────────────────────────
if (errors > 0) { console.error(`\n${errors} erreur(s) — fichier NON modifié.`); process.exit(1); }
if (html === orig) { console.warn('\n⚠️  Aucun changement détecté.'); process.exit(1); }

writeFileSync(SRC, html.replace(/\n/g, '\r\n'), 'utf8');
console.log('\n✅ index.html mis à jour → v26.74 Surplus-Real-Fix');
