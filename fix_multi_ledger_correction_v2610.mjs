// fix_multi_ledger_correction_v2610.mjs
// v26.10 Multi-Ledger-Correction — soldes 100% isolés par compte (épargne incluse),
//                                   double écriture des transferts d'épargne en vue Global,
//                                   retour visible du breakdown des entrées reçues (paye:true)
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
// OP 1 : CHANTIER 3 — vue Global affiche les transferts internes (double écriture débit/crédit)
// ─────────────────────────────────────────────────────────────
replace('1) _viewLegs Global — afficher transferts internes',
`                        // ── Filtre des legs selon le compte affiché (single ou Global) ──
                        const _viewLegs = (lgs) => {
                            if (_rFiltres.length === 1) return lgs.filter(l => l.account === _rFiltres[0]);
                            return lgs.filter(l => !l.internal); // Global : transferts internes exclus (net nul)
                        };`,
`                        // ── Filtre des legs selon le compte affiché (single ou Global) ──
                        const _viewLegs = (lgs) => {
                            if (_rFiltres.length === 1) return lgs.filter(l => l.account === _rFiltres[0]);
                            // v26.10 Multi-Ledger-Correction : vue Global → on AFFICHE les transferts internes (double écriture
                            // débit compte source / crédit compte destination). Chaque ligne garde son solde isolé par compte.
                            return lgs;
                        };`);

// ─────────────────────────────────────────────────────────────
// OP 2 : CHANTIER 1 — accumulateur de solde isolé pour CHAQUE compte (épargne incluse)
// ─────────────────────────────────────────────────────────────
replace('2) _soldesComptes — init des livrets épargne à leur solde réel',
`                        // v25.96 Global-Strict-Isolation : dictionnaire soldes par compte (vue Global) — Number() strict anti-NaN
                        const _soldesComptes = {};
                        if (_rFiltres.length === 0) {
                            (comptes.value || []).forEach(c => {
                                const s = Number(c.solde);
                                _soldesComptes['cpt_' + c.id] = Number.isFinite(s) ? s : 0;
                            });
                        }`,
`                        // v26.10 Multi-Ledger-Correction : un accumulateur de solde ISOLÉ par compte, initialisé à son VRAI solde réel à l'instant T
                        const _soldesComptes = {};
                        if (_rFiltres.length === 0) {
                            (comptes.value || []).forEach(c => {
                                const s = Number(c.solde);
                                _soldesComptes['cpt_' + c.id] = Number.isFinite(s) ? s : 0;
                            });
                            // chaque livret d'épargne possède aussi son propre accumulateur, ancré sur son solde réel (jamais 0 par défaut)
                            const _epReal = (donneesAnnuelles.value[curA] || {}).epargne;
                            const _epRealArr = Array.isArray(_epReal) ? _epReal : Object.values(_epReal || {});
                            _epRealArr.forEach(e => {
                                const s = Number(e.valeur);
                                _soldesComptes['ep_' + e.id] = Number.isFinite(s) ? s : 0;
                            });
                        }`);

// ─────────────────────────────────────────────────────────────
// OP 3 : CHANTIER 2 — retour visible du breakdown des entrées reçues — INLINE
// ─────────────────────────────────────────────────────────────
replace('3) styles entrées reçues inline — visibles (encaissé)',
`                                            <!-- v26.0 Ledger-Refinement : séparateur "Déjà Encaissé" — neutre (plus de vert criard) -->
                                            <tr v-else-if="e.type === 'sep_realise'" class="bg-gray-100 border-y border-gray-300">
                                                <td colspan="5" class="py-1 px-3 text-center">
                                                    <span class="text-[10px] font-black uppercase tracking-widest text-gray-500">{{ e.libelle }}</span>
                                                </td>
                                            </tr>
                                            <!-- v26.0 : ligne déjà réalisée — affichage simple/neutre, sans solde cumulé (déjà inclus dans T0) -->
                                            <tr v-else-if="e.etat === 'realise'" class="border-b border-gray-100 bg-gray-50/50">
                                                <td class="p-2 text-[10px] text-gray-400 font-bold whitespace-nowrap">{{ e.jourPrevu ? 'j.' + e.jourPrevu : '✓' }}</td>
                                                <td class="p-2 text-xs text-gray-500 font-medium">
                                                    <span v-if="releveComptesFiltres.length === 0 && e.compteKey" class="inline-block text-[8px] font-black bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded mr-1 align-middle">{{ getNomCompte(e.compteKey) }}</span>{{ e.libelle }}
                                                </td>
                                                <td class="p-2 text-right font-bold text-gray-500 text-xs tabular-nums">{{ e.type === 'credit' ? formatMAD(e.montant) : '' }}</td>
                                                <td class="p-2 text-right font-bold text-gray-500 text-xs tabular-nums">{{ e.type === 'debit' ? formatMAD(e.montant) : '' }}</td>
                                                <td class="p-2 text-right text-xs text-gray-300 tabular-nums">✓</td>
                                            </tr>`,
`                                            <!-- v26.10 Multi-Ledger-Correction : séparateur "Déjà Encaissé" (entrées reçues, visibles) -->
                                            <tr v-else-if="e.type === 'sep_realise'" class="bg-emerald-50 border-y border-emerald-200">
                                                <td colspan="5" class="py-1 px-3 text-center">
                                                    <span class="text-[10px] font-black uppercase tracking-widest text-emerald-700">{{ e.libelle }}</span>
                                                </td>
                                            </tr>
                                            <!-- v26.10 : entrée déjà reçue (paye:true) — détaillée et visible ; colonne Solde = ✓ reçu (montant déjà inclus dans T0) -->
                                            <tr v-else-if="e.etat === 'realise'" class="border-b border-emerald-100 bg-emerald-50/40">
                                                <td class="p-2 text-[10px] text-emerald-600 font-bold whitespace-nowrap">{{ e.jourPrevu ? 'j.' + e.jourPrevu : '✓' }}</td>
                                                <td class="p-2 text-xs text-gray-800 font-medium">
                                                    <span v-if="releveComptesFiltres.length === 0 && e.compteKey" class="inline-block text-[8px] font-black bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded mr-1 align-middle">{{ getNomCompte(e.compteKey) }}</span>{{ e.libelle }}
                                                </td>
                                                <td class="p-2 text-right font-black text-emerald-700 text-xs tabular-nums">{{ e.type === 'credit' ? formatMAD(e.montant) : '' }}</td>
                                                <td class="p-2 text-right font-black text-red-500 text-xs tabular-nums">{{ e.type === 'debit' ? formatMAD(e.montant) : '' }}</td>
                                                <td class="p-2 text-right text-[10px] text-emerald-500 font-bold tabular-nums">✓ reçu</td>
                                            </tr>`);

// ─────────────────────────────────────────────────────────────
// OP 4 : CHANTIER 2 — retour visible du breakdown des entrées reçues — MODAL
// ─────────────────────────────────────────────────────────────
replace('4) styles entrées reçues modal — visibles (encaissé)',
`                                <!-- v26.0 Ledger-Refinement : séparateur "Déjà Encaissé" — neutre -->
                                <tr v-else-if="e.type === 'sep_realise'" class="bg-gray-100 border-y border-gray-300">
                                    <td colspan="5" class="py-1.5 px-4 text-center">
                                        <span class="text-[10px] font-black uppercase tracking-widest text-gray-500">{{ e.libelle }}</span>
                                    </td>
                                </tr>
                                <!-- v26.0 : ligne déjà réalisée — affichage simple/neutre, sans solde cumulé -->
                                <tr v-else-if="e.etat === 'realise'" class="border-b border-gray-100 bg-gray-50/50">
                                    <td class="p-2 text-[10px] text-gray-400 font-bold whitespace-nowrap">{{ e.jourPrevu ? 'j.' + e.jourPrevu : '✓' }}</td>
                                    <td class="p-2 text-xs text-gray-500 font-medium">
                                        <span v-if="releveComptesFiltres.length === 0 && e.compteKey" class="inline-block text-[8px] font-black bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded mr-1 align-middle">{{ getNomCompte(e.compteKey) }}</span>{{ e.libelle }}
                                    </td>
                                    <td class="p-2 text-right font-bold text-gray-500 text-xs tabular-nums">{{ e.type === 'credit' ? formatMAD(e.montant) : '' }}</td>
                                    <td class="p-2 text-right font-bold text-gray-500 text-xs tabular-nums">{{ e.type === 'debit' ? formatMAD(e.montant) : '' }}</td>
                                    <td class="p-2 text-right text-xs text-gray-300 tabular-nums">✓</td>
                                </tr>`,
`                                <!-- v26.10 Multi-Ledger-Correction : séparateur "Déjà Encaissé" (entrées reçues, visibles) -->
                                <tr v-else-if="e.type === 'sep_realise'" class="bg-emerald-50 border-y border-emerald-200">
                                    <td colspan="5" class="py-1.5 px-4 text-center">
                                        <span class="text-[10px] font-black uppercase tracking-widest text-emerald-700">{{ e.libelle }}</span>
                                    </td>
                                </tr>
                                <!-- v26.10 : entrée déjà reçue (paye:true) — détaillée et visible ; colonne Solde = ✓ reçu -->
                                <tr v-else-if="e.etat === 'realise'" class="border-b border-emerald-100 bg-emerald-50/40">
                                    <td class="p-2 text-[10px] text-emerald-600 font-bold whitespace-nowrap">{{ e.jourPrevu ? 'j.' + e.jourPrevu : '✓' }}</td>
                                    <td class="p-2 text-xs text-gray-800 font-medium">
                                        <span v-if="releveComptesFiltres.length === 0 && e.compteKey" class="inline-block text-[8px] font-black bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded mr-1 align-middle">{{ getNomCompte(e.compteKey) }}</span>{{ e.libelle }}
                                    </td>
                                    <td class="p-2 text-right font-black text-emerald-700 text-xs tabular-nums">{{ e.type === 'credit' ? formatMAD(e.montant) : '' }}</td>
                                    <td class="p-2 text-right font-black text-red-500 text-xs tabular-nums">{{ e.type === 'debit' ? formatMAD(e.montant) : '' }}</td>
                                    <td class="p-2 text-right text-[10px] text-emerald-500 font-bold tabular-nums">✓ reçu</td>
                                </tr>`);

// ─────────────────────────────────────────────────────────────
// OP 5 : Version + changelog
// ─────────────────────────────────────────────────────────────
replace('5) version + changelog',
`                    const CURRENT_VERSION = "26.0 Ledger-Refinement";
                    const CHANGELOG = [
        { version: "26.0 Ledger-Refinement", date: "2026-05-30", changes: [`,
`                    const CURRENT_VERSION = "26.10 Multi-Ledger-Correction";
                    const CHANGELOG = [
        { version: "26.10 Multi-Ledger-Correction", date: "2026-05-30", changes: [
            "ÉTANCHÉITÉ DES SOLDES : chaque compte (Courant, autres comptes ET chaque livret d'épargne) possède son propre accumulateur isolé, initialisé à son vrai solde réel à l'instant T. La colonne Solde d'une ligne n'affiche QUE le solde cumulé du compte de cette ligne — aucune addition croisée entre comptes",
            "RETOUR DU BREAKDOWN DES ENTRÉES REÇUES : la section ✅ Déjà Encaissé (avant ⏰ AUJOURD'HUI) ré-affiche, détaillées ligne par ligne, toutes les entrées validées du cycle (Salaire, remboursements…). Seules les dépenses passées restent masquées",
            "DOUBLE ÉCRITURE DES TRANSFERTS D'ÉPARGNE : en vue Global, un virement d'épargne (ex: 10 400 DH vers Fonds Urgence) génère désormais 2 lignes — un débit sur le compte source (badge Compte Courant) et un crédit sur le compte destination (badge Fonds Urgence). Les transferts internes ne sont plus censurés par le filtre de vue",
            "Note de version : demande intitulée V26.10 — numérotée 26.10 (continuité après 26.0)"
        ] },
        { version: "26.0 Ledger-Refinement", date: "2026-05-30", changes: [`);

// ─────────────────────────────────────────────────────────────
fs.writeFileSync(FILE, html.replace(/\n/g, '\r\n'), 'utf8');
console.log('\n✅ ' + opCount + ' opérations appliquées — v26.10 Multi-Ledger-Correction');
