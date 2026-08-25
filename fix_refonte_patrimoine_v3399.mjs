/**
 * v33.99 — Refonte UX de la page Patrimoine & Objectifs
 * ---------------------------------------------------------------------------
 *  1. Hiérarchie « Family Office » : KPI en tête, puis le portefeuille, puis
 *     les objectifs et l'indépendance financière, enfin le simulateur.
 *  2. Tableau scindé en deux sous-sections : Actifs productifs / Foncier &
 *     jouissance, chacune avec sa ligne de regroupement.
 *  3. « dont X de marge » quitte la cellule et devient une info-bulle native.
 *  4. Hypothèses du moteur et garde-fous rangés dans un <details> fermé
 *     « ⚙️ Paramètres avancés ».
 *  5. Taux de couverture affiché en barre de progression rouge → orange → vert.
 */
import fs from 'node:fs';

const FILE = new URL('./index.html', import.meta.url);
let s = fs.readFileSync(FILE, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.split('\r\n').join('\n');
const sub = (from, to, n = 1) => {
    const c = s.split(from).length - 1;
    if (c !== n) throw new Error(`Ancre (${c}/${n}) :\n${from.slice(0, 160)}`);
    s = s.split(from).join(to);
};
const coupe = (debut, fin, label) => {
    const i0 = s.indexOf(debut);
    if (i0 < 0) throw new Error('début introuvable : ' + label);
    const i1 = s.indexOf(fin, i0);
    if (i1 < 0) throw new Error('fin introuvable : ' + label);
    const bloc = s.slice(i0, i1);
    s = s.slice(0, i0) + s.slice(i1);
    return bloc;
};

/* ══════════════════════════════════════════════════════════════════════════
   1. EXTRACTION — objectifs + épargne (à replacer après le portefeuille)
   ══════════════════════════════════════════════════════════════════════════ */
const blocObjectifs = coupe(
    `                    <!-- ── Section 1 : Smart Goals CRUD (v17.16) ── -->`,
    `                    <!-- ══ v33.90 : SYNTHÈSE DU PATRIMOINE — table unique ══ -->`,
    'objectifs + épargne');

/* ══════════════════════════════════════════════════════════════════════════
   2. EXTRACTION — bloc KPI (à remonter tout en haut)
   ══════════════════════════════════════════════════════════════════════════ */
const blocKpi = coupe(
    `                            <!-- Synthèse chiffrée -->`,
    `                        </div>
                    </div>

                    <div data-cfo-collapse="wealth-sandbox"`,
    'bloc KPI');

// Le KPI devient une carte autonome en tête de page
const CARTE_KPI = `                    <!-- ══ v33.99 : KPI en tête — le patrimoine d'un coup d'œil ══ -->
                    <div class="bg-gradient-to-r from-violet-600 to-purple-700 rounded-2xl p-5 text-white shadow-lg shadow-purple-900/20">
                        <p class="text-[10px] font-black uppercase tracking-widest opacity-70 mb-4">🏛️ Patrimoine retenu</p>
                        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
                            <div>
                                <p class="text-[9px] uppercase tracking-widest opacity-60 mb-1">Valeur des actifs</p>
                                <p class="text-xl lg:text-2xl font-black">{{ formatMAD(globalValeurTotale) }}</p>
                            </div>
                            <div>
                                <p class="text-[9px] uppercase tracking-widest opacity-60 mb-1">Dette totale</p>
                                <p class="text-xl lg:text-2xl font-black text-rose-300"
                                   :title="globalDetteBancaire.marge > 0 ? 'Capital pur. Au sens banque : ' + formatMAD(globalDetteBancaire.total) + ' dont ' + formatMAD(globalDetteBancaire.marge) + ' de marge non échue.' : null">{{ formatMAD(globalDetteTotale) }}</p>
                            </div>
                            <div>
                                <p class="text-[9px] uppercase tracking-widest opacity-60 mb-1">Patrimoine net</p>
                                <p class="text-xl lg:text-2xl font-black text-emerald-300">{{ formatMAD(globalPatrimoineNet) }}</p>
                            </div>
                            <div>
                                <p class="text-[9px] uppercase tracking-widest opacity-60 mb-1">Revenus passifs nets</p>
                                <p :class="['text-xl lg:text-2xl font-black', revenusPassifsNetsMensuel >= 0 ? 'text-yellow-300' : 'text-red-300']">{{ formatMAD(Math.round(revenusPassifsNetsMensuel)) }}<span class="text-[10px]">/mois</span></p>
                            </div>
                        </div>
                        <p v-if="assetsExclus.length" class="text-[10px] opacity-60 mt-3 pt-2 border-t border-white/20">
                            🙈 {{ assetsExclus.length }} actif{{ assetsExclus.length > 1 ? 's' : '' }} exclu{{ assetsExclus.length > 1 ? 's' : '' }} du calcul — {{ formatMAD(valeurExclue) }}
                        </p>
                    </div>

`;

sub(`                    <!-- ══ v33.90 : SYNTHÈSE DU PATRIMOINE — table unique ══ -->`,
    CARTE_KPI + `                    <!-- ══ v33.90 : SYNTHÈSE DU PATRIMOINE — table unique ══ -->`);

/* ══════════════════════════════════════════════════════════════════════════
   3. RÉINSERTION — objectifs juste avant le simulateur
   ══════════════════════════════════════════════════════════════════════════ */
sub(`                    <div data-cfo-collapse="wealth-sandbox"`,
    blocObjectifs + `                    <div data-cfo-collapse="wealth-sandbox"`);

/* ══════════════════════════════════════════════════════════════════════════
   4. TABLEAU — deux sous-sections
   ══════════════════════════════════════════════════════════════════════════ */
// La boucle unique devient deux boucles, chacune précédée d'une ligne de groupe.
sub(
`                                        <template v-for="asset in masterAssets" :key="asset.id">`,
`                                        <!-- v33.99 : regroupement par nature -->
                                        <tr v-if="roiAssets.length" class="bg-emerald-50 border-b border-emerald-100">
                                            <td colspan="8" class="px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                                                🟢 Actifs productifs · {{ roiAssets.length }}
                                                <span class="text-emerald-500 font-bold normal-case tracking-normal">— {{ formatMAD(Math.round(revenusPassifsNetsMensuel)) }}/mois de cash-flow net</span>
                                            </td>
                                        </tr>
                                        <template v-for="asset in [...roiAssets, ...stressAssets]" :key="asset.id">
                                        <tr v-if="!asset.isProductive && asset.id === (stressAssets[0] || {}).id" class="bg-amber-50 border-b border-amber-100">
                                            <td colspan="8" class="px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-amber-700">
                                                🟠 Foncier &amp; jouissance · {{ stressAssets.length }}
                                                <span class="text-amber-500 font-bold normal-case tracking-normal">— aucun revenu attendu, valorisation et sortie</span>
                                            </td>
                                        </tr>`);

/* ── 5. Marge : info-bulle au lieu de texte sous le montant ──────────────── */
sub(
`                                                <template v-for="d in [detteBancaire(asset)]" :key="'d'+asset.id">
                                                    <span class="text-rose-700 font-black">{{ formatMAD(d.total) }}</span>
                                                    <span v-if="d.estMourabaha && d.marge > 0" class="block text-[9px] font-bold text-gray-400 mt-0.5">dont {{ formatMAD(d.marge) }} de marge</span>
                                                </template>`,
`                                                <template v-for="d in [detteBancaire(asset)]" :key="'d'+asset.id">
                                                    <span class="text-rose-700 font-black"
                                                          :class="d.estMourabaha && d.marge > 0 ? 'border-b border-dotted border-rose-300 cursor-help' : ''"
                                                          :title="d.estMourabaha && d.marge > 0 ? 'Dette au sens de la banque : ' + formatMAD(d.capital) + ' de capital restant + ' + formatMAD(d.marge) + ' de marge non échue. Le patrimoine net ne déduit que le capital.' : null">{{ formatMAD(d.total) }}</span>
                                                </template>`);

sub(
`                                                <span class="font-black text-base text-rose-300">{{ formatMAD(globalDetteBancaire.total) }}</span>
                                                <span v-if="globalDetteBancaire.marge > 0" class="block text-[9px] font-bold text-white/50 mt-0.5">dont {{ formatMAD(globalDetteBancaire.marge) }} de marge</span>`,
`                                                <span class="font-black text-base text-rose-300"
                                                      :class="globalDetteBancaire.marge > 0 ? 'border-b border-dotted border-rose-400 cursor-help' : ''"
                                                      :title="globalDetteBancaire.marge > 0 ? formatMAD(globalDetteBancaire.capital) + ' de capital restant + ' + formatMAD(globalDetteBancaire.marge) + ' de marge non échue.' : null">{{ formatMAD(globalDetteBancaire.total) }}</span>`);

/* ── 6. Taux de couverture en barre de progression ───────────────────────── */
sub(
`                                    <div class="text-right">
                                        <p class="text-2xl font-black tabular-nums">{{ independanceFinanciere.tauxCouverture }}%</p>
                                        <p class="text-[9px] uppercase tracking-widest opacity-70">couverture</p>
                                    </div>`,
`                                    <div class="text-right min-w-[180px]">
                                        <p class="text-2xl font-black tabular-nums">{{ independanceFinanciere.tauxCouverture }}%</p>
                                        <p class="text-[9px] uppercase tracking-widest opacity-70 mb-1.5">couverture</p>
                                        <!-- v33.99 : rouge sous 40 %, orange jusqu'à 80 %, vert au-delà -->
                                        <div class="h-2.5 w-full bg-white/25 rounded-full overflow-hidden">
                                            <div :class="['h-full rounded-full transition-all duration-500',
                                                          independanceFinanciere.tauxCouverture >= 100 ? 'bg-emerald-300'
                                                          : independanceFinanciere.tauxCouverture >= 80 ? 'bg-lime-300'
                                                          : independanceFinanciere.tauxCouverture >= 40 ? 'bg-amber-300' : 'bg-rose-400']"
                                                 :style="{ width: Math.min(100, Math.max(2, independanceFinanciere.tauxCouverture)) + '%' }"></div>
                                        </div>
                                    </div>`);

/* ── 7. Hypothèses du moteur repliées dans « Paramètres avancés » ────────── */
sub(
`                            <!-- v33.00 : hypothèses du moteur + garde-fous anti-double-comptage -->
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">`,
`                            <!-- v33.99 : réglages fins repliés par défaut -->
                            <details class="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
                                <summary class="px-4 py-2.5 cursor-pointer text-[11px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-100 select-none">⚙️ Paramètres avancés</summary>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 bg-slate-50">`);

sub(
`                                    <p class="text-[9px] text-gray-400 italic leading-snug">Décoché = le moteur ajoute le flux lui-même. Coché = il le laisse au budget pour ne pas le compter deux fois.</p>
                                </div>
                            </div>`,
`                                    <p class="text-[9px] text-gray-400 italic leading-snug">Décoché = le moteur ajoute le flux lui-même. Coché = il le laisse au budget pour ne pas le compter deux fois.</p>
                                </div>
                            </div>
                            </details>`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ v33.99 appliquée');
