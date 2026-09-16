/**
 * v34.12 — Modale CFO & Audit : format cockpit par défaut + plein écran strict
 * ---------------------------------------------------------------------------
 * ÉTAT DE DÉPART — ce n'était pas une vraie modale
 *   #cfo-widget-modal est un widget flottant `position:fixed` positionné en
 *   bas-gauche (bottom:5.5rem;left:5rem), redimensionnable à la souris
 *   (resize:both) et déplaçable par sa barre de titre (startDragCfoWidget,
 *   qui mute modal.style.top/left en pixels bruts). Aucun fond n'estompait
 *   le dashboard derrière — c'était un assistant flottant, pas une modale.
 *
 * POURQUOI PAS transform:translate(-50%,-50%) POUR CENTRER
 *   startDragCfoWidget ancre le drag sur getBoundingClientRect() puis fixe
 *   top/left en px SANS toucher à `transform`. Un centrage par transform
 *   resterait actif par-dessus ce top/left fraîchement posé et décalerait le
 *   widget de la moitié de sa taille au premier glisser-déposer — un bug
 *   silencieux. Centrage choisi à la place : `top:0;left:0;right:0;bottom:0;
 *   margin:auto;` sur l'élément fixed — technique standard, compatible telle
 *   quelle avec le code de drag existant (il pose déjà top/left explicites et
 *   bottom/right:auto pendant le glisser, ce qui neutralise proprement le
 *   margin:auto sans qu'on ait à toucher startDragCfoWidget).
 *
 * TROIS ÉTATS, DEUX BASCULABLES PAR L'UTILISATEUR
 *   1. Fermée (showCfoModal=false) — rien de rendu.
 *   2. Cockpit (défaut à CHAQUE ouverture) — 90vw/1200px × 85vh/900px,
 *      centrée, redimensionnable/déplaçable comme avant.
 *   3. Plein écran strict (cfoMaximized=true, via l'icône ⛶) — 100vw/100vh,
 *      sans marge ni arrondi.
 *   Un watch() remet cfoMaximized à false à CHAQUE ouverture : rouvrir la
 *   modale donne toujours le format cockpit, jamais un plein écran qui
 *   traînerait d'une session précédente — c'est ce que "dimensions par
 *   défaut" demande.
 *
 * FERMETURE — le bouton ✕ fonctionnait déjà. Échap n'était PAS géré (seul
 *   Merlin l'était) : ajouté au même écouteur global. Le fond assombri est
 *   lui-même cliquable pour fermer (convention déjà en place dans l'app pour
 *   showReleveModal / showChangelog / showDriveHelp : fixed inset-0, fond
 *   sombre semi-transparent, backdrop-blur-sm, fermeture au clic sur le fond).
 *
 * BULLES DE RÉPONSE — élargies pour les réponses du CFO (tableaux/ratios),
 *   plus mesurées pour les messages utilisateur (question courte).
 * ══════════════════════════════════════════════════════════════════════════
 */
import fs from 'node:fs';

const FILE = new URL('./index.html', import.meta.url);
let s = fs.readFileSync(FILE, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.split('\r\n').join('\n');
const sub = (from, to, n = 1) => {
    const c = s.split(from).length - 1;
    if (c !== n) throw new Error(`Ancre (${c}/${n}) :\n${from.slice(0, 220)}`);
    s = s.split(from).join(to);
};

/* ══════════════════════════════════════════════════════════════════════════
   1. Fond assombri + nouvelles dimensions (cockpit / plein écran strict)
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                <!-- v26.95 CFO-Modal-Layout-Fix — single-column chat, flex fluide, v-show persistant -->
                <Teleport to="body">
                <div id="cfo-widget-modal" v-show="showCfoModal"
                     class="fixed bg-white rounded-2xl shadow-2xl border border-fuchsia-200/60 flex flex-col"
                     :class="cfoMaximized ? 'z-[10000]' : 'z-[9990]'"
                     :style="cfoMaximized
                         ? 'overflow:hidden;top:0.5rem;left:0.5rem;right:auto;bottom:auto;width:calc(100vw - 1rem);height:calc(100vh - 1rem);'
                         : 'resize:both;overflow:hidden;min-width:320px;min-height:380px;max-width:95vw;max-height:92vh;width:min(620px,90vw);height:min(600px,85vh);bottom:5.5rem;left:5rem;top:auto;right:auto;'">`,
`                <!-- v34.12 : fond assombri — estompe le dashboard pendant l'échange, ferme au clic -->
                <Teleport to="body">
                <div v-show="showCfoModal" @click="showCfoModal = false" class="fixed inset-0 z-[9985] bg-black/60 backdrop-blur-sm"></div>
                <!-- v34.12 CFO-Modal-Cockpit — cockpit d'analyse par défaut (90vw/1200px × 85vh/900px,
                     centrée), plein écran strict (100vw/100vh) via l'icône ⛶. -->
                <div id="cfo-widget-modal" v-show="showCfoModal"
                     class="fixed bg-white shadow-2xl border border-fuchsia-200/60 flex flex-col"
                     :class="cfoMaximized ? 'z-[10000] rounded-none' : 'z-[9990] rounded-2xl'"
                     :style="cfoMaximized
                         ? 'overflow:hidden;top:0;left:0;right:auto;bottom:auto;width:100vw;height:100vh;max-width:none;max-height:none;margin:0;'
                         : 'resize:both;overflow:hidden;min-width:320px;min-height:380px;max-width:95vw;max-height:92vh;width:min(1200px,90vw);height:min(900px,85vh);top:0;left:0;right:0;bottom:0;margin:auto;'">`);

/* ══════════════════════════════════════════════════════════════════════════
   2. Réouverture = toujours le format cockpit (jamais un plein écran
      hérité d'une session précédente)
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                    const cfoMaximized   = ref(false); // v27.1 : plein écran du widget`,
`                    const cfoMaximized   = ref(false); // v27.1 : plein écran du widget
                    // v34.12 : chaque ouverture repart du format cockpit — jamais un plein
                    //   écran laissé actif par la session precedente.
                    watch(showCfoModal, (v) => { if (v) cfoMaximized.value = false; });`);

/* ══════════════════════════════════════════════════════════════════════════
   3. Échap ferme la modale CFO (elle ne fermait qu'au bouton ✕ jusqu'ici)
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && merlinActive.value) toggleMerlin(); });`,
`                    document.addEventListener('keydown', (e) => {
                        if (e.key === 'Escape' && merlinActive.value) toggleMerlin();
                        if (e.key === 'Escape' && showCfoModal.value) showCfoModal.value = false; // v34.12
                    });`);

/* ══════════════════════════════════════════════════════════════════════════
   4. Bulles de réponse : plus larges côté CFO (tableaux/ratios), mesurées
      côté utilisateur (question courte)
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                                <div v-for="(msg, idx) in cfoMessages" :key="idx" :class="['flex', msg.role === 'user' ? 'justify-end' : 'justify-start']">
                                    <div :class="['max-w-[80%] p-4 rounded-2xl shadow-lg', msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white text-gray-800 border border-slate-200']">`,
`                                <div v-for="(msg, idx) in cfoMessages" :key="idx" :class="['flex', msg.role === 'user' ? 'justify-end' : 'justify-start']">
                                    <div :class="[msg.role === 'user' ? 'max-w-[80%]' : 'max-w-[92%]', 'p-4 rounded-2xl shadow-lg', msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white text-gray-800 border border-slate-200']">`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ v34.12 — modale CFO en format cockpit par défaut, plein écran strict, backdrop, Échap');
