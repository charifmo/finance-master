# -*- coding: utf-8 -*-
"""
v37.16 Cockpit-Pilotage — PARTIE GABARIT (onglet activeTab === 'pilotage').

À jouer APRÈS refacto_cockpit_js_v3716.py (il expose kpiUrgence, kpiProgression,
kpiAtterrissage, atterrissageCycle, chargesFixesEchues, bulleOuverte…).

Ce qui change à l'écran :
  - l'en-tête (jauge, 3 cartes, 4 cartes de comptes, 8 infobulles au survol)
    devient UNE ligne + TROIS chiffres : Urgence, Progression, Atterrissage ;
  - les infobulles : une seule ouverte à la fois, opaque, qui capte le
    pointeur (relative + absolute z-[200] shadow-2xl), au survol ou au tap ;
  - « À traiter » : badges de nature, total par paquet, validation en un clic
    des charges fixes échues (annulable) ;
  - les comptes, le budget conso et les références descendent, repliés.

Ce qui NE change PAS : le tracker des créances, en dessous, intact.
Ancres vérifiées avant écriture.
"""
import io, sys

F = 'index.html'
src = io.open(F, encoding='utf-8').read()

DEBUT = """                <div v-if="activeTab === 'pilotage'" class="max-w-4xl mx-auto space-y-6">\n"""
FIN = """                    <!-- ══════════════════════════════════════════════════════ -->\n                    <!-- v20.98 — TRACKER ASSURANCES                          -->\n"""
for nom, a in (('début onglet', DEBUT), ('tracker assurances', FIN)):
    n = src.count(a)
    if n != 1:
        print(f'✖ {nom} : {n} ancre(s), 1 attendue')
        sys.exit(1)
i, j = src.index(DEBUT), src.index(FIN)
if j <= i:
    print('✖ ordre des ancres inattendu'); sys.exit(1)

# ─── Composition d'un compte (réutilisée par la bulle KPI et les cartes comptes) ───
def composition(var):
    return f"""<div class="space-y-1">
                                            <div class="flex justify-between gap-3"><span class="text-slate-400">Solde aujourd'hui</span><span class="font-black text-white tabular-nums">{{{{ formatMAD({var}.t0) }}}}</span></div>
                                            <div class="flex justify-between gap-3"><span class="text-sky-300">+ Entrées du cycle</span><span class="font-black text-sky-200 tabular-nums">+ {{{{ formatMAD({var}.entrees) }}}}</span></div>
                                            <div class="flex justify-between gap-3"><span class="text-orange-300">− Sorties du cycle</span><span class="font-black text-orange-200 tabular-nums">− {{{{ formatMAD({var}.sorties) }}}}</span></div>
                                            <div :class="['flex justify-between gap-3 rounded-lg px-2.5 py-1.5 font-black mt-1', {var}.reel && {var}.atterrissage < 0 ? 'bg-red-900/70 text-red-100' : 'bg-emerald-900/60 text-emerald-200']">
                                                <span>= {{{{ {var}.reel && {var}.atterrissage < 0 ? 'Découvert' : 'Atterrissage' }}}} le {{{{ kpiAtterrissage.dateFin }}}}</span>
                                                <span class="tabular-nums">{{{{ formatMAD({var}.atterrissage) }}}}</span>
                                            </div>
                                        </div>
                                        <div v-if="{var}.lignes.length" class="mt-2 pt-2 border-t border-slate-800 space-y-0.5">
                                            <div v-for="(l, li) in {var}.lignes.slice(0, 10)" :key="{var}.key + '_' + li" class="flex justify-between gap-2 text-[10px]">
                                                <span class="text-slate-400 truncate min-w-0">{{{{ l.libelle }}}}<span v-if="l.jourPrevu" class="text-slate-600 font-bold ml-1">j.{{{{ l.jourPrevu }}}}</span></span>
                                                <span :class="['font-bold shrink-0 tabular-nums', l.type === 'credit' ? 'text-sky-300' : 'text-slate-200']">{{{{ l.type === 'credit' ? '+' : '−' }}}} {{{{ formatMAD(l.montant) }}}}</span>
                                            </div>
                                            <p v-if="{var}.lignes.length > 10" class="text-[10px] text-slate-500 font-bold">+ {{{{ {var}.lignes.length - 10 }}}} autre{{{{ {var}.lignes.length - 10 > 1 ? 's' : '' }}}} ligne{{{{ {var}.lignes.length - 10 > 1 ? 's' : '' }}}}</p>
                                        </div>"""

BADGE_NATURE = """t.nature === 'fixe' ? 'bg-orange-500/15 text-orange-300 border-orange-500/50'
                                                                   : (t.nature === 'variable' ? 'bg-sky-500/15 text-sky-300 border-sky-500/50'
                                                                   : (t.nature === 'epargne' ? 'bg-violet-500/15 text-violet-300 border-violet-500/50'
                                                                   : 'bg-rose-500/15 text-rose-300 border-rose-500/50'))"""

NOUVEAU = """                <div v-if="activeTab === 'pilotage'" class="max-w-4xl mx-auto space-y-5" data-cockpit>
                    <!-- ═══════════════════════════════════════════════════════════════
                         v37.16 — LE COCKPIT DU PILOTAGE
                         Avant : une jauge, trois cartes, quatre cartes de comptes et
                         huit infobulles au survol, dont deux pouvaient s'ouvrir l'une
                         sur l'autre. Maintenant : une ligne d'en-tête, trois chiffres
                         qui disent quoi faire, puis la file de travail. Le reste
                         descend, replié.
                         ═══════════════════════════════════════════════════════════════ -->

                    <!-- En-tête : où l'on est, et la navigation entre cycles -->
                    <div class="flex items-start justify-between gap-3 flex-wrap">
                        <div class="min-w-0">
                            <h2 class="text-xl md:text-2xl font-black text-gray-800 leading-tight">🎯 Pilotage du cycle</h2>
                            <p class="text-xs md:text-sm text-gray-500 mt-0.5 font-bold">
                                {{ pilotageCycleLabel }}<template v-if="!isCyclePasse"> · J−{{ joursRestantsAvantPaie }} avant la paie du {{ prochainePaieLabel }}</template><template v-else> · cycle clos</template>
                            </p>
                        </div>
                        <div class="flex items-center gap-2 shrink-0">
                            <select :value="pilotageViewedCycle || ''" @change="pilotageViewedCycle = $event.target.value || null"
                                    title="Changer de cycle" data-selecteur-cycle
                                    class="bg-white text-gray-700 text-xs font-bold border border-gray-300 rounded-lg px-2 py-2 focus:outline-none focus:border-emerald-500 cursor-pointer max-w-[11rem]">
                                <option value="">🗓️ Cycle actuel</option>
                                <option v-for="cy in cyclesDisponibles" :key="cy.key" :value="cy.key">{{ cy.nom }}</option>
                            </select>
                            <button @click="cloturerCycle()" title="Sauvegarder l'état du cycle dans l'historique"
                                    class="text-[10px] font-black px-2.5 py-2 rounded-lg border border-gray-300 bg-white text-gray-600 hover:border-purple-500 hover:text-purple-700 transition-colors whitespace-nowrap">💾 Clôturer</button>
                        </div>
                    </div>

                    <!-- Bannière Mode Régularisation -->
                    <div v-if="isPilotageRetro" class="flex items-center gap-3 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3">
                        <span class="text-base shrink-0">⚠️</span>
                        <div class="flex-1 min-w-0">
                            <p class="text-amber-800 font-black text-[11px] uppercase tracking-widest">Mode Régularisation</p>
                            <p class="text-amber-700 text-[11px] mt-0.5">Vous modifiez un cycle passé. Les changements impacteront les soldes suivants.</p>
                        </div>
                        <button @click="pilotageViewedCycle = null" class="text-[10px] font-black text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-1.5 rounded-lg hover:bg-amber-200 transition-colors whitespace-nowrap shrink-0">Cycle actuel</button>
                    </div>

                    <!-- ═══ LES TROIS CHIFFRES ═══════════════════════════════════════
                         Aucun n'a de formule à lui : Urgence = les deux premiers
                         paquets de la liste, Progression = réglé + reste des mêmes
                         tâches, Atterrissage = le moteur du Relevé. -->
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-3" data-cockpit-kpis>

                        <!-- 🔥 URGENCE -->
                        <button type="button" @click="allerAInbox()" data-kpi="urgence"
                                :class="['text-left rounded-2xl p-4 border-2 shadow-sm transition-colors bg-slate-900',
                                         kpiUrgence.montant > 0 ? 'border-amber-500 hover:border-amber-300' : 'border-emerald-600 hover:border-emerald-400']">
                            <p :class="['text-[10px] font-black uppercase tracking-widest', kpiUrgence.montant > 0 ? 'text-amber-300' : 'text-emerald-300']">
                                {{ isCyclePasse ? '🧾 À régulariser' : '🔥 Urgence · 7 jours' }}
                            </p>
                            <p class="text-3xl font-black tracking-tight text-white mt-1 tabular-nums" data-kpi-valeur>{{ formatMAD(kpiUrgence.montant) }}</p>
                            <p class="text-xs font-bold text-slate-300 mt-1">
                                <template v-if="isCyclePasse">{{ kpiUrgence.nb }} ligne{{ kpiUrgence.nb > 1 ? 's' : '' }} jamais pointée{{ kpiUrgence.nb > 1 ? 's' : '' }}</template>
                                <template v-else-if="kpiUrgence.montant > 0">à décaisser d'ici le {{ kpiUrgence.jusquau }} · {{ kpiUrgence.nb }} ligne{{ kpiUrgence.nb > 1 ? 's' : '' }}</template>
                                <template v-else>✅ Rien à décaisser d'ici le {{ kpiUrgence.jusquau }}</template>
                            </p>
                            <p v-if="!isCyclePasse && kpiUrgence.retard > 0" class="text-xs font-black text-rose-300 mt-1" data-kpi-retard>⚠️ dont {{ formatMAD(kpiUrgence.retard) }} en retard</p>
                            <p v-if="!isCyclePasse && kpiUrgence.sansDate" class="text-[10px] font-bold text-slate-400 mt-1">+ {{ kpiUrgence.sansDate }} ligne{{ kpiUrgence.sansDate > 1 ? 's' : '' }} sans date, non comptée{{ kpiUrgence.sansDate > 1 ? 's' : '' }}</p>
                        </button>

                        <!-- 📈 PROGRESSION -->
                        <div data-kpi="progression" class="rounded-2xl p-4 border-2 border-emerald-600 bg-slate-900 shadow-sm">
                            <p class="text-[10px] font-black uppercase tracking-widest text-emerald-300">📈 Progression du cycle</p>
                            <p class="mt-1 text-white tabular-nums leading-tight">
                                <span class="text-3xl font-black tracking-tight" data-kpi-valeur>{{ formatNombre(kpiProgression.regle) }}</span>
                                <span class="text-sm font-black text-slate-300"> / {{ formatMAD(kpiProgression.total) }} réglés</span>
                            </p>
                            <div class="relative mt-3 h-4 rounded-full bg-slate-700" data-kpi-barre>
                                <div class="h-full rounded-full bg-emerald-500 transition-all duration-500" :style="{ width: Math.min(100, kpiProgression.pct) + '%' }"></div>
                                <div v-if="!isCyclePasse" class="absolute -top-1 -bottom-1 w-1 -ml-0.5 bg-white rounded-full shadow"
                                     :style="{ left: Math.min(100, kpiProgression.pctTemps) + '%' }"
                                     :title="'Aujourd’hui : ' + kpiProgression.pctTemps + ' % du cycle écoulé'"></div>
                            </div>
                            <p class="text-xs font-bold text-slate-300 mt-2">
                                {{ kpiProgression.pct }} % réglé<template v-if="!isCyclePasse"> · <span class="text-white">▮</span> {{ kpiProgression.pctTemps }} % du cycle écoulé</template>
                            </p>
                            <div class="flex flex-wrap gap-1.5 mt-2">
                                <span v-for="n in kpiProgression.natures" :key="'pn_' + n.cle"
                                      :title="formatMAD(n.regle) + ' réglés sur ' + formatMAD(n.total)"
                                      :class="['text-[10px] font-black px-1.5 py-0.5 rounded-md border',
                                               n.teinte === 'orange' ? 'bg-orange-500/15 text-orange-300 border-orange-500/50'
                                               : (n.teinte === 'blue' ? 'bg-sky-500/15 text-sky-300 border-sky-500/50'
                                               : (n.teinte === 'purple' ? 'bg-violet-500/15 text-violet-300 border-violet-500/50'
                                               : 'bg-rose-500/15 text-rose-300 border-rose-500/50'))]">{{ n.badge }} {{ n.pct }} %</span>
                            </div>
                        </div>

                        <!-- 🚨 ATTERRISSAGE & ALERTE -->
                        <div class="relative" data-bulle-cle="kpi-atterrissage"
                             @pointerenter="survolBulle('kpi-atterrissage', $event)" @pointerleave="quitterBulle('kpi-atterrissage', $event)">
                            <button type="button" data-kpi="atterrissage" @click="basculerBulle('kpi-atterrissage')"
                                    :data-alerte="(!isCyclePasse && kpiAtterrissage.negatif) ? 'oui' : 'non'"
                                    :class="['w-full h-full text-left rounded-2xl p-4 border-2 shadow-sm transition-colors',
                                             isCyclePasse ? (soldeCloturePilotageRetro >= 0 ? 'bg-slate-900 border-indigo-500' : 'bg-red-600 border-red-700')
                                             : (kpiAtterrissage.negatif ? 'bg-red-600 border-red-700 hover:bg-red-700' : 'bg-slate-900 border-emerald-600 hover:border-emerald-400')]">
                                <template v-if="isCyclePasse">
                                    <p class="text-[10px] font-black uppercase tracking-widest text-indigo-200">🏁 Solde de clôture</p>
                                    <p class="text-3xl font-black tracking-tight text-white mt-1 tabular-nums" data-kpi-valeur>{{ formatMAD(soldeCloturePilotageRetro) }}</p>
                                    <p class="text-xs font-bold text-slate-200 mt-1">Transféré au cycle suivant</p>
                                </template>
                                <template v-else-if="kpiAtterrissage.negatif">
                                    <p class="text-[10px] font-black uppercase tracking-widest text-red-100">🚨 Atterrissage &amp; alerte</p>
                                    <p class="text-sm font-black text-white mt-1" data-kpi-phrase>Découvert projeté le {{ kpiAtterrissage.dateFin }}&nbsp;:</p>
                                    <p class="text-3xl font-black tracking-tight text-white tabular-nums" data-kpi-valeur>{{ formatMAD(kpiAtterrissage.vedette ? kpiAtterrissage.vedette.atterrissage : kpiAtterrissage.montant) }}</p>
                                    <p class="text-xs font-bold text-red-100 mt-1">{{ kpiAtterrissage.vedette ? kpiAtterrissage.vedette.label : 'Compte courant' }} · fin de cycle</p>
                                    <p v-for="c in kpiAtterrissage.alertes.filter(x => !kpiAtterrissage.vedette || x.key !== kpiAtterrissage.vedette.key)" :key="'al_' + c.key"
                                       class="text-xs font-black text-white mt-1" data-kpi-autre-alerte>⚠️ {{ c.label }}&nbsp;: {{ formatMAD(c.atterrissage) }}</p>
                                    <p v-if="kpiAtterrissage.montant >= 0 && kpiAtterrissage.courant" class="text-xs font-bold text-red-100 mt-1">
                                        {{ kpiAtterrissage.courant.icon }} {{ kpiAtterrissage.courant.label }}&nbsp;: {{ formatMAD(kpiAtterrissage.montant) }}
                                    </p>
                                </template>
                                <template v-else>
                                    <p class="text-[10px] font-black uppercase tracking-widest text-emerald-300">🏁 Atterrissage</p>
                                    <p class="text-3xl font-black tracking-tight text-white mt-1 tabular-nums" data-kpi-valeur>{{ formatMAD(kpiAtterrissage.montant) }}</p>
                                    <p class="text-xs font-bold text-slate-300 mt-1">Compte courant · le {{ kpiAtterrissage.dateFin }}</p>
                                </template>
                                <p v-if="!isCyclePasse" :class="['text-[10px] font-black mt-2', kpiAtterrissage.negatif ? 'text-red-100' : 'text-slate-400']">ⓘ Détail par compte</p>
                            </button>
                            <!-- Bulle : la composition, tirée du Relevé — une seule bulle ouverte à la fois -->
                            <div v-if="bulleOuverte === 'kpi-atterrissage' && !isCyclePasse" data-bulle
                                 class="absolute top-full left-0 right-0 md:left-auto md:w-[24rem] pt-2 z-[200]">
                                <div class="bg-slate-950 text-slate-200 border border-slate-600 rounded-xl shadow-2xl p-4 text-[11px] max-h-[70vh] overflow-y-auto">
                                    <div v-for="c in [kpiAtterrissage.courant].concat(kpiAtterrissage.alertes).filter(Boolean)" :key="'bk_' + c.key" class="mb-3 last:mb-0">
                                        <p class="font-black uppercase tracking-widest text-slate-300 text-[10px] mb-1.5">{{ c.icon }} {{ c.label }}</p>
                                        """ + composition('c') + """
                                    </div>
                                    <button type="button" @click.stop="ouvrirReleve(); fermerBulle()"
                                            class="mt-3 w-full text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg border border-indigo-500/60 text-indigo-200 hover:bg-indigo-600 hover:text-white transition-colors">📑 Toutes les lignes dans le Relevé</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div v-if="anneeAffichage === moisBudgetaire.an" class="space-y-5">

                        <!-- ═══ À TRAITER : la file de travail, par urgence ═══════════════ -->
                        <div id="pilotage-inbox" class="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden text-left shadow-lg scroll-mt-24">
                            <div class="flex items-center justify-between px-4 md:px-5 py-3 border-b border-slate-700 gap-3 flex-wrap">
                                <div class="flex items-center gap-3 min-w-0">
                                    <span class="text-blue-400 text-lg shrink-0">📋</span>
                                    <span class="text-sm font-black uppercase tracking-widest text-white truncate">À traiter — {{ pilotageCycleLabel }}</span>
                                </div>
                                <div class="flex items-center gap-2 shrink-0">
                                    <span class="text-[10px] px-2.5 py-1 rounded-lg font-black border bg-slate-900 border-slate-600 text-rose-300">
                                        {{ formatMAD(resteATraiterPilotage) }} restants
                                    </span>
                                    <span :class="['text-[10px] px-2.5 py-1 rounded-lg font-black border', tachesATraiter.length === 0 && tachesPilotage.length > 0 ? 'bg-green-900/50 border-green-500 text-green-400' : 'bg-slate-900 border-slate-600 text-blue-300']">
                                        {{ tachesTerminees.length }} / {{ tachesPilotage.length }} faits
                                    </span>
                                </div>
                            </div>

                            <!-- ✅ Un clic : les charges FIXES dont la date est arrivée -->
                            <div v-if="chargesFixesEchues.length" data-validation-rapide
                                 class="px-4 md:px-5 py-3 border-b border-slate-700 bg-emerald-950/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div class="min-w-0 flex-1">
                                    <p class="text-xs font-black text-emerald-200">
                                        {{ chargesFixesEchues.length }} charge{{ chargesFixesEchues.length > 1 ? 's' : '' }} fixe{{ chargesFixesEchues.length > 1 ? 's' : '' }} échue{{ chargesFixesEchues.length > 1 ? 's' : '' }} · {{ formatMAD(montantChargesFixesEchues) }}
                                    </p>
                                    <p class="text-[10px] font-bold text-slate-400 break-words">{{ chargesFixesEchues.map(t => t.libelle + ' (j.' + t.jourPrevu + ')').join(' · ') }}</p>
                                </div>
                                <button type="button" @click="validerChargesEchues()" data-valider-echues
                                        class="w-full sm:w-auto shrink-0 px-4 py-3 sm:py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black uppercase tracking-widest shadow-lg transition-colors">✅ Valider les charges échues</button>
                            </div>
                            <div v-if="derniereValidation && derniereValidation.cyc === cyclePilotage" data-validation-faite
                                 class="px-4 md:px-5 py-2.5 border-b border-slate-700 bg-slate-900 flex items-center justify-between gap-3 flex-wrap">
                                <p class="text-xs font-bold text-emerald-300 min-w-0">✅ {{ derniereValidation.n }} charge{{ derniereValidation.n > 1 ? 's' : '' }} validée{{ derniereValidation.n > 1 ? 's' : '' }} · {{ formatMAD(derniereValidation.montant) }}</p>
                                <div class="flex items-center gap-2 shrink-0">
                                    <button type="button" @click="annulerValidation()" data-annuler-validation
                                            class="text-[10px] font-black px-2.5 py-1.5 rounded-lg border border-slate-500 text-slate-200 hover:border-amber-400 hover:text-amber-300 transition-colors">↩ Annuler</button>
                                    <button type="button" @click="derniereValidation = null" title="Masquer" class="text-slate-500 hover:text-slate-300 text-sm px-1">✕</button>
                                </div>
                            </div>

                            <div class="p-3 md:p-4 space-y-5">
                                <!-- v37.13 : dire pourquoi certaines lignes ne sont pas datées -->
                                <p v-if="tachesSansDate" class="text-[10px] font-bold text-slate-400 bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 leading-snug">
                                    📅 {{ tachesSansDate }} ligne(s) sans jour de prélèvement : elles ferment la liste, faute de savoir où les placer.
                                    Renseignez « Jour prévu » dans le Budget Structurel pour qu'elles rejoignent le bon paquet.
                                    <span class="text-slate-500">(le champ est masqué sur une charge découpée en parts)</span>
                                </p>

                                <!-- Inbox Zero : plus rien à faire -->
                                <div v-if="tachesATraiter.length === 0" class="text-center py-10">
                                    <p class="text-4xl mb-3">✅</p>
                                    <p class="text-sm font-black text-green-400 uppercase tracking-widest">Tout est traité</p>
                                    <p class="text-[11px] text-slate-400 font-bold mt-1">
                                        {{ tachesPilotage.length }} élément(s) pointé(s) sur {{ pilotageCycleLabel }}.
                                        Le prochain cycle repartira à zéro.
                                    </p>
                                </div>

                                <!-- ⚠️ En retard / ⏳ Cette semaine / 📅 Reste du mois -->
                                <div v-for="paquet in tachesGroupees" :key="paquet.cle" :data-paquet="paquet.cle">
                                    <p :class="['text-[10px] font-black uppercase tracking-widest mb-2 pb-1 border-b flex items-center justify-between gap-2',
                                                paquet.teinte === 'rose' ? 'text-rose-300 border-rose-900/60'
                                                : (paquet.teinte === 'amber' ? 'text-amber-300 border-amber-900/60' : 'text-slate-300 border-slate-700')]">
                                        <span data-paquet-titre>{{ paquet.titre }}</span>
                                        <span class="font-mono normal-case tracking-normal">{{ paquet.taches.length }} · {{ formatMAD(paquet.total) }}</span>
                                    </p>
                                    <transition-group tag="div" name="tache" class="space-y-1.5">
                                        <div v-for="t in paquet.taches" :key="t.cle" data-tache
                                             :class="['flex flex-wrap items-center gap-x-3 gap-y-2 p-3 bg-slate-900/90 rounded-xl border transition-colors',
                                                      t.nature === 'fixe' ? 'border-slate-700 hover:border-orange-500'
                                                      : (t.nature === 'variable' ? 'border-slate-700 hover:border-sky-500'
                                                      : (t.nature === 'epargne' ? 'border-slate-700 hover:border-violet-500' : 'border-slate-700 hover:border-rose-500'))]">
                                            <label class="flex items-center gap-2.5 cursor-pointer flex-1 min-w-[12rem]">
                                                <input type="checkbox" :checked="false"
                                                       @change="toggleItemPaid(t.ref, t.due, cyclePilotage)"
                                                       class="w-5 h-5 rounded border-slate-600 bg-slate-800 text-green-500 focus:ring-green-500 cursor-pointer shrink-0"/>
                                                <span data-badge-nature :data-nature="t.nature"
                                                      :class="['text-[10px] font-black px-1.5 py-0.5 rounded-md border shrink-0 whitespace-nowrap',
                                                               """ + BADGE_NATURE + """]">{{ t.badge }}</span>
                                                <span class="text-sm font-bold text-slate-100 min-w-0 break-words md:truncate" data-tache-nom>{{ t.libelle }}</span>
                                                <span v-if="t.nature === 'variable'" class="text-[9px] text-slate-500 font-bold uppercase tracking-widest hidden md:inline shrink-0">{{ t.groupe }}</span>
                                            </label>
                                            <div class="flex items-center gap-2 ml-auto shrink-0">
                                                <span v-if="t.jourPrevu"
                                                      :class="['text-[10px] font-black px-1.5 py-0.5 rounded-full border shrink-0',
                                                               t.retard ? 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                                                               : (t.proche ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                                                               : 'bg-slate-700/40 text-slate-400 border-slate-600/50')]">📅 j.{{ t.jourPrevu }}</span>
                                                <span v-else class="text-[10px] font-black px-1.5 py-0.5 rounded-full border border-dashed border-slate-600 text-slate-500 shrink-0"
                                                      title="Aucune date de prélèvement sur cette ligne — renseignez « jour prévu » dans le Budget Structurel pour la classer dans le bon paquet">📅 sans date</span>
                                                <input type="number" :value="montantPayeCycle(t.ref, cyclePilotage)"
                                                       @input="setMontantPayeCycle(t.ref, $event.target.value, cyclePilotage)"
                                                       placeholder="0" title="Avance déjà versée"
                                                       class="w-20 bg-slate-950 text-slate-200 border border-slate-600 rounded p-1.5 text-right text-xs font-bold outline-none focus:border-blue-400 transition-colors"/>
                                                <span class="text-[10px] font-black text-slate-400 w-16 text-right tabular-nums">/ {{ formatNombre(t.due) }}</span>
                                            </div>
                                        </div>
                                    </transition-group>
                                </div>

                                <!-- ✅ Terminé — replié par défaut -->
                                <div v-if="tachesTerminees.length" class="rounded-xl border border-slate-700 bg-slate-900/60 overflow-hidden">
                                    <button @click="pilotageTermineOuvert = !pilotageTermineOuvert"
                                            class="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-slate-800/60 transition-colors">
                                        <span class="text-[10px] font-black uppercase tracking-widest text-green-400">✅ Terminé ({{ tachesTerminees.length }})</span>
                                        <span class="flex items-center gap-2 shrink-0">
                                            <span class="text-[10px] font-black text-green-500/80">{{ formatMAD(totalTraitePilotage) }}</span>
                                            <span class="text-slate-500 text-xs">{{ pilotageTermineOuvert ? '▲' : '▼' }}</span>
                                        </span>
                                    </button>
                                    <div v-show="pilotageTermineOuvert" class="px-3 pb-3 space-y-1.5 border-t border-slate-800 pt-3">
                                        <div v-for="t in tachesTerminees" :key="'ok_' + t.cle"
                                             class="flex items-center justify-between p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                                            <label class="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                                                <input type="checkbox" :checked="true"
                                                       @change="toggleItemPaid(t.ref, t.due, cyclePilotage)"
                                                       class="w-4 h-4 rounded border-slate-600 bg-slate-800 text-green-500 cursor-pointer shrink-0"/>
                                                <span class="text-[9px] font-black text-slate-500 shrink-0 whitespace-nowrap">{{ t.badge }}</span>
                                                <span class="text-xs font-bold text-slate-500 line-through truncate">{{ t.libelle }}</span>
                                                <span v-if="t.quand" class="text-[9px] text-slate-600 font-bold shrink-0">le {{ t.quand }}</span>
                                            </label>
                                            <span class="text-xs font-black text-green-500/80 ml-3 shrink-0">{{ formatMAD(t.regle || t.due) }}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- ═══ v32.00 Realized-T0 : conso déjà engagée sur le cycle ═══
                             v37.16 : le « Budget conso restant » de l'ancien en-tête vit
                             désormais ici, avec sa bulle de détail. -->
                        <div v-if="!isCyclePasse && consoCategoriesT0.length" :class="['rounded-2xl border text-left shadow-lg bg-slate-800', consoT0Renseigne ? 'border-violet-600/60' : 'border-amber-600/50']">
                            <div :class="['flex items-center justify-between gap-3 px-4 md:px-5 py-3 border-b border-slate-700 rounded-t-2xl flex-wrap', consoT0Renseigne ? 'bg-violet-900/20' : 'bg-amber-900/20']">
                                <div class="flex items-center gap-3 min-w-0">
                                    <span class="text-lg shrink-0">📊</span>
                                    <div class="min-w-0">
                                        <p class="text-sm font-black uppercase tracking-widest text-white">Réalisé à T0 — conso engagée</p>
                                        <p :class="['text-[10px] font-bold mt-0.5', consoT0Renseigne ? 'text-violet-300' : 'text-amber-300']">
                                            <template v-if="consoT0Renseigne">✅ Le reste du cycle est piloté par votre réel</template>
                                            <template v-else>⚠️ Non saisi — le reste est estimé au prorata du temps</template>
                                        </p>
                                    </div>
                                </div>
                                <div class="flex items-center gap-1.5 shrink-0">
                                    <button @click="remplirConsoT0DepuisReel()"
                                            title="Agréger les transactions réelles saisies depuis le début du cycle"
                                            class="text-[10px] font-black px-2.5 py-1.5 rounded-lg border border-violet-500/60 text-violet-300 hover:bg-violet-600 hover:text-white transition-all whitespace-nowrap">⚡ Depuis le réel</button>
                                    <button v-if="consoT0Renseigne" @click="resetConsoT0()"
                                            title="Effacer la saisie de ce cycle"
                                            class="text-[10px] font-black px-2 py-1.5 rounded-lg border border-slate-600 text-slate-400 hover:border-red-500 hover:text-red-300 transition-all">↩</button>
                                </div>
                            </div>
                            <!-- Budget conso restant + bulle « Disponible réel » -->
                            <div class="relative px-4 md:px-5 py-3 border-b border-slate-700" data-bulle-cle="conso-detail"
                                 @pointerenter="survolBulle('conso-detail', $event)" @pointerleave="quitterBulle('conso-detail', $event)">
                                <button type="button" @click="basculerBulle('conso-detail')" class="w-full flex items-center justify-between gap-3 text-left flex-wrap">
                                    <span class="text-[10px] font-black uppercase tracking-widest text-slate-300">🛒 Budget conso restant</span>
                                    <span class="flex items-baseline gap-2">
                                        <span :class="['text-lg font-black tabular-nums', budgetConsoRestantReel >= 0 ? 'text-emerald-300' : 'text-red-400']">{{ formatMAD(budgetConsoRestantReel) }}</span>
                                        <span v-if="budgetSemaineReel !== null" class="text-[10px] font-bold text-slate-400">soit {{ formatMAD(budgetSemaineReel) }} / sem</span>
                                        <span class="text-[10px] font-black text-slate-500">ⓘ</span>
                                    </span>
                                </button>
                                <div v-if="bulleOuverte === 'conso-detail'" data-bulle class="absolute top-full right-0 left-0 md:left-auto md:w-[22rem] md:right-5 pt-2 z-[200]">
                                    <div class="bg-slate-950 border border-slate-600 rounded-xl shadow-2xl p-3.5 text-left text-[11px] text-slate-200 max-h-[70vh] overflow-y-auto">
                                        <p class="font-black uppercase tracking-widest text-emerald-300 mb-2 text-[10px] border-b border-slate-700 pb-1.5">📊 Disponible réel</p>
                                        <div class="space-y-1.5 mb-3">
                                            <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest">🅰️ Enveloppe budgétaire</p>
                                            <div class="flex justify-between gap-3 pl-2"><span class="text-purple-300">Budget conso du cycle</span><span class="font-black text-white">{{ formatMAD(budgetConsoCycle) }}</span></div>
                                            <div class="flex justify-between gap-3 pl-2">
                                                <span :class="consoT0Renseigne ? 'text-orange-400' : 'text-amber-400'">− Déjà engagé <template v-if="!consoT0Renseigne">(non saisi)</template></span>
                                                <span class="font-black text-orange-200">− {{ formatMAD(consoEngageeT0) }}</span>
                                            </div>
                                            <div :class="['flex justify-between gap-3 font-black pl-2', contrainteConso === 'budget' ? 'text-emerald-300' : 'text-slate-400']">
                                                <span>= Reste au budget {{ contrainteConso === 'budget' ? '◀' : '' }}</span><span>{{ formatMAD(enveloppeConsoRestante) }}</span>
                                            </div>
                                        </div>
                                        <div class="space-y-1.5 mb-3 border-t border-slate-700 pt-2">
                                            <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest">🅱️ Trésorerie</p>
                                            <div class="flex justify-between gap-3 pl-2"><span class="text-emerald-400">💰 Tréso instantanée</span><span class="font-black text-white">{{ formatMAD(tresoActuelleCourante) }}</span></div>
                                            <div v-if="revenusEnAttenteCourant > 0" class="flex justify-between gap-3 pl-2"><span class="text-sky-400">📥 + Revenus en attente</span><span class="font-black text-sky-200">+ {{ formatMAD(revenusEnAttenteCourant) }}</span></div>
                                            <div class="flex justify-between gap-3 pl-2"><span class="text-orange-400">➖ Obligations (hors conso)</span><span class="font-black text-white">− {{ formatMAD(obligationsCourantHorsConso) }}</span></div>
                                            <div :class="['flex justify-between gap-3 font-black pl-2', contrainteConso === 'cash' ? 'text-emerald-300' : 'text-slate-400']">
                                                <span>= Cash dispo {{ contrainteConso === 'cash' ? '◀' : '' }}</span><span>{{ formatMAD(cashDispoPourConso) }}</span>
                                            </div>
                                        </div>
                                        <div class="space-y-1.5 border-t border-slate-700 pt-2">
                                            <div :class="['flex justify-between gap-3 font-black text-[12px]', budgetConsoRestantReel >= 0 ? 'text-emerald-300' : 'text-red-300']">
                                                <span>= Budget Conso Restant</span><span>{{ formatMAD(budgetConsoRestantReel) }}</span>
                                            </div>
                                            <p class="text-[9px] text-slate-500 font-bold">{{ contrainteConso === 'budget' ? '🅰️ Limité par votre budget conso' : '🅱️ Limité par la trésorerie disponible' }}</p>
                                            <div v-if="chargesVarHebdoDetail.length > 0" class="border-t border-slate-800 pt-1.5 mt-1.5">
                                                <div class="flex justify-between gap-3 mb-1"><span class="font-black uppercase tracking-widest text-purple-300 text-[10px]">🎯 Besoin hebdo théorique</span><span class="font-black text-purple-300">{{ formatMAD(besoinVariableHebdoTheorique) }}</span></div>
                                                <div v-for="c in chargesVarHebdoDetail" :key="'hb_' + c.label" class="flex justify-between gap-3 pl-3 text-[10px]"><span class="text-slate-400">↳ {{ c.label }}</span><span class="font-bold text-slate-200">{{ formatMAD(c.valeur) }}</span></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <!-- v34.06 : Mode Voyage — sélecteur de dates -->
                            <div :class="['px-4 md:px-5 py-3 border-b border-slate-700 flex items-center justify-between gap-3 flex-wrap', modeVoyageActif ? 'bg-sky-900/30' : 'bg-slate-900/40']">
                                <div class="flex items-center gap-3 flex-wrap">
                                    <span class="text-lg">✈️</span>
                                    <div>
                                        <label class="text-[11px] font-black uppercase tracking-widest text-sky-200">Voyage · absence</label>
                                        <p class="text-[10px] font-bold text-slate-400">Chaque cycle ne déduit que les jours qui tombent chez lui</p>
                                    </div>
                                    <div class="flex items-center gap-1.5 flex-wrap">
                                        <span class="text-[10px] font-black uppercase tracking-widest text-slate-400">Du</span>
                                        <input type="date" :value="soldesInitiaux.voyageDebut || ''"
                                               @change="setVoyage('voyageDebut', $event.target.value)"
                                               class="bg-slate-950 text-sky-300 border border-slate-600 rounded p-1.5 text-xs font-bold outline-none focus:border-sky-400"/>
                                        <span class="text-[10px] font-black uppercase tracking-widest text-slate-400">au</span>
                                        <input type="date" :value="soldesInitiaux.voyageFin || ''"
                                               :min="soldesInitiaux.voyageDebut || null"
                                               @change="setVoyage('voyageFin', $event.target.value)"
                                               class="bg-slate-950 text-sky-300 border border-slate-600 rounded p-1.5 text-xs font-bold outline-none focus:border-sky-400"/>
                                        <button v-if="soldesInitiaux.voyageDebut || soldesInitiaux.voyageFin"
                                                @click="effacerVoyage()" title="Effacer les dates de voyage"
                                                class="text-[9px] font-black px-2 py-1.5 rounded-lg border border-slate-600 text-slate-400 hover:border-red-500 hover:text-red-300 transition-all">↩</button>
                                    </div>
                                </div>
                                <div v-if="modeVoyageActif" class="text-right">
                                    <p class="text-[9px] font-black uppercase tracking-widest text-sky-400">Économie du cycle</p>
                                    <p class="text-base font-black text-emerald-300 tabular-nums">+{{ formatMAD(economieVoyage) }}</p>
                                    <p class="text-[9px] font-bold text-slate-400">
                                        {{ voyageJoursDuMois.total }} j sur ce cycle ({{ cycleLabel }}) · {{ voyageDetailMois }}
                                    </p>
                                    <p class="text-[9px] font-bold text-slate-500">
                                        {{ voyageJoursDuMois.weekend }} we · {{ voyageJoursDuMois.semaine }} sem · présence {{ Math.round(facteurPresence * 100) }} %<span v-if="economieVoyageBudget !== economieVoyage"> · budget allégé de {{ formatMAD(economieVoyageBudget) }}</span>
                                    </p>
                                </div>
                                <p v-else-if="voyageJoursDuMois.saisi" class="text-[9px] font-bold text-slate-500 text-right">
                                    Aucun jour de ce voyage ne tombe sur le cycle affiché ({{ cycleLabel }}).
                                </p>
                            </div>
                            <div class="p-3 md:p-4 space-y-2">
                                <div v-for="c in consoCategoriesT0" :key="'ct0_' + c.key"
                                     class="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 p-3 bg-slate-900/90 rounded-xl border border-slate-700 hover:border-violet-500 transition-all">
                                    <div class="min-w-0 flex-1">
                                        <p class="text-sm font-bold text-slate-200 truncate flex items-center gap-2">
                                            <span class="truncate">{{ c.label }}</span>
                                            <button @click="toggleSuspendreAbsence(c.key)"
                                                    :title="c.suspendue ? 'Suspendu pendant l’absence — cliquer pour le laisser courir' : 'Continue de courir pendant l’absence — cliquer pour le suspendre'"
                                                    :class="['text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border shrink-0 transition-colors', c.suspendue ? 'bg-sky-900/60 text-sky-300 border-sky-600' : 'bg-slate-800 text-slate-500 border-slate-600 hover:text-slate-300']">
                                                ✈️ {{ c.suspendue ? 'suspendu' : 'maintenu' }}
                                            </button>
                                        </p>
                                        <p v-if="modeVoyageActif && c.economie > 0" class="text-[10px] font-bold text-sky-300 mt-0.5">
                                            {{ formatMAD(c.budgetInitial) }} ➔ {{ formatMAD(c.budget) }}
                                            <span class="text-emerald-300">(−{{ formatMAD(c.economie) }} mode voyage)</span>
                                            <span v-if="c.pondere" class="text-slate-500">· pondéré week-end</span>
                                        </p>
                                        <div class="flex items-center gap-2 mt-1">
                                            <div class="h-1.5 w-20 bg-slate-700 rounded-full overflow-hidden shrink-0">
                                                <div :style="{ width: Math.min(100, c.pct) + '%' }"
                                                     :class="['h-full rounded-full transition-all', c.engage > c.theorique ? 'bg-red-500' : 'bg-emerald-500']"></div>
                                            </div>
                                            <span class="text-[9px] font-bold text-slate-500 whitespace-nowrap">
                                                {{ c.pct }}% · rythme attendu {{ formatMAD(c.theorique) }}
                                            </span>
                                        </div>
                                    </div>
                                    <div class="flex items-center gap-2 shrink-0 ml-auto">
                                        <input type="number" min="0" :value="c.engage"
                                               @input="setConsoT0(c.key, $event.target.value)"
                                               placeholder="0"
                                               class="w-24 bg-slate-950 text-violet-300 border border-slate-600 rounded p-1.5 text-right text-xs font-bold outline-none focus:border-violet-400 transition-colors"/>
                                        <span class="text-[10px] font-black text-slate-400 w-14 text-right tabular-nums">/ {{ formatNombre(c.budget) }}</span>
                                        <span :class="['text-[10px] font-black w-16 text-right', c.reste > 0 ? 'text-emerald-400' : 'text-red-400']">{{ formatMAD(c.reste) }}</span>
                                    </div>
                                </div>
                                <!-- Totaux -->
                                <div class="flex items-center justify-between gap-3 pt-3 mt-1 border-t border-slate-700 px-3 flex-wrap">
                                    <div class="min-w-0">
                                        <p class="text-[10px] font-black uppercase tracking-widest text-slate-300">Total engagé · J+{{ joursCycleEcoules }} / {{ joursCycleTotal }}</p>
                                        <p :class="['text-[9px] font-bold mt-0.5', deriveConsoT0 <= 0 ? 'text-emerald-400' : 'text-red-400']">
                                            {{ deriveConsoT0 <= 0 ? '✅ ' : '⚠️ +' }}{{ formatMAD(Math.abs(deriveConsoT0)) }}
                                            {{ deriveConsoT0 <= 0 ? 'sous le rythme attendu' : 'au-dessus du rythme attendu' }}
                                            ({{ formatMAD(consoTheoriqueAJour) }})
                                        </p>
                                    </div>
                                    <div class="text-right shrink-0">
                                        <p class="text-lg font-black text-violet-300 tracking-tighter">{{ formatMAD(consoEngageeT0) }}</p>
                                        <p class="text-[9px] font-bold text-slate-500">reste {{ formatMAD(enveloppeConsoRestante) }} / {{ formatMAD(budgetConsoCycle) }}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- ═══ v37.16 : les comptes, repliés — chiffres du Relevé, bulle au survol/tap ═══ -->
                        <details v-if="!isCyclePasse && atterrissageCycle.comptes.length" data-comptes-cycle class="bg-slate-800 rounded-2xl border border-slate-700 text-left shadow-lg">
                            <summary class="flex items-center justify-between gap-3 px-4 md:px-5 py-3 cursor-pointer select-none hover:bg-slate-700/40 rounded-2xl transition-colors">
                                <span class="text-[11px] font-black uppercase tracking-widest text-slate-200">🏦 Comptes du cycle — fin le {{ kpiAtterrissage.dateFin }}</span>
                                <span v-if="kpiAtterrissage.negatif" class="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-600 text-white shrink-0">
                                    ⚠️ {{ kpiAtterrissage.alertes.length + (kpiAtterrissage.montant < 0 ? 1 : 0) }} à découvert
                                </span>
                            </summary>
                            <div class="p-3 md:p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-700">
                                <div v-for="c in atterrissageCycle.comptes" :key="'cc_' + c.key" class="relative"
                                     :data-bulle-cle="'compte:' + c.key"
                                     @pointerenter="survolBulle('compte:' + c.key, $event)" @pointerleave="quitterBulle('compte:' + c.key, $event)">
                                    <button type="button" @click="basculerBulle('compte:' + c.key)" :data-compte="c.key"
                                            :class="['w-full text-left p-3 rounded-xl border-2 transition-colors bg-slate-900',
                                                     c.reel && c.atterrissage < 0 ? 'border-red-600 hover:border-red-400' : 'border-slate-700 hover:border-emerald-500']">
                                        <div class="flex items-start justify-between gap-2">
                                            <p class="text-xs font-black text-slate-100 truncate min-w-0">{{ c.icon }} {{ c.label }}</p>
                                            <p :class="['text-sm font-black tabular-nums shrink-0', c.reel && c.atterrissage < 0 ? 'text-red-400' : 'text-white']">{{ formatMAD(c.atterrissage) }}</p>
                                        </div>
                                        <p class="text-[10px] font-bold text-slate-400 mt-1">aujourd'hui {{ formatMAD(c.t0) }} · {{ c.lignes.length }} ligne{{ c.lignes.length > 1 ? 's' : '' }} ⓘ</p>
                                        <p v-if="c.reel && c.atterrissage < 0" class="text-[10px] font-black text-red-400 mt-0.5">⚠️ Découvert projeté le {{ kpiAtterrissage.dateFin }}</p>
                                        <p v-else-if="!c.reel" class="text-[10px] font-bold text-violet-300 mt-0.5">💎 Poche d'épargne alimentée ce cycle</p>
                                    </button>
                                    <div v-if="bulleOuverte === 'compte:' + c.key" data-bulle class="absolute top-full left-0 right-0 pt-2 z-[200]">
                                        <div class="bg-slate-950 text-slate-200 border border-slate-600 rounded-xl shadow-2xl p-4 text-[11px] max-h-[70vh] overflow-y-auto">
                                            <p class="font-black uppercase tracking-widest text-slate-300 text-[10px] mb-1.5">{{ c.icon }} {{ c.label }}</p>
                                        """ + composition('c') + """
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </details>

                        <!-- v22.60 : Sélecteur réduit — jourDePaie seul -->
                        <div class="flex items-center gap-3 bg-slate-800 rounded-2xl border border-slate-700 px-4 md:px-5 py-3 flex-wrap">
                            <span class="text-[10px] font-black uppercase tracking-widest text-slate-400 shrink-0">📅 Paie le</span>
                            <input type="number" min="1" max="31" v-model.number="soldesInitiaux.jourDePaie" @input="handleDataChange" class="w-16 bg-slate-900 text-blue-300 font-black text-lg p-2 rounded-xl border border-blue-700 text-center outline-none focus:border-blue-400"/>
                            <span class="text-[10px] font-black uppercase tracking-widest text-slate-400 shrink-0">de chaque mois</span>
                            <p class="ml-auto text-[10px] text-blue-300 font-black">🏦 Base cycle : {{ formatMAD(soldeInitialCycleActuel) }}</p>
                        </div>

                        <!-- v25.90 Multi-Ledger-Core : accès rapide au Journal / Relevé depuis le Pilotage -->
                        <button @click="ouvrirReleve()" class="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-900/30 border border-indigo-400/40">
                            <span class="text-base">📑</span>
                            <span>Ouvrir le Journal / Relevé</span>
                        </button>

                        <!-- ═══ v37.13 : références, en bas et repliées ═══════════════
                             v37.16 : lues ET écrites sur le cycle AFFICHÉ (cyclePilotage).
                             Elles cochaient le cycle EN COURS même en régularisation :
                             pointer « Appartement » sur septembre l'enregistrait comme
                             encaissé… en octobre (mesuré sur la v37.15). -->
                        <div class="space-y-4">
                            <details class="bg-slate-800 rounded-2xl border border-green-800/50 overflow-hidden text-left shadow-lg">
                                <summary class="flex items-center justify-between px-4 md:px-5 py-3 border-b border-slate-700 bg-green-900/20 cursor-pointer select-none hover:bg-green-900/30 transition-colors gap-3">
                                    <div class="flex items-center gap-3 min-w-0">
                                        <span class="text-green-400 text-lg">🟢</span>
                                        <span class="text-sm font-black uppercase tracking-widest text-white">Entrées d'Argent</span>
                                        <span class="text-[9px] font-black uppercase tracking-widest text-slate-400">{{ revenusRestantsPilotage }} à pointer</span>
                                    </div>
                                    <span class="text-sm font-black text-green-400 shrink-0">{{ formatMAD(tresoEntrees) }}</span>
                                </summary>
                                <div class="p-3 md:p-4 space-y-2">
                                    <div v-for="(rev, key) in revenusBudgetairesTries" :key="'rev_' + key"
                                         :class="['flex items-center justify-between p-3 rounded-xl group border transition-all', getDueRevenu(rev, pilotageViewedAn, pilotageViewedMois) <= 0 ? 'bg-slate-900/40 border-slate-800 opacity-60' : 'bg-slate-900/90 border-slate-700 hover:border-green-500']">
                                        <template v-if="getDueRevenu(rev, pilotageViewedAn, pilotageViewedMois) <= 0">
                                            <div class="flex items-center gap-3 flex-1">
                                                <span class="text-sm font-bold text-slate-400">{{ rev.label }}</span>
                                                <span class="text-[9px] font-black bg-slate-700/40 text-slate-400 border border-slate-600/60 px-1.5 py-0.5 rounded-full">⏸️ Suspendu ce mois</span>
                                            </div>
                                            <span class="text-sm font-black ml-4 text-slate-600">{{ formatMAD(0) }}</span>
                                        </template>
                                        <template v-else>
                                            <label class="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                                                <input type="checkbox"
                                                       :checked="isItemPaid(rev, getDueRevenu(rev, pilotageViewedAn, pilotageViewedMois), cyclePilotage)"
                                                       @change="toggleItemPaid(rev, getDueRevenu(rev, pilotageViewedAn, pilotageViewedMois), cyclePilotage)"
                                                       class="w-5 h-5 rounded border-slate-600 bg-slate-800 text-green-500 focus:ring-green-500 cursor-pointer shrink-0"/>
                                                <span :class="['text-sm font-bold transition-all truncate', isItemPaid(rev, getDueRevenu(rev, pilotageViewedAn, pilotageViewedMois), cyclePilotage) ? 'text-slate-500 line-through' : 'text-slate-200 group-hover:text-green-300']">{{ rev.label }}</span>
                                                <span v-if="isFluxCetteSemaine(rev.jourPrevu) && !isItemPaid(rev, getDueRevenu(rev, pilotageViewedAn, pilotageViewedMois), cyclePilotage)" class="text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded-full shrink-0">⏳ Cette sem.</span>
                                                <span v-if="rev.jourPrevu && !isItemPaid(rev, getDueRevenu(rev, pilotageViewedAn, pilotageViewedMois), cyclePilotage)" class="text-[9px] text-slate-500 font-bold shrink-0">j.{{ rev.jourPrevu }}</span>
                                            </label>
                                            <span :class="['text-sm font-black ml-4 shrink-0', isItemPaid(rev, getDueRevenu(rev, pilotageViewedAn, pilotageViewedMois), cyclePilotage) ? 'text-green-400' : 'text-slate-400']">{{ formatMAD(getDueRevenu(rev, pilotageViewedAn, pilotageViewedMois)) }}</span>
                                        </template>
                                    </div>
                                    <div v-if="!donneesAnnuelles[moisBudgetaire.an] || !Object.keys(donneesAnnuelles[moisBudgetaire.an]?.revenus || {}).length" class="text-center py-4 text-slate-500 text-sm">Aucune entrée configurée</div>
                                </div>
                            </details>

                            <!-- Vue par catégorie, conservée sous un repli : elle reste
                                 la référence quand on cherche une ligne précise. -->
                            <details class="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden text-left shadow-lg">
                                <summary class="px-4 md:px-5 py-3 cursor-pointer text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-white select-none">
                                    🗂️ Vue détaillée par catégorie
                                </summary>
                                <div class="p-3 md:p-4 space-y-4 border-t border-slate-700">
                                    <div v-if="chargesFixesBudgetairesTriees.length > 0">
                                        <p class="text-[9px] text-orange-400 font-black uppercase tracking-widest mb-2 border-b border-orange-900/50 pb-1 mt-2">🏢 Charges Fixes</p>
                                        <div class="space-y-1.5">
                                            <div v-for="(f, key) in chargesFixesBudgetairesTriees" :key="'vf_' + key" class="flex items-center justify-between p-3 bg-slate-900/90 rounded-xl group border border-slate-700 hover:border-orange-500 transition-all gap-3">
                                                <label class="flex items-center gap-3 cursor-pointer flex-1 min-w-0 flex-wrap">
                                                    <input type="checkbox" :checked="isItemPaid(f, getDueFixe(f, pilotageViewedAn, pilotageViewedMois), cyclePilotage)" @change="toggleItemPaid(f, getDueFixe(f, pilotageViewedAn, pilotageViewedMois), cyclePilotage)" class="w-5 h-5 rounded border-slate-600 bg-slate-800 text-orange-500 focus:ring-orange-500 cursor-pointer shrink-0"/>
                                                    <span :class="['text-sm font-bold transition-all', isItemPaid(f, getDueFixe(f, pilotageViewedAn, pilotageViewedMois), cyclePilotage) ? 'text-slate-500 line-through' : 'text-slate-200 group-hover:text-orange-300']">{{ f.label }}</span>
                                                    <span v-if="getDueFixe(f, pilotageViewedAn, pilotageViewedMois) <= 0" class="text-[9px] font-black bg-slate-700/40 text-slate-400 border border-slate-600/60 px-1.5 py-0.5 rounded-full">⏸️ Suspendu ce mois</span>
                                                    <span v-if="f.jourPrevu && !isItemPaid(f, getDueFixe(f, pilotageViewedAn, pilotageViewedMois), cyclePilotage)" class="text-[9px] text-slate-500 font-bold">j.{{ f.jourPrevu }}</span>
                                                </label>
                                                <div class="flex items-center gap-2 shrink-0">
                                                    <input type="number" :value="montantPayeCycle(f, cyclePilotage)" @input="setMontantPayeCycle(f, $event.target.value, cyclePilotage)" placeholder="0" class="w-20 bg-slate-950 text-orange-400 border border-slate-600 rounded p-1.5 text-right text-xs font-bold outline-none focus:border-orange-400 transition-colors"/>
                                                    <span class="text-[10px] font-black text-slate-400 w-16 text-right tabular-nums">/ {{ formatMAD(getDueFixe(f, pilotageViewedAn, pilotageViewedMois)) }}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div v-for="cat in chargesVarMensuellePilotage" :key="'vc_' + cat.label">
                                        <p class="text-[9px] text-sky-400 font-black uppercase tracking-widest mb-2 border-b border-sky-900/50 pb-1 mt-2 flex items-center gap-2">
                                            <span>🛒 {{ cat.label }}</span>
                                            <span v-if="cat.jourPrevu" class="text-[9px] text-slate-500 font-bold ml-auto">📅 j.{{ cat.jourPrevu }}</span>
                                        </p>
                                        <div class="space-y-1.5">
                                            <div v-for="f in cat.details" :key="'vd_' + f.id" class="flex items-center justify-between p-3 bg-slate-900/90 rounded-xl group border border-slate-700 hover:border-sky-500 transition-all gap-3">
                                                <label class="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                                                    <input type="checkbox" :checked="isItemPaid(f, f.montant, cyclePilotage)" @change="toggleItemPaid(f, f.montant, cyclePilotage)" class="w-5 h-5 rounded border-slate-600 bg-slate-800 text-sky-500 focus:ring-sky-500 cursor-pointer shrink-0"/>
                                                    <span :class="['text-sm font-bold transition-all truncate', isItemPaid(f, f.montant, cyclePilotage) ? 'text-slate-500 line-through' : 'text-slate-200 group-hover:text-sky-300']">{{ f.nom }}</span>
                                                </label>
                                                <div class="flex items-center gap-2 shrink-0">
                                                    <input type="number" :value="montantPayeCycle(f, cyclePilotage)" @input="setMontantPayeCycle(f, $event.target.value, cyclePilotage)" placeholder="0" class="w-20 bg-slate-950 text-sky-400 border border-slate-600 rounded p-1.5 text-right text-xs font-bold outline-none focus:border-sky-400 transition-colors"/>
                                                    <span class="text-[10px] font-black text-slate-400 w-16 text-right tabular-nums">/ {{ formatMAD(f.montant) }}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div v-if="epargneBudgetairePilotage.length > 0">
                                        <p class="text-[9px] text-violet-400 font-black uppercase tracking-widest mb-2 border-b border-violet-900/50 pb-1 mt-2">💎 Épargne &amp; Virements</p>
                                        <div class="space-y-1.5">
                                            <div v-for="ep in epargneBudgetairePilotage" :key="'ve_' + ep.id"
                                                 :class="['flex items-center justify-between p-3 rounded-xl group border transition-all gap-3', getDueFixe(ep, pilotageViewedAn, pilotageViewedMois) <= 0 ? 'bg-slate-900/40 border-slate-800 opacity-60' : 'bg-slate-900/90 border-slate-700 hover:border-violet-500']">
                                                <template v-if="getDueFixe(ep, pilotageViewedAn, pilotageViewedMois) <= 0">
                                                    <div class="flex items-center gap-3 flex-1">
                                                        <span class="text-sm font-bold text-slate-400">{{ ep.nom || ep.label || 'Épargne' }}</span>
                                                        <span class="text-[9px] font-black bg-slate-700/40 text-slate-400 border border-slate-600/60 px-1.5 py-0.5 rounded-full">⏸️ Suspendu ce mois</span>
                                                    </div>
                                                    <span class="text-sm font-black ml-4 text-slate-600">{{ formatMAD(0) }}</span>
                                                </template>
                                                <template v-else>
                                                    <label class="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                                                        <input type="checkbox" :checked="isItemPaid(ep, getDueFixe(ep, pilotageViewedAn, pilotageViewedMois), cyclePilotage)" @change="toggleItemPaid(ep, getDueFixe(ep, pilotageViewedAn, pilotageViewedMois), cyclePilotage)" class="w-5 h-5 rounded border-slate-600 bg-slate-800 text-violet-500 focus:ring-violet-500 cursor-pointer shrink-0"/>
                                                        <span :class="['text-sm font-bold transition-all truncate', isItemPaid(ep, getDueFixe(ep, pilotageViewedAn, pilotageViewedMois), cyclePilotage) ? 'text-slate-500 line-through' : 'text-slate-200 group-hover:text-violet-300']">{{ ep.nom || ep.label || 'Épargne' }}</span>
                                                        <span v-if="ep.jourPrevu && !isItemPaid(ep, getDueFixe(ep, pilotageViewedAn, pilotageViewedMois), cyclePilotage)" class="text-[9px] text-slate-500 font-bold shrink-0">j.{{ ep.jourPrevu }}</span>
                                                    </label>
                                                    <span :class="['text-sm font-black ml-4 shrink-0', isItemPaid(ep, getDueFixe(ep, pilotageViewedAn, pilotageViewedMois), cyclePilotage) ? 'text-violet-400' : 'text-slate-400']">{{ formatMAD(getDueFixe(ep, pilotageViewedAn, pilotageViewedMois)) }}</span>
                                                </template>
                                            </div>
                                        </div>
                                    </div>
                                    <div v-if="getDepensesCycle(pilotageViewedMois, pilotageViewedAn).length > 0">
                                        <p class="text-[9px] text-rose-400 font-black uppercase tracking-widest mb-2 border-b border-rose-900/50 pb-1 mt-2">⚠️ Flux Exceptionnels — {{ pilotageCycleLabel }}</p>
                                        <div class="space-y-1.5">
                                            <div v-for="dep in getDepensesCycle(pilotageViewedMois, pilotageViewedAn)" :key="'vx_' + dep.id" class="flex items-center justify-between p-3 bg-slate-900/90 rounded-xl group border border-slate-700 hover:border-rose-500 transition-all gap-3">
                                                <label class="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                                                    <input type="checkbox" :checked="isItemPaid(dep, dep.montant, cyclePilotage)" @change="toggleItemPaid(dep, dep.montant, cyclePilotage)" class="w-5 h-5 rounded border-slate-600 bg-slate-800 text-rose-500 focus:ring-rose-500 cursor-pointer shrink-0"/>
                                                    <span :class="['text-sm font-bold transition-all truncate', isItemPaid(dep, dep.montant, cyclePilotage) ? 'text-slate-500 line-through' : 'text-slate-200 group-hover:text-rose-300']">{{ dep.nom }}</span>
                                                </label>
                                                <div class="flex items-center gap-2 shrink-0">
                                                    <input type="number" :value="montantPayeCycle(dep, cyclePilotage)" @input="setMontantPayeCycle(dep, $event.target.value, cyclePilotage)" placeholder="0" class="w-20 bg-slate-950 text-rose-400 border border-slate-600 rounded p-1.5 text-right text-xs font-bold outline-none focus:border-rose-400 transition-colors"/>
                                                    <span class="text-[10px] font-black text-slate-400 w-20 text-right tabular-nums">/ {{ formatMAD(dep.montant) }}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </details>
                        </div>
                    </div>

                    <div v-else class="bg-yellow-50 p-6 rounded-[2rem] border border-yellow-200 text-center shadow-sm">
                        <p class="text-sm font-bold text-yellow-800">Le pilotage au jour le jour (Checklist) n'est actif que pour l'année en cours ({{ moisBudgetaire.an }}).</p>
                        <button @click="anneeAffichage = moisBudgetaire.an" class="mt-3 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700">Revenir à {{ moisBudgetaire.an }}</button>
                    </div>

"""

src = src[:i] + NOUVEAU + src[j:]
io.open(F, 'w', encoding='utf-8').write(src)
print('✔ gabarit du Pilotage remplacé (' + str(NOUVEAU.count('\n')) + ' lignes)')
