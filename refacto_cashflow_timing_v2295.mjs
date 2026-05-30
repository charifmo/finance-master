import { readFileSync, writeFileSync } from 'fs';

const filePath = 'C:/Users/HP/finance/index.html';
let html = readFileSync(filePath, 'utf8');
html = html.replace(/\r\n/g, '\n');

let ops = 0;
const check = (label, found) => {
    if (!found) { console.error('❌ ' + label + ' — FAILED'); process.exit(1); }
    ops++;
    console.log('✅ ' + label);
};

// ═══════════════════════════════════════════════════════════════════════════
// Op 1 : Ajouter isFluxCetteSemaine + sorted computeds après budgetSemaineReel
// ═══════════════════════════════════════════════════════════════════════════
const BUDGET_SEMAINE_END = `const budgetSemaineReel = computed(() => {
                        const jours = joursRestantsAvantPaie.value;
                        if (!jours) return null;
                        return cashDispoPourConso.value / (jours / 7);
                    });`;

const TIMING_JS = `

                    // ── v22.95 Cashflow-Timing — helpers ────────────────────────────────────
                    // Vérifie si jourPrevu (1-31) tombe dans les 7 prochains jours,
                    // en gérant le passage au mois suivant.
                    const isFluxCetteSemaine = (jourPrevu) => {
                        if (!jourPrevu || jourPrevu < 1 || jourPrevu > 31) return false;
                        const today = new Date();
                        const y = today.getFullYear();
                        const m = today.getMonth(); // 0-based
                        const d = today.getDate();
                        const todayMs = new Date(y, m, d).getTime();
                        // Try this month first, then next month
                        const candidates = [
                            new Date(y, m, jourPrevu).getTime(),
                            new Date(y, m + 1, jourPrevu).getTime(),
                        ];
                        return candidates.some(ms => {
                            const diff = Math.round((ms - todayMs) / 86400000);
                            return diff >= 0 && diff <= 7;
                        });
                    };

                    // Revenus du cycle budgétaire triés par jourPrevu (éléments sans jour à la fin)
                    const revenusBudgetairesTries = computed(() => {
                        calculationTick.value;
                        const mb = moisBudgetaire.value;
                        const d = donneesAnnuelles.value[mb.an];
                        if (!d) return [];
                        return Object.values(d.revenus || {}).slice().sort((a, b) => {
                            const ja = a.jourPrevu || 99;
                            const jb = b.jourPrevu || 99;
                            return ja - jb;
                        });
                    });

                    // Charges fixes du cycle budgétaire triées par jourPrevu
                    const chargesFixesBudgetairesTriees = computed(() => {
                        calculationTick.value;
                        const mb = moisBudgetaire.value;
                        const d = donneesAnnuelles.value[mb.an];
                        if (!d) return [];
                        return Object.values(d.chargesFixes || {}).slice().sort((a, b) => {
                            const ja = a.jourPrevu || 99;
                            const jb = b.jourPrevu || 99;
                            return ja - jb;
                        });
                    });`;

if (html.includes(BUDGET_SEMAINE_END)) {
    html = html.replace(BUDGET_SEMAINE_END, BUDGET_SEMAINE_END + TIMING_JS);
    check('Op 1 : isFluxCetteSemaine + sorted computeds', true);
} else {
    check('Op 1', false);
}

// ═══════════════════════════════════════════════════════════════════════════
// Op 2 : Exposer les nouveaux helpers dans le return
// ═══════════════════════════════════════════════════════════════════════════
const OLD_RETURN_LINE = `// v22.90 Double-Pilotage
                        revenusTheoriquesMois, engagementsTheoriquesMois, engagementsTheoriquesDetail,
                        budgetConsoTheoriqueMois, rythmeTheoriqueSemaine, pilotageTheoLignes,`;

const NEW_RETURN_LINE = `// v22.90 Double-Pilotage
                        revenusTheoriquesMois, engagementsTheoriquesMois, engagementsTheoriquesDetail,
                        budgetConsoTheoriqueMois, rythmeTheoriqueSemaine, pilotageTheoLignes,
                        // v22.95 Cashflow-Timing
                        isFluxCetteSemaine, revenusBudgetairesTries, chargesFixesBudgetairesTriees,`;

if (html.includes(OLD_RETURN_LINE)) {
    html = html.replace(OLD_RETURN_LINE, NEW_RETURN_LINE);
    check('Op 2 : return étendu (timing helpers)', true);
} else {
    check('Op 2', false);
}

// ═══════════════════════════════════════════════════════════════════════════
// Op 3 : pilotageTheoLignes — ajouter jourPrevu aux lignes revenus + fixes,
//         et trier avant return
// ═══════════════════════════════════════════════════════════════════════════
const OLD_PUSH_REVENU = `if (m > 0) out.revenus.push({ nom: r.label || r.nom || '?', montant: m });`;
const NEW_PUSH_REVENU = `if (m > 0) out.revenus.push({ nom: r.label || r.nom || '?', montant: m, jourPrevu: r.jourPrevu || null });`;

if (html.includes(OLD_PUSH_REVENU)) {
    html = html.replace(OLD_PUSH_REVENU, NEW_PUSH_REVENU);
    check('Op 3a : pilotageTheoLignes revenus jourPrevu', true);
} else {
    check('Op 3a', false);
}

const OLD_PUSH_FIXE = `if (due > 0) out.fixes.push({ nom: f.label || '?', montant: due });`;
const NEW_PUSH_FIXE = `if (due > 0) out.fixes.push({ nom: f.label || '?', montant: due, jourPrevu: f.jourPrevu || null });`;

if (html.includes(OLD_PUSH_FIXE)) {
    html = html.replace(OLD_PUSH_FIXE, NEW_PUSH_FIXE);
    check('Op 3b : pilotageTheoLignes fixes jourPrevu', true);
} else {
    check('Op 3b', false);
}

// Sort revenus + fixes before return out;
const OLD_RETURN_OUT = `                        return out;\n                    });\n\n             `;
const NEW_RETURN_OUT = `                        // Sort by jourPrevu (éléments sans jour à la fin)
                        const sortJour = (a, b) => (a.jourPrevu || 99) - (b.jourPrevu || 99);
                        out.revenus.sort(sortJour);
                        out.fixes.sort(sortJour);
                        return out;\n                    });\n\n             `;

if (html.includes(OLD_RETURN_OUT)) {
    html = html.replace(OLD_RETURN_OUT, NEW_RETURN_OUT);
    check('Op 3c : pilotageTheoLignes sort before return', true);
} else {
    check('Op 3c', false);
}

// ═══════════════════════════════════════════════════════════════════════════
// Op 4 : Pilotage Théorique template — revenus list item (badge + jour)
// ═══════════════════════════════════════════════════════════════════════════
const OLD_THEO_REV_LI = `<li v-for="(r, i) in pilotageTheoLignes.revenus" :key="'r'+i" class="flex justify-between text-xs py-1 border-b border-slate-100 last:border-0">
                                    <span class="text-slate-700 truncate max-w-[180px]">{{ r.nom }}</span>
                                    <span class="font-bold text-emerald-700">{{ formatMAD(r.montant) }}</span>
                                </li>`;

const NEW_THEO_REV_LI = `<li v-for="(r, i) in pilotageTheoLignes.revenus" :key="'r'+i" class="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-0 gap-2">
                                    <span class="text-slate-700 truncate max-w-[140px]">{{ r.nom }}</span>
                                    <div class="flex items-center gap-1.5 shrink-0">
                                        <span v-if="isFluxCetteSemaine(r.jourPrevu)" class="text-[9px] font-black bg-amber-100 text-amber-700 border border-amber-300 px-1.5 py-0.5 rounded-full">⏳ Cette semaine</span>
                                        <span v-if="r.jourPrevu" class="text-[9px] text-slate-400 font-bold">📅 j.{{ r.jourPrevu }}</span>
                                        <span class="font-bold text-emerald-700">{{ formatMAD(r.montant) }}</span>
                                    </div>
                                </li>`;

if (html.includes(OLD_THEO_REV_LI)) {
    html = html.replace(OLD_THEO_REV_LI, NEW_THEO_REV_LI);
    check('Op 4 : théo revenus list item badges', true);
} else {
    check('Op 4', false);
}

// ═══════════════════════════════════════════════════════════════════════════
// Op 5 : Pilotage Théorique template — fixes list item (badge + jour)
// ═══════════════════════════════════════════════════════════════════════════
const OLD_THEO_FIX_LI = `<li v-for="(f, i) in pilotageTheoLignes.fixes" :key="'f'+i" class="flex justify-between text-xs py-1 border-b border-slate-100 last:border-0">
                                    <span class="text-slate-700 truncate max-w-[180px]">{{ f.nom }}</span>
                                    <span class="font-bold text-orange-700">{{ formatMAD(f.montant) }}</span>
                                </li>`;

const NEW_THEO_FIX_LI = `<li v-for="(f, i) in pilotageTheoLignes.fixes" :key="'f'+i" class="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-0 gap-2">
                                    <span class="text-slate-700 truncate max-w-[140px]">{{ f.nom }}</span>
                                    <div class="flex items-center gap-1.5 shrink-0">
                                        <span v-if="isFluxCetteSemaine(f.jourPrevu)" class="text-[9px] font-black bg-amber-100 text-amber-700 border border-amber-300 px-1.5 py-0.5 rounded-full">⏳ Cette semaine</span>
                                        <span v-if="f.jourPrevu" class="text-[9px] text-slate-400 font-bold">📅 j.{{ f.jourPrevu }}</span>
                                        <span class="font-bold text-orange-700">{{ formatMAD(f.montant) }}</span>
                                    </div>
                                </li>`;

if (html.includes(OLD_THEO_FIX_LI)) {
    html = html.replace(OLD_THEO_FIX_LI, NEW_THEO_FIX_LI);
    check('Op 5 : théo fixes list item badges', true);
} else {
    check('Op 5', false);
}

// ═══════════════════════════════════════════════════════════════════════════
// Op 6 : Form revenus — ajouter champ jourPrevu après destinationCompte div
// ═══════════════════════════════════════════════════════════════════════════
const OLD_REV_DEST_ANCHOR = `                       </select>\n                            </div>\n                            <div v-if="item.showExceptions" class="mt-4 bg-blue-50/50`;

const NEW_REV_DEST_ANCHOR = `                       </select>\n                            </div>\n                            <!-- v22.95 Cashflow-Timing : jour prévu dans le mois -->\n                            <div v-if="!item.parts || !item.parts.length" class="flex items-center gap-2 mt-1 mb-1">\n                                <label class="text-[9px] font-black text-indigo-700 uppercase tracking-widest whitespace-nowrap">📅 Jour prévu :</label>\n                                <input type="number" v-model.number="item.jourPrevu" @input="handleDataChange" min="1" max="31" placeholder="ex: 27" class="w-20 p-1.5 text-xs font-black text-indigo-800 border border-indigo-200 rounded-lg bg-indigo-50 outline-none focus:ring-2 focus:ring-indigo-400 text-center"/>\n                                <span class="text-[9px] text-slate-400 font-bold">du mois (1–31)</span>\n                            </div>\n                            <div v-if="item.showExceptions" class="mt-4 bg-blue-50/50`;

if (html.includes(OLD_REV_DEST_ANCHOR)) {
    html = html.replace(OLD_REV_DEST_ANCHOR, NEW_REV_DEST_ANCHOR);
    check('Op 6 : form revenus jourPrevu champ', true);
} else {
    check('Op 6', false);
}

// ═══════════════════════════════════════════════════════════════════════════
// Op 7 : Form chargesFixes — ajouter champ jourPrevu après sourceCompte div
// ═══════════════════════════════════════════════════════════════════════════
const idx_cf_anchor = html.indexOf('v17.27 : Source (masqué si parts)');
if (idx_cf_anchor === -1) { console.error('❌ Op 7 : v17.27 anchor not found'); process.exit(1); }
const orangeShowExcIdx = html.indexOf('<div v-if="item.showExceptions" class="mt-4 bg-orange-50/50', idx_cf_anchor);
if (orangeShowExcIdx === -1) { console.error('❌ Op 7 : orange showExceptions not found'); process.exit(1); }
// Get the text just before showExceptions
const cfEnd = html.slice(orangeShowExcIdx - 150, orangeShowExcIdx + 50);
console.log('CF anchor context:', JSON.stringify(cfEnd));

const OLD_CF_DEST_ANCHOR = html.slice(orangeShowExcIdx - 50, orangeShowExcIdx + 50);
const NEW_CF_DEST_ANCHOR = OLD_CF_DEST_ANCHOR.replace(
    '<div v-if="item.showExceptions" class="mt-4 bg-orange-50/50',
    '<!-- v22.95 Cashflow-Timing : jour prévu dans le mois -->\n                            <div v-if="!item.parts || !item.parts.length" class="flex items-center gap-2 mt-1 mb-1">\n                                <label class="text-[9px] font-black text-indigo-700 uppercase tracking-widest whitespace-nowrap">📅 Jour prévu :</label>\n                                <input type="number" v-model.number="item.jourPrevu" @input="handleDataChange" min="1" max="31" placeholder="ex: 4" class="w-20 p-1.5 text-xs font-black text-indigo-800 border border-indigo-200 rounded-lg bg-indigo-50 outline-none focus:ring-2 focus:ring-indigo-400 text-center"/>\n                                <span class="text-[9px] text-slate-400 font-bold">du mois (1–31)</span>\n                            </div>\n                            <div v-if="item.showExceptions" class="mt-4 bg-orange-50/50'
);
if (OLD_CF_DEST_ANCHOR === NEW_CF_DEST_ANCHOR) { console.error('❌ Op 7 : replacement failed (no change)'); process.exit(1); }
html = html.slice(0, orangeShowExcIdx - 50) + NEW_CF_DEST_ANCHOR + html.slice(orangeShowExcIdx + 50);
check('Op 7 : form chargesFixes jourPrevu champ', true);

// ═══════════════════════════════════════════════════════════════════════════
// Op 8 : Réalisé — revenus v-for → sorted array + label span badge
// ═══════════════════════════════════════════════════════════════════════════
const OLD_REEL_REV_VFOR = `<div v-for="(rev, key) in donneesAnnuelles[moisBudgetaire.an]?.revenus" :key="'rev_' + key"
                                         class="flex items-center justify-between p-3 bg-slate-900/90 rounded-xl group border border-slate-700 hover:border-green-500 transition-all">`;

const NEW_REEL_REV_VFOR = `<div v-for="(rev, key) in revenusBudgetairesTries" :key="'rev_' + key"
                                         class="flex items-center justify-between p-3 bg-slate-900/90 rounded-xl group border border-slate-700 hover:border-green-500 transition-all">`;

if (html.includes(OLD_REEL_REV_VFOR)) {
    html = html.replace(OLD_REEL_REV_VFOR, NEW_REEL_REV_VFOR);
    check('Op 8a : réalisé revenus v-for → sorted', true);
} else {
    check('Op 8a', false);
}

const OLD_REEL_REV_LABEL = `<span :class="['text-sm font-bold transition-all', isItemPaid(rev, Number(rev.base || 0)) ? 'text-slate-500 line-through' : 'text-slate-200 group-hover:text-green-300']">{{ rev.label }}</span>`;

const NEW_REEL_REV_LABEL = `<span :class="['text-sm font-bold transition-all', isItemPaid(rev, Number(rev.base || 0)) ? 'text-slate-500 line-through' : 'text-slate-200 group-hover:text-green-300']">{{ rev.label }}</span>
                                             <span v-if="isFluxCetteSemaine(rev.jourPrevu) && !isItemPaid(rev, Number(rev.base || 0))" class="text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded-full ml-1">⏳ Cette sem.</span>
                                             <span v-if="rev.jourPrevu && !isItemPaid(rev, Number(rev.base || 0))" class="text-[9px] text-slate-500 font-bold ml-1">j.{{ rev.jourPrevu }}</span>`;

if (html.includes(OLD_REEL_REV_LABEL)) {
    html = html.replace(OLD_REEL_REV_LABEL, NEW_REEL_REV_LABEL);
    check('Op 8b : réalisé revenus label badges', true);
} else {
    check('Op 8b', false);
}

// ═══════════════════════════════════════════════════════════════════════════
// Op 9 : Réalisé — chargesFixes v-for → sorted array + label span badge
// ═══════════════════════════════════════════════════════════════════════════
const OLD_REEL_CF_VFOR = `<div v-for="(f, key) in donneesAnnuelles[moisBudgetaire.an]?.chargesFixes" :key="key" class="flex items-center justify-between p-3 bg-slate-900/90 rounded-xl group border border-slate-700 hover:border-orange-500 transition-all">`;

const NEW_REEL_CF_VFOR = `<div v-for="(f, key) in chargesFixesBudgetairesTriees" :key="key" class="flex items-center justify-between p-3 bg-slate-900/90 rounded-xl group border border-slate-700 hover:border-orange-500 transition-all">`;

if (html.includes(OLD_REEL_CF_VFOR)) {
    html = html.replace(OLD_REEL_CF_VFOR, NEW_REEL_CF_VFOR);
    check('Op 9a : réalisé chargesFixes v-for → sorted', true);
} else {
    check('Op 9a', false);
}

const OLD_REEL_CF_LABEL = `<span :class="['text-sm font-bold transition-all', isItemPaid(f, getDueFixe(f, moisBudgetaire.an)) ? 'text-slate-500 line-through' : 'text-slate-200 group-hover:text-orange-300']">{{ f.label }}</span>`;

const NEW_REEL_CF_LABEL = `<span :class="['text-sm font-bold transition-all', isItemPaid(f, getDueFixe(f, moisBudgetaire.an)) ? 'text-slate-500 line-through' : 'text-slate-200 group-hover:text-orange-300']">{{ f.label }}</span>
                                                 <span v-if="isFluxCetteSemaine(f.jourPrevu) && !isItemPaid(f, getDueFixe(f, moisBudgetaire.an))" class="text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded-full ml-1">⏳ Cette sem.</span>
                                                 <span v-if="f.jourPrevu && !isItemPaid(f, getDueFixe(f, moisBudgetaire.an))" class="text-[9px] text-slate-500 font-bold ml-1">j.{{ f.jourPrevu }}</span>`;

if (html.includes(OLD_REEL_CF_LABEL)) {
    html = html.replace(OLD_REEL_CF_LABEL, NEW_REEL_CF_LABEL);
    check('Op 9b : réalisé chargesFixes label badges', true);
} else {
    check('Op 9b', false);
}

// ═══════════════════════════════════════════════════════════════════════════
// Op 10 : Version bump → 22.95 Cashflow-Timing
// ═══════════════════════════════════════════════════════════════════════════
const OLD_VER = `"22.90 Double-Pilotage"`;
const NEW_VER = `"22.95 Cashflow-Timing"`;
if (html.includes(OLD_VER)) {
    html = html.replace(OLD_VER, NEW_VER);
    check('Op 10 : version → 22.95 Cashflow-Timing', true);
} else {
    check('Op 10', false);
}

writeFileSync(filePath, html, 'utf8');
console.log(`\n🎉 Done — ${ops}/12 ops appliquées. Fichier écrit.`);
