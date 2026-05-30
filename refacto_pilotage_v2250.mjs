/**
 * refacto_pilotage_v2250.mjs
 * v22.50 Pilotage-Pro — Cycle de Paie & Isolation Multi-comptes
 *
 * Opérations :
 *  1. Ajouter jourDePaie: 27 au default soldesInitiaux
 *  2. Remplacer bloc JS (resteAPayerParCompte + cashDispoPourConso + budgetSemaineReel)
 *     par les nouveaux computed v22.50 (jourDePaie, cycle de paie, tresoActuelleCourante,
 *     resteAPayerDetailParCompte, resteAPayerCourant, resteAPayerTotalGlobal)
 *  3. Mettre à jour le return statement
 *  4. Remplacer le sélecteur semainesRestantes par le champ jourDePaie
 *  5. Remplacer le bloc KPI Grid (gauge + 3 cartes)
 *  6. Bump version → 22.50 Pilotage-Pro
 */

import { readFileSync, writeFileSync } from 'fs';

const FILE = 'C:/Users/HP/finance/index.html';
let html = readFileSync(FILE, 'utf8');
const original = html;
let opCount = 0;

function replace(label, oldStr, newStr) {
  const idx = html.indexOf(oldStr);
  if (idx === -1) {
    console.error(`❌ [Op ${opCount + 1}] "${label}" — chaîne introuvable`);
    console.error('   Cherché :', JSON.stringify(oldStr.slice(0, 120)));
    process.exit(1);
  }
  const count = html.split(oldStr).length - 1;
  if (count > 1) {
    console.error(`❌ [Op ${opCount + 1}] "${label}" — ${count} occurrences (ambigu)`);
    process.exit(1);
  }
  html = html.slice(0, idx) + newStr + html.slice(idx + oldStr.length);
  opCount++;
  console.log(`✅ [Op ${opCount}] ${label}`);
}

/* ══════════════════════════════════════════════════════════
   Op 1 — Ajouter jourDePaie au default soldesInitiaux
   ══════════════════════════════════════════════════════════ */
replace(
  'Ajouter jourDePaie default',
  `semainesRestantes: 3, decalagePaie: true`,
  `semainesRestantes: 3, jourDePaie: 27, decalagePaie: true`
);

/* ══════════════════════════════════════════════════════════
   Op 2 — Remplacer bloc JS computed v22.41 → v22.50
   ══════════════════════════════════════════════════════════ */
const OLD_JS = `                    // Détail par compte source (Courant vs Épargne/Projet) — fixes + chocs seulement
                    const resteAPayerParCompte = computed(() => {
                        calculationTick.value;
                        const an = soldesInitiaux.value.anneeActuelle;
                        const dActuelle = donneesAnnuelles.value[an];
                        if (!dActuelle) return { courant: 0, autres: [] };
                        let courant = 0;
                        const autresMap = {};
                        // Charges fixes non payées
                        Object.values(dActuelle.chargesFixes || {}).forEach(f => {
                            const due = getDueFixe(f, an);
                            if (due > 0 && !isItemPaid(f, due)) {
                                const src = f.sourceCompte || 'courant';
                                if (src === 'courant') courant += due;
                                else { autresMap[src] = (autresMap[src] || 0) + due; }
                            }
                        });
                        // Chocs mois courant non payés
                        const mois = soldesInitiaux.value.moisActuel;
                        getDepensesMois(mois, an).forEach(dep => {
                            const m = Number(dep.montant || 0);
                            if (m > 0 && !isItemPaid(dep, m)) {
                                const src = dep.sourceCompte || 'courant';
                                if (src === 'courant') courant += m;
                                else { autresMap[src] = (autresMap[src] || 0) + m; }
                            }
                        });
                        // Résoudre les labels des autres comptes
                        const cptsList = comptes.value || [];
                        const autres = Object.entries(autresMap).map(([key, montant]) => {
                            let label = key;
                            if (key.startsWith('cpt_')) {
                                const id = parseInt(key.replace('cpt_', ''));
                                const cpt = cptsList.find(c => c.id === id);
                                label = cpt ? cpt.label : key;
                            } else if (key.startsWith('ep_')) {
                                const epId = key.replace('ep_', '');
                                const ep = (donneesAnnuelles.value[an]?.epargne || []).find(e => String(e.id) === epId);
                                label = ep ? (ep.label || ep.nom) : key;
                            }
                            return { label, montant };
                        });
                        return { courant, autres };
                    });
                    // v22.41 — Cash disponible pour la consommation (tréso - factures obligatoires)
                    const cashDispoPourConso = computed(() => {
                        return tresoActuelleMois.value - resteAPayerIncompressible.value;
                    });
                    // Budget par semaine réel (cash dispo ÷ semaines restantes)
                    const budgetSemaineReel = computed(() => {
                        const sem = Number((soldesInitiaux.value || {}).semainesRestantes || 0);
                        if (!sem) return null;
                        return cashDispoPourConso.value / sem;
                    });`;

const NEW_JS = `                    // ─── v22.50 Cycle de Paie ────────────────────────────────────────
                    const jourDePaie = computed(() => Number(soldesInitiaux.value.jourDePaie) || 27);

                    const _cyclePaieInfo = computed(() => {
                        const today = new Date();
                        const todayDay = today.getDate();
                        const jour = jourDePaie.value;
                        const mois = soldesInitiaux.value.moisActuel || (today.getMonth() + 1);
                        const an = soldesInitiaux.value.anneeActuelle || today.getFullYear();
                        const moisAbbr = ['','JAN','FÉV','MAR','AVR','MAI','JUN','JUL','AOÛ','SEP','OCT','NOV','DÉC'];
                        // Dernière paie = jourDePaie du mois actuel si déjà passé, sinon mois précédent
                        let dernierMois, dernierAn, prochainMois, prochainAn;
                        if (todayDay >= jour) {
                            dernierMois = mois; dernierAn = an;
                            prochainMois = mois === 12 ? 1 : mois + 1;
                            prochainAn = mois === 12 ? an + 1 : an;
                        } else {
                            dernierMois = mois === 1 ? 12 : mois - 1;
                            dernierAn = mois === 1 ? an - 1 : an;
                            prochainMois = mois; prochainAn = an;
                        }
                        const dernierePaieDate = new Date(dernierAn, dernierMois - 1, jour);
                        const prochainePaieDate = new Date(prochainAn, prochainMois - 1, jour);
                        const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                        const msPerDay = 864e5;
                        const joursDepuis = Math.max(0, Math.round((todayMidnight - dernierePaieDate) / msPerDay));
                        const joursAvant = Math.max(0, Math.round((prochainePaieDate - todayMidnight) / msPerDay));
                        const totalCycle = Math.max(1, Math.round((prochainePaieDate - dernierePaieDate) / msPerDay));
                        const progress = Math.min(100, Math.max(0, Math.round((joursDepuis / totalCycle) * 100)));
                        return {
                            joursAvant,
                            joursDepuis,
                            progress,
                            dernierePaieLabel: jour + ' ' + moisAbbr[dernierMois],
                            prochainePaieLabel: jour + ' ' + moisAbbr[prochainMois],
                        };
                    });

                    const joursRestantsAvantPaie = computed(() => _cyclePaieInfo.value.joursAvant);
                    const joursDepuisDernierePaie = computed(() => _cyclePaieInfo.value.joursDepuis);
                    const progressCyclePaie = computed(() => _cyclePaieInfo.value.progress);
                    const dernierePaieLabel = computed(() => _cyclePaieInfo.value.dernierePaieLabel);
                    const prochainePaieLabel = computed(() => _cyclePaieInfo.value.prochainePaieLabel);

                    // ─── v22.50 Trésorerie du Compte Courant uniquement ──────────────────
                    const tresoActuelleCourante = computed(() => {
                        calculationTick.value;
                        const an = soldesInitiaux.value.anneeActuelle;
                        const dActuelle = donneesAnnuelles.value[an];
                        if (!dActuelle) return 0;
                        let entrees = 0;
                        Object.values(dActuelle.revenus || {}).forEach(rev => {
                            const dest = rev.destinationCompte || 'courant';
                            if (dest !== 'courant') return;
                            const base = Number(rev.base || 0);
                            if (isItemPaid(rev, base)) entrees += base;
                        });
                        let sorties = 0;
                        Object.values(dActuelle.chargesFixes || {}).forEach(f => {
                            if ((f.sourceCompte || 'courant') !== 'courant') return;
                            const due = getDueFixe(f, an);
                            if (isItemPaid(f, due)) sorties += due;
                        });
                        Object.values(dActuelle.chargesVariables || {}).filter(c => c?.periode === 'mois').forEach(cat => {
                            if ((cat.sourceCompte || 'courant') !== 'courant') return;
                            (cat.details || []).forEach(f => {
                                const m = Number(f.montant || 0);
                                if (isItemPaid(f, m)) sorties += m;
                            });
                        });
                        getDepensesMois(soldesInitiaux.value.moisActuel, an).forEach(dep => {
                            if ((dep.sourceCompte || 'courant') !== 'courant') return;
                            const m = Number(dep.montant || 0);
                            if (m > 0 && isItemPaid(dep, m)) sorties += m;
                        });
                        return entrees - sorties;
                    });

                    // ─── v22.50 Détail des charges restantes, groupées par compte source ─
                    const resteAPayerDetailParCompte = computed(() => {
                        calculationTick.value;
                        const an = soldesInitiaux.value.anneeActuelle;
                        const mois = soldesInitiaux.value.moisActuel;
                        const dActuelle = donneesAnnuelles.value[an];
                        if (!dActuelle) return [];
                        const cptsList = comptes.value || [];
                        const groupsMap = {};

                        const getOrCreate = (key) => {
                            if (!groupsMap[key]) {
                                let label = key, icon = '🏦';
                                if (key === 'courant') { label = 'Compte Courant'; icon = '💳'; }
                                else if (key.startsWith('cpt_')) {
                                    const id = parseInt(key.replace('cpt_', ''));
                                    const cpt = cptsList.find(c => c.id === id);
                                    label = cpt ? cpt.label : key;
                                    icon = cpt ? (cpt.icone || '🏦') : '🏦';
                                } else if (key.startsWith('ep_')) {
                                    const epId = key.replace('ep_', '');
                                    const ep = (dActuelle.epargne || []).find(e => String(e.id) === epId);
                                    label = ep ? (ep.label || ep.nom || key) : key;
                                    icon = '🎯';
                                }
                                groupsMap[key] = { key, icon, label, montant: 0, items: [] };
                            }
                            return groupsMap[key];
                        };

                        // Charges fixes non payées
                        Object.values(dActuelle.chargesFixes || {}).forEach(f => {
                            const due = getDueFixe(f, an);
                            if (due > 0 && !isItemPaid(f, due)) {
                                const grp = getOrCreate(f.sourceCompte || 'courant');
                                grp.montant += due;
                                grp.items.push({ label: f.label || '?', montant: due, type: 'fix' });
                            }
                        });
                        // Charges variables mensuelles non payées
                        Object.values(dActuelle.chargesVariables || {}).filter(c => c?.periode === 'mois').forEach(cat => {
                            const src = cat.sourceCompte || 'courant';
                            if (cat.details && cat.details.length) {
                                cat.details.forEach(f => {
                                    const m = Number(f.montant || 0);
                                    if (m > 0 && !isItemPaid(f, m)) {
                                        const grp = getOrCreate(src);
                                        grp.montant += m;
                                        grp.items.push({ label: f.nom || cat.label || '?', montant: m, type: 'var' });
                                    }
                                });
                            } else {
                                const m = Number(cat.valeur || 0);
                                if (m > 0) {
                                    const grp = getOrCreate(src);
                                    grp.montant += m;
                                    grp.items.push({ label: cat.label || '?', montant: m, type: 'var' });
                                }
                            }
                        });
                        // Dépenses irrégulières du mois non payées
                        getDepensesMois(mois, an).forEach(dep => {
                            const m = Number(dep.montant || 0);
                            if (m > 0 && !isItemPaid(dep, m)) {
                                const grp = getOrCreate(dep.sourceCompte || 'courant');
                                grp.montant += m;
                                grp.items.push({ label: dep.nom || '?', montant: m, type: 'choc' });
                            }
                        });
                        // Virements sortants du mois non payés
                        getVirementsMois(mois, an).forEach(vir => {
                            const m = Number(vir.montant || 0);
                            if (m > 0 && !isItemPaid(vir, m)) {
                                const grp = getOrCreate(vir.sourceCompte || 'courant');
                                grp.montant += m;
                                grp.items.push({ label: vir.label || vir.nom || '?', montant: m, type: 'virement' });
                            }
                        });

                        // Courant en premier, puis par montant décroissant
                        return Object.values(groupsMap).sort((a, b) => {
                            if (a.key === 'courant') return -1;
                            if (b.key === 'courant') return 1;
                            return b.montant - a.montant;
                        });
                    });

                    const resteAPayerCourant = computed(() => {
                        const grp = resteAPayerDetailParCompte.value.find(g => g.key === 'courant');
                        return grp ? grp.montant : 0;
                    });
                    const resteAPayerTotalGlobal = computed(() => {
                        return resteAPayerDetailParCompte.value.reduce((s, g) => s + g.montant, 0);
                    });
                    // v22.50 — Cash dispo = tréso courant − obligations courant
                    const cashDispoPourConso = computed(() => {
                        return tresoActuelleCourante.value - resteAPayerCourant.value;
                    });
                    // Budget hebdo = cash dispo ÷ (jours restants / 7)
                    const budgetSemaineReel = computed(() => {
                        const jours = joursRestantsAvantPaie.value;
                        if (!jours) return null;
                        return cashDispoPourConso.value / (jours / 7);
                    });`;

replace('Bloc JS computed v22.50', OLD_JS, NEW_JS);

/* ══════════════════════════════════════════════════════════
   Op 3 — Mettre à jour le return statement
   ══════════════════════════════════════════════════════════ */
replace(
  'Return statement — nouveaux computed',
  `resteAPayerParCompte, cashDispoPourConso, budgetSemaineReel,`,
  `resteAPayerDetailParCompte, resteAPayerCourant, resteAPayerTotalGlobal, tresoActuelleCourante, jourDePaie, joursRestantsAvantPaie, joursDepuisDernierePaie, progressCyclePaie, dernierePaieLabel, prochainePaieLabel, cashDispoPourConso, budgetSemaineReel,`
);

/* ══════════════════════════════════════════════════════════
   Op 4 — Return : ajouter tresoActuelleMois pour compat tooltip
   ══════════════════════════════════════════════════════════ */
// tresoActuelleMois est gardé car il est utilisé dans d'autres onglets
// On vérifie juste qu'il est toujours dans le return
const checkTreso = html.indexOf('tresoActuelleMois,');
if (checkTreso === -1) {
  console.error('❌ tresoActuelleMois absent du return — vérifier manuellement');
  process.exit(1);
}
console.log(`✅ [Op ${++opCount}] tresoActuelleMois présent dans le return ✓`);

/* ══════════════════════════════════════════════════════════
   Op 5 — Remplacer le sélecteur semainesRestantes
   ══════════════════════════════════════════════════════════ */
replace(
  'Sélecteur semainesRestantes → jourDePaie',
  `<div class="bg-slate-800 p-5 rounded-2xl border border-slate-700 text-center flex flex-col justify-center">
                                <label class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-3 block">Prorata de Consommation Restant</label>
                                <select v-model.number="soldesInitiaux.semainesRestantes" @change="handleDataChange" class="w-full bg-slate-900 text-white font-bold text-sm p-3 rounded-xl outline-none cursor-pointer border border-slate-600 text-center">
                                    <option v-for="s in [4,3,2,1,0]" :value="s">{{ s }} semaines restantes</option>
                                </select>
                                <p class="text-[10px] text-blue-400 font-black mt-2 uppercase tracking-widest">Budget calculé : {{ formatMAD(budgetConsoRestant) }}</p>
                            </div>`,
  `<div class="bg-slate-800 p-5 rounded-2xl border border-slate-700 text-center flex flex-col justify-center">
                                <label class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-3 block">📅 Jour de Paie</label>
                                <div class="flex items-center gap-2 justify-center">
                                    <span class="text-slate-400 text-sm font-bold">Le</span>
                                    <input type="number" min="1" max="31" v-model.number="soldesInitiaux.jourDePaie" @input="handleDataChange" class="w-20 bg-slate-900 text-blue-300 font-black text-xl p-3 rounded-xl border border-blue-700 text-center outline-none focus:border-blue-400"/>
                                    <span class="text-slate-400 text-sm font-bold">de chaque mois</span>
                                </div>
                                <p class="text-[10px] text-emerald-400 font-black mt-2 uppercase tracking-widest">⏳ J−{{ joursRestantsAvantPaie }} avant la prochaine paie</p>
                            </div>`
);

/* ══════════════════════════════════════════════════════════
   Op 6 — Remplacer le bloc KPI Grid (gauge + 3 cartes)
   ══════════════════════════════════════════════════════════ */
const OLD_KPI_BLOCK = `<!-- KPI Grid 3 colonnes -->
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">

                            <!-- KPI 1 : Trésorerie Actuelle (liquide pointé) -->
                            <div class="relative group cursor-default">
                                <div :class="['p-4 rounded-2xl border text-center transition-all', tresoActuelleMois >= 0 ? 'bg-emerald-900/20 border-emerald-700 group-hover:border-emerald-500' : 'bg-red-900/20 border-red-700 group-hover:border-red-500']">
                                    <p class="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">💰 Tréso Actuelle</p>
                                    <p :class="['text-2xl font-black tracking-tighter', tresoActuelleMois >= 0 ? 'text-emerald-400' : 'text-red-400']">{{ formatMAD(tresoActuelleMois) }}</p>
                                    <p class="text-[9px] text-gray-500 mt-1">Entrées − Sorties pointées</p>
                                </div>
                                <div class="absolute top-full left-0 right-0 mt-1.5 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                    <div class="w-3 h-3 bg-slate-950 border-t border-l border-slate-600 rotate-45 mx-auto -mb-[7px] relative z-10"></div>
                                    <div class="bg-slate-950 border border-slate-600 rounded-xl shadow-2xl p-3.5 text-left text-[11px]">
                                        <p class="font-black uppercase tracking-widest text-slate-300 mb-2 text-[10px]">🔍 Calcul Trésorerie</p>
                                        <div class="space-y-1.5">
                                            <div class="flex justify-between gap-3">
                                                <span class="text-green-400">+ Entrées pointées</span>
                                                <span class="font-black text-white">{{ formatMAD(tresoEntrees) }}</span>
                                            </div>
                                            <div class="flex justify-between gap-3">
                                                <span class="text-red-400">− Sorties pointées</span>
                                                <span class="font-black text-white">{{ formatMAD(tresoEntrees - tresoActuelleMois) }}</span>
                                            </div>
                                            <div :class="['flex justify-between gap-3 border-t border-slate-700 pt-1.5 mt-1.5 font-black', tresoActuelleMois >= 0 ? 'text-emerald-300' : 'text-red-300']">
                                                <span>= Tréso disponible</span>
                                                <span>{{ formatMAD(tresoActuelleMois) }}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- KPI 2 : Reste à Payer INCOMPRESSIBLE (fixes + chocs, PAS les variables) -->
                            <div class="relative group cursor-default">
                                <div :class="['p-4 rounded-2xl border text-center transition-all', resteAPayerIncompressible > 0 ? 'bg-orange-900/20 border-orange-700 group-hover:border-orange-500' : 'bg-green-900/20 border-green-700 group-hover:border-green-500']">
                                    <p class="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">🔴 Reste à Payer</p>
                                    <p :class="['text-2xl font-black tracking-tighter', resteAPayerIncompressible > 0 ? 'text-orange-400' : 'text-green-400']">{{ formatMAD(resteAPayerIncompressible) }}</p>
                                    <p class="text-[9px] text-gray-500 mt-1">Fixes + Chocs — charges exigibles</p>
                                </div>
                                <div class="absolute top-full left-0 right-0 mt-1.5 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                    <div class="w-3 h-3 bg-slate-950 border-t border-l border-slate-600 rotate-45 mx-auto -mb-[7px] relative z-10"></div>
                                    <div class="bg-slate-950 border border-slate-600 rounded-xl shadow-2xl p-3.5 text-left text-[11px]">
                                        <p class="font-black uppercase tracking-widest text-slate-300 mb-2 text-[10px]">🔍 Détail charges exigibles</p>
                                        <div class="space-y-1.5">
                                            <div class="flex justify-between gap-3">
                                                <span class="text-orange-300">🏢 Fixes en attente</span>
                                                <span class="font-black text-white">{{ formatMAD(resteAPayerFixes) }}</span>
                                            </div>
                                            <div class="flex justify-between gap-3">
                                                <span class="text-red-300">⚠️ Chocs en attente</span>
                                                <span class="font-black text-white">{{ formatMAD(resteAPayerIrregulier) }}</span>
                                            </div>
                                            <div class="flex justify-between gap-3 border-t border-slate-700 pt-1.5 mt-1.5 font-black text-orange-300">
                                                <span>= Total exigible</span>
                                                <span>{{ formatMAD(resteAPayerIncompressible) }}</span>
                                            </div>
                                            <!-- Répartition par compte source -->
                                            <div v-if="resteAPayerParCompte.courant > 0 || resteAPayerParCompte.autres.length" class="border-t border-slate-700 pt-1.5 mt-1.5">
                                                <p class="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1.5">📤 Depuis</p>
                                                <div class="space-y-1">
                                                    <div v-if="resteAPayerParCompte.courant > 0" class="flex justify-between gap-3">
                                                        <span class="text-slate-300">💳 Compte Courant</span>
                                                        <span class="font-black text-slate-200">{{ formatMAD(resteAPayerParCompte.courant) }}</span>
                                                    </div>
                                                    <div v-for="cpt in resteAPayerParCompte.autres" :key="cpt.label" class="flex justify-between gap-3">
                                                        <span class="text-violet-300">🏦 {{ cpt.label }}</span>
                                                        <span class="font-black text-slate-200">{{ formatMAD(cpt.montant) }}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- KPI 3 : Budget Conso = cashDispoPourConso (VRAI reste à vivre) -->
                            <div class="relative group cursor-default">
                                <div :class="['p-4 rounded-2xl border text-center transition-all', cashDispoPourConso >= 0 ? 'bg-blue-900/20 border-blue-700 group-hover:border-blue-500' : 'bg-red-900/20 border-red-700 group-hover:border-red-500']">
                                    <p class="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">📊 Budget Conso Restant</p>
                                    <p :class="['text-2xl font-black tracking-tighter', cashDispoPourConso >= 0 ? 'text-blue-400' : 'text-red-400']">{{ formatMAD(cashDispoPourConso) }}</p>
                                    <p class="text-[9px] text-gray-500 mt-1">
                                        <template v-if="budgetSemaineReel !== null">Soit {{ formatMAD(budgetSemaineReel) }} / semaine</template>
                                        <template v-else>Définir les semaines restantes</template>
                                    </p>
                                </div>
                                <div class="absolute top-full left-0 right-0 mt-1.5 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                    <div class="w-3 h-3 bg-slate-950 border-t border-l border-slate-600 rotate-45 mx-auto -mb-[7px] relative z-10"></div>
                                    <div class="bg-slate-950 border border-slate-600 rounded-xl shadow-2xl p-3.5 text-left text-[11px]">
                                        <p class="font-black uppercase tracking-widest text-slate-300 mb-2 text-[10px]">🔍 Calcul Budget Conso</p>
                                        <div class="space-y-1.5">
                                            <div class="flex justify-between gap-3">
                                                <span class="text-emerald-400">💰 Tréso actuelle</span>
                                                <span class="font-black text-white">{{ formatMAD(tresoActuelleMois) }}</span>
                                            </div>
                                            <div class="flex justify-between gap-3">
                                                <span class="text-orange-400">➖ Reste à payer exigible</span>
                                                <span class="font-black text-white">− {{ formatMAD(resteAPayerIncompressible) }}</span>
                                            </div>
                                            <div :class="['flex justify-between gap-3 border-t border-slate-700 pt-1.5 mt-1.5 font-black', cashDispoPourConso >= 0 ? 'text-blue-300' : 'text-red-300']">
                                                <span>= Disponible conso</span>
                                                <span>{{ formatMAD(cashDispoPourConso) }}</span>
                                            </div>
                                            <div v-if="budgetSemaineReel !== null" class="flex justify-between gap-3 border-t border-slate-700 pt-1.5 mt-1.5">
                                                <span class="text-amber-400">📅 Budget / semaine</span>
                                                <span class="font-black text-amber-300">{{ formatMAD(budgetSemaineReel) }}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div><!-- /KPI Grid -->`;

const NEW_KPI_BLOCK = `<!-- ⏳ v22.50 Jauge Cycle de Paie -->
                        <div class="mb-4 bg-slate-800/60 rounded-2xl border border-slate-700 p-4">
                            <div class="flex items-center justify-between mb-2.5">
                                <div class="text-left">
                                    <p class="text-[9px] font-black uppercase tracking-widest text-slate-400">📅 Dernière paie</p>
                                    <p class="text-white text-xs font-black mt-0.5">{{ dernierePaieLabel }}</p>
                                </div>
                                <div class="text-center">
                                    <p :class="['text-xl font-black', joursRestantsAvantPaie <= 3 ? 'text-red-400' : joursRestantsAvantPaie <= 7 ? 'text-amber-400' : 'text-emerald-400']">⏳ J−{{ joursRestantsAvantPaie }}</p>
                                    <p class="text-slate-500 text-[9px] font-bold">{{ budgetSemaineReel !== null ? formatMAD(budgetSemaineReel) + \` / sem\` : \`\` }}</p>
                                </div>
                                <div class="text-right">
                                    <p class="text-[9px] font-black uppercase tracking-widest text-slate-400">Prochaine paie 📅</p>
                                    <p class="text-white text-xs font-black mt-0.5">{{ prochainePaieLabel }}</p>
                                </div>
                            </div>
                            <div class="w-full bg-slate-700 rounded-full h-2.5 overflow-hidden">
                                <div :style="{ width: progressCyclePaie + '%' }" :class="['h-full rounded-full transition-all duration-700', progressCyclePaie < 50 ? 'bg-emerald-500' : progressCyclePaie < 80 ? 'bg-amber-400' : 'bg-red-500']"></div>
                            </div>
                            <div class="flex justify-between text-[9px] text-slate-500 mt-1.5 font-bold">
                                <span>{{ joursDepuisDernierePaie }}j écoulés</span>
                                <span>{{ progressCyclePaie }}% du cycle</span>
                                <span>{{ joursRestantsAvantPaie }}j restants</span>
                            </div>
                        </div>

                        <!-- KPI Grid 3 colonnes v22.50 -->
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">

                            <!-- KPI 1 : Trésorerie Courante (compte courant uniquement) -->
                            <div class="relative group cursor-default">
                                <div :class="['p-4 rounded-2xl border text-center transition-all', tresoActuelleCourante >= 0 ? 'bg-emerald-900/20 border-emerald-700 group-hover:border-emerald-500' : 'bg-red-900/20 border-red-700 group-hover:border-red-500']">
                                    <p class="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">💰 Tréso Courante</p>
                                    <p :class="['text-2xl font-black tracking-tighter', tresoActuelleCourante >= 0 ? 'text-emerald-400' : 'text-red-400']">{{ formatMAD(tresoActuelleCourante) }}</p>
                                    <p class="text-[9px] text-gray-500 mt-1">Compte courant uniquement</p>
                                </div>
                                <div class="absolute top-full left-0 right-0 mt-1.5 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                    <div class="w-3 h-3 bg-slate-950 border-t border-l border-slate-600 rotate-45 mx-auto -mb-[7px] relative z-10"></div>
                                    <div class="bg-slate-950 border border-slate-600 rounded-xl shadow-2xl p-3.5 text-left text-[11px]">
                                        <p class="font-black uppercase tracking-widest text-slate-300 mb-2 text-[10px]">🔍 Trésorerie Courant</p>
                                        <div class="space-y-1.5">
                                            <p class="text-slate-400 text-[10px]">Revenus (dest. courant) encaissés<br/>moins charges (src. courant) payées</p>
                                            <div :class="['flex justify-between gap-3 border-t border-slate-700 pt-1.5 mt-1.5 font-black', tresoActuelleCourante >= 0 ? 'text-emerald-300' : 'text-red-300']">
                                                <span>= Tréso compte courant</span>
                                                <span>{{ formatMAD(tresoActuelleCourante) }}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- KPI 2 : Reste à Payer — Tous comptes avec détail par compte -->
                            <div class="relative group cursor-default">
                                <div :class="['p-4 rounded-2xl border text-center transition-all', resteAPayerTotalGlobal > 0 ? 'bg-orange-900/20 border-orange-700 group-hover:border-orange-500' : 'bg-green-900/20 border-green-700 group-hover:border-green-500']">
                                    <p class="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">🔴 Reste à Payer</p>
                                    <p :class="['text-2xl font-black tracking-tighter', resteAPayerTotalGlobal > 0 ? 'text-orange-400' : 'text-green-400']">{{ formatMAD(resteAPayerTotalGlobal) }}</p>
                                    <p class="text-[9px] text-gray-500 mt-1">Tous comptes — non payés</p>
                                </div>
                                <div class="absolute top-full left-0 right-0 mt-1.5 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                    <div class="w-3 h-3 bg-slate-950 border-t border-l border-slate-600 rotate-45 mx-auto -mb-[7px] relative z-10"></div>
                                    <div class="bg-slate-950 border border-slate-600 rounded-xl shadow-2xl p-3.5 text-left text-[11px]">
                                        <p class="font-black uppercase tracking-widest text-slate-300 mb-2 text-[10px]">🔍 Détail par compte</p>
                                        <div class="space-y-1.5">
                                            <div v-if="!resteAPayerDetailParCompte.length" class="text-center text-emerald-400 py-1">✅ Tout est payé !</div>
                                            <div v-for="grp in resteAPayerDetailParCompte" :key="grp.key" class="flex justify-between gap-3">
                                                <span :class="grp.key === 'courant' ? 'text-orange-300' : 'text-violet-300'">{{ grp.icon }} {{ grp.label }}</span>
                                                <span class="font-black text-white">{{ formatMAD(grp.montant) }}</span>
                                            </div>
                                            <div v-if="resteAPayerDetailParCompte.length > 1" class="flex justify-between gap-3 border-t border-slate-700 pt-1.5 mt-1.5 font-black text-orange-300">
                                                <span>= Total tous comptes</span>
                                                <span>{{ formatMAD(resteAPayerTotalGlobal) }}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- KPI 3 : Budget Conso courant (tréso courant − obligations courant) -->
                            <div class="relative group cursor-default">
                                <div :class="['p-4 rounded-2xl border text-center transition-all', cashDispoPourConso >= 0 ? 'bg-blue-900/20 border-blue-700 group-hover:border-blue-500' : 'bg-red-900/20 border-red-700 group-hover:border-red-500']">
                                    <p class="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">📊 Budget Conso Restant</p>
                                    <p :class="['text-2xl font-black tracking-tighter', cashDispoPourConso >= 0 ? 'text-blue-400' : 'text-red-400']">{{ formatMAD(cashDispoPourConso) }}</p>
                                    <p class="text-[9px] text-gray-500 mt-1">
                                        <template v-if="budgetSemaineReel !== null">Soit {{ formatMAD(budgetSemaineReel) }} / sem · J−{{ joursRestantsAvantPaie }}</template>
                                        <template v-else>Configurer le jour de paie</template>
                                    </p>
                                </div>
                                <div class="absolute top-full left-0 right-0 mt-1.5 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                    <div class="w-3 h-3 bg-slate-950 border-t border-l border-slate-600 rotate-45 mx-auto -mb-[7px] relative z-10"></div>
                                    <div class="bg-slate-950 border border-slate-600 rounded-xl shadow-2xl p-3.5 text-left text-[11px]">
                                        <p class="font-black uppercase tracking-widest text-slate-300 mb-2 text-[10px]">🔍 Calcul Budget Conso</p>
                                        <div class="space-y-1.5">
                                            <div class="flex justify-between gap-3">
                                                <span class="text-emerald-400">💰 Tréso courant</span>
                                                <span class="font-black text-white">{{ formatMAD(tresoActuelleCourante) }}</span>
                                            </div>
                                            <div class="flex justify-between gap-3">
                                                <span class="text-orange-400">➖ Obligations courant</span>
                                                <span class="font-black text-white">− {{ formatMAD(resteAPayerCourant) }}</span>
                                            </div>
                                            <div :class="['flex justify-between gap-3 border-t border-slate-700 pt-1.5 mt-1.5 font-black', cashDispoPourConso >= 0 ? 'text-blue-300' : 'text-red-300']">
                                                <span>= Disponible conso</span>
                                                <span>{{ formatMAD(cashDispoPourConso) }}</span>
                                            </div>
                                            <div v-if="budgetSemaineReel !== null" class="flex justify-between gap-3 border-t border-slate-700 pt-1.5 mt-1.5">
                                                <span class="text-amber-400">📅 Budget / sem (J−{{ joursRestantsAvantPaie }})</span>
                                                <span class="font-black text-amber-300">{{ formatMAD(budgetSemaineReel) }}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div><!-- /KPI Grid v22.50 -->`;

replace('KPI Grid + Jauge Cycle de Paie', OLD_KPI_BLOCK, NEW_KPI_BLOCK);

/* ══════════════════════════════════════════════════════════
   Op 7 — Bump version
   ══════════════════════════════════════════════════════════ */
replace(
  'Bump version 22.50',
  `"22.41 Pilotage-Math"`,
  `"22.50 Pilotage-Pro"`
);

/* ══════════════════════════════════════════════════════════
   Vérifications finales
   ══════════════════════════════════════════════════════════ */
console.log('\n── Vérifications ──');

// 1. Aucune référence à resteAPayerParCompte dans le template
const rapTemplate = html.slice(html.indexOf('<div v-if="activeTab === \'pilotage\'"'), html.indexOf('</div><!-- /KPI Grid v22.50 -->') + 50);
const badRef = rapTemplate.indexOf('resteAPayerParCompte');
console.log(badRef === -1 ? '✅ Pas de resteAPayerParCompte dans le template KPI' : `⚠️ resteAPayerParCompte encore présent dans le template KPI @ ${badRef}`);

// 2. joursRestantsAvantPaie présent
const hasJours = html.indexOf('joursRestantsAvantPaie') !== -1;
console.log(hasJours ? '✅ joursRestantsAvantPaie présent' : '❌ joursRestantsAvantPaie absent');

// 3. resteAPayerDetailParCompte présent
const hasDetail = html.indexOf('resteAPayerDetailParCompte') !== -1;
console.log(hasDetail ? '✅ resteAPayerDetailParCompte présent' : '❌ resteAPayerDetailParCompte absent');

// 4. jourDePaie dans le template
const hasJourDePaie = html.indexOf('soldesInitiaux.jourDePaie') !== -1;
console.log(hasJourDePaie ? '✅ soldesInitiaux.jourDePaie présent dans template' : '❌ soldesInitiaux.jourDePaie absent');

// 5. Pas de :class cassé
const brokenClass = html.match(/:[a-z]+="[^"]+"\s*\?/g) || [];
const truelyBroken = brokenClass.filter(m => !m.includes(':class=') && !m.includes(':style='));
console.log(truelyBroken.length === 0 ? '✅ Aucun attribut :class cassé' : `⚠️ ${truelyBroken.length} :class potentiellement cassé`);

// 6. Équilibre des div
let depth = 0, issues = 0;
for (let i = 0; i < html.length; i++) {
  if (html[i] === '<') {
    if (html.slice(i, i + 4) === '<div') depth++;
    else if (html.slice(i, i + 6) === '</div>') { depth--; if (depth < 0) { issues++; depth = 0; } }
  }
}
console.log(depth === 0 && issues === 0 ? `✅ Équilibre div : depth=${depth}, issues=${issues}` : `⚠️ div depth=${depth}, issues=${issues}`);

writeFileSync(FILE, html, 'utf8');
console.log(`\n🎉 v22.50 Pilotage-Pro appliqué — ${opCount} opérations, ${Buffer.byteLength(html)} octets`);
