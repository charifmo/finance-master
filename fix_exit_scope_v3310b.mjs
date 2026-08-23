/**
 * v33.10b — Fix de portée : la ligne dépliable du simulateur de sortie était
 * un <tr> FRÈRE du <tr v-for> — `asset` n'existe pas dans cette portée, d'où
 * « Cannot read properties of undefined (reading 'id') » et la disparition de
 * tout le ROI Tracker au rendu. On enveloppe les deux lignes dans un
 * <template v-for> qui porte la boucle.
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

// La boucle passe sur un <template>, les deux <tr> deviennent son contenu.
sub(
`                                        <tr v-for="asset in stressAssets" :key="asset.id" class="border-b border-gray-100 hover:bg-gray-50 transition-colors">`,
`                                        <template v-for="asset in stressAssets" :key="asset.id">
                                        <tr class="border-b border-gray-100 hover:bg-gray-50 transition-colors">`);

sub(
`                                        <!-- v33.10 : ligne dépliable — simulateur de sortie -->
                                        <tr v-if="exitOpen[asset.id]" :key="asset.id + '_exit'" class="bg-fuchsia-50/30">`,
`                                        <!-- v33.10 : ligne dépliable — simulateur de sortie -->
                                        <tr v-if="exitOpen[asset.id]" class="bg-fuchsia-50/30">`);

// Fermeture du template juste après la ligne dépliable
sub(
`                                            </td>
                                        </tr>
                                    </tbody>
                                    <tfoot>
                                        <tr class="bg-gradient-to-r from-slate-800 to-violet-900 text-white">
                                            <td class="px-4 py-3 font-black text-sm uppercase tracking-widest" colspan="2">📊 Totaux</td>`,
`                                            </td>
                                        </tr>
                                        </template>
                                    </tbody>
                                    <tfoot>
                                        <tr class="bg-gradient-to-r from-slate-800 to-violet-900 text-white">
                                            <td class="px-4 py-3 font-black text-sm uppercase tracking-widest" colspan="2">📊 Totaux</td>`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ v33.10b portée v-for corrigée');
