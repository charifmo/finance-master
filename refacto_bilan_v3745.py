# -*- coding: utf-8 -*-
"""
v37.45 — « l'onglet où y a plein de stats et de graphs useless, pas de graphes KPI
importants » : le BILAN (Prévisionnel › Bilan & Simulation), relu par un directeur
financier.

  AVANT — cinq cartes qui répétaient le bandeau du haut (le surplus rebaptisé
  « Reste à vivre moyen », les mensualités, le patrimoine global), dont une fausse :
  « Patrimoine NET » = la simple somme des comptes, aucune dette retranchée. Puis
  deux anneaux qui CACHAIENT le déficit (une part négative ne se dessine pas : un
  budget à −20 000 DH/mois y paraissait plein et équilibré), une courbe tirée d'un
  autre moteur que le Relevé, et un panneau « Audit détaillé » vide tant qu'on n'a
  pas cliqué un anneau.

  APRÈS — les questions qu'un conseiller pose, dans l'ordre :
    1. LE VERDICT, en une phrase par signal, le pire d'abord.
    2. QUATRE SIGNAUX VITAUX, chacun avec son repère : solde du budget, taux
       d'épargne réel, taux d'endettement, épargne de précaution en mois.
    3. LA TRAJECTOIRE DES COMPTES sur 12 mois — le moteur du Relevé (le même
       que le bandeau et la Météo) : fin de mois du compte courant, tous comptes,
       et le point bas daté.
    4. OÙ PART L'ARGENT — chaque poste en DH/mois et en % des ressources, crédits
       à part, détail au clic ; total engagé, ce qui reste ou ce qui manque.
    5. L'ANNÉE MOIS PAR MOIS — ressources face aux sorties, poste par poste : les
       mois où les dépenses ponctuelles font plonger le budget sautent aux yeux.
  Les postes et les mois viennent de respirationDuMois, le modèle de la Météo :
  mêmes libellés, mêmes couleurs, mêmes montants.
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

# ── 1. Les calculs ────────────────────────────────────────────────────────────
CALCULS = r"""                    /* ═══════════════════════════════════════════════════════════════
                       v37.45 — LE BILAN, LU PAR UN DIRECTEUR FINANCIER
                       Quatre signaux vitaux avec leur repère, la trajectoire des comptes
                       (moteur du Relevé), ce que coûte chaque poste et l'année mois par
                       mois (modèle de la Météo, respirationDuMois, crédits à part).
                       ═══════════════════════════════════════════════════════════════ */
                    const _MOIS_BILAN = ['', 'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
                    const POSTES_BILAN = [
                        { cle: 'credits',      label: 'Mensualités de crédit',  icone: '🏦', classe: 'bg-blue-900',   couleur: '#1e3a8a' },
                        { cle: 'fixes',        label: 'Charges fixes',          icone: '🏢', classe: 'bg-orange-500', couleur: '#f97316' },
                        { cle: 'mensuelles',   label: 'Factures & mensuel',     icone: '🧾', classe: 'bg-sky-500',    couleur: '#0ea5e9' },
                        { cle: 'conso',        label: 'Conso courante',         icone: '🛒', classe: 'bg-teal-500',   couleur: '#14b8a6' },
                        { cle: 'exceptionnel', label: 'Dépenses ponctuelles',   icone: '⚠️', classe: 'bg-rose-500',   couleur: '#f43f5e' },
                        { cle: 'epargne',      label: 'Épargne programmée',     icone: '💎', classe: 'bg-violet-500', couleur: '#8b5cf6' },
                    ];
                    //  L'année du budget affiché, mois par mois. Une charge fixe dont la clé
                    //  commence par « credit » est une mensualité (même règle que le bandeau).
                    const bilanAnnee = computed(() => {
                        calculationTick.value;
                        const an = Number(anneeAffichage.value);
                        const d = (donneesAnnuelles.value || {})[an];
                        if (!d) return null;
                        const mb = moisBudgetaire.value;
                        const cumul = {};                       // poste → nom → total annuel
                        const ajoute = (poste, nom, v) => { const p = cumul[poste] || (cumul[poste] = {}); p[nom] = (p[nom] || 0) + v; };
                        const mois = Array.from({ length: 12 }, (_, i) => {
                            const m = i + 1, r = respirationDuMois(an, m);
                            const val = { credits: 0, fixes: 0 };
                            Object.entries(d.chargesFixes || {}).forEach(([k, f]) => {
                                const v = valeurEffective(f, (f || {}).valeur, m);
                                if (!(v > 0)) return;
                                const poste = String(k).startsWith('credit') ? 'credits' : 'fixes';
                                val[poste] += v; ajoute(poste, (f || {}).label || k, v);
                            });
                            ['mensuelles', 'conso', 'exceptionnel', 'epargne'].forEach(cle => {
                                val[cle] = 0;
                                (r.lignes[cle] || []).forEach(l => { val[cle] += l.montant; ajoute(cle, l.nom + (cle === 'exceptionnel' ? ' (' + _MOIS_BILAN[m] + ')' : ''), l.montant); });
                            });
                            Object.keys(val).forEach(k => { val[k] = Math.round(val[k]); });
                            return { m, nom: _MOIS_BILAN[m], ressources: r.ressources, sorties: r.sorties, marge: r.marge, ...val,
                                     courant: an === mb.an && m === mb.mois };
                        });
                        const moy = (k) => mois.reduce((s, x) => s + x[k], 0) / 12;
                        const ressources = moy('ressources'), sorties = moy('sorties'), marge = moy('marge');
                        const postes = POSTES_BILAN.map(p => {
                            const moyenne = moy(p.cle);
                            const lignes = Object.entries(cumul[p.cle] || {}).map(([nom, t]) => ({ nom, moyenne: Math.round(t / 12) }))
                                .filter(l => l.moyenne > 0).sort((a, b) => b.moyenne - a.moyenne);
                            return { ...p, moyenne: Math.round(moyenne), lignes,
                                     pct: ressources > 0 ? Math.round(moyenne / ressources * 100) : 0,
                                     largeur: Math.min(100, moyenne / Math.max(1, ressources > 0 ? ressources : sorties) * 100) };
                        }).filter(p => p.moyenne > 0).sort((a, b) => b.moyenne - a.moyenne);
                        const deficitaires = mois.filter(x => x.marge < 0);
                        const pire = deficitaires.reduce((p, x) => (!p || x.marge < p.marge ? x : p), null);
                        const moindre = deficitaires.reduce((p, x) => (!p || x.marge > p.marge ? x : p), null);
                        const texteDeficit = !deficitaires.length ? 'Chaque mois, les ressources couvrent les sorties.'
                            : (deficitaires.length === 12 ? 'Les 12 mois dépensent plus qu’ils ne rentrent : de ' + formatMAD(moindre.marge) + ' (' + moindre.nom + ') à ' + formatMAD(pire.marge) + ' (' + pire.nom + ').'
                            : deficitaires.length + ' mois où les sorties dépassent les ressources : ' + deficitaires.map(x => x.nom + ' ' + formatMAD(x.marge)).join(', ') + '.');
                        return { an, mois, postes, deficitaires, texteDeficit,
                                 moy: { ressources: Math.round(ressources), sorties: Math.round(sorties), marge: Math.round(marge), epargne: Math.round(moy('epargne')), credits: Math.round(moy('credits')) },
                                 pctEngage: ressources > 0 ? Math.round(sorties / ressources * 100) : 0,
                                 moisCourant: mois.find(x => x.courant) || null };
                    });

                    //  La trajectoire : le Relevé déroulé sur les 12 cycles à venir. Fin de
                    //  mois du compte courant, de tous les comptes (comptes + épargne non liée,
                    //  comme le bandeau), point bas daté du courant.
                    const bilanTrajectoire = computed(() => {
                        calculationTick.value;
                        const mb = moisBudgetaire.value, jdp = jourDePaie.value;
                        const cycles = [];
                        for (let i = 0, m = mb.mois, a = mb.an; i < 12; i++) { cycles.push(m + '-' + a); if (++m > 12) { m = 1; a++; } }
                        let j;
                        try { j = _buildJournalReleve([], cycles); } catch (e) { return null; }
                        if (!j) return null;
                        const ck = j.courantKey, lies = _epargneLinkedKeys.value;
                        const dateDe = (jour, cycle) => {
                            const [cm, ca] = String(cycle).split('-').map(Number);
                            let m = cm, a = ca;
                            if (jdp > 1 && Number(jour) >= jdp) { m--; if (m < 1) { m = 12; a--; } }
                            return Math.min(Math.max(1, Number(jour) || 1), new Date(a, m, 0).getDate()) + ' ' + _MOIS_BILAN[m] + ' ' + a;
                        };
                        const solde = {}, fins = [];
                        let ci = 0, bas = null, decouvert = null;
                        const fige = (jusqua) => { while (ci < jusqua) { fins.push({ ...solde }); ci++; } };
                        (j.entries || []).forEach(e => {
                            const k = e.compteKey;
                            if (!k) return;
                            if (e.type === 'initial') {
                                if (!(k in solde)) solde[k] = Number(e.montant) || 0;
                                if (k === ck && !bas) bas = { montant: solde[k], date: 'aujourd’hui' };
                                return;
                            }
                            const idx = cycles.indexOf(e.cycle);
                            if (idx > ci) fige(idx);
                            solde[k] = Number(e.soldeCompteApres) || 0;
                            if (k === ck) {
                                if (!bas || solde[k] < bas.montant) bas = { montant: solde[k], date: dateDe(e.jourPrevu, e.cycle), libelle: e.libelle };
                                if (!decouvert && solde[k] < -0.5) decouvert = { montant: solde[k], date: dateDe(e.jourPrevu, e.cycle), libelle: e.libelle };
                            }
                        });
                        fige(cycles.length);
                        const points = cycles.map((c, i) => {
                            const [m, a] = c.split('-').map(Number), f = fins[i] || {};
                            return { cycle: c, label: _MOIS_BILAN[m] + ' ' + String(a).slice(-2),
                                     courant: Math.round(Number(f[ck]) || 0),
                                     total: Math.round(Object.keys(f).filter(k => !lies.has(k)).reduce((s, k) => s + (Number(f[k]) || 0), 0)) };
                        });
                        return { points, courantKey: ck, pointBas: bas ? { ...bas, montant: Math.round(bas.montant) } : null,
                                 decouvert: decouvert ? { ...decouvert, montant: Math.round(decouvert.montant) } : null,
                                 fin: points[points.length - 1] };
                    });

                    const _NIVEAUX_BILAN = {
                        ok:        { etiquette: 'Sain',         valeurClasse: 'text-emerald-700', pastille: 'bg-emerald-100 text-emerald-800', barre: 'bg-emerald-500' },
                        attention: { etiquette: 'À surveiller', valeurClasse: 'text-amber-700',   pastille: 'bg-amber-100 text-amber-800',     barre: 'bg-amber-500' },
                        alerte:    { etiquette: 'Alerte',       valeurClasse: 'text-rose-700',    pastille: 'bg-rose-100 text-rose-800',       barre: 'bg-rose-500' },
                        neutre:    { etiquette: 'À définir',    valeurClasse: 'text-gray-800',    pastille: 'bg-gray-100 text-gray-700',       barre: 'bg-gray-400' },
                    };
                    const _pct = (x) => (Math.round(x * 10) / 10).toLocaleString('fr-FR') + ' %';
                    const bilanSignaux = computed(() => {
                        const A = bilanAnnee.value;
                        if (!A) return [];
                        const R = A.moy.ressources, M = A.moy.marge, E = A.moy.epargne;
                        const pctMarge = R > 0 ? M / R * 100 : (M < 0 ? -100 : 0);
                        const mc = A.moisCourant;
                        const out = [];
                        //  1. Le solde du budget
                        out.push({ cle: 'solde', titre: 'Solde mensuel', valeur: formatMAD(M),
                            niveau: M < 0 ? 'alerte' : (pctMarge < 5 ? 'attention' : 'ok'),
                            jauge: Math.min(100, A.pctEngage),
                            explication: M < 0 ? 'Le budget dépense ' + formatMAD(-M) + ' de plus qu’il ne rentre chaque mois : l’écart sort de vos réserves.'
                                               : 'Il reste ' + formatMAD(M) + ' par mois après dépenses et épargne (' + Math.round(pctMarge) + ' % des ressources).',
                            resume: M < 0 ? 'Le budget dépense ' + formatMAD(-M) + ' de plus qu’il ne rentre, chaque mois en moyenne.' : 'Le budget dégage ' + formatMAD(M) + ' par mois (' + Math.round(pctMarge) + ' % des ressources).',
                            repere: 'Moyenne des 12 mois de ' + A.an + (mc ? ' · ce mois-ci : ' + formatMAD(mc.marge) : '') + ' · repère : ≥ 5 % des ressources' });
                        //  2. Le taux d'épargne RÉEL : l'épargne programmée, moins le déficit qui la ronge
                        const tx = R > 0 ? (E + M) / R * 100 : null;
                        out.push({ cle: 'epargne', titre: 'Taux d’épargne', valeur: tx === null ? '—' : _pct(tx),
                            niveau: tx === null ? 'neutre' : (tx < 0 ? 'alerte' : (tx < 10 ? 'attention' : 'ok')),
                            jauge: tx === null ? 0 : Math.max(0, Math.min(100, tx / 20 * 100)),
                            explication: tx === null ? 'Aucun revenu saisi pour ' + A.an + '.'
                                : (E + M >= 0 ? 'Vous mettez de côté ' + formatMAD(E + M) + ' par mois' + (M < 0 ? ' : l’épargne programmée (' + formatMAD(E) + ') moins le déficit.' : ' (épargne programmée ' + formatMAD(E) + (M > 0 ? ' + reste ' + formatMAD(M) : '') + ').')
                                              : 'Le déficit (' + formatMAD(-M) + ') dépasse l’épargne programmée (' + formatMAD(E) + ') : vous puisez ' + formatMAD(-(E + M)) + ' par mois dans vos réserves.'),
                            resume: tx === null ? '' : (tx < 0 ? 'Taux d’épargne réel négatif (' + _pct(tx) + ') : vous puisez ' + formatMAD(-(E + M)) + ' par mois dans vos réserves.' : 'Taux d’épargne réel : ' + _pct(tx) + ' des ressources (repère : 10 % au minimum).'),
                            repere: 'Repère : 10 % au minimum, 20 % c’est très bien' });
                        //  3. Le taux d'endettement — celui du bandeau (mensualités du mois / revenus)
                        const te = Number(tauxEndettement.value) || 0;
                        const paliers = (creditsPaliersData.value || []).map(p => p.range + ' : ' + p.taux + ' %').join(' · ');
                        out.push({ cle: 'endettement', titre: 'Endettement', valeur: _pct(te),
                            niveau: te > 40 ? 'alerte' : (te > 33 ? 'attention' : 'ok'),
                            jauge: Math.min(100, te / 60 * 100),
                            explication: 'Crédits : ' + formatMAD(totalCreditsMensuels.value) + ' par mois pour ' + formatMAD(totalRevenusBase.value) + ' de revenus.' + (paliers ? ' ' + paliers + '.' : ''),
                            resume: 'Les crédits prennent ' + _pct(te) + ' des revenus (repère : 33 %, zone rouge au-delà de 40 %).',
                            repere: 'Repère : un tiers des revenus (33 %) · au-delà de 40 %, zone rouge pour les banques' });
                        //  4. L'épargne de précaution, en mois de dépenses
                        const dep = depensesMensuellesBase.value, liq = patrimoineLiquide.value;
                        const obj = Number((parametres.value || {}).objectifFondsSecuriteMois) || 0;
                        const nb = dep > 0 ? liq / dep : null;
                        out.push({ cle: 'precaution', titre: 'Précaution', valeur: nb === null ? '—' : (Math.round(nb * 10) / 10).toLocaleString('fr-FR') + ' mois',
                            niveau: (nb === null || obj <= 0) ? 'neutre' : (nb >= obj ? 'ok' : (nb >= obj / 2 ? 'attention' : 'alerte')),
                            jauge: (nb === null || obj <= 0) ? 0 : Math.min(100, nb / obj * 100),
                            explication: nb === null ? 'Aucune dépense mensuelle saisie.' : 'Vos liquidités (' + formatMAD(liq) + ') couvrent ' + (Math.round(nb * 10) / 10).toLocaleString('fr-FR') + ' mois de dépenses (' + formatMAD(dep) + ' par mois).',
                            resume: nb === null ? '' : 'Épargne de précaution : ' + (Math.round(nb * 10) / 10).toLocaleString('fr-FR') + ' mois de dépenses' + (obj > 0 ? ', pour un objectif de ' + obj + ' mois.' : '.'),
                            repere: obj > 0 ? 'Objectif : ' + obj + ' mois = ' + formatMAD(cibleFondsSecurite.value) : 'Objectif à régler dans Paramètres' });
                        return out.map(s => ({ ...s, ...(_NIVEAUX_BILAN[s.niveau] || _NIVEAUX_BILAN.neutre) }));
                    });

                    //  Le verdict : une phrase par signal, le pire d'abord.
                    const bilanVerdict = computed(() => {
                        const S = bilanSignaux.value, T = bilanTrajectoire.value, A = bilanAnnee.value;
                        const rang = { alerte: 0, attention: 1, ok: 2, neutre: 3 };
                        const points = [];
                        //  La trésorerie d'abord : c'est le seul signal daté.
                        if (T && T.pointBas) {
                            if (T.decouvert) points.push({ niveau: 'alerte', texte: 'Le compte courant passe sous zéro le ' + T.decouvert.date + ' ; point bas ' + formatMAD(T.pointBas.montant) + ' le ' + T.pointBas.date + '.'
                                + (T.fin && T.fin.total >= 0 ? ' Vos autres comptes le couvrent encore (' + formatMAD(T.fin.total) + ' au total fin ' + T.fin.label + ') : prévoyez les virements.' : ' Même tous vos comptes réunis ne le couvrent pas.') });
                            else points.push({ niveau: 'ok', texte: 'Le compte courant reste positif sur les 12 prochains mois (point bas ' + formatMAD(T.pointBas.montant) + ', ' + T.pointBas.date + ').' });
                        }
                        S.filter(s => s.niveau !== 'neutre' && s.resume).forEach(s => points.push({ niveau: s.niveau, texte: s.resume }));
                        //  Un déficit SAISONNIER (quelques mois seulement) mérite sa ligne ; s'il touche
                        //  les 12 mois, le solde du budget l'a déjà dit.
                        if (A && A.deficitaires.length && A.deficitaires.length < 12) points.push({ niveau: A.deficitaires.length >= 6 ? 'alerte' : 'attention',
                            texte: A.deficitaires.length + ' mois sur 12 dépensent plus qu’ils ne rentrent : ' + A.deficitaires.map(x => x.nom).join(', ').replace(/\.$/, '') + '.' });
                        points.sort((a, b) => rang[a.niveau] - rang[b.niveau]);
                        const nA = points.filter(p => p.niveau === 'alerte').length, nW = points.filter(p => p.niveau === 'attention').length;
                        const niveau = nA ? 'alerte' : (nW ? 'attention' : 'ok');
                        const titre = nA ? (nA === 1 ? '1 signal en alerte' : nA + ' signaux en alerte') + (nW ? ', ' + nW + ' à surveiller' : '')
                                    : (nW ? (nW === 1 ? '1 point à surveiller' : nW + ' points à surveiller') : 'Situation saine : budget, dettes et trésorerie au vert');
                        return { niveau, titre, points };
                    });

                    const _axeDH = (v) => (Math.abs(v) >= 1000 ? (Math.round(v / 100) / 10).toLocaleString('fr-FR') + ' k' : v);
                    const bilanTrajectoireChart = computed(() => {
                        const T = bilanTrajectoire.value;
                        if (!T) return null;
                        return { type: 'bar', data: { labels: T.points.map(p => p.label), datasets: [
                                { type: 'line', label: 'Tous vos comptes', data: T.points.map(p => p.total), borderColor: '#047857', backgroundColor: '#047857', tension: 0.3, pointRadius: 3, order: 1 },
                                { type: 'bar', label: 'Compte courant', data: T.points.map(p => p.courant), backgroundColor: T.points.map(p => p.courant < 0 ? '#e11d48' : '#3b82f6'), borderRadius: 4, order: 2 },
                            ] },
                            options: { responsive: true, maintainAspectRatio: false, animation: false,
                                plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: (c) => c.dataset.label + ' : ' + formatMAD(c.parsed.y) } } },
                                scales: { y: { ticks: { callback: _axeDH }, grid: { color: (c) => (c.tick && c.tick.value === 0 ? '#334155' : '#e5e7eb') } } } } };
                    });
                    const bilanMoisChart = computed(() => {
                        const A = bilanAnnee.value;
                        if (!A) return null;
                        const ordre = ['credits', 'fixes', 'mensuelles', 'conso', 'exceptionnel', 'epargne'];
                        return { type: 'bar', data: { labels: A.mois.map(x => x.nom), datasets: [
                                { type: 'line', label: 'Ressources', data: A.mois.map(x => x.ressources), borderColor: '#15803d', backgroundColor: '#15803d', borderWidth: 3, pointRadius: 4, stack: 'ressources', order: 0 },
                                ...ordre.map(k => { const p = POSTES_BILAN.find(x => x.cle === k); return { label: p.label, data: A.mois.map(x => x[k]), backgroundColor: p.couleur, stack: 'sorties', order: 1 }; }),
                            ] },
                            options: { responsive: true, maintainAspectRatio: false, animation: false,
                                plugins: { legend: { position: 'bottom', labels: { boxWidth: 10 } }, tooltip: { mode: 'index', intersect: false, callbacks: { label: (c) => c.dataset.label + ' : ' + formatMAD(c.parsed.y) } } },
                                scales: { x: { stacked: true }, y: { stacked: true, ticks: { callback: _axeDH } } } } };
                    });

                    const budgetChartConfig = computed(() => {"""
sub('calculs du bilan', "                    const budgetChartConfig = computed(() => {", CALCULS)
sub('bilan : exposé', "                        budgetChartConfig, consoChartConfig, lineChartConfig, detailChartConfig, activeDrilldown,",
    "                        bilanAnnee, bilanTrajectoire, bilanSignaux, bilanVerdict, bilanTrajectoireChart, bilanMoisChart,\n"
    "                        budgetChartConfig, consoChartConfig, lineChartConfig, detailChartConfig, activeDrilldown,")

# ── 2. La page ────────────────────────────────────────────────────────────────
debut = src.index("""                <div v-if="activeTab === 'dashboard'" class="max-w-6xl mx-auto space-y-6">
                    <h2 class="text-2xl font-bold text-gray-800 border-b pb-4">Tableau de bord & KPIs (Année {{anneeAffichage}})</h2>""")
fin_ancre = "                    </div><!-- /dash-evolution -->\n"
fin = src.index(fin_ancre, debut) + len(fin_ancre)
if src.count(fin_ancre) != 1: print('✖ fin du tableau de bord : ancre non unique'); sys.exit(1)
PAGE = """                <div v-if="activeTab === 'dashboard'" class="max-w-6xl mx-auto space-y-6" data-bilan>
                    <!-- ═══ v37.45 — LE BILAN, LU PAR UN DIRECTEUR FINANCIER ═══
                         Remplace cinq cartes qui répétaient le bandeau, deux anneaux qui cachaient
                         le déficit, une courbe d'un autre moteur et un panneau d'audit vide. -->
                    <div class="border-b pb-4">
                        <h2 class="text-2xl font-bold text-gray-800">Bilan {{ anneeAffichage }}</h2>
                        <p class="text-sm text-gray-500 mt-1">Votre santé financière en quatre signaux, la trajectoire de vos comptes et ce que coûte chaque poste — d'après le budget prévu.</p>
                    </div>

                    <div v-if="!bilanAnnee" class="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">Aucun budget saisi pour {{ anneeAffichage }}.</div>
                    <template v-else>
                    <!-- 1. Le verdict -->
                    <section data-bilan-verdict :data-niveau="bilanVerdict.niveau"
                             :class="['rounded-2xl border-2 p-5', bilanVerdict.niveau === 'alerte' ? 'bg-rose-50 border-rose-200' : (bilanVerdict.niveau === 'attention' ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200')]">
                        <p :class="['text-lg font-black', bilanVerdict.niveau === 'alerte' ? 'text-rose-800' : (bilanVerdict.niveau === 'attention' ? 'text-amber-800' : 'text-emerald-800')]">{{ bilanVerdict.titre }}</p>
                        <ul class="mt-2 space-y-1.5">
                            <li v-for="(p, i) in bilanVerdict.points" :key="i" data-bilan-point :data-niveau="p.niveau" class="flex gap-2 text-sm text-gray-800 leading-snug">
                                <span aria-hidden="true" class="shrink-0">{{ p.niveau === 'alerte' ? '🔴' : (p.niveau === 'attention' ? '🟠' : '🟢') }}</span><span>{{ p.texte }}</span>
                            </li>
                        </ul>
                    </section>

                    <!-- 2. Les quatre signaux vitaux, chacun avec son repère -->
                    <div data-bilan-signaux class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                        <div v-for="s in bilanSignaux" :key="s.cle" :data-signal="s.cle" :data-niveau="s.niveau" class="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col">
                            <div class="flex items-start justify-between gap-2">
                                <p class="text-xs font-black uppercase tracking-widest text-gray-600 leading-tight">{{ s.titre }}</p>
                                <span :class="['shrink-0 text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full', s.pastille]">{{ s.etiquette }}</span>
                            </div>
                            <p :class="['text-2xl 2xl:text-3xl font-black mt-2 tabular-nums whitespace-nowrap', s.valeurClasse]" :data-signal-valeur="s.cle">{{ s.valeur }}</p>
                            <div class="mt-3 h-2 rounded-full bg-gray-100 overflow-hidden" aria-hidden="true"><div :class="['h-full rounded-full', s.barre]" :style="{ width: s.jauge + '%' }"></div></div>
                            <p class="text-xs text-gray-700 mt-2 leading-snug">{{ s.explication }}</p>
                            <p class="text-[11px] text-gray-500 mt-auto pt-2 leading-snug">{{ s.repere }}
                                <button v-if="s.cle === 'precaution'" type="button" @click="activeTab = 'settings'" class="text-blue-700 font-bold hover:underline">Régler →</button></p>
                        </div>
                    </div>

                    <!-- 3. La trajectoire des comptes : le Relevé, 12 mois -->
                    <section v-if="bilanTrajectoire" data-bilan-trajectoire class="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                        <div class="flex flex-wrap items-start justify-between gap-4">
                            <div>
                                <h3 class="text-lg font-bold text-gray-800">Trajectoire de vos comptes — 12 prochains mois</h3>
                                <p class="text-xs text-gray-500 mt-0.5">Solde en fin de mois, tel que le Relevé de comptes le projette (même calcul que le bandeau et la Météo).</p>
                            </div>
                            <div v-if="bilanTrajectoire.pointBas" class="text-right">
                                <p class="text-[11px] font-black uppercase tracking-widest text-gray-500">Point bas du compte courant</p>
                                <p data-bilan-point-bas :class="['text-xl font-black tabular-nums', bilanTrajectoire.pointBas.montant < 0 ? 'text-rose-700' : 'text-gray-900']">{{ formatMAD(bilanTrajectoire.pointBas.montant) }}</p>
                                <p class="text-xs text-gray-500">{{ bilanTrajectoire.pointBas.date }}</p>
                            </div>
                        </div>
                        <div class="h-72 mt-4 relative"><base-chart v-if="bilanTrajectoireChart" :config="bilanTrajectoireChart"></base-chart></div>
                        <p data-bilan-fin class="text-xs text-gray-600 mt-3">Fin {{ bilanTrajectoire.fin.label }} : compte courant <span class="font-black tabular-nums" :class="bilanTrajectoire.fin.courant < 0 ? 'text-rose-700' : 'text-gray-900'">{{ formatMAD(bilanTrajectoire.fin.courant) }}</span> · tous comptes <span class="font-black tabular-nums text-gray-900">{{ formatMAD(bilanTrajectoire.fin.total) }}</span>.
                            <button type="button" @click="ouvrirReleve()" class="ml-1 text-blue-700 font-bold hover:underline">Voir le Relevé →</button></p>
                    </section>

                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <!-- 4. Où part l'argent -->
                        <section data-bilan-postes class="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                            <h3 class="text-lg font-bold text-gray-800">Où part l'argent</h3>
                            <p class="text-xs text-gray-500 mt-0.5">Moyenne par mois sur {{ bilanAnnee.an }}, pour {{ formatMAD(bilanAnnee.moy.ressources) }} de ressources. Cliquez un poste pour son détail.</p>
                            <div class="mt-4 space-y-2.5">
                                <details v-for="p in bilanAnnee.postes" :key="p.cle" :data-poste="p.cle" class="group">
                                    <summary class="list-none cursor-pointer rounded-lg px-1 -mx-1 hover:bg-gray-50">
                                        <div class="flex items-baseline justify-between gap-3 text-sm">
                                            <span class="font-bold text-gray-800"><span aria-hidden="true">{{ p.icone }}</span> {{ p.label }} <span class="text-gray-500 text-xs group-open:hidden">▸</span><span class="text-gray-500 text-xs hidden group-open:inline">▾</span></span>
                                            <span class="tabular-nums whitespace-nowrap"><span class="font-black text-gray-900" :data-poste-montant="p.cle">{{ formatMAD(p.moyenne) }}</span> <span class="text-xs font-bold text-gray-500">· {{ p.pct }} %</span></span>
                                        </div>
                                        <div class="mt-1 h-2.5 rounded-full bg-gray-100 overflow-hidden" aria-hidden="true"><div :class="['h-full rounded-full', p.classe]" :style="{ width: p.largeur + '%' }"></div></div>
                                    </summary>
                                    <ul class="mt-2 ml-6 mb-1 space-y-1 text-xs text-gray-700">
                                        <li v-for="l in p.lignes" :key="l.nom" class="flex justify-between gap-3"><span class="min-w-0">{{ l.nom }}</span><span class="tabular-nums font-bold whitespace-nowrap">{{ formatMAD(l.moyenne) }}</span></li>
                                    </ul>
                                </details>
                            </div>
                            <div class="mt-4 pt-3 border-t border-gray-200 flex items-baseline justify-between gap-3 text-sm">
                                <span class="font-bold text-gray-800">Total engagé</span>
                                <span class="tabular-nums"><span class="font-black text-gray-900" data-bilan-total>{{ formatMAD(bilanAnnee.moy.sorties) }}</span> <span :class="['text-xs font-black', bilanAnnee.pctEngage > 100 ? 'text-rose-700' : 'text-gray-600']">· {{ bilanAnnee.pctEngage }} % des ressources</span></span>
                            </div>
                            <p data-bilan-marge :class="['text-sm font-bold mt-1 text-right', bilanAnnee.moy.marge < 0 ? 'text-rose-700' : 'text-emerald-700']">{{ bilanAnnee.moy.marge < 0 ? 'Il manque ' + formatMAD(-bilanAnnee.moy.marge) + ' par mois.' : 'Il reste ' + formatMAD(bilanAnnee.moy.marge) + ' par mois.' }}</p>
                        </section>

                        <!-- 5. L'année mois par mois -->
                        <section data-bilan-mois class="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col">
                            <h3 class="text-lg font-bold text-gray-800">L'année {{ bilanAnnee.an }} mois par mois</h3>
                            <p class="text-xs text-gray-500 mt-0.5">Les ressources (ligne verte) face aux sorties, poste par poste.</p>
                            <div class="h-72 mt-4 relative flex-1 min-h-[18rem]"><base-chart v-if="bilanMoisChart" :config="bilanMoisChart"></base-chart></div>
                            <p data-bilan-mois-deficit :class="['text-xs mt-3 font-bold', bilanAnnee.deficitaires.length ? 'text-rose-700' : 'text-emerald-700']">{{ bilanAnnee.texteDeficit }}</p>
                        </section>
                    </div>
                    </template>
"""
src = src[:debut] + PAGE + src[fin:]

io.open(F, 'w', encoding='utf-8').write(src)
print('✔ index.html : Bilan refondu (verdict, 4 signaux, trajectoire, postes, mois par mois)')
