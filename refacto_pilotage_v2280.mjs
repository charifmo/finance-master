/**
 * refacto_pilotage_v2280.mjs
 * v22.80 Pilotage-Nominatif
 *
 * Corrections :
 *  1. tresoActuelleCourante : type 'courant' (pas 'liquide')
 *  2. KPI 1 tooltip : idem
 *  3. resteAPayerDetailParCompte : items → lignes (nominatif), + épargne loop, + parNature.epargne
 *  4. KPI 2 tooltip : nominatif v-for lignes (remplace le groupement par nature)
 *  5. Suppression Toggle Décalage de Paie + Destination du Surplus
 *  6. Version bump 22.80 Pilotage-Nominatif
 */

import { readFileSync, writeFileSync } from 'fs';

const FILE = 'C:/Users/HP/finance/index.html';
let html = readFileSync(FILE, 'utf8');

// Normaliser CRLF → LF
html = html.replace(/\r\n/g, '\n');
console.log('✅ CRLF normalisé → LF');

let opCount = 0;
function replace(label, oldStr, newStr) {
  const idx = html.indexOf(oldStr);
  if (idx === -1) {
    console.error(`❌ [Op ${opCount + 1}] "${label}" — introuvable`);
    console.error('   Début :', JSON.stringify(oldStr.slice(0, 120)));
    process.exit(1);
  }
  const n = html.split(oldStr).length - 1;
  if (n > 1) {
    console.error(`❌ [Op ${opCount + 1}] "${label}" — ${n} occurrences, ambigu`);
    process.exit(1);
  }
  html = html.slice(0, idx) + newStr + html.slice(idx + oldStr.length);
  opCount++;
  console.log(`✅ [Op ${opCount}] ${label}`);
}

/* ══════════════════════════════════════════════════════════
   Op 1 — tresoActuelleCourante : type 'courant' au lieu de 'liquide'
   ══════════════════════════════════════════════════════════ */
replace(
  'tresoActuelleCourante → type courant',
  `                    // ─── v22.60 Trésorerie réelle = somme des soldes comptes liquides ───
                    const tresoActuelleCourante = computed(() => {
                        calculationTick.value;
                        const liquides = (comptes.value || []).filter(c => c.type === 'liquide');
                        if (liquides.length === 0) {
                            // Fallback : solde courant de soldesInitiaux si aucun compte configuré
                            return Number(soldesInitiaux.value.courant || 0);
                        }
                        return liquides.reduce((sum, c) => sum + Number(c.solde || 0), 0);
                    });`,
  `                    // ─── v22.80 Trésorerie réelle = solde du compte type 'courant' ───
                    const tresoActuelleCourante = computed(() => {
                        calculationTick.value;
                        const compteCourant = (comptes.value || []).find(c => c.type === 'courant');
                        if (compteCourant) return Number(compteCourant.solde || 0);
                        // Fallback : soldesInitiaux.courant si aucun compte 'courant' configuré
                        return Number(soldesInitiaux.value.courant || 0);
                    });`
);

/* ══════════════════════════════════════════════════════════
   Op 2 — resteAPayerDetailParCompte : lignes + épargne + parNature.epargne
   ══════════════════════════════════════════════════════════ */
replace(
  'resteAPayerDetailParCompte : init avec lignes + parNature.epargne',
  `                                groupsMap[key] = { key, icon, label, montant: 0, items: [],
                                    parNature: { fix: 0, var: 0, choc: 0, virement: 0 } };`,
  `                                groupsMap[key] = { key, icon, label, montant: 0, lignes: [],
                                    parNature: { fix: 0, var: 0, choc: 0, virement: 0, epargne: 0 } };`
);

// Charges fixes : items → lignes
replace(
  'Charges fixes : items → lignes',
  `                                grp.montant += due; grp.parNature.fix += due;
                                grp.items.push({ label: f.label || '?', montant: due, type: 'fix' });`,
  `                                grp.montant += due; grp.parNature.fix += due;
                                grp.lignes.push({ nom: f.label || '?', montant: due, type: 'fix' });`
);

// Charges variables : items → lignes (details)
replace(
  'Variables détail : items → lignes',
  `                                        const grp = getOrCreate(src);
                                        grp.montant += m; grp.parNature.var += m;
                                        grp.items.push({ label: f.nom || cat.label || '?', montant: m, type: 'var' });`,
  `                                        const grp = getOrCreate(src);
                                        grp.montant += m; grp.parNature.var += m;
                                        grp.lignes.push({ nom: f.nom || cat.label || '?', montant: m, type: 'var' });`
);

// Charges variables : items → lignes (no details)
replace(
  'Variables no-detail : items → lignes',
  `                                    const grp = getOrCreate(src);
                                    grp.montant += m; grp.parNature.var += m;
                                    grp.items.push({ label: cat.label || '?', montant: m, type: 'var' });`,
  `                                    const grp = getOrCreate(src);
                                    grp.montant += m; grp.parNature.var += m;
                                    grp.lignes.push({ nom: cat.label || '?', montant: m, type: 'var' });`
);

// Chocs : items → lignes
replace(
  'Chocs : items → lignes',
  `                                grp.montant += m; grp.parNature.choc += m;
                                grp.items.push({ label: dep.nom || '?', montant: m, type: 'choc' });`,
  `                                grp.montant += m; grp.parNature.choc += m;
                                grp.lignes.push({ nom: dep.nom || '?', montant: m, type: 'choc' });`
);

// Virements : items → lignes + add épargne loop after
replace(
  'Virements : items → lignes + boucle épargne',
  `                        // Virements sortants du mois non payés
                        getVirementsMois(mois, an).forEach(vir => {
                            const m = Number(vir.montant || 0);
                            if (m > 0 && !isItemPaid(vir, m)) {
                                const grp = getOrCreate(vir.sourceCompte || 'courant');
                                grp.montant += m; grp.parNature.virement += m;
                                grp.items.push({ label: vir.label || vir.nom || '?', montant: m, type: 'virement' });
                            }
                        });`,
  `                        // Virements sortants du mois non payés
                        getVirementsMois(mois, an).forEach(vir => {
                            const m = Number(vir.montant || 0);
                            if (m > 0 && !isItemPaid(vir, m)) {
                                const grp = getOrCreate(vir.sourceCompte || 'courant');
                                grp.montant += m; grp.parNature.virement += m;
                                grp.lignes.push({ nom: vir.label || vir.nom || '?', montant: m, type: 'virement' });
                            }
                        });
                        // ── v22.80 : Épargne mensuelle (allocations non cochées) ─────────
                        const epargneArr = Array.isArray(dActuelle.epargne)
                            ? dActuelle.epargne
                            : Object.values(dActuelle.epargne || {});
                        epargneArr.forEach(ep => {
                            const m = Number(ep.valeur || 0);
                            if (m <= 0) return;
                            // Inclure toujours (obligation de virement épargne)
                            // sauf si explicitement marqué payé dans la checklist
                            if (isItemPaid(ep, m)) return;
                            const src = ep.sourceCompte || 'courant';
                            const grp = getOrCreate(src);
                            grp.montant += m; grp.parNature.epargne += m;
                            grp.lignes.push({ nom: ep.nom || ep.label || '?', montant: m, type: 'epargne' });
                        });`
);

/* ══════════════════════════════════════════════════════════
   Op 3 — KPI 1 tooltip : type 'courant' (pas 'liquide')
   ══════════════════════════════════════════════════════════ */
replace(
  'KPI 1 tooltip : courant au lieu de liquide',
  `                                            <template v-if="comptes.filter(c => c.type === 'liquide').length > 0">
                                                <div v-for="cpt in comptes.filter(c => c.type === 'liquide')" :key="'kpi1_'+cpt.id" class="flex justify-between gap-3">
                                                    <span class="text-slate-300">{{ cpt.icone || '💳' }} {{ cpt.label }}</span>
                                                    <span class="font-black text-white">{{ formatMAD(Number(cpt.solde || 0)) }}</span>
                                                </div>
                                                <div v-if="comptes.filter(c => c.type === 'liquide').length > 1" :class="['flex justify-between gap-3 border-t border-slate-700 pt-1.5 mt-1.5 font-black', tresoActuelleCourante >= 0 ? 'text-emerald-300' : 'text-red-300']">
                                                    <span>= Total liquide</span>
                                                    <span>{{ formatMAD(tresoActuelleCourante) }}</span>
                                                </div>
                                            </template>
                                            <template v-else>
                                                <p class="text-slate-400 text-[10px]">Aucun compte de type "liquide" configuré.<br/>Configurer vos comptes dans l'onglet Saisie.</p>
                                                <div class="flex justify-between gap-3 border-t border-slate-700 pt-1.5 mt-1.5 font-black text-amber-300">
                                                    <span>Solde courant (fallback)</span>
                                                    <span>{{ formatMAD(tresoActuelleCourante) }}</span>
                                                </div>
                                            </template>`,
  `                                            <template v-if="comptes.find(c => c.type === 'courant')">
                                                <div class="flex justify-between gap-3">
                                                    <span class="text-slate-300">{{ comptes.find(c => c.type === 'courant').icone || '💳' }} {{ comptes.find(c => c.type === 'courant').label }}</span>
                                                    <span class="font-black text-white">{{ formatMAD(Number(comptes.find(c => c.type === 'courant').solde || 0)) }}</span>
                                                </div>
                                                <div :class="['flex justify-between gap-3 border-t border-slate-700 pt-1.5 mt-1.5 font-black', tresoActuelleCourante >= 0 ? 'text-emerald-300' : 'text-red-300']">
                                                    <span>= Solde compte courant</span>
                                                    <span>{{ formatMAD(tresoActuelleCourante) }}</span>
                                                </div>
                                            </template>
                                            <template v-else>
                                                <p class="text-slate-400 text-[10px]">Aucun compte de type "courant" configuré.<br/>Configurer vos comptes dans l'onglet Saisie.</p>
                                                <div class="flex justify-between gap-3 border-t border-slate-700 pt-1.5 mt-1.5 font-black text-amber-300">
                                                    <span>Fallback soldesInitiaux.courant</span>
                                                    <span>{{ formatMAD(tresoActuelleCourante) }}</span>
                                                </div>
                                            </template>`
);

/* ══════════════════════════════════════════════════════════
   Op 4 — KPI 2 tooltip : nominatif v-for lignes
   ══════════════════════════════════════════════════════════ */
replace(
  'KPI 2 tooltip : nominatif par ligne',
  `                                        <div class="space-y-2.5">
                                            <div v-if="!resteAPayerDetailParCompte.length" class="text-center text-emerald-400 py-1">✅ Tout est payé !</div>
                                            <div v-for="grp in resteAPayerDetailParCompte" :key="grp.key" class="space-y-1">
                                                <div class="flex justify-between gap-3 font-black">
                                                    <span :class="grp.key === 'courant' ? 'text-orange-300' : 'text-violet-300'">{{ grp.icon }} {{ grp.label }}</span>
                                                    <span class="text-white">{{ formatMAD(grp.montant) }}</span>
                                                </div>
                                                <div v-if="grp.parNature.fix > 0" class="flex justify-between gap-3 pl-3 text-[10px] text-slate-400">
                                                    <span>↳ 🏢 Fixes</span>
                                                    <span class="font-bold text-slate-300">{{ formatMAD(grp.parNature.fix) }}</span>
                                                </div>
                                                <div v-if="grp.parNature.var > 0" class="flex justify-between gap-3 pl-3 text-[10px] text-slate-400">
                                                    <span>↳ 🧾 Variables</span>
                                                    <span class="font-bold text-slate-300">{{ formatMAD(grp.parNature.var) }}</span>
                                                </div>
                                                <div v-if="grp.parNature.choc > 0" class="flex justify-between gap-3 pl-3 text-[10px] text-slate-400">
                                                    <span>↳ ⚠️ Chocs</span>
                                                    <span class="font-bold text-slate-300">{{ formatMAD(grp.parNature.choc) }}</span>
                                                </div>
                                                <div v-if="grp.parNature.virement > 0" class="flex justify-between gap-3 pl-3 text-[10px] text-slate-400">
                                                    <span>↳ 🔄 Virements</span>
                                                    <span class="font-bold text-slate-300">{{ formatMAD(grp.parNature.virement) }}</span>
                                                </div>
                                            </div>
                                            <div v-if="resteAPayerDetailParCompte.length > 1" class="flex justify-between gap-3 border-t border-slate-700 pt-1.5 mt-1.5 font-black text-orange-300">
                                                <span>= Total tous comptes</span>
                                                <span>{{ formatMAD(resteAPayerTotalGlobal) }}</span>
                                            </div>
                                        </div>`,
  `                                        <div class="space-y-3">
                                            <div v-if="!resteAPayerDetailParCompte.length" class="text-center text-emerald-400 py-1">✅ Tout est payé !</div>
                                            <div v-for="grp in resteAPayerDetailParCompte" :key="grp.key" class="space-y-1">
                                                <!-- En-tête du compte -->
                                                <div class="flex justify-between gap-3 font-black">
                                                    <span :class="grp.key === 'courant' ? 'text-orange-300' : 'text-violet-300'">{{ grp.icon }} {{ grp.label }}</span>
                                                    <span class="text-white">{{ formatMAD(grp.montant) }}</span>
                                                </div>
                                                <!-- Lignes nominatives -->
                                                <div v-for="(ligne, li) in grp.lignes" :key="grp.key+'_'+li"
                                                     class="flex justify-between gap-2 pl-3 text-[10px]">
                                                    <span class="text-slate-400 truncate max-w-[150px]">
                                                        <span v-if="ligne.type==='fix'">🏢</span>
                                                        <span v-else-if="ligne.type==='var'">🧾</span>
                                                        <span v-else-if="ligne.type==='choc'">⚠️</span>
                                                        <span v-else-if="ligne.type==='epargne'">💰</span>
                                                        <span v-else>🔄</span>
                                                        {{ ligne.nom }}
                                                    </span>
                                                    <span class="font-bold text-slate-200 shrink-0">{{ formatMAD(ligne.montant) }}</span>
                                                </div>
                                            </div>
                                            <div v-if="resteAPayerDetailParCompte.length > 1" class="flex justify-between gap-3 border-t border-slate-700 pt-1.5 mt-1.5 font-black text-orange-300">
                                                <span>= Total tous comptes</span>
                                                <span>{{ formatMAD(resteAPayerTotalGlobal) }}</span>
                                            </div>
                                        </div>`
);

/* ══════════════════════════════════════════════════════════
   Op 5 — Supprimer Décalage de Paie + Destination du Surplus
   ══════════════════════════════════════════════════════════ */
replace(
  'Supprimer Toggle décalage + Destination surplus',
  `<!-- Toggle décalage paie -->
                        <div class="p-4 bg-slate-800 rounded-2xl border border-slate-700 flex items-center justify-between shadow-sm">
                            <div>
                                <p class="text-sm font-bold text-white">Mode "Décalage de Paie" actif</p>
                                <p class="text-[10px] text-slate-400 mt-1">Le salaire reçu en fin de mois finance le mois d'après.</p>
                            </div>
                            <label class="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" v-model="soldesInitiaux.decalagePaie" @change="handleDataChange" class="sr-only peer">
                                <div class="w-11 h-6 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                            </label>
                        </div>

                        <!-- v17.19 : Destination du Surplus -->
                        <div class="p-4 bg-slate-800 rounded-2xl border border-slate-700 flex items-center justify-between shadow-sm">
                            <div>
                                <p class="text-sm font-bold text-white">🔄 Destination du Surplus</p>
                                <p class="text-[10px] text-slate-400 mt-1">Où va le cashflow positif de chaque mois ?</p>
                            </div>
                            <select v-model="soldesInitiaux.destinationSurplus" @change="handleDataChange" class="bg-slate-700 text-white px-3 py-2 rounded-lg text-sm font-bold outline-none border border-slate-600 cursor-pointer focus:border-blue-500">
                                <option value="courant">💳 Compte Courant</option>
                                <option v-for="c in comptesSelectOptions" :key="'dcpt_'+c.id" :value="'cpt_'+c.id">{{ c.icone }} {{ c.label }}</option>
                                <option v-for="ep in epargneNonLiee" :key="'dest_'+ep.id" :value="'ep_'+ep.id">🎯 {{ ep.nom }}</option>
                            </select>
                        </div>

                        <!-- Checklist`,
  `<!-- Checklist`
);

/* ══════════════════════════════════════════════════════════
   Op 6 — Bump version
   ══════════════════════════════════════════════════════════ */
replace('Bump version 22.80', `"22.60 Pilotage-Expert"`, `"22.80 Pilotage-Nominatif"`);

/* ══════════════════════════════════════════════════════════
   Vérifications finales
   ══════════════════════════════════════════════════════════ */
console.log('\n── Vérifications ──');

const checks = [
  ["c.type === 'courant'", 'type courant dans tresoActuelleCourante'],
  ['lignes.push', 'lignes dans resteAPayerDetailParCompte'],
  ['parNature.epargne', 'parNature.epargne'],
  ['epargneArr', 'boucle épargne'],
  ['ligne.type===\'fix\'', 'nominatif dans KPI2 tooltip'],
  ['ligne.nom', 'ligne.nom dans tooltip'],
  ['22.80 Pilotage-Nominatif', 'version bump'],
];
checks.forEach(([s, l]) => {
  console.log(html.indexOf(s) >= 0 ? `✅ ${l}` : `❌ ${l} ABSENT`);
});

// Vérifier absence des blocs supprimés
const noDecalage = html.indexOf('Décalage de Paie') === -1 || html.indexOf('Mode "Décalage de Paie" actif') === -1;
console.log(html.indexOf('Mode "Décalage de Paie" actif') === -1 ? '✅ Bloc décalage supprimé' : '⚠️ Bloc décalage encore présent');
console.log(html.indexOf('Destination du Surplus') === -1 ? '✅ Bloc destination surplus supprimé' : '⚠️ Bloc destination encore présent');

// Pas d'items.push restants
const itemsPush = (html.match(/items\.push/g) || []).length;
console.log(itemsPush === 0 ? '✅ items.push absent (remplacé par lignes.push)' : `⚠️ ${itemsPush} items.push encore présents`);

// Équilibre div
let depth = 0, issues = 0;
for (let i = 0; i < html.length; i++) {
  if (html[i] === '<') {
    if (html.slice(i,i+4) === '<div') depth++;
    else if (html.slice(i,i+6) === '</div>') { depth--; if (depth < 0) { issues++; depth = 0; } }
  }
}
console.log(depth === 0 && issues <= 1 ? `✅ div OK depth=${depth} issues=${issues}` : `⚠️ div depth=${depth} issues=${issues}`);

writeFileSync(FILE, html, 'utf8');
console.log(`\n🎉 v22.80 Pilotage-Nominatif — ${opCount} ops, ${Buffer.byteLength(html)} octets`);
