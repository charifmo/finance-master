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
check('showCfoWidget ref',
    `const showCfoWidget = ref(false); // v26.80 : widget modal flottant CFO`);
check('showCfoWidget return',
    `chatFullScreen, showCfoWidget, startDragCfoWidget, consulterCFO`);
check('FAB toggle',
    `        <button @click="showCfoWidget = !showCfoWidget"`);
check('Modal comment v26.80',
    `                <!-- v26.80 CFO-Floating-Widget — modale redimensionnable (Teleport → body, v-show persistant) -->`);
check('Audit column comment',
    `                    <!-- ── GAUCHE : Audit 7-KPI ── -->`);
check('showCfoWidget.value in transferer',
    `                        showCfoWidget.value = true; // v26.80 : ouvre le widget flottant`);
check('Version v26.80',
    `v26.80 CFO-Floating-Widget`);

if (errors > 0) { console.error(`\n${errors} ancre(s) — abandon.`); process.exit(1); }

// ─── OP1 : rename ref ──────────────────────────────────────────────────────────
replace('OP1 rename ref',
    `const showCfoWidget = ref(false); // v26.80 : widget modal flottant CFO`,
    `const showCfoModal = ref(false); // v26.95 : widget modal flottant CFO`
);

// ─── OP2 : rename return ───────────────────────────────────────────────────────
replace('OP2 rename return',
    `chatFullScreen, showCfoWidget, startDragCfoWidget, consulterCFO`,
    `chatFullScreen, showCfoModal, startDragCfoWidget, consulterCFO`
);

// ─── OP3 : FAB — rename + toggle → true ───────────────────────────────────────
replace('OP3 FAB showCfoModal = true',
    `        <button @click="showCfoWidget = !showCfoWidget"
            title="Ouvrir le CFO & Audit"
            :class="['fixed z-[9995] rounded-full flex items-center justify-center border-2 transition-all hover:scale-110 shadow-xl',
                     'bottom-60 right-4 w-12 h-12 text-xl',
                     'md:bottom-[10.5rem] md:left-6 md:right-auto md:w-16 md:h-16 md:text-3xl',
                     showCfoWidget
                       ? 'bg-gradient-to-br from-fuchsia-500 to-purple-700 text-white border-fuchsia-300 shadow-fuchsia-900/50'
                       : 'bg-gradient-to-br from-slate-800 to-slate-900 text-fuchsia-300 border-fuchsia-500/40 shadow-slate-900/50']">
            🧠
        </button>`,
    `        <button @click="showCfoModal = true"
            title="Ouvrir le CFO & Audit"
            :class="['fixed z-[9995] rounded-full flex items-center justify-center border-2 transition-all hover:scale-110 shadow-xl',
                     'bottom-60 right-4 w-12 h-12 text-xl',
                     'md:bottom-[10.5rem] md:left-6 md:right-auto md:w-16 md:h-16 md:text-3xl',
                     showCfoModal
                       ? 'bg-gradient-to-br from-fuchsia-500 to-purple-700 text-white border-fuchsia-300 shadow-fuchsia-900/50'
                       : 'bg-gradient-to-br from-slate-800 to-slate-900 text-fuchsia-300 border-fuchsia-500/40 shadow-slate-900/50']">
            🧠
        </button>`
);

// ─── OP4a : modal header — comment + Teleport + modal div + title bar + old grid start ───
replace('OP4a modal header',
    `                <!-- v26.80 CFO-Floating-Widget — modale redimensionnable (Teleport → body, v-show persistant) -->
                <Teleport to="body">
                <div id="cfo-widget-modal" v-show="showCfoWidget"
                     class="fixed z-[9990] bg-white rounded-2xl shadow-2xl border border-fuchsia-200/60 flex flex-col overflow-hidden"
                     style="resize:both;overflow:auto;min-width:350px;min-height:400px;max-width:90vw;max-height:90vh;width:min(740px,90vw);height:min(640px,85vh);bottom:5.5rem;left:5rem;">
                    <!-- ── Barre de titre (drag-to-move) ── -->
                    <div class="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-fuchsia-600 to-purple-700 text-white shrink-0 cursor-move select-none"
                         @mousedown="startDragCfoWidget">
                        <div class="flex items-center gap-2 pointer-events-none">
                            <span class="font-black text-sm">🧠 CFO &amp; Audit</span>
                            <span class="text-[8px] bg-white/10 px-1.5 py-0.5 rounded-full font-mono text-white/60">{{ cfoSessionId.slice(0,13) }}…</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <button @click.stop="resetCFOSession" class="text-[9px] text-fuchsia-100 hover:text-white font-bold uppercase tracking-widest hover:bg-white/10 px-2 py-0.5 rounded transition-colors">🔄 Reset</button>
                            <button @click.stop="showCfoWidget = false" class="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/20 text-white font-black text-base transition-colors" title="Fermer">✕</button>
                        </div>
                    </div>
                    <!-- ── Contenu scrollable ── -->
                    <div class="flex-1 overflow-auto min-h-0 p-4">
                    <div class="grid lg:grid-cols-12 gap-5">`,
    `                <!-- v26.95 CFO-Modal-Layout-Fix — single-column chat, flex fluide, v-show persistant -->
                <Teleport to="body">
                <div id="cfo-widget-modal" v-show="showCfoModal"
                     class="fixed z-[9990] bg-white rounded-2xl shadow-2xl border border-fuchsia-200/60 flex flex-col"
                     style="resize:both;overflow:hidden;min-width:320px;min-height:380px;max-width:95vw;max-height:92vh;width:min(620px,90vw);height:min(600px,85vh);bottom:5.5rem;left:5rem;">
                    <!-- ── Barre de titre (drag-to-move) ── -->
                    <div class="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-fuchsia-600 to-purple-700 text-white shrink-0 cursor-move select-none"
                         @mousedown="startDragCfoWidget">
                        <div class="flex items-center gap-2">
                            <span class="font-black text-sm pointer-events-none">🧠 CFO &amp; Audit</span>
                            <span class="text-[8px] bg-white/10 px-1.5 py-0.5 rounded-full font-mono text-white/60 pointer-events-none">{{ cfoSessionId.slice(0,13) }}…</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <button @click.stop="transfererAuditAuCFO" class="text-[9px] text-fuchsia-100 hover:text-white font-bold uppercase tracking-widest hover:bg-white/10 px-2 py-0.5 rounded transition-colors">⚡ Briefer</button>
                            <button @click.stop="resetCFOSession" class="text-[9px] text-fuchsia-100 hover:text-white font-bold uppercase tracking-widest hover:bg-white/10 px-2 py-0.5 rounded transition-colors">🔄 Reset</button>
                            <button @click.stop="showCfoModal = false" class="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/20 text-white font-black text-base transition-colors" title="Fermer">✕</button>
                        </div>
                    </div>
                    <!-- ── Contenu flex-col v26.95 : single-column, chat flex-1 ── -->
                    <div class="flex-1 min-h-0 flex flex-col overflow-hidden">`
);

// ─── OP4b : replace audit + chat columns with single-column flex (indexOf) ─────
{
    const AUDIT_START = '\n\n                    <!-- ── GAUCHE : Audit 7-KPI ── -->';
    const TELEPORT_END = '                </Teleport>';
    const p1 = html.indexOf(AUDIT_START);
    const p2 = html.indexOf(TELEPORT_END, p1 > -1 ? p1 : 0);
    if (p1 === -1 || p2 === -1) {
        console.error('❌ OP4b: audit start or Teleport end not found'); errors++;
    } else {
        const newContent = `

                        <div v-if="!cfoWebhookUrl" class="m-4 bg-orange-50 border-2 border-orange-300 p-5 rounded-2xl shrink-0">
                            <p class="text-xs font-black uppercase tracking-widest text-orange-800 mb-2">⚠️ Configuration requise</p>
                            <p class="text-xs text-orange-700 mb-3 leading-relaxed">Collez ici l'URL du Webhook n8n (path <code class="bg-white px-1 rounded font-mono">finance-cfo-web</code>) :</p>
                            <input v-model="cfoWebhookInput" @keyup.enter="saveCFOWebhook" type="url" placeholder="https://n8n.votre-vps.com/webhook/finance-cfo-web" class="w-full p-3 border-2 border-orange-300 rounded-lg font-mono text-xs bg-white outline-none focus:border-orange-500 mb-3" />
                            <button @click="saveCFOWebhook" class="w-full py-3 bg-orange-600 text-white font-black rounded-lg uppercase text-[10px] tracking-widest hover:bg-orange-700">Enregistrer l\\'URL</button>
                        </div>

                        <div v-if="cfoWebhookUrl" class="flex-1 min-h-0 overflow-y-auto bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 mx-3 mt-3 rounded-2xl shadow-2xl border border-slate-700 p-4" ref="cfoChatContainer">
                            <div v-if="cfoMessages.length === 0" class="text-center py-16">
                                <p class="text-5xl mb-4">🤖</p>
                                <p class="text-slate-300 font-bold text-sm uppercase tracking-widest mb-2">CFO prêt</p>
                                <p class="text-slate-500 text-xs font-medium max-w-md mx-auto leading-relaxed">Exemple : <i>« Je veux épargner 2000 DH de plus par mois, comment faire ? »</i> ou cliquez sur <b>⚡ Briefer</b> pour un audit immédiat.</p>
                            </div>
                            <div v-else class="space-y-4">
                                <div v-for="(msg, idx) in cfoMessages" :key="idx" :class="['flex', msg.role === 'user' ? 'justify-end' : 'justify-start']">
                                    <div :class="['max-w-[80%] p-4 rounded-2xl shadow-lg', msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white text-gray-800 border border-slate-200']">
                                        <p v-if="msg.role === 'user'" class="text-sm font-medium whitespace-pre-wrap">{{ msg.content }}</p>
                                        <div v-else class="text-sm cfo-html" v-html="msg.content"></div>
                                        <p :class="['text-[9px] mt-2 font-mono uppercase tracking-widest', msg.role === 'user' ? 'text-blue-200' : 'text-gray-400']">{{ msg.time }}</p>
                                    </div>
                                </div>
                                <div v-if="cfoLoading" class="flex justify-start">
                                    <div class="bg-white text-gray-800 p-4 rounded-2xl shadow-lg border border-slate-200">
                                        <div class="flex items-center gap-2">
                                            <span class="inline-block w-2 h-2 rounded-full bg-fuchsia-500 animate-pulse"></span>
                                            <span class="inline-block w-2 h-2 rounded-full bg-fuchsia-500 animate-pulse" style="animation-delay: 0.2s"></span>
                                            <span class="inline-block w-2 h-2 rounded-full bg-fuchsia-500 animate-pulse" style="animation-delay: 0.4s"></span>
                                            <span class="text-xs text-gray-500 font-bold ml-2">Le CFO analyse…</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div v-if="cfoWebhookUrl" class="shrink-0 flex gap-2 p-3">
                            <input v-model="cfoInput" @keyup.enter="envoyerCFO" :disabled="cfoLoading" type="text" placeholder="Posez votre question au CFO…" class="flex-1 p-3 border-2 border-gray-200 rounded-xl outline-none focus:border-fuchsia-500 text-sm disabled:bg-gray-100 bg-white shadow" />
                            <button @click="envoyerCFO" :disabled="cfoLoading || !cfoInput.trim()" class="px-5 py-3 bg-gradient-to-r from-fuchsia-600 to-purple-700 text-white font-black rounded-xl uppercase text-[10px] tracking-widest shadow hover:scale-105 transition-all disabled:opacity-50 disabled:scale-100 shrink-0">Envoyer</button>
                        </div>

                        <div v-if="cfoWebhookUrl && cfoMessages.length === 0" class="shrink-0 grid grid-cols-3 gap-2 px-3 pb-2">
                            <button @click="cfoInput = 'Fais un diagnostic complet de ma situation financière'; envoyerCFO()" class="p-3 bg-white border border-gray-200 rounded-xl text-left hover:border-fuchsia-400 transition-colors shadow-sm">
                                <p class="text-[10px] font-black uppercase tracking-widest text-fuchsia-700 mb-1">📊 Diagnostic</p>
                                <p class="text-[9px] text-gray-600">Bilan global</p>
                            </button>
                            <button @click="cfoInput = 'Comment puis-je augmenter mon épargne de 2000 DH/mois ?'; envoyerCFO()" class="p-3 bg-white border border-gray-200 rounded-xl text-left hover:border-fuchsia-400 transition-colors shadow-sm">
                                <p class="text-[10px] font-black uppercase tracking-widest text-fuchsia-700 mb-1">💰 Épargne</p>
                                <p class="text-[9px] text-gray-600">+2000 DH/mois</p>
                            </button>
                            <button @click="cfoInput = 'Analyse mes charges fixes et propose 3 pistes d\\'optimisation'; envoyerCFO()" class="p-3 bg-white border border-gray-200 rounded-xl text-left hover:border-fuchsia-400 transition-colors shadow-sm">
                                <p class="text-[10px] font-black uppercase tracking-widest text-fuchsia-700 mb-1">🔒 Optimiser</p>
                                <p class="text-[9px] text-gray-600">Réduire les charges</p>
                            </button>
                        </div>

                        <div class="shrink-0 bg-slate-50 mx-3 mb-3 p-3 rounded-xl border border-slate-200 text-[10px] text-gray-600 font-medium leading-relaxed">
                            <p class="font-black uppercase text-slate-700 mb-1 tracking-widest text-[9px]">🔐 Sécurité</p>
                            <ul class="space-y-0.5 list-disc pl-4">
                                <li>Le CFO ne modifie jamais vos données sans votre accord explicite par <b>OUI</b>.</li>
                                <li>Chaque simulation est affichée <b>Avant / Après</b> pour validation.</li>
                                <li>La mémoire conversationnelle est conservée côté VPS (PostgreSQL).</li>
                            </ul>
                        </div>

                    </div><!-- /flex-col-content -->
                </div><!-- /cfo-widget-modal -->
                </Teleport>`;
        html = html.slice(0, p1) + newContent + html.slice(p2 + TELEPORT_END.length);
        console.log('✅ REPLACED: OP4b single-column chat layout');
    }
}

if (errors > 0) { console.error(`\n${errors} erreur(s) après OP4 — abandon.`); process.exit(1); }

// ─── OP5 : transfererAuditAuCFO rename ────────────────────────────────────────
replace('OP5 rename transferer showCfoModal',
    `                        showCfoWidget.value = true; // v26.80 : ouvre le widget flottant`,
    `                        showCfoModal.value = true; // v26.95 : ouvre le widget flottant`
);

// ─── OP6 : bump version ───────────────────────────────────────────────────────
replace('OP6 bump 26.80 → 26.95',
    `v26.80 CFO-Floating-Widget`,
    `v26.95 Modal-Layout-Fix`
);

// ─── SAVE ─────────────────────────────────────────────────────────────────────
if (errors > 0) { console.error(`\n${errors} erreur(s) — fichier NON modifié.`); process.exit(1); }
if (html === orig) { console.warn('\n⚠️  Aucun changement détecté.'); process.exit(1); }

writeFileSync(SRC, html.replace(/\n/g, '\r\n'), 'utf8');
console.log('\n✅ index.html → v26.95 Modal-Layout-Fix');
