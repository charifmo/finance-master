/**
 * v33.01 — UI du moteur de simulation
 *   1. Panneau de paramètres du simulateur (surplus auto, inflation, revalo,
 *      garde-fous anti-double-comptage).
 *   2. Tableau de projection enrichi : décomposition du mouvement annuel.
 *   3. ROI Tracker : rendement NET et cash-flow net au lieu de revenue/value.
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

/* ── 1. Panneau de paramètres ─────────────────────────────────────────────── */
sub(
`                                <div>
                                    <label class="text-[10px] font-black uppercase tracking-widest text-indigo-700 block mb-1.5">Surplus mensuel (hypothèse)</label>
                                    <input type="number" v-model.number="sandboxSurplusMensuel" step="500"
                                        class="w-full bg-white border-2 border-indigo-200 rounded-lg px-3 py-2 text-sm font-black text-indigo-800 outline-none focus:border-indigo-500 text-right"/>
                                </div>
                                <div class="flex items-end">
                                    <button @click="resetSandbox" class="w-full py-2 rounded-lg border-2 border-gray-200 text-gray-600 font-black text-xs uppercase tracking-widest hover:bg-gray-50">♻️ Réinitialiser le brouillon</button>
                                </div>
                            </div>`,
`                                <div>
                                    <label class="text-[10px] font-black uppercase tracking-widest text-indigo-700 block mb-1.5 flex items-center justify-between">
                                        <span>Surplus mensuel</span>
                                        <label class="flex items-center gap-1 cursor-pointer normal-case tracking-normal text-[9px] text-indigo-500">
                                            <input type="checkbox" v-model="sandboxSurplusAuto" class="accent-indigo-600"/> auto
                                        </label>
                                    </label>
                                    <input v-if="!sandboxSurplusAuto" type="number" v-model.number="sandboxSurplusMensuel" step="500"
                                        class="w-full bg-white border-2 border-indigo-200 rounded-lg px-3 py-2 text-sm font-black text-indigo-800 outline-none focus:border-indigo-500 text-right"/>
                                    <div v-else class="w-full bg-indigo-50 border-2 border-indigo-200 rounded-lg px-3 py-2 text-sm font-black text-indigo-800 text-right tabular-nums">
                                        {{ formatMAD(Math.round(surplusBudgetaireAnnuel(sandboxStartYear) / 12)) }}
                                        <span class="block text-[8px] font-bold uppercase tracking-widest text-indigo-400">dérivé du budget {{ sandboxStartYear }}</span>
                                    </div>
                                </div>
                                <div class="flex items-end">
                                    <button @click="resetSandbox" class="w-full py-2 rounded-lg border-2 border-gray-200 text-gray-600 font-black text-xs uppercase tracking-widest hover:bg-gray-50">♻️ Réinitialiser le brouillon</button>
                                </div>
                            </div>

                            <!-- v33.00 : hypothèses du moteur + garde-fous anti-double-comptage -->
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                                <div class="space-y-2">
                                    <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">Hypothèses du moteur</p>
                                    <label class="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer">
                                        <input type="checkbox" v-model="sandboxRevaloOn" class="accent-emerald-600"/>
                                        Revaloriser les actifs (taux par actif, défaut 3 %/an)
                                    </label>
                                    <label class="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer">
                                        <input type="checkbox" v-model="sandboxInflationOn" class="accent-amber-600"/>
                                        Éroder le surplus de l'inflation ({{ parametres.hypotheseInflation }} %/an)
                                    </label>
                                </div>
                                <div class="space-y-2">
                                    <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">Éviter les doubles comptages</p>
                                    <label class="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer">
                                        <input type="checkbox" v-model="sandboxMensualitesDansBudget" class="accent-rose-600"/>
                                        Les mensualités de crédit sont déjà dans mes charges fixes
                                    </label>
                                    <label class="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer">
                                        <input type="checkbox" v-model="sandboxRevenusActifsDansBudget" class="accent-rose-600"/>
                                        Les loyers sont déjà dans mes revenus
                                    </label>
                                    <p class="text-[9px] text-gray-400 italic leading-snug">Décoché = le moteur ajoute le flux lui-même. Coché = il le laisse au budget pour ne pas le compter deux fois.</p>
                                </div>
                            </div>`);

/* ── 2. Tableau de projection : décomposition ─────────────────────────────── */
sub(
`                                            <th class="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-widest">Patrimoine Net</th>
                                            <th class="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-widest">Événements</th>`,
`                                            <th class="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-widest">Patrimoine Net</th>
                                            <th class="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-widest" title="Surplus budgétaire de l'année">+ Surplus</th>
                                            <th class="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-widest" title="Cash-flow net des actifs productifs">+ Actifs</th>
                                            <th class="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-widest" title="Capital de crédit remboursé dans l'année">− Capital</th>
                                            <th class="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-widest" title="Plus-value de revalorisation">▲ Revalo</th>
                                            <th class="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-widest">Événements</th>`);

sub(
`                                            <td :class="['px-3 py-2 text-right font-black tabular-nums', row.net >= 0 ? 'text-emerald-700' : 'text-red-600']">{{ formatMAD(row.net) }}</td>
                                            <td class="px-3 py-2 text-[10px] text-gray-500">{{ row.events.length ? row.events.map(e => sandboxEventLabel(e)).join(' · ') : '—' }}</td>`,
`                                            <td :class="['px-3 py-2 text-right font-black tabular-nums', row.net >= 0 ? 'text-emerald-700' : 'text-red-600']">{{ formatMAD(row.net) }}</td>
                                            <td :class="['px-3 py-2 text-right text-[11px] font-bold tabular-nums', row.fluxSurplus >= 0 ? 'text-gray-500' : 'text-rose-500']">{{ row.fluxSurplus ? formatMAD(row.fluxSurplus) : '—' }}</td>
                                            <td class="px-3 py-2 text-right text-[11px] font-bold tabular-nums text-emerald-600">{{ row.fluxActifs ? formatMAD(row.fluxActifs) : '—' }}</td>
                                            <td class="px-3 py-2 text-right text-[11px] font-bold tabular-nums text-rose-600">{{ row.capitalAmorti ? formatMAD(row.capitalAmorti) : '—' }}</td>
                                            <td class="px-3 py-2 text-right text-[11px] font-bold tabular-nums text-indigo-500">{{ row.revalo ? formatMAD(row.revalo) : '—' }}</td>
                                            <td class="px-3 py-2 text-[10px] text-gray-500">{{ row.events.length ? row.events.map(e => sandboxEventLabel(e)).join(' · ') : '—' }}</td>`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ v33.01 UI simulation appliquée');
