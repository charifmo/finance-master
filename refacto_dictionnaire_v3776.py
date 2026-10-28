#!/usr/bin/env python3
"""v37.76 — UN DICTIONNAIRE PLUS RICHE, QUI APPREND VOS VARIANTES · LA FRISE DU CYCLE EN VUE.

« Rends le dictionnaire de la saisie beaucoup plus riche pour éviter de trop utiliser les tokens :
  tout à l'heure il n'a pas su ajouter Carrefour à Supermarché ! Et une fois que je corrige quelque chose
  de l'IA ou quelque chose de suspendu, il ajoute ça au dictionnaire sous variantes. »

  1. « carrefour » était bien traduit vers « supermarche »… qui touchait DEUX de vos lignes par le début
     du mot (« Super marché » et une autre ligne « Super marché … » dans une autre catégorie) : ex aequo, note 67, sous le seuil — doute, donc
     l'IA. La ligne dont le libellé s'écrit EXACTEMENT comme le mot du dictionnaire (« Super marché » =
     « supermarche », espaces ôtés) passe désormais devant : rangé, sûr, sans IA.
  2. Le dictionnaire s'enrichit : enseignes du Maroc (supermarchés, mode, maison, sport, voyages,
     abonnements, IA, bébé, jouets…), variantes darija, libellés bancaires tronqués (« LAB D AN… »).
  3. VOS VARIANTES : une correction (journal, « À catégoriser »), une opération en suspens validée
     telle quelle, une réponse SÛRE de l'IA — le commerçant (premier mot qui le nomme) entre au
     dictionnaire, vers votre catégorie. « Carrefour Market Gueliz » profite de « carrefour » appris,
     même si l'opération d'origine est supprimée. Votre correction l'emporte toujours sur l'IA ;
     chaque variante est visible et oubliable dans « Ce que l'appli a appris ».
  4. Une opération en suspens (import bancaire) enregistrée sans changer sa catégorie est validée.

« Le bouton pour accéder au visualiseur de cycle et semaines doit être visible. »
  5. « 📈 Cycle et semaines » en bouton dans l'en-tête du Pilotage, et un vrai bouton dans la Météo.
"""
import io, sys

F = 'index.html'
src = io.open(F, encoding='utf-8').read()
def sub(label, old, new):
    global src
    c = src.count(old)
    if c != 1:
        print(f'✖ {label} : {c} ancre(s), 1 attendue'); sys.exit(1)
    src = src.replace(old, new)

# ── 1. La ligne qui s'écrit exactement comme le mot du dictionnaire ─────────────
sub('cible : forme collée',
"""                        let hits = cats.filter(c => c.phrase === n);                                      // le libellé entier
""",
"""                        let hits = cats.filter(c => c.phrase === n);                                      // le libellé entier
                        //  v37.76 : la même chose, espaces ôtés — « Super marché » EST « supermarche » ; « Super marché … » d’une autre catégorie
                        //  ne l'est pas (avant, les deux répondaient par le début du mot : ex aequo, doute, l'IA)
                        if (!hits.length) { const nc = n.replace(/ /g, ''); hits = cats.filter(c => c.phrase.replace(/ /g, '') === nc); }
""")

# ── 2. Le dictionnaire enrichi ─────────────────────────────────────────────────
sub('dictionnaire enrichi',
"""                    const _DICO = DICO_CATEGORIES.map((r, i) => {""",
"""                    //  v37.76 — LE DICTIONNAIRE ENRICHI : enseignes du Maroc, variantes darija, libellés bancaires tronqués.
                    //  Chaque entrée complète le thème qui porte ce début de titre (m = mots, k = enseignes, même collées).
                    const DICO_ENRICHI = {
                        '🛒 Courses': { m: 'carrefour market|carrefour express|marjane market|marjane|carrefour|bim|acima|kazyon|aswak|aswak assalam|label vie|labelvie|atacadao|hanouti|supermarket|grocery|moul hanout|mol hanout|mul hanout|7anout|super marche|hyper|hyper marche|مرجان|كارفور|بيم|اسواق السلام|حانوت',
                                        k: 'carrefourmarket|carrefourexpress|marjanemarket|kazyon|aswak|hanouti|labelvie' },
                        '🍔 Fast-food': { m: 'jumia food|chicken|shawarma|chawarma|panini|sandwich|sandwichs|snack|bocadillo|crepe|crepes|crep|pizzeria|burger house|nuggets|frites|hot dog|شوارما|سندويتش|بيتزا',
                                          k: 'jumiafood|burgerhouse' },
                        '🍽️ Restaurant': { m: 'tajine|tagine|tanjia|rotisserie|grillade|mechoui|trattoria|steakhouse|fruits de mer|طاجين|طنجية|مشوي' },
                        '☕ Café': { m: 'jus|juice|smoothie|milkshake|the a la menthe|caffe|coffee|columbus|tim hortons|dunkin|عصير',
                                    k: 'columbus|timhortons|dunkin' },
                        '👕 Vêtements': { m: 'h&m|mango|lc waikiki|waikiki|defacto|max fashion|celio|jules|shein|chaussure|chaussures|sbbat|sebbat|sabbat|jean|jeans|veste|pantalon|chemise|robe|jellaba|djellaba|caftan|kaftan|babouche|babouches|حوايج|سباط|جلابة|قفطان',
                                          k: 'lcwaikiki|maxfashion|celio|shein' },
                        '🏋️ Sport': { m: 'decathlon|intersport|go sport|nike|adidas|puma|abonnement salle',
                                      k: 'decathlon|intersport|gosport|adidas' },
                        '🛋️ Maison': { m: 'mr bricolage|virgin|darty|electromenager|electro menager|meuble|meubles|tapis|zarbiya|zerbiya|vaisselle|quincaillerie|droguerie|peinture|plombier|plomberie|electricien|serrurier|ampoule|matelas|rideaux|زربية|ماطلة',
                                       k: 'mrbricolage|virginmegastore|darty' },
                        '📱 Téléphone': { m: 'orange maroc|orange ma|iam|maroc telecom|itissalat|inwi|recharge|jawal|forfait|pass internet|اتصالات|انوي|اورونج',
                                          k: 'orangemaroc|maroctelecom|inwi' },
                        '📺 Abonnements': { m: 'spotify|deezer|anghami|youtube premium|disney|disney plus|shahid|osn|starzplay|amazon prime|prime video|apple music|apple com|apple tv|icloud|google one|google play|google storage|play store|app store|canal plus|beinsports|bein sports|abonnement|شاهد',
                                            k: 'spotify|anghami|shahid|starzplay|primevideo|icloud|googleplay|googleone|appstore|applecom|beinsports|canalplus' },
                        '🤖 IA': { m: 'openai|anthropic|claude|claude ai|midjourney|copilot|gemini|perplexity|cursor|github|notion|canva|adobe',
                                   k: 'openai|anthropic|midjourney|perplexity|copilot|github|canva' },
                        '🔬 Analyses': { m: 'lab|labo d analyses|laboratoire d analyses|biologie|biologiste|bilan sanguin' },
                        '💊 Pharmacie': { m: 'parapharmacie|parapharma|para pharmacie|pharmacie de garde|pharmacien|فرمسيان|صيدلية' },
                        '✈️ Voyage': { m: 'royal air maroc|ram|airbnb|booking|booking com|hotel|riad|ryanair|air arabia|easyjet|transavia|expedia|agoda|vueling|valise|visa|فندق|رياض',
                                       k: 'airbnb|bookingcom|ryanair|airarabia|easyjet|transavia|expedia|agoda|vueling|royalairmaroc' },
                        '🧸 Jouets': { m: 'toys r us|toysrus|lego|playmobil|king jouet|jouet|jouets|poupee|لعب', k: 'toysrus|kingjouet|playmobil' },
                        '🍼 Bébé': { m: 'pampers|couche|couches|lait bebe|lait infantile|bledina|nido|aptamil|guigoz|mustela|chicco|biberon|lingettes|حفاضات',
                                     k: 'pampers|aptamil|guigoz|mustela|chicco|bledina' },
                        '🎁 Cadeaux': { m: 'cadeau|cadeaux|hdiya|hadiya|l hdiya|fleurs|fleuriste|anniversaire|mariage|bouquet|هدية|ورد' },
                        '⛽ Station-service': { m: 'afriquia|shell|total|totalenergies|winxo|petrom|ziz|oilibya|vivo|station essence', k: 'afriquia|totalenergies|winxo|petrom|oilibya' },
                        '🚕 Transport': { m: 'roadster|yango|lime|tram casa|casa tram|busway|alsa|ctm|supratours|oncf|al boraq', k: 'yango|supratours|careem|indrive|heetch' },
                        '🧾 Impôts': { m: 'vignette|dgi|impot|impots|taxe|amende|timbre|timbres|tribunal|commune|moqata3a|mqata3a|passeport|cnie|carte grise|ضريبة|مقاطعة|تنبر' },
                    };
                    DICO_CATEGORIES.forEach(r => {
                        const e = Object.entries(DICO_ENRICHI).find(([p]) => r.t.startsWith(p));
                        if (!e) return;
                        if (e[1].m) r.m += '|' + e[1].m;
                        if (e[1].k) r.k = (r.k ? r.k + '|' : '') + e[1].k;
                    });
                    const _DICO = DICO_CATEGORIES.map((r, i) => {""")

# ── 3. Vos variantes ────────────────────────────────────────────────────────────
sub('apprentissage : variantes',
"""['noms', 'actions', 'oublis'].forEach(k =>""",
"""['noms', 'actions', 'oublis', 'variantes'].forEach(k =>""")
sub('variantes : proposées',
"""                        //  2. Vos libellés : le mot tapé EST une de vos lignes""",
"""                        //  1 bis. v37.76 : VOS VARIANTES — le commerçant d'une correction, d'une opération en suspens validée,
                        //  d'une réponse sûre de l'IA : « carrefour » appris range « Carrefour Market Gueliz »
                        if (apprentissageActif.value) {
                            const vv = _apprLu().variantes || {};
                            A.toks.forEach(w => { const e = vv[w]; if (e && e.c) proposer(e.c, e.src === 'vous' ? 93 : 84, e.src === 'vous' ? 'vous' : 'appris',
                                '« ' + w + ' » : ' + (e.src === 'vous' ? 'votre correction' : 'appris d’une réponse sûre de l’IA')); });
                        }
                        //  2. Vos libellés : le mot tapé EST une de vos lignes""")
sub('variantes : retenir et oublier',
"""const oublierActionApprise = (k) => { delete _appr().actions[k]; _apprModifie(); };""",
"""const oublierActionApprise = (k) => { delete _appr().actions[k]; _apprModifie(); };
                    //  v37.76 : le mot qui nomme le commerçant — le premier qui n'est ni un mot de banque, ni une ville, ni un nombre
                    const _MOTS_BANQUE = new Set(['paiement', 'retrait', 'gab', 'virement', 'vir', 'prelevement', 'prlv', 'frais', 'com', 'commission', 'achat',
                        'tpe', 'ecom', 'web', 'www', 'sarl', 'ste', 'store', 'shop', 'market', 'maroc', 'marrakech', 'casablanca', 'casa', 'rabat', 'tanger',
                        'agadir', 'fes', 'meknes', 'oujda', 'kenitra', 'tetouan', 'sidi', 'hay', 'bd', 'av', 'rue', 'nouveau', 'divers']);
                    const _motVariante = (libelle) => _analyseLibelle(libelle).toks.find(w => w.length >= 3 && /\\p{L}{3}/u.test(w) && !_MOTS_BANQUE.has(w) && !_MOTS_LABEL_FAIBLES.has(w)) || null;
                    const retenirVariante = (libelle, catId, src) => {
                        if (!apprentissageActif.value || !catId || catId === 'cat_misc') return null;
                        const w = _motVariante(libelle);
                        if (!w) return null;
                        const a = _appr(), e = a.variantes[w];
                        if (e && e.src === 'vous' && src !== 'vous') return null;          // votre correction l'emporte sur l'IA
                        a.variantes[w] = { c: catId, src: src === 'vous' ? 'vous' : 'ia', n: e && e.c === catId ? (e.n || 1) + 1 : 1, t: _ymd(new Date()), ex: String(libelle || '').slice(0, 60) };
                        return w;
                    };
                    const oublierVariante = (w) => { delete _appr().variantes[w]; _apprModifie(); };""")
sub('variantes : vue',
"""                        return { actif: a.actif !== false, categories, noms, actions, oublis: Object.keys(a.oublis || {}).length,
                                 total: categories.length + noms.length + actions.length };""",
"""                        const variantes = Object.entries(a.variantes || {}).map(([mot, e]) => ({ mot, label: _libCat(e.c), src: e.src, n: e.n || 1, t: e.t || '', ex: e.ex || '' }))
                            .sort((p, q) => String(q.t).localeCompare(String(p.t)) || p.mot.localeCompare(q.mot));
                        return { actif: a.actif !== false, categories, noms, actions, variantes, oublis: Object.keys(a.oublis || {}).length,
                                 total: categories.length + noms.length + actions.length + variantes.length };""")
sub('variantes : écran',
"""                                <div data-apprentissage-noms>""",
"""                                <!-- v37.76 : les variantes entrées au dictionnaire -->
                                <div data-apprentissage-variantes>
                                    <p class="font-black text-gray-700 mb-1">🔤 Variantes ajoutées au dictionnaire · {{ apprentissageVue.variantes.length }}</p>
                                    <p v-if="!apprentissageVue.variantes.length" class="text-gray-500 italic">Corrigez une catégorie, validez une opération en suspens : son commerçant entre ici (« carrefour » → Super marché), et « Carrefour Market Gueliz » sera rangé sans demander à l’IA.</p>
                                    <ul class="max-h-60 overflow-y-auto divide-y divide-gray-100">
                                        <li v-for="x in apprentissageVue.variantes" :key="'apv_' + x.mot" data-apprentissage-variante :data-mot="x.mot" class="py-1 flex items-start gap-2">
                                            <span class="flex-1">« {{ x.mot }} » → <b>{{ x.label }}</b> <span class="text-gray-400">· {{ x.src === 'vous' ? 'votre correction' : 'IA, réponse sûre' }}<template v-if="x.n > 1"> · {{ x.n }}×</template><template v-if="x.ex"> · ex. « {{ x.ex }} »</template></span></span>
                                            <button type="button" data-apprentissage-oublier-variante @click="oublierVariante(x.mot)" class="text-red-600 hover:underline shrink-0" title="Oublier cette variante">🗑</button>
                                        </li>
                                    </ul>
                                </div>
                                <div data-apprentissage-noms>""")
sub('variantes : exposition',
"""oublierActionApprise, """,
"""oublierActionApprise, retenirVariante, oublierVariante, """)

# Où l'on apprend
sub('ranger à la main',
"""                        t.categorieId = catId; t.categorieSource = 'vous';
""",
"""                        t.categorieId = catId; t.categorieSource = 'vous';
                        retenirVariante(t.libelle, catId, 'vous');   // v37.76
""")
sub('journal : correction ou suspens validé',
"""                        if (b.categorieId && b.categorieId !== t.categorieId) { t.categorieId = b.categorieId; t.categorieSource = 'vous'; delete t.aVerifier; delete t.iaConfiance; }
""",
"""                        if (b.categorieId && b.categorieId !== t.categorieId) { t.categorieId = b.categorieId; t.categorieSource = 'vous'; delete t.aVerifier; delete t.iaConfiance; retenirVariante(t.libelle, b.categorieId, 'vous'); }
                        //  v37.76 : en suspens (import, IA pas sûre) et enregistrée sans changer de catégorie : validée — et apprise
                        //  (pas un rangement « par défaut » : il ne devine rien)
                        else if (b.categorieId && b.categorieId !== 'cat_misc' && t.aVerifier && t.categorieSource !== 'défaut') { t.categorieSource = 'vous'; delete t.aVerifier; delete t.iaConfiance; retenirVariante(t.libelle, b.categorieId, 'vous'); }
""")
sub('IA sûre',
"""if (conf === 'haute' && u.source !== 'banque') delete u.aVerifier; else u.aVerifier = true;""",
"""if (conf === 'haute' && u.source !== 'banque') delete u.aVerifier; else u.aVerifier = true;
                            if (conf === 'haute') retenirVariante(u.libelle, r.id, 'ia');   // v37.76 : la prochaine fois, sans l'IA""")

# ── 5. La frise du cycle, en vue ────────────────────────────────────────────────
sub('frise : en-tête du Pilotage',
"""                                    class="text-[10px] font-black px-2.5 py-2 rounded-lg border border-gray-300 bg-white text-gray-600 hover:border-purple-500 hover:text-purple-700 transition-colors whitespace-nowrap">💾 Clôturer</button>""",
"""                                    class="text-[10px] font-black px-2.5 py-2 rounded-lg border border-gray-300 bg-white text-gray-600 hover:border-purple-500 hover:text-purple-700 transition-colors whitespace-nowrap">💾 Clôturer</button>
                            <!-- v37.76 : « le bouton du visualiseur de cycle et semaines doit être visible » -->
                            <button type="button" data-ouvrir-frise-entete @click="friseOuverte = true" title="La frise du cycle : avancement, morceaux de semaine, dépassements"
                                    class="text-[11px] font-black px-3 py-2 rounded-lg bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 transition-colors whitespace-nowrap">📈 Cycle et semaines</button>""")
sub('frise : dans la Météo',
"""                    <button type="button" data-ouvrir-frise @click="$emit('frise')" title="La frise du cycle : avancement, morceaux de semaine, dépassements"
                            class="text-[10px] font-black text-white/85 hover:text-white underline decoration-dotted underline-offset-2">📈 Frise du cycle</button>""",
"""                    <button type="button" data-ouvrir-frise @click="$emit('frise')" title="La frise du cycle : avancement, morceaux de semaine, dépassements"
                            class="rounded-full bg-white text-slate-900 px-2.5 py-0.5 text-[10px] font-black shadow-sm hover:bg-emerald-100">📈 Voir le cycle et ses semaines</button>""")

sub('vos choix devant le dictionnaire',
"""const proche = !!rival && rival.note >= best.note - _CAT_MARGE;""",
"""//  v37.76 : VOS choix (corrections, variantes) ne sont pas mis en doute par le dictionnaire ni par l'historique automatique
                        const proche = !!rival && rival.note >= best.note - _CAT_MARGE && !(best.source === 'vous' && ['règle', 'appris'].includes(rival.source));""")
sub('oublier une catégorie apprise oublie sa variante',
"""const oublierCategorieApprise = (cle) => { _appr().oublis[cle] = true; _apprModifie(); };""",
"""const oublierCategorieApprise = (cle) => { _appr().oublis[cle] = true; const w = _motVariante(cle); if (w) delete _appr().variantes[w]; _apprModifie(); };   // v37.76 : et sa variante""")
io.open(F, 'w', encoding='utf-8').write(src)
print('✔ v37.76 : dictionnaire enrichi, la ligne exacte d’abord, vos variantes apprises, frise du cycle en vue')
