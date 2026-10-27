# -*- coding: utf-8 -*-
"""
v37.66 (suite) — LES POSTES À LA QUINZAINE QUI DÉBORDENT, ET LA FRISE DU CYCLE.

« Vérifie aussi la même chose pour les charges en demi-cycle qui franchissent le cycle d'après, et il faut
alerter par rapport à ça ; et il faut créer un outil graphique sur le temps pour montrer le cycle,
l'avancement pour chaque catégorie et sous-catégorie, les chevauchements, les dépassements, pour que ce
soit clair. Cet outil sera à la demande. »
  • Un poste à la quinzaine (Psy, 400 DH toutes les 2 semaines) a une enveloppe de jours ÷ 14 séances
    (31 jours ≈ 2,2). D'après la dernière séance payée (saisie ou ticket), la prochaine tombe 14 jours plus
    tard : « ↪ prochaine séance ≈ 10 nov. : couverte », « ⚠️ ≈ 24 nov. : elle dépasserait l'enveloppe de
    314 DH », ou « ↪ ≈ 1 déc. : au cycle suivant ». Rien de payé encore : « ≈ 2,2 séances ce cycle — une
    3ᵉ avant le 26 nov. dépasserait de 314 DH ».
  • 📈 FRISE DU CYCLE (bouton de la carte, à la demande) : l'axe du cycle, ses morceaux de semaine (✂️ ceux
    que coupe la paie), le jour J ; pour chaque catégorie, sa barre (engagé / budget, repère du rythme
    attendu) ; pour chaque poste de la semaine, une case par morceau (réel / prévu — au prévu, à venir,
    dépassé) ; pour chaque poste du cycle, son enveloppe et ses séances (payées, à venir, au cycle
    suivant). En tête, les dépassements et les alertes.
"""
import io, sys
F = 'index.html'
src = io.open(F, encoding='utf-8').read()
def sub(label, a, b, n=1):
    global src
    if src.count(a) != n: print('✖', label, ':', src.count(a), 'ancre(s),', n, 'attendue(s)'); sys.exit(1)
    src = src.replace(a, b)

# ── 1. Les postes du cycle : leurs paiements, la prochaine séance d'un poste à la quinzaine ─────────────
sub('postes du cycle : paiements et alerte',
"""                            postesCycle: categories.flatMap(c => c.sem.postes.filter(p => p.unite !== 'semaine')
                                .map(p => ({ ...p, cat: c.key, catLabel: c.label, fois: p.unite === 'quinzaine' ? String(Math.round(nSem / 2 * 10) / 10).replace('.', ',') : '1',
                                             resteCycle: Math.max(0, p.cyclePrevu - p.cycleEngage) }))),""",
"""                            postesCycle: categories.flatMap(c => c.sem.postes.filter(p => p.unite !== 'semaine')
                                .map(p => ({ ...p, cat: c.key, catLabel: c.label, fois: p.unite === 'quinzaine' ? String(Math.round(nSem / 2 * 10) / 10).replace('.', ',') : '1',
                                             resteCycle: Math.max(0, p.cyclePrevu - p.cycleEngage), categorieId: ((c.prevu || []).find(x => x.cle === p.cle) || {}).categorieId || null,
                                             ...quinzaineDuPoste(c.key, { ...p, categorieId: ((c.prevu || []).find(x => x.cle === p.cle) || {}).categorieId || null }, nSem) }))),""")
sub('quinzaine du poste',
"""                    const liberteCycle = computed(() => {""",
"""                    /*  v37.66 — UN POSTE À LA QUINZAINE QUI DÉBORDE. Ses paiements du cycle (les morceaux où il
                        est tapé, ses tickets datés) ; la prochaine séance 14 jours après la dernière : couverte,
                        au-delà de l'enveloppe, ou au cycle suivant. Rien de payé : l'enveloppe en séances
                        (jours ÷ 14) dit si une séance de plus dépasserait.
                        → { paiements: [ISO], prochaine: ISO|null, alerte: { niveau, texte }|null } */
                    const quinzaineDuPoste = (cat, p, nSem) => {
                        const { debut, fin } = consoT0Fenetre.value, d1 = _ymd(fin);
                        const lib = (iso) => { const t = _decaler(iso, 0); return t.getDate() + ' ' + _MOIS_COURTS[t.getMonth()]; };
                        const paiements = [];
                        morceauxEntre(debut, fin).forEach(s => { const iso = _ymd(s.debut); if (Number((_valeursSemaine(iso) || {})[p.cle] || 0) > 0) paiements.push(iso); });
                        ((_ticketsCycle.value.parCle[cat] || {}).tx || []).forEach(t => { if (p.categorieId && t.categorieId === p.categorieId && t.date) paiements.push(t.date); });
                        paiements.sort();
                        if (p.unite !== 'quinzaine' || !(p.prevu > 0)) return { paiements, prochaine: null, alerte: null };
                        const reste = p.cyclePrevu - p.cycleEngage;
                        if (!paiements.length) {
                            const fois = nSem / 2, n = Math.floor(fois + 1e-9);
                            if (fois - n < 0.05) return { paiements, prochaine: null, alerte: null };
                            const depasse = Math.round((n + 1) * p.prevu - p.cyclePrevu);
                            return { paiements, prochaine: null, alerte: { niveau: 'info', texte: '≈ ' + String(Math.round(fois * 10) / 10).replace('.', ',') + ' séances ce cycle : une ' + (n + 1) + 'ᵉ avant le ' + lib(d1) + ' dépasserait l\\u2019enveloppe de ' + depasse + ' DH' } };
                        }
                        const prochaine = _ymd(_decaler(paiements[paiements.length - 1], 14));
                        if (prochaine > d1) return { paiements, prochaine, alerte: { niveau: 'suivant', texte: '↪ Prochaine séance ≈ ' + lib(prochaine) + ' : au cycle suivant' } };
                        if (reste + 0.5 < p.prevu) return { paiements, prochaine, alerte: { niveau: 'depasse', texte: '⚠️ Prochaine séance ≈ ' + lib(prochaine) + ' : elle dépasserait l\\u2019enveloppe de ' + Math.round(p.prevu - Math.max(0, reste)) + ' DH' } };
                        return { paiements, prochaine, alerte: { niveau: 'ok', texte: '↪ Prochaine séance ≈ ' + lib(prochaine) + ' : couverte' } };
                    };
                    const liberteCycle = computed(() => {""")
sub('alerte dans le bloc du cycle',
"""                            <span class="block h-[3px] mt-1 rounded-full bg-black/25 overflow-hidden"><span :class="['block h-full rounded-full transition-all duration-300', d.depasse ? 'bg-rose-300' : 'bg-white/75']" :style="{ width: d.pct + '%' }"></span></span>
                        </span>
                        <label class="shrink-0 flex items-center gap-1 rounded-lg ring-1 px-2 py-1 bg-black/30 ring-white/35 hover:ring-white/70 focus-within:ring-2 focus-within:ring-white focus-within:bg-black/45 cursor-text transition-colors shadow-inner"
                               :title="'Payé cette semaine pour ' + d.nom""",
"""                            <span class="block h-[3px] mt-1 rounded-full bg-black/25 overflow-hidden"><span :class="['block h-full rounded-full transition-all duration-300', d.depasse ? 'bg-rose-300' : 'bg-white/75']" :style="{ width: d.pct + '%' }"></span></span>
                            <span v-if="d.alerte && d.alerte.niveau !== 'info'" data-pulse-cycle-alerte :data-niveau="d.alerte.niveau"
                                  :class="['block mt-0.5 text-[10px] font-bold leading-snug', d.alerte.niveau === 'depasse' ? 'text-rose-200' : (d.alerte.niveau === 'info' ? 'text-amber-200' : 'text-white/60')]">{{ d.alerte.texte }}</span>
                        </span>
                        <label class="shrink-0 flex items-center gap-1 rounded-lg ring-1 px-2 py-1 bg-black/30 ring-white/35 hover:ring-white/70 focus-within:ring-2 focus-within:ring-white focus-within:bg-black/45 cursor-text transition-colors shadow-inner"
                               :title="'Payé cette semaine pour ' + d.nom""")

sub('note quinzaine du bloc',
"""<p class="px-1.5 mt-1 text-[10px] font-semibold text-white/60 leading-snug">{{ p.cycleDu }} → {{ p.cycleAu }} : une enveloppe pour tout le cycle — tapez le montant la semaine où c'est payé.</p>""",
"""<p class="px-1.5 mt-1 text-[10px] font-semibold text-white/60 leading-snug">{{ p.cycleDu }} → {{ p.cycleAu }} : une enveloppe pour tout le cycle — tapez le montant la semaine où c'est payé.<template v-if="p.postesCycle.some(d => d.unite === 'quinzaine')"> <span class="text-amber-200" data-pulse-cycle-quinzaine>« / 15 j » : ≈ {{ p.postesCycle.find(d => d.unite === 'quinzaine').fois }} fois sur ce cycle — une fois de plus dépasserait l'enveloppe ; après le {{ p.cycleAu }}, elle compte au cycle suivant.</span></template></p>""")
# ── 2. La frise du cycle (à la demande) ─────────────────────────────────────────────────────────────────
sub('bouton de la frise',
"""                    <button v-if="p.compteur" type="button" data-liberte-effacer""",
"""                    <button type="button" data-ouvrir-frise @click="$emit('frise')" title="La frise du cycle : avancement, morceaux de semaine, dépassements"
                            class="text-[10px] font-black text-white/85 hover:text-white underline decoration-dotted underline-offset-2">📈 Frise du cycle</button>
                    <button v-if="p.compteur" type="button" data-liberte-effacer""")
sub('emits frise', "'cloturer', 'retirer-virement'],", "'cloturer', 'retirer-virement', 'frise'],")
sub('branchement frise', """@retirer-virement="retirerVirementPrevu"></meteo-financiere>""", """@retirer-virement="retirerVirementPrevu" @frise="friseOuverte = true"></meteo-financiere>""", n=3)
sub('calcul de la frise',
"""                    //  🔒 Le Sanctuaire : exactement la liste et le total de l'Urgence.""",
"""                    /*  v37.66 — LA FRISE DU CYCLE, calculée à la demande (seulement la frise ouverte) :
                        l'axe (morceaux, jour J), chaque catégorie (engagé / budget, rythme attendu), chaque
                        poste de la semaine morceau par morceau (réel / prévu), chaque poste du cycle (son
                        enveloppe, ses séances), et les dépassements en tête. */
                    const friseOuverte = ref(false);
                    const friseCycle = computed(() => {
                        if (!friseOuverte.value) return null;
                        calculationTick.value;
                        const L = liberteCycle.value, mb = moisBudgetaire.value, d = donneesAnnuelles.value[consoT0Annee.value] || {};
                        const { debut, fin } = consoT0Fenetre.value, ms = morceauxEntre(debut, fin), J = ms.length ? ms[0].total : 1;
                        const nSem = semainesDuCycle(mb.mois, mb.an);
                        const lib = (dt) => dt.getDate() + ' ' + _MOIS_COURTS[dt.getMonth()];
                        const libIso = (iso) => lib(_decaler(iso, 0));
                        const auj = new Date(), a0 = new Date(auj.getFullYear(), auj.getMonth(), auj.getDate()), aujIso = _ymd(a0);
                        const aujJ = Math.max(0, Math.min(J, Math.round((a0 - debut) / 864e5) + 1));
                        const pos = (iso) => Math.round((_decaler(iso, 0) - debut) / 864e5) / J * 100;
                        const morceaux = ms.map(m => {
                            const iso = _ymd(m.debut), f = _ymd(m.fin);
                            return { debut: iso, fin: f, jours: m.jours, coupe: m.coupe, part: m.jours / J * 100,
                                     label: m.debut.getDate() + (m.jours > 1 ? '–' + m.fin.getDate() : '') + ' ' + _MOIS_COURTS[m.fin.getMonth()],
                                     titre: (m.jours > 1 ? 'Du ' + lib(m.debut) + ' au ' + lib(m.fin) : 'Le ' + lib(m.debut)) + ' · ' + m.jours + ' j' + (m.coupe ? ' (coupé par la paie)' : ''),
                                     etat: f < aujIso ? 'passe' : (iso > aujIso ? 'avenir' : 'encours'),
                                     vals: _valeursSemaine(iso), T: _lireTickets(iso, f), defs: defautsSemaine(iso), m };
                        });
                        const alertes = [];
                        const categories = (L.categories || []).map(c => {
                            const cv = (d.chargesVariables || {})[c.key] || {};
                            const budget = Math.round(budgetCategorieRevise(cv));
                            const prevus = morceaux.map(m => prevuHebdoLignes(c.key, cv, budget, nSem, m.m));
                            const cellule = (cle, catId, i) => {
                                const m = morceaux[i], g = m.T.parCle[c.key] || { total: 0, parPoste: {} };
                                const tape = Object.prototype.hasOwnProperty.call(m.vals, cle), sai = Number(m.vals[cle] || 0);
                                const tk = cle === c.key ? Number(g.total || 0) : (catId ? Number(g.parPoste[catId] || 0) : 0);
                                const prevu = Math.round(Number(prevus[i][cle] || 0)), defaut = Math.round(Number(m.defs[cle] || 0));
                                const auPrevu = !tape && tk <= 0 && defaut > 0;
                                const reel = Math.round(Math.max(sai, tk) + (auPrevu ? defaut : 0));
                                return { prevu, reel, auPrevu, etat: m.etat, avenir: m.etat === 'avenir' && !tape && tk <= 0, encours: m.etat === 'encours', depasse: reel > prevu + 0.5, part: m.part, titre: m.titre };
                            };
                            const lignes = [];
                            const hebdo = (c.prevu || []).filter(p => p.unite === 'semaine');
                            if (hebdo.length) hebdo.forEach(p => lignes.push({ cle: p.cle, nom: p.nom, emoji: p.emoji, unite: 'semaine', cellules: morceaux.map((m, i) => cellule(p.cle, p.categorieId, i)) }));
                            else if (!(c.prevu || []).length) lignes.push({ cle: c.key, nom: c.label, emoji: '', unite: 'semaine', cellules: morceaux.map((m, i) => cellule(c.key, null, i)) });
                            (L.postesCycle || []).filter(p => p.cat === c.key).forEach(p => {
                                const seances = [];
                                if (p.unite === 'quinzaine' && p.prevu > 0) {
                                    p.paiements.forEach(iso => seances.push({ pos: pos(iso), quand: libIso(iso), etat: 'paye' }));
                                    let iso = p.paiements.length ? _ymd(_decaler(p.paiements[p.paiements.length - 1], 14)) : null;
                                    for (let k = 0; iso && k < 3; k++, iso = _ymd(_decaler(iso, 14))) {
                                        const hors = iso > _ymd(fin);
                                        seances.push({ pos: hors ? 100 : pos(iso), quand: libIso(iso), etat: hors ? 'suivant' : 'prevue' });
                                        if (hors) break;
                                    }
                                } else p.paiements.forEach(iso => seances.push({ pos: pos(iso), quand: libIso(iso), etat: 'paye' }));
                                lignes.push({ cle: p.cle, nom: p.nom, emoji: p.emoji, unite: p.unite, enveloppe: p.cyclePrevu, engage: p.cycleEngage, depasse: p.exces > 0, fois: p.unite === 'quinzaine' ? p.fois : null,
                                              pct: p.cyclePrevu > 0 ? Math.min(100, Math.round(p.cycleEngage / p.cyclePrevu * 100)) : (p.cycleEngage > 0 ? 100 : 0), seances, alerte: p.alerte });
                                if (p.exces > 0) alertes.push('🔴 ' + p.nom + ' (' + c.label + ') : ' + Math.round(p.cycleEngage) + ' DH sur une enveloppe de ' + Math.round(p.cyclePrevu) + ' — dépassement de ' + Math.round(p.exces) + ' DH');
                                else if (p.alerte && p.alerte.niveau === 'depasse') alertes.push(p.alerte.texte.replace('⚠️ ', '⚠️ ' + p.nom + ' : '));
                            });
                            lignes.forEach(l => (l.cellules || []).forEach(x => { if (x.depasse && x.etat !== 'avenir' && !x.auPrevu) alertes.push('🟠 ' + l.nom + ' : ' + x.reel + ' DH pour ' + x.prevu + ' prévus (' + x.titre + ')'); }));
                            const engage = Math.round(c.engage || 0);
                            if (engage > c.budget) alertes.unshift('🔴 ' + c.label + ' : ' + engage + ' DH engagés pour un budget de ' + c.budget + ' DH — dépassement de ' + (engage - c.budget) + ' DH');
                            return { key: c.key, label: c.label, budget: c.budget, engage, estime: !c.declare && !L.declare,
                                     pct: c.budget > 0 ? Math.min(100, Math.round(engage / c.budget * 100)) : 0,
                                     pctAttendu: c.budget > 0 ? Math.min(100, Math.round((c.theorique || 0) / c.budget * 100)) : 0,
                                     depasse: engage > c.budget, lignes };
                        });
                        //  Une seule note pour les postes « toutes les 2 semaines » (au lieu d'une par poste)
                        const nQ = (L.postesCycle || []).filter(p => p.unite === 'quinzaine').length, fois = nSem / 2;
                        const quinzaine = !nQ ? null : '⏱️ ' + nQ + ' poste' + (nQ > 1 ? 's' : '') + ' « toutes les 2 semaines » : ce cycle de ' + J + ' jours en couvre ≈ ' + String(Math.round(fois * 10) / 10).replace('.', ',') + ' fois'
                            + (fois - Math.floor(fois + 1e-9) >= 0.05 ? ' — une ' + (Math.floor(fois + 1e-9) + 1) + 'ᵉ fois avant le ' + lib(fin) + ' dépasserait leur enveloppe ; après le ' + lib(fin) + ', elle compte au cycle suivant.' : '.');
                        return { du: lib(debut), au: lib(fin), jours: J, aujJ, aujPct: aujJ / J * 100, morceaux: morceaux.map(({ vals, T, defs, m, ...x }) => x), categories, alertes, quinzaine };
                    });
                    //  🔒 Le Sanctuaire : exactement la liste et le total de l'Urgence.""")
sub('exposition frise',
"""                        meteoFinanciere, revenusAilleurs, retirerVirementPrevu,""",
"""                        meteoFinanciere, revenusAilleurs, retirerVirementPrevu, friseOuverte, friseCycle, quinzaineDuPoste,""")
sub('gabarit de la frise',
"""        <!-- v17.31 : Modale Relevé de Compte -->""",
"""        <!-- 📈 v37.66 : LA FRISE DU CYCLE, à la demande — l'avancement de chaque catégorie et de chaque poste, morceau par morceau -->
        <div v-if="friseOuverte && friseCycle" data-frise class="fixed inset-0 bg-black/50 z-[10000] flex items-center justify-center p-2 md:p-4" @click.self="friseOuverte = false">
            <div class="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col">
                <div class="flex items-start justify-between gap-3 px-3 md:px-5 py-3 border-b border-slate-100">
                    <div class="min-w-0">
                        <p class="text-sm md:text-base font-black text-slate-800" data-frise-titre>📈 Frise du cycle · {{ friseCycle.du }} → {{ friseCycle.au }} ({{ friseCycle.jours }} j)</p>
                        <p class="text-[11px] font-semibold text-slate-500 leading-snug">Jour {{ friseCycle.aujJ }} sur {{ friseCycle.jours }}. Une colonne = un morceau de semaine (lundi → dimanche) ; ✂️ = coupé par la paie. Chaque case : réel / prévu.</p>
                    </div>
                    <button type="button" data-frise-fermer @click="friseOuverte = false" aria-label="Fermer la frise" class="shrink-0 w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black">✕</button>
                </div>
                <div class="overflow-y-auto px-2 md:px-5 py-3 space-y-3">
                    <div v-if="friseCycle.alertes.length" data-frise-alertes class="rounded-xl bg-rose-50 ring-1 ring-rose-200 px-3 py-2 space-y-0.5">
                        <p class="text-[10px] font-black uppercase tracking-widest text-rose-700">À surveiller</p>
                        <p v-for="(a, i) in friseCycle.alertes" :key="'fa' + i" data-frise-alerte class="text-[11px] md:text-xs font-bold text-rose-900 leading-snug">{{ a }}</p>
                    </div>
                    <p v-if="friseCycle.quinzaine" data-frise-quinzaine class="rounded-xl bg-amber-50 ring-1 ring-amber-200 px-3 py-2 text-[11px] md:text-xs font-bold text-amber-900 leading-snug">{{ friseCycle.quinzaine }}</p>
                    <p v-if="!friseCycle.alertes.length" data-frise-rien class="rounded-xl bg-emerald-50 ring-1 ring-emerald-200 px-3 py-2 text-[11px] md:text-xs font-bold text-emerald-800">✓ Aucun dépassement ce cycle.</p>
                    <div class="grid grid-cols-[6.5rem_minmax(0,1fr)] md:grid-cols-[11rem_minmax(0,1fr)] gap-x-2 gap-y-1 items-center">
                        <span></span>
                        <div class="relative flex h-8 rounded-lg overflow-hidden ring-1 ring-slate-200" data-frise-axe>
                            <div v-for="m in friseCycle.morceaux" :key="'fm' + m.debut" data-frise-morceau :data-debut="m.debut" :data-coupe="m.coupe ? '1' : null" :title="m.titre" :style="{ width: m.part + '%' }"
                                 :class="['flex items-center justify-center text-[9px] md:text-[10px] font-black border-r border-white leading-none text-center',
                                          m.coupe ? 'bg-amber-100 text-amber-900' : (m.etat === 'passe' ? 'bg-slate-200 text-slate-600' : (m.etat === 'encours' ? 'bg-sky-200 text-sky-900' : 'bg-slate-50 text-slate-500'))]">{{ m.coupe ? '✂️' : '' }}{{ m.label }}</div>
                            <span data-frise-auj class="absolute inset-y-0 w-0.5 bg-rose-500" :style="{ left: friseCycle.aujPct + '%' }" title="Aujourd’hui"></span>
                        </div>
                    </div>
                    <div v-for="c in friseCycle.categories" :key="'fc' + c.key" data-frise-categorie :data-cat="c.key" class="rounded-xl ring-1 ring-slate-200 p-2 md:p-2.5 space-y-1">
                        <div class="grid grid-cols-[6.5rem_minmax(0,1fr)] md:grid-cols-[11rem_minmax(0,1fr)] gap-x-2 items-center">
                            <p class="min-w-0"><span class="block truncate text-[12px] md:text-[13px] font-black text-slate-800">{{ c.label }}</span>
                               <span :class="['block text-[10px] font-bold tabular-nums', c.depasse ? 'text-rose-600' : 'text-slate-500']" data-frise-cat-total>{{ formatMAD(c.engage) }} / {{ formatMAD(c.budget) }}{{ c.estime ? ' (estimé)' : '' }}</span></p>
                            <div class="relative h-3 rounded-full bg-slate-100 overflow-hidden" :title="'Engagé ' + c.pct + ' % du budget ; rythme attendu à ce jour : ' + c.pctAttendu + ' %'">
                                <span :class="['absolute inset-y-0 left-0 rounded-full', c.depasse ? 'bg-rose-400' : 'bg-emerald-400']" :style="{ width: c.pct + '%' }"></span>
                                <span class="absolute inset-y-0 w-0.5 bg-slate-700" :style="{ left: c.pctAttendu + '%' }"></span>
                            </div>
                        </div>
                        <div v-for="l in c.lignes" :key="'fl' + l.cle" data-frise-ligne :data-poste="l.cle" :data-unite="l.unite" class="grid grid-cols-[6.5rem_minmax(0,1fr)] md:grid-cols-[11rem_minmax(0,1fr)] gap-x-2 items-center">
                            <p class="min-w-0 truncate text-[11px] font-semibold text-slate-600 pl-1">{{ l.emoji }} {{ l.nom }} <span class="text-slate-400">{{ l.unite === 'semaine' ? '/ sem' : (l.unite === 'quinzaine' ? '/ 15 j' : '/ cycle') }}</span></p>
                            <div v-if="l.cellules" class="flex rounded-md overflow-hidden ring-1 ring-slate-200">
                                <span v-for="(x, i) in l.cellules" :key="'fx' + i" data-frise-case :data-etat="x.depasse && !x.avenir ? 'depasse' : (x.avenir ? 'avenir' : (x.auPrevu ? 'auprevu' : (x.encours ? 'encours' : 'tenu')))" :style="{ width: x.part + '%' }" :title="x.titre + ' : ' + x.reel + ' / ' + x.prevu + ' DH' + (x.auPrevu ? ' (au prévu, rien tapé)' : '')"
                                      :class="['h-6 flex items-center justify-center text-[9px] md:text-[10px] font-bold tabular-nums border-r border-white leading-none',
                                               x.avenir ? 'bg-slate-50 text-slate-400' : (x.depasse ? 'bg-rose-200 text-rose-900' : (x.auPrevu ? 'bg-emerald-50 text-emerald-700 italic' : (x.encours ? 'bg-sky-100 text-sky-900' : 'bg-emerald-200 text-emerald-900')))]">{{ x.avenir ? x.prevu : x.reel + '/' + x.prevu }}</span>
                            </div>
                            <div v-else class="min-w-0">
                                <div class="relative h-6 rounded-md bg-slate-100 ring-1 ring-slate-200 overflow-hidden" :title="l.engage + ' / ' + l.enveloppe + ' DH sur le cycle'">
                                    <span :class="['absolute inset-y-0 left-0', l.depasse ? 'bg-rose-300' : 'bg-violet-200']" :style="{ width: l.pct + '%' }"></span>
                                    <span class="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-700 tabular-nums">{{ l.engage }} / {{ l.enveloppe }} DH sur le cycle{{ l.fois ? ' · ≈ ' + l.fois + '×' : '' }}</span>
                                    <span v-for="(s, k) in l.seances" :key="'fs' + k" data-frise-seance :data-etat="s.etat" :title="(s.etat === 'paye' ? 'Payé le ' : (s.etat === 'suivant' ? 'Prochaine ≈ ' + s.quand + ' : au cycle suivant' : 'Prochaine ≈ ')) + (s.etat === 'suivant' ? '' : s.quand)"
                                          :class="['absolute top-0.5 bottom-0.5 w-2 -ml-1 rounded-full ring-2', s.etat === 'paye' ? 'bg-violet-600 ring-white' : (s.etat === 'suivant' ? 'bg-white ring-amber-500' : 'bg-white ring-violet-500')]" :style="{ left: Math.min(99, s.pos) + '%' }"></span>
                                </div>
                                <p v-if="l.alerte && l.alerte.niveau !== 'info'" data-frise-alerte-ligne :class="['mt-0.5 text-[10px] font-bold leading-snug', l.alerte.niveau === 'depasse' ? 'text-rose-600' : (l.alerte.niveau === 'info' ? 'text-amber-700' : 'text-slate-500')]">{{ l.alerte.texte }}</p>
                            </div>
                        </div>
                    </div>
                    <p class="text-[10px] font-semibold text-slate-500 leading-relaxed" data-frise-legende>
                        <span class="inline-block w-3 h-3 align-middle rounded bg-emerald-200"></span> tenu ·
                        <span class="inline-block w-3 h-3 align-middle rounded bg-sky-100"></span> en cours ·
                        <span class="inline-block w-3 h-3 align-middle rounded bg-emerald-50 ring-1 ring-emerald-200"></span> au prévu (rien tapé, morceau écoulé) ·
                        <span class="inline-block w-3 h-3 align-middle rounded bg-rose-200"></span> dépassé ·
                        <span class="inline-block w-3 h-3 align-middle rounded bg-slate-50 ring-1 ring-slate-200"></span> à venir (prévu) ·
                        <span class="inline-block w-3 h-3 align-middle rounded bg-amber-100"></span> ✂️ coupé par la paie ·
                        <span class="inline-block w-2 h-2 align-middle rounded-full bg-violet-600"></span> séance payée ·
                        <span class="inline-block w-2 h-2 align-middle rounded-full ring-2 ring-violet-500"></span> prochaine ·
                        <span class="inline-block w-2 h-2 align-middle rounded-full ring-2 ring-amber-500"></span> au cycle suivant ·
                        trait noir : le rythme attendu à ce jour.
                    </p>
                </div>
            </div>
        </div>

        <!-- v17.31 : Modale Relevé de Compte -->""")

io.open(F, 'w', encoding='utf-8').write(src)
print('✔ v37.66 Frise : la frise du cycle à la demande, et les postes à la quinzaine qui débordent')
