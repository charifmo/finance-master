// v33.80 UI : retire les panneaux de revente en ligne, ajoute les cases à
// cocher d'inclusion, et héberge le simulateur dans la modale.
import fs from 'node:fs';

const FILE = 'C:/Users/HP/finance/index.html';
let s = fs.readFileSync(FILE, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.split('\r\n').join('\n');
const sub = (from, to, n = 1) => {
    const c = s.split(from).length - 1;
    if (c !== n) throw new Error(`Ancre (${c}/${n}) :\n${from.slice(0, 160)}`);
    s = s.split(from).join(to);
};

/* ── 1. Extraire le gabarit du panneau (pour le réinjecter dans la modale) ── */
const DEB = `<div v-if="exitOpen[asset.id]" class="mt-3 rounded-2xl border-2 border-fuchsia-200 overflow-hidden">`;
const idx = s.indexOf(DEB);
if (idx < 0) throw new Error('panneau de revente introuvable');

/* ── 2. Supprimer le panneau + le bouton plein largeur de la CARTE PRODUCTIVE ── */
{
    const start = s.indexOf(`                                <button v-if="!exitOpen[asset.id]" @click="toggleExit(asset.id, asset)"`);
    if (start < 0) throw new Error('bouton dashed carte productive introuvable');
    const marqueur = `\n                                </div>\n                            </div>`;
    const end = s.indexOf(marqueur, start);
    if (end < 0) throw new Error('fin de carte productive introuvable');
    s = s.slice(0, start) + s.slice(end + 1);
}

/* ── 3. Supprimer la ligne dépliable du TABLEAU non productif ── */
{
    const start = s.indexOf(`                                        <!-- v33.10 : ligne dépliable — simulateur de sortie -->`);
    if (start < 0) throw new Error('ligne dépliable introuvable');
    const end = s.indexOf(`                                        </template>`, start);
    if (end < 0) throw new Error('fin de ligne dépliable introuvable');
    s = s.slice(0, start) + s.slice(end);
}

/* ── 4. Les icônes 🔮 ouvrent la modale ── */
sub(
`<button @click="toggleExit(asset.id, asset)" :class="['p-1.5 rounded-lg transition-colors text-sm', exitOpen[asset.id] ? 'bg-fuchsia-100 text-fuchsia-700' : 'hover:bg-fuchsia-100 text-gray-400 hover:text-fuchsia-600']" title="Simuler une revente">🔮</button>`,
`<button @click="ouvrirSimulationRevente(asset.id)" class="p-1.5 rounded-lg transition-colors text-sm hover:bg-fuchsia-100 text-gray-400 hover:text-fuchsia-600" title="Simuler une revente">🔮</button>`);

sub(
`<button @click="toggleExit(asset.id, asset)" :class="['p-1.5 rounded-lg transition-colors', exitOpen[asset.id] ? 'bg-fuchsia-100 text-fuchsia-700' : 'hover:bg-fuchsia-100 text-fuchsia-600']" title="Simuler une revente">🔮</button>`,
`<button @click="ouvrirSimulationRevente(asset.id)" class="p-1.5 rounded-lg transition-colors hover:bg-fuchsia-100 text-fuchsia-600" title="Simuler une revente">🔮</button>`);

/* ── 5. Case à cocher — carte productive ── */
sub(
`                                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div class="flex-1 min-w-0">
                                        <p class="text-sm font-black text-gray-800">{{ asset.name }}</p>`,
`                                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div class="flex-1 min-w-0">
                                        <p class="text-sm font-black text-gray-800 flex items-center gap-2">
                                            <button @click="asset.is_included_in_net_worth = asset.is_included_in_net_worth === false; handleDataChange()"
                                                    :title="asset.is_included_in_net_worth === false ? 'Exclu du patrimoine net — cliquer pour inclure' : 'Compté dans le patrimoine net — cliquer pour exclure'"
                                                    class="text-base leading-none shrink-0">{{ asset.is_included_in_net_worth === false ? '🙈' : '👁️' }}</button>
                                            <span :class="asset.is_included_in_net_worth === false ? 'text-gray-400 line-through' : ''">{{ asset.name }}</span>
                                            <span v-if="asset.is_included_in_net_worth === false" class="text-[8px] font-black uppercase tracking-widest bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">hors patrimoine</span>
                                        </p>`);

sub(
`                                <div v-for="asset in roiAssets" :key="asset.id"
                                     class="p-4 bg-gray-50 rounded-xl border border-gray-200 hover:border-violet-300 transition-colors">`,
`                                <div v-for="asset in roiAssets" :key="asset.id"
                                     :class="['p-4 rounded-xl border transition-colors', asset.is_included_in_net_worth === false ? 'bg-gray-100 border-gray-200 opacity-60' : 'bg-gray-50 border-gray-200 hover:border-violet-300']">`);

/* ── 6. Case à cocher — tableau non productif ── */
sub(
`                                        <tr class="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                            <td class="px-4 py-3">
                                                <p class="text-sm font-black text-gray-800">{{ asset.name }}</p>
                                                <p class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">{{ asset.type }}</p>
                                            </td>`,
`                                        <tr :class="['border-b border-gray-100 transition-colors', asset.is_included_in_net_worth === false ? 'bg-gray-100/70 opacity-60' : 'hover:bg-gray-50']">
                                            <td class="px-4 py-3">
                                                <p class="text-sm font-black text-gray-800 flex items-center gap-2">
                                                    <button @click="asset.is_included_in_net_worth = asset.is_included_in_net_worth === false; handleDataChange()"
                                                            :title="asset.is_included_in_net_worth === false ? 'Exclu du patrimoine net — cliquer pour inclure' : 'Compté dans le patrimoine net — cliquer pour exclure'"
                                                            class="text-base leading-none shrink-0">{{ asset.is_included_in_net_worth === false ? '🙈' : '👁️' }}</button>
                                                    <span :class="asset.is_included_in_net_worth === false ? 'text-gray-400 line-through' : ''">{{ asset.name }}</span>
                                                </p>
                                                <p class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">
                                                    {{ asset.type }}
                                                    <span v-if="asset.is_included_in_net_worth === false" class="ml-1 bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded normal-case">hors patrimoine net</span>
                                                </p>
                                            </td>`);

/* ── 7. Bandeau « exclus » sous les totaux ── */
sub(
`                                            <td class="px-4 py-3 text-right font-black text-base text-emerald-300 whitespace-nowrap">{{ formatMAD(stressTotalNet) }}</td>
                                            <td class="px-4 py-3"></td>`,
`                                            <td class="px-4 py-3 text-right font-black text-base text-emerald-300 whitespace-nowrap">{{ formatMAD(stressTotalNet) }}</td>
                                            <td class="px-4 py-3"></td>
                                        </tr>
                                        <tr v-if="assetsExclus.length" class="bg-gray-100">
                                            <td colspan="7" class="px-4 py-2 text-[11px] font-bold text-gray-500">
                                                🙈 {{ assetsExclus.length }} actif{{ assetsExclus.length > 1 ? 's' : '' }} hors patrimoine net
                                                — {{ formatMAD(valeurExclue) }} non comptabilisés :
                                                <span class="text-gray-600">{{ assetsExclus.map(a => a.name).join(' · ') }}</span>
                                            </td>`);

/* ── 8. Onglet « Revente » dans la modale (actifs non fonciers) ── */
const PANNEAU_MODALE = `                        <!-- ── v33.80 : SIMULATEUR DE REVENTE (dans la modale) ── -->
                        <div v-show="masterAssetTab === 'revente' && !masterAssetEstTerrain" class="space-y-4">
                            <template v-for="sim in [masterAssetExit]" :key="'exm'">
                            <div>
                                <div class="flex items-center justify-between mb-1.5">
                                    <label class="text-[10px] font-black uppercase tracking-widest text-fuchsia-700">Année de revente</label>
                                    <span class="text-sm font-black text-fuchsia-800 tabular-nums">Année {{ sim.annee }} / {{ masterAssetExitMax }}</span>
                                </div>
                                <input type="range" min="1" :max="masterAssetExitMax" step="1" v-model.number="masterAssetExitAnnee" class="w-full accent-fuchsia-600 cursor-pointer"/>
                                <div class="flex justify-between text-[9px] font-bold text-gray-400 mt-0.5"><span>1 an</span><span>{{ masterAssetExitMax }} ans</span></div>
                            </div>
                            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div class="p-3 rounded-xl bg-teal-50 border border-teal-200">
                                    <p class="text-[9px] font-black uppercase tracking-widest text-teal-600">A · Valeur de revente</p>
                                    <p class="text-lg font-black text-teal-800 tabular-nums">{{ formatMAD(sim.valeurRevente) }}</p>
                                    <p class="text-[9px] font-bold text-teal-500">+{{ formatMAD(sim.plusValueLatente) }} de revalorisation · −{{ formatMAD(sim.fraisRevente) }} de frais</p>
                                </div>
                                <div class="p-3 rounded-xl bg-rose-50 border border-rose-200">
                                    <p class="text-[9px] font-black uppercase tracking-widest text-rose-600">B · {{ sim.estMourabaha ? 'Solde de rachat' : 'Capital restant dû' }}</p>
                                    <p class="text-lg font-black text-rose-800 tabular-nums">{{ formatMAD(sim.crd) }}</p>
                                    <p v-if="sim.detailIbraa" class="text-[9px] font-bold text-rose-500">capital {{ formatMAD(sim.detailIbraa.capitalRestant) }} + marge non échue {{ formatMAD(sim.detailIbraa.margeNonEchue) }} − Ibra'a {{ formatMAD(sim.detailIbraa.ibraa) }}</p>
                                    <p v-else-if="!sim.crd" class="text-[9px] font-bold text-rose-400">Aucun crédit en cours</p>
                                </div>
                                <div class="p-3 rounded-xl bg-indigo-50 border border-indigo-200">
                                    <p class="text-[9px] font-black uppercase tracking-widest text-indigo-600">C · Cash sorti (effort)</p>
                                    <p class="text-lg font-black text-indigo-800 tabular-nums">{{ formatMAD(sim.cashSorti) }}</p>
                                    <p v-if="sim.moisDejaPayes" class="text-[9px] font-bold text-indigo-400">dont {{ sim.moisDejaPayes }} échéances déjà versées ({{ formatMAD(sim.dejaVerse) }})</p>
                                </div>
                            </div>
                            <div :class="['p-4 rounded-2xl text-white', sim.gagnant ? 'bg-gradient-to-r from-emerald-600 to-teal-700' : 'bg-gradient-to-r from-rose-600 to-red-700']">
                                <p class="text-[10px] font-black uppercase tracking-widest opacity-75">D · Net dans la poche</p>
                                <p class="text-3xl font-black tabular-nums leading-tight">{{ formatMAD(sim.netPoche) }}</p>
                                <p class="text-[11px] font-bold opacity-90 mt-1">
                                    {{ sim.gagnant ? '✅ Supérieur au cash sorti' : '⚠️ Inférieur au cash sorti' }}
                                    de <span class="font-black">{{ formatMAD(Math.abs(sim.gain)) }}</span>
                                </p>
                            </div>
                            </template>
                        </div>

`;
sub(
`                        <!-- ── v33.60 : SCÉNARIOS DE VENTE — entièrement calculés ── -->`,
PANNEAU_MODALE + `                        <!-- ── v33.60 : SCÉNARIOS DE VENTE — entièrement calculés ── -->`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ v33.80 UI appliquée');
