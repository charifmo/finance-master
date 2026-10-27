#!/usr/bin/env python3
"""v37.67 — LE CFO LIT, IL NE CALCULE PLUS.

« Pourquoi le CFO se trompe ? D'où il prend ces infos ? Pourquoi il dit que toutes ces charges
sont prises du compte courant alors que non ? » — le résumé envoyé au CFO (_buildPayloadCFO)
lisait `sourceCompte`, un champ mort depuis la v20 (les charges suivent le compte par défaut de
leur nature, ou leur propre `compte`) : il valait « courant » sur chaque ligne. Il donnait aussi
le montant de base sans les exceptions (un crédit suspendu toute l’année comptait encore) et le montant « par
semaine » brut, que le modèle multipliait par 4,33.

  1. _lectureCFO() : chaque ligne avec le compte du moteur (compteDeFlux), le montant de CE
     cycle (exceptions comprises), le budget du cycle des charges variables (jours ÷ 7), les
     épargnes (depuis → vers) ; et « alimentation_du_courant » : pour le cycle en cours et les
     3 suivants, ce que le Courant encaisse lui-même, ce qui en sort, et le virement à faire
     depuis le compte du salaire — lu dans le journal du Relevé, au dirham.
  2. Telegram lit le JSON brut du serveur : la même lecture y est enregistrée (_lectureCFO).
  3. Schéma 22 : le champ mort `sourceCompte` est retiré des charges fixes et variables.
  4. Annuler : 50 pas, et la pile survit au rechargement de la page (IndexedDB), tant que les
     données chargées sont celles du dernier pas.
"""
import io, sys

F = 'index.html'
src = io.open(F, encoding='utf-8').read()

def sub(label, old, new, n=1):
    global src
    c = src.count(old)
    if c != n:
        print(f'✖ {label} : {c} ancre(s), {n} attendue(s)'); sys.exit(1)
    src = src.replace(old, new)

# ── 1. La lecture du CFO ────────────────────────────────────────────────────
sub('payload : revenus / charges',
"""                        // 2. Revenus fixes (label + montant mensuel uniquement — sans exceptions)
                        const revenus_fixes = Object.entries(data.revenus || {}).map(([k, v]) => ({
                            id: k,
                            label: v.label || k,
                            montant_mensuel: Number(v.base || 0),
                            destination: _getLabel(v.destinationCompte || 'courant'),
                        }));

                        // 3. Charges fixes (label + montant — sans historique d'exceptions)
                        const charges_fixes = Object.entries(data.chargesFixes || {}).map(([k, v]) => ({
                            id: k,
                            label: v.label || k,
                            montant_mensuel: Number(v.valeur || 0),
                            compte_source: _getLabel(v.sourceCompte || 'courant'),
                        }));

                        // 4. Charges variables
                        const charges_variables = Object.entries(data.chargesVariables || {}).map(([k, v]) => ({
                            id: k,
                            label: v.label || k,
                            montant_mensuel: Number(v.valeur || 0),
                            periode: v.periode || 'mois',
                            compte_source: _getLabel(v.sourceCompte || 'courant'),
                        }));
""",
"""                        // 2-4. v37.67 : revenus, charges, épargnes et alimentation du Courant — la lecture
                        //   du moteur (_lectureCFO) : le bon compte, le montant de CE cycle, le budget du cycle.
                        const lecture = _lectureCFO();
                        const { revenus_fixes, charges_fixes, charges_variables } = lecture;
""")

sub('payload : instruction et clés',
"""                            instruction_lecture: 'La clé matrice_cash_flow_calculee contient les soldes RÉELS calculés par le moteur Vue.js. Tous les montants y sont déjà prélevés sur le bon compte. Les evenements_exceptionnels sont fournis à titre informatif uniquement — ils sont DÉJÀ inclus dans la matrice. Ne jamais recalculer.',
                            matrice_cash_flow_calculee,""",
"""                            instruction_lecture: 'La clé matrice_cash_flow_calculee contient les soldes RÉELS calculés par le moteur Vue.js. Tous les montants y sont déjà prélevés sur le bon compte. Les evenements_exceptionnels sont fournis à titre informatif uniquement — ils sont DÉJÀ inclus dans la matrice. Ne jamais recalculer. ' + lecture.regle,
                            cycle_en_cours: lecture.cycle_en_cours,
                            alimentation_du_courant: lecture.alimentation_du_courant,
                            epargne_recurrente: lecture.epargne_recurrente,
                            matrice_cash_flow_calculee,""")

sub('lectureCFO : définition',
"""                    const _buildPayloadCFO = () => {""",
"""                    /*  v37.67 — LE CFO LIT, IL NE CALCULE PLUS.
                        Le résumé lisait `sourceCompte`, champ mort depuis la v20 (« courant » sur chaque
                        ligne : « toutes ces charges sont prises du compte courant alors que non »), le
                        montant de base sans exceptions (un crédit suspendu toute l’année comptait encore) et le montant
                        « / semaine » brut, que le modèle multipliait par 4,33. Ici, tout vient du moteur :
                        le compte (compteDeFlux), le montant de CE cycle, le budget du cycle (jours ÷ 7),
                        et ce que le Courant doit recevoir, cycle par cycle, lu dans le journal du Relevé. */
                    const _lectureCFO = () => {
                        const mb = moisBudgetaire.value, an = mb.an, m = mb.mois;
                        const dC = (donneesAnnuelles.value || {})[an] || {};
                        const nom = (k) => getNomCompte(k);
                        const jdp = Number((soldesInitiaux.value || {}).jourDePaie) || 27;
                        const MOIS = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
                        const libJ = (d) => d.getDate() + ' ' + _MOIS_COURTS[d.getMonth()] + ' ' + d.getFullYear();
                        const cycle = (mm, aa) => MOIS[mm] + ' ' + aa + ' (du ' + libJ(new Date(aa, mm - 2, jdp)) + ' au ' + libJ(new Date(aa, mm - 1, jdp - 1)) + ')';
                        const RYTHMES = { semaine: 'par semaine', quinzaine: 'toutes les 2 semaines', cycle: 'une fois par cycle', mois: 'par mois' };
                        const revenus_fixes = Object.entries(dC.revenus || {}).filter(([, v]) => v).map(([k, v]) => ({
                            id: k, label: v.label || k, montant_ce_cycle: Math.round(getDueRevenu(v, an, m)), montant_habituel: Number(v.base || 0),
                            arrive_sur: nom(compteDeFlux('revenu', v)),
                        }));
                        const charges_fixes = Object.entries(dC.chargesFixes || {}).filter(([, v]) => v).map(([k, v]) => ({
                            id: k, label: v.label || k, montant_ce_cycle: Math.round(getDueFixe(v, an, m)), montant_habituel: Number(v.valeur || 0),
                            payee_depuis: nom(compteDeFlux('fixe', v)),
                        }));
                        const charges_variables = Object.entries(dC.chargesVariables || {}).filter(([, v]) => v).map(([k, v]) => ({
                            id: k, label: v.label || k, budget_ce_cycle: Math.round(budgetCategorieRevise(v)), payee_depuis: nom(compteDeFlux('variable', v)),
                            postes: (v.details || []).filter(Boolean).map(p => ({ nom: p.nom || '?', montant: Number(p.montant || 0), rythme: RYTHMES[p.periode || v.periode || 'mois'] || (p.periode || v.periode) })),
                        }));
                        const epargne_recurrente = (Array.isArray(dC.epargne) ? dC.epargne : []).filter(Boolean).map(o => ({
                            label: o.nom || o.label || 'Épargne', montant_ce_cycle: Math.round(valeurEffective(o, o.valeur, m)), depuis: nom(compteDeFlux('epargne', o)),
                            vers: (o.linkedAccountId !== null && o.linkedAccountId !== undefined && o.linkedAccountId !== '') ? nom('cpt_' + o.linkedAccountId) : 'poche d’épargne (sans compte)',
                        }));
                        //  Le Courant, cycle par cycle : ce qu'il encaisse lui-même, ce qui en sort, ce qu'il
                        //  reçoit déjà par virement — et ce qu'il faut y virer depuis le compte du salaire.
                        const ck = cleDeCompte('courant');
                        const principal = (rv) => Object.values(rv || {}).filter(Boolean).sort((a, b) => Number(b.base || 0) - Number(a.base || 0))[0];
                        const sal = principal(dC.revenus), sk = sal ? compteDeFlux('revenu', sal) : null;
                        const flux = (mm, aa) => {
                            const cle = mm + '-' + aa, E = ((_buildJournalReleve([], [cle]) || {}).entries || []).filter(e => e.cycle === cle && (e.type === 'credit' || e.type === 'debit'));
                            const somme = (L, t) => Math.round(L.filter(e => e.type === t).reduce((s, e) => s + Math.abs(Number(e.montant) || 0), 0));
                            const vir = (e) => /^🔄/.test(String(e.libelle || ''));
                            const C = E.filter(e => e.compteKey === ck), S = (sk && sk !== ck) ? E.filter(e => e.compteKey === sk) : [];
                            const entrees_propres = somme(C.filter(e => !vir(e)), 'credit'), virements_deja_prevus = somme(C.filter(vir), 'credit'), sorties = somme(C, 'debit');
                            const top = C.filter(e => e.type === 'debit').sort((a, b) => Math.abs(b.montant) - Math.abs(a.montant)).slice(0, 8).map(e => e.libelle.replace(/^\\S+\\s/, '') + ' ' + Math.round(Math.abs(e.montant)));
                            return { cycle: cycle(mm, aa), entrees_propres_du_courant: entrees_propres, sorties_du_courant: sorties, virements_deja_prevus_vers_courant: virements_deja_prevus,
                                     a_virer_vers_courant: Math.max(0, sorties - entrees_propres - virements_deja_prevus), principales_sorties: top,
                                     ...(S.length ? { compte_du_salaire_entrees: somme(S, 'credit'), compte_du_salaire_sorties: somme(S, 'debit') } : {}) };
                        };
                        const suivants = [];
                        for (let k = 1, mm = m, aa = an; k <= 3; k++) { mm = mm === 12 ? 1 : mm + 1; aa = mm === 1 ? aa + 1 : aa; try { suivants.push(flux(mm, aa)); } catch (e) { /* cycle non budgété */ } }
                        let enCours = null;
                        try {
                            const f = flux(m, an), soldeC = Math.round(Number(((comptes.value || []).find(c => cleDeCompte('cpt_' + c.id) === ck) || {}).solde) || 0);
                            enCours = { ...f, solde_du_courant_aujourdhui: soldeC, solde_du_courant_fin_de_cycle_sans_virement: soldeC + f.entrees_propres_du_courant + f.virements_deja_prevus_vers_courant - f.sorties_du_courant,
                                        a_virer_vers_courant: Math.max(0, f.sorties_du_courant - f.entrees_propres_du_courant - f.virements_deja_prevus_vers_courant - soldeC),
                                        note: 'reste du cycle en cours : seulement ce qui n’est pas encore payé ; le solde d’aujourd’hui compte' };
                        } catch (e) { /* journal indisponible */ }
                        const maxi = suivants.reduce((x, s) => Math.max(x, s.a_virer_vers_courant), 0);
                        //  Le salaire change-t-il de compte d'une année à l'autre ? (une donnée à vérifier)
                        const ecarts = Object.keys(donneesAnnuelles.value || {}).map(Number).filter(a => a >= an).sort().map(a => {
                            const p = principal(((donneesAnnuelles.value || {})[a] || {}).revenus); return p ? [a, nom(compteDeFlux('revenu', p))] : null;
                        }).filter(Boolean);
                        const alerte_donnees = ecarts.length > 1 && ecarts.some(e => e[1] !== ecarts[0][1])
                            ? 'Le salaire n’arrive pas sur le même compte selon les années : ' + ecarts.map(e => e[0] + ' → ' + e[1]).join(', ') + '. À signaler à l’utilisateur avant toute recommandation pluriannuelle.' : null;
                        return {
                            regle: 'v37.67 — Chaque ligne dit de quel compte elle part (payee_depuis / depuis) ou sur quel compte elle arrive (arrive_sur) : c’est le routage du moteur, ne le suppose jamais. montant_ce_cycle intègre les exceptions (0 = rien ce cycle). budget_ce_cycle d’une charge variable est déjà le coût du cycle de paie (jours ÷ 7, rythmes des postes compris) : ne multiplie JAMAIS une semaine par 4,33. Pour « combien virer vers le Compte Courant », lis alimentation_du_courant : c’est le calcul de l’appli au dirham ; n’additionne pas les lignes toi-même.',
                            cycle_en_cours: cycle(m, an), revenus_fixes, charges_fixes, charges_variables, epargne_recurrente,
                            alimentation_du_courant: {
                                compte_courant: nom(ck), compte_du_salaire: sk ? nom(sk) : null,
                                cycle_en_cours: enCours, cycles_suivants: suivants,
                                virement_permanent_conseille: maxi > 0 ? Math.ceil(maxi / 100) * 100 : 0,
                                explication: 'virement_permanent_conseille = le plus gros a_virer_vers_courant des 3 prochains cycles, arrondi à la centaine supérieure, à programmer le jour de la paie depuis le compte du salaire.',
                                alerte_donnees,
                            },
                        };
                    };
                    const _buildPayloadCFO = () => {""")

# ── 2. Telegram : la même lecture dans le JSON enregistré ──────────────────
sub('export : schéma 22 + lecture CFO',
"""                    const getExportData = () => ({ version: CURRENT_VERSION, _schemaVersion: 21, soldesInitiaux: soldesInitiaux.value, donneesAnnuelles: donneesAnnuelles.value, gConfig: gConfig.value, comptes: comptes.value, parametres: parametres.value, wealthGoals: wealthGoals.value, masterAssets: masterAssets.value, studioExpl: studioExpl.value });""",
"""                    //  v37.67 : _lectureCFO voyage avec les données — le CFO sur Telegram lit ce fichier brut.
                    const _lectureCFOSure = () => { try { return _lectureCFO(); } catch (e) { return null; } };
                    const getExportData = () => ({ version: CURRENT_VERSION, _schemaVersion: 22, soldesInitiaux: soldesInitiaux.value, donneesAnnuelles: donneesAnnuelles.value, gConfig: gConfig.value, comptes: comptes.value, parametres: parametres.value, wealthGoals: wealthGoals.value, masterAssets: masterAssets.value, studioExpl: studioExpl.value, _lectureCFO: _lectureCFOSure() });""")

# ── 3. Schéma 22 : le champ mort des charges ───────────────────────────────
sub('migration : schéma 22',
"""                    // ── Patch v15.1 : corrige soldeInitial→solde + inclureLiquidite ──""",
"""                    // ── v37.67 : LE CHAMP MORT DES CHARGES (schéma 22) ──
                    //  Depuis la v20, une charge fixe ou variable part du compte par défaut de sa nature
                    //  (Budget Structurel) ou de son propre `compte` ; son `sourceCompte` n'est plus lu par
                    //  l'appli — mais il restait « courant » sur chaque ligne, et le CFO le croyait.
                    const purgerSourceCompteCharges = (data) => {
                        if (!data || (data._schemaVersion || 0) >= 22) return 0;
                        let n = 0;
                        const purger = (o) => { if (o && typeof o === 'object' && 'sourceCompte' in o) { delete o.sourceCompte; n++; } };
                        Object.values(data.donneesAnnuelles || {}).forEach(a => ['chargesFixes', 'chargesVariables'].forEach(g => {
                            Object.values((a && a[g]) || {}).forEach(c => { purger(c); ((c && c.details) || []).forEach(purger); });
                        }));
                        return n;
                    };

                    // ── Patch v15.1 : corrige soldeInitial→solde + inclureLiquidite ──""")

sub('migration : appel',
"""                            const _nSemCoupees = migrerSemainesCoupees(data);   // v37.66 : schéma 21""",
"""                            const _nSemCoupees = migrerSemainesCoupees(data);   // v37.66 : schéma 21
                            purgerSourceCompteCharges(data);                    // v37.67 : schéma 22""")

# ── 4. Annuler : 50 pas, qui survivent au rechargement ─────────────────────
sub('undo : profondeur',
"""                        // 10 pas, c'était l'équivalent de 5 actions réelles vu les
                        // doublons. Sans doublons, 30 pas = 30 actions.
                        if (_history.value.length > 30) { _history.value.shift(); }
                        _historyIdx.value = _history.value.length - 1;
                    };""",
"""                        // 10 pas, c'était l'équivalent de 5 actions réelles vu les
                        // doublons. Sans doublons, 30 pas = 30 actions. — v37.67 : 50.
                        if (_history.value.length > UNDO_MAX + 1) { _history.value.shift(); }   // 50 retours = 51 états
                        _historyIdx.value = _history.value.length - 1;
                        _memoriserPileUndo();
                    };

                    /*  v37.67 — LA PILE SURVIT AU RECHARGEMENT. « Pourquoi Undo n'en a que 3 ? » — la pile
                        vivait dans la mémoire de l'onglet : recharger la page, rouvrir l'appli ou laisser le
                        téléphone fermer l'onglet la vidait. Elle est recopiée dans le navigateur (IndexedDB) ;
                        au chargement, elle revient SI les données chargées sont exactement celles de son
                        dernier pas — sinon (modifiées ailleurs, sur un autre appareil, par le CFO), elle
                        est jetée : on ne revient jamais par-dessus des données qu'on n'a pas vues. */
                    const _idbPile = (mode, f) => new Promise((ok) => {
                        try {
                            const rq = indexedDB.open('finance_undo_v1', 1);
                            rq.onupgradeneeded = () => rq.result.createObjectStore('pile');
                            rq.onerror = () => ok(null);
                            rq.onsuccess = () => {
                                const db = rq.result;
                                try {
                                    const tx = db.transaction('pile', mode), r = f(tx.objectStore('pile'));
                                    tx.oncomplete = () => { db.close(); ok(r ? r.result : null); };
                                    tx.onerror = tx.onabort = () => { db.close(); ok(null); };
                                } catch (e) { db.close(); ok(null); }
                            };
                        } catch (e) { ok(null); }
                    });
                    let _pileTimer = null;
                    const _memoriserPileUndo = () => {
                        clearTimeout(_pileTimer);
                        _pileTimer = setTimeout(() => { const v = { snaps: _history.value.slice(), idx: _historyIdx.value, t: Date.now() }; _idbPile('readwrite', s => s.put(v, 'derniere')); }, 600);
                    };
                    const _canonEtat = (s) => {
                        const tri = (x) => Array.isArray(x) ? x.map(tri) : (x && typeof x === 'object' ? Object.keys(x).sort().reduce((o, k) => { o[k] = tri(x[k]); return o; }, {}) : x);
                        try { return JSON.stringify(tri(JSON.parse(s))); } catch (e) { return null; }
                    };
                    const _restaurerPileUndo = async () => {
                        if (_history.value.length !== 1) return 0;
                        const v = await _idbPile('readonly', s => s.get('derniere'));
                        if (_history.value.length !== 1) return 0;          // une modification est arrivée entre-temps
                        if (!v || !Array.isArray(v.snaps) || !(v.idx > 0) || v.idx >= v.snaps.length) return 0;
                        const ici = _history.value[0], haut = v.snaps[v.idx];
                        if (haut !== ici && _canonEtat(haut) !== _canonEtat(ici)) { _idbPile('readwrite', s => s.delete('derniere')); return 0; }
                        const pile = v.snaps.slice(0, v.idx + 1).slice(-(UNDO_MAX + 1));
                        pile[pile.length - 1] = ici;
                        _history.value = pile;
                        _historyIdx.value = pile.length - 1;
                        return _historyIdx.value;
                    };""")

sub('undo : constante',
"""                    const _history = ref([]);
                    const _historyIdx = ref(-1);""",
"""                    const UNDO_MAX = 50;   // v37.67 : 50 pas (« il faut un historique de 40 undo au moins »)
                    const _history = ref([]);
                    const _historyIdx = ref(-1);""")

sub('undo : mémoriser après undo / redo',
"""                    const _apresHistorique = () => {
                        forceUpdateCalculations();""",
"""                    const _apresHistorique = () => {
                        _memoriserPileUndo();
                        forceUpdateCalculations();""")

sub('undo : restaurer au chargement',
"""                                if (typeof _saveSnapshot === 'function') _saveSnapshot();
                            }, 200);""",
"""                                if (typeof _saveSnapshot === 'function') {
                                    _saveSnapshot();
                                    _restaurerPileUndo().then(n => { if (n) addLog('↩️ Annuler : ' + n + ' pas retrouvé(s) après le rechargement.', 'success'); });
                                }
                            }, 200);""")

io.open(F, 'w', encoding='utf-8').write(src)
print('✔ v37.67 : le CFO lit le moteur (comptes, exceptions, alimentation du Courant), schéma 22, Annuler 50 pas persistants')

# ── 5. Exposés (tests et console) ──────────────────────────────────────────
src = io.open(F, encoding='utf-8').read()
sub('exposés',
"""libSemaines, partDuMorceau, migrerSemainesCoupees,""",
"""libSemaines, partDuMorceau, migrerSemainesCoupees, purgerSourceCompteCharges, _lectureCFO, _buildPayloadCFO, UNDO_MAX,""")
io.open(F, 'w', encoding='utf-8').write(src)
print('✔ exposés')
