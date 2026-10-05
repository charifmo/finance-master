# -*- coding: utf-8 -*-
"""
v37.21 Rayons-X — PARTIE GABARIT.

  • <mono-compte> : un compte = sa couleur (stable depuis v37.18) + 2-3 lettres.
    Le même petit carré partout — pastilles de routage, Liberté, Sanctuaire,
    lignes du panneau — pour que l'œil associe la dépense à son compte sans lire.
  • La carte Liberté, aérée : un chiffre vedette, une jauge fine, une ligne de
    légende, UNE note (la plus importante), puis les catégories en tuiles
    (anneau de progression, « dépensé / budget »). Plus de pile de barres.
  • Rayons X : survol (souris) ou toucher (téléphone) d'une catégorie → panneau
    des vraies transactions de la semaine (date, libellé, compte, montant).
    Le panneau est téléporté dans <body>, en position fixe, z-[9999] : aucun
    parent (overflow, backdrop-blur, stacking context) ne peut le rogner.
  • Sanctuaire par compte : une barre partagée aux couleurs des comptes, une
    ligne par compte payeur ; Rayons X → les prélèvements de ce compte.
  • Bureau : le Sanctuaire passe sous le verdict (colonne de gauche), la Liberté
    occupe toute la colonne de droite — deux colonnes de même hauteur.
"""
import io, sys, hashlib
F = 'index.html'
src = io.open(F, encoding='utf-8').read()
edits = []
def sub(label, anchor, replacement, expected=1):
    n = src.count(anchor)
    if n != expected:
        print(f'✖ {label} : {n} ancre(s), {expected} attendue(s)'); sys.exit(1)
    edits.append((anchor, replacement))

# ── Le composant Météo, remplacé d'un bloc (empreinte vérifiée : v37.20) ────
debut, fin = src.index('        const MeteoFinanciere = {'), src.index('        const BaseChart = {')
ancien = src[debut:fin]
if hashlib.sha1(ancien.encode()).hexdigest() != '3bfd10f1ae5577425f20c4b4ff1a5b1b6aa15afd':
    print('✖ composant Météo : ce n\'est pas celui de la v37.20'); sys.exit(1)

NOUVEAU = r"""        const MeteoFinanciere = {
            props: { meteo: { type: Object, required: true }, formatMad: { type: Function, required: true },
                     lien: { type: String, default: null }, chips: { type: Boolean, default: true } },
            emits: ['aller', 'revenir'],
            components: { 'mono-compte': MonoCompte },
            data() { return { rx: null, rxEpingle: false, rxStyle: {} }; },
            computed: {
                fond() {
                    return this.meteo.etat === 'orage' ? 'from-rose-600 via-red-700 to-slate-900'
                         : this.meteo.etat === 'nuages' ? 'from-slate-500 via-slate-600 to-slate-800'
                         : 'from-sky-500 via-sky-600 to-indigo-700';
                },
                p() { return this.meteo.pulse || {}; },
                s() { return this.meteo.sanctuaire || {}; },
                //  Le remplissage dit le rythme : vert tenu, ambre en avance, rouge dépassé.
                remplissage() {
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
                },
                //  Ce que montre le panneau Rayons X (null = fermé).
                rxContenu() {
                    const r = this.rx;
                    if (!r) return null;
                    if (r.type === 'cat') { const c = (this.p.categories || []).find(x => x.key === r.key); return c ? { type: 'cat', c } : null; }
                    if (r.type === 'compte') { const c = (this.s.parCompte || []).find(x => x.key === r.key); return c ? { type: 'compte', c } : null; }
                    if (r.type === 'hors') return (this.p.horsBudgetTx || []).length ? { type: 'hors', lignes: this.p.horsBudgetTx } : null;
                    return null;
                },
            },
            methods: {
                chiffre(v) { return this.formatMad(v).replace(/\s*DH\s*$/, ''); },
                anneau(c) { return Math.min(100, c.budget > 0 ? c.depense / c.budget * 100 : (c.depense > 0 ? 100 : 0)); },
                estOuvert(type, key) { return !!this.rx && this.rx.type === type && this.rx.key === key; },
                //  Souris : le survol ouvre, la sortie referme (avec un temps de grâce
                //  pour rejoindre le panneau) ; le clic épingle. Doigt : le toucher
                //  ouvre et épingle, un second toucher referme.
                ouvrir(type, key, el) {
                    clearTimeout(this._minuteur);
                    this._ancre = el;
                    if (!this.estOuvert(type, key)) {
                        this.rx = { type, key };
                        this.rxStyle = { left: '0px', top: '0px', width: Math.min(340, window.innerWidth - 16) + 'px', visibility: 'hidden' };
                    }
                    this.$nextTick(() => this.placer());
                    this.ecouter(true);
                },
                fermer() { clearTimeout(this._minuteur); this.rx = null; this.rxEpingle = false; this.ecouter(false); },
                fermerBientot() { clearTimeout(this._minuteur); if (!this.rxEpingle) this._minuteur = setTimeout(() => this.fermer(), 180); },
                survolEntree(e, type, key) { if (e.pointerType === 'mouse' && !this.rxEpingle) this.ouvrir(type, key, e.currentTarget); },
                survolSortie(e) { if (e.pointerType === 'mouse') this.fermerBientot(); },
                panneauEntree() { clearTimeout(this._minuteur); },
                basculer(e, type, key) {
                    if (this.estOuvert(type, key) && this.rxEpingle) return this.fermer();
                    this.rxEpingle = true;
                    this.ouvrir(type, key, e.currentTarget);
                },
                placer() {
                    const el = this.$refs.panneau, a = this._ancre;
                    if (!el || !a || !a.isConnected) return this.fermer();
                    const r = a.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight;
                    const W = Math.min(340, vw - 16);
                    const left = Math.min(Math.max(8, r.left), vw - W - 8);
                    const h = el.offsetHeight;
                    let top = r.bottom + 8;
                    if (top + h > vh - 8) top = (r.top - 8 - h >= 8) ? r.top - 8 - h : Math.max(8, vh - 8 - h);
                    this.rxStyle = { left: left + 'px', top: top + 'px', width: W + 'px' };
                },
                ecouter(on) {
                    if (on === !!this._ecoute) return;
                    this._ecoute = on;
                    if (!this._h) this._h = {
                        defile: (e) => { const p = this.$refs.panneau; if (p && e && e.target && e.target.nodeType === 1 && p.contains(e.target)) return; this.fermer(); },
                        touche: (e) => { if (e.key === 'Escape') this.fermer(); },
                        dehors: (e) => {
                            const p = this.$refs.panneau, t = e.target;
                            if (p && p.contains(t)) return;
                            if (t && t.closest && t.closest('[data-rx-ancre]')) return;
                            this.fermer();
                        },
                    };
                    const f = on ? 'addEventListener' : 'removeEventListener';
                    window[f]('scroll', this._h.defile, true);
                    window[f]('resize', this._h.defile);
                    document[f]('keydown', this._h.touche);
                    document[f]('pointerdown', this._h.dehors, true);
                },
            },
            beforeUnmount() { this.ecouter(false); clearTimeout(this._minuteur); },
            template: `
<section data-meteo :data-etat="meteo.etat" :class="['relative overflow-hidden rounded-3xl p-4 md:p-6 text-white shadow-xl shadow-slate-900/20 bg-gradient-to-br', fond]">
    <div aria-hidden="true" class="pointer-events-none absolute -top-20 -right-16 w-64 h-64 rounded-full bg-white/20 blur-3xl"></div>
    <div aria-hidden="true" class="pointer-events-none absolute -bottom-24 -left-10 w-56 h-56 rounded-full bg-black/10 blur-3xl"></div>
    <div v-if="meteo.retro" class="relative mb-4 flex items-center justify-between gap-3 flex-wrap rounded-2xl bg-black/25 ring-1 ring-white/20 px-3 py-2 text-xs font-bold">
        <span>🕰️ Vous régularisez {{ meteo.cycleConsulte }} : la météo, elle, parle du cycle en cours.</span>
        <button type="button" @click="$emit('revenir')" class="shrink-0 rounded-lg bg-white/90 text-slate-900 px-2.5 py-1 text-[11px] font-black hover:bg-white">Cycle actuel</button>
    </div>
    <div class="relative grid grid-cols-1 gap-2.5 md:gap-x-6 md:gap-y-5 md:grid-cols-2 md:grid-rows-[auto_1fr] items-start">
        <!-- Le verdict -->
        <div class="flex gap-3 md:gap-4 items-start min-w-0 md:col-start-1 md:row-start-1">
            <div class="meteo-flotte text-3xl md:text-6xl leading-none drop-shadow-lg select-none shrink-0" aria-hidden="true">{{ meteo.icone }}</div>
            <div class="min-w-0">
                <p class="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">Météo financière</p>
                <h3 class="text-xl md:text-3xl font-black tracking-tight leading-tight" data-meteo-titre>{{ meteo.titre }}</h3>
                <p class="mt-1 md:mt-1.5 text-xs md:text-sm font-semibold text-white/90 leading-snug line-clamp-2 md:line-clamp-none" data-meteo-raison>{{ meteo.raison }}</p>
                <p class="mt-1.5 md:mt-2 text-xs md:text-sm font-black text-white leading-snug" data-meteo-conseil>👉 {{ meteo.conseil }}</p>
                <p v-if="meteo.logistique" class="mt-1.5 md:mt-2 inline-block rounded-xl bg-black/20 ring-1 ring-white/15 px-2.5 py-1 md:py-1.5 text-[11px] md:text-xs font-bold text-white leading-snug" data-meteo-logistique>{{ meteo.logistique }}</p>
            </div>
        </div>

        <!-- 🕊️ LIBERTÉ : ce que je peux dépenser cette semaine (le Variable) -->
        <div data-pulse-liberte :data-rythme="p.rythme" class="min-w-0 md:col-start-2 md:row-start-1 md:row-span-2 rounded-[1.5rem] bg-white/[0.13] backdrop-blur-md ring-1 ring-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] p-3.5 md:p-5">
            <div class="flex items-center justify-between gap-2">
                <p class="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 whitespace-nowrap">🕊️ Liberté de la semaine</p>
                <span data-pulse-rythme :class="['shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ring-1',
                      p.rythme === 'depasse' ? 'bg-rose-500/30 ring-rose-200/40' : (p.rythme === 'avance' ? 'bg-amber-400/25 ring-amber-200/40' : 'bg-emerald-400/20 ring-emerald-200/30')]"><span class="hidden md:inline">{{ rythmeTexte }}</span><span class="md:hidden">{{ rythmeCourt }}</span></span>
            </div>
            <p class="mt-2 md:mt-4 flex items-baseline gap-1.5 tabular-nums leading-none" data-pulse-montant>
                <span class="text-4xl md:text-6xl font-black tracking-tighter">{{ chiffre(p.liberte) }}</span>
                <span class="text-lg md:text-2xl font-black text-white/50">DH</span>
                <span v-if="p.contrainte === 'tresorerie' && !p.depassement && !p.reelSansDates" class="md:hidden ml-auto self-center rounded-full bg-amber-300/20 ring-1 ring-amber-200/40 px-2 py-0.5 text-[10px] font-black text-amber-100 tracking-normal">🏦 plafonnée</span>
            </p>
            <p class="mt-1.5 md:mt-2 text-xs md:text-sm font-semibold text-white/70 leading-snug">
                libres d'ici <span class="md:hidden">dim.</span><span class="hidden md:inline">dimanche</span> {{ p.au }}<span v-if="p.compte" class="whitespace-nowrap" data-pulse-compte :data-compte="p.compte.key"> · sur <mono-compte :c="p.compte" class="align-[-2px]"></mono-compte> <span class="font-bold text-white/90">{{ p.compte.tag }}</span></span>
            </p>

            <!-- La semaine : remplissage = enveloppe consommée, repère = aujourd'hui -->
            <div class="mt-3 md:mt-5">
                <div class="relative" role="img" :aria-label="p.pct + ' % de l’enveloppe hebdomadaire consommée, au jour ' + (p.idxJour + 1) + ' sur 7'">
                    <div class="h-2 rounded-full bg-black/25 overflow-hidden">
                        <div data-pulse-jauge :class="['h-full rounded-full transition-all duration-700 ease-out', remplissage]" :style="{ width: Math.min(100, p.pct) + '%' }"></div>
                    </div>
                    <div aria-hidden="true" class="absolute inset-0 flex pointer-events-none">
                        <span v-for="i in 6" :key="'sep' + i" class="flex-1 border-r border-white/15"></span><span class="flex-1"></span>
                    </div>
                    <div data-pulse-repere aria-hidden="true" class="absolute -top-1 -bottom-1 w-[3px] -ml-[1.5px] rounded-full bg-white shadow-[0_0_0_2px_rgba(15,23,42,0.18)]" :style="{ left: p.pctTemps + '%' }"></div>
                </div>
                <div aria-hidden="true" class="mt-1.5 hidden md:grid grid-cols-7 text-center text-[9px] font-black tracking-wider">
                    <span v-for="(j, i) in p.jours" :key="'j' + i" :class="i === p.idxJour ? 'text-white' : (i < p.idxJour ? 'text-white/55' : 'text-white/30')">{{ j }}</span>
                </div>
                <p class="mt-2 md:mt-2.5 flex items-baseline justify-between gap-3 text-[11px] md:text-xs" data-pulse-legende>
                    <span class="font-semibold text-white/65"><span class="font-black text-white tabular-nums">{{ formatMad(p.depense) }}</span> dépensés sur {{ formatMad(p.enveloppe) }}</span>
                    <span class="font-black tabular-nums text-white/90">{{ p.pct }} %</span>
                </p>
                <!-- UNE note, la plus importante -->
                <p v-if="p.reelSansDates" class="mt-2 text-[11px] font-semibold text-white/75 leading-snug" data-pulse-sans-dates>ℹ️ Réel saisi par catégorie, sans dates : la semaine ne peut pas le voir.<span class="hidden md:inline"> Saisissez vos dépenses (onglet Saisie) pour la suivre.</span></p>
                <p v-else-if="p.depassement > 0" class="mt-2 text-[11px] font-black text-rose-100">⚠️ Dépassée de {{ formatMad(p.depassement) }} depuis lundi.</p>
                <p v-else-if="p.contrainte === 'tresorerie'" class="hidden md:block mt-2 text-[11px] font-bold text-amber-100 leading-snug" data-pulse-plafond>🏦 Plafonnée par la trésorerie : au-delà de {{ formatMad(p.plafond) }} cette semaine, vous entamez la part des semaines suivantes.</p>
                <p v-else-if="!p.nbTx" class="mt-2 text-[11px] font-semibold text-white/70" data-pulse-vide>Aucune dépense saisie depuis lundi {{ p.du }}.</p>
            </div>

            <!-- Où part l'enveloppe : une tuile par catégorie, Rayons X au survol -->
            <!-- Au téléphone, une rangée toute à zéro n'a rien à auditer : on l'affiche dès le premier achat -->
            <div v-if="p.categories && p.categories.length" :class="['mt-2.5 md:mt-5 md:pt-4 md:border-t md:border-white/10', p.nbTx ? '' : 'hidden md:block']">
                <p class="hidden md:flex items-baseline justify-between gap-2 mb-2.5">
                    <span class="text-[10px] font-black uppercase tracking-[0.22em] text-white/55">Où part l'enveloppe</span>
                    <span class="text-[10px] font-semibold text-white/40">survol : le détail des achats</span>
                </p>
                <div data-pulse-categories class="rx-defile flex md:grid md:grid-cols-1 gap-1.5 md:gap-1 overflow-x-auto md:overflow-visible -mx-1 px-1 py-0.5">
                    <button v-for="c in p.categories" :key="'pc_' + c.key" type="button" data-rx-ancre data-pulse-cat :data-cat="c.key"
                            :aria-expanded="estOuvert('cat', c.key) ? 'true' : 'false'" :aria-label="c.label + ' : ' + formatMad(c.depense) + ' sur ' + formatMad(c.budget) + ', voir les achats'"
                            @pointerenter="survolEntree($event, 'cat', c.key)" @pointerleave="survolSortie($event)" @click="basculer($event, 'cat', c.key)"
                            :class="['shrink-0 md:shrink flex items-center gap-2 md:gap-3 rounded-xl pl-1.5 pr-2.5 py-1.5 md:px-2.5 md:py-2 text-left ring-1 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/70',
                                     estOuvert('cat', c.key) ? 'bg-white/20 ring-white/40' : 'bg-white/[0.06] ring-white/10 hover:bg-white/[0.14]']">
                        <svg viewBox="0 0 36 36" class="w-6 h-6 md:w-7 md:h-7 -rotate-90 shrink-0" aria-hidden="true">
                            <circle cx="18" cy="18" r="14" fill="none" stroke-width="5" class="stroke-white/15"></circle>
                            <circle cx="18" cy="18" r="14" fill="none" stroke-width="5" pathLength="100" :stroke-linecap="anneau(c) > 0 ? 'round' : 'butt'"
                                    :stroke-dasharray="anneau(c) + ' 100'" :class="c.depense > c.budget ? 'stroke-rose-200' : 'stroke-white'"></circle>
                        </svg>
                        <span class="min-w-0 md:flex-1 md:flex md:items-baseline md:justify-between md:gap-3">
                            <span class="block text-[11px] md:text-[13px] font-bold text-white leading-tight truncate max-w-[7.5rem] md:max-w-none">{{ c.label }}</span>
                            <span class="block mt-0.5 md:mt-0 md:shrink-0 text-[10px] md:text-xs font-semibold text-white/50 tabular-nums leading-tight whitespace-nowrap"><span class="font-black text-white/90">{{ chiffre(c.depense) }}</span> / {{ chiffre(c.budget) }} DH</span>
                        </span>
                        <span v-if="c.comptesAutres && c.comptesAutres.length" class="hidden md:inline-flex -space-x-1 shrink-0"><mono-compte v-for="k in c.comptesAutres" :key="'ca_' + k.key" :c="k"></mono-compte></span>
                        <span v-if="c.nb" class="hidden md:inline-flex shrink-0 items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-white/15 text-[10px] font-black tabular-nums" :title="c.nb + ' achat' + (c.nb > 1 ? 's' : '') + ' cette semaine'">{{ c.nb }}</span>
                    </button>
                </div>
                <button v-if="p.horsBudget > 0" type="button" data-rx-ancre data-pulse-hors
                        @pointerenter="survolEntree($event, 'hors', 'hors')" @pointerleave="survolSortie($event)" @click="basculer($event, 'hors', 'hors')"
                        class="hidden md:inline-block mt-3 text-[10px] font-semibold text-white/50 hover:text-white/80 underline decoration-dotted underline-offset-2 text-left">+ {{ formatMad(p.horsBudget) }} saisis hors budget conso (factures…) : non comptés ici</button>
            </div>
        </div>

        <!-- 🔒 SANCTUAIRE : l'argent déjà promis (le Fixe et l'engagé), par compte -->
        <div data-pulse-sanctuaire class="min-w-0 md:col-start-1 md:row-start-2 md:self-end rounded-[1.5rem] bg-slate-950/40 backdrop-blur-md ring-1 ring-white/10 p-3 md:p-5">
            <div class="flex items-center gap-3">
                <span aria-hidden="true" class="shrink-0 w-9 h-9 md:w-10 md:h-10 rounded-xl bg-white/10 ring-1 ring-white/15 flex items-center justify-center text-lg">🔒</span>
                <div class="min-w-0 flex-1">
                    <p class="text-[10px] font-black uppercase tracking-[0.22em] text-white/55">Sanctuaire · 7<span class="hidden md:inline"> prochains</span> jours</p>
                    <p class="tabular-nums leading-tight"><span class="text-xl md:text-3xl font-black tracking-tight" data-pulse-sanctuaire-montant>{{ formatMad(s.montant) }}</span> <span class="text-xs font-bold text-white/60">verrouillés</span></p>
                </div>
            </div>
            <p class="hidden md:block mt-2 text-[11px] font-semibold text-white/60 leading-snug">
                <template v-if="s.nb">Fixes, factures, épargne : {{ s.nb }} prélèvement{{ s.nb > 1 ? 's' : '' }}<template v-if="s.retard">, dont <span class="font-black text-rose-200">{{ formatMad(s.retard) }} en retard</span></template>. Cet argent n'est pas à dépenser.</template>
                <template v-else>Aucun prélèvement programmé dans les 7 prochains jours.</template>
            </p>
            <div v-if="s.parCompte && s.parCompte.length" class="mt-2 md:mt-3">
                <div class="hidden md:flex h-1.5 rounded-full overflow-hidden bg-white/10 gap-px" aria-hidden="true" data-sanct-barre>
                    <span v-for="c in s.parCompte" :key="'sb_' + c.key" :class="['h-full', c.couleur]" :style="{ width: c.part + '%' }"></span>
                </div>
                <div class="rx-defile md:mt-2.5 flex md:block gap-1.5 overflow-x-auto md:overflow-visible md:space-y-1 -mx-1 px-1 py-0.5">
                    <button v-for="c in s.parCompte" :key="'sc_' + c.key" type="button" data-rx-ancre data-sanct-compte :data-compte="c.key"
                            :aria-expanded="estOuvert('compte', c.key) ? 'true' : 'false'" :aria-label="formatMad(c.montant) + ' à garder sur ' + c.label + ', voir les prélèvements'"
                            @pointerenter="survolEntree($event, 'compte', c.key)" @pointerleave="survolSortie($event)" @click="basculer($event, 'compte', c.key)"
                            :class="['shrink-0 md:w-full flex items-center gap-2 md:gap-2.5 rounded-xl px-2 py-1.5 md:px-2.5 md:py-2 text-left ring-1 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/70',
                                     estOuvert('compte', c.key) ? 'bg-white/15 ring-white/30' : 'bg-white/[0.04] ring-white/10 hover:bg-white/10']">
                        <mono-compte :c="c" grand></mono-compte>
                        <span class="min-w-0 md:flex-1">
                            <span class="block text-[11px] md:text-[13px] font-bold text-white leading-tight truncate max-w-[6rem] md:max-w-none">{{ c.tag }}</span>
                            <span class="hidden md:block text-[10px] font-semibold text-white/45 leading-tight">{{ c.nb }} prélèvement{{ c.nb > 1 ? 's' : '' }}<template v-if="c.retard"> · <span class="text-rose-200">{{ formatMad(c.retard) }} en retard</span></template></span>
                        </span>
                        <span class="text-[11px] md:text-sm font-black tabular-nums whitespace-nowrap">{{ formatMad(c.montant) }}</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
    <!-- Le filet de sécurité : le cycle entier, en mention discrète -->
    <p class="relative mt-3 md:mt-4 text-[10px] md:text-[11px] font-semibold text-white/70 leading-snug" data-meteo-filet>
        🛟 Filet du cycle : <span data-meteo-rav>{{ formatMad(Math.max(0, meteo.rav)) }}</span> <span class="hidden md:inline">dépensables </span>jusqu'à la paie<span class="hidden md:inline"> du {{ meteo.prochainePaie }}</span> (J−{{ meteo.jours }})<span class="hidden md:inline">,
        soit ≈ {{ formatMad(meteo.parSemaine) }} / semaine</span> · <span data-meteo-jour>{{ formatMad(meteo.parJour) }}</span> / jour<span class="hidden md:inline"> en moyenne</span>
    </p>
    <div v-if="chips || lien" class="relative mt-2.5 md:mt-3 flex flex-wrap items-center gap-1.5 md:gap-2 text-[10px] md:text-[11px] font-bold">
        <template v-if="chips">
            <span class="rounded-full bg-white/15 ring-1 ring-white/20 px-2.5 py-1">🏁 Atterrissage le {{ meteo.dateFin }} : {{ formatMad(meteo.atterrissage) }}</span>
            <span class="rounded-full bg-white/15 ring-1 ring-white/20 px-2.5 py-1">🫁 Respiration du budget : {{ meteo.respirationPct }} %</span>
        </template>
        <button v-if="lien" type="button" data-meteo-lien @click="$emit('aller')"
                class="ml-auto rounded-full bg-white text-slate-900 px-3.5 py-1.5 text-[11px] font-black shadow-md hover:shadow-lg hover:-translate-y-0.5 transition">{{ lien }} →</button>
    </div>

    <!-- 🔍 RAYONS X : téléporté dans <body>, fixe, au-dessus de tout -->
    <teleport to="body">
        <div v-if="rxContenu" ref="panneau" data-rayonx :data-rx-type="rxContenu.type" role="dialog"
             :aria-label="rxContenu.type === 'cat' ? 'Achats de la semaine : ' + rxContenu.c.label : (rxContenu.type === 'compte' ? 'Prélèvements sur ' + rxContenu.c.label : 'Dépenses hors budget conso')"
             :style="rxStyle" @pointerenter="panneauEntree()" @pointerleave="survolSortie($event)"
             class="fixed z-[9999] rounded-2xl bg-slate-950/95 backdrop-blur-xl text-slate-100 ring-1 ring-white/10 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.65)] p-4 text-left">
            <!-- Une catégorie : ses achats de la semaine -->
            <template v-if="rxContenu.type === 'cat'">
                <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                        <p class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">🔍 Cette semaine</p>
                        <p class="text-sm font-black text-white truncate">{{ rxContenu.c.label }}</p>
                    </div>
                    <p class="shrink-0 text-right tabular-nums leading-tight">
                        <span class="block text-lg font-black text-white" data-rx-total>{{ formatMad(rxContenu.c.depense) }}</span>
                        <span class="block text-[10px] font-semibold text-slate-400">sur {{ formatMad(rxContenu.c.budget) }}</span>
                    </p>
                </div>
                <div class="mt-2.5 h-1 rounded-full bg-white/10 overflow-hidden">
                    <div :class="['h-full rounded-full', rxContenu.c.reste < 0 ? 'bg-rose-400' : 'bg-emerald-300']" :style="{ width: anneau(rxContenu.c) + '%' }"></div>
                </div>
                <ul v-if="rxContenu.c.transactions.length" class="mt-3 max-h-64 overflow-y-auto divide-y divide-white/5 -mx-1 px-1">
                    <li v-for="t in rxContenu.c.transactions" :key="'rxt_' + t.id" data-rx-ligne class="grid grid-cols-[3.1rem_minmax(0,1fr)_auto] items-center gap-2 py-2 text-xs">
                        <span class="text-[10px] font-bold text-slate-500 tabular-nums whitespace-nowrap" data-rx-quand>{{ t.quand }}</span>
                        <span class="min-w-0 flex items-center gap-1.5">
                            <span class="truncate font-semibold text-slate-100" data-rx-libelle>{{ t.libelle }}</span>
                            <mono-compte v-if="t.compte" :c="t.compte"></mono-compte>
                            <span v-if="t.horsCompte" class="shrink-0 text-[9px] font-black text-amber-300" title="Payé depuis un autre compte que celui des charges variables">≠ prévu</span>
                        </span>
                        <span class="font-black tabular-nums text-white" data-rx-montant>{{ formatMad(t.montant) }}</span>
                    </li>
                </ul>
                <p v-else class="mt-3 text-xs font-semibold text-slate-400">Aucun achat saisi depuis lundi dans cette catégorie.</p>
                <p class="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between gap-2 text-[11px] font-bold">
                    <span class="text-slate-400">{{ rxContenu.c.nb }} achat{{ rxContenu.c.nb > 1 ? 's' : '' }}<template v-if="p.compte"> · sur {{ p.compte.tag }}</template></span>
                    <span :class="rxContenu.c.reste < 0 ? 'text-rose-300' : 'text-emerald-300'" data-rx-reste>{{ rxContenu.c.reste >= 0 ? 'Reste ' + formatMad(rxContenu.c.reste) : 'Dépassé de ' + formatMad(-rxContenu.c.reste) }}</span>
                </p>
            </template>
            <!-- Un compte : les prélèvements qu'il doit couvrir -->
            <template v-else-if="rxContenu.type === 'compte'">
                <div class="flex items-center gap-2.5">
                    <mono-compte :c="rxContenu.c" grand></mono-compte>
                    <div class="min-w-0 flex-1">
                        <p class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">🔒 À garder ici</p>
                        <p class="text-sm font-black text-white truncate">{{ rxContenu.c.label }}</p>
                    </div>
                    <p class="shrink-0 text-lg font-black text-white tabular-nums" data-rx-total>{{ formatMad(rxContenu.c.montant) }}</p>
                </div>
                <ul class="mt-3 max-h-64 overflow-y-auto divide-y divide-white/5 -mx-1 px-1">
                    <li v-for="(t, i) in rxContenu.c.lignes" :key="'rxc_' + i" data-rx-ligne class="grid grid-cols-[3.1rem_minmax(0,1fr)_auto] items-center gap-2 py-2 text-xs">
                        <span :class="['text-[10px] font-bold tabular-nums whitespace-nowrap', t.retard ? 'text-rose-300' : 'text-slate-500']" data-rx-quand>{{ t.retard ? 'retard' : (t.quand || '—') }}</span>
                        <span class="min-w-0">
                            <span class="block truncate font-semibold text-slate-100" data-rx-libelle>{{ t.icone }} {{ t.libelle }}</span>
                            <span class="block truncate text-[10px] font-semibold text-slate-500">{{ t.badge }}<template v-if="t.groupe && !/^(Charge fixe|Épargne|Flux exceptionnel)$/.test(t.groupe)"> · {{ t.groupe }}</template><template v-if="t.retard && t.quand"> · prévu {{ t.quand }}</template></span>
                        </span>
                        <span class="font-black tabular-nums text-white" data-rx-montant>{{ formatMad(t.reste) }}</span>
                    </li>
                </ul>
                <p class="mt-3 pt-2.5 border-t border-white/10 text-[11px] font-semibold text-slate-400 leading-snug">Ces prélèvements partent de <span class="font-black text-white">{{ rxContenu.c.tag }}</span> : gardez-y au moins {{ formatMad(rxContenu.c.montant) }} d'ici 7 jours.</p>
            </template>
            <!-- Hors budget conso -->
            <template v-else>
                <p class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">🔍 Hors budget conso · cette semaine</p>
                <ul class="mt-2 max-h-64 overflow-y-auto divide-y divide-white/5 -mx-1 px-1">
                    <li v-for="t in rxContenu.lignes" :key="'rxh_' + t.id" data-rx-ligne class="grid grid-cols-[3.1rem_minmax(0,1fr)_auto] items-center gap-2 py-2 text-xs">
                        <span class="text-[10px] font-bold text-slate-500 tabular-nums whitespace-nowrap">{{ t.quand }}</span>
                        <span class="min-w-0 flex items-center gap-1.5"><span class="truncate font-semibold text-slate-100">{{ t.libelle }}</span><mono-compte v-if="t.compte" :c="t.compte"></mono-compte></span>
                        <span class="font-black tabular-nums text-white">{{ formatMad(t.montant) }}</span>
                    </li>
                </ul>
                <p class="mt-3 pt-2.5 border-t border-white/10 text-[11px] font-semibold text-slate-400 leading-snug">Rangées dans une catégorie hors enveloppe (factures, prélèvements planifiés) : suivies par le Sanctuaire, pas par la Liberté.</p>
            </template>
        </div>
    </teleport>
</section>`,
        };

"""

# ── Le monogramme, défini avant la pastille de routage qui l'utilise ────────
sub('composant MonoCompte', """        const ChipCompte = {
            props: { m: { type: Object, required: true },""", """        /* ═══ v37.21 — MONOGRAMME DE COMPTE ═══════════════════════════════════
           Un compte = sa couleur (stable, v37.18) + 2-3 lettres (la banque si
           le libellé la nomme). Le même petit carré partout. */
        const MonoCompte = {
            props: { c: { type: Object, default: null }, grand: { type: Boolean, default: false } },
            template: `<span v-if="c" :title="c.label" data-mono-compte :data-compte="c.key"
      :class="['inline-flex items-center justify-center shrink-0 rounded-[5px] font-black text-white leading-none tracking-tight ring-1 ring-black/10 select-none',
               grand ? 'h-6 min-w-[1.5rem] px-1 text-[9px]' : 'h-4 min-w-[1rem] px-0.5 text-[7.5px]', c.couleur]">{{ c.initiales }}</span>`,
        };

        const ChipCompte = {
            components: { 'mono-compte': MonoCompte },
            props: { m: { type: Object, required: true },""")
sub('la pastille de routage porte le monogramme', """        <span :class="['w-2 h-2 rounded-full shrink-0', m.couleur]"></span>
        <span class="truncate">{{ m.court }}</span>""", """        <mono-compte :c="m"></mono-compte>
        <span class="truncate">{{ m.tag || m.court }}</span>""")
sub('…et sa bulle aussi', """                <span :class="['w-2.5 h-2.5 rounded-full shrink-0', m.couleur]"></span>
                {{ sens === 'credit' ? 'Arrive sur' : 'Prélevé sur' }} {{ m.label }}""", """                <mono-compte :c="m" grand></mono-compte>
                {{ sens === 'credit' ? 'Arrive sur' : 'Prélevé sur' }} {{ m.label }}""")
sub('défilement horizontal sans barre au téléphone', """        input[data-saisie] { -moz-appearance: textfield; appearance: textfield; }""", """        input[data-saisie] { -moz-appearance: textfield; appearance: textfield; }
        /* v37.21 : les rangées de tuiles défilent au doigt, sans barre de défilement */
        .rx-defile { scrollbar-width: none; -webkit-overflow-scrolling: touch; }
        .rx-defile::-webkit-scrollbar { display: none; }""")

src = src[:debut] + NOUVEAU + src[fin:]
for a, r in edits: src = src.replace(a, r, 1)
io.open(F, 'w', encoding='utf-8').write(src)
print(f'✔ composant Météo remplacé + {len(edits)} modifications appliquées')
