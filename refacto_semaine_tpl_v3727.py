# -*- coding: utf-8 -*-
"""
v37.27 Semaine-Glissante — PARTIE GABARIT.

  « Par semaine : la semaine en cours, et je peux switcher à la passée et à la
  prochaine. » La section « Par catégorie » de la carte devient hebdomadaire :
    • barre ‹ Semaine du 5 au 11 oct. › avec la pastille en cours / passée /
      à venir et le total de la semaine (dépensé / prévu) ; « ↩ Cette semaine »
      quand on a quitté la semaine en cours ;
    • chaque ligne : reste de la SEMAINE, anneau de la semaine, et la case (ou le
      ✎ qui déplie les postes) saisit CETTE semaine ;
    • chaque poste : son budget hebdomadaire (Marjane : prévu 400), la jauge de la
      semaine, les tickets datés de la semaine.
  Le grand « Reste à dépenser » reste celui du cycle : il somme les semaines du
  cycle. Une semaine d'un autre cycle le dit, et ne le modifie pas.
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
def bloc(label, debut, fin, nouveau):
    global src
    i, j = src.find(debut), src.find(fin)
    if i < 0 or j < 0 or j <= i or src.count(debut) != 1:
        print(f'✖ {label} : bornes introuvables'); sys.exit(1)
    src = src[:i] + nouveau + src[j:]

# ── 1. Le script du composant ───────────────────────────────────────────────
sub('événements', r"""            emits: ['aller', 'revenir', 'compteur', 'effacer'],""",
    r"""            emits: ['aller', 'revenir', 'effacer', 'semaine', 'saisie', 'retirer'],""")
sub('semaine : états', r"""                p() { return this.meteo.liberte || {}; },""",
    r"""                p() { return this.meteo.liberte || {}; },
                sm() { return this.p.semaine || {}; },
                statutTexte() { return this.sm.statut === 'passee' ? 'passée' : (this.sm.statut === 'avenir' ? 'à venir' : 'en cours'); },
                statutClasse() {
                    return this.sm.statut === 'passee' ? 'bg-white/10 ring-white/25 text-white/70'
                         : this.sm.statut === 'avenir' ? 'bg-sky-400/20 ring-sky-200/40 text-sky-100'
                         : 'bg-emerald-400/20 ring-emerald-200/40 text-emerald-100';
                },""")
sub('saisie → la semaine affichée', r"""                saisirCompteur(cle, e) { this.$emit('compteur', cle, e.target.value); },""",
    r"""                saisirCompteur(cle, e) { this.$emit('saisie', this.sm.lundi, cle, e.target.value); },""")
sub('invite d\'une case unique', r"""                invite(c) { return c.tickets > 0 ? String(c.tickets) : (c.source === 'estime' ? '≈ ' + this.chiffre(c.engage) : '0'); },""",
    r"""                invite(c) { return c.sem.tickets > 0 ? String(c.sem.tickets) : (c.sem.source === 'estime' && c.sem.engage > 0 ? '≈ ' + this.chiffre(c.sem.engage) : '0'); },
                anneauSem(c) { return c.sem.pct; },""")
sub('hors-liste de la semaine', r"""                libreDe(c) { return { cle: c.key, saisi: c.libre, declare: c.libre > 0 }; },""",
    r"""                libreDe(c) { return { cle: c.key, saisi: c.sem.libre, declare: c.sem.libre > 0 }; },""")
sub('invite d\'un poste', r"""                invitePoste(c, d) {
                    if (c.source === 'estime' && c.budget > 0) return '≈ ' + this.chiffre(Math.round(c.engage * d.partCycle / c.budget));
                    return '0';
                },""", r"""                //  Avant toute saisie : l'estimation du poste pour la part écoulée de la semaine.
                invitePoste(c, d) {
                    const e = c.sem.source === 'estime' ? Math.round(d.budget * (this.sm.frac || 0)) : 0;
                    return e > 0 ? '≈ ' + this.chiffre(e) : '0';
                },""")
sub('poste : émission (chiffres)', r"""                        this.$emit('compteur', d.cle, t);""", r"""                        this.$emit('saisie', this.sm.lundi, d.cle, t);""")
sub('poste : émission (+/-)', r"""                        this.$emit('compteur', d.cle, String(v));""", r"""                        this.$emit('saisie', this.sm.lundi, d.cle, String(v));""")

# ── 2. La section « Par catégorie » devient « Par semaine » ────────────────
bloc('section hebdomadaire', '            <!-- ✍️ Par catégorie : on LIT le reste, on TAPE ce qui est parti. Une ligne,', '                <button v-if="p.horsBudget > 0" type="button" data-rx-ancre data-pulse-hors', r"""            <!-- 🗓️ Par SEMAINE : on LIT le reste de la semaine, on TAPE ce qui est parti.
                 ‹ › change de semaine (passée, à venir) ; la partie gauche d'une ligne
                 ouvre les Rayons X (audit du cycle), la droite reçoit la saisie. -->
            <div v-if="p.categories && p.categories.length" class="mt-3 md:mt-5 pt-3 md:pt-4 border-t border-white/10" data-liberte-saisie>
                <div data-semaine-nav class="flex items-center gap-2 mb-2">
                    <button type="button" data-semaine-prec @click="$emit('semaine', -1)" aria-label="Semaine précédente" title="Semaine précédente"
                            class="shrink-0 w-8 h-8 md:w-9 md:h-9 rounded-xl bg-black/25 ring-1 ring-white/30 hover:ring-white/70 hover:bg-black/35 text-white text-lg font-black leading-none outline-none focus-visible:ring-2 focus-visible:ring-white transition-colors">‹</button>
                    <div class="min-w-0 flex-1 text-center leading-tight">
                        <p class="text-[10px] md:text-[11px] font-black uppercase tracking-[0.12em] text-white/85" data-semaine-titre>Semaine du {{ sm.du }} au {{ sm.au }}</p>
                        <p class="mt-1 flex items-center justify-center gap-1.5 text-[10px] md:text-[11px] font-semibold text-white/60 tabular-nums">
                            <span data-semaine-statut :data-statut="sm.statut" :class="['rounded-full px-1.5 py-px text-[9px] font-black uppercase tracking-wider ring-1', statutClasse]">{{ statutTexte }}</span>
                            <span data-semaine-total><span class="font-black text-white/90">{{ sm.estime ? '≈ ' : '' }}{{ formatMad(sm.engage) }}</span> / {{ formatMad(sm.budget) }}</span>
                        </p>
                    </div>
                    <button type="button" data-semaine-suiv @click="$emit('semaine', 1)" aria-label="Semaine suivante" title="Semaine suivante"
                            class="shrink-0 w-8 h-8 md:w-9 md:h-9 rounded-xl bg-black/25 ring-1 ring-white/30 hover:ring-white/70 hover:bg-black/35 text-white text-lg font-black leading-none outline-none focus-visible:ring-2 focus-visible:ring-white transition-colors">›</button>
                </div>
                <div class="flex items-center justify-between gap-2 mb-1.5 min-h-[1.1rem]">
                    <button v-if="sm.decalage !== 0" type="button" data-semaine-aujourdhui @click="$emit('semaine', 0)"
                            class="text-[10px] font-black text-white/85 hover:text-white underline decoration-dotted underline-offset-2">↩ Cette semaine</button>
                    <span v-else></span>
                    <button v-if="p.compteur" type="button" data-liberte-effacer @click="$emit('effacer')" title="Effacer toutes les saisies du cycle (toutes ses semaines)"
                            class="text-[10px] font-bold text-white/40 hover:text-white/80 underline decoration-dotted underline-offset-2">↩ effacer tout le cycle</button>
                </div>
                <p v-if="!sm.dansCycle" data-semaine-hors class="mb-2 rounded-lg bg-white/[0.07] ring-1 ring-white/10 px-2.5 py-1.5 text-[10px] font-semibold text-white/75 leading-snug">
                    ℹ️ Cette semaine appartient au cycle {{ sm.cycleRel === 'precedent' ? 'précédent' : 'suivant' }} : elle ne change pas le Reste à dépenser ci-dessus.
                </p>
                <div data-pulse-categories class="space-y-1 md:space-y-1.5">
                    <div v-for="c in p.categories" :key="'pc_' + c.key" data-pulse-categorie :data-cat="c.key">
                    <div data-pulse-ligne :data-cat="c.key" :data-source="c.sem.source"
                         :class="['flex items-center gap-1.5 md:gap-2 rounded-xl ring-1 p-1 md:p-1.5 transition-colors',
                                  estOuvert('cat', c.key) ? 'bg-white/20 ring-white/40' : (c.sem.source === 'estime' ? 'bg-white/[0.04] ring-white/10' : 'bg-white/[0.08] ring-white/15')]">
                        <button type="button" data-rx-ancre data-pulse-cat :data-cat="c.key" :data-source="c.sem.source"
                                :aria-expanded="estOuvert('cat', c.key) ? 'true' : 'false'" :aria-label="'Audit de ' + c.label + ' : courses prévues et tickets'"
                                @pointerenter="survolEntree($event, 'cat', c.key)" @pointerleave="survolSortie($event)" @click="basculer($event, 'cat', c.key)"
                                class="group min-w-0 flex-1 flex items-center gap-2 md:gap-2.5 rounded-lg px-1 py-0.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-white/70">
                            <svg viewBox="0 0 36 36" class="w-6 h-6 md:w-7 md:h-7 -rotate-90 shrink-0" aria-hidden="true">
                                <circle cx="18" cy="18" r="14" fill="none" stroke-width="5" class="stroke-white/15"></circle>
                                <circle cx="18" cy="18" r="14" fill="none" stroke-width="5" pathLength="100" :stroke-linecap="anneauSem(c) > 0 ? 'round' : 'butt'"
                                        :stroke-dasharray="anneauSem(c) + ' 100'" :class="c.sem.reste < 0 ? 'stroke-rose-200' : (c.sem.source === 'estime' ? 'stroke-white/50' : 'stroke-white')"></circle>
                            </svg>
                            <span class="min-w-0 flex-1">
                                <span class="flex items-center gap-1 text-[12px] md:text-[13px] font-bold text-white leading-tight">
                                    <span class="truncate">{{ c.label }}</span>
                                    <span aria-hidden="true" class="shrink-0 text-[10px] opacity-40 group-hover:opacity-100 transition-opacity">🔍</span>
                                </span>
                                <span class="block mt-0.5 text-[10px] md:text-[11px] font-semibold text-white/55 tabular-nums leading-tight whitespace-nowrap overflow-hidden text-ellipsis" data-pulse-reste>
                                    <template v-if="c.sem.reste >= 0">{{ c.sem.source === 'estime' ? '≈ ' : '' }}reste <span class="font-black text-white/90">{{ chiffre(c.sem.reste) }}</span> / {{ chiffre(c.sem.budget) }}</template>
                                    <template v-else><span class="font-black text-rose-200">dépassé de {{ chiffre(-c.sem.reste) }}</span> / {{ chiffre(c.sem.budget) }}</template>
                                    <template v-if="c.sem.tickets > 0"> · 🧾 {{ chiffre(c.sem.tickets) }}</template>
                                </span>
                            </span>
                        </button>
                        <!-- Avec des postes : le total de la semaine se LIT, on déplie pour saisir poste par poste -->
                        <button v-if="c.sem.postes.length" type="button" data-pulse-ouvrir :data-cat="c.key" :aria-expanded="ouverte(c.key) ? 'true' : 'false'"
                                :title="'Saisir poste par poste (' + c.sem.postes.length + ' postes)'" @click="basculerOuverte(c.key)"
                                :class="['shrink-0 flex items-center gap-1.5 rounded-lg ring-1 px-2.5 py-1 md:py-1.5 shadow-inner transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white',
                                         ouverte(c.key) ? 'bg-black/45 ring-white/80' : (c.sem.source === 'estime' ? 'bg-black/25 ring-white/35 hover:ring-white/70' : 'bg-black/35 ring-white/50 hover:ring-white/70')]">
                            <span aria-hidden="true" class="text-[11px] text-white/60">✎</span>
                            <span :class="['text-[13px] md:text-sm font-black tabular-nums', c.sem.source === 'estime' ? 'italic text-white/65' : 'text-white']" data-pulse-total>{{ c.sem.source === 'estime' ? '≈ ' : '' }}{{ chiffre(c.sem.engage) }}</span>
                            <span class="text-[10px] font-bold text-white/45">DH</span>
                            <span aria-hidden="true" :class="['text-[10px] text-white/75 transition-transform', ouverte(c.key) ? 'rotate-180' : '']">▾</span>
                        </button>
                        <!-- Sans poste : la case unique de la semaine -->
                        <label v-else :class="['shrink-0 flex items-center gap-1 rounded-lg ring-1 px-2 py-1 md:py-1.5 cursor-text transition-colors shadow-inner focus-within:ring-2 focus-within:ring-white focus-within:bg-black/40',
                                        c.sem.source === 'compteur' ? 'bg-black/35 ring-white/50' : 'bg-black/25 ring-white/35 hover:ring-white/70']"
                               :title="c.sem.source === 'tickets' ? 'Les tickets datés de la semaine (' + formatMad(c.sem.tickets) + ') comptent tant que votre saisie est plus petite' : 'Dépensé cette semaine, sans date'">
                            <span class="sr-only">Dépensé cette semaine en {{ c.label }}</span>
                            <span aria-hidden="true" class="text-[11px] text-white/60">✎</span>
                            <input :key="'u_' + c.key + sm.lundi" type="number" inputmode="decimal" min="0" step="1" data-saisie data-pulse-saisie :data-cat="c.key"
                                   :value="c.sem.saisi || ''" :placeholder="invite(c)"
                                   @input="saisirCompteur(c.key, $event)" @focus="fermer()" @keydown.enter="$event.target.blur()"
                                   class="w-[4.5rem] md:w-[5.5rem] bg-transparent text-right text-[13px] md:text-sm font-black text-white tabular-nums placeholder:text-white/55 placeholder:italic placeholder:font-semibold outline-none">
                            <span class="text-[10px] font-bold text-white/45">DH</span>
                        </label>
                    </div>
                    <!-- 📦 Des saisies d'avant la saisie par semaine, toujours comptées -->
                    <p v-if="c.sem.cycleAvant > 0" data-pulse-cycle-avant class="mt-1 ml-1 md:ml-2 text-[10px] font-semibold text-white/55 leading-snug">
                        📦 {{ formatMad(c.sem.cycleAvant) }} saisis sur tout le cycle (avant la saisie par semaine), toujours comptés ·
                        <button type="button" data-pulse-retirer @click="$emit('retirer', c.key)" class="font-black text-white/80 hover:text-white underline decoration-dotted underline-offset-2">retirer</button>
                    </p>
                    <!-- ✍️ Les postes de la semaine : une case chacun -->
                    <div v-if="c.sem.postes.length && ouverte(c.key)" data-pulse-postes :data-cat="c.key" class="mt-1 ml-3 md:ml-5 pl-2 md:pl-3 border-l-2 border-white/20 space-y-0.5">
                        <p class="px-1.5 pt-0.5 text-[10px] font-semibold text-white/45 leading-snug">Dépensé cette semaine sur chaque poste<span class="hidden md:inline"> · <span class="text-white/70">+50</span> ajoute 50 · <span class="text-white/70">Entrée</span> passe au suivant</span></p>
                        <div v-for="d in c.sem.postes" :key="'po_' + d.cle" data-pulse-poste :data-poste="d.cle" class="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-white/[0.06] transition-colors">
                            <span aria-hidden="true" class="shrink-0 w-5 text-center text-base leading-none">{{ d.emoji }}</span>
                            <span class="min-w-0 flex-1">
                                <span class="block truncate text-[12px] md:text-[13px] font-bold text-white leading-tight">{{ d.nom }}</span>
                                <span class="block text-[10px] font-semibold text-white/45 tabular-nums leading-tight whitespace-nowrap">prévu {{ chiffre(d.budget) }}<template v-if="d.tickets > 0"> · 🧾 {{ chiffre(d.tickets) }}</template></span>
                                <span class="block h-[3px] mt-1 rounded-full bg-black/25 overflow-hidden"><span :class="['block h-full rounded-full transition-all duration-300', d.depasse ? 'bg-rose-300' : 'bg-white/75']" :style="{ width: d.pct + '%' }"></span></span>
                            </span>
                            <label class="shrink-0 flex items-center gap-1 rounded-lg ring-1 px-2 py-1 bg-black/30 ring-white/35 hover:ring-white/70 focus-within:ring-2 focus-within:ring-white focus-within:bg-black/45 cursor-text transition-colors shadow-inner">
                                <span class="sr-only">Dépensé sur {{ d.nom }} cette semaine</span>
                                <input :key="'ip_' + d.cle + sm.lundi" type="text" inputmode="decimal" autocomplete="off" data-saisie data-pulse-poste-saisie :data-poste="d.cle" :data-cat="c.key"
                                       :value="d.declare ? d.saisi : ''" :placeholder="invitePoste(c, d)"
                                       @input="saisirPoste(d, $event, false)" @change="saisirPoste(d, $event, true)" @focus="$event.target.select(); fermer()" @keydown.enter.prevent="suivant($event)"
                                       class="w-[3.8rem] md:w-[4.8rem] bg-transparent text-right text-[13px] font-black text-white tabular-nums placeholder:text-white/45 placeholder:italic placeholder:font-semibold outline-none">
                                <span class="text-[10px] font-bold text-white/45">DH</span>
                            </label>
                        </div>
                        <div data-pulse-poste data-poste="libre" class="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-white/[0.06] transition-colors">
                            <span aria-hidden="true" class="shrink-0 w-5 text-center text-base leading-none">🏷️</span>
                            <span class="min-w-0 flex-1">
                                <span class="block truncate text-[12px] md:text-[13px] font-bold text-white/85 leading-tight">Autre</span>
                                <span class="block text-[10px] font-semibold text-white/45 leading-tight">hors de la liste ci-dessus</span>
                            </span>
                            <label class="shrink-0 flex items-center gap-1 rounded-lg ring-1 px-2 py-1 bg-black/30 ring-white/35 hover:ring-white/70 focus-within:ring-2 focus-within:ring-white focus-within:bg-black/45 cursor-text transition-colors shadow-inner">
                                <span class="sr-only">Autres dépenses en {{ c.label }} cette semaine</span>
                                <input :key="'il_' + c.key + sm.lundi" type="text" inputmode="decimal" autocomplete="off" data-saisie data-pulse-poste-saisie data-poste="libre" :data-cat="c.key"
                                       :value="c.sem.libre || ''" placeholder="0"
                                       @input="saisirPoste(libreDe(c), $event, false)" @change="saisirPoste(libreDe(c), $event, true)" @focus="$event.target.select(); fermer()" @keydown.enter.prevent="suivant($event)"
                                       class="w-[3.8rem] md:w-[4.8rem] bg-transparent text-right text-[13px] font-black text-white tabular-nums placeholder:text-white/45 placeholder:italic placeholder:font-semibold outline-none">
                                <span class="text-[10px] font-bold text-white/45">DH</span>
                            </label>
                        </div>
                    </div>
                    </div>
                </div>
""")

# ── 3. Les textes ───────────────────────────────────────────────────────────
sub('note « estimé »', r"""Rien de déclaré : reste estimé au prorata du temps. Ouvrez une catégorie (✎) et tapez ce que vous avez dépensé sur chaque poste — sans date.</span><span class="md:hidden">Estimé : touchez ✎ et tapez vos dépenses.</span>""",
    r"""Rien de déclaré : reste estimé au prorata du temps. Saisissez ce que vous dépensez chaque semaine (✎ ; ‹ › pour changer de semaine) — sans date.</span><span class="md:hidden">Estimé : touchez ✎ et saisissez la semaine.</span>""")

# ── 4. Le parent : la saisie va à la semaine affichée ───────────────────────
n = src.count('@compteur="saisirCompteurConso" @effacer="resetConsoT0"')
if n != 3: print(f'✖ usages de la Météo : {n}, 3 attendus'); sys.exit(1)
edits.append(('@compteur="saisirCompteurConso" @effacer="resetConsoT0"',
              '@saisie="saisirSemaineConso" @semaine="changerSemaine" @retirer="retirerSaisiesCycle" @effacer="resetConsoT0"'))

for a, r in edits: src = src.replace(a, r) if a.startswith('@compteur=') else src.replace(a, r, 1)
io.open(F, 'w', encoding='utf-8').write(src)
print(f'✔ section hebdomadaire + {len(edits)} modifications appliquées')
