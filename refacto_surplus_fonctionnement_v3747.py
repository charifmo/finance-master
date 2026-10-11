# -*- coding: utf-8 -*-
"""
v37.47 — « LE PRINCIPE DE SURPLUS N'EST PAS BON. Le surplus brut, c'est après que j'ai
effectué toutes les charges : combien il reste sur le courant ET Assafa fixe à la fin
du mois. Le surplus net est celui après le transfert de toutes les épargnes. […] quitte à
ajouter des flags à cocher pour distinguer les comptes courants ou les déduire de leur
fonction : maintenant tout est mélangé ! »

  AVANT — le surplus ne regardait QUE le Compte Courant :
    • les charges fixes payées par Assafa en sortaient, mais le virement Courant →
      Assafa qui les finance y entrait comme une sortie (v37.37) ;
    • l'« épargne » comptait toute ligne d'épargne partie du Courant — y compris
      « Compte Principale ASSAFA » (20 000 DH/mois en 2027), qui n'est pas de l'épargne
      mais l'argent des charges fixes : 33 250 DH d'« épargne » au lieu de 13 250 ;
    • le type d'un compte ne disait rien : Courant, Assafa, Dépenses annuelles et
      Compte urgence sont tous « liquide ».

  APRÈS — un PÉRIMÈTRE DE FONCTIONNEMENT :
    • chaque compte est « de fonctionnement » ou non. Par défaut, déduit de sa
      fonction : le compte courant, le compte des charges fixes, celui des charges
      variables, et tout compte qui reçoit un revenu. Une case à cocher par compte
      (Budget Structurel › Architecture des comptes) force le choix ; « ↺ auto »
      revient à la déduction ;
    • BRUT = ce qui reste sur ces comptes après TOUTES leurs charges (fixes,
      variables, dépenses ponctuelles payées par eux), revenus compris. Mois en
      cours : leur solde réel + ce qui reste à encaisser − ce qui reste à payer
      (l'épargne déjà versée y est remise) ;
    • ÉPARGNE = ce qui QUITTE le périmètre vers un compte qui n'en est pas (ligne
      d'épargne ou virement interne) ; ce qui y REVIENT d'un compte d'épargne la
      diminue (reprise). Un mouvement entre deux comptes de fonctionnement
      (Courant → Assafa) n'est ni une charge ni de l'épargne : il s'annule ;
    • NET = BRUT − ÉPARGNE.
  Même règle pour la Météo et le Bilan (respirationDuMois) : une « épargne » vers un
  compte de fonctionnement n'y est plus comptée, et une dépense payée par un compte
  d'épargne (Dépenses annuelles…) n'est plus comptée une seconde fois — l'épargne qui
  l'a provisionnée l'est déjà ; le Bilan la montre à part. Et pour le CFO (serveur
  PHP, cfo_compute_monthly_net_courant), au dirham près.
"""
import io, sys

F = 'index.html'
src = io.open(F, encoding='utf-8').read()

def sub(label, a, b, n=1):
    global src
    c = src.count(a)
    if c != n:
        print(f'✖ {label} : {c} ancre(s), {n} attendue(s)'); sys.exit(1)
    src = src.replace(a, b)

# ── 1. Le périmètre de fonctionnement ────────────────────────────────────────
sub('périmètre de fonctionnement', """                    // ─────────────────────────────────────────────────────────────────────────
                    // v27.60 Rolling-Cashflow-Macro : MOTEUR FLUX — PÉRIMÈTRE COMPTE COURANT STRICT""",
"""                    /* ═══════════════════════════════════════════════════════════════
                       v37.47 — LE PÉRIMÈTRE DE FONCTIONNEMENT
                       Les comptes qui font tourner le mois : leurs revenus et leurs charges
                       forment le surplus BRUT ; ce qui les quitte vers un autre compte est
                       de l'ÉPARGNE. Par défaut, déduit de la fonction du compte : le compte
                       courant, le compte des charges fixes, celui des charges variables, et
                       tout compte qui reçoit un revenu. compte.fonctionnement (true / false),
                       coché dans l'Architecture des comptes, force le choix.
                       ═══════════════════════════════════════════════════════════════ */
                    const comptesFonctionnementAuto = computed(() => {
                        const ck = _cleCourant.value, si = soldesInitiaux.value || {};
                        const n = (k) => _cleCompte(k, ck);
                        const auto = new Set([ck, n(si.compteChargesFixes || 'courant'), n(si.compteChargesVariables || 'courant')]);
                        Object.values(donneesAnnuelles.value || {}).forEach(d =>
                            Object.values((d || {}).revenus || {}).forEach(r => auto.add(n((r || {}).destinationCompte || 'courant'))));
                        return auto;
                    });
                    const comptesFonctionnement = computed(() => {
                        const auto = comptesFonctionnementAuto.value, liste = comptes.value || [];
                        if (!liste.length) return new Set([_cleCourant.value]);
                        const out = new Set();
                        liste.forEach(c => {
                            const k = 'cpt_' + c.id;
                            if (c.fonctionnement === true || (c.fonctionnement !== false && auto.has(k))) out.add(k);
                        });
                        return out;
                    });
                    const estFonctionnement = (k) => comptesFonctionnement.value.has(_cleCompte(k, _cleCourant.value));
                    const fonctionnementExplicite = (id) => {
                        const c = (comptes.value || []).find(x => String(x.id) === String(id));
                        return c && (c.fonctionnement === true || c.fonctionnement === false) ? c.fonctionnement : null;
                    };
                    const definirFonctionnement = (id, valeur) => {
                        const c = (comptes.value || []).find(x => String(x.id) === String(id));
                        if (!c) return;
                        c.fonctionnement = !!valeur;
                        handleDataChange();
                    };
                    const remettreFonctionnementAuto = (id) => {
                        const c = (comptes.value || []).find(x => String(x.id) === String(id));
                        if (!c) return;
                        delete c.fonctionnement;
                        handleDataChange();
                    };
                    //  Un mouvement entre deux comptes : +1 s'il QUITTE le périmètre (épargne),
                    //  −1 s'il y REVIENT (reprise d'épargne), 0 s'il reste dedans ou dehors.
                    const sensEpargne = (src, dest) => {
                        const a = estFonctionnement(src || 'courant'), b = estFonctionnement(dest || 'courant');
                        return a === b ? 0 : (a ? 1 : -1);
                    };
                    //  Où va une ligne d'épargne : son compte lié, sinon sa poche virtuelle.
                    const destEpargne = (ep) => {
                        const l = (ep || {}).linkedAccountId;
                        return (l !== undefined && l !== null && l !== '') ? l : 'ep_' + (ep || {}).id;
                    };
                    //  Pour la bulle : qui compte dans le brut, où va l'épargne.
                    const perimetreSurplus = computed(() => {
                        const liste = comptes.value || [];
                        const nom = (c) => c.label || c.nom || ('Compte ' + c.id);
                        const f = liste.filter(c => comptesFonctionnement.value.has('cpt_' + c.id)).map(nom);
                        const e = liste.filter(c => !comptesFonctionnement.value.has('cpt_' + c.id)).map(nom);
                        return { fonctionnement: f.length ? f.join(' + ') : 'le compte courant', epargne: e.length ? e.join(', ') : 'vos poches d’épargne' };
                    });

                    // ─────────────────────────────────────────────────────────────────────────
                    // v27.60 Rolling-Cashflow-Macro : MOTEUR FLUX — PÉRIMÈTRE COMPTE COURANT STRICT""")

# ── 2. Le moteur de flux mensuel : le périmètre « fonctionnement » ───────────
sub('flux : portée', """                        const _courantOnly = scope === 'courant';""",
"""                        const _courantOnly = scope === 'courant';
                        //  v37.47 : 'fonctionnement' → les comptes du périmètre de fonctionnement
                        //  (le surplus). Les virements internes n'y sont PAS : le surplus les range
                        //  dans l'épargne (vers l'épargne) ou les annule (entre deux comptes du périmètre).
                        const _fonct = scope === 'fonctionnement';
                        const _perim = _courantOnly || _fonct;""")
sub('flux : dans le périmètre', """                        const _isCourant = (k) => _normKey(k) === courantKey;""",
"""                        const _isCourant = (k) => _normKey(k) === courantKey;
                        const _dans = (k) => _fonct ? estFonctionnement(k) : _isCourant(k);""")
sub('flux : revenus', """                            if (_courantOnly && !_isCourant(r.destinationCompte)) return;
                            const a = _amt(r, r.base); if (a > 0) entrants += a;""",
"""                            if (_perim && !_dans(r.destinationCompte)) return;
                            const a = _amt(r, r.base); if (a > 0) entrants += a;""")
sub('flux : fixes', """                        if (!_courantOnly || _fxSrc === courantKey) {""", """                        if (!_perim || _dans(_fxSrc)) {""")
sub('flux : variables', """                        if (!_courantOnly || _varSrc === courantKey) {""", """                        if (!_perim || _dans(_varSrc)) {""")
sub('flux : ponctuelles', """                            if (_courantOnly && !_isCourant(dep.sourceCompte)) return;
                            const rawDue = Number(dep.montant || 0); if (rawDue === 0) return;""",
"""                            if (_perim && !_dans(dep.sourceCompte)) return;
                            const rawDue = Number(dep.montant || 0); if (rawDue === 0) return;""")

# ── 3. Le surplus détaillé : brut du périmètre, épargne qui le quitte ────────
sub('surplus : épargne et virements', """                        // Épargne : ne compter que les virements sortant DU Compte Courant
                        const _courantCpt = (comptes.value || []).find(c => c.type === 'courant' || c.type === 'liquide');
                        const _courantKey = _courantCpt ? 'cpt_' + _courantCpt.id : 'courant';
                        const _isCourantSrc = (k) => _cleCompte(k, _courantKey) === _courantKey; // v37.8
                        const epArr = (Array.isArray(d.epargne) ? d.epargne : Object.values(d.epargne || {}))
                            .filter(Boolean)
                            .filter(obj => _isCourantSrc(obj.sourceCompte));""",
"""                        //  v37.47 : l'épargne = ce qui QUITTE le périmètre de fonctionnement (ligne
                        //  d'épargne ou virement interne), moins ce qui y REVIENT. Entre deux comptes
                        //  du périmètre (Courant → Assafa), ce n'est pas de l'épargne : ça s'annule.
                        const epArr = (Array.isArray(d.epargne) ? d.epargne : Object.values(d.epargne || {}))
                            .filter(Boolean)
                            .map(obj => ({ obj, sens: sensEpargne(obj.sourceCompte || 'courant', destEpargne(obj)) }))
                            .filter(x => x.sens !== 0);
                        //  Solde réel des comptes du périmètre (le mois en cours part de là)
                        const soldePerimetre = (comptes.value || []).length
                            ? (comptes.value || []).filter(c => estFonctionnement('cpt_' + c.id)).reduce((s, c) => s + (Number(c.solde) || 0), 0)
                            : (tresoActuelleCourante.value || 0);""")
sub('surplus : un mois', """                            const { entrants, sortants } = _getMonthFlux(mNum, anneeAffichage.value, mode);
                            /*  v37.36 — L'ÉPARGNE DU MOIS. Chaque objectif vaut, CE mois-là, son
                                exception si une règle le couvre, sinon son montant de base — par
                                l'évaluateur unique (valeurEffective). Au mois en cours, ce qui est
                                déjà POINTÉ (versé, avance comprise) est séparé du reste : la colonne
                                ne montre plus 0 pour une épargne faite. */
                            let ep = 0, epVersee = 0;
                            epArr.forEach(obj => {
                                const v = valeurEffective(obj, obj.valeur, mNum);
                                if (!(v > 0)) return;
                                ep += v;
                                if (isCurrent) epVersee += isItemPaid(obj, v) ? v : Math.min(v, Math.max(0, Number(getPaidAmount(obj, v)) || 0));
                            });
                            const epRestante = ep - epVersee;
                            //  Brut AVANT épargne. Au mois en cours il part du solde réel du Courant,
                            //  d'où l'épargne déjà versée est sortie : on l'y remet, pour que
                            //  Brut − Épargne = Net se lise sur chaque ligne.
                            const soldeDepart = isCurrent ? (tresoActuelleCourante.value || 0) + epVersee : 0;""",
"""                            const { entrants, sortants } = _getMonthFlux(mNum, anneeAffichage.value, mode, 'fonctionnement');
                            /*  v37.36 — L'ÉPARGNE DU MOIS. Chaque objectif vaut, CE mois-là, son
                                exception si une règle le couvre, sinon son montant de base — par
                                l'évaluateur unique (valeurEffective). Au mois en cours, ce qui est
                                déjà POINTÉ (versé, avance comprise) est séparé du reste : la colonne
                                ne montre plus 0 pour une épargne faite.
                                v37.47 — signée : + ce qui quitte le périmètre, − ce qui y revient. */
                            let ep = 0, epVersee = 0;
                            epArr.forEach(({ obj, sens }) => {
                                const v = valeurEffective(obj, obj.valeur, mNum);
                                if (!(v > 0)) return;
                                ep += sens * v;
                                if (isCurrent) epVersee += sens * (isItemPaid(obj, v) ? v : Math.min(v, Math.max(0, Number(getPaidAmount(obj, v)) || 0)));
                            });
                            //  v37.47 : un virement interne qui quitte le périmètre est de l'épargne ;
                            //  qui y revient, une reprise ; entre deux comptes du périmètre, rien.
                            const _cleM = _cleCycle(mNum, anneeAffichage.value);
                            getVirementsCycle(mNum, anneeAffichage.value).forEach(vir => {
                                const sens = sensEpargne(vir.sourceCompte || 'courant', vir.destinationCompte || 'courant');
                                const due = Math.abs(Number(vir.montant) || 0);
                                if (!sens || !due) return;
                                ep += sens * due;
                                if (isCurrent) epVersee += sens * (isItemPaid(vir, due, _cleM) ? due : Math.min(due, Math.max(0, Number(getPaidAmount(vir, due, _cleM)) || 0)));
                            });
                            const epRestante = ep - epVersee;
                            //  Brut AVANT épargne. Au mois en cours il part du solde réel des comptes
                            //  du périmètre, d'où l'épargne déjà versée est sortie : on l'y remet,
                            //  pour que Brut − Épargne = Net se lise sur chaque ligne.
                            const soldeDepart = isCurrent ? soldePerimetre + epVersee : 0;""")

# ── 4. La Météo et le Bilan (respirationDuMois) : même périmètre ──────────────
sub('respiration : lignes', """                        const lignes = { revenus: [], fixes: [], mensuelles: [], conso: [], epargne: [], exceptionnel: [], injections: [] };
                        Object.values(d.revenus || {}).forEach(r => {
                            const v = valeurEffective(r, r.base, m);
                            if (v > 0) lignes.revenus.push({ nom: r.label || r.nom || '?', montant: v, jourPrevu: r.jourPrevu || null, compte: compteDeFlux('revenu', r), nature: 'revenu' });
                        });
                        Object.values(d.chargesFixes || {}).forEach(f => {
                            const v = valeurEffective(f, f.valeur, m);
                            if (v > 0) lignes.fixes.push({ nom: f.label || '?', montant: v, jourPrevu: f.jourPrevu || null, compte: compteDeFlux('fixe', f), nature: 'fixe' });
                        });""",
"""                        //  v37.47 : le budget du PÉRIMÈTRE DE FONCTIONNEMENT. Ce qui entre ou sort par
                        //  un compte d'épargne (une dépense payée par les Dépenses annuelles…) va dans
                        //  horsPerimetre : l'épargne qui l'a provisionnée est déjà comptée.
                        const lignes = { revenus: [], fixes: [], mensuelles: [], conso: [], epargne: [], exceptionnel: [], injections: [], horsPerimetre: [] };
                        const _hors = (l) => { lignes.horsPerimetre.push(l); };
                        Object.values(d.revenus || {}).forEach(r => {
                            const v = valeurEffective(r, r.base, m);
                            if (!(v > 0)) return;
                            const l = { nom: r.label || r.nom || '?', montant: v, jourPrevu: r.jourPrevu || null, compte: compteDeFlux('revenu', r), nature: 'revenu' };
                            if (estFonctionnement(l.compte)) lignes.revenus.push(l); else _hors({ ...l, sens: 'entree' });
                        });
                        Object.entries(d.chargesFixes || {}).forEach(([cle, f]) => {
                            const v = valeurEffective(f, f.valeur, m);
                            if (!(v > 0)) return;
                            const l = { cle, nom: f.label || '?', montant: v, jourPrevu: f.jourPrevu || null, compte: compteDeFlux('fixe', f), nature: 'fixe' };
                            if (estFonctionnement(l.compte)) lignes.fixes.push(l); else _hors({ ...l, sens: 'sortie' });
                        });""")
sub('respiration : variables hors périmètre', """                        Object.values(d.chargesVariables || {}).forEach(c => {
                            if (!c) return;
                            const v = valeurEffective(c, c.valeur, m);
                            if (v <= 0) return;""",
"""                        Object.values(d.chargesVariables || {}).forEach(c => {
                            if (!c) return;
                            const v = valeurEffective(c, c.valeur, m);
                            if (v <= 0) return;
                            if (!estFonctionnement(compteDeFlux('variable', c))) {
                                _hors({ nom: c.label || '?', montant: Math.round(coutVariableDuCycle(c, m, an, true) * 100) / 100, compte: compteDeFlux('variable', c), nature: 'variable', sens: 'sortie' });
                                return;
                            }""")
sub('respiration : épargne et ponctuelles', """                        epArr.forEach(ep => {
                            const v = valeurEffective(ep, ep.valeur, m);
                            if (v > 0) lignes.epargne.push({ nom: ep.nom || ep.label || '?', montant: v, jourPrevu: ep.jourPrevu || null, compte: compteDeFlux('epargne', ep), nature: 'epargne', ref: ep });
                        });
                        const irr = Array.isArray(d.depensesIrregulieres) ? d.depensesIrregulieres : Object.values(d.depensesIrregulieres || {});
                        irr.filter(x => Number(x.mois) === Number(m)).forEach(x => {
                            const v = Number(x.montant) || 0;
                            if (v > 0) lignes.exceptionnel.push({ nom: x.nom || x.label || '?', montant: v, compte: compteDeFlux('exceptionnel', x), nature: 'exceptionnel', ref: x });
                            else if (v < 0) lignes.injections.push({ nom: x.nom || x.label || '?', montant: -v, compte: compteDeFlux('exceptionnel', x), nature: 'injection', ref: x });
                        });""",
"""                        //  v37.47 : une épargne ne compte que si elle QUITTE le périmètre ; si elle y
                        //  revient d'un compte d'épargne, c'est une reprise (une ressource) ; entre
                        //  deux comptes du périmètre (Courant → Assafa), ce n'est rien.
                        epArr.forEach(ep => {
                            const v = valeurEffective(ep, ep.valeur, m);
                            if (!(v > 0)) return;
                            const sens = sensEpargne(ep.sourceCompte || 'courant', destEpargne(ep));
                            if (sens > 0) lignes.epargne.push({ nom: ep.nom || ep.label || '?', montant: v, jourPrevu: ep.jourPrevu || null, compte: compteDeFlux('epargne', ep), nature: 'epargne', ref: ep });
                            else if (sens < 0) lignes.injections.push({ nom: '↩ ' + (ep.nom || ep.label || 'Épargne'), montant: v, compte: cleDeCompte(destEpargne(ep)), nature: 'reprise', ref: ep });
                        });
                        //  …et de même pour un virement interne entre le périmètre et l'épargne
                        getVirementsCycle(m, an).forEach(vir => {
                            const v = Math.abs(Number(vir.montant) || 0);
                            const sens = sensEpargne(vir.sourceCompte || 'courant', vir.destinationCompte || 'courant');
                            if (!v || !sens) return;
                            if (sens > 0) lignes.epargne.push({ nom: 'Virement → ' + getNomCompte(vir.destinationCompte || 'courant'), montant: v, compte: cleDeCompte(vir.sourceCompte || 'courant'), nature: 'epargne', ref: vir });
                            else lignes.injections.push({ nom: 'Virement ← ' + getNomCompte(vir.sourceCompte || 'courant'), montant: v, compte: cleDeCompte(vir.destinationCompte || 'courant'), nature: 'reprise', ref: vir });
                        });
                        const irr = Array.isArray(d.depensesIrregulieres) ? d.depensesIrregulieres : Object.values(d.depensesIrregulieres || {});
                        irr.filter(x => Number(x.mois) === Number(m)).forEach(x => {
                            const v = Number(x.montant) || 0;
                            const compteX = compteDeFlux('exceptionnel', x);
                            if (v !== 0 && !estFonctionnement(compteX)) { _hors({ nom: x.nom || x.label || '?', montant: Math.abs(v), compte: compteX, nature: v > 0 ? 'exceptionnel' : 'injection', sens: v > 0 ? 'sortie' : 'entree', ref: x }); return; }
                            if (v > 0) lignes.exceptionnel.push({ nom: x.nom || x.label || '?', montant: v, compte: compteX, nature: 'exceptionnel', ref: x });
                            else if (v < 0) lignes.injections.push({ nom: x.nom || x.label || '?', montant: -v, compte: compteX, nature: 'injection', ref: x });
                        });""")
sub('respiration : filtre par compte', """                        if (compte) Object.keys(lignes).forEach(k => { lignes[k] = lignes[k].filter(x => x.compte === compte); });""",
"""                        if (compte) Object.keys(lignes).forEach(k => { lignes[k] = lignes[k].filter(x => x.compte === compte); });
                        const horsPerimetreSorties = Math.round(lignes.horsPerimetre.filter(x => x.sens === 'sortie').reduce((s, x) => s + x.montant, 0));""")
sub('respiration : retour', """                            an, mois: m, revenus, injections, ressources, sorties, marge, pct, niveau,""",
"""                            an, mois: m, revenus, injections, ressources, sorties, marge, pct, niveau, horsPerimetreSorties,""")

# ── 5. Le Bilan : fixes du périmètre, dépenses payées par l'épargne à part ──
sub('bilan : fixes du périmètre', """                            Object.entries(d.chargesFixes || {}).forEach(([k, f]) => {
                                const v = valeurEffective(f, (f || {}).valeur, m);
                                if (!(v > 0)) return;""",
"""                            Object.entries(d.chargesFixes || {}).forEach(([k, f]) => {
                                const v = valeurEffective(f, (f || {}).valeur, m);
                                if (!(v > 0) || !estFonctionnement(compteDeFlux('fixe', f))) return;   // v37.47""")
sub('bilan : hors périmètre par mois', """                            return { m, nom: _MOIS_BILAN[m], ressources: r.ressources, sorties: r.sorties, marge: r.marge, ...val,""",
"""                            return { m, nom: _MOIS_BILAN[m], ressources: r.ressources, sorties: r.sorties, marge: r.marge, ...val, horsPerimetre: r.horsPerimetreSorties || 0,""")
sub('bilan : hors périmètre moyen', """                                 moy: { ressources: Math.round(ressources), sorties: Math.round(sorties), marge: Math.round(marge), epargne: Math.round(moy('epargne')), credits: Math.round(moy('credits')) },""",
"""                                 moy: { ressources: Math.round(ressources), sorties: Math.round(sorties), marge: Math.round(marge), epargne: Math.round(moy('epargne')), credits: Math.round(moy('credits')), horsPerimetre: Math.round(moy('horsPerimetre')) },""")
sub('bilan : la ligne', """                            <p data-bilan-marge :class="['text-sm font-bold mt-1 text-right', bilanAnnee.moy.marge < 0 ? 'text-rose-700' : 'text-emerald-700']">""",
"""                            <p v-if="bilanAnnee.moy.horsPerimetre > 0" data-bilan-hors-perimetre class="text-xs text-gray-600 mt-2 leading-snug">Non compté ci-dessus : {{ formatMAD(bilanAnnee.moy.horsPerimetre) }} par mois en moyenne de dépenses payées directement par vos comptes d'épargne ({{ perimetreSurplus.epargne }}) — l'épargne qui les alimente l'est déjà.</p>
                            <p data-bilan-marge :class="['text-sm font-bold mt-1 text-right', bilanAnnee.moy.marge < 0 ? 'text-rose-700' : 'text-emerald-700']">""")

# ── 6. La bulle « Surplus détaillé » : le périmètre, l'épargne signée ────────
sub('bulle : épargne signée', """{{ row.epargne > 0 ? '-' : '' }}{{ formatMAD(row.epargne) }}""",
    """{{ row.epargne > 0 ? '-' : (row.epargne < 0 ? '+' : '') }}{{ formatMAD(Math.abs(row.epargne)) }}""", n=2)
sub('bulle : moyenne signée (bureau)', """<span class="text-[9px] font-black tabular-nums text-right text-purple-500 whitespace-nowrap">-{{ formatMAD(surplusStats.moyEpargne) }}</span>""",
    """<span class="text-[9px] font-black tabular-nums text-right text-purple-500 whitespace-nowrap">{{ surplusStats.moyEpargne > 0 ? '-' : (surplusStats.moyEpargne < 0 ? '+' : '') }}{{ formatMAD(Math.abs(surplusStats.moyEpargne)) }}</span>""")
sub('bulle : moyenne signée (mobile)', """<span class="text-[8px] font-black tabular-nums text-right text-purple-500 whitespace-nowrap">-{{ formatMAD(surplusStats.moyEpargne) }}</span>""",
    """<span class="text-[8px] font-black tabular-nums text-right text-purple-500 whitespace-nowrap">{{ surplusStats.moyEpargne > 0 ? '-' : (surplusStats.moyEpargne < 0 ? '+' : '') }}{{ formatMAD(Math.abs(surplusStats.moyEpargne)) }}</span>""")
sub('bulle : périmètre (bureau)', """                                <div class="grid grid-cols-[52px_1fr_1fr_1fr] px-3 py-1.5 border-b border-gray-800 bg-gray-900">""",
"""                                <!-- v37.47 : ce que veulent dire Brut, Épargne et Net -->
                                <p data-surplus-perimetre class="px-3 py-2 border-b border-gray-800 text-[10px] text-gray-300 leading-snug whitespace-normal">
                                    <b class="text-emerald-400">Brut</b> : ce qui reste sur <b class="text-white">{{ perimetreSurplus.fonctionnement }}</b> après toutes leurs charges.
                                    <b class="text-purple-400">Épargne</b> : ce qui part vers {{ perimetreSurplus.epargne }}. <b class="text-blue-300">Net</b> = Brut − Épargne.
                                    <button type="button" @click.stop="showSurplusTooltip = false; appMode = 'previsionnel'; activeTab = 'parametres'" class="text-blue-300 hover:underline font-bold">Choisir les comptes →</button>
                                </p>
                                <div class="grid grid-cols-[52px_1fr_1fr_1fr] px-3 py-1.5 border-b border-gray-800 bg-gray-900">""")
sub('bulle : périmètre (mobile)', """                            <div class="grid grid-cols-[44px_1fr_1fr_1fr] px-2 py-1 border-b border-gray-800 bg-gray-900">""",
"""                            <p data-surplus-perimetre class="px-2 py-1.5 border-b border-gray-800 text-[9px] text-gray-300 leading-snug whitespace-normal">
                                <b class="text-emerald-400">Brut</b> : ce qui reste sur <b class="text-white">{{ perimetreSurplus.fonctionnement }}</b> après leurs charges. <b class="text-purple-400">Épargne</b> : vers {{ perimetreSurplus.epargne }}.
                            </p>
                            <div class="grid grid-cols-[44px_1fr_1fr_1fr] px-2 py-1 border-b border-gray-800 bg-gray-900">""")

# ── 7. L'Architecture des comptes : la case « fonctionnement » ───────────────
sub('comptes : case fonctionnement', """                                            <span v-if="compte.inclureLiquidite !== false" class="text-[9px] text-blue-500 font-bold">💧 inclus liquide</span>
                                        </div>""",
"""                                            <span v-if="compte.inclureLiquidite !== false" class="text-[9px] text-blue-500 font-bold">💧 inclus liquide</span>
                                            <!-- v37.47 : compte de fonctionnement (surplus) — déduit de sa fonction, ou forcé -->
                                            <label class="inline-flex items-center gap-1 text-[10px] font-bold cursor-pointer select-none" :class="estFonctionnement('cpt_' + compte.id) ? 'text-emerald-700' : 'text-gray-600'"
                                                   title="Compte de fonctionnement : ses revenus et ses charges font le surplus BRUT ; un virement vers un compte non coché est de l'ÉPARGNE. Auto : le compte courant, le compte des charges fixes / variables et ceux qui reçoivent un revenu.">
                                                <input type="checkbox" data-fonctionnement :data-compte="compte.id" class="w-3.5 h-3.5 accent-emerald-600" :checked="estFonctionnement('cpt_' + compte.id)" @change="definirFonctionnement(compte.id, $event.target.checked)"/>
                                                🔄 Fonctionnement<span v-if="fonctionnementExplicite(compte.id) === null" class="font-medium text-gray-500">(auto)</span>
                                            </label>
                                            <button v-if="fonctionnementExplicite(compte.id) !== null" type="button" data-fonctionnement-auto @click="remettreFonctionnementAuto(compte.id)" class="text-[10px] font-bold text-blue-700 hover:underline" title="Revenir à la déduction automatique">↺ auto</button>
                                        </div>""")

# ── 8. Exposé au gabarit ─────────────────────────────────────────────────────
sub('exposé', "                        meteoFinanciere, respirationBudgetaire, respirationDuMois, NIVEAUX_RESPIRATION, semainesVariablesDuCycle,",
    "                        meteoFinanciere, respirationBudgetaire, respirationDuMois, NIVEAUX_RESPIRATION, semainesVariablesDuCycle,\n"
    "                        comptesFonctionnement, estFonctionnement, fonctionnementExplicite, definirFonctionnement, remettreFonctionnementAuto, sensEpargne, perimetreSurplus,")

io.open(F, 'w', encoding='utf-8').write(src)
print('✔ index.html : surplus du périmètre de fonctionnement (brut, épargne, net), case par compte')
