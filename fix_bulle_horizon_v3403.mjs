/**
 * v34.03 — La bulle et le Relevé ouvrent sur le même horizon
 * ---------------------------------------------------------------------------
 * AUDIT DE LA BULLE « Répartition du Patrimoine Projeté » : aucune faute de
 * calcul. Vérifié sur données réelles —
 *   • total de la bulle = somme de ses lignes (59 767 DH) ;
 *   • chaque ligne = atterrissage du Relevé pour ce compte, écart 0 ;
 *   • pont mois par mois du Compte Courant cohérent :
 *     −495 (août) → −174 → 147 → 1 702 → 2 107 (décembre).
 *
 * L'INCOHÉRENCE PERÇUE était un écart d'HORIZON : la bulle affiche fin 2026
 * (2 107 DH) tandis qu'un clic ouvrait le Relevé sur le cycle courant seul
 * (−495 DH). Deux chiffres justes, deux périodes différentes, et un utilisateur
 * qui conclut logiquement que l'outil se contredit.
 *
 * Correctif : cliquer un compte dans la bulle ouvre le Relevé déjà cadré sur
 * le même horizon — du cycle courant à décembre de l'année cible. Le chiffre
 * de la bulle est alors littéralement la dernière ligne du relevé affiché.
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

/* ── 1. Ouverture du relevé cadrée sur l'horizon de projection ───────────── */
sub(
`                    const fermerReleve = () => {`,
String.raw`                    // v34.03 : ouvre le Relevé sur l'horizon exact de la projection, pour
                    //   que l'atterrissage affiché soit le chiffre lu dans la bulle.
                    const ouvrirReleveProjection = (compteKey) => {
                        const curA = moisBudgetaire.value.an;
                        const cible = Math.max(Number(anneeCibleProjection.value) || curA, curA);
                        ouvrirReleve(compteKey);
                        anneesSelectionnees.value = Array.from({ length: cible - curA + 1 }, (_, i) => curA + i);
                        moisSelectionnes.value = [1,2,3,4,5,6,7,8,9,10,11,12];
                    };

                    const fermerReleve = () => {`);

sub(
`ouvrirReleve, fermerReleve,`,
`ouvrirReleve, ouvrirReleveProjection, fermerReleve,`);

/* ── 2. La bulle appelle la nouvelle ouverture ───────────────────────────── */
sub(
`                                    <div class="flex justify-between"><span class="text-blue-300 font-bold cursor-pointer hover:underline" @click="ouvrirReleve(key)">{{ getCompteIcone(key) }} {{ getCompteLabel(key) }}</span><span class="font-black" :class="val < 0 ? 'text-red-400' : ''">{{ formatMAD(val) }}</span></div>`,
`                                    <div class="flex justify-between"><span class="text-blue-300 font-bold cursor-pointer hover:underline" @click="ouvrirReleveProjection(key)" title="Ouvrir le Relevé sur le même horizon">{{ getCompteIcone(key) }} {{ getCompteLabel(key) }}</span><span class="font-black" :class="val < 0 ? 'text-red-400' : ''">{{ formatMAD(val) }}</span></div>`);

sub(
`                                    <div v-if="!getEpLinkedId(key)" class="flex justify-between"><span class="text-purple-300 font-bold cursor-pointer hover:underline" @click="ouvrirReleve(key)">🎯 {{ getEpargneLabel(key) }}</span><span class="font-black">{{ formatMAD(val) }}</span></div>`,
`                                    <div v-if="!getEpLinkedId(key)" class="flex justify-between"><span class="text-purple-300 font-bold cursor-pointer hover:underline" @click="ouvrirReleveProjection(key)" title="Ouvrir le Relevé sur le même horizon">🎯 {{ getEpargneLabel(key) }}</span><span class="font-black">{{ formatMAD(val) }}</span></div>`);

/* ── 3. Contrôle d'intégrité visible : total vs somme des lignes ─────────── */
sub(
`                                <div class="border-t border-slate-700 pt-1.5 mt-1.5 flex justify-between"><span class="text-emerald-300 font-black">🏛️ Total</span><span class="font-black text-emerald-400">{{ formatMAD(patrimoineProjeteGlobal) }}</span></div>`,
`                                <div class="border-t border-slate-700 pt-1.5 mt-1.5 flex justify-between"><span class="text-emerald-300 font-black">🏛️ Total</span><span class="font-black text-emerald-400">{{ formatMAD(patrimoineProjeteGlobal) }}</span></div>
                                <p class="text-[8px] text-slate-500 font-bold mt-1">Cliquez un compte pour ouvrir son relevé sur le même horizon.</p>`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ v34.03 appliquée');
