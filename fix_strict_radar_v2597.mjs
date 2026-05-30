// fix_strict_radar_v2597.mjs
// v25.97 Strict-Radar — forward-only (zéro passé) + dégroupage total (un leg par flux)
import fs from 'node:fs';
const FILE = 'C:/Users/HP/finance/index.html';
let html = fs.readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n');
let opCount = 0;
const check = (label, str) => {
    if (!html.includes(str)) { console.error('❌ ANCHOR MISSING: ' + label); process.exit(1); }
};
const replace = (label, from, to) => {
    check(label, from);
    html = html.split(from).join(to);
    opCount++;
    console.log('✔ ' + label);
};

// ─────────────────────────────────────────────────────────────
// OP 1 : _mkLegs — DÉGROUPAGE TOTAL (un leg par flux) + suppression du mode 'realized'
// ─────────────────────────────────────────────────────────────
replace('1) _mkLegs dégroupé (un leg par flux, sans realized)',
`                            // v25.60 : agrégation par grande catégorie × compte (pas de détail ligne à ligne)
                            const acc = {};
                            const bump = (account, cat, montant) => {
                                if (!montant) return;
                                if (!acc[account]) acc[account] = {};
                                acc[account][cat] = (acc[account][cat] || 0) + montant;
                            };
                            // montant d'un item simple (revenu / charge fixe) — bouclier + payé/théorique
                            const _amt = (item, baseVal) => {
                                const v = _effVal(item, baseVal, m);
                                if (v <= 0) return 0; // bouclier : flux inactif ce mois-là → exclu
                                if (mode === 'full') return Math.round(v * 100) / 100;
                                // v25.90 Multi-Ledger-Core : mode 'realized' = items déjà pointés (Assurance, Booking…)
                                if (mode === 'realized') return isItemPaid(item, v) ? Math.round(v * 100) / 100 : 0;
                                if (isItemPaid(item, v)) return 0;
                                const r = v - (getPaidAmount(item, v) || 0);
                                return r > 0 ? Math.round(r * 100) / 100 : 0;
                            };
                            // montant mensuel d'une catégorie de charge variable (conversion hebdo → mensuel ×4.3)
                            const _varAmt = (cv) => {
                                const effValeur = _effVal(cv, cv.valeur, m); // bouclier sur la catégorie
                                let monthly = (cv.periode === 'semaine') ? effValeur * 4.3 : effValeur;
                                monthly = Math.round(monthly * 100) / 100;
                                if (monthly <= 0) return 0;
                                if (mode === 'full') return monthly;
                                // reste à payer : retire la part déjà pointée (suivi sur détails ou catégorie)
                                let paid = 0;
                                if ((cv.details || []).length > 0) cv.details.forEach(d => { paid += getPaidAmount(d, Number(d.montant || 0)) || 0; });
                                else paid = getPaidAmount(cv, effValeur) || 0;
                                const rem = monthly - paid;
                                return rem > 0 ? Math.round(rem * 100) / 100 : 0;
                            };

                            // Revenus → destinationCompte (crédit)
                            Object.values(dA.revenus || {}).forEach(r => { bump(_normKey(r.destinationCompte), 'rev', _amt(r, r.base)); });
                            // Charges fixes → compteChargesFixes (débit)
                            Object.values(dA.chargesFixes || {}).forEach(f => { bump(_fxSrc, 'fix', _amt(f, f.valeur)); });
                            // Charges variables → compteChargesVariables (débit) — total mensuel par catégorie
                            Object.values(dA.chargesVariables || {}).forEach(cv => { bump(_varSrc, 'var', _varAmt(cv)); });
                            // Dépenses exceptionnelles du cycle (règle du 27) → sourceCompte (débit)
                            getDepensesCycle(m, a).forEach(dep => {
                                const due = Number(dep.montant || 0); if (!due) return;
                                let amt;
                                if (mode === 'full') amt = due;
                                // v25.90 : mode 'realized' = dépense exceptionnelle déjà pointée
                                else if (mode === 'realized') { amt = isItemPaid(dep, due) ? due : 0; }
                                else { if (isItemPaid(dep, due)) amt = 0; else { const r = due - (getPaidAmount(dep, due) || 0); amt = r > 0 ? r : 0; } }
                                bump(_normKey(dep.sourceCompte), 'choc', Math.round(amt * 100) / 100);
                            });
                            // Épargne → transfert interne : débit source + crédit destination
                            const epArr = Array.isArray(dA.epargne) ? dA.epargne : Object.values(dA.epargne || {});
                            epArr.forEach(e => {
                                const v = _effVal(e, e.valeur, m); if (v <= 0) return;
                                const _epPaid = isItemPaid(e, v);
                                // v25.90 : 'realized' = épargne déjà virée ; 'remaining' = à virer ; 'full' = tout
                                if (mode === 'realized' && !_epPaid) return;
                                if (mode === 'remaining' && _epPaid) return;
                                bump(_normKey(e.sourceCompte || 'courant'), 'epOut', v);
                                bump(e.linkedAccountId ? _normKey(e.linkedAccountId) : ('ep_' + e.id), 'epIn', v);
                            });

                            // ── Aplatissement : une ligne par (compte, catégorie) ──
                            const META = {
                                rev:   { libelle: '💰 Revenus',                  type: 'credit', jour: jdp, internal: false },
                                fix:   { libelle: '🔒 Charges Fixes',            type: 'debit',  jour: 10,  internal: false },
                                var:   { libelle: '📊 Charges Variables',        type: 'debit',  jour: 15,  internal: false },
                                choc:  { libelle: '⚠️ Dépenses Exceptionnelles', type: 'debit',  jour: 20,  internal: false },
                                epOut: { libelle: '💎 Épargne (prélèvement)',    type: 'debit',  jour: jdp, internal: true },
                                epIn:  { libelle: '💎 Épargne (versement)',      type: 'credit', jour: jdp, internal: true }
                            };
                            const order = ['rev', 'fix', 'var', 'choc', 'epOut', 'epIn'];
                            const out = [];
                            Object.keys(acc).forEach(account => {
                                order.forEach(cat => {
                                    const montant = Math.round((acc[account][cat] || 0) * 100) / 100;
                                    if (montant > 0) { const mt = META[cat]; out.push({ account, libelle: mt.libelle, montant, type: mt.type, jourPrevu: mt.jour, internal: mt.internal }); }
                                });
                            });
                            return out;`,
`                            // v25.97 Strict-Radar : UN LEG PAR FLUX individuel — aucune agrégation, aucun reduce de fusion
                            const out = [];
                            // montant effectif d'un item simple (revenu / charge fixe) — paye:true EXCLU (déjà dans le solde réel)
                            const _amt = (item, baseVal) => {
                                const v = _effVal(item, baseVal, m);
                                if (v <= 0) return 0; // bouclier : flux inactif ce mois-là → exclu
                                if (mode === 'full') return Math.round(v * 100) / 100;
                                if (isItemPaid(item, v)) return 0; // déjà pointé → totalement ignoré (radar forward-only)
                                const r = v - (getPaidAmount(item, v) || 0);
                                return r > 0 ? Math.round(r * 100) / 100 : 0;
                            };
                            // montant mensuel d'une catégorie de charge variable (conversion hebdo → mensuel ×4.3)
                            const _varAmt = (cv) => {
                                const effValeur = _effVal(cv, cv.valeur, m);
                                let monthly = (cv.periode === 'semaine') ? effValeur * 4.3 : effValeur;
                                monthly = Math.round(monthly * 100) / 100;
                                if (monthly <= 0) return 0;
                                if (mode === 'full') return monthly;
                                let paid = 0;
                                if ((cv.details || []).length > 0) cv.details.forEach(d => { paid += getPaidAmount(d, Number(d.montant || 0)) || 0; });
                                else paid = getPaidAmount(cv, effValeur) || 0;
                                const rem = monthly - paid;
                                return rem > 0 ? Math.round(rem * 100) / 100 : 0;
                            };

                            // Revenus → destinationCompte (crédit) — UNE LIGNE PAR REVENU (libellé + date + montant propres)
                            Object.values(dA.revenus || {}).forEach(r => {
                                const amt = _amt(r, r.base);
                                if (amt > 0) out.push({ account: _normKey(r.destinationCompte), libelle: '💰 ' + (r.label || r.nom || 'Revenu'), montant: amt, type: 'credit', jourPrevu: Number(r.jourPrevu || jdp), internal: false });
                            });
                            // Charges fixes → compteChargesFixes (débit) — UNE LIGNE PAR CHARGE FIXE
                            Object.values(dA.chargesFixes || {}).forEach(f => {
                                const amt = _amt(f, f.valeur);
                                if (amt > 0) out.push({ account: _fxSrc, libelle: '🔒 ' + (f.label || f.nom || 'Charge fixe'), montant: amt, type: 'debit', jourPrevu: Number(f.jourPrevu || 10), internal: false });
                            });
                            // Charges variables → compteChargesVariables (débit) — UNE LIGNE PAR CATÉGORIE
                            Object.values(dA.chargesVariables || {}).forEach(cv => {
                                const amt = _varAmt(cv);
                                if (amt > 0) out.push({ account: _varSrc, libelle: '📊 ' + (cv.label || cv.nom || 'Charge variable'), montant: amt, type: 'debit', jourPrevu: Number(cv.jourPrevu || 15), internal: false });
                            });
                            // Dépenses exceptionnelles du cycle (règle du 27) → sourceCompte (débit) — UNE LIGNE PAR DÉPENSE
                            getDepensesCycle(m, a).forEach(dep => {
                                const due = Number(dep.montant || 0); if (!due) return;
                                let amt;
                                if (mode === 'full') amt = due;
                                else { if (isItemPaid(dep, due)) amt = 0; else { const r = due - (getPaidAmount(dep, due) || 0); amt = r > 0 ? r : 0; } }
                                amt = Math.round(amt * 100) / 100;
                                if (amt > 0) out.push({ account: _normKey(dep.sourceCompte), libelle: '⚠️ ' + (dep.nom || dep.label || 'Dépense'), montant: amt, type: 'debit', jourPrevu: Number(dep.jourPrevu || 20), internal: false });
                            });
                            // Épargne → transfert interne : UNE LIGNE prélèvement + UNE LIGNE versement PAR ÉPARGNE
                            const epArr = Array.isArray(dA.epargne) ? dA.epargne : Object.values(dA.epargne || {});
                            epArr.forEach(e => {
                                const v = _effVal(e, e.valeur, m); if (v <= 0) return;
                                if (mode !== 'full' && isItemPaid(e, v)) return; // déjà virée → exclue (radar forward-only)
                                const amt = Math.round(v * 100) / 100;
                                const lbl = e.nom || e.label || 'Épargne';
                                const _jr = Number(e.jourPrevu || jdp);
                                out.push({ account: _normKey(e.sourceCompte || 'courant'), libelle: '💎 ' + lbl + ' (prélèvement)', montant: amt, type: 'debit', jourPrevu: _jr, internal: true });
                                out.push({ account: e.linkedAccountId ? _normKey(e.linkedAccountId) : ('ep_' + e.id), libelle: '💎 ' + lbl + ' (versement)', montant: amt, type: 'credit', jourPrevu: _jr, internal: true });
                            });
                            return out;`);

// ─────────────────────────────────────────────────────────────
// OP 2 : Suppression TOTALE de la section "Déjà Réalisé" — 1re ligne = AUJOURD'HUI
// ─────────────────────────────────────────────────────────────
replace('2) suppression section Déjà Réalisé (forward-only)',
`                            // ── Section "Déjà Réalisé" (cycle courant uniquement) ──
                            if (isCurrent) {
                                const realLegs = _viewLegs(_mkLegs(cyc.m, cyc.a, 'realized'));
                                realLegs.sort((x, y) => _cSort(x.jourPrevu) - _cSort(y.jourPrevu));
                                if (realLegs.length > 0) {
                                    entries.push({ type: 'sep_realise', libelle: '✅ Déjà Réalisé ce cycle', soldeApres: solde, jourPrevu: null });
                                    realLegs.forEach(l => {
                                        entries.push({ libelle: l.libelle, montant: l.montant, type: l.type, jourPrevu: l.jourPrevu, etat: 'realise', soldeApres: solde, compteKey: l.account, soldeCompteApres: null });
                                    });
                                }
                            }

                            // ── Ligne d'ouverture du cycle ──`,
`                            // ── v25.97 Strict-Radar : AUCUN passé — la 1re ligne du cycle courant est ⏰ AUJOURD'HUI ──
                            // ── Ligne d'ouverture du cycle ──`);

// ─────────────────────────────────────────────────────────────
// OP 3 : Version + changelog
// ─────────────────────────────────────────────────────────────
replace('3) version + changelog',
`                    const CURRENT_VERSION = "25.96 Global-Strict-Isolation";
                    const CHANGELOG = [
        { version: "25.96 Global-Strict-Isolation", date: "2026-05-30", changes: [`,
`                    const CURRENT_VERSION = "25.97 Strict-Radar";
                    const CHANGELOG = [
        { version: "25.97 Strict-Radar", date: "2026-05-30", changes: [
            "RADAR FORWARD-ONLY : suppression totale de la section ✅ Déjà Réalisé du Journal — la LIGNE N°1 du tableau est désormais ⏰ AUJOURD'HUI, rien ne s'affiche avant",
            "Tout flux pointé (paye:true) est totalement exclu du moteur du journal : son montant est déjà inclus dans le solde réel de départ (suppression du mode 'realized' de _mkLegs)",
            "DÉGROUPAGE TOTAL : _mkLegs génère un leg PAR FLUX individuel (un revenu = une ligne) — fini les lignes fusionnées '💰 Revenus'. Chaque revenu/charge/dépense a son libellé exact, sa date (jourPrevu) et son montant propres",
            "Plus aucun reduce/addition pour fusionner des flux de même catégorie : Salaire, Bonification, Loyer Appartement = 3 lignes distinctes",
            "Note de version : demande intitulée V25.97 — numérotée 25.97 (continuité après 25.96)"
        ] },
        { version: "25.96 Global-Strict-Isolation", date: "2026-05-30", changes: [`);

// ─────────────────────────────────────────────────────────────
fs.writeFileSync(FILE, html.replace(/\n/g, '\r\n'), 'utf8');
console.log('\n✅ ' + opCount + ' opérations appliquées — v25.97 Strict-Radar');
