# -*- coding: utf-8 -*-
"""
v37.32 Memoire-Et-Alerte — deux corrections d'expérience.

  1. L'INTERFACE SE SOUVIENT. Un mois déplié dans le Calendrier pluriannuel, une
     catégorie ouverte dans le Budget Structurel, un accordéon du téléphone : tout
     se refermait au rechargement. L'état des tiroirs vit désormais dans un store
     d'interface (etatUI) enregistré dans le localStorage — PAR APPAREIL, et jamais
     dans les données financières : déplier un tiroir ne marque plus les données
     « modifiées », n'est plus envoyé au serveur, et le PC du bureau ne referme pas
     ce que le téléphone a ouvert. Sans choix enregistré, un tiroir garde son
     comportement d'avant (un panneau de périodes que le CFO vient de remplir
     s'ouvre toujours).

  2. LA MÉTÉO PRIORISE L'URGENCE. Le découvert projeté était noyé dans un
     paragraphe, pendant que la carte de droite affichait « par semaine » et
     « par jour ». Désormais :
       • un BLOC ROUGE en tête de la Météo, pour chaque compte qui finit le cycle
         dans le rouge : le compte, le montant qui manque, la date, et l'action
         de sauvetage (« Virer X depuis Y avant le Z ») ;
       • la carte « Reste à dépenser » perd ses tuiles « par semaine » et « par
         jour » (et l'explication ⓘ, les Rayons X, leur « ≈ par semaine ») ; le
         nombre de jours avant la paie rejoint la ligne « d'ici la paie ».
"""
import io, re, sys
F = 'index.html'
src = io.open(F, encoding='utf-8').read()
edits = []
def sub(label, anchor, replacement, expected=1):
    n = src.count(anchor)
    if n != expected:
        print(f'✖ {label} : {n} ancre(s), {expected} attendue(s)'); sys.exit(1)
    edits.append((anchor, replacement, expected))

# ══ 1. LE STORE D'INTERFACE (niveau module : l'app ET les composants le lisent) ══
sub('store d\'interface', r"""        const { createApp, ref, computed, watch, onMounted, onBeforeUnmount, toRaw, nextTick } = Vue;""",
    r"""        const { createApp, ref, computed, watch, onMounted, onBeforeUnmount, toRaw, nextTick, reactive } = Vue;
        /*  v37.32 — L'INTERFACE SE SOUVIENT. L'état des tiroirs et accordéons (déplié /
            replié), par APPAREIL, dans le localStorage — jamais dans les données
            financières : ni envoyé au serveur, ni partagé entre deux PC, et déplier un
            tiroir ne marque plus les données « modifiées ». Sans choix enregistré, un
            tiroir garde son comportement d'avant (`defaut`). */
        const CLE_UI = 'finance_ui_v1';
        const etatUI = reactive((() => {
            try { const o = JSON.parse(localStorage.getItem(CLE_UI) || '{}'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; }
            catch (e) { return {}; }
        })());
        watch(etatUI, () => { try { localStorage.setItem(CLE_UI, JSON.stringify(etatUI)); } catch (e) {} }, { deep: true });
        //  Lecture par `etatUI[cle]` (et non hasOwnProperty, que Vue ne suit pas) : un tiroir ouvert
        //  pour la première fois — une clé qui n'existait pas — redessine bien la page.
        const uiOuvert = (cle, defaut = false) => { const v = etatUI[cle]; return v === undefined ? !!defaut : !!v; };
        const uiBasculer = (cle, defaut = false) => { etatUI[cle] = !uiOuvert(cle, defaut); };
        const uiFixer = (cle, v) => { etatUI[cle] = !!v; };
        //  Un ref « tiroir » (booléen, tableau ou objet) relu au démarrage et réécrit à chaque changement
        const refUI = (cle, defaut) => {
            const v = Object.prototype.hasOwnProperty.call(etatUI, cle) ? etatUI[cle] : defaut;
            const r = ref(Array.isArray(defaut) ? (Array.isArray(v) ? v.slice() : defaut.slice())
                        : (defaut && typeof defaut === 'object') ? (v && typeof v === 'object' && !Array.isArray(v) ? { ...v } : { ...defaut })
                        : !!v);
            watch(r, (x) => { etatUI[cle] = Array.isArray(x) ? x.slice() : (x && typeof x === 'object' ? { ...x } : !!x); }, { deep: true });
            return r;
        };""")
sub('exports UI', r"""                        isMobile, activeMobileTab, mobileMonthOpen, toggleMobileMonth,""",
    r"""                        isMobile, activeMobileTab, mobileMonthOpen, toggleMobileMonth,
                        // v37.32 : l'interface se souvient (localStorage, par appareil)
                        uiOuvert, uiBasculer, uiFixer,""")

# ── Les tiroirs qui étaient des refs ─────────────────────────────────────────
sub('calendrier : mois dépliés', r"""                    const moisOuverts = ref([1, 4, 6, 7, 8, 9, 10, 12]);""",
    r"""                    const moisOuverts = refUI('calendrier.moisOuverts', [1, 4, 6, 7, 8, 9, 10, 12]);   // v37.32 : mémorisés""")
sub('téléphone : mois dépliés', r"""                    const mobileMonthOpen = ref({}); // accordéon détails mois""",
    r"""                    const mobileMonthOpen = refUI('mobile.moisOuverts', {}); // accordéon détails mois — v37.32 : mémorisé""")
sub('téléphone : factures', r"""                    const dropdownFacturesOpen = ref(true);""",
    r"""                    const dropdownFacturesOpen = refUI('mobile.factures', true);   // v37.32 : mémorisé""")
sub('simulateur de sortie', r"""                    const exitOpen = ref({});""",
    r"""                    const exitOpen = refUI('patrimoine.sorties', {});   // v37.32 : mémorisé""")
sub('pilotage : terminées', r"""                    const pilotageTermineOuvert = ref(false);""",
    r"""                    const pilotageTermineOuvert = refUI('pilotage.terminees', false);   // v37.32 : mémorisé""")

# ── La Météo : les postes dépliés d'une catégorie ────────────────────────────
sub('météo : postes dépliés (lecture)', r"""            data() { return { rx: null, rxEpingle: false, rxStyle: {}, rxTousPostes: false, ouvertes: {}, caseActive: null }; },""",
    r"""            data() { return { rx: null, rxEpingle: false, rxStyle: {}, rxTousPostes: false, ouvertes: { ...(etatUI['meteo.postes'] || {}) }, caseActive: null }; },""")
sub('météo : postes dépliés (écriture)', r"""                basculerOuverte(k) { this.ouvertes = { ...this.ouvertes, [k]: !this.ouvertes[k] }; this.fermer(); },""",
    r"""                basculerOuverte(k) { this.ouvertes = { ...this.ouvertes, [k]: !this.ouvertes[k] }; etatUI['meteo.postes'] = { ...this.ouvertes }; this.fermer(); },""")

# ══ 2. LE BUDGET STRUCTUREL : « détails » et « périodes » de chaque ligne ══════
#  Les drapeaux showDetails / showExceptions vivaient DANS les données (envoyées au
#  serveur). Chaque bouton et chaque panneau lit désormais le store d'interface, clé
#  « budget.<section>.<clé de la ligne>.<panneau> » ; le drapeau des données reste la
#  valeur par défaut (le CFO ouvre encore le panneau des périodes qu'il remplit).
lignes = src.split('\n')
section, n_lignes = None, 0
SECTIONS = {'revenus': 'revenus', 'chargesFixes': 'fixes', 'chargesVariables': 'variables'}
for i, l in enumerate(lignes):
    m = re.search(r'v-for="\(item, key\) in donneesAnnuelles\[anneeAffichage\]\.(revenus|chargesFixes|chargesVariables)"', l)
    if m: section = ('item', SECTIONS[m.group(1)])
    if re.search(r'v-for="\(obj, idx\) in donneesAnnuelles\[anneeAffichage\]\.epargne"', l): section = ('obj', 'epargne')
    if 'CHANGELOG' in l or not re.search(r'\b(item|obj)\.show(Details|Exceptions)\b', l) or 'label:' in l: continue
    if section is None: print('✖ drapeau hors section ligne', i + 1); sys.exit(1)
    var, nom = section
    if not re.search(r'\b' + var + r'\.show', l): print('✖ variable inattendue ligne', i + 1, var); sys.exit(1)
    def cle(panneau):
        ident = "key" if var == 'item' else "obj.id"
        return "'budget." + nom + ".' + " + ident + " + '." + panneau + "'"
    for champ, panneau in (('showDetails', 'details'), ('showExceptions', 'periodes')):
        c, dft = cle(panneau), var + '.' + champ
        l = re.sub(re.escape(var) + r'\.' + champ + r' = !' + re.escape(var) + r'\.' + champ + r'(; handleDataChange\(\))?',
                   'uiBasculer(' + c + ', ' + dft + ')', l)
        l = re.sub(r'v-if="' + re.escape(var) + r'\.' + champ + '"', 'v-if="uiOuvert(' + c.replace('"', '&quot;') + ', ' + dft + ')"', l)
        l = re.sub(r'\{\{ ' + re.escape(var) + r'\.' + champ + r' \?', '{{ uiOuvert(' + c + ', ' + dft + ') ?', l)
    if re.search(r'(?<!, )\b(item|obj)\.show(Details|Exceptions)\b(?!\))', l): print('✖ drapeau non converti ligne', i + 1, l.strip()[:120]); sys.exit(1)
    lignes[i] = l; n_lignes += 1
if n_lignes != 30: print('✖ Budget Structurel :', n_lignes, 'lignes, 30 attendues'); sys.exit(1)
src = '\n'.join(lignes)

# ══ 3. LES ACCORDÉONS <details> : chacun sa clé ═════════════════════════════
DETAILS = [
    ('<details class="shrink-0 bg-white border-t border-slate-100">', 'cfo.limites', 'false'),
    ('<details class="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">\n                                <summary class="px-4 py-2.5 cursor-pointer text-[11px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-100 select-none">\n                                    🩹', 'simulateur.debitATort', 'false'),
    ('<details v-if="sandboxDecomposition && !sandboxDecomposition.sansBudget" class="rounded-2xl', 'simulateur.decomposition', 'false'),
    ('<details v-if="Array.isArray(row.detailsIrreg) && row.detailsIrreg.length > 0" class="border-t border-gray-100">', "'releve.flux.' + (row.mois || idx)", 'false'),
    ('<details class="mb-4 rounded-2xl border-2 overflow-hidden" :class="auditFinancier.scoreGlobal', 'audit', 'false'),
    ('<details open class="bg-white rounded-2xl border border-gray-200 shadow-sm mb-3 overflow-hidden">', 'mobile.boussole', 'true'),
    ('<details class="bg-white rounded-2xl border-l-4 border-green-500 border border-gray-200 shadow-sm mb-3 overflow-hidden">', 'mobile.revenus', 'false'),
    ('<details class="bg-white rounded-2xl border-l-4 border-orange-500 border border-gray-200 shadow-sm mb-3 overflow-hidden">', 'mobile.fixes', 'false'),
    ('<details class="bg-white rounded-2xl border-l-4 border-red-500 border border-gray-200 shadow-sm mb-3 overflow-hidden">', 'mobile.variables', 'false'),
    ('<details class="bg-white rounded-2xl border-l-4 border-purple-500 border border-gray-200 shadow-sm mb-3 overflow-hidden">', 'mobile.epargne', 'false'),
    ('<details v-if="!isCyclePasse && atterrissageCycle.comptes.length" data-comptes-cycle class="', 'pilotage.comptesCycle', 'false'),
    ('<details class="bg-slate-800 rounded-2xl border border-green-800/50 overflow-hidden text-left shadow-lg">', 'pilotage.entrees', 'false'),
    ('<details class="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden text-left shadow-lg">', 'pilotage.categories', 'false'),
]
for ancre, cle, dft in DETAILS:
    c = cle if cle.startswith("'") else "'" + cle + "'"
    att = ' :open="uiOuvert(' + c + ', ' + dft + ')" @toggle="uiFixer(' + c + ', $event.target.open)"'
    nouveau = ancre.replace('<details open ', '<details ').replace('<details', '<details' + att, 1)
    sub('accordéon ' + cle, ancre, nouveau)
#  Les deux accordéons gris du simulateur (le « paramètres avancés », plus bas, partage la classe)
sub('accordéon simulateur.avances', r"""<details class="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
                                <summary class="px-4 py-2.5 cursor-pointer text-[11px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-100 select-none">⚙️""", r"""<details :open="uiOuvert('simulateur.avances', false)" @toggle="uiFixer('simulateur.avances', $event.target.open)" class="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
                                <summary class="px-4 py-2.5 cursor-pointer text-[11px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-100 select-none">⚙️""")
#  Les deux derniers accordéons blancs du téléphone (🏦 comptes, 🛠️ outils) partagent leur classe
sub('accordéons mobile.comptes / outils', r"""<details class="bg-white rounded-2xl border border-gray-200 shadow-sm mb-3 overflow-hidden">""",
    r"""<details :open="uiOuvert('mobile.' + 'ACCORDEON', false)" @toggle="uiFixer('mobile.' + 'ACCORDEON', $event.target.open)" class="bg-white rounded-2xl border border-gray-200 shadow-sm mb-3 overflow-hidden">""", expected=2)

# ══ 4. LA MÉTÉO : le découvert en tête, plus de « par semaine » / « par jour » ══
sub('météo : les comptes à découvert', r"""                        return {
                            etat, icone, titre, raison, conseil,
                            rav, parJour, parSemaine, jours, cash, siRav,""",
    r"""                        /*  v37.32 — CHAQUE COMPTE QUI FINIT LE CYCLE DANS LE ROUGE, avec son action
                            de sauvetage : le montant qui manque, le compte d'où le virer (celui
                            qu'indique le radar, sinon celui qui atterrit le plus haut et couvre
                            l'écart), et la date limite (le jour où le solde passe sous zéro). */
                        const decouverts = (() => {
                            const a = atterrissageCycle.value, rp = radarParCle.value;
                            const rouges = (a.comptes || []).filter(c => c.atterrissage < 0 && (c.courant || c.reel));
                            return rouges.map(c => {
                                const manque = Math.ceil(-c.atterrissage);
                                const r = rp[c.key] || null;
                                let depuis = r && r.donneur ? r.donneur.key : null;
                                if (!depuis) {
                                    const d = (a.comptes || []).filter(x => x.key !== c.key && x.atterrissage >= manque).sort((x, y) => y.atterrissage - x.atterrissage)[0];
                                    depuis = d ? d.key : null;
                                }
                                return {
                                    key: c.key, compte: infoCompte(c.key), manque, date: A.dateFin, courant: !!c.courant,
                                    avantLe: r && r.aVirer > 0 ? r.avantLe : A.dateFin,
                                    depuis: depuis ? infoCompte(depuis) : null,
                                    //  Le courant : ce découvert suppose TOUT le budget conso dépensé ;
                                    //  s'en tenir au Reste à dépenser l'évite-t-il ?
                                    evitable: !!c.courant && rav > 0 && siRav !== null && siRav >= -1,
                                };
                            }).sort((x, y) => y.manque - x.manque);
                        })();
                        return {
                            etat, icone, titre, raison, conseil, decouverts,
                            rav, parJour, parSemaine, jours, cash, siRav,""")
#  Le gabarit : le bloc rouge, en tête, avant tout le reste
sub('météo : bloc découvert', r"""    <div class="relative grid grid-cols-1 gap-2.5 md:gap-x-6 md:gap-y-5 md:grid-cols-2 md:grid-rows-[auto_1fr] items-start">
        <!-- Le verdict -->""", r"""    <!-- 🚨 v37.32 : LE DÉCOUVERT D'ABORD — quel compte, combien, et comment le sauver -->
    <div v-if="meteo.decouverts && meteo.decouverts.length && !meteo.retro" data-meteo-decouvert role="alert"
         class="relative mb-3 md:mb-5 rounded-2xl bg-rose-600 ring-2 ring-white/80 shadow-lg shadow-rose-950/40 p-3 md:p-4">
        <p class="text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] text-white">🚨 Découvert projeté — fin de cycle le {{ meteo.dateFin }}</p>
        <div v-for="d in meteo.decouverts" :key="'dec_' + d.key" data-meteo-decouvert-compte :data-compte="d.key"
             class="mt-2.5 first:mt-2 grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.5fr)] items-center gap-x-3 gap-y-2">
            <p class="min-w-0 flex items-center gap-2">
                <mono-compte :c="d.compte" grand></mono-compte>
                <span class="min-w-0 truncate text-lg md:text-2xl font-black" :title="d.compte.label" data-meteo-decouvert-nom>{{ d.compte.tag }}</span>
            </p>
            <p class="text-right tabular-nums leading-none whitespace-nowrap" data-meteo-decouvert-montant>
                <span class="text-3xl md:text-4xl font-black tracking-tight">− {{ chiffre(d.manque) }}</span>
                <span class="text-sm md:text-base font-black text-white/75">DH</span>
            </p>
            <div class="col-span-2 md:col-span-1 min-w-0">
                <p class="rounded-xl bg-white text-rose-700 px-3 py-2 text-xs md:text-sm font-black leading-snug shadow-sm" data-meteo-sauvetage>
                    <template v-if="d.depuis">➜ Virer {{ formatMad(d.manque) }} depuis <mono-compte :c="d.depuis" class="align-[-2px]"></mono-compte> {{ d.depuis.tag }} avant le {{ d.avantLe }}</template>
                    <template v-else>➜ Il manque {{ formatMad(d.manque) }} avant le {{ d.avantLe }} : aucun compte ne le couvre seul — reportez une charge ou apportez des fonds.</template>
                </p>
                <p v-if="d.evitable" class="mt-1 text-[11px] font-bold text-white/90 leading-snug" data-meteo-decouvert-evitable>ou : tenez-vous au Reste à dépenser — ce découvert suppose tout le budget conso dépensé.</p>
            </div>
        </div>
    </div>
    <div class="relative grid grid-cols-1 gap-2.5 md:gap-x-6 md:gap-y-5 md:grid-cols-2 md:grid-rows-[auto_1fr] items-start">
        <!-- Le verdict -->""")
#  Le paragraphe ne répète plus ce que dit le bloc rouge
sub('météo : raison et conseil quand le bloc parle', r"""                <p class="mt-1 md:mt-1.5 text-xs md:text-sm font-semibold text-white/90 leading-snug line-clamp-2 md:line-clamp-none" data-meteo-raison>{{ meteo.raison }}</p>
                <p class="mt-1.5 md:mt-2 text-xs md:text-sm font-black text-white leading-snug" data-meteo-conseil>👉 {{ meteo.conseil }}</p>
                <p v-if="meteo.logistique" """, r"""                <template v-if="!(meteo.decouverts && meteo.decouverts.length && !meteo.retro)">
                <p class="mt-1 md:mt-1.5 text-xs md:text-sm font-semibold text-white/90 leading-snug line-clamp-2 md:line-clamp-none" data-meteo-raison>{{ meteo.raison }}</p>
                <p class="mt-1.5 md:mt-2 text-xs md:text-sm font-black text-white leading-snug" data-meteo-conseil>👉 {{ meteo.conseil }}</p>
                </template>
                <p v-else class="mt-1 md:mt-1.5 text-xs md:text-sm font-semibold text-white/90 leading-snug" data-meteo-raison>{{ meteo.decouverts.length > 1 ? meteo.decouverts.length + ' comptes finissent le cycle dans le rouge' : 'Un compte finit le cycle dans le rouge' }} : le virement ci-dessus l’évite.</p>
                <p v-if="meteo.logistique && !(meteo.decouverts && meteo.decouverts.length)" """)
#  La carte « Reste à dépenser » : plus de tuiles « par semaine » / « par jour »
sub('carte : tuiles retirées', r"""            <!-- Le rythme : ce que ce reste veut dire, sans dater un seul ticket -->
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
""", "")
sub('carte : jours avant la paie', r"""                d'ici la paie du {{ p.paie }}<span v-if""",
    r"""                d'ici la paie du {{ p.paie }} <span class="whitespace-nowrap" data-liberte-jours>(dans {{ p.jours }} j)</span><span v-if""")
sub('ⓘ : plus de « par semaine »', r"""                <p class="mt-1 text-[10px] font-semibold text-slate-400">÷ {{ p.jours }} jours avant la paie × 7 ≈ {{ formatMad(p.parSemaine) }} par semaine.</p>
""", "")
sub('rayons x : plus de « par semaine »', r"""<span class="text-slate-400"><template v-if="rxContenu.c.resteReel > 0">≈ {{ formatMad(rxContenu.c.parSemaineReel) }} / sem. d'ici la paie</template><template v-else>Plus rien à dépenser ici</template></span>""",
    r"""<span class="text-slate-400">{{ rxContenu.c.resteReel > 0 ? 'Ce cycle' : 'Plus rien à dépenser ici' }}</span>""")

for a, r, n in edits: src = src.replace(a, r, n)
#  Les deux accordéons blancs du téléphone : 🏦 comptes puis 🛠️ outils, dans l'ordre
for nom in ('comptes', 'outils'):
    src = src.replace("'mobile.' + 'ACCORDEON'", "'mobile." + nom + "'", 2)
if 'ACCORDEON' in src: print('✖ accordéon mobile non nommé'); sys.exit(1)
io.open(F, 'w', encoding='utf-8').write(src)
print(f'✔ {len(edits)} modifications + {n_lignes} lignes du Budget Structurel appliquées à {F}')
