// fix_inflows_radar_v2598.mjs
// v25.98 Inflows-Radar-Fix — radar asymétrique (revenus encaissés only) + T0 multi-ledger par compte
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
// OP 1 : _mkLegs — revenus : nouvelle branche 'realized-in' (revenu encaissé paye:true, dégroupé)
// ─────────────────────────────────────────────────────────────
replace('1) _mkLegs revenus — branche realized-in',
`                            // Revenus → destinationCompte (crédit) — UNE LIGNE PAR REVENU (libellé + date + montant propres)
                            Object.values(dA.revenus || {}).forEach(r => {
                                const amt = _amt(r, r.base);
                                if (amt > 0) out.push({ account: _normKey(r.destinationCompte), libelle: '💰 ' + (r.label || r.nom || 'Revenu'), montant: amt, type: 'credit', jourPrevu: Number(r.jourPrevu || jdp), internal: false });
                            });`,
`                            // Revenus → destinationCompte (crédit) — UNE LIGNE PAR REVENU (libellé + date + montant propres)
                            Object.values(dA.revenus || {}).forEach(r => {
                                // v25.98 Inflows-Radar-Fix : mode 'realized-in' = UNIQUEMENT les revenus déjà encaissés (paye:true), dégroupés
                                if (mode === 'realized-in') {
                                    const v = _effVal(r, r.base, m);
                                    if (v <= 0 || !isItemPaid(r, v)) return; // non encaissé → ignoré (radar asymétrique)
                                    const paid = Math.round((getPaidAmount(r, v) || v) * 100) / 100;
                                    if (paid > 0) out.push({ account: _normKey(r.destinationCompte), libelle: '💰 ' + (r.label || r.nom || 'Revenu'), montant: paid, type: 'credit', jourPrevu: Number(r.jourPrevu || jdp), internal: false });
                                    return;
                                }
                                const amt = _amt(r, r.base);
                                if (amt > 0) out.push({ account: _normKey(r.destinationCompte), libelle: '💰 ' + (r.label || r.nom || 'Revenu'), montant: amt, type: 'credit', jourPrevu: Number(r.jourPrevu || jdp), internal: false });
                            });`);

// ─────────────────────────────────────────────────────────────
// OP 2 : _mkLegs — CENSURE des sorties en mode 'realized-in' (charges fixes / variables / dépenses / épargne)
// ─────────────────────────────────────────────────────────────
replace('2a) censure sorties — charges fixes',
`                            Object.values(dA.chargesFixes || {}).forEach(f => {
                                const amt = _amt(f, f.valeur);`,
`                            Object.values(dA.chargesFixes || {}).forEach(f => {
                                if (mode === 'realized-in') return; // v25.98 : AUCUNE sortie dans le passé
                                const amt = _amt(f, f.valeur);`);

replace('2b) censure sorties — charges variables',
`                            Object.values(dA.chargesVariables || {}).forEach(cv => {
                                const amt = _varAmt(cv);`,
`                            Object.values(dA.chargesVariables || {}).forEach(cv => {
                                if (mode === 'realized-in') return; // v25.98 : AUCUNE sortie dans le passé
                                const amt = _varAmt(cv);`);

replace('2c) censure sorties — dépenses exceptionnelles',
`                            getDepensesCycle(m, a).forEach(dep => {
                                const due = Number(dep.montant || 0); if (!due) return;`,
`                            getDepensesCycle(m, a).forEach(dep => {
                                if (mode === 'realized-in') return; // v25.98 : AUCUNE sortie dans le passé
                                const due = Number(dep.montant || 0); if (!due) return;`);

replace('2d) censure sorties — épargne',
`                            epArr.forEach(e => {
                                const v = _effVal(e, e.valeur, m); if (v <= 0) return;`,
`                            epArr.forEach(e => {
                                if (mode === 'realized-in') return; // v25.98 : l'épargne est un transfert, jamais un revenu encaissé
                                const v = _effVal(e, e.valeur, m); if (v <= 0) return;`);

// ─────────────────────────────────────────────────────────────
// OP 3 : Section "Déjà Encaissé" (revenus only) + T0 multi-ledger PAR COMPTE en vue Global
// ─────────────────────────────────────────────────────────────
replace('3) section Déjà Encaissé + T0 par compte',
`                            // ── v25.97 Strict-Radar : AUCUN passé — la 1re ligne du cycle courant est ⏰ AUJOURD'HUI ──
                            // ── Ligne d'ouverture du cycle ──
                            entries.push({ type: 'initial', libelle: isCurrent ? "⏰ AUJOURD'HUI" : ("🔮 " + _mNL[cyc.m] + ' ' + cyc.a), montant: solde, soldeApres: solde, jourPrevu: null, etat: isCurrent ? 't0' : 'projete' });`,
`                            // ── v25.98 Inflows-Radar-Fix : Radar ASYMÉTRIQUE — uniquement les REVENUS déjà encaissés (paye:true), dégroupés, AVANT la ligne T0 ──
                            if (isCurrent) {
                                const inLegs = _viewLegs(_mkLegs(cyc.m, cyc.a, 'realized-in'));
                                inLegs.sort((x, y) => _cSort(x.jourPrevu) - _cSort(y.jourPrevu));
                                if (inLegs.length > 0) {
                                    entries.push({ type: 'sep_realise', libelle: '✅ Déjà Encaissé ce cycle', soldeApres: solde, jourPrevu: null });
                                    inLegs.forEach(l => {
                                        entries.push({ libelle: l.libelle, montant: l.montant, type: l.type, jourPrevu: l.jourPrevu, etat: 'realise', soldeApres: solde, compteKey: l.account, soldeCompteApres: null });
                                    });
                                }
                            }

                            // ── Ligne(s) d'ouverture du cycle ──
                            if (_rFiltres.length === 0 && isCurrent) {
                                // v25.98 : vue Global → UNE ligne ⏰ AUJOURD'HUI PAR COMPTE (soldes strictement isolés, jamais additionnés)
                                (comptes.value || []).forEach(c => {
                                    const _s = Number(c.solde); const _sv = Number.isFinite(_s) ? _s : 0;
                                    entries.push({ type: 'initial', libelle: "⏰ AUJOURD'HUI", montant: _sv, soldeApres: _sv, jourPrevu: null, etat: 't0', compteKey: 'cpt_' + c.id, soldeCompteApres: _sv });
                                });
                                const _ep0 = Array.isArray((donneesAnnuelles.value[cyc.a] || {}).epargne) ? donneesAnnuelles.value[cyc.a].epargne : Object.values((donneesAnnuelles.value[cyc.a] || {}).epargne || {});
                                _ep0.forEach(e => {
                                    const _s = Number(e.valeur); const _sv = Number.isFinite(_s) ? _s : 0;
                                    entries.push({ type: 'initial', libelle: "⏰ AUJOURD'HUI", montant: _sv, soldeApres: _sv, jourPrevu: null, etat: 't0', compteKey: 'ep_' + e.id, soldeCompteApres: _sv });
                                });
                            } else {
                                entries.push({ type: 'initial', libelle: isCurrent ? "⏰ AUJOURD'HUI" : ("🔮 " + _mNL[cyc.m] + ' ' + cyc.a), montant: solde, soldeApres: solde, jourPrevu: null, etat: isCurrent ? 't0' : 'projete' });
                            }`);

// ─────────────────────────────────────────────────────────────
// OP 4 : template ligne 'initial' INLINE → badge compte + solde isolé
// ─────────────────────────────────────────────────────────────
replace('4) template initial inline — badge + solde isolé',
`                                            <tr v-else-if="e.type === 'initial'" class="bg-blue-50 border-b-2 border-blue-300">
                                                <td class="p-2 text-[10px] font-bold text-blue-400">{{ e.jourPrevu ? 'J.' + e.jourPrevu : '' }}</td>
                                                <td colspan="3" class="p-2 text-xs font-black text-blue-700 uppercase tracking-wider">{{ e.libelle }}</td>
                                                <td class="p-2 text-right font-black text-xs tabular-nums text-blue-700">{{ formatMAD(e.soldeApres) }}</td>
                                            </tr>`,
`                                            <tr v-else-if="e.type === 'initial'" class="bg-blue-50 border-b-2 border-blue-300">
                                                <td class="p-2 text-[10px] font-bold text-blue-400">{{ e.jourPrevu ? 'J.' + e.jourPrevu : '' }}</td>
                                                <td colspan="3" class="p-2 text-xs font-black text-blue-700 uppercase tracking-wider"><span v-if="releveComptesFiltres.length === 0 && e.compteKey" class="inline-block text-[8px] font-black bg-blue-200 text-blue-900 px-1.5 py-0.5 rounded mr-1 align-middle normal-case tracking-normal">{{ getNomCompte(e.compteKey) }}</span>{{ e.libelle }}</td>
                                                <td class="p-2 text-right font-black text-xs tabular-nums text-blue-700">{{ formatMAD(e.soldeCompteApres ?? e.soldeApres) }}</td>
                                            </tr>`);

// ─────────────────────────────────────────────────────────────
// OP 5 : template ligne 'initial' MODAL → badge compte + solde isolé
// ─────────────────────────────────────────────────────────────
replace('5) template initial modal — badge + solde isolé',
`                                <tr v-else-if="e.type === 'initial'" class="bg-blue-50 border-b-2 border-blue-300">
                                    <td class="p-2 text-[10px] font-bold text-blue-400">{{ e.jourPrevu ? 'J.' + e.jourPrevu : '' }}</td>
                                    <td colspan="3" class="p-2 text-xs font-black text-blue-700 uppercase tracking-wider">{{ e.libelle }}</td>
                                    <td class="p-2 text-right font-black text-xs tabular-nums text-blue-700">{{ formatMAD(e.soldeApres) }}</td>
                                </tr>`,
`                                <tr v-else-if="e.type === 'initial'" class="bg-blue-50 border-b-2 border-blue-300">
                                    <td class="p-2 text-[10px] font-bold text-blue-400">{{ e.jourPrevu ? 'J.' + e.jourPrevu : '' }}</td>
                                    <td colspan="3" class="p-2 text-xs font-black text-blue-700 uppercase tracking-wider"><span v-if="releveComptesFiltres.length === 0 && e.compteKey" class="inline-block text-[8px] font-black bg-blue-200 text-blue-900 px-1.5 py-0.5 rounded mr-1 align-middle normal-case tracking-normal">{{ getNomCompte(e.compteKey) }}</span>{{ e.libelle }}</td>
                                    <td class="p-2 text-right font-black text-xs tabular-nums text-blue-700">{{ formatMAD(e.soldeCompteApres ?? e.soldeApres) }}</td>
                                </tr>`);

// ─────────────────────────────────────────────────────────────
// OP 6 : Version + changelog
// ─────────────────────────────────────────────────────────────
replace('6) version + changelog',
`                    const CURRENT_VERSION = "25.97 Strict-Radar";
                    const CHANGELOG = [
        { version: "25.97 Strict-Radar", date: "2026-05-30", changes: [`,
`                    const CURRENT_VERSION = "25.98 Inflows-Radar-Fix";
                    const CHANGELOG = [
        { version: "25.98 Inflows-Radar-Fix", date: "2026-05-30", changes: [
            "RADAR ASYMÉTRIQUE : la section ✅ Déjà Encaissé (avant T0) n'affiche QUE les revenus encaissés (paye:true), chacun sur sa propre ligne dégroupée (libellé + date + montant propres) — nouveau mode 'realized-in' dans _mkLegs",
            "CENSURE des sorties passées : aucune charge fixe/variable, dépense ou épargne pointée (paye:true) n'apparaît dans le passé — leur impact est déjà dans le solde réel d'aujourd'hui",
            "SÉPARATION STRICTE T0 (vue Global) : la ligne ⏰ AUJOURD'HUI est désormais éclatée en UNE ligne PAR COMPTE (Courant, autres comptes, Épargne) avec son solde strictement isolé — fini l'addition fusionnée des patrimoines",
            "Les lignes ⏰ AUJOURD'HUI affichent le badge du compte et son solde isolé (soldeCompteApres) en vue Global",
            "Note de version : demande intitulée V25.98 — numérotée 25.98 (continuité après 25.97)"
        ] },
        { version: "25.97 Strict-Radar", date: "2026-05-30", changes: [`);

// ─────────────────────────────────────────────────────────────
fs.writeFileSync(FILE, html.replace(/\n/g, '\r\n'), 'utf8');
console.log('\n✅ ' + opCount + ' opérations appliquées — v25.98 Inflows-Radar-Fix');
