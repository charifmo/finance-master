# -*- coding: utf-8 -*-
"""
v37.17 Meteo-Financiere — PARTIE GABARIT. À jouer après refacto_meteo_js_v3717.py.

  1. <meteo-financiere> : UN composant, posé en tête du Pilotage Réalisé, du
     Prévisionnel (bureau) et de l'accueil mobile du Prévisionnel — la même
     météo, le même reste à vivre, quel que soit l'écran.
  2. Le Prévisionnel devient une « respiration budgétaire » : une barre où
     chaque poste prend sa vraie place face aux revenus, puis des cartes où
     chaque ligne porte sa propre barre de poids.
  3. « À traiter » : cartes à liseré de couleur, saisie invitante pour le
     variable et l'exceptionnel, saisie discrète pour le fixe — que le bouton
     ⚡ prend en charge, et qui s'allume quand on survole ce bouton.
Ancres vérifiées avant écriture.
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

# ─── 1. Le composant ────────────────────────────────────────────────────────
COMPOSANT = r"""        /* ═══ v37.17 — MÉTÉO FINANCIÈRE ═══════════════════════════════════════
           Un composant, trois emplacements. Il n'affiche que ce que lui passe
           le computed meteoFinanciere : aucune logique d'argent ici. */
        const MeteoFinanciere = {
            props: { meteo: { type: Object, required: true }, formatMad: { type: Function, required: true },
                     lien: { type: String, default: null }, chips: { type: Boolean, default: true } },
            emits: ['aller', 'revenir'],
            computed: {
                fond() {
                    return this.meteo.etat === 'orage' ? 'from-rose-600 via-red-700 to-slate-900'
                         : this.meteo.etat === 'nuages' ? 'from-slate-500 via-slate-600 to-slate-800'
                         : 'from-sky-500 via-sky-600 to-indigo-700';
                },
            },
            template: `
<section data-meteo :data-etat="meteo.etat" :class="['relative overflow-hidden rounded-3xl p-4 md:p-6 text-white shadow-xl shadow-slate-900/20 bg-gradient-to-br', fond]">
    <div aria-hidden="true" class="pointer-events-none absolute -top-20 -right-16 w-64 h-64 rounded-full bg-white/20 blur-3xl"></div>
    <div aria-hidden="true" class="pointer-events-none absolute -bottom-24 -left-10 w-56 h-56 rounded-full bg-black/10 blur-3xl"></div>
    <div v-if="meteo.retro" class="relative mb-4 flex items-center justify-between gap-3 flex-wrap rounded-2xl bg-black/25 ring-1 ring-white/20 px-3 py-2 text-xs font-bold">
        <span>🕰️ Vous régularisez {{ meteo.cycleConsulte }} : la météo, elle, parle du cycle en cours.</span>
        <button type="button" @click="$emit('revenir')" class="shrink-0 rounded-lg bg-white/90 text-slate-900 px-2.5 py-1 text-[11px] font-black hover:bg-white">Cycle actuel</button>
    </div>
    <div class="relative grid gap-4 md:gap-6 md:grid-cols-2 items-stretch">
        <div class="flex gap-4 items-start min-w-0">
            <div class="meteo-flotte text-4xl md:text-6xl leading-none drop-shadow-lg select-none shrink-0" aria-hidden="true">{{ meteo.icone }}</div>
            <div class="min-w-0">
                <p class="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">Météo financière</p>
                <h3 class="text-xl md:text-3xl font-black tracking-tight leading-tight" data-meteo-titre>{{ meteo.titre }}</h3>
                <p class="mt-1 md:mt-1.5 text-xs md:text-sm font-semibold text-white/90 leading-snug" data-meteo-raison>{{ meteo.raison }}</p>
                <p class="mt-1.5 md:mt-2 text-xs md:text-sm font-black text-white leading-snug" data-meteo-conseil>👉 {{ meteo.conseil }}</p>
            </div>
        </div>
        <div class="rounded-2xl bg-white/15 backdrop-blur-md ring-1 ring-white/25 shadow-inner p-3.5 md:p-5 flex flex-col justify-center">
            <p class="text-[10px] font-black uppercase tracking-[0.2em] text-white/75">Reste à vivre aujourd'hui</p>
            <p class="mt-1 flex items-baseline gap-2 flex-wrap tabular-nums">
                <span class="text-4xl md:text-6xl font-black tracking-tight leading-none" data-meteo-jour>{{ formatMad(meteo.parJour) }}</span>
                <span class="text-sm font-bold text-white/80">/ jour</span>
            </p>
            <p class="mt-1.5 md:mt-2 text-xs md:text-sm font-bold text-white/90"><span data-meteo-rav>{{ formatMad(Math.max(0, meteo.rav)) }}</span> jusqu'à la paie du {{ meteo.prochainePaie }} · J−{{ meteo.jours }}</p>
            <p class="text-xs font-semibold text-white/75">soit {{ formatMad(meteo.parSemaine) }} par semaine</p>
        </div>
    </div>
    <div v-if="chips || lien" class="relative mt-3 md:mt-4 flex flex-wrap items-center gap-1.5 md:gap-2 text-[10px] md:text-[11px] font-bold">
        <template v-if="chips">
            <span class="rounded-full bg-white/15 ring-1 ring-white/20 px-2.5 py-1">🏁 Atterrissage le {{ meteo.dateFin }} : {{ formatMad(meteo.atterrissage) }}</span>
            <span class="rounded-full bg-white/15 ring-1 ring-white/20 px-2.5 py-1">🔥 7 prochains jours : {{ formatMad(meteo.urgence) }}</span>
            <span class="rounded-full bg-white/15 ring-1 ring-white/20 px-2.5 py-1">🫁 Respiration du budget : {{ meteo.respirationPct }} %</span>
        </template>
        <button v-if="lien" type="button" data-meteo-lien @click="$emit('aller')"
                class="ml-auto rounded-full bg-white text-slate-900 px-3.5 py-1.5 text-[11px] font-black shadow-md hover:shadow-lg hover:-translate-y-0.5 transition">{{ lien }} →</button>
    </div>
</section>`,
        };

        const BaseChart = {"""
sub('composant avant BaseChart', """        const BaseChart = {""", COMPOSANT)
sub('enregistrement du composant', """                components: { 'base-chart': BaseChart },""",
    """                components: { 'base-chart': BaseChart, 'meteo-financiere': MeteoFinanciere },""")

# ─── 2. Styles : flottement de l'icône, respect de « réduire les animations » ─
sub('styles', """        .tache-move { transition: transform 0.28s ease; }""",
"""        .tache-move { transition: transform 0.28s ease; }
        /* v37.17 : l'icône de météo respire doucement — jamais pour qui a demandé moins d'animations */
        .meteo-flotte { animation: meteoFlotte 6s ease-in-out infinite; }
        @keyframes meteoFlotte { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @media (prefers-reduced-motion: reduce) { .meteo-flotte { animation: none; } .tache-enter-active, .tache-leave-active, .tache-move { transition: none; } }
        /* v37.17 : les flèches du champ numérique rognaient le texte d'invite */
        input[data-saisie]::-webkit-outer-spin-button, input[data-saisie]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[data-saisie] { -moz-appearance: textfield; appearance: textfield; }""")

# ─── 3. La météo en tête du Pilotage Réalisé ────────────────────────────────
sub('météo dans le Réalisé', """                    <!-- Bannière Mode Régularisation -->
                    <div v-if="isPilotageRetro" class="flex items-center gap-3 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3">""",
"""                    <!-- v37.17 : la même météo que dans le Prévisionnel -->
                    <meteo-financiere :meteo="meteoFinanciere" :format-mad="formatMAD" :chips="false"
                                      :lien="isMobile ? null : 'Voir le budget prévu'"
                                      @aller="appMode = 'previsionnel'; activeTab = 'pilotageTheo'"
                                      @revenir="pilotageViewedCycle = null"></meteo-financiere>

                    <!-- Bannière Mode Régularisation -->
                    <div v-if="isPilotageRetro" class="flex items-center gap-3 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3">""")

# ─── 4. … et en tête de l'accueil mobile du Prévisionnel ────────────────────
sub('météo mobile prévi', """            <!-- CONTENT -->
            <div class="px-3 py-4">
""", """            <!-- CONTENT -->
            <div class="px-3 py-4">
                <!-- v37.17 : sur téléphone, le Prévisionnel n'a pas d'onglet « Théorique » :
                     la météo se pose donc ici, en tête de chaque écran. -->
                <div class="mb-4">
                    <meteo-financiere :meteo="meteoFinanciere" :format-mad="formatMAD" lien="Pointer le réalisé"
                                      @aller="appMode = 'reel'; activeTab = 'pilotage'"
                                      @revenir="pilotageViewedCycle = null"></meteo-financiere>
                </div>
""")

# ─── 5. Le Prévisionnel, refondu ────────────────────────────────────────────
DEBUT = """                <div v-if="activeTab === 'pilotageTheo' && appMode === 'previsionnel'" class="max-w-4xl mx-auto space-y-6">\n"""
FIN = """                <div v-if="activeTab === 'dashboard'" class="max-w-6xl mx-auto space-y-6">\n"""
for nom, a in (('début Théorique', DEBUT), ('début Dashboard', FIN)):
    if src.count(a) != 1:
        print(f'✖ {nom} : {src.count(a)} ancre(s)'); sys.exit(1)

VERRE = "rounded-3xl bg-white/80 backdrop-blur-xl ring-1 ring-slate-900/5 shadow-[0_10px_40px_-14px_rgba(15,23,42,0.22)]"
LIGNE_DATE = """<span v-if="isFluxCetteSemaine(l.jourPrevu)" class="text-[9px] font-black bg-amber-100 text-amber-700 border border-amber-300 px-1.5 py-0.5 rounded-full">⏳ Cette semaine</span>
                                            <span v-if="l.jourPrevu" class="text-[10px] text-slate-400 font-bold">📅 j.{{ l.jourPrevu }}</span>"""

THEO = """                <div v-if="activeTab === 'pilotageTheo' && appMode === 'previsionnel'" class="max-w-4xl mx-auto space-y-5" data-theo>
                    <!-- ═══════════════════════════════════════════════════════════════
                         v37.17 — LE PRÉVISIONNEL RESPIRE
                         Avant : quatre listes de chiffres. Maintenant : une barre où
                         chaque poste prend sa vraie place face aux revenus, et pour
                         chaque ligne une barre de poids. On ressent avant de lire.
                         Mêmes conventions que le moteur du simulateur : exceptions au
                         mois budgétaire, catégories hebdomadaires × 4,3.
                         ═══════════════════════════════════════════════════════════════ -->
                    <div class="flex items-start justify-between gap-3 flex-wrap">
                        <div class="min-w-0">
                            <h2 class="text-xl md:text-2xl font-black text-gray-800 leading-tight">🔮 Budget prévu du cycle</h2>
                            <p class="text-xs md:text-sm text-gray-500 mt-0.5 font-bold">{{ cycleLabel }} · budget de {{ nomDuMois(moisBudgetaire.mois) }}</p>
                        </div>
                        <span class="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200">Vue Prévi · Lecture seule</span>
                    </div>

                    <meteo-financiere :meteo="meteoFinanciere" :format-mad="formatMAD" lien="Pointer le réalisé"
                                      @aller="appMode = 'reel'; activeTab = 'pilotage'"
                                      @revenir="pilotageViewedCycle = null"></meteo-financiere>

                    <!-- 🫁 La jauge de respiration -->
                    <section data-respiration :data-niveau="respirationBudgetaire.niveau" class=\"""" + VERRE + """ p-5 md:p-6">
                        <div class="flex items-start justify-between gap-4 flex-wrap">
                            <div class="min-w-0">
                                <p class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">🫁 Respiration budgétaire</p>
                                <p class="mt-1 flex items-baseline gap-2 flex-wrap">
                                    <span data-respiration-pct
                                          :class="['text-4xl md:text-5xl font-black tracking-tight tabular-nums',
                                                   respirationBudgetaire.niveau === 'ample' ? 'text-emerald-600'
                                                   : (respirationBudgetaire.niveau === 'serre' ? 'text-amber-600'
                                                   : (respirationBudgetaire.niveau === 'court' ? 'text-orange-600' : 'text-rose-600'))]">{{ respirationBudgetaire.pct }} %</span>
                                    <span class="text-sm font-black text-slate-700">{{ NIVEAUX_RESPIRATION[respirationBudgetaire.niveau].label }}</span>
                                </p>
                                <p class="text-xs font-semibold text-slate-500 mt-1 max-w-md">{{ NIVEAUX_RESPIRATION[respirationBudgetaire.niveau].phrase }}</p>
                            </div>
                            <div class="text-right shrink-0">
                                <p class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Ce qui rentre</p>
                                <p class="text-2xl font-black text-slate-900 tabular-nums" data-respiration-ressources>{{ formatMAD(respirationBudgetaire.ressources) }}</p>
                                <p v-if="respirationBudgetaire.injections" class="text-[11px] font-bold text-emerald-600">dont {{ formatMAD(respirationBudgetaire.injections) }} d'injection exceptionnelle</p>
                                <p :class="['text-xs font-black', respirationBudgetaire.marge >= 0 ? 'text-emerald-600' : 'text-rose-600']" data-respiration-marge>
                                    {{ respirationBudgetaire.marge >= 0 ? 'Marge libre' : 'Déficit' }} : {{ formatMAD(respirationBudgetaire.marge) }}
                                </p>
                            </div>
                        </div>
                        <!-- La barre : 100 % = le plus grand de « ce qui rentre » et « ce qui sort » -->
                        <div class="relative mt-5">
                            <div class="h-7 w-full rounded-full bg-slate-100 overflow-hidden flex ring-1 ring-inset ring-slate-900/5" data-respiration-barre role="img"
                                 :aria-label="'Respiration budgétaire : ' + respirationBudgetaire.pct + ' % des revenus restent libres'">
                                <div v-for="s in respirationBudgetaire.segments.filter(x => x.montant > 0)" :key="'rs_' + s.cle" :data-segment="s.cle"
                                     :class="[s.couleur, 'h-full transition-all duration-700 border-r border-white/60 last:border-r-0']"
                                     :style="{ width: s.part + '%' }" :title="s.label + ' : ' + formatMAD(s.montant) + ' (' + s.pctRevenus + ' % des revenus)'"></div>
                                <div v-if="respirationBudgetaire.partMarge > 0" data-segment="marge" class="h-full"
                                     :style="{ width: respirationBudgetaire.partMarge + '%', backgroundImage: 'repeating-linear-gradient(135deg, rgba(16,185,129,.45) 0 7px, rgba(16,185,129,.18) 7px 14px)' }"
                                     :title="'Marge libre : ' + formatMAD(respirationBudgetaire.marge)"></div>
                            </div>
                            <!-- En déficit, un repère montre où s'arrêtent les revenus -->
                            <div v-if="respirationBudgetaire.marge < 0" data-repere-revenus class="absolute -top-1.5 -bottom-1.5 w-0.5 bg-slate-900 rounded-full"
                                 :style="{ left: (respirationBudgetaire.ressources / Math.max(1, respirationBudgetaire.sorties) * 100) + '%' }">
                                <span class="absolute top-full mt-1 -translate-x-1/2 whitespace-nowrap text-[10px] font-black text-slate-700">↑ vos revenus</span>
                            </div>
                        </div>
                        <!-- Légende -->
                        <div class="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                            <div v-for="s in respirationBudgetaire.segments" :key="'lg_' + s.cle" class="flex items-start gap-2 min-w-0">
                                <span :class="[s.couleur, 'mt-1 w-2.5 h-2.5 rounded-full shrink-0']"></span>
                                <div class="min-w-0">
                                    <p class="text-[11px] font-bold text-slate-500 truncate">{{ s.icone }} {{ s.label }}</p>
                                    <p class="text-sm font-black text-slate-900 tabular-nums">{{ formatMAD(s.montant) }} <span class="text-[11px] font-bold text-slate-400">· {{ s.pctRevenus }} %</span></p>
                                </div>
                            </div>
                            <div class="flex items-start gap-2 min-w-0">
                                <span :class="['mt-1 w-2.5 h-2.5 rounded-full shrink-0', respirationBudgetaire.marge >= 0 ? 'bg-emerald-400' : 'bg-rose-600']"></span>
                                <div class="min-w-0">
                                    <p class="text-[11px] font-bold text-slate-500">{{ respirationBudgetaire.marge >= 0 ? '🌿 Marge libre' : '🚨 Déficit' }}</p>
                                    <p :class="['text-sm font-black tabular-nums', respirationBudgetaire.marge >= 0 ? 'text-emerald-700' : 'text-rose-700']">{{ formatMAD(respirationBudgetaire.marge) }} <span class="text-[11px] font-bold text-slate-400">· {{ respirationBudgetaire.pct }} %</span></p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <!-- Le détail : chaque ligne porte la barre de son poids dans les revenus -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <section data-theo-carte="revenus" class=\"""" + VERRE + """ p-4 md:p-5">
                            <div class="flex items-baseline justify-between gap-3 mb-3">
                                <h3 class="text-xs font-black uppercase tracking-[0.15em] text-emerald-700">💰 Ce qui rentre</h3>
                                <span class="text-sm font-black text-slate-900 tabular-nums">{{ formatMAD(respirationBudgetaire.ressources) }}</span>
                            </div>
                            <p v-if="!respirationBudgetaire.lignes.revenus.length" class="text-xs text-slate-400 italic">Aucun revenu défini</p>
                            <ul class="space-y-2.5">
                                <li v-for="(l, i) in respirationBudgetaire.lignes.revenus.concat(respirationBudgetaire.lignes.injections)" :key="'tr_' + i">
                                    <div class="flex items-center justify-between gap-2 text-xs">
                                        <span class="font-bold text-slate-700 truncate min-w-0">{{ l.nom }}</span>
                                        <span class="flex items-center gap-1.5 shrink-0">
                                            """ + LIGNE_DATE + """
                                            <span class="font-black text-emerald-700 tabular-nums">{{ formatMAD(l.montant) }}</span>
                                        </span>
                                    </div>
                                    <div class="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                        <div class="h-full rounded-full bg-emerald-500" :style="{ width: Math.min(100, l.montant / Math.max(1, respirationBudgetaire.ressources) * 100) + '%' }"></div>
                                    </div>
                                </li>
                            </ul>
                        </section>
                        <section v-for="s in respirationBudgetaire.segments.filter(x => x.lignes.length)" :key="'tc_' + s.cle" :data-theo-carte="s.cle" class=\"""" + VERRE + """ p-4 md:p-5">
                            <div class="flex items-baseline justify-between gap-x-3 gap-y-1 mb-3 flex-wrap">
                                <h3 class="text-xs font-black uppercase tracking-[0.15em] text-slate-700 whitespace-nowrap">{{ s.icone }} {{ s.label }}</h3>
                                <span class="text-sm font-black text-slate-900 tabular-nums whitespace-nowrap">{{ formatMAD(s.montant) }} <span class="text-[11px] font-bold text-slate-400">· {{ s.pctRevenus }} % des revenus</span></span>
                            </div>
                            <p v-if="s.cle === 'conso'" class="-mt-1.5 mb-3 text-[11px] font-bold text-teal-700">≈ {{ formatMAD(respirationBudgetaire.consoParSemaine) }} par semaine · budget hebdo × 4,3</p>
                            <ul class="space-y-2.5">
                                <li v-for="(l, i) in s.lignes" :key="'tl_' + s.cle + i">
                                    <div class="flex items-center justify-between gap-2 text-xs">
                                        <span class="font-bold text-slate-700 truncate min-w-0">{{ l.nom }}</span>
                                        <span class="flex items-center gap-1.5 shrink-0">
                                            """ + LIGNE_DATE + """
                                            <span class="font-black text-slate-900 tabular-nums">{{ formatMAD(l.montant) }}</span>
                                        </span>
                                    </div>
                                    <div class="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                        <div :class="['h-full rounded-full', s.couleur]" :style="{ width: Math.min(100, l.montant / Math.max(1, respirationBudgetaire.ressources) * 100) + '%' }"></div>
                                    </div>
                                    <p v-if="l.detail" class="mt-0.5 text-[10px] font-semibold text-slate-400 truncate">{{ l.detail }}</p>
                                    <p v-if="l.parSemaine" class="mt-0.5 text-[10px] font-semibold text-slate-400">{{ formatMAD(l.parSemaine) }} / semaine</p>
                                </li>
                            </ul>
                        </section>
                    </div>

                    <div class="rounded-2xl bg-indigo-50/70 ring-1 ring-indigo-200 p-3.5 text-[11px] text-indigo-800 leading-snug">
                        ℹ️ <b>Vue prévue</b> : ces montants sont ceux du Budget Structurel pour {{ nomDuMois(moisBudgetaire.mois) }}, exceptions comprises, sans tenir compte de ce qui est déjà pointé.
                        La météo, elle, lit le réel. Pour pointer, bascule sur <b class="text-emerald-700">📊 Réalisé</b>.
                    </div>
                </div>

"""
i, j = src.index(DEBUT), src.index(FIN)
src_avant = src

# ─── 6. « À traiter » : le bandeau ⚡ et les cartes ──────────────────────────
sub('bandeau validation rapide', """                            <div v-if="chargesFixesEchues.length" data-validation-rapide
                                 class="px-4 md:px-5 py-3 border-b border-slate-700 bg-emerald-950/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div class="min-w-0 flex-1">
                                    <p class="text-xs font-black text-emerald-200">
                                        {{ chargesFixesEchues.length }} charge{{ chargesFixesEchues.length > 1 ? 's' : '' }} fixe{{ chargesFixesEchues.length > 1 ? 's' : '' }} échue{{ chargesFixesEchues.length > 1 ? 's' : '' }} · {{ formatMAD(montantChargesFixesEchues) }}
                                    </p>
                                    <p class="text-[10px] font-bold text-slate-400 break-words">{{ chargesFixesEchues.map(t => t.libelle + ' (j.' + t.jourPrevu + ')').join(' · ') }}</p>
                                </div>
                                <button type="button" @click="validerChargesEchues()" data-valider-echues
                                        class="w-full sm:w-auto shrink-0 px-4 py-3 sm:py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black uppercase tracking-widest shadow-lg transition-colors">✅ Valider les charges échues</button>
                            </div>""",
"""                            <div v-if="chargesFixesEchues.length" data-validation-rapide
                                 class="px-4 md:px-5 py-4 border-b border-slate-700 bg-gradient-to-r from-emerald-500/20 via-emerald-500/10 to-transparent flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div class="flex items-start gap-3 min-w-0 flex-1">
                                    <span aria-hidden="true" class="shrink-0 w-10 h-10 rounded-2xl bg-emerald-400/20 ring-1 ring-emerald-300/40 flex items-center justify-center text-xl">⚡</span>
                                    <div class="min-w-0">
                                        <p class="text-sm font-black text-emerald-100">
                                            {{ chargesFixesEchues.length }} charge{{ chargesFixesEchues.length > 1 ? 's' : '' }} fixe{{ chargesFixesEchues.length > 1 ? 's' : '' }} échue{{ chargesFixesEchues.length > 1 ? 's' : '' }} · {{ formatMAD(montantChargesFixesEchues) }}
                                        </p>
                                        <p class="text-[11px] font-bold text-emerald-200/70 break-words">{{ chargesFixesEchues.map(t => t.libelle + ' (j.' + t.jourPrevu + ')').join(' · ') }}</p>
                                    </div>
                                </div>
                                <button type="button" data-valider-echues
                                        @mouseenter="surbrillanceEchues = true" @mouseleave="surbrillanceEchues = false"
                                        @focus="surbrillanceEchues = true" @blur="surbrillanceEchues = false"
                                        @click="surbrillanceEchues = false; validerChargesEchues()"
                                        class="w-full sm:w-auto shrink-0 px-5 py-3 rounded-2xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-950/50 hover:-translate-y-0.5 active:translate-y-0 transition">✅ Valider les charges échues</button>
                            </div>""")

sub('carte de tâche', """                                        <div v-for="t in paquet.taches" :key="t.cle" data-tache
                                             :class="['flex flex-wrap items-center gap-x-3 gap-y-2 p-3 bg-slate-900/90 rounded-xl border transition-colors',
                                                      t.nature === 'fixe' ? 'border-slate-700 hover:border-orange-500'
                                                      : (t.nature === 'variable' ? 'border-slate-700 hover:border-sky-500'
                                                      : (t.nature === 'epargne' ? 'border-slate-700 hover:border-violet-500' : 'border-slate-700 hover:border-rose-500'))]">
                                            <label class="flex items-center gap-2.5 cursor-pointer flex-1 min-w-[12rem]">
                                                <input type="checkbox" :checked="false"
                                                       @change="toggleItemPaid(t.ref, t.due, cyclePilotage)"
                                                       class="w-5 h-5 rounded border-slate-600 bg-slate-800 text-green-500 focus:ring-green-500 cursor-pointer shrink-0"/>""",
"""                                        <div v-for="t in paquet.taches" :key="t.cle" data-tache :data-nature-ligne="t.nature"
                                             :class="['relative flex flex-wrap items-center gap-x-3 gap-y-2 pl-4 pr-3 py-3 rounded-2xl border bg-gradient-to-r shadow-md shadow-black/20 transition-all duration-200 hover:shadow-xl hover:shadow-black/30',
                                                      t.nature === 'fixe' ? 'from-orange-500/10 via-slate-900 to-slate-900 border-orange-500/20 hover:border-orange-400/60'
                                                      : (t.nature === 'variable' ? 'from-sky-500/10 via-slate-900 to-slate-900 border-sky-500/20 hover:border-sky-400/60'
                                                      : (t.nature === 'epargne' ? 'from-violet-500/10 via-slate-900 to-slate-900 border-violet-500/20 hover:border-violet-400/60'
                                                      : 'from-rose-500/10 via-slate-900 to-slate-900 border-rose-500/20 hover:border-rose-400/60')),
                                                      surbrillanceEchues && estEchue(t) ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-800' : '']">
                                            <span aria-hidden="true" :class="['absolute left-0 top-3 bottom-3 w-1 rounded-r-full',
                                                  t.nature === 'fixe' ? 'bg-orange-400' : (t.nature === 'variable' ? 'bg-sky-400' : (t.nature === 'epargne' ? 'bg-violet-400' : 'bg-rose-400'))]"></span>
                                            <label class="flex items-center gap-2.5 cursor-pointer flex-1 min-w-[12rem]">
                                                <input type="checkbox" :checked="false"
                                                       @change="toggleItemPaid(t.ref, t.due, cyclePilotage)"
                                                       title="Pointer comme payé"
                                                       class="w-5 h-5 accent-emerald-500 cursor-pointer shrink-0 transition-transform hover:scale-110"/>""")

sub('pastille échue après le nom', """                                                <span v-if="t.nature === 'variable'" class="text-[9px] text-slate-500 font-bold uppercase tracking-widest hidden md:inline shrink-0">{{ t.groupe }}</span>
                                            </label>""",
"""                                                <span v-if="t.nature === 'variable'" class="text-[9px] text-slate-500 font-bold uppercase tracking-widest hidden md:inline shrink-0">{{ t.groupe }}</span>
                                                <span v-if="estEchue(t)" data-chip-echue title="Comprise dans « Valider les charges échues »"
                                                      class="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 whitespace-nowrap shrink-0">⚡ échue</span>
                                            </label>""")

sub('saisie du montant', """                                                <input type="number" :value="montantPayeCycle(t.ref, cyclePilotage)"
                                                       @input="setMontantPayeCycle(t.ref, $event.target.value, cyclePilotage)"
                                                       placeholder="0" title="Avance déjà versée"
                                                       class="w-20 bg-slate-950 text-slate-200 border border-slate-600 rounded p-1.5 text-right text-xs font-bold outline-none focus:border-blue-400 transition-colors"/>
                                                <span class="text-[10px] font-black text-slate-400 w-16 text-right tabular-nums">/ {{ formatNombre(t.due) }}</span>""",
"""                                                <!-- v37.17 : le variable et l'exceptionnel se SAISISSENT (le montant
                                                     réel varie) ; le fixe se COCHE — sa saisie reste discrète, pour
                                                     une avance partielle, et le bouton ⚡ fait le reste. -->
                                                <div class="relative">
                                                    <input type="number" inputmode="decimal" min="0"
                                                           :value="montantPayeCycle(t.ref, cyclePilotage) || ''"
                                                           @input="setMontantPayeCycle(t.ref, $event.target.value, cyclePilotage)"
                                                           :data-saisie="(t.nature === 'variable' || t.nature === 'exceptionnel') ? 'invitante' : 'discrete'"
                                                           :placeholder="(t.nature === 'variable' || t.nature === 'exceptionnel') ? 'Saisir' : 'avance'"
                                                           :title="(t.nature === 'variable' || t.nature === 'exceptionnel') ? 'Saisissez ce qui a vraiment été payé' : 'Avance partielle déjà versée'"
                                                           :class="t.nature === 'variable'
                                                               ? 'w-36 h-10 bg-slate-950 border-2 border-sky-500/40 rounded-xl pl-3 pr-9 text-right text-sm font-black text-sky-100 placeholder:text-sky-300/50 placeholder:font-semibold outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-500/20 transition'
                                                               : (t.nature === 'exceptionnel'
                                                               ? 'w-36 h-10 bg-slate-950 border-2 border-rose-500/40 rounded-xl pl-3 pr-9 text-right text-sm font-black text-rose-100 placeholder:text-rose-300/50 placeholder:font-semibold outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-500/20 transition'
                                                               : 'w-16 h-8 bg-transparent border border-slate-700/60 hover:border-slate-500 rounded-lg px-2 text-right text-xs font-bold text-slate-400 placeholder:text-slate-600 outline-none focus:border-slate-400 transition')"/>
                                                    <span v-if="t.nature === 'variable' || t.nature === 'exceptionnel'" aria-hidden="true"
                                                          :class="['pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black', t.nature === 'variable' ? 'text-sky-300/70' : 'text-rose-300/70']">DH</span>
                                                </div>
                                                <span class="text-[10px] font-black text-slate-400 w-16 text-right tabular-nums">/ {{ formatNombre(t.due) }}</span>""")

for a, r in edits:
    src = src.replace(a, r, 1)
# Le Prévisionnel en dernier : les ancres du bloc sont indépendantes des précédentes.
i, j = src.index(DEBUT), src.index(FIN)
src = src[:i] + THEO + src[j:]
io.open(F, 'w', encoding='utf-8').write(src)
print(f'✔ {len(edits)} modifications + Prévisionnel remplacé')
