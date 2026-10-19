# -*- coding: utf-8 -*-
"""
v37.60 — L'APPLICATION APPREND DE VOS CORRECTIONS.

« Ajoute une option learning : si je corrige quelque chose, l'appli apprend d'après ma correction ; si je
corrige une fois, on alimente un dictionnaire, ou quelque chose de plus intelligent. »
  • UNE CORRECTION SUFFIT : la catégorie que VOUS avez choisie pour un libellé l'emporte sur toutes celles
    que l'application avait devinées pour ce même libellé (avant : noyée par la majorité des anciennes).
  • LE MONTANT DÉPARTAGE : le même libellé rangé par vous dans deux catégories (« Marjane » 50 DH → Snacks,
    « Marjane » 400 DH → Courses) : la catégorie dont vos montants sont les plus proches.
  • LES AUTRES, D'UN CLIC : après une correction, « Ranger aussi les N autres « … » » (montants affichés).
  • LES NOMS : une opération de banque renommée (« MCDO ARR » → « McDonald's ») — le nom revient aux imports
    suivants, variantes de lecture comprises (« MCDO AR »), et la catégorie suit le nom.
  • LES CHOIX D'IMPORT : « Ajouter », « Ignorer », « Pointer telle ligne » changés à la main pour un
    commerçant — proposés d'office la fois suivante (« 🧠 votre choix »). Le plus fréquent, le dernier à
    égalité.
  • VISIBLE ET RÉVERSIBLE : « 🧠 Ce que l'appli a appris de vous » (Saisie) — l'interrupteur « Apprendre
    de mes corrections », chaque règle apprise, 🗑 pour l'oublier.
  • L'IMPORT, SUR VOS CAPTURES DU 19/10 : un achat ne se pointe plus sur une ligne du Pilotage sans rapport
    (« Vidange Skoda » 0 / 6 000, « Divers Achats maison » déjà réglé) — sa catégorie doit être SÛRE et la
    ligne être la sienne (plusieurs lignes possibles — les filles d'une catégorie mère, des sœurs — : un mot
    commun ou le montant juste) ; jamais une ligne réglée ; une dépense exceptionnelle au montant juste seulement.
    Les 0,00 DH (vérifications de carte) ignorés. « Remonter » posé sur une date n'invente plus de libellé ;
    la date cachée est celle de l'opération voisine (« 18/10? »). Deux captures qui se chevauchent : la même
    opération lue autrement n'est comptée qu'une fois. « Compte chèque » reconnu Attijari par ses « PAIEMENT
    CB 18 10 26 » (plus de « sans compte, répondez à la question »).
  • STOCKAGE : parametres.apprentissage { actif, noms, actions, oublis }, dans le document unique. Les
    catégories s'apprennent des opérations elles-mêmes (rien à dupliquer). Rien dans n8n.
"""
import io, sys
F = 'index.html'
src = io.open(F, encoding='utf-8').read()
def sub(label, a, b, n=1):
    global src
    if src.count(a) != n: print('✖', label, ':', src.count(a), 'ancre(s),', n, 'attendue(s)'); sys.exit(1)
    src = src.replace(a, b)

# ── 1. La mémoire des catégories : vos choix d'abord, leurs montants, les oublis ─────────────────────────
sub('mémoire',
"""                    //  Ce que vos transactions déjà rangées apprennent : par libellé entier et par mot.
                    //  Un choix fait À LA MAIN (categorieSource « vous ») pèse trois fois plus.
                    const _memoireCategories = computed(() => {
                        calculationTick.value;
                        const exact = Object.create(null), mots = Object.create(null);
                        const vivantes = new Set(_categoriesCandidates.value.map(c => c.id));
                        const ajouter = (table, cle, t) => {
                            const e = table[cle] = table[cle] || Object.create(null);
                            const x = e[t.categorieId] = e[t.categorieId] || { p: 0, vous: false };
                            const vous = t.categorieSource === 'vous';
                            x.p += vous ? 3 : 1; x.vous = x.vous || vous;
                        };
                        Object.values(donneesAnnuelles.value || {}).forEach(d => (d && Array.isArray(d.transactionsReelles) ? d.transactionsReelles : []).forEach(t => {
                            if (!t || !t.categorieId || t.categorieId === 'cat_misc' || t.aVerifier || !vivantes.has(t.categorieId)) return;
                            const toks = _analyseLibelle(t.libelle).toks;
                            if (!toks.length) return;
                            ajouter(exact, toks.join(' '), t);
                            toks.forEach(w => ajouter(mots, w, t));
                        }));
                        return { exact, mots };
                    });
""",
"""                    /* ═══ v37.60 — L'APPRENTISSAGE ══════════════════════════════════════════════════════
                       Ce que l'application retient de VOS corrections : les catégories (apprises des
                       opérations elles-mêmes), les noms de commerçants, les choix d'import. Tout est dans
                       parametres.apprentissage { actif, noms, actions, oublis } ; « actif: false » coupe tout. */
                    const _apprLu = () => (parametres.value && parametres.value.apprentissage) || {};
                    const _appr = () => {
                        const p = parametres.value;
                        if (!p.apprentissage || typeof p.apprentissage !== 'object') p.apprentissage = {};
                        const a = p.apprentissage;
                        if (a.actif === undefined) a.actif = true;
                        ['noms', 'actions', 'oublis'].forEach(k => { if (!a[k] || typeof a[k] !== 'object' || Array.isArray(a[k])) a[k] = {}; });
                        return a;
                    };
                    const apprentissageActif = computed(() => { calculationTick.value; return _apprLu().actif !== false; });
                    const _medianeAppr = (l) => { const s = l.slice().sort((a, b) => a - b), k = s.length >> 1; return s.length ? (s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2) : 0; };

                    //  Ce que vos transactions déjà rangées apprennent : par libellé entier et par mot.
                    //  Un choix fait À LA MAIN (categorieSource « vous ») pèse trois fois plus — et, v37.60, il
                    //  l'emporte (voir categoriserLibelle) ; ses montants sont gardés : ils départagent deux choix.
                    //  Un libellé « oublié » (🗑 dans « Ce que l'appli a appris ») n'apprend plus rien.
                    const _memoireCategories = computed(() => {
                        calculationTick.value;
                        const exact = Object.create(null), mots = Object.create(null);
                        const vivantes = new Set(_categoriesCandidates.value.map(c => c.id));
                        const oublis = _apprLu().oublis || {};
                        const ajouter = (table, cle, t) => {
                            const e = table[cle] = table[cle] || Object.create(null);
                            const x = e[t.categorieId] = e[t.categorieId] || { p: 0, vous: false, m: [], n: 0, der: '' };
                            const vous = t.categorieSource === 'vous';
                            x.p += vous ? 3 : 1; x.vous = x.vous || vous;
                            if (vous) { x.n++; if (Number(t.montant) > 0) x.m.push(Number(t.montant)); if (String(t.date || '') > x.der) x.der = String(t.date || ''); }
                        };
                        Object.values(donneesAnnuelles.value || {}).forEach(d => (d && Array.isArray(d.transactionsReelles) ? d.transactionsReelles : []).forEach(t => {
                            if (!t || !t.categorieId || t.categorieId === 'cat_misc' || t.aVerifier || !vivantes.has(t.categorieId)) return;
                            const toks = _analyseLibelle(t.libelle).toks;
                            if (!toks.length || oublis[toks.join(' ')]) return;
                            ajouter(exact, toks.join(' '), t);
                            toks.forEach(w => ajouter(mots, w, t));
                        }));
                        return { exact, mots };
                    });
""")

# ── 2. La décision : vos choix l'emportent, le montant départage ─────────────────────────────────────────
sub('signature',
"""                    const categoriserLibelle = (libelle) => {
                        const A = _analyseLibelle(libelle);""",
"""                    const categoriserLibelle = (libelle, montant) => {
                        const A = _analyseLibelle(libelle);""")
sub('couche 1',
"""                        //  1. Vos corrections et vos saisies passées
                        const mem = _memoireCategories.value, cle = A.toks.join(' ');
                        const exact = mem.exact[cle];
                        if (exact) {
                            const total = Object.values(exact).reduce((s, x) => s + x.p, 0);
                            Object.entries(exact).forEach(([id, x]) => proposer(id, x.p / total >= 0.75 ? (x.vous ? 98 : 82) : 55,
                                x.vous ? 'vous' : 'appris', '« ' + cle + ' » déjà rangé ici'));
                        } else {
                            const votes = Object.create(null);
                            A.toks.forEach(w => Object.entries(mem.mots[w] || {}).forEach(([id, x]) => {
                                const v = votes[id] = votes[id] || { p: 0, vous: false }; v.p += x.p; v.vous = v.vous || x.vous; }));
                            const total = Object.values(votes).reduce((s, x) => s + x.p, 0);
                            Object.entries(votes).forEach(([id, x]) => proposer(id,
                                x.p / total >= 0.75 ? (x.vous ? (total >= 2 ? 88 : 80) : (total >= 2 ? 72 : 62)) : 50,
                                x.vous ? 'vous' : 'appris', 'des mots déjà rangés ici'));
                        }""",
"""                        //  1. Vos corrections et vos saisies passées (v37.60 : coupé si l'apprentissage l'est)
                        const mem = apprentissageActif.value ? _memoireCategories.value : { exact: {}, mots: {} }, cle = A.toks.join(' ');
                        const exact = mem.exact[cle];
                        //  v37.60 : UNE CORRECTION SUFFIT — dès que VOUS avez rangé ce libellé, seuls vos choix comptent ;
                        //  plusieurs choix : celui dont vos montants sont les plus proches (« Marjane » 50 ≠ 400), sinon le plus fréquent
                        const vousE = exact ? Object.entries(exact).filter(([, x]) => x.vous) : [];
                        const m = Math.abs(Number(montant) || 0);
                        if (vousE.length) {
                            let gagnant = null;
                            if (vousE.length > 1 && m > 0 && vousE.every(([, x]) => x.m.length)) {
                                const d = vousE.map(([id, x]) => ({ id, med: _medianeAppr(x.m), dist: Math.abs(Math.log(m) - Math.log(_medianeAppr(x.m))) })).sort((a, b) => a.dist - b.dist);
                                if (d[1].dist - d[0].dist >= Math.log(1.5)) gagnant = { id: d[0].id, raison: '« ' + cle + ' » autour de ' + Math.round(d[0].med) + ' DH : votre choix' };
                            }
                            if (!gagnant) {
                                const total = vousE.reduce((s, [, x]) => s + x.n, 0);
                                const [id, x] = vousE.slice().sort((a, b) => b[1].n - a[1].n || String(b[1].der).localeCompare(String(a[1].der)))[0];
                                if (x.n / total >= 0.6 || vousE.length === 1) gagnant = { id, raison: '« ' + cle + ' » : votre choix' + (x.n > 1 ? ' (' + x.n + ' fois)' : '') };
                            }
                            //  votre choix est une catégorie MÈRE et le libellé nomme une de ses lignes (« marjane » rangé dans
                            //  Alimentation, la ligne « Marjane ») : la ligne — votre famille, en plus précis (v37.56)
                            const fille = gagnant && cats.find(c => c.parent === gagnant.id && c.phrase === cle);
                            if (fille) gagnant = { id: fille.id, raison: '« ' + cle + ' » : votre catégorie, sa ligne « ' + fille.label + ' »' };
                            //  votre choix TRANCHE : ni une de vos lignes au même nom, ni le dictionnaire ne le contredisent
                            if (gagnant) return { id: gagnant.id, statut: 'sur', source: 'vous', score: 98, raison: gagnant.raison,
                                                  candidats: [gagnant.id, ...vousE.map(([id]) => id).filter(id => id !== gagnant.id)].slice(0, 3) };
                            vousE.forEach(([id]) => proposer(id, 60, 'vous', '« ' + cle + ' » : un de vos choix'));
                        } else if (exact) {
                            const total = Object.values(exact).reduce((s, x) => s + x.p, 0);
                            Object.entries(exact).forEach(([id, x]) => proposer(id, x.p / total >= 0.75 ? 82 : 55, 'appris', '« ' + cle + ' » déjà rangé ici'));
                        } else {
                            const votes = Object.create(null);
                            A.toks.forEach(w => Object.entries(mem.mots[w] || {}).forEach(([id, x]) => {
                                const v = votes[id] = votes[id] || { p: 0, vous: false }; v.p += x.p; v.vous = v.vous || x.vous; }));
                            //  v37.60 : des mots que VOUS avez rangés ? seuls ceux-là votent
                            const lesVotes = Object.entries(votes).some(([, x]) => x.vous) ? Object.entries(votes).filter(([, x]) => x.vous) : Object.entries(votes);
                            const total = lesVotes.reduce((s, [, x]) => s + x.p, 0);
                            lesVotes.forEach(([id, x]) => proposer(id,
                                x.p / total >= 0.75 ? (x.vous ? (total >= 2 ? 88 : 80) : (total >= 2 ? 72 : 62)) : 50,
                                x.vous ? 'vous' : 'appris', 'des mots déjà rangés ici'));
                        }""")

# ── 3. Le montant passé à la décision, partout où il est connu ─────────────────────────────────────────
sub('rattacher', "                                const r = categoriserLibelle(t.libelle);\n                                if (r.statut !== 'sur' || !r.id || r.id === t.categorieId) return;",
                 "                                const r = categoriserLibelle(t.libelle, t.montant);\n                                if (r.statut !== 'sur' || !r.id || r.id === t.categorieId) return;")
sub('saisie', "                            const r = categoriserLibelle(parsed.libelle);", "                            const r = categoriserLibelle(parsed.libelle, parsed.montant);")
sub('défaut', "                            const id = _categorieParDefaut(categoriserLibelle(t.libelle));", "                            const id = _categorieParDefaut(categoriserLibelle(t.libelle, t.montant));")
sub('à catégoriser', "                                const r = categoriserLibelle(t.libelle);\n                                const actuelle", "                                const r = categoriserLibelle(t.libelle, t.montant);\n                                const actuelle")

# ── 4. Le journal : une correction retenue, et les autres d'un clic ────────────────────────────────────
sub('journal état',
"""                        ouvert: null, brouillon: null, confirmerSuppression: null, archivesOuvertes: {}, famillesOuvertes: {},""",
"""                        ouvert: null, brouillon: null, confirmerSuppression: null, archivesOuvertes: {}, famillesOuvertes: {}, appris: null,""")
sub('ouvrir',
"""                        journal.ouvert = id; journal.confirmerSuppression = null;""",
"""                        journal.ouvert = id; journal.confirmerSuppression = null; journal.appris = null;""")
sub('enregistrer avant',
"""                        const t = s.arr[s.i];
                        const montant = Math.abs(Number(String(b.montant).replace(',', '.')));
                        if (!(montant > 0)) return false;""",
"""                        const t = s.arr[s.i];
                        const montant = Math.abs(Number(String(b.montant).replace(',', '.')));
                        if (!(montant > 0)) return false;
                        const avant = { libelle: t.libelle, categorieId: t.categorieId };   // v37.60 : ce que vous corrigez""")
sub('enregistrer après',
"""                        journal.ouvert = null; journal.brouillon = null;
                        calculationTick.value++;
                        handleDataChange();
                        return true;
                    };
                    const supprimerOperation = (id) => {""",
"""                        journal.ouvert = null; journal.brouillon = null;
                        _retenirCorrection(t, avant);
                        calculationTick.value++;
                        handleDataChange();
                        return true;
                    };
                    //  v37.60 — RETENIR UNE CORRECTION : le nom d'une opération de banque (pour les imports suivants), la
                    //  catégorie (apprise de l'opération elle-même) ; et proposer les opérations semblables, d'un clic.
                    const _cleMarchand = (s) => {
                        const n = bqLibNorm(s), c = _bqCoeur(n).replace(/^\\d{4,6}(?=[a-z])/, '');
                        return c.length >= 3 ? c : n;
                    };
                    const _cleLib = (s) => _analyseLibelle(s).toks.join(' ');
                    const _retenirCorrection = (t, avant) => {
                        journal.appris = null;
                        if (!apprentissageActif.value || !t) return null;
                        const lignes = [];
                        let k = null;
                        const renomme = t.source === 'banque' && String(t.libelle || '').trim() && t.libelle !== avant.libelle;
                        if (renomme) {
                            k = _cleMarchand(t.banqueMarchand || avant.libelle);
                            if (k) {
                                const a = _appr(), e = a.noms[k] || {};
                                a.noms[k] = { nom: t.libelle, brut: e.brut || avant.libelle, n: (e.n || 0) + 1, t: _ymd(new Date()) };
                                lignes.push('« ' + avant.libelle + ' » s\\'appellera « ' + t.libelle + ' » aux prochains imports');
                            }
                        }
                        const recat = t.categorieSource === 'vous' && t.categorieId && t.categorieId !== avant.categorieId;
                        if (recat) lignes.push('« ' + t.libelle + ' » → ' + _libCat(t.categorieId) + ', sans vous redemander');
                        if (!lignes.length) return null;
                        const cleAvant = _cleLib(avant.libelle);
                        const similaires = journalToutes.value.filter(x => x.t.id !== t.id && x.t.categorieSource !== 'vous' && (
                                (recat && _cleLib(x.t.libelle) === cleAvant && x.t.categorieId !== t.categorieId)
                             || (renomme && k && x.t.source === 'banque' && x.t.libelle === avant.libelle && _cleMarchand(x.t.banqueMarchand || x.t.libelle) === k)))
                            .map(x => ({ id: x.t.id, montant: x.montant }));
                        const ms = similaires.map(x => x.montant);
                        journal.appris = { lignes, similaires: similaires.map(x => x.id), min: ms.length ? Math.min(...ms) : 0, max: ms.length ? Math.max(...ms) : 0,
                                           libelle: renomme ? t.libelle : null, ancien: avant.libelle, categorieId: recat ? t.categorieId : null };
                        return journal.appris;
                    };
                    //  « Ranger aussi les N autres » : même libellé — renommées et/ou rangées comme vous l'avez fait
                    const appliquerAuxSimilaires = () => {
                        const a = journal.appris;
                        if (!a || !a.similaires.length) return 0;
                        let n = 0;
                        a.similaires.forEach(id => {
                            const t = _txParId(id);
                            if (!t) return;
                            if (a.libelle && t.source === 'banque' && t.libelle === a.ancien) t.libelle = a.libelle;
                            if (a.categorieId) { t.categorieId = a.categorieId; t.categorieSource = 'vous'; delete t.aVerifier; delete t.iaConfiance; }
                            n++;
                        });
                        journal.appris = { ...a, similaires: [], fait: n };
                        calculationTick.value++;
                        handleDataChange();
                        return n;
                    };
                    const supprimerOperation = (id) => {""")
sub('ranger',
"""                    const rangerTransaction = (txId, catId) => {
                        const t = _txParId(txId);
                        if (!t || !catId) return;
                        t.categorieId = catId; t.categorieSource = 'vous';""",
"""                    const rangerTransaction = (txId, catId) => {
                        const t = _txParId(txId);
                        if (!t || !catId) return;
                        const avant = { libelle: t.libelle, categorieId: t.categorieId };
                        t.categorieId = catId; t.categorieSource = 'vous';
                        if (avant.categorieId !== catId) _retenirCorrection(t, avant);   // v37.60""")

# ── 5. L'import : les noms appris, les choix appris ────────────────────────────────────────────────────
sub('proposer appris',
"""                    const _proposer = (cap, deja, reservees) => {""",
"""                    //  v37.60 — un nom ou un choix appris pour ce commerçant : la clé exacte, sinon une variante de lecture
                    //  (« MCDO AR » pour « MCDO ARR ») — jamais une clé de moins de 4 signes
                    const _apprisPour = (table, marchand) => {
                        if (!apprentissageActif.value) return null;
                        const T = _apprLu()[table] || {}, k = _cleMarchand(marchand);
                        if (!k) return null;
                        if (T[k]) return T[k];
                        const c = Object.keys(T).find(x => x.length >= 4 && k.length >= 4 && bqLibProche(x, k));
                        return c ? T[c] : null;
                    };
                    const _ACTIONS_APPRISES = /^(ajouter|ignorer|frais|pointer:.+)$/;
                    const _actionApprise = (marchand) => {
                        const e = _apprisPour('actions', marchand);
                        if (!e || !e.c) return null;
                        const [v, n] = Object.entries(e.c).sort((a, b) => b[1] - a[1] || (b[0] === e.dernier ? 1 : 0) - (a[0] === e.dernier ? 1 : 0))[0] || [];
                        return v && _ACTIONS_APPRISES.test(v) ? { v, n } : null;
                    };
                    const _appliquerChoixAppris = (l, reservees) => {
                        l.actionProposee = l.action;
                        if (l.action.startsWith('deja:')) return l;
                        const a = _actionApprise(l.marchandBrut || l.marchand);
                        if (!a) return l;
                        if (a.v === l.action) { l.appris = { ...(l.appris || {}), action: a.n }; return l; }
                        if (a.v.startsWith('pointer:')) {
                            const cle = a.v.slice(8);
                            if (reservees.has(cle)) return l;                                     // déjà pointée par une autre ligne
                            if (!l.cibles.some(c => c.cle === cle)) {
                                const t = [...tachesPilotageToutes.value, ...entreesPilotageToutes.value].find(x => x.cle === cle);
                                if (!t) return l;                                                 // cette ligne n'existe plus au Pilotage
                                l.cibles.push({ cle, libelle: t.libelle, due: t.due, regle: t.regle || 0, nature: t.nature, score: 0, famille: false });
                            }
                        }
                        if (!optionsLigneBanque(l).some(o => o.v === a.v)) return l;
                        if (l.action.startsWith('pointer:')) reservees.delete(l.action.slice(8));
                        if (a.v.startsWith('pointer:')) reservees.add(a.v.slice(8));
                        if (a.v === 'ajouter' && !l.cat) l.cat = categoriserLibelle(l.marchand, Math.abs(l.op.montant));
                        l.action = a.v; l.appris = { ...(l.appris || {}), action: a.n };
                        return l;
                    };
                    const _proposer = (cap, deja, reservees) => {""")
sub('proposer nom',
"""                        cap.lignes = prep.map(({ op, hash, e }) => {
                            const type = bqClasser(op), marchand = bqMarchand(op);
                            const l = { op, hash, type, marchand, cat: null, journal: null, cibles: [], action: 'ignorer', raison: '', dejaTraitee: null, doublon: false, decale: null };""",
"""                        cap.lignes = prep.map(({ op, hash, e }) => {
                            const type = bqClasser(op), marchand = bqMarchand(op);
                            //  v37.60 : le nom que vous lui avez donné — la catégorie suit ce nom
                            const nom = _apprisPour('noms', marchand);
                            const l = { op, hash, type, marchand: nom ? nom.nom : marchand, marchandBrut: marchand, appris: nom ? { nom: true } : null,
                                        cat: null, journal: null, cibles: [], action: 'ignorer', raison: '', dejaTraitee: null, doublon: false, decale: null };""")
sub('proposer catégories',
"""                                    if (type === 'achat') { l.cat = categoriserLibelle(marchand); l.action = 'corriger:' + tx.id; }""",
"""                                    if (type === 'achat') { l.cat = categoriserLibelle(l.marchand, Math.abs(op.montant)); l.action = 'corriger:' + tx.id; }""")
sub('proposer suite',
"""                            if (type === 'gab') { l.raison = 'Retrait espèces'; return l; }
                            if (type === 'frais') { l.action = 'frais'; return l; }
                            if (type === 'achat') {
                                l.cat = categoriserLibelle(marchand);
                                l.journal = _matchJournal(op, marchand, txPris);
                                if (l.journal) { txPris.add(l.journal.id); l.action = 'deja:' + l.journal.id; }
                            }
                            l.cibles = _ciblesPilotage(op, marchand, l.cat, type);
                            if (l.action.startsWith('deja:')) return l;""",
"""                            if (type === 'gab') { l.raison = 'Retrait espèces'; return _appliquerChoixAppris(l, reservees); }
                            if (type === 'frais') { l.action = 'frais'; return _appliquerChoixAppris(l, reservees); }
                            if (type === 'achat') {
                                l.cat = categoriserLibelle(l.marchand, Math.abs(op.montant));
                                l.journal = _matchJournal(op, marchand, txPris);
                                if (l.journal) { txPris.add(l.journal.id); l.action = 'deja:' + l.journal.id; }
                            }
                            l.cibles = _ciblesPilotage(op, l.marchand, l.cat, type);
                            if (l.action.startsWith('deja:')) return _appliquerChoixAppris(l, reservees);""")
sub('proposer fin',
"""                            if (libre) { reservees.add(libre.cle); l.action = 'pointer:' + libre.cle; return l; }
                            if (type === 'achat') { l.action = 'ajouter'; return l; }
                            l.raison = type === 'virement' ? 'Virement : déjà dans le solde' : 'Entrée : déjà dans le solde';
                            return l;""",
"""                            if (libre) { reservees.add(libre.cle); l.action = 'pointer:' + libre.cle; return _appliquerChoixAppris(l, reservees); }
                            if (type === 'achat') { l.action = 'ajouter'; return _appliquerChoixAppris(l, reservees); }
                            l.raison = type === 'virement' ? 'Virement : déjà dans le solde' : 'Entrée : déjà dans le solde';
                            return _appliquerChoixAppris(l, reservees);""")

# ── 6. Appliquer l'import : retenir les choix changés à la main ────────────────────────────────────────
sub('appliquer st',
"""                        const st = { ajoutees: 0, suspens: 0, deja: 0, pointees: 0, ignorees: 0, frais: 0, soldes: 0, corrigees: 0, retirees: 0 };""",
"""                        const st = { ajoutees: 0, suspens: 0, deja: 0, pointees: 0, ignorees: 0, frais: 0, soldes: 0, corrigees: 0, retirees: 0, appris: 0 };
                        //  v37.60 : un choix changé à la main pour ce commerçant est retenu ; un choix appris gardé est renforcé
                        const retenirChoix = (l) => {
                            if (!apprentissageActif.value || !_ACTIONS_APPRISES.test(l.action)) return;
                            const change = l.actionProposee && l.action !== l.actionProposee;
                            if (!change && !(l.appris && l.appris.action)) return;
                            const k = _cleMarchand(l.marchandBrut || l.marchand);
                            if (!k) return;
                            const a = _appr(), e = a.actions[k] || { c: {} };
                            e.c = { ...(e.c || {}), [l.action]: ((e.c || {})[l.action] || 0) + 1 };
                            a.actions[k] = { ...e, dernier: l.action, brut: l.marchandBrut || l.marchand, nom: l.marchand, t: _ymd(new Date()) };
                            if (change) st.appris++;
                        };""")
sub('appliquer boucle',
"""                            (cap.lignes || []).forEach(l => {
                                if (l.dejaTraitee || l.doublon) return;
                                const [a, cible] = [l.action.split(':')[0], l.action.split(':').slice(1).join(':')];""",
"""                            (cap.lignes || []).forEach(l => {
                                if (l.dejaTraitee || l.doublon) return;
                                retenirChoix(l);
                                const [a, cible] = [l.action.split(':')[0], l.action.split(':').slice(1).join(':')];""")
sub('appliquer marchand brut',
"""                                    const extra = { categorieId: r.id || 'cat_misc', banqueHash: l.hash, banqueLibelle: l.op.libelle, banqueMarchand: bqLibNorm(l.marchand) };""",
"""                                    const extra = { categorieId: r.id || 'cat_misc', banqueHash: l.hash, banqueLibelle: l.op.libelle, banqueMarchand: bqLibNorm(l.marchandBrut || l.marchand) };""")
sub('appliquer corriger brut',
"""                                        tx.libelle = l.marchand; tx.banqueLibelle = l.op.libelle; tx.banqueMarchand = bqLibNorm(l.marchand); tx.banqueHash = l.hash;""",
"""                                        tx.libelle = l.marchand; tx.banqueLibelle = l.op.libelle; tx.banqueMarchand = bqLibNorm(l.marchandBrut || l.marchand); tx.banqueHash = l.hash;""")
sub('appliquer catégorie',
"""                                    const r = l.cat || categoriserLibelle(l.marchand), sur = r.statut === 'sur';""",
"""                                    const r = l.cat || categoriserLibelle(l.marchand, Math.abs(l.op.montant)), sur = r.statut === 'sur';""")
sub('appliquer catégorie 2',
"""                                            const r = l.cat || categoriserLibelle(l.marchand);""",
"""                                            const r = l.cat || categoriserLibelle(l.marchand, Math.abs(l.op.montant));""")

# ── 7. « Ce que l'appli a appris de vous » : voir, oublier, couper ─────────────────────────────────────
sub('vue apprentissage',
"""                    const reglesCategorisation = computed(() => {""",
"""                    //  v37.60 — CE QUE L'APPLI A APPRIS DE VOUS
                    const _LIB_ACTION = (v) => v === 'ajouter' ? '➕ ajouter au journal' : v === 'ignorer' ? '🚫 ignorer' : v === 'frais' ? '🧾 frais bancaires'
                        : /^pointer:/.test(v) ? '📌 pointer « ' + ((([...tachesPilotageToutes.value, ...entreesPilotageToutes.value].find(t => t.cle === v.slice(8)) || {}).libelle) || v.slice(8).split(':').pop()) + ' »' : v;
                    const apprentissageVue = computed(() => {
                        calculationTick.value;
                        const a = _apprLu(), mem = _memoireCategories.value;
                        const categories = Object.entries(mem.exact).map(([cle, t]) => {
                            const vous = Object.entries(t).filter(([, x]) => x.vous).sort((p, q) => q[1].n - p[1].n);
                            if (!vous.length) return null;
                            return { cle, n: vous.reduce((s, [, x]) => s + x.n, 0), der: vous.map(([, x]) => x.der).sort().pop() || '',
                                     vers: vous.map(([id, x]) => ({ id, label: _libCat(id), n: x.n, autour: vous.length > 1 && x.m.length ? Math.round(_medianeAppr(x.m)) : null })) };
                        }).filter(Boolean).sort((p, q) => String(q.der).localeCompare(String(p.der)) || q.n - p.n);
                        const noms = Object.entries(a.noms || {}).map(([k, e]) => ({ k, brut: e.brut || k, nom: e.nom, n: e.n || 1, t: e.t || '' })).sort((p, q) => String(q.t).localeCompare(String(p.t)));
                        const actions = Object.entries(a.actions || {}).map(([k, e]) => {
                            const [v, n] = Object.entries(e.c || {}).sort((p, q) => q[1] - p[1] || (q[0] === e.dernier ? 1 : 0) - (p[0] === e.dernier ? 1 : 0))[0] || [];
                            return v ? { k, nom: e.nom || e.brut || k, action: _LIB_ACTION(v), n, t: e.t || '' } : null;
                        }).filter(Boolean).sort((p, q) => String(q.t).localeCompare(String(p.t)));
                        return { actif: a.actif !== false, categories, noms, actions, oublis: Object.keys(a.oublis || {}).length,
                                 total: categories.length + noms.length + actions.length };
                    });
                    const _apprModifie = () => { calculationTick.value++; handleDataChange(); };
                    const basculerApprentissage = () => { const a = _appr(); a.actif = a.actif === false; _apprModifie(); };
                    const oublierCategorieApprise = (cle) => { _appr().oublis[cle] = true; _apprModifie(); };
                    const oublierNomAppris = (k) => { delete _appr().noms[k]; _apprModifie(); };
                    const oublierActionApprise = (k) => { delete _appr().actions[k]; _apprModifie(); };
                    const reapprendreTout = () => { _appr().oublis = {}; _apprModifie(); };
                    const reglesCategorisation = computed(() => {""")

# ── 8. L'écran ───────────────────────────────────────────────────────────────────────────────────────
sub('tpl journal appris',
"""                                <span v-if="journalResume.sansDate" class="text-red-700"> · 📅 {{ journalResume.sansDate }} sans date</span>
                            </p>""",
"""                                <span v-if="journalResume.sansDate" class="text-red-700"> · 📅 {{ journalResume.sansDate }} sans date</span>
                            </p>
                            <!-- v37.60 : la correction retenue, et les opérations semblables d'un clic -->
                            <div v-if="journal.appris" data-journal-appris class="flex flex-wrap items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-[11px] font-bold text-violet-900">
                                <span class="mr-auto">🧠 Retenu : <span v-for="(t, i) in journal.appris.lignes" :key="'ja_' + i">{{ i ? ' · ' : '' }}{{ t }}</span>.
                                    <span v-if="journal.appris.fait" data-journal-appris-fait class="text-emerald-700"> ✓ {{ journal.appris.fait }} autre(s) mise(s) à jour.</span></span>
                                <button v-if="journal.appris.similaires.length" type="button" data-journal-appris-similaires @click="appliquerAuxSimilaires()"
                                        class="px-2.5 py-1 rounded-lg text-white bg-violet-600 hover:bg-violet-700">Aussi les {{ journal.appris.similaires.length }} autre(s) « {{ journal.appris.ancien }} »<template v-if="journal.appris.max"> ({{ journal.appris.min === journal.appris.max ? formatMAD(journal.appris.min) : formatMAD(journal.appris.min) + ' à ' + formatMAD(journal.appris.max) }})</template></button>
                                <button type="button" data-journal-appris-fermer @click="journal.appris = null" class="text-violet-500 hover:text-violet-800">✕</button>
                            </div>""")
sub('tpl import nom',
"""                                        <span class="text-xs font-bold text-gray-900 truncate" :title="l.op.libelle">{{ l.type === 'achat' ? l.marchand : l.op.libelle }}</span>""",
"""                                        <span class="text-xs font-bold text-gray-900 truncate" :title="l.op.libelle">{{ l.type === 'achat' || (l.appris && l.appris.nom) ? l.marchand : l.op.libelle }}</span>
                                        <span v-if="l.appris && l.appris.nom" data-import-nom-appris class="text-[10px] shrink-0" :title="'Lu : ' + l.marchandBrut + ' — le nom que vous lui avez donné'">🧠</span>""")
sub('tpl import badge',
"""                                        <template v-else>
                                            <span v-if="l.decale" data-import-badge="decale\"""",
"""                                        <template v-else>
                                            <span v-if="l.appris && l.appris.action" data-import-badge="appris" class="text-[10px] font-black px-2 py-0.5 rounded-full bg-violet-50 text-violet-800 border border-violet-200" title="Le choix que vous avez fait pour ce commerçant">🧠 votre choix{{ l.appris.action > 1 ? ' (' + l.appris.action + '×)' : '' }}</span>
                                            <span v-if="l.decale" data-import-badge="decale\"""")
sub('tpl import fini',
"""                        <li>✓ {{ importBanque.resume.deja }} déjà dans le journal</li>""",
"""                        <li v-if="importBanque.resume.appris" data-import-fini-appris>🧠 {{ importBanque.resume.appris }} choix retenu(s) : proposés d'office au prochain import</li>
                        <li>✓ {{ importBanque.resume.deja }} déjà dans le journal</li>""")
sub('tpl panneau',
"""                    <!-- v37.49 : les règles de catégorisation, visibles -->""",
"""                    <!-- v37.60 : ce que l'appli a appris de vous -->
                    <details data-apprentissage class="bg-white rounded-2xl border border-violet-200 shadow-sm overflow-hidden"
                             :open="uiOuvert('saisie.apprentissage', false)" @toggle="uiFixer('saisie.apprentissage', $event.target.open)">
                        <summary class="px-4 md:px-6 py-3 cursor-pointer select-none font-black uppercase tracking-widest text-violet-800 text-xs md:text-sm">
                            🧠 Ce que l'appli a appris de vous <span data-apprentissage-compte class="normal-case tracking-normal font-semibold text-gray-500">— {{ apprentissageVue.actif ? apprentissageVue.total + ' règle(s)' : 'apprentissage coupé' }}</span>
                        </summary>
                        <div class="px-4 md:px-6 pb-4 space-y-3 text-[11px]">
                            <label class="flex items-start gap-2 cursor-pointer select-none rounded-xl bg-violet-50 border border-violet-100 px-3 py-2">
                                <input type="checkbox" data-apprentissage-actif :checked="apprentissageVue.actif" @change="basculerApprentissage()" class="mt-0.5 accent-violet-600"/>
                                <span><b class="text-violet-900">Apprendre de mes corrections</b><br><span class="text-gray-600">Une catégorie, un nom, un choix d'import corrigé une fois : retenu pour la suite. Vos choix l'emportent sur ce que l'appli devine ; le montant départage un même libellé rangé à deux endroits.</span></span>
                            </label>
                            <template v-if="apprentissageVue.actif">
                                <div data-apprentissage-categories>
                                    <p class="font-black text-gray-700 mb-1">🗂️ Catégories · {{ apprentissageVue.categories.length }}</p>
                                    <p v-if="!apprentissageVue.categories.length" class="text-gray-500 italic">Rien encore : changez la catégorie d'une opération (journal, « À catégoriser ») et elle sera retenue.</p>
                                    <ul class="max-h-60 overflow-y-auto divide-y divide-gray-100">
                                        <li v-for="c in apprentissageVue.categories" :key="'apc_' + c.cle" data-apprentissage-categorie :data-cle="c.cle" class="py-1 flex items-start gap-2">
                                            <span class="flex-1">« {{ c.cle }} » → <template v-for="(x, i) in c.vers" :key="x.id"><span v-if="i"> · </span><b>{{ x.label }}</b><span v-if="x.autour" class="text-gray-500"> (autour de {{ formatMAD(x.autour) }})</span></template> <span class="text-gray-400">· {{ c.n }}×</span></span>
                                            <button type="button" data-apprentissage-oublier @click="oublierCategorieApprise(c.cle)" class="text-red-600 hover:underline shrink-0" title="Oublier : ce libellé n'apprend plus rien">🗑</button>
                                        </li>
                                    </ul>
                                    <p v-if="apprentissageVue.oublis" class="text-gray-500 mt-1">{{ apprentissageVue.oublis }} libellé(s) oublié(s) · <button type="button" data-apprentissage-reapprendre @click="reapprendreTout()" class="text-blue-700 hover:underline">tout réapprendre</button></p>
                                </div>
                                <div data-apprentissage-noms>
                                    <p class="font-black text-gray-700 mb-1">🏷️ Noms des commerçants (imports) · {{ apprentissageVue.noms.length }}</p>
                                    <p v-if="!apprentissageVue.noms.length" class="text-gray-500 italic">Renommez une opération importée de la banque (« MCDO ARR » → « McDonald's ») : le nom reviendra à chaque import.</p>
                                    <ul class="divide-y divide-gray-100">
                                        <li v-for="x in apprentissageVue.noms" :key="'apn_' + x.k" data-apprentissage-nom class="py-1 flex items-start gap-2">
                                            <span class="flex-1">« {{ x.brut }} » → <b>{{ x.nom }}</b></span>
                                            <button type="button" @click="oublierNomAppris(x.k)" class="text-red-600 hover:underline shrink-0">🗑</button>
                                        </li>
                                    </ul>
                                </div>
                                <div data-apprentissage-actions>
                                    <p class="font-black text-gray-700 mb-1">🏦 Vos choix à l'import · {{ apprentissageVue.actions.length }}</p>
                                    <p v-if="!apprentissageVue.actions.length" class="text-gray-500 italic">Changez « Ajouter / Ignorer / Pointer » pour une ligne d'import : ce commerçant aura ce choix d'office la fois suivante.</p>
                                    <ul class="divide-y divide-gray-100">
                                        <li v-for="x in apprentissageVue.actions" :key="'apa_' + x.k" data-apprentissage-action class="py-1 flex items-start gap-2">
                                            <span class="flex-1">« {{ x.nom }} » → <b>{{ x.action }}</b> <span class="text-gray-400">· {{ x.n }}×</span></span>
                                            <button type="button" @click="oublierActionApprise(x.k)" class="text-red-600 hover:underline shrink-0">🗑</button>
                                        </li>
                                    </ul>
                                </div>
                            </template>
                        </div>
                    </details>

                    <!-- v37.49 : les règles de catégorisation, visibles -->""")

# ══ L'IMPORT, SUR VOS CAPTURES DU 19/10 ═══════════════════════════════════════════════════════════════
# 10. Le bouton « Remonter » posé sur une DATE : « TREN;LRR 1 Remonter » n'est pas un libellé (il se collait à
#     « MEGARA »). Une ligne « Remonter » sans montant, suivie ni d'une date ni d'un montant, est écartée.
sub('remonter ligne',
"""                            //  un petit mot seul (« ok », « box ») sous un libellé : la fin de ce libellé, passée à la ligne
                            const prec = out[out.length - 1];""",
"""                            //  v37.60 : le bouton « Remonter » posé sur une date — ce qui reste dessous n'est pas un libellé
                            if (/\\bremonter\\b/i.test(l) && !/\\d[,.]\\d{2}\\b/.test(l) && s && !/\\d[,.]\\d{2}\\b/.test(s)
                                && !new RegExp('^\\\\d{1,2}(er)? ?(' + BQ_RE_MOIS + ')\\\\.?(\\\\s|$)|^\\\\d{1,2}[\\\\/.-]\\\\d{1,2}', 'i').test(s)) continue;
                            //  un petit mot seul (« ok », « box ») sous un libellé : la fin de ce libellé, passée à la ligne
                            const prec = out[out.length - 1];""")

# 11. L'écran « Compte chèque » sans « AWBGAB » ni « VIR WEB » : les lignes « PAIEMENT CB 18 10 26 » suffisent
sub('attijari cb',
"""                                    + (/paiement cb ?\\d{2}/.test(nTout) ? 2 : 0) + (/\\bvir web\\b/.test(nTout) ? 1 : 0)   // v37.59 : l'écran « Compte chèque »""",
"""                                    + Math.min(3, (nTout.match(/paiement cb ?\\d{2} ?\\d{2} ?\\d{2}/g) || []).length) + (/\\bvir web\\b/.test(nTout) ? 1 : 0)   // v37.59-60 : l'écran « Compte chèque »""")

# 12. Une date cachée (sous « Remonter ») : celle de l'opération voisine, dans une liste rangée par date
sub('date déduite',
"""                        //  v37.55 : Attijari Mobile — le solde du COMPTE CHÈQUE est celui qui suit son libellé ; un montant sans""",
"""                        //  v37.60 : une date cachée (sous le bouton « Remonter ») — la liste est rangée par date : celle de
                        //  l'opération suivante (sinon de la précédente), signalée « déduite »
                        if (essais[0].tt === 'L') operations.forEach((o, i) => {
                            if (o.dateOp && !o.sansDateOp) return;
                            const v = operations.slice(i + 1).find(x => x.dateOp && !x.sansDateOp) || operations.slice(0, i).reverse().find(x => x.dateOp && !x.sansDateOp);
                            if (!v) return;
                            o.dateOp = v.dateOp; o.date = o.dateAchat || v.dateOp; o.dateDeduite = true;
                        });
                        //  v37.55 : Attijari Mobile — le solde du COMPTE CHÈQUE est celui qui suit son libellé ; un montant sans""")

# 13. Deux captures qui se chevauchent : la même opération lue un peu autrement (« Google MBC &@ » / « Google MBC
#     Shahid »), une date déduite — même compte, même montant, libellé proche : un doublon, pas un second ajout.
#     Un montant NUL (vérification de carte « GOOGLE PAYMENTS 0,00 ») : ignoré, jamais ajouté.
sub('doublon flou',
"""                            if (deja.has(hash)) { l.doublon = true; l.action = 'aucune'; return l; }
                            deja.add(hash);""",
"""                            const vus = deja.vus || (deja.vus = []), cents = Math.round(op.montant * 100), dOp = op.dateOp || op.date, lib = bqLibNorm(op.libelle);
                            const autre = !deja.has(hash) && vus.find(v => v.cap !== cap.id && !v.pris && String(v.c) === String(cap.compteId) && v.m === cents && bqLibProche(v.l, lib)
                                && (v.d === dOp || v.deduite || op.dateDeduite || op.sansDateOp || Math.abs(new Date(v.d) - new Date(dOp)) <= 864e5));
                            if (deja.has(hash) || autre) { if (autre) autre.pris = true; l.doublon = true; l.action = 'aucune'; return l; }
                            deja.add(hash);
                            vus.push({ cap: cap.id, c: cap.compteId, d: dOp, m: cents, l: lib, deduite: !!(op.dateDeduite || op.sansDateOp), pris: false });""")
sub('montant nul',
"""                            if (type === 'gab') { l.raison = 'Retrait espèces'; return _appliquerChoixAppris(l, reservees); }""",
"""                            if (!cents) { l.type = 'nul'; l.raison = 'Montant nul : une vérification de carte'; return l; }   // v37.60
                            if (type === 'gab') { l.raison = 'Retrait espèces'; return _appliquerChoixAppris(l, reservees); }""")
sub('montant nul signe',
"""{{ l.op.montant > 0 ? '+' : '−' }}{{ formatMAD(Math.abs(l.op.montant)) }}""",
"""{{ l.op.montant > 0 ? '+' : (l.op.montant < 0 ? '−' : '') }}{{ formatMAD(Math.abs(l.op.montant)) }}""")
sub('montant nul couleur',
"""<span :class="['text-xs font-black tabular-nums shrink-0', l.op.montant < 0 ? 'text-red-700' : 'text-emerald-700']">""",
"""<span :class="['text-xs font-black tabular-nums shrink-0', l.op.montant < 0 ? 'text-red-700' : (l.op.montant > 0 ? 'text-emerald-700' : 'text-gray-400')]">""")
sub('badge nul',
"""                                            <span v-else-if="l.type === 'gab'" data-import-badge="gab\"""",
"""                                            <span v-else-if="l.type === 'nul'" data-import-badge="nul" class="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">0 DH : vérification de carte</span>
                                            <span v-else-if="l.type === 'gab'" data-import-badge="gab\"""")
sub('date déduite affichée',
"""                                        <span class="text-[10px] font-bold text-gray-500 tabular-nums shrink-0">{{ (l.op.date || '').slice(8, 10) }}/{{ (l.op.date || '').slice(5, 7) }}</span>""",
"""                                        <span class="text-[10px] font-bold text-gray-500 tabular-nums shrink-0" :title="l.op.dateDeduite ? 'Date cachée sur la capture : celle de l’opération voisine' : ''">{{ (l.op.date || '').slice(8, 10) }}/{{ (l.op.date || '').slice(5, 7) }}{{ l.op.dateDeduite ? '?' : '' }}</span>""")

# 14. LE POINTAGE D'UN ACHAT : plus jamais sur une ligne sans rapport. Avant : une catégorie seulement DEVINÉE
#     (une piste parmi trois, une catégorie « sœur ») suffisait — « GOOGLE PAYMENTS » pointé sur « Vidange Skoda »
#     (0 / 6 000), « Google MBC » sur « Divers Achats maison » déjà réglé (1 200 / 1 200). Désormais un achat ne
#     se pointe par sa catégorie que si elle est SÛRE et que la ligne est cette catégorie (ou sa mère, ou sa
#     fille) ; jamais sur une ligne déjà réglée ; une dépense exceptionnelle seulement au montant juste.
sub('pointage achat',
"""                        return pool.map(t => {
                            const reste = Math.max(0, t.due - (t.regle || 0));
                            const cat = t.ref && t.ref.categorieId;
                            let s = 0, famille = false;
                            if (Math.abs(reste - m) <= 1 || Math.abs(t.due - m) <= 1) s += 50;
                            if (parMots) {""",
"""                        return pool.map(t => {
                            const reste = Math.max(0, t.due - (t.regle || 0));
                            const cat = t.ref && t.ref.categorieId;
                            let s = 0, famille = false;
                            const juste = Math.abs(reste - m) <= 1 || Math.abs(t.due - m) <= 1;
                            if (juste) s += 50;
                            //  v37.60 — un achat : jamais une ligne réglée ; une exceptionnelle au montant juste ; sa catégorie
                            //  seulement SÛRE, et la ligne est cette catégorie, sa mère ou sa fille (pas une sœur, pas une piste)
                            if (type === 'achat') {
                                if (reste <= 0.5 || (t.nature === 'exceptionnel' && !juste)) return null;
                                //  plusieurs lignes de cette catégorie (Factures : elect, eau, tel…) : la catégorie ne dit pas LAQUELLE —
                                //  il faut un mot commun ou le montant juste
                                const mot = bqNorm(t.libelle).split(/[^a-z0-9]+/).some(w => w.length >= 4 && mots.has(w));
                                //  la ligne a la catégorie de l'achat, sa mère ou sa fille — et elle est la SEULE dans ce lien (sinon un mot
                                //  commun ou le montant juste) ; une SŒUR (même mère : « elect », « elect marrakech villa ») seulement
                                //  avec un mot commun ou le montant juste
                                const lien = (c) => !c || !r || !r.id ? null : c === r.id ? 'meme' : parents.get(r.id) === c ? 'mere' : parents.get(c) === r.id ? 'fille'
                                                  : (pr && parents.get(c) === pr) ? 'soeur' : null;
                                const l0 = lien(cat);
                                const seule = l0 && pool.filter(x => lien(x.ref && x.ref.categorieId) === l0).length <= 1;
                                if (r && r.statut === 'sur' && l0 && (mot || juste || (l0 !== 'soeur' && seule))) { s += 45; famille = true; }
                                if (mot) s += 30;
                                if (t.paye) s -= 25;
                                return { cle: t.cle, libelle: t.libelle, due: t.due, regle: t.regle || 0, nature: t.nature, score: s, famille };
                            }
                            if (parMots) {""")
sub('pointage filtre',
"""                        }).filter(c => c.score >= (type === 'achat' ? (c.famille ? 10 : 40) : 50)).sort((a, b) => b.score - a.score).slice(0, 3);""",
"""                        }).filter(c => c && c.score >= (type === 'achat' ? (c.famille ? 10 : 40) : 50)).sort((a, b) => b.score - a.score).slice(0, 3);""")

# ── 9. Exposé ─────────────────────────────────────────────────────────────────────────────────────────
sub('export',
"""                        ouvrirOperation, enregistrerOperation, supprimerOperation, ressaisirOperation, filtrerJournalCategorie, filtrerJournalLibelle, effacerFiltresJournal,
""",
"""                        ouvrirOperation, enregistrerOperation, supprimerOperation, ressaisirOperation, filtrerJournalCategorie, filtrerJournalLibelle, effacerFiltresJournal,
                        apprentissageVue, apprentissageActif, basculerApprentissage, oublierCategorieApprise, oublierNomAppris, oublierActionApprise, reapprendreTout, appliquerAuxSimilaires,
""")

io.open(F, 'w', encoding='utf-8').write(src)
print('✔ v37.60 Apprentissage : catégories (vos choix, le montant), noms, choix d’import, panneau ; import : pointage, 0 DH, Remonter, doublons')
