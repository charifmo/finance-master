# -*- coding: utf-8 -*-
"""
v37.61 — LA SAISIE, SIMPLE ET JUSTE.

« Fais un audit de la partie saisie pour la rendre la plus simple à utiliser de ma part, et détecte les
erreurs et problèmes. » L'audit, l'application ouverte en téléphone (390 px), vos gestes rejoués :
  ERREURS
  • « Marjane 1 250 » enregistrait 1 DH ; « 7up 10 » 7 DH ; « iam 4g 50 » 4 DH ; « 1.250 loyer » 1,25 DH ;
    « café 15dh » le libellé « café dh ». → un nombre collé à des lettres est un nom ; « 1 250 » et « 1.250 »
    sont des milliers ; le nombre en fin (sinon en tête) de texte est le montant ; DH / MAD / درهم avalés ;
    chiffres arabes (١٥٠) compris.
  • Effacer le nombre (« 50 café » → « café ») laissait 50 DH prêt à partir ; effacer le libellé le gardait.
  • La page restée ouverte : la saisie prenait l'heure du formulaire précédent (hier 09:30 au lieu de
    20:40, le mauvais jour, le mauvais cycle). → « Maintenant » vaut l'instant de la validation, tant que vous
    n'avez pas choisi une date.
  • Une saisie datée d'une autre année tombait dans l'année AFFICHÉE (le 2 janvier compté en janvier de
    l'année d'avant) ; l'année absente : la saisie disparaissait, le formulaire vidé comme si de rien
    n'était. → l'année de la date, créée au besoin (copie de la plus proche) ; un échec garde le formulaire.
  • Le libellé changé dans « ⚙️ Ajuster » ne changeait pas la catégorie ; « — Catégorie — » choisi rangeait
    « à la main » dans « non catégorisé ».
  • La liste des catégories de la saisie : six lignes vides « — », des catégories de REVENUS, « Misc », les
    lignes à plat. → la liste du journal : familles, leurs lignes, rien de vide.
  • Le résumé d'un journal vide : « −0 DH ».
  PLUS SIMPLE
  • ⚡ Saisie rapide (le ➕) : le clavier s'ouvre tout de suite ; un seul champ, puis l'étiquette (montant,
    catégorie, compte, date) comme sur la page ; « ⚙️ Ajuster » pour le reste (au lieu de 7 champs).
  • Après chaque saisie : « ✓ café · 15 DH → Sorties » et « ↶ Annuler » (6 secondes).
  • « ⚠️ déjà saisi aujourd'hui à 08:30 » : même libellé, même montant, le même jour.
  • Le COMPTE appris : celui de votre dernière saisie du même libellé (« 🏦 … · appris »).
  • Téléphone : les filtres du journal repliés (« ⚙️ Filtres »), la page assez longue pour que les boutons
    flottants ne cachent plus rien ; le compteur « N op. ce cycle ».
"""
import io, sys
F = 'index.html'
src = io.open(F, encoding='utf-8').read()
def sub(label, a, b, n=1):
    global src
    if src.count(a) != n: print('✖', label, ':', src.count(a), 'ancre(s),', n, 'attendue(s)'); sys.exit(1)
    src = src.replace(a, b)

# ── 1. Le montant dans le texte ──────────────────────────────────────────────────────────────────────
sub('parse',
"""                    // Parse "400 courses" → { montant: 400, libelle: "courses" }
                    const _parseSaisieRapide = (txt) => {
                        const s = String(txt || '').trim();
                        if (!s) return null;
                        const m = s.match(/(-?\\d+(?:[.,]\\d+)?)/);
                        if (!m) return null;
                        const montant = parseFloat(m[1].replace(',', '.'));
                        if (!montant || montant <= 0) return null;
                        const libelle = s.replace(m[0], '').trim() || 'Sans libellé';
                        return { montant, libelle };
                    };""",
"""                    //  v37.61 — LE MONTANT DANS LE TEXTE. « 400 courses » → 400 + « courses ». Un nombre collé à des lettres
                    //  est un nom (« 7up », « 4g ») ; « 1 250 » et « 1.250 » sont des milliers ; plusieurs nombres : celui de la
                    //  fin, sinon celui du début, sinon le dernier ; DH / MAD / درهم avalés ; chiffres arabes compris.
                    //  → { montant (null s'il n'y en a pas), libelle } ; null pour un texte vide.
                    const _DEVISE_SAISIE = /^(dhs?|mad|drh|dirhams?|درهم|دراهم)$/i;
                    const _parseSaisieRapide = (txt) => {
                        const s = String(txt || '').replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x6F0))
                            .replace(/[\\u00a0\\u202f]/g, ' ').replace(/\\s+/g, ' ').trim();
                        if (!s) return null;
                        const re = /(^|[^\\p{L}\\p{N}.,])(\\d{1,3}(?:[ .]\\d{3})+(?:,\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)(?=$|[^\\p{L}\\p{N}]|(?:dhs?|mad|درهم)(?!\\p{L}))/giu;
                        const cands = [];
                        let m;
                        while ((m = re.exec(s))) {
                            const debut = m.index + m[1].length, txt = m[2];
                            const v = /[ .]\\d{3}(?:,|$)/.test(txt) && /^\\d{1,3}(?:[ .]\\d{3})+/.test(txt)
                                ? Number(txt.replace(/[ .]/g, '').replace(',', '.')) : Number(txt.replace(',', '.'));
                            cands.push({ debut, fin: debut + txt.length, v });
                        }
                        const ok = cands.filter(c => c.v > 0);
                        const pris = ok.find(c => !s.slice(c.fin).replace(/^\\s*(dhs?|mad|drh|dirhams?|درهم|دراهم)(?!\\p{L})/iu, '').trim())
                                  || ok.find(c => !s.slice(0, c.debut).trim()) || ok[ok.length - 1] || null;
                        const reste = pris ? (s.slice(0, pris.debut) + ' ' + s.slice(pris.fin)) : s;
                        const libelle = reste.split(' ').filter(w => w && !_DEVISE_SAISIE.test(w.replace(/[.,;:]+$/, '')))
                            .join(' ').replace(/^[\\s,;:.\\-–—]+|[\\s,;:\\-–—]+$/g, '').trim();
                        return { montant: pris ? Math.round(pris.v * 100) / 100 : null, libelle: libelle || 'Sans libellé' };
                    };""")

# ── 2. Le formulaire : ce que vous avez touché (date, montant, libellé, compte), les erreurs, l'annulation ──
sub('form init',
"""                    const saisieForm = ref({
                        datetime: _nowLocalDateTime(),
                        libelle: '',
                        montant: null,
                        categorieId: '',
                        compteId: null,
                    });""",
"""                    const saisieForm = ref({
                        datetime: _nowLocalDateTime(),
                        libelle: '',
                        montant: null,
                        categorieId: '',
                        compteId: null,
                        dateFixee: false, montantManuel: false, libelleManuel: false, compteManuel: false,   // v37.61
                    });
                    //  v37.61 : le compte appris (votre dernière saisie du même libellé), l'erreur d'enregistrement, et
                    //  l'annonce « ✓ ajouté » avec son « ↶ Annuler »
                    const saisieCompteAppris = ref(false);
                    const saisieErreur = ref('');
                    const saisieAnnonce = reactive({ texte: '', txId: null, minuterie: null });""")
sub('reset',
"""                            categorieId: '',
                            compteId: saisieCompteDefaut.value || (Array.isArray(comptes.value) && comptes.value[0] ? comptes.value[0].id : null),
                        };
                        saisieRapide.value = '';""",
"""                            categorieId: '',
                            compteId: saisieCompteDefaut.value || (Array.isArray(comptes.value) && comptes.value[0] ? comptes.value[0].id : null),
                            dateFixee: false, montantManuel: false, libelleManuel: false, compteManuel: false,
                        };
                        saisieCompteAppris.value = false; saisieErreur.value = '';
                        saisieRapide.value = '';""")
sub('choisir',
"""                    const choisirCategorieSaisie = (catId) => {
                        saisieForm.value.categorieId = catId;""",
"""                    const choisirCategorieSaisie = (catId) => {
                        //  v37.61 : « 🤖 Automatique » (aucune catégorie) rend la main aux règles, ce n'est pas un choix
                        if (!catId) { saisieCatSource.value = null; _categoriserSaisie(); return; }
                        saisieForm.value.categorieId = catId;""")
sub('watch',
"""                    // Watch sur smart input → remplit le formulaire en temps réel
                    watch(saisieRapide, (txt) => {
                        const s = String(txt || '').trim();
                        if (!s) { saisieCatSource.value = null; saisieCatStatut.value = null; saisieCatRaison.value = ''; saisieCatSuggestions.value = []; return; }
                        const parsed = _parseSaisieRapide(s);
                        if (!parsed) return;
                        if (parsed.montant > 0) saisieForm.value.montant = parsed.montant;
                        if (parsed.libelle && parsed.libelle !== 'Sans libellé') {
                            saisieForm.value.libelle = parsed.libelle;
                            // Un choix manuel de l'utilisateur n'est jamais écrasé
                            if (saisieCatSource.value === 'manuel') return;
                            //  v37.49 : sûr → rangé ; doute → rangé au plus probable, les pistes en
                            //  puces ; inconnu → l'IA proposera après validation
                            const r = categoriserLibelle(parsed.libelle, parsed.montant);
                            saisieForm.value.categorieId = r.id || '';
                            saisieCatSource.value = r.source;
                            saisieCatStatut.value = r.statut;
                            saisieCatRaison.value = r.raison;
                            saisieCatSuggestions.value = r.statut === 'sur' ? [] : (r.candidats.length ? r.candidats : categoriesLesPlusUtilisees.value.slice(0, 3));
                        }
                    });""",
"""                    //  v37.61 — la catégorie (et le compte appris) d'après le libellé et le montant du formulaire. Un choix fait
                    //  à la main n'est jamais écrasé.
                    const _categoriserSaisie = () => {
                        const f = saisieForm.value, lib = String(f.libelle || '').trim();
                        if (!lib || lib === 'Sans libellé') {
                            if (saisieCatSource.value !== 'manuel') { f.categorieId = ''; saisieCatSource.value = null; saisieCatStatut.value = null; saisieCatRaison.value = ''; saisieCatSuggestions.value = []; }
                            return;
                        }
                        if (saisieCatSource.value !== 'manuel') {
                            //  v37.49 : sûr → rangé ; doute → rangé au plus probable, les pistes en puces ; inconnu → l'IA après validation
                            const r = categoriserLibelle(lib, f.montant);
                            f.categorieId = r.id || '';
                            saisieCatSource.value = r.source;
                            saisieCatStatut.value = r.statut;
                            saisieCatRaison.value = r.raison;
                            saisieCatSuggestions.value = r.statut === 'sur' ? [] : (r.candidats.length ? r.candidats : categoriesLesPlusUtilisees.value.slice(0, 3));
                        }
                        //  le compte de votre dernière saisie du même libellé (si vous ne l'avez pas choisi)
                        if (!f.compteManuel) {
                            const cle = _analyseLibelle(lib).toks.join(' ');
                            const x = cle && apprentissageActif.value ? journalToutes.value.find(y => y.t.compteId != null && y.t.source !== 'banque' && _analyseLibelle(y.t.libelle).toks.join(' ') === cle) : null;
                            const c = x && (comptes.value || []).find(k => String(k.id) === String(x.t.compteId));
                            if (c) { f.compteId = c.id; saisieCompteAppris.value = true; }
                            else if (saisieCompteAppris.value) { f.compteId = saisieCompteDefaut.value || (comptes.value && comptes.value[0] ? comptes.value[0].id : null); saisieCompteAppris.value = false; }
                        }
                    };
                    // Watch sur smart input → remplit le formulaire en temps réel
                    //  v37.61 : le texte fait foi — un nombre effacé efface le montant, un libellé effacé le libellé (sauf ceux
                    //  saisis dans « ⚙️ Ajuster »)
                    watch(saisieRapide, (txt) => {
                        const s = String(txt || '').trim(), f = saisieForm.value;
                        saisieErreur.value = '';
                        if (!s) {
                            if (!f.montantManuel) f.montant = null;
                            if (!f.libelleManuel) f.libelle = '';
                            if (saisieCatSource.value !== 'manuel') { saisieCatSource.value = null; saisieCatStatut.value = null; saisieCatRaison.value = ''; saisieCatSuggestions.value = []; }
                            return;
                        }
                        const parsed = _parseSaisieRapide(s);
                        if (parsed.montant != null) { f.montant = parsed.montant; f.montantManuel = false; }
                        else if (!f.montantManuel) f.montant = null;
                        f.libelle = parsed.libelle !== 'Sans libellé' ? parsed.libelle : (f.libelleManuel ? f.libelle : '');
                        if (parsed.libelle !== 'Sans libellé') f.libelleManuel = false;
                        _categoriserSaisie();
                    });
                    //  v37.61 : les champs de « ⚙️ Ajuster »
                    const libelleSaisieModifie = () => { saisieForm.value.libelleManuel = true; _categoriserSaisie(); };
                    const montantSaisieModifie = () => { saisieForm.value.montantManuel = true; if (saisieCatSource.value !== 'manuel') _categoriserSaisie(); };
                    const dateSaisieModifiee = () => { saisieForm.value.dateFixee = true; };
                    const compteSaisieModifie = () => { saisieForm.value.compteManuel = true; saisieCompteAppris.value = false; };
                    const ouvrirAjusterSaisie = () => {
                        if (!showSaisieDetails.value && !saisieForm.value.dateFixee) saisieForm.value.datetime = _nowLocalDateTime();
                        showSaisieDetails.value = !showSaisieDetails.value;
                    };
                    //  v37.61 : « ⚠️ déjà saisi aujourd'hui à 08:30 » — même libellé, même montant, le même jour
                    const saisieDejaVue = computed(() => {
                        const f = saisieForm.value, cle = _analyseLibelle(f.libelle).toks.join(' ');
                        if (!cle || !(f.montant > 0)) return null;
                        const jour = (f.dateFixee ? f.datetime : _nowLocalDateTime()).slice(0, 10);
                        const x = journalToutes.value.find(y => y.ymd === jour && Math.abs(y.montant - f.montant) < 0.005 && _analyseLibelle(y.t.libelle).toks.join(' ') === cle);
                        return x ? { heure: x.heure || '', source: x.t.source || 'manuel' } : null;
                    });
                    const _fermerAnnonce = () => { if (saisieAnnonce.minuterie) clearTimeout(saisieAnnonce.minuterie); Object.assign(saisieAnnonce, { texte: '', txId: null, minuterie: null }); };
                    const annulerDerniereSaisie = () => {
                        const id = saisieAnnonce.txId;
                        _fermerAnnonce();
                        if (id == null) return false;
                        const s = _seauDeTx(id);
                        if (!s) return false;
                        s.arr.splice(s.i, 1);
                        calculationTick.value++;
                        handleDataChange();
                        return true;
                    };""")

# ── 3. Valider : l'instant présent, la bonne année, jamais une saisie perdue ────────────────────────────
sub('valider',
"""                    const validerSaisieForm = () => {
                        const f = saisieForm.value;
                        if (!f.montant || f.montant <= 0) return false;
                        const dt = f.datetime || _nowLocalDateTime();""",
"""                    const validerSaisieForm = () => {
                        const f = saisieForm.value;
                        if (!f.montant || f.montant <= 0) return false;
                        //  v37.61 : « Maintenant » = l'instant de la validation (la page a pu rester ouverte depuis hier)
                        const dt = (f.dateFixee && f.datetime) || _nowLocalDateTime();""")
sub('valider fin',
"""                        if (txId && statut === 'inconnu') demanderCategorieIA(txId);
                        resetSaisieForm();
                        return true;
                    };""",
"""                        //  v37.61 : rien d'enregistré → le formulaire reste, et on le dit
                        if (!txId) { saisieErreur.value = "⚠️ Saisie NON enregistrée (année " + dt.slice(0, 4) + " introuvable) : rien n'est perdu, réessayez."; return false; }
                        if (statut === 'inconnu') demanderCategorieIA(txId);
                        const c = (comptes.value || []).find(k => String(k.id) === String(f.compteId));
                        _fermerAnnonce();
                        Object.assign(saisieAnnonce, { txId, texte: '✓ ' + (String(f.libelle || '').trim() || 'Sans libellé') + ' · ' + formatMAD(f.montant)
                            + (f.categorieId && f.categorieId !== 'cat_misc' ? ' → ' + String(getCategorieLabel(f.categorieId) || '').trim() : ' → 🤖 l\\'IA range') + (c ? ' · ' + c.label : '')
                            + (dt.slice(0, 10) !== _nowLocalDateTime().slice(0, 10) ? ' · ' + dt.slice(8, 10) + '/' + dt.slice(5, 7) : '') });
                        saisieAnnonce.minuterie = setTimeout(_fermerAnnonce, 6000);
                        resetSaisieForm();
                        return true;
                    };""")
sub('ajouter tx',
"""                    const ajouterTransactionReelle = (data) => {
                        const a = anneeAffichage.value;
                        if (!donneesAnnuelles.value[a]) return;
                        if (!Array.isArray(donneesAnnuelles.value[a].transactionsReelles)) {
                            donneesAnnuelles.value[a].transactionsReelles = [];
                        }
                        const today = new Date();
                        const dateOnly = data.date || (data.datetime ? data.datetime.slice(0, 10) : today.toISOString().slice(0, 10));""",
"""                    //  v37.61 — LE SEAU DE L'ANNÉE d'une opération, créé s'il manque : copie de l'année la plus proche (le budget),
                    //  trackers vidés, ses propres dépenses exceptionnelles, aucune opération — comme « Ajouter une année »
                    const _assurerSeauAnnee = (an) => {
                        const A = Number(an);
                        if (!A || A < 2000 || A > 2200) return null;
                        if (donneesAnnuelles.value[A]) return donneesAnnuelles.value[A];
                        const dispo = Object.keys(donneesAnnuelles.value || {}).map(Number).filter(Boolean);
                        if (!dispo.length) return null;
                        const src = dispo.sort((x, y) => Math.abs(x - A) - Math.abs(y - A) || y - x)[0];
                        const c = JSON.parse(JSON.stringify(donneesAnnuelles.value[src]));
                        Object.values(c.chargesFixes || {}).forEach(_viderTracker);
                        Object.values(c.chargesVariables || {}).forEach(v => { _viderTracker(v); (v.details || []).forEach(_viderTracker); });
                        (Array.isArray(c.depensesIrregulieres) ? c.depensesIrregulieres : []).forEach(d => { _viderTracker(d); d.annee = A; d.id = Date.now() + Math.random(); });
                        c.transactionsReelles = []; c.banqueOperations = {};
                        donneesAnnuelles.value[A] = c;
                        try { addLog('Année ' + A + ' créée (copie de ' + src + ') pour une opération datée de ' + A + '.', 'info'); } catch (e) {}
                        return c;
                    };
                    const ajouterTransactionReelle = (data) => {
                        const today = new Date();
                        const dateOnly = data.date || (data.datetime ? data.datetime.slice(0, 10) : today.toISOString().slice(0, 10));
                        //  v37.61 : l'année de la DATE (plus l'année affichée) ; absente : créée — jamais une saisie perdue
                        const seau = _assurerSeauAnnee(Number(String(dateOnly).slice(0, 4))) || donneesAnnuelles.value[anneeAffichage.value];
                        if (!seau) return null;
                        if (!Array.isArray(seau.transactionsReelles)) seau.transactionsReelles = [];""")
sub('ajouter tx push',
"""                        if (data.aVerifier) tx.aVerifier = true;
                        donneesAnnuelles.value[a].transactionsReelles.push(tx);""",
"""                        if (data.aVerifier) tx.aVerifier = true;
                        seau.transactionsReelles.push(tx);""")
sub('journal année',
"""                            if (!donneesAnnuelles.value[an]) donneesAnnuelles.value[an] = JSON.parse(JSON.stringify({ ...donneesAnnuelles.value[s.an], transactionsReelles: [] }));""",
"""                            _assurerSeauAnnee(an);   // v37.61 : la même création propre que la saisie""")

# ── 4. La saisie rapide : le clavier tout de suite ─────────────────────────────────────────────────────
sub('ouvrir rapide',
"""                    const openSaisieQuickModal = () => {
                        resetSaisieForm();
                        showSaisieQuickModal.value = true;
                    };""",
"""                    const openSaisieQuickModal = () => {
                        resetSaisieForm();
                        showSaisieDetails.value = false;
                        showSaisieQuickModal.value = true;
                        //  v37.61 : le clavier s'ouvre tout de suite
                        nextTick(() => { const i = document.querySelector('[data-saisie-rapide-champ]'); if (i) i.focus(); });
                    };""")
sub('date label',
"""                        const dt = saisieForm.value.datetime;
                        if (!dt) return 'Maintenant';""",
"""                        const dt = saisieForm.value.datetime;
                        if (!dt || !saisieForm.value.dateFixee) return 'Maintenant';   // v37.61 : l'instant de la validation""")
sub('cycle compteur',
"""                    const showSaisieDetails = ref(false);""",
"""                    const showSaisieDetails = ref(false);
                    //  v37.61 : le compteur de l'en-tête — les opérations du cycle en cours (plus « N tx — année »)
                    const saisieNbCycle = computed(() => { const c = (_cycleCourantJournal.value || {}).cle; return journalToutes.value.filter(x => x.cycle && x.cycle.cle === c).length; });""")

# ── 5. L'écran : la page Saisie ─────────────────────────────────────────────────────────────────────
sub('tpl conteneur',
"""                <div v-if="activeTab === 'saisie'" class="max-w-5xl mx-auto space-y-4 md:space-y-6">""",
"""                <div v-if="activeTab === 'saisie'" class="max-w-5xl mx-auto space-y-4 md:space-y-6 pb-40 md:pb-0">""")
sub('tpl compteur',
"""                            <span class="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">{{ transactionsReellesTriees.length }} tx — {{ anneeAffichage }}</span>""",
"""                            <span data-saisie-compteur class="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">{{ saisieNbCycle }} op. ce cycle</span>""")
sub('tpl étiquette montant',
"""                            <span v-if="saisieForm.montant" class="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">💵 {{ formatMAD(saisieForm.montant) }}</span>""",
"""                            <span v-if="saisieForm.montant" class="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">💵 {{ formatMAD(saisieForm.montant) }}</span>
                            <span v-else data-saisie-sans-montant class="text-[10px] font-black px-2 py-0.5 rounded-full bg-gray-50 text-gray-500 border border-dashed border-gray-300">💵 montant ? (ex. « 45 {{ saisieForm.libelle || 'café' }} »)</span>""")
sub('tpl étiquette compte',
"""                            <span v-if="saisieForm.compteId" class="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-50 text-slate-700 border border-slate-200">🏦 {{ (comptes.find(c => c.id === saisieForm.compteId) || {}).label || '—' }}</span>
                            <span class="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">📅 {{ saisieDateLabel }}</span>
                            <button @click="showSaisieDetails = !showSaisieDetails" class="ml-auto text-[10px] font-black text-gray-400 hover:text-emerald-600 transition-colors">
                                {{ showSaisieDetails ? '× Fermer' : '⚙️ Ajuster' }}
                            </button>
                        </div>""",
"""                            <span v-if="saisieForm.compteId" data-saisie-compte class="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-50 text-slate-700 border border-slate-200">🏦 {{ (comptes.find(c => c.id === saisieForm.compteId) || {}).label || '—' }}<span v-if="saisieCompteAppris" class="font-bold opacity-70"> · appris</span></span>
                            <span class="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">📅 {{ saisieDateLabel }}</span>
                            <button @click="ouvrirAjusterSaisie()" data-saisie-ajuster class="ml-auto text-[10px] font-black text-gray-400 hover:text-emerald-600 transition-colors">
                                {{ showSaisieDetails ? '× Fermer' : '⚙️ Ajuster' }}
                            </button>
                        </div>
                        <p v-if="saisieDejaVue" data-saisie-deja-vue class="mt-1.5 text-[10px] font-black text-amber-800">⚠️ Déjà saisi aujourd'hui{{ saisieDejaVue.heure ? ' à ' + saisieDejaVue.heure : '' }}{{ saisieDejaVue.source === 'banque' ? ' (importé de la banque)' : '' }} — même libellé, même montant. Validez quand même si c'en est un autre.</p>
                        <p v-if="saisieErreur" data-saisie-erreur class="mt-1.5 text-[11px] font-black text-red-700">{{ saisieErreur }}</p>""")
sub('tpl ajuster',
"""                        <div v-if="showSaisieDetails" class="mt-2 pt-2 border-t border-gray-100 space-y-2">
                            <div class="grid grid-cols-2 gap-2">
                                <input v-model="saisieForm.datetime" type="datetime-local"
                                       class="px-2 py-2 border border-gray-200 rounded-lg text-xs font-bold outline-none focus:border-emerald-500 bg-gray-50" />
                                <input v-model.number="saisieForm.montant" type="number" inputmode="decimal" step="0.01" min="0" placeholder="Montant"
                                       class="px-2 py-2 border border-gray-200 rounded-lg text-xs font-bold outline-none focus:border-emerald-500 bg-gray-50 text-right tabular-nums" />
                            </div>
                            <select v-model="saisieForm.categorieId" @change="choisirCategorieSaisie(saisieForm.categorieId)"
                                    class="w-full px-2 py-2 border border-gray-200 rounded-lg text-xs font-bold outline-none focus:border-emerald-500 bg-gray-50">
                                <option value="">— Catégorie —</option>
                                <optgroup v-for="g in categoriesForSelect" :key="g.label" :label="g.label">
                                    <option v-for="c in g.items" :key="c.id" :value="c.id">{{ c.label }}</option>
                                </optgroup>
                                <option value="cat_misc">📦 Misc</option>
                            </select>
                            <select v-model="saisieForm.compteId"
                                    class="w-full px-2 py-2 border border-gray-200 rounded-lg text-xs font-bold outline-none focus:border-emerald-500 bg-gray-50">
                                <option :value="null">— Compte —</option>
                                <option v-for="c in comptes" :key="c.id" :value="c.id">{{ c.label }}</option>
                            </select>
                            <input v-model="saisieForm.libelle" type="text" placeholder="Libellé"
                                   class="w-full px-2 py-2 border border-gray-200 rounded-lg text-xs font-bold outline-none focus:border-emerald-500 bg-gray-50" />""",
"""                        <div v-if="showSaisieDetails" data-saisie-details class="mt-2 pt-2 border-t border-gray-100 space-y-2">
                            <div class="grid grid-cols-2 gap-2">
                                <input v-model="saisieForm.datetime" @input="dateSaisieModifiee()" type="datetime-local" data-saisie-date
                                       class="px-2 py-2 border border-gray-200 rounded-lg text-xs font-bold outline-none focus:border-emerald-500 bg-gray-50" />
                                <input v-model.number="saisieForm.montant" @input="montantSaisieModifie()" type="number" inputmode="decimal" step="0.01" min="0" placeholder="Montant"
                                       class="px-2 py-2 border border-gray-200 rounded-lg text-xs font-bold outline-none focus:border-emerald-500 bg-gray-50 text-right tabular-nums" />
                            </div>
                            <select v-model="saisieForm.categorieId" @change="choisirCategorieSaisie(saisieForm.categorieId)" data-saisie-categorie
                                    class="w-full px-2 py-2 border border-gray-200 rounded-lg text-xs font-bold outline-none focus:border-emerald-500 bg-gray-50">
                                <option value="">🤖 Automatique (les règles, puis l'IA)</option>
                                <optgroup v-for="g in categoriesPourRanger" :key="g.label" :label="g.label">
                                    <option v-for="c in g.items" :key="c.id" :value="c.id">{{ c.label }}</option>
                                </optgroup>
                            </select>
                            <select v-model="saisieForm.compteId" @change="compteSaisieModifie()" data-saisie-compte-choix
                                    class="w-full px-2 py-2 border border-gray-200 rounded-lg text-xs font-bold outline-none focus:border-emerald-500 bg-gray-50">
                                <option :value="null">— Compte —</option>
                                <option v-for="c in comptes" :key="c.id" :value="c.id">{{ c.label }}</option>
                            </select>
                            <input v-model="saisieForm.libelle" @input="libelleSaisieModifie()" type="text" placeholder="Libellé"
                                   class="w-full px-2 py-2 border border-gray-200 rounded-lg text-xs font-bold outline-none focus:border-emerald-500 bg-gray-50" />""")

# ── 6. La saisie rapide (le ➕) : un champ, l'étiquette, « ⚙️ Ajuster » pour le reste ──────────────────
sub('tpl rapide',
"""                    <input v-model="saisieRapide" @keyup.enter="validerSaisieFormFromQuick" type="text"
                           placeholder='Ex: "400 courses"'
                           class="w-full px-4 py-4 text-base font-bold border-2 border-emerald-200 rounded-xl outline-none focus:border-emerald-500 bg-gray-50" />
                    <div class="grid grid-cols-2 gap-2">
                        <input v-model="saisieForm.datetime" type="datetime-local" class="px-2 py-3 border-2 border-gray-200 rounded-lg text-xs font-bold outline-none focus:border-emerald-500 bg-gray-50" />
                        <input v-model.number="saisieForm.montant" type="number" inputmode="decimal" step="0.01" placeholder="Montant" class="px-3 py-3 border-2 border-gray-200 rounded-lg text-sm font-bold outline-none focus:border-emerald-500 bg-gray-50 text-right tabular-nums" />
                    </div>
                    <!-- v37.49 : la même étiquette que sur bureau, et les pistes en cas de doute -->
                    <div v-if="saisieForm.libelle && (saisieForm.categorieId || saisieCatStatut === 'inconnu')" data-saisie-etiquette-mobile class="flex flex-wrap items-center gap-1.5 -mt-1">""",
"""                    <input v-model="saisieRapide" @keyup.enter="validerSaisieFormFromQuick" type="text" data-saisie-rapide-champ enterkeyhint="done" autocomplete="off"
                           placeholder='Ex: "400 courses"'
                           class="w-full px-4 py-4 text-base font-bold border-2 border-emerald-200 rounded-xl outline-none focus:border-emerald-500 bg-gray-50" />
                    <!-- v37.61 : l'étiquette (montant, compte, date) et « ⚙️ Ajuster » — comme sur la page, plus 7 champs d'office -->
                    <div v-if="saisieRapide || saisieForm.montant" data-saisie-rapide-etiquette class="flex flex-wrap items-center gap-1.5 -mt-1">
                        <span v-if="saisieForm.montant" class="text-[11px] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">💵 {{ formatMAD(saisieForm.montant) }}</span>
                        <span v-else data-saisie-sans-montant class="text-[11px] font-black px-2 py-0.5 rounded-full bg-gray-50 text-gray-500 border border-dashed border-gray-300">💵 montant ?</span>
                        <span v-if="saisieForm.compteId" class="text-[11px] font-black px-2 py-0.5 rounded-full bg-slate-50 text-slate-700 border border-slate-200">🏦 {{ (comptes.find(c => c.id === saisieForm.compteId) || {}).label || '—' }}<span v-if="saisieCompteAppris" class="font-bold opacity-70"> · appris</span></span>
                        <span class="text-[11px] font-black px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">📅 {{ saisieDateLabel }}</span>
                        <button type="button" @click="ouvrirAjusterSaisie()" data-saisie-ajuster class="ml-auto text-[11px] font-black text-gray-500 hover:text-emerald-600">{{ showSaisieDetails ? '× Fermer' : '⚙️ Ajuster' }}</button>
                    </div>
                    <p v-if="saisieDejaVue" data-saisie-deja-vue class="-mt-1 text-[11px] font-black text-amber-800">⚠️ Déjà saisi aujourd'hui{{ saisieDejaVue.heure ? ' à ' + saisieDejaVue.heure : '' }}{{ saisieDejaVue.source === 'banque' ? ' (importé de la banque)' : '' }} — même libellé, même montant.</p>
                    <p v-if="saisieErreur" data-saisie-erreur class="-mt-1 text-[11px] font-black text-red-700">{{ saisieErreur }}</p>
                    <!-- v37.49 : la même étiquette que sur bureau, et les pistes en cas de doute -->
                    <div v-if="saisieForm.libelle && (saisieForm.categorieId || saisieCatStatut === 'inconnu')" data-saisie-etiquette-mobile class="flex flex-wrap items-center gap-1.5 -mt-1">""")
sub('tpl rapide champs',
"""                    <select v-model="saisieForm.categorieId" @change="choisirCategorieSaisie(saisieForm.categorieId)" class="w-full px-3 py-3 border-2 border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-emerald-500 bg-gray-50">
                        <option value="">— Catégorie —</option>
                        <optgroup v-for="g in categoriesForSelect" :key="g.label" :label="g.label">
                            <option v-for="c in g.items" :key="c.id" :value="c.id">{{ c.label }}</option>
                        </optgroup>
                        <option value="cat_misc">📦 Misc</option>
                    </select>
                    <select v-model="saisieForm.compteId" class="w-full px-3 py-3 border-2 border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-emerald-500 bg-gray-50">
                        <option :value="null">— Compte —</option>
                        <option v-for="c in comptes" :key="c.id" :value="c.id">{{ c.label }}</option>
                    </select>
                    <input v-model="saisieForm.libelle" type="text" placeholder="Libellé" class="w-full px-3 py-3 border-2 border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-emerald-500 bg-gray-50" />""",
"""                    <div v-if="showSaisieDetails" data-saisie-details class="space-y-2">
                        <div class="grid grid-cols-2 gap-2">
                            <input v-model="saisieForm.datetime" @input="dateSaisieModifiee()" type="datetime-local" data-saisie-date class="px-2 py-3 border-2 border-gray-200 rounded-lg text-xs font-bold outline-none focus:border-emerald-500 bg-gray-50" />
                            <input v-model.number="saisieForm.montant" @input="montantSaisieModifie()" type="number" inputmode="decimal" step="0.01" placeholder="Montant" class="px-3 py-3 border-2 border-gray-200 rounded-lg text-sm font-bold outline-none focus:border-emerald-500 bg-gray-50 text-right tabular-nums" />
                        </div>
                        <select v-model="saisieForm.categorieId" @change="choisirCategorieSaisie(saisieForm.categorieId)" data-saisie-categorie class="w-full px-3 py-3 border-2 border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-emerald-500 bg-gray-50">
                            <option value="">🤖 Automatique (les règles, puis l'IA)</option>
                            <optgroup v-for="g in categoriesPourRanger" :key="g.label" :label="g.label">
                                <option v-for="c in g.items" :key="c.id" :value="c.id">{{ c.label }}</option>
                            </optgroup>
                        </select>
                        <select v-model="saisieForm.compteId" @change="compteSaisieModifie()" data-saisie-compte-choix class="w-full px-3 py-3 border-2 border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-emerald-500 bg-gray-50">
                            <option :value="null">— Compte —</option>
                            <option v-for="c in comptes" :key="c.id" :value="c.id">{{ c.label }}</option>
                        </select>
                        <input v-model="saisieForm.libelle" @input="libelleSaisieModifie()" type="text" placeholder="Libellé" class="w-full px-3 py-3 border-2 border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-emerald-500 bg-gray-50" />
                    </div>""")

# ── 7. L'annonce « ✓ ajouté · ↶ Annuler », sur tous les écrans ───────────────────────────────────────
sub('tpl annonce',
"""        <div v-if="showSaisieQuickModal" @click.self="closeSaisieQuickModal\"""",
"""        <!-- v37.61 : la saisie enregistrée, et l'annuler d'un toucher (6 secondes) -->
        <div v-if="saisieAnnonce.texte && !showSaisieQuickModal" data-saisie-annonce role="status" class="fixed left-3 right-3 top-3 md:top-auto md:left-auto md:right-6 md:w-[26rem] md:bottom-6 z-[90] flex items-center gap-3 rounded-2xl bg-slate-900 text-white px-4 py-3 shadow-2xl">
            <span class="flex-1 text-xs font-bold leading-snug">{{ saisieAnnonce.texte }}</span>
            <button type="button" data-saisie-annuler @click="annulerDerniereSaisie()" class="shrink-0 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-black">↶ Annuler</button>
        </div>
        <div v-if="showSaisieQuickModal" @click.self="closeSaisieQuickModal\"""")

# ── 8. Le journal : « 0 DH », les filtres repliés au téléphone ───────────────────────────────────────
sub('tpl −0',
"""                                {{ journalResume.n }} opération(s) · <span class="text-red-700">−{{ formatMAD(journalResume.total) }}</span>""",
"""                                {{ journalResume.n }} opération(s) · <span class="text-red-700">{{ journalResume.total ? '−' : '' }}{{ formatMAD(journalResume.total) }}</span>""")
sub('tpl filtres',
"""                            <div class="flex flex-wrap items-center gap-1.5">
                                <select data-journal-filtre-cat v-model="journal.cat\"""",
"""                            <button v-if="isMobile" type="button" data-journal-filtres-bouton @click="journal.filtresOuverts = !journal.filtresOuverts"
                                    class="text-[11px] font-black text-gray-600 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white">⚙️ Filtres{{ (journal.cat ? 1 : 0) + (journal.compte ? 1 : 0) + (journal.source ? 1 : 0) + (journal.aVerifier ? 1 : 0) ? ' (' + ((journal.cat ? 1 : 0) + (journal.compte ? 1 : 0) + (journal.source ? 1 : 0) + (journal.aVerifier ? 1 : 0)) + ')' : '' }} {{ journal.filtresOuverts ? '▴' : '▾' }}</button>
                            <div v-if="!isMobile || journal.filtresOuverts" data-journal-filtres class="flex flex-wrap items-center gap-1.5">
                                <select data-journal-filtre-cat v-model="journal.cat\"""")
sub('journal état filtres',
"""                        ouvert: null, brouillon: null, confirmerSuppression: null, archivesOuvertes: {}, famillesOuvertes: {}, appris: null,""",
"""                        ouvert: null, brouillon: null, confirmerSuppression: null, archivesOuvertes: {}, famillesOuvertes: {}, appris: null, filtresOuverts: false,""")

# ── 9. Exposé ─────────────────────────────────────────────────────────────────────────────────────────
sub('export',
"""                        showSaisieQuickModal, openSaisieQuickModal, closeSaisieQuickModal, validerSaisieFormFromQuick,""",
"""                        showSaisieQuickModal, openSaisieQuickModal, closeSaisieQuickModal, validerSaisieFormFromQuick,
                        saisieCompteAppris, saisieErreur, saisieAnnonce, annulerDerniereSaisie, saisieDejaVue, saisieNbCycle, libelleSaisieModifie, montantSaisieModifie,
                        dateSaisieModifiee, compteSaisieModifie, ouvrirAjusterSaisie, _parseSaisieRapide,""")

io.open(F, 'w', encoding='utf-8').write(src)
print('✔ v37.61 Saisie : montant lu juste, rien de périmé, la bonne année, saisie rapide épurée, annuler, compte appris')
