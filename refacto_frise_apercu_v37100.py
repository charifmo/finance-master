#!/usr/bin/env python3
"""v37.100 — LA FRISE S'OUVRE SUR LE JOURNAL : un clic sur une case (ou une enveloppe) montre les opérations
   saisies derrière ce chiffre (le poste, sur ce morceau de semaine ou sur le cycle), chacune modifiable ou
   supprimable sur place — les mêmes fonctions que le Journal."""
import io, sys
F = 'index.html'
src = io.open(F, encoding='utf-8').read()
def sub(label, old, new):
    global src
    c = src.count(old)
    if c != 1: print(f'✖ {label} : {c} ancre(s), 1 attendue'); sys.exit(1)
    src = src.replace(old, new)

# 1. le calcul : chaque case connaît son poste et ses dates
sub('cellule : dates', "return { prevu, reel, auPrevu, etat: m.etat, avenir: m.etat === 'avenir' && !tape && tk <= 0, encours: m.etat === 'encours', depasse: reel > prevu + 0.5, part: m.part, titre: m.titre };",
    "return { prevu, reel, auPrevu, etat: m.etat, avenir: m.etat === 'avenir' && !tape && tk <= 0, encours: m.etat === 'encours', depasse: reel > prevu + 0.5, part: m.part, titre: m.titre, du: m.debut, au: m.fin, saisi: tape ? Math.round(sai) : null, defaut };")
sub('ligne hebdo : poste', "if (hebdo.length) hebdo.forEach(p => lignes.push({ cle: p.cle, nom: p.nom, emoji: p.emoji, unite: 'semaine', cellules:",
    "if (hebdo.length) hebdo.forEach(p => lignes.push({ cle: p.cle, nom: p.nom, emoji: p.emoji, unite: 'semaine', catKey: c.key, catId: p.categorieId || null, cellules:")
sub('ligne catégorie : poste', "else if (!(c.prevu || []).length) lignes.push({ cle: c.key, nom: c.label, emoji: '', unite: 'semaine', cellules:",
    "else if (!(c.prevu || []).length) lignes.push({ cle: c.key, nom: c.label, emoji: '', unite: 'semaine', catKey: c.key, catId: null, cellules:")
sub('ligne enveloppe : poste', "lignes.push({ cle: p.cle, nom: p.nom, emoji: p.emoji, unite: p.unite, enveloppe: p.cyclePrevu,",
    "lignes.push({ cle: p.cle, nom: p.nom, emoji: p.emoji, unite: p.unite, catKey: c.key, catId: p.categorieId || null, du: _ymd(debut), au: _ymd(fin), saisi: morceaux.reduce((s, m) => s + (Object.prototype.hasOwnProperty.call(m.vals, p.cle) ? Number(m.vals[p.cle] || 0) : 0), 0), enveloppe: p.cyclePrevu,")

JS = r"""
                    /*  v37.100 — UNE CASE DE LA FRISE → LES OPÉRATIONS DERRIÈRE CE CHIFFRE (modifier, supprimer sur place). */
                    const apercuFrise = ref(null);
                    const _libJourFrise = (iso) => { const p = String(iso || '').split('-').map(Number); return p[2] ? p[2] + ' ' + _MOIS_COURTS[p[1] - 1] : '?'; };
                    const ouvrirApercuFrise = (c, l, x) => {
                        if (!c || !l) return;
                        const du = x ? x.du : l.du, au = x ? x.au : l.au;
                        if (!du || !au) return;
                        journal.ouvert = null; journal.brouillon = null; journal.confirmerSuppression = null;
                        apercuFrise.value = { catKey: l.catKey || c.key, catId: l.catId || null, cle: l.cle, nom: l.nom, emoji: l.emoji || '', catLabel: c.label, du, au,
                                              periode: du === au ? 'le ' + _libJourFrise(du) : 'du ' + _libJourFrise(du) + ' au ' + _libJourFrise(au), parCycle: !x,
                                              reel: x ? x.reel : l.engage, prevu: x ? x.prevu : l.enveloppe, saisi: x ? x.saisi : (l.saisi || null), auPrevu: x ? x.auPrevu : false, defaut: x ? x.defaut : 0 };
                    };
                    const fermerApercuFrise = () => { apercuFrise.value = null; journal.ouvert = null; journal.brouillon = null; journal.confirmerSuppression = null; };
                    const apercuFriseOps = computed(() => {
                        calculationTick.value;
                        const A = apercuFrise.value;
                        if (!A) return { ops: [], total: 0 };
                        const d = donneesAnnuelles.value[consoT0Annee.value] || {}, cvs = d.chargesVariables || {};
                        const carte = {};
                        Object.entries(cvs).forEach(([key, cv]) => {
                            if (!cv || cv.categorieId === 'cat_cv_factures') return;
                            if (cv.categorieId) carte[cv.categorieId] = key;
                            (cv.details || []).forEach(det => { if (det && det.categorieId) carte[det.categorieId] = key; });
                        });
                        const mere = (cvs[A.catKey] || {}).categorieId;
                        const parPoste = A.catId && A.catId !== mere;
                        const ops = [];
                        Object.values(donneesAnnuelles.value || {}).forEach(a => {
                            (a && Array.isArray(a.transactionsReelles) ? a.transactionsReelles : []).forEach(t => {
                                const dt = String(t.date || '').slice(0, 10);
                                if (!t || !dt || dt < A.du || dt > A.au || carte[t.categorieId] !== A.catKey) return;
                                if (parPoste && t.categorieId !== A.catId) return;
                                const heure = String(t.datetime || '').slice(11, 16);
                                ops.push({ t, quand: _libJourFrise(dt) + (heure && heure !== '12:00' ? ' · ' + heure : ''), montant: Number(t.montant) || 0,
                                           compte: ((comptes.value || []).find(c => String(c.id) === String(t.compteId)) || {}).label || 'sans compte',
                                           cat: t.categorieId && t.categorieId !== A.catId ? _libCat(t.categorieId) : '' });
                            });
                        });
                        ops.sort((x, y) => String(y.t.datetime || y.t.date).localeCompare(String(x.t.datetime || x.t.date)));
                        return { ops, total: Math.round(ops.reduce((s, o) => s + o.montant, 0) * 100) / 100 };
                    });
                    const apercuVersJournal = () => {
                        const A = apercuFrise.value; if (!A) return;
                        const d = donneesAnnuelles.value[consoT0Annee.value] || {};
                        journal.cat = A.catId || ((d.chargesVariables || {})[A.catKey] || {}).categorieId || '';
                        journal.q = ''; journal.periode = 'cycle'; journal.vue = 'date';
                        fermerApercuFrise(); friseOuverte.value = false;
                        appMode.value = 'reel'; activeTab.value = 'saisie';
                    };
"""
sub('JS : après friseCycle', "                    const friseCycle = computed(() => friseOuverte.value ? _friseCalc.value : null);\n",
    "                    const friseCycle = computed(() => friseOuverte.value ? _friseCalc.value : null);\n" + JS)
sub('frise fermée : aperçu fermé', """<div v-if="friseOuverte && friseCycle" data-frise class="fixed inset-0 bg-black/50 z-[10000] flex items-center justify-center p-2 md:p-4" @click.self="friseOuverte = false">""",
    """<div v-if="friseOuverte && friseCycle" data-frise class="fixed inset-0 bg-black/50 z-[10000] flex items-center justify-center p-2 md:p-4" @click.self="friseOuverte = false; fermerApercuFrise()">""")
sub('sous-titre', """Chaque case : réel / prévu""", """Chaque case : réel / prévu — touchez-la pour voir ce qui a été saisi""")

# 2. les cases et les enveloppes deviennent cliquables
sub('case cliquable', """<span v-for="(x, i) in l.cellules" :key="'fx' + i" data-frise-case """,
    """<span v-for="(x, i) in l.cellules" :key="'fx' + i" data-frise-case role="button" tabindex="0" @click="ouvrirApercuFrise(c, l, x)" @keydown.enter="ouvrirApercuFrise(c, l, x)" """)
sub('case : curseur', """:class="['h-6 flex items-center justify-center text-[9px] md:text-[10px] font-bold tabular-nums border-r border-white leading-none',""",
    """:class="['h-6 flex items-center justify-center text-[9px] md:text-[10px] font-bold tabular-nums border-r border-white leading-none cursor-pointer hover:brightness-95 hover:ring-2 hover:ring-inset hover:ring-blue-400',""")
sub('enveloppe cliquable', """<div class="relative h-6 rounded-md bg-slate-100 ring-1 ring-slate-200 overflow-hidden" :title="l.engage + ' / ' + l.enveloppe + ' DH sur le cycle'">""",
    """<div data-frise-enveloppe role="button" tabindex="0" @click="ouvrirApercuFrise(c, l, null)" @keydown.enter="ouvrirApercuFrise(c, l, null)" class="relative h-6 rounded-md bg-slate-100 ring-1 ring-slate-200 overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-400" :title="l.engage + ' / ' + l.enveloppe + ' DH sur le cycle — touchez pour voir ce qui a été saisi'">""")

# 3. le panneau
PANNEAU = """        <!-- v37.100 : ce qui a été saisi derrière une case de la frise — modifiable et supprimable sur place -->
        <div v-if="friseOuverte && apercuFrise" data-frise-apercu class="fixed inset-0 z-[10001] bg-black/30 flex items-end md:items-center justify-center p-0 md:p-4" @click.self="fermerApercuFrise()">
            <div class="bg-white w-full md:max-w-lg rounded-t-3xl md:rounded-2xl shadow-2xl max-h-[85vh] flex flex-col">
                <div class="flex items-start gap-3 px-4 py-3 border-b border-slate-100">
                    <div class="min-w-0 flex-1">
                        <p class="text-sm font-black text-slate-800 truncate" data-frise-apercu-titre>{{ apercuFrise.emoji }} {{ apercuFrise.nom }} <span class="text-slate-400 font-bold">· {{ apercuFrise.catLabel }}</span></p>
                        <p class="text-[11px] font-semibold text-slate-500">{{ apercuFrise.parCycle ? 'Tout le cycle, ' : '' }}{{ apercuFrise.periode }} · compté {{ formatMAD(apercuFrise.reel) }} pour {{ formatMAD(apercuFrise.prevu) }} prévus</p>
                    </div>
                    <button type="button" data-frise-apercu-fermer @click="fermerApercuFrise()" aria-label="Fermer" class="shrink-0 w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 font-black text-slate-700">✕</button>
                </div>
                <div class="overflow-y-auto px-3 py-2 space-y-1.5">
                    <p v-if="apercuFrise.saisi" data-frise-apercu-saisi class="rounded-lg bg-sky-50 ring-1 ring-sky-200 px-2.5 py-1.5 text-[11px] font-bold text-sky-900">✍️ Saisi pour la semaine, sans date : {{ formatMAD(apercuFrise.saisi) }} — se corrige dans la Météo (✎ de la semaine).</p>
                    <p v-if="apercuFrise.auPrevu" data-frise-apercu-auprevu class="rounded-lg bg-emerald-50 ring-1 ring-emerald-200 px-2.5 py-1.5 text-[11px] font-bold text-emerald-900">Rien n'a été tapé sur ce morceau : il compte au prévu ({{ formatMAD(apercuFrise.defaut) }}).</p>
                    <p v-if="!apercuFriseOps.ops.length" data-frise-apercu-vide class="px-1 py-3 text-xs font-semibold text-slate-500 text-center">Aucune opération dans le journal pour ce poste, {{ apercuFrise.periode }}.</p>
                    <div v-for="o in apercuFriseOps.ops" :key="'fa_' + o.t.id" data-frise-apercu-op :data-tx="o.t.id" :class="['rounded-xl border', journal.ouvert === o.t.id ? 'border-blue-300 bg-blue-50/40' : 'border-slate-200']">
                        <button type="button" data-frise-apercu-ouvrir @click="ouvrirOperation(o.t.id)" class="w-full text-left px-2.5 py-2 flex items-start gap-2">
                            <span class="flex-1 min-w-0">
                                <span class="block text-xs font-bold text-slate-900 truncate">{{ o.t.libelle || '(sans libellé)' }}</span>
                                <span class="block text-[10px] font-semibold text-slate-500">{{ o.quand }} · {{ o.compte }}{{ o.cat ? ' · ' + o.cat : '' }}{{ o.t.source ? ' · ' + o.t.source : '' }}</span>
                            </span>
                            <span class="text-xs font-black tabular-nums text-red-600 whitespace-nowrap">−{{ formatMAD(o.montant) }}</span>
                            <span class="text-[11px] text-slate-400">{{ journal.ouvert === o.t.id ? '▴' : '✏️' }}</span>
                        </button>
                        <div v-if="journal.ouvert === o.t.id && journal.brouillon" data-frise-apercu-edition class="px-2.5 pb-2.5 pt-1 border-t border-blue-100 space-y-2">
                            <div class="grid grid-cols-2 gap-2">
                                <label class="col-span-2 text-[10px] font-black uppercase tracking-wider text-gray-500">Libellé
                                    <input type="text" data-frise-edit-libelle v-model="journal.brouillon.libelle" class="mt-0.5 w-full text-xs font-bold px-2 py-1.5 rounded-lg border border-gray-200 bg-white outline-none focus:border-blue-400 normal-case tracking-normal"/></label>
                                <label class="text-[10px] font-black uppercase tracking-wider text-gray-500">Montant (DH)
                                    <input type="number" inputmode="decimal" step="0.01" min="0" data-frise-edit-montant v-model="journal.brouillon.montant" class="mt-0.5 w-full text-xs font-bold px-2 py-1.5 rounded-lg border border-gray-200 bg-white outline-none focus:border-blue-400"/></label>
                                <label class="text-[10px] font-black uppercase tracking-wider text-gray-500">Date
                                    <input type="datetime-local" data-frise-edit-date v-model="journal.brouillon.datetime" class="mt-0.5 w-full text-xs font-bold px-2 py-1.5 rounded-lg border border-gray-200 bg-white outline-none focus:border-blue-400"/></label>
                                <label class="text-[10px] font-black uppercase tracking-wider text-gray-500">Catégorie
                                    <select data-frise-edit-cat v-model="journal.brouillon.categorieId" class="mt-0.5 w-full text-xs font-bold px-2 py-1.5 rounded-lg border border-gray-200 bg-white outline-none focus:border-blue-400 normal-case tracking-normal">
                                        <option value="">À catégoriser</option>
                                        <option v-if="journal.brouillon.categorieId && !categoriesPourRanger.some(g => g.items.some(c => c.id === journal.brouillon.categorieId))" :value="journal.brouillon.categorieId">{{ getCategorieLabel(journal.brouillon.categorieId) || journal.brouillon.categorieId }}</option>
                                        <optgroup v-for="g in categoriesPourRanger" :key="'fae_' + g.label" :label="g.label"><option v-for="c in g.items" :key="'faec_' + c.id" :value="c.id">{{ c.label }}</option></optgroup>
                                    </select></label>
                                <label class="text-[10px] font-black uppercase tracking-wider text-gray-500">Compte
                                    <select data-frise-edit-compte v-model="journal.brouillon.compteId" class="mt-0.5 w-full text-xs font-bold px-2 py-1.5 rounded-lg border border-gray-200 bg-white outline-none focus:border-blue-400 normal-case tracking-normal">
                                        <option value="">Sans compte</option>
                                        <option v-for="c in journalComptes" :key="'faeo_' + c.id" :value="String(c.id)">{{ c.label }}</option>
                                    </select></label>
                            </div>
                            <div class="flex items-center gap-2">
                                <button type="button" data-frise-apercu-supprimer @click="supprimerOperation(o.t.id)" :class="['mr-auto px-2.5 py-1.5 rounded-lg text-[11px] font-black', journal.confirmerSuppression === o.t.id ? 'bg-red-600 text-white' : 'text-red-700 bg-red-50 hover:bg-red-100']">{{ journal.confirmerSuppression === o.t.id ? 'Confirmer la suppression' : '🗑️ Supprimer' }}</button>
                                <button type="button" data-frise-apercu-enregistrer @click="enregistrerOperation()" class="px-3 py-1.5 rounded-lg text-[11px] font-black text-white bg-blue-600 hover:bg-blue-700">✓ Enregistrer</button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="px-3 py-2.5 border-t border-slate-100 flex items-center gap-2">
                    <span class="mr-auto text-[11px] font-black text-slate-600 tabular-nums" data-frise-apercu-total>{{ apercuFriseOps.ops.length }} opération{{ apercuFriseOps.ops.length > 1 ? 's' : '' }} · {{ formatMAD(apercuFriseOps.total) }}</span>
                    <button type="button" data-frise-apercu-journal @click="apercuVersJournal()" class="px-3 py-1.5 rounded-lg text-[11px] font-black text-slate-700 bg-slate-100 hover:bg-slate-200">📋 Voir dans le Journal</button>
                </div>
            </div>
        </div>

        <!-- v17.31 : Modale Relevé de Compte -->"""
sub('panneau', "        <!-- v17.31 : Modale Relevé de Compte -->", PANNEAU)

sub('exports', "recalibrerAnnee, annulerRecalibrage, lignesRecalibrage,",
    "recalibrerAnnee, annulerRecalibrage, lignesRecalibrage, apercuFrise, ouvrirApercuFrise, fermerApercuFrise, apercuFriseOps, apercuVersJournal,")
io.open(F, 'w', encoding='utf-8').write(src)
print('✔ index.html : frise → aperçu du journal')
