# -*- coding: utf-8 -*-
"""
v37.51 — CLÔTURER UNE CASE DU RÉALISÉ.

« Je veux un bouton (clôturer cette catégorie pour cette semaine ou cycle ou 15 j) pour chaque
case du réalisé, pour que l'appli n'attende plus un ajout. » et « il se peut que je dépasse le
budget d'une case et que j'y rajoute même après l'avoir finalisée ou clôturée : juste, ça se
désactive et ça me dit dépassement. »

PILOTAGE (cases cochées / saisies d'un cycle — trackerRealise)
  • 🔒 sur chaque ligne « À traiter » : la case est close pour le cycle, à ce qui a été réglé.
    Le reste (dû − réglé) n'est plus attendu : il sort du Relevé, du reste à payer, de
    l'urgence, de la progression. Un seul champ en plus dans l'état du cycle : cloture: true.
  • isItemPaid lit cloture : une case close est « faite ». getPaidAmount ne change pas (il dit
    ce qui a VRAIMENT été réglé). Les 19 « Math.max(0, dû − getPaidAmount) » du moteur passent
    par resteDuItem (0 si close) ; les « getPaidAmount || dû » (journal du réalisé) par
    regleDuItem (close à 0 : 0 réglé, pas le dû) ; les sommes par catégorie variable par
    couvertItem (une ligne close couvre son dû).
  • « Déjà validé » : la ligne close dit « 🔒 clôturé · X libérés » ; on peut toujours y
    AJOUTER (« + ajouter ») — rien ne se désactive ; au-delà du dû : « dépassement +X ».
    Décocher rouvre la case avec ce qui a été réglé.

MÉTÉO (saisie par semaine — consoRealiseeT0)
  • 🔒 sur chaque poste : une ligne / sem se clôt pour LA semaine affichée, une ligne / 15 j ou
    / cycle pour le cycle. Stockage : consoClotureT0['S' + lundi] / ['C' + cycle] = { clé: true }.
  • Une ligne close n'est plus « au prévu » : vide, elle vaut 0 ; ce qui reste de son prévu est
    LIBÉRÉ (sort de l'enveloppe conso : Reste à dépenser, Relevé, atterrissage). La saisie reste
    ouverte : au-delà du prévu, « dépassement ».
"""
import io, re, sys

def patcher(F, subs):
    src = io.open(F, encoding='utf-8').read()
    for label, a, b in subs:
        c = src.count(a)
        if c != 1:
            print(f'✖ {F} — {label} : {c} ancre(s), 1 attendue'); sys.exit(1)
        src = src.replace(a, b)
    return src

H = []
# ══ 1. PILOTAGE — le moteur ════════════════════════════════════════════════
H.append(('isItemPaid lit la clôture', """                    const isItemPaid = (item, dueAmount, cle) => {
                        const e = _etatCycle(item, cle);
                        if (!e) return false;
                        if (e.paye && !e.montantPaye) return true;""",
"""                    const isItemPaid = (item, dueAmount, cle) => {
                        const e = _etatCycle(item, cle);
                        if (!e) return false;
                        if (e.cloture) return true;          // v37.51 : close = plus rien n'est attendu
                        if (e.paye && !e.montantPaye) return true;"""))

H.append(('helpers de clôture', """                        return e.paye ? dueAmount : 0;
                    };

                    const toggleItemPaid = (item, dueAmount, cle) => {
                        // v25.40 Strict-Immutability : cocher/décocher ne change QUE l'état
                        // de l'item. Le solde réel des comptes n'est JAMAIS muté ici.
                        const dejaPaye = isItemPaid(item, dueAmount, cle);""",
"""                        return e.paye ? dueAmount : 0;
                    };

                    /*  v37.51 — UNE CASE CLÔTURÉE. « Plus rien n'est attendu sur ce cycle » : elle
                        vaut ce qui a été réglé, le reste de son dû est libéré. getPaidAmount dit
                        toujours ce qui a VRAIMENT été réglé ; trois lectures en découlent :
                          resteDuItem  — ce qui reste à payer (0 si close)
                          regleDuItem  — ce qu'une ligne faite a coûté (close à 0 : 0, pas son dû)
                          couvertItem  — ce qu'une ligne couvre de son dû dans une somme (close : tout) */
                    const estClotureItem = (item, cle) => !!(_etatCycle(item, cle) || {}).cloture;
                    const resteDuItem = (item, due, cle) => estClotureItem(item, cle) ? 0 : Math.max(0, due - getPaidAmount(item, due, cle));
                    const regleDuItem = (item, due, cle) => estClotureItem(item, cle) ? (getPaidAmount(item, due, cle) || 0) : (getPaidAmount(item, due, cle) || due);
                    const couvertItem = (item, due, cle) => {
                        const p = getPaidAmount(item, due, cle) || 0;
                        return estClotureItem(item, cle) ? Math.max(p, Number(due) || 0) : p;
                    };
                    const cloturerItem = (item, cle) => {
                        if (!item) return;
                        const e = _etatCycle(item, cle) || { paye: false, montantPaye: 0 };
                        _poserEtatCycle(item, cle, Object.assign({}, e, { cloture: true, dateReelle: e.dateReelle || _aujourdhuiISO() }));
                        handleDataChange();
                    };
                    //  « + ajouter » d'une ligne déjà validée (ou close) : s'ajoute au réglé, rien ne se
                    //  désactive. « −20 » corrige. Au-delà du dû, la ligne le dit : dépassement.
                    const ajouterAuRegle = (item, due, valeur, cle) => {
                        const t = String(valeur == null ? '' : valeur).trim().replace(',', '.').replace('−', '-').replace(/^\\+/, '').replace(/\\s+/g, '');
                        const v = Number(t);
                        if (!t || !Number.isFinite(v) || v === 0) return;
                        const base = Math.abs(Number(getPaidAmount(item, due, cle)) || 0);
                        setMontantPayeCycle(item, Math.max(0, Math.round((base + v) * 100) / 100), cle);
                    };

                    const toggleItemPaid = (item, dueAmount, cle) => {
                        // v25.40 Strict-Immutability : cocher/décocher ne change QUE l'état
                        // de l'item. Le solde réel des comptes n'est JAMAIS muté ici.
                        //  v37.51 : décocher une case CLOSE la rouvre avec ce qui a été réglé.
                        const _e = _etatCycle(item, cle);
                        if (_e && _e.cloture && Math.abs(Number(_e.montantPaye) || 0) < Math.abs(Number(dueAmount) || 0)) {
                            const rouverte = Object.assign({}, _e);
                            delete rouverte.cloture;
                            _poserEtatCycle(item, cle, rouverte);
                            handleDataChange();
                            return;
                        }
                        const dejaPaye = isItemPaid(item, dueAmount, cle);"""))

H.append(('tâches : clos', """                                paye: isItemPaid(ref, d, cyc),
                                regle: getPaidAmount(ref, d, cyc) || 0,
                                quand: dateReelleCycle(ref, cyc),""",
"""                                paye: isItemPaid(ref, d, cyc),
                                regle: getPaidAmount(ref, d, cyc) || 0,
                                clos: estClotureItem(ref, cyc),   // v37.51
                                quand: dateReelleCycle(ref, cyc),"""))
H.append(('entrées : clos', """                                paye: isItemPaid(ref, d, cyc), regle: getPaidAmount(ref, d, cyc) || 0,
                                quand: dateReelleCycle(ref, cyc),""",
"""                                paye: isItemPaid(ref, d, cyc), regle: getPaidAmount(ref, d, cyc) || 0,
                                clos: estClotureItem(ref, cyc),   // v37.51
                                quand: dateReelleCycle(ref, cyc),"""))
H.append(('total traité', """                        Math.round(tachesTerminees.value.reduce((s, t) => s + (t.regle || t.due), 0)));""",
"""                        Math.round(tachesTerminees.value.reduce((s, t) => s + (t.clos ? t.regle : (t.regle || t.due)), 0)));"""))
H.append(('déjà validé : somme', """.reduce((s, t) => s + (t.regle || t.due), 0));
                        return { lignes, regle: somme('debit'), encaisse: somme('credit') };""",
""".reduce((s, t) => s + (t.clos ? t.regle : (t.regle || t.due)), 0));
                        return { lignes, regle: somme('debit'), encaisse: somme('credit') };"""))
H.append(('progression', """                            const r = t.paye ? (t.regle || t.due) : Math.min(t.regle || 0, t.due);""",
"""                            const r = t.paye ? (t.clos ? t.regle : (t.regle || t.due)) : Math.min(t.regle || 0, t.due);"""))

# ══ 2. MÉTÉO — le moteur ═══════════════════════════════════════════════════
H.append(('parts du cycle partagées', """                    const prevuHebdoLignes = (key, cv, budget, n) => {
                        const dets = (cv.details || []).filter(x => x && Number(x.montant) > 0);
                        if (!dets.length) return { [key]: Math.round(budget / n) };
                        const poids = (x) => Number(x.montant) * facteurPeriode(periodeDetail(x, cv), n);
                        const W = dets.reduce((s, x) => s + poids(x), 0);
                        const parts = dets.map(x => ({ x, part: Math.round(W > 0 ? budget * poids(x) / W : 0), montant: Math.round(Number(x.montant) * (W > 0 ? budget / W : 1)) }))
                                          .sort((a, b) => b.part - a.part || b.montant - a.montant);
                        if (parts.length) parts[0].part += Math.round(budget) - parts.reduce((s, p) => s + p.part, 0);
                        const out = {};""",
"""                    //  v37.51 : la part du CYCLE de chaque ligne (même calcul que l'affichage)
                    const _partsCycleLignes = (cv, budget, n) => {
                        const dets = (cv.details || []).filter(x => x && Number(x.montant) > 0);
                        const poids = (x) => Number(x.montant) * facteurPeriode(periodeDetail(x, cv), n);
                        const W = dets.reduce((s, x) => s + poids(x), 0);
                        const parts = dets.map(x => ({ x, part: Math.round(W > 0 ? budget * poids(x) / W : 0), montant: Math.round(Number(x.montant) * (W > 0 ? budget / W : 1)) }))
                                          .sort((a, b) => b.part - a.part || b.montant - a.montant);
                        if (parts.length) parts[0].part += Math.round(budget) - parts.reduce((s, p) => s + p.part, 0);
                        return parts;
                    };
                    const prevuHebdoLignes = (key, cv, budget, n) => {
                        const dets = (cv.details || []).filter(x => x && Number(x.montant) > 0);
                        if (!dets.length) return { [key]: Math.round(budget / n) };
                        const parts = _partsCycleLignes(cv, budget, n);
                        const out = {};"""))

H.append(('clôtures : lecture, économies', """                    //  Les défauts d'UNE semaine (lundi ISO) : {} tant qu'elle n'est pas écoulée.""",
"""                    /*  v37.51 — LES CASES CLOSES DE LA MÉTÉO. consoClotureT0['S' + lundi] (lignes / sem,
                        catégorie sans ligne) et ['C' + cycle] (lignes / 15 j et / cycle) = { clé: true },
                        tous seaux annuels confondus. Une ligne close n'attend plus rien : vide, elle
                        vaut 0 (plus « au prévu ») et ce qui reste de son prévu est LIBÉRÉ — il sort
                        de l'enveloppe conso. Au-delà du prévu : dépassement, rien ne se bloque. */
                    const _cloturesConso = computed(() => {
                        calculationTick.value;
                        const out = {};
                        Object.values(donneesAnnuelles.value || {}).forEach(a => {
                            const r = a && a.consoClotureT0;
                            if (!r || typeof r !== 'object') return;
                            Object.entries(r).forEach(([k, v]) => { if (v && typeof v === 'object') out[k] = Object.assign(out[k] || {}, v); });
                        });
                        return out;
                    });
                    //  Ce que libèrent les cases closes du cycle : { parCle, parCat, clos: { catégorie: true }, total }
                    const consoEcoClotures = computed(() => {
                        calculationTick.value;
                        const out = { parCle: {}, parCat: {}, clos: {}, total: 0 };
                        const d = donneesAnnuelles.value[consoT0Annee.value];
                        const CL = _cloturesConso.value;
                        if (!d || !Object.keys(CL).length) return out;
                        const mb = moisBudgetaire.value, n = semainesDuCycle(mb.mois, mb.an);
                        const noter = (key, cle, v) => {
                            out.clos[key] = true;
                            const e = Math.max(0, Math.round(v));
                            if (!e) return;
                            out.parCle[cle] = (out.parCle[cle] || 0) + e; out.parCat[key] = (out.parCat[key] || 0) + e; out.total += e;
                        };
                        const cats = Object.entries(d.chargesVariables || {}).filter(([, cv]) => cv && cv.categorieId !== 'cat_cv_factures')
                            .map(([key, cv]) => ({ key, cv, budget: Math.round(budgetCategorieRevise(cv)) })).filter(c => c.budget > 0);
                        const idsDe = (key, cv) => { const m = {}; (cv.details || []).forEach(x => { if (x) m[cleDetailT0(key, x)] = x.categorieId; }); return m; };
                        //  Les semaines du cycle (règle du jeudi)
                        const { debut, fin } = consoT0Fenetre.value;
                        const j = new Date(debut.getFullYear(), debut.getMonth(), debut.getDate() + ((4 - debut.getDay() + 7) % 7));
                        for (; j.getTime() <= fin.getTime(); j.setDate(j.getDate() + 7)) {
                            const lundi = _ymd(new Date(j.getFullYear(), j.getMonth(), j.getDate() - 3));
                            const fermes = CL['S' + lundi];
                            if (!fermes || !Object.keys(fermes).length) continue;
                            const vals = _valeursSemaine(lundi), T = _lireTickets(lundi, _ymd(_decaler(lundi, 6)));
                            cats.forEach(({ key, cv, budget }) => {
                                const g = T.parCle[key] || { total: 0, parPoste: {} }, idDe = idsDe(key, cv);
                                Object.entries(prevuHebdoLignes(key, cv, budget, n)).forEach(([cle, v]) => {
                                    if (!fermes[cle]) return;
                                    const sai = Math.max(0, Math.round(Number(vals[cle] || 0)));
                                    const tk = Math.round(cle === key ? g.total : (idDe[cle] ? (g.parPoste[idDe[cle]] || 0) : 0));
                                    noter(key, cle, v - Math.max(sai, tk));
                                });
                            });
                        }
                        //  Le cycle : les lignes / 15 j et / cycle
                        const fermesC = CL['C' + consoT0CycleKey.value];
                        if (fermesC && Object.keys(fermesC).length) {
                            const S = consoT0Saisies.value, TC = _ticketsCycle.value;
                            cats.forEach(({ key, cv, budget }) => {
                                const g = TC.parCle[key] || { total: 0, parPoste: {} };
                                _partsCycleLignes(cv, budget, n).forEach(p => {
                                    const cle = cleDetailT0(key, p.x);
                                    if (periodeDetail(p.x, cv) === 'semaine' || !fermesC[cle]) return;
                                    const sai = Math.max(0, Math.round(Number(S[cle] || 0)));
                                    const tk = Math.round(p.x.categorieId ? (g.parPoste[p.x.categorieId] || 0) : 0);
                                    noter(key, cle, p.part - Math.max(sai, tk));
                                });
                            });
                        }
                        return out;
                    });
                    //  Clôturer / rouvrir une case de la Météo (le 🔒 d'un poste ou d'une catégorie sans poste)
                    const basculerClotureConso = (lundiISO, cle, unite) => {
                        const d = donneesAnnuelles.value[consoT0Annee.value];
                        if (!d || !cle) return;
                        const k = unite && unite !== 'semaine' ? 'C' + consoT0CycleKey.value : 'S' + lundiISO;
                        const porteur = Object.values(donneesAnnuelles.value || {})
                            .find(a => a && a.consoClotureT0 && a.consoClotureT0[k] && a.consoClotureT0[k][cle]);
                        if (porteur) {
                            delete porteur.consoClotureT0[k][cle];
                            if (!Object.keys(porteur.consoClotureT0[k]).length) delete porteur.consoClotureT0[k];
                        } else {
                            if (!d.consoClotureT0 || typeof d.consoClotureT0 !== 'object') d.consoClotureT0 = {};
                            if (!d.consoClotureT0[k] || typeof d.consoClotureT0[k] !== 'object') d.consoClotureT0[k] = {};
                            d.consoClotureT0[k][cle] = true;
                        }
                        calculationTick.value++;
                        handleDataChange();
                    };
                    //  Les défauts d'UNE semaine (lundi ISO) : {} tant qu'elle n'est pas écoulée."""))

H.append(('défauts : une ligne close ne vaut plus son prévu', """                        const vals = _valeursSemaine(lundiISO), base = consoT0SaisiesCycle.value;
                        const T = _lireTickets(lundiISO, dimanche);
                        const out = {};""",
"""                        const vals = _valeursSemaine(lundiISO), base = consoT0SaisiesCycle.value;
                        const T = _lireTickets(lundiISO, dimanche);
                        const fermes = _cloturesConso.value['S' + lundiISO] || {};   // v37.51 : close, vide = 0
                        const out = {};"""))
H.append(('défauts : skip', """                                if (!(v > 0) || Object.prototype.hasOwnProperty.call(vals, cle)) return;   // saisi, même 0""",
"""                                if (!(v > 0) || Object.prototype.hasOwnProperty.call(vals, cle)) return;   // saisi, même 0
                                if (fermes[cle]) return;                                                    // v37.51 : close"""))

H.append(('renseigné : une clôture est une déclaration', """                        consoCompteurRenseigne.value || _ticketsCycle.value.total > 0 || Object.keys(consoDefautsDuCycle.value).length > 0
                    );""",
"""                        consoCompteurRenseigne.value || _ticketsCycle.value.total > 0 || Object.keys(consoDefautsDuCycle.value).length > 0
                        || Object.keys(consoEcoClotures.value.clos).length > 0   // v37.51 : clôturer, c'est déclarer
                    );"""))
H.append(('catégorie : eco', """                                const defaut = Math.round(defautDeCategorie(key));
                                const declare = saisi > 0 || tickets > 0 || defaut > 0 || (declareQuelquePart""",
"""                                const defaut = Math.round(defautDeCategorie(key));
                                //  v37.51 : ce que ses cases closes libèrent — hors de l'engagé (ce n'est pas dépensé)
                                const eco = Math.round(consoEcoClotures.value.parCat[key] || 0), clos = !!consoEcoClotures.value.clos[key];
                                const declare = clos || saisi > 0 || tickets > 0 || defaut > 0 || (declareQuelquePart"""))
H.append(('catégorie : reste', """                                    key, saisi, libre, parPostes, tickets, declare, defaut,""",
"""                                    key, saisi, libre, parPostes, tickets, declare, defaut, eco, clos,"""))
H.append(('catégorie : reste net', """                                    reste: Math.max(0, budget - engage),
                                    pondere:""",
"""                                    reste: Math.max(0, budget - engage - eco),
                                    pondere:"""))
H.append(('Σ eco', """                    const consoEngageeT0 = computed(() =>
                        consoCategoriesT0.value.reduce((s, c) => s + c.engage, 0)
                    );""",
"""                    const consoEngageeT0 = computed(() =>
                        consoCategoriesT0.value.reduce((s, c) => s + c.engage, 0)
                    );
                    //  v37.51 : libéré par les cases closes (sort de l'enveloppe, n'est pas dépensé)
                    const consoEcoT0 = computed(() =>
                        consoCategoriesT0.value.reduce((s, c) => s + (c.eco || 0), 0)
                    );"""))
H.append(('enveloppe restante', """                            ? Math.max(0, budgetConsoCycle.value - consoEngageeT0.value)
                            : enveloppeConsoProrataTemps.value;""",
"""                            ? Math.max(0, budgetConsoCycle.value - consoEngageeT0.value - consoEcoT0.value)
                            : enveloppeConsoProrataTemps.value;"""))
H.append(('économie voyage', """                            ? Math.max(0, budget - consoEngageeT0.value)
                            : Math.round(budget * (joursCycleRestants.value / joursCycleTotal.value));""",
"""                            ? Math.max(0, budget - consoEngageeT0.value - consoEcoT0.value)
                            : Math.round(budget * (joursCycleRestants.value / joursCycleTotal.value));"""))
H.append(('enveloppe par compte', """                            out[k] = (out[k] || 0) + (reel ? (c.budget - c.engage) : c.budget * ratio);""",
"""                            out[k] = (out[k] || 0) + (reel ? (c.budget - c.engage - (c.eco || 0)) : c.budget * ratio);"""))
H.append(('reste par catégorie', """                            montant: Math.round(reel ? (c.budget - c.engage) : (c.budget * ratio)),""",
"""                            montant: Math.round(reel ? (c.budget - c.engage - (c.eco || 0)) : (c.budget * ratio)),"""))
H.append(('effacer tout le cycle : ses clôtures aussi', """                            Object.keys(r).forEach(k => { if (_RE_SEMAINE.test(k) && _semaineDansCycle(k.slice(1))) delete r[k]; });
                        });""",
"""                            Object.keys(r).forEach(k => { if (_RE_SEMAINE.test(k) && _semaineDansCycle(k.slice(1))) delete r[k]; });
                        });
                        //  v37.51 : … et ses cases closes
                        Object.values(donneesAnnuelles.value || {}).forEach(a => {
                            const c = a && a.consoClotureT0;
                            if (!c) return;
                            Object.keys(c).forEach(k => { if ((_RE_SEMAINE.test(k) && _semaineDansCycle(k.slice(1))) || k === 'C' + consoT0CycleKey.value) delete c[k]; });
                        });"""))

# ── La Météo affichée ───────────────────────────────────────────────────────
H.append(('météo : clôtures de la semaine affichée', """                        const defsSem = defautsSemaine(lundiSel);                        // v37.31 : {} si pas écoulée""",
"""                        const defsSem = defautsSemaine(lundiSel);                        // v37.31 : {} si pas écoulée
                        //  v37.51 : les cases closes — de la semaine affichée (/ sem) et du cycle (/ 15 j, / cycle)
                        const closS = _cloturesConso.value['S' + lundiSel] || {}, closC = _cloturesConso.value['C' + consoT0CycleKey.value] || {};"""))
H.append(('météo : reste de catégorie net', """                            const resteCat = c.budget - engageCat;""",
"""                            const resteCat = c.budget - engageCat - (c.eco || 0);   // v37.51"""))
H.append(('météo : poste / sem', """                                    const bud = Math.round(p.partCycle / nSem);
                                    return { ...base, budget: bud, prevu: bud, planifie: 0,
                                             pct: bud > 0 ? Math.min(100, Math.round(eng / bud * 100)) : (eng > 0 ? 100 : 0), depasse: eng > bud };""",
"""                                    const bud = Math.round(p.partCycle / nSem);
                                    const clos = !!closS[p.cle];
                                    return { ...base, budget: bud, prevu: bud, planifie: 0,
                                             pct: bud > 0 ? Math.min(100, Math.round(eng / bud * 100)) : (eng > 0 ? 100 : 0), depasse: eng > bud,
                                             clos, eco: clos ? Math.max(0, bud - eng) : 0, exces: Math.max(0, eng - bud) };"""))
H.append(('météo : poste / cycle', """                                return { ...base, budget: 0, prevu: p.montant, cyclePrevu: p.partCycle, cycleEngage: p.engage,
                                         planifie: Math.min(eng, Math.max(0, p.partCycle - ailleurs)),
                                         pct: p.pctEngage, depasse: p.engage > p.partCycle };""",
"""                                const closP = !!closC[p.cle];
                                return { ...base, budget: 0, prevu: p.montant, cyclePrevu: p.partCycle, cycleEngage: p.engage,
                                         planifie: Math.min(eng, Math.max(0, p.partCycle - ailleurs)),
                                         pct: p.pctEngage, depasse: p.engage > p.partCycle,
                                         clos: closP, eco: closP ? Math.max(0, p.partCycle - p.engage) : 0, exces: Math.max(0, p.engage - p.partCycle) };"""))
H.append(('météo : semaine déclarée', """                            const declS = saisiS > 0 || ticketsS > 0 || defautS > 0 || Object.keys(valsSem).some(k => k === c.key || k.startsWith(c.key + '::'));""",
"""                            //  v37.51 : la catégorie sans poste se clôt d'un bloc ; une ligne / sem close libère sa semaine
                            const closCat = !postesSem.length && !!closS[c.key];
                            const declS = closCat || postesSem.some(p => p.clos && p.unite === 'semaine') || saisiS > 0 || ticketsS > 0 || defautS > 0 || Object.keys(valsSem).some(k => k === c.key || k.startsWith(c.key + '::'));"""))
H.append(('météo : sem eco', """                            const engS = declS ? Math.max(saisiS, ticketsS) + defautS : 0;
                            const sem = {
                                budget: semBudget, prevuSemaine, prevuCycle: prevuCycleLignes, engage: engS, saisi: saisiS, libre: libreS, tickets: ticketsS, declare: declS, defaut: defautS,
                                reste: semBudget - engS,""",
"""                            const engS = declS ? Math.max(saisiS, ticketsS) + defautS : 0;
                            const ecoCat = closCat ? Math.max(0, semBudget - engS) : 0;
                            const ecoS = ecoCat + postesSem.reduce((s, p) => s + (p.unite === 'semaine' ? (p.eco || 0) : 0), 0);
                            const sem = {
                                budget: semBudget, prevuSemaine, prevuCycle: prevuCycleLignes, engage: engS, saisi: saisiS, libre: libreS, tickets: ticketsS, declare: declS, defaut: defautS,
                                clos: closCat, eco: ecoCat, ecoS, exces: Math.max(0, engS - semBudget),
                                reste: semBudget - engS - ecoS,"""))
H.append(('météo : semaine, total net', """                                         budget: sb, engage: se, reste: sb - se, pct: sb > 0 ? Math.min(100, Math.round(se / sb * 100)) : 0 };""",
"""                                         eco: categories.reduce((s, c) => s + (c.sem.ecoS || 0), 0),
                                         budget: sb, engage: se, reste: sb - se - categories.reduce((s, c) => s + (c.sem.ecoS || 0), 0), pct: sb > 0 ? Math.min(100, Math.round(se / sb * 100)) : 0 };"""))

# ── Exposés au gabarit ──────────────────────────────────────────────────────
H.append(('exports pilotage', """                        cycleRealiseActif, cyclePilotage, montantPayeCycle, setMontantPayeCycle, dateReelleCycle,""",
"""                        cycleRealiseActif, cyclePilotage, montantPayeCycle, setMontantPayeCycle, dateReelleCycle,
                        estClotureItem, cloturerItem, ajouterAuRegle, basculerClotureConso, consoEcoT0, entreesPilotageToutes,"""))

# ══ 3. GABARITS ═════════════════════════════════════════════════════════════
H.append(('À traiter : 🔒', """                                                    <span v-else class="text-[10px] font-black text-slate-400 w-16 text-right tabular-nums">/ {{ formatNombre(t.due) }}</span>
                                                </div>""",
"""                                                    <span v-else class="text-[10px] font-black text-slate-400 w-16 text-right tabular-nums">/ {{ formatNombre(t.due) }}</span>
                                                    <!-- v37.51 : clôturer la case — plus rien n'est attendu sur ce cycle -->
                                                    <button type="button" data-cloturer @click="cloturerItem(t.ref, cyclePilotage)"
                                                            :aria-label="'Clôturer ' + t.libelle + ' pour ce cycle'"
                                                            :title="t.sens === 'credit'
                                                                ? 'Clôturer : plus rien à recevoir sur ce cycle' + (t.regle > 0 ? ' (' + formatNombre(t.regle) + ' reçus)' : '')
                                                                : 'Clôturer pour ce cycle : plus rien n’est attendu' + (t.regle > 0 ? ' — ' + formatNombre(t.regle) + ' réglés, ' + formatNombre(Math.max(0, t.due - t.regle)) + ' libérés' : '')"
                                                            class="shrink-0 w-7 h-7 grid place-items-center rounded-lg border border-slate-700/60 text-[11px] text-slate-500 opacity-70 hover:opacity-100 hover:text-emerald-300 hover:border-emerald-500/60 hover:bg-emerald-500/10 transition">🔒</button>
                                                </div>"""))
H.append(('Déjà validé : clôturé, ajouter, dépassement', """                                            <span data-valide-montant :class="['text-xs font-black shrink-0 tabular-nums', t.sens === 'credit' ? 'text-emerald-400' : 'text-slate-400']">{{ t.sens === 'credit' ? '+ ' : '' }}{{ formatMAD(t.regle || t.due) }}</span>""",
"""                                            <!-- v37.51 : une case validée ou close reste OUVERTE aux ajouts ; elle dit ce qu'elle a libéré, ou son dépassement -->
                                            <span v-if="t.clos" data-valide-clos title="Clôturée : plus rien n’est attendu sur ce cycle — décocher pour la rouvrir"
                                                  class="text-[9px] font-black px-1.5 py-px rounded-full border border-slate-600 text-slate-400 shrink-0 whitespace-nowrap">🔒<span class="hidden sm:inline"> clôturé</span><template v-if="t.regle < t.due"> · {{ formatNombre(t.due - t.regle) }}<span class="hidden sm:inline"> libérés</span></template></span>
                                            <span v-if="t.sens !== 'credit' && t.regle > t.due" data-valide-depassement
                                                  class="text-[9px] font-black px-1.5 py-px rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/40 shrink-0 whitespace-nowrap">dépassement +{{ formatNombre(t.regle - t.due) }}</span>
                                            <input v-if="t.sens !== 'credit' || t.nature === 'exceptionnel'" type="text" inputmode="decimal" autocomplete="off" data-valide-ajout
                                                   :aria-label="'Ajouter un montant à ' + t.libelle" placeholder="+ ajouter"
                                                   :title="'Ajouter une dépense à cette case (réglé : ' + formatNombre(t.regle) + ' / ' + formatNombre(t.due) + ') — « -20 » corrige'"
                                                   @change="ajouterAuRegle(t.ref, t.due, $event.target.value, cyclePilotage); $event.target.value = ''" @keydown.enter="$event.target.blur()"
                                                   class="w-[5rem] h-6 shrink-0 bg-transparent border border-slate-700/60 hover:border-slate-500 rounded-lg px-1.5 text-right text-[11px] font-bold text-slate-300 placeholder:text-slate-600 placeholder:font-semibold outline-none focus:border-emerald-400 transition"/>
                                            <span data-valide-montant :class="['text-xs font-black shrink-0 tabular-nums', t.sens === 'credit' ? 'text-emerald-400' : (t.regle > t.due ? 'text-rose-300' : 'text-slate-400')]">{{ t.sens === 'credit' ? '+ ' : '' }}{{ formatMAD(t.clos ? t.regle : (t.regle || t.due)) }}</span>"""))
H.append(('Déjà validé : rouvrir', """<input type="checkbox" :checked="true" @change="toggleItemPaid(t.ref, t.due, cyclePilotage)" title="Décocher : remettre à traiter\"""",
"""<input type="checkbox" :checked="true" @change="toggleItemPaid(t.ref, t.due, cyclePilotage)" :title="t.clos ? 'Décocher : rouvrir la case (ce qui est réglé reste)' : 'Décocher : remettre à traiter'\""""))

# Météo — le composant
H.append(('emits', """            emits: ['aller', 'revenir', 'effacer', 'semaine', 'saisie', 'retirer'],""",
"""            emits: ['aller', 'revenir', 'effacer', 'semaine', 'saisie', 'retirer', 'cloturer'],"""))
H.append(('libellé de clôture', """                uniteCourte(u) { return u === 'quinzaine' ? '/ 15 j' : (u === 'cycle' ? '/ cycle' : '/ sem'); },""",
"""                uniteCourte(u) { return u === 'quinzaine' ? '/ 15 j' : (u === 'cycle' ? '/ cycle' : '/ sem'); },
                //  v37.51 : le 🔒 d'une case — / sem : la semaine affichée ; / 15 j et / cycle : le cycle
                titreCloture(nom, unite, clos) {
                    if (clos) return 'Rouvrir ' + nom + ' : sa case attend de nouveau des dépenses';
                    return 'Clôturer ' + nom + (unite === 'semaine' ? ' pour cette semaine' : ' pour ce cycle') + ' : plus rien n’est attendu, le reste de son prévu est libéré';
                },"""))
H.append(('poste : état clos', """<template v-if="d.defaut > 0"> · <span class="text-emerald-200" data-pulse-poste-defaut>✓ au prévu</span></template></span>""",
"""<template v-if="d.defaut > 0"> · <span class="text-emerald-200" data-pulse-poste-defaut>✓ au prévu</span></template><template v-if="d.exces > 0"> · <span class="font-black text-rose-200" data-pulse-poste-depasse>dépassement +{{ chiffre(d.exces) }}</span></template><template v-else-if="d.clos"> · <span class="font-black text-white/85" data-pulse-poste-clos>🔒 {{ d.eco > 0 ? chiffre(d.eco) + ' libérés' : 'clôturé' }}</span></template></span>"""))
H.append(('poste : 🔒', """                                       class="w-[3.8rem] md:w-[4.8rem] bg-transparent text-right text-[13px] font-black text-white tabular-nums placeholder:text-white/35 placeholder:font-semibold outline-none">
                                <span class="text-[10px] font-bold text-white/45">DH</span>
                            </label>
                        </div>
                        <div data-pulse-poste data-poste="libre\"""",
"""                                       class="w-[3.8rem] md:w-[4.8rem] bg-transparent text-right text-[13px] font-black text-white tabular-nums placeholder:text-white/35 placeholder:font-semibold outline-none">
                                <span class="text-[10px] font-bold text-white/45">DH</span>
                            </label>
                            <button type="button" data-pulse-cloturer :data-poste="d.cle" :aria-pressed="d.clos ? 'true' : 'false'" :title="titreCloture(d.nom, d.unite, d.clos)"
                                    @click="$emit('cloturer', sm.lundi, d.cle, d.unite); fermer()"
                                    :class="['shrink-0 w-6 h-6 grid place-items-center rounded-md text-[10px] transition', d.clos ? 'bg-white/25 ring-1 ring-white/60' : 'opacity-35 hover:opacity-100 hover:bg-white/10']">🔒</button>
                        </div>
                        <div data-pulse-poste data-poste="libre\""""))
H.append(('libre : place du 🔒', """                                <span class="text-[10px] font-bold text-white/45">DH</span>
                            </label>
                        </div>
                    </div>
                    </div>""",
"""                                <span class="text-[10px] font-bold text-white/45">DH</span>
                            </label>
                            <span aria-hidden="true" class="shrink-0 w-6"></span>
                        </div>
                    </div>
                    </div>"""))
H.append(('catégorie sans poste : 🔒', """                                   class="w-[4.5rem] md:w-[5.5rem] bg-transparent text-right text-[13px] md:text-sm font-black text-white tabular-nums placeholder:text-white/35 placeholder:font-semibold outline-none">
                            <span class="text-[10px] font-bold text-white/45">DH</span>
                        </label>""",
"""                                   class="w-[4.5rem] md:w-[5.5rem] bg-transparent text-right text-[13px] md:text-sm font-black text-white tabular-nums placeholder:text-white/35 placeholder:font-semibold outline-none">
                            <span class="text-[10px] font-bold text-white/45">DH</span>
                        </label>
                        <button v-if="!c.sem.postes.length" type="button" data-pulse-cloturer :data-poste="c.key" :aria-pressed="c.sem.clos ? 'true' : 'false'" :title="titreCloture(c.label, 'semaine', c.sem.clos)"
                                @click="$emit('cloturer', sm.lundi, c.key, 'semaine'); fermer()"
                                :class="['shrink-0 w-6 h-6 grid place-items-center rounded-md text-[10px] transition', c.sem.clos ? 'bg-white/25 ring-1 ring-white/60' : 'opacity-35 hover:opacity-100 hover:bg-white/10']">🔒</button>"""))
H.append(('catégorie : libéré', """                                    <template v-if="c.sem.defaut > 0"> · <span class="text-emerald-200" data-pulse-defaut>✓ au prévu</span></template>
                                </span>""",
"""                                    <template v-if="c.sem.defaut > 0"> · <span class="text-emerald-200" data-pulse-defaut>✓ au prévu</span></template>
                                    <template v-if="c.sem.ecoS > 0"> · <span class="font-black text-white/85" data-pulse-libere>🔒 {{ chiffre(c.sem.ecoS) }} libérés</span></template>
                                </span>"""))

src = patcher('index.html', H)

# ── Le moteur : 19 restes « dû − réglé » → resteDuItem ; « réglé || dû » → regleDuItem ;
#    sommes de détails variables → couvertItem ─────────────────────────────────────────────
RE_RESTE = re.compile(r"Math\.max\(0, (\w+) - getPaidAmount\((\w+), \1((?:, \w+)?)\)\)")
DEF = "const resteDuItem = (item, due, cle) => estClotureItem(item, cle) ? 0 : Math.max(0, due - getPaidAmount(item, due, cle));"
assert src.count(DEF) == 1
src = src.replace(DEF, '@@DEF_RESTE@@')
n1 = len(RE_RESTE.findall(src))
if n1 != 19: print(f'✖ resteDuItem : {n1} site(s), 19 attendus'); sys.exit(1)
src = RE_RESTE.sub(lambda m: f"resteDuItem({m.group(2)}, {m.group(1)}{m.group(3)})", src).replace('@@DEF_RESTE@@', DEF)

RE_REGLE = re.compile(r"getPaidAmount\((\w+), (\w+), _cyc\) \|\| \2\b")
n2 = len(RE_REGLE.findall(src))
if n2 != 6: print(f'✖ regleDuItem : {n2} site(s), 6 attendus'); sys.exit(1)
src = RE_REGLE.sub(lambda m: f"regleDuItem({m.group(1)}, {m.group(2)}, _cyc)", src)

n3 = src.count('paid += getPaidAmount(') + src.count('else paid = getPaidAmount(')
if n3 != 4: print(f'✖ couvertItem : {n3} site(s), 4 attendus'); sys.exit(1)
src = src.replace('paid += getPaidAmount(', 'paid += couvertItem(').replace('else paid = getPaidAmount(', 'else paid = couvertItem(')

# Les trois <meteo-financiere> écoutent le 🔒
n4 = src.count('@saisie="saisirSemaineConso"')
if n4 != 3: print(f'✖ meteo-financiere : {n4} usage(s), 3 attendus'); sys.exit(1)
src = src.replace('@saisie="saisirSemaineConso"', '@saisie="saisirSemaineConso" @cloturer="basculerClotureConso"')

io.open('index.html', 'w', encoding='utf-8').write(src)
print('✔ v37.51 — clôture : Pilotage (19 restes, 6 réglés, 4 sommes) + Météo + gabarits')
