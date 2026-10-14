# -*- coding: utf-8 -*-
"""
v37.52 — LA CATÉGORISATION SE FAIT SEULE.

« Pourquoi j'ai besoin d'appuyer sur IA ? Si l'appli n'arrive pas à catégoriser, elle fait appel
à l'IA ; si l'appel à l'IA échoue, elle met un truc par défaut, sans que j'appuie sur un bouton. »

  1. LES RÈGLES, D'ABORD — un mot de vos lignes écrit autrement en darija est reconnu : lettre
     doublée et article « l / el » ramenés à la même racine (« Hri » = votre ligne « lhrri »).
  2. SÛR → rangé, partout, tout de suite : à la saisie (déjà) ET pour toute transaction déjà
     enregistrée sans catégorie (arrivée par l'agent, un import, un autre appareil, une version
     d'avant) — plus de bouton « Appliquer les suggestions sûres ».
  3. DOUTE OU INCONNU → l'IA est appelée d'office (à la saisie comme au chargement, une demande à
     la fois, une seule fois par transaction et par session) — plus de bouton « Demander à l'IA ».
  4. L'IA ÉCHOUE (injoignable, réponse illisible, catégorie inventée, « aucune ») → une catégorie
     PAR DÉFAUT est posée : la meilleure piste des règles, sinon votre catégorie la plus utilisée,
     sinon « Dépense exceptionnelle ». Source « par défaut », surlignée « à vérifier » : rien
     n'attend, un clic sur ✓ confirme. « 🤖 relancer l'IA » reste sur ces lignes-là.
"""
import io, sys

def patcher(F, subs):
    src = io.open(F, encoding='utf-8').read()
    for label, a, b, n in subs:
        c = src.count(a)
        if c != n:
            print(f'✖ {F} — {label} : {c} ancre(s), {n} attendue(s)'); sys.exit(1)
        src = src.replace(a, b)
    io.open(F, 'w', encoding='utf-8').write(src)

H = []
# ── 1. La racine darija d'un mot ────────────────────────────────────────────
H.append(('racine darija', """                    //  Des mots de libellé qui ne disent rien de la dépense
                    const _MOTS_LABEL_FAIBLES = new Set(""",
"""                    //  v37.52 — LA RACINE D'UN MOT DARIJA : lettres doublées ramenées à une, article
                    //  « l / el » collé devant une consonne retiré (« lhrri » → « hri », « lkhodra » →
                    //  « khodra »). Jamais devant une voyelle ni un chiffre : « lait », « l7m » restent.
                    const _racineDarija = (w) => {
                        const r = String(w || '').replace(/(.)\\1+/g, '$1');
                        const s = r.replace(/^(el|l)(?=[^aeiouy\\d\\s])/, '');
                        return s.length >= 3 ? s : r;
                    };
                    const _memeRacine = (a, b) => { const x = _racineDarija(a); return x.length >= 3 && x === _racineDarija(b); };
                    //  Des mots de libellé qui ne disent rien de la dépense
                    const _MOTS_LABEL_FAIBLES = new Set(""", 1))
H.append(('libellé : même racine', """                            if (c.mots.length === 1 && libres.includes(c.mots[0])) return proposer(c.id, 92, 'libellé', '« ' + c.label + ' » dans le libellé');""",
"""                            if (c.mots.length === 1 && libres.includes(c.mots[0])) return proposer(c.id, 92, 'libellé', '« ' + c.label + ' » dans le libellé');
                            //  v37.52 : le même mot, autre graphie (« Hri » pour « lhrri »)
                            if (c.mots.length === 1 && libres.some(w => _memeRacine(w, c.mots[0]))) return proposer(c.id, 90, 'libellé', '« ' + c.label + ' », autre graphie');""", 1))

# ── 2-4. L'enchaînement automatique ─────────────────────────────────────────
H.append(('IA : tentée', """                        iaCategorisation.enCours[txId] = true;
                        delete iaCategorisation.messages[txId];""",
"""                        iaCategorisation.enCours[txId] = true;
                        _iaTentees.add(txId);   // v37.52 : une fois par session, le balayage n'y revient pas
                        delete iaCategorisation.messages[txId];""", 1))
H.append(('IA : file + défaut', """                    let _iaFile = Promise.resolve();""",
"""                    let _iaFile = Promise.resolve();
                    const _iaTentees = new Set();
                    //  v37.52 — L'IA N'A PAS RÉPONDU : UNE CATÉGORIE PAR DÉFAUT, À VÉRIFIER. La meilleure
                    //  piste des règles, sinon votre catégorie la plus utilisée, sinon « Dépense
                    //  exceptionnelle ». Une piste déjà posée (un doute) est gardée.
                    const _categorieParDefaut = (r) => {
                        const vivantes = _categoriesCandidates.value, ids = new Set(vivantes.map(c => c.id));
                        if (r && r.id && ids.has(r.id)) return r.id;
                        const u = categoriesLesPlusUtilisees.value.find(id => ids.has(id));
                        if (u) return u;
                        if (ids.has('cat_irr_depense_exceptionnelle')) return 'cat_irr_depense_exceptionnelle';
                        return vivantes.length ? vivantes[0].id : null;
                    };
                    const _poserParDefaut = (txId, motif) => {
                        const t = _txParId(txId);
                        if (!t || t.categorieSource === 'vous') return;
                        if (t.categorieId && t.categorieId !== 'cat_misc') {
                            t.aVerifier = true;
                            iaCategorisation.messages[txId] = motif + ' : gardée dans « ' + String(getCategorieLabel(t.categorieId) || '').trim() + ' », à vérifier.';
                        } else {
                            const id = _categorieParDefaut(categoriserLibelle(t.libelle));
                            if (!id) { iaCategorisation.messages[txId] = motif + ' : à vous de la ranger.'; return; }
                            t.categorieId = id; t.categorieSource = 'défaut'; t.aVerifier = true;
                            iaCategorisation.messages[txId] = motif + ' : rangée par défaut dans « ' + String(getCategorieLabel(id) || '').trim() + ' », à vérifier.';
                        }
                        calculationTick.value++;
                        handleDataChange();
                    };""", 1))
H.append(('IA : pas de libellé', """                            if (!_analyseLibelle(t.libelle).toks.length || t.libelle === 'Sans libellé') { iaCategorisation.messages[txId] = "Pas de libellé : rien à demander à l'IA, à vous de la ranger."; return; }""",
"""                            if (!_analyseLibelle(t.libelle).toks.length || t.libelle === 'Sans libellé') { _poserParDefaut(txId, "Pas de libellé, rien à demander à l'IA"); return; }""", 1))
H.append(('IA : aucune catégorie', """                                iaCategorisation.messages[txId] = "L'IA ne voit aucune de vos catégories" + (r.raison ? ' (' + String(r.raison).slice(0, 80) + ')' : '') + ' : à vous de la ranger.';
                                return;""",
"""                                _poserParDefaut(txId, "L'IA ne voit aucune de vos catégories" + (r.raison ? ' (' + String(r.raison).slice(0, 80) + ')' : ''));
                                return;""", 1))
H.append(('IA : injoignable', """                            iaCategorisation.messages[txId] = 'IA injoignable (' + (e && e.message || e) + ') : la transaction attend, à vous de la ranger.';""",
"""                            _poserParDefaut(txId, 'IA injoignable (' + (e && e.message || e) + ')');""", 1))
H.append(('source « par défaut »', """                    const SOURCES_CATEGORIE = { vous: 'vous', manuel: 'vous', appris: 'appris', 'libellé': 'votre libellé', 'règle': 'règle', ia: 'IA' };""",
"""                    const SOURCES_CATEGORIE = { vous: 'vous', manuel: 'vous', appris: 'appris', 'libellé': 'votre libellé', 'règle': 'règle', ia: 'IA', 'défaut': 'par défaut' };""", 1))
H.append(('le balayage automatique', """                    const demanderIAPourTout = () => aCategoriser.value
                        .filter(l => !l.sure && l.source !== 'ia' && !iaCategorisation.enCours[l.id])
                        .forEach(l => demanderCategorieIA(l.id));""",
"""                    const demanderIAPourTout = () => aCategoriser.value
                        .filter(l => !l.sure && l.source !== 'ia' && !iaCategorisation.enCours[l.id])
                        .forEach(l => demanderCategorieIA(l.id));
                    //  v37.52 — SANS BOUTON : dès qu'une transaction attend (saisie, agent, import, autre
                    //  appareil), le sûr est rangé, le reste part à l'IA — une fois par session.
                    const _balayerACategoriser = () => {
                        if (appliquerSuggestionsSures()) return;          // la liste change : on repasse
                        aCategoriser.value.forEach(l => {
                            if (l.sure || l.source === 'ia' || l.source === 'vous' || _iaTentees.has(l.id) || iaCategorisation.enCours[l.id]) return;
                            demanderCategorieIA(l.id);
                        });
                    };""", 1))
H.append(('le balayage : une fois tout le moteur défini', """                    onBeforeUnmount(() => {
                        if (_resizeHandler) window.removeEventListener('resize', _resizeHandler);
                    });""",
"""                    onBeforeUnmount(() => {
                        if (_resizeHandler) window.removeEventListener('resize', _resizeHandler);
                    });

                    //  v37.52 : le balayage « À vérifier » — posé ICI, quand tout le moteur est défini
                    //  (plus haut, il lirait des valeurs pas encore initialisées).
                    watch(() => aCategoriser.value.map(l => l.id + ':' + (l.sure || '') + ':' + (l.source || '')).join('|'),
                          () => _balayerACategoriser(), { immediate: true });""", 1))

# ── Le panneau : plus de boutons à presser ──────────────────────────────────
H.append(('panneau : en-tête', """                            <h3 class="font-black uppercase tracking-widest text-amber-900 text-xs md:text-sm">⚠️ À catégoriser ({{ aCategoriser.length }})</h3>
                            <span class="text-[10px] font-semibold text-amber-900">Un doute, ou rien de trouvé : un clic range la transaction, et votre choix devient une règle.</span>
                            <div class="ml-auto flex flex-wrap gap-1.5">
                                <button v-if="aCategoriser.some(l => l.sure)" type="button" data-appliquer-sures @click="appliquerSuggestionsSures()"
                                        class="text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-600 text-white hover:bg-emerald-700">✓ Appliquer les {{ aCategoriser.filter(l => l.sure).length }} suggestion(s) sûre(s)</button>
                                <button v-if="aCategoriser.some(l => !l.sure && l.source !== 'ia')" type="button" data-ia-tout @click="demanderIAPourTout()"
                                        class="text-[10px] font-black px-2.5 py-1 rounded-full bg-violet-600 text-white hover:bg-violet-700">🤖 Demander à l'IA</button>
                            </div>""",
"""                            <h3 class="font-black uppercase tracking-widest text-amber-900 text-xs md:text-sm">⚠️ À vérifier ({{ aCategoriser.length }})</h3>
                            <span data-a-categoriser-aide class="text-[10px] font-semibold text-amber-900">Rangées d'office : les règles, puis l'IA, puis une catégorie par défaut si l'IA ne répond pas. Rien n'attend — ✓ confirme, ou choisissez-en une autre : votre choix devient une règle.</span>""", 1))
H.append(('panneau : par défaut', """<span v-if="cid === l.actuelle && l.source === 'ia'" class="opacity-70"> · IA</span><span v-else-if="cid === l.sure" class="opacity-70"> · sûr</span>""",
"""<span v-if="cid === l.actuelle && l.source === 'ia'" class="opacity-70"> · IA</span><span v-else-if="cid === l.actuelle && l.source === 'défaut'" class="opacity-70"> · par défaut</span><span v-else-if="cid === l.sure" class="opacity-70"> · sûr</span>""", 1))
H.append(('panneau : relancer', """                                    <button v-if="!l.sure && !iaCategorisation.enCours[l.id]" type="button" data-ia-une @click="demanderCategorieIA(l.id)" class="text-[10px] font-bold text-violet-700 hover:underline">🤖 IA</button>""",
"""                                    <button v-if="!l.sure && l.source !== 'ia' && !iaCategorisation.enCours[l.id]" type="button" data-ia-une @click="demanderCategorieIA(l.id)" class="text-[10px] font-bold text-violet-700 hover:underline">🤖 relancer l'IA</button>""", 1))
H.append(('journal : par défaut', """<span v-if="tx.categorieSource === 'ia'" class="text-[9px] font-black text-violet-700"> · IA</span>""",
"""<span v-if="tx.categorieSource === 'ia'" class="text-[9px] font-black text-violet-700"> · IA</span><span v-else-if="tx.categorieSource === 'défaut'" class="text-[9px] font-black text-amber-700"> · par défaut</span>""", 1))
H.append(('saisie : l\'étiquette inconnue', """title="Aucune règle ne connaît ce libellé">🤖 Inconnu des règles : l'IA proposera une catégorie</span>""",
"""title="Aucune règle ne connaît ce libellé : l'IA est appelée à l'enregistrement ; si elle ne répond pas, une catégorie par défaut est posée, à vérifier">🤖 Inconnu des règles : l'IA proposera une catégorie</span>""", 2))

patcher('index.html', H)
print('✔ v37.52 — catégorisation automatique : racine darija, sûr d\'office, IA d\'office, défaut si l\'IA échoue')
