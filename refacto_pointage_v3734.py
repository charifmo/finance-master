# -*- coding: utf-8 -*-
"""
v37.34 Pointage-Sans-Double — un flux pointé n'est plus projeté ; la checklist
se range en tiroirs.

  1. LE DOUBLE COMPTAGE. Une entrée exceptionnelle se saisit en négatif
     (« Prime exceptionnelle » : − 23 781). La case de la checklist la pointait
     AVEC son signe ({ paye: true, montantPaye: − 23 781 }) ; le moteur du Relevé
     raisonne en valeur absolue et lisait « − 23 781 réglés sur 23 781 » : pas
     réglée, reste 23 781 − (− 23 781) = 47 562. La prime, déjà dans le solde
     d'aujourd'hui, était projetée une seconde fois — et doublée.
       • isItemPaid / getPaidAmount comparent des MONTANTS (valeur absolue) ; le
         réglé revient avec le signe du dû demandé. Même réponse quel que soit
         l'écran qui pose la question — et les pointages déjà enregistrés avec
         un signe se lisent juste, sans migration.
       • toggleItemPaid / setMontantPayeCycle enregistrent un montant positif.
       • Un flux exceptionnel pointé sort des « chocs à venir » MÊME s'il était
         prévu pour un cycle futur (reçu ou payé en avance) : le Relevé (radar
         jusqu'en décembre) et le tableau Surplus ne le reprojettent plus.

  2. LES ENTRÉES S'AFFICHENT EN ENTRÉES. Une rentrée exceptionnelle s'affichait
     « − 23 781 DH » dans la checklist : elle s'affiche en vert, « + 23 781 DH ».

  3. LA CHECKLIST EN TIROIRS. La file « À traiter » se range par nature — un
     tiroir par famille (Entrées d'Argent, Charges fixes, Charges variables,
     Épargne & virements, Flux exceptionnels), fermé d'office — son en-tête dit
     combien, en retard, sous 7 jours, et le montant —, mémorisé (v37.32), et qui
     ne montre que ce qui RESTE à faire. La carte « Urgence » ouvre les tiroirs
     qui portent l'urgent. Ce qui est pointé part dans « ✅ Déjà validé », en bas, replié et
     grisé (on y décoche pour remettre à traiter). Les doublons d'en bas
     (« Entrées d'Argent » et « Vue détaillée par catégorie ») disparaissent :
     chaque ligne n'existe plus qu'à un endroit.
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
def tranche(label, debut, fin, doit_contenir):
    """Le texte entre deux ancres uniques (début inclus, fin exclue), vérifié."""
    if src.count(debut) != 1 or src.count(fin) < 1:
        print(f'✖ {label} : ancres introuvables'); sys.exit(1)
    i = src.index(debut); j = src.index(fin, i)
    t = src[i:j]
    for m in doit_contenir:
        if m not in t: print(f'✖ {label} : « {m} » absent de la tranche'); sys.exit(1)
    return t

# ══ 1. LE POINTAGE N'A PAS DE SIGNE ══════════════════════════════════════════
sub('isItemPaid / getPaidAmount', r"""                    const isItemPaid = (item, dueAmount, cle) => {
                        const e = _etatCycle(item, cle);
                        if (!e) return false;
                        if (e.paye && !e.montantPaye) return true;
                        // Injection de cash (montant négatif) : on se fie à la case, pas au montant.
                        if (dueAmount < 0) return e.paye === true;
                        return Number(e.montantPaye || 0) >= dueAmount;
                    };

                    const getPaidAmount = (item, dueAmount, cle) => {
                        const e = _etatCycle(item, cle);
                        if (!e) return 0;
                        if (e.paye && !e.montantPaye) return dueAmount;
                        if (e.montantPaye !== undefined && e.montantPaye !== null) return Number(e.montantPaye);
                        return e.paye ? dueAmount : 0;
                    };
""", r"""                    //  v37.34 — UN POINTAGE N'A PAS DE SIGNE. Une entrée exceptionnelle se
                    //  saisit en négatif (− 23 781) ; la case la pointait avec son signe, le
                    //  moteur du Relevé la relisait en valeur absolue : « − 23 781 réglés sur
                    //  23 781 », donc pas réglée, reste 23 781 − (− 23 781) = 47 562 — la
                    //  prime comptée deux fois. On compare désormais des MONTANTS, et le
                    //  réglé revient avec le signe du dû demandé : même réponse quel que soit
                    //  l'écran, pointages déjà enregistrés compris.
                    const isItemPaid = (item, dueAmount, cle) => {
                        const e = _etatCycle(item, cle);
                        if (!e) return false;
                        if (e.paye && !e.montantPaye) return true;
                        return Math.abs(Number(e.montantPaye) || 0) >= Math.abs(Number(dueAmount) || 0);
                    };

                    const getPaidAmount = (item, dueAmount, cle) => {
                        const e = _etatCycle(item, cle);
                        if (!e) return 0;
                        if (e.paye && !e.montantPaye) return dueAmount;
                        if (e.montantPaye !== undefined && e.montantPaye !== null)
                            return (Number(dueAmount) < 0 ? -1 : 1) * Math.abs(Number(e.montantPaye) || 0);
                        return e.paye ? dueAmount : 0;
                    };
""")
sub('toggleItemPaid : un montant positif', r"""                            : { paye: true, montantPaye: dueAmount, dateReelle: _aujourdhuiISO() });""",
    r"""                            : { paye: true, montantPaye: Math.abs(Number(dueAmount) || 0), dateReelle: _aujourdhuiISO() });""")
sub('montantPayeCycle : un montant positif', r"""                        return e ? Number(e.montantPaye || 0) : 0;
                    };
                    const setMontantPayeCycle = (item, valeur, cle) => {
                        const e = _etatCycle(item, cle) || { paye: false };
                        const v = Number(valeur) || 0;""", r"""                        return e ? Math.abs(Number(e.montantPaye) || 0) : 0;
                    };
                    const setMontantPayeCycle = (item, valeur, cle) => {
                        const e = _etatCycle(item, cle) || { paye: false };
                        const v = Math.abs(Number(valeur) || 0);""")

# ══ 2. UN FLUX POINTÉ N'EST PLUS UN CHOC À VENIR — même prévu pour plus tard ══
sub('relevé : flux exceptionnel pointé', r"""                                let amt;
                                if (mode === 'full') amt = due;
                                else { if (isItemPaid(dep, due, _cyc)) amt = 0; else { const r = due - (getPaidAmount(dep, due, _cyc) || 0); amt = r > 0 ? r : 0; } }""",
    r"""                                //  v37.34 : un flux exceptionnel pointé est DÉJÀ dans le solde d'aujourd'hui
                                //  — même prévu pour un cycle futur (reçu ou payé en avance) : il ne fait
                                //  plus partie des chocs à venir, ni ce cycle ni plus tard.
                                let amt;
                                if (isItemPaid(dep, due, _cyc)) amt = 0; else { const r = due - (getPaidAmount(dep, due, _cyc) || 0); amt = r > 0 ? r : 0; }""")
sub('surplus : flux exceptionnel pointé', r"""                            let a;
                            if (mode === 'full') a = due;
                            else { if (isItemPaid(dep, due)) a = 0; else { const r = due - (getPaidAmount(dep, due)||0); a = r > 0 ? r : 0; } }""",
    r"""                            let a;   // v37.34 : pointé = déjà dans le solde, même en avance
                            if (isItemPaid(dep, due)) a = 0; else { const r = due - (getPaidAmount(dep, due)||0); a = r > 0 ? r : 0; }""")

# ══ 3. LES TIROIRS : entrées, tiroirs par nature, déjà validé, suspendus ═════
sub('calculs des tiroirs', r"""                    const tachesSansDate = computed(() => tachesATraiter.value.filter(t => !t.jourPrevu).length);
""", r"""                    const tachesSansDate = computed(() => tachesATraiter.value.filter(t => !t.jourPrevu).length);

                    /* ═══════════════════════════════════════════════════════════
                       v37.34 — LE POINTAGE EN TIROIRS
                       « Un immense parchemin où tout est mélangé. » La file se range par
                       NATURE — un tiroir par famille, fermé d'office (son en-tête dit
                       combien, en retard, sous 7 jours, et le montant), mémorisé (v37.32)
                       — et ne montre que ce qui RESTE à faire. Ce qui est pointé part
                       dans « Déjà validé ». La carte « Urgence » ouvre les tiroirs urgents.
                       Les ENTRÉES (revenus, entrées exceptionnelles) ne sont pas des
                       tâches : rien à décaisser, ni l'Urgence ni la Progression ne les
                       comptent. Elles se pointent pourtant au même endroit, en vert.
                       ═══════════════════════════════════════════════════════════ */
                    const entreesPilotageToutes = computed(() => {
                        calculationTick.value;
                        const an = pilotageViewedAn.value, mois = pilotageViewedMois.value, cyc = cyclePilotage.value;
                        const rAuj = _rangAujourdhui.value;
                        const out = [];
                        const pousser = (ref, cle, libelle, montant, jourPrevu, nature) => {
                            const d = Math.abs(Number(montant) || 0);
                            if (d <= 0) return;                  // suspendu ce mois → hors liste
                            const rang = _rangDansCycle(jourPrevu);
                            out.push({
                                cle, ref, libelle: libelle || '(sans nom)', due: d, sens: 'credit', nature,
                                groupe: nature === 'revenu' ? 'Revenu' : 'Flux exceptionnel',
                                badge: nature === 'revenu' ? '💰 Revenu' : '💚 Entrée',
                                compte: compteDeFlux(nature, ref),
                                jourPrevu: Number(jourPrevu) || null, rang,
                                retard: rang < rAuj, proche: rang >= rAuj && rang <= rAuj + HORIZON_URGENCE,
                                paye: isItemPaid(ref, d, cyc), regle: getPaidAmount(ref, d, cyc) || 0,
                                quand: dateReelleCycle(ref, cyc),
                            });
                        };
                        revenusBudgetairesTries.value.forEach((rev, i) =>
                            pousser(rev, 'Revenu:' + i + ':' + (rev.label || ''), rev.label, getDueRevenu(rev, an, mois), rev.jourPrevu, 'revenu'));
                        //  Une entrée exceptionnelle = un montant NÉGATIF dans le Calendrier.
                        getDepensesCycle(mois, an).forEach(dep => {
                            if (Number(dep.montant) < 0)
                                pousser(dep, 'Entrée exceptionnelle:' + (dep.id != null ? dep.id : dep.nom), dep.nom, dep.montant, dep.jourPrevu, 'exceptionnel');
                        });
                        return out.sort((a, b) => a.rang - b.rang || a.libelle.localeCompare(b.libelle));
                    });
                    const entreesPilotage = computed(() => focusCompte.value
                        ? entreesPilotageToutes.value.filter(e => e.compte === focusCompte.value)
                        : entreesPilotageToutes.value);
                    const TIROIRS_POINTAGE = [
                        { cle: 'entrees',      titre: "🟢 Entrées d'Argent",    barre: 'bg-emerald-400' },
                        { cle: 'fixe',         titre: '🏢 Charges fixes',       barre: 'bg-orange-400' },
                        { cle: 'variable',     titre: '🛒 Charges variables',   barre: 'bg-sky-400' },
                        { cle: 'epargne',      titre: '💎 Épargne & virements', barre: 'bg-violet-400' },
                        { cle: 'exceptionnel', titre: '⚡ Flux exceptionnels',  barre: 'bg-rose-400' },
                    ];
                    //  Les entrées exceptionnelles restent avec les flux exceptionnels :
                    //  c'est là qu'on les cherche — en vert, « + ».
                    const _lignesDuTiroir = (cle) => cle === 'entrees'
                        ? entreesPilotage.value.filter(e => e.nature === 'revenu')
                        : tachesPilotage.value.filter(t => t.nature === cle)
                            .concat(cle === 'exceptionnel' ? entreesPilotage.value.filter(e => e.nature === 'exceptionnel') : []);
                    const tiroirsPilotage = computed(() => TIROIRS_POINTAGE.map(T => {
                        const toutes = _lignesDuTiroir(T.cle);
                        const aFaire = toutes.filter(t => !t.paye)
                            .sort((a, b) => a.rang - b.rang || a.libelle.localeCompare(b.libelle));
                        const reste = (sens) => Math.round(aFaire.filter(t => (t.sens || 'debit') === sens)
                            .reduce((s, t) => s + Math.max(0, t.due - (t.regle || 0)), 0));
                        return { ...T, aFaire, faits: toutes.length - aFaire.length,
                                 aPayer: reste('debit'), aEncaisser: reste('credit'),
                                 retard: aFaire.filter(t => t.retard).length,
                                 proche: aFaire.filter(t => t.proche).length,
                                 urgent: aFaire.some(t => t.retard || t.proche) };
                    }).filter(T => T.aFaire.length));
                    const dejaValidePilotage = computed(() => {
                        const lignes = TIROIRS_POINTAGE.flatMap(T => _lignesDuTiroir(T.cle).filter(t => t.paye)
                            .sort((a, b) => a.rang - b.rang || a.libelle.localeCompare(b.libelle)));
                        const somme = (sens) => Math.round(lignes.filter(t => (t.sens || 'debit') === sens).reduce((s, t) => s + (t.regle || t.due), 0));
                        return { lignes, regle: somme('debit'), encaisse: somme('credit') };
                    });
                    //  Ce qui est suspendu ce mois (exception à 0) : dit en une ligne.
                    const suspendusPilotage = computed(() => {
                        calculationTick.value;
                        const an = pilotageViewedAn.value, mois = pilotageViewedMois.value;
                        const noms = [];
                        const voir = (base, due, nom) => { if (Number(base) > 0 && !(Number(due) > 0) && nom) noms.push(nom); };
                        revenusBudgetairesTries.value.forEach(r => voir(r.base, getDueRevenu(r, an, mois), r.label));
                        chargesFixesBudgetairesTriees.value.forEach(f => voir(f.valeur, getDueFixe(f, an, mois), f.label));
                        epargneBudgetairePilotage.value.forEach(ep => voir(ep.valeur, getDueFixe(ep, an, mois), ep.nom || ep.label));
                        return noms;
                    });
""")
sub('urgence : ouvre les tiroirs urgents', r"""                    const allerAInbox = () => {
                        const el = document.getElementById('pilotage-inbox');
                        if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    };""", r"""                    const allerAInbox = () => {
                        //  v37.34 : la file est en tiroirs — ceux qui portent l'urgence s'ouvrent.
                        tiroirsPilotage.value.filter(T => T.urgent).forEach(T => uiFixer('pilotage.tiroir.' + T.cle, true));
                        nextTick(() => {
                            const el = document.getElementById('pilotage-inbox');
                            if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        });
                    };""")
sub('exports', r"""                        resteATraiterPilotage, totalTraitePilotage, pilotageTermineOuvert, revenusRestantsPilotage,
""", r"""                        resteATraiterPilotage, totalTraitePilotage, pilotageTermineOuvert, revenusRestantsPilotage,
                        entreesPilotage, tiroirsPilotage, dejaValidePilotage, suspendusPilotage,
""")

# ══ 4. LE GABARIT : compteur, tiroirs, déjà validé ══════════════════════════
sub('compteur « faits »', r"""                                    <span :class="['text-[10px] px-2.5 py-1 rounded-lg font-black border', tachesATraiter.length === 0 && tachesPilotage.length > 0 ? 'bg-green-900/50 border-green-500 text-green-400' : 'bg-slate-900 border-slate-600 text-blue-300']">
                                        {{ tachesTerminees.length }} / {{ tachesPilotage.length }} faits
                                    </span>""", r"""                                    <span data-pointage-compteur :class="['text-[10px] px-2.5 py-1 rounded-lg font-black border', !tiroirsPilotage.length && dejaValidePilotage.lignes.length ? 'bg-green-900/50 border-green-500 text-green-400' : 'bg-slate-900 border-slate-600 text-blue-300']">
                                        {{ dejaValidePilotage.lignes.length }} / {{ tachesPilotage.length + entreesPilotage.length }} faits
                                    </span>""")

ancienne_file = tranche('file par urgence',
    "                                <!-- Inbox Zero : plus rien à faire -->\n",
    "                            </div>\n                        </div>\n\n                        <!-- v37.18 : la sécurité des comptes jusqu'en décembre",
    ['tachesGroupees', 'data-paquet', '✅ Terminé', 'pilotageTermineOuvert'])
COULEUR_LIGNE = """t.sens === 'credit' ? 'from-emerald-500/10 via-slate-900 to-slate-900 border-emerald-500/25 hover:border-emerald-400/60'
                                                      : (t.nature === 'fixe' ? 'from-orange-500/10 via-slate-900 to-slate-900 border-orange-500/20 hover:border-orange-400/60'
                                                      : (t.nature === 'variable' ? 'from-sky-500/10 via-slate-900 to-slate-900 border-sky-500/20 hover:border-sky-400/60'
                                                      : (t.nature === 'epargne' ? 'from-violet-500/10 via-slate-900 to-slate-900 border-violet-500/20 hover:border-violet-400/60'
                                                      : 'from-rose-500/10 via-slate-900 to-slate-900 border-rose-500/20 hover:border-rose-400/60')))"""
nouvelle_file = """                                <!-- Inbox Zero : plus rien à faire -->
                                <div v-if="!tiroirsPilotage.length" data-pointage-zero class="text-center py-10">
                                    <p class="text-4xl mb-3">✅</p>
                                    <p class="text-sm font-black text-green-400 uppercase tracking-widest">Tout est traité</p>
                                    <p class="text-[11px] text-slate-400 font-bold mt-1">
                                        {{ dejaValidePilotage.lignes.length }} élément(s) pointé(s) sur {{ pilotageCycleLabel }}.
                                        Le prochain cycle repartira à zéro.
                                    </p>
                                </div>

                                <!-- 🗂️ v37.34 : UN TIROIR PAR NATURE, seulement ce qui RESTE à faire.
                                     Fermés d'office : l'en-tête dit tout (combien, en retard, sous
                                     7 jours, le montant). Ouvert / fermé est mémorisé (v37.32) ; la
                                     carte « Urgence » ouvre ceux qui portent l'urgent. -->
                                <div v-else data-tiroirs class="space-y-2.5">
                                    <details v-for="T in tiroirsPilotage" :key="'tir_' + T.cle" :data-tiroir="T.cle"
                                             :open="uiOuvert('pilotage.tiroir.' + T.cle, false)" @toggle="uiFixer('pilotage.tiroir.' + T.cle, $event.target.open)"
                                             class="group rounded-2xl border border-slate-700 bg-slate-900/40 overflow-hidden">
                                        <summary class="flex items-stretch gap-2.5 md:gap-3 px-3 md:px-4 py-3 cursor-pointer select-none hover:bg-slate-700/30 transition-colors">
                                            <span aria-hidden="true" :class="['shrink-0 w-1.5 rounded-full', T.barre]"></span>
                                            <span class="min-w-0 flex-1">
                                                <!-- Le titre et le montant sur une ligne : les pastilles ont toute la largeur dessous -->
                                                <span class="flex items-start justify-between gap-3">
                                                    <span class="min-w-0 text-sm font-black text-white leading-snug" data-tiroir-titre>{{ T.titre }}</span>
                                                    <span class="shrink-0 text-right leading-tight tabular-nums whitespace-nowrap">
                                                        <span v-if="T.aEncaisser" data-tiroir-encaisser class="block text-sm font-black text-emerald-300">+ {{ formatMAD(T.aEncaisser) }}</span>
                                                        <span v-if="T.aPayer" data-tiroir-payer class="block text-sm font-black text-slate-100">{{ formatMAD(T.aPayer) }}</span>
                                                    </span>
                                                </span>
                                                <span class="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-slate-400">
                                                    <span data-tiroir-nb>{{ T.aFaire.length }} {{ T.cle === 'entrees' ? 'à encaisser' : 'à traiter' }}</span>
                                                    <span v-if="T.retard" data-tiroir-retard class="px-1.5 py-px rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/40 font-black">⚠️ {{ T.retard }} en retard</span>
                                                    <span v-if="T.proche" data-tiroir-proche class="px-1.5 py-px rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/40 font-black">⏳ {{ T.proche }} sous 7 j</span>
                                                </span>
                                            </span>
                                            <span aria-hidden="true" class="shrink-0 self-center text-slate-500 text-xs transition-transform group-open:rotate-180">▾</span>
                                        </summary>
                                        <transition-group tag="div" name="tache" class="px-2 md:px-3 pb-3 pt-1 space-y-1.5">
                                            <div v-for="t in T.aFaire" :key="t.cle" :data-tache="t.sens === 'credit' ? null : ''" :data-entree="t.sens === 'credit' ? '' : null" :data-nature-ligne="t.nature"
                                                 :class="['relative flex flex-wrap items-center gap-x-3 gap-y-2 pl-4 pr-3 py-3 rounded-2xl border bg-gradient-to-r shadow-md shadow-black/20 transition-all duration-200 hover:shadow-xl hover:shadow-black/30',
                                                      """ + COULEUR_LIGNE + """,
                                                      surbrillanceEchues && estEchue(t) ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-800' : '']">
                                                <span aria-hidden="true" :class="['absolute left-0 top-3 bottom-3 w-1 rounded-r-full',
                                                      t.sens === 'credit' ? 'bg-emerald-400' : (t.nature === 'fixe' ? 'bg-orange-400' : (t.nature === 'variable' ? 'bg-sky-400' : (t.nature === 'epargne' ? 'bg-violet-400' : 'bg-rose-400')))]"></span>
                                                <label class="flex items-center gap-2.5 cursor-pointer flex-1 min-w-[12rem]">
                                                    <input type="checkbox" :checked="false"
                                                           @change="toggleItemPaid(t.ref, t.due, cyclePilotage)"
                                                           :title="t.sens === 'credit' ? 'Pointer comme reçu' : 'Pointer comme payé'"
                                                           class="w-5 h-5 accent-emerald-500 cursor-pointer shrink-0 transition-transform hover:scale-110"/>
                                                    <span v-if="t.sens === 'credit' && t.nature === 'exceptionnel'" data-entree-badge
                                                          class="text-[10px] font-black px-1.5 py-0.5 rounded-md border shrink-0 whitespace-nowrap bg-emerald-500/15 text-emerald-300 border-emerald-500/50">💚 Entrée</span>
                                                    <span class="text-sm font-bold text-slate-100 min-w-0 break-words md:truncate" data-tache-nom>{{ t.libelle }}</span>
                                                    <span v-if="t.nature === 'variable'" data-tache-groupe class="text-[9px] text-slate-500 font-bold uppercase tracking-widest shrink-0">{{ t.groupe }}</span>
                                                    <span v-if="estEchue(t)" data-chip-echue title="Comprise dans « Valider les charges échues »"
                                                          class="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 whitespace-nowrap shrink-0">⚡ échue</span>
                                                </label>
                                                <div class="flex flex-wrap items-center justify-end gap-2 ml-auto">
                                                    <chip-compte :m="mecaniqueCompte(t.compte)" :regle="regleDeRoutage(t.sens === 'credit' ? (t.nature === 'revenu' ? 'revenu' : 'injection') : t.nature, t.ref)" :cle="'route:' + t.cle" :ouverte="bulleOuverte === 'route:' + t.cle" :format-mad="formatMAD" sombre :sens="t.sens === 'credit' ? 'credit' : 'debit'"
                                                                 @survol="survolBulle('route:' + t.cle, $event)" @quitter="quitterBulle('route:' + t.cle, $event)" @basculer="basculerBulle('route:' + t.cle)"></chip-compte>
                                                    <span v-if="t.jourPrevu"
                                                          :class="['text-[10px] font-black px-1.5 py-0.5 rounded-full border shrink-0',
                                                                   t.retard ? 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                                                                   : (t.proche ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                                                                   : 'bg-slate-700/40 text-slate-400 border-slate-600/50')]">📅 j.{{ t.jourPrevu }}</span>
                                                    <span v-else class="text-[10px] font-black px-1.5 py-0.5 rounded-full border border-dashed border-slate-600 text-slate-500 shrink-0"
                                                          title="Aucune date de prélèvement sur cette ligne — renseignez « jour prévu » dans le Budget Structurel pour la classer">📅 sans date</span>
                                                    <!-- v37.17 : le variable et l'exceptionnel se SAISISSENT ; le fixe se COCHE (saisie
                                                         discrète, pour une avance) ; une entrée exceptionnelle peut être reçue en partie. -->
                                                    <div v-if="t.sens !== 'credit' || t.nature === 'exceptionnel'" class="relative">
                                                        <input type="number" inputmode="decimal" min="0"
                                                               :value="montantPayeCycle(t.ref, cyclePilotage) || ''"
                                                               @input="setMontantPayeCycle(t.ref, $event.target.value, cyclePilotage)"
                                                               :data-saisie="t.sens !== 'credit' && (t.nature === 'variable' || t.nature === 'exceptionnel') ? 'invitante' : 'discrete'"
                                                               :placeholder="t.sens === 'credit' ? 'reçu' : ((t.nature === 'variable' || t.nature === 'exceptionnel') ? 'Saisir' : 'avance')"
                                                               :title="t.sens === 'credit' ? 'Déjà reçu, en partie' : ((t.nature === 'variable' || t.nature === 'exceptionnel') ? 'Saisissez ce qui a vraiment été payé' : 'Avance partielle déjà versée')"
                                                               :class="t.sens === 'credit'
                                                                   ? 'w-16 h-8 bg-transparent border border-emerald-700/60 hover:border-emerald-500 rounded-lg px-2 text-right text-xs font-bold text-emerald-200 placeholder:text-emerald-700 outline-none focus:border-emerald-400 transition'
                                                                   : (t.nature === 'variable'
                                                                   ? 'w-36 h-10 bg-slate-950 border-2 border-sky-500/40 rounded-xl pl-3 pr-9 text-right text-sm font-black text-sky-100 placeholder:text-sky-300/50 placeholder:font-semibold outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-500/20 transition'
                                                                   : (t.nature === 'exceptionnel'
                                                                   ? 'w-36 h-10 bg-slate-950 border-2 border-rose-500/40 rounded-xl pl-3 pr-9 text-right text-sm font-black text-rose-100 placeholder:text-rose-300/50 placeholder:font-semibold outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-500/20 transition'
                                                                   : 'w-16 h-8 bg-transparent border border-slate-700/60 hover:border-slate-500 rounded-lg px-2 text-right text-xs font-bold text-slate-400 placeholder:text-slate-600 outline-none focus:border-slate-400 transition'))"/>
                                                        <span v-if="t.sens !== 'credit' && (t.nature === 'variable' || t.nature === 'exceptionnel')" aria-hidden="true"
                                                              :class="['pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black', t.nature === 'variable' ? 'text-sky-300/70' : 'text-rose-300/70']">DH</span>
                                                    </div>
                                                    <span v-if="t.sens === 'credit'" data-entree-montant class="text-sm font-black text-emerald-300 tabular-nums whitespace-nowrap">+ {{ formatMAD(t.due) }}</span>
                                                    <span v-else class="text-[10px] font-black text-slate-400 w-16 text-right tabular-nums">/ {{ formatNombre(t.due) }}</span>
                                                </div>
                                            </div>
                                        </transition-group>
                                    </details>
                                    <p v-if="suspendusPilotage.length" data-suspendus class="px-1 text-[10px] font-bold text-slate-500 leading-snug">
                                        ⏸️ Suspendu{{ suspendusPilotage.length > 1 ? 's' : '' }} ce mois : {{ suspendusPilotage.join(' · ') }}
                                    </p>
                                </div>

                                <!-- ✅ v37.34 : DÉJÀ VALIDÉ — tout ce qui est pointé, à l'écart, replié et grisé.
                                     Décocher une ligne la remet dans son tiroir. -->
                                <details v-if="dejaValidePilotage.lignes.length" data-deja-valide
                                         :open="uiOuvert('pilotage.terminees', false)" @toggle="uiFixer('pilotage.terminees', $event.target.open)"
                                         class="group rounded-2xl border border-slate-700/70 bg-slate-900/30 overflow-hidden">
                                    <summary class="flex items-center justify-between gap-3 px-3 md:px-4 py-2.5 cursor-pointer select-none hover:bg-slate-800/60 transition-colors">
                                        <span class="text-[10px] font-black uppercase tracking-widest text-green-400" data-deja-valide-titre>✅ Déjà validé ({{ dejaValidePilotage.lignes.length }})</span>
                                        <span class="flex items-center gap-2 shrink-0 text-[10px] font-black tabular-nums">
                                            <span v-if="dejaValidePilotage.encaisse" class="text-emerald-400/80">+ {{ formatMAD(dejaValidePilotage.encaisse) }}</span>
                                            <span v-if="dejaValidePilotage.regle" class="text-slate-400">{{ formatMAD(dejaValidePilotage.regle) }} réglés</span>
                                            <span aria-hidden="true" class="text-slate-500 text-xs transition-transform group-open:rotate-180">▾</span>
                                        </span>
                                    </summary>
                                    <div class="px-3 pb-3 pt-2 space-y-1 border-t border-slate-800">
                                        <div v-for="t in dejaValidePilotage.lignes" :key="'ok_' + t.cle" data-valide :data-nature-ligne="t.nature"
                                             class="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-slate-900/70 border border-slate-800 opacity-70 hover:opacity-100 transition-opacity">
                                            <label class="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                                                <input type="checkbox" :checked="true" @change="toggleItemPaid(t.ref, t.due, cyclePilotage)" title="Décocher : remettre à traiter"
                                                       class="w-4 h-4 accent-emerald-500 cursor-pointer shrink-0"/>
                                                <span data-badge-nature :data-nature="t.nature" class="text-[9px] font-black text-slate-500 shrink-0 whitespace-nowrap">{{ t.badge }}</span>
                                                <span data-valide-nom class="text-xs font-bold text-slate-400 line-through truncate">{{ t.libelle }}</span>
                                                <span v-if="t.quand" class="hidden sm:inline text-[9px] text-slate-600 font-bold shrink-0">le {{ t.quand }}</span>
                                            </label>
                                            <span data-valide-montant :class="['text-xs font-black shrink-0 tabular-nums', t.sens === 'credit' ? 'text-emerald-400' : 'text-slate-400']">{{ t.sens === 'credit' ? '+ ' : '' }}{{ formatMAD(t.regle || t.due) }}</span>
                                        </div>
                                    </div>
                                </details>
"""
src = src.replace(ancienne_file, nouvelle_file, 1)

# ══ 5. Les doublons d'en bas (« Entrées d'Argent », « Vue détaillée ») s'en vont ══
anciennes_refs = tranche('références d\'en bas',
    "                        <!-- ═══ v37.13 : références, en bas et repliées ═══════════════\n",
    "                    </div>\n\n                    <div v-else class=\"bg-yellow-50 p-6 rounded-[2rem]",
    ["pilotage.entrees", "Vue détaillée par catégorie", "⚠️ Flux Exceptionnels — {{ pilotageCycleLabel }}"])
src = src.replace(anciennes_refs, """                        <!-- v37.34 : « Entrées d'Argent » et « Vue détaillée par catégorie » ont
                             rejoint les tiroirs de « À traiter » : une ligne n'existe plus
                             qu'à un endroit — à faire dans son tiroir, faite dans « Déjà validé ». -->
""", 1)

# ══ 6. L'ancienne checklist du Prévisionnel (téléphone) : une entrée en « + » vert ══
sub('checklist mobile : entrée en +', r"""<span class="text-[10px] text-slate-400 font-black w-20 text-right">/ {{ formatMAD(dep.montant).replace(' DH', '') }} DH</span>""",
    r"""<span :class="['text-[10px] font-black w-20 text-right', Number(dep.montant) < 0 ? 'text-emerald-400' : 'text-slate-400']">{{ Number(dep.montant) < 0 ? '+ ' + formatMAD(-Number(dep.montant)) : '/ ' + formatMAD(dep.montant) }}</span>""")

for a, r, n in edits: src = src.replace(a, r, n)
io.open(F, 'w', encoding='utf-8').write(src)
print(f'✔ {len(edits)} modifications + file en tiroirs + références retirées, appliquées à {F}')
