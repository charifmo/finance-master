# -*- coding: utf-8 -*-
"""
v37.20 Pulse-Hebdo — PARTIE LOGIQUE.

  pulseHebdo   — 🕊️ LIBERTÉ : la semaine en cours, du lundi au dimanche.
                 Enveloppe = le budget variable hebdomadaire du Prévisionnel
                 (catégories hebdo telles quelles, mensuelles ÷ 4,3, factures exclues
                 — les factures sont des prélèvements, elles vont au Sanctuaire).
                 Dépensé = les transactions RÉELLES datées de lundi à aujourd'hui,
                 rattachées à ces catégories par la même table que « ⚡ Depuis le réel ».
                 Liberté = enveloppe − dépensé, plafonnée par ce que la trésorerie
                 autorise d'ici la paie (le reste à vivre de la Météo) : la semaine ne
                 promet jamais plus que le compte ne peut payer.
  sanctuaire   — 🔒 les sorties programmées des 7 prochains jours, non payées : la
                 même liste et le même total que la carte « Urgence » du Réalisé.
  meteo        — les conseils parlent en semaines, plus en jours.
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

sub('pulse avant la météo', """                    const meteoFinanciere = computed(() => {""",
"""                    /* ═══════════════════════════════════════════════════════════════
                       v37.20 — LE PULSE HEBDOMADAIRE
                       La vraie vie ne se lisse pas au jour le jour : on raisonne en
                       semaines. Deux chiffres, et chacun croise le Prévu et le Réalisé.
                       ═══════════════════════════════════════════════════════════════ */
                    const _JOURS_SEMAINE = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
                    const pulseHebdo = computed(() => {
                        calculationTick.value;
                        const auj = new Date();
                        const idx = (auj.getDay() + 6) % 7;                   // 0 = lundi … 6 = dimanche
                        const lundi = new Date(auj.getFullYear(), auj.getMonth(), auj.getDate() - idx);
                        const dimanche = new Date(lundi.getFullYear(), lundi.getMonth(), lundi.getDate() + 6);
                        const mb = moisBudgetaire.value;
                        const d = donneesAnnuelles.value[mb.an] || {};
                        //  1. L'enveloppe hebdomadaire du Prévisionnel, catégorie par catégorie
                        const cats = [], carte = {};
                        Object.entries(d.chargesVariables || {}).forEach(([key, cv]) => {
                            if (!cv || cv.categorieId === 'cat_cv_factures') return;
                            //  Une mensuelle découpée en détails est planifiée : ses détails
                            //  sont des prélèvements (→ Sanctuaire), pas de la Liberté.
                            if (cv.periode !== 'semaine' && (cv.details || []).length) return;
                            const v = valeurEffective(cv, cv.valeur, mb.mois);
                            if (cv.categorieId) carte[cv.categorieId] = key;
                            (cv.details || []).forEach(det => { if (det && det.categorieId) carte[det.categorieId] = key; });
                            cats.push({ key, label: cv.label || key, budget: cv.periode === 'semaine' ? v : v / 4.3, depense: 0 });
                        });
                        //  2. Le réel : transactions datées de lundi à aujourd'hui, toutes
                        //     années confondues (une semaine peut enjamber le 31 décembre).
                        const dMin = _ymd(lundi), dMax = _ymd(auj);
                        let nbTx = 0, horsBudget = 0, nbHors = 0;
                        Object.values(donneesAnnuelles.value || {}).forEach(an => {
                            (an && Array.isArray(an.transactionsReelles) ? an.transactionsReelles : []).forEach(t => {
                                const dt = String(t.date || '').slice(0, 10);
                                if (!dt || dt < dMin || dt > dMax) return;
                                const m = Number(t.montant) || 0;
                                const k = carte[t.categorieId];
                                const c = k ? cats.find(x => x.key === k) : null;
                                if (!c) { if (m > 0) { horsBudget += m; nbHors++; } return; }
                                c.depense += m; nbTx++;
                            });
                        });
                        const enveloppe = Math.round(cats.reduce((s, c) => s + c.budget, 0));
                        const depense = Math.round(cats.reduce((s, c) => s + c.depense, 0));
                        //  3. Le plafond de la trésorerie : la part de cette semaine dans le
                        //     cash disponible d'ici la paie, au rythme régulier (cash ÷ jours
                        //     avant la paie × jours restants d'ici dimanche). Quand c'est le
                        //     cash qui mord, un lundi, c'est exactement le « X par semaine »
                        //     du conseil. Si la paie tombe avant dimanche, tout est à prendre.
                        //     Le budget, lui, est déjà porté par l'enveloppe : son reste du
                        //     cycle est une estimation au prorata du temps, qui fond même
                        //     sans dépense — il ne doit pas brider la semaine une 2e fois.
                        const cashCycle = Math.round(cashDispoPourConso.value);
                        const joursPaie = Math.max(1, Number(joursRestantsAvantPaie.value) || 1);
                        const plafond = cashCycle > 0 ? Math.floor(cashCycle / joursPaie * Math.min(7 - idx, joursPaie)) : 0;
                        const restantBudget = enveloppe - depense;
                        const liberte = Math.max(0, Math.min(restantBudget, plafond));
                        const pct = enveloppe > 0 ? Math.round(depense / enveloppe * 100) : (depense > 0 ? 100 : 0);
                        const pctTemps = Math.round((idx + 1) / 7 * 100);
                        const rythme = depense > enveloppe ? 'depasse' : (pct > pctTemps + 10 ? 'avance' : 'tenu');
                        const lib = (dt) => dt.getDate() + ' ' + _MOIS_COURTS[dt.getMonth()];
                        return {
                            enveloppe, depense, liberte, plafond, restantBudget, cashCycle, joursPaie,
                            contrainte: plafond < restantBudget ? 'tresorerie' : 'budget',
                            depassement: Math.max(0, depense - enveloppe),
                            pct, pctTemps, rythme, idxJour: idx, joursRestants: 7 - idx, jours: _JOURS_SEMAINE,
                            du: lib(lundi), au: lib(dimanche),
                            nbTx, horsBudget: Math.round(horsBudget), nbHors,
                            //  Réel saisi par catégorie (bloc T0) mais sans transaction datée :
                            //  la semaine ne peut pas le voir — on le dit.
                            reelSansDates: nbTx === 0 && consoT0Renseigne.value,
                            categories: cats.filter(c => c.budget > 0 || c.depense > 0)
                                .map(c => ({ ...c, budget: Math.round(c.budget), depense: Math.round(c.depense),
                                             pct: c.budget > 0 ? Math.min(100, Math.round(c.depense / c.budget * 100)) : 100 }))
                                .sort((a, b) => b.budget - a.budget),
                        };
                    });
                    //  🔒 Le Sanctuaire : exactement la liste et le total de l'Urgence.
                    const sanctuaireHebdo = computed(() => {
                        const r = _rangAujourdhui.value;
                        const lignes = tachesPilotageToutes.value
                            .filter(t => !t.paye && t.rang <= r + HORIZON_URGENCE)
                            .map(t => ({ libelle: t.libelle, nature: t.nature, badge: t.badge, jourPrevu: t.jourPrevu,
                                         reste: Math.max(0, t.due - (t.regle || 0)), retard: t.rang < r, rang: t.rang }))
                            .filter(t => t.reste > 0)
                            .sort((a, b) => a.rang - b.rang);
                        const parNature = {};
                        lignes.forEach(t => { parNature[t.nature] = (parNature[t.nature] || 0) + t.reste; });
                        return {
                            montant: urgenceGlobale.value,
                            nb: lignes.length,
                            retard: Math.round(lignes.filter(t => t.retard).reduce((s, t) => s + t.reste, 0)),
                            natures: Object.keys(NATURES_TACHE).filter(k => parNature[k])
                                .map(k => ({ cle: k, badge: NATURES_TACHE[k].badge, montant: Math.round(parNature[k]) })),
                            prochaines: lignes.slice(0, 3),
                        };
                    });

                    const meteoFinanciere = computed(() => {""")

# Les conseils parlent en semaines
sub('conseil orage', """'Pour rester à flot : pas plus de ' + formatMAD(rav) + ' de dépenses courantes d’ici la paie, soit ' + formatMAD(parJour) + ' par jour.'""",
    """'Pour rester à flot : pas plus de ' + formatMAD(rav) + ' de dépenses courantes d’ici la paie, soit environ ' + formatMAD(parSemaine) + ' par semaine.'""")
sub('conseil nuages', """'Rythme sûr : ' + formatMAD(parJour) + ' par jour jusqu’à la paie du ' + prochainePaieLabel.value + '.'""",
    """'Rythme sûr : environ ' + formatMAD(parSemaine) + ' par semaine jusqu’à la paie du ' + prochainePaieLabel.value + '.'""")
sub('conseil soleil', """'Vous pouvez dépenser ' + formatMAD(parJour) + ' par jour sans toucher à ce coussin.'""",
    """'Vous pouvez dépenser environ ' + formatMAD(parSemaine) + ' par semaine sans toucher à ce coussin.'""")
sub('pulse dans la météo', """                            retro: isCyclePasse.value, cycleConsulte: pilotageCycleLabel.value,
                            logistique: (() => {""", """                            retro: isCyclePasse.value, cycleConsulte: pilotageCycleLabel.value,
                            pulse: pulseHebdo.value, sanctuaire: sanctuaireHebdo.value,
                            logistique: (() => {""")
sub('exposition', """                        mecaniqueCompte, tachesPilotageToutes, kpiAtterrissageGlobal, respirationGlobale,""",
"""                        mecaniqueCompte, tachesPilotageToutes, kpiAtterrissageGlobal, respirationGlobale,
                        // v37.20 : pulse hebdomadaire
                        pulseHebdo, sanctuaireHebdo,""")

for a, r in edits: src = src.replace(a, r, 1)
io.open(F, 'w', encoding='utf-8').write(src)
print(f'✔ {len(edits)} modifications appliquées à {F}')
