/**
 * v34.08 — Les 3 FAB (Merlin / Journal / CFO) quittent le flottant sur desktop
 * ---------------------------------------------------------------------------
 * DIAGNOSTIC — ce n'est pas un bug de z-index ni de position isolée. Les trois
 * boutons sont `fixed`, ancrés `md:bottom-X md:left-6`, empilés sur la
 * verticale (6 / 24 / 10.5rem). Sur desktop, `left-6` place leur colonne
 * exactement sur la sidebar (elle-même en `md:h-full`), qui fait 16rem (ou
 * 72px repliée) de large : les trois derniers boutons du menu (Undo/Redo et
 * le pied VPS) tombent dessous, non cliquables.
 *
 * CHOIX — Option 1 (intégration en pied de sidebar), pas le Speed Dial.
 * La sidebar a DÉJÀ ce pattern : un footer conditionnel (collapsed → colonne
 * d'icônes 💾📤📄 ; déplié → panneau VPS/Drive) sous `flex flex-col
 * justify-between`. Les trois actions IA rejoignent ce pied, dans le même
 * langage visuel (w-10 h-10 replié, ligne pleine largeur déplié) — pas un
 * nouveau motif d'interaction à apprendre.
 *
 * PORTÉE — desktop uniquement. Sur mobile la sidebar n'existe pas
 * (`v-if="!isMobile"`) et la nav est une barre d'onglets en bas d'écran : les
 * 3 boutons y restent flottants, inchangés, juste débarrassés des classes
 * `md:*` désormais mortes. `v-if="isMobile"` les scope explicitement pour
 * qu'ils ne puissent plus jamais réapparaître par-dessus la sidebar.
 *
 * La bulle d'astuce « Mode Merlin actif » (ancrée sur l'ancienne position du
 * bouton) est scopée mobile pour la même raison : sur desktop elle pointerait
 * vers un bouton qui n'est plus là. Le titre du bouton dans la sidebar suffit.
 *
 * NON TOUCHÉ — la bulle de RÉPONSE de Merlin (résultat de l'audit, z-9999,
 * apparaît ponctuellement après un clic). C'est un panneau modal transitoire,
 * pas une gêne permanente : hors du périmètre signalé par le client.
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
   1. Les 3 boutons flottants → mobile uniquement, plus de position desktop
   ══════════════════════════════════════════════════════════════════════════ */

sub(
`        <!-- v17.98 : Bouton flottant Baguette Magique MERLIN — v18.00 : responsive mobile -->
        <button @click="toggleMerlin"
            :title="merlinActive ? 'Désactiver Merlin (Echap)' : 'Activer Merlin — Audit IA d\\'un champ'"
            :class="['merlin-wand-btn fixed z-[9998] rounded-full flex items-center justify-center border-2 transition-all hover:scale-110',
                      'bottom-20 right-4 w-12 h-12 text-xl md:bottom-6 md:left-6 md:right-auto md:w-16 md:h-16 md:text-3xl',
                      merlinActive ? 'bg-gradient-to-br from-fuchsia-600 to-purple-700 text-white border-fuchsia-300' : 'bg-gradient-to-br from-slate-800 to-slate-900 text-fuchsia-300 border-purple-500/40']">
            🪄
        </button>

        <!-- v26.71 FAB Journal — toujours visible, au-dessus de Merlin, jamais superposé au bouton save -->
        <button @click="ouvrirReleve()"
            title="Ouvrir le Journal / Relevé"
            class="fixed z-[9996] rounded-full flex items-center justify-center border-2 transition-all hover:scale-110 shadow-xl
                   bottom-[11.5rem] right-4 w-12 h-12 text-xl
                   md:bottom-24 md:left-6 md:right-auto md:w-16 md:h-16 md:text-3xl
                   bg-gradient-to-br from-indigo-600 to-violet-700 text-white border-indigo-400/60 shadow-indigo-900/50">
            📑
        </button>

        <!-- v26.80 FAB CFO Widget — au-dessus du Journal, accès direct sans changer d'onglet -->
        <button @click="showCfoModal = true"
            title="Ouvrir le CFO & Audit"
            :class="['fixed z-[9995] rounded-full flex items-center justify-center border-2 transition-all hover:scale-110 shadow-xl',
                     'bottom-60 right-4 w-12 h-12 text-xl',
                     'md:bottom-[10.5rem] md:left-6 md:right-auto md:w-16 md:h-16 md:text-3xl',
                     showCfoModal
                       ? 'bg-gradient-to-br from-fuchsia-500 to-purple-700 text-white border-fuchsia-300 shadow-fuchsia-900/50'
                       : 'bg-gradient-to-br from-slate-800 to-slate-900 text-fuchsia-300 border-fuchsia-500/40 shadow-slate-900/50']">
            🧠
        </button>`,
`        <!-- v34.08 : les 3 actions IA quittent le flottant desktop pour le pied de sidebar
             (voir plus bas, dans le menu). Sur mobile — pas de sidebar — elles restent
             ici, flottantes, débarrassées des classes md:* qui les posaient sur le menu. -->
        <button v-if="isMobile" @click="toggleMerlin"
            :title="merlinActive ? 'Désactiver Merlin (Echap)' : 'Activer Merlin — Audit IA d\\'un champ'"
            :class="['merlin-wand-btn fixed z-[9998] rounded-full flex items-center justify-center border-2 transition-all hover:scale-110',
                      'bottom-20 right-4 w-12 h-12 text-xl',
                      merlinActive ? 'bg-gradient-to-br from-fuchsia-600 to-purple-700 text-white border-fuchsia-300' : 'bg-gradient-to-br from-slate-800 to-slate-900 text-fuchsia-300 border-purple-500/40']">
            🪄
        </button>

        <!-- v26.71 FAB Journal (mobile uniquement depuis v34.08) -->
        <button v-if="isMobile" @click="ouvrirReleve()"
            title="Ouvrir le Journal / Relevé"
            class="fixed z-[9996] rounded-full flex items-center justify-center border-2 transition-all hover:scale-110 shadow-xl
                   bottom-[11.5rem] right-4 w-12 h-12 text-xl
                   bg-gradient-to-br from-indigo-600 to-violet-700 text-white border-indigo-400/60 shadow-indigo-900/50">
            📑
        </button>

        <!-- v26.80 FAB CFO Widget (mobile uniquement depuis v34.08) -->
        <button v-if="isMobile" @click="showCfoModal = true"
            title="Ouvrir le CFO & Audit"
            :class="['fixed z-[9995] rounded-full flex items-center justify-center border-2 transition-all hover:scale-110 shadow-xl',
                     'bottom-60 right-4 w-12 h-12 text-xl',
                     showCfoModal
                       ? 'bg-gradient-to-br from-fuchsia-500 to-purple-700 text-white border-fuchsia-300 shadow-fuchsia-900/50'
                       : 'bg-gradient-to-br from-slate-800 to-slate-900 text-fuchsia-300 border-fuchsia-500/40 shadow-slate-900/50']">
            🧠
        </button>`);

/* ══════════════════════════════════════════════════════════════════════════
   2. Bulle d'astuce « Mode Merlin actif » → mobile uniquement
      (elle pointait vers l'ancienne position bottom-6/left-6 du bouton)
   ══════════════════════════════════════════════════════════════════════════ */

sub(
`            <div v-if="merlinActive && !merlinBubble.open" class="fixed bottom-36 right-4 md:bottom-24 md:left-6 md:right-auto z-[9998] bg-purple-900/95 text-purple-100 px-4 py-3 rounded-2xl shadow-2xl border border-purple-400/40 text-xs font-bold max-w-[240px] backdrop-blur">`,
`            <div v-if="isMobile && merlinActive && !merlinBubble.open" class="fixed bottom-36 right-4 z-[9998] bg-purple-900/95 text-purple-100 px-4 py-3 rounded-2xl shadow-2xl border border-purple-400/40 text-xs font-bold max-w-[240px] backdrop-blur">`);

/* ══════════════════════════════════════════════════════════════════════════
   3. Nouveau pied de sidebar — les 3 actions IA, intégrées au menu
      Inséré comme dernier enfant du bloc nav (avant sa fermeture), donc la
      sidebar garde exactement ses 2 enfants top-level (nav + footer VPS) —
      aucun risque de redistribution par le justify-between du conteneur.
   ══════════════════════════════════════════════════════════════════════════ */

sub(
`                        <button @click="redo" :disabled="!canRedo" :title="'Refaire (' + redoCount + ' disponible' + (redoCount > 1 ? 's' : '') + ')'" :class="['flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all border', canRedo ? 'bg-slate-700 hover:bg-blue-600 text-white border-slate-600' : 'bg-slate-900 text-slate-700 cursor-not-allowed border-slate-800']">↪<span v-if="!isSidebarCollapsed"> Redo</span></button>
                    </div>
                </nav>`,
`                        <button @click="redo" :disabled="!canRedo" :title="'Refaire (' + redoCount + ' disponible' + (redoCount > 1 ? 's' : '') + ')'" :class="['flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all border', canRedo ? 'bg-slate-700 hover:bg-blue-600 text-white border-slate-600' : 'bg-slate-900 text-slate-700 cursor-not-allowed border-slate-800']">↪<span v-if="!isSidebarCollapsed"> Redo</span></button>
                    </div>
                    <!-- v34.08 : Actions IA — anciennement 3 FAB flottants qui recouvraient
                         ce menu sur desktop (position: fixed + md:left-6, exactement la
                         largeur de la sidebar). Intégrées au pied du menu, dans le même
                         langage visuel que le footer VPS/Export juste en dessous : elles
                         ne flottent plus jamais par-dessus rien. -->
                    <div :class="['mt-3 pt-3 border-t border-slate-800', isSidebarCollapsed ? '' : 'px-1']">
                        <p v-if="!isSidebarCollapsed" class="text-[9px] text-slate-500 font-black uppercase tracking-widest text-center mb-2">Actions IA</p>
                        <div :class="isSidebarCollapsed ? 'flex flex-col items-center gap-2' : 'flex items-center gap-2'">
                            <button @click="showCfoModal = true" title="CFO & Audit"
                                :class="['rounded-lg flex items-center justify-center border-2 transition-all hover:scale-105',
                                         isSidebarCollapsed ? 'w-10 h-10 text-lg' : 'flex-1 h-11 text-xl',
                                         showCfoModal ? 'bg-gradient-to-br from-fuchsia-500 to-purple-700 text-white border-fuchsia-300' : 'bg-gradient-to-br from-slate-800 to-slate-900 text-fuchsia-300 border-fuchsia-500/40 hover:border-fuchsia-400']">
                                🧠
                            </button>
                            <button @click="ouvrirReleve()" title="Journal / Relevé"
                                :class="['rounded-lg flex items-center justify-center border-2 transition-all hover:scale-105 bg-gradient-to-br from-indigo-600 to-violet-700 text-white border-indigo-400/60',
                                         isSidebarCollapsed ? 'w-10 h-10 text-lg' : 'flex-1 h-11 text-xl']">
                                📑
                            </button>
                            <button @click="toggleMerlin"
                                :title="merlinActive ? 'Désactiver Merlin (Echap)' : 'Activer Merlin — Audit IA d\\'un champ'"
                                :class="['merlin-wand-btn rounded-lg flex items-center justify-center border-2 transition-all hover:scale-105',
                                         isSidebarCollapsed ? 'w-10 h-10 text-lg' : 'flex-1 h-11 text-xl',
                                         merlinActive ? 'bg-gradient-to-br from-fuchsia-600 to-purple-700 text-white border-fuchsia-300' : 'bg-gradient-to-br from-slate-800 to-slate-900 text-fuchsia-300 border-purple-500/40 hover:border-purple-400']">
                                🪄
                            </button>
                        </div>
                    </div>
                </nav>`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ v34.08 — actions IA integrees au pied de sidebar (desktop), FAB restant mobile-only');
