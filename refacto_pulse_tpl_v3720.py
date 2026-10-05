# -*- coding: utf-8 -*-
"""
v37.20 Pulse-Hebdo — PARTIE GABARIT (composant <meteo-financiere>).

  À droite de la Météo, deux tuiles remplacent le « X DH / jour » :
    🕊️ LIBERTÉ    — ce qu'il reste à dépenser librement d'ici dimanche, et une jauge
                    de la semaine (7 cases, L → D) : le remplissage est l'enveloppe
                    consommée, le repère blanc est le jour. Si le remplissage dépasse
                    le repère, on va plus vite que la semaine.
    🔒 SANCTUAIRE — l'argent déjà promis aux prélèvements des 7 prochains jours.
  Le reste à vivre du cycle et le « DH/jour » ne disparaissent pas : ils
  descendent en une ligne discrète, « filet de sécurité ».
"""
import io, sys
F = 'index.html'
src = io.open(F, encoding='utf-8').read()
edits = []
def sub(label, anchor, replacement, expected=1):
    n = src.count(anchor)
    if n != expected:
        print(f'✖ {label} : {n} ancre(s), {expected} attendue(s)'); sys.exit(1)
    edits.append((anchor, replacement))

sub('couleurs du rythme', """            computed: {
                fond() {
                    return this.meteo.etat === 'orage' ? 'from-rose-600 via-red-700 to-slate-900'
                         : this.meteo.etat === 'nuages' ? 'from-slate-500 via-slate-600 to-slate-800'
                         : 'from-sky-500 via-sky-600 to-indigo-700';
                },
            },""", """            computed: {
                fond() {
                    return this.meteo.etat === 'orage' ? 'from-rose-600 via-red-700 to-slate-900'
                         : this.meteo.etat === 'nuages' ? 'from-slate-500 via-slate-600 to-slate-800'
                         : 'from-sky-500 via-sky-600 to-indigo-700';
                },
                p() { return this.meteo.pulse || {}; },
                s() { return this.meteo.sanctuaire || {}; },
                //  Le remplissage dit le rythme : vert tenu, ambre en avance, rouge dépassé.
                remplissage() {
                    return this.p.rythme === 'depasse' ? 'bg-gradient-to-r from-rose-400 to-red-500'
                         : this.p.rythme === 'avance' ? 'bg-gradient-to-r from-amber-300 to-orange-400'
                         : 'bg-gradient-to-r from-emerald-300 to-teal-300';
                },
                rythmeTexte() {
                    return this.p.rythme === 'depasse' ? '⚠️ Enveloppe dépassée'
                         : this.p.rythme === 'avance' ? '⏩ Plus vite que la semaine'
                         : '✓ Rythme tenu';
                },
                rythmeCourt() {
                    return this.p.rythme === 'depasse' ? '⚠️ Dépassée' : this.p.rythme === 'avance' ? '⏩ En avance' : '✓ Tenu';
                },
            },""")

sub('les deux tuiles', """        <div class="rounded-2xl bg-white/15 backdrop-blur-md ring-1 ring-white/25 shadow-inner p-3.5 md:p-5 flex flex-col justify-center">
            <p class="text-[10px] font-black uppercase tracking-[0.2em] text-white/75">Reste à vivre aujourd'hui</p>
            <p class="mt-1 flex items-baseline gap-2 flex-wrap tabular-nums">
                <span class="text-4xl md:text-6xl font-black tracking-tight leading-none" data-meteo-jour>{{ formatMad(meteo.parJour) }}</span>
                <span class="text-sm font-bold text-white/80">/ jour</span>
            </p>
            <p class="mt-1.5 md:mt-2 text-xs md:text-sm font-bold text-white/90"><span data-meteo-rav>{{ formatMad(Math.max(0, meteo.rav)) }}</span> jusqu'à la paie du {{ meteo.prochainePaie }} · J−{{ meteo.jours }}</p>
            <p class="text-xs font-semibold text-white/75">soit {{ formatMad(meteo.parSemaine) }} par semaine</p>
        </div>
    </div>""", """        <div class="grid gap-2.5 md:gap-3 content-start">
            <!-- 🕊️ LIBERTÉ : la semaine en cours, prévu × réalisé -->
            <div data-pulse-liberte :data-rythme="p.rythme" class="rounded-2xl bg-white/15 backdrop-blur-md ring-1 ring-white/25 shadow-inner p-3 md:p-4">
                <div class="flex items-start justify-between gap-2">
                    <p class="text-[10px] font-black uppercase tracking-[0.2em] text-white/75">🕊️ Liberté de la semaine</p>
                    <span data-pulse-rythme :class="['shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ring-1',
                          p.rythme === 'depasse' ? 'bg-rose-500/30 ring-rose-200/40' : (p.rythme === 'avance' ? 'bg-amber-400/25 ring-amber-200/40' : 'bg-emerald-400/20 ring-emerald-200/30')]"><span class="hidden md:inline">{{ rythmeTexte }}</span><span class="md:hidden">{{ rythmeCourt }}</span></span>
                </div>
                <p class="mt-1 flex items-baseline gap-2 flex-wrap tabular-nums">
                    <span class="text-3xl md:text-5xl font-black tracking-tight leading-none" data-pulse-montant>{{ formatMad(p.liberte) }}</span>
                    <span class="text-xs md:text-sm font-bold text-white/80">à dépenser librement d'ici dimanche {{ p.au }}</span>
                </p>
                <!-- La semaine en 7 cases : le remplissage = l'enveloppe consommée, le repère = aujourd'hui -->
                <div class="relative mt-3" role="img" :aria-label="p.pct + ' % de l’enveloppe hebdomadaire consommée, au jour ' + (p.idxJour + 1) + ' sur 7'">
                    <div class="h-3 rounded-full bg-black/25 ring-1 ring-inset ring-white/10 overflow-hidden">
                        <div data-pulse-jauge :class="['h-full rounded-full transition-all duration-700 ease-out', remplissage]" :style="{ width: Math.min(100, p.pct) + '%' }"></div>
                    </div>
                    <div aria-hidden="true" class="absolute inset-0 flex pointer-events-none">
                        <span v-for="i in 6" :key="'sep' + i" class="flex-1 border-r border-white/25"></span><span class="flex-1"></span>
                    </div>
                    <div data-pulse-repere aria-hidden="true" class="absolute -top-1 -bottom-1 w-1 -ml-0.5 rounded-full bg-white shadow" :style="{ left: p.pctTemps + '%' }"></div>
                </div>
                <div aria-hidden="true" class="mt-1 hidden md:grid grid-cols-7 text-center text-[9px] font-black">
                    <span v-for="(j, i) in p.jours" :key="'j' + i" :class="i === p.idxJour ? 'text-white' : (i < p.idxJour ? 'text-white/60' : 'text-white/35')">{{ j }}</span>
                </div>
                <p class="mt-1.5 text-[11px] font-bold text-white/90" data-pulse-legende>
                    {{ p.pct }} % de l'enveloppe de la semaine consommée · {{ formatMad(p.depense) }} sur {{ formatMad(p.enveloppe) }}
                </p>
                <p v-if="p.depassement > 0" class="mt-1 text-[11px] font-black text-rose-100">Dépassée de {{ formatMad(p.depassement) }} depuis lundi.</p>
                <p v-else-if="p.contrainte === 'tresorerie'" class="mt-1 text-[11px] font-bold text-amber-100 leading-snug" data-pulse-plafond>🏦 Plafonnée par la trésorerie : au-delà de {{ formatMad(p.plafond) }} cette semaine, vous entamez la part des semaines suivantes.</p>
                <p v-if="p.reelSansDates" class="mt-1 text-[10px] font-semibold text-white/70 leading-snug" data-pulse-sans-dates>Votre réel est saisi par catégorie, sans dates : la semaine ne peut pas le voir.<span class="hidden md:inline"> Saisissez vos dépenses (onglet Saisie) pour suivre la semaine.</span></p>
                <p v-else-if="!p.nbTx" class="mt-1 text-[10px] font-semibold text-white/70" data-pulse-vide>Aucune dépense saisie depuis lundi {{ p.du }}.</p>
                <p v-if="p.horsBudget > 0" class="mt-0.5 text-[10px] font-semibold text-white/60">+ {{ formatMad(p.horsBudget) }} saisis hors budget conso (factures, divers) : non comptés ici.</p>
                <ul v-if="p.categories && p.categories.length" class="hidden md:block mt-2.5 space-y-1">
                    <li v-for="c in p.categories.slice(0, 4)" :key="'pc_' + c.key" class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 text-[10px] font-bold text-white/85">
                        <span class="truncate">{{ c.label }}</span>
                        <span class="tabular-nums text-white/75">{{ formatMad(c.depense) }} / {{ formatMad(c.budget) }}</span>
                        <span class="col-span-2 h-1 rounded-full bg-black/20 overflow-hidden"><span class="block h-full rounded-full bg-white/70" :style="{ width: c.pct + '%' }"></span></span>
                    </li>
                </ul>
            </div>
            <!-- 🔒 SANCTUAIRE : l'argent déjà promis -->
            <div data-pulse-sanctuaire class="rounded-2xl bg-slate-950/35 backdrop-blur-md ring-1 ring-white/15 p-3 md:p-4">
                <div class="flex items-center gap-3">
                    <span aria-hidden="true" class="shrink-0 w-9 h-9 rounded-xl bg-white/10 ring-1 ring-white/20 flex items-center justify-center text-lg">🔒</span>
                    <div class="min-w-0">
                        <p class="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">Sanctuaire · 7<span class="hidden md:inline"> prochains</span> jours</p>
                        <p class="tabular-nums"><span class="text-xl md:text-2xl font-black" data-pulse-sanctuaire-montant>{{ formatMad(s.montant) }}</span> <span class="text-xs font-bold text-white/75">verrouillés</span></p>
                        <p v-if="s.nb" class="md:hidden text-[10px] font-semibold text-white/70">pour {{ s.nb }} prélèvement{{ s.nb > 1 ? 's' : '' }}<template v-if="s.retard">, dont {{ formatMad(s.retard) }} en retard</template></p>
                    </div>
                </div>
                <p class="hidden md:block mt-1.5 text-[11px] font-semibold text-white/80 leading-snug">
                    <template v-if="s.nb">Réservés à {{ s.nb }} prélèvement{{ s.nb > 1 ? 's' : '' }} à venir<template v-if="s.retard"> (dont {{ formatMad(s.retard) }} en retard)</template> : cet argent n'est pas à dépenser.</template>
                    <template v-else>Aucun prélèvement programmé dans les 7 prochains jours.</template>
                </p>
                <div v-if="s.natures && s.natures.length" class="hidden md:flex flex-wrap gap-1 mt-2">
                    <span v-for="n in s.natures" :key="'sn_' + n.cle" class="rounded-md bg-white/10 ring-1 ring-white/15 px-1.5 py-0.5 text-[10px] font-bold">{{ n.badge }} {{ formatMad(n.montant) }}</span>
                </div>
                <ul v-if="s.prochaines && s.prochaines.length" class="hidden md:block mt-2 space-y-0.5">
                    <li v-for="(t, i) in s.prochaines" :key="'sp_' + i" class="flex justify-between gap-2 text-[10px] font-semibold text-white/80">
                        <span class="truncate">{{ t.libelle }}<span v-if="t.jourPrevu" :class="['ml-1 font-black', t.retard ? 'text-rose-200' : 'text-white/60']">j.{{ t.jourPrevu }}</span></span>
                        <span class="tabular-nums shrink-0">{{ formatMad(t.reste) }}</span>
                    </li>
                </ul>
            </div>
        </div>
    </div>
    <!-- Le filet de sécurité : le cycle entier, en mention discrète -->
    <p class="relative mt-3 text-[10px] md:text-[11px] font-semibold text-white/70 leading-snug" data-meteo-filet>
        🛟 Filet du cycle : <span data-meteo-rav>{{ formatMad(Math.max(0, meteo.rav)) }}</span> <span class="hidden md:inline">dépensables </span>jusqu'à la paie<span class="hidden md:inline"> du {{ meteo.prochainePaie }}</span> (J−{{ meteo.jours }})<span class="hidden md:inline">,
        soit ≈ {{ formatMad(meteo.parSemaine) }} / semaine</span> · <span data-meteo-jour>{{ formatMad(meteo.parJour) }}</span> / jour<span class="hidden md:inline"> en moyenne</span>
    </p>""")

# Le chip « 7 prochains jours » disparaît : c'est désormais le Sanctuaire
sub('chips du bas', """            <span class="rounded-full bg-white/15 ring-1 ring-white/20 px-2.5 py-1">🔥 7 prochains jours : {{ formatMad(meteo.urgence) }}</span>
""", "")
sub('marge des chips', """    <div v-if="chips || lien" class="relative mt-3 md:mt-4 flex flex-wrap items-center gap-1.5 md:gap-2 text-[10px] md:text-[11px] font-bold">""",
    """    <div v-if="chips || lien" class="relative mt-2.5 md:mt-3 flex flex-wrap items-center gap-1.5 md:gap-2 text-[10px] md:text-[11px] font-bold">""")


sub('ciel compact', """    <div class="relative grid gap-4 md:gap-6 md:grid-cols-2 items-stretch">""", """    <div class="relative grid gap-3 md:gap-6 md:grid-cols-2 items-stretch">""")
sub('raison sur une ligne au téléphone', """<p class="mt-1 md:mt-1.5 text-xs md:text-sm font-semibold text-white/90 leading-snug" data-meteo-raison>""",
    """<p class="mt-1 md:mt-1.5 text-xs md:text-sm font-semibold text-white/90 leading-snug line-clamp-2 md:line-clamp-none" data-meteo-raison>""")
sub('logistique compacte au téléphone', """<p v-if="meteo.logistique" class="mt-2 inline-block rounded-xl bg-black/20 ring-1 ring-white/15 px-2.5 py-1.5 text-xs font-bold text-white leading-snug" data-meteo-logistique>""",
    """<p v-if="meteo.logistique" class="mt-1.5 md:mt-2 inline-block rounded-xl bg-black/20 ring-1 ring-white/15 px-2.5 py-1 md:py-1.5 text-[11px] md:text-xs font-bold text-white leading-snug" data-meteo-logistique>""")

sub('icône compacte au téléphone', """        <div class="flex gap-4 items-start min-w-0">
            <div class="meteo-flotte text-4xl md:text-6xl leading-none drop-shadow-lg select-none shrink-0" aria-hidden="true">{{ meteo.icone }}</div>""",
    """        <div class="flex gap-3 md:gap-4 items-start min-w-0">
            <div class="meteo-flotte text-3xl md:text-6xl leading-none drop-shadow-lg select-none shrink-0" aria-hidden="true">{{ meteo.icone }}</div>""")

for a, r in edits: src = src.replace(a, r, 1)
io.open(F, 'w', encoding='utf-8').write(src)
print(f'✔ {len(edits)} modifications appliquées')
