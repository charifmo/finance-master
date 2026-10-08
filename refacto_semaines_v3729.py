# -*- coding: utf-8 -*-
"""
v37.29 Semaines-Reelles — la fin du « × 4,3 ».

  Question de l'utilisateur : « tu as pris en charge le facteur 4,3 semaines ? »
  Oui, mais un cycle réel compte 4 ou 5 semaines, jamais 4,3 : dans un cycle de
  5 semaines, dépenser exactement le prévu chaque semaine affichait un faux
  dépassement (5 × 3 097 = 15 485 pour un budget de 13 317) ; dans un cycle de
  4 semaines, 929 DH n'étaient portés par aucune semaine. Choix retenu (« 1 ») :
  compter les VRAIES semaines du cycle, partout — Pilotage, Météo, Prévisionnel,
  section Charges variables (là où on saisit le prévu), surplus, journal, relevé,
  graphiques, indépendance financière.

  Règle unique (semainesDuCycle) :
    • le cycle du mois budgétaire M court du jour de paie de M−1 à la veille du
      jour de paie de M (la fenêtre de la saisie par semaine) ;
    • une semaine lui appartient si son JEUDI y tombe (règle v37.27) ;
    • une catégorie « / sem » coûte valeur × N (N = 4 ou 5) ce cycle-là ;
      une catégorie « / mois » se répartit sur ses N semaines (Prévu hebdo = valeur ÷ N).
  Sur l'année : 52 ou 53 semaines, au lieu de 4,3 × 12 = 51,6.
  Une mesure « mensuelle moyenne » (indépendance financière) prend la moyenne de
  l'année : semaines de l'année ÷ 12.

  Au passage, deux défauts du même calcul :
    • journal de trésorerie : l'exception d'une catégorie « / sem » remplaçait le
      montant MENSUEL par la valeur HEBDO (exception non multipliée) ;
    • contrôle budget vs réalisé : les sous-lignes d'une catégorie « / sem »
      étaient comptées comme des montants mensuels.
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

# ══ 1. LA RÈGLE ══════════════════════════════════════════════════════════════
sub('règle semainesDuCycle', r"""                    //  Le second paramètre reste l'ANNÉE pour ne pas casser les 40 points
                    //  d'appel existants ; le mois budgétaire se passe en troisième.""",
    r"""                    /*  v37.29 — LES VRAIES SEMAINES D'UN CYCLE (fin du « × 4,3 »).
                        Le cycle du mois budgétaire M court du jour de paie de M−1 à la
                        veille du jour de paie de M (la fenêtre de la saisie par semaine) ;
                        une semaine lui appartient si son JEUDI y tombe (v37.27). Un cycle
                        compte donc 4 ou 5 semaines — jamais 4,3 — et l'année 52 ou 53.
                        Une catégorie « / sem » coûte valeur × N ce cycle-là ; une catégorie
                        « / mois » se répartit sur ses N semaines. */
                    const semainesDuCycle = (mois, an) => {
                        const jdp = Number((soldesInitiaux.value || {}).jourDePaie) || 27;
                        const m = Number(mois) || MOIS_BUDGETAIRE_COURANT();
                        const a = Number(an) || Number(moisBudgetaire?.value?.an) || new Date().getFullYear();
                        const debut = new Date(a, m - 2, jdp), fin = new Date(a, m - 1, jdp - 1);
                        const jeudi = new Date(debut.getFullYear(), debut.getMonth(), debut.getDate() + ((4 - debut.getDay() + 7) % 7));
                        let n = 0;
                        while (jeudi.getTime() <= fin.getTime() && n < 6) { n++; jeudi.setDate(jeudi.getDate() + 7); }
                        return n || 4;
                    };
                    const semainesDeLAnnee = (an) => { let s = 0; for (let m = 1; m <= 12; m++) s += semainesDuCycle(m, an); return s; };
                    //  Le coût d'une charge variable sur UN cycle : exception du mois comprise,
                    //  puis × les semaines du cycle si elle est saisie « / sem ».
                    const valeurVariableDuCycle = (cv, mois, an) => {
                        const v = valeurEffective(cv, (cv || {}).valeur, mois);
                        return (cv || {}).periode === 'semaine' ? v * semainesDuCycle(mois, an) : v;
                    };
                    //  Le cycle en cours et le suivant, pour la section Charges variables.
                    const _MOIS_CAP = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
                    const cyclesSemaines = computed(() => {
                        calculationTick.value;
                        const mb = moisBudgetaire.value;
                        return [0, 1].map(k => {
                            const m = ((mb.mois - 1 + k) % 12) + 1, a = mb.an + (mb.mois + k > 12 ? 1 : 0);
                            return { cle: m + '-' + a, mois: m, an: a, n: semainesDuCycle(m, a), label: _MOIS_CAP[m - 1] };
                        });
                    });

                    //  Le second paramètre reste l'ANNÉE pour ne pas casser les 40 points
                    //  d'appel existants ; le mois budgétaire se passe en troisième.""")

# ══ 2. LE PILOTAGE (cycle courant par défaut) ════════════════════════════════
sub('getMonthlyVariableValue', r"""                    const getMonthlyVariableValue = (item) => { const v = Number((item || {}).valeur) || 0; return item?.periode === 'semaine' ? v * 4.3 : v; };""",
    r"""                    //  v37.29 : × les semaines RÉELLES du cycle (celui du mois budgétaire courant
                    //  par défaut), plus × 4,3.
                    const getMonthlyVariableValue = (item, mois, an) => {
                        const v = Number((item || {}).valeur) || 0;
                        if (item?.periode !== 'semaine') return v;
                        const mb = moisBudgetaire.value;
                        return v * (mois ? semainesDuCycle(mois, an || mb.an) : semainesDuCycle(mb.mois, mb.an));
                    };""")
sub('commentaire budget variable mensuel', r"""                    // Budget variable mensuel total (mois + hebdo converti ×4.3) du cycle courant""",
    r"""                    // Budget variable du cycle courant (mois + hebdo × semaines réelles du cycle, v37.29)""")
sub('commentaire prorata', r"""(HORS factures, hebdo × 4.3 inclus)""", r"""(HORS factures, hebdo × semaines du cycle inclus — v37.29)""")

# ══ 3. LA MÉTÉO (Liberté, Rayons X, Par semaine) ═════════════════════════════
sub('météo : semaines du cycle', r"""                        const frac = decal < 0 ? 1 : (decal > 0 ? 0 : (idxAuj + 1) / 7);   // part de la semaine écoulée""",
    r"""                        const frac = decal < 0 ? 1 : (decal > 0 ? 0 : (idxAuj + 1) / 7);   // part de la semaine écoulée
                        const nSem = semainesDuCycle(mb.mois, mb.an);                       // v37.29 : 4 ou 5, jamais 4,3""")
sub('météo : prévu par unité', r"""                            const v = cv.periode === 'semaine' ? c.budget / 4.3 : c.budget;""",
    r"""                            const v = cv.periode === 'semaine' ? c.budget / nSem : c.budget;""")
sub('météo : prévu de la semaine', r"""                            const semBudget = Math.round(c.budget / 4.3);""", r"""                            const semBudget = Math.round(c.budget / nSem);""")
sub('météo : prévu du poste', r"""                                const bud = Math.round(p.partCycle / 4.3);""", r"""                                const bud = Math.round(p.partCycle / nSem);""")
sub('météo : rang de la semaine', r"""                                         cycleRel: th < _ymd(debut) ? 'precedent' : (th > _ymd(fin) ? 'suivant' : null),
                                         budget: sb,""", r"""                                         cycleRel: th < _ymd(debut) ? 'precedent' : (th > _ymd(fin) ? 'suivant' : null),
                                         //  v37.29 : « semaine 2 sur 4 » du cycle
                                         nb: nSem, rang: _semaineDansCycle(lundiSel) ? Math.round((_decaler(th, 0) - new Date(debut.getFullYear(), debut.getMonth(), debut.getDate() + ((4 - debut.getDay() + 7) % 7))) / 6048e5) + 1 : null,
                                         budget: sb,""")
sub('météo : semaines exposées', r"""                            paie: prochainePaieLabel.value, jourCycle: joursCycleEcoules.value, joursCycle: joursCycleTotal.value,""",
    r"""                            paie: prochainePaieLabel.value, jourCycle: joursCycleEcoules.value, joursCycle: joursCycleTotal.value, nbSemaines: nSem,""")
sub('météo : rang dans la barre', r"""<span data-semaine-statut :data-statut="sm.statut" :class="['rounded-full px-1.5 py-px text-[9px] font-black uppercase tracking-wider ring-1', statutClasse]">{{ statutTexte }}</span>""",
    r"""<span data-semaine-statut :data-statut="sm.statut" :class="['rounded-full px-1.5 py-px text-[9px] font-black uppercase tracking-wider ring-1', statutClasse]">{{ statutTexte }}</span>
                            <span v-if="sm.rang" data-semaine-rang class="font-bold text-white/70" :title="'Ce cycle compte ' + sm.nb + ' semaines : son budget = ' + sm.nb + ' × le prévu de la semaine'">sem. {{ sm.rang }}/{{ sm.nb }}</span>""")

# ══ 4. LE PRÉVISIONNEL ═══════════════════════════════════════════════════════
sub('prévisionnel : commentaire', r"""                       hebdomadaires × 4,3, flux exceptionnels du mois nets""",
    r"""                       hebdomadaires × les semaines du cycle (v37.29), flux exceptionnels du mois nets""")
sub('prévisionnel : conso du mois', r"""                                lignes.conso.push({ nom: c.label || '?', montant: Math.round(v * 4.3 * 100) / 100, parSemaine: v, compte: compteDeFlux('variable', c), nature: 'variable' });""",
    r"""                                lignes.conso.push({ nom: c.label || '?', montant: Math.round(v * semainesDuCycle(m, an) * 100) / 100, parSemaine: v, compte: compteDeFlux('variable', c), nature: 'variable' });""")
sub('prévisionnel : semaines exposées', r"""                            consoParSemaine: Math.round(lignes.conso.reduce((s, x) => s + x.parSemaine, 0)),
                        };""", r"""                            consoParSemaine: Math.round(lignes.conso.reduce((s, x) => s + x.parSemaine, 0)),
                            semaines: semainesDuCycle(m, an),
                        };""")
sub('prévisionnel : texte', r"""≈ {{ formatMAD(respirationBudgetaire.consoParSemaine) }} par semaine · budget hebdo × 4,3</p>""",
    r"""<span data-theo-semaines>{{ formatMAD(respirationBudgetaire.consoParSemaine) }} par semaine × {{ respirationBudgetaire.semaines }} semaines ce cycle</span></p>""")
sub('prévisionnel : commentaire en-tête', r"""                         mois budgétaire, catégories hebdomadaires × 4,3.""",
    r"""                         mois budgétaire, catégories hebdomadaires × les semaines du cycle (4 ou 5).""")

# ══ 5. LA SECTION CHARGES VARIABLES (où l'on saisit le prévu) ════════════════
#  Bureau et téléphone : le calcul « × 4,3 » devient le calcul du cycle en cours
#  et du suivant, avec leur nombre réel de semaines.
sub('charges variables (bureau)', r"""                            <div v-if="item.periode === 'semaine'" class="text-[9px] text-red-500 font-black uppercase tracking-widest text-right mb-2">
                                Impact mensuel calculé (x4.3) : {{ formatMAD((item.valeur || 0) * 4.3) }}
                            </div>""",
    r"""                            <div v-if="item.periode === 'semaine' || item.categorieId !== 'cat_cv_factures'" data-cv-semaines class="text-[9px] text-red-500 font-black uppercase tracking-widest text-right mb-2 space-x-2">
                                <span v-for="cy in cyclesSemaines" :key="'cvs_' + cy.cle" data-cv-cycle :data-semaines="cy.n" class="inline-block whitespace-nowrap">{{ cy.label }} : {{ cy.n }} sem. → {{ item.periode === 'semaine' ? formatMAD((item.valeur || 0) * cy.n) : formatMAD((item.valeur || 0) / cy.n) + ' / sem.' }}</span>
                            </div>""")
sub('charges variables (téléphone)', r"""                                <p v-if="item.periode === 'semaine'" class="text-[9px] text-red-500 font-black uppercase tracking-widest text-right mt-1">
                                    Mensuel (x4.3) : {{ formatMAD((item.valeur || 0) * 4.3) }}
                                </p>""",
    r"""                                <p v-if="item.periode === 'semaine' || item.categorieId !== 'cat_cv_factures'" data-cv-semaines class="text-[9px] text-red-500 font-black uppercase tracking-widest text-right mt-1 space-x-2">
                                    <span v-for="cy in cyclesSemaines" :key="'cvsm_' + cy.cle" data-cv-cycle :data-semaines="cy.n" class="inline-block whitespace-nowrap">{{ cy.label }} : {{ cy.n }} sem. → {{ item.periode === 'semaine' ? formatMAD((item.valeur || 0) * cy.n) : formatMAD((item.valeur || 0) / cy.n) + ' / sem.' }}</span>
                                </p>""")
sub('exports', r"""                        liberteCycle, sanctuaireHebdo, consoCompteurRenseigne, saisirCompteurConso,""",
    r"""                        liberteCycle, sanctuaireHebdo, consoCompteurRenseigne, saisirCompteurConso,
                        // v37.29 : semaines réelles du cycle
                        semainesDuCycle, semainesDeLAnnee, cyclesSemaines,""")

# ══ 6. LES MOTEURS MOIS PAR MOIS ═════════════════════════════════════════════
sub('surplus annuel', r"""                                const v = valeurEffective(c, c.valeur, m);
                                variables += (c.periode === 'semaine' ? v * 4.3 : v);""",
    r"""                                variables += valeurVariableDuCycle(c, m, Number(annee));""")
sub('radar : commentaire', r"""                            // montant mensuel d'une catégorie de charge variable (conversion hebdo → mensuel ×4.3)""",
    r"""                            // montant d'une catégorie de charge variable sur le cycle (hebdo × semaines réelles du cycle, v37.29)""")
sub('radar : legs', r"""                                let monthly = (cv.periode === 'semaine') ? effValeur * 4.3 : effValeur;""",
    r"""                                let monthly = (cv.periode === 'semaine') ? effValeur * semainesDuCycle(m, a) : effValeur;""")
sub('flux du mois', r"""                                let monthly = (cv.periode === 'semaine') ? effV * 4.3 : effV;""",
    r"""                                let monthly = (cv.periode === 'semaine') ? effV * semainesDuCycle(mNum, annee) : effV;""")
sub('journal : variables du mois', r"""                                let effVal = getMonthlyVariableValue(curr || {});
                                // v17.99 : Exceptions périodes variables
                                (curr?.exceptions || []).forEach(e => { if (mNum >= e.moisDebut && mNum <= e.moisFin) effVal = Number(e.nouvelleValeur || 0); });""",
    r"""                                //  v17.99 : exceptions du mois — v37.29 : appliquées AVANT la conversion,
                                //  × les semaines réelles du cycle (une exception « / sem » est hebdo).
                                let effVal = valeurVariableDuCycle(curr || {}, mNum, aNum);""")
sub('journal : prorata semaines restantes', r"""                                const rConso = semRest / 4.3;""",
    r"""                                const rConso = semRest / semainesDuCycle(mNum, aNum);""")
sub('relevé : mensuel et annuel', r"""                            const m = ((c || {}).periode === 'semaine' ? N((c || {}).valeur) * 4.3 : N((c || {}).valeur));
                            if (m <= 0) return;
                            lignes.push({ cle: 'cv_' + k, nom: (c || {}).label || k, mensuel: Math.round(m),
                                          annuel: Math.round(m * moisRestants), onglet: 'saisie', categorie: 'Charge variable' });""",
    r"""                            //  v37.29 : chaque mois restant avec SES semaines (4 ou 5), plus × 4,3.
                            const hebdo = (c || {}).periode === 'semaine';
                            const m = hebdo ? N((c || {}).valeur) * semainesDuCycle(annee === mb.an ? mb.mois : 1, annee) : N((c || {}).valeur);
                            if (m <= 0) return;
                            let annuel = 0;
                            for (let mm = 13 - moisRestants; mm <= 12; mm++) annuel += hebdo ? N((c || {}).valeur) * semainesDuCycle(mm, annee) : N((c || {}).valeur);
                            lignes.push({ cle: 'cv_' + k, nom: (c || {}).label || k, mensuel: Math.round(m),
                                          annuel: Math.round(annuel), onglet: 'saisie', categorie: 'Charge variable' });""")
sub('indépendance financière : mois moyen', r"""                            .reduce((s, c) => s + (c.periode === 'semaine' ? N(c.valeur) * 4.3 : N(c.valeur)), 0);""",
    r"""                            .reduce((s, c) => s + (c.periode === 'semaine' ? N(c.valeur) * semainesDeLAnnee(anneeAffichage.value) / 12 : N(c.valeur)), 0);   // v37.29 : mois MOYEN de l'année""")
sub('contrôle budget vs réalisé', r"""                            if (Array.isArray(cv.details) && cv.details.length) {
                                cv.details.forEach(det => add(det.categorieId || cv.categorieId, det.nom, 'charge_variable_detail', det.montant));
                            } else if (cv.periode === 'mois' || !cv.periode) {
                                add(cv.categorieId, cv.label, 'charge_variable', cv.valeur);
                            } else if (cv.periode === 'semaine') {
                                add(cv.categorieId, cv.label, 'charge_variable', Number(cv.valeur || 0) * 4.3);
                            }""",
    r"""                            //  v37.29 : une ligne « / sem » × les semaines réelles du cycle contrôlé
                            //  (ses sous-lignes aussi : elles étaient comptées comme mensuelles).
                            const kSem = cv.periode === 'semaine' ? semainesDuCycle(m, a) : 1;
                            if (Array.isArray(cv.details) && cv.details.length) {
                                cv.details.forEach(det => add(det.categorieId || cv.categorieId, det.nom, 'charge_variable_detail', Number(det.montant || 0) * kSem));
                            } else {
                                add(cv.categorieId, cv.label, 'charge_variable', Number(cv.valeur || 0) * kSem);
                            }""")
sub('graphique des sous-lignes', r"""dt=cat.details.map(d=>cat.periode==='semaine'?d.montant*4.3:d.montant);""",
    r"""dt=cat.details.map(d=>getMonthlyVariableValue({ periode: cat.periode, valeur: d.montant }));""")

for a, r, n in edits: src = src.replace(a, r, n)
reste = [l for l in src.split('\n') if '4.3' in l and ('* 4.3' in l or '/ 4.3' in l or '*4.3' in l)]
io.open(F, 'w', encoding='utf-8').write(src)
print(f'✔ {len(edits)} modifications appliquées à {F}')
if reste:
    print('⚠ « 4.3 » encore présent :'); [print('   ', l.strip()[:140]) for l in reste]
