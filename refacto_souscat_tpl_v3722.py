# -*- coding: utf-8 -*-
"""
v37.22 Liste-de-Courses — PARTIE GABARIT (panneau Rayons X d'une catégorie).

  Le panneau se lit maintenant de haut en bas comme on fait ses courses :
    1. l'en-tête (catégorie, dépensé / budget) ;
    2. 🧾 BUDGET PRÉVU — un « ticket » clair dans le panneau sombre : une
       étiquette par sous-catégorie, [🛍️ Hri : 800 DH], la plus grosse
       d'abord. L'étiquette se remplit (vert, puis rose au-delà) à mesure que
       la semaine dépense sur ce poste. Au-delà de 8 postes, « +N » déplie ;
    3. un séparateur, puis DÉPENSES RÉELLES DE LA SEMAINE — la jauge et les
       achats ; chaque achat rattaché à une sous-catégorie en porte le nom.
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

sub('état : postes repliés', """            data() { return { rx: null, rxEpingle: false, rxStyle: {} }; },""",
    """            data() { return { rx: null, rxEpingle: false, rxStyle: {}, rxTousPostes: false }; },""")
sub('chaque ouverture repart repliée', """                    if (!this.estOuvert(type, key)) {
                        this.rx = { type, key };""", """                    if (!this.estOuvert(type, key)) {
                        this.rx = { type, key };
                        this.rxTousPostes = false;""")
sub('méthodes des postes', """                estOuvert(type, key) {""", """                //  v37.22 : 8 postes d'abord ; « +N » déplie (et le panneau se recale).
                postesVisibles(c) { return this.rxTousPostes ? c.prevu : c.prevu.slice(0, 8); },
                deplierPostes() { this.rxTousPostes = true; this.$nextTick(() => this.placer()); },
                estOuvert(type, key) {""")

sub('bloc Budget prévu + section Dépenses réelles', """                <div class="mt-2.5 h-1 rounded-full bg-white/10 overflow-hidden">
                    <div :class="['h-full rounded-full', rxContenu.c.reste < 0 ? 'bg-rose-400' : 'bg-emerald-300']" :style="{ width: anneau(rxContenu.c) + '%' }"></div>
                </div>
                <ul v-if="rxContenu.c.transactions.length" class="mt-3 max-h-64 overflow-y-auto divide-y divide-white/5 -mx-1 px-1">""", """                <!-- 🧾 Le budget prévu : la liste de courses -->
                <div v-if="rxContenu.c.prevu && rxContenu.c.prevu.length" data-rx-prevu class="mt-3 rounded-xl bg-slate-50 ring-1 ring-white/20 p-2.5 text-slate-600">
                    <p class="flex items-baseline justify-between gap-2">
                        <span class="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">🧾 Budget prévu</span>
                        <span class="text-[10px] font-bold text-slate-400 tabular-nums">{{ formatMad(rxContenu.c.budget) }} / semaine</span>
                    </p>
                    <div class="mt-2 flex flex-wrap gap-1">
                        <span v-for="(d, i) in postesVisibles(rxContenu.c)" :key="'rxp_' + i" data-rx-poste :data-depense="d.depense"
                              :title="d.depense > 0 ? formatMad(d.depense) + ' dépensés cette semaine sur ' + formatMad(d.montant) : 'Rien dépensé sur ce poste cette semaine'"
                              class="relative overflow-hidden inline-flex items-center gap-1 rounded-md bg-white ring-1 ring-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 tabular-nums">
                            <span v-if="d.depense > 0" aria-hidden="true" data-rx-poste-rempli :class="['absolute inset-y-0 left-0', d.depense > d.montant ? 'bg-rose-100' : 'bg-emerald-100']" :style="{ width: d.pct + '%' }"></span>
                            <span class="relative">{{ d.emoji }} {{ d.nom }} : <span class="font-black text-slate-800">{{ formatMad(d.montant) }}</span></span>
                        </span>
                        <button v-if="!rxTousPostes && rxContenu.c.prevu.length > 8" type="button" data-rx-plus @click.stop="deplierPostes()"
                                class="inline-flex items-center rounded-md bg-slate-200/70 hover:bg-slate-300/70 px-1.5 py-0.5 text-[10px] font-black text-slate-600">+{{ rxContenu.c.prevu.length - 8 }}</button>
                    </div>
                    <p v-if="rxContenu.c.prevuAjuste" class="mt-1.5 text-[10px] font-semibold text-slate-400 leading-snug">Ajusté à l'exception de ce mois : postes ramenés au budget de la semaine.</p>
                    <p v-if="rxContenu.c.nonVentile > 0" class="mt-1.5 text-[10px] font-semibold text-slate-400 leading-snug" data-rx-non-ventile>{{ formatMad(rxContenu.c.nonVentile) }} d'achats saisis sur « {{ rxContenu.c.label }} » sans sous-catégorie : non répartis ci-dessus.</p>
                </div>
                <!-- Les dépenses réelles de la semaine -->
                <div :class="rxContenu.c.prevu && rxContenu.c.prevu.length ? 'mt-3 pt-3 border-t border-dashed border-white/15' : 'mt-2.5'">
                    <p v-if="rxContenu.c.prevu && rxContenu.c.prevu.length" class="flex items-baseline justify-between gap-2 mb-2" data-rx-reel>
                        <span class="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">💳 Dépenses réelles de la semaine</span>
                        <span class="text-[10px] font-bold text-slate-500 tabular-nums">{{ anneau(rxContenu.c).toFixed(0) }} %</span>
                    </p>
                    <div class="h-1 rounded-full bg-white/10 overflow-hidden">
                        <div :class="['h-full rounded-full', rxContenu.c.reste < 0 ? 'bg-rose-400' : 'bg-emerald-300']" :style="{ width: anneau(rxContenu.c) + '%' }"></div>
                    </div>
                </div>
                <ul v-if="rxContenu.c.transactions.length" class="mt-2 max-h-64 overflow-y-auto divide-y divide-white/5 -mx-1 px-1">""")

sub('chaque achat dit son poste', """                            <span class="truncate font-semibold text-slate-100" data-rx-libelle>{{ t.libelle }}</span>
                            <mono-compte v-if="t.compte" :c="t.compte"></mono-compte>
                            <span v-if="t.horsCompte\"""", """                            <span class="truncate font-semibold text-slate-100" data-rx-libelle>{{ t.libelle }}</span>
                            <span v-if="t.poste" class="shrink-0 max-w-[5.5rem] truncate rounded bg-white/10 px-1 text-[9px] font-bold text-slate-300" data-rx-ligne-poste :title="t.poste">{{ t.posteEmoji }} {{ t.poste }}</span>
                            <mono-compte v-if="t.compte" :c="t.compte"></mono-compte>
                            <span v-if="t.horsCompte\"""")

for a, r in edits: src = src.replace(a, r, 1)
io.open(F, 'w', encoding='utf-8').write(src)
print(f'✔ {len(edits)} modifications appliquées à {F}')
