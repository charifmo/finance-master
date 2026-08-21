/**
 * v32.80 — UI-Compacte : sidebar rétractable + ruban KPI en micro-badges
 * ---------------------------------------------------------------------------
 *  1. État isSidebarCollapsed (persisté) + bouton toggle dans la sidebar.
 *  2. Sidebar : 16rem ↔ 4.5rem, transition-[width] duration-300, textes masqués
 *     en mode réduit (icônes seules, centrées, title= au survol).
 *  3. Topbar : les KPI passent de blocs à deux lignes à des micro-badges une
 *     ligne (libellé + valeur en ligne), hauteur divisée par ~2.
 */
import fs from 'node:fs';

const FILE = new URL('./index.html', import.meta.url);
let s = fs.readFileSync(FILE, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.split('\r\n').join('\n');

const sub = (from, to, n = 1) => {
    const c = s.split(from).length - 1;
    if (c !== n) throw new Error(`Ancre (${c}/${n}) :\n${from.slice(0, 200)}`);
    s = s.split(from).join(to);
};

/* ══════════════════════════════════════════════════════════════════════════
   1. ÉTAT — isSidebarCollapsed (persisté comme appMode)
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                    const appMode = ref(localStorage.getItem('appMode') || 'previsionnel'); // 'previsionnel' | 'reel'`,
`                    const appMode = ref(localStorage.getItem('appMode') || 'previsionnel'); // 'previsionnel' | 'reel'
                    // v32.80 UI-Compacte : sidebar rétractable (état persisté)
                    const isSidebarCollapsed = ref(localStorage.getItem('sidebarCollapsed') === '1');
                    watch(isSidebarCollapsed, (v) => { try { localStorage.setItem('sidebarCollapsed', v ? '1' : '0'); } catch (e) {} });
                    const toggleSidebar = () => { isSidebarCollapsed.value = !isSidebarCollapsed.value; };`);

sub(
`                        showPoidsTooltip, showInlineReleve,`,
`                        showPoidsTooltip, showInlineReleve,
                        // v32.80 UI-Compacte
                        isSidebarCollapsed, toggleSidebar,`);

/* ══════════════════════════════════════════════════════════════════════════
   2. SIDEBAR — largeur animée
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`        <div v-if="!isMobile" class="w-full md:w-64 bg-slate-900 text-white flex flex-col justify-between shrink-0 shadow-2xl z-30 md:h-full md:overflow-y-auto custom-scroll border-r border-slate-800">`,
`        <div v-if="!isMobile"
             class="bg-slate-900 text-white flex flex-col justify-between shrink-0 shadow-2xl z-30 md:h-full md:overflow-y-auto custom-scroll border-r border-slate-800 transition-[width] duration-300 ease-in-out"
             :style="{ width: isSidebarCollapsed ? '72px' : '16rem' }">`);

/* 2a. En-tête : logo + titre + toggle ------------------------------------- */
sub(
`                <div class="p-4 border-b border-slate-800 bg-slate-950/40 text-center">
                    <div class="flex items-center justify-center gap-2 mb-1">
                        <img v-if="parametres.branding.logoUrl" :src="parametres.branding.logoUrl" class="w-8 h-8 object-contain rounded-lg shadow"/>
                        <span v-else class="text-2xl">📈</span>
                        <h1 class="text-lg font-black text-blue-400 italic uppercase tracking-tighter">{{ parametres.branding.appName || 'Finance App' }}</h1>
                    </div>
                    <p class="text-slate-400 text-[9px] mt-1 font-bold uppercase tracking-widest">
                        <span class="bg-blue-600/30 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30">v{{ CURRENT_VERSION }}</span>
                    </p>
                </div>`,
`                <!-- ═══ v32.80 : en-tête + toggle de rétractation ═══ -->
                <div :class="['border-b border-slate-800 bg-slate-950/40', isSidebarCollapsed ? 'px-2 py-3' : 'p-4 text-center']">
                    <div :class="['flex items-center gap-2', isSidebarCollapsed ? 'justify-center' : 'justify-center mb-1']">
                        <img v-if="parametres.branding.logoUrl" :src="parametres.branding.logoUrl" class="w-8 h-8 object-contain rounded-lg shadow shrink-0"/>
                        <span v-else class="text-2xl shrink-0">📈</span>
                        <h1 v-if="!isSidebarCollapsed" class="text-lg font-black text-blue-400 italic uppercase tracking-tighter truncate">{{ parametres.branding.appName || 'Finance App' }}</h1>
                    </div>
                    <p v-if="!isSidebarCollapsed" class="text-slate-400 text-[9px] mt-1 font-bold uppercase tracking-widest">
                        <span class="bg-blue-600/30 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30">v{{ CURRENT_VERSION }}</span>
                    </p>
                    <button @click="toggleSidebar"
                            :title="isSidebarCollapsed ? 'Déplier le menu' : 'Replier le menu'"
                            :class="['mt-2 w-full flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors', isSidebarCollapsed ? 'py-1.5' : 'py-1']">
                        <span class="text-xs font-black leading-none">{{ isSidebarCollapsed ? '»' : '«' }}</span>
                        <span v-if="!isSidebarCollapsed" class="text-[9px] font-black uppercase tracking-widest">Replier</span>
                    </button>
                </div>`);

/* 2b. Master switch dual-mode --------------------------------------------- */
sub(
`                <div class="px-3 py-3 border-b border-slate-800 bg-slate-950/40">
                    <p class="text-[9px] text-slate-500 font-black uppercase tracking-widest text-center mb-2">Mode application</p>
                    <div class="inline-flex w-full rounded-xl border border-slate-700 bg-slate-900 p-1">
                        <button @click="appMode = 'previsionnel'; activeTab = 'dashboard'"
                                :class="appMode === 'previsionnel' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'"
                                class="flex-1 px-2 py-1.5 rounded-lg text-[11px] font-bold transition">
                            🔮 Prévisionnel
                        </button>
                        <button @click="appMode = 'reel'; activeTab = 'pilotage'"
                                :class="appMode === 'reel' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'"
                                class="flex-1 px-2 py-1.5 rounded-lg text-[11px] font-bold transition">
                            📊 Réalisé
                        </button>
                    </div>
                </div>`,
`                <div :class="['border-b border-slate-800 bg-slate-950/40', isSidebarCollapsed ? 'px-2 py-2' : 'px-3 py-3']">
                    <p v-if="!isSidebarCollapsed" class="text-[9px] text-slate-500 font-black uppercase tracking-widest text-center mb-2">Mode application</p>
                    <div :class="['rounded-xl border border-slate-700 bg-slate-900 p-1', isSidebarCollapsed ? 'flex flex-col gap-1' : 'inline-flex w-full']">
                        <button @click="appMode = 'previsionnel'; activeTab = 'dashboard'" title="Mode Prévisionnel"
                                :class="[appMode === 'previsionnel' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white', isSidebarCollapsed ? 'px-0 py-1.5' : 'px-2 py-1.5']"
                                class="flex-1 rounded-lg text-[11px] font-bold transition">
                            🔮<span v-if="!isSidebarCollapsed"> Prévisionnel</span>
                        </button>
                        <button @click="appMode = 'reel'; activeTab = 'pilotage'" title="Mode Réalisé"
                                :class="[appMode === 'reel' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white', isSidebarCollapsed ? 'px-0 py-1.5' : 'px-2 py-1.5']"
                                class="flex-1 rounded-lg text-[11px] font-bold transition">
                            📊<span v-if="!isSidebarCollapsed"> Réalisé</span>
                        </button>
                    </div>
                </div>`);

/* 2c. Nav : padding + icônes seules quand replié -------------------------- */
sub(`                <nav class="px-4 py-4 space-y-2">`,
    `                <nav :class="['space-y-2', isSidebarCollapsed ? 'px-2 py-3' : 'px-4 py-4']">`);

// classe commune des 11 boutons d'onglet
sub(`'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors text-sm font-bold'`,
    `'w-full flex items-center rounded-lg transition-colors text-sm font-bold', isSidebarCollapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-4 py-3 text-left'`,
    12);

// libellés : "EMOJI Texte" → <span icône> + <span texte masquable> + title=
{
    const navStart = s.indexOf(`                <nav :class="['space-y-2'`);
    const navEnd = s.indexOf('</nav>', navStart);
    if (navStart < 0 || navEnd < 0) throw new Error('bloc <nav> introuvable');
    let nav = s.slice(navStart, navEnd);
    const re = /(\]">)([\u{1F000}-\u{1FAFF}\u{2190}-\u{27BF}\u{2B00}-\u{2BFF}]\uFE0F?) ([^<>]+?)(<\/button>)/gu;
    let count = 0;
    nav = nav.replace(re, (m, open, icon, label, close) => {
        if (label === 'Undo' || label === 'Redo') return m; // traités séparément (colonne repliée)
        count++;
        return `]" :title="isSidebarCollapsed ? '${label.replace(/'/g, "\\'").replace(/&/g, '&')}' : null"><span class="text-base leading-none shrink-0">${icon}</span><span v-if="!isSidebarCollapsed" class="truncate">${label}</span>${close}`;
    });
    if (count !== 12) throw new Error('libellés d\'onglet transformés : ' + count + '/12');
    s = s.slice(0, navStart) + nav + s.slice(navEnd);
}

// bouton Changelog (classe statique → dynamique)
sub(
`                    <button @click="showChangelog = true" class="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors text-slate-400 hover:bg-slate-800 mt-4 border-t border-slate-800 text-xs font-medium uppercase tracking-widest">📖 Changelog</button>`,
`                    <button @click="showChangelog = true" :title="isSidebarCollapsed ? 'Changelog' : null"
                            :class="['w-full flex items-center rounded-lg transition-colors text-slate-400 hover:bg-slate-800 mt-4 border-t border-slate-800 text-xs font-medium uppercase tracking-widest', isSidebarCollapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-4 py-3 text-left']">
                        <span class="text-base leading-none shrink-0">📖</span><span v-if="!isSidebarCollapsed" class="truncate">Changelog</span>
                    </button>`);

// Undo / Redo : colonne d'icônes quand replié
sub(
`                    <div class="flex gap-2 mt-2 px-1">`,
`                    <div :class="['mt-2 px-1 flex gap-2', isSidebarCollapsed ? 'flex-col' : '']">`);
sub(`bg-slate-900 text-slate-700 cursor-not-allowed border-slate-800']">↩ Undo</button>`,
    `bg-slate-900 text-slate-700 cursor-not-allowed border-slate-800']">↩<span v-if="!isSidebarCollapsed"> Undo</span></button>`);
sub(`bg-slate-900 text-slate-700 cursor-not-allowed border-slate-800']">↪ Redo</button>`,
    `bg-slate-900 text-slate-700 cursor-not-allowed border-slate-800']">↪<span v-if="!isSidebarCollapsed"> Redo</span></button>`);

/* 2d. Pied de sidebar (VPS / Drive / Export) : masqué quand replié -------- */
sub(
`            <div class="flex flex-col border-t border-slate-800">
                <div class="p-4 bg-slate-950/80 border-b border-slate-800">`,
`            <!-- v32.80 : pied replié → une colonne d'actions essentielles -->
            <div v-if="isSidebarCollapsed" class="flex flex-col items-center gap-2 border-t border-slate-800 py-3">
                <button @click="saveToServer" :disabled="serverSyncStatus === 'saving'" title="Sauver sur VPS"
                        :class="['w-10 h-10 rounded-lg text-base transition-all border', serverSyncStatus === 'modified' ? 'bg-purple-600 border-purple-500 animate-pulse' : (serverSyncStatus === 'error' ? 'bg-red-600 border-red-500' : 'bg-slate-800 border-slate-700 hover:bg-slate-700')]">💾</button>
                <button @click="exporterDonnees" title="Exporter les données" class="w-10 h-10 rounded-lg text-base bg-green-900/20 border border-green-800/50 hover:bg-green-900/40 transition-colors">📤</button>
                <button @click="exporterPDF" title="Exporter en PDF" class="w-10 h-10 rounded-lg text-base bg-sky-900/20 border border-sky-800/50 hover:bg-sky-900/40 transition-colors">📄</button>
            </div>

            <div v-else class="flex flex-col border-t border-slate-800">
                <div class="p-4 bg-slate-950/80 border-b border-slate-800">`);

/* ══════════════════════════════════════════════════════════════════════════
   3. TOPBAR — micro-badges
   ══════════════════════════════════════════════════════════════════════════ */

/* 3a. Bandeau année : padding réduit -------------------------------------- */
sub(
`                <div class="px-6 py-3 flex flex-wrap gap-4 justify-between items-center bg-slate-50 border-b border-gray-200">`,
`                <div class="px-6 py-1.5 flex flex-wrap gap-4 justify-between items-center bg-slate-50 border-b border-gray-200">`);

/* 3b. Bloc Patrimoine Liquide : compacté ---------------------------------- */
sub(
`                <div class="px-6 py-3 flex flex-wrap gap-4 justify-between items-center">
                    <div class="flex items-center gap-4">
                        <div class="bg-blue-100 p-2.5 rounded-xl shadow-inner text-blue-600"><span class="text-xl">🏦</span></div>
                        <div>
                            <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest">Patrimoine Liquide — {{ nomDuMois(soldesInitiaux.moisActuel) }} {{ soldesInitiaux.anneeActuelle }}</p>
                            <div class="flex items-center gap-2">
                                <span :class="['text-2xl font-black', patrimoineLiquide >= 0 ? 'text-gray-800' : 'text-red-600']">{{ formatMAD(patrimoineLiquide) }}</span>`,
`                <div class="px-6 py-1.5 flex flex-wrap gap-x-4 gap-y-1 justify-between items-center">
                    <div class="flex items-center gap-2">
                        <div class="bg-blue-100 p-1.5 rounded-lg shadow-inner text-blue-600 leading-none"><span class="text-sm">🏦</span></div>
                        <div class="flex items-baseline gap-2">
                            <p class="text-[9px] font-black text-gray-400 uppercase tracking-wide leading-none">Patrimoine Liquide · {{ nomDuMois(soldesInitiaux.moisActuel) }} {{ soldesInitiaux.anneeActuelle }}</p>
                            <div class="flex items-center gap-2">
                                <span :class="['text-lg font-black leading-none', patrimoineLiquide >= 0 ? 'text-gray-800' : 'text-red-600']">{{ formatMAD(patrimoineLiquide) }}</span>`);

/* 3b-bis. Patrimoine Global Projeté ramené sur une seule ligne ------------ */
sub(
`                    <div class="text-right relative group">
                        <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest italic flex items-center justify-end gap-1">
                            <span>Patrimoine Global Projeté</span>
                            <select v-model.number="anneeCibleProjection" class="bg-transparent border-none outline-none text-gray-500 font-black uppercase tracking-widest cursor-pointer hover:text-blue-600 focus:text-blue-600 text-[10px] px-0 py-0">
                                <option v-for="a in anneesProjectionOptions" :key="a" :value="a">{{ a }}</option>
                            </select>
                            <span v-if="(soldesInitiaux.decalagePaie !== false)">(Avant Paie)</span>
                        </p>
                        <p :class="['text-xl font-black flex items-center justify-end gap-2', patrimoineProjeteGlobal >= 0 ? 'text-green-600' : 'text-red-600']">
                            {{ formatMAD(patrimoineProjeteGlobal) }}
                            <span :class="['p-1.5 rounded-lg shadow-sm text-sm', patrimoineProjeteGlobal >= 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600']">{{ patrimoineProjeteGlobal >= 0 ? '🎉' : '⚠️' }}</span>
                        </p>`,
`                    <!-- v32.80 : patrimoine projeté ramené sur une seule ligne -->
                    <div class="text-right relative group flex items-center justify-end gap-2 flex-wrap">
                        <p class="text-[9px] font-black text-gray-400 uppercase tracking-wide italic flex items-center gap-1 whitespace-nowrap">
                            <span>Patrimoine Global Projeté</span>
                            <select v-model.number="anneeCibleProjection" class="bg-transparent border-none outline-none text-gray-500 font-black uppercase tracking-wide cursor-pointer hover:text-blue-600 focus:text-blue-600 text-[9px] px-0 py-0">
                                <option v-for="a in anneesProjectionOptions" :key="a" :value="a">{{ a }}</option>
                            </select>
                            <span v-if="(soldesInitiaux.decalagePaie !== false)">(Avant Paie)</span>
                        </p>
                        <p :class="['text-base font-black flex items-center gap-1.5 whitespace-nowrap', patrimoineProjeteGlobal >= 0 ? 'text-green-600' : 'text-red-600']">
                            {{ formatMAD(patrimoineProjeteGlobal) }}
                            <span :class="['px-1 py-0.5 rounded-md shadow-sm text-xs', patrimoineProjeteGlobal >= 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600']">{{ patrimoineProjeteGlobal >= 0 ? '🎉' : '⚠️' }}</span>
                        </p>`);

/* 3c. Conteneur du ruban --------------------------------------------------- */
sub(
`                    <!-- v18.00 : KPIs ruban responsive — grid sur petits écrans -->
                    <div class="grid grid-cols-2 lg:flex lg:flex-wrap gap-2 lg:gap-3 lg:items-center">`,
`                    <!-- v32.80 : ruban de micro-badges — une seule ligne, empreinte réduite de moitié -->
                    <div class="flex flex-wrap items-center gap-1.5">`);

/* 3d. Badge SURPLUS -------------------------------------------------------- */
sub(
`                            <div :class="['border rounded-xl px-2 py-1.5 lg:px-3 lg:py-2 cursor-pointer select-none', surplusMensuelBase >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-300']">
                                <p class="text-[8px] lg:text-[9px] font-black uppercase tracking-widest text-gray-500">💰 Surplus /mois ⓘ</p>
                                <p :class="['text-xs lg:text-sm font-black', surplusMensuelBase >= 0 ? 'text-emerald-700' : 'text-red-600']">{{ formatMAD(surplusMensuelBase) }}</p>
                            </div>`,
`                            <div :class="['border rounded-lg px-2 py-1 cursor-pointer select-none flex items-baseline gap-1.5 whitespace-nowrap', surplusMensuelBase >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-300']">
                                <span class="text-[9px] font-black uppercase tracking-wide text-gray-500">💰 Surplus ⓘ</span>
                                <span :class="['text-[11px] font-black tabular-nums', surplusMensuelBase >= 0 ? 'text-emerald-700' : 'text-red-600']">{{ formatMAD(surplusMensuelBase) }}</span>
                            </div>`);

/* 3e. Badge MENSUALITÉS ---------------------------------------------------- */
sub(
`                            <div class="bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 lg:px-3 lg:py-2 cursor-pointer select-none">
                                <p class="text-[8px] lg:text-[9px] font-black uppercase tracking-widest text-gray-500">🏦 Mensualités ⓘ</p>
                                <p class="text-xs lg:text-sm font-black text-slate-700">{{ formatMAD(totalCreditsMensuels) }}</p>
                                <p :class="['text-[8px] font-bold uppercase', tauxEndettement > 40 ? 'text-red-500' : (tauxEndettement > 30 ? 'text-orange-500' : 'text-green-600')]">{{ tauxEndettement.toFixed(1) }}% endet.</p>
                            </div>`,
`                            <div class="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 cursor-pointer select-none flex items-baseline gap-1.5 whitespace-nowrap">
                                <span class="text-[9px] font-black uppercase tracking-wide text-gray-500">🏦 Mensualités ⓘ</span>
                                <span class="text-[11px] font-black text-slate-700 tabular-nums">{{ formatMAD(totalCreditsMensuels) }}</span>
                                <span :class="['text-[9px] font-bold', tauxEndettement > 40 ? 'text-red-500' : (tauxEndettement > 30 ? 'text-orange-500' : 'text-green-600')]">{{ tauxEndettement.toFixed(0) }}%</span>
                            </div>`);

/* 3f. Badge DÉPENSES ANNUELLES -------------------------------------------- */
sub(
`                            <div :class="['border rounded-xl px-2 py-1.5 lg:px-3 lg:py-2 cursor-pointer select-none', kpiDepensesAnnuelles.soldeFinal < 0 ? 'bg-red-50 border-red-300' : 'bg-amber-50 border-amber-200']">
                                <p class="text-[8px] lg:text-[9px] font-black uppercase tracking-widest text-gray-500">{{ kpiDepensesAnnuelles.icone }} Dépenses Annuelles ⓘ</p>
                                <p :class="['text-xs lg:text-sm font-black', kpiDepensesAnnuelles.soldeFinal < 0 ? 'text-red-600' : 'text-amber-700']">{{ formatMAD(kpiDepensesAnnuelles.soldeFinal) }}</p>
                                <p class="text-[8px] font-bold uppercase text-gray-400">Reste -{{ formatMAD(kpiDepensesAnnuelles.totalSorties) }} · fin {{ kpiDepensesAnnuelles.anneeCible }}</p>
                            </div>`,
`                            <div :class="['border rounded-lg px-2 py-1 cursor-pointer select-none flex items-baseline gap-1.5 whitespace-nowrap', kpiDepensesAnnuelles.soldeFinal < 0 ? 'bg-red-50 border-red-300' : 'bg-amber-50 border-amber-200']">
                                <span class="text-[9px] font-black uppercase tracking-wide text-gray-500">{{ kpiDepensesAnnuelles.icone }} Dép. Ann. ⓘ</span>
                                <span :class="['text-[11px] font-black tabular-nums', kpiDepensesAnnuelles.soldeFinal < 0 ? 'text-red-600' : 'text-amber-700']">{{ formatMAD(kpiDepensesAnnuelles.soldeFinal) }}</span>
                                <span class="text-[9px] font-bold text-gray-400">fin {{ kpiDepensesAnnuelles.anneeCible }}</span>
                            </div>`);

/* 3g. Badges ENTRÉES / SORTIES -------------------------------------------- */
sub(
`                        <div class="bg-green-50 border border-green-200 rounded-xl px-2 py-1.5 lg:px-3 lg:py-2">
                            <p class="text-[8px] lg:text-[9px] font-black text-green-600 uppercase tracking-widest">↑ Entrées {{anneeAffichage}}</p>
                            <p class="text-xs lg:text-sm font-black text-green-700">+{{ formatMAD(statsFluxAnnee.totalEntrees) }}</p>
                        </div>
                        <div class="bg-red-50 border border-red-200 rounded-xl px-2 py-1.5 lg:px-3 lg:py-2">
                            <p class="text-[8px] lg:text-[9px] font-black text-red-600 uppercase tracking-widest">↓ Sorties {{anneeAffichage}}</p>
                            <p class="text-xs lg:text-sm font-black text-red-700">-{{ formatMAD(statsFluxAnnee.totalSorties) }}</p>
                        </div>`,
`                        <div class="bg-green-50 border border-green-200 rounded-lg px-2 py-1 flex items-baseline gap-1.5 whitespace-nowrap">
                            <span class="text-[9px] font-black text-green-600 uppercase tracking-wide">↑ Entrées {{anneeAffichage}}</span>
                            <span class="text-[11px] font-black text-green-700 tabular-nums">+{{ formatMAD(statsFluxAnnee.totalEntrees) }}</span>
                        </div>
                        <div class="bg-red-50 border border-red-200 rounded-lg px-2 py-1 flex items-baseline gap-1.5 whitespace-nowrap">
                            <span class="text-[9px] font-black text-red-600 uppercase tracking-wide">↓ Sorties {{anneeAffichage}}</span>
                            <span class="text-[11px] font-black text-red-700 tabular-nums">-{{ formatMAD(statsFluxAnnee.totalSorties) }}</span>
                        </div>`);

/* 3h. Badge POIDS SUR SURPLUS --------------------------------------------- */
sub(
`                        <div :class="['border rounded-xl px-2 py-1.5 lg:px-3 lg:py-2 col-span-2 lg:col-span-1 relative cursor-default', statsFluxAnnee.impactSurplus > 0 ? (statsFluxAnnee.impactSurplus > 50 ? 'bg-red-50 border-red-300' : 'bg-orange-50 border-orange-300') : 'bg-emerald-50 border-emerald-300']"
                             @mouseenter="showPoidsTooltip = true" @mouseleave="showPoidsTooltip = false">
                            <p :class="['text-[8px] lg:text-[9px] font-black uppercase tracking-widest', statsFluxAnnee.impactSurplus > 0 ? (statsFluxAnnee.impactSurplus > 50 ? 'text-red-600' : 'text-orange-600') : 'text-emerald-600']">Poids sur Surplus ⓘ</p>
                            <p v-if="statsFluxAnnee.impactSurplus > 0" :class="['text-xs lg:text-sm font-black', statsFluxAnnee.impactSurplus > 50 ? 'text-red-700' : 'text-orange-700']">⚠️ {{ formatMAD(statsFluxAnnee.montantImpact) }} ({{ statsFluxAnnee.impactSurplus.toFixed(0) }}%)</p>
                            <p v-else class="text-xs lg:text-sm font-black text-emerald-700">✅ Surplus préservé</p>`,
`                        <div :class="['border rounded-lg px-2 py-1 relative cursor-default flex items-baseline gap-1.5 whitespace-nowrap', statsFluxAnnee.impactSurplus > 0 ? (statsFluxAnnee.impactSurplus > 50 ? 'bg-red-50 border-red-300' : 'bg-orange-50 border-orange-300') : 'bg-emerald-50 border-emerald-300']"
                             @mouseenter="showPoidsTooltip = true" @mouseleave="showPoidsTooltip = false">
                            <span :class="['text-[9px] font-black uppercase tracking-wide', statsFluxAnnee.impactSurplus > 0 ? (statsFluxAnnee.impactSurplus > 50 ? 'text-red-600' : 'text-orange-600') : 'text-emerald-600']">Poids ⓘ</span>
                            <span v-if="statsFluxAnnee.impactSurplus > 0" :class="['text-[11px] font-black tabular-nums', statsFluxAnnee.impactSurplus > 50 ? 'text-red-700' : 'text-orange-700']">⚠️ {{ formatMAD(statsFluxAnnee.montantImpact) }} ({{ statsFluxAnnee.impactSurplus.toFixed(0) }}%)</span>
                            <span v-else class="text-[11px] font-black text-emerald-700">✅ Préservé</span>`);

/* ══════════════════════════════════════════════════════════════════════════
   4. VERSION + CHANGELOG
   ══════════════════════════════════════════════════════════════════════════ */
sub(`                    const CURRENT_VERSION = "32.71 Depenses-Annuelles-Annee";`,
    `                    const CURRENT_VERSION = "32.80 UI-Compacte";`);

sub(
`                    const CHANGELOG = [
`,
`                    const CHANGELOG = [
        { version: "32.80 UI-Compacte", date: "2026-08-21", changes: [
            "SIDEBAR RÉTRACTABLE : nouvel état isSidebarCollapsed (persisté en localStorage) + bouton toggle « / » sous le logo. Ouvert = 16rem (icônes + texte), replié = 72px (icônes seules, centrées, libellé en title au survol). Transition CSS transition-[width] duration-300 ease-in-out — aucun saut brutal.",
            "En mode replié : logo réduit, badge de version, libellés d'onglets, master switch textuel, Undo/Redo textuels et panneaux VPS/Drive/Export sont masqués. Le pied de sidebar est remplacé par une colonne de 3 actions essentielles (💾 Sauver VPS, 📤 Exporter, 📄 PDF) avec pastille d'état de sync conservée sur le bouton.",
            "TOPBAR MICRO-BADGES : les KPI passent de blocs sur 2–3 lignes (rounded-xl, px-3 py-2, libellé au-dessus de la valeur) à des badges sur UNE ligne (rounded-lg, px-2 py-1, libellé et valeur alignés en baseline). Hauteur du ruban divisée par ~2.",
            "Typographie resserrée : titres text-[9px] uppercase tracking-wide, valeurs text-[11px] tabular-nums. Libellés abrégés là où la valeur porte déjà le sens (« Dép. Ann. », « Poids »). Le taux d'endettement et l'année cible deviennent des suffixes en ligne au lieu de troisièmes lignes.",
            "Ruban en flex-row unique (flex flex-wrap items-center gap-1.5) au lieu de la grille 2 colonnes ; bandeau année et bloc Patrimoine Liquide passent de py-3 à py-1.5, icône et valeur réduites.",
            "Interactivité inchangée : tous les tooltips au survol (Surplus, Mensualités, Dépenses Annuelles, Poids) et leurs contenus sont conservés à l'identique."
        ] },
`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ v32.80 appliquée');
