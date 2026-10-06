# -*- coding: utf-8 -*-
"""
v37.24 Une-Seule-Saisie — PARTIE GABARIT.

  UN endroit pour regarder ET agir : la carte « Reste à dépenser ».
    • Chaque ligne de catégorie porte son champ « déjà dépensé » : on clique
      sur la ligne « Alimentation », on tape 1500, le grand chiffre bouge en
      direct. Plus besoin d'ouvrir un panneau pour saisir.
    • La partie gauche de la ligne (anneau, nom, reste) reste le déclencheur
      des Rayons X — désormais un pur outil d'AUDIT : courses prévues, tickets
      datés, et ce qui a été retenu (compteur ou tickets). Plus de saisie dedans.
    • « ⓘ » à côté du titre ouvre le détail du calcul (ex-bulle « Disponible
      réel ») : 🅰️ budget − engagé, 🅱️ trésorerie, le plus petit des deux.
    • L'ancien bloc « Réalisé à T0 — conso engagée » disparaît du DOM. Son
      seul contenu sans équivalent, le mode Voyage (dates d'absence, catégories
      suspendues), devient un petit volet repliable.
    • « ⚡ Depuis le réel » disparaît : les tickets comptent d'eux-mêmes depuis
      la v37.23. « ↩ Tout effacer » vit dans l'en-tête des lignes.
"""
import io, re, sys
F = 'index.html'
src = io.open(F, encoding='utf-8').read()
edits = []
def sub(label, anchor, replacement, expected=1):
    n = src.count(anchor)
    if n != expected:
        print(f'✖ {label} : {n} ancre(s), {expected} attendue(s)'); sys.exit(1)
    edits.append((anchor, replacement))
def bloc(label, debut, fin, nouveau):
    global src
    i, j = src.find(debut), src.find(fin)
    if i < 0 or j < 0 or j <= i or src.count(debut) != 1:
        print(f'✖ {label} : bornes introuvables'); sys.exit(1)
    src = src[:i] + nouveau + src[j:]

# ── 1. Le script du composant ───────────────────────────────────────────────
sub('événement effacer', """            emits: ['aller', 'revenir', 'compteur'],""", """            emits: ['aller', 'revenir', 'compteur', 'effacer'],""")
sub('panneau « calcul »', """                    if (r.type === 'hors') return""", """                    if (r.type === 'calcul') return { type: 'calcul' };
                    if (r.type === 'hors') return""")
sub('invite du champ', """                saisirCompteur(cle, e) { this.$emit('compteur', cle, e.target.value); },""",
    """                saisirCompteur(cle, e) { this.$emit('compteur', cle, e.target.value); },
                //  L'invite du champ dit ce qui compte tant qu'on n'a rien tapé :
                //  les tickets s'il y en a, sinon l'estimation au rythme attendu.
                invite(c) { return c.tickets > 0 ? String(c.tickets) : (c.source === 'estime' ? '≈ ' + this.chiffre(c.engage) : '0'); },""")

# ── 2. La carte : « ⓘ », note, lignes avec champ de saisie ─────────────────
sub('ⓘ : comment est calculé ce chiffre', """                <p class="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 whitespace-nowrap">💸 Reste à dépenser</p>""",
    """                <p class="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-white/60 whitespace-nowrap">💸 Reste à dépenser
                    <button type="button" data-rx-ancre data-liberte-calcul :aria-expanded="estOuvert('calcul', 'calcul') ? 'true' : 'false'" aria-label="Comment est calculé ce chiffre"
                            @pointerenter="survolEntree($event, 'calcul', 'calcul')" @pointerleave="survolSortie($event)" @click="basculer($event, 'calcul', 'calcul')"
                            class="inline-flex items-center justify-center w-4 h-4 rounded-full ring-1 ring-white/30 text-[9px] font-black normal-case tracking-normal text-white/70 hover:bg-white/20 hover:text-white">i</button>
                </p>""")
m = re.search(r'                <p v-if="!p\.declare" class="mt-2 text-\[11px\] font-semibold text-white/80 leading-snug" data-liberte-estime>.*?</p>\n', src)
if not m: print('✖ note « estimé » introuvable'); sys.exit(1)
edits.append((m.group(0), """                <p v-if="!p.declare" class="mt-2 text-[11px] font-semibold text-white/80 leading-snug" data-liberte-estime>✍️ <span class="hidden md:inline">Rien de déclaré : reste estimé au prorata du temps. Tapez ce que vous avez déjà dépensé sur chaque ligne ci-dessous — un total suffit, sans date.</span><span class="md:hidden">Estimé : tapez vos totaux ci-dessous.</span></p>
"""))
bloc('lignes de catégorie', '            <!-- Par catégorie : le reste de chacune, et d\'où vient le chiffre -->', '        <!-- 🔒 SANCTUAIRE', """            <!-- ✍️ Par catégorie : on LIT le reste, on TAPE ce qui est parti. Une ligne,
                 deux gestes : la partie gauche ouvre les Rayons X (audit), le champ
                 de droite reçoit le total en vrac. -->
            <div v-if="p.categories && p.categories.length" class="mt-3 md:mt-5 pt-3 md:pt-4 border-t border-white/10" data-liberte-saisie>
                <p class="flex items-baseline justify-between gap-2 mb-1.5 md:mb-2">
                    <span class="text-[10px] font-black uppercase tracking-[0.2em] text-white/55">Par catégorie</span>
                    <span class="flex items-baseline gap-2">
                        <button v-if="p.compteur" type="button" data-liberte-effacer @click="$emit('effacer')" title="Effacer toutes les saisies de ce cycle"
                                class="text-[10px] font-bold text-white/40 hover:text-white/80 underline decoration-dotted underline-offset-2">↩ tout effacer</button>
                        <span class="text-[10px] font-black uppercase tracking-[0.14em] text-white/55">✍️ Déjà dépensé</span>
                    </span>
                </p>
                <div data-pulse-categories class="space-y-1 md:space-y-1.5">
                    <div v-for="c in p.categories" :key="'pc_' + c.key" data-pulse-ligne :data-cat="c.key" :data-source="c.source"
                         :class="['flex items-center gap-1.5 md:gap-2 rounded-xl ring-1 p-1 md:p-1.5 transition-colors',
                                  estOuvert('cat', c.key) ? 'bg-white/20 ring-white/40' : (c.source === 'estime' ? 'bg-white/[0.04] ring-white/10' : 'bg-white/[0.08] ring-white/15')]">
                        <button type="button" data-rx-ancre data-pulse-cat :data-cat="c.key" :data-source="c.source"
                                :aria-expanded="estOuvert('cat', c.key) ? 'true' : 'false'" :aria-label="'Audit de ' + c.label + ' : courses prévues et tickets'"
                                @pointerenter="survolEntree($event, 'cat', c.key)" @pointerleave="survolSortie($event)" @click="basculer($event, 'cat', c.key)"
                                class="group min-w-0 flex-1 flex items-center gap-2 md:gap-2.5 rounded-lg px-1 py-0.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-white/70">
                            <svg viewBox="0 0 36 36" class="w-6 h-6 md:w-7 md:h-7 -rotate-90 shrink-0" aria-hidden="true">
                                <circle cx="18" cy="18" r="14" fill="none" stroke-width="5" class="stroke-white/15"></circle>
                                <circle cx="18" cy="18" r="14" fill="none" stroke-width="5" pathLength="100" :stroke-linecap="anneau(c) > 0 ? 'round' : 'butt'"
                                        :stroke-dasharray="anneau(c) + ' 100'" :class="c.reste < 0 ? 'stroke-rose-200' : (c.source === 'estime' ? 'stroke-white/50' : 'stroke-white')"></circle>
                            </svg>
                            <span class="min-w-0 flex-1">
                                <span class="flex items-center gap-1 text-[12px] md:text-[13px] font-bold text-white leading-tight">
                                    <span class="truncate">{{ c.label }}</span>
                                    <span aria-hidden="true" class="shrink-0 text-[10px] opacity-40 group-hover:opacity-100 transition-opacity">🔍</span>
                                </span>
                                <span class="block mt-0.5 text-[10px] md:text-[11px] font-semibold text-white/55 tabular-nums leading-tight whitespace-nowrap overflow-hidden text-ellipsis" data-pulse-reste>
                                    <template v-if="c.reste >= 0">{{ c.source === 'estime' ? '≈ ' : '' }}reste <span class="font-black text-white/90">{{ chiffre(c.reste) }}</span> / {{ chiffre(c.budget) }}</template>
                                    <template v-else><span class="font-black text-rose-200">dépassé de {{ chiffre(-c.reste) }}</span> / {{ chiffre(c.budget) }}</template>
                                    <template v-if="c.tickets > 0"> · 🧾 {{ chiffre(c.tickets) }}</template>
                                </span>
                            </span>
                        </button>
                        <label :class="['shrink-0 flex items-center gap-1 rounded-lg ring-1 px-2 py-1 md:py-1.5 cursor-text transition-colors focus-within:ring-2 focus-within:ring-white/80 focus-within:bg-black/30',
                                        c.source === 'compteur' ? 'bg-black/25 ring-white/30' : 'bg-black/15 ring-white/15 hover:ring-white/40']"
                               :title="c.source === 'tickets' ? 'Les tickets datés (' + formatMad(c.tickets) + ') comptent tant que votre total est plus petit' : 'Total dépensé ce cycle, sans date'">
                            <span class="sr-only">Déjà dépensé ce cycle en {{ c.label }}</span>
                            <input type="number" inputmode="decimal" min="0" step="1" data-saisie data-pulse-saisie :data-cat="c.key"
                                   :value="c.saisi || ''" :placeholder="invite(c)"
                                   @input="saisirCompteur(c.key, $event)" @focus="fermer()" @keydown.enter="$event.target.blur()"
                                   class="w-[4.5rem] md:w-[5.5rem] bg-transparent text-right text-[13px] md:text-sm font-black text-white tabular-nums placeholder:text-white/40 placeholder:font-semibold outline-none">
                            <span class="text-[10px] font-bold text-white/45">DH</span>
                        </label>
                    </div>
                </div>
                <button v-if="p.horsBudget > 0" type="button" data-rx-ancre data-pulse-hors
                        @pointerenter="survolEntree($event, 'hors', 'hors')" @pointerleave="survolSortie($event)" @click="basculer($event, 'hors', 'hors')"
                        class="hidden md:inline-block mt-3 text-[10px] font-semibold text-white/50 hover:text-white/80 underline decoration-dotted underline-offset-2 text-left">+ {{ formatMad(p.horsBudget) }} saisis hors budget conso (factures…) : non comptés ici</button>
            </div>
        </div>

""")

# ── 3. Rayons X : l'audit seul — plus de champ de saisie ────────────────────
bloc('panneau : la saisie quitte le panneau', '                <!-- 📝 La saisie en vrac : un total, sans date -->', '                <!-- 🧾 Les tickets datés du cycle, s\'il y en a -->', """                <!-- Ce qui a été retenu, et pourquoi (la saisie se fait sur la ligne de la carte) -->
                <p class="mt-3 rounded-lg bg-white/[0.04] ring-1 ring-white/10 px-2.5 py-2 text-[10px] font-semibold text-slate-400 leading-snug" data-rx-retenu>
                    <template v-if="rxContenu.c.source === 'estime'">≈ Rien de déclaré : estimé au rythme attendu ({{ formatMad(rxContenu.c.engage) }}). Tapez le total sur la ligne de la carte.</template>
                    <template v-else-if="rxContenu.c.saisi > 0 && rxContenu.c.tickets > 0">📝 Total saisi {{ formatMad(rxContenu.c.saisi) }} · 🧾 tickets {{ formatMad(rxContenu.c.tickets) }} : on retient le plus grand, {{ formatMad(rxContenu.c.engage) }} — jamais la somme.</template>
                    <template v-else-if="rxContenu.c.source === 'compteur'">📝 Total saisi sur la carte : {{ formatMad(rxContenu.c.engage) }}.</template>
                    <template v-else>🧾 Retenu : la somme des tickets datés du cycle, {{ formatMad(rxContenu.c.engage) }}.</template>
                </p>
""")
sub('panneau « calcul »', """            <!-- Un compte : les prélèvements qu'il doit couvrir -->""", """            <!-- ⓘ Le calcul du Reste à dépenser (ex-bulle « Disponible réel ») -->
            <template v-else-if="rxContenu.type === 'calcul'">
                <p class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">ⓘ Comment est calculé ce chiffre</p>
                <div class="mt-2.5 space-y-1 text-[11px]" data-rx-calcul-budget>
                    <p class="text-[9px] font-black uppercase tracking-widest text-slate-500">🅰️ Le budget</p>
                    <p class="flex justify-between gap-3"><span class="text-slate-300">Budget conso du cycle</span><span class="font-black text-white tabular-nums">{{ formatMad(p.budget) }}</span></p>
                    <p v-if="p.declare" class="flex justify-between gap-3"><span class="text-slate-300">− Déjà dépensé (déclaré)</span><span class="font-black text-white tabular-nums">− {{ formatMad(p.calcul.engageDeclare) }}</span></p>
                    <p v-if="p.declare && p.calcul.engageEstime > 0" class="flex justify-between gap-3"><span class="text-slate-400">− Estimé (catégories non déclarées)</span><span class="font-black text-slate-300 tabular-nums">− {{ formatMad(p.calcul.engageEstime) }}</span></p>
                    <p v-if="!p.declare" class="flex justify-between gap-3"><span class="text-slate-400">− Estimé au prorata du temps</span><span class="font-black text-slate-300 tabular-nums">− {{ formatMad(p.engage) }}</span></p>
                    <p :class="['flex justify-between gap-3 font-black', p.contrainte === 'budget' ? 'text-emerald-300' : 'text-slate-400']"><span>= Reste au budget {{ p.contrainte === 'budget' ? '◀' : '' }}</span><span class="tabular-nums">{{ formatMad(p.resteBudget) }}</span></p>
                </div>
                <div class="mt-2.5 pt-2.5 border-t border-white/10 space-y-1 text-[11px]" data-rx-calcul-cash>
                    <p class="text-[9px] font-black uppercase tracking-widest text-slate-500">🅱️ La trésorerie</p>
                    <p class="flex justify-between gap-3"><span class="text-slate-300">Solde du compte courant</span><span class="font-black text-white tabular-nums">{{ formatMad(p.calcul.treso) }}</span></p>
                    <p v-if="p.calcul.revenusAttente > 0" class="flex justify-between gap-3"><span class="text-slate-300">+ Revenus à venir</span><span class="font-black text-white tabular-nums">+ {{ formatMad(p.calcul.revenusAttente) }}</span></p>
                    <p class="flex justify-between gap-3"><span class="text-slate-300">− Charges à payer (hors conso)</span><span class="font-black text-white tabular-nums">− {{ formatMad(p.calcul.obligations) }}</span></p>
                    <p :class="['flex justify-between gap-3 font-black', p.contrainte === 'tresorerie' ? 'text-emerald-300' : 'text-slate-400']"><span>= Cash disponible {{ p.contrainte === 'tresorerie' ? '◀' : '' }}</span><span class="tabular-nums">{{ formatMad(p.cash) }}</span></p>
                </div>
                <p class="mt-3 pt-2.5 border-t border-white/10 flex justify-between gap-3 text-[12px] font-black text-white"><span>= Reste à dépenser (le plus petit)</span><span class="tabular-nums" data-rx-total>{{ formatMad(p.reste) }}</span></p>
                <p class="mt-1 text-[10px] font-semibold text-slate-400">÷ {{ p.jours }} jours avant la paie × 7 ≈ {{ formatMad(p.parSemaine) }} par semaine.</p>
            </template>
            <!-- Un compte : les prélèvements qu'il doit couvrir -->""")

# ── 4. Le parent : « ↩ tout effacer » → resetConsoT0 ────────────────────────
n = src.count('@compteur="saisirCompteurConso"')
if n != 3: print(f'✖ usages de la Météo : {n}, 3 attendus'); sys.exit(1)
edits.append(('@compteur="saisirCompteurConso"', '@compteur="saisirCompteurConso" @effacer="resetConsoT0"'))

# ── 5. L'ancien bloc « Réalisé à T0 » quitte le DOM ; le Voyage reste ───────
bloc('ancien bloc Réalisé à T0', '                        <!-- ═══ v32.00 Realized-T0 : conso déjà engagée sur le cycle ═══', '                        <!-- ═══ v37.16 : les comptes, repliés', """                        <!-- ═══ v37.24 : l'ancien bloc « Réalisé à T0 — conso engagée » a quitté le
                             DOM : la saisie vit sur les lignes de la Météo. Seul son mode
                             Voyage, sans équivalent ailleurs, reste — replié. ═══ -->
                        <details v-if="!isCyclePasse && consoCategoriesT0.length" data-voyage :open="modeVoyageActif"
                                 :class="['rounded-2xl border text-left shadow-lg', modeVoyageActif ? 'bg-sky-950/40 border-sky-700/60' : 'bg-slate-800 border-slate-700']">
                            <summary class="flex items-center justify-between gap-3 px-4 md:px-5 py-3 cursor-pointer select-none hover:bg-slate-700/30 rounded-2xl flex-wrap">
                                <span class="text-[11px] font-black uppercase tracking-widest text-sky-200">✈️ Voyage · absence</span>
                                <span v-if="modeVoyageActif" class="text-[11px] font-black text-emerald-300 tabular-nums">+{{ formatMAD(economieVoyage) }} d'économie sur ce cycle</span>
                                <span v-else class="text-[10px] font-bold text-slate-400">Une absence allège le budget conso du cycle</span>
                            </summary>
                            <div class="px-4 md:px-5 pb-4 pt-1 space-y-3">
                                <div class="flex items-center gap-1.5 flex-wrap">
                                    <span class="text-[10px] font-black uppercase tracking-widest text-slate-400">Du</span>
                                    <input type="date" :value="soldesInitiaux.voyageDebut || ''" data-voyage-debut
                                           @change="setVoyage('voyageDebut', $event.target.value)"
                                           class="bg-slate-950 text-sky-300 border border-slate-600 rounded p-1.5 text-xs font-bold outline-none focus:border-sky-400"/>
                                    <span class="text-[10px] font-black uppercase tracking-widest text-slate-400">au</span>
                                    <input type="date" :value="soldesInitiaux.voyageFin || ''" data-voyage-fin
                                           :min="soldesInitiaux.voyageDebut || null"
                                           @change="setVoyage('voyageFin', $event.target.value)"
                                           class="bg-slate-950 text-sky-300 border border-slate-600 rounded p-1.5 text-xs font-bold outline-none focus:border-sky-400"/>
                                    <button v-if="soldesInitiaux.voyageDebut || soldesInitiaux.voyageFin"
                                            @click="effacerVoyage()" title="Effacer les dates de voyage"
                                            class="text-[9px] font-black px-2 py-1.5 rounded-lg border border-slate-600 text-slate-400 hover:border-red-500 hover:text-red-300 transition-all">↩</button>
                                    <span class="text-[10px] font-bold text-slate-500 w-full md:w-auto">Chaque cycle ne déduit que les jours qui tombent chez lui.</span>
                                </div>
                                <p v-if="modeVoyageActif" class="text-[10px] font-bold text-slate-400">
                                    {{ voyageJoursDuMois.total }} j sur ce cycle ({{ cycleLabel }}) · {{ voyageDetailMois }} · {{ voyageJoursDuMois.weekend }} we · {{ voyageJoursDuMois.semaine }} sem · présence {{ Math.round(facteurPresence * 100) }} %
                                </p>
                                <p v-else-if="voyageJoursDuMois.saisi" class="text-[10px] font-bold text-slate-500">Aucun jour de ce voyage ne tombe sur le cycle affiché ({{ cycleLabel }}).</p>
                                <div>
                                    <p class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Pendant l'absence</p>
                                    <div class="flex flex-wrap gap-1.5">
                                        <button v-for="c in consoCategoriesT0" :key="'vy_' + c.key" @click="toggleSuspendreAbsence(c.key)" data-voyage-cat :data-cat="c.key"
                                                :title="c.suspendue ? 'Suspendu pendant l’absence — cliquer pour le laisser courir' : 'Continue de courir pendant l’absence — cliquer pour le suspendre'"
                                                :class="['text-[10px] font-black px-2 py-1 rounded-lg border transition-colors', c.suspendue ? 'bg-sky-900/60 text-sky-200 border-sky-600' : 'bg-slate-900 text-slate-400 border-slate-600 hover:text-slate-200']">
                                            {{ c.label }} · {{ c.suspendue ? '✈️ suspendu' : 'maintenu' }}<template v-if="modeVoyageActif && c.economie > 0"> <span class="text-emerald-300">−{{ formatMAD(c.economie) }}</span></template>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </details>

""")

for a, r in edits: src = src.replace(a, r) if a.startswith('@compteur=') else src.replace(a, r, 1)
io.open(F, 'w', encoding='utf-8').write(src)
print(f'✔ carte, panneau, bloc T0 → Voyage + {len(edits)} modifications appliquées')
