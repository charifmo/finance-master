#!/usr/bin/env python3
"""v37.89 — LE COURANT ALIMENTÉ AU JUSTE BESOIN · LE CFO DEMANDE, L'APPLI CALCULE.

« Il faut un virement entre le Courant et Assafa chaque début de cycle, avec la valeur requise. » Le CFO a
  posé 9 100 DH le 28 de chaque mois : le 28 janvier appartient au cycle de FÉVRIER (après la paie du 27) —
  janvier restait à − 7 880, février recevait deux fois ; 9 100 tous les mois même quand le Courant n'en avait
  plus besoin (+ 52 672 en novembre) ; des allers-retours Courant → Assafa le même jour ; et des soldes de fin
  d'année inventés (Assafa « + 2 711 » quand l'appli calcule − 6 389).

  1. APPLI — « 🔄 Alimenter le Courant au juste besoin » (Flux exceptionnels de l'année) : pour chaque cycle
     à venir, UN virement du compte du salaire vers le Courant, le jour de paie (il ouvre le cycle), du montant
     qui garde le Courant au-dessus de zéro sur tout le cycle (arrondi à la centaine ; rien s'il n'en faut pas),
     calculé par le Relevé de comptes, cycle après cycle. Il remplace les virements salaire ↔ Courant de ces
     cycles (les allers-retours compris). « ↩️ Annuler » remet tout comme avant. Il signale ce qui reste à
     regarder : le compte du salaire qui passe sous zéro, les gros virements qui partent du Courant (« faire
     partir du compte du salaire » en un clic).
  2. CFO — un nouvel outil `app_action` : le CFO DEMANDE une capacité de l'appli (alimenter le Courant au juste
     besoin, adapter une épargne au potentiel) ; l'appli l'exécute avec SON moteur au rechargement qui suit
     l'échange, et le dit dans le fil. Le CFO ne calcule plus ces montants.
  3. CFO — la lecture donne, pour chaque cycle, la DATE exacte à laquelle poser son virement (« 27 déc. 2026 :
     année 2026, mois 12, jour 27 »).
  4. Surplus détaillé — la moyenne « hors virements du calendrier » : les virements ponctuels de fin d'année
     (63 000 DH d'un coup en décembre) ne font plus croire à un net négatif chaque mois.
"""
import io, sys

F = 'index.html'
src = io.open(F, encoding='utf-8').read()
def sub(label, old, new, n=1):
    global src
    c = src.count(old)
    if c != n:
        print(f'✖ {label} : {c} ancre(s), {n} attendue(s)'); sys.exit(1)
    src = src.replace(old, new)

# ── 1. Les fonctions ─────────────────────────────────────────────────────────────
sub('fonctions : alimentation et actions du CFO',
"""                        obj.exceptions = plages; delete obj.adapteePotentiel;
                        calculationTick.value++; handleDataChange();
                    };
                    const sensEpargne = (src, dest) => {""",
"""                        obj.exceptions = plages; delete obj.adapteePotentiel;
                        calculationTick.value++; handleDataChange();
                    };

                    /*  v37.89 — LE COURANT ALIMENTÉ AU JUSTE BESOIN. Pour chaque cycle à venir de l'année : UN virement du
                        compte du salaire vers le Courant, posé le jour de paie (il ouvre le cycle : le 27 déc. ouvre janvier),
                        du montant qui garde le Courant au-dessus de zéro sur tout le cycle — lu dans le Relevé, cycle après
                        cycle (chaque virement posé compte pour le suivant). Il remplace les virements salaire ↔ Courant de ces
                        cycles, allers-retours compris ; ce qui est retiré est gardé pour « Annuler ». */
                    const _principalRevenu = (rv) => Object.values(rv || {}).filter(Boolean).sort((a, b) => Number(b.base || 0) - Number(a.base || 0))[0];
                    const compteDuSalaire = (an) => { const s = _principalRevenu(((donneesAnnuelles.value || {})[an] || {}).revenus); return s ? compteDeFlux('revenu', s) : null; };
                    const cycleDuVirement = (v, an) => {
                        const jdp = jourDePaie.value; let m = Number(v && v.mois) || 0, a = Number(an);
                        if (jdp > 1 && Number(v && v.jourPrevu) >= jdp) { m++; if (m > 12) { m = 1; a++; } }
                        return { m, a };
                    };
                    const _dateVirementDuCycle = (M, a) => { const jdp = jourDePaie.value || 1; return M === 1 ? { an: a - 1, mois: 12, jour: jdp } : { an: a, mois: M - 1, jour: jdp }; };
                    const alimenterCourantAuJusteBesoin = (an) => {
                        const a = Number(an), mb = moisBudgetaire.value;
                        const ck = cleDeCompte('courant'), sk = compteDuSalaire(a), skK = sk ? cleDeCompte(sk) : null;
                        if (!skK || skK === ck) { addLog('🔄 Le salaire de ' + a + ' arrive déjà sur le Courant : aucun virement d’alimentation à poser.', 'warn'); return null; }
                        const premier = a < mb.an ? 13 : (a === mb.an ? mb.mois + 1 : 1);
                        const cycles = []; for (let m = premier; m <= 12; m++) cycles.push(m);
                        if (!cycles.length) { addLog('🔄 Aucun cycle à venir en ' + a + '.', 'warn'); return null; }
                        const estAli = (v) => { const s = cleDeCompte(v.sourceCompte || 'courant'), d = cleDeCompte(v.destinationCompte || 'courant'); return (s === skK && d === ck) || (s === ck && d === skK); };
                        const retires = [], ajoutes = [], plan = [];
                        [a - 1, a].forEach(y => {
                            const d = (donneesAnnuelles.value || {})[y];
                            if (!d || !Array.isArray(d.virementsInternes)) return;
                            d.virementsInternes = d.virementsInternes.filter(v => {
                                if (!v || !estAli(v)) return true;
                                const c = cycleDuVirement(v, y);
                                if (c.a === a && cycles.includes(c.m)) { retires.push({ an: y, v: JSON.parse(JSON.stringify(v)) }); return false; }
                                return true;
                            });
                        });
                        const cles = []; for (let m = mb.mois, y = mb.an; y < a || (y === a && m <= 12); ) { cles.push(m + '-' + y); m++; if (m > 12) { m = 1; y++; } }
                        let n = 0;
                        cycles.forEach(M => {
                            const cle = M + '-' + a, i = cles.indexOf(cle), dv = _dateVirementDuCycle(M, a);
                            calculationTick.value++;
                            const E = ((_buildJournalReleve([], cles.slice(0, i + 1)) || {}).entries || []).filter(e => e.cycle === cle && e.compteKey === ck && (e.type === 'credit' || e.type === 'debit'));
                            const min = E.length ? Math.min(...E.map(e => Number(e.soldeCompteApres) || 0)) : 0;
                            const montant = min < 0 ? Math.ceil(-min / 100) * 100 : 0;
                            const ligne = { cycle: M, montant, le: dv.jour + ' ' + _MOIS_COURTS[dv.mois - 1] + ' ' + dv.an };
                            plan.push(ligne);
                            if (!montant) return;
                            const d = (donneesAnnuelles.value || {})[dv.an];
                            if (!d) { ligne.impossible = 'exercice ' + dv.an + ' absent'; return; }
                            if (!Array.isArray(d.virementsInternes)) d.virementsInternes = [];
                            const id = Date.now() * 100 + (n++);
                            d.virementsInternes.push({ id, mois: dv.mois, sourceCompte: sk, destinationCompte: 'courant', montant, jourPrevu: dv.jour, origine: 'juste_besoin' });
                            ajoutes.push({ an: dv.an, id });
                        });
                        calculationTick.value++;
                        //  Ce qui reste à regarder : le compte du salaire sous zéro, les gros virements qui partent du Courant
                        let salaireMin = null;
                        try {
                            const E = ((_buildJournalReleve([], cles) || {}).entries || []).filter(e => e.compteKey === skK && /-(\\d{4})$/.exec(e.cycle) && Number(e.cycle.split('-')[1]) === a && (e.type === 'credit' || e.type === 'debit'));
                            E.forEach(e => { const s = Number(e.soldeCompteApres) || 0; if (!salaireMin || s < salaireMin.montant) salaireMin = { montant: Math.round(s), cycle: e.cycle }; });
                        } catch (e) { /* journal indisponible */ }
                        const d = donneesAnnuelles.value[a];
                        d.alimentationJusteBesoin = { le: _aujourdhuiISO(), salaire: getNomCompte(sk), retires, ajoutes, plan,
                                                      salaireMin: salaireMin && salaireMin.montant < 0 ? salaireMin : null };
                        const total = plan.reduce((s, p) => s + p.montant, 0);
                        addLog('🔄 Courant alimenté au juste besoin (' + a + ') : ' + plan.filter(p => p.montant).map(p => _MOIS_COURTS[p.cycle - 1] + ' ' + formatMAD(p.montant)).join(' · ')
                               + ' — ' + formatMAD(total) + ' au total, ' + retires.length + ' ancien(s) virement(s) remplacé(s).', 'success');
                        handleDataChange();
                        return d.alimentationJusteBesoin;
                    };
                    const annulerAlimentationCourant = (an) => {
                        const d = (donneesAnnuelles.value || {})[an], r = d && d.alimentationJusteBesoin;
                        if (!r) return;
                        (r.ajoutes || []).forEach(x => { const dd = donneesAnnuelles.value[x.an]; if (dd && Array.isArray(dd.virementsInternes)) dd.virementsInternes = dd.virementsInternes.filter(v => v.id !== x.id); });
                        (r.retires || []).forEach(x => { const dd = donneesAnnuelles.value[x.an]; if (!dd) return; if (!Array.isArray(dd.virementsInternes)) dd.virementsInternes = []; dd.virementsInternes.push(x.v); });
                        delete d.alimentationJusteBesoin;
                        calculationTick.value++; addLog('↩️ Alimentation au juste besoin annulée (' + an + ') : les virements d’avant sont revenus.', 'success'); handleDataChange();
                    };
                    //  Les gros virements qui partent du Courant ailleurs que vers le compte du salaire (épargne de fin d'année…) :
                    //  calculés quand le Courant débordait ; une fois alimenté au juste besoin, l'argent est resté sur le compte du salaire
                    const virementsDepuisCourant = (an) => {
                        const ck = cleDeCompte('courant'), sk = compteDuSalaire(an), skK = sk ? cleDeCompte(sk) : null;
                        if (!skK || skK === ck) return [];
                        return (((donneesAnnuelles.value || {})[an] || {}).virementsInternes || []).filter(v => v && cleDeCompte(v.sourceCompte || 'courant') === ck
                            && cleDeCompte(v.destinationCompte || 'courant') !== skK && Math.abs(Number(v.montant) || 0) >= 1000);
                    };
                    const fairePartirDuSalaire = (v, an) => { const sk = compteDuSalaire(an); if (!v || !sk) return; v.sourceCompte = sk; calculationTick.value++; addLog('🔄 Virement de ' + formatMAD(v.montant) + ' : part désormais de ' + getNomCompte(sk) + '.', 'success'); handleDataChange(); };

                    /*  v37.89 — LE CFO DEMANDE, L'APPLI CALCULE. Le CFO dépose une demande (`actionsAppli` sur le serveur) ;
                        au rechargement qui suit l'échange, l'appli l'exécute avec son propre moteur et le dit dans le fil. */
                    const actionsEnAttente = ref([]);
                    const resultatActionsAppli = ref(null);
                    const executerActionsAppli = () => {
                        const L = (actionsEnAttente.value || []).filter(Boolean);
                        actionsEnAttente.value = [];
                        if (!L.length) return null;
                        const fait = [];
                        L.forEach(x => {
                            const an = Number(x.annee) || moisBudgetaire.value.an;
                            try {
                                if (x.tache === 'alimenter_courant') {
                                    const r = alimenterCourantAuJusteBesoin(an);
                                    fait.push(r ? '🔄 Courant alimenté au juste besoin en ' + an + ' : ' + (r.plan.filter(p => p.montant).map(p => p.le + ' → ' + formatMAD(p.montant)).join(', ') || 'aucun virement nécessaire')
                                                  + (r.retires.length ? ' (' + r.retires.length + ' ancien(s) virement(s) remplacé(s))' : '') + (r.salaireMin ? ' — ⚠️ ' + r.salaire + ' passe sous zéro (' + formatMAD(r.salaireMin.montant) + ')' : '')
                                                : '🔄 Alimentation du Courant ' + an + ' : rien à faire.');
                                } else if (x.tache === 'adapter_epargne') {
                                    const n = String(x.nom || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');
                                    const pool = (((donneesAnnuelles.value || {})[an] || {}).epargne || []).filter(Boolean);
                                    const nn = (o) => String(o.nom || o.label || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');
                                    const obj = pool.find(o => nn(o) === n) || pool.find(o => n && (nn(o).includes(n) || n.includes(nn(o))));
                                    if (!obj) { fait.push('⚠️ Épargne « ' + x.nom + ' » introuvable en ' + an + ' : rien adapté.'); return; }
                                    adapterEpargneAuPotentiel(obj, an, Number(x.plafond) > 0 ? Number(x.plafond) : null);
                                    const mo = (obj.adapteePotentiel || {}).mois || {};
                                    fait.push('⚖️ « ' + (obj.nom || obj.label) + ' » adaptée au potentiel en ' + an + ' : ' + Object.entries(mo).map(([m, v]) => _MOIS_COURTS[m - 1] + ' ' + formatMAD(v)).join(' · '));
                                }
                            } catch (e) { fait.push('❌ ' + x.tache + ' : ' + (e.message || e)); }
                        });
                        resultatActionsAppli.value = fait;
                        fait.forEach(t => addLog('🧮 Demande du CFO exécutée par l’appli — ' + t, 'success'));
                        return fait;
                    };
                    watch(actionsEnAttente, (L) => { if (L && L.length) setTimeout(executerActionsAppli, 900); });
                    const sensEpargne = (src, dest) => {""")

# ── 2. Le chargement : les demandes du CFO ────────────────────────────────────────
sub('chargement : demandes du CFO',
"""                            const _vcc = virementsVersCourant(data);            // v37.73 : à chaque chargement""",
"""                            const _vcc = virementsVersCourant(data);            // v37.73 : à chaque chargement
                            if (Array.isArray(data.actionsAppli) && data.actionsAppli.length) actionsEnAttente.value = data.actionsAppli.slice();   // v37.89 : demandes du CFO""")

# ── 3. Le fil du CFO : ce que l'appli a exécuté ───────────────────────────────────
sub('fil du CFO : résultat des demandes',
"""                                           + 'Le serveur a été modifié pendant cet échange : les données affichées viennent d\\'être rechargées depuis le VPS.</div>' });
                                scrollCFOToBottom();""",
"""                                           + 'Le serveur a été modifié pendant cet échange : les données affichées viennent d\\'être rechargées depuis le VPS.</div>' });
                                scrollCFOToBottom();
                                //  v37.89 : les demandes du CFO, exécutées par l'appli avec son moteur
                                if (actionsEnAttente.value.length) executerActionsAppli();
                                const _fait = resultatActionsAppli.value; resultatActionsAppli.value = null;
                                if (_fait && _fait.length) {
                                    cfoMessages.value.push({ role: 'agent', time: new Date().toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'}),
                                        content: '<div data-cfo-actions-appli style="border-left:3px solid #4f46e5;background:#eef2ff;padding:8px 12px;border-radius:8px;font-size:12px">'
                                               + '<b style="color:#3730a3">🧮 Calculé par l’appli (pas par le CFO)</b><br>' + _fait.map(t => String(t).replace(/</g, '&lt;')).join('<br>') + '</div>' });
                                    scrollCFOToBottom();
                                }""")

# ── 4. La lecture du CFO : la date du virement de chaque cycle, et les capacités ──
sub('lecture : date du virement de chaque cycle',
"""                            return { cycle: cycle(mm, aa), entrees_propres_du_courant: entrees_propres, sorties_du_courant: sorties, virements_deja_prevus_vers_courant: virements_deja_prevus,""",
"""                            const _dv = _dateVirementDuCycle(mm, aa);   // v37.89 : la date où poser le virement de CE cycle
                            return { cycle: cycle(mm, aa), virement_a_poser_le: _dv.jour + ' ' + _MOIS_COURTS[_dv.mois - 1] + ' ' + _dv.an + ' (plan_transfer : année ' + _dv.an + ', month ' + _dv.mois + ', day ' + _dv.jour + ') — après la paie, il ouvre ce cycle ; le 28 du mois M appartient au cycle M+1',
                                     entrees_propres_du_courant: entrees_propres, sorties_du_courant: sorties, virements_deja_prevus_vers_courant: virements_deja_prevus,""")
sub('lecture : capacités de l appli',
"""                            alimentation_du_courant: {
                                compte_courant: nom(ck), compte_du_salaire: sk ? nom(sk) : null,""",
"""                            //  v37.89 : ce que l'APPLI sait calculer elle-même — le CFO le demande (app_action), il ne le recalcule pas
                            capacites_de_l_appli: {
                                mode_emploi: 'Appelle app_action : l’appli exécute la demande avec SON moteur juste après ta réponse (rechargement de l’écran) et écrit le résultat dans le fil. Ne calcule pas ces montants toi-même ; annonce que l’appli les calcule.',
                                alimenter_courant: 'task=alimenter_courant, year=AAAA — un virement du compte du salaire vers le Courant à chaque cycle à venir, le jour de paie, du montant EXACT qui garde le Courant ≥ 0 sur tout le cycle (0 s’il n’en faut pas) ; remplace les virements salaire ↔ Courant de ces cycles (allers-retours compris). C’est LA réponse à « alimenter le Courant », « le Courant passe en négatif », « virement de début de cycle ».',
                                adapter_epargne: 'task=adapter_epargne, year=AAAA, name=<ligne d’épargne EXISTANTE>, cap=<plafond facultatif> — exceptions mensuelles = potentiel du mois − les autres lignes, jamais sous zéro, à partir du mois en cours.',
                            },
                            alimentation_du_courant: {
                                compte_courant: nom(ck), compte_du_salaire: sk ? nom(sk) : null,""")

# ── 5. Surplus détaillé : la moyenne hors virements du calendrier ─────────────────
sub('surplus : part des virements du calendrier',
"""                            let ep = 0, epVersee = 0;
                            epArr.forEach(({ obj, sens }) => {""",
"""                            let ep = 0, epVersee = 0, epVir = 0;   // v37.89 : epVir = la part des virements du calendrier
                            epArr.forEach(({ obj, sens }) => {""")
sub('surplus : compte les virements',
"""                                if (!sens || !due) return;
                                ep += sens * due;
                                if (isCurrent) epVersee += sens * (isItemPaid(vir, due, _cleM)""",
"""                                if (!sens || !due) return;
                                ep += sens * due; epVir += sens * due;
                                if (isCurrent) epVersee += sens * (isItemPaid(vir, due, _cleM)""")
sub('surplus : renvoyé',
"""                            return { mNum, brut, epargne: ep, epargneVersee: epVersee, epargneRestante: epRestante, surplusMensuel, net, isPast: false, isCurrent };""",
"""                            return { mNum, brut, epargne: ep, epargneVersee: epVersee, epargneRestante: epRestante, epargneVirements: epVir, surplusMensuel, net, isPast: false, isCurrent };""")
sub('surplus : stats',
"""                            moyNet:     arr.reduce((s, r) => s + r.surplusMensuel, 0) / n,
                            nbMois: n,""",
"""                            moyNet:     arr.reduce((s, r) => s + r.surplusMensuel, 0) / n,
                            //  v37.89 : les virements du calendrier (ponctuels : 63 000 d'un coup en décembre) faussent la moyenne
                            virements:  arr.reduce((s, r) => s + (r.epargneVirements || 0), 0),
                            moyNetHorsVirements: arr.reduce((s, r) => s + r.surplusMensuel + (r.epargneVirements || 0), 0) / n,
                            moisVirements: arr.filter(r => Math.abs(r.epargneVirements || 0) >= 1).map(r => r.mNum),
                            nbMois: n,""")
sub('surplus : ligne affichée',
"""                                    <span class="text-[9px] font-black tabular-nums text-right whitespace-nowrap" :class="surplusStats.moyNet >= 0 ? 'text-blue-300' : 'text-rose-400'">{{ surplusStats.moyNet >= 0 ? '+' : '' }}{{ formatMAD(surplusStats.moyNet) }}""",
"""                                    <span class="text-[9px] font-black tabular-nums text-right whitespace-nowrap" :class="surplusStats.moyNet >= 0 ? 'text-blue-300' : 'text-rose-400'">{{ surplusStats.moyNet >= 0 ? '+' : '' }}{{ formatMAD(surplusStats.moyNet) }}""")
#  la ligne « hors virements » après la ligne Moy.
i = src.index("""<span class="text-[9px] font-black tabular-nums text-right whitespace-nowrap" :class="surplusStats.moyNet >= 0 ? 'text-blue-300' : 'text-rose-400'">""")
j = src.index('</div>', i) + len('</div>')
src = src[:j] + """
                                <!-- v37.89 : la moyenne sans les virements ponctuels du calendrier -->
                                <div v-if="Math.abs(surplusStats.virements || 0) >= 1" data-surplus-hors-virements class="px-3 py-1.5 border-t border-gray-800 text-[9px] font-bold text-indigo-200 leading-snug">
                                    Net moyen <b>hors virements du calendrier</b> : <b :class="surplusStats.moyNetHorsVirements >= 0 ? 'text-blue-300' : 'text-rose-400'">{{ surplusStats.moyNetHorsVirements >= 0 ? '+' : '' }}{{ formatMAD(surplusStats.moyNetHorsVirements) }}</b>
                                    — {{ formatMAD(Math.abs(surplusStats.virements)) }} de virements ponctuels ({{ surplusStats.moisVirements.map(m => nomDuMois(m)).join(', ') }}) comptés comme épargne de ces mois-là : c’est de l’argent accumulé, pas le revenu du mois.
                                </div>""" + src[j:]

# ── 6. L'écran : le bouton, le plan, Annuler, ce qui reste à regarder ─────────────
sub('écran : bloc alimentation',
"""                    <div class="space-y-4">
                        <div v-for="moisNum in 12" :key="moisNum" class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">""",
"""                    <!-- v37.89 : le Courant alimenté au juste besoin -->
                    <div data-alimentation-courant class="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 space-y-2">
                        <div class="flex flex-wrap items-center gap-2">
                            <span class="text-sm font-black text-indigo-900 flex-1 min-w-[200px]">🔄 Alimenter le Courant au juste besoin — {{ anneeAffichage }}</span>
                            <button type="button" data-alimenter-courant @click="alimenterCourantAuJusteBesoin(anneeAffichage)" class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow">{{ (donneesAnnuelles[anneeAffichage] || {}).alimentationJusteBesoin ? '↻ Recalculer' : '🔄 Calculer et poser les virements' }}</button>
                            <button v-if="(donneesAnnuelles[anneeAffichage] || {}).alimentationJusteBesoin" type="button" data-annuler-alimentation @click="annulerAlimentationCourant(anneeAffichage)" class="px-3 py-1.5 rounded-lg bg-white border border-indigo-200 text-indigo-700 text-xs font-black">↩️ Annuler</button>
                        </div>
                        <p class="text-[11px] text-indigo-900/80 font-semibold leading-snug">À chaque cycle à venir, UN virement du compte du salaire vers le Courant, le jour de paie (il ouvre le cycle), du montant qui garde le Courant au-dessus de zéro sur tout le cycle — calculé par le Relevé. Il remplace les virements salaire ↔ Courant de ces cycles, allers-retours compris.</p>
                        <template v-if="(donneesAnnuelles[anneeAffichage] || {}).alimentationJusteBesoin">
                            <div class="flex flex-wrap gap-1.5" data-alimentation-plan>
                                <span v-for="p in donneesAnnuelles[anneeAffichage].alimentationJusteBesoin.plan" :key="'al_' + p.cycle" class="text-[10px] font-black px-2 py-0.5 rounded-full border tabular-nums"
                                      :class="p.montant ? 'bg-white border-indigo-200 text-indigo-800' : 'bg-slate-50 border-slate-200 text-slate-400'">{{ nomDuMois(p.cycle) }} : {{ p.montant ? formatMAD(p.montant) + ' le ' + p.le : 'rien' }}{{ p.impossible ? ' ⚠️ ' + p.impossible : '' }}</span>
                            </div>
                            <p v-if="donneesAnnuelles[anneeAffichage].alimentationJusteBesoin.salaireMin" data-alimentation-salaire-negatif class="text-[11px] font-black text-rose-700">⚠️ {{ donneesAnnuelles[anneeAffichage].alimentationJusteBesoin.salaire }} passe sous zéro ({{ formatMAD(donneesAnnuelles[anneeAffichage].alimentationJusteBesoin.salaireMin.montant) }}) : regardez les gros virements qui en partent.</p>
                        </template>
                        <div v-for="v in virementsDepuisCourant(anneeAffichage)" :key="'vdc_' + v.id" data-virement-depuis-courant class="flex flex-wrap items-center gap-2 text-[11px] font-bold text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                            <span class="flex-1 min-w-[180px]">⚠️ {{ formatMAD(v.montant) }} du Courant vers {{ getNomCompte(v.destinationCompte) }} en {{ nomDuMois(v.mois) }} : calculé quand le Courant débordait ; alimenté au juste besoin, il n’aura plus cet argent.</span>
                            <button type="button" data-faire-partir-du-salaire @click="fairePartirDuSalaire(v, anneeAffichage)" class="px-2 py-0.5 rounded bg-amber-600 text-white text-[10px] font-black">Faire partir de {{ getNomCompte(compteDuSalaire(anneeAffichage)) }}</button>
                        </div>
                    </div>

                    <div class="space-y-4">
                        <div v-for="moisNum in 12" :key="moisNum" class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">""")

sub('exposition', """adapterEpargneAuPotentiel, retirerAdaptationEpargne, """,
    """adapterEpargneAuPotentiel, retirerAdaptationEpargne, alimenterCourantAuJusteBesoin, annulerAlimentationCourant, virementsDepuisCourant, fairePartirDuSalaire, compteDuSalaire, cycleDuVirement, actionsEnAttente, executerActionsAppli, """)

io.open(F, 'w', encoding='utf-8').write(src)
print('✔ v37.89 : appli (juste besoin, demandes du CFO, dates, moyenne hors virements)')

# ── 7. Le moteur du CFO (PHP) : app_action, et pas de virement en double ─────────
P = 'cfo_intent_engine.php'
php = io.open(P, encoding='utf-8').read()
def subp(label, old, new):
    global php
    c = php.count(old)
    if c != 1:
        print(f'✖ {P} — {label} : {c} ancre(s), 1 attendue'); sys.exit(1)
    php = php.replace(old, new)
subp('catalogue : app_action',
"""    'clone_year' => ['desc'=>"Duplique un exercice budgétaire complet.",""",
"""    //  v37.89 : LE CFO DEMANDE, L'APPLI CALCULE — l'appli exécute la tâche avec son propre moteur au rechargement qui suit
    'app_action' => ['desc'=>"Demande à l'APPLI d'exécuter une de ses capacités avec SON moteur (au rechargement de l'écran juste après ta réponse ; le résultat s'écrit dans le fil). task=alimenter_courant : un virement du compte du salaire vers le Courant à chaque cycle à venir de l'année, le jour de paie, du montant exact qui garde le Courant ≥ 0 (remplace les virements salaire ↔ Courant de ces cycles). task=adapter_epargne : la ligne d'épargne `name` adaptée au potentiel de chaque mois (plafond `cap` facultatif). Tu ne calcules pas ces montants.",
        'params'=>[
        'task' => ['type'=>'string','required'=>true,'aliases'=>['tache','action_appli','capacite'],'desc'=>"alimenter_courant | adapter_epargne"],
        'name' => ['type'=>'string','aliases'=>array_merge($A_NOM,['poche','savings_name']),'desc'=>"adapter_epargne : la ligne d'épargne EXISTANTE."],
        'cap'  => ['type'=>'number','aliases'=>['plafond','maximum'],'desc'=>"adapter_epargne : plafond mensuel facultatif (DH)."],
    ]],
    'clone_year' => ['desc'=>"Duplique un exercice budgétaire complet.",""")
subp('traduction : app_action',
"""        case 'clone_year':
            return [cfo_obj(['action'=>'clone_year','category'=>'annee','clone_from_year'=>(int)$num('from_year'),'years'=>[(int)$num('to_year')]])];""",
"""        case 'app_action':   // v37.89
            return [cfo_obj(['action'=>'action_appli','category'=>'appli','target'=>oget($a, 'task'),'tache'=>oget($a, 'task'),
                'nom'=>oget($a, 'name', null),'plafond'=>is_numeric(oget($a, 'cap', null)) ? oget($a, 'cap') + 0 : null,'years'=>$yrs])];
        case 'clone_year':
            return [cfo_obj(['action'=>'clone_year','category'=>'annee','clone_from_year'=>(int)$num('from_year'),'years'=>[(int)$num('to_year')]])];""")
subp('ops : action_appli',
"""        case 'clone_year':
            return [$o(['type'=>'clone_annee','depuis'=>oget($change,'clone_from_year') ?: ($annee - 1),'vers'=>$annee])];""",
"""        case 'action_appli':   // v37.89
            return [$o(['type'=>'action_appli','annee'=>$annee,'tache'=>oget($change,'tache'),'nom'=>oget($change,'nom', null),'plafond'=>oget($change,'plafond', null)])];
        case 'clone_year':
            return [$o(['type'=>'clone_annee','depuis'=>oget($change,'clone_from_year') ?: ($annee - 1),'vers'=>$annee])];""")
subp('application : action_appli + doublon de virement',
"""        /* ── v37.72 : VIREMENT PROGRAMMÉ (virementsInternes) — aucun solde touché ── */
        case 'add_virement_programme': {""",
"""        /* ── v37.89 : UNE DEMANDE À L'APPLI — exécutée par son moteur au rechargement qui suit ── */
        case 'action_appli': {
            $t = cfo_norm_str((string)oget($op, 'tache'));
            $t = strpos($t, 'alim') !== false ? 'alimenter_courant' : (strpos($t, 'epargne') !== false || strpos($t, 'adapt') !== false ? 'adapter_epargne' : $t);
            if (!in_array($t, ['alimenter_courant', 'adapter_epargne'], true)) { $log['status']='error'; $log['reason']='tâche inconnue : '.oget($op,'tache').' (alimenter_courant | adapter_epargne)'; break; }
            if (!$y) { $log['status']='error'; $log['reason']='année absente : '.$a; break; }
            $nom = oget($op, 'nom', null);
            if ($t === 'adapter_epargne') {
                cfo_ep_migrate($y); $pool = oget($y, 'epargne');
                list($ix, $ep) = (is_array($pool) && count($pool) && $nom) ? cfo_ep_find($pool, $nom) : [null, null];
                if (!$ep) { $log['status']='error'; $log['reason']='adapter_epargne : ligne d épargne « '.($nom ?: '?').' » introuvable en '.$a.' (name = une ligne EXISTANTE)'; break; }
                $nom = oget($ep, 'nom') ?: oget($ep, 'label');
            }
            $L = is_array(oget($fd, 'actionsAppli')) ? oget($fd, 'actionsAppli') : [];
            $L = array_values(array_filter($L, fn($x) => !(is_object($x) && oget($x,'tache') === $t && (int)oget($x,'annee') === $a && (string)oget($x,'nom','') === (string)($nom ?? ''))));
            $L[] = cfo_obj(['id'=>cfo_uid(),'tache'=>$t,'annee'=>$a,'nom'=>$nom,'plafond'=>oget($op,'plafond', null),'demande'=>date('c')]);
            oset($fd, 'actionsAppli', $L);
            $log['action_appli'] = ['tache'=>$t,'annee'=>$a,'nom'=>$nom,'execution'=>"par l'appli, avec son moteur, au rechargement de l'écran juste après ta réponse — le résultat s'écrit dans le fil : ne l'annonce pas en chiffres"];
            break;
        }

        /* ── v37.72 : VIREMENT PROGRAMMÉ (virementsInternes) — aucun solde touché ── */
        case 'add_virement_programme': {""")
subp('virement : pas de doublon',
"""            $vir = cfo_obj(['id'=>cfo_uid(),'mois'=>$m,'sourceCompte'=>$src,'destinationCompte'=>$dst,'montant'=>$mt + 0]);""",
"""            //  v37.89 : le MÊME virement (mêmes comptes, même mois, même jour) existe déjà — le reposer le doublerait
            $jj = ($j !== null && (int)$j >= 1 && (int)$j <= 31) ? (int)$j : null;
            foreach ($pool as $v0) {
                if (!is_object($v0) || (int)oget($v0,'mois') !== $m) continue;
                $j0 = oget($v0,'jourPrevu', null); $j0 = $j0 !== null ? (int)$j0 : null;
                if ($j0 === $jj && cfo_cle_compte_epargne((string)oget($v0,'sourceCompte'), $fd) === cfo_cle_compte_epargne($src, $fd)
                    && cfo_cle_compte_epargne((string)oget($v0,'destinationCompte'), $fd) === cfo_cle_compte_epargne($dst, $fd)) {
                    $log['status']='error';
                    $log['reason']='ce virement existe déjà ('.oget($v0,'montant').' DH, mois '.$m.($jj ? ', le '.$jj : '').') : le reposer le DOUBLERAIT. Un virement posé le jour de paie ou après appartient au cycle SUIVANT (le 28 janvier alimente février). Pour alimenter le Courant au juste besoin : app_action task=alimenter_courant.';
                    break 2;
                }
            }
            $vir = cfo_obj(['id'=>cfo_uid(),'mois'=>$m,'sourceCompte'=>$src,'destinationCompte'=>$dst,'montant'=>$mt + 0]);""")
subp('catalogue : nom app_action',
"""'add_one_off_expense','create_account','adjust_account_balance','plan_transfer','set_initial_balance','clone_year',""",
"""'add_one_off_expense','create_account','adjust_account_balance','plan_transfer','set_initial_balance','clone_year','app_action',""")
io.open(P, 'w', encoding='utf-8').write(php)

# ── 8. Les consignes du CFO ──────────────────────────────────────────────────────
C = 'cfo_system_prompt.md'
cs = io.open(C, encoding='utf-8').read()
a = """═══ 1. LA HIÉRARCHIE DE LA VÉRITÉ (RÈGLE ABSOLUE) ═══"""
if cs.count(a) != 1: print('✖ consignes : ancre'); sys.exit(1)
cs = cs.replace(a, """═══ 0bis. L'APPLI CALCULE, TU DEMANDES (RÈGLE ABSOLUE — v37.89) ═══
L'appli a un moteur (Relevé de comptes, cycles de paie, potentiel d'épargne). Tu ne refais JAMAIS ses calculs
de soldes, de virements ou d'épargne : tu lis lecture_moteur, et pour agir tu DEMANDES à l'appli (app_action).
  • « Alimenter le Courant », « le Courant passe en négatif », « virement de début de cycle », « rebalance les
    virements » → app_action task=alimenter_courant year=AAAA. L'appli pose, cycle par cycle, le montant exact
    (0 quand il n'en faut pas) et remplace les anciens virements salaire ↔ Courant. Jamais un plan_transfer
    répété « 9 100 tous les mois ».
  • « Adapter l'épargne à ce que je peux épargner » → app_action task=adapter_epargne name=<ligne EXISTANTE>.
  • Après une app_action, ne donne AUCUN chiffre de résultat : dis que l'appli le calcule et l'écrit dans le fil
    (« 🧮 Calculé par l'appli »). Ne promets jamais un solde que l'appli n'a pas calculé.
  • Un virement posé le jour de paie ou après appartient au cycle SUIVANT : le 28 janvier alimente février. La
    date de chaque cycle se lit dans alimentation_du_courant…virement_a_poser_le. Le moteur refuse un virement
    identique à un virement existant.
  • Un solde, un atterrissage, une fin d'année : lis-le (Relevé, alimentation_du_courant, potentiel_epargne) ou
    dis qu'il n'est pas dans la lecture. Jamais d'estimation présentée comme un chiffre de l'appli.

""" + a)
io.open(C, 'w', encoding='utf-8').write(cs)
print('✔ v37.89 : moteur du CFO (app_action, doublon refusé) et consignes')
