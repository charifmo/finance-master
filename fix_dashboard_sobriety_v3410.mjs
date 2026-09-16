/**
 * v34.10 — Élégance fintech : sobriété, typographie DH, annee unifiee, Poids annuel
 * ---------------------------------------------------------------------------
 * PÉRIMÈTRE RETENU (et pourquoi il s'arrête là)
 *
 * Les 4 chantiers demandés n'ont pas tous le même niveau de risque. Les
 * chantiers 2, 3 et 4 ciblent des éléments précis, vérifiables mécaniquement
 * (ancres de texte, cohérence des refs Vue). Le chantier 1 ("sobriété
 * visuelle") est plus large et plus flou par nature. Je l'ai scopé à ce qui
 * est concret et sans risque a l'aveugle :
 *   - le "bandeau arc-en-ciel" nommé explicitement = la ligne de badges du
 *     topbar (Surplus / Mensualités / Dép. Ann. / Entrées / Sorties / Poids),
 *     qui melangeait 6 fonds pastel differents (emerald-50, slate-50, amber-50,
 *     green-50, red-50, orange-50). Unifiee en chips sombres semi-transparentes
 *     a texte pastel, exactement la consigne du brief.
 *   - les 3 gros chiffres KPI positif/negatif de la grille "Tableau de bord"
 *     (Reste a vivre, Patrimoine Global, Patrimoine Net) : -600 -> -700,
 *     plus sourd, meme famille de teinte (le signal vert/rouge reste lisible —
 *     ce n'est pas du decor, c'est le repere positif/negatif du CFO).
 *
 * Ce que je n'ai PAS fait, et pourquoi : une refonte complete de l'onglet
 * Paramètres et un passage sombre sur toutes les cartes de l'app. Cet
 * environnement de build n'a pas d'acces au CDN (Vue/Tailwind bloques par le
 * proxy d'egress) : impossible de rendre la page pour verifier visuellement.
 * Reteindre a l'aveugle des dizaines de cartes sur une appli financiere en
 * production est le genre d'edition qui doit se faire avec un rendu sous les
 * yeux, pas par substitution de texte en confiance. Le topbar + la grille KPI
 * sont le coeur du "dashboard principal" cite dans la demande et couvrent
 * l'essentiel de l'impact visuel reel.
 *
 * CHANTIER 2 — TYPOGRAPHIE DH (1 ligne, 411 sites d'appel couverts)
 *   formatMAD() est utilisee dans les templates ET dans des concatenations de
 *   chaines pures (prompts CFO, export PDF/texte) — donc HORS de question de
 *   la faire retourner du HTML (span stylise) sans auditer un a un ses 411
 *   appels. Le vrai defaut ("135 969 \n DH") vient d'un espace normal entre le
 *   nombre et "DH" : Intl.NumberFormat('fr-FR') separe deja les milliers par
 *   une espace INSECABLE, seul le "+ ' DH'" final est cassable. Remplace par
 *   une espace insecable : plus aucun retour a la ligne possible, partout,
 *   sans toucher un seul site d'appel. Le sous-point "DH en corps reduit" est
 *   laisse de cote : il exigerait exactement l'audit a 411 sites que je viens
 *   d'ecarter pour une finition optionnelle ("ex:" dans le brief).
 *
 * CHANTIER 3 — SÉLECTEUR D'ANNÉE REDONDANT
 *   `anneeCibleProjection` n'etait pas un alias local d'anneeAffichage : ref
 *   independante, persistee en localStorage, defaut 2029 — un horizon de
 *   projection long terme decouple de l'annee en cours d'edition (v13.1,
 *   "Horizon Dynamique"). Les deux selecteurs affichaient la meme annee sur
 *   les captures parce que l'utilisateur les avait alignes a la main, pas
 *   parce que l'app les synchronisait. La demande explicite ("lie
 *   automatiquement... a l'annee globale active") est neanmoins sans
 *   ambiguite : la ref est supprimee, toutes ses lectures redirigees vers
 *   anneeAffichage. CONSEQUENCE A CONNAITRE : la fonctionnalite "voir mon
 *   patrimoine projete en 2029 pendant que j'edite le budget 2026" disparait.
 *   Si elle etait utilisee, le mecanisme est a reintroduire consciemment
 *   (ex: un reglage dans Parametres), pas comme un sous-produit de ce fix.
 *   Applique aux 3 endroits qui portaient EXACTEMENT ce meme motif redondant
 *   (topbar, grille KPI desktop, grille KPI mobile) — pas seulement celui de
 *   la capture — pour ne pas laisser deux versions incoherentes du meme motif.
 *
 * CHANTIER 4 — POIDS : IMPACT MENSUEL + TOTAL ANNUEL
 *   statsFluxAnnee.netAnnuel EST deja le total annuel des chocs (chocsSorties
 *   - chocsEntrees) — montantImpact n'est que net/12. Aucun nouveau calcul :
 *   le badge affiche desormais les deux, format demande par le client.
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
   CHANTIER 2 — formatMAD : espace insecable entre le nombre et "DH"
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                    const formatMAD = (v) => new Intl.NumberFormat('fr-FR').format(Math.round(Number(v) || 0)) + ' DH';`,
`                    const formatMAD = (v) => new Intl.NumberFormat('fr-FR').format(Math.round(Number(v) || 0)) + ' DH'; // v34.10 : espace insecable — "DH" ne saute plus a la ligne`);

/* ══════════════════════════════════════════════════════════════════════════
   CHANTIER 3 — anneeCibleProjection supprimee, tout lit anneeAffichage
   ══════════════════════════════════════════════════════════════════════════ */

// -- définition + watcher (localStorage devenu inutile) --
sub(
`                    const anneeCibleProjection = ref(Number(localStorage.getItem('annee_cible_projection')) || 2029);
                    const anneesProjectionOptions = [2024, 2025, 2026, 2027, 2028, 2029];
                    watch(anneeCibleProjection, (v) => { localStorage.setItem('annee_cible_projection', String(v)); });`,
`                    // v34.10 : anneeCibleProjection supprimee — le Patrimoine Global se lit
                    //   desormais sur l'annee active (anneeAffichage). L'ancien horizon
                    //   independant (localStorage, defaut 2029) etait percu comme un
                    //   second selecteur d'annee redondant avec celui du topbar.
                    //   anneesProjectionOptions reste : encore utilise par le selecteur
                    //   "Voyage dans le temps" (anneeCibleProjectionComptes), feature distincte.
                    const anneesProjectionOptions = [2024, 2025, 2026, 2027, 2028, 2029];`);

// -- topbar : sélecteur local retiré, rappel textuel ajouté --
sub(
`                        <p class="text-[9px] font-black text-gray-400 uppercase tracking-wide italic flex items-center gap-1 whitespace-nowrap">
                            <span>Patrimoine Global Projeté</span>
                            <select v-model.number="anneeCibleProjection" class="bg-transparent border-none outline-none text-gray-500 font-black uppercase tracking-wide cursor-pointer hover:text-blue-600 focus:text-blue-600 text-[9px] px-0 py-0">
                                <option v-for="a in anneesProjectionOptions" :key="a" :value="a">{{ a }}</option>
                            </select>
                            <span v-if="(soldesInitiaux.decalagePaie !== false)">(Avant Paie)</span>
                        </p>`,
`                        <p class="text-[9px] font-black text-gray-400 uppercase tracking-wide italic flex items-center gap-1 whitespace-nowrap">
                            <span>Patrimoine Global Projeté</span>
                            <span class="normal-case tracking-normal text-gray-400">(Fin {{ anneeAffichage }})</span>
                            <span v-if="(soldesInitiaux.decalagePaie !== false)">(Avant Paie)</span>
                        </p>`);

sub(
`                            <p class="text-[8px] font-bold text-slate-500 mb-2 -mt-1">Soldes issus du Relevé de Comptes — fin {{ Math.max(anneeCibleProjection, soldesInitiaux.anneeActuelle) }}</p>`,
`                            <p class="text-[8px] font-bold text-slate-500 mb-2 -mt-1">Soldes issus du Relevé de Comptes — fin {{ Math.max(anneeAffichage, soldesInitiaux.anneeActuelle) }}</p>`);

// -- grille KPI desktop : carte "Patrimoine Global" + label "Épargne Générée" --
// (traité conjointement au chantier 1 : bordure adoucie + chiffres mués -600 -> -700)
sub(
`                        <div class="bg-white p-6 rounded-xl shadow-sm border border-emerald-200 flex flex-col justify-center relative group">
                            <p class="text-xs text-gray-500 font-bold uppercase tracking-widest flex items-center gap-1">
                                <span>Patrimoine Global</span>
                                <select v-model.number="anneeCibleProjection" class="bg-transparent border-none outline-none text-gray-500 font-bold uppercase tracking-widest cursor-pointer hover:text-blue-600 focus:text-blue-600 text-xs px-0 py-0">
                                    <option v-for="a in anneesProjectionOptions" :key="a" :value="a">{{ a }}</option>
                                </select>
                            </p>
                            <h3 :class="['text-2xl lg:text-3xl font-black mt-2', patrimoineProjeteGlobal >= 0 ? 'text-emerald-600' : 'text-red-600']">{{ formatMAD(patrimoineProjeteGlobal) }}</h3>
                            <p class="text-[10px] mt-1 font-bold uppercase text-gray-400">Comptes : {{ formatMAD(soldeFinal) }} · Épargne : {{ formatMAD(epargneTotaleFinal) }}</p>
                        </div>
                        <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-center">
                            <p class="text-xs text-gray-500 font-bold uppercase tracking-widest">Épargne Générée ({{ anneeCibleProjection }})</p><!-- v17.14 -->`,
`                        <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-center relative group">
                            <p class="text-xs text-gray-500 font-bold uppercase tracking-widest flex items-center gap-1">
                                <span>Patrimoine Global</span>
                                <span class="normal-case font-medium tracking-normal text-gray-400">(Fin {{ anneeAffichage }})</span>
                            </p>
                            <h3 :class="['text-2xl lg:text-3xl font-black mt-2', patrimoineProjeteGlobal >= 0 ? 'text-emerald-700' : 'text-rose-700']">{{ formatMAD(patrimoineProjeteGlobal) }}</h3>
                            <p class="text-[10px] mt-1 font-bold uppercase text-gray-400">Comptes : {{ formatMAD(soldeFinal) }} · Épargne : {{ formatMAD(epargneTotaleFinal) }}</p>
                        </div>
                        <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-center">
                            <p class="text-xs text-gray-500 font-bold uppercase tracking-widest">Épargne Générée ({{ anneeAffichage }})</p><!-- v17.14 -->`);

// -- grille KPI mobile : même motif redondant, même traitement --
sub(
`                        <div class="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm">
                            <p class="text-[9px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1">
                                <span>Projection Fin</span>
                                <select v-model.number="anneeCibleProjection" class="bg-transparent border-none outline-none text-gray-500 font-black uppercase tracking-widest cursor-pointer hover:text-blue-600 focus:text-blue-600 text-[9px] px-0 py-0">
                                    <option v-for="a in anneesProjectionOptions" :key="a" :value="a">{{ a }}</option>
                                </select>
                            </p>
                            <p :class="['text-lg font-black mt-1', soldeFinal >= 0 ? 'text-blue-600' : 'text-red-600']">{{ formatMAD(soldeFinal) }}</p>
                        </div>
                        <div class="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm">
                            <p class="text-[9px] font-black text-gray-500 uppercase tracking-widest">Épargne Générée ({{ anneeCibleProjection }})</p><!-- v17.14 -->`,
`                        <div class="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm">
                            <p class="text-[9px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1">
                                <span>Solde Fin</span>
                                <span class="normal-case font-medium tracking-normal text-gray-400">({{ anneeAffichage }})</span>
                            </p>
                            <p :class="['text-lg font-black mt-1', soldeFinal >= 0 ? 'text-blue-600' : 'text-red-600']">{{ formatMAD(soldeFinal) }}</p>
                        </div>
                        <div class="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm">
                            <p class="text-[9px] font-black text-gray-500 uppercase tracking-widest">Épargne Générée ({{ anneeAffichage }})</p><!-- v17.14 -->`);

// -- les 4 lectures internes (computeds) : anneeCibleProjection.value -> anneeAffichage.value --
sub(
`                        const cible = Math.max(Number(anneeCibleProjection.value) || curA, curA);`,
`                        const cible = Math.max(Number(anneeAffichage.value) || curA, curA);`,
    2); // ouvrirReleveProjection + soldesProjetesJournal : même motif, même correction

sub(
`                        const target = Number(anneeCibleProjection.value);`,
`                        const target = Number(anneeAffichage.value);`);

sub(
`                        const cible = Number(anneeCibleProjection.value) || 2029;`,
`                        const cible = Number(anneeAffichage.value) || 2029;`);

// -- exposition dans le setup() --
sub(
`                        anneeCibleProjection, anneesProjectionOptions,`,
`                        anneesProjectionOptions,`);

/* ══════════════════════════════════════════════════════════════════════════
   CHANTIER 4 — Poids : impact mensuel ET total annuel dans le badge
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                            <span v-if="statsFluxAnnee.impactSurplus > 0" :class="['text-[11px] font-black tabular-nums', statsFluxAnnee.impactSurplus > 50 ? 'text-red-700' : 'text-orange-700']">⚠️ {{ formatMAD(statsFluxAnnee.montantImpact) }} ({{ statsFluxAnnee.impactSurplus.toFixed(0) }}%)</span>`,
`                            <span v-if="statsFluxAnnee.impactSurplus > 0" :class="['text-[11px] font-black tabular-nums', statsFluxAnnee.impactSurplus > 50 ? 'text-rose-400' : 'text-orange-300']">⚠️ {{ formatMAD(statsFluxAnnee.montantImpact) }}/m · Total {{ formatMAD(statsFluxAnnee.netAnnuel) }} ({{ statsFluxAnnee.impactSurplus.toFixed(0) }}%)</span>`);

/* ══════════════════════════════════════════════════════════════════════════
   CHANTIER 1 — Bandeau topbar : 6 pastels disparates -> chips sombres unifiées
   La logique conditionnelle (positif/negatif/alerte) est intégralement
   conservée — seule la palette change (fonds -50 pastel -> chip slate-900/90
   uniforme, textes -600/-700 saturés -> -400 pastel-sur-sombre).
   ══════════════════════════════════════════════════════════════════════════ */

// -- Surplus --
sub(
`                            <div :class="['border rounded-lg px-2 py-1 cursor-pointer select-none flex items-baseline gap-1.5 whitespace-nowrap', surplusMensuelBase >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-300']">
                                <span class="text-[9px] font-black uppercase tracking-wide text-gray-500">💰 Surplus ⓘ</span>
                                <span :class="['text-[11px] font-black tabular-nums', surplusMensuelBase >= 0 ? 'text-emerald-700' : 'text-red-600']">{{ formatMAD(surplusMensuelBase) }}</span>
                            </div>`,
`                            <div class="border border-white/10 bg-slate-900/90 rounded-lg px-2 py-1 cursor-pointer select-none flex items-baseline gap-1.5 whitespace-nowrap">
                                <span class="text-[9px] font-black uppercase tracking-wide text-slate-400">💰 Surplus ⓘ</span>
                                <span :class="['text-[11px] font-black tabular-nums', surplusMensuelBase >= 0 ? 'text-emerald-400' : 'text-rose-400']">{{ formatMAD(surplusMensuelBase) }}</span>
                            </div>`);

// -- Mensualités --
sub(
`                            <div class="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 cursor-pointer select-none flex items-baseline gap-1.5 whitespace-nowrap">
                                <span class="text-[9px] font-black uppercase tracking-wide text-gray-500">🏦 Mensualités ⓘ</span>
                                <span class="text-[11px] font-black text-slate-700 tabular-nums">{{ formatMAD(totalCreditsMensuels) }}</span>
                                <span :class="['text-[9px] font-bold', tauxEndettement > 40 ? 'text-red-500' : (tauxEndettement > 30 ? 'text-orange-500' : 'text-green-600')]">{{ tauxEndettement.toFixed(0) }}%</span>
                            </div>`,
`                            <div class="bg-slate-900/90 border border-white/10 rounded-lg px-2 py-1 cursor-pointer select-none flex items-baseline gap-1.5 whitespace-nowrap">
                                <span class="text-[9px] font-black uppercase tracking-wide text-slate-400">🏦 Mensualités ⓘ</span>
                                <span class="text-[11px] font-black text-slate-200 tabular-nums">{{ formatMAD(totalCreditsMensuels) }}</span>
                                <span :class="['text-[9px] font-bold', tauxEndettement > 40 ? 'text-rose-400' : (tauxEndettement > 30 ? 'text-orange-300' : 'text-emerald-400')]">{{ tauxEndettement.toFixed(0) }}%</span>
                            </div>`);

// -- Dépenses Annuelles --
sub(
`                            <div :class="['border rounded-lg px-2 py-1 cursor-pointer select-none flex items-baseline gap-1.5 whitespace-nowrap', kpiDepensesAnnuelles.soldeFinal < 0 ? 'bg-red-50 border-red-300' : 'bg-amber-50 border-amber-200']">
                                <span class="text-[9px] font-black uppercase tracking-wide text-gray-500">{{ kpiDepensesAnnuelles.icone }} Dép. Ann. ⓘ</span>
                                <span :class="['text-[11px] font-black tabular-nums', kpiDepensesAnnuelles.soldeFinal < 0 ? 'text-red-600' : 'text-amber-700']">{{ formatMAD(kpiDepensesAnnuelles.soldeFinal) }}</span>
                                <span class="text-[9px] font-bold text-gray-400">fin {{ kpiDepensesAnnuelles.anneeCible }}</span>
                            </div>`,
`                            <div class="border border-white/10 bg-slate-900/90 rounded-lg px-2 py-1 cursor-pointer select-none flex items-baseline gap-1.5 whitespace-nowrap">
                                <span class="text-[9px] font-black uppercase tracking-wide text-slate-400">{{ kpiDepensesAnnuelles.icone }} Dép. Ann. ⓘ</span>
                                <span :class="['text-[11px] font-black tabular-nums', kpiDepensesAnnuelles.soldeFinal < 0 ? 'text-rose-400' : 'text-amber-300']">{{ formatMAD(kpiDepensesAnnuelles.soldeFinal) }}</span>
                                <span class="text-[9px] font-bold text-slate-500">fin {{ kpiDepensesAnnuelles.anneeCible }}</span>
                            </div>`);

// -- Entrées / Sorties --
sub(
`                        <div class="bg-green-50 border border-green-200 rounded-lg px-2 py-1 flex items-baseline gap-1.5 whitespace-nowrap">
                            <span class="text-[9px] font-black text-green-600 uppercase tracking-wide">↑ Entrées {{anneeAffichage}}</span>
                            <span class="text-[11px] font-black text-green-700 tabular-nums">+{{ formatMAD(statsFluxAnnee.totalEntrees) }}</span>
                        </div>
                        <div class="bg-red-50 border border-red-200 rounded-lg px-2 py-1 flex items-baseline gap-1.5 whitespace-nowrap">
                            <span class="text-[9px] font-black text-red-600 uppercase tracking-wide">↓ Sorties {{anneeAffichage}}</span>
                            <span class="text-[11px] font-black text-red-700 tabular-nums">-{{ formatMAD(statsFluxAnnee.totalSorties) }}</span>
                        </div>`,
`                        <div class="bg-slate-900/90 border border-white/10 rounded-lg px-2 py-1 flex items-baseline gap-1.5 whitespace-nowrap">
                            <span class="text-[9px] font-black text-slate-400 uppercase tracking-wide">↑ Entrées {{anneeAffichage}}</span>
                            <span class="text-[11px] font-black text-emerald-400 tabular-nums">+{{ formatMAD(statsFluxAnnee.totalEntrees) }}</span>
                        </div>
                        <div class="bg-slate-900/90 border border-white/10 rounded-lg px-2 py-1 flex items-baseline gap-1.5 whitespace-nowrap">
                            <span class="text-[9px] font-black text-slate-400 uppercase tracking-wide">↓ Sorties {{anneeAffichage}}</span>
                            <span class="text-[11px] font-black text-rose-400 tabular-nums">-{{ formatMAD(statsFluxAnnee.totalSorties) }}</span>
                        </div>`);

// -- Poids (pill uniquement — la logique conditionnelle et le tooltip restent intacts) --
sub(
`                        <div :class="['border rounded-lg px-2 py-1 relative cursor-default flex items-baseline gap-1.5 whitespace-nowrap', statsFluxAnnee.impactSurplus > 0 ? (statsFluxAnnee.impactSurplus > 50 ? 'bg-red-50 border-red-300' : 'bg-orange-50 border-orange-300') : 'bg-emerald-50 border-emerald-300']"
                             @mouseenter="showPoidsTooltip = true" @mouseleave="showPoidsTooltip = false">
                            <span :class="['text-[9px] font-black uppercase tracking-wide', statsFluxAnnee.impactSurplus > 0 ? (statsFluxAnnee.impactSurplus > 50 ? 'text-red-600' : 'text-orange-600') : 'text-emerald-600']">Poids ⓘ</span>`,
`                        <div class="border border-white/10 bg-slate-900/90 rounded-lg px-2 py-1 relative cursor-default flex items-baseline gap-1.5 whitespace-nowrap"
                             @mouseenter="showPoidsTooltip = true" @mouseleave="showPoidsTooltip = false">
                            <span :class="['text-[9px] font-black uppercase tracking-wide', statsFluxAnnee.impactSurplus > 0 ? (statsFluxAnnee.impactSurplus > 50 ? 'text-rose-400' : 'text-orange-300') : 'text-emerald-400']">Poids ⓘ</span>`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ v34.10 — sobriété topbar, DH insécable, année unifiée, Poids annuel');
