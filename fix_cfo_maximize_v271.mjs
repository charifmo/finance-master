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
check('showCfoModal ref',
    `const showCfoModal = ref(false); // v26.95 : widget modal flottant CFO`);
check('startDragCfoWidget no-modal check',
    `                        const modal = document.getElementById('cfo-widget-modal');\n                        if (!modal) return;`);
check('modal static style',
    `                     style="resize:both;overflow:hidden;min-width:320px;min-height:380px;max-width:95vw;max-height:92vh;width:min(620px,90vw);height:min(600px,85vh);bottom:5.5rem;left:5rem;">`);
check('title bar buttons block',
    `                            <button @mousedown.stop @click.stop="resetCFOSession"`);
check('return startDragCfoWidget brieferCFO',
    `showCfoModal, startDragCfoWidget, brieferCFO, consulterCFO`);

if (errors > 0) { console.error(`\n${errors} ancre(s) — abandon.`); process.exit(1); }

// ─── OP1 : Ajouter cfoMaximized = ref(false) juste après showCfoModal ─────────
replace('OP1 add cfoMaximized ref',
    `const showCfoModal = ref(false); // v26.95 : widget modal flottant CFO`,
    `const showCfoModal   = ref(false); // v26.95 : widget modal flottant CFO
                    const cfoMaximized   = ref(false); // v27.1 : plein écran du widget`
);

// ─── OP2 : Désactiver le drag en mode maximisé ─────────────────────────────────
replace('OP2 drag guard maximized',
    `                        const modal = document.getElementById('cfo-widget-modal');
                        if (!modal) return;`,
    `                        const modal = document.getElementById('cfo-widget-modal');
                        if (!modal || cfoMaximized.value) return;`
);

// ─── OP3 : Passer le style de static à :style conditionnel ─────────────────────
replace('OP3 modal dynamic style',
    `                     style="resize:both;overflow:hidden;min-width:320px;min-height:380px;max-width:95vw;max-height:92vh;width:min(620px,90vw);height:min(600px,85vh);bottom:5.5rem;left:5rem;">`,
    `                     :style="cfoMaximized
                         ? 'overflow:hidden;top:0.5rem;left:0.5rem;right:auto;bottom:auto;width:calc(100vw - 1rem);height:calc(100vh - 1rem);'
                         : 'resize:both;overflow:hidden;min-width:320px;min-height:380px;max-width:95vw;max-height:92vh;width:min(620px,90vw);height:min(600px,85vh);bottom:5.5rem;left:5rem;top:auto;right:auto;'">`
);

// ─── OP4 : Ajouter le bouton ⛶/🗗 avant la croix de fermeture ─────────────────
replace('OP4 add maximize button',
    `                            <button @mousedown.stop @click.stop="resetCFOSession" class="text-[9px] text-fuchsia-100 hover:text-white font-bold uppercase tracking-widest hover:bg-white/10 px-2 py-0.5 rounded transition-colors">🔄 Reset</button>
                            <button @mousedown.stop @click.stop="showCfoModal = false" class="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/20 text-white font-black text-base transition-colors" title="Fermer">✕</button>`,
    `                            <button @mousedown.stop @click.stop="resetCFOSession" class="text-[9px] text-fuchsia-100 hover:text-white font-bold uppercase tracking-widest hover:bg-white/10 px-2 py-0.5 rounded transition-colors">🔄 Reset</button>
                            <button @mousedown.stop @click.stop="cfoMaximized = !cfoMaximized" class="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/20 text-white font-black text-base transition-colors" :title="cfoMaximized ? 'Réduire' : 'Agrandir'">{{ cfoMaximized ? '🗗' : '⛶' }}</button>
                            <button @mousedown.stop @click.stop="showCfoModal = false" class="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/20 text-white font-black text-base transition-colors" title="Fermer">✕</button>`
);

// ─── OP5 : Ajouter cfoMaximized au return ─────────────────────────────────────
replace('OP5 return cfoMaximized',
    `showCfoModal, startDragCfoWidget, brieferCFO, consulterCFO`,
    `showCfoModal, cfoMaximized, startDragCfoWidget, brieferCFO, consulterCFO`
);

// ─── SAVE ─────────────────────────────────────────────────────────────────────
if (errors > 0) { console.error(`\n${errors} erreur(s) — fichier NON modifié.`); process.exit(1); }
if (html === orig) { console.warn('\n⚠️  Aucun changement détecté.'); process.exit(1); }

writeFileSync(SRC, html.replace(/\n/g, '\r\n'), 'utf8');
console.log('\n✅ index.html → v27.1 CFO maximize/restore button');
