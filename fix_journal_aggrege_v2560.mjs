/**
 * fix_journal_aggrege_v2560.mjs
 * v25.60 Journal-Agrégé
 *
 * BUG 1 : le journal de projection (Relevé) affiche chaque charge ligne par ligne
 *          (Nounou, Femme de ménage, Alimentation, Santé...). L'utilisateur veut
 *          UN total par grande catégorie : Charges Fixes = X, Charges Variables = Y, etc.
 * BUG 2 : les charges variables hebdomadaires (periode: 'semaine') étaient sommées
 *          telles quelles (valeur hebdo traitée comme mensuelle). Il faut convertir
 *          en mensuel (× 4.3) comme getMonthlyVariableValue.
 *
 * Op 1 : Réécriture de _mkLegs — agrégation par catégorie × compte + conversion ×4.3
 * Op 2 : Version bump + Changelog
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

// ── Op 1 : _mkLegs agrégé par catégorie + conversion hebdo→mensuel ────────────
const OLD_MKLEGS = `                        const _mkLegs = (m, a, mode) => {
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
                        };`;

const NEW_MKLEGS = `                        const _mkLegs = (m, a, mode) => {
                            const dA = donneesAnnuelles.value[a] || {};
                            // v25.60 : agrégation par grande catégorie × compte (pas de détail ligne à ligne)
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
                                else { if (isItemPaid(dep, due)) amt = 0; else { const r = due - (getPaidAmount(dep, due) || 0); amt = r > 0 ? r : 0; } }
                                bump(_normKey(dep.sourceCompte), 'choc', Math.round(amt * 100) / 100);
                            });
                            // Épargne → transfert interne : débit source + crédit destination
                            const epArr = Array.isArray(dA.epargne) ? dA.epargne : Object.values(dA.epargne || {});
                            epArr.forEach(e => {
                                const v = _effVal(e, e.valeur, m); if (v <= 0) return;
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
                            return out;
                        };`;

replace('Op1 - _mkLegs agrégé par catégorie + conversion hebdo→mensuel', OLD_MKLEGS, NEW_MKLEGS);

// ── Op 2 : Version bump + Changelog ───────────────────────────────────────────
replace(
    'Op2a - Version bump',
    `const CURRENT_VERSION = "25.50 Revenu-Bouclier";`,
    `const CURRENT_VERSION = "25.60 Journal-Agrégé";`
);
replace(
    'Op2b - Changelog entry v25.60',
    `const CHANGELOG = [`,
    `const CHANGELOG = [
        { version: "25.60 Journal-Agrégé", date: "2026-05-30", changes: [
            "Journal du Relevé : agrégation par grande catégorie — une seule ligne 💰 Revenus / 🔒 Charges Fixes / 📊 Charges Variables / ⚠️ Dépenses Exceptionnelles / 💎 Épargne (plus de détail ligne par ligne)",
            "Fix conversion hebdo→mensuel : les charges variables periode:'semaine' sont multipliées par 4.3 (comme getMonthlyVariableValue) au lieu d'être traitées comme des montants mensuels",
            "Agrégation respectant le routage par compte (chaque total reste rattaché à son compte source/destination)"
        ] },`
);

// ── Écriture ──────────────────────────────────────────────────────────────────
writeFileSync(FILE, html.replace(/\n/g, '\r\n'), 'utf8');
console.log(`\n🎉 v25.60 Journal-Agrégé — ${opCount} opérations appliquées !`);
