#!/usr/bin/env python3
"""v37.82 — LES DEUX GRAPHIQUES DU BILAN, SÉLECTIONNABLES.

« Je veux ce graphique sélectionnable par compte, le même graphique pour les charges, sélectionnable par type
  de charges. »

  1. « Trajectoire de vos comptes » : des pastilles — « Vue d'ensemble » (tous les comptes + le Courant, comme
     avant) puis un compte par pastille, à cocher : une courbe par compte, le solde en fin de mois, et le point bas
     de la sélection (le compte, le jour, la ligne qui le crée). Mémorisé.
  2. « L'année mois par mois » : des pastilles par type de charges (crédits, fixes, factures, conso, ponctuelles,
     épargne) : on coche, le graphique ne garde que ça ; UN seul type coché : il se détaille ligne par ligne
     (chaque charge de ce type, mois par mois). Mémorisé.
"""
import io, sys
F = 'index.html'
src = io.open(F, encoding='utf-8').read()
def sub(label, old, new):
    global src
    c = src.count(old)
    if c != 1:
        print(f'✖ {label} : {c} ancre(s), 1 attendue'); sys.exit(1)
    src = src.replace(old, new)

# ── 1. La trajectoire par compte : les données ──────────────────────────────────
sub('trajectoire : points bas par compte',
"""                        const solde = {}, fins = [];
                        let ci = 0, bas = null, decouvert = null;""",
"""                        const solde = {}, fins = [], basParCompte = {};   // v37.82 : le point bas de CHAQUE compte
                        let ci = 0, bas = null, decouvert = null;""")
sub('trajectoire : initial par compte',
"""                                if (!(k in solde)) solde[k] = Number(e.montant) || 0;
                                if (k === ck && !bas) bas = { montant: solde[k], date: 'aujourd’hui' };""",
"""                                if (!(k in solde)) solde[k] = Number(e.montant) || 0;
                                if (!basParCompte[k]) basParCompte[k] = { montant: solde[k], date: 'aujourd’hui' };
                                if (k === ck && !bas) bas = { montant: solde[k], date: 'aujourd’hui' };""")
sub('trajectoire : ligne par compte',
"""                            solde[k] = Number(e.soldeCompteApres) || 0;
                            if (k === ck) {""",
"""                            solde[k] = Number(e.soldeCompteApres) || 0;
                            if (!basParCompte[k] || solde[k] < basParCompte[k].montant) basParCompte[k] = { montant: solde[k], date: dateDe(e.jourPrevu, e.cycle), libelle: e.libelle };
                            if (k === ck) {""")
sub('trajectoire : comptes et séries',
"""                        const points = cycles.map((c, i) => {
                            const [m, a] = c.split('-').map(Number), f = fins[i] || {};
                            return { cycle: c, label: _MOIS_BILAN[m] + ' ' + String(a).slice(-2),
                                     courant: Math.round(Number(f[ck]) || 0),""",
"""                        const points = cycles.map((c, i) => {
                            const [m, a] = c.split('-').map(Number), f = fins[i] || {};
                            return { cycle: c, label: _MOIS_BILAN[m] + ' ' + String(a).slice(-2),
                                     parCompte: Object.fromEntries(Object.keys(f).map(k => [k, Math.round(Number(f[k]) || 0)])),
                                     courant: Math.round(Number(f[ck]) || 0),""")
sub('trajectoire : retour',
"""                        return { points, courantKey: ck, pointBas: bas ? { ...bas, montant: Math.round(bas.montant) } : null,""",
"""                        //  v37.82 : les comptes à cocher — réels (pas une poche d'épargne liée), le Courant d'abord
                        const comptes = Object.keys(basParCompte).filter(k => !lies.has(k) && (k === ck || k.startsWith('cpt_')))
                            .map(k => ({ ...infoCompte(k), courant: k === ck, bas: { ...basParCompte[k], montant: Math.round(basParCompte[k].montant) } }))
                            .sort((x, y) => (y.courant - x.courant) || String(x.label).localeCompare(String(y.label)));
                        return { points, comptes, courantKey: ck, pointBas: bas ? { ...bas, montant: Math.round(bas.montant) } : null,""")

# ── 1b. Le graphique et ses pastilles ───────────────────────────────────────────
sub('trajectoire : graphique',
"""                    const bilanTrajectoireChart = computed(() => {
                        const T = bilanTrajectoire.value;
                        if (!T) return null;
                        return {""",
"""                    //  v37.82 : les comptes cochés (vide = la vue d'ensemble d'avant) — mémorisés
                    const bilanComptesSel = refUI('bilan.comptesSel', []);
                    const basculerCompteBilan = (k) => { const i = bilanComptesSel.value.indexOf(k); if (i >= 0) bilanComptesSel.value.splice(i, 1); else bilanComptesSel.value.push(k); };
                    const _COULEURS_COMPTES = ['#4f46e5', '#f59e0b', '#14b8a6', '#ec4899', '#84cc16', '#06b6d4', '#c026d3', '#eab308'];
                    const bilanComptesCoches = computed(() => {
                        const T = bilanTrajectoire.value;
                        if (!T) return [];
                        return bilanComptesSel.value.map(k => T.comptes.find(c => c.key === k)).filter(Boolean);
                    });
                    const bilanPointBasSel = computed(() => {
                        const T = bilanTrajectoire.value, C = bilanComptesCoches.value;
                        if (!T) return null;
                        if (!C.length) return T.pointBas ? { ...T.pointBas, nom: 'du compte courant' } : null;
                        const p = C.reduce((m, c) => (!m || c.bas.montant < m.bas.montant ? c : m), null);
                        return { montant: p.bas.montant, date: p.bas.date, libelle: p.bas.libelle, nom: (C.length > 1 ? 'des ' + C.length + ' comptes cochés — ' : 'de ') + p.label };
                    });
                    const bilanTrajectoireChart = computed(() => {
                        const T = bilanTrajectoire.value;
                        if (!T) return null;
                        const C = bilanComptesCoches.value;
                        if (C.length) return { type: 'line', data: { labels: T.points.map(p => p.label), datasets: C.map((c, i) => {
                                const col = _COULEURS_COMPTES[T.comptes.findIndex(x => x.key === c.key) % _COULEURS_COMPTES.length];
                                return { label: c.label, data: T.points.map(p => p.parCompte[c.key] || 0), borderColor: col, backgroundColor: col, tension: 0.3, pointRadius: 3,
                                         segment: { borderColor: (x) => (x.p1.parsed.y < 0 ? '#e11d48' : col) } }; }) },
                            options: { responsive: true, maintainAspectRatio: false, animation: false,
                                plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: (c) => c.dataset.label + ' : ' + formatMAD(c.parsed.y) } } },
                                scales: { y: { ticks: { callback: _axeDH }, grid: { color: (c) => (c.tick && c.tick.value === 0 ? '#334155' : '#e5e7eb') } } } } };
                        return {""")
sub('trajectoire : pastilles et point bas',
"""                            <div v-if="bilanTrajectoire.pointBas" class="text-right">
                                <p class="text-[11px] font-black uppercase tracking-widest text-gray-500">Point bas du compte courant</p>
                                <p data-bilan-point-bas :class="['text-xl font-black tabular-nums', bilanTrajectoire.pointBas.montant < 0 ? 'text-rose-700' : 'text-gray-900']">{{ formatMAD(bilanTrajectoire.pointBas.montant) }}</p>
                                <p class="text-xs text-gray-500">{{ bilanTrajectoire.pointBas.date }}</p>
                            </div>
                        </div>""",
"""                            <div v-if="bilanPointBasSel" class="text-right">
                                <p class="text-[11px] font-black uppercase tracking-widest text-gray-500" data-bilan-point-bas-nom>Point bas {{ bilanPointBasSel.nom }}</p>
                                <p data-bilan-point-bas :class="['text-xl font-black tabular-nums', bilanPointBasSel.montant < 0 ? 'text-rose-700' : 'text-gray-900']">{{ formatMAD(bilanPointBasSel.montant) }}</p>
                                <p class="text-xs text-gray-500">{{ bilanPointBasSel.date }}</p>
                            </div>
                        </div>
                        <!-- v37.82 : un compte par pastille — on coche, le graphique suit -->
                        <div data-bilan-comptes-choix class="mt-3 flex flex-wrap items-center gap-1.5">
                            <button type="button" data-bilan-compte-tous @click="bilanComptesSel.splice(0)"
                                    :class="['text-[11px] font-black px-2.5 py-1 rounded-full border transition-colors', !bilanComptesSel.length ? 'bg-slate-900 text-white border-slate-900' : 'border-gray-300 text-gray-600 hover:border-gray-500']">Vue d’ensemble</button>
                            <button v-for="c in bilanTrajectoire.comptes" :key="'bt_' + c.key" type="button" data-bilan-compte-choix :data-compte="c.key" @click="basculerCompteBilan(c.key)"
                                    :aria-pressed="bilanComptesSel.includes(c.key) ? 'true' : 'false'"
                                    :class="['text-[11px] font-black px-2.5 py-1 rounded-full border transition-colors', bilanComptesSel.includes(c.key) ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-600 hover:border-indigo-400']">{{ c.icone }} {{ c.label }}</button>
                        </div>""")
sub('trajectoire : légende de fin',
"""                        <p data-bilan-fin class="text-xs text-gray-600 mt-3">""",
"""                        <p v-if="bilanComptesCoches.length" data-bilan-fin-sel class="text-xs text-gray-600 mt-3">Fin {{ bilanTrajectoire.fin.label }} : <template v-for="(c, i) in bilanComptesCoches" :key="'bf_' + c.key"><span v-if="i"> · </span>{{ c.label }} <span class="font-black tabular-nums" :class="(bilanTrajectoire.fin.parCompte[c.key] || 0) < 0 ? 'text-rose-700' : 'text-gray-900'">{{ formatMAD(bilanTrajectoire.fin.parCompte[c.key] || 0) }}</span></template>
                            <button type="button" @click="ouvrirReleve(bilanComptesCoches.length === 1 ? bilanComptesCoches[0].key : undefined)" class="ml-1 text-blue-700 font-bold hover:underline">Voir le Relevé →</button></p>
                        <p v-else data-bilan-fin class="text-xs text-gray-600 mt-3">""")

# ── 2. L'année par type de charges ──────────────────────────────────────────────
sub('année : détail mois par ligne',
"""                        const cumul = {};                       // poste → nom → total annuel
                        const ajoute = (poste, nom, v) => { const p = cumul[poste] || (cumul[poste] = {}); p[nom] = (p[nom] || 0) + v; };""",
"""                        const cumul = {};                       // poste → nom → total annuel
                        const parMois = {};                     // v37.82 : poste → nom → les 12 mois (le détail d'un type coché)
                        let moisEnCours = 1;
                        const ajoute = (poste, nom, v) => {
                            const p = cumul[poste] || (cumul[poste] = {}); p[nom] = (p[nom] || 0) + v;
                            const q = parMois[poste] || (parMois[poste] = {}), t = q[nom] || (q[nom] = Array(12).fill(0)); t[moisEnCours - 1] += v;
                        };""")
sub('année : mois en cours', """                            const m = i + 1, r = respirationDuMois(an, m);""", """                            const m = i + 1, r = respirationDuMois(an, m); moisEnCours = m;""")
sub('année : exposé',
"""                        return { an, mois, postes, deficitaires, texteDeficit,""",
"""                        return { an, mois, postes, deficitaires, texteDeficit, parMois,""")
sub('année : graphique',
"""                    const bilanMoisChart = computed(() => {
                        const A = bilanAnnee.value;
                        if (!A) return null;
                        const ordre = ['credits', 'fixes', 'mensuelles', 'conso', 'exceptionnel', 'epargne'];
                        return {""",
"""                    //  v37.82 : les types de charges cochés (vide = tous) ; UN seul coché : détaillé ligne par ligne — mémorisés
                    const bilanTypesSel = refUI('bilan.typesSel', []);
                    const basculerTypeBilan = (k) => { const i = bilanTypesSel.value.indexOf(k); if (i >= 0) bilanTypesSel.value.splice(i, 1); else bilanTypesSel.value.push(k); };
                    const bilanTypesChoix = computed(() => POSTES_BILAN.filter(p => !bilanAnnee.value || (bilanAnnee.value.moy[p.cle] || 0) > 0 || bilanAnnee.value.mois.some(x => x[p.cle] > 0)));
                    const _TEINTES_LIGNES = ['#f97316', '#0ea5e9', '#14b8a6', '#f43f5e', '#8b5cf6', '#eab308', '#84cc16', '#ec4899', '#06b6d4'];
                    const bilanMoisChart = computed(() => {
                        const A = bilanAnnee.value;
                        if (!A) return null;
                        const sel = bilanTypesSel.value.filter(k => POSTES_BILAN.some(p => p.cle === k));
                        if (sel.length === 1) {
                            const lignes = Object.entries((A.parMois || {})[sel[0]] || {}).map(([nom, t]) => ({ nom, t, tot: t.reduce((s, x) => s + x, 0) })).filter(l => l.tot > 0).sort((a, b) => b.tot - a.tot);
                            const tete = lignes.slice(0, 8), reste = lignes.slice(8);
                            const jeux = tete.map((l, i) => ({ label: l.nom, data: l.t.map(x => Math.round(x)), backgroundColor: _TEINTES_LIGNES[i % _TEINTES_LIGNES.length], stack: 'sorties', order: 1 }));
                            if (reste.length) jeux.push({ label: 'Autres (' + reste.length + ')', data: A.mois.map((_, i) => Math.round(reste.reduce((s, l) => s + l.t[i], 0))), backgroundColor: '#9ca3af', stack: 'sorties', order: 1 });
                            return { type: 'bar', data: { labels: A.mois.map(x => x.nom), datasets: jeux },
                                options: { responsive: true, maintainAspectRatio: false, animation: false,
                                    plugins: { legend: { position: 'bottom', labels: { boxWidth: 10 } }, tooltip: { mode: 'index', intersect: false, callbacks: { label: (c) => c.dataset.label + ' : ' + formatMAD(c.parsed.y) } } },
                                    scales: { x: { stacked: true }, y: { stacked: true, ticks: { callback: _axeDH } } } } };
                        }
                        const ordre = ['credits', 'fixes', 'mensuelles', 'conso', 'exceptionnel', 'epargne'].filter(k => !sel.length || sel.includes(k));
                        return {""")
sub('année : ressources seulement sans sélection',
"""                                { type: 'line', label: 'Ressources', data: A.mois.map(x => x.ressources), borderColor: '#15803d', backgroundColor: '#15803d', borderWidth: 3, pointRadius: 4, stack: 'ressources', order: 0 },
                                ...ordre.map(""",
"""                                ...(sel.length ? [] : [{ type: 'line', label: 'Ressources', data: A.mois.map(x => x.ressources), borderColor: '#15803d', backgroundColor: '#15803d', borderWidth: 3, pointRadius: 4, stack: 'ressources', order: 0 }]),
                                ...ordre.map(""")
sub('année : pastilles',
"""                            <p class="text-xs text-gray-500 mt-0.5">Les ressources (ligne verte) face aux sorties, poste par poste.</p>""",
"""                            <p class="text-xs text-gray-500 mt-0.5">Les ressources (ligne verte) face aux sorties, poste par poste. Cochez un ou plusieurs types ; un seul : il se détaille ligne par ligne.</p>
                            <!-- v37.82 : un type de charges par pastille -->
                            <div data-bilan-types-choix class="mt-2 flex flex-wrap items-center gap-1.5">
                                <button type="button" data-bilan-type-tous @click="bilanTypesSel.splice(0)"
                                        :class="['text-[11px] font-black px-2.5 py-1 rounded-full border transition-colors', !bilanTypesSel.length ? 'bg-slate-900 text-white border-slate-900' : 'border-gray-300 text-gray-600 hover:border-gray-500']">Tous</button>
                                <button v-for="p in bilanTypesChoix" :key="'bty_' + p.cle" type="button" data-bilan-type-choix :data-type="p.cle" @click="basculerTypeBilan(p.cle)"
                                        :aria-pressed="bilanTypesSel.includes(p.cle) ? 'true' : 'false'"
                                        :class="['text-[11px] font-black px-2.5 py-1 rounded-full border transition-colors', bilanTypesSel.includes(p.cle) ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-600 hover:border-indigo-400']">{{ p.icone }} {{ p.label }}</button>
                            </div>""")
sub('exposition',
"""bilanAnnee, bilanTrajectoire, bilanSignaux, bilanVerdict, bilanTrajectoireChart, bilanMoisChart,""",
"""bilanAnnee, bilanTrajectoire, bilanSignaux, bilanVerdict, bilanTrajectoireChart, bilanMoisChart,
                        bilanComptesSel, basculerCompteBilan, bilanComptesCoches, bilanPointBasSel, bilanTypesSel, basculerTypeBilan, bilanTypesChoix,""")
io.open(F, 'w', encoding='utf-8').write(src)
print('✔ v37.82 : trajectoire par compte, année par type de charges')
