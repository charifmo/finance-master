# -*- coding: utf-8 -*-
"""
v37.31 Prevu-Par-Defaut — une semaine ÉCOULÉE sans saisie compte son prévu.

  Retour utilisateur : « quand je ne remplis pas un poste variable et que la
  semaine s'est écoulée, il faut mettre par défaut la valeur prévue en réalisé ».

  Règle (defautsSemaine) — pour une semaine dont le dimanche est passé :
    • chaque ligne « / sem » d'une charge variable, et chaque charge SANS ligne,
      qui n'a ni saisie (même 0) ni ticket daté cette semaine-là, compte son
      PRÉVU de la semaine comme réalisé ;
    • les lignes /15 j et /cycle n'en reçoivent pas : elles ne s'achètent pas
      chaque semaine et se suivent sur le cycle (v37.30) ;
    • une charge qui porte encore un ancien total de CYCLE (avant la saisie par
      semaine) n'en reçoit pas non plus : ce total couvre déjà ses semaines ;
    • une charge saisie EN VRAC cette semaine-là (un montant dans « Autre », ou un
      ticket non ventilé sur un poste) non plus : la même dépense compterait deux fois.
  Rien n'est écrit dans les données : le défaut est CALCULÉ (il suit le prévu),
  et disparaît dès qu'on tape un montant — 0 compris, pour « rien dépensé ».

  Moteur : engagé(catégorie) = max(saisi, tickets) + défauts. Les défauts ne
  couvrent que des lignes-semaines sans aucune trace : pas de double comptage.
  La semaine EN COURS et les semaines à venir restent vierges (v37.28).
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
sub('règle des défauts', r"""                    //  Le compteur en vrac a-t-il été rempli ? (bouton ↩ d'effacement)""",
    r"""                    /*  v37.31 — UNE SEMAINE ÉCOULÉE SANS SAISIE COMPTE SON PRÉVU.
                        Le prévu HEBDO de chaque ligne « / sem » d'une charge (ou de la charge
                        entière, sans ligne) pour un budget de cycle donné : le MÊME calcul que
                        l'affichage de la Météo (parts du cycle triées, reste d'arrondi sur la
                        première), pour que le défaut tombe pile sur le « Prévu » affiché. */
                    const prevuHebdoLignes = (key, cv, budget, n) => {
                        const dets = (cv.details || []).filter(x => x && Number(x.montant) > 0);
                        if (!dets.length) return { [key]: Math.round(budget / n) };
                        const poids = (x) => Number(x.montant) * facteurPeriode(periodeDetail(x, cv), n);
                        const W = dets.reduce((s, x) => s + poids(x), 0);
                        const parts = dets.map(x => ({ x, part: Math.round(W > 0 ? budget * poids(x) / W : 0), montant: Math.round(Number(x.montant) * (W > 0 ? budget / W : 1)) }))
                                          .sort((a, b) => b.part - a.part || b.montant - a.montant);
                        if (parts.length) parts[0].part += Math.round(budget) - parts.reduce((s, p) => s + p.part, 0);
                        const out = {};
                        parts.forEach(p => { if (periodeDetail(p.x, cv) === 'semaine') out[cleDetailT0(key, p.x)] = Math.round(p.part / n); });
                        return out;
                    };
                    //  Les défauts d'UNE semaine (lundi ISO) : {} tant qu'elle n'est pas écoulée.
                    const defautsSemaine = (lundiISO) => {
                        const dimanche = _ymd(_decaler(lundiISO, 6));
                        if (!(dimanche < _ymd(new Date()))) return {};
                        const d = donneesAnnuelles.value[consoT0Annee.value];
                        if (!d) return {};
                        const mb = moisBudgetaire.value, n = semainesDuCycle(mb.mois, mb.an);
                        const vals = _valeursSemaine(lundiISO), base = consoT0SaisiesCycle.value;
                        const T = _lireTickets(lundiISO, dimanche);
                        const out = {};
                        Object.entries(d.chargesVariables || {}).forEach(([key, cv]) => {
                            if (!cv || cv.categorieId === 'cat_cv_factures') return;
                            //  Un ancien total de CYCLE (avant la saisie par semaine) couvre déjà ses semaines
                            if (Object.keys(base).some(k => k === key || k.startsWith(key + '::'))) return;
                            const budget = Math.round(budgetCategorieRevise(cv));
                            if (!(budget > 0)) return;
                            const g = T.parCle[key] || { total: 0, parPoste: {} };
                            //  Saisie EN VRAC cette semaine-là (« Autre », ou un ticket non ventilé sur
                            //  un poste) : la catégorie est réglée en bloc — pas de prévu ajouté aux
                            //  lignes vides, sinon la même dépense compterait deux fois.
                            const nonVentile = g.total - Object.values(g.parPoste || {}).reduce((s, x) => s + x, 0);
                            if ((cv.details || []).some(x => x && Number(x.montant) > 0) && (Number(vals[key] || 0) > 0 || nonVentile > 0.5)) return;
                            const idDe = {};
                            (cv.details || []).forEach(x => { if (x) idDe[cleDetailT0(key, x)] = x.categorieId; });
                            Object.entries(prevuHebdoLignes(key, cv, budget, n)).forEach(([cle, v]) => {
                                if (!(v > 0) || Object.prototype.hasOwnProperty.call(vals, cle)) return;   // saisi, même 0
                                const tk = cle === key ? g.total : (idDe[cle] ? (g.parPoste[idDe[cle]] || 0) : 0);
                                if (tk > 0) return;                                                         // un ticket daté
                                out[cle] = v;
                            });
                        });
                        return out;
                    };
                    //  Les défauts des semaines ÉCOULÉES du cycle : { lundi: { clé: montant } }
                    const consoDefautsDuCycle = computed(() => {
                        calculationTick.value;
                        const { debut, fin } = consoT0Fenetre.value;
                        const out = {};
                        const j = new Date(debut.getFullYear(), debut.getMonth(), debut.getDate() + ((4 - debut.getDay() + 7) % 7));
                        for (; j.getTime() <= fin.getTime(); j.setDate(j.getDate() + 7)) {
                            const lundi = _ymd(new Date(j.getFullYear(), j.getMonth(), j.getDate() - 3));
                            const dft = defautsSemaine(lundi);
                            if (Object.keys(dft).length) out[lundi] = dft;
                        }
                        return out;
                    });
                    //  … additionnés par clé (ligne ou charge)
                    const consoDefautsParCle = computed(() => {
                        const out = {};
                        Object.values(consoDefautsDuCycle.value).forEach(w => Object.entries(w).forEach(([k, v]) => { out[k] = (out[k] || 0) + v; }));
                        return out;
                    });
                    const defautDeCategorie = (key) => Object.entries(consoDefautsParCle.value)
                        .filter(([k]) => k === key || k.startsWith(key + '::')).reduce((s, [, v]) => s + v, 0);

                    //  Le compteur en vrac a-t-il été rempli ? (bouton ↩ d'effacement)""")
sub('tickets des semaines du cycle', r"""                        const { debut, fin } = consoT0Fenetre.value;
                        const auj = new Date();
                        return _lireTickets(_ymd(debut), _ymd(fin < auj ? fin : auj));""",
    r"""                        const { debut, fin } = consoT0Fenetre.value;
                        const auj = new Date();
                        //  v37.31 : les tickets des SEMAINES du cycle (règle du jeudi, v37.27), comme
                        //  les saisies : du lundi de la 1ʳᵉ semaine au dimanche de la dernière.
                        //  Un ticket du lundi 5 oct. compte dans le cycle qui commence le jeudi 8.
                        const j1 = new Date(debut.getFullYear(), debut.getMonth(), debut.getDate() + ((4 - debut.getDay() + 7) % 7));
                        const jN = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate() - ((fin.getDay() - 4 + 7) % 7));
                        const lundi1 = new Date(j1.getFullYear(), j1.getMonth(), j1.getDate() - 3), dimN = new Date(jN.getFullYear(), jN.getMonth(), jN.getDate() + 3);
                        return _lireTickets(_ymd(lundi1), _ymd(dimN < auj ? dimN : auj));""")
sub('déclaré dès qu\'un défaut existe', r"""                        consoCompteurRenseigne.value || _ticketsCycle.value.total > 0
                    );""", r"""                        consoCompteurRenseigne.value || _ticketsCycle.value.total > 0 || Object.keys(consoDefautsDuCycle.value).length > 0
                    );""")
sub('moteur : max(saisi, tickets) + défauts', r"""                                const declare = saisi > 0 || tickets > 0 || (declareQuelquePart && (Object.prototype.hasOwnProperty.call(saisies, key) || clesPostes.length > 0));
                                const engage = declare ? Math.max(saisi, tickets) : (declareQuelquePart ? theoriqueCat : 0);
                                return {
                                    key, saisi, libre, parPostes, tickets, declare,""",
    r"""                                //  v37.31 : les semaines écoulées sans saisie comptent leur prévu. Ces
                                //  défauts ne couvrent que des lignes-semaines SANS saisie ni ticket :
                                //  ils s'ajoutent au max(saisi, tickets), sans double comptage.
                                const defaut = Math.round(defautDeCategorie(key));
                                const declare = saisi > 0 || tickets > 0 || defaut > 0 || (declareQuelquePart && (Object.prototype.hasOwnProperty.call(saisies, key) || clesPostes.length > 0));
                                const engage = declare ? Math.max(saisi, tickets) + defaut : (declareQuelquePart ? theoriqueCat : 0);
                                return {
                                    key, saisi, libre, parPostes, tickets, declare, defaut,""")

# ══ 2. LA MÉTÉO ═════════════════════════════════════════════════════════════
sub('météo : défauts de la semaine affichée', r"""                        const aSaisie = (cle) => Object.prototype.hasOwnProperty.call(valsSem, cle);""",
    r"""                        const aSaisie = (cle) => Object.prototype.hasOwnProperty.call(valsSem, cle);
                        const defsSem = defautsSemaine(lundiSel);                        // v37.31 : {} si pas écoulée""")
sub('météo : poste du cycle avec ses défauts', r"""                                const saisiP = Math.max(0, Math.round(Number(consoT0Saisies.value[cle] || 0)));
                                const engP = Math.max(saisiP, dep);""",
    r"""                                const saisiP = Math.max(0, Math.round(Number(consoT0Saisies.value[cle] || 0)));
                                const engP = Math.max(saisiP, dep) + Math.round(consoDefautsParCle.value[cle] || 0);   // v37.31""")
sub('météo : poste de la semaine avec son défaut', r"""                                const eng = Math.max(sai, tk);
                                const base = { cle: p.cle, nom: p.nom, emoji: p.emoji, unite: p.unite, saisi: sai, declare: aSaisie(p.cle), tickets: tk, engage: eng };""",
    r"""                                //  v37.31 : semaine écoulée, rien saisi ni ticketé → son prévu
                                const defaut = Math.round(defsSem[p.cle] || 0);
                                const eng = Math.max(sai, tk) + defaut;
                                const base = { cle: p.cle, nom: p.nom, emoji: p.emoji, unite: p.unite, saisi: sai, declare: aSaisie(p.cle), tickets: tk, engage: eng, defaut };""")
sub('météo : la semaine avec ses défauts', r"""                            const declS = saisiS > 0 || ticketsS > 0 || Object.keys(valsSem).some(k => k === c.key || k.startsWith(c.key + '::'));
                            //  v37.28 : une semaine vaut ce qui a été TAPÉ (ou ticketé), rien d'autre.
                            //  Aucune estimation n'entre dans une case : sans saisie, 0.
                            const engS = declS ? Math.max(saisiS, ticketsS) : 0;""",
    r"""                            //  v37.31 : une semaine ÉCOULÉE : chaque ligne laissée vide compte son prévu
                            const defautS = Math.round(defsSem[c.key] || 0) + postesSem.reduce((s, p) => s + (p.defaut || 0), 0);
                            const declS = saisiS > 0 || ticketsS > 0 || defautS > 0 || Object.keys(valsSem).some(k => k === c.key || k.startsWith(c.key + '::'));
                            //  v37.28 : la semaine en cours (et à venir) vaut ce qui a été TAPÉ (ou
                            //  ticketé), rien d'autre ; aucune estimation n'entre dans une case.
                            const engS = declS ? Math.max(saisiS, ticketsS) + defautS : 0;""")
sub('météo : semaine exposée', r"""                                budget: semBudget, prevuSemaine, prevuCycle: prevuCycleLignes, engage: engS, saisi: saisiS, libre: libreS, tickets: ticketsS, declare: declS,""",
    r"""                                budget: semBudget, prevuSemaine, prevuCycle: prevuCycleLignes, engage: engS, saisi: saisiS, libre: libreS, tickets: ticketsS, declare: declS, defaut: defautS,""")
sub('météo : source de la semaine', r"""                                source: declS ? (ticketsS > saisiS ? 'tickets' : 'compteur') : 'vide',""",
    r"""                                source: declS ? (saisiS === 0 && ticketsS === 0 && defautS > 0 ? 'defaut' : (ticketsS > saisiS ? 'tickets' : 'compteur')) : 'vide',""")
sub('météo : catégorie du cycle', r"""                                source: !c.declare ? 'estime' : (c.tickets > c.saisi ? 'tickets' : 'compteur'),""",
    r"""                                defaut: c.defaut || 0,
                                source: !c.declare ? 'estime' : (c.saisi === 0 && c.tickets === 0 && c.defaut > 0 ? 'defaut' : (c.tickets > c.saisi ? 'tickets' : 'compteur')),""")
sub('météo : calcul (ⓘ)', r"""                                engageEstime: categories.filter(c => !c.declare).reduce((s, c) => s + c.engage, 0),""",
    r"""                                engageEstime: categories.filter(c => !c.declare).reduce((s, c) => s + c.engage, 0),
                                engageDefaut: categories.reduce((s, c) => s + (c.defaut || 0), 0),""")
sub('météo : défauts de la semaine', r"""                                         budget: sb, engage: se, reste: sb - se, pct: sb > 0 ? Math.min(100, Math.round(se / sb * 100)) : 0 };""",
    r"""                                         defaut: categories.reduce((s, c) => s + (c.sem.defaut || 0), 0),
                                         budget: sb, engage: se, reste: sb - se, pct: sb > 0 ? Math.min(100, Math.round(se / sb * 100)) : 0 };""")

# ── Gabarit ──────────────────────────────────────────────────────────────────
sub('note : semaine écoulée', r"""                    ℹ️ Cette semaine appartient au cycle {{ sm.cycleRel === 'precedent' ? 'précédent' : 'suivant' }} : elle ne change pas le Reste à dépenser ci-dessus.
                </p>""", r"""                    ℹ️ Cette semaine appartient au cycle {{ sm.cycleRel === 'precedent' ? 'précédent' : 'suivant' }} : elle ne change pas le Reste à dépenser ci-dessus.
                </p>
                <p v-if="sm.defaut > 0" data-semaine-defaut class="mb-2 rounded-lg bg-emerald-400/15 ring-1 ring-emerald-200/30 px-2.5 py-1.5 text-[10px] font-semibold text-white/85 leading-snug">
                    ✓ Semaine écoulée : les lignes laissées vides comptent leur prévu ({{ formatMad(sm.defaut) }}). Tapez le vrai montant pour corriger — 0 si rien n'a été dépensé.
                </p>""")
sub('ligne : marque « au prévu »', r"""                                    <template v-if="c.sem.tickets > 0"> · 🧾 {{ chiffre(c.sem.tickets) }}</template>""",
    r"""                                    <template v-if="c.sem.tickets > 0"> · 🧾 {{ chiffre(c.sem.tickets) }}</template>
                                    <template v-if="c.sem.defaut > 0"> · <span class="text-emerald-200" data-pulse-defaut>✓ au prévu</span></template>""")
sub('case unique : le prévu retenu', r"""                                   :value="c.sem.saisi || ''" placeholder="0"
""", r"""                                   :value="c.sem.saisi || (caseActive === c.key ? '' : (c.sem.defaut || ''))" :placeholder="!c.sem.saisi && c.sem.defaut > 0 && caseActive === c.key ? String(c.sem.defaut) : '0'" :data-defaut="!c.sem.saisi && c.sem.defaut > 0 ? '1' : null" :class="!c.sem.saisi && c.sem.defaut > 0 ? 'opacity-60' : ''"
""")
sub('case poste : le prévu retenu', r"""                                       :value="d.declare ? d.saisi : ''" placeholder="0"
""", r"""                                       :value="d.declare ? d.saisi : (caseActive === d.cle ? '' : (d.defaut || ''))" :placeholder="!d.declare && d.defaut > 0 && caseActive === d.cle ? String(d.defaut) : '0'" :data-defaut="!d.declare && d.defaut > 0 ? '1' : null" :class="!d.declare && d.defaut > 0 ? 'opacity-60' : ''"
""")
sub('poste : marque « au prévu »', r"""<template v-if="d.tickets > 0"> · 🧾 {{ chiffre(d.tickets) }}</template></span>""",
    r"""<template v-if="d.tickets > 0"> · 🧾 {{ chiffre(d.tickets) }}</template><template v-if="d.defaut > 0"> · <span class="text-emerald-200" data-pulse-poste-defaut>✓ au prévu</span></template></span>""")
#  Une case au prévu retenu se VIDE quand on y entre (le prévu passe en invite) : sinon un clic
#  place le curseur après « 400 » et taper 350 donne 400350. L'état est RÉACTIF (caseActive) :
#  Vue réécrit `value` à chaque rendu, une case vidée à la main serait re-remplie en pleine saisie.
sub('case active', r"""            data() { return { rx: null, rxEpingle: false, rxStyle: {}, rxTousPostes: false, ouvertes: {} }; },""",
    r"""            data() { return { rx: null, rxEpingle: false, rxStyle: {}, rxTousPostes: false, ouvertes: {}, caseActive: null }; },""")
sub('méthodes entrer / sortir d\'une case', r"""                saisirCompteur(cle, e) { this.$emit('saisie', this.sm.lundi, cle, e.target.value); },""",
    r"""                saisirCompteur(cle, e) { this.$emit('saisie', this.sm.lundi, cle, e.target.value); },
                //  v37.31 : une case au prévu retenu se vide quand on y entre — le prévu reste en
                //  invite, on tape le vrai montant ; ressortie sans rien taper, elle le retrouve.
                entrerCase(e, cle, defaut) { this.caseActive = cle; if (!(defaut > 0)) e.target.select(); },
                sortirCase(cle) { if (this.caseActive === cle) this.caseActive = null; },""")
sub('case unique : entrer / sortir', r"""                                   @input="saisirCompteur(c.key, $event)" @focus="fermer()" """,
    r"""                                   @input="saisirCompteur(c.key, $event)" @focus="entrerCase($event, c.key, !c.sem.saisi ? c.sem.defaut : 0); fermer()" @blur="sortirCase(c.key)" """)
sub('case poste : entrer / sortir', r"""@input="saisirPoste(d, $event, false)" @change="saisirPoste(d, $event, true)" @focus="$event.target.select(); fermer()" """,
    r"""@input="saisirPoste(d, $event, false)" @change="saisirPoste(d, $event, true)" @focus="entrerCase($event, d.cle, !d.declare ? d.defaut : 0); fermer()" @blur="sortirCase(d.cle)" """)
sub('« +50 » sur un prévu retenu', r"""                        const v = Math.max(0, Math.round((Number(d.saisi) || 0) + (m[1] === '+' ? 1 : -1) * Number(m[2])));""",
    r"""                        const v = Math.max(0, Math.round((Number(d.declare ? d.saisi : d.defaut) || 0) + (m[1] === '+' ? 1 : -1) * Number(m[2])));""")
#  Rayons X : ce qui est retenu, défauts compris
sub('rayons x : retenu', r"""                    <template v-else-if="rxContenu.c.saisi > 0 && rxContenu.c.tickets > 0">📝 Total saisi {{ formatMad(rxContenu.c.saisi) }} · 🧾 tickets {{ formatMad(rxContenu.c.tickets) }} : on retient le plus grand, {{ formatMad(rxContenu.c.engage) }} — jamais la somme.</template>
                    <template v-else-if="rxContenu.c.source === 'compteur'">📝 Total saisi sur la carte : {{ formatMad(rxContenu.c.engage) }}.</template>
                    <template v-else>🧾 Retenu : la somme des tickets datés du cycle, {{ formatMad(rxContenu.c.engage) }}.</template>""",
    r"""                    <template v-else-if="rxContenu.c.source === 'defaut'">✓ Rien saisi ce cycle : les semaines écoulées comptent leur prévu, {{ formatMad(rxContenu.c.defaut) }}. Tapez le vrai montant sur la ligne pour corriger.</template>
                    <template v-else-if="rxContenu.c.saisi > 0 && rxContenu.c.tickets > 0">📝 Total saisi {{ formatMad(rxContenu.c.saisi) }} · 🧾 tickets {{ formatMad(rxContenu.c.tickets) }} : on retient le plus grand, {{ formatMad(Math.max(rxContenu.c.saisi, rxContenu.c.tickets)) }} — jamais la somme.</template>
                    <template v-else-if="rxContenu.c.source === 'compteur'">📝 Total saisi sur la carte : {{ formatMad(rxContenu.c.saisi) }}.</template>
                    <template v-else>🧾 Retenu : la somme des tickets datés du cycle, {{ formatMad(rxContenu.c.tickets) }}.</template>
                    <span v-if="rxContenu.c.defaut > 0 && rxContenu.c.source !== 'defaut'" class="block mt-1 text-emerald-300/90" data-rx-defaut>✓ + {{ formatMad(rxContenu.c.defaut) }} au prévu : semaines écoulées sans saisie.</span>""")
sub('ⓘ : dont au prévu', r"""                    <p v-if="p.declare" class="flex justify-between gap-3"><span class="text-slate-300">− Déjà dépensé (déclaré)</span><span class="font-black text-white tabular-nums">− {{ formatMad(p.calcul.engageDeclare) }}</span></p>""",
    r"""                    <p v-if="p.declare" class="flex justify-between gap-3"><span class="text-slate-300">− Déjà dépensé (déclaré)</span><span class="font-black text-white tabular-nums">− {{ formatMad(p.calcul.engageDeclare) }}</span></p>
                    <p v-if="p.calcul.engageDefaut > 0" class="flex justify-between gap-3 pl-3 text-[10px]" data-rx-calcul-defaut><span class="text-slate-400">dont au prévu (semaines écoulées sans saisie)</span><span class="tabular-nums text-slate-300">{{ formatMad(p.calcul.engageDefaut) }}</span></p>""")
sub('exports', r"""                        periodeDetail, coutVariableDuCycle, dependDesSemaines, valeurEquivalente,""",
    r"""                        periodeDetail, coutVariableDuCycle, dependDesSemaines, valeurEquivalente,
                        // v37.31 : semaine écoulée sans saisie = son prévu
                        defautsSemaine, consoDefautsDuCycle,""")

for a, r, n in edits: src = src.replace(a, r, n)
io.open(F, 'w', encoding='utf-8').write(src)
print(f'✔ {len(edits)} modifications appliquées à {F}')
