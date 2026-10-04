# -*- coding: utf-8 -*-
"""
v37.18 Logistique-Bancaire — PARTIE GABARIT. À jouer après refacto_logistique_js_v3718.py.

  <radar-comptes>  : « Sécurité des comptes » — une ligne par compte réel : solde du
                     jour, courbe jusqu'à décembre, point bas, fin d'année, et le
                     virement à faire (avec un compte d'où le faire).
  <chip-compte>    : sur chaque ligne de dépense ou de revenu, une pastille discrète
                     (point de couleur + nom court du compte). Survol ou tap : la
                     mécanique bancaire de la ligne, en clair.
  Barre de focus   : un clic sur un compte filtre le Réalisé ET le Prévisionnel.
  Météo            : une seule ligne logistique, le virement le plus pressant.
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

COMPOSANTS = r"""        /* ═══ v37.18 — PASTILLE DE COMPTE ═══════════════════════════════════
           Discrète au repos (un point de couleur, un nom court) ; au survol ou
           au tap, la bulle raconte la mécanique bancaire de la ligne. Elle
           utilise la bulle UNIQUE du cockpit (une seule ouverte à la fois). */
        const ChipCompte = {
            props: { m: { type: Object, required: true }, regle: { type: String, default: '' }, cle: { type: String, required: true },
                     ouverte: { type: Boolean, default: false }, formatMad: { type: Function, required: true },
                     sombre: { type: Boolean, default: false }, sens: { type: String, default: 'debit' } },
            emits: ['survol', 'quitter', 'basculer'],
            data() { return { place: {} }; },
            methods: {
                //  Une pastille près du bord gauche ouvrait sa bulle hors de l'écran
                //  (mesuré sur S24+) : on la recale dans la fenêtre avant de l'ouvrir.
                placer() {
                    const r = this.$el.getBoundingClientRect();
                    const W = Math.min(288, window.innerWidth - 16);
                    const gauche = Math.min(Math.max(8, r.right - W), window.innerWidth - W - 8);
                    this.place = { left: (gauche - r.left) + 'px', width: W + 'px' };
                },
                survol(e) { this.placer(); this.$emit('survol', e); },
                basculer() { this.placer(); this.$emit('basculer'); },
            },
            template: `
<span class="relative inline-flex align-middle" :data-bulle-cle="cle" @pointerenter="survol($event)" @pointerleave="$emit('quitter', $event)">
    <button type="button" data-route :data-compte-route="m.key" @click.stop.prevent="basculer()"
            :title="(sens === 'credit' ? 'Arrive sur ' : 'Prélevé sur ') + m.label"
            :class="['inline-flex items-center gap-1 max-w-[8.5rem] rounded-full border px-1.5 py-0.5 text-[10px] font-bold transition-colors',
                     sombre ? 'border-slate-600/70 text-slate-300 hover:border-slate-400 hover:text-white bg-slate-900/60' : 'border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-800 bg-white/70']">
        <span :class="['w-2 h-2 rounded-full shrink-0', m.couleur]"></span>
        <span class="truncate">{{ m.court }}</span>
    </button>
    <span v-if="ouverte" data-bulle class="absolute top-full pt-2 z-[200] text-left" :style="place">
        <span class="block bg-slate-950 text-slate-200 border border-slate-600 rounded-xl shadow-2xl p-3.5 text-[11px] leading-snug">
            <span class="flex items-center gap-2 font-black text-white text-xs">
                <span :class="['w-2.5 h-2.5 rounded-full shrink-0', m.couleur]"></span>
                {{ sens === 'credit' ? 'Arrive sur' : 'Prélevé sur' }} {{ m.label }}
            </span>
            <span v-if="regle" class="block mt-1 text-slate-400">{{ regle }}</span>
            <span v-if="m.radar" class="block mt-2.5 pt-2 border-t border-slate-800 space-y-1">
                <span class="flex justify-between gap-3"><span class="text-slate-400">Solde aujourd'hui</span><span class="font-black text-white tabular-nums">{{ formatMad(m.radar.t0) }}</span></span>
                <span v-if="m.finCycle !== null" class="flex justify-between gap-3"><span class="text-slate-400">Fin du cycle</span><span :class="['font-black tabular-nums', m.finCycle < 0 ? 'text-rose-300' : 'text-white']">{{ formatMad(m.finCycle) }}</span></span>
                <span class="flex justify-between gap-3"><span class="text-slate-400">Point bas d'ici le {{ m.horizon }}</span><span :class="['font-black tabular-nums', m.radar.pointBas < 0 ? 'text-rose-300' : 'text-emerald-300']">{{ formatMad(m.radar.pointBas) }}</span></span>
                <span :class="['block mt-1.5 rounded-lg px-2.5 py-1.5 font-black', m.radar.aVirer > 0 ? 'bg-rose-900/60 text-rose-100' : 'bg-emerald-900/50 text-emerald-200']">
                    <template v-if="m.radar.aVirer > 0">🔁 Virer {{ formatMad(m.radar.aVirer) }} avant le {{ m.radar.avantLe }}<template v-if="m.radar.donneur"> (depuis {{ m.radar.donneur.court }})</template></template>
                    <template v-else>✅ Tranquille jusqu'au {{ m.horizon }}</template>
                </span>
            </span>
        </span>
    </span>
</span>`,
        };

        /* ═══ v37.18 — RADAR DE COUVERTURE (« Sécurité des comptes ») ═════════
           Chaque compte réel, projeté par le moteur du Relevé jusqu'au cycle de
           décembre. Le chiffre qui compte est le POINT BAS : c'est lui qui dit
           combien virer pour ne jamais passer sous zéro. */
        const RadarComptes = {
            props: { radar: { type: Object, required: true }, formatMad: { type: Function, required: true },
                     focus: { type: String, default: null }, compact: { type: Boolean, default: false } },
            emits: ['focus'],
            data() { return { tout: false }; },
            computed: {
                lignes() {
                    const base = this.radar.comptes.filter(c => c.nbLignes > 0 || c.t0 !== 0 || c.key === this.focus);
                    if (this.focus) return base.filter(c => c.key === this.focus);
                    if (this.compact && !this.tout) return base.filter(c => c.aVirer > 0);
                    return base;
                },
                caches() { return this.radar.comptes.filter(c => c.nbLignes > 0 || c.t0 !== 0).length - this.lignes.length; },
            },
            methods: {
                echelle(p) { const min = Math.min(0, ...p), max = Math.max(0, ...p); return { min, span: (max - min) || 1 }; },
                chemin(p) {
                    if (!p || p.length < 2) return '';
                    const e = this.echelle(p), n = p.length;
                    return p.map((v, i) => (i / (n - 1) * 200).toFixed(1) + ',' + (40 - (v - e.min) / e.span * 36).toFixed(1)).join(' ');
                },
                zero(p) { const e = this.echelle(p || [0]); return (40 - (0 - e.min) / e.span * 36).toFixed(1); },
            },
            template: `
<section data-radar class="rounded-3xl bg-white/80 backdrop-blur-xl ring-1 ring-slate-900/5 shadow-[0_10px_40px_-14px_rgba(15,23,42,0.22)] p-4 md:p-5">
    <p class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">🛡️ Sécurité des comptes · jusqu'au {{ radar.horizon }}</p>
    <h3 class="mt-0.5 text-base md:text-lg font-black text-slate-900" data-radar-titre>
        <template v-if="radar.besoins.length">{{ radar.besoins.length }} virement{{ radar.besoins.length > 1 ? 's' : '' }} à prévoir · {{ formatMad(radar.totalAVirer) }}</template>
        <template v-else>✅ Tous les comptes tiennent jusqu'au {{ radar.horizon }}</template>
    </h3>
    <p class="text-xs font-semibold text-slate-500">Solde du jour, puis chaque entrée et chaque prélèvement prévus, compte par compte — le moteur du Relevé.</p>
    <ul class="mt-4 space-y-3">
        <li v-for="c in lignes" :key="'rad_' + c.key" data-radar-compte :data-compte="c.key" :data-a-virer="c.aVirer"
            :class="['rounded-2xl ring-1 p-3 md:p-4', c.aVirer > 0 ? 'ring-rose-200 bg-rose-50/70' : 'ring-emerald-100 bg-emerald-50/40']">
            <div class="flex items-center justify-between gap-2 flex-wrap">
                <div class="flex items-center gap-2 min-w-0">
                    <span :class="['w-2.5 h-2.5 rounded-full shrink-0', c.couleur]"></span>
                    <p class="text-sm font-black text-slate-900 truncate">{{ c.icone }} {{ c.label }}</p>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <span v-if="c.aVirer > 0" class="text-[11px] font-black px-2 py-0.5 rounded-full bg-rose-600 text-white">🔁 Virer {{ formatMad(c.aVirer) }}</span>
                    <span v-else class="text-[11px] font-black px-2 py-0.5 rounded-full bg-emerald-600 text-white">✅ Tranquille</span>
                    <button type="button" data-radar-focus @click="$emit('focus', c.key)"
                            :class="['text-[10px] font-black px-2 py-0.5 rounded-full border transition-colors', focus === c.key ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300 text-slate-500 hover:border-slate-500 hover:text-slate-800']">🎯 {{ focus === c.key ? 'Focus actif' : 'Focus' }}</button>
                </div>
            </div>
            <div class="mt-3 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-3 items-center">
                <svg viewBox="0 0 200 44" preserveAspectRatio="none" class="w-full h-11" role="img" :aria-label="'Solde de ' + c.label + ' jusqu’au ' + radar.horizon">
                    <line x1="0" x2="200" :y1="zero(c.points)" :y2="zero(c.points)" class="stroke-slate-300" stroke-width="1" stroke-dasharray="3 3"/>
                    <polyline :points="chemin(c.points)" fill="none" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"
                              :class="c.aVirer > 0 ? 'stroke-rose-500' : 'stroke-emerald-500'"/>
                </svg>
                <div class="grid grid-cols-3 gap-3 text-right">
                    <div><p class="text-[10px] font-bold text-slate-400">Aujourd'hui</p><p class="text-sm font-black text-slate-900 tabular-nums">{{ formatMad(c.t0) }}</p></div>
                    <div><p class="text-[10px] font-bold text-slate-400">Point bas · {{ c.datePointBas }}</p><p :class="['text-sm font-black tabular-nums', c.pointBas < 0 ? 'text-rose-600' : 'text-slate-900']" data-radar-point-bas>{{ formatMad(c.pointBas) }}</p></div>
                    <div><p class="text-[10px] font-bold text-slate-400">Fin · {{ radar.horizon }}</p><p :class="['text-sm font-black tabular-nums', c.fin < 0 ? 'text-rose-600' : 'text-slate-900']">{{ formatMad(c.fin) }}</p></div>
                </div>
            </div>
            <p v-if="c.aVirer > 0" class="mt-2 text-xs font-bold text-rose-800" data-radar-conseil>
                Virer {{ formatMad(c.aVirer) }} sur {{ c.court }} avant le {{ c.avantLe }}<template v-if="c.donneur"> — par exemple depuis {{ c.donneur.label }}, qui garderait {{ formatMad(c.donneur.resteAuPlusBas) }} au plus bas</template>
                <span v-if="c.fin >= 0" class="block font-semibold text-rose-700/80">La fin d'année est positive, mais le compte passe sous zéro avant.</span>
            </p>
        </li>
    </ul>
    <button v-if="compact && !focus && (caches > 0 || tout)" type="button" @click="tout = !tout"
            class="mt-3 text-[11px] font-black text-slate-500 hover:text-slate-900">{{ tout ? '▲ Seulement les comptes à approvisionner' : '▼ Voir les ' + (caches) + ' autres comptes' }}</button>
    <p class="mt-3 text-[10px] text-slate-400 font-semibold leading-snug">Point bas : le solde le plus bas atteint jusqu'au {{ radar.horizon }} — virer ce montant aujourd'hui garde le compte au-dessus de zéro jusqu'au bout.</p>
</section>`,
        };

        const MeteoFinanciere = {"""
sub('composants', """        const MeteoFinanciere = {""", COMPOSANTS)
sub('enregistrement', """                components: { 'base-chart': BaseChart, 'meteo-financiere': MeteoFinanciere },""",
    """                components: { 'base-chart': BaseChart, 'meteo-financiere': MeteoFinanciere, 'chip-compte': ChipCompte, 'radar-comptes': RadarComptes },""")

# ── Météo : la ligne logistique ──
sub('ligne logistique de la météo', """                <p class="mt-1.5 md:mt-2 text-xs md:text-sm font-black text-white leading-snug" data-meteo-conseil>👉 {{ meteo.conseil }}</p>""",
"""                <p class="mt-1.5 md:mt-2 text-xs md:text-sm font-black text-white leading-snug" data-meteo-conseil>👉 {{ meteo.conseil }}</p>
                <p v-if="meteo.logistique" class="mt-2 inline-block rounded-xl bg-black/20 ring-1 ring-white/15 px-2.5 py-1.5 text-xs font-bold text-white leading-snug" data-meteo-logistique>{{ meteo.logistique }}</p>""")

# ── La barre de focus (identique dans les deux onglets) ──
def barre_focus(nom):
    return f"""                    <!-- v37.18 : FOCUS BANCAIRE — un clic, et l'écran ne parle plus que de ce compte -->
                    <div v-if="comptesFocus.length > 1" data-focus-bar data-focus-ou="{nom}" class="space-y-2">
                        <div class="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                            <span class="text-[10px] font-black uppercase tracking-widest text-gray-400 shrink-0">🎯 Focus</span>
                            <button type="button" data-focus="tous" @click="focusCompte = null"
                                    :class="['shrink-0 rounded-full px-3 py-1.5 text-[11px] font-black border transition-colors', !focusCompte ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-500']">Tous les comptes</button>
                            <button v-for="c in comptesFocus" :key="'fo_' + c.key" type="button" :data-focus="c.key"
                                    @click="focusCompte = (focusCompte === c.key ? null : c.key)"
                                    :class="['shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-black border transition-colors', focusCompte === c.key ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-500']">
                                <span :class="['w-2 h-2 rounded-full', c.couleur]"></span>{{{{ c.court }}}}
                                <span v-if="radarComptes.besoins.some(b => b.key === c.key)" class="text-rose-500" title="Virement à prévoir">●</span>
                            </button>
                        </div>
                        <div v-if="focusCompte" data-focus-banner class="flex items-center justify-between gap-3 rounded-2xl bg-slate-900 text-white px-4 py-2.5">
                            <p class="text-xs font-bold min-w-0">🎯 Vous ne voyez que ce qui touche <b>{{{{ infoCompte(focusCompte).label }}}}</b>. La météo, elle, reste globale.</p>
                            <button type="button" @click="focusCompte = null" class="shrink-0 rounded-lg bg-white text-slate-900 px-2.5 py-1 text-[11px] font-black">✕ Tout afficher</button>
                        </div>
                    </div>
"""

# ── Réalisé : focus + radar ──
sub('focus dans le Réalisé', """                                      @aller="appMode = 'previsionnel'; activeTab = 'pilotageTheo'"
                                      @revenir="pilotageViewedCycle = null"></meteo-financiere>
""", """                                      @aller="appMode = 'previsionnel'; activeTab = 'pilotageTheo'"
                                      @revenir="pilotageViewedCycle = null"></meteo-financiere>

""" + barre_focus('realise'))
sub('radar compact après la file du Réalisé', """                        <!-- ═══ v32.00 Realized-T0 : conso déjà engagée sur le cycle ═══""",
"""                        <!-- v37.18 : la sécurité des comptes jusqu'en décembre — compacte : seuls
                             les comptes à approvisionner, le reste à la demande -->
                        <radar-comptes v-if="!isCyclePasse" :radar="radarComptes" :format-mad="formatMAD" :focus="focusCompte" compact
                                       @focus="(k) => focusCompte = (focusCompte === k ? null : k)"></radar-comptes>

                        <!-- ═══ v32.00 Realized-T0 : conso déjà engagée sur le cycle ═══""")

# ── Prévisionnel : focus + radar complet ──
sub('focus + radar dans le Prévisionnel', """                    <!-- 🫁 La jauge de respiration -->""",
    barre_focus('previsionnel') + """
                    <radar-comptes :radar="radarComptes" :format-mad="formatMAD" :focus="focusCompte"
                                   @focus="(k) => focusCompte = (focusCompte === k ? null : k)"></radar-comptes>

                    <!-- 🫁 La jauge de respiration -->""")
sub('titre de la jauge en focus', """                                <p class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">🫁 Respiration budgétaire</p>""",
"""                                <p class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">🫁 Respiration budgétaire<template v-if="focusCompte"> · {{ infoCompte(focusCompte).label }} seul</template></p>""")

# ── Pastilles : file du Réalisé ──
def chip(cle, m, regle, sens, sombre):
    return (f"""<chip-compte :m="{m}" :regle="{regle}" :cle="{cle}" :ouverte="bulleOuverte === {cle}" :format-mad="formatMAD"{' sombre' if sombre else ''} sens="{sens}"
                                                             @survol="survolBulle({cle}, $event)" @quitter="quitterBulle({cle}, $event)" @basculer="basculerBulle({cle})"></chip-compte>""")
sub('pastille dans la file', """                                            <div class="flex items-center gap-2 ml-auto shrink-0">
                                                <span v-if="t.jourPrevu\"""", """                                            <div class="flex flex-wrap items-center justify-end gap-2 ml-auto">
                                                """ + chip("'route:' + t.cle", "mecaniqueCompte(t.compte)", "regleDeRoutage(t.nature, t.ref)", 'debit', True) + """
                                                <span v-if="t.jourPrevu\"""")
sub('en-tête de file en focus', """<span class="text-sm font-black uppercase tracking-widest text-white truncate">À traiter — {{ pilotageCycleLabel }}</span>""",
"""<span class="text-sm font-black uppercase tracking-widest text-white truncate">À traiter — {{ pilotageCycleLabel }}<template v-if="focusCompte"> · 🎯 {{ infoCompte(focusCompte).court }}</template></span>""")
# Les bulles des pastilles doivent pouvoir déborder de la file
sub('la file laisse sortir les bulles', """<div id="pilotage-inbox" class="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden text-left shadow-lg scroll-mt-24">""",
"""<div id="pilotage-inbox" class="bg-slate-800 rounded-2xl border border-slate-700 text-left shadow-lg scroll-mt-24">""")

# ── Entrées d'argent : filtrées et routées ──
sub('entrées filtrées par le focus', """                                    <div v-for="(rev, key) in revenusBudgetairesTries" :key="'rev_' + key\"""",
"""                                    <div v-for="(rev, key) in revenusBudgetairesTries" :key="'rev_' + key" v-show="!focusCompte || compteDeFlux('revenu', rev) === focusCompte\"""")
sub('pastille sur les entrées', """                                            <span :class="['text-sm font-black ml-4 shrink-0', isItemPaid(rev, getDueRevenu(rev, pilotageViewedAn, pilotageViewedMois), cyclePilotage) ? 'text-green-400' : 'text-slate-400']">""",
"""                                            """ + chip("'routeR:' + key", "mecaniqueCompte(compteDeFlux('revenu', rev))", "regleDeRoutage('revenu', rev)", 'credit', True) + """
                                            <span :class="['text-sm font-black ml-3 shrink-0', isItemPaid(rev, getDueRevenu(rev, pilotageViewedAn, pilotageViewedMois), cyclePilotage) ? 'text-green-400' : 'text-slate-400']">""")
sub('vue détaillée : non filtrée, et on le dit', """                                    🗂️ Vue détaillée par catégorie
""", """                                    🗂️ Vue détaillée par catégorie<template v-if="focusCompte"> · tous comptes</template>
""")

# ── Lignes du Prévisionnel : le nom garde sa place, les méta passent dessous si besoin ──
sub('lignes du Prévisionnel sur deux rangs', """                                    <div class="flex items-center justify-between gap-2 text-xs">
                                        <span class="font-bold text-slate-700 truncate min-w-0">{{ l.nom }}</span>
                                        <span class="flex items-center gap-1.5 shrink-0">""", """                                    <div class="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs">
                                        <span class="font-bold text-slate-700 truncate min-w-[9rem] flex-1">{{ l.nom }}</span>
                                        <span class="ml-auto flex items-center gap-1.5 shrink-0">""", expected=2)

# ── Pastilles : Prévisionnel ──
sub('pastille revenus Prévisionnel', """                                            <span class="font-black text-emerald-700 tabular-nums">{{ formatMAD(l.montant) }}</span>""",
"""                                            """ + chip("'routeTR:' + i", "mecaniqueCompte(l.compte)", "regleDeRoutage(l.nature, l.ref)", 'credit', False) + """
                                            <span class="font-black text-emerald-700 tabular-nums">{{ formatMAD(l.montant) }}</span>""")
sub('pastille postes Prévisionnel', """                                            <span class="font-black text-slate-900 tabular-nums">{{ formatMAD(l.montant) }}</span>""",
"""                                            """ + chip("'routeT:' + s.cle + i", "mecaniqueCompte(l.compte)", "regleDeRoutage(l.nature, l.ref)", 'debit', False) + """
                                            <span class="font-black text-slate-900 tabular-nums">{{ formatMAD(l.montant) }}</span>""")

for a, r in edits:
    src = src.replace(a, r)
io.open(F, 'w', encoding='utf-8').write(src)
print(f'✔ {len(edits)} modifications appliquées')
