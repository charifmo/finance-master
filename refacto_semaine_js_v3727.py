# -*- coding: utf-8 -*-
"""
v37.27 Semaine-Glissante — PARTIE MOTEUR.

  Retour : « je ne veux pas par mois mais par semaine : la semaine en cours, et je
  peux switcher à la passée et à la prochaine ». Les postes sont des budgets
  HEBDOMADAIRES (Marjane : 400 / semaine) : on les saisit à la semaine.

  Stockage — dans le MÊME objet que le compteur du cycle (rien de nouveau à
  persister), sous une clé par semaine, indexée par son lundi :
      consoRealiseeT0['S2026-10-05'] = { 'alimentation::1': 320, alimentation: 40, … }
  Rattachement au cycle — une semaine appartient au cycle où tombe son JEUDI
  (la majorité de ses jours). Le moteur du cycle (reste à dépenser, atterrissage,
  Relevé) lit donc, par catégorie :
      saisi  = compteur du cycle (historique) + Σ semaines du cycle
      engagé = max(saisi, tickets datés)            — inchangé, jamais la somme
  La carte, elle, montre la SEMAINE choisie : budget (= le poste), saisi, tickets
  datés de la semaine, reste ; un décalage (-1 = la précédente, +1 = la suivante).
"""
import io, sys
F = 'index.html'
src = io.open(F, encoding='utf-8').read()
edits = []
def sub(label, anchor, replacement, expected=1):
    n = src.count(anchor)
    if n != expected:
        print(f'✖ {label} : {n} ancre(s), {expected} attendue(s)'); sys.exit(1)
    edits.append((anchor, replacement))

# ── 1. Un lecteur de tickets pour N'IMPORTE quelle période ──────────────────
sub('lecteur de tickets : en-tête', r"""                    const _ticketsCycle = computed(() => {
                        calculationTick.value;
                        const d = donneesAnnuelles.value[consoT0Annee.value];
                        const out = { parCle: {}, hors: [], horsTotal: 0, total: 0 };
                        if (!d) return out;
                        const { debut, fin } = consoT0Fenetre.value;
                        const auj = new Date();
                        const dMin = _ymd(debut), dMax = _ymd(fin < auj ? fin : auj);
                        const ilYa6j""", r"""                    //  v37.27 : les tickets datés d'une période [dMin, dMax] (YYYY-MM-DD) — le
                    //  cycle, ou une semaine. Une seule lecture, pour que les deux s'accordent.
                    const _lireTickets = (dMin, dMax) => {
                        const d = donneesAnnuelles.value[consoT0Annee.value];
                        const out = { parCle: {}, hors: [], horsTotal: 0, total: 0 };
                        if (!d) return out;
                        const auj = new Date();
                        const ilYa6j""")
sub('lecteur de tickets : pied', r"""                        return out;
                    });
                    //  Le compteur en vrac a-t-il été rempli ? (bouton ↩ d'effacement)""", r"""                        return out;
                    };
                    const _ticketsCycle = computed(() => {
                        calculationTick.value;
                        const { debut, fin } = consoT0Fenetre.value;
                        const auj = new Date();
                        return _lireTickets(_ymd(debut), _ymd(fin < auj ? fin : auj));
                    });
                    //  Le compteur en vrac a-t-il été rempli ? (bouton ↩ d'effacement)""")

# ── 2. Les saisies du cycle = compteur du cycle + semaines du cycle ─────────
sub('saisies : cycle + semaines', r"""                    const consoT0Saisies = computed(() => {
                        calculationTick.value;
                        const d = donneesAnnuelles.value[consoT0Annee.value];
                        return (d && d.consoRealiseeT0 && d.consoRealiseeT0[consoT0CycleKey.value]) || {};
                    });""", r"""                    //  Le compteur du CYCLE seul (v37.23-26, conservé : il reste valable).
                    const consoT0SaisiesCycle = computed(() => {
                        calculationTick.value;
                        const d = donneesAnnuelles.value[consoT0Annee.value];
                        return (d && d.consoRealiseeT0 && d.consoRealiseeT0[consoT0CycleKey.value]) || {};
                    });
                    /* ── v37.27 : LES SEMAINES ──────────────────────────────────────────
                       Une semaine = un lundi (YYYY-MM-DD). Clé de stockage : 'S' + lundi,
                       dans consoRealiseeT0, comme les cycles. Une semaine appartient au
                       cycle où tombe son JEUDI : la majorité de ses jours. */
                    const _RE_SEMAINE = /^S\d{4}-\d{2}-\d{2}$/;
                    const _decaler = (iso, nbJours) => { const [y, m, j] = iso.split('-').map(Number); return new Date(y, m - 1, j + nbJours); };
                    const _lundiISO = (dt) => _ymd(new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() - ((dt.getDay() + 6) % 7)));
                    const _jeudiISO = (lundiISO) => _ymd(_decaler(lundiISO, 3));
                    const _semaineDansCycle = (lundiISO) => {
                        const t = _jeudiISO(lundiISO), { debut, fin } = consoT0Fenetre.value;
                        return t >= _ymd(debut) && t <= _ymd(fin);
                    };
                    //  Toutes les saisies d'une semaine, quel que soit le seau annuel qui les porte.
                    const _valeursSemaine = (lundiISO) => {
                        const out = {};
                        Object.values(donneesAnnuelles.value || {}).forEach(a => {
                            const r = a && a.consoRealiseeT0 && a.consoRealiseeT0['S' + lundiISO];
                            if (r && typeof r === 'object') Object.assign(out, r);
                        });
                        return out;
                    };
                    const consoSemainesDuCycle = computed(() => {
                        calculationTick.value;
                        const out = {};
                        Object.values(donneesAnnuelles.value || {}).forEach(a => {
                            const r = a && a.consoRealiseeT0;
                            if (!r) return;
                            Object.keys(r).forEach(k => {
                                if (_RE_SEMAINE.test(k) && _semaineDansCycle(k.slice(1)) && r[k] && typeof r[k] === 'object') out[k.slice(1)] = Object.assign(out[k.slice(1)] || {}, r[k]);
                            });
                        });
                        return out;
                    });
                    const consoT0Saisies = computed(() => {
                        const m = { ...consoT0SaisiesCycle.value };
                        Object.values(consoSemainesDuCycle.value).forEach(w => Object.entries(w).forEach(([k, v]) => { m[k] = (Number(m[k]) || 0) + (Number(v) || 0); }));
                        return m;
                    });
                    //  La semaine affichée : 0 = en cours, -1 = la précédente, +1 = la suivante…
                    const semaineDecalage = ref(0);
                    const changerSemaine = (delta) => { semaineDecalage.value = delta === 0 ? 0 : semaineDecalage.value + delta; };""")

# ── 3. Écrire / effacer une saisie de semaine ; effacer le cycle entier ─────
sub('saisie de semaine + reset', r"""                    const resetConsoT0 = () => {
                        const d = donneesAnnuelles.value[consoT0Annee.value];
                        if (!d || !d.consoRealiseeT0) return;
                        delete d.consoRealiseeT0[consoT0CycleKey.value];
                        calculationTick.value++;""", r"""                    //  v37.27 : saisie d'une semaine. Le seau annuel qui porte déjà cette semaine,
                    //  sinon celui de l'année du lundi, sinon l'année budgétaire (toujours là).
                    const _seauSemaine = (iso) => {
                        const tous = donneesAnnuelles.value || {};
                        const porteur = Object.values(tous).find(a => a && a.consoRealiseeT0 && a.consoRealiseeT0['S' + iso]);
                        return porteur || tous[Number(iso.slice(0, 4))] || tous[consoT0Annee.value];
                    };
                    const saisirSemaineConso = (lundiISO, cle, montant) => {
                        const d = _seauSemaine(lundiISO);
                        if (!d) return;
                        if (!d.consoRealiseeT0 || typeof d.consoRealiseeT0 !== 'object') d.consoRealiseeT0 = {};
                        const sk = 'S' + lundiISO;
                        if (montant === '' || montant === null || montant === undefined) {
                            const ligne = d.consoRealiseeT0[sk];
                            if (ligne && Object.prototype.hasOwnProperty.call(ligne, cle)) {
                                delete ligne[cle];
                                if (!Object.keys(ligne).length) delete d.consoRealiseeT0[sk];
                                calculationTick.value++; handleDataChange();
                            }
                            return;
                        }
                        if (!d.consoRealiseeT0[sk] || typeof d.consoRealiseeT0[sk] !== 'object') d.consoRealiseeT0[sk] = {};
                        d.consoRealiseeT0[sk][cle] = Math.max(0, Math.round(Number(montant) || 0));
                        calculationTick.value++;
                        handleDataChange();
                    };
                    //  Retire les saisies de CYCLE (celles d'avant la saisie hebdomadaire) d'une catégorie.
                    const retirerSaisiesCycle = (catKey) => {
                        const d = donneesAnnuelles.value[consoT0Annee.value];
                        const ligne = d && d.consoRealiseeT0 && d.consoRealiseeT0[consoT0CycleKey.value];
                        if (!ligne) return;
                        Object.keys(ligne).filter(k => k === catKey || k.startsWith(catKey + '::')).forEach(k => delete ligne[k]);
                        calculationTick.value++; handleDataChange();
                    };
                    const resetConsoT0 = () => {
                        //  « Tout effacer » : le compteur du cycle ET les semaines qui lui appartiennent.
                        Object.values(donneesAnnuelles.value || {}).forEach(a => {
                            const r = a && a.consoRealiseeT0;
                            if (!r) return;
                            Object.keys(r).forEach(k => { if (_RE_SEMAINE.test(k) && _semaineDansCycle(k.slice(1))) delete r[k]; });
                        });
                        const d = donneesAnnuelles.value[consoT0Annee.value];
                        if (!d || !d.consoRealiseeT0) { calculationTick.value++; handleDataChange(); return; }
                        delete d.consoRealiseeT0[consoT0CycleKey.value];
                        calculationTick.value++;""")

# ── 4. liberteCycle : la semaine choisie ────────────────────────────────────
sub('semaine choisie : amorce', r"""                        const cleVar = compteDeFlux('variable');
                        const categories = consoCategoriesT0.value.map(c => {""", r"""                        const cleVar = compteDeFlux('variable');
                        //  v37.27 : la SEMAINE affichée (lundi → dimanche), décalée de -1 / +1…
                        const auj = new Date();
                        const decal = semaineDecalage.value;
                        const idxAuj = (auj.getDay() + 6) % 7;
                        const lundiSel = _ymd(_decaler(_lundiISO(auj), 7 * decal));
                        const dimSel = _ymd(_decaler(lundiSel, 6));
                        const frac = decal < 0 ? 1 : (decal > 0 ? 0 : (idxAuj + 1) / 7);   // part de la semaine écoulée
                        const TS = _lireTickets(lundiSel, dimSel);
                        const valsSem = _valeursSemaine(lundiSel);
                        const baseCycle = consoT0SaisiesCycle.value;
                        const aSaisie = (cle) => Object.prototype.hasOwnProperty.call(valsSem, cle);
                        const categories = consoCategoriesT0.value.map(c => {""")
sub('semaine choisie : par catégorie', r"""                            const engageCat = c.declare || declare ? c.engage : c.theorique;
                            const resteCat = c.budget - engageCat;
                            return {""", r"""                            const engageCat = c.declare || declare ? c.engage : c.theorique;
                            const resteCat = c.budget - engageCat;
                            //  ── v37.27 : la même catégorie, vue SEMAINE ──
                            const gS = TS.parCle[c.key] || { total: 0, tx: [], parPoste: {} };
                            const semBudget = Math.round(c.budget / 4.3);
                            const postesSem = prevu.map(p => {
                                const bud = Math.round(p.partCycle / 4.3);
                                const sai = Math.max(0, Math.round(Number(valsSem[p.cle] || 0)));
                                const tk = Math.round(gS.parPoste[p.categorieId] || 0);
                                const eng = Math.max(sai, tk);
                                return { cle: p.cle, nom: p.nom, emoji: p.emoji, budget: bud, saisi: sai, declare: aSaisie(p.cle), tickets: tk, engage: eng,
                                         pct: bud > 0 ? Math.min(100, Math.round(eng / bud * 100)) : (eng > 0 ? 100 : 0), depasse: eng > bud };
                            });
                            const libreS = Math.max(0, Math.round(Number(valsSem[c.key] || 0)));
                            const saisiS = libreS + postesSem.reduce((s, p) => s + p.saisi, 0);
                            const ticketsS = Math.round(gS.total);
                            const declS = saisiS > 0 || ticketsS > 0 || Object.keys(valsSem).some(k => k === c.key || k.startsWith(c.key + '::'));
                            const ailleurs = c.declare || declare;                       // déclaré ailleurs dans le cycle
                            //  Une estimation n'a de sens que pour la semaine EN COURS, tant que rien n'est déclaré
                            //  dans le cycle ; une semaine passée ou à venir sans saisie vaut 0, pas « tout dépensé ».
                            const estimee = !declS && !ailleurs && decal === 0;
                            const engS = declS ? Math.max(saisiS, ticketsS) : (estimee ? Math.round(semBudget * frac) : 0);
                            const sem = {
                                budget: semBudget, engage: engS, saisi: saisiS, libre: libreS, tickets: ticketsS, declare: declS,
                                reste: semBudget - engS, pct: semBudget > 0 ? Math.min(100, Math.round(engS / semBudget * 100)) : (engS > 0 ? 100 : 0),
                                source: declS ? (ticketsS > saisiS ? 'tickets' : 'compteur') : (estimee ? 'estime' : 'vide'),
                                postes: postesSem, nb: gS.tx.length,
                                //  Les saisies de CYCLE d'avant la saisie hebdomadaire, toujours comptées
                                cycleAvant: Object.keys(baseCycle).filter(k => k === c.key || k.startsWith(c.key + '::')).reduce((s, k) => s + (Number(baseCycle[k]) || 0), 0),
                            };
                            return {
                                sem,""")
sub('la semaine, au niveau de la carte', r"""                            horsBudget: Math.round(T.horsTotal), horsBudgetTx: T.hors.slice().sort(_parDateDesc),
                            categories,
                        };
                    });""", r"""                            horsBudget: Math.round(T.horsTotal), horsBudgetTx: T.hors.slice().sort(_parDateDesc),
                            categories,
                            semaine: (() => {
                                const sb = categories.reduce((s, c) => s + c.sem.budget, 0), se = categories.reduce((s, c) => s + c.sem.engage, 0);
                                const lib = (iso) => { const t = _decaler(iso, 0); return t.getDate() + ' ' + _MOIS_COURTS[t.getMonth()]; };
                                const { debut, fin } = consoT0Fenetre.value, th = _jeudiISO(lundiSel);
                                return { decalage: decal, lundi: lundiSel, dimanche: dimSel, du: lib(lundiSel), au: lib(dimSel),
                                         statut: decal === 0 ? 'en_cours' : (decal < 0 ? 'passee' : 'avenir'),
                                         idxJour: decal === 0 ? idxAuj : null, frac, dansCycle: _semaineDansCycle(lundiSel),
                                         cycleRel: th < _ymd(debut) ? 'precedent' : (th > _ymd(fin) ? 'suivant' : null),
                                         estime: categories.length > 0 && categories.every(c => c.sem.source === 'estime'),
                                         budget: sb, engage: se, reste: sb - se, pct: sb > 0 ? Math.min(100, Math.round(se / sb * 100)) : 0 };
                            })(),
                        };
                    });""")

# ── 5. Exposition ───────────────────────────────────────────────────────────
sub('exposition', r"""                        liberteCycle, sanctuaireHebdo, consoCompteurRenseigne, saisirCompteurConso,""",
    r"""                        liberteCycle, sanctuaireHebdo, consoCompteurRenseigne, saisirCompteurConso,
                        semaineDecalage, changerSemaine, saisirSemaineConso, retirerSaisiesCycle,""")

for a, r in edits: src = src.replace(a, r, 1)
io.open(F, 'w', encoding='utf-8').write(src)
print(f'✔ {len(edits)} modifications appliquées à {F}')
