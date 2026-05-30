// fix_multi_ledger_core_v2590.mjs
// v25.90 Multi-Ledger-Core — multi-sélection badges, realized mode, per-account balances, journal button
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
// OP 1 : Ajout des refs/computeds/méthodes multi-sélection
// ─────────────────────────────────────────────────────────────
replace('1) refs moisSelectionnes / anneesSelectionnees / cyclesReleveActifs / toggles',
`                    const releveActiveCycle = ref(null); // v23.20 : "6-2026" = Cycle Juin 2026, null = tout`,
`                    const releveActiveCycle = ref(null); // v23.20 : "6-2026" = Cycle Juin 2026, null = tout

                    // v25.90 Multi-Ledger-Core : multi-sélection mois × années (badges tactiles)
                    const moisSelectionnes = ref([]); // ex: [6,7] — vide = cycle courant par défaut
                    const anneesSelectionnees = ref([]); // ex: [2026] — vide = année courante
                    const cyclesReleveActifs = computed(() => {
                        const curM = moisBudgetaire.value.mois, curA = moisBudgetaire.value.an;
                        if (!moisSelectionnes.value.length && !anneesSelectionnees.value.length) return [];
                        const ms = moisSelectionnes.value.length > 0 ? moisSelectionnes.value.slice() : [curM];
                        const as = anneesSelectionnees.value.length > 0 ? anneesSelectionnees.value.slice() : [curA];
                        const combos = [];
                        as.forEach(a => ms.forEach(m => combos.push({ m: Number(m), a: Number(a) })));
                        combos.sort((x, y) => x.a !== y.a ? x.a - y.a : x.m - y.m);
                        return combos
                            .filter(c => c.a > curA || (c.a === curA && c.m >= curM))
                            .map(c => c.m + '-' + c.a);
                    });
                    const toggleMoisReleve = (m) => {
                        const i = moisSelectionnes.value.indexOf(m);
                        if (i >= 0) moisSelectionnes.value.splice(i, 1);
                        else moisSelectionnes.value.push(m);
                    };
                    const toggleAnneeReleve = (a) => {
                        const i = anneesSelectionnees.value.indexOf(a);
                        if (i >= 0) anneesSelectionnees.value.splice(i, 1);
                        else anneesSelectionnees.value.push(a);
                    };`);

// ─────────────────────────────────────────────────────────────
// OP 2 : _amt — ajout du mode 'realized'
// ─────────────────────────────────────────────────────────────
replace('2) _amt + mode realized',
`                            // montant d'un item simple (revenu / charge fixe) — bouclier + payé/théorique
                            const _amt = (item, baseVal) => {
                                const v = _effVal(item, baseVal, m);
                                if (v <= 0) return 0; // bouclier : flux inactif ce mois-là → exclu
                                if (mode === 'full') return Math.round(v * 100) / 100;
                                if (isItemPaid(item, v)) return 0;
                                const r = v - (getPaidAmount(item, v) || 0);
                                return r > 0 ? Math.round(r * 100) / 100 : 0;
                            };`,
`                            // montant d'un item simple (revenu / charge fixe) — bouclier + payé/théorique
                            const _amt = (item, baseVal) => {
                                const v = _effVal(item, baseVal, m);
                                if (v <= 0) return 0; // bouclier : flux inactif ce mois-là → exclu
                                if (mode === 'full') return Math.round(v * 100) / 100;
                                // v25.90 Multi-Ledger-Core : mode 'realized' = items déjà pointés (Assurance, Booking…)
                                if (mode === 'realized') return isItemPaid(item, v) ? Math.round(v * 100) / 100 : 0;
                                if (isItemPaid(item, v)) return 0;
                                const r = v - (getPaidAmount(item, v) || 0);
                                return r > 0 ? Math.round(r * 100) / 100 : 0;
                            };`);

// ─────────────────────────────────────────────────────────────
// OP 3 : chocs — ajout du mode 'realized'
// ─────────────────────────────────────────────────────────────
replace('3) chocs + mode realized',
`                            getDepensesCycle(m, a).forEach(dep => {
                                const due = Number(dep.montant || 0); if (!due) return;
                                let amt;
                                if (mode === 'full') amt = due;
                                else { if (isItemPaid(dep, due)) amt = 0; else { const r = due - (getPaidAmount(dep, due) || 0); amt = r > 0 ? r : 0; } }
                                bump(_normKey(dep.sourceCompte), 'choc', Math.round(amt * 100) / 100);
                            });`,
`                            getDepensesCycle(m, a).forEach(dep => {
                                const due = Number(dep.montant || 0); if (!due) return;
                                let amt;
                                if (mode === 'full') amt = due;
                                // v25.90 : mode 'realized' = dépense exceptionnelle déjà pointée
                                else if (mode === 'realized') { amt = isItemPaid(dep, due) ? due : 0; }
                                else { if (isItemPaid(dep, due)) amt = 0; else { const r = due - (getPaidAmount(dep, due) || 0); amt = r > 0 ? r : 0; } }
                                bump(_normKey(dep.sourceCompte), 'choc', Math.round(amt * 100) / 100);
                            });`);

// ─────────────────────────────────────────────────────────────
// OP 4 : épargne — mode 'realized'
// ─────────────────────────────────────────────────────────────
replace('4) épargne + mode realized',
`                            epArr.forEach(e => {
                                const v = _effVal(e, e.valeur, m); if (v <= 0) return;
                                // v25.70 Pilotage-Align : épargne pointée (cochée) → retirée du futur (mode 'remaining')
                                if (mode !== 'full' && isItemPaid(e, v)) return;
                                bump(_normKey(e.sourceCompte || 'courant'), 'epOut', v);
                                bump(e.linkedAccountId ? _normKey(e.linkedAccountId) : ('ep_' + e.id), 'epIn', v);
                            });`,
`                            epArr.forEach(e => {
                                const v = _effVal(e, e.valeur, m); if (v <= 0) return;
                                const _epPaid = isItemPaid(e, v);
                                // v25.90 : 'realized' = épargne déjà virée ; 'remaining' = à virer ; 'full' = tout
                                if (mode === 'realized' && !_epPaid) return;
                                if (mode === 'remaining' && _epPaid) return;
                                bump(_normKey(e.sourceCompte || 'courant'), 'epOut', v);
                                bump(e.linkedAccountId ? _normKey(e.linkedAccountId) : ('ep_' + e.id), 'epIn', v);
                            });`);

// ─────────────────────────────────────────────────────────────
// OP 5 : T0 — ajout du dictionnaire _soldesComptes
// ─────────────────────────────────────────────────────────────
replace('5) T0 + dictionnaire _soldesComptes',
`                        // ── T0 : solde réel du compte affiché (ou somme en Global) ──
                        let T0;
                        if (_rFiltres.length === 1) {
                            const _cpt = (comptes.value || []).find(c => ('cpt_' + c.id) === _rFiltres[0]);
                            T0 = _cpt ? (Number(_cpt.solde) || 0) : 0;
                        } else {
                            T0 = (comptes.value || []).reduce((s, c) => s + (Number(c.solde) || 0), 0);
                        }`,
`                        // ── T0 : solde réel du compte affiché (ou somme en Global) ──
                        let T0;
                        if (_rFiltres.length === 1) {
                            const _cpt = (comptes.value || []).find(c => ('cpt_' + c.id) === _rFiltres[0]);
                            T0 = _cpt ? (Number(_cpt.solde) || 0) : 0;
                        } else {
                            T0 = (comptes.value || []).reduce((s, c) => s + (Number(c.solde) || 0), 0);
                        }
                        // v25.90 Multi-Ledger-Core : dictionnaire des soldes par compte (vue Global = pas de somme)
                        const _soldesComptes = {};
                        if (_rFiltres.length === 0) {
                            (comptes.value || []).forEach(c => { _soldesComptes['cpt_' + c.id] = Number(c.solde) || 0; });
                        }`);

// ─────────────────────────────────────────────────────────────
// OP 6 : Réécriture complète sélection + chaînage + construction des entries
// ─────────────────────────────────────────────────────────────
replace('6) multi-cycle chaining + realized section + per-account balances',
`                        // ── Cycle sélectionné (clé "m-a") — défaut = cycle courant, jamais le passé ──
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
                        // v25.80 Master-Cycle-Sync : tri cyclique — jours ≥ jdp (27…31) avant jours 1…26
                        const _cSort = (j) => (j || 0) >= jdp ? (j || 0) - jdp : (j || 0) + (32 - jdp);
                        dispLegs.sort((x, y) => _cSort(x.jourPrevu) - _cSort(y.jourPrevu));

                        const entries = [];
                        entries.push({ type: 'initial', libelle: isCurrent ? "⏰ AUJOURD'HUI" : "🔮 Solde Initial Projeté", montant: opening, soldeApres: opening, jourPrevu: null, etat: isCurrent ? 't0' : 'projete' });
                        let solde = opening;
                        dispLegs.forEach(l => {
                            solde = Math.round((solde + (l.type === 'credit' ? l.montant : -l.montant)) * 100) / 100;
                            entries.push({ libelle: l.libelle, montant: l.montant, type: l.type, jourPrevu: l.jourPrevu, etat: 'prevu', soldeApres: solde });
                        });

                        return { entries, soldeAtterrissage: solde };
                    });`,
`                        // ── v25.90 Multi-Ledger-Core : cycles actifs (multi-sélection ou cycle courant) ──
                        const _mNL = ['','Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
                        const _cSort = (j) => (j || 0) >= jdp ? (j || 0) - jdp : (j || 0) + (32 - jdp);
                        const _rawCycles = cyclesReleveActifs.value;
                        const _activeCycles = _rawCycles.length > 0
                            ? _rawCycles.map(k => { const p = k.split('-').map(Number); return { m: p[0], a: p[1] }; })
                            : [{ m: curM, a: curA }];

                        // ── Chaînage T0 : avance jusqu'à l'ouverture du PREMIER cycle actif ──
                        let opening = T0;
                        { let _cm = curM, _ca = curA, _g = 0;
                          const _fc = _activeCycles[0];
                          while (!(_cm === _fc.m && _ca === _fc.a) && _g++ < 36) {
                              const _md = (_cm === curM && _ca === curA) ? 'remaining' : 'full';
                              opening = Math.round((opening + _netLegs(_mkLegs(_cm, _ca, _md))) * 100) / 100;
                              if (_cm === 12) { _cm = 1; _ca++; } else { _cm++; }
                          }
                        }

                        const entries = [];
                        let solde = opening;

                        for (let _ci = 0; _ci < _activeCycles.length; _ci++) {
                            const cyc = _activeCycles[_ci];
                            const isCurrent = (cyc.m === curM && cyc.a === curA);

                            // Séparateur inter-cycle (sauf le premier)
                            if (_ci > 0) {
                                entries.push({ type: 'cycle_sep', libelle: '📅 ' + _mNL[cyc.m] + ' ' + cyc.a, soldeApres: solde, jourPrevu: null });
                            }

                            // ── Section "Déjà Réalisé" (cycle courant uniquement) ──
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

                            // ── Ligne d'ouverture du cycle ──
                            entries.push({ type: 'initial', libelle: isCurrent ? "⏰ AUJOURD'HUI" : ("🔮 " + _mNL[cyc.m] + ' ' + cyc.a), montant: solde, soldeApres: solde, jourPrevu: null, etat: isCurrent ? 't0' : 'projete' });

                            // ── Flux du cycle (remaining si courant, full si futur) ──
                            const dispMode = isCurrent ? 'remaining' : 'full';
                            const dispLegs = _viewLegs(_mkLegs(cyc.m, cyc.a, dispMode));
                            dispLegs.sort((x, y) => _cSort(x.jourPrevu) - _cSort(y.jourPrevu));
                            dispLegs.forEach(l => {
                                const delta = l.type === 'credit' ? l.montant : -l.montant;
                                solde = Math.round((solde + delta) * 100) / 100;
                                let soldeCompteApres = null;
                                if (_rFiltres.length === 0 && _soldesComptes[l.account] !== undefined) {
                                    _soldesComptes[l.account] = Math.round((_soldesComptes[l.account] + delta) * 100) / 100;
                                    soldeCompteApres = _soldesComptes[l.account];
                                }
                                entries.push({ libelle: l.libelle, montant: l.montant, type: l.type, jourPrevu: l.jourPrevu, etat: 'prevu', soldeApres: solde, compteKey: l.account, soldeCompteApres });
                            });

                            // ── Avance vers le cycle suivant (cycles intermédiaires non affichés) ──
                            if (_ci < _activeCycles.length - 1) {
                                const nextCyc = _activeCycles[_ci + 1];
                                let _nm = cyc.m, _na = cyc.a, _g2 = 0;
                                if (_nm === 12) { _nm = 1; _na++; } else { _nm++; }
                                while (!(_nm === nextCyc.m && _na === nextCyc.a) && _g2++ < 36) {
                                    solde = Math.round((solde + _netLegs(_mkLegs(_nm, _na, 'full'))) * 100) / 100;
                                    if (_nm === 12) { _nm = 1; _na++; } else { _nm++; }
                                }
                            }
                        }

                        return { entries, soldeAtterrissage: solde };
                    });`);

// ─────────────────────────────────────────────────────────────
// OP 7 : Sélecteurs INLINE → badges multi-sélection
// ─────────────────────────────────────────────────────────────
replace('7) inline selectors → badges',
`                                        <!-- v25.80 Master-Cycle-Sync : deux sélecteurs larges Mois + Année -->
                                        <div class="flex items-center gap-2 ml-auto">
                                            <select :value="releveSelectedMois"
                                                @change="releveActiveCycle = $event.target.value + '-' + releveSelectedAn; releveAnneesFiltres = []; releveMoisFiltres = []"
                                                class="text-sm font-bold bg-white border-2 border-indigo-200 rounded-xl px-3 py-2 text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer shadow-sm">
                                                <option v-for="n in 12" :key="n" :value="n">{{ ['','Jan','Fév','Mar','Avr','Mai','Juin','Juil','Aoû','Sep','Oct','Nov','Déc'][n] }}</option>
                                            </select>
                                            <select :value="releveSelectedAn"
                                                @change="releveActiveCycle = releveSelectedMois + '-' + $event.target.value; releveAnneesFiltres = []; releveMoisFiltres = []"
                                                class="text-sm font-bold bg-white border-2 border-indigo-200 rounded-xl px-3 py-2 text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer shadow-sm">
                                                <option :value="moisBudgetaire.an">{{ moisBudgetaire.an }}</option>
                                                <option :value="moisBudgetaire.an + 1">{{ moisBudgetaire.an + 1 }}</option>
                                            </select>
                                        </div>`,
`                                        <!-- v25.90 Multi-Ledger-Core : badges multi-sélection mois × années -->
                                        <div class="flex flex-col gap-1.5 ml-auto items-end">
                                            <div class="flex flex-wrap gap-1 justify-end">
                                                <button v-for="n in 12" :key="n" @click.stop="toggleMoisReleve(n)"
                                                    :class="moisSelectionnes.includes(n) ? 'bg-indigo-600 text-white ring-1 ring-indigo-300' : 'bg-gray-100 text-gray-700 hover:bg-indigo-50 hover:text-indigo-700'"
                                                    class="px-2 py-1 rounded-lg text-[10px] font-black transition-all">
                                                    {{ ['','Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'][n] }}
                                                </button>
                                            </div>
                                            <div class="flex gap-1 justify-end">
                                                <button @click.stop="toggleAnneeReleve(moisBudgetaire.an)"
                                                    :class="anneesSelectionnees.includes(moisBudgetaire.an) ? 'bg-violet-600 text-white ring-1 ring-violet-300' : 'bg-gray-100 text-gray-700 hover:bg-violet-50 hover:text-violet-700'"
                                                    class="px-3 py-1 rounded-lg text-[10px] font-black transition-all">
                                                    {{ moisBudgetaire.an }}
                                                </button>
                                                <button @click.stop="toggleAnneeReleve(moisBudgetaire.an + 1)"
                                                    :class="anneesSelectionnees.includes(moisBudgetaire.an + 1) ? 'bg-violet-600 text-white ring-1 ring-violet-300' : 'bg-gray-100 text-gray-700 hover:bg-violet-50 hover:text-violet-700'"
                                                    class="px-3 py-1 rounded-lg text-[10px] font-black transition-all">
                                                    {{ moisBudgetaire.an + 1 }}
                                                </button>
                                            </div>
                                        </div>`);

// ─────────────────────────────────────────────────────────────
// OP 8 : Table INLINE → ajout cycle_sep / sep_realise / realise + badge compte
// ─────────────────────────────────────────────────────────────
replace('8) inline table rows + per-account badge',
`                                            <!-- v25.80 Master-Cycle-Sync : lignes futures traitées comme les autres (simulation sérieuse) -->
                                            <tr v-else :class="['border-b transition-all', e.type === 'credit' ? 'border-gray-100 bg-green-50/30 hover:bg-green-50/60' : 'border-gray-100 bg-white hover:bg-gray-50']">
                                                <td class="p-2 text-[10px] text-gray-600 font-bold whitespace-nowrap">{{ e.jourPrevu ? 'j.' + e.jourPrevu : '' }}</td>
                                                <td class="p-2 text-xs text-gray-700">{{ e.libelle }}</td>
                                                <td class="p-2 text-right font-bold text-green-600 text-xs tabular-nums">{{ e.type === 'credit' ? formatMAD(e.montant) : '' }}</td>
                                                <td class="p-2 text-right font-bold text-red-500 text-xs tabular-nums">{{ e.type === 'debit' ? formatMAD(e.montant) : '' }}</td>
                                                <td class="p-2 text-right font-black text-xs tabular-nums" :class="e.soldeApres < 0 ? 'text-red-600' : 'text-gray-800'">{{ formatMAD(e.soldeApres) }}</td>
                                            </tr>`,
`                                            <!-- v25.90 Multi-Ledger-Core : séparateur de cycle (multi-cycle) -->
                                            <tr v-else-if="e.type === 'cycle_sep'" class="bg-indigo-50 border-y-2 border-indigo-300">
                                                <td colspan="5" class="py-1.5 px-3 text-center">
                                                    <span class="text-[10px] font-black uppercase tracking-widest text-indigo-700">{{ e.libelle }}</span>
                                                    <span class="text-[10px] font-bold text-indigo-500 ml-2">Solde entrée : {{ formatMAD(e.soldeApres) }}</span>
                                                </td>
                                            </tr>
                                            <!-- v25.90 : séparateur "Déjà Réalisé" -->
                                            <tr v-else-if="e.type === 'sep_realise'" class="bg-emerald-50 border-y border-emerald-300">
                                                <td colspan="5" class="py-1 px-3 text-center">
                                                    <span class="text-[10px] font-black uppercase tracking-widest text-emerald-700">{{ e.libelle }}</span>
                                                </td>
                                            </tr>
                                            <!-- v25.90 : ligne réalisée (rentrée/dépense déjà pointée — Booking, Assurance…) -->
                                            <tr v-else-if="e.etat === 'realise'" :class="['border-b', e.type === 'credit' ? 'border-emerald-100 bg-emerald-50/50' : 'border-orange-100 bg-orange-50/40']">
                                                <td class="p-2 text-[10px] text-emerald-700 font-black whitespace-nowrap">{{ e.jourPrevu ? 'j.' + e.jourPrevu : '✓' }}</td>
                                                <td class="p-2 text-xs text-gray-900 font-medium">
                                                    <span v-if="releveComptesFiltres.length === 0 && e.compteKey" class="inline-block text-[8px] font-black bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded mr-1 align-middle">{{ (comptes.find(c => 'cpt_'+c.id === e.compteKey)||{}).nom || e.compteKey }}</span>{{ e.libelle }}
                                                </td>
                                                <td class="p-2 text-right font-black text-emerald-700 text-xs tabular-nums">{{ e.type === 'credit' ? formatMAD(e.montant) : '' }}</td>
                                                <td class="p-2 text-right font-black text-orange-600 text-xs tabular-nums">{{ e.type === 'debit' ? formatMAD(e.montant) : '' }}</td>
                                                <td class="p-2 text-right text-xs text-gray-600 tabular-nums">—</td>
                                            </tr>
                                            <!-- v25.90 Multi-Ledger-Core : ligne standard (avec badge compte en vue Global + solde par compte) -->
                                            <tr v-else :class="['border-b transition-all', e.type === 'credit' ? 'border-gray-100 bg-green-50/30 hover:bg-green-50/60' : 'border-gray-100 bg-white hover:bg-gray-50']">
                                                <td class="p-2 text-[10px] text-gray-900 font-black whitespace-nowrap">{{ e.jourPrevu ? 'j.' + e.jourPrevu : '' }}</td>
                                                <td class="p-2 text-xs text-gray-900 font-medium">
                                                    <span v-if="releveComptesFiltres.length === 0 && e.compteKey" class="inline-block text-[8px] font-black bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded mr-1 align-middle">{{ (comptes.find(c => 'cpt_'+c.id === e.compteKey)||{}).nom || e.compteKey }}</span>{{ e.libelle }}
                                                </td>
                                                <td class="p-2 text-right font-black text-green-700 text-xs tabular-nums">{{ e.type === 'credit' ? formatMAD(e.montant) : '' }}</td>
                                                <td class="p-2 text-right font-black text-red-600 text-xs tabular-nums">{{ e.type === 'debit' ? formatMAD(e.montant) : '' }}</td>
                                                <td class="p-2 text-right font-black text-xs tabular-nums" :class="(e.soldeCompteApres ?? e.soldeApres) < 0 ? 'text-red-700' : 'text-gray-900'">{{ formatMAD(e.soldeCompteApres ?? e.soldeApres) }}</td>
                                            </tr>`);

// ─────────────────────────────────────────────────────────────
// OP 9 : Sélecteurs MODAL → badges multi-sélection
// ─────────────────────────────────────────────────────────────
replace('9) modal selectors → badges',
`                            <!-- v25.80 Master-Cycle-Sync : deux sélecteurs larges Mois + Année (remplace liste combinée) -->
                            <select :value="releveSelectedMois"
                                @change="releveActiveCycle = $event.target.value + '-' + releveSelectedAn; releveAnneesFiltres = []; releveMoisFiltres = []"
                                class="text-base font-bold bg-white border-2 border-indigo-200 rounded-xl px-4 py-2 text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer shadow-sm min-w-[7rem]">
                                <option v-for="n in 12" :key="n" :value="n">{{ ['','Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'][n] }}</option>
                            </select>
                            <select :value="releveSelectedAn"
                                @change="releveActiveCycle = releveSelectedMois + '-' + $event.target.value; releveAnneesFiltres = []; releveMoisFiltres = []"
                                class="text-base font-bold bg-white border-2 border-indigo-200 rounded-xl px-4 py-2 text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer shadow-sm">
                                <option :value="moisBudgetaire.an">{{ moisBudgetaire.an }}</option>
                                <option :value="moisBudgetaire.an + 1">{{ moisBudgetaire.an + 1 }}</option>
                            </select>`,
`                            <!-- v25.90 Multi-Ledger-Core : badges multi-sélection mois × années -->
                            <div class="flex flex-col gap-1.5 items-end">
                                <div class="flex flex-wrap gap-1 justify-end max-w-xs">
                                    <button v-for="n in 12" :key="n" @click="toggleMoisReleve(n)"
                                        :class="moisSelectionnes.includes(n) ? 'bg-indigo-600 text-white ring-1 ring-indigo-300' : 'bg-gray-100 text-gray-700 hover:bg-indigo-50 hover:text-indigo-700'"
                                        class="px-2.5 py-1 rounded-lg text-[11px] font-black transition-all">
                                        {{ ['','Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'][n] }}
                                    </button>
                                </div>
                                <div class="flex gap-1 justify-end">
                                    <button @click="toggleAnneeReleve(moisBudgetaire.an)"
                                        :class="anneesSelectionnees.includes(moisBudgetaire.an) ? 'bg-violet-600 text-white ring-1 ring-violet-300' : 'bg-gray-100 text-gray-700 hover:bg-violet-50 hover:text-violet-700'"
                                        class="px-3 py-1 rounded-lg text-[11px] font-black transition-all">
                                        {{ moisBudgetaire.an }}
                                    </button>
                                    <button @click="toggleAnneeReleve(moisBudgetaire.an + 1)"
                                        :class="anneesSelectionnees.includes(moisBudgetaire.an + 1) ? 'bg-violet-600 text-white ring-1 ring-violet-300' : 'bg-gray-100 text-gray-700 hover:bg-violet-50 hover:text-violet-700'"
                                        class="px-3 py-1 rounded-lg text-[11px] font-black transition-all">
                                        {{ moisBudgetaire.an + 1 }}
                                    </button>
                                </div>
                            </div>`);

// ─────────────────────────────────────────────────────────────
// OP 10 : Table MODAL → ajout cycle_sep / sep_realise / realise + badge compte
// ─────────────────────────────────────────────────────────────
replace('10) modal table rows + per-account badge',
`                                <!-- v25.80 Master-Cycle-Sync : lignes futures traitées comme les autres (simulation sérieuse) -->
                                <tr v-else :class="['border-b transition-all', e.type === 'credit' ? 'border-gray-100 bg-green-50/30 hover:bg-green-50/60' : 'border-gray-100 bg-white hover:bg-gray-50']">
                                    <td class="p-2 text-[10px] text-gray-600 font-bold whitespace-nowrap">{{ e.jourPrevu ? 'j.' + e.jourPrevu : '' }}</td>
                                    <td class="p-2 text-xs text-gray-700">{{ e.libelle }}</td>
                                    <td class="p-2 text-right font-bold text-green-600 text-xs tabular-nums">{{ e.type === 'credit' ? formatMAD(e.montant) : '' }}</td>
                                    <td class="p-2 text-right font-bold text-red-500 text-xs tabular-nums">{{ e.type === 'debit' ? formatMAD(e.montant) : '' }}</td>
                                    <td class="p-2 text-right font-black text-xs tabular-nums" :class="e.soldeApres < 0 ? 'text-red-600' : 'text-gray-800'">{{ formatMAD(e.soldeApres) }}</td>
                                </tr>`,
`                                <!-- v25.90 Multi-Ledger-Core : séparateur de cycle -->
                                <tr v-else-if="e.type === 'cycle_sep'" class="bg-indigo-50 border-y-2 border-indigo-300">
                                    <td colspan="5" class="py-1.5 px-4 text-center">
                                        <span class="text-[10px] font-black uppercase tracking-widest text-indigo-700">{{ e.libelle }}</span>
                                        <span class="text-[10px] font-bold text-indigo-500 ml-2">Solde entrée : {{ formatMAD(e.soldeApres) }}</span>
                                    </td>
                                </tr>
                                <!-- v25.90 : séparateur "Déjà Réalisé" -->
                                <tr v-else-if="e.type === 'sep_realise'" class="bg-emerald-50 border-y border-emerald-300">
                                    <td colspan="5" class="py-1.5 px-4 text-center">
                                        <span class="text-[10px] font-black uppercase tracking-widest text-emerald-700">{{ e.libelle }}</span>
                                    </td>
                                </tr>
                                <!-- v25.90 : ligne réalisée (Booking / Assurance / charges pointées) -->
                                <tr v-else-if="e.etat === 'realise'" :class="['border-b', e.type === 'credit' ? 'border-emerald-100 bg-emerald-50/50' : 'border-orange-100 bg-orange-50/40']">
                                    <td class="p-2 text-[10px] text-emerald-700 font-black whitespace-nowrap">{{ e.jourPrevu ? 'j.' + e.jourPrevu : '✓' }}</td>
                                    <td class="p-2 text-xs text-gray-900 font-medium">
                                        <span v-if="releveComptesFiltres.length === 0 && e.compteKey" class="inline-block text-[8px] font-black bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded mr-1 align-middle">{{ (comptes.find(c => 'cpt_'+c.id === e.compteKey)||{}).nom || e.compteKey }}</span>{{ e.libelle }}
                                    </td>
                                    <td class="p-2 text-right font-black text-emerald-700 text-xs tabular-nums">{{ e.type === 'credit' ? formatMAD(e.montant) : '' }}</td>
                                    <td class="p-2 text-right font-black text-orange-600 text-xs tabular-nums">{{ e.type === 'debit' ? formatMAD(e.montant) : '' }}</td>
                                    <td class="p-2 text-right text-xs text-gray-600 tabular-nums">—</td>
                                </tr>
                                <!-- v25.90 Multi-Ledger-Core : ligne standard avec badge compte (vue Global) + solde par compte -->
                                <tr v-else :class="['border-b transition-all', e.type === 'credit' ? 'border-gray-100 bg-green-50/30 hover:bg-green-50/60' : 'border-gray-100 bg-white hover:bg-gray-50']">
                                    <td class="p-2 text-[10px] text-gray-900 font-black whitespace-nowrap">{{ e.jourPrevu ? 'j.' + e.jourPrevu : '' }}</td>
                                    <td class="p-2 text-xs text-gray-900 font-medium">
                                        <span v-if="releveComptesFiltres.length === 0 && e.compteKey" class="inline-block text-[8px] font-black bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded mr-1 align-middle">{{ (comptes.find(c => 'cpt_'+c.id === e.compteKey)||{}).nom || e.compteKey }}</span>{{ e.libelle }}
                                    </td>
                                    <td class="p-2 text-right font-black text-green-700 text-xs tabular-nums">{{ e.type === 'credit' ? formatMAD(e.montant) : '' }}</td>
                                    <td class="p-2 text-right font-black text-red-600 text-xs tabular-nums">{{ e.type === 'debit' ? formatMAD(e.montant) : '' }}</td>
                                    <td class="p-2 text-right font-black text-xs tabular-nums" :class="(e.soldeCompteApres ?? e.soldeApres) < 0 ? 'text-red-700' : 'text-gray-900'">{{ formatMAD(e.soldeCompteApres ?? e.soldeApres) }}</td>
                                </tr>`);

// ─────────────────────────────────────────────────────────────
// OP 11 : Bouton "📑 Ouvrir le Journal" dans header Pilotage
// ─────────────────────────────────────────────────────────────
replace('11) bouton Ouvrir le Journal — Pilotage header',
`                            <span v-if="isPilotageRetro" class="text-[9px] font-bold text-amber-400 shrink-0">⚠️ Rétro</span>
                        </div>
                        <!-- Bannière Mode Régularisation -->`,
`                            <span v-if="isPilotageRetro" class="text-[9px] font-bold text-amber-400 shrink-0">⚠️ Rétro</span>
                        </div>
                        <!-- v25.90 Multi-Ledger-Core : accès rapide au Journal / Relevé depuis le Pilotage -->
                        <button @click="ouvrirReleve()" class="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-900/30 border border-indigo-400/40">
                            <span class="text-base">📑</span>
                            <span>Ouvrir le Journal / Relevé</span>
                        </button>
                        <!-- Bannière Mode Régularisation -->`);

// ─────────────────────────────────────────────────────────────
// OP 12 : Setup return — expose nouveaux refs/computeds/méthodes
// ─────────────────────────────────────────────────────────────
replace('12) setup return — multi-ledger exports',
`                        journalHybridePourReleve, releveProjectionLabel, releveCyclesFuturs, releveSelectedMois, releveSelectedAn,`,
`                        journalHybridePourReleve, releveProjectionLabel, releveCyclesFuturs, releveSelectedMois, releveSelectedAn,
                        // v25.90 Multi-Ledger-Core
                        moisSelectionnes, anneesSelectionnees, cyclesReleveActifs, toggleMoisReleve, toggleAnneeReleve,`);

// ─────────────────────────────────────────────────────────────
// OP 13 : Version bump + changelog
// ─────────────────────────────────────────────────────────────
replace('13) version + changelog',
`                    const CURRENT_VERSION = "25.80 Master-Cycle-Sync";
                    const CHANGELOG = [
        { version: "25.80 Master-Cycle-Sync", date: "2026-05-30", changes: [`,
`                    const CURRENT_VERSION = "25.90 Multi-Ledger-Core";
                    const CHANGELOG = [
        { version: "25.90 Multi-Ledger-Core", date: "2026-05-30", changes: [
            "Relevé : multi-sélection mois × années par badges tactiles (moisSelectionnes / anneesSelectionnees) — l'utilisateur peut combiner Juin + Juillet + 2026 pour chaîner plusieurs cycles dans le même journal",
            "Journal : intégration des rentrées DÉJÀ POINTÉES (Assurance, Booking…) en section ✅ Déjà Réalisé avant la ligne ⏰ AUJOURD'HUI — nouveau mode 'realized' dans _mkLegs (revenus + charges fixes + variables + chocs + épargne)",
            "Vue Global : dictionnaire _soldesComptes par compte individuel — fin de la somme abusive entre Compte Courant + Crédit Immo + Épargne sur une même colonne. Chaque ligne affiche un badge identifiant son compte d'origine + son solde spécifique après transaction",
            "Typographie épurée : suppression des opacités réduites et des gris clairs — tout le journal en noir intense (text-gray-900, font-black) pour une lisibilité maximale",
            "Pilotage : bouton large 📑 Ouvrir le Journal / Relevé dans le header — bascule rapide vers la modale du relevé",
            "Séparateur visuel inter-cycle (📅 Juillet 2026) quand plusieurs mois sont sélectionnés, avec solde d'entrée annoncé",
            "Note de version : demande intitulée V25.70 — numérotée 25.90 pour rester monotone (25.50/25.60/25.70/25.80 déjà publiées)"
        ] },
        { version: "25.80 Master-Cycle-Sync", date: "2026-05-30", changes: [`);

// ─────────────────────────────────────────────────────────────
// Écriture finale (CRLF)
// ─────────────────────────────────────────────────────────────
fs.writeFileSync(FILE, html.replace(/\n/g, '\r\n'), 'utf8');
console.log('\n✅ ' + opCount + ' opérations appliquées — v25.90 Multi-Ledger-Core');
