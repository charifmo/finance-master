/**
 * fix_macro_accounts_v2480.mjs
 * v24.80 Macro-Accounts
 *
 * CHANTIER 1 : NETTOYAGE UI (Budget Structurel)
 *   Op 1 : soldesInitiaux defaults — ajouter compteChargesFixes + compteChargesVariables
 *   Op 2 : chargesFixes — insérer sélecteur global en haut de section
 *   Op 3 : chargesFixes — supprimer select sourceCompte sur les sous-parties
 *   Op 4 : chargesFixes — supprimer div "Prélever sur" par item
 *   Op 5 : chargesVariables — insérer sélecteur global en haut de section
 *   Op 6 : chargesVariables — supprimer select sourceCompte sur les sous-parties
 *   Op 7 : chargesVariables — supprimer div "Prélever sur" par item
 *
 * CHANTIER 2 : ROUTAGE LOGIQUE
 *   Op 8  : journalHybride chargesFixes push — attacher sourceCompte macro
 *   Op 9  : journalHybride chargesVariables details push — attacher sourceCompte macro
 *   Op 10 : journalHybride chargesVariables non-details push — attacher sourceCompte macro
 *   Op 11 : resteAPayerDetailParCompte chargesFixes — f.sourceCompte → macro
 *   Op 12 : resteAPayerDetailParCompte chargesVariables — cat.sourceCompte → macro
 *   Op 13 : bilan chargesFixes ventilation — remplacer parts-routing par macro
 *   Op 14 : bilan chargesVariables ventilation — remplacer parts-routing par macro
 *   Op 15 : bilan chargesFixes restant — simplifier avec macro
 *   Op 16 : bilan chargesVariables restant — simplifier avec macro
 *
 *   Op 17 : Version bump → "24.80 Macro-Accounts"
 *   Op 18 : Changelog
 */

import { readFileSync, writeFileSync } from 'fs';

const FILE = 'C:/Users/HP/finance/index.html';
let html = readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n');

let opCount = 0;

function check(label, needle) {
    if (!html.includes(needle)) {
        console.error(`\n❌ ANCHOR NOT FOUND: ${label}`);
        console.error(`   Preview: ${JSON.stringify(needle.slice(0, 200))}`);
        process.exit(1);
    }
}

function replace(label, from, to) {
    check(label, from);
    const before = html;
    html = html.split(from).join(to);
    if (html === before) {
        console.error(`\n❌ NO CHANGE: ${label}`);
        process.exit(1);
    }
    opCount++;
    console.log(`✅ Op ${opCount} — ${label}`);
}

// ── Op 1 : soldesInitiaux defaults ────────────────────────────────────────────
replace(
    'Op1 - soldesInitiaux defaults compteChargesFixes + compteChargesVariables',
    `soldesInitiaux: { courant: 125000, urgence: 0, lt: 0, bourse: 0, moisActuel: new Date().getMonth() + 1, anneeActuelle: new Date().getFullYear(), salaireRecu: false, semainesRestantes: 3, jourDePaie: 27, decalagePaie: true, destinationSurplus: 'courant', categories: [] /* v22 P1 : référentiel stable */ },`,
    `soldesInitiaux: { courant: 125000, urgence: 0, lt: 0, bourse: 0, moisActuel: new Date().getMonth() + 1, anneeActuelle: new Date().getFullYear(), salaireRecu: false, semainesRestantes: 3, jourDePaie: 27, decalagePaie: true, destinationSurplus: 'courant', categories: [] /* v22 P1 : référentiel stable */, compteChargesFixes: 'courant', compteChargesVariables: 'courant' /* v24.80 Macro-Accounts */ },`
);

// ── Op 2 : chargesFixes — sélecteur global en haut ───────────────────────────
replace(
    'Op2 - chargesFixes global selector before v-for',
    `                        <p class="text-xs text-gray-500 italic mb-4">Pour signaler un paiement, rendez-vous dans la <b>Checklist Détaillée</b> de l'année en cours.</p>
                        <div v-for="(item, key) in donneesAnnuelles[anneeAffichage].chargesFixes" :key="key" class="mb-5 border-b border-gray-100 pb-4 last:border-0">`,
    `                        <p class="text-xs text-gray-500 italic mb-4">Pour signaler un paiement, rendez-vous dans la <b>Checklist Détaillée</b> de l'année en cours.</p>
                        <!-- v24.80 : Sélecteur global compte charges fixes -->
                        <div class="flex items-center gap-3 mb-5 p-3 bg-orange-50 rounded-xl border border-orange-200">
                            <label class="text-[10px] font-black text-orange-700 uppercase tracking-widest whitespace-nowrap">🏦 Prélever toutes les charges fixes sur :</label>
                            <select v-model="soldesInitiaux.compteChargesFixes" @change="handleDataChange" class="flex-1 p-2 text-xs font-bold border border-orange-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-orange-400">
                                <option value="courant">💳 Compte Courant</option>
                                <optgroup label="── Comptes bancaires ──">
                                    <option v-for="c in comptesSelectOptions" :key="'gcf_'+c.id" :value="'cpt_'+c.id">{{ c.icone }} {{ c.label }}</option>
                                </optgroup>
                                <optgroup label="── Objectifs épargne ──">
                                    <option v-for="ep in donneesAnnuelles[anneeAffichage].epargne" :key="'gcfe_'+ep.id" :value="'ep_'+ep.id">🎯 {{ ep.label }}</option>
                                </optgroup>
                            </select>
                        </div>
                        <div v-for="(item, key) in donneesAnnuelles[anneeAffichage].chargesFixes" :key="key" class="mb-5 border-b border-gray-100 pb-4 last:border-0">`
);

// ── Op 3 : chargesFixes — supprimer select sourceCompte sur les sous-parties ──
replace(
    'Op3 - chargesFixes remove per-part sourceCompte select',
    `                                    <select v-model="part.sourceCompte" @change="handleDataChange" class="text-[10px] font-bold border border-orange-200 rounded bg-orange-50 p-1.5 outline-none max-w-[120px]">
                                        <option value="courant">💳 Courant</option>
                                        <option v-for="c in comptesSelectOptions" :key="'pcf_'+c.id" :value="'cpt_'+c.id">{{ c.icone }} {{ c.label }}</option>
                                        <option v-for="ep in donneesAnnuelles[anneeAffichage].epargne" :key="'pcfe_'+ep.id" :value="'ep_'+ep.id">🎯 {{ ep.label }}</option>
                                    </select>
                                    <button @click="supprimerPart(item, pi)" class="text-red-400 hover:text-red-600 px-1.5 font-bold text-sm">✕</button>`,
    `                                    <button @click="supprimerPart(item, pi)" class="text-red-400 hover:text-red-600 px-1.5 font-bold text-sm">✕</button>`
);

// ── Op 4 : chargesFixes — supprimer div "Prélever sur" par item ───────────────
replace(
    'Op4 - chargesFixes remove per-item sourceCompte div',
    `                            <!-- v17.27 : Source (masqué si parts) -->
                            <div v-if="!item.parts || !item.parts.length" class="flex items-center gap-2 mt-2 mb-1">
                                <label class="text-[9px] font-black text-orange-700 uppercase tracking-widest whitespace-nowrap">← Prélever sur :</label>
                                <select v-model="item.sourceCompte" @change="handleDataChange" class="flex-1 p-1.5 text-xs font-bold border border-orange-200 rounded-lg bg-orange-50 outline-none focus:ring-2 focus:ring-orange-400">
                                    <option value="courant">💳 Compte Courant</option>
                                    <optgroup label="── Comptes bancaires ──">
                                        <option v-for="c in comptesSelectOptions" :key="'cf_'+c.id" :value="'cpt_' + c.id">{{ c.icone }} {{ c.label }}</option>
                                    </optgroup>
                                    <optgroup label="── Objectifs épargne ──">
                                        <option v-for="ep in donneesAnnuelles[anneeAffichage].epargne" :key="'cfe_'+ep.id" :value="'ep_' + ep.id">🎯 {{ ep.label }}</option>
                                    </optgroup>
                                </select>
                            </div>
                            <!-- v22.95 Cashflow-Timing`,
    `                            <!-- v22.95 Cashflow-Timing`
);

// ── Op 5 : chargesVariables — sélecteur global en haut ───────────────────────
replace(
    'Op5 - chargesVariables global selector before v-for',
    `                        <div class="cfo-collapsible-body">
                        <div v-for="(item, key) in donneesAnnuelles[anneeAffichage].chargesVariables" :key="key" class="mb-6 border-b border-gray-100 pb-5 last:border-0">`,
    `                        <div class="cfo-collapsible-body">
                        <!-- v24.80 : Sélecteur global compte charges variables -->
                        <div class="flex items-center gap-3 mb-5 p-3 bg-red-50 rounded-xl border border-red-200">
                            <label class="text-[10px] font-black text-red-700 uppercase tracking-widest whitespace-nowrap">🏦 Prélever toutes les charges variables sur :</label>
                            <select v-model="soldesInitiaux.compteChargesVariables" @change="handleDataChange" class="flex-1 p-2 text-xs font-bold border border-red-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-red-400">
                                <option value="courant">💳 Compte Courant</option>
                                <optgroup label="── Comptes bancaires ──">
                                    <option v-for="c in comptesSelectOptions" :key="'gcv_'+c.id" :value="'cpt_'+c.id">{{ c.icone }} {{ c.label }}</option>
                                </optgroup>
                                <optgroup label="── Objectifs épargne ──">
                                    <option v-for="ep in donneesAnnuelles[anneeAffichage].epargne" :key="'gcve_'+ep.id" :value="'ep_'+ep.id">🎯 {{ ep.label }}</option>
                                </optgroup>
                            </select>
                        </div>
                        <div v-for="(item, key) in donneesAnnuelles[anneeAffichage].chargesVariables" :key="key" class="mb-6 border-b border-gray-100 pb-5 last:border-0">`
);

// ── Op 6 : chargesVariables — supprimer select sourceCompte sur les sous-parties
replace(
    'Op6 - chargesVariables remove per-part sourceCompte select',
    `                                    <select v-model="part.sourceCompte" @change="handleDataChange" class="text-[10px] font-bold border border-red-200 rounded bg-red-50 p-1.5 outline-none max-w-[120px]">
                                        <option value="courant">💳 Courant</option>
                                        <option v-for="c in comptesSelectOptions" :key="'pcv_'+c.id" :value="'cpt_'+c.id">{{ c.icone }} {{ c.label }}</option>
                                        <option v-for="ep in donneesAnnuelles[anneeAffichage].epargne" :key="'pcve_'+ep.id" :value="'ep_'+ep.id">🎯 {{ ep.label }}</option>
                                    </select>
                                    <button @click="supprimerPart(item, pi)" class="text-red-400 hover:text-red-600 px-1.5 font-bold text-sm">✕</button>`,
    `                                    <button @click="supprimerPart(item, pi)" class="text-red-400 hover:text-red-600 px-1.5 font-bold text-sm">✕</button>`
);

// ── Op 7 : chargesVariables — supprimer div "Prélever sur" par item ───────────
replace(
    'Op7 - chargesVariables remove per-item sourceCompte div',
    `                            <!-- v17.27 : Source (masqué si parts) -->
                            <div v-if="!item.parts || !item.parts.length" class="flex items-center gap-2 mt-2 mb-1">
                                <label class="text-[9px] font-black text-red-700 uppercase tracking-widest whitespace-nowrap">← Prélever sur :</label>
                                <select v-model="item.sourceCompte" @change="handleDataChange" class="flex-1 p-1.5 text-xs font-bold border border-red-200 rounded-lg bg-red-50 outline-none focus:ring-2 focus:ring-red-400">
                                    <option value="courant">💳 Compte Courant</option>
                                    <optgroup label="── Comptes bancaires ──">
                                        <option v-for="c in comptesSelectOptions" :key="'cv_'+c.id" :value="'cpt_' + c.id">{{ c.icone }} {{ c.label }}</option>
                                    </optgroup>
                                    <optgroup label="── Objectifs épargne ──">
                                        <option v-for="ep in donneesAnnuelles[anneeAffichage].epargne" :key="'cve_'+ep.id" :value="'ep_' + ep.id">🎯 {{ ep.label }}</option>
                                    </optgroup>
                                </select>
                            </div>
                            <!-- v22.96 Cashflow-Global`,
    `                            <!-- v22.96 Cashflow-Global`
);

// ── Op 8 : journalHybride chargesFixes push — sourceCompte macro ──────────────
replace(
    'Op8 - journalHybride chargesFixes push sourceCompte macro',
    `                            (paid ? paidItems : unpaidItems).push({
                                libelle: f.label || 'Charge fixe',
                                montant: amt, type: 'debit',
                                jourPrevu: Number(f.jourPrevu || 10),
                                etat: paid ? 'realise' : 'prevu'
                            });`,
    `                            (paid ? paidItems : unpaidItems).push({
                                libelle: f.label || 'Charge fixe',
                                montant: amt, type: 'debit',
                                jourPrevu: Number(f.jourPrevu || 10),
                                etat: paid ? 'realise' : 'prevu',
                                sourceCompte: soldesInitiaux.value.compteChargesFixes || 'courant'
                            });`
);

// ── Op 9 : journalHybride chargesVariables details push — sourceCompte macro ──
replace(
    'Op9 - journalHybride chargesVariables details push sourceCompte macro',
    `                                    (paid ? paidItems : unpaidItems).push({
                                        libelle: (cv.label ? cv.label + ' · ' : '') + (d.label || d.nom || ''),
                                        montant: amt, type: 'debit',
                                        jourPrevu: 15,
                                        etat: paid ? 'realise' : 'prevu'
                                    });`,
    `                                    (paid ? paidItems : unpaidItems).push({
                                        libelle: (cv.label ? cv.label + ' · ' : '') + (d.label || d.nom || ''),
                                        montant: amt, type: 'debit',
                                        jourPrevu: 15,
                                        etat: paid ? 'realise' : 'prevu',
                                        sourceCompte: soldesInitiaux.value.compteChargesVariables || 'courant'
                                    });`
);

// ── Op 10 : journalHybride chargesVariables non-details push — sourceCompte macro
replace(
    'Op10 - journalHybride chargesVariables non-details push sourceCompte macro',
    `                                (paid ? paidItems : unpaidItems).push({
                                    libelle: cv.label || 'Variable',
                                    montant: amt, type: 'debit',
                                    jourPrevu: 15,
                                    etat: paid ? 'realise' : 'prevu'
                                });`,
    `                                (paid ? paidItems : unpaidItems).push({
                                    libelle: cv.label || 'Variable',
                                    montant: amt, type: 'debit',
                                    jourPrevu: 15,
                                    etat: paid ? 'realise' : 'prevu',
                                    sourceCompte: soldesInitiaux.value.compteChargesVariables || 'courant'
                                });`
);

// ── Op 11 : resteAPayerDetailParCompte chargesFixes — macro ───────────────────
replace(
    'Op11 - resteAPayerDetailParCompte chargesFixes macro routing',
    `                            if (due > 0 && !isItemPaid(f, due) && ok(f)) {
                                const grp = getOrCreate(f.sourceCompte || 'courant');`,
    `                            if (due > 0 && !isItemPaid(f, due) && ok(f)) {
                                const grp = getOrCreate(soldesInitiaux.value.compteChargesFixes || 'courant');`
);

// ── Op 12 : resteAPayerDetailParCompte chargesVariables — macro ───────────────
replace(
    'Op12 - resteAPayerDetailParCompte chargesVariables macro routing',
    `                        Object.values(dActuelle.chargesVariables || {}).filter(c => c?.periode === 'mois').forEach(cat => {
                            const src = cat.sourceCompte || 'courant';`,
    `                        Object.values(dActuelle.chargesVariables || {}).filter(c => c?.periode === 'mois').forEach(cat => {
                            const src = soldesInitiaux.value.compteChargesVariables || 'courant';`
);

// ── Op 13 : bilan chargesFixes ventilation — macro ────────────────────────────
replace(
    'Op13 - bilan chargesFixes ventilation replace parts-routing with macro',
    `                                // v17.29 : parts-aware routing
                                if (f.parts && f.parts.length > 0) {
                                    const partsSum = f.parts.reduce((s, p) => s + Number(p.valeur || 0), 0);
                                    const ratio = partsSum > 0 ? effVal / partsSum : 0;
                                    f.parts.forEach(p => {
                                        const pv = Number(p.valeur || 0) * ratio;
                                        const src = _normKey(p.sourceCompte);
                                        if (src === courantCptKey || src === 'courant') { fixCourant += pv; }
                                        else { fixParCompte[src] = (fixParCompte[src] || 0) + pv; }
                                    });
                                } else {
                                    const src = _normKey((f || {}).sourceCompte);
                                    if (src === courantCptKey || src === 'courant') { fixCourant += effVal; }
                                    else { fixParCompte[src] = (fixParCompte[src] || 0) + effVal; }
                                }
                            });
                            const fixMois = fixCourant + Object.values(fixParCompte).reduce((s, v) => s + v, 0);`,
    `                                // v24.80 : routing macro-compte (ignore sourceCompte par ligne)
                                const _sfx = _normKey(soldesInitiaux.value.compteChargesFixes || 'courant');
                                if (_sfx === courantCptKey || _sfx === 'courant') { fixCourant += effVal; }
                                else { fixParCompte[_sfx] = (fixParCompte[_sfx] || 0) + effVal; }
                            });
                            const fixMois = fixCourant + Object.values(fixParCompte).reduce((s, v) => s + v, 0);`
);

// ── Op 14 : bilan chargesVariables ventilation — macro ────────────────────────
replace(
    'Op14 - bilan chargesVariables ventilation replace parts-routing with macro',
    `                                // v17.29 : parts-aware routing
                                if (curr.parts && curr.parts.length > 0) {
                                    const partsSum = curr.parts.reduce((s, p) => s + Number(p.valeur || 0), 0);
                                    const ratio = partsSum > 0 ? effVal / partsSum : 0;
                                    curr.parts.forEach(p => {
                                        const pv = Number(p.valeur || 0) * ratio;
                                        const src = _normKey(p.sourceCompte);
                                        if (src === courantCptKey || src === 'courant') { varCourant += pv; }
                                        else { varParCompte[src] = (varParCompte[src] || 0) + pv; }
                                    });
                                } else {
                                    const src = _normKey((curr || {}).sourceCompte);
                                    if (src === courantCptKey || src === 'courant') { varCourant += effVal; }
                                    else { varParCompte[src] = (varParCompte[src] || 0) + effVal; }
                                }
                            });
                            const totVarBase = varCourant + Object.values(varParCompte).reduce((s, v) => s + v, 0);`,
    `                                // v24.80 : routing macro-compte (ignore sourceCompte par ligne)
                                const _svar = _normKey(soldesInitiaux.value.compteChargesVariables || 'courant');
                                if (_svar === courantCptKey || _svar === 'courant') { varCourant += effVal; }
                                else { varParCompte[_svar] = (varParCompte[_svar] || 0) + effVal; }
                            });
                            const totVarBase = varCourant + Object.values(varParCompte).reduce((s, v) => s + v, 0);`
);

// ── Op 15 : bilan chargesFixes restant — macro ────────────────────────────────
replace(
    'Op15 - bilan chargesFixes restant simplify with macro',
    `                                Object.values(dataAnnee.chargesFixes || {}).forEach(f => {
                                    let due = getDueFixe(f, aNum);
                                    let remaining = Math.max(0, due - getPaidAmount(f, due));
                                    if (remaining <= 0) return;
                                    if (f.parts && f.parts.length > 0) {
                                        const partsSum = f.parts.reduce((s, p) => s + Number(p.valeur || 0), 0);
                                        const ratio = partsSum > 0 ? remaining / partsSum : 0;
                                        f.parts.forEach(p => {
                                            const pv = Number(p.valeur || 0) * ratio;
                                            const src = p.sourceCompte || 'courant';
                                            if (src === 'courant') { fRestCourant += pv; }
                                            else { fRestParCompte[src] = (fRestParCompte[src] || 0) + pv; }
                                        });
                                    } else {
                                        const src = (f || {}).sourceCompte || 'courant';
                                        if (src === 'courant') { fRestCourant += remaining; }
                                        else { fRestParCompte[src] = (fRestParCompte[src] || 0) + remaining; }
                                    }
                                });`,
    `                                Object.values(dataAnnee.chargesFixes || {}).forEach(f => {
                                    let due = getDueFixe(f, aNum);
                                    let remaining = Math.max(0, due - getPaidAmount(f, due));
                                    if (remaining <= 0) return;
                                    // v24.80 : routing macro-compte
                                    const src = soldesInitiaux.value.compteChargesFixes || 'courant';
                                    if (src === 'courant') { fRestCourant += remaining; }
                                    else { fRestParCompte[src] = (fRestParCompte[src] || 0) + remaining; }
                                });`
);

// ── Op 16 : bilan chargesVariables restant — macro ────────────────────────────
replace(
    'Op16 - bilan chargesVariables restant simplify with macro',
    `                                Object.values(dataAnnee.chargesVariables || {}).forEach(curr => {
                                    let remaining;
                                    if (curr?.periode === 'semaine') {
                                        remaining = Number(curr?.valeur || 0) * semRest;
                                    } else {
                                        if (curr?.details && curr.details.length > 0) {
                                            remaining = curr.details.reduce((sum, d) => sum + Math.max(0, Number(d.montant || 0) - getPaidAmount(d, Number(d.montant || 0))), 0);
                                        } else {
                                            remaining = Number(curr?.valeur || 0) * rConso;
                                        }
                                    }
                                    if (remaining <= 0) return;
                                    if (curr.parts && curr.parts.length > 0) {
                                        const partsSum = curr.parts.reduce((s, p) => s + Number(p.valeur || 0), 0);
                                        const ratio = partsSum > 0 ? remaining / partsSum : 0;
                                        curr.parts.forEach(p => {
                                            const pv = Number(p.valeur || 0) * ratio;
                                            const src = p.sourceCompte || 'courant';
                                            if (src === 'courant') { vRestCourant += pv; }
                                            else { vRestParCompte[src] = (vRestParCompte[src] || 0) + pv; }
                                        });
                                    } else {
                                        const src = (curr || {}).sourceCompte || 'courant';
                                        if (src === 'courant') { vRestCourant += remaining; }
                                        else { vRestParCompte[src] = (vRestParCompte[src] || 0) + remaining; }
                                    }
                                });`,
    `                                Object.values(dataAnnee.chargesVariables || {}).forEach(curr => {
                                    let remaining;
                                    if (curr?.periode === 'semaine') {
                                        remaining = Number(curr?.valeur || 0) * semRest;
                                    } else {
                                        if (curr?.details && curr.details.length > 0) {
                                            remaining = curr.details.reduce((sum, d) => sum + Math.max(0, Number(d.montant || 0) - getPaidAmount(d, Number(d.montant || 0))), 0);
                                        } else {
                                            remaining = Number(curr?.valeur || 0) * rConso;
                                        }
                                    }
                                    if (remaining <= 0) return;
                                    // v24.80 : routing macro-compte
                                    const src = soldesInitiaux.value.compteChargesVariables || 'courant';
                                    if (src === 'courant') { vRestCourant += remaining; }
                                    else { vRestParCompte[src] = (vRestParCompte[src] || 0) + remaining; }
                                });`
);

// ── Op 17 : Version bump ──────────────────────────────────────────────────────
replace(
    'Op17 - Version bump',
    `const CURRENT_VERSION = "24.61 Relevé-PerCompte";`,
    `const CURRENT_VERSION = "24.80 Macro-Accounts";`
);

// ── Op 18 : Changelog ─────────────────────────────────────────────────────────
replace(
    'Op18 - Changelog entry v24.80',
    `const CHANGELOG = [`,
    `const CHANGELOG = [
        { version: "24.80 Macro-Accounts", date: "2026-05-30", changes: [
            "CHANTIER 1 : Budget Structurel — suppression des sélecteurs sourceCompte par ligne (chargesFixes + chargesVariables, items et sous-parties)",
            "CHANTIER 1 : Ajout d'un sélecteur global 'Prélever sur' en haut de chaque section (Charges Fixes + Charges Variables)",
            "CHANTIER 2 : journalHybride chargesFixes/chargesVariables push — sourceCompte attaché via macro soldesInitiaux.compteChargesFixes/Variables",
            "CHANTIER 2 : resteAPayerDetailParCompte — routing via macro (plus de f.sourceCompte / cat.sourceCompte par ligne)",
            "CHANTIER 2 : bilan ventilation chargesFixes/chargesVariables — parts-routing supprimé, routing unifié via _sfx/_svar macro",
            "CHANTIER 2 : bilan restant chargesFixes/chargesVariables — simplification avec macro",
            "CHANTIER 3 : soldesInitiaux defaults — compteChargesFixes: 'courant', compteChargesVariables: 'courant' ajoutés (migration transparente)"
        ] },`
);

// ── Écriture ──────────────────────────────────────────────────────────────────
writeFileSync(FILE, html.replace(/\n/g, '\r\n'), 'utf8');
console.log(`\n🎉 v24.80 Macro-Accounts — ${opCount} opérations appliquées !`);
