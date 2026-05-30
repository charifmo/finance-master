/**
 * refacto_pilotage_v2260.mjs
 * v22.60 Pilotage-Expert — Corrections ergonomiques
 *
 * Opérations :
 *  1. Normaliser CRLF → LF (évite les bugs de recherche sur Windows)
 *  2. Mettre à jour _cyclePaieInfo pour exposer prochainMois/prochainAn
 *  3. Ajouter computed moisBudgetaire + cycleLabel
 *  4. tresoActuelleCourante = somme des comptes.type === 'liquide' (solde réel)
 *  5. resteAPayerDetailParCompte : ajouter parNature {fix, var, choc, virement}
 *  6. Template : supprimer le grid sélecteur mois/année
 *  7. Template : afficher "Cycle Actuel" au-dessus de la jauge
 *  8. Template : mettre à jour le sous-titre du header pilotage
 *  9. Template : remplacer toutes les refs moisActuel/anneeActuelle dans la checklist
 * 10. Template : mettre à jour le tooltip KPI 1 (solde bancaire réel)
 * 11. Template : mettre à jour le tooltip KPI 2 (parNature par compte)
 * 12. Ajouter moisBudgetaire, cycleLabel au return statement
 * 13. Bump version 22.60 Pilotage-Expert
 */

import { readFileSync, writeFileSync } from 'fs';

const FILE = 'C:/Users/HP/finance/index.html';
let html = readFileSync(FILE, 'utf8');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// IMPORTANT : normaliser CRLF → LF
// (git autocrlf=true convertit LF→CRLF sur Windows)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
html = html.replace(/\r\n/g, '\n');
const crlfFixed = (html.indexOf('\r\n') === -1);
console.log(crlfFixed ? '✅ CRLF normalisé → LF' : '⚠️ CRLF encore présent');

let opCount = 0;

function replace(label, oldStr, newStr) {
  const idx = html.indexOf(oldStr);
  if (idx === -1) {
    console.error(`❌ [Op ${opCount + 1}] "${label}" — chaîne introuvable`);
    console.error('   Premier 120c :', JSON.stringify(oldStr.slice(0, 120)));
    process.exit(1);
  }
  const count = (html.split(oldStr).length - 1);
  if (count > 1) {
    console.error(`❌ [Op ${opCount + 1}] "${label}" — ${count} occurrences (ambigu)`);
    process.exit(1);
  }
  html = html.slice(0, idx) + newStr + html.slice(idx + oldStr.length);
  opCount++;
  console.log(`✅ [Op ${opCount}] ${label}`);
}

/* ══════════════════════════════════════════════════════════
   Op 1 — Mettre à jour _cyclePaieInfo : exposer prochainMois/prochainAn/dernierMois/dernierAn
   ══════════════════════════════════════════════════════════ */
replace(
  '_cyclePaieInfo : exposer prochainMois et dernierMois',
  `                        const mois = soldesInitiaux.value.moisActuel || (today.getMonth() + 1);
                        const an = soldesInitiaux.value.anneeActuelle || today.getFullYear();`,
  `                        const mois = today.getMonth() + 1;
                        const an = today.getFullYear();`
);

replace(
  '_cyclePaieInfo : ajouter prochainMois/dernierMois au return',
  `                        return {
                            joursAvant,
                            joursDepuis,
                            progress,
                            dernierePaieLabel: jour + ' ' + moisAbbr[dernierMois],
                            prochainePaieLabel: jour + ' ' + moisAbbr[prochainMois],
                        };`,
  `                        const moisNomsFr = ['','janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
                        const jourProchaineM1 = new Date(prochainAn, prochainMois - 1, jour - 1);
                        const labelFin = (jourProchaineM1.getDate()) + ' ' + moisNomsFr[jourProchaineM1.getMonth() + 1].slice(0,3).replace(/^(.)/, c => c.toUpperCase());
                        const labelDeb = jour + ' ' + moisNomsFr[dernierMois].slice(0,3).replace(/^(.)/, c => c.toUpperCase());
                        return {
                            joursAvant,
                            joursDepuis,
                            progress,
                            dernierePaieLabel: jour + ' ' + moisAbbr[dernierMois],
                            prochainePaieLabel: jour + ' ' + moisAbbr[prochainMois],
                            prochainMois,
                            prochainAn,
                            dernierMois,
                            dernierAn,
                            cycleDebLabel: labelDeb,
                            cycleFinLabel: labelFin,
                        };`
);

/* ══════════════════════════════════════════════════════════
   Op 2 — Ajouter moisBudgetaire + cycleLabel après prochainePaieLabel
   ══════════════════════════════════════════════════════════ */
replace(
  'Ajouter computed moisBudgetaire + cycleLabel',
  `                    const joursRestantsAvantPaie = computed(() => _cyclePaieInfo.value.joursAvant);`,
  `                    // v22.60 — Mois budgétaire : mois financé par le cycle actuel
                    const moisBudgetaire = computed(() => ({
                        mois: _cyclePaieInfo.value.prochainMois,
                        an: _cyclePaieInfo.value.prochainAn,
                    }));
                    // Label du cycle actuel ex: "27 Mai → 26 Juin"
                    const cycleLabel = computed(() => {
                        const info = _cyclePaieInfo.value;
                        return info.cycleDebLabel + ' → ' + info.cycleFinLabel;
                    });

                    const joursRestantsAvantPaie = computed(() => _cyclePaieInfo.value.joursAvant);`
);

/* ══════════════════════════════════════════════════════════
   Op 3 — tresoActuelleCourante : solde réel des comptes liquides
   ══════════════════════════════════════════════════════════ */
replace(
  'tresoActuelleCourante → solde réel comptes liquides',
  `                    // ─── v22.50 Trésorerie du Compte Courant uniquement ──────────────────
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
                    });`,
  `                    // ─── v22.60 Trésorerie réelle = somme des soldes comptes liquides ───
                    const tresoActuelleCourante = computed(() => {
                        calculationTick.value;
                        const liquides = (comptes.value || []).filter(c => c.type === 'liquide');
                        if (liquides.length === 0) {
                            // Fallback : solde courant de soldesInitiaux si aucun compte configuré
                            return Number(soldesInitiaux.value.courant || 0);
                        }
                        return liquides.reduce((sum, c) => sum + Number(c.solde || 0), 0);
                    });`
);

/* ══════════════════════════════════════════════════════════
   Op 4 — resteAPayerDetailParCompte : ajouter moisBudgetaire + parNature
   ══════════════════════════════════════════════════════════ */
replace(
  'resteAPayerDetailParCompte → moisBudgetaire + parNature',
  `                    // ─── v22.50 Détail des charges restantes, groupées par compte source ─
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
                        };`,
  `                    // ─── v22.60 Détail des charges restantes : moisBudgetaire + parNature ─
                    const resteAPayerDetailParCompte = computed(() => {
                        calculationTick.value;
                        const mb = moisBudgetaire.value;
                        const an = mb.an;
                        const mois = mb.mois;
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
                                groupsMap[key] = { key, icon, label, montant: 0, items: [],
                                    parNature: { fix: 0, var: 0, choc: 0, virement: 0 } };
                            }
                            return groupsMap[key];
                        };`
);

// Now add parNature tracking inside the group additions
replace(
  'resteAPayerDetailParCompte → parNature fixes',
  `                        // Charges fixes non payées
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
                        });`,
  `                        // Charges fixes non payées
                        Object.values(dActuelle.chargesFixes || {}).forEach(f => {
                            const due = getDueFixe(f, an);
                            if (due > 0 && !isItemPaid(f, due)) {
                                const grp = getOrCreate(f.sourceCompte || 'courant');
                                grp.montant += due; grp.parNature.fix += due;
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
                                        grp.montant += m; grp.parNature.var += m;
                                        grp.items.push({ label: f.nom || cat.label || '?', montant: m, type: 'var' });
                                    }
                                });
                            } else {
                                const m = Number(cat.valeur || 0);
                                if (m > 0) {
                                    const grp = getOrCreate(src);
                                    grp.montant += m; grp.parNature.var += m;
                                    grp.items.push({ label: cat.label || '?', montant: m, type: 'var' });
                                }
                            }
                        });
                        // Dépenses irrégulières du mois non payées
                        getDepensesMois(mois, an).forEach(dep => {
                            const m = Number(dep.montant || 0);
                            if (m > 0 && !isItemPaid(dep, m)) {
                                const grp = getOrCreate(dep.sourceCompte || 'courant');
                                grp.montant += m; grp.parNature.choc += m;
                                grp.items.push({ label: dep.nom || '?', montant: m, type: 'choc' });
                            }
                        });
                        // Virements sortants du mois non payés
                        getVirementsMois(mois, an).forEach(vir => {
                            const m = Number(vir.montant || 0);
                            if (m > 0 && !isItemPaid(vir, m)) {
                                const grp = getOrCreate(vir.sourceCompte || 'courant');
                                grp.montant += m; grp.parNature.virement += m;
                                grp.items.push({ label: vir.label || vir.nom || '?', montant: m, type: 'virement' });
                            }
                        });`
);

/* ══════════════════════════════════════════════════════════
   Op 5 — Return statement : ajouter moisBudgetaire + cycleLabel
   ══════════════════════════════════════════════════════════ */
replace(
  'Return : ajouter moisBudgetaire + cycleLabel',
  `resteAPayerDetailParCompte, resteAPayerCourant, resteAPayerTotalGlobal, tresoActuelleCourante, jourDePaie, joursRestantsAvantPaie, joursDepuisDernierePaie, progressCyclePaie, dernierePaieLabel, prochainePaieLabel, cashDispoPourConso, budgetSemaineReel,`,
  `resteAPayerDetailParCompte, resteAPayerCourant, resteAPayerTotalGlobal, tresoActuelleCourante, jourDePaie, moisBudgetaire, cycleLabel, joursRestantsAvantPaie, joursDepuisDernierePaie, progressCyclePaie, dernierePaieLabel, prochainePaieLabel, cashDispoPourConso, budgetSemaineReel,`
);

/* ══════════════════════════════════════════════════════════
   Op 6 — Template : supprimer le grid sélecteur mois/année
   ══════════════════════════════════════════════════════════ */
replace(
  'Supprimer grid mois/année + garder seulement jourDePaie',
  `                        <!-- Sélecteurs date + semaines -->
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700 text-center flex flex-col justify-center">
                                <label class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-3 block">Aujourd'hui, nous sommes en</label>
                                <div class="flex gap-2">
                                    <select v-model.number="soldesInitiaux.moisActuel" @change="handleDataChange" class="flex-1 bg-slate-900 text-white font-bold text-sm p-3 rounded-xl outline-none cursor-pointer border border-slate-600 text-center">
                                        <option v-for="m in [1,2,3,4,5,6,7,8,9,10,11,12]" :value="m">{{ nomDuMois(m) }}</option>
                                    </select>
                                    <input type="number" v-model.number="soldesInitiaux.anneeActuelle" @input="handleDataChange" class="w-24 bg-slate-900 text-blue-300 font-black text-sm p-3 rounded-xl border border-slate-600 text-center outline-none"/>
                                </div>
                            </div>
                            <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700 text-center flex flex-col justify-center">
                                <label class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-3 block">📅 Jour de Paie</label>
                                <div class="flex items-center gap-2 justify-center">
                                    <span class="text-slate-400 text-sm font-bold">Le</span>
                                    <input type="number" min="1" max="31" v-model.number="soldesInitiaux.jourDePaie" @input="handleDataChange" class="w-20 bg-slate-900 text-blue-300 font-black text-xl p-3 rounded-xl border border-blue-700 text-center outline-none focus:border-blue-400"/>
                                    <span class="text-slate-400 text-sm font-bold">de chaque mois</span>
                                </div>
                                <p class="text-[10px] text-emerald-400 font-black mt-2 uppercase tracking-widest">⏳ J−{{ joursRestantsAvantPaie }} avant la prochaine paie</p>
                            </div>
                        </div>`,
  `                        <!-- v22.60 : Sélecteur réduit — jourDePaie seul -->
                        <div class="flex items-center gap-3 bg-slate-800/60 rounded-2xl border border-slate-700 px-5 py-4">
                            <span class="text-[10px] font-black uppercase tracking-widest text-slate-400 shrink-0">📅 Paie le</span>
                            <input type="number" min="1" max="31" v-model.number="soldesInitiaux.jourDePaie" @input="handleDataChange" class="w-16 bg-slate-900 text-blue-300 font-black text-lg p-2 rounded-xl border border-blue-700 text-center outline-none focus:border-blue-400"/>
                            <span class="text-[10px] font-black uppercase tracking-widest text-slate-400 shrink-0">de chaque mois</span>
                            <div class="ml-auto text-right">
                                <p class="text-[10px] font-black uppercase tracking-widest text-emerald-400">⏳ J−{{ joursRestantsAvantPaie }} avant la prochaine paie</p>
                                <p class="text-[9px] text-slate-500 mt-0.5 font-bold">Cycle : {{ cycleLabel }}</p>
                            </div>
                        </div>`
);

/* ══════════════════════════════════════════════════════════
   Op 7 — Template : mettre à jour le sous-titre du header
   ══════════════════════════════════════════════════════════ */
replace(
  'Header pilotage : sous-titre → cycleLabel',
  `<p class="text-sm text-gray-500 mt-0.5">Pointage des factures — <b>{{ nomDuMois(soldesInitiaux.moisActuel) }} {{ soldesInitiaux.anneeActuelle }}</b></p>`,
  `<p class="text-sm text-gray-500 mt-0.5">Cycle <b>{{ cycleLabel }}</b></p>`
);

/* ══════════════════════════════════════════════════════════
   Op 8 — Template : remplacer anneeActuelle dans la checklist revenues
   ══════════════════════════════════════════════════════════ */
// Check v-if guard
replace(
  'v-if guard pilotage checklist → moisBudgetaire.an',
  `<div v-if="anneeAffichage === soldesInitiaux.anneeActuelle" class="space-y-6">`,
  `<div v-if="anneeAffichage === moisBudgetaire.an" class="space-y-6">`
);

// Revenue list
replace(
  'Revenus list → moisBudgetaire.an',
  `<div v-for="(rev, key) in donneesAnnuelles[soldesInitiaux.anneeActuelle].revenus" :key="'rev_' + key"`,
  `<div v-for="(rev, key) in donneesAnnuelles[moisBudgetaire.an]?.revenus" :key="'rev_' + key"`
);

replace(
  'Revenus vide check → moisBudgetaire.an',
  `<div v-if="!donneesAnnuelles[soldesInitiaux.anneeActuelle] || !Object.keys(donneesAnnuelles[soldesInitiaux.anneeActuelle].revenus || {}).length"`,
  `<div v-if="!donneesAnnuelles[moisBudgetaire.an] || !Object.keys(donneesAnnuelles[moisBudgetaire.an]?.revenus || {}).length"`
);

// Checklist header title
replace(
  'Checklist title → cycleLabel',
  `<span class="text-sm font-black uppercase tracking-widest text-white">Checklist — {{ nomDuMois(soldesInitiaux.moisActuel) }} {{ soldesInitiaux.anneeActuelle }}</span>`,
  `<span class="text-sm font-black uppercase tracking-widest text-white">Checklist — {{ cycleLabel }}</span>`
);

// chargesFixes v-if guard
replace(
  'chargesFixes v-if → moisBudgetaire.an',
  `<div v-if="donneesAnnuelles[soldesInitiaux.anneeActuelle] && Object.keys(donneesAnnuelles[soldesInitiaux.anneeActuelle].chargesFixes).length > 0">`,
  `<div v-if="donneesAnnuelles[moisBudgetaire.an] && Object.keys(donneesAnnuelles[moisBudgetaire.an]?.chargesFixes || {}).length > 0">`
);

// chargesFixes v-for
replace(
  'chargesFixes v-for → moisBudgetaire.an',
  `<div v-for="(f, key) in donneesAnnuelles[soldesInitiaux.anneeActuelle].chargesFixes" :key="key" class="flex items-center justify-between p-3 bg-slate-900/90 rounded-xl group border border-slate-700 hover:border-orange-500 transition-all">`,
  `<div v-for="(f, key) in donneesAnnuelles[moisBudgetaire.an]?.chargesFixes" :key="key" class="flex items-center justify-between p-3 bg-slate-900/90 rounded-xl group border border-slate-700 hover:border-orange-500 transition-all">`
);

// getDueFixe calls in chargesFixes (checked/label/amount span — they all reference soldesInitiaux.anneeActuelle)
replace(
  'getDueFixe checked → moisBudgetaire.an',
  `:checked="isItemPaid(f, getDueFixe(f, soldesInitiaux.anneeActuelle))" @change="toggleItemPaid(f, getDueFixe(f, soldesInitiaux.anneeActuelle))" class="w-5 h-5 rounded border-slate-600 bg-slate-800 text-orange-500 focus:ring-orange-500 cursor-pointer"/>`,
  `:checked="isItemPaid(f, getDueFixe(f, moisBudgetaire.an))" @change="toggleItemPaid(f, getDueFixe(f, moisBudgetaire.an))" class="w-5 h-5 rounded border-slate-600 bg-slate-800 text-orange-500 focus:ring-orange-500 cursor-pointer"/>`
);

replace(
  'getDueFixe label class → moisBudgetaire.an',
  `isItemPaid(f, getDueFixe(f, soldesInitiaux.anneeActuelle)) ? 'text-slate-500 line-through' : 'text-slate-200 group-hover:text-orange-300']">{{ f.label }}</span>`,
  `isItemPaid(f, getDueFixe(f, moisBudgetaire.an)) ? 'text-slate-500 line-through' : 'text-slate-200 group-hover:text-orange-300']">{{ f.label }}</span>`
);

replace(
  'getDueFixe amount class → moisBudgetaire.an',
  `isItemPaid(f, getDueFixe(f, soldesInitiaux.anneeActuelle)) ? 'text-slate-600' : 'text-slate-400']">/ {{ formatMAD(getDueFixe(f, soldesInitiaux.anneeActuelle)).replace(' DH', '') }}</span>`,
  `isItemPaid(f, getDueFixe(f, moisBudgetaire.an)) ? 'text-slate-600' : 'text-slate-400']">/ {{ formatMAD(getDueFixe(f, moisBudgetaire.an)).replace(' DH', '') }}</span>`
);

// chargesVariables v-for
replace(
  'chargesVariables v-for → moisBudgetaire.an',
  `<div v-for="cat in Object.values(donneesAnnuelles[soldesInitiaux.anneeActuelle]?.chargesVariables || {}).filter(c => c.periode === 'mois')" :key="cat.label">`,
  `<div v-for="cat in Object.values(donneesAnnuelles[moisBudgetaire.an]?.chargesVariables || {}).filter(c => c.periode === 'mois')" :key="cat.label">`
);

// Flux Exceptionnels section
replace(
  'Flux exceptionnels → moisBudgetaire',
  `<div v-if="getDepensesMois(soldesInitiaux.moisActuel, soldesInitiaux.anneeActuelle).length > 0">
                                        <p class="text-[9px] text-red-400 font-black uppercase tracking-widest mb-2 border-b border-red-900/50 pb-1 mt-2">⚠️ Flux Exceptionnels de {{ nomDuMois(soldesInitiaux.moisActuel) }}</p>
                                        <div class="space-y-1.5">
                                            <div v-for="dep in getDepensesMois(soldesInitiaux.moisActuel, soldesInitiaux.anneeActuelle)"`,
  `<div v-if="getDepensesMois(moisBudgetaire.mois, moisBudgetaire.an).length > 0">
                                        <p class="text-[9px] text-red-400 font-black uppercase tracking-widest mb-2 border-b border-red-900/50 pb-1 mt-2">⚠️ Flux Exceptionnels — {{ cycleLabel }}</p>
                                        <div class="space-y-1.5">
                                            <div v-for="dep in getDepensesMois(moisBudgetaire.mois, moisBudgetaire.an)"`
);

// v-else guard (year warning)
replace(
  'v-else guard → moisBudgetaire.an',
  `<p class="text-sm font-bold text-yellow-800">Le pilotage au jour le jour (Checklist) n'est actif que pour l'année en cours ({{ soldesInitiaux.anneeActuelle }}).</p>
                        <button @click="anneeAffichage = soldesInitiaux.anneeActuelle"`,
  `<p class="text-sm font-bold text-yellow-800">Le pilotage au jour le jour (Checklist) n'est actif que pour l'année en cours ({{ moisBudgetaire.an }}).</p>
                        <button @click="anneeAffichage = moisBudgetaire.an"`
);

/* ══════════════════════════════════════════════════════════
   Op 9 — Template KPI 1 : Tooltip Solde Bancaire Réel
   ══════════════════════════════════════════════════════════ */
replace(
  'KPI 1 tooltip : solde bancaire réel',
  `                                    <div class="bg-slate-950 border border-slate-600 rounded-xl shadow-2xl p-3.5 text-left text-[11px]">
                                        <p class="font-black uppercase tracking-widest text-slate-300 mb-2 text-[10px]">🔍 Trésorerie Courant</p>
                                        <div class="space-y-1.5">
                                            <p class="text-slate-400 text-[10px]">Revenus (dest. courant) encaissés<br/>moins charges (src. courant) payées</p>
                                            <div :class="['flex justify-between gap-3 border-t border-slate-700 pt-1.5 mt-1.5 font-black', tresoActuelleCourante >= 0 ? 'text-emerald-300' : 'text-red-300']">
                                                <span>= Tréso compte courant</span>
                                                <span>{{ formatMAD(tresoActuelleCourante) }}</span>
                                            </div>
                                        </div>
                                    </div>`,
  `                                    <div class="bg-slate-950 border border-slate-600 rounded-xl shadow-2xl p-3.5 text-left text-[11px]">
                                        <p class="font-black uppercase tracking-widest text-slate-300 mb-2 text-[10px]">🏦 Solde Bancaire Réel</p>
                                        <div class="space-y-1.5">
                                            <template v-if="comptes.filter(c => c.type === 'liquide').length > 0">
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
                                            </template>
                                        </div>
                                    </div>`
);

/* ══════════════════════════════════════════════════════════
   Op 10 — Template KPI 2 : Tooltip avec ventilation par nature
   ══════════════════════════════════════════════════════════ */
replace(
  'KPI 2 tooltip : parNature par compte',
  `                                    <div class="bg-slate-950 border border-slate-600 rounded-xl shadow-2xl p-3.5 text-left text-[11px]">
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
                                    </div>`,
  `                                    <div class="bg-slate-950 border border-slate-600 rounded-xl shadow-2xl p-3.5 text-left text-[11px]">
                                        <p class="font-black uppercase tracking-widest text-slate-300 mb-2 text-[10px]">🔍 Détail par compte</p>
                                        <div class="space-y-2.5">
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
                                        </div>
                                    </div>`
);

/* ══════════════════════════════════════════════════════════
   Op 11 — Bump version
   ══════════════════════════════════════════════════════════ */
replace(
  'Bump version 22.60',
  `"22.50 Pilotage-Pro"`,
  `"22.60 Pilotage-Expert"`
);

/* ══════════════════════════════════════════════════════════
   Vérifications finales
   ══════════════════════════════════════════════════════════ */
console.log('\n── Vérifications ──');

const checks = [
  ['moisBudgetaire', 'computed moisBudgetaire'],
  ['cycleLabel', 'computed cycleLabel'],
  ['prochainMois,', 'prochainMois exposé dans _cyclePaieInfo'],
  ['parNature: { fix: 0', 'parNature dans resteAPayerDetailParCompte'],
  ['comptes.filter(c => c.type', 'comptes liquides dans KPI 1 tooltip'],
  ['grp.parNature.fix', 'parNature.fix dans KPI 2 tooltip'],
  ['↳ 🏢 Fixes', 'label Fixes dans KPI 2 tooltip'],
  ['Cycle Actuel', 'NON voulu'] // should NOT be in the file (we use cycleLabel instead)
];

checks.forEach(([str, label]) => {
  const found = html.indexOf(str) >= 0;
  if (label === 'NON voulu') {
    console.log(found ? `⚠️ Texte non voulu encore présent: ${str}` : `✅ ${label} absent (correct)`);
  } else {
    console.log(found ? `✅ ${label}` : `❌ ${label} ABSENT`);
  }
});

// Aucune ref moisActuel dans le bloc pilotage (après suppression)
const piloStart = html.indexOf('<div v-if="activeTab === \'pilotage\'"');
const piloEnd = html.indexOf('<!-- ══════════════════', piloStart);
const piloSection = html.slice(piloStart, piloEnd);
const moisActuelRefs = (piloSection.match(/soldesInitiaux\.moisActuel/g) || []).length;
const anneeActuelRefs = (piloSection.match(/soldesInitiaux\.anneeActuelle/g) || []).length;
console.log(moisActuelRefs === 0 ? '✅ Aucun soldesInitiaux.moisActuel dans le bloc pilotage' : `⚠️ ${moisActuelRefs} refs moisActuel restantes`);
console.log(anneeActuelRefs === 0 ? '✅ Aucun soldesInitiaux.anneeActuelle dans le bloc pilotage' : `⚠️ ${anneeActuelRefs} refs anneeActuelle restantes`);

// Équilibre div
let depth = 0, issues = 0;
for (let i = 0; i < html.length; i++) {
  if (html[i] === '<') {
    if (html.slice(i, i+4) === '<div') depth++;
    else if (html.slice(i, i+6) === '</div>') { depth--; if (depth < 0) { issues++; depth = 0; } }
  }
}
console.log(depth === 0 && issues <= 1 ? `✅ Équilibre div : depth=${depth}, issues=${issues} (≤1 normal)` : `⚠️ div depth=${depth}, issues=${issues}`);

writeFileSync(FILE, html, 'utf8');
console.log(`\n🎉 v22.60 Pilotage-Expert appliqué — ${opCount} opérations, ${Buffer.byteLength(html)} octets`);
