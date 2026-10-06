# -*- coding: utf-8 -*-
"""
v37.23 Liberté-du-Cycle — PARTIE GABARIT.

  RÔLES, une fois pour toutes :
    GAUCHE = l'état (le ciel, sa raison, l'action qui s'impose, les virements,
             le Sanctuaire des prélèvements). Aucun chiffre « à vivre ».
    DROITE = « 💸 Reste à dépenser » : LE chiffre du quotidien, jusqu'à la
             paie, et ce qu'il veut dire en rythme (par semaine, par jour).
  La ligne « filet du cycle » disparaît : son contenu EST la carte de droite.

  La carte de droite :
    • le reste du cycle en vedette, puis le rythme en trois cases ;
    • une jauge du CYCLE (engagé / budget) et un repère « où vous devriez en
      être » (rythme attendu du moteur) — en avance / tenu / dépassé sans
      qu'aucun ticket ne soit daté ;
    • les catégories : reste par catégorie, et d'où vient le chiffre
      (📝 compteur, 🧾 tickets, ou « à saisir ») ;
    • Rayons X : la liste de courses, puis « 📝 Déjà dépensé ce cycle » —
      un champ pour mettre à jour le total EN VRAC, sans date — puis les
      tickets datés s'il y en a.
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
sub('événement compteur', """            emits: ['aller', 'revenir'],
            components: { 'mono-compte': MonoCompte },""", """            emits: ['aller', 'revenir', 'compteur'],
            components: { 'mono-compte': MonoCompte },""")
sub('la carte lit la Liberté du cycle', """                p() { return this.meteo.pulse || {}; },""", """                p() { return this.meteo.liberte || {}; },""")
sub('couleurs et textes du rythme', """                remplissage() {
                    return this.p.rythme === 'depasse' ? 'bg-gradient-to-r from-rose-300 to-red-400'
                         : this.p.rythme === 'avance' ? 'bg-gradient-to-r from-amber-200 to-orange-300'
                         : 'bg-gradient-to-r from-emerald-200 to-teal-200';
                },
                rythmeTexte() {
                    return this.p.rythme === 'depasse' ? '⚠️ Enveloppe dépassée'
                         : this.p.rythme === 'avance' ? '⏩ Plus vite que la semaine'
                         : '✓ Rythme tenu';
                },
                rythmeCourt() {
                    return this.p.rythme === 'depasse' ? '⚠️ Dépassée' : this.p.rythme === 'avance' ? '⏩ En avance' : '✓ Tenu';
                },""", """                remplissage() {
                    return this.p.rythme === 'depasse' ? 'bg-gradient-to-r from-rose-300 to-red-400'
                         : this.p.rythme === 'avance' ? 'bg-gradient-to-r from-amber-200 to-orange-300'
                         : this.p.rythme === 'estime' ? 'bg-white/40'
                         : 'bg-gradient-to-r from-emerald-200 to-teal-200';
                },
                rythmeTexte() {
                    return this.p.rythme === 'depasse' ? '⚠️ Budget dépassé'
                         : this.p.rythme === 'avance' ? '⏩ Plus vite que le cycle'
                         : this.p.rythme === 'estime' ? '≈ Estimé'
                         : '✓ Rythme tenu';
                },
                rythmeCourt() {
                    return this.p.rythme === 'depasse' ? '⚠️ Dépassé' : this.p.rythme === 'avance' ? '⏩ En avance' : this.p.rythme === 'estime' ? '≈ Estimé' : '✓ Tenu';
                },""")
sub('anneau : engagé du cycle', """                anneau(c) { return Math.min(100, c.budget > 0 ? c.depense / c.budget * 100 : (c.depense > 0 ? 100 : 0)); },""",
    """                anneau(c) { const e = c.engage != null ? c.engage : c.depense; return Math.min(100, c.budget > 0 ? e / c.budget * 100 : (e > 0 ? 100 : 0)); },
                //  v37.23 : la saisie en vrac part au parent (setConsoT0), le panneau reste ouvert.
                saisirCompteur(cle, e) { this.$emit('compteur', cle, e.target.value); },""")
sub('le clavier du téléphone ne ferme pas le panneau', """                        defile: (e) => { const p = this.$refs.panneau; if (p && e && e.target && e.target.nodeType === 1 && p.contains(e.target)) return; this.fermer(); },""",
    """                        defile: (e) => {
                            const p = this.$refs.panneau;
                            if (p && e && e.target && e.target.nodeType === 1 && p.contains(e.target)) return;
                            //  Une saisie en cours (clavier du téléphone qui s'ouvre, page qui
                            //  défile pour montrer le champ) : on recale, on ne ferme pas.
                            if (p && p.contains(document.activeElement)) return this.placer();
                            this.fermer();
                        },""")

sub('le panneau ne recouvre jamais son ancre', """                    const h = el.offsetHeight;
                    let top = r.bottom + 8;
                    if (top + h > vh - 8) top = (r.top - 8 - h >= 8) ? r.top - 8 - h : Math.max(8, vh - 8 - h);
                    this.rxStyle = { left: left + 'px', top: top + 'px', width: W + 'px' };""", """                    //  v37.23 : le panneau ne recouvre JAMAIS la tuile qui l'ouvre (on doit
                    //  pouvoir la toucher à nouveau pour fermer) : dessous s'il tient,
                    //  sinon dessus, sinon du côté le plus spacieux, avec défilement.
                    const h = el.scrollHeight;
                    const bas = vh - r.bottom - 16, haut = r.top - 16;
                    let top, maxH = null;
                    if (h <= bas) top = r.bottom + 8;
                    else if (h <= haut) top = r.top - 8 - h;
                    else if (bas >= haut) { top = r.bottom + 8; maxH = bas; }
                    else { maxH = haut; top = r.top - 8 - haut; }
                    this.rxStyle = { left: left + 'px', top: top + 'px', width: W + 'px', maxHeight: maxH ? maxH + 'px' : null, overflowY: maxH ? 'auto' : null };""")

# ── 2. La carte de droite ───────────────────────────────────────────────────
bloc('carte Liberté', '        <!-- 🕊️ LIBERTÉ : ce que je peux dépenser cette semaine (le Variable) -->', '        <!-- 🔒 SANCTUAIRE : l\'argent déjà promis', """        <!-- 💸 RESTE À DÉPENSER : le seul endroit où l'on parle de l'argent pour vivre -->
        <div data-pulse-liberte data-liberte :data-rythme="p.rythme" class="min-w-0 md:col-start-2 md:row-start-1 md:row-span-2 rounded-[1.5rem] bg-white/[0.13] backdrop-blur-md ring-1 ring-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] p-3.5 md:p-5">
            <div class="flex items-center justify-between gap-2">
                <p class="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 whitespace-nowrap">💸 Reste à dépenser</p>
                <span data-pulse-rythme :class="['shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ring-1',
                      p.rythme === 'depasse' ? 'bg-rose-500/30 ring-rose-200/40' : (p.rythme === 'avance' ? 'bg-amber-400/25 ring-amber-200/40' : (p.rythme === 'estime' ? 'bg-white/10 ring-white/25' : 'bg-emerald-400/20 ring-emerald-200/30'))]"><span class="hidden md:inline">{{ rythmeTexte }}</span><span class="md:hidden">{{ rythmeCourt }}</span></span>
            </div>
            <p class="mt-2 md:mt-3 flex items-baseline gap-1.5 tabular-nums leading-none" data-pulse-montant data-meteo-rav>
                <span class="text-4xl md:text-6xl font-black tracking-tighter">{{ chiffre(p.reste) }}</span>
                <span class="text-lg md:text-2xl font-black text-white/50">DH</span>
                <span v-if="p.declare && !p.depassement && p.contrainte === 'tresorerie'" class="md:hidden ml-auto self-center rounded-full bg-amber-300/20 ring-1 ring-amber-200/40 px-2 py-0.5 text-[10px] font-black text-amber-100 tracking-normal">🏦 plafonné</span>
            </p>
            <p class="mt-1.5 text-xs md:text-sm font-semibold text-white/70 leading-snug">
                d'ici la paie du {{ p.paie }}<span v-if="p.compte" class="whitespace-nowrap" data-pulse-compte :data-compte="p.compte.key"> · sur <mono-compte :c="p.compte" class="align-[-2px]"></mono-compte> <span class="font-bold text-white/90">{{ p.compte.tag }}</span></span>
            </p>

            <!-- Le rythme : ce que ce reste veut dire, sans dater un seul ticket -->
            <div class="mt-3 md:mt-4 grid grid-cols-[1.35fr_1fr_1fr] gap-1.5 md:gap-2" data-liberte-rythme>
                <div class="rounded-xl bg-white/[0.14] ring-1 ring-white/20 px-2.5 py-1.5 md:px-3 md:py-2">
                    <p class="text-[9px] md:text-[10px] font-black uppercase tracking-wider text-white/60">≈ Par semaine</p>
                    <p class="text-sm md:text-xl font-black tabular-nums leading-tight whitespace-nowrap" data-liberte-semaine>{{ formatMad(p.parSemaine) }}</p>
                </div>
                <div class="rounded-xl bg-black/15 ring-1 ring-white/10 px-2.5 py-1.5 md:px-3 md:py-2">
                    <p class="text-[9px] md:text-[10px] font-black uppercase tracking-wider text-white/50">Par jour</p>
                    <p class="text-sm md:text-base font-black tabular-nums leading-tight text-white/90" data-meteo-jour>{{ formatMad(p.parJour) }}</p>
                </div>
                <div class="rounded-xl bg-black/15 ring-1 ring-white/10 px-2.5 py-1.5 md:px-3 md:py-2">
                    <p class="text-[9px] md:text-[10px] font-black uppercase tracking-wider text-white/50">Paie dans</p>
                    <p class="text-sm md:text-base font-black tabular-nums leading-tight text-white/90" data-liberte-jours>{{ p.jours }} j</p>
                </div>
            </div>

            <!-- Le cycle : engagé / budget, repère = où vous devriez en être -->
            <div class="mt-3.5 md:mt-5">
                <div class="relative" role="img" :aria-label="p.pct + ' % du budget conso du cycle engagé ; rythme attendu ' + p.pctAttendu + ' %'">
                    <div class="h-2 rounded-full bg-black/25 overflow-hidden">
                        <div data-pulse-jauge :class="['h-full rounded-full transition-all duration-700 ease-out', remplissage]" :style="{ width: Math.min(100, p.pct) + '%' }"></div>
                    </div>
                    <div data-pulse-repere aria-hidden="true" class="absolute -top-1 -bottom-1 w-[3px] -ml-[1.5px] rounded-full bg-white shadow-[0_0_0_2px_rgba(15,23,42,0.18)]" :style="{ left: p.pctAttendu + '%' }"></div>
                </div>
                <p class="mt-2 flex items-baseline justify-between gap-3 text-[11px] md:text-xs" data-pulse-legende>
                    <span class="font-semibold text-white/65"><span class="font-black text-white tabular-nums">{{ formatMad(p.engage) }}</span> {{ p.declare ? 'dépensés' : 'estimés' }} sur {{ formatMad(p.budget) }}</span>
                    <span class="font-black tabular-nums text-white/90">{{ p.pct }} %</span>
                </p>
                <p class="hidden md:block mt-0.5 text-[10px] font-semibold text-white/45">Repère blanc : où vous devriez en être au jour {{ p.jourCycle }} sur {{ p.joursCycle }} du cycle.</p>
                <!-- UNE note, la plus importante -->
                <p v-if="!p.declare" class="mt-2 text-[11px] font-semibold text-white/80 leading-snug" data-liberte-estime>✍️ <span class="hidden md:inline">Rien de déclaré : reste estimé au prorata du temps. Survolez une catégorie et saisissez ce que vous avez dépensé — un total suffit, sans date.</span><span class="md:hidden">Estimé : touchez une catégorie pour saisir.</span></p>
                <p v-else-if="p.depassement > 0" class="mt-2 text-[11px] font-black text-rose-100" data-liberte-depasse>⚠️ Budget conso du cycle dépassé de {{ formatMad(p.depassement) }}.</p>
                <p v-else-if="p.contrainte === 'tresorerie'" class="hidden md:block mt-2 text-[11px] font-bold text-amber-100 leading-snug" data-pulse-plafond>🏦 Plafonné par la trésorerie : le budget laisserait {{ formatMad(p.resteBudget) }}, le compte n'en couvre que {{ formatMad(p.reste) }} d'ici la paie.</p>
            </div>

            <!-- Par catégorie : le reste de chacune, et d'où vient le chiffre -->
            <div v-if="p.categories && p.categories.length" class="mt-3 md:mt-5 md:pt-4 md:border-t md:border-white/10">
                <p class="hidden md:flex items-baseline justify-between gap-2 mb-2.5">
                    <span class="text-[10px] font-black uppercase tracking-[0.22em] text-white/55">Par catégorie</span>
                    <span class="text-[10px] font-semibold text-white/40">survol : courses prévues, saisie, tickets</span>
                </p>
                <div data-pulse-categories class="rx-defile flex md:grid md:grid-cols-1 gap-1.5 md:gap-1 overflow-x-auto md:overflow-visible -mx-1 px-1 py-0.5">
                    <button v-for="c in p.categories" :key="'pc_' + c.key" type="button" data-rx-ancre data-pulse-cat :data-cat="c.key" :data-source="c.source"
                            :aria-expanded="estOuvert('cat', c.key) ? 'true' : 'false'" :aria-label="c.label + ' : reste ' + formatMad(c.reste) + ' sur ' + formatMad(c.budget) + ', détail et saisie'"
                            @pointerenter="survolEntree($event, 'cat', c.key)" @pointerleave="survolSortie($event)" @click="basculer($event, 'cat', c.key)"
                            :class="['shrink-0 md:shrink flex items-center gap-2 md:gap-3 rounded-xl pl-1.5 pr-2.5 py-1.5 md:px-2.5 md:py-2 text-left ring-1 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/70',
                                     estOuvert('cat', c.key) ? 'bg-white/20 ring-white/40' : (c.source === 'estime' ? 'bg-white/[0.03] ring-white/10 hover:bg-white/[0.1]' : 'bg-white/[0.06] ring-white/10 hover:bg-white/[0.14]')]">
                        <svg viewBox="0 0 36 36" class="w-6 h-6 md:w-7 md:h-7 -rotate-90 shrink-0" aria-hidden="true">
                            <circle cx="18" cy="18" r="14" fill="none" stroke-width="5" class="stroke-white/15"></circle>
                            <circle cx="18" cy="18" r="14" fill="none" stroke-width="5" pathLength="100" :stroke-linecap="anneau(c) > 0 ? 'round' : 'butt'"
                                    :stroke-dasharray="anneau(c) + ' 100'" :class="c.reste < 0 ? 'stroke-rose-200' : 'stroke-white'"></circle>
                        </svg>
                        <span class="min-w-0 md:flex-1 md:flex md:items-baseline md:justify-between md:gap-3">
                            <span class="block text-[11px] md:text-[13px] font-bold text-white leading-tight truncate max-w-[7.5rem] md:max-w-none">{{ c.label }}</span>
                            <span class="block mt-0.5 md:mt-0 md:shrink-0 text-[10px] md:text-xs font-semibold text-white/50 tabular-nums leading-tight whitespace-nowrap">
                                <template v-if="c.reste >= 0">{{ c.source === 'estime' ? '≈ ' : '' }}reste <span class="font-black text-white/90">{{ chiffre(c.reste) }}</span> / {{ chiffre(c.budget) }}</template>
                                <template v-else><span class="font-black text-rose-200">dépassé de {{ chiffre(-c.reste) }} DH</span></template>
                            </span>
                        </span>
                        <span class="hidden md:inline-flex shrink-0 items-center justify-center h-5 px-1.5 rounded-full text-[10px] font-black"
                              :class="c.source === 'estime' ? 'bg-white/10 text-white/60' : 'bg-white/15 text-white'" :title="c.source === 'compteur' ? 'Total saisi en vrac' : (c.source === 'tickets' ? c.nb + ' ticket(s) daté(s)' : 'Rien de déclaré : estimé au rythme attendu du cycle')">{{ c.source === 'compteur' ? '📝' : (c.source === 'tickets' ? '🧾 ' + c.nb : '≈ à saisir') }}</span>
                    </button>
                </div>
                <button v-if="p.horsBudget > 0" type="button" data-rx-ancre data-pulse-hors
                        @pointerenter="survolEntree($event, 'hors', 'hors')" @pointerleave="survolSortie($event)" @click="basculer($event, 'hors', 'hors')"
                        class="hidden md:inline-block mt-3 text-[10px] font-semibold text-white/50 hover:text-white/80 underline decoration-dotted underline-offset-2 text-left">+ {{ formatMad(p.horsBudget) }} saisis hors budget conso (factures…) : non comptés ici</button>
            </div>
        </div>

""")

# ── 3. Plus de « filet » : son contenu est la carte de droite ───────────────
bloc('ligne filet', '    <!-- Le filet de sécurité : le cycle entier, en mention discrète -->', '    <div v-if="chips || lien" class="relative mt-2.5 md:mt-3', '')
sub('les puces d\'état global passent à gauche, sous le verdict', """                <p v-if="meteo.logistique" class="mt-1.5 md:mt-2 inline-block rounded-xl bg-black/20 ring-1 ring-white/15 px-2.5 py-1 md:py-1.5 text-[11px] md:text-xs font-bold text-white leading-snug" data-meteo-logistique>{{ meteo.logistique }}</p>
            </div>""", """                <p v-if="meteo.logistique" class="mt-1.5 md:mt-2 inline-block rounded-xl bg-black/20 ring-1 ring-white/15 px-2.5 py-1 md:py-1.5 text-[11px] md:text-xs font-bold text-white leading-snug" data-meteo-logistique>{{ meteo.logistique }}</p>
                <div v-if="chips" class="mt-2.5 md:mt-3 flex flex-wrap gap-1.5 text-[10px] md:text-[11px] font-bold" data-meteo-etat>
                    <span class="rounded-full bg-white/15 ring-1 ring-white/20 px-2.5 py-1">🏁 Atterrissage le {{ meteo.dateFin }} : {{ formatMad(meteo.atterrissage) }}</span>
                    <span class="hidden md:inline rounded-full bg-white/15 ring-1 ring-white/20 px-2.5 py-1">🫁 Respiration du budget : {{ meteo.respirationPct }} %</span>
                </div>
            </div>""")
sub('la rangée du bas ne garde que le lien', """    <div v-if="chips || lien" class="relative mt-2.5 md:mt-3 flex flex-wrap items-center gap-1.5 md:gap-2 text-[10px] md:text-[11px] font-bold">
        <template v-if="chips">
            <span class="rounded-full bg-white/15 ring-1 ring-white/20 px-2.5 py-1">🏁 Atterrissage le {{ meteo.dateFin }} : {{ formatMad(meteo.atterrissage) }}</span>
            <span class="rounded-full bg-white/15 ring-1 ring-white/20 px-2.5 py-1">🫁 Respiration du budget : {{ meteo.respirationPct }} %</span>
        </template>""", """    <div v-if="lien" class="relative mt-3 md:mt-4 flex flex-wrap items-center gap-1.5 md:gap-2 text-[10px] md:text-[11px] font-bold">""")

# ── 4. Rayons X d'une catégorie : courses prévues, saisie en vrac, tickets ──
bloc('panneau catégorie', '            <!-- Une catégorie : ses achats de la semaine -->', '            <!-- Un compte : les prélèvements qu\'il doit couvrir -->', """            <!-- Une catégorie : ce qui est prévu, ce qui est parti, et la saisie en vrac -->
            <template v-if="rxContenu.type === 'cat'">
                <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                        <p class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">🔍 Ce cycle</p>
                        <p class="text-sm font-black text-white truncate">{{ rxContenu.c.label }}</p>
                    </div>
                    <p class="shrink-0 text-right tabular-nums leading-tight">
                        <span class="block text-lg font-black text-white" data-rx-total>{{ formatMad(rxContenu.c.engage) }}</span>
                        <span class="block text-[10px] font-semibold text-slate-400">sur {{ formatMad(rxContenu.c.budget) }}</span>
                    </p>
                </div>
                <div class="mt-2.5 h-1 rounded-full bg-white/10 overflow-hidden">
                    <div :class="['h-full rounded-full', rxContenu.c.reste < 0 ? 'bg-rose-400' : 'bg-emerald-300']" :style="{ width: anneau(rxContenu.c) + '%' }"></div>
                </div>
                <!-- 🧾 Le budget prévu : la liste de courses -->
                <div v-if="rxContenu.c.prevu && rxContenu.c.prevu.length" data-rx-prevu class="mt-3 rounded-xl bg-slate-50 ring-1 ring-white/20 p-2.5 text-slate-600">
                    <p class="flex items-baseline justify-between gap-2">
                        <span class="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">🧾 Budget prévu</span>
                        <span class="text-[10px] font-bold text-slate-400 tabular-nums">par {{ rxContenu.c.prevuUnite }}</span>
                    </p>
                    <div class="mt-2 flex flex-wrap gap-1">
                        <span v-for="(d, i) in postesVisibles(rxContenu.c)" :key="'rxp_' + i" data-rx-poste :data-depense="d.depense"
                              :title="d.depense > 0 ? formatMad(d.depense) + ' de tickets sur ce poste ce cycle' : 'Aucun ticket sur ce poste ce cycle'"
                              class="relative overflow-hidden inline-flex items-center gap-1 rounded-md bg-white ring-1 ring-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 tabular-nums">
                            <span v-if="d.depense > 0" aria-hidden="true" data-rx-poste-rempli :class="['absolute inset-y-0 left-0', d.depasse ? 'bg-rose-100' : 'bg-emerald-100']" :style="{ width: d.pct + '%' }"></span>
                            <span class="relative">{{ d.emoji }} {{ d.nom }} : <span class="font-black text-slate-800">{{ formatMad(d.montant) }}</span></span>
                        </span>
                        <button v-if="!rxTousPostes && rxContenu.c.prevu.length > 8" type="button" data-rx-plus @click.stop="deplierPostes()"
                                class="inline-flex items-center rounded-md bg-slate-200/70 hover:bg-slate-300/70 px-1.5 py-0.5 text-[10px] font-black text-slate-600">+{{ rxContenu.c.prevu.length - 8 }}</button>
                    </div>
                    <p v-if="rxContenu.c.prevuAjuste" class="mt-1.5 text-[10px] font-semibold text-slate-400 leading-snug">Ajusté au budget du cycle (exception du mois, mode voyage) : postes ramenés en proportion.</p>
                    <p v-if="rxContenu.c.nonVentile > 0" class="mt-1.5 text-[10px] font-semibold text-slate-400 leading-snug" data-rx-non-ventile>{{ formatMad(rxContenu.c.nonVentile) }} de tickets saisis sur « {{ rxContenu.c.label }} » sans sous-catégorie : non répartis ci-dessus.</p>
                </div>
                <!-- 📝 La saisie en vrac : un total, sans date -->
                <div data-rx-compteur class="mt-3 rounded-xl bg-violet-400/10 ring-1 ring-violet-300/25 p-2.5">
                    <label class="flex items-center justify-between gap-2">
                        <span class="min-w-0">
                            <span class="block text-[10px] font-black uppercase tracking-[0.16em] text-violet-200">📝 Déjà dépensé ce cycle</span>
                            <span class="block text-[10px] font-semibold text-slate-400">un total suffit, sans date</span>
                        </span>
                        <span class="flex items-center gap-1 shrink-0">
                            <input type="number" inputmode="decimal" min="0" step="1" data-rx-compteur-input
                                   :value="rxContenu.c.saisi || ''" :placeholder="rxContenu.c.tickets ? String(rxContenu.c.tickets) : '0'"
                                   @change="saisirCompteur(rxContenu.c.key, $event)" @keydown.enter="$event.target.blur()"
                                   class="w-24 rounded-lg bg-slate-900 ring-1 ring-white/15 px-2 py-1 text-right text-sm font-black text-white tabular-nums outline-none focus:ring-2 focus:ring-violet-300">
                            <span class="text-[11px] font-bold text-slate-400">DH</span>
                        </span>
                    </label>
                    <p v-if="rxContenu.c.tickets > 0 && rxContenu.c.saisi > 0" class="mt-1.5 text-[10px] font-semibold text-slate-400 leading-snug" data-rx-regle>
                        Compteur {{ formatMad(rxContenu.c.saisi) }} · tickets {{ formatMad(rxContenu.c.tickets) }} : on retient le plus grand, jamais la somme.
                    </p>
                </div>
                <!-- 🧾 Les tickets datés du cycle, s'il y en a -->
                <div v-if="rxContenu.c.transactions.length" class="mt-3 pt-3 border-t border-dashed border-white/15">
                    <p class="flex items-baseline justify-between gap-2 mb-1" data-rx-reel>
                        <span class="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">🧾 Tickets datés du cycle</span>
                        <span class="text-[10px] font-bold text-slate-500 tabular-nums">{{ formatMad(rxContenu.c.tickets) }}</span>
                    </p>
                    <ul class="max-h-48 overflow-y-auto divide-y divide-white/5 -mx-1 px-1">
                        <li v-for="t in rxContenu.c.transactions" :key="'rxt_' + t.id" data-rx-ligne class="grid grid-cols-[3.1rem_minmax(0,1fr)_auto] items-center gap-2 py-2 text-xs">
                            <span class="text-[10px] font-bold text-slate-500 tabular-nums whitespace-nowrap" data-rx-quand>{{ t.quand }}</span>
                            <span class="min-w-0 flex items-center gap-1.5">
                                <span class="truncate font-semibold text-slate-100" data-rx-libelle>{{ t.libelle }}</span>
                                <span v-if="t.poste" class="shrink-0 max-w-[5.5rem] truncate rounded bg-white/10 px-1 text-[9px] font-bold text-slate-300" data-rx-ligne-poste :title="t.poste">{{ t.posteEmoji }} {{ t.poste }}</span>
                                <mono-compte v-if="t.compte" :c="t.compte"></mono-compte>
                                <span v-if="t.horsCompte" class="shrink-0 text-[9px] font-black text-amber-300" title="Payé depuis un autre compte que celui des charges variables">≠ prévu</span>
                            </span>
                            <span class="font-black tabular-nums text-white" data-rx-montant>{{ formatMad(t.montant) }}</span>
                        </li>
                    </ul>
                </div>
                <p class="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between gap-2 text-[11px] font-bold">
                    <span class="text-slate-400"><template v-if="rxContenu.c.reste > 0">≈ {{ formatMad(rxContenu.c.parSemaine) }} / sem. d'ici la paie</template><template v-else>Plus rien à dépenser ici</template></span>
                    <span :class="['whitespace-nowrap', rxContenu.c.reste < 0 ? 'text-rose-300' : 'text-emerald-300']" data-rx-reste>{{ rxContenu.c.reste >= 0 ? 'Reste ' + formatMad(rxContenu.c.reste) : 'Dépassé de ' + formatMad(-rxContenu.c.reste) }}</span>
                </p>
            </template>
""")
sub('hors budget : le cycle', """🔍 Hors budget conso · cette semaine</p>""", """🔍 Hors budget conso · ce cycle</p>""")
sub('hors budget : la carte', """suivies par le Sanctuaire, pas par la Liberté.</p>""", """suivies par le Sanctuaire, pas par le Reste à dépenser.</p>""")

# ── 5. Le parent : la saisie en vrac va au moteur (setConsoT0) ──────────────
n = src.count("""<meteo-financiere :meteo="meteoFinanciere" :format-mad="formatMAD\"""")
if n != 3:
    print(f'✖ usages de <meteo-financiere> : {n}, 3 attendus'); sys.exit(1)
edits.append(("""<meteo-financiere :meteo="meteoFinanciere" :format-mad="formatMAD\"""",
              """<meteo-financiere :meteo="meteoFinanciere" :format-mad="formatMAD" @compteur="saisirCompteurConso\""""))

# ── 6. Le bloc « Réalisé à T0 » montre le compteur, pas l'engagé fusionné ──
sub('champ du compteur', """                                        <input type="number" min="0" :value="c.engage"
                                               @input="setConsoT0(c.key, $event.target.value)"
                                               placeholder="0\"""", """                                        <span v-if="c.tickets > 0" class="text-[9px] font-bold text-slate-500 whitespace-nowrap" :title="'Tickets datés du cycle : ' + formatMAD(c.tickets) + ' — on retient le plus grand du compteur et des tickets'">🧾 {{ formatNombre(c.tickets) }}</span>
                                        <input type="number" min="0" :value="c.saisi || ''"
                                               @input="saisirCompteurConso(c.key, $event.target.value)"
                                               :placeholder="c.tickets ? String(c.tickets) : '0'\"""")
sub('↩ efface le compteur', """                                    <button v-if="consoT0Renseigne" @click="resetConsoT0()\"""", """                                    <button v-if="consoCompteurRenseigne" @click="resetConsoT0()\"""")

for a, r in edits: src = src.replace(a, r) if a.startswith('<meteo-financiere') else src.replace(a, r, 1)
io.open(F, 'w', encoding='utf-8').write(src)
print(f'✔ carte, filet, panneau remplacés + {len(edits)} modifications appliquées')
