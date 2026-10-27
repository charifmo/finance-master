# -*- coding: utf-8 -*-
"""
v37.66 — LA CARTE DE LA SEMAINE, CLAIRE : CE QUI EST À TAPER, ET JUSQU'À QUAND.

« Je ne comprends pas cette dispatch de semaine tronquée entre 2 cycles, ce n'est pas clair du tout :
j'ai eu la paie aujourd'hui, donc ça doit commencer aujourd'hui. Et comment tu fais pour le psy, qui est
sur 2 semaines, ou ceux d'un cycle entier ? » — « Pourquoi il y a déjà de l'info rentrée sur ce cycle
alors qu'il vient de commencer ? (sûrement des infos rentrées hier et avant, donc le cycle d'avant) »
  • Les saisies faites AVANT la paie retournent au cycle qui finit (schéma 21). La v37.65 avait re-rangé
    l'ancienne clé du lundi sous le jour de paie (mardi, mercredi ou jeudi) : c'était faux, ces saisies
    dataient d'avant la paie. Elles reviennent au lundi — le dernier morceau du cycle précédent. Sans
    schéma 20 : rien ne bouge (la clé du lundi désigne déjà les jours d'avant la paie).
  • Le titre dit ce qu'on voit : « Début du cycle · mar. 27 oct. → dim. 1 nov. · 6 j », « Semaine du 2 au
    8 nov. », « Fin du cycle · lun. 23 → jeu. 26 nov. · 4 j », « Cycle précédent · lun. 26 oct. ». La note
    « semaine coupée par la paie » qui embrouillait disparaît.
  • 📅 SUR TOUT LE CYCLE : les postes à la quinzaine (Psy) et au cycle (Hri, barber) quittent les lignes
    de la semaine pour un bloc à eux — « 400 DH toutes les 2 semaines (≈ 2,2 fois ce cycle) · 0 / 886 ce
    cycle · reste 886 ». On les tape quand ça arrive ; ils ne se « remettent pas à zéro » chaque semaine.
  • Chaque catégorie, dans la semaine, ne parle plus que de la semaine (son prévu, son reste) ; un rappel
    « + 886 DH sur le cycle (Hri · Psy) ↓ » renvoie au bloc.
"""
import io, sys
F = 'index.html'
src = io.open(F, encoding='utf-8').read()
def sub(label, a, b, n=1):
    global src
    if src.count(a) != n: print('✖', label, ':', src.count(a), 'ancre(s),', n, 'attendue(s)'); sys.exit(1)
    src = src.replace(a, b)

# ── 1. Schéma 21 : les saisies d'avant la paie rendues au cycle qui finit ────────────────────────────────
a = src.index("                    // ── v37.65 : LES SEMAINES COUPÉES PAR LA PAIE (schéma 20) ──────────")
b = src.index("                    // ── Patch v15.1 : corrige soldeInitial→solde + inclureLiquidite ──")
src = src[:a] + """                    // ── v37.66 : LES SAISIES D'AVANT LA PAIE, DANS LE CYCLE QUI FINIT (schéma 21) ──
                    //  Une saisie de semaine est rangée sous 'S' + le premier jour de son morceau ; la
                    //  clé du lundi d'une semaine coupée par la paie désigne les jours d'AVANT la paie.
                    //  La v37.65 (schéma 20) avait re-rangé ces clés sous le jour de paie (mardi,
                    //  mercredi ou jeudi), dans le cycle suivant — or elles étaient tapées avant la
                    //  paie (« des infos rentrées hier et avant »). Elles reviennent au lundi, si
                    //  rien n'y est déjà. Données d'avant le schéma 20 : rien ne bouge.
                    const migrerSemainesCoupees = (data) => {
                        if (!data || (data._schemaVersion || 0) !== 20) return 0;
                        const jdp = Number((data.soldesInitiaux || {}).jourDePaie) || 27;
                        const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
                        const estPaie = (d) => [0, -1].some(k => new Date(d.getFullYear(), d.getMonth() + k, jdp).getTime() === d.getTime());
                        let n = 0;
                        Object.values(data.donneesAnnuelles || {}).forEach(a => ['consoRealiseeT0', 'consoClotureT0'].forEach(champ => {
                            const r = a && a[champ];
                            if (!r || typeof r !== 'object') return;
                            Object.keys(r).forEach(k => {
                                const m = /^S(\\d{4})-(\\d{2})-(\\d{2})$/.exec(k);
                                if (!m || !r[k] || typeof r[k] !== 'object') return;
                                const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
                                if (d.getDay() < 2 || d.getDay() > 4 || !estPaie(d)) return;
                                const lk = 'S' + ymd(new Date(d.getFullYear(), d.getMonth(), d.getDate() - (d.getDay() - 1)));
                                if (r[lk]) return;
                                r[lk] = r[k]; delete r[k]; n++;
                            });
                        }));
                        return n;
                    };

""" + src[b:]
sub('migration appel',
"""                            const _nSemCoupees = migrerSemainesCoupees(data);   // v37.65 : schéma 20
                            if (_nSemCoupees) addLog('✅ Semaines coupées par la paie : ' + _nSemCoupees + ' saisie(s) re-rangée(s) sous le jour de paie, dans leur cycle.', 'success');""",
"""                            const _nSemCoupees = migrerSemainesCoupees(data);   // v37.66 : schéma 21
                            if (_nSemCoupees) addLog('✅ Semaines coupées par la paie : ' + _nSemCoupees + ' saisie(s) d\\'avant la paie rendue(s) au cycle qui finit.', 'success');""")
sub('schéma 21', "const getExportData = () => ({ version: CURRENT_VERSION, _schemaVersion: 20,", "const getExportData = () => ({ version: CURRENT_VERSION, _schemaVersion: 21,")

# ── 2. La semaine SEULE, pour chaque catégorie ; les postes du cycle à part ─────────────────────────────
sub('semaine seule',
"""                                postes: postesSem, nb: gS.tx.length,
                                //  Les saisies de CYCLE d'avant la saisie hebdomadaire, toujours comptées""",
"""                                postes: postesSem, nb: gS.tx.length,
                                //  v37.66 : la SEMAINE seule (lignes « / sem », « Autre », catégorie sans ligne) —
                                //  les postes à la quinzaine et au cycle ont leur bloc, « Sur tout le cycle »
                                hebdo: (() => {
                                    const engCycle = postesSem.filter(p => p.unite !== 'semaine').reduce((s, p) => s + Math.max(p.saisi, p.tickets), 0);
                                    const e = declS ? Math.max(0, engS - engCycle) : 0;
                                    return { budget: prevuSemaine, engage: e, reste: prevuSemaine - e - ecoS,
                                             pct: prevuSemaine > 0 ? Math.min(100, Math.round(e / prevuSemaine * 100)) : (e > 0 ? 100 : 0) };
                                })(),
                                //  Les saisies de CYCLE d'avant la saisie hebdomadaire, toujours comptées""")
sub('postes du cycle',
"""                            categories,
""",
"""                            categories,
                            //  v37.66 : les postes du CYCLE (/ 15 j, / cycle), toutes catégories — une enveloppe chacun
                            postesCycle: categories.flatMap(c => c.sem.postes.filter(p => p.unite !== 'semaine')
                                .map(p => ({ ...p, cat: c.key, catLabel: c.label, fois: p.unite === 'quinzaine' ? String(Math.round(nSem / 2 * 10) / 10).replace('.', ',') : '1',
                                             resteCycle: Math.max(0, p.cyclePrevu - p.cycleEngage) }))),
                            cycleDu: (() => { const t = consoT0Fenetre.value.debut; return t.getDate() + ' ' + _MOIS_COURTS[t.getMonth()]; })(),
                            cycleAu: (() => { const t = consoT0Fenetre.value.fin; return t.getDate() + ' ' + _MOIS_COURTS[t.getMonth()]; })(),
""")
sub('titre du morceau',
"""                                         //  v37.65 : la clôture du morceau — le dimanche soir, ou la veille de la paie""",
"""                                         //  v37.66 : le titre dit ce qu'on voit — début / fin du cycle, cycle précédent / suivant
                                         titre: (() => {
                                             const jr = (iso) => ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'][_decaler(iso, 0).getDay()] + ' ' + lib(iso);
                                             const plage = mSel.jours === 1 ? jr(debutSel) : jr(debutSel) + ' → ' + jr(finSel);
                                             if (!dans) return (debutSel < _ymd(debut) ? 'Cycle précédent · ' : 'Cycle suivant · ') + plage;
                                             if (mSel.coupe && mSel.rang === 1) return 'Début du cycle · ' + plage;
                                             if (mSel.coupe && mSel.rang === mSel.nb) return 'Fin du cycle · ' + plage;
                                             return 'Semaine du ' + lib(debutSel) + ' au ' + lib(finSel);
                                         })(),
                                         //  v37.65 : la clôture du morceau — le dimanche soir, ou la veille de la paie""")

# ── 3. Le gabarit ─────────────────────────────────────────────────────────────────────────────────────
sub('titre',
"""data-semaine-titre>{{ sm.jours === 1 ? 'Le ' + sm.du : 'Semaine du ' + sm.du + ' au ' + sm.au }} <button v-if="sm.coupe" type="button" data-semaine-coupe-badge @click="noteCoupe = !noteCoupe" :aria-expanded="noteCoupe ? 'true' : 'false'"
                                :title="'Semaine coupée par la paie : seulement ' + sm.jours + ' jour(s) dans ce cycle, prévu au prorata (' + sm.jours + '/7)'"
                                class="ml-1 normal-case tracking-normal font-bold text-amber-200 rounded-full ring-1 ring-amber-200/50 px-1.5 hover:bg-amber-200/10">✂️ {{ sm.jours }} j</button></p>""",
"""data-semaine-titre>{{ sm.titre }}<span v-if="sm.coupe" data-semaine-coupe-badge :title="'La paie coupe cette semaine : ' + sm.jours + ' jour(s) ici, prévu au prorata (' + sm.jours + '/7)'"
                                class="normal-case tracking-normal font-bold text-amber-200"> · {{ sm.jours }} j</span></p>""")
a = src.index("""                <!-- v37.65 : une semaine coupée par la paie se saisit en deux morceaux, chacun dans son cycle —""")
b = src.index("""                <p v-if="!sm.dansCycle" data-semaine-hors""")
src = src[:a] + src[b:]
sub('état de la note', "caseActive: null, noteCoupe: false }; },", "caseActive: null }; },")
sub('anneau semaine', "anneauSem(c) { return c.sem.pct; },", "anneauSem(c) { return (c.sem.hebdo || c.sem).pct; },")
sub('ligne : la semaine seule',
"""                                    <span data-pulse-prevu>Prévu : {{ chiffre(c.sem.prevuSemaine) }} DH</span>
                                    <template v-if="c.sem.declare"> · <template v-if="c.sem.reste >= 0">reste <span class="font-black text-white/90">{{ chiffre(c.sem.reste) }}</span></template><span v-else class="font-black text-rose-200">dépassé de {{ chiffre(-c.sem.reste) }}</span></template>""",
"""                                    <span data-pulse-prevu>Prévu : {{ chiffre(c.sem.prevuSemaine) }} DH</span>
                                    <template v-if="c.sem.declare"> · <template v-if="c.sem.hebdo.reste >= 0">reste <span class="font-black text-white/90">{{ chiffre(c.sem.hebdo.reste) }}</span></template><span v-else class="font-black text-rose-200">dépassé de {{ chiffre(-c.sem.hebdo.reste) }}</span></template>""")
sub('rappel du cycle',
"""{{ '+ ' + chiffre(c.sem.prevuCycle) + ' DH / cycle (' + c.sem.postes.filter(p => p.unite !== 'semaine').map(p => p.nom).join(' · ') + ')' }}</span>""",
"""{{ '+ ' + chiffre(c.sem.prevuCycle) + ' DH sur le cycle (' + c.sem.postes.filter(p => p.unite !== 'semaine').map(p => p.nom).join(' · ') + ') ↓' }}</span>""")
sub('total de la ligne', """<span class="text-[13px] md:text-sm font-black tabular-nums text-white" data-pulse-total>{{ chiffre(c.sem.engage) }}</span>""",
    """<span class="text-[13px] md:text-sm font-black tabular-nums text-white" data-pulse-total>{{ chiffre(c.sem.hebdo.engage) }}</span>""")
sub('postes de la semaine seulement',
"""                        <div v-for="d in c.sem.postes" :key="'po_' + d.cle" data-pulse-poste :data-poste="d.cle\"""",
"""                        <div v-for="d in c.sem.postes.filter(x => x.unite === 'semaine')" :key="'po_' + d.cle" data-pulse-poste :data-poste="d.cle\"""")
sub('bloc du cycle',
"""                <button v-if="p.horsBudget > 0" type="button" data-rx-ancre data-pulse-hors""",
"""                <!-- 📅 v37.66 : les postes du CYCLE (/ 15 j, / cycle) — une enveloppe pour tout le cycle, tapée quand ça arrive -->
                <details v-if="p.postesCycle && p.postesCycle.length && sm.dansCycle" data-pulse-cycle :open="uiOuvert('meteo.cycle', false)" @toggle="uiFixer('meteo.cycle', $event.target.open)" class="mt-3 rounded-xl bg-black/15 ring-1 ring-white/15 p-2 md:p-2.5">
                    <summary data-pulse-cycle-resume class="cursor-pointer px-1.5 text-[10px] md:text-[11px] font-black uppercase tracking-[0.14em] text-white/85">📅 Sur tout le cycle <span class="normal-case tracking-normal font-semibold text-white/60">· {{ p.postesCycle.length }} poste{{ p.postesCycle.length > 1 ? 's' : '' }} à la quinzaine ou au cycle · {{ chiffre(p.postesCycle.reduce((s, d) => s + d.cycleEngage, 0)) }} / {{ chiffre(p.postesCycle.reduce((s, d) => s + d.cyclePrevu, 0)) }} DH</span></summary>
                    <p class="px-1.5 mt-1 text-[10px] font-semibold text-white/60 leading-snug">{{ p.cycleDu }} → {{ p.cycleAu }} : une enveloppe pour tout le cycle — tapez le montant la semaine où c'est payé.</p>
                    <div v-for="d in p.postesCycle" :key="'pcy_' + d.cle" data-pulse-poste data-pulse-poste-cycle :data-poste="d.cle" :data-cat="d.cat" class="mt-1 flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-white/[0.06] transition-colors">
                        <span aria-hidden="true" class="shrink-0 w-5 text-center text-base leading-none">{{ d.emoji }}</span>
                        <span class="min-w-0 flex-1">
                            <span class="block truncate text-[12px] md:text-[13px] font-bold text-white leading-tight">{{ d.nom }} <span class="font-semibold text-white/45">· {{ d.catLabel }}</span></span>
                            <span class="block truncate text-[10px] font-semibold text-white/55 tabular-nums leading-tight" data-pulse-prevu :data-unite="d.unite">{{ chiffre(d.prevu) }} DH {{ d.unite === 'quinzaine' ? '/ 15 j (≈ ' + d.fois + '×)' : '/ cycle' }} · <span class="text-white/80" data-pulse-cycle-engage>{{ chiffre(d.cycleEngage) }} / {{ chiffre(d.cyclePrevu) }}</span><template v-if="d.exces > 0"> · <span class="font-black text-rose-200" data-pulse-poste-depasse>dépassement +{{ chiffre(d.exces) }}</span></template><template v-else-if="d.clos"> · <span class="font-black text-white/85" data-pulse-poste-clos>🔒 {{ d.eco > 0 ? chiffre(d.eco) + ' libérés' : 'clôturé' }}</span></template><template v-else> · reste {{ chiffre(d.resteCycle) }}</template></span>
                            <span class="block h-[3px] mt-1 rounded-full bg-black/25 overflow-hidden"><span :class="['block h-full rounded-full transition-all duration-300', d.depasse ? 'bg-rose-300' : 'bg-white/75']" :style="{ width: d.pct + '%' }"></span></span>
                        </span>
                        <label class="shrink-0 flex items-center gap-1 rounded-lg ring-1 px-2 py-1 bg-black/30 ring-white/35 hover:ring-white/70 focus-within:ring-2 focus-within:ring-white focus-within:bg-black/45 cursor-text transition-colors shadow-inner"
                               :title="'Payé cette semaine pour ' + d.nom + ' (déjà ' + chiffre(d.cycleEngage) + ' DH ce cycle)'">
                            <span class="sr-only">Payé cette semaine pour {{ d.nom }}</span>
                            <input :key="'ic_' + d.cle + sm.debut" type="text" inputmode="decimal" autocomplete="off" data-saisie data-pulse-poste-saisie :data-poste="d.cle" :data-cat="d.cat"
                                   :value="d.declare ? d.saisi : ''" placeholder="0"
                                   @input="saisirPoste(d, $event, false)" @change="saisirPoste(d, $event, true)" @focus="entrerCase($event, d.cle, 0); fermer()" @blur="sortirCase(d.cle)" @keydown.enter.prevent="$event.target.blur()"
                                   class="w-[3.8rem] md:w-[4.8rem] bg-transparent text-right text-[13px] font-black text-white tabular-nums placeholder:text-white/35 placeholder:font-semibold outline-none">
                            <span class="text-[10px] font-bold text-white/45">DH</span>
                        </label>
                        <button type="button" data-pulse-cloturer :data-poste="d.cle" :aria-pressed="d.clos ? 'true' : 'false'" :title="titreCloture(d.nom, d.unite, d.clos)"
                                @click="$emit('cloturer', sm.debut, d.cle, d.unite); fermer()"
                                :class="['shrink-0 w-6 h-6 grid place-items-center rounded-md text-[10px] transition', d.clos ? 'bg-white/25 ring-1 ring-white/60' : 'opacity-35 hover:opacity-100 hover:bg-white/10']">🔒</button>
                    </div>
                </details>
                <button v-if="p.horsBudget > 0" type="button" data-rx-ancre data-pulse-hors""")

io.open(F, 'w', encoding='utf-8').write(src)
print('✔ v37.66 Affichage : début / fin du cycle, les postes du cycle à part, les saisies d’avant la paie au cycle qui finit')
