#!/usr/bin/env python3
"""v37.97 — « RECALIBRER L'ANNÉE » EN UN GESTE, ET DES GARDE-FOUS VISIBLES.

  Un seul bouton fait, dans l'ordre : 1) retire les virements en double, 2) réadapte au potentiel les lignes
  d'épargne déjà calées sur le potentiel (les montants fixes — Smart Goals… — ne sont JAMAIS touchés),
  3) alimente le Courant au juste besoin. Avant / après affiché (point bas du Courant, comptes sous zéro,
  épargne vs ce que l'année permet, virements, alertes) ; « Annuler » ramène virements et épargne d'avant
  (les opérations importées entre-temps ne sont pas touchées). Proposé d'office après un import de captures.
  Garde-fous : compte sous zéro, épargne > potentiel annuel, virement en double, aller-retour le même jour.
  Le CFO peut le demander : app_action task=recalibrer_annee.
"""
import io, sys

F = 'index.html'
src = io.open(F, encoding='utf-8').read()
def sub(label, old, new, cible=None):
    global src
    c = src.count(old)
    if c != 1:
        print(f'✖ {label} : {c} ancre(s), 1 attendue'); sys.exit(1)
    src = src.replace(old, new)

JS = r"""
                    /*  v37.97 — RECALIBRER L'ANNÉE EN UN GESTE · LES GARDE-FOUS. */
                    //  Le point le plus bas de chaque compte réel sur les cycles de l'année (lu dans le Relevé)
                    const _minParCompte = (an) => {
                        const a = Number(an), mb = moisBudgetaire.value, out = {};
                        if (a < mb.an) return out;
                        const cles = []; for (let m = mb.mois, y = mb.an; y < a || (y === a && m <= 12); ) { cles.push(m + '-' + y); m++; if (m > 12) { m = 1; y++; } }
                        let E; try { E = ((_buildJournalReleve([], cles) || {}).entries || []); } catch (e) { return out; }
                        E.forEach(e => {
                            if (!e || !e.compteKey || (e.type !== 'credit' && e.type !== 'debit')) return;
                            const p = String(e.cycle || '').split('-').map(Number);
                            if (p[1] !== a) return;
                            const s = Math.round(Number(e.soldeCompteApres) || 0), o = out[e.compteKey];
                            if (!o || s < o.min) out[e.compteKey] = { min: s, cycle: p[0], libelle: String(e.libelle || '') };
                        });
                        Object.keys(out).forEach(k => { if (!infoCompte(k).reel) delete out[k]; });
                        return out;
                    };
                    const _sigVirement = (v) => [Number(v.mois) || 0, Number(v.jourPrevu) || 0, cleDeCompte(String(v.sourceCompte || 'courant')), cleDeCompte(String(v.destinationCompte || 'courant')), Math.abs(Number(v.montant) || 0)].join('|');
                    const _leJour = (v) => nomDuMois(Number(v.mois)) + (v.jourPrevu ? ' (le ' + v.jourPrevu + ')' : '');
                    const gardeFousAnnee = (an, mins) => {
                        const a = Number(an), d = (donneesAnnuelles.value || {})[a];
                        if (!d) return [];
                        const G = [];
                        Object.entries(mins || _minParCompte(a)).forEach(([k, o]) => {
                            if (o.min < -0.5) G.push({ type: 'sous_zero', cle: k, texte: getNomCompte(k) + ' passe sous zéro en ' + nomDuMois(o.cycle) + ' ' + a + ' (' + formatMAD(o.min) + ')',
                                                       aide: '« Recalibrer l’année » pose les virements qui manquent ; sinon avancez une entrée ou reportez une dépense.' });
                        });
                        const pa = potentielEpargneAn(a), ep = pa.reduce((s, x) => s + x.epargne_programmee, 0), pot = pa.reduce((s, x) => s + x.potentiel_avant_epargne, 0);
                        if (ep > 0 && ep > pot) G.push({ type: 'epargne_sup_potentiel', texte: 'L’épargne programmée en ' + a + ' (' + formatMAD(ep) + ') dépasse ce que l’année permet (' + formatMAD(Math.max(0, pot)) + ')',
                                                         aide: 'Adaptez une ligne d’épargne au potentiel (⚖️ dans Épargne), puis recalibrez.' });
                        const vi = (Array.isArray(d.virementsInternes) ? d.virementsInternes : []).filter(Boolean);
                        const groupes = {};
                        vi.forEach(v => { const s = _sigVirement(v); (groupes[s] = groupes[s] || []).push(v); });
                        Object.values(groupes).filter(L => L.length > 1).forEach(L => G.push({ type: 'doublon', ids: L.slice(1).map(v => v.id),
                            texte: 'Virement en double : ' + L.length + ' × ' + formatMAD(L[0].montant) + ' de ' + getNomCompte(L[0].sourceCompte || 'courant') + ' vers ' + getNomCompte(L[0].destinationCompte || 'courant') + ' en ' + _leJour(L[0]),
                            aide: 'Un seul est gardé.' }));
                        const parJour = {};
                        vi.forEach(v => {
                            const s = cleDeCompte(String(v.sourceCompte || 'courant')), t = cleDeCompte(String(v.destinationCompte || 'courant'));
                            if (s === t) return;
                            const k = (Number(v.mois) || 0) + '|' + (Number(v.jourPrevu) || 0) + '|' + [s, t].sort().join('>');
                            (parJour[k] = parJour[k] || {})[s] = v;
                        });
                        Object.values(parJour).forEach(o => { const L = Object.values(o); if (L.length === 2) G.push({ type: 'aller_retour',
                            texte: 'Aller-retour le même jour : ' + formatMAD(L[0].montant) + ' vers ' + getNomCompte(L[0].destinationCompte || 'courant') + ' et ' + formatMAD(L[1].montant) + ' en retour, en ' + _leJour(L[0]),
                            aide: 'L’argent part et revient : seule la différence compte. « Recalibrer l’année » le règle entre le compte du salaire et le Courant.' }); });
                        return G;
                    };
                    const gardeFousAffichage = computed(() => {
                        calculationTick.value;
                        if (activeTab.value !== 'irregulieres') return [];
                        try { return gardeFousAnnee(anneeAffichage.value); } catch (e) { return []; }
                    });
                    const retirerDoublonsVirements = (an, silencieux) => {
                        const d = (donneesAnnuelles.value || {})[Number(an)];
                        if (!d || !Array.isArray(d.virementsInternes)) return 0;
                        const vus = new Set(); let n = 0;
                        d.virementsInternes = d.virementsInternes.filter(v => { if (!v) return true; const s = _sigVirement(v); if (vus.has(s)) { n++; return false; } vus.add(s); return true; });
                        if (n) { calculationTick.value++; if (!silencieux) { addLog('🧹 ' + n + ' virement(s) en double retiré(s) en ' + an + '.', 'success'); handleDataChange(); } }
                        return n;
                    };
                    const _etatAnnee = (a) => {
                        calculationTick.value++;
                        const mins = _minParCompte(a), ck = cleDeCompte('courant'), pa = potentielEpargneAn(a);
                        return { courantBas: mins[ck] ? mins[ck].min : null, courantBasMois: mins[ck] ? mins[ck].cycle : null,
                                 comptesSousZero: Object.values(mins).filter(o => o.min < -0.5).length,
                                 epargne: pa.reduce((s, x) => s + x.epargne_programmee, 0), potentiel: pa.reduce((s, x) => s + x.potentiel_avant_epargne, 0),
                                 virements: (((donneesAnnuelles.value || {})[a] || {}).virementsInternes || []).filter(Boolean).length,
                                 alertes: gardeFousAnnee(a, mins).length };
                    };
                    const _lignesEpargne = (d) => (Array.isArray(d.epargne) ? d.epargne : Object.values(d.epargne || {})).filter(Boolean);
                    const recalibrerAnnee = (an) => {
                        const a = Number(an), D = donneesAnnuelles.value || {}, d = D[a];
                        if (!d) { addLog('🎯 Exercice ' + a + ' absent : rien à recalibrer.', 'warn'); return null; }
                        //  ce qu'« Annuler » remettra : les virements et l'épargne (les opérations importées ne sont pas touchées)
                        const annuler = { epargne: JSON.parse(JSON.stringify(d.epargne || [])), annees: {} };
                        [a - 1, a, a + 1].forEach(y => { const dy = D[y]; if (dy) annuler.annees[y] = { virementsInternes: JSON.parse(JSON.stringify(dy.virementsInternes || [])), alimentationJusteBesoin: dy.alimentationJusteBesoin ? JSON.parse(JSON.stringify(dy.alimentationJusteBesoin)) : null }; });
                        const avant = _etatAnnee(a), etapes = [];
                        const nd = retirerDoublonsVirements(a, true);
                        etapes.push(nd ? '🧹 ' + nd + ' virement(s) en double retiré(s)' : '🧹 Aucun virement en double');
                        const adaptees = _lignesEpargne(d).filter(o => o.adapteePotentiel && Number(o.adapteePotentiel.an) === a);
                        adaptees.forEach(o => adapterEpargneAuPotentiel(o, a, o.adapteePotentiel.plafond));
                        const fixes = _lignesEpargne(d).filter(o => !adaptees.includes(o) && sensEpargne(o.sourceCompte || 'courant', destEpargne(o)) > 0);
                        etapes.push(adaptees.length ? '⚖️ Épargne réadaptée au potentiel : ' + adaptees.map(o => o.nom || o.label || 'Épargne').join(', ') : '⚖️ Aucune ligne d’épargne calée sur le potentiel');
                        if (fixes.length) etapes.push('🔒 Montants fixes gardés tels quels : ' + fixes.map(o => o.nom || o.label || 'Épargne').join(', '));
                        const r = alimenterCourantAuJusteBesoin(a);
                        etapes.push(r ? '🔄 Courant alimenté au juste besoin : ' + (r.plan.filter(p => p.montant).map(p => _MOIS_COURTS[p.cycle - 1] + ' ' + formatMAD(p.montant)).join(' · ') || 'aucun virement nécessaire') + (r.nettoyes ? ' (' + r.nettoyes + ' ancien(s) retiré(s) d’abord)' : '')
                                      : '🔄 Le salaire arrive déjà sur le Courant : pas d’alimentation à poser');
                        const apres = _etatAnnee(a);
                        d.recalibrage = { le: _aujourdhuiISO(), avant, apres, etapes, annuler };
                        calculationTick.value++;
                        handleDataChange();
                        addLog('🎯 ' + a + ' recalibrée — point bas du Courant : ' + (avant.courantBas === null ? '—' : formatMAD(avant.courantBas)) + ' → ' + (apres.courantBas === null ? '—' : formatMAD(apres.courantBas)) + ' ; alertes : ' + avant.alertes + ' → ' + apres.alertes + '.', 'success');
                        return d.recalibrage;
                    };
                    const annulerRecalibrage = (an) => {
                        const a = Number(an), D = donneesAnnuelles.value || {}, d = D[a], r = d && d.recalibrage;
                        if (!r || !r.annuler) return false;
                        d.epargne = JSON.parse(JSON.stringify(r.annuler.epargne || []));
                        Object.entries(r.annuler.annees || {}).forEach(([y, s]) => {
                            const dy = D[y]; if (!dy) return;
                            dy.virementsInternes = JSON.parse(JSON.stringify(s.virementsInternes || []));
                            if (s.alimentationJusteBesoin) dy.alimentationJusteBesoin = JSON.parse(JSON.stringify(s.alimentationJusteBesoin)); else delete dy.alimentationJusteBesoin;
                        });
                        delete d.recalibrage;
                        calculationTick.value++;
                        addLog('↩️ Recalibrage de ' + a + ' annulé : virements et épargne d’avant revenus.', 'success');
                        handleDataChange();
                        return true;
                    };
                    const lignesRecalibrage = (rc) => {
                        if (!rc || !rc.avant || !rc.apres) return [];
                        const A = rc.avant, B = rc.apres, M = (x) => x === null || x === undefined ? '—' : formatMAD(x);
                        const bas = (e) => e.courantBas === null ? '—' : formatMAD(e.courantBas) + (e.courantBasMois ? ' (' + _MOIS_COURTS[e.courantBasMois - 1] + ')' : '');
                        return [
                            { cle: 'bas', lib: 'Point bas du Courant', av: bas(A), ap: bas(B), mieux: (B.courantBas ?? 0) >= (A.courantBas ?? 0) },
                            { cle: 'zero', lib: 'Comptes qui passent sous zéro', av: String(A.comptesSousZero), ap: String(B.comptesSousZero), mieux: B.comptesSousZero <= A.comptesSousZero },
                            { cle: 'ep', lib: 'Épargne programmée / ce que l’année permet', av: M(A.epargne) + ' / ' + M(A.potentiel), ap: M(B.epargne) + ' / ' + M(B.potentiel), mieux: B.epargne <= B.potentiel || B.epargne <= A.epargne },
                            { cle: 'vir', lib: 'Virements de l’année', av: String(A.virements), ap: String(B.virements), mieux: true },
                            { cle: 'al', lib: 'Alertes', av: String(A.alertes), ap: String(B.alertes), mieux: B.alertes <= A.alertes },
                        ];
                    };
"""

sub('JS : après fairePartirDuSalaire',
"""                    const fairePartirDuSalaire = (v, an) => { const sk = compteDuSalaire(an); if (!v || !sk) return; v.sourceCompte = sk; calculationTick.value++; addLog('🔄 Virement de ' + formatMAD(v.montant) + ' : part désormais de ' + getNomCompte(sk) + '.', 'success'); handleDataChange(); };
""",
"""                    const fairePartirDuSalaire = (v, an) => { const sk = compteDuSalaire(an); if (!v || !sk) return; v.sourceCompte = sk; calculationTick.value++; addLog('🔄 Virement de ' + formatMAD(v.montant) + ' : part désormais de ' + getNomCompte(sk) + '.', 'success'); handleDataChange(); };
""" + JS)

sub('exports',
"alimenterCourantAuJusteBesoin, annulerAlimentationCourant,",
"alimenterCourantAuJusteBesoin, annulerAlimentationCourant, recalibrerAnnee, annulerRecalibrage, lignesRecalibrage, gardeFousAnnee, gardeFousAffichage, retirerDoublonsVirements,")

# demande du CFO
sub('CFO : tâche recalibrer_annee exécutée par l\'appli',
"""                                if (x.tache === 'alimenter_courant') {""",
"""                                if (x.tache === 'recalibrer_annee') {
                                    const r = recalibrerAnnee(an);
                                    fait.push(r ? '🎯 ' + an + ' recalibrée par l’appli — ' + r.etapes.join(' · ') + ' — point bas du Courant ' + (r.avant.courantBas === null ? '—' : formatMAD(r.avant.courantBas)) + ' → ' + (r.apres.courantBas === null ? '—' : formatMAD(r.apres.courantBas)) + ', alertes ' + r.avant.alertes + ' → ' + r.apres.alertes
                                                : '🎯 Recalibrage ' + an + ' : exercice absent.');
                                } else if (x.tache === 'alimenter_courant') {""")

UI = """                    <!-- v37.97 : recalibrer l'année en un geste, et les garde-fous -->
                    <div data-recalibrer class="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-2">
                        <div class="flex flex-wrap items-center gap-2">
                            <span class="text-sm font-black text-emerald-900 flex-1 min-w-[200px]">🎯 Recalibrer {{ anneeAffichage }} en un geste</span>
                            <button type="button" data-recalibrer-annee @click="recalibrerAnnee(anneeAffichage)" class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow">🎯 Recalibrer l’année</button>
                            <button v-if="(donneesAnnuelles[anneeAffichage] || {}).recalibrage" type="button" data-annuler-recalibrage @click="annulerRecalibrage(anneeAffichage)" class="px-3 py-1.5 rounded-lg bg-white border border-emerald-200 text-emerald-700 text-xs font-black">↩️ Annuler</button>
                        </div>
                        <p class="text-[11px] text-emerald-900/80 font-semibold leading-snug">Dans l’ordre : retire les virements en double, recale sur le potentiel l’épargne qui l’est déjà, puis alimente le Courant au juste besoin. Les montants d’épargne fixes ne sont jamais touchés.</p>
                        <div v-if="(donneesAnnuelles[anneeAffichage] || {}).recalibrage" data-recalibrage-resume class="rounded-xl bg-white border border-emerald-100 p-2 space-y-1">
                            <div class="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-0.5 text-[11px] font-bold tabular-nums">
                                <span class="text-slate-400 font-black">Recalibré le {{ donneesAnnuelles[anneeAffichage].recalibrage.le }}</span><span class="text-slate-400 font-black text-right">Avant</span><span class="text-slate-400 font-black text-right">Après</span>
                                <template v-for="l in lignesRecalibrage(donneesAnnuelles[anneeAffichage].recalibrage)" :key="'rc_' + l.cle">
                                    <span class="text-slate-700">{{ l.lib }}</span><span class="text-right text-slate-500">{{ l.av }}</span><span class="text-right" :data-recalibrage-apres="l.cle" :class="l.mieux ? 'text-emerald-700' : 'text-rose-700'">{{ l.ap }}</span>
                                </template>
                            </div>
                            <ul class="text-[10px] font-semibold text-slate-600 space-y-0.5"><li v-for="(e, i) in donneesAnnuelles[anneeAffichage].recalibrage.etapes" :key="'rce_' + i">{{ e }}</li></ul>
                        </div>
                        <div data-garde-fous class="space-y-1">
                            <p v-if="!gardeFousAffichage.length" data-garde-fous-ok class="text-[11px] font-black text-emerald-700">✅ Aucun garde-fou déclenché en {{ anneeAffichage }}.</p>
                            <div v-for="(g, i) in gardeFousAffichage" :key="'gf_' + i" :data-garde-fou="g.type" class="flex flex-wrap items-center gap-2 text-[11px] font-bold text-rose-900 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1">
                                <span class="flex-1 min-w-[180px]">⚠️ {{ g.texte }}<span class="block text-[10px] font-semibold text-rose-800/80">{{ g.aide }}</span></span>
                                <button v-if="g.type === 'doublon'" type="button" data-retirer-doublons @click="retirerDoublonsVirements(anneeAffichage)" class="px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-black">Retirer le double</button>
                            </div>
                        </div>
                    </div>

                    <!-- v37.89 : le Courant alimenté au juste besoin -->"""
sub('UI : bloc recalibrer', "                    <!-- v37.89 : le Courant alimenté au juste besoin -->", UI)

IMP = """                        <li>🏦 {{ importBanque.resume.soldes }} solde(s) mis à jour</li>
                    </ul>
                    <!-- v37.97 : les soldes ont bougé — recalibrer l'année, proposé d'office -->
                    <div v-if="importBanque.resume.soldes || importBanque.resume.ajoutees" data-proposition-recalibrage class="rounded-xl border border-emerald-200 bg-emerald-50 p-3 space-y-2">
                        <template v-if="!importBanque.recalibre">
                            <p class="text-xs font-black text-emerald-900">🎯 Vos comptes ont bougé : recalibrer {{ moisBudgetaire.an }} (doublons retirés, épargne recalée, Courant alimenté au juste besoin) ?</p>
                            <button type="button" data-recalibrer-apres-import @click="importBanque.recalibre = recalibrerAnnee(moisBudgetaire.an) || { etapes: ['Exercice absent'] }" class="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black">🎯 Recalibrer l’année maintenant</button>
                        </template>
                        <template v-else>
                            <p class="text-xs font-black text-emerald-900">✓ {{ moisBudgetaire.an }} recalibrée</p>
                            <div class="grid grid-cols-[1fr_auto_auto] gap-x-3 text-[11px] font-bold tabular-nums" data-recalibrage-import-resume>
                                <template v-for="l in lignesRecalibrage(importBanque.recalibre)" :key="'rci_' + l.cle"><span>{{ l.lib }}</span><span class="text-right text-slate-500">{{ l.av }}</span><span class="text-right" :class="l.mieux ? 'text-emerald-700' : 'text-rose-700'">{{ l.ap }}</span></template>
                            </div>
                            <button v-if="importBanque.recalibre.avant" type="button" data-annuler-recalibrage-import @click="annulerRecalibrage(moisBudgetaire.an); importBanque.recalibre = null" class="px-3 py-1 rounded-lg bg-white border border-emerald-200 text-emerald-700 text-[11px] font-black">↩️ Annuler</button>
                        </template>
                    </div>"""
sub('UI : proposition après import', """                        <li>🏦 {{ importBanque.resume.soldes }} solde(s) mis à jour</li>
                    </ul>""", IMP)

sub('import : remise à zéro de la proposition', """                        importBanque.resume = st;
                        importBanque.etape = 'fini';""", """                        importBanque.resume = st;
                        importBanque.recalibre = null;
                        importBanque.etape = 'fini';""")

io.open(F, 'w', encoding='utf-8').write(src)
print('✔ index.html : Recalibrer l\'année + garde-fous')

# ── CFO : app_action task=recalibrer_annee ──
P = 'cfo_intent_engine.php'
php = io.open(P, encoding='utf-8').read()
def psub(label, old, new):
    global php
    c = php.count(old)
    if c != 1: print(f'✖ {label} : {c} ancre(s), 1 attendue'); sys.exit(1)
    php = php.replace(old, new)
psub('catalogue : desc', "task=adapter_epargne : la ligne d'épargne `name` adaptée au potentiel de chaque mois (plafond `cap` facultatif). Tu ne calcules pas ces montants.",
     "task=adapter_epargne : la ligne d'épargne `name` adaptée au potentiel de chaque mois (plafond `cap` facultatif). task=recalibrer_annee : TOUT en un geste — doublons de virements retirés, épargne déjà calée sur le potentiel recalée, Courant alimenté au juste besoin ; avant/après et garde-fous écrits dans le fil (les montants d'épargne fixes ne sont pas touchés). Tu ne calcules pas ces montants.")
psub('catalogue : task', "'desc'=>\"alimenter_courant | adapter_epargne\"]", "'desc'=>\"recalibrer_annee | alimenter_courant | adapter_epargne\"]")
psub('traduction', "$t = strpos($t, 'alim') !== false ? 'alimenter_courant' : (strpos($t, 'epargne') !== false || strpos($t, 'adapt') !== false ? 'adapter_epargne' : $t);\n            if (!in_array($t, ['alimenter_courant', 'adapter_epargne'], true)) { $log['status']='error'; $log['reason']='tâche inconnue : '.oget($op,'tache').' (alimenter_courant | adapter_epargne)'; break; }",
     "$t = strpos($t, 'recalib') !== false ? 'recalibrer_annee' : (strpos($t, 'alim') !== false ? 'alimenter_courant' : (strpos($t, 'epargne') !== false || strpos($t, 'adapt') !== false ? 'adapter_epargne' : $t));\n            if (!in_array($t, ['recalibrer_annee', 'alimenter_courant', 'adapter_epargne'], true)) { $log['status']='error'; $log['reason']='tâche inconnue : '.oget($op,'tache').' (recalibrer_annee | alimenter_courant | adapter_epargne)'; break; }")
io.open(P, 'w', encoding='utf-8').write(php)
print('✔ cfo_intent_engine.php : recalibrer_annee')
