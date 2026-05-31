import { readFileSync, writeFileSync } from 'fs';

const SRC = 'C:/Users/HP/finance/index.html';
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

// ─── ANCHORS ───────────────────────────────────────────────────────────────────
check('v-for+v-if surplus (52px grid)',
    `                                    <div v-for="row in surplusParMois" v-if="!row.isPast" :key="row.mNum"`);
check('v-for+v-if surplus (44px grid)',
    `                                <div v-for="row in surplusParMois" v-if="!row.isPast" :key="row.mNum"`);
check('startDragCfoWidget jump',
    `                        const ox = e.clientX - rect.left, oy = e.clientY - rect.top;\n                        modal.style.bottom = 'auto';`);
check('title bar Briefer button',
    `                            <button @click.stop="transfererAuditAuCFO" class="text-[9px] text-fuchsia-100 hover:text-white font-bold uppercase tracking-widest hover:bg-white/10 px-2 py-0.5 rounded transition-colors">⚡ Briefer</button>`);
check('transfererAuditAuCFO setTimeout end',
    `                        setTimeout(() => { envoyerCFO(); }, 500);\n                    };`);
check('return startDragCfoWidget',
    `chatFullScreen, showCfoModal, startDragCfoWidget, consulterCFO`);
check('content wrapper flex-col',
    `                    <!-- ── Contenu flex-col v26.95 : single-column, chat flex-1 ── -->\n                    <div class="flex-1 min-h-0 flex flex-col overflow-hidden">`);
check('Version v26.95',
    `v26.95 Modal-Layout-Fix`);

if (errors > 0) { console.error(`\n${errors} ancre(s) — abandon.`); process.exit(1); }

// ─── OP1 : Fix Vue3 v-for+v-if sur surplusParMois — 52px (popup plein écran) ──
replace('OP1 fix v-for+v-if surplus 52px',
    `                                    <div v-for="row in surplusParMois" v-if="!row.isPast" :key="row.mNum"
                                         :class="['grid grid-cols-[52px_1fr_1fr_1fr] px-3 py-1 hover:bg-gray-800 transition-colors items-center', row.isCurrent ? 'bg-blue-900/30 border-l-2 border-blue-400' : '']">
                                        <span class="text-[9px] font-bold whitespace-nowrap" :class="row.isCurrent ? 'text-blue-200' : 'text-gray-400'">{{ nomDuMois(row.mNum).slice(0,4) }}{{ row.isCurrent ? ' ✓' : '' }}</span>
                                        <span class="text-[9px] font-black tabular-nums text-right whitespace-nowrap" :class="row.brut >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ row.brut >= 0 ? '+' : '' }}{{ formatMAD(row.brut) }}</span>
                                        <span class="text-[9px] font-black tabular-nums text-right text-purple-400 whitespace-nowrap">{{ row.epargne > 0 ? '-' : '' }}{{ formatMAD(row.epargne) }}</span>
                                        <span class="text-[9px] font-black tabular-nums text-right whitespace-nowrap" :class="row.net >= 0 ? 'text-blue-300' : 'text-rose-400'">{{ row.net >= 0 ? '+' : '' }}{{ formatMAD(row.net) }}</span>
                                    </div>`,
    `                                    <template v-for="row in surplusParMois" :key="row.mNum">
                                    <div v-if="!row.isPast"
                                         :class="['grid grid-cols-[52px_1fr_1fr_1fr] px-3 py-1 hover:bg-gray-800 transition-colors items-center', row.isCurrent ? 'bg-blue-900/30 border-l-2 border-blue-400' : '']">
                                        <span class="text-[9px] font-bold whitespace-nowrap" :class="row.isCurrent ? 'text-blue-200' : 'text-gray-400'">{{ nomDuMois(row.mNum).slice(0,4) }}{{ row.isCurrent ? ' ✓' : '' }}</span>
                                        <span class="text-[9px] font-black tabular-nums text-right whitespace-nowrap" :class="row.brut >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ row.brut >= 0 ? '+' : '' }}{{ formatMAD(row.brut) }}</span>
                                        <span class="text-[9px] font-black tabular-nums text-right text-purple-400 whitespace-nowrap">{{ row.epargne > 0 ? '-' : '' }}{{ formatMAD(row.epargne) }}</span>
                                        <span class="text-[9px] font-black tabular-nums text-right whitespace-nowrap" :class="row.net >= 0 ? 'text-blue-300' : 'text-rose-400'">{{ row.net >= 0 ? '+' : '' }}{{ formatMAD(row.net) }}</span>
                                    </div>
                                    </template>`
);

// ─── OP2 : Fix Vue3 v-for+v-if sur surplusParMois — 44px (sidebar compacte) ──
replace('OP2 fix v-for+v-if surplus 44px',
    `                                <div v-for="row in surplusParMois" v-if="!row.isPast" :key="row.mNum"
                                     :class="['grid grid-cols-[44px_1fr_1fr_1fr] px-2 py-0.5 items-center', row.isCurrent ? 'bg-blue-900/30 border-l-2 border-blue-400' : '']">
                                    <span class="text-[8px] font-bold whitespace-nowrap" :class="row.isCurrent ? 'text-blue-200' : 'text-gray-400'">{{ nomDuMois(row.mNum).slice(0,4) }}{{ row.isCurrent ? ' ✓' : '' }}</span>
                                    <span class="text-[8px] font-black tabular-nums text-right whitespace-nowrap" :class="row.brut >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ row.brut >= 0 ? '+' : '' }}{{ formatMAD(row.brut) }}</span>
                                    <span class="text-[8px] font-black tabular-nums text-right text-purple-400 whitespace-nowrap">{{ row.epargne > 0 ? '-' : '' }}{{ formatMAD(row.epargne) }}</span>
                                    <span class="text-[8px] font-black tabular-nums text-right whitespace-nowrap" :class="row.net >= 0 ? 'text-blue-300' : 'text-rose-400'">{{ row.net >= 0 ? '+' : '' }}{{ formatMAD(row.net) }}</span>
                                </div>`,
    `                                <template v-for="row in surplusParMois" :key="row.mNum">
                                <div v-if="!row.isPast"
                                     :class="['grid grid-cols-[44px_1fr_1fr_1fr] px-2 py-0.5 items-center', row.isCurrent ? 'bg-blue-900/30 border-l-2 border-blue-400' : '']">
                                    <span class="text-[8px] font-bold whitespace-nowrap" :class="row.isCurrent ? 'text-blue-200' : 'text-gray-400'">{{ nomDuMois(row.mNum).slice(0,4) }}{{ row.isCurrent ? ' ✓' : '' }}</span>
                                    <span class="text-[8px] font-black tabular-nums text-right whitespace-nowrap" :class="row.brut >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ row.brut >= 0 ? '+' : '' }}{{ formatMAD(row.brut) }}</span>
                                    <span class="text-[8px] font-black tabular-nums text-right text-purple-400 whitespace-nowrap">{{ row.epargne > 0 ? '-' : '' }}{{ formatMAD(row.epargne) }}</span>
                                    <span class="text-[8px] font-black tabular-nums text-right whitespace-nowrap" :class="row.net >= 0 ? 'text-blue-300' : 'text-rose-400'">{{ row.net >= 0 ? '+' : '' }}{{ formatMAD(row.net) }}</span>
                                </div>
                                </template>`
);

// ─── OP3 : Fix startDragCfoWidget — pas de saut immédiat sur mousedown ─────────
replace('OP3 fix drag no jump',
    `                        const ox = e.clientX - rect.left, oy = e.clientY - rect.top;
                        modal.style.bottom = 'auto';
                        const onMove = ev => { modal.style.left = (ev.clientX - ox) + 'px'; modal.style.top = (ev.clientY - oy) + 'px'; };`,
    `                        const ox = e.clientX - rect.left, oy = e.clientY - rect.top;
                        // v27.0 : ne pas bouger avant le premier déplacement (évite le saut sur simple clic)
                        let anchored = false;
                        const onMove = ev => {
                            if (!anchored) {
                                anchored = true;
                                modal.style.top  = rect.top  + 'px';
                                modal.style.left = rect.left + 'px';
                                modal.style.bottom = 'auto';
                                modal.style.right  = 'auto';
                            }
                            modal.style.left = (ev.clientX - ox) + 'px';
                            modal.style.top  = (ev.clientY - oy) + 'px';
                        };`
);

// ─── OP4 : Title bar buttons — @mousedown.stop + Briefer → brieferCFO ─────────
replace('OP4 title bar mousedown.stop + brieferCFO',
    `                            <button @click.stop="transfererAuditAuCFO" class="text-[9px] text-fuchsia-100 hover:text-white font-bold uppercase tracking-widest hover:bg-white/10 px-2 py-0.5 rounded transition-colors">⚡ Briefer</button>
                            <button @click.stop="resetCFOSession" class="text-[9px] text-fuchsia-100 hover:text-white font-bold uppercase tracking-widest hover:bg-white/10 px-2 py-0.5 rounded transition-colors">🔄 Reset</button>
                            <button @click.stop="showCfoModal = false" class="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/20 text-white font-black text-base transition-colors" title="Fermer">✕</button>`,
    `                            <button @mousedown.stop @click.stop="brieferCFO" class="text-[9px] text-fuchsia-100 hover:text-white font-bold uppercase tracking-widest hover:bg-white/10 px-2 py-0.5 rounded transition-colors">⚡ Briefer</button>
                            <button @mousedown.stop @click.stop="resetCFOSession" class="text-[9px] text-fuchsia-100 hover:text-white font-bold uppercase tracking-widest hover:bg-white/10 px-2 py-0.5 rounded transition-colors">🔄 Reset</button>
                            <button @mousedown.stop @click.stop="showCfoModal = false" class="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/20 text-white font-black text-base transition-colors" title="Fermer">✕</button>`
);

// ─── OP5 : Ajouter brieferCFO après transfererAuditAuCFO ──────────────────────
replace('OP5 add brieferCFO function',
    `                        setTimeout(() => { envoyerCFO(); }, 500);
                    };`,
    `                        setTimeout(() => { envoyerCFO(); }, 500);
                    };
                    // v27.0 : injecte le prompt d'audit dans l'input sans auto-envoi (validation manuelle)
                    const brieferCFO = () => {
                        const a = auditFinancier.value;
                        const aNum = anneeAffichage.value;
                        const emoji = { vert: '🟢', orange: '🟠', rouge: '🔴' };
                        cfoInput.value = \`Agis en tant que CFO. Analyse ces 7 KPIs financiers pour \${aNum}, identifie mon plus grand risque actuel et propose 2 actions de crise concrètes et chiffrées à exécuter ce mois-ci.

⚡ COURT TERME
- Liquidité \${emoji[a.liquidite.score]} : \${a.liquidite.detail}
- Budget Jour \${emoji[a.budgetJour.score]} : \${a.budgetJour.detail}

🛡️ MOYEN TERME
- Fonds de Survie \${emoji[a.fondsSurvie.score]} : \${a.fondsSurvie.detail}
- Rigidité \${emoji[a.rigidite.score]} : \${a.rigidite.detail}

📈 LONG TERME
- Endettement \${emoji[a.endettement.score]} : \${a.endettement.detail}
- Taux d'Épargne \${emoji[a.tauxEpargne.score]} : \${a.tauxEpargne.detail}
- Cash Drag \${emoji[a.cashDrag.score]} : \${a.cashDrag.detail}

Score global : \${a.scoreTotal}/14 (\${a.scoreGlobal === 'vert' ? 'SAIN' : (a.scoreGlobal === 'orange' ? 'VIGILANCE' : 'CRITIQUE')})\`;
                    };`
);

// ─── OP6 : Ajouter brieferCFO au return ───────────────────────────────────────
replace('OP6 return brieferCFO',
    `chatFullScreen, showCfoModal, startDragCfoWidget, consulterCFO`,
    `chatFullScreen, showCfoModal, startDragCfoWidget, brieferCFO, consulterCFO`
);

// ─── OP7 : Content wrapper — w-full pour resize fluide ────────────────────────
replace('OP7 content wrapper w-full',
    `                    <!-- ── Contenu flex-col v26.95 : single-column, chat flex-1 ── -->
                    <div class="flex-1 min-h-0 flex flex-col overflow-hidden">`,
    `                    <!-- ── Contenu flex-col v27.0 : single-column, chat flex-1, resize fluide ── -->
                    <div class="flex-1 min-h-0 w-full flex flex-col overflow-hidden">`
);

// ─── OP8 : Bump version ───────────────────────────────────────────────────────
replace('OP8 bump 26.95 → 27.0',
    `v26.95 Modal-Layout-Fix`,
    `v27.0 Crash-Fix-And-Layout`
);

// ─── SAVE ─────────────────────────────────────────────────────────────────────
if (errors > 0) { console.error(`\n${errors} erreur(s) — fichier NON modifié.`); process.exit(1); }
if (html === orig) { console.warn('\n⚠️  Aucun changement détecté.'); process.exit(1); }

writeFileSync(SRC, html.replace(/\n/g, '\r\n'), 'utf8');
console.log('\n✅ index.html → v27.0 Crash-Fix-And-Layout');
