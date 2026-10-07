# -*- coding: utf-8 -*-
"""
v37.26 Saisie-Par-Poste — PARTIE GABARIT.

  Une catégorie qui a des postes (Alimentation : Marjane, khdra, kfta…) n'a plus
  de case « total » : sa ligne affiche son total en LECTURE et se déplie
  (bouton ✎ + chevron) sur une case par poste.
    • Entrée = poste suivant ; le contenu est sélectionné au clic : on tape, on
      Entrée, on tape… sans souris.
    • « +50 » (ou « -20 ») + Entrée AJOUTE au poste : on met à jour sans refaire
      l'addition de tête.
    • Chaque poste montre son budget du cycle, une jauge fine (rose au-delà) et
      ses tickets datés s'il y en a. « Autre » reçoit le hors-liste.
    • Une catégorie SANS poste garde sa case unique, comme avant.
  Le nom de la catégorie reste le déclencheur des Rayons X (audit).
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
sub('état : catégories dépliées', r"""            data() { return { rx: null, rxEpingle: false, rxStyle: {}, rxTousPostes: false }; },""",
    r"""            data() { return { rx: null, rxEpingle: false, rxStyle: {}, rxTousPostes: false, ouvertes: {} }; },""")
sub('méthodes de saisie par poste', r"""                invite(c) { return c.tickets > 0 ? String(c.tickets) : (c.source === 'estime' ? '≈ ' + this.chiffre(c.engage) : '0'); },""",
    r"""                invite(c) { return c.tickets > 0 ? String(c.tickets) : (c.source === 'estime' ? '≈ ' + this.chiffre(c.engage) : '0'); },
                //  v37.26 : saisie poste par poste
                ouverte(k) { return !!this.ouvertes[k]; },
                basculerOuverte(k) { this.ouvertes = { ...this.ouvertes, [k]: !this.ouvertes[k] }; this.fermer(); },
                //  Le « hors-liste » : le total libre de la catégorie (clé = la catégorie)
                libreDe(c) { return { cle: c.key, saisi: c.libre, declare: c.libre > 0 }; },
                invitePoste(c, d) {
                    if (c.source === 'estime' && c.budget > 0) return '≈ ' + this.chiffre(Math.round(c.engage * d.partCycle / c.budget));
                    return '0';
                },
                //  Des chiffres : pris en compte en direct. « +50 » / « -20 » : s'ajoute au poste à la
                //  validation. Tout autre texte est refusé et le poste retrouve sa valeur.
                saisirPoste(d, e, fin) {
                    const t = String(e.target.value).trim().replace(',', '.');
                    if (/^\d*\.?\d*$/.test(t)) {
                        if (t === '.') return;
                        this.$emit('compteur', d.cle, t);
                        return;
                    }
                    if (!fin) return;
                    const m = t.match(/^([+\-−])\s*(\d+(?:\.\d+)?)$/);
                    if (m) {
                        const v = Math.max(0, Math.round((Number(d.saisi) || 0) + (m[1] === '+' ? 1 : -1) * Number(m[2])));
                        this.$emit('compteur', d.cle, String(v));
                        e.target.value = String(v);
                    } else e.target.value = d.declare ? String(d.saisi) : '';
                },
                //  Entrée : valide ce poste et passe au suivant (le dernier : on referme le clavier)
                suivant(e) {
                    const el = e.target, tous = [...el.closest('[data-pulse-postes]').querySelectorAll('[data-pulse-poste-saisie]')];
                    const i = tous.indexOf(el);
                    el.blur();
                    const n = tous[i + 1];
                    if (n) n.focus();
                },""")

# ── 2. Les lignes de catégorie : total lisible + postes dépliables ─────────
bloc('lignes de catégorie', r'                <div data-pulse-categories class="space-y-1 md:space-y-1.5">', r'                <button v-if="p.horsBudget > 0" type="button" data-rx-ancre data-pulse-hors', r"""                <div data-pulse-categories class="space-y-1 md:space-y-1.5">
                    <div v-for="c in p.categories" :key="'pc_' + c.key" data-pulse-categorie :data-cat="c.key">
                    <div data-pulse-ligne :data-cat="c.key" :data-source="c.source"
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
                        <!-- Avec des postes : le total se LIT, on déplie pour saisir poste par poste -->
                        <button v-if="c.prevu.length" type="button" data-pulse-ouvrir :data-cat="c.key" :aria-expanded="ouverte(c.key) ? 'true' : 'false'"
                                :title="'Saisir poste par poste (' + c.prevu.length + ' postes)'" @click="basculerOuverte(c.key)"
                                :class="['shrink-0 flex items-center gap-1.5 rounded-lg ring-1 px-2.5 py-1 md:py-1.5 shadow-inner transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white',
                                         ouverte(c.key) ? 'bg-black/45 ring-white/80' : (c.source === 'estime' ? 'bg-black/25 ring-white/35 hover:ring-white/70' : 'bg-black/35 ring-white/50 hover:ring-white/70')]">
                            <span aria-hidden="true" class="text-[11px] text-white/60">✎</span>
                            <span :class="['text-[13px] md:text-sm font-black tabular-nums', c.source === 'estime' ? 'italic text-white/65' : 'text-white']" data-pulse-total>{{ c.source === 'estime' ? '≈ ' : '' }}{{ chiffre(c.engage) }}</span>
                            <span class="text-[10px] font-bold text-white/45">DH</span>
                            <span aria-hidden="true" :class="['text-[10px] text-white/75 transition-transform', ouverte(c.key) ? 'rotate-180' : '']">▾</span>
                        </button>
                        <!-- Sans poste : la case unique, comme avant -->
                        <label v-else :class="['shrink-0 flex items-center gap-1 rounded-lg ring-1 px-2 py-1 md:py-1.5 cursor-text transition-colors shadow-inner focus-within:ring-2 focus-within:ring-white focus-within:bg-black/40',
                                        c.source === 'compteur' ? 'bg-black/35 ring-white/50' : 'bg-black/25 ring-white/35 hover:ring-white/70']"
                               :title="c.source === 'tickets' ? 'Les tickets datés (' + formatMad(c.tickets) + ') comptent tant que votre total est plus petit' : 'Total dépensé ce cycle, sans date'">
                            <span class="sr-only">Déjà dépensé ce cycle en {{ c.label }}</span>
                            <span aria-hidden="true" class="text-[11px] text-white/60">✎</span>
                            <input type="number" inputmode="decimal" min="0" step="1" data-saisie data-pulse-saisie :data-cat="c.key"
                                   :value="c.saisi || ''" :placeholder="invite(c)"
                                   @input="saisirCompteur(c.key, $event)" @focus="fermer()" @keydown.enter="$event.target.blur()"
                                   class="w-[4.5rem] md:w-[5.5rem] bg-transparent text-right text-[13px] md:text-sm font-black text-white tabular-nums placeholder:text-white/55 placeholder:italic placeholder:font-semibold outline-none">
                            <span class="text-[10px] font-bold text-white/45">DH</span>
                        </label>
                    </div>
                    <!-- ✍️ Les postes : une case chacun -->
                    <div v-if="c.prevu.length && ouverte(c.key)" data-pulse-postes :data-cat="c.key" class="mt-1 ml-3 md:ml-5 pl-2 md:pl-3 border-l-2 border-white/20 space-y-0.5">
                        <p class="px-1.5 pt-0.5 text-[10px] font-semibold text-white/45 leading-snug">Tapez ce que vous avez dépensé sur chaque poste<span class="hidden md:inline"> · <span class="text-white/70">+50</span> ajoute 50 · <span class="text-white/70">Entrée</span> passe au suivant</span></p>
                        <div v-for="d in c.prevu" :key="'po_' + d.cle" data-pulse-poste :data-poste="d.cle" class="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-white/[0.06] transition-colors">
                            <span aria-hidden="true" class="shrink-0 w-5 text-center text-base leading-none">{{ d.emoji }}</span>
                            <span class="min-w-0 flex-1">
                                <span class="block truncate text-[12px] md:text-[13px] font-bold text-white leading-tight">{{ d.nom }}</span>
                                <span class="block text-[10px] font-semibold text-white/45 tabular-nums leading-tight whitespace-nowrap">prévu {{ chiffre(d.partCycle) }}<template v-if="d.depense > 0"> · 🧾 {{ chiffre(d.depense) }}</template></span>
                                <span class="block h-[3px] mt-1 rounded-full bg-black/25 overflow-hidden"><span :class="['block h-full rounded-full transition-all duration-300', d.engage > d.partCycle ? 'bg-rose-300' : 'bg-white/75']" :style="{ width: d.pctEngage + '%' }"></span></span>
                            </span>
                            <label class="shrink-0 flex items-center gap-1 rounded-lg ring-1 px-2 py-1 bg-black/30 ring-white/35 hover:ring-white/70 focus-within:ring-2 focus-within:ring-white focus-within:bg-black/45 cursor-text transition-colors shadow-inner">
                                <span class="sr-only">Dépensé sur {{ d.nom }} ce cycle</span>
                                <input type="text" inputmode="decimal" autocomplete="off" data-saisie data-pulse-poste-saisie :data-poste="d.cle" :data-cat="c.key"
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
                                <span class="sr-only">Autres dépenses en {{ c.label }} ce cycle</span>
                                <input type="text" inputmode="decimal" autocomplete="off" data-saisie data-pulse-poste-saisie data-poste="libre" :data-cat="c.key"
                                       :value="c.libre || ''" placeholder="0"
                                       @input="saisirPoste(libreDe(c), $event, false)" @change="saisirPoste(libreDe(c), $event, true)" @focus="$event.target.select(); fermer()" @keydown.enter.prevent="suivant($event)"
                                       class="w-[3.8rem] md:w-[4.8rem] bg-transparent text-right text-[13px] font-black text-white tabular-nums placeholder:text-white/45 placeholder:italic placeholder:font-semibold outline-none">
                                <span class="text-[10px] font-bold text-white/45">DH</span>
                            </label>
                        </div>
                    </div>
                    </div>
                </div>
""")

# ── 3. Les textes qui parlaient de « la ligne » ─────────────────────────────
sub('note « estimé »', r"""Rien de déclaré : reste estimé au prorata du temps. Tapez ce que vous avez déjà dépensé sur chaque ligne ci-dessous — un total suffit, sans date.</span><span class="md:hidden">Estimé : tapez vos totaux ci-dessous.</span>""",
    r"""Rien de déclaré : reste estimé au prorata du temps. Ouvrez une catégorie (✎) et tapez ce que vous avez dépensé sur chaque poste — sans date.</span><span class="md:hidden">Estimé : touchez ✎ et tapez vos dépenses.</span>""")
sub('audit : où saisir', r"""Tapez le total sur la ligne de la carte.""", r"""Saisissez-le sur la carte (bouton ✎ de la ligne).""")

for a, r in edits: src = src.replace(a, r, 1)
io.open(F, 'w', encoding='utf-8').write(src)
print(f'✔ lignes dépliables + {len(edits)} modifications appliquées')
