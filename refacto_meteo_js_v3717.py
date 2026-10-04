# -*- coding: utf-8 -*-
"""
v37.17 Meteo-Financiere — PARTIE LOGIQUE.

Deux computeds, et toujours aucune formule nouvelle sur l'argent :

  meteoFinanciere      — l'état du ciel se déduit de chiffres déjà affichés :
                         l'atterrissage (moteur du Relevé), le reste à vivre
                         (budgetConsoRestantReel = min(enveloppe, cash dispo))
                         et la respiration du budget prévu.
                         Identité vérifiée : atterrissage + enveloppe conso
                         restante = cash dispo. Dépenser le reste à vivre et
                         pas un dirham de plus fait donc atterrir à zéro.
  respirationDuMois    — la jauge du Prévisionnel. Même conversion que le
                         moteur (hebdo × 4,3, exceptions au mois budgétaire) :
                         marge + épargne, sommées sur 12 mois, redonnent
                         surplusBudgetaireAnnuel au dirham.
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

sub('bloc météo après allerAInbox',
"""                    const allerAInbox = () => {
                        const el = document.getElementById('pilotage-inbox');
                        if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    };
""",
"""                    const allerAInbox = () => {
                        const el = document.getElementById('pilotage-inbox');
                        if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    };

                    //  v37.17 : survoler « Valider les charges échues » allume les lignes
                    //  qu'il va cocher — on voit ce que fait le bouton avant de cliquer.
                    const surbrillanceEchues = ref(false);
                    const estEchue = (t) => chargesFixesEchues.value.some(x => x.cle === t.cle);

                    /* ═══════════════════════════════════════════════════════════════
                       v37.17 — LA RESPIRATION DU BUDGET (Prévisionnel)
                       Pour un mois budgétaire donné : ce qui rentre, et où ça part.
                       Mêmes conventions que le moteur du simulateur
                       (surplusBudgetaireAnnuel) : exceptions au mois, catégories
                       hebdomadaires × 4,3, flux exceptionnels du mois nets
                       (une injection de cash est une ressource).
                       ═══════════════════════════════════════════════════════════════ */
                    const SEGMENTS_RESPIRATION = [
                        { cle: 'fixes',        label: 'Charges fixes',        icone: '🏢', couleur: 'bg-orange-500' },
                        { cle: 'mensuelles',   label: 'Factures & mensuel',   icone: '🧾', couleur: 'bg-sky-500' },
                        { cle: 'conso',        label: 'Conso courante',       icone: '🛒', couleur: 'bg-teal-500' },
                        { cle: 'epargne',      label: 'Épargne',              icone: '💎', couleur: 'bg-violet-500' },
                        { cle: 'exceptionnel', label: 'Exceptionnel',         icone: '⚠️', couleur: 'bg-rose-500' },
                    ];
                    const respirationDuMois = (an, m) => {
                        const d = (donneesAnnuelles.value || {})[an] || {};
                        const lignes = { revenus: [], fixes: [], mensuelles: [], conso: [], epargne: [], exceptionnel: [], injections: [] };
                        Object.values(d.revenus || {}).forEach(r => {
                            const v = valeurEffective(r, r.base, m);
                            if (v > 0) lignes.revenus.push({ nom: r.label || r.nom || '?', montant: v, jourPrevu: r.jourPrevu || null });
                        });
                        Object.values(d.chargesFixes || {}).forEach(f => {
                            const v = valeurEffective(f, f.valeur, m);
                            if (v > 0) lignes.fixes.push({ nom: f.label || '?', montant: v, jourPrevu: f.jourPrevu || null });
                        });
                        Object.values(d.chargesVariables || {}).forEach(c => {
                            if (!c) return;
                            const v = valeurEffective(c, c.valeur, m);
                            if (v <= 0) return;
                            if (c.periode === 'semaine') {
                                lignes.conso.push({ nom: c.label || '?', montant: Math.round(v * 4.3 * 100) / 100, parSemaine: v });
                            } else {
                                const det = (c.details || []).filter(x => Number(x.montant) > 0).map(x => x.nom + ' ' + formatNombre(x.montant));
                                lignes.mensuelles.push({ nom: c.label || '?', montant: v, jourPrevu: c.jourPrevu || null, detail: det.join(' · ') });
                            }
                        });
                        const epArr = Array.isArray(d.epargne) ? d.epargne : Object.values(d.epargne || {});
                        epArr.forEach(ep => {
                            const v = valeurEffective(ep, ep.valeur, m);
                            if (v > 0) lignes.epargne.push({ nom: ep.nom || ep.label || '?', montant: v, jourPrevu: ep.jourPrevu || null });
                        });
                        const irr = Array.isArray(d.depensesIrregulieres) ? d.depensesIrregulieres : Object.values(d.depensesIrregulieres || {});
                        irr.filter(x => Number(x.mois) === Number(m)).forEach(x => {
                            const v = Number(x.montant) || 0;
                            if (v > 0) lignes.exceptionnel.push({ nom: x.nom || x.label || '?', montant: v });
                            else if (v < 0) lignes.injections.push({ nom: x.nom || x.label || '?', montant: -v });
                        });
                        const somme = (a) => Math.round(a.reduce((s, x) => s + x.montant, 0));
                        const revenus = somme(lignes.revenus), injections = somme(lignes.injections);
                        const ressources = revenus + injections;
                        const segments = SEGMENTS_RESPIRATION.map(s => ({ ...s, montant: somme(lignes[s.cle]), lignes: lignes[s.cle] }));
                        const sorties = segments.reduce((s, x) => s + x.montant, 0);
                        const marge = ressources - sorties;
                        //  La barre se lit sur le PLUS GRAND des deux : les ressources quand
                        //  il reste de l'air, les sorties quand elles débordent.
                        const echelle = Math.max(1, ressources, sorties);
                        segments.forEach(s => { s.part = s.montant / echelle * 100; s.pctRevenus = ressources > 0 ? Math.round(s.montant / ressources * 100) : 0; });
                        const pct = ressources > 0 ? Math.round(marge / ressources * 100) : (marge < 0 ? -100 : 0);
                        const niveau = marge < 0 ? 'apnee' : (pct < 5 ? 'court' : (pct < 15 ? 'serre' : 'ample'));
                        return {
                            an, mois: m, revenus, injections, ressources, sorties, marge, pct, niveau,
                            partMarge: marge > 0 ? marge / echelle * 100 : 0,
                            partDeficit: marge < 0 ? -marge / echelle * 100 : 0,
                            segments, lignes,
                            consoParSemaine: Math.round(lignes.conso.reduce((s, x) => s + x.parSemaine, 0)),
                        };
                    };
                    const respirationBudgetaire = computed(() => {
                        calculationTick.value;
                        return respirationDuMois(moisBudgetaire.value.an, moisBudgetaire.value.mois);
                    });
                    const NIVEAUX_RESPIRATION = {
                        ample:  { label: 'Respiration ample',      phrase: 'Il reste de l’air chaque mois : le budget encaisse un imprévu.' },
                        serre:  { label: 'Respiration serrée',     phrase: 'La marge existe mais reste mince : un gros imprévu la consomme.' },
                        court:  { label: 'À bout de souffle',      phrase: 'Presque tout est engagé avant le premier jour du mois.' },
                        apnee:  { label: 'En apnée',               phrase: 'Le budget prévu dépense plus qu’il ne rentre : l’écart sort de l’épargne.' },
                    };

                    /* ═══════════════════════════════════════════════════════════════
                       v37.17 — LA MÉTÉO FINANCIÈRE
                       Trois ciels, chacun avec SA raison écrite en clair :
                         ⛈️ Orage   — un compte réel finit le cycle à découvert ;
                         ⛅ Nuages  — rien de dépensable, coussin < 5 % des revenus,
                                      ou budget prévu en déficit ;
                         ☀️ Soleil  — le reste.
                       Le reste à vivre est budgetConsoRestantReel, déjà affiché dans
                       le Réalisé ; on le ramène au jour, jusqu'à la veille de la paie.
                       ═══════════════════════════════════════════════════════════════ */
                    const meteoFinanciere = computed(() => {
                        const A = kpiAtterrissage.value;
                        const R = respirationBudgetaire.value;
                        const jours = Math.max(1, Number(joursRestantsAvantPaie.value) || 1);
                        const rav = Math.round(budgetConsoRestantReel.value);
                        const parJour = rav > 0 ? Math.floor(rav / jours) : 0;
                        const parSemaine = rav > 0 ? Math.floor(rav / jours * 7) : 0;
                        const cash = Math.round(cashDispoPourConso.value);
                        const env = Math.round(enveloppeConsoRestante.value);
                        const courant = A.montant;
                        const coussinMin = Math.round(Math.max(0, R.ressources) * 0.05);
                        //  Atterrissage si l'on s'en tient au reste à vivre plutôt qu'à tout
                        //  le budget conso. N'a de sens que si la conso sort du courant.
                        const conso_sur_courant = (soldesInitiaux.value.compteChargesVariables || 'courant') === 'courant';
                        const siRav = conso_sur_courant ? courant + env - Math.max(0, rav) : null;
                        let etat, icone, titre, raison, conseil;
                        if (A.negatif) {
                            etat = 'orage'; icone = '⛈️'; titre = 'Orage en vue';
                            if (courant < 0) {
                                raison = 'Découvert projeté le ' + A.dateFin + ' : ' + formatMAD(courant) + ' sur ' + ((A.courant && A.courant.label) || 'le compte courant') + ', si tout le budget conso est dépensé.';
                                if (rav > 0 && siRav !== null && siRav >= -1)
                                    conseil = 'Pour rester à flot : pas plus de ' + formatMAD(rav) + ' de dépenses courantes d’ici la paie, soit ' + formatMAD(parJour) + ' par jour.';
                                else if (cash < 0)
                                    conseil = 'Même sans aucune dépense courante, il manque ' + formatMAD(-cash) + ' : un virement ou le report d’une charge s’impose.';
                                else
                                    conseil = 'Réduisez les dépenses courantes jusqu’à la paie du ' + prochainePaieLabel.value + '.';
                            } else {
                                const p = A.vedette || A.alertes[0];
                                raison = p.label + ' finit le cycle à découvert le ' + A.dateFin + ' : ' + formatMAD(p.atterrissage) + '.';
                                conseil = courant >= -p.atterrissage
                                    ? 'Le compte courant atterrit à ' + formatMAD(courant) + ' : un virement de ' + formatMAD(-p.atterrissage) + ' vers ' + p.label + ' couvre l’écart.'
                                    : 'Prévoyez un virement de ' + formatMAD(-p.atterrissage) + ' vers ' + p.label + ' avant le ' + A.dateFin + '.';
                            }
                        } else if (rav <= 0 || courant < coussinMin || R.marge < 0) {
                            etat = 'nuages'; icone = '⛅'; titre = 'Ciel voilé';
                            if (rav <= 0)
                                raison = contrainteConso.value === 'budget'
                                    ? 'Le budget conso du cycle est entièrement consommé.'
                                    : 'Les charges à venir absorbent toute la trésorerie disponible.';
                            else if (courant < coussinMin)
                                raison = 'Coussin de fin de cycle mince : ' + formatMAD(courant) + ', moins de 5 % de vos revenus (' + formatMAD(coussinMin) + ').';
                            else
                                raison = 'Le budget prévu dépense plus qu’il ne rentre : ' + formatMAD(R.marge) + ' par mois.';
                            conseil = rav > 0
                                ? 'Rythme sûr : ' + formatMAD(parJour) + ' par jour jusqu’à la paie du ' + prochainePaieLabel.value + '.'
                                : 'Limitez les dépenses courantes jusqu’à la paie du ' + prochainePaieLabel.value + '.';
                        } else {
                            etat = 'soleil'; icone = '☀️'; titre = 'Grand soleil';
                            raison = 'Atterrissage le ' + A.dateFin + ' : ' + formatMAD(courant) + ' de coussin, tout le budget conso compris.';
                            conseil = 'Vous pouvez dépenser ' + formatMAD(parJour) + ' par jour sans toucher à ce coussin.';
                        }
                        return {
                            etat, icone, titre, raison, conseil,
                            rav, parJour, parSemaine, jours, cash, siRav,
                            prochainePaie: prochainePaieLabel.value,
                            atterrissage: courant, dateFin: A.dateFin, urgence: kpiUrgence.value.montant,
                            respirationPct: R.pct, respirationNiveau: R.niveau,
                            retro: isCyclePasse.value, cycleConsulte: pilotageCycleLabel.value,
                        };
                    });
""")

sub('garde-fou des onglets par mode',
"""                        const tabsPrev = ['dashboard','parametres','pilotage','irregulieres','studio','wealth','cfo','settings'];
                        const tabsReel = ['saisie','controle','tresorerie','syntheseReel'];""",
"""                        //  v37.17 : « pilotage » est un onglet du RÉALISÉ et « pilotageTheo » du
                        //  Prévisionnel. Absents de ces listes, ils étaient remplacés aussitôt
                        //  choisis : « Mode Réalisé » menait à Saisie, pas au Pilotage.
                        const tabsPrev = ['dashboard','pilotageTheo','parametres','irregulieres','studio','wealth','supervision','cfo','settings'];
                        const tabsReel = ['saisie','pilotage','controle','tresorerie','syntheseReel'];""")

sub('exposition', """                        bulleOuverte, bulleEpinglee, survolBulle, quitterBulle, basculerBulle, fermerBulle, allerAInbox,""",
"""                        bulleOuverte, bulleEpinglee, survolBulle, quitterBulle, basculerBulle, fermerBulle, allerAInbox,
                        // v37.17 : météo financière + respiration du Prévisionnel
                        meteoFinanciere, respirationBudgetaire, respirationDuMois, NIVEAUX_RESPIRATION,
                        surbrillanceEchues, estEchue,""")

for a, r in edits: src = src.replace(a, r, 1)
io.open(F, 'w', encoding='utf-8').write(src)
print(f'✔ {len(edits)} modifications appliquées à {F}')
