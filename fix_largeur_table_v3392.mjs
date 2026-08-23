/**
 * v33.92 — La table du patrimoine tient enfin dans la page
 * ---------------------------------------------------------------------------
 * CAUSE RACINE : l'onglet Patrimoine est plafonné à max-w-5xl (1024 px). Avec
 * neuf colonnes, la table débordait de son conteneur et la colonne Actions
 * épinglée en v33.91 se posait PAR-DESSUS la colonne Cash-flow, qui s'affichait
 * tronquée (« 5 096 D »). L'épinglage réglait l'accès aux boutons mais rendait
 * les chiffres illisibles.
 *
 * Deux corrections :
 *  1. l'onglet passe à max-w-7xl (1280 px) — la table a la place de respirer ;
 *  2. la colonne Quote-part disparaît en tant que colonne : elle devient un
 *     badge sur la ligne du nom, à côté de la nature de l'actif. Huit colonnes
 *     au lieu de neuf.
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

/* ── 1. Onglet Patrimoine élargi ──────────────────────────────────────────── */
sub(
`                <div v-if="activeTab === 'wealth'" class="max-w-5xl mx-auto space-y-6">`,
`                <div v-if="activeTab === 'wealth'" class="max-w-7xl mx-auto space-y-6">`);

/* ── 2. Colonne Quote-part supprimée de l'en-tête ─────────────────────────── */
sub(
`                                            <th class="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest">Actif</th>
                                            <th class="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest">Quote-part</th>`,
`                                            <th class="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest">Actif</th>`);

/* ── 3. Quote-part rapatriée en badge sur la ligne du nom ─────────────────── */
sub(
`                                                    <span class="text-gray-400">{{ asset.type }}</span>
                                                    <span v-if="asset.is_included_in_net_worth === false" class="bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded normal-case">hors patrimoine net</span>
                                                </p>
                                            </td>
                                            <td class="px-4 py-3 text-center whitespace-nowrap">
                                                <span :class="['text-xs font-black px-2 py-1 rounded-lg border', asset.quotePart === '100%' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-amber-100 text-amber-700 border-amber-200']">{{ asset.quotePart }}</span>
                                            </td>`,
`                                                    <span class="text-gray-400">{{ asset.type }}</span>
                                                    <span :class="['px-1.5 py-0.5 rounded-full border', asset.quotePart === '100%' ? 'bg-gray-50 text-gray-500 border-gray-200' : 'bg-amber-100 text-amber-700 border-amber-300']">{{ asset.quotePart }}</span>
                                                    <span v-if="asset.is_included_in_net_worth === false" class="bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded normal-case">hors patrimoine net</span>
                                                </p>
                                            </td>`);

/* ── 4. colspan mis à jour (9 → 8) ────────────────────────────────────────── */
sub(
`                                            <td colspan="9" class="px-4 pb-4 pt-0">`,
`                                            <td colspan="8" class="px-4 pb-4 pt-0">`);
sub(
`                                            <td colspan="9" class="px-4 py-2 text-[11px] font-bold text-gray-500">`,
`                                            <td colspan="8" class="px-4 py-2 text-[11px] font-bold text-gray-500">`);
sub(
`                                            <td class="px-4 py-3 font-black text-sm uppercase tracking-widest" colspan="2">📊 Totaux retenus</td>`,
`                                            <td class="px-4 py-3 font-black text-sm uppercase tracking-widest">📊 Totaux retenus</td>`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ v33.92 largeur corrigée');
