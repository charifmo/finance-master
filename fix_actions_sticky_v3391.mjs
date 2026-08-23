/**
 * v33.91 — La colonne Actions toujours atteignable
 * ---------------------------------------------------------------------------
 * La colonne existait bien dans le DOM, mais la table (1078 px) débordait de
 * son conteneur (974 px) : les boutons partaient hors écran, accessibles
 * seulement par un scroll horizontal que rien ne signalait.
 *
 * Correctif : la colonne Actions est épinglée à droite (position sticky) et
 * reste visible quel que soit le défilement ; la table est resserrée pour
 * réduire le débordement, et un liseré marque la colonne épinglée.
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

/* ── 1. En-tête : colonne épinglée ────────────────────────────────────────── */
sub(
`                                            <th class="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest">Rdt net</th>
                                            <th class="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest">Actions</th>`,
`                                            <th class="px-3 py-3 text-right text-[10px] font-black uppercase tracking-widest">Rdt net</th>
                                            <th class="px-3 py-3 text-center text-[10px] font-black uppercase tracking-widest sticky right-0 bg-slate-800 border-l border-slate-600 shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.4)]">Actions</th>`);

/* ── 2. Cellule d'actions : épinglée, fond suivant l'état de la ligne ────── */
sub(
`                                            <td class="px-4 py-3 text-center whitespace-nowrap">
                                                <div class="flex items-center justify-center gap-1.5">
                                                    <button @click="toggleExit(asset.id, asset)" :class="['p-1.5 rounded-lg transition-colors', exitOpen[asset.id] ? 'bg-fuchsia-100 text-fuchsia-700' : 'hover:bg-fuchsia-100 text-fuchsia-600']" title="Simuler une revente">🔮</button>`,
`                                            <td :class="['px-3 py-3 text-center whitespace-nowrap sticky right-0 border-l border-gray-200 shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.12)]', asset.is_included_in_net_worth === false ? 'bg-gray-100' : 'bg-white']">
                                                <div class="flex items-center justify-center gap-1.5">
                                                    <button @click="toggleExit(asset.id, asset)" :class="['p-1.5 rounded-lg transition-colors', exitOpen[asset.id] ? 'bg-fuchsia-100 text-fuchsia-700' : 'hover:bg-fuchsia-100 text-fuchsia-600']" title="Simuler une revente">🔮</button>`);

/* ── 3. Pied de tableau : même épinglage ──────────────────────────────────── */
sub(
`{{ globalValeurProductifs > 0 ? (assetsEconomics.filter(e => (masterAssets.find(a => a.id === e.id) || {}).isProductive && (masterAssets.find(a => a.id === e.id) || {}).is_included_in_net_worth !== false).reduce((s, e) => s + e.rex, 0) / globalValeurProductifs * 100).toFixed(2) : '0.00' }} %</td>
                                            <td class="px-4 py-3"></td>`,
`{{ globalValeurProductifs > 0 ? (assetsEconomics.filter(e => (masterAssets.find(a => a.id === e.id) || {}).isProductive && (masterAssets.find(a => a.id === e.id) || {}).is_included_in_net_worth !== false).reduce((s, e) => s + e.rex, 0) / globalValeurProductifs * 100).toFixed(2) : '0.00' }} %</td>
                                            <td class="px-3 py-3 sticky right-0 bg-violet-900 border-l border-violet-700"></td>`);

/* ── 4. Table resserrée + repère de défilement ────────────────────────────── */
sub(
`                            <div class="overflow-x-auto rounded-xl border border-gray-200">
                                <table class="w-full text-sm min-w-[900px]">
                                    <thead class="bg-slate-800 text-white">`,
`                            <div class="overflow-x-auto rounded-xl border border-gray-200 relative">
                                <table class="w-full text-xs lg:text-sm min-w-[820px]">
                                    <thead class="bg-slate-800 text-white">`);

// Paddings resserrés sur les colonnes chiffrées
[['valeur_actuelle || asset.value', 'blue'], ['montant_credit || 0', 'rose'], ['apport_personnel || 0', 'indigo']].forEach(() => {});
sub(
`                                            <td class="px-4 py-3 text-right text-blue-700 font-black bg-blue-50/40 whitespace-nowrap">{{ formatMAD(asset.valeur_actuelle || asset.value) }}</td>
                                            <td class="px-4 py-3 text-right text-rose-700 font-black bg-rose-50/40 whitespace-nowrap">{{ formatMAD(asset.montant_credit || 0) }}</td>
                                            <td class="px-4 py-3 text-right text-indigo-700 font-black bg-indigo-50/40 whitespace-nowrap">{{ formatMAD(asset.apport_personnel || 0) }}</td>
                                            <td class="px-4 py-3 text-right text-emerald-700 font-black bg-emerald-50/40 whitespace-nowrap">`,
`                                            <td class="px-3 py-3 text-right text-blue-700 font-black bg-blue-50/40 whitespace-nowrap">{{ formatMAD(asset.valeur_actuelle || asset.value) }}</td>
                                            <td class="px-3 py-3 text-right text-rose-700 font-black bg-rose-50/40 whitespace-nowrap">{{ formatMAD(asset.montant_credit || 0) }}</td>
                                            <td class="px-3 py-3 text-right text-indigo-700 font-black bg-indigo-50/40 whitespace-nowrap">{{ formatMAD(asset.apport_personnel || 0) }}</td>
                                            <td class="px-3 py-3 text-right text-emerald-700 font-black bg-emerald-50/40 whitespace-nowrap">`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ v33.91 colonne Actions épinglée');
