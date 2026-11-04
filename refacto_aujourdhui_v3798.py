#!/usr/bin/env python3
"""v37.98 — L'ÉCRAN « AUJOURD'HUI », LE MODE EXPERT, LES RÉPONSES INSTANTANÉES DU CFO.

  À l'ouverture : 3 chiffres (ce qu'il reste à dépenser jusqu'à la paie, le point le plus bas du compte courant
  et sa date, l'épargne du mois face à ce que le mois permet) et UNE action (recalibrer si un garde-fou saute,
  importer les captures si les soldes sont vieux, sinon noter ses dépenses). Tout le reste derrière « Mode
  expert » (préférence par appareil ; « ☀️ Aujourd'hui » pour revenir).
  CFO : une question chiffrée (dépenses du mois, irrégulières, reste à dépenser, point bas, soldes, épargne,
  revenus) reçoit sa réponse tout de suite, lue dans l'appli, sans IA ; « Demander au CFO quand même » reste là.
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

JS = r"""
                    /*  v37.98 — L'ÉCRAN « AUJOURD'HUI » · MODE EXPERT · RÉPONSES INSTANTANÉES. */
                    const _lireModePref = () => { try { return localStorage.getItem('fm_mode_affichage'); } catch (e) { return null; } };
                    const modeAffichagePref = ref(_lireModePref());
                    const modeExpert = computed(() => (modeAffichagePref.value || (soldesInitiaux.value || {}).modeAffichage || 'simple') === 'expert');
                    const choisirModeAffichage = (m) => { modeAffichagePref.value = m; try { localStorage.setItem('fm_mode_affichage', m); } catch (e) { /* navigation privée */ } };
                    const donneesChargees = ref(false);
                    const vueAujourdhui = computed(() => donneesChargees.value && !modeExpert.value);
                    const _dateReleveCourte = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.getDate() + ' ' + _MOIS_COURTS[d.getMonth()]; };
                    const _courantRadar = () => { try { const k = _cleCourant.value; return (radarComptes.value.comptes || []).find(c => c.key === k) || null; } catch (e) { return null; } };
                    const chiffresDuJour = computed(() => {
                        calculationTick.value;
                        if (!vueAujourdhui.value) return null;
                        const mb = moisBudgetaire.value, c = _courantRadar();
                        let ep = 0, pot = 0; try { ep = epargneDuMoisHors(mb.an, mb.mois, null); pot = potentielEpargneDuMois(mb.an, mb.mois); } catch (e) { /* exercice absent */ }
                        return { cycle: nomDuMois(mb.mois) + ' ' + mb.an, jours: joursRestantsAvantPaie.value,
                                 reste: Math.round(Number(budgetConsoRestantReel.value) || 0), semaine: budgetSemaineReel.value === null ? null : Math.round(Number(budgetSemaineReel.value) || 0),
                                 limiteParTresorerie: contrainteConso.value === 'cash',
                                 bas: c ? c.pointBas : null, basLe: c ? c.datePointBas : null, basHorizon: radarComptes.value.horizon,
                                 epargne: Math.round(ep), potentiel: Math.round(pot) };
                    });
                    //  UNE action, la plus utile maintenant
                    const actionDuJour = computed(() => {
                        calculationTick.value;
                        if (!vueAujourdhui.value) return null;
                        const an = moisBudgetaire.value.an, d = (donneesAnnuelles.value || {})[an] || {};
                        if (d.recalibrage && d.recalibrage.le === _aujourdhuiISO()) return { cle: 'fait', texte: '✅ ' + an + ' recalibrée aujourd’hui.', bouton: null };
                        let G = []; try { G = gardeFousAnnee(an); } catch (e) { G = []; }
                        const g = G.find(x => x.type === 'sous_zero') || G.find(x => x.type === 'doublon' || x.type === 'aller_retour');
                        if (g) return { cle: 'recalibrer', texte: g.texte + '.', bouton: '🎯 Tout recalculer pour ' + an };
                        const ge = G.find(x => x.type === 'epargne_sup_potentiel');
                        if (ge) return { cle: 'epargne', texte: ge.texte + '.', bouton: '🎓 Voir l’épargne' };
                        const vieux = (comptes.value || []).filter(c => c && (c.type === 'liquide' || !c.type)).map(c => (c.soldeBanque && c.soldeBanque.date) ? (Date.now() - new Date(c.soldeBanque.date).getTime()) / 864e5 : 999);
                        const age = vieux.length ? Math.max(...vieux) : 0;
                        if (age > 7) return { cle: 'importer', texte: age >= 999 ? 'Vos soldes n’ont jamais été lus sur vos relevés : importez une capture de chaque compte.' : 'Vos soldes datent de ' + Math.floor(age) + ' jours : importez vos captures pour rester juste.', bouton: '📸 Importer mes captures' };
                        return { cle: 'saisir', texte: '✅ Rien d’urgent. Notez vos dépenses au fil de l’eau.', bouton: '✍️ Noter une dépense' };
                    });
                    const faireActionDuJour = () => {
                        const a = actionDuJour.value; if (!a) return;
                        if (a.cle === 'recalibrer') recalibrerAnnee(moisBudgetaire.value.an);
                        else if (a.cle === 'importer') ouvrirImportBanque();
                        else if (a.cle === 'saisir') openSaisieQuickModal();
                        else if (a.cle === 'epargne') { choisirModeAffichage('expert'); appMode.value = 'previsionnel'; activeTab.value = 'parametres'; }
                    };

                    //  Le CFO : une question chiffrée trouve sa réponse dans l'appli, tout de suite, sans IA
                    const _sansAccents = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, ' ');
                    const reponseInstantanee = (question) => {
                        const n = ' ' + _sansAccents(question) + ' ';
                        if (/(ajout|modifi|supprim|retir|\bpose|programm|chang|\bmets\b|recalib|aliment|adapt|memoris|retiens|pourquoi|conseil|dois je|faut il|analys|compar|simul|et si|optimis|strateg|expliqu|\bcree|deplac|annul|transf|vire|paye|rembours|prevois|projet)/.test(n)) return null;
                        if (!/(combien|\bcomb\b|\bquel|total|montant|\?|savoir|donne|dis moi|c est quoi|\bmon |\bma |\bmes )/.test(n)) return null;
                        const mb = moisBudgetaire.value, an = mb.an, m = mb.mois, d = (donneesAnnuelles.value || {})[an] || {};
                        const M = (x) => _echapper(formatMAD(Math.round(Number(x) || 0)));
                        const blocs = [], sujets = [];
                        const irrDe = (mm) => (Array.isArray(d.depensesIrregulieres) ? d.depensesIrregulieres : []).filter(x => x && Number(x.mois) === mm && Number(x.montant) > 0);
                        const veutIrr = /(irreg|exceptionnel|ponctuel)/.test(n);
                        if (/(depense|charge|sortie|\bdep\b)/.test(n) && /(mois|mensuel|total|chaque|par mois)/.test(n)) {
                            const fixes = (mm) => Object.values(d.chargesFixes || {}).filter(Boolean).reduce((s, it) => s + (Number(getDueFixe(it, an, mm)) || 0), 0);
                            const varia = (mm) => Object.values(d.chargesVariables || {}).filter(Boolean).reduce((s, it) => s + (Number(getMonthlyVariableValue(it, mm, an)) || 0), 0);
                            const f = fixes(m), v = varia(m), i = irrDe(m).reduce((s, x) => s + Number(x.montant), 0);
                            let moy = 0; for (let k = 1; k <= 12; k++) moy += fixes(k) + varia(k); moy /= 12;
                            blocs.push('<p><b>Dépenses du cycle de ' + _echapper(nomDuMois(m)) + ' ' + an + '</b> : charges fixes ' + M(f) + ' · dépenses variables (budget) ' + M(v)
                                + (i ? ' · exceptionnelles du mois ' + M(i) : '') + ' → <b>' + M(f + v + i) + '</b>.</p><p>En moyenne sur ' + an + ' : <b>' + M(moy) + ' par mois</b> (fixes + variables), hors exceptionnelles et épargne.</p>');
                            sujets.push('depenses');
                        }
                        if (veutIrr) {
                            const L = (Array.isArray(d.depensesIrregulieres) ? d.depensesIrregulieres : []).filter(x => x && Number(x.montant) > 0).sort((x, y) => Number(x.mois) - Number(y.mois));
                            const tot = L.reduce((s, x) => s + Number(x.montant), 0), avenir = L.filter(x => Number(x.mois) >= m);
                            blocs.push('<p><b>Dépenses exceptionnelles ' + an + '</b> : ' + L.length + ' ligne(s), <b>' + M(tot) + '</b> sur l’année (≈ ' + M(tot / 12) + ' par mois) ; '
                                + avenir.length + ' encore à venir (' + M(avenir.reduce((s, x) => s + Number(x.montant), 0)) + ').</p>'
                                + (L.length ? '<ul style="margin:4px 0 0 0;padding-left:16px">' + L.slice(0, 12).map(x => '<li>' + _echapper(_MOIS_COURTS[Number(x.mois) - 1] || '?') + ' — ' + _echapper(x.nom || '—') + ' : ' + M(x.montant) + '</li>').join('') + (L.length > 12 ? '<li>…</li>' : '') + '</ul>' : ''));
                            sujets.push('irregulieres');
                        }
                        if (/(reste a (depenser|vivre)|rest a depens|peux (encore )?depenser|budget (restant|de la semaine|semaine)|reste ce mois|reste du mois)/.test(n)) {
                            const r = Math.round(Number(budgetConsoRestantReel.value) || 0), s = budgetSemaineReel.value;
                            blocs.push('<p><b>Reste à dépenser jusqu’à la paie</b> : <b>' + M(r) + '</b>' + (s !== null ? ', soit ' + M(s) + ' par semaine' : '') + ' — ' + joursRestantsAvantPaie.value + ' jour(s) avant la paie'
                                + (contrainteConso.value === 'cash' ? ' (limité par l’argent disponible sur le compte, pas par le budget)' : '') + '.</p>');
                            sujets.push('reste');
                        }
                        if (/(point (le plus )?bas|negatif|decouvert|sous zero|en rouge)/.test(n)) {
                            const c = _courantRadar();
                            if (c) blocs.push('<p><b>Point le plus bas du compte courant</b> d’ici le ' + _echapper(radarComptes.value.horizon) + ' : <b>' + M(c.pointBas) + '</b> le ' + _echapper(c.datePointBas || '?')
                                + (c.pointBas < 0 ? ' ⚠️ — il passe sous zéro ; « Recalibrer l’année » pose les virements qui manquent.' : ' ✅') + '</p>');
                            sujets.push('point_bas');
                        }
                        if (/\bsoldes?\b|combien (j ai|ai je) sur|sur mes comptes|sur mon compte/.test(n)) {
                            const L = (comptes.value || []).filter(Boolean);
                            const vise = L.filter(c => { const l = _sansAccents(c.label || ''); const mots = l.replace(/^compte\s+/, '').split(/\s+/).filter(w => w.length > 3); return mots.some(w => n.includes(' ' + w)); });
                            const liste = vise.length ? vise : L;
                            blocs.push('<p><b>Soldes</b> :</p><ul style="margin:4px 0 0 0;padding-left:16px">' + liste.map(c => '<li>' + _echapper(c.label || 'Compte') + ' : <b>' + M(c.solde) + '</b>'
                                + (c.soldeBanque && c.soldeBanque.date ? ' <span style="color:#64748b">(relevé du ' + _echapper(_dateReleveCourte(c.soldeBanque.date)) + ')</span>' : '') + '</li>').join('') + '</ul>');
                            sujets.push('soldes');
                        }
                        if (/(epargn|potentiel|mettre de cote|mis de cote)/.test(n)) {
                            let pa = []; try { pa = potentielEpargneAn(an); } catch (e) { pa = []; }
                            const x = pa.find(p => p.mois === m) || { epargne_programmee: 0, potentiel_avant_epargne: 0 };
                            blocs.push('<p><b>Épargne de ' + _echapper(nomDuMois(m)) + '</b> : ' + M(x.epargne_programmee) + ' programmée, le mois permet ' + M(x.potentiel_avant_epargne) + '.</p><p>Sur ' + an + ' : '
                                + M(pa.reduce((s, p) => s + p.epargne_programmee, 0)) + ' programmée pour ' + M(pa.reduce((s, p) => s + p.potentiel_avant_epargne, 0)) + ' possible.</p>');
                            sujets.push('epargne');
                        }
                        if (/(revenu|\bgagne|entrees? d argent)/.test(n) || (/salaire/.test(n) && !/(solde|compte salaire|sur mon compte)/.test(n))) {
                            const r = Object.values(d.revenus || {}).filter(Boolean).reduce((s, it) => s + (Number(getDueRevenu(it, an, m)) || 0), 0);
                            blocs.push('<p><b>Revenus du cycle de ' + _echapper(nomDuMois(m)) + '</b> : <b>' + M(r) + '</b>.</p>');
                            sujets.push('revenus');
                        }
                        if (!blocs.length) return null;
                        const q = String(question || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
                        const h = '<div data-cfo-instantane="' + sujets.join(' ') + '" style="border-left:3px solid #0891b2;background:#ecfeff;padding:8px 12px;border-radius:8px;font-size:13px">'
                            + '<div style="font-size:11px;font-weight:800;color:#0e7490;margin-bottom:4px">⚡ Réponse instantanée — lue dans l’appli, sans IA</div>' + blocs.join('')
                            + '<button type="button" data-cfo-renvoyer data-question="' + q + '" style="margin-top:8px;padding:3px 10px;border-radius:8px;background:#4f46e5;color:#fff;font-weight:800;font-size:11px">🤖 Demander au CFO quand même</button>';
                        return `${h}</div>`;
                    };
"""

sub('JS : après lignesRecalibrage', "                    const lignesRecalibrage = (rc) => {", JS + "                    const lignesRecalibrage = (rc) => {")

sub('CFO : réponse instantanée avant l\'envoi',
"""                        cfoInput.value = '';
                        nextTick(_replierChampsCFO);   // v37.11 : le champ revient à une ligne
                        consulterCFO(q);""",
"""                        cfoInput.value = '';
                        nextTick(_replierChampsCFO);   // v37.11 : le champ revient à une ligne
                        //  v37.98 : une question chiffrée — la réponse est lue dans l'appli, tout de suite, sans IA
                        let _inst = null; try { _inst = reponseInstantanee(q); } catch (e) { _inst = null; }
                        if (_inst) {
                            const _n = new Date(), _t = _n.getHours().toString().padStart(2, '0') + ':' + _n.getMinutes().toString().padStart(2, '0');
                            cfoMessages.value.push({ role: 'user', content: q, time: _t });
                            cfoMessages.value.push({ role: 'agent', content: _inst, time: _t });
                            scrollCFOToBottom();
                            return;
                        }
                        consulterCFO(q);""")

sub('chargement : données prêtes (fichier vide)',
"""                                    handleDataChange(); // Force un recalcul avec les données de secours
                                    return;""",
"""                                    handleDataChange(); // Force un recalcul avec les données de secours
                                    donneesChargees.value = true;
                                    return;""")
sub('chargement : données prêtes',
"""                        } catch (e) { addLog("Mode hors-ligne local activé.", 'warn'); migrateCategoriesV22(); /* v22.00 P1 */ }
                        // v37.38 : à l'ouverture, rattraper toute mémorisation demandée mais non écrite""",
"""                        } catch (e) { addLog("Mode hors-ligne local activé.", 'warn'); migrateCategoriesV22(); /* v22.00 P1 */ }
                        donneesChargees.value = true;   // v37.98 : l'écran « Aujourd'hui » attend les vraies données
                        // v37.38 : à l'ouverture, rattraper toute mémorisation demandée mais non écrite""")

sub('exports',
"recalibrerAnnee, annulerRecalibrage, lignesRecalibrage,",
"recalibrerAnnee, annulerRecalibrage, lignesRecalibrage, modeExpert, choisirModeAffichage, vueAujourdhui, chiffresDuJour, actionDuJour, faireActionDuJour, reponseInstantanee, donneesChargees,")

NAV = """                <nav aria-label="Onglets" :class="['flex-1 min-h-0 overflow-y-auto custom-scroll space-y-1.5', isSidebarCollapsed ? 'px-2 py-3' : 'px-3 py-3']">
                    <!-- v37.98 : revenir à l'écran simple -->
                    <button type="button" data-vers-aujourdhui @click="choisirModeAffichage('simple')" :title="isSidebarCollapsed ? 'Aujourd’hui (écran simple)' : null" :class="['w-full flex items-center rounded-lg text-sm font-bold bg-amber-400/15 text-amber-200 hover:bg-amber-400/25', isSidebarCollapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5 text-left']"><span class="text-base leading-none shrink-0">☀️</span><span v-if="!isSidebarCollapsed" class="leading-tight">Aujourd’hui</span></button>"""
sub('nav : Aujourd\'hui', """                <nav aria-label="Onglets" :class="['flex-1 min-h-0 overflow-y-auto custom-scroll space-y-1.5', isSidebarCollapsed ? 'px-2 py-3' : 'px-3 py-3']">""", NAV)

sub('mobile : Aujourd\'hui',
"""                        <button @click="activeTab = 'parametres'" class="text-[8px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-700 mt-0.5">⚙ Gérer les comptes</button>
                    </div>
                    <select v-model.number="anneeAffichage\"""",
"""                        <button @click="activeTab = 'parametres'" class="text-[8px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-700 mt-0.5">⚙ Gérer les comptes</button>
                        <button type="button" data-vers-aujourdhui-mobile @click="choisirModeAffichage('simple')" class="ml-2 text-[8px] font-black uppercase tracking-widest text-amber-600 hover:text-amber-700 mt-0.5">☀️ Aujourd’hui</button>
                    </div>
                    <select v-model.number="anneeAffichage\"""")

ECRAN = """        <!-- v37.98 : L'ÉCRAN « AUJOURD'HUI » — 3 chiffres, 1 action ; le reste derrière « Mode expert » -->
        <div v-if="vueAujourdhui" data-aujourdhui class="fixed inset-0 z-[70] bg-gradient-to-b from-sky-50 to-slate-100 overflow-y-auto">
            <div class="max-w-md mx-auto px-4 pt-6 pb-28 space-y-3" v-if="chiffresDuJour">
                <div class="flex items-end justify-between gap-2">
                    <div>
                        <p class="text-[11px] font-black uppercase tracking-widest text-sky-700">☀️ Aujourd’hui</p>
                        <p class="text-xs font-semibold text-slate-500">Cycle de {{ chiffresDuJour.cycle }} · paie dans {{ chiffresDuJour.jours }} jour{{ chiffresDuJour.jours > 1 ? 's' : '' }}</p>
                    </div>
                    <button type="button" data-mode-expert @click="choisirModeAffichage('expert')" class="text-[11px] font-black px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 shadow-sm">🎓 Mode expert</button>
                </div>
                <div data-auj-reste class="rounded-2xl bg-white shadow-sm border border-slate-200 p-4">
                    <p class="text-xs font-bold text-slate-500">Il vous reste à dépenser jusqu’à la paie</p>
                    <p class="text-3xl font-black tabular-nums" :class="chiffresDuJour.reste >= 0 ? 'text-slate-900' : 'text-rose-600'">{{ formatMAD(chiffresDuJour.reste) }}</p>
                    <p class="text-xs font-semibold text-slate-500"><template v-if="chiffresDuJour.semaine !== null">soit {{ formatMAD(chiffresDuJour.semaine) }} par semaine</template><template v-if="chiffresDuJour.limiteParTresorerie"> · limité par l’argent sur le compte</template></p>
                </div>
                <div data-auj-point-bas class="rounded-2xl bg-white shadow-sm border p-4" :class="chiffresDuJour.bas !== null && chiffresDuJour.bas < 0 ? 'border-rose-300' : 'border-slate-200'">
                    <p class="text-xs font-bold text-slate-500">Le plus bas que touchera votre compte courant d’ici le {{ chiffresDuJour.basHorizon }}</p>
                    <p class="text-3xl font-black tabular-nums" :class="chiffresDuJour.bas !== null && chiffresDuJour.bas < 0 ? 'text-rose-600' : 'text-emerald-700'">{{ chiffresDuJour.bas === null ? '—' : formatMAD(chiffresDuJour.bas) }}</p>
                    <p class="text-xs font-semibold text-slate-500" v-if="chiffresDuJour.basLe">le {{ chiffresDuJour.basLe }}{{ chiffresDuJour.bas < 0 ? ' — il passe sous zéro' : ' — jamais sous zéro' }}</p>
                </div>
                <div data-auj-epargne class="rounded-2xl bg-white shadow-sm border border-slate-200 p-4">
                    <p class="text-xs font-bold text-slate-500">Épargne de ce mois</p>
                    <p class="text-3xl font-black tabular-nums text-violet-700">{{ formatMAD(chiffresDuJour.epargne) }}</p>
                    <p class="text-xs font-semibold text-slate-500" data-auj-epargne-possible>{{ chiffresDuJour.potentiel > 0 ? 'le mois permet ' + formatMAD(chiffresDuJour.potentiel) : 'ce mois-ci ne laisse rien à épargner (il manque ' + formatMAD(-chiffresDuJour.potentiel) + ')' }}{{ chiffresDuJour.epargne > 0 && chiffresDuJour.epargne > chiffresDuJour.potentiel ? ' — c’est plus que possible' : '' }}</p>
                </div>
                <div v-if="actionDuJour" data-auj-action :data-auj-action-cle="actionDuJour.cle" class="rounded-2xl p-4 shadow-sm border" :class="actionDuJour.bouton && actionDuJour.cle !== 'saisir' ? 'bg-amber-50 border-amber-300' : 'bg-emerald-50 border-emerald-200'">
                    <p class="text-[11px] font-black uppercase tracking-widest text-slate-500">À faire</p>
                    <p class="text-sm font-bold text-slate-800 leading-snug">{{ actionDuJour.texte }}</p>
                    <button v-if="actionDuJour.bouton" type="button" data-auj-faire @click="faireActionDuJour" class="mt-2 w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-black">{{ actionDuJour.bouton }}</button>
                    <div v-if="(donneesAnnuelles[moisBudgetaire.an] || {}).recalibrage && actionDuJour.cle === 'fait'" data-auj-recalibrage class="mt-2 grid grid-cols-[1fr_auto_auto] gap-x-3 text-[11px] font-bold tabular-nums">
                        <template v-for="l in lignesRecalibrage(donneesAnnuelles[moisBudgetaire.an].recalibrage)" :key="'aj_' + l.cle"><span>{{ l.lib }}</span><span class="text-right text-slate-500">{{ l.av }}</span><span class="text-right" :class="l.mieux ? 'text-emerald-700' : 'text-rose-700'">{{ l.ap }}</span></template>
                    </div>
                </div>
                <div class="grid grid-cols-3 gap-2">
                    <button type="button" data-auj-saisir @click="openSaisieQuickModal" class="rounded-xl bg-white border border-slate-200 py-3 text-xs font-black text-slate-700 shadow-sm">✍️<br>Noter</button>
                    <button type="button" data-auj-importer @click="ouvrirImportBanque" class="rounded-xl bg-white border border-slate-200 py-3 text-xs font-black text-slate-700 shadow-sm">📸<br>Captures</button>
                    <button type="button" data-auj-cfo @click="showCfoModal = true" class="rounded-xl bg-white border border-slate-200 py-3 text-xs font-black text-slate-700 shadow-sm">💬<br>CFO</button>
                </div>
            </div>
        </div>

        <div v-if="importBanque.ouvert" data-import-banque"""
sub('écran Aujourd\'hui', """        <div v-if="importBanque.ouvert" data-import-banque""", ECRAN)

io.open(F, 'w', encoding='utf-8').write(src)
print('✔ index.html : Aujourd\'hui + mode expert + réponses instantanées')

# ── mots simples (appliqué une fois, à la main dans la release : voir v37.98) ──
#   '➕ Gérer Périodes' → '➕ Montant variable selon le mois' ; 'Exceptions par période' → 'Montant variable selon le mois' ;
#   '🔄 Fonctionnement' → '🔄 Compte du quotidien'
