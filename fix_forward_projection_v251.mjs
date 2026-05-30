/**
 * fix_forward_projection_v251.mjs
 * v25.1 Forward-Projection
 *
 * Op 1 : Réécriture de journalHybridePourReleve en moteur "Forward-Only"
 *         (T0 = solde réel, contenu = flux paye:false du cycle courant triés par jour)
 * Op 2 : releveProjectionLabel computed ("26 [Mois]")
 * Op 3 : Inline template — supprime filtres temporels, ajoute titre projection
 * Op 4 : Modal template — supprime filtres temporels, ajoute titre projection
 * Op 5 : Footer (inline + modal) → "🏁 Atterrissage Projeté"
 * Op 6 : Ligne initiale (inline + modal) → masque "J.null"
 * Op 7 : Expose releveProjectionLabel dans le return
 * Op 8 : Version bump + Changelog
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

// ── Op 1 : Réécriture du moteur journalHybridePourReleve ──────────────────────
const OLD_ENGINE = `                    const journalHybridePourReleve = computed(() => {
                        calculationTick.value;
                        // Routing v24.60 : cycle passé → clos | per-account → bilanJournal | default → hybrid
                        const _rFiltres = releveComptesFiltres.value;
                        const _rJ = bilanJournal.value;
                        const _rCpt = (comptes.value || []).find(c => c.type === 'courant' || c.type === 'liquide');
                        const _rCourantKey = _rCpt ? 'cpt_' + _rCpt.id : Object.keys(_rJ)[0];
                        if (releveActiveCycle.value) {
                            const [_rVM, _rVA] = releveActiveCycle.value.split('-').map(Number);
                            if (_rVA < moisBudgetaire.value.an || (_rVA === moisBudgetaire.value.an && _rVM < moisBudgetaire.value.mois))
                                return { entries: [], soldeAtterrissage: 0, cycleClos: true };
                        }
                        if (_rFiltres.length === 1 && _rFiltres[0] !== _rCourantKey) {
                            const _rRaw = (_rJ[_rFiltres[0]] || []).filter(e => e.type === 'initial' || Number(e.montant || 0) !== 0);
                            return { entries: _rRaw, soldeAtterrissage: _rRaw.length ? Number((_rRaw[_rRaw.length - 1]).soldeApres || 0) : 0 };
                        }
                        // Compte Courant sélectionné → journal hybride filtré (items courant seulement)
                        if (_rFiltres.length === 1 && _rFiltres[0] === _rCourantKey) {
                            const _rBase = journalHybride.value;
                            const _rFiltered = [];
                            // v24.90 : solde initial = tresoActuelleCourante (solde réel, positif)
                            const _rTreso = tresoActuelleCourante.value;
                            let _rSolde = _rTreso;
                            _rBase.entries.forEach(_re => {
                                if (_re.type === 'initial') { _rFiltered.push({..._re, soldeApres: _rTreso}); return; }
                                if (_re.type === 'separator') { _rSolde = _re.soldeApres; _rFiltered.push({..._re}); return; }
                                if ((_re.sourceCompte || 'courant') !== 'courant') return;
                                _rSolde = Math.round((_rSolde + (_re.type === 'credit' ? _re.montant : -_re.montant)) * 100) / 100;
                                _rFiltered.push({..._re, soldeApres: _rSolde});
                            });
                            return { entries: _rFiltered, soldeAtterrissage: _rSolde };
                        }
                        if (!releveActiveCycle.value) return journalHybride.value;
                        const [mStr, aStr] = releveActiveCycle.value.split('-');
                        const mois = Number(mStr), an = Number(aStr);
                        const dAnnee = donneesAnnuelles.value[an];
                        const jdp = Number((soldesInitiaux.value || {}).jourDePaie) || 27;
                        if (!dAnnee) return { entries: [], soldeAtterrissage: 0 };

                        // Solde d'ouverture : dernier soldeApres avant ce mois dans bilanJournal
                        const moisNoms = ['','Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
                        const j = bilanJournal.value;
                        const courantCpt = (comptes.value || []).find(c => c.type === 'courant' || c.type === 'liquide');
                        const courantKey = courantCpt ? 'cpt_' + courantCpt.id : Object.keys(j)[0];
                        let soldeInit = 0;
                        if (courantKey && j[courantKey]) {
                            for (const e of j[courantKey]) {
                                if (e.type === 'initial') { soldeInit = e.soldeApres; continue; }
                                if (!e.mois || e.mois === '—') continue;
                                const ep = e.mois.split(' ');
                                const eAn = Number(ep[1] || 0);
                                const eMois = moisNoms.indexOf(ep[0]);
                                if (eAn > an || (eAn === an && eMois >= mois)) break;
                                soldeInit = e.soldeApres;
                            }
                        }

                        // ── Agrégats par grande catégorie (pas de détail individuel) ──
                        // Revenus
                        let totalRevDue = 0, totalRevPaid = 0;
                        Object.values(dAnnee.revenus || {}).forEach(r => {
                            const due = Number(r.base || 0);
                            totalRevDue += due;
                            totalRevPaid += getPaidAmount(r, due);
                        });

                        // Charges Fixes
                        let totalFixDue = 0, totalFixPaid = 0;
                        Object.values(dAnnee.chargesFixes || {}).forEach(f => {
                            const due = Number(f.valeur || 0);
                            totalFixDue += due;
                            totalFixPaid += getPaidAmount(f, due);
                        });

                        // Charges Variables
                        let totalVarDue = 0, totalVarPaid = 0;
                        Object.values(dAnnee.chargesVariables || {}).forEach(cv => {
                            if ((cv.details || []).length > 0) {
                                cv.details.forEach(d => { const due = Number(d.montant || 0); totalVarDue += due; totalVarPaid += getPaidAmount(d, due); });
                            } else {
                                const due = Number(cv.valeur || 0); totalVarDue += due; totalVarPaid += getPaidAmount(cv, due);
                            }
                        });

                        // Épargne
                        let totalEp = 0;
                        const _ep = dAnnee.epargne;
                        if (Array.isArray(_ep)) _ep.forEach(e => { totalEp += Number(e.valeur || 0); });
                        else Object.values(_ep || {}).forEach(e => { totalEp += Number(e.valeur || 0); });

                        // Dépenses exceptionnelles du mois
                        let totalIrreg = 0;
                        getDepensesMois(mois, an).forEach(dep => { totalIrreg += getPaidAmount(dep, Number(dep.montant || 0)) || Number(dep.montant || 0); });

                        const aggItems = [];
                        if (totalRevDue)  aggItems.push({ libelle: '💰 Revenus',                    montant: totalRevPaid  || totalRevDue,  type: 'credit', jourPrevu: jdp, etat: 'realise' });
                        if (totalFixDue)  aggItems.push({ libelle: '🔒 Charges Fixes',              montant: totalFixPaid  || totalFixDue,  type: 'debit',  jourPrevu: 10,  etat: 'realise' });
                        if (totalVarDue)  aggItems.push({ libelle: '📊 Charges Variables',          montant: totalVarPaid  || totalVarDue,  type: 'debit',  jourPrevu: 15,  etat: 'realise' });
                        if (totalEp)      aggItems.push({ libelle: '💎 Épargne',                    montant: totalEp,                       type: 'debit',  jourPrevu: jdp, etat: 'realise' });
                        if (totalIrreg)   aggItems.push({ libelle: '⚠️ Dépenses Exceptionnelles',   montant: totalIrreg,                    type: 'debit',  jourPrevu: 20,  etat: 'realise' });

                        aggItems.sort((a, b) => a.jourPrevu - b.jourPrevu);

                        const entries = [];
                        entries.push({ type: 'initial', libelle: 'Solde Initial du Cycle', montant: soldeInit, soldeApres: soldeInit, jourPrevu: jdp, etat: 'realise' });
                        let soldeCourant = soldeInit;
                        aggItems.forEach(item => {
                            soldeCourant = Math.round((soldeCourant + (item.type === 'credit' ? item.montant : -item.montant)) * 100) / 100;
                            entries.push({ ...item, soldeApres: soldeCourant });
                        });

                        return { entries, soldeAtterrissage: soldeCourant };
                    });`;

const NEW_ENGINE = `                    const journalHybridePourReleve = computed(() => {
                        calculationTick.value;
                        // v25.1 Forward-Projection : moteur projection pure depuis T0 (solde réel)
                        const _rFiltres = releveComptesFiltres.value;
                        const an = moisBudgetaire.value.an;
                        const mois = moisBudgetaire.value.mois;
                        const dAnnee = donneesAnnuelles.value[an] || {};
                        const jdp = Number((soldesInitiaux.value || {}).jourDePaie) || 27;
                        const _si = soldesInitiaux.value || {};

                        const _courantCpt = (comptes.value || []).find(c => c.type === 'courant' || c.type === 'liquide');
                        const courantKey = _courantCpt ? 'cpt_' + _courantCpt.id : 'courant';
                        const _normKey = (k) => {
                            if (!k || k === 'courant') return courantKey;
                            if (/^\\d+$/.test(String(k))) return 'cpt_' + k;
                            return k;
                        };

                        // ── Génération des "legs" : uniquement les flux NON payés (paye:false) ──
                        const legs = [];
                        const _remaining = (item, due) => {
                            if (isItemPaid(item, due)) return 0;
                            const r = due - (getPaidAmount(item, due) || 0);
                            return r > 0 ? Math.round(r * 100) / 100 : 0;
                        };

                        // Revenus → destinationCompte (crédit)
                        Object.values(dAnnee.revenus || {}).forEach(r => {
                            const due = Number(r.base || 0); if (!due) return;
                            const amt = _remaining(r, due); if (!amt) return;
                            legs.push({ account: _normKey(r.destinationCompte), libelle: r.label || 'Revenu', montant: amt, type: 'credit', jourPrevu: Number(r.jourPrevu || jdp) });
                        });

                        // Charges fixes → compteChargesFixes (débit)
                        const _fxSrc = _normKey(_si.compteChargesFixes || 'courant');
                        Object.values(dAnnee.chargesFixes || {}).forEach(f => {
                            const due = Number(f.valeur || 0); if (!due) return;
                            const amt = _remaining(f, due); if (!amt) return;
                            legs.push({ account: _fxSrc, libelle: f.label || 'Charge fixe', montant: amt, type: 'debit', jourPrevu: Number(f.jourPrevu || 10) });
                        });

                        // Charges variables agrégées par catégorie → compteChargesVariables (débit)
                        const _varSrc = _normKey(_si.compteChargesVariables || 'courant');
                        Object.values(dAnnee.chargesVariables || {}).forEach(cv => {
                            let amt = 0;
                            if ((cv.details || []).length > 0) {
                                cv.details.forEach(d => { const due = Number(d.montant || 0); if (due) amt += _remaining(d, due); });
                            } else {
                                const due = Number(cv.valeur || 0); if (due) amt += _remaining(cv, due);
                            }
                            if (amt > 0) legs.push({ account: _varSrc, libelle: cv.label || 'Variable', montant: Math.round(amt * 100) / 100, type: 'debit', jourPrevu: 15 });
                        });

                        // Dépenses exceptionnelles du cycle (règle du 27) → sourceCompte (débit)
                        getDepensesCycle(mois, an).forEach(dep => {
                            const due = Number(dep.montant || 0); if (!due) return;
                            const amt = _remaining(dep, due); if (!amt) return;
                            legs.push({ account: _normKey(dep.sourceCompte), libelle: dep.nom || dep.label || 'Dépense', montant: amt, type: 'debit', jourPrevu: 20 });
                        });

                        // Épargne → transfert interne : débit source + crédit destination
                        const _epArr = Array.isArray(dAnnee.epargne) ? dAnnee.epargne : Object.values(dAnnee.epargne || {});
                        _epArr.forEach(e => {
                            const due = Number(e.valeur || 0); if (!due) return;
                            const src = _normKey(e.sourceCompte || 'courant');
                            const dest = e.linkedAccountId ? _normKey(e.linkedAccountId) : ('ep_' + e.id);
                            legs.push({ account: src,  libelle: '💎 ' + (e.nom || 'Épargne'), montant: due, type: 'debit',  jourPrevu: jdp, internal: true });
                            legs.push({ account: dest, libelle: '💎 ' + (e.nom || 'Épargne'), montant: due, type: 'credit', jourPrevu: jdp, internal: true });
                        });

                        // ── Sélection T0 + filtrage des legs selon le compte affiché ──
                        let T0 = 0, selLegs;
                        if (_rFiltres.length === 1) {
                            const _k = _rFiltres[0];
                            const _cpt = (comptes.value || []).find(c => ('cpt_' + c.id) === _k);
                            T0 = _cpt ? (Number(_cpt.solde) || 0) : 0;
                            selLegs = legs.filter(l => l.account === _k);
                        } else {
                            // Global : somme de tous les comptes ; transferts internes (épargne) exclus (net nul)
                            T0 = (comptes.value || []).reduce((s, c) => s + (Number(c.solde) || 0), 0);
                            selLegs = legs.filter(l => !l.internal);
                        }

                        selLegs.sort((a, b) => (a.jourPrevu || 0) - (b.jourPrevu || 0));

                        const entries = [];
                        entries.push({ type: 'initial', libelle: "⏰ AUJOURD'HUI", montant: T0, soldeApres: T0, jourPrevu: null, etat: 't0' });
                        let solde = T0;
                        selLegs.forEach(l => {
                            solde = Math.round((solde + (l.type === 'credit' ? l.montant : -l.montant)) * 100) / 100;
                            entries.push({ libelle: l.libelle, montant: l.montant, type: l.type, jourPrevu: l.jourPrevu, etat: 'prevu', soldeApres: solde });
                        });

                        return { entries, soldeAtterrissage: solde };
                    });

                    // v25.1 : libellé de projection ("26 [Mois]")
                    const releveProjectionLabel = computed(() => {
                        const _mn = ['','Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
                        return '26 ' + (_mn[moisBudgetaire.value.mois] || '');
                    });`;

replace('Op1+2 - Forward-Only engine + releveProjectionLabel', OLD_ENGINE, NEW_ENGINE);

// ── Op 3 : Inline template — supprime filtres temporels, ajoute titre ─────────
const OLD_INLINE_FILTERS = `                                    <!-- v23.40 : Sélecteurs Année + Cycle (remplace timeline scrollable) -->
                                    <div class="flex items-center gap-3 flex-wrap w-full">
                                        <div class="flex items-center gap-1.5">
                                            <label class="text-[9px] font-black text-gray-500 uppercase tracking-widest">Année</label>
                                            <select :value="releveActiveCycle ? ((cyclesDisponibles.find(c => c.key === releveActiveCycle) || {}).an || '') : (releveAnneesFiltres[0] || '')"
                                                @change="releveActiveCycle = null; releveAnneesFiltres = $event.target.value ? [Number($event.target.value)] : []; releveMoisFiltres = []"
                                                class="text-xs font-bold bg-white border border-gray-200 rounded-lg px-2 py-1 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer">
                                                <option value="">Toutes</option>
                                                <option v-for="a in releveAnneesDisponibles" :key="a" :value="a">{{ a }}</option>
                                            </select>
                                        </div>
                                        <div class="flex items-center gap-1.5">
                                            <label class="text-[9px] font-black text-gray-500 uppercase tracking-widest">Période</label>
                                            <select :value="releveActiveCycle || ''"
                                                @change="releveActiveCycle = $event.target.value || null; releveAnneesFiltres = []; releveMoisFiltres = []"
                                                class="text-xs font-bold bg-white border border-gray-200 rounded-lg px-2 py-1 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer">
                                                <option value="">Tous les cycles</option>
                                                <option v-for="cy in cyclesDisponibles" :key="cy.key" :value="cy.key">{{ cy.nom }}</option>
                                            </select>
                                        </div>
                                        <span v-if="releveActiveCycle" class="text-[9px] text-indigo-500 font-bold">
                                            {{ (cyclesDisponibles.find(c => c.key === releveActiveCycle) || {}).label }}
                                        </span>
                                        <button v-if="releveActiveCycle || releveAnneesFiltres.length" @click.stop="releveActiveCycle = null; releveAnneesFiltres = []; releveMoisFiltres = []"
                                            class="text-[9px] font-bold text-gray-400 hover:text-gray-600 ml-auto">✕ Tout</button>
                                    </div>`;

const NEW_INLINE_FILTERS = `                                    <!-- v25.1 Forward-Projection : titre projection (filtres temporels supprimés) -->
                                    <div class="flex items-center gap-2 flex-wrap w-full">
                                        <span class="text-xs font-black text-indigo-600 uppercase tracking-wide">📅 Projection jusqu'au {{ releveProjectionLabel }}</span>
                                    </div>`;

replace('Op3 - Inline filtres temporels → titre projection', OLD_INLINE_FILTERS, NEW_INLINE_FILTERS);

// ── Op 4 : Modal template — supprime filtres temporels, ajoute titre ──────────
const OLD_MODAL_FILTERS = `                            <!-- v23.40 : Sélecteurs Année + Cycle dans la modale -->
                            <div class="flex items-center gap-2">
                                <select :value="releveActiveCycle ? ((cyclesDisponibles.find(c => c.key === releveActiveCycle) || {}).an || '') : (releveAnneesFiltres[0] || '')"
                                    @change="releveActiveCycle = null; releveAnneesFiltres = $event.target.value ? [Number($event.target.value)] : []; releveMoisFiltres = []"
                                    class="text-xs font-bold bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                                    <option value="">Toutes années</option>
                                    <option v-for="a in releveAnneesDisponibles" :key="a" :value="a">{{ a }}</option>
                                </select>
                                <select :value="releveActiveCycle || ''"
                                    @change="releveActiveCycle = $event.target.value || null; releveAnneesFiltres = []; releveMoisFiltres = []"
                                    class="text-xs font-bold bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                                    <option value="">Tous les cycles</option>
                                    <option v-for="cy in cyclesDisponibles" :key="cy.key" :value="cy.key">{{ cy.nom }}</option>
                                </select>
                            </div>`;

const NEW_MODAL_FILTERS = `                            <!-- v25.1 Forward-Projection : titre projection (filtres temporels supprimés) -->
                            <span class="text-[11px] font-black text-indigo-600 uppercase tracking-wide">📅 Jusqu'au {{ releveProjectionLabel }}</span>`;

replace('Op4 - Modal filtres temporels → titre projection', OLD_MODAL_FILTERS, NEW_MODAL_FILTERS);

// ── Op 5 : Footer (inline + modal) → "🏁 Atterrissage Projeté" ────────────────
replace(
    'Op5 - Footer landing label (inline + modal)',
    `{{ releveActiveCycle ? '🏁 Solde de clôture' : '🏁 Atterrissage projeté au 26' }}`,
    `🏁 Atterrissage Projeté`
);

// ── Op 6 : Ligne initiale (inline + modal) → masque "J.null" ──────────────────
replace(
    'Op6 - Initial row jour cell (inline + modal)',
    `<td class="p-2 text-[10px] font-bold text-blue-400">J.{{ e.jourPrevu }}</td>`,
    `<td class="p-2 text-[10px] font-bold text-blue-400">{{ e.jourPrevu ? 'J.' + e.jourPrevu : '' }}</td>`
);

// ── Op 7 : Expose releveProjectionLabel dans le return ────────────────────────
replace(
    'Op7 - Expose releveProjectionLabel in return',
    `                        journalHybridePourReleve,`,
    `                        journalHybridePourReleve, releveProjectionLabel,`
);

// ── Op 8 : Version bump + Changelog ───────────────────────────────────────────
replace(
    'Op8a - Version bump',
    `const CURRENT_VERSION = "24.91 Pilotage-CrashFix";`,
    `const CURRENT_VERSION = "25.1 Forward-Projection";`
);
replace(
    'Op8b - Changelog entry v25.1',
    `const CHANGELOG = [`,
    `const CHANGELOG = [
        { version: "25.1 Forward-Projection", date: "2026-05-30", changes: [
            "Relevé refondu en projection pure 'Forward-Only' : ligne 1 = ⏰ AUJOURD'HUI (solde réel T0), puis uniquement les flux paye:false du cycle courant triés par jour, solde courant continu jusqu'à l'Atterrissage Projeté",
            "Suppression des filtres temporels (Année / Période / Cycle) — le Relevé affiche le reste du cycle en cours uniquement, titre '📅 Projection jusqu'au 26 [Mois]'",
            "Global = somme de tous les comptes (transferts épargne internes exclus) ; par compte = solde réel + flux routés vers ce compte (épargne visible : sortie source + entrée destination)"
        ] },`
);

// ── Écriture ──────────────────────────────────────────────────────────────────
writeFileSync(FILE, html.replace(/\n/g, '\r\n'), 'utf8');
console.log(`\n🎉 v25.1 Forward-Projection — ${opCount} opérations appliquées !`);
