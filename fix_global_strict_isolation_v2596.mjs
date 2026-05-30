// fix_global_strict_isolation_v2596.mjs
// v25.96 Global-Strict-Isolation — robust account-name resolver + strict per-account balance + anti-NaN
import fs from 'node:fs';
const FILE = 'C:/Users/HP/finance/index.html';
let html = fs.readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n');
let opCount = 0;
const check = (label, str) => {
    if (!html.includes(str)) { console.error('❌ ANCHOR MISSING: ' + label); process.exit(1); }
};
const replace = (label, from, to) => {
    check(label, from);
    const n = html.split(from).length - 1;
    html = html.split(from).join(to);
    opCount++;
    console.log('✔ ' + label + ' (' + n + ' occurrence' + (n > 1 ? 's' : '') + ')');
};

// ─────────────────────────────────────────────────────────────
// OP 1 : getNomCompte(key) — résolveur robuste (cpt_ → comptes.label, ep_ → épargne.nom)
// ─────────────────────────────────────────────────────────────
replace('1) getNomCompte resolver',
`                    const getCompteIcone = (key) => {
                        const id = String(key).replace('cpt_', '');
                        const c = comptes.value.find(c => String(c.id) === id);
                        return c ? (c.icone || '💰') : '💰';
                    };`,
`                    const getCompteIcone = (key) => {
                        const id = String(key).replace('cpt_', '');
                        const c = comptes.value.find(c => String(c.id) === id);
                        return c ? (c.icone || '💰') : '💰';
                    };

                    // v25.96 Global-Strict-Isolation : résolveur robuste de nom de compte (cpt_ + ep_)
                    const getNomCompte = (key) => {
                        if (key === null || key === undefined || key === '') return '?';
                        const k = String(key);
                        if (k.startsWith('cpt_')) {
                            const id = k.replace('cpt_', '');
                            const c = (comptes.value || []).find(c => String(c.id) === id);
                            return c ? (c.label || c.nom || k) : k; // jamais vide : ID brut en dernier recours
                        }
                        if (k.startsWith('ep_')) {
                            const id = Number(k.replace('ep_', ''));
                            const d = donneesAnnuelles.value[anneeAffichage.value];
                            const ep = (d && Array.isArray(d.epargne)) ? d.epargne.find(e => Number(e.id) === id) : null;
                            return ep ? (ep.nom || ep.label || k) : k;
                        }
                        if (k === 'courant') return 'Compte Courant';
                        return k;
                    };`);

// ─────────────────────────────────────────────────────────────
// OP 2 : T0 / _soldesComptes — blindage anti-NaN (Number() strict)
// ─────────────────────────────────────────────────────────────
replace('2) anti-NaN init _soldesComptes',
`                        // v25.90 Multi-Ledger-Core : dictionnaire des soldes par compte (vue Global = pas de somme)
                        const _soldesComptes = {};
                        if (_rFiltres.length === 0) {
                            (comptes.value || []).forEach(c => { _soldesComptes['cpt_' + c.id] = Number(c.solde) || 0; });
                        }`,
`                        // v25.96 Global-Strict-Isolation : dictionnaire soldes par compte (vue Global) — Number() strict anti-NaN
                        const _soldesComptes = {};
                        if (_rFiltres.length === 0) {
                            (comptes.value || []).forEach(c => {
                                const s = Number(c.solde);
                                _soldesComptes['cpt_' + c.id] = Number.isFinite(s) ? s : 0;
                            });
                        }`);

// ─────────────────────────────────────────────────────────────
// OP 3 : Boucle d'écritures — isolation STRICTE (lazy-init, jamais de somme)
// ─────────────────────────────────────────────────────────────
replace('3) strict per-account balance (lazy-init, never sum)',
`                                const delta = l.type === 'credit' ? l.montant : -l.montant;
                                solde = Math.round((solde + delta) * 100) / 100;
                                let soldeCompteApres = null;
                                if (_rFiltres.length === 0 && _soldesComptes[l.account] !== undefined) {
                                    _soldesComptes[l.account] = Math.round((_soldesComptes[l.account] + delta) * 100) / 100;
                                    soldeCompteApres = _soldesComptes[l.account];
                                }
                                entries.push({ libelle: l.libelle, montant: l.montant, type: l.type, jourPrevu: l.jourPrevu, etat: 'prevu', soldeApres: solde, compteKey: l.account, soldeCompteApres });`,
`                                const _d = Number(l.type === 'credit' ? l.montant : -l.montant) || 0;
                                solde = Math.round((solde + _d) * 100) / 100;
                                // v25.96 Global-Strict-Isolation : solde ISOLÉ du compte impacté — JAMAIS de somme cumulée
                                let soldeCompteApres = null;
                                if (_rFiltres.length === 0) {
                                    const _prev = Number(_soldesComptes[l.account]); // lazy-init : compte jamais vu → 0
                                    _soldesComptes[l.account] = Math.round(((Number.isFinite(_prev) ? _prev : 0) + _d) * 100) / 100;
                                    soldeCompteApres = _soldesComptes[l.account];
                                }
                                entries.push({ libelle: l.libelle, montant: l.montant, type: l.type, jourPrevu: l.jourPrevu, etat: 'prevu', soldeApres: solde, compteKey: l.account, soldeCompteApres });`);

// ─────────────────────────────────────────────────────────────
// OP 4 : Badges (inline + modal, realise + standard) → getNomCompte
// ─────────────────────────────────────────────────────────────
replace('4) badges → getNomCompte (4 occurrences)',
`{{ (comptes.find(c => 'cpt_'+c.id === e.compteKey)||{}).nom || e.compteKey }}`,
`{{ getNomCompte(e.compteKey) }}`);

// ─────────────────────────────────────────────────────────────
// OP 5 : Setup return — expose getNomCompte
// ─────────────────────────────────────────────────────────────
replace('5) setup return — getNomCompte',
`                        detailsComptesFinal, getCompteLabel, getCompteIcone,`,
`                        detailsComptesFinal, getCompteLabel, getCompteIcone, getNomCompte,`);

// ─────────────────────────────────────────────────────────────
// OP 6 : Version + changelog
// ─────────────────────────────────────────────────────────────
replace('6) version + changelog',
`                    const CURRENT_VERSION = "25.90 Multi-Ledger-Core";
                    const CHANGELOG = [
        { version: "25.90 Multi-Ledger-Core", date: "2026-05-30", changes: [`,
`                    const CURRENT_VERSION = "25.96 Global-Strict-Isolation";
                    const CHANGELOG = [
        { version: "25.96 Global-Strict-Isolation", date: "2026-05-30", changes: [
            "FIX badges vides : nouveau résolveur getNomCompte(key) — cpt_ → comptes.label (et non plus .nom qui n'existe pas), ep_ → épargne.nom ; ID brut affiché en dernier recours, jamais de champ vide",
            "FIX somme cumulée en vue Global : la colonne Solde affiche désormais STRICTEMENT le solde isolé du compte impacté par la ligne (_soldesComptes[compte]) — fini l'addition Courant + Crédit + Épargne. Lazy-init à 0 de tout compte jamais vu pour ne jamais retomber sur le solde global cumulé",
            "Blindage anti-NaN : Number.isFinite() sur l'init des soldes de départ et sur chaque delta de transaction — aucune infection NaN possible dans le tableau",
            "Note de version : demande intitulée V25.96 — numérotée 25.96 (continuité après 25.90)"
        ] },
        { version: "25.90 Multi-Ledger-Core", date: "2026-05-30", changes: [`);

// ─────────────────────────────────────────────────────────────
fs.writeFileSync(FILE, html.replace(/\n/g, '\r\n'), 'utf8');
console.log('\n✅ ' + opCount + ' opérations appliquées — v25.96 Global-Strict-Isolation');
