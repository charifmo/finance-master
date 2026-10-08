# -*- coding: utf-8 -*-
"""
v37.30 Rythmes-Par-Ligne — une périodicité par sous-catégorie.

  Dans la vraie vie, « Hri » (le ravitaillement) se fait une fois par mois, la
  viande (« L7m ») à la semaine, le « Psy » à la quinzaine. Chaque ligne de
  détail d'une charge variable porte désormais SON rythme :
      details[i].periode ∈ { 'semaine', 'quinzaine', 'cycle' }
  Coût d'une ligne sur un cycle de N semaines réelles (v37.29) :
      /sem   → montant × N        /15 j → montant × N / 2        /cycle → montant × 1

  RÉTROCOMPATIBILITÉ — une ligne SANS rythme hérite de sa catégorie : « / sem »
  → /sem, « / mois » → /cycle. Aucune donnée existante ne change d'un dirham ;
  le sélecteur propose /sem par défaut sur une catégorie hebdomadaire.

  LA SOURCE DE VÉRITÉ DEVIENT LA LIGNE — `valeur` était la somme brute des
  lignes, lue dans l'unité de la catégorie : avec des rythmes mêlés, cette somme
  ne veut plus rien dire (Hri 1 000 / cycle × 5 semaines…). Un seul calcul,
  coutVariableDuCycle(cv, mois, an), sert désormais TOUS les moteurs (Pilotage,
  Météo, Prévisionnel, surplus, journal, relevé, contrôle, graphiques). `valeur`
  reste un résumé : l'équivalent dans l'unité de la catégorie (égal à la somme
  brute tant que les lignes partagent son rythme), lu par le CFO.

  LA SEMAINE (Météo) — une ligne /15 j ou /cycle ne s'achète pas chaque semaine :
  elle se suit sur le CYCLE (son enveloppe, son reste), et la semaine où elle est
  dépensée, cette dépense compte comme PRÉVUE dans la limite de l'enveloppe
  restante. Plus de faux « dépassé » la semaine du ravitaillement.
"""
import io, sys
F = 'index.html'
src = io.open(F, encoding='utf-8').read()
edits = []
def sub(label, anchor, replacement, expected=1):
    n = src.count(anchor)
    if n != expected:
        print(f'✖ {label} : {n} ancre(s), {expected} attendue(s)'); sys.exit(1)
    edits.append((anchor, replacement, expected))

# ══ 1. LE MODÈLE : rythme d'une ligne, coût d'une charge sur un cycle ═══════════
sub('modèle des rythmes', r"""                    //  Le coût d'une charge variable sur UN cycle : exception du mois comprise,
                    //  puis × les semaines du cycle si elle est saisie « / sem ».
                    const valeurVariableDuCycle = (cv, mois, an) => {
                        const v = valeurEffective(cv, (cv || {}).valeur, mois);
                        return (cv || {}).periode === 'semaine' ? v * semainesDuCycle(mois, an) : v;
                    };""",
    r"""                    /*  v37.30 — UN RYTHME PAR LIGNE DE DÉTAIL.
                        details[i].periode : 'semaine' | 'quinzaine' | 'cycle'. Sans rythme,
                        une ligne hérite de sa catégorie (« / sem » → semaine, « / mois » →
                        cycle) : les données existantes ne bougent pas d'un dirham. */
                    const RYTHMES = ['semaine', 'quinzaine', 'cycle'];
                    const periodeDetail = (d, cv) => RYTHMES.includes(d && d.periode) ? d.periode : ((cv || {}).periode === 'semaine' ? 'semaine' : 'cycle');
                    //  Combien de fois une ligne tombe dans un cycle de N semaines réelles
                    const facteurPeriode = (p, n) => p === 'semaine' ? n : (p === 'quinzaine' ? n / 2 : 1);
                    //  L'exception du mois budgétaire (même règle que valeurEffective), ou null
                    const exceptionDuMois = (item, mois) => {
                        let v = null; const m = Number(mois);
                        ((item || {}).exceptions || []).forEach(e => {
                            const md = Number(e.moisDebut || 0), mf = Number(e.moisFin || 0);
                            if (md && mf && m >= md && m <= mf) v = Number(e.nouvelleValeur || 0);
                        });
                        return v;
                    };
                    const aDesLignes = (cv) => Array.isArray((cv || {}).details) && cv.details.length > 0;
                    //  Ce que coûte UNE ligne sur le cycle (mois, an) — cycle courant par défaut
                    const dueDetailDuCycle = (d, cv, mois, an) => {
                        const mb = moisBudgetaire.value;
                        const n = semainesDuCycle(Number(mois) || mb.mois, Number(an) || mb.an);
                        return (Number((d || {}).montant) || 0) * facteurPeriode(periodeDetail(d, cv), n);
                    };
                    /*  LE coût d'une charge variable sur UN cycle — utilisé par TOUS les moteurs.
                          • une exception du mois remplace la catégorie entière (dans son unité) ;
                          • sinon, avec des lignes : Σ montant × (N, N/2 ou 1) selon le rythme ;
                          • sans ligne : valeur × N (« / sem ») ou valeur (« / mois »). */
                    const coutVariableDuCycle = (cv, mois, an, avecExceptions = true) => {
                        const c = cv || {};
                        const mb = moisBudgetaire.value;
                        const m = Number(mois) || mb.mois, a = Number(an) || mb.an;
                        const n = semainesDuCycle(m, a);
                        const exc = avecExceptions ? exceptionDuMois(c, m) : null;
                        if (exc === null && aDesLignes(c))
                            return c.details.reduce((s, d) => s + (Number((d || {}).montant) || 0) * facteurPeriode(periodeDetail(d, c), n), 0);
                        const v = exc !== null ? exc : (Number(c.valeur) || 0);
                        return c.periode === 'semaine' ? v * n : v;
                    };
                    //  Le coût dépend-il du nombre de semaines du cycle ? (non : tout au /cycle)
                    const dependDesSemaines = (cv) => aDesLignes(cv)
                        ? cv.details.some(d => Number((d || {}).montant) > 0 && periodeDetail(d, cv) !== 'cycle')
                        : (cv || {}).periode === 'semaine';
                    //  `valeur` d'une catégorie à lignes : l'équivalent dans SON unité. Lignes au
                    //  rythme de la catégorie → leur somme exacte (comme avant) ; rythmes mêlés →
                    //  l'équivalent sur une année réelle (semaines de l'année ÷ 12), arrondi.
                    const valeurEquivalente = (cv, an) => {
                        const c = cv || {};
                        if (!aDesLignes(c)) return Number(c.valeur) || 0;
                        const brut = c.details.reduce((s, d) => s + (Number((d || {}).montant) || 0), 0);
                        const unite = c.periode === 'semaine' ? 'semaine' : 'cycle';
                        if (c.details.every(d => periodeDetail(d, c) === unite)) return brut;
                        const sa = semainesDeLAnnee(Number(an) || moisBudgetaire.value.an);
                        const parCycle = c.details.reduce((s, d) => s + (Number((d || {}).montant) || 0) * facteurPeriode(periodeDetail(d, c), sa / 12), 0);
                        return Math.round(unite === 'semaine' ? parCycle / (sa / 12) : parCycle);
                    };
                    //  Le coût d'une charge variable sur UN cycle, exception du mois comprise.
                    const valeurVariableDuCycle = (cv, mois, an) => coutVariableDuCycle(cv, mois, an, true);""")

sub('getMonthlyVariableValue ligne par ligne', r"""                    const getMonthlyVariableValue = (item, mois, an) => {
                        const v = Number((item || {}).valeur) || 0;
                        if (item?.periode !== 'semaine') return v;
                        const mb = moisBudgetaire.value;
                        return v * (mois ? semainesDuCycle(mois, an || mb.an) : semainesDuCycle(mb.mois, mb.an));
                    };""",
    r"""                    //  v37.30 : ligne par ligne (chacune son rythme), hors exception du mois.
                    const getMonthlyVariableValue = (item, mois, an) => coutVariableDuCycle(item, mois, an, false);""")
sub('budget révisé : exception + lignes', r"""                        const v = valeurEffective(c, c.valeur, moisBudgetaire.value.mois);
                        return Math.max(0, getMonthlyVariableValue({ ...c, valeur: v }) - economieCategorieAbsence(cv));""",
    r"""                        //  v37.30 : sans exception, ligne par ligne (chacune son rythme).
                        return Math.max(0, coutVariableDuCycle(c, moisBudgetaire.value.mois, moisBudgetaire.value.an, true) - economieCategorieAbsence(cv));""")
sub('synchro de valeur', r"""                                if (cv?.details?.length > 0) cv.valeur = cv.details.reduce((sum, d) => sum + (Number(d.montant) || 0), 0);""",
    r"""                                //  v37.30 : l'équivalent dans l'unité de la catégorie (= la somme si
                                //  toutes les lignes ont son rythme ; sinon, rythmes mêlés convertis).
                                if (cv?.details?.length > 0) { const eq = valeurEquivalente(cv, anneeAffichage.value); if (cv.valeur !== eq) cv.valeur = eq; }""")

# ══ 2. LES MOTEURS MOIS PAR MOIS ═════════════════════════════════════════════
sub('radar : coût du cycle', r"""                                const effValeur = _effVal(cv, cv.valeur, m);
                                let monthly = (cv.periode === 'semaine') ? effValeur * semainesDuCycle(m, a) : effValeur;""",
    r"""                                const effValeur = _effVal(cv, cv.valeur, m);
                                let monthly = coutVariableDuCycle(cv, m, a, true);   // v37.30 : ligne par ligne""")
sub('radar : payé ligne par ligne', r"""                                if ((cv.details || []).length > 0) cv.details.forEach(d => { paid += getPaidAmount(d, Number(d.montant || 0), _cyc) || 0; });""",
    r"""                                if ((cv.details || []).length > 0) cv.details.forEach(d => { paid += getPaidAmount(d, dueDetailDuCycle(d, cv, m, a), _cyc) || 0; });""")
sub('flux du mois : coût du cycle', r"""                                const effV = _effVal(cv, cv.valeur);
                                let monthly = (cv.periode === 'semaine') ? effV * semainesDuCycle(mNum, annee) : effV;""",
    r"""                                const effV = _effVal(cv, cv.valeur);
                                let monthly = coutVariableDuCycle(cv, mNum, annee, true);   // v37.30 : ligne par ligne""")
sub('flux du mois : payé ligne par ligne', r"""                                if ((cv.details || []).length > 0) cv.details.forEach(d => { paid += getPaidAmount(d, Number(d.montant||0)) || 0; });""",
    r"""                                if ((cv.details || []).length > 0) cv.details.forEach(d => { paid += getPaidAmount(d, dueDetailDuCycle(d, cv, mNum, annee)) || 0; });""")
sub('journal hybride : dû d\'une ligne', r"""                                        const due = Number(d.montant || 0);
                                        if (!due) return;""",
    r"""                                        const due = dueDetailDuCycle(d, cv, mois, an);   // v37.30 : son rythme
                                        if (!due) return;""")
sub('solde initial : payé d\'une ligne', r"""                                const amt = getPaidAmount(d, Number(d.montant || 0));
                                if (amt > 0) paidChg += amt;""",
    r"""                                const amt = getPaidAmount(d, dueDetailDuCycle(d, cv, mois, an));
                                if (amt > 0) paidChg += amt;""")
sub('trésorerie réalisée : lignes payées', r"""                            (cat.details || []).forEach(f => { if (isItemPaid(f, Number(f.montant || 0))) sorties += Number(f.montant || 0); });""",
    r"""                            (cat.details || []).forEach(f => { const due = dueDetailDuCycle(f, cat); if (isItemPaid(f, due)) sorties += due; });""")
sub('totaux dus / payés', r"""                                cv.details.forEach(d => { const due = Number(d.montant || 0); totalVarDue += due; totalVarPaid += getPaidAmount(d, due); });""",
    r"""                                cv.details.forEach(d => { const due = dueDetailDuCycle(d, cv); totalVarDue += due; totalVarPaid += getPaidAmount(d, due); });""")
sub('tâches du Pilotage : dû d\'une ligne', r"""                            (cat.details || []).forEach(d =>
                                pousser(d, d.nom, Number(d.montant || 0), cat.label, '🛒', 'blue', d.jourPrevu || cat.jourPrevu, 'variable'));""",
    r"""                            (cat.details || []).forEach(d =>
                                pousser(d, d.nom, dueDetailDuCycle(d, cat, moisBud, an), cat.label, '🛒', 'blue', d.jourPrevu || cat.jourPrevu, 'variable'));""")
sub('budget conso théorique : lignes', r"""                                    cat.details.forEach(d => { total += Number(d.montant || 0); });""",
    r"""                                    cat.details.forEach(d => { total += dueDetailDuCycle(d, cat, mb.mois, mb.an); });""")
sub('listes du théorique : lignes', r"""                                    cat.details.forEach(d => {
                                        const m = Number(d.montant || 0);
                                        if (m > 0) out.variables.push({ nom: d.nom || cat.label || '?', montant: m, jourPrevu: cat.jourPrevu || null });""",
    r"""                                    cat.details.forEach(d => {
                                        const m = dueDetailDuCycle(d, cat, mois, an);   // v37.30 : son rythme
                                        if (m > 0) out.variables.push({ nom: d.nom || cat.label || '?', montant: m, jourPrevu: cat.jourPrevu || null });""")
sub('journal : reste du mois en cours', r"""                                    let remaining;
                                    if (curr?.periode === 'semaine') {
                                        remaining = Number(curr?.valeur || 0) * semRest;
                                    } else {
                                        if (curr?.details && curr.details.length > 0) {
                                            remaining = curr.details.reduce((sum, d) => sum + Math.max(0, Number(d.montant || 0) - getPaidAmount(d, Number(d.montant || 0))), 0);
                                        } else {
                                            remaining = Number(curr?.valeur || 0) * rConso;
                                        }
                                    }""",
    r"""                                    let remaining;
                                    if (curr?.details && curr.details.length > 0) {
                                        //  v37.30 : chaque ligne à son rythme — /sem et /15 j au prorata des
                                        //  semaines restantes, /cycle : ce qui n'est pas encore payé.
                                        remaining = curr.details.reduce((sum, d) => {
                                            const p = periodeDetail(d, curr), mt = Number(d.montant || 0);
                                            if (p === 'semaine') return sum + mt * semRest;
                                            if (p === 'quinzaine') return sum + mt * semRest / 2;
                                            return sum + Math.max(0, mt - getPaidAmount(d, mt));
                                        }, 0);
                                    } else if (curr?.periode === 'semaine') {
                                        remaining = Number(curr?.valeur || 0) * semRest;
                                    } else {
                                        remaining = Number(curr?.valeur || 0) * rConso;
                                    }""")
sub('contrôle budget vs réalisé : lignes', r"""                            const kSem = cv.periode === 'semaine' ? semainesDuCycle(m, a) : 1;
                            if (Array.isArray(cv.details) && cv.details.length) {
                                cv.details.forEach(det => add(det.categorieId || cv.categorieId, det.nom, 'charge_variable_detail', Number(det.montant || 0) * kSem));""",
    r"""                            const kSem = cv.periode === 'semaine' ? semainesDuCycle(m, a) : 1;
                            if (Array.isArray(cv.details) && cv.details.length) {
                                cv.details.forEach(det => add(det.categorieId || cv.categorieId, det.nom, 'charge_variable_detail', dueDetailDuCycle(det, cv, m, a)));""")
sub('graphique des lignes', r"""dt=cat.details.map(d=>getMonthlyVariableValue({ periode: cat.periode, valeur: d.montant }));""",
    r"""dt=cat.details.map(d=>dueDetailDuCycle(d, cat));""")
sub('relevé : coût ligne par ligne', r"""                            //  v37.29 : chaque mois restant avec SES semaines (4 ou 5), plus × 4,3.
                            const hebdo = (c || {}).periode === 'semaine';
                            const m = hebdo ? N((c || {}).valeur) * semainesDuCycle(annee === mb.an ? mb.mois : 1, annee) : N((c || {}).valeur);
                            if (m <= 0) return;
                            let annuel = 0;
                            for (let mm = 13 - moisRestants; mm <= 12; mm++) annuel += hebdo ? N((c || {}).valeur) * semainesDuCycle(mm, annee) : N((c || {}).valeur);""",
    r"""                            //  v37.29 : chaque mois restant avec SES semaines (4 ou 5), plus × 4,3.
                            //  v37.30 : et chaque ligne avec SON rythme (/sem, /15 j, /cycle).
                            const m = coutVariableDuCycle(c, annee === mb.an ? mb.mois : 1, annee, false);
                            if (m <= 0) return;
                            let annuel = 0;
                            for (let mm = 13 - moisRestants; mm <= 12; mm++) annuel += coutVariableDuCycle(c, mm, annee, false);""")
sub('indépendance : mois moyen ligne par ligne', r"""                            .reduce((s, c) => s + (c.periode === 'semaine' ? N(c.valeur) * semainesDeLAnnee(anneeAffichage.value) / 12 : N(c.valeur)), 0);   // v37.29 : mois MOYEN de l'année""",
    r"""                            .reduce((s, c) => { let t = 0; for (let m = 1; m <= 12; m++) t += coutVariableDuCycle(c, m, anneeAffichage.value, false); return s + t / 12; }, 0);   // v37.29-30 : mois MOYEN, ligne par ligne""")

# ══ 3. LE PRÉVISIONNEL ═══════════════════════════════════════════════════════
sub('prévisionnel : coût ligne par ligne', r"""                            const v = valeurEffective(c, c.valeur, m);
                            if (v <= 0) return;
                            if (c.periode === 'semaine') {
                                lignes.conso.push({ nom: c.label || '?', montant: Math.round(v * semainesDuCycle(m, an) * 100) / 100, parSemaine: v, compte: compteDeFlux('variable', c), nature: 'variable' });
                            } else {
                                const det = (c.details || []).filter(x => Number(x.montant) > 0).map(x => x.nom + ' ' + formatNombre(x.montant));
                                lignes.mensuelles.push({ nom: c.label || '?', montant: v, jourPrevu: c.jourPrevu || null, detail: det.join(' · '), compte: compteDeFlux('variable', c), nature: 'variable' });""",
    r"""                            const v = valeurEffective(c, c.valeur, m);
                            if (v <= 0) return;
                            //  v37.30 : le coût du cycle, ligne par ligne (chacune son rythme)
                            const cout = Math.round(coutVariableDuCycle(c, m, an, true) * 100) / 100;
                            if (c.periode === 'semaine') {
                                lignes.conso.push({ nom: c.label || '?', montant: cout, parSemaine: Math.round(cout / semainesDuCycle(m, an) * 100) / 100, compte: compteDeFlux('variable', c), nature: 'variable' });
                            } else {
                                const det = (c.details || []).filter(x => Number(x.montant) > 0).map(x => x.nom + ' ' + formatNombre(x.montant) + (periodeDetail(x, c) === 'cycle' ? '' : (periodeDetail(x, c) === 'semaine' ? ' / sem' : ' / 15 j')));
                                lignes.mensuelles.push({ nom: c.label || '?', montant: cout, jourPrevu: c.jourPrevu || null, detail: det.join(' · '), compte: compteDeFlux('variable', c), nature: 'variable' });""")

# ══ 4. LA MÉTÉO : liste de courses, postes de la semaine ═════════════════════
sub('météo : poids de chaque ligne', r"""                            const v = cv.periode === 'semaine' ? c.budget / nSem : c.budget;
                            const dets = (cv.details || []).filter(x => x && Number(x.montant) > 0);
                            const S = dets.reduce((s, x) => s + Number(x.montant), 0);
                            const parId = {};
                            const prevu = dets.map(x => {
                                const part = Number(x.montant) / S;""",
    r"""                            const v = cv.periode === 'semaine' ? c.budget / nSem : c.budget;
                            const dets = (cv.details || []).filter(x => x && Number(x.montant) > 0);
                            //  v37.30 : le poids d'une ligne dans le cycle = montant × (N, N/2 ou 1)
                            //  selon SON rythme ; le budget du moteur (exception, voyage) se répartit
                            //  au prorata de ces poids — `ajuste` vaut 1 sans exception ni voyage.
                            const poidsLigne = (x) => Number(x.montant) * facteurPeriode(periodeDetail(x, cv), nSem);
                            const W = dets.reduce((s, x) => s + poidsLigne(x), 0);
                            const ajuste = W > 0 ? c.budget / W : 1;
                            const uniformes = dets.every(x => periodeDetail(x, cv) === (cv.periode === 'semaine' ? 'semaine' : 'cycle'));
                            const parId = {};
                            const prevu = dets.map(x => {
                                const part = poidsLigne(x) / W;""")
sub('météo : unité de la ligne', r"""                                const p = { nom: x.nom || '—', emoji: emojiPoste(x.nom, x.icone), montant: Math.round(v * part), categorieId: x.categorieId || null,""",
    r"""                                const p = { nom: x.nom || '—', emoji: emojiPoste(x.nom, x.icone), montant: Math.round(Number(x.montant) * ajuste), unite: periodeDetail(x, cv), categorieId: x.categorieId || null,""")
sub('météo : tri et arrondis', r"""                            }).sort((a, b) => b.montant - a.montant);
                            if (prevu.length) prevu[0].montant += Math.round(v) - prevu.reduce((s, x) => s + x.montant, 0);""",
    r"""                            }).sort((a, b) => b.partCycle - a.partCycle || b.montant - a.montant);
                            //  Les parts du cycle tombent juste sur le budget ; les montants affichés
                            //  aussi, quand toutes les lignes ont le rythme de la catégorie.
                            if (prevu.length) prevu[0].partCycle += Math.round(c.budget) - prevu.reduce((s, x) => s + x.partCycle, 0);
                            if (prevu.length && uniformes) prevu[0].montant += Math.round(v) - prevu.reduce((s, x) => s + x.montant, 0);""")
sub('météo : ajusté si exception', r"""                                prevuAjuste: S > 0 && Math.abs(v - S) > 0.5,""",
    r"""                                prevuAjuste: W > 0 && Math.abs(c.budget - W) > 0.5,""")
sub('météo : postes de la semaine', r"""                            const reelCat = c.declare ? engageCat : 0;                            //  ── v37.27 : la même catégorie, vue SEMAINE ──
                            const gS = TS.parCle[c.key] || { total: 0, tx: [], parPoste: {} };
                            const semBudget = Math.round(c.budget / nSem);
                            const postesSem = prevu.map(p => {
                                const bud = Math.round(p.partCycle / nSem);
                                const sai = Math.max(0, Math.round(Number(valsSem[p.cle] || 0)));
                                const tk = Math.round(gS.parPoste[p.categorieId] || 0);
                                const eng = Math.max(sai, tk);
                                return { cle: p.cle, nom: p.nom, emoji: p.emoji, budget: bud, saisi: sai, declare: aSaisie(p.cle), tickets: tk, engage: eng,
                                         pct: bud > 0 ? Math.min(100, Math.round(eng / bud * 100)) : (eng > 0 ? 100 : 0), depasse: eng > bud };
                            });""",
    r"""                            const reelCat = c.declare ? engageCat : 0;
                            //  ── v37.27 : la même catégorie, vue SEMAINE ──
                            const gS = TS.parCle[c.key] || { total: 0, tx: [], parPoste: {} };
                            const postesSem = prevu.map(p => {
                                const sai = Math.max(0, Math.round(Number(valsSem[p.cle] || 0)));
                                const tk = Math.round(gS.parPoste[p.categorieId] || 0);
                                const eng = Math.max(sai, tk);
                                const base = { cle: p.cle, nom: p.nom, emoji: p.emoji, unite: p.unite, saisi: sai, declare: aSaisie(p.cle), tickets: tk, engage: eng };
                                if (p.unite === 'semaine') {
                                    const bud = Math.round(p.partCycle / nSem);
                                    return { ...base, budget: bud, prevu: bud, planifie: 0,
                                             pct: bud > 0 ? Math.min(100, Math.round(eng / bud * 100)) : (eng > 0 ? 100 : 0), depasse: eng > bud };
                                }
                                //  v37.30 : une ligne /15 j ou /cycle se suit sur le CYCLE ; dépensée cette
                                //  semaine, elle compte comme PRÉVUE dans la limite de son enveloppe restante.
                                const ailleurs = Math.max(0, p.engage - eng);
                                return { ...base, budget: 0, prevu: p.montant, cyclePrevu: p.partCycle, cycleEngage: p.engage,
                                         planifie: Math.min(eng, Math.max(0, p.partCycle - ailleurs)),
                                         pct: p.pctEngage, depasse: p.engage > p.partCycle };
                            });
                            //  Le prévu de la semaine : les lignes « / sem » (ou la catégorie entière,
                            //  sans ligne) + les lignes /15 j et /cycle dépensées cette semaine.
                            const prevuCycleLignes = postesSem.filter(p => p.unite !== 'semaine').reduce((s, p) => s + p.cyclePrevu, 0);
                            const prevuSemaine = Math.round((c.budget - prevuCycleLignes) / nSem);
                            const semBudget = prevuSemaine + postesSem.reduce((s, p) => s + p.planifie, 0);""")
sub('météo : semaine exposée', r"""                                budget: semBudget, engage: engS, saisi: saisiS, libre: libreS, tickets: ticketsS, declare: declS,""",
    r"""                                budget: semBudget, prevuSemaine, prevuCycle: prevuCycleLignes, engage: engS, saisi: saisiS, libre: libreS, tickets: ticketsS, declare: declS,""")

# ── Gabarit de la Météo ──────────────────────────────────────────────────────
sub('méthode uniteCourte', r"""                postesVisibles(c) { return this.rxTousPostes ? c.prevu : c.prevu.slice(0, 8); },""",
    r"""                postesVisibles(c) { return this.rxTousPostes ? c.prevu : c.prevu.slice(0, 8); },
                //  v37.30 : le rythme d'une ligne, en court
                uniteCourte(u) { return u === 'quinzaine' ? '/ 15 j' : (u === 'cycle' ? '/ cycle' : '/ sem'); },""")
sub('ligne : prévu de la semaine', r"""                                    <span data-pulse-prevu>Prévu : {{ chiffre(c.sem.budget) }} DH</span>""",
    r"""                                    <span data-pulse-prevu>Prévu : {{ chiffre(c.sem.prevuSemaine) }} DH</span>""")
#  L'enveloppe des lignes /15 j et /cycle : sa propre ligne, pour que le « reste » reste lisible
sub('ligne : enveloppe du cycle', r"""                                    <template v-if="c.sem.tickets > 0"> · 🧾 {{ chiffre(c.sem.tickets) }}</template>
                                </span>
""", r"""                                    <template v-if="c.sem.tickets > 0"> · 🧾 {{ chiffre(c.sem.tickets) }}</template>
                                </span>
                                <span v-if="c.sem.prevuCycle > 0" data-pulse-prevu-cycle class="block text-[10px] font-semibold text-white/50 tabular-nums leading-tight whitespace-nowrap overflow-hidden text-ellipsis">{{ '+ ' + chiffre(c.sem.prevuCycle) + ' DH / cycle (' + c.sem.postes.filter(p => p.unite !== 'semaine').map(p => p.nom).join(' · ') + ')' }}</span>
""")
sub('poste : son rythme', r"""data-pulse-prevu>Prévu : {{ chiffre(d.budget) }} DH<template v-if="d.tickets > 0"> · 🧾 {{ chiffre(d.tickets) }}</template></span>""",
    r"""data-pulse-prevu :data-unite="d.unite">Prévu : {{ chiffre(d.prevu) }} DH{{ d.unite !== 'semaine' ? ' ' + uniteCourte(d.unite) : '' }}<template v-if="d.unite !== 'semaine' && d.cycleEngage > 0"> · <span class="text-white/75">{{ chiffre(d.cycleEngage) }} ce cycle</span></template><template v-if="d.tickets > 0"> · 🧾 {{ chiffre(d.tickets) }}</template></span>""")
sub('poste : le prévu peut passer à la ligne', r"""<span class="block text-[10px] font-semibold text-white/45 tabular-nums leading-tight whitespace-nowrap" data-pulse-prevu""",
    r"""<span class="block text-[10px] font-semibold text-white/45 tabular-nums leading-tight" data-pulse-prevu""")
#  Rayons X : chaque étiquette dit son rythme
sub('rayons x : en-tête du prévu', r"""<span class="text-[10px] font-bold text-slate-400 tabular-nums">par {{ rxContenu.c.prevuUnite }}</span>""",
    r"""<span class="text-[10px] font-bold text-slate-400 tabular-nums" data-rx-prevu-semaines>cycle de {{ p.nbSemaines }} semaines</span>""")
sub('rayons x : étiquette avec rythme', r"""                              :title="d.depense > 0 ? formatMad(d.depense) + ' de tickets sur ce poste ce cycle' : 'Aucun ticket sur ce poste ce cycle'"
""", r"""                              :data-unite="d.unite" :title="formatMad(d.montant) + ' ' + uniteCourte(d.unite) + ' → ' + formatMad(d.partCycle) + ' sur ce cycle de ' + p.nbSemaines + ' semaines · ' + (d.depense > 0 ? formatMad(d.depense) + ' de tickets' : 'aucun ticket')"
""")
sub('rayons x : unité affichée', r"""<span class="relative">{{ d.emoji }} {{ d.nom }} : <span class="font-black text-slate-800">{{ formatMad(d.montant) }}</span></span>""",
    r"""<span class="relative">{{ d.emoji }} {{ d.nom }} : <span class="font-black text-slate-800">{{ formatMad(d.montant) }}</span> <span class="text-slate-400" data-rx-poste-unite>{{ uniteCourte(d.unite) }}</span></span>""")

# ══ 5. LA SECTION CHARGES VARIABLES : un sélecteur par ligne ═════════════════
SELECT_BUREAU = r"""                                        <input type="number" v-model.number="detail.montant" @input="handleDataChange" class="w-20 p-1.5 text-sm font-black text-red-600 text-right outline-none bg-gray-50 rounded border border-transparent focus:border-red-200"/>
                                        <select :value="periodeDetail(detail, item)" @change="detail.periode = $event.target.value; handleDataChange()" data-cv-detail-periode :aria-label="'Rythme de ' + (detail.nom || 'cette ligne')"
                                                class="shrink-0 py-1.5 pl-1 pr-0.5 text-[10px] font-black text-gray-600 bg-gray-100 rounded border border-transparent focus:border-red-200 outline-none cursor-pointer">
                                            <option value="semaine">/sem</option><option value="quinzaine">/15j</option><option value="cycle">/cycle</option>
                                        </select>"""
sub('éditeur bureau : sélecteur', r"""                                        <input type="number" v-model.number="detail.montant" @input="handleDataChange" class="w-20 p-1.5 text-sm font-black text-red-600 text-right outline-none bg-gray-50 rounded border border-transparent focus:border-red-200"/>""",
    SELECT_BUREAU)
sub('éditeur téléphone : sélecteur', r"""                                            <input type="number" v-model.number="detail.montant" @input="handleDataChange" class="w-24 p-3 text-sm font-black text-red-600 text-right outline-none bg-gray-50 rounded"/>""",
    r"""                                            <input type="number" v-model.number="detail.montant" @input="handleDataChange" class="flex-1 min-w-0 p-3 text-sm font-black text-red-600 text-right outline-none bg-gray-50 rounded"/>
                                            <select :value="periodeDetail(detail, item)" @change="detail.periode = $event.target.value; handleDataChange()" data-cv-detail-periode :aria-label="'Rythme de ' + (detail.nom || 'cette ligne')"
                                                    class="shrink-0 px-1 text-xs font-black text-gray-700 bg-gray-100 rounded border border-gray-200 outline-none">
                                                <option value="semaine">/sem</option><option value="quinzaine">/15j</option><option value="cycle">/cycle</option>
                                            </select>""")
sub('éditeur téléphone : nom pleine largeur', r"""                                            <input type="text" v-model="detail.nom" @input="handleDataChange" placeholder="Nom..." class="flex-1 p-3 text-sm font-bold text-gray-700 outline-none bg-gray-50 rounded"/>""",
    r"""                                            <input type="text" v-model="detail.nom" @input="handleDataChange" placeholder="Nom..." class="basis-full min-w-0 p-3 text-sm font-bold text-gray-700 outline-none bg-gray-50 rounded"/>""")
sub('éditeur téléphone : nom au-dessus, montant · rythme · ✕ dessous', r"""class="bg-white p-2 rounded-lg border border-gray-200 flex items-stretch gap-2">""",
    r"""class="bg-white p-2 rounded-lg border border-gray-200 flex flex-wrap items-stretch gap-2">""")
sub('éditeur : nouvelle ligne au rythme de la catégorie', r"""<button @click="(item.details = item.details || []).push({ id: Date.now(), nom: 'Nouvelle ligne', montant: 0, paye: false, montantPaye: 0 }); handleDataChange()" """,
    r"""<button @click="(item.details = item.details || []).push({ id: Date.now(), nom: 'Nouvelle ligne', montant: 0, periode: item.periode === 'mois' ? 'cycle' : 'semaine', paye: false, montantPaye: 0 }); handleDataChange()" """, expected=2)
sub('éditeur bureau : consigne', r"""Détail des dépenses (Le total remplace la valeur ci-dessus)</p>""",
    r"""Détail des dépenses — chaque ligne a son rythme : /sem, /15j ou /cycle</p>""")
sub('éditeur téléphone : consigne', r"""Détail (total remplace la valeur)</p>""", r"""Détail — un rythme par ligne</p>""")
#  Le calcul du cycle en cours et du suivant : ligne par ligne
for nom, cle in (('bureau', 'cvs_'), ('téléphone', 'cvsm_')):
    sub(f'éditeur {nom} : calcul du cycle', r"""<span v-for="cy in cyclesSemaines" :key="'""" + cle + r"""' + cy.cle" data-cv-cycle :data-semaines="cy.n" class="inline-block whitespace-nowrap">{{ cy.label }} : {{ cy.n }} sem. → {{ item.periode === 'semaine' ? formatMAD((item.valeur || 0) * cy.n) : formatMAD((item.valeur || 0) / cy.n) + ' / sem.' }}</span>""",
        r"""<span v-for="cy in cyclesSemaines" :key="'""" + cle + r"""' + cy.cle" data-cv-cycle :data-semaines="cy.n" class="inline-block whitespace-nowrap">{{ cy.label }} : {{ cy.n }} sem. → {{ dependDesSemaines(item) ? formatMAD(coutVariableDuCycle(item, cy.mois, cy.an, false)) : formatMAD((item.valeur || 0) / cy.n) + ' / sem.' }}</span>""")
sub('éditeur : condition d\'affichage', r"""v-if="item.periode === 'semaine' || item.categorieId !== 'cat_cv_factures'" data-cv-semaines""",
    r"""v-if="dependDesSemaines(item) || item.categorieId !== 'cat_cv_factures'" data-cv-semaines""", expected=2)
sub('exports', r"""                        semainesDuCycle, semainesDeLAnnee, cyclesSemaines,""",
    r"""                        semainesDuCycle, semainesDeLAnnee, cyclesSemaines,
                        // v37.30 : un rythme par ligne de détail
                        periodeDetail, coutVariableDuCycle, dependDesSemaines, valeurEquivalente,""")

for a, r, n in edits: src = src.replace(a, r, n)
io.open(F, 'w', encoding='utf-8').write(src)
print(f'✔ {len(edits)} modifications appliquées à {F}')
