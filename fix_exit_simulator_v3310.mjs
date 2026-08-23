/**
 * v33.10 — Simulateur de sortie (Exit Strategy)
 *   1. Schéma v19 : nouveau champ frais_revente_pct (défaut 3 %).
 *   2. Accordéon « 🔮 Simuler une revente » dans chaque carte d'actif
 *      (productif ET non productif) avec un curseur Année de revente.
 *   3. Quatre KPI recalculés en direct : valeur de revente, CRD (Ibra'a gérée
 *      pour la Mourabaha), cash sorti cumulé, net vendeur dans la poche.
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
   1. SCHÉMA — frais_revente_pct
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                        prix_acquisition: 0, frais_acquisition: 0, travaux: 0, valeur_actuelle: 0,
                        taux_revalorisation: 3,`,
`                        prix_acquisition: 0, frais_acquisition: 0, travaux: 0, valeur_actuelle: 0,
                        taux_revalorisation: 3,
                        frais_revente_pct: 3,   // v33.10 : frais de sortie (agence, notaire acheteur…)`);

sub(
`                            taux_revalorisation: Number(f.taux_revalorisation) || 0,`,
`                            taux_revalorisation: Number(f.taux_revalorisation) || 0,
                            frais_revente_pct: Number(f.frais_revente_pct) || 0,`);

/* ══════════════════════════════════════════════════════════════════════════
   2. MOTEUR — exitSim()
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                    // Vue réactive : économie de chaque actif (année 0)`,
String.raw`                    // ═══════════════════════════════════════════════════════════════════
                    // v33.10 — SIMULATEUR DE SORTIE (revente à l'année N)
                    //   A. valeur de revente = valeur_actuelle × (1 + revalo)^N
                    //   B. CRD à la fin de l'année N (Mourabaha → solde anticipé avec Ibra'a)
                    //   C. cash sorti = apport + échéances versées + frais & travaux initiaux
                    //   D. net vendeur = valeur × (1 − frais_revente) − CRD
                    // ═══════════════════════════════════════════════════════════════════
                    const exitOpen = ref({});
                    const exitYears = ref({});
                    const exitMaxAnnees = (a) => {
                        const n = Math.round(N((a || {}).duree_mois) / 12);
                        return n > 0 ? n : 20;
                    };
                    const toggleExit = (id, asset) => {
                        exitOpen.value = Object.assign({}, exitOpen.value, { [id]: !exitOpen.value[id] });
                        if (exitYears.value[id] == null) {
                            exitYears.value = Object.assign({}, exitYears.value, { [id]: Math.min(5, exitMaxAnnees(asset)) });
                        }
                    };
                    const setExitYear = (id, v) => {
                        exitYears.value = Object.assign({}, exitYears.value, { [id]: Number(v) || 1 });
                    };

                    const exitSim = (asset, annee) => {
                        const a = migrateAssetV19(asset);
                        const An = Math.max(1, Math.round(N(annee, 1)));

                        // A — valeur de revente estimée
                        const base = N(a.valeur_actuelle) || N(a.prix_acquisition) || N(a.value);
                        const valeurRevente = base * Math.pow(1 + N(a.taux_revalorisation) / 100, An);

                        // B — capital restant dû à la fin de l'année N
                        let crd = 0, detailIbraa = null;
                        if (N(a.montant_credit) > 0 && N(a.duree_mois) > 0) {
                            if (String(a.type_credit) === 'mourabaha') {
                                // Mourabaha : ce qu'il faut réellement verser pour solder,
                                // marge non échue comprise, diminuée de l'Ibra'a.
                                const sa = soldeAnticipe(a, Math.round(N(a.mois_deja_payes)) + An * 12);
                                crd = sa.solde; detailIbraa = sa;
                            } else {
                                crd = amortissementAnnuel(a, An - 1).capitalRestant;
                            }
                        }

                        // C — cash sorti (effort cumulé)
                        const mens = N(a.mensualite) > 0 ? N(a.mensualite)
                                   : mensualiteClassique(a.montant_credit, a.taux_credit, a.duree_mois);
                        // les échéances s'arrêtent à la fin du crédit
                        const moisEcheances = N(a.montant_credit) > 0
                            ? Math.min(An * 12, Math.max(0, Math.round(N(a.duree_mois) - N(a.mois_deja_payes))))
                            : 0;
                        const fraisInit = coutTotalRevient(a) - N(a.prix_acquisition);
                        const cashSorti = N(a.apport_personnel) + (mens + N(a.assurance_mensuelle)) * moisEcheances + fraisInit;

                        // D — net vendeur
                        const fraisRevente = valeurRevente * (N(a.frais_revente_pct) / 100);
                        const netPoche = valeurRevente - fraisRevente - crd;

                        const r0 = (v) => Math.round(v);
                        return {
                            annee: An,
                            valeurRevente: r0(valeurRevente),
                            plusValueLatente: r0(valeurRevente - base),
                            fraisRevente: r0(fraisRevente),
                            crd: r0(crd), detailIbraa,
                            cashSorti: r0(cashSorti), mensualite: r0(mens),
                            moisEcheances, fraisInit: r0(fraisInit),
                            netPoche: r0(netPoche),
                            gain: r0(netPoche - cashSorti),
                            gagnant: netPoche > cashSorti,
                        };
                    };

                    // Vue réactive : économie de chaque actif (année 0)`);

sub(
`                        tableauAmortissement, amortissementAnnuel, soldeAnticipe, assetEconomics,`,
`                        tableauAmortissement, amortissementAnnuel, soldeAnticipe, assetEconomics,
                        exitOpen, exitYears, exitMaxAnnees, toggleExit, setExitYear, exitSim,`);

/* ══════════════════════════════════════════════════════════════════════════
   3. MODALE — champ frais de revente (onglet Acquisition)
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                            <div>
                                <label class="text-[10px] font-black uppercase tracking-widest text-emerald-600 block mb-1.5">Revalorisation (%/an)</label>
                                <input v-model.number="masterAssetForm.taux_revalorisation" type="number" min="-20" max="30" step="0.5" class="w-full bg-emerald-50 border-2 border-emerald-200 rounded-lg px-3 py-2 text-sm font-black text-emerald-800 outline-none focus:border-emerald-500 text-right"/>
                            </div>
                            <div class="col-span-2 flex items-end">`,
`                            <div>
                                <label class="text-[10px] font-black uppercase tracking-widest text-emerald-600 block mb-1.5">Revalorisation (%/an)</label>
                                <input v-model.number="masterAssetForm.taux_revalorisation" type="number" min="-20" max="30" step="0.5" class="w-full bg-emerald-50 border-2 border-emerald-200 rounded-lg px-3 py-2 text-sm font-black text-emerald-800 outline-none focus:border-emerald-500 text-right"/>
                            </div>
                            <div>
                                <label class="text-[10px] font-black uppercase tracking-widest text-fuchsia-600 block mb-1.5">Frais de revente (%)</label>
                                <input v-model.number="masterAssetForm.frais_revente_pct" type="number" min="0" max="20" step="0.5" class="w-full bg-fuchsia-50 border-2 border-fuchsia-200 rounded-lg px-3 py-2 text-sm font-black text-fuchsia-800 outline-none focus:border-fuchsia-500 text-right"/>
                                <p class="text-[9px] text-fuchsia-400 font-bold mt-0.5">Agence, notaire acheteur…</p>
                            </div>
                            <div class="col-span-2 flex items-end">`);

/* ══════════════════════════════════════════════════════════════════════════
   4. BLOC RÉUTILISABLE — panneau du simulateur
   ══════════════════════════════════════════════════════════════════════════ */
const PANNEAU = (indent) => {
    const p = ' '.repeat(indent);
    return `${p}<div v-if="exitOpen[asset.id]" class="mt-3 rounded-2xl border-2 border-fuchsia-200 overflow-hidden">
${p}    <template v-for="sim in [exitSim(asset, exitYears[asset.id] || 1)]" :key="'ex'+asset.id">
${p}    <div class="px-4 py-2.5 bg-gradient-to-r from-fuchsia-600 to-purple-700 text-white flex items-center justify-between flex-wrap gap-2">
${p}        <p class="font-black uppercase tracking-widest text-[11px]">🔮 Scénario de revente — année {{ sim.annee }}</p>
${p}        <p class="text-[10px] opacity-80">Revalo {{ asset.taux_revalorisation }} %/an · frais de sortie {{ asset.frais_revente_pct }} %</p>
${p}    </div>
${p}    <div class="p-4 bg-white space-y-4">
${p}        <!-- Curseur -->
${p}        <div>
${p}            <div class="flex items-center justify-between mb-1.5">
${p}                <label class="text-[10px] font-black uppercase tracking-widest text-fuchsia-700">Année de revente</label>
${p}                <span class="text-sm font-black text-fuchsia-800 tabular-nums">Année {{ sim.annee }} / {{ exitMaxAnnees(asset) }}</span>
${p}            </div>
${p}            <input type="range" min="1" :max="exitMaxAnnees(asset)" step="1"
${p}                   :value="exitYears[asset.id] || 1"
${p}                   @input="setExitYear(asset.id, $event.target.value)"
${p}                   class="w-full accent-fuchsia-600 cursor-pointer"/>
${p}            <div class="flex justify-between text-[9px] font-bold text-gray-400 mt-0.5">
${p}                <span>1 an</span><span>{{ exitMaxAnnees(asset) }} ans</span>
${p}            </div>
${p}        </div>
${p}
${p}        <!-- A / B / C -->
${p}        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
${p}            <div class="p-3 rounded-xl bg-teal-50 border border-teal-200">
${p}                <p class="text-[9px] font-black uppercase tracking-widest text-teal-600">A · Valeur de revente</p>
${p}                <p class="text-lg font-black text-teal-800 tabular-nums">{{ formatMAD(sim.valeurRevente) }}</p>
${p}                <p class="text-[9px] font-bold text-teal-500">+{{ formatMAD(sim.plusValueLatente) }} de revalorisation · −{{ formatMAD(sim.fraisRevente) }} de frais</p>
${p}            </div>
${p}            <div class="p-3 rounded-xl bg-rose-50 border border-rose-200">
${p}                <p class="text-[9px] font-black uppercase tracking-widest text-rose-600">B · Reste à la banque</p>
${p}                <p class="text-lg font-black text-rose-800 tabular-nums">{{ formatMAD(sim.crd) }}</p>
${p}                <p v-if="sim.detailIbraa" class="text-[9px] font-bold text-rose-500">Mourabaha : capital {{ formatMAD(sim.detailIbraa.capitalRestant) }} + marge non échue {{ formatMAD(sim.detailIbraa.margeNonEchue) }} − Ibra'a {{ formatMAD(sim.detailIbraa.ibraa) }}</p>
${p}                <p v-else-if="sim.crd === 0" class="text-[9px] font-bold text-rose-400">Aucun crédit en cours</p>
${p}                <p v-else class="text-[9px] font-bold text-rose-500">Capital restant dû fin d'année {{ sim.annee }}</p>
${p}            </div>
${p}            <div class="p-3 rounded-xl bg-indigo-50 border border-indigo-200">
${p}                <p class="text-[9px] font-black uppercase tracking-widest text-indigo-600">C · Cash sorti (effort)</p>
${p}                <p class="text-lg font-black text-indigo-800 tabular-nums">{{ formatMAD(sim.cashSorti) }}</p>
${p}                <p class="text-[9px] font-bold text-indigo-500">Apport {{ formatMAD(asset.apport_personnel) }} + {{ sim.moisEcheances }} échéances<span v-if="sim.fraisInit"> + frais &amp; travaux {{ formatMAD(sim.fraisInit) }}</span></p>
${p}            </div>
${p}        </div>
${p}
${p}        <!-- D -->
${p}        <div :class="['p-4 rounded-2xl text-white', sim.gagnant ? 'bg-gradient-to-r from-emerald-600 to-teal-700' : 'bg-gradient-to-r from-rose-600 to-red-700']">
${p}            <p class="text-[10px] font-black uppercase tracking-widest opacity-75">D · Net dans la poche</p>
${p}            <p class="text-3xl sm:text-4xl font-black tabular-nums leading-tight">{{ formatMAD(sim.netPoche) }}</p>
${p}            <p class="text-[11px] font-bold opacity-90 mt-1">
${p}                {{ sim.gagnant ? '✅ Supérieur au cash sorti' : '⚠️ Inférieur au cash sorti' }}
${p}                de <span class="font-black">{{ formatMAD(Math.abs(sim.gain)) }}</span>
${p}                <span class="opacity-70">(effort {{ formatMAD(sim.cashSorti) }})</span>
${p}            </p>
${p}        </div>
${p}    </div>
${p}    </template>
${p}</div>`;
};

/* ══════════════════════════════════════════════════════════════════════════
   5. CARTE ACTIF PRODUCTIF — bouton + panneau
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                                <div v-for="asset in roiAssets" :key="asset.id"
                                     class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200 hover:border-violet-300 transition-colors">`,
`                                <div v-for="asset in roiAssets" :key="asset.id"
                                     class="p-4 bg-gray-50 rounded-xl border border-gray-200 hover:border-violet-300 transition-colors">
                                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">`);

sub(
`                                        <button @click="editMasterAsset(asset.id)" class="p-1.5 rounded-lg hover:bg-violet-100 text-gray-400 hover:text-violet-600 transition-colors text-sm" title="Éditer">✏️</button>
                                        <button @click="deleteMasterAsset(asset.id)" class="p-1.5 rounded-lg hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors text-sm" title="Supprimer">🗑️</button>
                                    </div>
                                </div>
                            </div>`,
`                                        <button @click="toggleExit(asset.id, asset)" :class="['p-1.5 rounded-lg transition-colors text-sm', exitOpen[asset.id] ? 'bg-fuchsia-100 text-fuchsia-700' : 'hover:bg-fuchsia-100 text-gray-400 hover:text-fuchsia-600']" title="Simuler une revente">🔮</button>
                                        <button @click="editMasterAsset(asset.id)" class="p-1.5 rounded-lg hover:bg-violet-100 text-gray-400 hover:text-violet-600 transition-colors text-sm" title="Éditer">✏️</button>
                                        <button @click="deleteMasterAsset(asset.id)" class="p-1.5 rounded-lg hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors text-sm" title="Supprimer">🗑️</button>
                                    </div>
                                </div>
                                <button v-if="!exitOpen[asset.id]" @click="toggleExit(asset.id, asset)"
                                        class="mt-3 w-full py-2 rounded-xl border-2 border-dashed border-fuchsia-300 hover:border-fuchsia-500 hover:bg-fuchsia-50 text-fuchsia-700 font-black uppercase text-[10px] tracking-widest transition-colors">
                                    🔮 Simuler une revente (Exit)
                                </button>
${PANNEAU(32)}
                                </div>
                            </div>`);

/* ══════════════════════════════════════════════════════════════════════════
   6. TABLEAU ACTIFS NON PRODUCTIFS — ligne dépliable
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                                                <div class="flex items-center justify-center gap-1.5">
                                                    <button @click="editMasterAsset(asset.id)" class="p-1.5 rounded-lg hover:bg-blue-100 text-blue-600 transition-colors" title="Éditer">✏️</button>
                                                    <button @click="deleteMasterAsset(asset.id)" class="p-1.5 rounded-lg hover:bg-red-100 text-red-600 transition-colors" title="Supprimer">🗑️</button>
                                                </div>
                                            </td>
                                        </tr>
                                    </tbody>`,
`                                                <div class="flex items-center justify-center gap-1.5">
                                                    <button @click="toggleExit(asset.id, asset)" :class="['p-1.5 rounded-lg transition-colors', exitOpen[asset.id] ? 'bg-fuchsia-100 text-fuchsia-700' : 'hover:bg-fuchsia-100 text-fuchsia-600']" title="Simuler une revente">🔮</button>
                                                    <button @click="editMasterAsset(asset.id)" class="p-1.5 rounded-lg hover:bg-blue-100 text-blue-600 transition-colors" title="Éditer">✏️</button>
                                                    <button @click="deleteMasterAsset(asset.id)" class="p-1.5 rounded-lg hover:bg-red-100 text-red-600 transition-colors" title="Supprimer">🗑️</button>
                                                </div>
                                            </td>
                                        </tr>
                                        <!-- v33.10 : ligne dépliable — simulateur de sortie -->
                                        <tr v-if="exitOpen[asset.id]" :key="asset.id + '_exit'" class="bg-fuchsia-50/30">
                                            <td colspan="7" class="px-4 pb-4 pt-0">
${PANNEAU(48)}
                                            </td>
                                        </tr>
                                    </tbody>`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ v33.10 Exit Simulator appliqué');
