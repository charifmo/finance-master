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

// ── Op 1 : helpers JS après budgetSemaineReel ────────────────────────────
const BUDGET_END = `const budgetSemaineReel = computed(() => {
                        const jours = joursRestantsAvantPaie.value;
                        if (!jours) return null;
                        return cashDispoPourConso.value / (jours / 7);
                    });`;

const TIMING_JS = `

                    // ── v22.95 Cashflow-Timing ───────────────────────────────────────────────
                    const isFluxCetteSemaine = (jourPrevu) => {
                        if (!jourPrevu || jourPrevu < 1 || jourPrevu > 31) return false;
                        const today = new Date();
                        const y = today.getFullYear();
                        const m = today.getMonth();
                        const d = today.getDate();
                        const todayMs = new Date(y, m, d).getTime();
                        const candidates = [
                            new Date(y, m, jourPrevu).getTime(),
                            new Date(y, m + 1, jourPrevu).getTime(),
                        ];
                        return candidates.some(ms => {
                            const diff = Math.round((ms - todayMs) / 86400000);
                            return diff >= 0 && diff <= 7;
                        });
                    };

                    const revenusBudgetairesTries = computed(() => {
                        calculationTick.value;
                        const mb = moisBudgetaire.value;
                        const d = donneesAnnuelles.value[mb.an];
                        if (!d) return [];
                        return Object.values(d.revenus || {}).slice().sort((a, b) =>
                            (a.jourPrevu || 99) - (b.jourPrevu || 99));
                    });

                    const chargesFixesBudgetairesTriees = computed(() => {
                        calculationTick.value;
                        const mb = moisBudgetaire.value;
                        const d = donneesAnnuelles.value[mb.an];
                        if (!d) return [];
                        return Object.values(d.chargesFixes || {}).slice().sort((a, b) =>
                            (a.jourPrevu || 99) - (b.jourPrevu || 99));
                    });`;

check('Op 1 : timing JS helpers', html.includes(BUDGET_END));
html = html.replace(BUDGET_END, BUDGET_END + TIMING_JS);

// ── Op 2 : return ────────────────────────────────────────────────────────
const OLD_RET = `// v22.90 Double-Pilotage
                        revenusTheoriquesMois, engagementsTheoriquesMois, engagementsTheoriquesDetail,
                        budgetConsoTheoriqueMois, rythmeTheoriqueSemaine, pilotageTheoLignes,`;

const NEW_RET = OLD_RET + `
                        // v22.95 Cashflow-Timing
                        isFluxCetteSemaine, revenusBudgetairesTries, chargesFixesBudgetairesTriees,`;

check('Op 2 : return anchor found', html.includes(OLD_RET));
html = html.replace(OLD_RET, NEW_RET);

// ── Op 3a : pilotageTheoLignes revenus push ──────────────────────────────
const OLD_PR = `if (m > 0) out.revenus.push({ nom: r.label || r.nom || '?', montant: m });`;
const NEW_PR = `if (m > 0) out.revenus.push({ nom: r.label || r.nom || '?', montant: m, jourPrevu: r.jourPrevu || null });`;
check('Op 3a : push revenus anchor', html.includes(OLD_PR));
html = html.replace(OLD_PR, NEW_PR);

// ── Op 3b : pilotageTheoLignes fixes push ───────────────────────────────
const OLD_PF = `if (due > 0) out.fixes.push({ nom: f.label || '?', montant: due });`;
const NEW_PF = `if (due > 0) out.fixes.push({ nom: f.label || '?', montant: due, jourPrevu: f.jourPrevu || null });`;
check('Op 3b : push fixes anchor', html.includes(OLD_PF));
html = html.replace(OLD_PF, NEW_PF);

// ── Op 3c : sort before return out ──────────────────────────────────────
const OLD_RO = `                        return out;\n                    });\n\n             `;
const NEW_RO = `                        const sortJour = (a, b) => (a.jourPrevu || 99) - (b.jourPrevu || 99);
                        out.revenus.sort(sortJour);
                        out.fixes.sort(sortJour);
                        return out;\n                    });\n\n             `;
check('Op 3c : return out anchor', html.includes(OLD_RO));
html = html.replace(OLD_RO, NEW_RO);

// ── Op 4 : théo revenus list item ────────────────────────────────────────
const OLD_TR = `<li v-for="(r, i) in pilotageTheoLignes.revenus" :key="'r'+i" class="flex justify-between text-xs py-1 border-b border-slate-100 last:border-0">
                                    <span class="text-slate-700 truncate max-w-[180px]">{{ r.nom }}</span>
                                    <span class="font-bold text-emerald-700">{{ formatMAD(r.montant) }}</span>
                                </li>`;

const NEW_TR = `<li v-for="(r, i) in pilotageTheoLignes.revenus" :key="'r'+i" class="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-0 gap-2">
                                    <span class="text-slate-700 truncate max-w-[140px]">{{ r.nom }}</span>
                                    <div class="flex items-center gap-1.5 shrink-0">
                                        <span v-if="isFluxCetteSemaine(r.jourPrevu)" class="text-[9px] font-black bg-amber-100 text-amber-700 border border-amber-300 px-1.5 py-0.5 rounded-full">⏳ Cette semaine</span>
                                        <span v-if="r.jourPrevu" class="text-[9px] text-slate-400 font-bold">📅 j.{{ r.jourPrevu }}</span>
                                        <span class="font-bold text-emerald-700">{{ formatMAD(r.montant) }}</span>
                                    </div>
                                </li>`;

check('Op 4 : théo revenus li anchor', html.includes(OLD_TR));
html = html.replace(OLD_TR, NEW_TR);

// ── Op 5 : théo fixes list item ──────────────────────────────────────────
const OLD_TF = `<li v-for="(f, i) in pilotageTheoLignes.fixes" :key="'f'+i" class="flex justify-between text-xs py-1 border-b border-slate-100 last:border-0">
                                    <span class="text-slate-700 truncate max-w-[180px]">{{ f.nom }}</span>
                                    <span class="font-bold text-orange-700">{{ formatMAD(f.montant) }}</span>
                                </li>`;

const NEW_TF = `<li v-for="(f, i) in pilotageTheoLignes.fixes" :key="'f'+i" class="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-0 gap-2">
                                    <span class="text-slate-700 truncate max-w-[140px]">{{ f.nom }}</span>
                                    <div class="flex items-center gap-1.5 shrink-0">
                                        <span v-if="isFluxCetteSemaine(f.jourPrevu)" class="text-[9px] font-black bg-amber-100 text-amber-700 border border-amber-300 px-1.5 py-0.5 rounded-full">⏳ Cette semaine</span>
                                        <span v-if="f.jourPrevu" class="text-[9px] text-slate-400 font-bold">📅 j.{{ f.jourPrevu }}</span>
                                        <span class="font-bold text-orange-700">{{ formatMAD(f.montant) }}</span>
                                    </div>
                                </li>`;

check('Op 5 : théo fixes li anchor', html.includes(OLD_TF));
html = html.replace(OLD_TF, NEW_TF);

// ── Op 6 : form revenus jourPrevu ────────────────────────────────────────
const OLD_REV_ANCHOR = `                       </select>\n                            </div>\n                            <div v-if="item.showExceptions" class="mt-4 bg-blue-50/50`;
const NEW_REV_ANCHOR = `                       </select>\n                            </div>\n                            <!-- v22.95 Cashflow-Timing : jour prévu dans le mois -->\n                            <div v-if="!item.parts || !item.parts.length" class="flex items-center gap-2 mt-1 mb-1">\n                                <label class="text-[9px] font-black text-indigo-700 uppercase tracking-widest whitespace-nowrap">📅 Jour prévu :</label>\n                                <input type="number" v-model.number="item.jourPrevu" @input="handleDataChange" min="1" max="31" placeholder="ex: 27" class="w-20 p-1.5 text-xs font-black text-indigo-800 border border-indigo-200 rounded-lg bg-indigo-50 outline-none focus:ring-2 focus:ring-indigo-400 text-center"/>\n                                <span class="text-[9px] text-slate-400 font-bold">du mois (1–31)</span>\n                            </div>\n                            <div v-if="item.showExceptions" class="mt-4 bg-blue-50/50`;

check('Op 6 : form revenus anchor', html.includes(OLD_REV_ANCHOR));
html = html.replace(OLD_REV_ANCHOR, NEW_REV_ANCHOR);

// ── Op 8a : réalisé revenus v-for → sorted ───────────────────────────────
const OLD_RV = `<div v-for="(rev, key) in donneesAnnuelles[moisBudgetaire.an]?.revenus" :key="'rev_' + key"\n                                         class="flex items-center justify-between p-3 bg-slate-900/90 rounded-xl group border border-slate-700 hover:border-green-500 transition-all">`;
const NEW_RV = `<div v-for="(rev, key) in revenusBudgetairesTries" :key="'rev_' + key"\n                                         class="flex items-center justify-between p-3 bg-slate-900/90 rounded-xl group border border-slate-700 hover:border-green-500 transition-all">`;
check('Op 8a : réalisé rev vfor anchor', html.includes(OLD_RV));
html = html.replace(OLD_RV, NEW_RV);

// ── Op 8b : réalisé revenus label span badge ─────────────────────────────
const OLD_RL = `<span :class="['text-sm font-bold transition-all', isItemPaid(rev, Number(rev.base || 0)) ? 'text-slate-500 line-through' : 'text-slate-200 group-hover:text-green-300']">{{ rev.label }}</span>`;
const NEW_RL = OLD_RL + `
                                             <span v-if="isFluxCetteSemaine(rev.jourPrevu) && !isItemPaid(rev, Number(rev.base || 0))" class="text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded-full ml-1">⏳ Cette sem.</span>
                                             <span v-if="rev.jourPrevu && !isItemPaid(rev, Number(rev.base || 0))" class="text-[9px] text-slate-500 font-bold ml-1">j.{{ rev.jourPrevu }}</span>`;
check('Op 8b : réalisé rev label anchor', html.includes(OLD_RL));
html = html.replace(OLD_RL, NEW_RL);

// ── Op 9a : réalisé chargesFixes v-for → sorted ──────────────────────────
const OLD_CF = `<div v-for="(f, key) in donneesAnnuelles[moisBudgetaire.an]?.chargesFixes" :key="key" class="flex items-center justify-between p-3 bg-slate-900/90 rounded-xl group border border-slate-700 hover:border-orange-500 transition-all">`;
const NEW_CF = `<div v-for="(f, key) in chargesFixesBudgetairesTriees" :key="key" class="flex items-center justify-between p-3 bg-slate-900/90 rounded-xl group border border-slate-700 hover:border-orange-500 transition-all">`;
check('Op 9a : réalisé CF vfor anchor', html.includes(OLD_CF));
html = html.replace(OLD_CF, NEW_CF);

// ── Op 9b : réalisé chargesFixes label span badge ────────────────────────
const OLD_CFL = `<span :class="['text-sm font-bold transition-all', isItemPaid(f, getDueFixe(f, moisBudgetaire.an)) ? 'text-slate-500 line-through' : 'text-slate-200 group-hover:text-orange-300']">{{ f.label }}</span>`;
const NEW_CFL = OLD_CFL + `
                                                 <span v-if="isFluxCetteSemaine(f.jourPrevu) && !isItemPaid(f, getDueFixe(f, moisBudgetaire.an))" class="text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded-full ml-1">⏳ Cette sem.</span>
                                                 <span v-if="f.jourPrevu && !isItemPaid(f, getDueFixe(f, moisBudgetaire.an))" class="text-[9px] text-slate-500 font-bold ml-1">j.{{ f.jourPrevu }}</span>`;
check('Op 9b : réalisé CF label anchor', html.includes(OLD_CFL));
html = html.replace(OLD_CFL, NEW_CFL);

writeFileSync(filePath, html, 'utf8');
console.log(`\n🎉 Done — ${ops}/11 ops. Fichier écrit.`);
