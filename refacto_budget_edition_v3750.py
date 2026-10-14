# -*- coding: utf-8 -*-
"""
v37.50 — LE BUDGET STRUCTUREL SANS « MODE ÉDITION ».

« Je veux pouvoir ajouter des lignes sur chaque catégorie (ex. ajouter en charge fixe "Syndic
magasin"), sur toutes les catégories ; affecter chaque charge à un compte, pas un compte global
par catégorie ; sans alourdir l'interface ; et au lieu d'un bouton pour éditer les noms, juste
un double-clic sur chaque nom pour le changer. »

  • « + Ajouter … » toujours visible (discret) : la ligne apparaît, son nom prêt à être tapé.
  • Double-clic sur un nom (revenu, charge fixe, charge variable, épargne, compte) : il devient
    modifiable — Entrée garde, Échap annule. Le bouton « ✏️ Éditer noms » disparaît.
  • Une puce « 🏦 compte » par charge fixe et par charge variable : « par défaut » (le compte de
    la famille) ou le compte de CETTE ligne.
  • Scinder / Supprimer : dans les options de la ligne (« Gérer périodes »), plus en permanence.
  • Ajout, renommage, compte, suppression : l'année affichée ET les suivantes (même ligne).
"""
import io, re, sys

F = 'index.html'
src = io.open(F, encoding='utf-8').read()

def sub(label, a, b, n=1):
    global src
    c = src.count(a)
    if c != n:
        print(f'✖ {F} — {label} : {c} ancre(s), {n} attendue(s)'); sys.exit(1)
    src = src.replace(a, b)

# ═══ 1. Le script ═══════════════════════════════════════════════════════════
sub('ajouts', """                    const ajouterEntree = () => {
                        const yr = anneeAffichage.value;
                        if (!donneesAnnuelles.value[yr]) return;
                        const id = 'rev_' + Date.now();
                        const catId = 'cat_rv_' + _slugCat(id);
                        donneesAnnuelles.value[yr].revenus[id] = { label: 'Nouveau revenu', base: 0, destinationCompte: 'courant', exceptions: [], categorieId: catId };
                        migrateCategoriesV22(); // ré-indexe la nouvelle entrée dans le registre
                        handleDataChange();
                    };
                    const ajouterChargeFixe = () => {
                        const yr = anneeAffichage.value;
                        if (!donneesAnnuelles.value[yr]) return;
                        const id = 'fix_' + Date.now();
                        const catId = 'cat_cf_' + _slugCat(id);
                        donneesAnnuelles.value[yr].chargesFixes[id] = { label: 'Nouvelle charge fixe', valeur: 0, sourceCompte: 'courant', exceptions: [], categorieId: catId };
                        migrateCategoriesV22();
                        handleDataChange();
                    };
                    const ajouterChargeVariable = () => {
                        const yr = anneeAffichage.value;
                        if (!donneesAnnuelles.value[yr]) return;
                        const id = 'var_' + Date.now();
                        const catId = 'cat_cv_' + _slugCat(id);
                        donneesAnnuelles.value[yr].chargesVariables[id] = { label: 'Nouvelle charge variable', valeur: 0, periode: 'mois', sourceCompte: 'courant', categorieId: catId };
                        migrateCategoriesV22();
                        handleDataChange();
                    };""", """                    // ── v37.50 : ÉDITER LE BUDGET SANS « MODE ÉDITION » ───────────────────────
                    //   Double-clic sur un nom : il devient modifiable (Entrée garde, Échap annule).
                    //   « + Ajouter » toujours là : la ligne naît avec son nom prêt à taper. Ajout,
                    //   renommage, compte et suppression valent pour l'année affichée ET les
                    //   suivantes (même clé de ligne) : une charge ne s'arrête pas au 31 décembre.
                    const nomEnEdition = ref(null);
                    const estEnEdition = (id) => !!nomEnEdition.value && nomEnEdition.value.id === id;
                    const finRenommer = (annuler) => {
                        const e = nomEnEdition.value;
                        if (!e) return;
                        nomEnEdition.value = null;
                        const v = String(e.objet[e.champ] == null ? '' : e.objet[e.champ]).trim();
                        if (annuler || !v) { e.objet[e.champ] = e.avant; return; }
                        e.objet[e.champ] = v;
                        if (v !== e.avant) { if (e.suite) e.suite(v, e.avant); handleDataChange(); }
                    };
                    const commencerRenommer = (id, objet, champ, suite) => {
                        if (!objet) return;
                        if (nomEnEdition.value) finRenommer(false);
                        nomEnEdition.value = { id, objet, champ, avant: objet[champ], suite: suite || null };
                        nextTick(() => { const el = document.querySelector('[data-nom-edition]'); if (el) { el.focus(); el.select(); } });
                    };
                    const _anneesDes = () => Object.keys(donneesAnnuelles.value || {}).map(Number)
                        .filter(a => a >= Number(anneeAffichage.value)).sort((a, b) => a - b);
                    const _lignesSuivantes = (coll, key) => _anneesDes().map(a => ((donneesAnnuelles.value[a] || {})[coll] || {})[key]).filter(Boolean);
                    //  Renommer : les années suivantes qui portaient le même nom suivent
                    const renommerLigneBudget = (coll, key) => (nouveau, avant) =>
                        _lignesSuivantes(coll, key).forEach(it => { if (it.label === avant) it.label = nouveau; });
                    const renommerEpargne = (id) => (nouveau, avant) => _anneesDes().forEach(a => {
                        ((donneesAnnuelles.value[a] || {}).epargne || []).forEach(ep => { if (ep && String(ep.id) === String(id) && ep.nom === avant) ep.nom = nouveau; });
                    });
                    //  Le compte d'UNE ligne (vide = le compte par défaut de sa famille)
                    const choisirCompteLigne = (coll, key, compte) => {
                        _lignesSuivantes(coll, key).forEach(it => { if (compte) it.compte = compte; else delete it.compte; });
                        calculationTick.value++;
                        handleDataChange();
                    };
                    const _MODELES_LIGNE = {
                        revenus: ['rev_', 'cat_rv_', () => ({ label: 'Nouveau revenu', base: 0, destinationCompte: 'courant', exceptions: [] })],
                        chargesFixes: ['fix_', 'cat_cf_', () => ({ label: 'Nouvelle charge fixe', valeur: 0, exceptions: [] })],
                        chargesVariables: ['var_', 'cat_cv_', () => ({ label: 'Nouvelle charge variable', valeur: 0, periode: 'mois', exceptions: [] })],
                    };
                    const ajouterLigneBudget = (coll) => {
                        const yr = Number(anneeAffichage.value), P = _MODELES_LIGNE[coll];
                        if (!P || !donneesAnnuelles.value[yr]) return null;
                        const id = P[0] + Date.now();
                        _anneesDes().forEach(a => {
                            const d = donneesAnnuelles.value[a];
                            if (!d) return;
                            if (!d[coll] || typeof d[coll] !== 'object') d[coll] = {};
                            d[coll][id] = { ...P[2](), categorieId: P[1] + _slugCat(id) };
                        });
                        migrateCategoriesV22();   // ré-indexe la nouvelle entrée dans le registre
                        handleDataChange();
                        //  Le nom tout de suite : « Syndic magasin », Entrée
                        nextTick(() => commencerRenommer(coll + ':' + id, donneesAnnuelles.value[yr][coll][id], 'label', renommerLigneBudget(coll, id)));
                        return id;
                    };
                    const supprimerLigneBudget = (coll, key) => {
                        const an = Number(anneeAffichage.value);
                        const it = ((donneesAnnuelles.value[an] || {})[coll] || {})[key];
                        if (!it) return;
                        const suivantes = _anneesDes().filter(a => a > an && ((donneesAnnuelles.value[a] || {})[coll] || {})[key]);
                        if (!confirm('Supprimer « ' + (it.label || key) + ' » de ' + an + (suivantes.length ? ' et des années suivantes (' + suivantes.join(', ') + ')' : '') + ' ?')) return;
                        _anneesDes().forEach(a => { const c = (donneesAnnuelles.value[a] || {})[coll]; if (c && c[key]) delete c[key]; });
                        calculationTick.value++;
                        handleDataChange();
                    };
                    //  Un montant tapé sur une ligne : les années suivantes encore à 0 le reprennent
                    //  (une ligne ajoutée vit aussi en 2027…) — un montant déjà saisi n'est jamais écrasé.
                    const propagerValeurLigne = (coll, key, champ) => {
                        const an = Number(anneeAffichage.value);
                        const v = Number((((donneesAnnuelles.value[an] || {})[coll] || {})[key] || {})[champ] || 0);
                        if (!(v > 0)) return;
                        _lignesSuivantes(coll, key).forEach(it => { if (it !== donneesAnnuelles.value[an][coll][key] && !(Number(it[champ]) > 0)) it[champ] = v; });
                        handleDataChange();
                    };
                    //  Les anciens noms, gardés pour leurs appelants
                    const ajouterEntree = () => ajouterLigneBudget('revenus');
                    const ajouterChargeFixe = () => ajouterLigneBudget('chargesFixes');
                    const ajouterChargeVariable = () => ajouterLigneBudget('chargesVariables');""")
sub('exposition', """                        activeTab, appMode, modeEdition, fileInput, soldesInitiaux, donneesAnnuelles, projetStudio,""",
"""                        activeTab, appMode, modeEdition, fileInput, soldesInitiaux, donneesAnnuelles, projetStudio,
                        // v37.50 : édition du budget sans mode édition
                        estEnEdition, commencerRenommer, finRenommer, renommerLigneBudget, renommerEpargne, choisirCompteLigne,
                        ajouterLigneBudget, supprimerLigneBudget, propagerValeurLigne,""")

# ═══ 2. Les noms : double-clic ═════════════════════════════════════════════
ORDRE = ['revenus', 'chargesFixes', 'chargesVariables'] * 2
motif = re.compile(r'(?P<i>[ ]*)<input v-if="modeEdition" type="text" v-model="item\.label" @input="handleDataChange" class="(?P<ic>[^"]*)"\s*/>\n'
                   r'(?P<j>[ ]*)<label v-else class="(?P<lc>[^"]*)">')
trouves = list(motif.finditer(src))
if len(trouves) != 6:
    print(f'✖ noms : {len(trouves)} trouvés, 6 attendus'); sys.exit(1)
morceaux, fin = [], 0
for m, coll in zip(trouves, ORDRE):
    ident = "'" + coll + ":' + key"
    morceaux.append(src[fin:m.start()])
    morceaux.append(
        f'{m["i"]}<input v-if="estEnEdition({ident})" data-nom-edition type="text" v-model="item.label" '
        f'@keydown.enter.prevent="finRenommer(false)" @keydown.esc.prevent="finRenommer(true)" @blur="finRenommer(false)" class="{m["ic"]}" />\n'
        f'{m["j"]}<label v-else data-nom :data-ligne="{ident}" @dblclick="commencerRenommer({ident}, item, \'label\', renommerLigneBudget(\'{coll}\', key))" '
        f'title="Double-clic pour renommer" class="{m["lc"]} cursor-text select-none">')
    fin = m.end()
morceaux.append(src[fin:])
src = ''.join(morceaux)

sub('épargne : double-clic (bureau)', """<span class="text-sm font-black text-gray-700 uppercase tracking-wide block">{{ obj.nom }}</span>""",
"""<input v-if="estEnEdition('epargne:' + obj.id)" data-nom-edition type="text" v-model="obj.nom" @keydown.enter.prevent="finRenommer(false)" @keydown.esc.prevent="finRenommer(true)" @blur="finRenommer(false)" class="text-sm font-bold text-gray-700 bg-gray-50 border border-gray-300 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-purple-400 w-48" />
                                    <span v-else data-nom :data-ligne="'epargne:' + obj.id" @dblclick="commencerRenommer('epargne:' + obj.id, obj, 'nom', renommerEpargne(obj.id))" title="Double-clic pour renommer" class="text-sm font-black text-gray-700 uppercase tracking-wide block cursor-text select-none">{{ obj.nom }}</span>""")
sub('épargne : double-clic (mobile)', """<span class="text-xs font-black text-gray-700 uppercase tracking-wide">{{ obj.nom }}</span>""",
"""<input v-if="estEnEdition('epargne:' + obj.id)" data-nom-edition type="text" v-model="obj.nom" @keydown.enter.prevent="finRenommer(false)" @keydown.esc.prevent="finRenommer(true)" @blur="finRenommer(false)" class="text-xs font-bold text-gray-700 bg-gray-50 border border-gray-300 rounded px-2 py-1 outline-none" />
                                <span v-else data-nom :data-ligne="'epargne:' + obj.id" @dblclick="commencerRenommer('epargne:' + obj.id, obj, 'nom', renommerEpargne(obj.id))" title="Double-clic pour renommer" class="text-xs font-black text-gray-700 uppercase tracking-wide cursor-text select-none">{{ obj.nom }}</span>""")
sub('comptes : double-clic', """<p class="font-black text-gray-800 text-sm truncate">{{ compte.label }}</p>""",
"""<input v-if="estEnEdition('compte:' + compte.id)" data-nom-edition type="text" :value="(comptes.find(x => x.id === compte.id) || compte).label" @input="(comptes.find(x => x.id === compte.id) || compte).label = $event.target.value" @keydown.enter.prevent="finRenommer(false)" @keydown.esc.prevent="finRenommer(true)" @blur="finRenommer(false)" class="text-sm font-bold text-gray-800 bg-gray-50 border border-gray-300 rounded px-2 py-1 outline-none w-56" />
                                        <p v-else data-nom :data-ligne="'compte:' + compte.id" @dblclick="commencerRenommer('compte:' + compte.id, comptes.find(x => x.id === compte.id) || compte, 'label')" title="Double-clic pour renommer" class="font-black text-gray-800 text-sm truncate cursor-text select-none">{{ compte.label }}</p>""")

# ═══ 3. Plus de bouton « Éditer noms » ═════════════════════════════════════
sub('bouton bureau', re.search(r'\n[ ]*<button @click="modeEdition = !modeEdition" :class="\[\'text-\[10px\] px-3 py-1\.5[^\n]*\n[^\n]*Terminer Edition[^\n]*\n[ ]*</button>', src).group(0),
    """
                                <span class="text-[10px] font-semibold text-gray-400 normal-case tracking-normal" data-aide-double-clic>✎ double-clic sur un nom pour le renommer</span>""")
sub('bouton mobile', re.search(r'\n[ ]*<button @click="modeEdition = !modeEdition" :class="\[\'text-\[10px\] px-3 py-2[^\n]*\n[^\n]*✅ Fin[^\n]*\n[ ]*</button>', src).group(0), '')

# ═══ 4. Scinder / Supprimer : dans les options de la ligne ═════════════════
UI = {'revenus': 'revenus', 'chargesFixes': 'fixes', 'chargesVariables': 'variables'}
paire = re.compile(r'<button v-if="modeEdition && \(!item\.parts \|\| !item\.parts\.length\)" @click="scinderLigneObj\(item\)"(?P<a>[^\n]*)\n'
                   r'(?P<i>[ ]*)<button v-if="modeEdition" @click="supprimerLigneObj\(donneesAnnuelles\[anneeAffichage\]\.(?P<c>\w+), key\)"')
n = 0
def rp(m):
    global n; n += 1
    o = f"uiOuvert('budget.{UI[m['c']]}.' + key + '.periodes', item.showExceptions)"
    return (f'<button v-if="{o} && (!item.parts || !item.parts.length)" @click="scinderLigneObj(item)"{m["a"]}\n'
            f'{m["i"]}<button v-if="{o}" data-supprimer-ligne @click="supprimerLigneBudget(\'{m["c"]}\', key)"')
src = paire.sub(rp, src)
if n != 6: print(f'✖ scinder/supprimer : {n} paires, 6 attendues'); sys.exit(1)

# ═══ 5. « + Ajouter » toujours là, discret ═════════════════════════════════
for f, coll in (('ajouterEntree', 'revenus'), ('ajouterChargeFixe', 'chargesFixes'), ('ajouterChargeVariable', 'chargesVariables')):
    motif = re.compile(r'<button v-if="modeEdition" @click="' + f + r'\(\)" class="w-full mt-4 py-3 text-sm font-black uppercase tracking-widest (?P<t>text-\w+-600) (?P<bg>bg-\w+-50) border-2 border-dashed (?P<b>border-\w+-300) rounded-xl (?P<h>hover:bg-\w+-100) transition-colors">')
    src, k = motif.subn(lambda m: f'<button type="button" data-ajouter-ligne="{coll}" @click="{f}()" class="w-full mt-3 py-2 text-[11px] font-black uppercase tracking-widest {m["t"]} bg-white border border-dashed {m["b"]} rounded-xl {m["h"]} transition-colors">', src)
    if k != 2: print(f'✖ ajouter {f} : {k}, 2 attendus'); sys.exit(1)

# ═══ 6. Le compte de chaque ligne ══════════════════════════════════════════
def puce(coll, defaut, cls_def, cls_choix):
    return (f'<select data-compte-ligne :data-ligne="\'{coll}:\' + key" :value="item.compte || \'\'" @change="choisirCompteLigne(\'{coll}\', key, $event.target.value)" @click.stop\n'
            f'        :title="item.compte ? \'Cette charge sort de ce compte (choisi sur la ligne)\' : \'Compte par défaut — choisissez-en un autre pour cette seule ligne\'"\n'
            f'        :class="[\'{{cls}}\', item.compte ? \'{cls_choix}\' : \'{cls_def}\']">\n'
            f'    <option value="">🏦 {{{{ getNomCompte(soldesInitiaux.{defaut} || \'courant\') }}}} · par défaut</option>\n'
            f'    <option value="courant">💳 Compte Courant</option>\n'
            f'    <option v-for="c in comptesSelectOptions" :key="\'lc_\' + key + c.id" :value="\'cpt_\' + c.id">{{{{ c.icone }}}} {{{{ c.label }}}}</option>\n'
            f'    <option v-for="ep in donneesAnnuelles[anneeAffichage].epargne" :key="\'lce_\' + key + ep.id" :value="\'ep_\' + ep.id">🎯 {{{{ ep.label || ep.nom }}}}</option>\n'
            f'</select>')
def indente(t, ind): return ('\n' + ind).join(t.split('\n'))
# bureau : la puce rejoint les boutons de la ligne (fixes et variables)
for coll, defaut, ui in (('chargesFixes', 'compteChargesFixes', 'fixes'), ('chargesVariables', 'compteChargesVariables', 'variables')):
    ancre = f"""<button v-if="uiOuvert('budget.{ui}.' + key + '.periodes', item.showExceptions) && (!item.parts || !item.parts.length)" @click="scinderLigneObj(item)" class="text-[10px] text-blue-500 hover:bg-blue-50"""
    if src.count(ancre) != 1: print(f'✖ puce bureau {coll} : {src.count(ancre)}'); sys.exit(1)
    i = src.index(ancre); deb = src.rindex('\n', 0, i) + 1; ind = src[deb:i]
    p = puce(coll, defaut, 'bg-white text-gray-500 border-gray-200 hover:border-gray-400', 'bg-indigo-50 text-indigo-800 border-indigo-300').replace('{cls}', 'max-w-[19rem] text-[10px] font-bold rounded-lg border px-1.5 py-1 outline-none cursor-pointer')
    src = src[:deb] + ind + '<!-- v37.50 : le compte de CETTE ligne -->\n' + ind + indente(p, ind) + '\n' + src[deb:]
# mobile : l'encart « ← Prélevé sur » (lecture seule depuis la v32.10) devient le choix
for coul, defaut, coll, fin in (('orange', 'compteChargesFixes', 'chargesFixes', 'Charges Fixes'), ('red', 'compteChargesVariables', 'chargesVariables', 'Charges Variables')):
    m = re.search(r'<div v-if="!item\.parts \|\| !item\.parts\.length" class="mt-2 flex items-center gap-2 bg-' + coul + r'-50/70 border border-' + coul + r'-200 rounded-lg px-2\.5 py-2">\n'
                  r'(?P<i>[ ]*)<span class="text-\[9px\] font-black text-' + coul + r'-700 uppercase tracking-widest shrink-0">← Prélevé sur</span>\n'
                  r'[^\n]*\n[^\n]*réglage global<br/>' + fin + r'</span>\n[ ]*</div>', src)
    if not m: print(f'✖ encart mobile {coll}'); sys.exit(1)
    ind = m['i']
    p = puce(coll, defaut, 'text-' + coul + '-800', 'text-indigo-800').replace('{cls}', 'flex-1 min-w-0 text-[11px] font-black bg-transparent outline-none cursor-pointer')
    neuf = (f'<div class="mt-2 flex items-center gap-2 bg-{coul}-50/70 border border-{coul}-200 rounded-lg px-2.5 py-1.5">\n'
            f'{ind}<span class="text-[9px] font-black text-{coul}-700 uppercase tracking-widest shrink-0">← Prélevé sur</span>\n'
            f'{ind}' + indente(p, ind) + '\n' + ind[:-4] + '</div>')
    src = src[:m.start()] + neuf + src[m.end():]

# ═══ 6 bis. Un montant tapé rejoint les années suivantes encore à 0 ════════
champs = re.compile(r'<input type="number" v-model\.number="item\.(?P<f>valeur|base)" @input="handleDataChange"')
ordre = ['revenus', 'chargesFixes', 'chargesVariables'] * 2
trouves = list(champs.finditer(src))
if len(trouves) != 6: print(f'✖ montants : {len(trouves)}, 6 attendus'); sys.exit(1)
for m, coll in reversed(list(zip(trouves, ordre))):
    src = src[:m.start()] + m.group(0) + f' @change="propagerValeurLigne(\'{coll}\', key, \'{m["f"]}\')"' + src[m.end():]

# ═══ 7. Le réglage global devient « par défaut » ═══════════════════════════
sub('libellé fixes', '🏦 Prélever toutes les charges fixes sur :', '🏦 Compte par défaut des charges fixes :', n=2)
sub('libellé variables', '🏦 Prélever toutes les charges variables sur :', '🏦 Compte par défaut des charges variables :', n=2)

io.open(F, 'w', encoding='utf-8').write(src)
print('✔ index.html : Budget Structurel — ajouter, double-clic pour renommer, un compte par ligne')
