/**
 * fix_future_restored_v2530.mjs
 * v25.30 Future-Restored
 *
 * Op 1 : Réécriture journalHybridePourReleve — projection multi-cycles (présent + futur)
 *         + bouclier des règles temporelles (exceptions moisDebut/moisFin → valeur effective)
 *         + releveCyclesFuturs computed (cycle courant + futurs uniquement, pas de passé)
 *         + releveProjectionLabel basé sur le cycle sélectionné
 * Op 2 : Inline template — sélecteur de cycle (futur uniquement) restauré
 * Op 3 : Modal template — sélecteur de cycle (futur uniquement) restauré
 * Op 4 : Expose releveCyclesFuturs dans le return
 * Op 5 : Version bump + Changelog
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

// ── Op 1 : moteur projection multi-cycles + bouclier temporel ─────────────────
const OLD_ENGINE = `                        // v25.1 Forward-Projection : moteur projection pure depuis T0 (solde réel)
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

const NEW_ENGINE = `                        // v25.30 Future-Restored : projection multi-cycles (présent + futur) avec bouclier temporel
                        const _rFiltres = releveComptesFiltres.value;
                        const jdp = Number((soldesInitiaux.value || {}).jourDePaie) || 27;
                        const _si = soldesInitiaux.value || {};
                        const curM = moisBudgetaire.value.mois, curA = moisBudgetaire.value.an;

                        const _courantCpt = (comptes.value || []).find(c => c.type === 'courant' || c.type === 'liquide');
                        const courantKey = _courantCpt ? 'cpt_' + _courantCpt.id : 'courant';
                        const _normKey = (k) => {
                            if (!k || k === 'courant') return courantKey;
                            if (/^\\d+$/.test(String(k))) return 'cpt_' + k;
                            return k;
                        };
                        const _fxSrc  = _normKey(_si.compteChargesFixes || 'courant');
                        const _varSrc = _normKey(_si.compteChargesVariables || 'courant');

                        // ── Bouclier temporel : valeur effective d'un item pour un mois donné ──
                        // exceptions = [{ moisDebut, moisFin, nouvelleValeur }] → override la valeur sur la plage
                        const _effVal = (item, baseVal, m) => {
                            let v = Number(baseVal || 0);
                            (item.exceptions || []).forEach(e => {
                                const md = Number(e.moisDebut || 0), mf = Number(e.moisFin || 0);
                                if (md && mf && m >= md && m <= mf) v = Number(e.nouvelleValeur || 0);
                            });
                            return v;
                        };

                        // ── Génère les "legs" d'un cycle (m, a) ──
                        //   mode 'remaining' : cycle courant → uniquement le reste non payé (paye:false)
                        //   mode 'full'      : cycle futur   → tous les flux théoriques valides
                        const _mkLegs = (m, a, mode) => {
                            const dA = donneesAnnuelles.value[a] || {};
                            const out = [];
                            const _amt = (item, baseVal) => {
                                const v = _effVal(item, baseVal, m);
                                if (v <= 0) return 0; // bouclier : flux inactif ce mois-là → exclu
                                if (mode === 'full') return Math.round(v * 100) / 100;
                                if (isItemPaid(item, v)) return 0;
                                const r = v - (getPaidAmount(item, v) || 0);
                                return r > 0 ? Math.round(r * 100) / 100 : 0;
                            };
                            // Revenus → destinationCompte (crédit)
                            Object.values(dA.revenus || {}).forEach(r => {
                                const amt = _amt(r, r.base); if (!amt) return;
                                out.push({ account: _normKey(r.destinationCompte), libelle: r.label || 'Revenu', montant: amt, type: 'credit', jourPrevu: Number(r.jourPrevu || jdp) });
                            });
                            // Charges fixes → compteChargesFixes (débit)
                            Object.values(dA.chargesFixes || {}).forEach(f => {
                                const amt = _amt(f, f.valeur); if (!amt) return;
                                out.push({ account: _fxSrc, libelle: f.label || 'Charge fixe', montant: amt, type: 'debit', jourPrevu: Number(f.jourPrevu || 10) });
                            });
                            // Charges variables agrégées par catégorie → compteChargesVariables (débit)
                            Object.values(dA.chargesVariables || {}).forEach(cv => {
                                let amt = 0;
                                if ((cv.details || []).length > 0) cv.details.forEach(d => { amt += _amt(d, d.montant); });
                                else amt += _amt(cv, cv.valeur);
                                if (amt > 0) out.push({ account: _varSrc, libelle: cv.label || 'Variable', montant: Math.round(amt * 100) / 100, type: 'debit', jourPrevu: 15 });
                            });
                            // Dépenses exceptionnelles du cycle (règle du 27) → sourceCompte (débit)
                            getDepensesCycle(m, a).forEach(dep => {
                                const due = Number(dep.montant || 0); if (!due) return;
                                let amt;
                                if (mode === 'full') amt = due;
                                else { if (isItemPaid(dep, due)) amt = 0; else { const r = due - (getPaidAmount(dep, due) || 0); amt = r > 0 ? Math.round(r * 100) / 100 : 0; } }
                                if (!amt) return;
                                out.push({ account: _normKey(dep.sourceCompte), libelle: dep.nom || dep.label || 'Dépense', montant: amt, type: 'debit', jourPrevu: 20 });
                            });
                            // Épargne → transfert interne : débit source + crédit destination
                            const epArr = Array.isArray(dA.epargne) ? dA.epargne : Object.values(dA.epargne || {});
                            epArr.forEach(e => {
                                const v = _effVal(e, e.valeur, m); if (v <= 0) return;
                                const src = _normKey(e.sourceCompte || 'courant');
                                const dest = e.linkedAccountId ? _normKey(e.linkedAccountId) : ('ep_' + e.id);
                                out.push({ account: src,  libelle: '💎 ' + (e.nom || 'Épargne'), montant: v, type: 'debit',  jourPrevu: jdp, internal: true });
                                out.push({ account: dest, libelle: '💎 ' + (e.nom || 'Épargne'), montant: v, type: 'credit', jourPrevu: jdp, internal: true });
                            });
                            return out;
                        };

                        // ── Filtre des legs selon le compte affiché (single ou Global) ──
                        const _viewLegs = (lgs) => {
                            if (_rFiltres.length === 1) return lgs.filter(l => l.account === _rFiltres[0]);
                            return lgs.filter(l => !l.internal); // Global : transferts internes exclus (net nul)
                        };
                        const _netLegs = (lgs) => _viewLegs(lgs).reduce((s, l) => s + (l.type === 'credit' ? l.montant : -l.montant), 0);

                        // ── T0 : solde réel du compte affiché (ou somme en Global) ──
                        let T0;
                        if (_rFiltres.length === 1) {
                            const _cpt = (comptes.value || []).find(c => ('cpt_' + c.id) === _rFiltres[0]);
                            T0 = _cpt ? (Number(_cpt.solde) || 0) : 0;
                        } else {
                            T0 = (comptes.value || []).reduce((s, c) => s + (Number(c.solde) || 0), 0);
                        }

                        // ── Cycle sélectionné (clé "m-a") — défaut = cycle courant, jamais le passé ──
                        let selM = curM, selA = curA;
                        if (releveActiveCycle.value) {
                            const _p = String(releveActiveCycle.value).split('-').map(Number);
                            if (_p.length === 2 && _p[0] >= 1 && _p[0] <= 12 && _p[1] > 0) { selM = _p[0]; selA = _p[1]; }
                            if (selA < curA || (selA === curA && selM < curM)) { selM = curM; selA = curA; }
                        }
                        const isCurrent = (selM === curM && selA === curA);

                        // ── Chaînage : avance T0 cycle après cycle jusqu'au cycle sélectionné ──
                        let opening = T0, m = curM, a = curA, _guard = 0;
                        while (!(m === selM && a === selA) && _guard++ < 36) {
                            const _mode = (m === curM && a === curA) ? 'remaining' : 'full';
                            opening = Math.round((opening + _netLegs(_mkLegs(m, a, _mode))) * 100) / 100;
                            if (m === 12) { m = 1; a++; } else { m++; }
                        }

                        // ── Construction du relevé du cycle sélectionné ──
                        const dispMode = isCurrent ? 'remaining' : 'full';
                        const dispLegs = _viewLegs(_mkLegs(selM, selA, dispMode));
                        dispLegs.sort((x, y) => (x.jourPrevu || 0) - (y.jourPrevu || 0));

                        const entries = [];
                        entries.push({ type: 'initial', libelle: isCurrent ? "⏰ AUJOURD'HUI" : "🔮 Solde Initial Projeté", montant: opening, soldeApres: opening, jourPrevu: null, etat: isCurrent ? 't0' : 'projete' });
                        let solde = opening;
                        dispLegs.forEach(l => {
                            solde = Math.round((solde + (l.type === 'credit' ? l.montant : -l.montant)) * 100) / 100;
                            entries.push({ libelle: l.libelle, montant: l.montant, type: l.type, jourPrevu: l.jourPrevu, etat: 'prevu', soldeApres: solde });
                        });

                        return { entries, soldeAtterrissage: solde };
                    });

                    // v25.30 : cycles disponibles dans le Relevé = courant + futurs (jamais le passé)
                    const releveCyclesFuturs = computed(() => {
                        const _mN = ['','Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
                        const curM = moisBudgetaire.value.mois, curA = moisBudgetaire.value.an;
                        const endA = curA + 1; // jusqu'à la fin de l'année suivante
                        const out = [];
                        let m = curM, a = curA, _g = 0;
                        while ((a < endA || (a === endA && m <= 12)) && _g++ < 36) {
                            out.push({ key: m + '-' + a, mois: m, an: a, nom: _mN[m] + ' ' + a });
                            if (m === 12) { m = 1; a++; } else { m++; }
                        }
                        return out;
                    });

                    // v25.30 : libellé de projection ("26 [Mois du cycle sélectionné]")
                    const releveProjectionLabel = computed(() => {
                        const _mn = ['','Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
                        let m = moisBudgetaire.value.mois;
                        if (releveActiveCycle.value) {
                            const _p = String(releveActiveCycle.value).split('-').map(Number);
                            if (_p.length === 2 && _p[0] >= 1 && _p[0] <= 12) m = _p[0];
                        }
                        return '26 ' + (_mn[m] || '');
                    });`;

replace('Op1 - Engine multi-cycles + bouclier temporel + releveCyclesFuturs', OLD_ENGINE, NEW_ENGINE);

// ── Op 2 : Inline — sélecteur de cycle (futur) restauré ───────────────────────
const OLD_INLINE_TITLE = `                                    <!-- v25.1 Forward-Projection : titre projection (filtres temporels supprimés) -->
                                    <div class="flex items-center gap-2 flex-wrap w-full">
                                        <span class="text-xs font-black text-indigo-600 uppercase tracking-wide">📅 Projection jusqu'au {{ releveProjectionLabel }}</span>
                                    </div>`;

const NEW_INLINE_TITLE = `                                    <!-- v25.30 Future-Restored : titre projection + sélecteur cycle (courant + futurs) -->
                                    <div class="flex items-center gap-2 flex-wrap w-full">
                                        <span class="text-xs font-black text-indigo-600 uppercase tracking-wide">📅 Projection jusqu'au {{ releveProjectionLabel }}</span>
                                        <div class="flex items-center gap-1.5 ml-auto">
                                            <label class="text-[9px] font-black text-gray-500 uppercase tracking-widest">Cycle</label>
                                            <select :value="releveActiveCycle || (moisBudgetaire.mois + '-' + moisBudgetaire.an)"
                                                @change="releveActiveCycle = $event.target.value || null; releveAnneesFiltres = []; releveMoisFiltres = []"
                                                class="text-xs font-bold bg-white border border-gray-200 rounded-lg px-2 py-1 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer">
                                                <option v-for="cy in releveCyclesFuturs" :key="cy.key" :value="cy.key">{{ cy.nom }}</option>
                                            </select>
                                        </div>
                                    </div>`;

replace('Op2 - Inline cycle selector restored', OLD_INLINE_TITLE, NEW_INLINE_TITLE);

// ── Op 3 : Modal — sélecteur de cycle (futur) restauré ────────────────────────
const OLD_MODAL_TITLE = `                            <!-- v25.1 Forward-Projection : titre projection (filtres temporels supprimés) -->
                            <span class="text-[11px] font-black text-indigo-600 uppercase tracking-wide">📅 Jusqu'au {{ releveProjectionLabel }}</span>`;

const NEW_MODAL_TITLE = `                            <!-- v25.30 Future-Restored : titre projection + sélecteur cycle (courant + futurs) -->
                            <span class="text-[11px] font-black text-indigo-600 uppercase tracking-wide">📅 Jusqu'au {{ releveProjectionLabel }}</span>
                            <select :value="releveActiveCycle || (moisBudgetaire.mois + '-' + moisBudgetaire.an)"
                                @change="releveActiveCycle = $event.target.value || null; releveAnneesFiltres = []; releveMoisFiltres = []"
                                class="text-xs font-bold bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                                <option v-for="cy in releveCyclesFuturs" :key="cy.key" :value="cy.key">{{ cy.nom }}</option>
                            </select>`;

replace('Op3 - Modal cycle selector restored', OLD_MODAL_TITLE, NEW_MODAL_TITLE);

// ── Op 4 : Expose releveCyclesFuturs dans le return ───────────────────────────
replace(
    'Op4 - Expose releveCyclesFuturs in return',
    `                        journalHybridePourReleve, releveProjectionLabel,`,
    `                        journalHybridePourReleve, releveProjectionLabel, releveCyclesFuturs,`
);

// ── Op 5 : Version bump + Changelog ───────────────────────────────────────────
replace(
    'Op5a - Version bump',
    `const CURRENT_VERSION = "25.1 Forward-Projection";`,
    `const CURRENT_VERSION = "25.30 Future-Restored";`
);
replace(
    'Op5b - Changelog entry v25.30',
    `const CHANGELOG = [`,
    `const CHANGELOG = [
        { version: "25.30 Future-Restored", date: "2026-05-30", changes: [
            "Sélecteur de cycle restauré dans le Relevé — affiche le cycle courant + tous les cycles futurs (jusqu'à fin de l'année suivante), aucun cycle passé",
            "Bouclier des règles temporelles : les exceptions (moisDebut/moisFin → nouvelleValeur) sont appliquées par mois projeté — un flux à 0 ce mois-là (ex: Appartement) n'apparaît plus dans le journal",
            "Projection multi-cycles : cycle courant = départ T0 réel + flux non payés ; cycle futur = solde initial projeté (chaîné depuis aujourd'hui) + tous les flux théoriques valides du mois"
        ] },`
);

// ── Écriture ──────────────────────────────────────────────────────────────────
writeFileSync(FILE, html.replace(/\n/g, '\r\n'), 'utf8');
console.log(`\n🎉 v25.30 Future-Restored — ${opCount} opérations appliquées !`);
