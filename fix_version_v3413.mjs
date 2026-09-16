import fs from 'node:fs';
const FILE = new URL('./index.html', import.meta.url);
let s = fs.readFileSync(FILE, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.split('\r\n').join('\n');
const sub = (from, to, n = 1) => {
    const c = s.split(from).length - 1;
    if (c !== n) throw new Error(`Ancre (${c}/${n}) : ${from.slice(0, 120)}`);
    s = s.split(from).join(to);
};

sub(`                    const CURRENT_VERSION = "34.12 CFO-Cockpit";`,
    `                    const CURRENT_VERSION = "34.13 Chocs-Sans-Injection";`);

const ENTREE = [
    `        { version: "34.13 Chocs-Sans-Injection", date: "2026-09-16", changes: [`,
    `            "BUG CORRIGÉ (2e passe) — le « Total Chocs » du badge Poids (v34.11) sommait Math.abs(montant) sur TOUTES les lignes de depensesIrregulieres, dépenses ET injections confondues. Une ligne à montant négatif dans ce tableau n'est pas une dépense mal signée : c'est une INJECTION délibérée, étiquetée « Injection Banque » par l'app elle-même (remboursement, crédit débloqué — voir injecterFluxCashStudio, qui pousse un « Déblocage Crédit » à montant négatif pouvant atteindre plusieurs centaines de milliers de DH pour un achat immobilier). Cas signalé : Top 3 visible = 64 000 DH, badge affichait « Total Chocs 485 290 DH ».",`,
    `            "CORRECTIF — totalChocsAnnuel = chocsSorties (déjà calculé juste au-dessus, déjà filtré par le même tableau chocs que top3Chocs, donc par le toggle « inclure long terme »). Plus de Math.abs sur l'ensemble : les injections sont exclues du poids, exactement comme le client l'a précisé (chocs = dépenses ponctuelles — voyages, anniversaires, vidanges — jamais une entrée d'argent). Bénéfice additionnel : total, top3 et % du badge viennent désormais tous de la même liste filtrée — une incohérence interne de la v34.11 (le total, lui, ignorait le toggle) disparaît au passage.",`,
    `            "VÉRIFIÉ — scénario reconstruit à partir du signalement (5 dépenses réelles + 1 injection studio de −420 000 DH) : l'ancien calcul produit 498 290 DH, à l'échelle du chiffre faux rapporté (485 290 DH) — confirme le diagnostic. Le nouveau calcul isole exactement les 5 dépenses (78 290 DH), l'injection est exclue, le total reste ≥ la somme du Top 3 seul, et l'impact mensuel/pourcentage (basé sur le net, inchangé) n'est pas affecté."`,
    `        ] },`,
].join('\n');

sub(`                    const CHANGELOG = [\n`, `                    const CHANGELOG = [\n${ENTREE}\n`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ version 34.13 + changelog');
