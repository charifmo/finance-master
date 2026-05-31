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

// ─────────────────────────────────────────────────────────────────────────────
// VÉRIFICATION DES ANCRES
// ─────────────────────────────────────────────────────────────────────────────

check('Sidebar CFO button',
    `                    <button @click="activeTab = 'cfo'" :class="['w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors text-sm font-bold', activeTab === 'cfo' ? 'bg-gradient-to-r from-fuchsia-600 to-purple-700 shadow-lg shadow-purple-900/50' : 'hover:bg-slate-800 text-slate-300']">🧠 CFO & Audit <span class="ml-auto text-[9px] bg-purple-900/80 text-purple-100 px-1.5 py-0.5 rounded border border-purple-400/30">v14</span></button>`);

check('Mobile nav CFO button',
    `                <button @click="activeMobileTab = 'cfo'"
                        :class="['flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors', activeMobileTab === 'cfo' ? 'text-fuchsia-600 bg-fuchsia-50' : 'text-gray-500']">
                    <span class="text-lg">🧠</span>
                    <span class="text-[8px] font-black uppercase tracking-wider">CFO</span>
                </button>`);

check('Journal FAB closing tag + fade transition',
    `            📑\n        </button>\n        <transition name="fade">`);

check('Teleport + chatFullScreen + CFO tab opening',
    `                <!-- Bouton flottant plein écran -->
                <Teleport to="body">
                    <button v-if="chatFullScreen" @click="chatFullScreen = false"
                        class="fixed top-4 right-4 z-[9999] flex items-center gap-2 bg-slate-800/90 backdrop-blur text-white text-xs font-black uppercase tracking-widest px-4 py-2 rounded-full shadow-2xl border border-slate-600 hover:bg-fuchsia-700 transition-colors">
                        🗗 Réduire
                    </button>
                </Teleport>

                <!-- === CFO & AUDIT (v15.10 — Unified Control Center) === -->
                <div v-if="activeTab === 'cfo'" class="grid lg:grid-cols-12 gap-5">`);

check('CFO tab closing + next section start',
    `                                <li>La mémoire conversationnelle est conservée côté VPS (PostgreSQL).</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <!-- ═══════════════════════════════════════════════════════════ -->
                <!-- ONGLET PARAMÈTRES v15                                       -->`);

check('Chat container max-height',
    `chatFullScreen ? 'max-h-[calc(100vh-200px)]' : 'max-h-[60vh] lg:max-h-[520px]'`);

check('transfererAuditAuCFO activeTab',
    `                        activeTab.value = 'cfo';\n                        if (isMobile.value)`);

check('chatFullScreen ref definition',
    `                    const chatFullScreen = ref(false);`);

check('Return statement CFO line',
    `                        cfoMessages, cfoInput, cfoLoading, cfoSessionId, cfoWebhookUrl, cfoWebhookInput, cfoChatContainer, chatFullScreen, consulterCFO, envoyerCFO, saveCFOWebhook, resetCFOSession,`);

if (errors > 0) { console.error(`\n${errors} ancre(s) — abandon.`); process.exit(1); }

// ─────────────────────────────────────────────────────────────────────────────
// OP1 : Ajouter showCfoWidget ref + startDragCfoWidget fn juste après chatFullScreen
// ─────────────────────────────────────────────────────────────────────────────
replace('OP1 showCfoWidget ref',
    `                    const chatFullScreen = ref(false);`,
    `                    const chatFullScreen = ref(false);
                    const showCfoWidget = ref(false); // v26.80 : widget modal flottant CFO
                    // v26.80 : drag-to-move du widget CFO par sa barre de titre
                    const startDragCfoWidget = (e) => {
                        const modal = document.getElementById('cfo-widget-modal');
                        if (!modal) return;
                        e.preventDefault();
                        const rect = modal.getBoundingClientRect();
                        const ox = e.clientX - rect.left, oy = e.clientY - rect.top;
                        modal.style.bottom = 'auto';
                        const onMove = ev => { modal.style.left = (ev.clientX - ox) + 'px'; modal.style.top = (ev.clientY - oy) + 'px'; };
                        const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
                        document.addEventListener('mousemove', onMove);
                        document.addEventListener('mouseup', onUp);
                    };`
);

// ─────────────────────────────────────────────────────────────────────────────
// OP2 : Ajouter showCfoWidget + startDragCfoWidget au return()
// ─────────────────────────────────────────────────────────────────────────────
replace('OP2 return showCfoWidget',
    `                        cfoMessages, cfoInput, cfoLoading, cfoSessionId, cfoWebhookUrl, cfoWebhookInput, cfoChatContainer, chatFullScreen, consulterCFO, envoyerCFO, saveCFOWebhook, resetCFOSession,`,
    `                        cfoMessages, cfoInput, cfoLoading, cfoSessionId, cfoWebhookUrl, cfoWebhookInput, cfoChatContainer, chatFullScreen, showCfoWidget, startDragCfoWidget, consulterCFO, envoyerCFO, saveCFOWebhook, resetCFOSession,`
);

// ─────────────────────────────────────────────────────────────────────────────
// OP3 : Supprimer le bouton CFO de la sidebar
// ─────────────────────────────────────────────────────────────────────────────
replace('OP3 sidebar CFO button supprimé',
    `                    <button @click="activeTab = 'cfo'" :class="['w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors text-sm font-bold', activeTab === 'cfo' ? 'bg-gradient-to-r from-fuchsia-600 to-purple-700 shadow-lg shadow-purple-900/50' : 'hover:bg-slate-800 text-slate-300']">🧠 CFO & Audit <span class="ml-auto text-[9px] bg-purple-900/80 text-purple-100 px-1.5 py-0.5 rounded border border-purple-400/30">v14</span></button>`,
    `                    <!-- v26.80 : bouton CFO supprimé de la sidebar — accès via FAB flottant 🧠 -->`
);

// ─────────────────────────────────────────────────────────────────────────────
// OP4 : Supprimer le bouton CFO de la barre de navigation mobile
// ─────────────────────────────────────────────────────────────────────────────
replace('OP4 mobile nav CFO supprimé',
    `                <button @click="activeMobileTab = 'cfo'"
                        :class="['flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors', activeMobileTab === 'cfo' ? 'text-fuchsia-600 bg-fuchsia-50' : 'text-gray-500']">
                    <span class="text-lg">🧠</span>
                    <span class="text-[8px] font-black uppercase tracking-wider">CFO</span>
                </button>`,
    `                <!-- v26.80 : bouton CFO mobile supprimé — accès via FAB flottant -->`
);

// ─────────────────────────────────────────────────────────────────────────────
// OP5 : Insérer le FAB CFO juste au-dessus du FAB Journal
//   Journal  : bottom-[11.5rem]=184px mobile  /  md:bottom-24=96px desktop
//   CFO      : bottom-60=240px        mobile  /  md:bottom-[10.5rem]=168px desktop
// ─────────────────────────────────────────────────────────────────────────────
replace('OP5 FAB CFO au-dessus du Journal',
    `            📑\n        </button>\n        <transition name="fade">`,
    `            📑
        </button>

        <!-- v26.80 FAB CFO Widget — au-dessus du Journal, accès direct sans changer d'onglet -->
        <button @click="showCfoWidget = !showCfoWidget"
            title="Ouvrir le CFO & Audit"
            :class="['fixed z-[9995] rounded-full flex items-center justify-center border-2 transition-all hover:scale-110 shadow-xl',
                     'bottom-60 right-4 w-12 h-12 text-xl',
                     'md:bottom-[10.5rem] md:left-6 md:right-auto md:w-16 md:h-16 md:text-3xl',
                     showCfoWidget
                       ? 'bg-gradient-to-br from-fuchsia-500 to-purple-700 text-white border-fuchsia-300 shadow-fuchsia-900/50'
                       : 'bg-gradient-to-br from-slate-800 to-slate-900 text-fuchsia-300 border-fuchsia-500/40 shadow-slate-900/50']">
            🧠
        </button>

        <transition name="fade">`
);

// ─────────────────────────────────────────────────────────────────────────────
// OP6 : Remplacer le Teleport+chatFullScreen+CFO tab par la modale flottante
//        (ouverture — garde tout le contenu intérieur intact)
// ─────────────────────────────────────────────────────────────────────────────
replace('OP6 ouverture modale CFO',
    `                <!-- Bouton flottant plein écran -->
                <Teleport to="body">
                    <button v-if="chatFullScreen" @click="chatFullScreen = false"
                        class="fixed top-4 right-4 z-[9999] flex items-center gap-2 bg-slate-800/90 backdrop-blur text-white text-xs font-black uppercase tracking-widest px-4 py-2 rounded-full shadow-2xl border border-slate-600 hover:bg-fuchsia-700 transition-colors">
                        🗗 Réduire
                    </button>
                </Teleport>

                <!-- === CFO & AUDIT (v15.10 — Unified Control Center) === -->
                <div v-if="activeTab === 'cfo'" class="grid lg:grid-cols-12 gap-5">`,
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
                    <div class="grid lg:grid-cols-12 gap-5">`
);

// ─────────────────────────────────────────────────────────────────────────────
// OP7 : Fermeture de la modale (après la note de sécurité)
// ─────────────────────────────────────────────────────────────────────────────
replace('OP7 fermeture modale CFO',
    `                                <li>La mémoire conversationnelle est conservée côté VPS (PostgreSQL).</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <!-- ═══════════════════════════════════════════════════════════ -->
                <!-- ONGLET PARAMÈTRES v15                                       -->`,
    `                                <li>La mémoire conversationnelle est conservée côté VPS (PostgreSQL).</li>
                            </ul>
                        </div>
                    </div>
                </div><!-- /grid lg:grid-cols-12 -->
                    </div><!-- /scrollable-content -->
                </div><!-- /cfo-widget-modal -->
                </Teleport>

                <!-- ═══════════════════════════════════════════════════════════ -->
                <!-- ONGLET PARAMÈTRES v15                                       -->`
);

// ─────────────────────────────────────────────────────────────────────────────
// OP8 : Chat container — adapter max-height dans la modale (380px au lieu de 60vh)
// ─────────────────────────────────────────────────────────────────────────────
replace('OP8 chat max-height dans modale',
    `chatFullScreen ? 'max-h-[calc(100vh-200px)]' : 'max-h-[60vh] lg:max-h-[520px]'`,
    `chatFullScreen ? 'max-h-[calc(100vh-200px)]' : 'max-h-[380px]'`
);

// ─────────────────────────────────────────────────────────────────────────────
// OP9 : transfererAuditAuCFO — ouvrir le widget au lieu de changer d'onglet
// ─────────────────────────────────────────────────────────────────────────────
replace('OP9 transfererAuditAuCFO → showCfoWidget',
    `                        activeTab.value = 'cfo';\n                        if (isMobile.value)`,
    `                        showCfoWidget.value = true; // v26.80 : ouvre le widget flottant\n                        if (isMobile.value)`
);

// ─────────────────────────────────────────────────────────────────────────────
// BUMP VERSION
// ─────────────────────────────────────────────────────────────────────────────
replace('Bump 26.74 → 26.80',
    'v26.74 Surplus-Real-Fix',
    'v26.80 CFO-Floating-Widget'
);

// ─────────────────────────────────────────────────────────────────────────────
// SAUVEGARDE
// ─────────────────────────────────────────────────────────────────────────────
if (errors > 0) { console.error(`\n${errors} erreur(s) — fichier NON modifié.`); process.exit(1); }
if (html === orig) { console.warn('\n⚠️  Aucun changement détecté.'); process.exit(1); }

writeFileSync(SRC, html.replace(/\n/g, '\r\n'), 'utf8');
console.log('\n✅ index.html → v26.80 CFO-Floating-Widget');
