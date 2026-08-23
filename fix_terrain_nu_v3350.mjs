/**
 * v33.50 — Interface conditionnelle pour le foncier nu
 * ---------------------------------------------------------------------------
 * Un terrain nu hérité en indivision n'a ni crédit ni locataire : les onglets
 * Financement et Exploitation sont masqués. À la place, l'accent est mis sur
 * le portage et la sortie — origine, valorisation au m², quote-part, scénarios
 * de vente et frais de sortie (Semsar, TNB, TPI).
 *
 * Nouveaux champs : annee_acquisition, surface_totale, prix_m2,
 * valeur_globale_terrain, prix_vente_pessimiste / median / optimiste,
 * scenarios_par_m2, arrieres_tnb, provision_tpi, commission_semsar_pct,
 * commission_semsar_montant.
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
   1. SCHÉMA
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                        regime_fiscal: 'exonere', taux_marginal: 37, abattement_pct: 40,`,
`                        // v33.50 — FONCIER NU : origine, valorisation, sortie
                        annee_acquisition: 0, surface_totale: 0, prix_m2: 0, valeur_globale_terrain: 0,
                        scenarios_par_m2: false,
                        prix_vente_pessimiste: 0, prix_vente_median: 0, prix_vente_optimiste: 0,
                        arrieres_tnb: 0, provision_tpi: 0,
                        commission_semsar_pct: 2.5, commission_semsar_montant: 0,
                        // FISCALITÉ
                        regime_fiscal: 'exonere', taux_marginal: 37, abattement_pct: 40,`);

sub(
`                            part_bati_pct: Number(f.part_bati_pct) || 0,
                            _v: 19,`,
`                            part_bati_pct: Number(f.part_bati_pct) || 0,
                            // ── FONCIER NU (v33.50) ──
                            annee_acquisition: Number(f.annee_acquisition) || 0,
                            surface_totale: Number(f.surface_totale) || 0,
                            prix_m2: Number(f.prix_m2) || 0,
                            valeur_globale_terrain: Number(f.valeur_globale_terrain) || 0,
                            scenarios_par_m2: !!f.scenarios_par_m2,
                            prix_vente_pessimiste: Number(f.prix_vente_pessimiste) || 0,
                            prix_vente_median: Number(f.prix_vente_median) || 0,
                            prix_vente_optimiste: Number(f.prix_vente_optimiste) || 0,
                            arrieres_tnb: Number(f.arrieres_tnb) || 0,
                            provision_tpi: Number(f.provision_tpi) || 0,
                            commission_semsar_pct: Number(f.commission_semsar_pct) || 0,
                            commission_semsar_montant: Number(f.commission_semsar_montant) || 0,
                            _v: 19,`);

/* ══════════════════════════════════════════════════════════════════════════
   2. MOTEUR — quote-part, scénarios de vente, net vendeur foncier
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                    // ── v33.40 : MOIS ÉCOULÉS DEPUIS LE DÉBLOCAGE ──────────────────────`,
String.raw`                    // ── v33.50 : FONCIER NU ────────────────────────────────────────────
                    //   « Terrain » comme « Terrain Nu » : on reconnaît les deux, les
                    //   actifs créés avant cette version portent le type court.
                    const estTerrainNu = (a) => /terrain/i.test(String((a || {}).type || ''));
                    // "35%" → 35 ; une quote-part vide vaut 100 %
                    const quotePartPct = (a) => {
                        const v = parseFloat(String((a || {}).quotePart || '100').replace(',', '.'));
                        return Number.isFinite(v) && v > 0 ? v : 100;
                    };

                    // Trois scénarios de vente → net réellement encaissé
                    //   prix global (ou prix au m² × surface)
                    //   × quote-part − commission Semsar − arriérés TNB − provision TPI
                    const terrainScenarios = (asset) => {
                        const a = asset || {};
                        const qp = quotePartPct(a) / 100;
                        const surface = N(a.surface_totale);
                        const parM2 = !!a.scenarios_par_m2;
                        const semsarPct = N(a.commission_semsar_pct) / 100;
                        const tnb = N(a.arrieres_tnb);
                        const tpi = N(a.provision_tpi);
                        const r0 = (v) => Math.round(v);
                        const build = (cle, label, saisie) => {
                            const prixGlobal = parM2 ? N(saisie) * surface : N(saisie);
                            const maPart = prixGlobal * qp;
                            const semsar = maPart * semsarPct;
                            const net = maPart - semsar - tnb - tpi;
                            return {
                                cle, label, saisie: N(saisie),
                                prixGlobal: r0(prixGlobal),
                                prixM2: surface > 0 ? Math.round(prixGlobal / surface) : 0,
                                maPart: r0(maPart), semsar: r0(semsar), tnb: r0(tnb), tpi: r0(tpi),
                                net: r0(net),
                                // écart vs la valeur actuellement inscrite au patrimoine
                                ecart: r0(net - (N(a.valeur_actuelle) || N(a.prix_acquisition))),
                            };
                        };
                        return [
                            build('pessimiste', 'Pessimiste', a.prix_vente_pessimiste),
                            build('median', 'Médian', a.prix_vente_median),
                            build('optimiste', 'Optimiste', a.prix_vente_optimiste),
                        ];
                    };

                    // ── v33.40 : MOIS ÉCOULÉS DEPUIS LE DÉBLOCAGE ──────────────────────`);

/* ══════════════════════════════════════════════════════════════════════════
   3. MODALE — computed dérivés + synchronisations explicites
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                    const masterAssetPiloteParCapital = computed(() => N(masterAssetForm.value.capital_initial) > 0);`,
String.raw`                    const masterAssetPiloteParCapital = computed(() => N(masterAssetForm.value.capital_initial) > 0);
                    // v33.50 : contexte foncier
                    const masterAssetEstTerrain = computed(() => estTerrainNu(masterAssetForm.value));
                    const masterAssetQuotePct = computed(() => quotePartPct(masterAssetForm.value));
                    const masterAssetMaPart = computed(() =>
                        Math.round(N(masterAssetForm.value.valeur_globale_terrain) * masterAssetQuotePct.value / 100));
                    const masterAssetScenarios = computed(() => terrainScenarios(masterAssetForm.value));
                    const masterAssetOngletsDispos = computed(() => masterAssetEstTerrain.value
                        ? [['acquisition','🏞️ Origine & Valorisation'],['scenarios','💰 Scénarios de Vente'],['fiscalite','🧾 Fiscalité & Frais de Sortie']]
                        : [['acquisition','🏗️ Acquisition'],['financement','🏦 Financement'],['exploitation','🔑 Exploitation'],['fiscalite','🧾 Fiscalité']]);

                    // Synchronisations explicites (pas de watcher croisé : aucune boucle)
                    const syncPrixM2 = () => {
                        const f = masterAssetForm.value;
                        if (N(f.surface_totale) > 0) f.valeur_globale_terrain = Math.round(N(f.prix_m2) * N(f.surface_totale));
                    };
                    const syncValeurGlobale = () => {
                        const f = masterAssetForm.value;
                        if (N(f.surface_totale) > 0) f.prix_m2 = Math.round((N(f.valeur_globale_terrain) / N(f.surface_totale)) * 100) / 100;
                        // ma quote-part alimente la valeur retenue au patrimoine
                        if (N(f.valeur_globale_terrain) > 0) f.valeur_actuelle = masterAssetMaPart.value;
                    };
                    // La commission Semsar est un résultat : on la stocke pour l'export
                    watch(
                        () => [masterAssetForm.value.prix_vente_median, masterAssetForm.value.commission_semsar_pct,
                               masterAssetForm.value.surface_totale, masterAssetForm.value.scenarios_par_m2,
                               masterAssetForm.value.quotePart].join('|'),
                        () => {
                            if (!masterAssetEstTerrain.value) return;
                            const med = masterAssetScenarios.value.find(x => x.cle === 'median');
                            if (med && Number(masterAssetForm.value.commission_semsar_montant) !== med.semsar) {
                                masterAssetForm.value.commission_semsar_montant = med.semsar;
                            }
                        },
                        { immediate: true }
                    );`);

sub(
`                        masterAssetMoisAuto, masterAssetDatePilotee,`,
`                        masterAssetMoisAuto, masterAssetDatePilotee,
                        masterAssetEstTerrain, masterAssetQuotePct, masterAssetMaPart,
                        masterAssetScenarios, masterAssetOngletsDispos, syncPrixM2, syncValeurGlobale,
                        estTerrainNu, quotePartPct, terrainScenarios,`);

/* ══════════════════════════════════════════════════════════════════════════
   4. TEMPLATE — barre d'onglets conditionnelle
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                            <button v-for="t in [['acquisition','🏗️ Acquisition'],['financement','🏦 Financement'],['exploitation','🔑 Exploitation'],['fiscalite','🧾 Fiscalité']]" :key="t[0]"`,
`                            <button v-for="t in masterAssetOngletsDispos" :key="t[0]"`);

// Les onglets masqués ne doivent pas rester actifs si on bascule sur Terrain Nu
sub(
`                        <div v-show="masterAssetTab === 'financement'" class="grid grid-cols-2 md:grid-cols-3 gap-3">`,
`                        <div v-show="masterAssetTab === 'financement' && !masterAssetEstTerrain" class="grid grid-cols-2 md:grid-cols-3 gap-3">`);
sub(
`                        <div v-show="masterAssetTab === 'exploitation'" class="space-y-3">`,
`                        <div v-show="masterAssetTab === 'exploitation' && !masterAssetEstTerrain" class="space-y-3">`);

/* ── 5. Bloc « Origine & Valorisation » dans l'onglet acquisition ────────── */
sub(
`                        <!-- ── ACQUISITION ── -->
                        <div v-show="masterAssetTab === 'acquisition'" class="grid grid-cols-2 md:grid-cols-3 gap-3">`,
`                        <!-- ── v33.50 : ORIGINE & VALORISATION (terrain nu) ── -->
                        <div v-show="masterAssetTab === 'acquisition' && masterAssetEstTerrain" class="space-y-3">
                            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div>
                                    <label class="text-[10px] font-black uppercase tracking-widest text-amber-700 block mb-1.5">Année d'acquisition</label>
                                    <input v-model.number="masterAssetForm.annee_acquisition" type="number" min="1900" max="2100" step="1" placeholder="ex. 1998"
                                           class="w-full bg-amber-50 border-2 border-amber-200 rounded-lg px-3 py-2 text-sm font-black text-amber-800 outline-none focus:border-amber-500 text-right"/>
                                    <p class="text-[9px] text-amber-500 font-bold mt-0.5">Base de l’abattement TPI</p>
                                </div>
                                <div>
                                    <label class="text-[10px] font-black uppercase tracking-widest text-amber-700 block mb-1.5">Surface totale (m²)</label>
                                    <input v-model.number="masterAssetForm.surface_totale" @input="syncValeurGlobale" type="number" min="0" step="10"
                                           class="w-full bg-amber-50 border-2 border-amber-200 rounded-lg px-3 py-2 text-sm font-black text-amber-800 outline-none focus:border-amber-500 text-right"/>
                                </div>
                                <div>
                                    <label class="text-[10px] font-black uppercase tracking-widest text-amber-700 block mb-1.5">Prix au m² (DH)</label>
                                    <input v-model.number="masterAssetForm.prix_m2" @input="syncPrixM2" type="number" min="0" step="50"
                                           class="w-full bg-amber-50 border-2 border-amber-200 rounded-lg px-3 py-2 text-sm font-black text-amber-800 outline-none focus:border-amber-500 text-right"/>
                                </div>
                                <div>
                                    <label class="text-[10px] font-black uppercase tracking-widest text-emerald-600 block mb-1.5">Revalorisation (%/an)</label>
                                    <input v-model.number="masterAssetForm.taux_revalorisation" type="number" min="-20" max="30" step="0.5"
                                           class="w-full bg-emerald-50 border-2 border-emerald-200 rounded-lg px-3 py-2 text-sm font-black text-emerald-800 outline-none focus:border-emerald-500 text-right"/>
                                </div>
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label class="text-[10px] font-black uppercase tracking-widest text-amber-700 block mb-1.5">Valeur globale du terrain (DH)</label>
                                    <input v-model.number="masterAssetForm.valeur_globale_terrain" @input="syncValeurGlobale" type="number" min="0" step="50000"
                                           class="w-full bg-amber-50 border-2 border-amber-300 rounded-lg px-3 py-2 text-sm font-black text-amber-800 outline-none focus:border-amber-500 text-right"/>
                                    <p class="text-[9px] text-gray-400 font-bold mt-0.5">Prix du bien entier, indivision comprise</p>
                                </div>
                                <div class="bg-violet-50 border-2 border-violet-200 rounded-lg px-3 py-2 flex flex-col justify-center">
                                    <p class="text-[9px] font-black uppercase tracking-widest text-violet-500">Ma quote-part · {{ masterAssetForm.quotePart }}</p>
                                    <p class="text-lg font-black text-violet-800 tabular-nums">{{ formatMAD(masterAssetMaPart) }}</p>
                                    <p class="text-[9px] text-violet-400 font-bold">Reportée en valeur actuelle du patrimoine</p>
                                </div>
                            </div>
                        </div>

                        <!-- ── ACQUISITION (actifs non fonciers) ── -->
                        <div v-show="masterAssetTab === 'acquisition' && !masterAssetEstTerrain" class="grid grid-cols-2 md:grid-cols-3 gap-3">`);

/* ── 6. Onglet « Scénarios de Vente » ────────────────────────────────────── */
sub(
`                        <!-- ── FISCALITÉ ── -->
                        <div v-show="masterAssetTab === 'fiscalite'" class="grid grid-cols-2 md:grid-cols-3 gap-3">`,
`                        <!-- ── v33.50 : SCÉNARIOS DE VENTE (terrain nu) ── -->
                        <div v-show="masterAssetTab === 'scenarios' && masterAssetEstTerrain" class="space-y-3">
                            <label class="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer">
                                <input type="checkbox" v-model="masterAssetForm.scenarios_par_m2" class="accent-amber-600"/>
                                Saisir les prix au m² (sinon en valeur totale du terrain)
                            </label>
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div v-for="sc in masterAssetScenarios" :key="sc.cle"
                                     :class="['rounded-xl border-2 overflow-hidden', sc.cle === 'median' ? 'border-blue-300' : sc.cle === 'optimiste' ? 'border-emerald-200' : 'border-rose-200']">
                                    <div :class="['px-3 py-1.5 text-white font-black uppercase tracking-widest text-[10px]', sc.cle === 'median' ? 'bg-blue-600' : sc.cle === 'optimiste' ? 'bg-emerald-600' : 'bg-rose-600']">{{ sc.label }}</div>
                                    <div class="p-3 space-y-1.5 bg-white">
                                        <input v-if="sc.cle === 'pessimiste'" v-model.number="masterAssetForm.prix_vente_pessimiste" type="number" min="0" step="100" class="w-full bg-gray-50 border-2 border-gray-200 rounded-lg px-2 py-1.5 text-sm font-black text-gray-800 outline-none text-right"/>
                                        <input v-else-if="sc.cle === 'median'" v-model.number="masterAssetForm.prix_vente_median" type="number" min="0" step="100" class="w-full bg-gray-50 border-2 border-gray-200 rounded-lg px-2 py-1.5 text-sm font-black text-gray-800 outline-none text-right"/>
                                        <input v-else v-model.number="masterAssetForm.prix_vente_optimiste" type="number" min="0" step="100" class="w-full bg-gray-50 border-2 border-gray-200 rounded-lg px-2 py-1.5 text-sm font-black text-gray-800 outline-none text-right"/>
                                        <p class="text-[9px] font-bold text-gray-400">{{ masterAssetForm.scenarios_par_m2 ? 'DH/m² · terrain entier ' + formatMAD(sc.prixGlobal) : 'DH au total · ' + formatMAD(sc.prixM2) + '/m²' }}</p>
                                        <div class="pt-1.5 border-t border-gray-100 space-y-0.5">
                                            <div class="flex justify-between text-[10px]"><span class="font-bold text-gray-500">Ma quote-part</span><span class="font-black tabular-nums text-gray-800">{{ formatMAD(sc.maPart) }}</span></div>
                                            <div class="flex justify-between text-[10px]"><span class="font-bold text-gray-500">− Semsar</span><span class="font-black tabular-nums text-rose-600">{{ formatMAD(sc.semsar) }}</span></div>
                                            <div class="flex justify-between text-[10px]"><span class="font-bold text-gray-500">− Arriérés TNB</span><span class="font-black tabular-nums text-rose-600">{{ formatMAD(sc.tnb) }}</span></div>
                                            <div class="flex justify-between text-[10px]"><span class="font-bold text-gray-500">− Provision TPI</span><span class="font-black tabular-nums text-rose-600">{{ formatMAD(sc.tpi) }}</span></div>
                                            <div class="flex justify-between text-xs pt-1 border-t border-gray-100"><span class="font-black uppercase tracking-widest text-gray-600">Net vendeur</span><span :class="['font-black tabular-nums', sc.net >= 0 ? 'text-emerald-700' : 'text-red-600']">{{ formatMAD(sc.net) }}</span></div>
                                            <div class="flex justify-between text-[9px]"><span class="font-bold text-gray-400">vs valeur inscrite</span><span :class="['font-black tabular-nums', sc.ecart >= 0 ? 'text-emerald-600' : 'text-rose-600']">{{ sc.ecart >= 0 ? '+' : '' }}{{ formatMAD(sc.ecart) }}</span></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- ── v33.50 : FISCALITÉ & FRAIS DE SORTIE (terrain nu) ── -->
                        <div v-show="masterAssetTab === 'fiscalite' && masterAssetEstTerrain" class="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                                <label class="text-[10px] font-black uppercase tracking-widest text-orange-600 block mb-1.5">Arriérés TNB (DH)</label>
                                <input v-model.number="masterAssetForm.arrieres_tnb" type="number" min="0" step="1000"
                                       class="w-full bg-orange-50 border-2 border-orange-200 rounded-lg px-3 py-2 text-sm font-black text-orange-800 outline-none focus:border-orange-500 text-right"/>
                                <p class="text-[9px] text-orange-400 font-bold mt-0.5">Taxe sur les terrains non bâtis</p>
                            </div>
                            <div>
                                <label class="text-[10px] font-black uppercase tracking-widest text-orange-600 block mb-1.5">Provision TPI (DH)</label>
                                <input v-model.number="masterAssetForm.provision_tpi" type="number" min="0" step="1000"
                                       class="w-full bg-orange-50 border-2 border-orange-200 rounded-lg px-3 py-2 text-sm font-black text-orange-800 outline-none focus:border-orange-500 text-right"/>
                                <p class="text-[9px] text-orange-400 font-bold mt-0.5">Impôt sur la plus-value</p>
                            </div>
                            <div>
                                <label class="text-[10px] font-black uppercase tracking-widest text-orange-600 block mb-1.5">Commission Semsar (%)</label>
                                <input v-model.number="masterAssetForm.commission_semsar_pct" type="number" min="0" max="20" step="0.5"
                                       class="w-full bg-orange-50 border-2 border-orange-200 rounded-lg px-3 py-2 text-sm font-black text-orange-800 outline-none focus:border-orange-500 text-right"/>
                            </div>
                            <div>
                                <label class="text-[10px] font-black uppercase tracking-widest text-orange-600 block mb-1.5 flex items-center justify-between">
                                    <span>Semsar (DH)</span>
                                    <span class="text-[8px] bg-orange-600 text-white px-1.5 py-0.5 rounded normal-case tracking-normal">calculé</span>
                                </label>
                                <input :value="masterAssetForm.commission_semsar_montant" type="number" readonly
                                       class="w-full bg-gray-100 border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-black text-gray-600 outline-none cursor-not-allowed text-right"/>
                                <p class="text-[9px] text-gray-400 font-bold mt-0.5">Sur le scénario médian</p>
                            </div>
                        </div>

                        <!-- ── FISCALITÉ (actifs non fonciers) ── -->
                        <div v-show="masterAssetTab === 'fiscalite' && !masterAssetEstTerrain" class="grid grid-cols-2 md:grid-cols-3 gap-3">`);

/* ── 7. Bascule d'onglet si l'onglet courant devient indisponible ────────── */
sub(
`                    const openMasterAssetModal = () => {
                        editingMasterAssetId.value = null;
                        masterAssetTab.value = 'acquisition';`,
`                    // v33.50 : si l'actif devient un terrain, un onglet masqué ne doit pas rester actif
                    watch(
                        () => masterAssetForm.value.type + '|' + masterAssetTab.value,
                        () => {
                            const dispos = (estTerrainNu(masterAssetForm.value)
                                ? ['acquisition', 'scenarios', 'fiscalite']
                                : ['acquisition', 'financement', 'exploitation', 'fiscalite']);
                            if (!dispos.includes(masterAssetTab.value)) masterAssetTab.value = 'acquisition';
                        }
                    );

                    const openMasterAssetModal = () => {
                        editingMasterAssetId.value = null;
                        masterAssetTab.value = 'acquisition';`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ v33.50 interface foncier nu appliquée');
