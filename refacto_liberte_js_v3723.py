# -*- coding: utf-8 -*-
"""
v37.23 Liberté-du-Cycle — PARTIE MOTEUR.

  FRICTION 1 — « la dictature de la date ». La Liberté hebdomadaire (v37.20)
  ne voyait que les tickets datés de lundi à aujourd'hui : une saisie en vrac
  (« Alimentation : 2 300 déjà dépensés ») la rendait fausse. On repart du
  cycle de paie, l'unité dans laquelle l'utilisateur pense son budget, et
  d'UNE seule source de vérité, celle du moteur du Réalisé :

    engagé(catégorie) = max( compteur saisi en vrac , Σ tickets datés du cycle )

  - le compteur (bloc « Réalisé à T0 ») est un total courant, qu'on met à
    jour quand on veut, sans date ;
  - les tickets datés (onglet Saisie) comptent désormais d'eux-mêmes, sans le
    bouton « ⚡ Depuis le réel » ;
  - le max évite le double comptage dans les deux usages : un compteur qui
    inclut déjà les tickets, ou des tickets seuls.
  Le moteur (enveloppeConsoRestante → reste à vivre, atterrissage, Relevé)
  lit le même engagé : la carte et le reste de l'app ne peuvent pas diverger.
  Rien de déclaré du tout → le moteur garde son estimation au prorata du
  temps, et la carte le DIT (« estimé »).

  FRICTION 2 — deux chiffres concurrents. Le conseil de gauche ne chiffre plus
  l'argent à vivre : il renvoie au « Reste à dépenser » de droite, seul
  endroit où vivent le reste du cycle, le rythme par semaine et par jour.
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

# ── 1. Les tickets du cycle, et un « réel renseigné » qui les voit ──────────
sub('tickets datés du cycle', """                    // Au moins une catégorie renseignée → on pilote au réel, plus au temps
                    const consoT0Renseigne = computed(() =>
                        Object.values(consoT0Saisies.value).some(v => Number(v) > 0)
                    );""", """                    //  v37.23 : les tickets datés du cycle (onglet Saisie), par catégorie et
                    //  par sous-catégorie. Fenêtre = début du cycle → aujourd'hui.
                    const _ticketsCycle = computed(() => {
                        calculationTick.value;
                        const d = donneesAnnuelles.value[consoT0Annee.value];
                        const out = { parCle: {}, hors: [], horsTotal: 0, total: 0 };
                        if (!d) return out;
                        const { debut, fin } = consoT0Fenetre.value;
                        const auj = new Date();
                        const dMin = _ymd(debut), dMax = _ymd(fin < auj ? fin : auj);
                        const ilYa6j = _ymd(new Date(auj.getFullYear(), auj.getMonth(), auj.getDate() - 6));
                        const carte = {};
                        Object.entries(d.chargesVariables || {}).forEach(([key, cv]) => {
                            if (!cv || cv.categorieId === 'cat_cv_factures') return;
                            if (cv.categorieId) carte[cv.categorieId] = key;
                            (cv.details || []).forEach(det => { if (det && det.categorieId) carte[det.categorieId] = key; });
                        });
                        const cleVar = compteDeFlux('variable');
                        //  Tous les seaux annuels : un cycle peut enjamber le 31 décembre.
                        Object.values(donneesAnnuelles.value || {}).forEach(a => {
                            (a && Array.isArray(a.transactionsReelles) ? a.transactionsReelles : []).forEach(t => {
                                const dt = String(t.date || '').slice(0, 10);
                                if (!dt || dt < dMin || dt > dMax) return;
                                const m = Number(t.montant) || 0;
                                const tx = _txRayonX(t, dt, cleVar);
                                tx.categorieId = t.categorieId || null;
                                //  Au-delà d'une semaine, « lun. 29 » ne suffit plus : on donne le mois.
                                if (dt < ilYa6j) { const [, mo, j] = dt.split('-').map(Number); tx.quand = j + ' ' + _MOIS_COURTS[mo - 1]; }
                                const k = carte[t.categorieId];
                                if (!k) { if (m > 0) { out.hors.push(tx); out.horsTotal += m; } return; }
                                const g = out.parCle[k] = out.parCle[k] || { total: 0, tx: [], parPoste: {} };
                                g.total += m; g.tx.push(tx); out.total += m;
                                if (t.categorieId !== d.chargesVariables[k].categorieId) g.parPoste[t.categorieId] = (g.parPoste[t.categorieId] || 0) + m;
                            });
                        });
                        return out;
                    });
                    //  Le compteur en vrac a-t-il été rempli ? (bouton ↩ d'effacement)
                    const consoCompteurRenseigne = computed(() =>
                        Object.values(consoT0Saisies.value).some(v => Number(v) > 0)
                    );
                    // Au moins une dépense déclarée (compteur OU tickets datés) → on pilote
                    // au réel, plus au temps
                    const consoT0Renseigne = computed(() =>
                        consoCompteurRenseigne.value || _ticketsCycle.value.total > 0
                    );""")

sub('engagé = max(compteur, tickets), sinon estimé', """                                const engage = Math.max(0, Number(saisies[key] || 0));
                                return {
                                    key,""", """                                //  v37.23 : le compteur en vrac OU les tickets datés, le plus
                                //  grand des deux — jamais leur somme (pas de double comptage).
                                //  Une catégorie NON déclarée, dès qu'une autre l'est, reste
                                //  estimée à son rythme attendu : déclarer « Alimentation »
                                //  ne doit pas faire croire que Sorties n'a rien coûté.
                                const saisi = Math.max(0, Math.round(Number(saisies[key] || 0)));
                                const tickets = Math.round(((_ticketsCycle.value.parCle[key] || {}).total) || 0);
                                const theoriqueCat = Math.round(budget * (estSuspendableAbsence(cv) ? ratioEcoule : ratioEcouleBrut));
                                const declare = saisi > 0 || tickets > 0 || (declareQuelquePart && Object.prototype.hasOwnProperty.call(saisies, key));
                                const engage = declare ? Math.max(saisi, tickets) : (declareQuelquePart ? theoriqueCat : 0);
                                return {
                                    key, saisi, tickets, declare,""")
sub('déclaré quelque part', """                        const saisies = consoT0Saisies.value;
                        // v34.06 : un jour d'absence déjà passé""", """                        const saisies = consoT0Saisies.value;
                        const declareQuelquePart = consoT0Renseigne.value;
                        // v34.06 : un jour d'absence déjà passé""")
sub('effacer un compteur', """                    const resetConsoT0 = () => {""", """                    //  v37.23 : un champ vidé RETIRE la déclaration (la catégorie redevient
                    //  estimée) ; « 0 » tapé déclare « rien dépensé ».
                    const saisirCompteurConso = (catKey, montant) => {
                        if (montant === '' || montant === null || montant === undefined) {
                            const d = donneesAnnuelles.value[consoT0Annee.value];
                            const ligne = d && d.consoRealiseeT0 && d.consoRealiseeT0[consoT0CycleKey.value];
                            if (ligne && Object.prototype.hasOwnProperty.call(ligne, catKey)) { delete ligne[catKey]; calculationTick.value++; handleDataChange(); }
                            return;
                        }
                        setConsoT0(catKey, montant);
                    };
                    const resetConsoT0 = () => {""")

# ── 1 bis. Le budget conso du cycle respecte l'exception du mois ───────────
#   Le Prévisionnel appliquait l'exception (« Alimentation : 1 200 en novembre »),
#   le Réalisé l'ignorait (getMonthlyVariableValue lit la valeur brute). Avec UN
#   chiffre de vérité, l'écart deviendrait visible : on l'aligne.
sub('exception du mois dans le budget conso', """                    const budgetCategorieRevise = (cv) =>
                        Math.max(0, getMonthlyVariableValue(cv || {}) - economieCategorieAbsence(cv));""", """                    const budgetCategorieRevise = (cv) => {
                        const c = cv || {};
                        //  v37.23 : l'exception du mois budgétaire, comme au Prévisionnel.
                        const v = valeurEffective(c, c.valeur, moisBudgetaire.value.mois);
                        return Math.max(0, getMonthlyVariableValue({ ...c, valeur: v }) - economieCategorieAbsence(cv));
                    };""")

# ── 2. Le getter unique de la carte de droite ───────────────────────────────
debut = src.index('                    const pulseHebdo = computed(() => {')
fin = src.index('                    //  🔒 Le Sanctuaire : exactement la liste et le total de l\'Urgence.')
ancien = src[debut:fin]
if 'reelSansDates' not in ancien or ancien.count('computed(') != 1:
    print('✖ bloc pulseHebdo inattendu'); sys.exit(1)
NOUVEAU = """                    /* ═══════════════════════════════════════════════════════════════
                       v37.23 — LA LIBERTÉ DU CYCLE (remplace le Pulse hebdomadaire)
                       UN chiffre : le reste à dépenser jusqu'à la paie — celui du moteur
                       (budgetConsoRestantReel = min(budget restant, cash)). Le RYTHME se
                       déduit du temps qui reste, pas des dates des tickets :
                           ≈ reste ÷ jours avant la paie × 7  par semaine.
                       La jauge compare l'engagé au « rythme attendu » du moteur
                       (consoTheoriqueAJour) : en avance / tenu / dépassé, sans dater.
                       ═══════════════════════════════════════════════════════════════ */
                    const liberteCycle = computed(() => {
                        calculationTick.value;
                        const mb = moisBudgetaire.value;
                        const d = donneesAnnuelles.value[consoT0Annee.value] || {};
                        const T = _ticketsCycle.value;
                        const jours = Math.max(1, Number(joursRestantsAvantPaie.value) || 1);
                        const budget = Math.round(budgetConsoCycle.value);
                        const declare = consoT0Renseigne.value;
                        const resteBudget = Math.round(enveloppeConsoRestante.value);
                        //  Rien de déclaré : l'engagé est l'estimation du moteur (prorata).
                        const engage = declare ? Math.round(consoEngageeT0.value) : Math.max(0, budget - resteBudget);
                        const reste = Math.max(0, Math.round(budgetConsoRestantReel.value));
                        const attendu = Math.round(consoTheoriqueAJour.value);
                        const rythme = !declare ? 'estime' : engage > budget ? 'depasse' : (engage - attendu > budget * 0.05 ? 'avance' : 'tenu');
                        const cleVar = compteDeFlux('variable');
                        const categories = consoCategoriesT0.value.map(c => {
                            const cv = (d.chargesVariables || {})[c.key] || {};
                            const g = T.parCle[c.key] || { total: 0, tx: [], parPoste: {} };
                            //  La liste de courses (v37.22), dans l'unité de la ligne
                            //  (semaine ou mois), ramenée au budget du moteur (exception du
                            //  mois, mode voyage) ; le remplissage d'un poste compare ses
                            //  tickets du cycle à SA part du budget du cycle.
                            const v = cv.periode === 'semaine' ? c.budget / 4.3 : c.budget;
                            const dets = (cv.details || []).filter(x => x && Number(x.montant) > 0);
                            const S = dets.reduce((s, x) => s + Number(x.montant), 0);
                            const parId = {};
                            const prevu = dets.map(x => {
                                const part = Number(x.montant) / S;
                                const dep = Math.round(g.parPoste[x.categorieId] || 0);
                                const partCycle = c.budget * part;
                                const p = { nom: x.nom || '—', emoji: emojiPoste(x.nom, x.icone), montant: Math.round(v * part), categorieId: x.categorieId || null,
                                            depense: dep, pct: partCycle > 0 ? Math.min(100, Math.round(dep / partCycle * 100)) : (dep > 0 ? 100 : 0), depasse: dep > partCycle };
                                if (x.categorieId) parId[x.categorieId] = p;
                                return p;
                            }).sort((a, b) => b.montant - a.montant);
                            if (prevu.length) prevu[0].montant += Math.round(v) - prevu.reduce((s, x) => s + x.montant, 0);
                            const transactions = g.tx.map(t => { const p = parId[t.categorieId]; return p ? { ...t, poste: p.nom, posteEmoji: p.emoji } : t; }).sort(_parDateDesc);
                            const autres = {};
                            transactions.forEach(t => { if (t.horsCompte) autres[t.compte.key] = t.compte; });
                            //  Rien de déclaré nulle part : le moteur estime au prorata ; la
                            //  catégorie affiche son rythme attendu, pour que les tuiles
                            //  racontent la même histoire que le grand chiffre.
                            const engageCat = c.declare || declare ? c.engage : c.theorique;
                            const resteCat = c.budget - engageCat;
                            return {
                                key: c.key, label: c.label, budget: c.budget, engage: engageCat, saisi: c.saisi, tickets: c.tickets, declare: c.declare,
                                reste: resteCat, parSemaine: resteCat > 0 ? Math.floor(resteCat / jours * 7) : 0,
                                theorique: c.theorique, pct: c.budget > 0 ? Math.round(engageCat / c.budget * 100) : 0,
                                source: !c.declare ? 'estime' : (c.tickets > c.saisi ? 'tickets' : 'compteur'),
                                transactions, nb: transactions.length, comptesAutres: Object.values(autres),
                                prevu, prevuUnite: cv.periode === 'semaine' ? 'semaine' : 'mois',
                                prevuAjuste: S > 0 && Math.abs(v - S) > 0.5,
                                nonVentile: Math.round(g.total - Object.values(g.parPoste).reduce((s, x) => s + x, 0)),
                            };
                        });
                        return {
                            reste, resteBudget, budget, engage, attendu,
                            cash: Math.round(cashDispoPourConso.value),
                            contrainte: reste < resteBudget ? 'tresorerie' : 'budget',
                            declare, compteur: consoCompteurRenseigne.value, nbTickets: Object.values(T.parCle).reduce((s, g) => s + g.tx.length, 0),
                            jours, semaines: Math.round(jours / 7 * 10) / 10,
                            parSemaine: reste > 0 ? Math.floor(reste / jours * 7) : 0,
                            parJour: reste > 0 ? Math.floor(reste / jours) : 0,
                            pct: budget > 0 ? Math.round(engage / budget * 100) : 0,
                            pctAttendu: budget > 0 ? Math.min(100, Math.round(attendu / budget * 100)) : 0,
                            rythme, depassement: Math.max(0, engage - budget),
                            paie: prochainePaieLabel.value, jourCycle: joursCycleEcoules.value, joursCycle: joursCycleTotal.value,
                            compte: infoCompte(cleVar),
                            horsBudget: Math.round(T.horsTotal), horsBudgetTx: T.hors.slice().sort(_parDateDesc),
                            categories,
                        };
                    });
"""
src = src[:debut] + NOUVEAU + src[fin:]

# ── 3. La Météo de gauche ne chiffre plus l'argent à vivre ─────────────────
sub('orage rattrapable', """                                    conseil = 'Pour rester à flot : pas plus de ' + formatMAD(rav) + ' de dépenses courantes d’ici la paie, soit environ ' + formatMAD(parSemaine) + ' par semaine.';""",
    """                                    conseil = 'Pour rester à flot, tenez-vous au Reste à dépenser : il est calculé pour ça.';""")
sub('orage sans marge', """                                else
                                    conseil = 'Réduisez les dépenses courantes jusqu’à la paie du ' + prochainePaieLabel.value + '.';
                            } else {""", """                                else
                                    conseil = 'Réduisez les dépenses courantes jusqu’à la paie du ' + prochainePaieLabel.value + ' : le budget conso ne tient plus en entier.';
                            } else {""")
sub('nuages', """                            conseil = rav > 0
                                ? 'Rythme sûr : environ ' + formatMAD(parSemaine) + ' par semaine jusqu’à la paie du ' + prochainePaieLabel.value + '.'
                                : 'Limitez les dépenses courantes jusqu’à la paie du ' + prochainePaieLabel.value + '.';""",
    """                            conseil = rav > 0
                                ? 'Restez dans le Reste à dépenser jusqu’à la paie du ' + prochainePaieLabel.value + '.'
                                : 'Limitez les dépenses courantes jusqu’à la paie du ' + prochainePaieLabel.value + '.';""")
sub('soleil', """                            conseil = 'Vous pouvez dépenser environ ' + formatMAD(parSemaine) + ' par semaine sans toucher à ce coussin.';""",
    """                            conseil = 'Dépenser le Reste à dépenser, pas plus, préserve ce coussin.';""")
sub('la Météo transporte la Liberté du cycle', """                            pulse: pulseHebdo.value, sanctuaire: sanctuaireHebdo.value,""",
    """                            liberte: liberteCycle.value, sanctuaire: sanctuaireHebdo.value,""")
sub('exposition', """                        pulseHebdo, sanctuaireHebdo,""", """                        liberteCycle, sanctuaireHebdo, consoCompteurRenseigne, saisirCompteurConso,""")

for a, r in edits: src = src.replace(a, r, 1)
io.open(F, 'w', encoding='utf-8').write(src)
print(f'✔ getter liberteCycle + {len(edits)} modifications appliquées à {F}')
