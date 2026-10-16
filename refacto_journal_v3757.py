# -*- coding: utf-8 -*-
"""
v37.57 — LE JOURNAL, OUTIL DE TRAVAIL (« lessons learned »).

« Le journal n'est pas interactif alors qu'on doit vraiment l'utiliser pour les lessons learned : fais
attention comment répertorier, archiver… une jolie architecture basée sur la praticité, avec possibilité
de répertorier par catégorie. »
  • TROIS VUES sur les mêmes opérations (tous les seaux annuels) : 🗓️ par date — le cycle de paie en cours
    ouvert, les cycles précédents en ARCHIVES repliées, jour par jour avec leur total ; 🗂️ par catégorie —
    familles et lignes, total, nombre, moyenne, l'écart au cycle précédent ; 💡 leçons — les opérations
    annotées, rangées par catégorie.
  • CHERCHER ET FILTRER : texte (libellé, catégorie, note, montant), période (ce cycle, le précédent,
    3 cycles, tout), catégorie (une famille prend ses lignes), compte, source, « à vérifier ».
  • UN CLIC OUVRE L'OPÉRATION : libellé, montant, date, catégorie, compte se corrigent sur place ; « ce que
    je retiens » s'y attache (note), « 📌 c'est une leçon » ; « toutes les mêmes », « ressaisir aujourd'hui »,
    supprimer (confirmé). Une date changée d'année fait passer l'opération dans son seau annuel.
  • STOCKAGE : rien de nouveau côté serveur — les opérations restent dans le document unique (Postgres
    finance_state, repli fichier), lu et écrit aussi par l'agent n8n ; « note » et « lecon » sont deux
    champs de plus sur l'opération. L'archive est une VUE (par cycle), pas un déplacement de données.
  • BANQUE : « 7) GOOGLE*… » (le jour « 07 » lu « 7) » sur une capture Attijarinet PC) prend sa date.
"""
import io, sys
F = 'index.html'
src = io.open(F, encoding='utf-8').read()
def sub(label, a, b):
    global src
    if src.count(a) != 1: print('✖', label, ':', src.count(a), 'ancre(s)'); sys.exit(1)
    src = src.replace(a, b)
JS = r'''                    /* ═══ v37.57 — LE JOURNAL, OUTIL DE TRAVAIL ══════════════════════════════════════
                       « Le journal n'est pas interactif, alors qu'on doit vraiment l'utiliser pour les
                       lessons learned. » Trois vues sur les mêmes opérations, tous les seaux annuels :
                         • PAR DATE — rangé par cycle de paie (le cycle en cours ouvert, les précédents en
                           ARCHIVES repliées), puis par jour, avec le total de chaque jour ;
                         • PAR CATÉGORIE — chaque famille (Alimentation…) et ses lignes (Marjane…) :
                           total, nombre, moyenne, et l'écart avec le cycle précédent ;
                         • LEÇONS — les opérations annotées (« ce que je retiens »), par catégorie.
                       Recherche (libellé, catégorie, note, montant), période, catégorie, compte, source,
                       « à vérifier ». Un clic sur une opération l'ouvre : tout se corrige sur place
                       (libellé, montant, date, catégorie, compte), une note s'y attache, on la marque
                       comme leçon, on la ressaisit aujourd'hui, on la supprime (confirmée). */
                    const _JOURNAL_PREF = 'fm.journal.v1';
                    const _journalPrefs = (() => { try { return JSON.parse(localStorage.getItem(_JOURNAL_PREF) || '{}') || {}; } catch (e) { return {}; } })();
                    const journal = reactive({
                        q: '', periode: ['cycle', 'precedent', 'trois', 'tout'].includes(_journalPrefs.periode) ? _journalPrefs.periode : 'cycle',
                        vue: ['date', 'categorie', 'lecons'].includes(_journalPrefs.vue) ? _journalPrefs.vue : 'date',
                        cat: '', compte: '', source: '', aVerifier: false,
                        ouvert: null, brouillon: null, confirmerSuppression: null, archivesOuvertes: {}, famillesOuvertes: {},
                    });
                    watch(() => [journal.periode, journal.vue], ([periode, vue]) => {
                        try { localStorage.setItem(_JOURNAL_PREF, JSON.stringify({ periode, vue })); } catch (e) {}
                    });
                    //  Le cycle de paie d'une date : { cle: 202610, mois, an, label: « 27 sep → 26 oct » }
                    const _MOIS_JNL = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc'];
                    const _cycleJournal = (ymd) => {
                        const [a, m, j] = String(ymd || '').slice(0, 10).split('-').map(Number);
                        if (!a || !m || !j) return null;
                        const c = cycleBudgetaireDe(j, m, a), jdp = jourDePaie.value;
                        const prec = c.mois === 1 ? 12 : c.mois - 1;
                        const label = jdp <= 1 ? (_MOIS_JNL[c.mois - 1] + ' ' + c.an)
                            : jdp + ' ' + _MOIS_JNL[prec - 1] + ' → ' + (jdp - 1) + ' ' + _MOIS_JNL[c.mois - 1] + (c.an !== new Date().getFullYear() ? ' ' + c.an : '');
                        return { cle: c.an * 100 + c.mois, mois: c.mois, an: c.an, label };
                    };
                    const _cycleCourantJournal = computed(() => { calculationTick.value; const d = new Date(); return _cycleJournal(_ymd(d)); });
                    //  La famille d'une catégorie (sa mère, ou elle-même)
                    const _familleDe = (id) => {
                        if (!id || id === 'cat_misc') return 'cat_misc';
                        const c = (soldesInitiaux.value.categories || []).find(x => x && x.id === id);
                        return (c && c.parent) || id;
                    };
                    const _libCat = (id) => (!id || id === 'cat_misc') ? 'À catégoriser' : (String(getCategorieLabel(id) || '').trim() || '(Hors catégorie)');
                    //  Toutes les opérations, de tous les seaux annuels, avec leur cycle et leur famille
                    const journalToutes = computed(() => {
                        calculationTick.value;
                        const out = [];
                        Object.entries(donneesAnnuelles.value || {}).forEach(([an, d]) => (d && Array.isArray(d.transactionsReelles) ? d.transactionsReelles : []).forEach(t => {
                            if (!t) return;
                            const quand = String(t.datetime || t.date || '');
                            const ymd = quand.slice(0, 10);
                            const fam = _familleDe(t.categorieId);
                            out.push({ t, an: Number(an), quand, ymd, heure: quand.length > 10 ? quand.slice(11, 16) : '', cycle: _cycleJournal(ymd),
                                       fam, famLabel: _libCat(fam), catLabel: _libCat(t.categorieId), montant: Number(t.montant) || 0 });
                        }));
                        return out.sort((x, y) => (x.ymd ? 1 : 0) - (y.ymd ? 1 : 0) || String(y.quand).localeCompare(String(x.quand)));
                    });
                    const _normJnl = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
                    //  La fenêtre de la période : des clés de cycle (202610…) ; « tout » = aucune borne
                    const _cyclesPeriode = computed(() => {
                        const c = _cycleCourantJournal.value;
                        if (!c || journal.periode === 'tout') return null;
                        const recul = (cle, n) => { let a = Math.floor(cle / 100), m = cle % 100; for (let i = 0; i < n; i++) { m--; if (!m) { m = 12; a--; } } return a * 100 + m; };
                        if (journal.periode === 'cycle') return new Set([c.cle]);
                        if (journal.periode === 'precedent') return new Set([recul(c.cle, 1)]);
                        return new Set([c.cle, recul(c.cle, 1), recul(c.cle, 2)]);
                    });
                    const journalFiltrees = computed(() => {
                        const q = _normJnl(journal.q).trim(), win = _cyclesPeriode.value;
                        return journalToutes.value.filter(x => {
                            const t = x.t;
                            //  une opération sans date (une ligne de banque mal datée) reste visible : elle est à corriger
                            if (win && x.cycle && !win.has(x.cycle.cle)) return false;
                            if (journal.cat && t.categorieId !== journal.cat && x.fam !== journal.cat) return false;
                            if (journal.compte && String(t.compteId || '') !== String(journal.compte)) return false;
                            if (journal.source && (t.source || 'manuel') !== journal.source) return false;
                            if (journal.aVerifier && !estACategoriser(t)) return false;
                            if (q) {
                                const foin = _normJnl([t.libelle, x.catLabel, x.famLabel, t.note, String(Math.round(x.montant))].join(' '));
                                if (!q.split(/\s+/).every(m => foin.includes(m))) return false;
                            }
                            return true;
                        });
                    });
                    const journalResume = computed(() => {
                        const l = journalFiltrees.value;
                        const total = l.reduce((s, x) => s + x.montant, 0);
                        return { n: l.length, total, moyenne: l.length ? total / l.length : 0, lecons: l.filter(x => x.t.lecon || String(x.t.note || '').trim()).length,
                                 aVerifier: l.filter(x => estACategoriser(x.t)).length, sansDate: l.filter(x => !x.ymd).length };
                    });
                    const _JOURS_JNL = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
                    const _libJour = (ymd) => {
                        const [a, m, j] = ymd.split('-').map(Number);
                        const d = new Date(a, m - 1, j), auj = _ymd(new Date()), hier = _ymd(new Date(Date.now() - 864e5));
                        return ymd === auj ? "Aujourd'hui" : ymd === hier ? 'Hier' : _JOURS_JNL[d.getDay()] + ' ' + j + ' ' + _MOIS_JNL[m - 1] + (a !== new Date().getFullYear() ? ' ' + a : '');
                    };
                    //  PAR DATE : cycles (le courant ouvert, les autres en archives) → jours → opérations
                    const journalParDate = computed(() => {
                        const courant = (_cycleCourantJournal.value || {}).cle, cherche = !!journal.q.trim();
                        const cycles = new Map();
                        journalFiltrees.value.forEach(x => {
                            const ck = x.cycle ? x.cycle.cle : 0;
                            if (!cycles.has(ck)) cycles.set(ck, { cle: ck, label: x.cycle ? x.cycle.label : 'Sans date — à dater', sansDate: !x.cycle, courant: ck === courant, total: 0, n: 0, jours: new Map() });
                            const c = cycles.get(ck);
                            c.total += x.montant; c.n++;
                            const jk = x.ymd || '—';
                            if (!c.jours.has(jk)) c.jours.set(jk, { cle: jk, label: x.ymd ? _libJour(x.ymd) : 'Date inconnue', total: 0, ops: [] });
                            const j = c.jours.get(jk); j.total += x.montant; j.ops.push(x);
                        });
                        return [...cycles.values()].sort((a, b) => (b.sansDate ? 1 : 0) - (a.sansDate ? 1 : 0) || b.cle - a.cle)
                            .map(c => { const jours = [...c.jours.values()];
                                //  ouverte : le cycle en cours, une recherche, une archive dépliée, ou l'opération ouverte qu'elle contient
                                const contient = journal.ouvert != null && jours.some(j => j.ops.some(x => x.t.id === journal.ouvert));
                                return { ...c, jours, ouvert: c.courant || c.sansDate || cherche || contient || journal.archivesOuvertes[c.cle] === true || (journal.periode === 'precedent' && journal.archivesOuvertes[c.cle] !== false) }; });
                    });
                    //  PAR CATÉGORIE : familles → lignes, avec l'écart au cycle précédent
                    const journalParCategorie = computed(() => {
                        const l = journalFiltrees.value, total = l.reduce((s, x) => s + x.montant, 0) || 1;
                        const c = _cycleCourantJournal.value;
                        const precCle = c ? (c.mois === 1 ? (c.an - 1) * 100 + 12 : c.cle - 1) : null;
                        const prec = {};
                        if (journal.periode === 'cycle' && precCle) journalToutes.value.forEach(x => { if (x.cycle && x.cycle.cle === precCle) prec[x.fam] = (prec[x.fam] || 0) + x.montant; });
                        const fams = new Map();
                        l.forEach(x => {
                            if (!fams.has(x.fam)) fams.set(x.fam, { id: x.fam, label: x.famLabel, total: 0, n: 0, lignes: new Map() });
                            const f = fams.get(x.fam); f.total += x.montant; f.n++;
                            const lk = x.t.categorieId || 'cat_misc';
                            if (!f.lignes.has(lk)) f.lignes.set(lk, { id: lk, label: lk === x.fam ? x.famLabel + ' (sans ligne)' : x.catLabel, total: 0, n: 0, dernier: '', libelles: {} });
                            const g = f.lignes.get(lk); g.total += x.montant; g.n++;
                            if (x.ymd > g.dernier) g.dernier = x.ymd;
                            const lib = String(x.t.libelle || '').trim(); if (lib) g.libelles[lib] = (g.libelles[lib] || 0) + 1;
                        });
                        return [...fams.values()].map(f => {
                            const p = prec[f.id];
                            return { ...f, part: f.total / total, precedent: p == null ? null : p, ecart: p ? (f.total - p) / p : null, ouvert: !!journal.famillesOuvertes[f.id],
                                     lignes: [...f.lignes.values()].map(g => ({ ...g, moyenne: g.total / g.n,
                                         top: Object.entries(g.libelles).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => n > 1 ? k + ' ×' + n : k) })).sort((a, b) => b.total - a.total) };
                        }).sort((a, b) => b.total - a.total);
                    });
                    //  LEÇONS : les opérations annotées, par famille
                    const journalLecons = computed(() => {
                        const fams = new Map();
                        journalFiltrees.value.filter(x => x.t.lecon || String(x.t.note || '').trim()).forEach(x => {
                            if (!fams.has(x.fam)) fams.set(x.fam, { id: x.fam, label: x.famLabel, ops: [] });
                            fams.get(x.fam).ops.push(x);
                        });
                        return [...fams.values()].sort((a, b) => b.ops.length - a.ops.length);
                    });
                    const journalComptes = computed(() => (comptes.value || []).map(c => ({ id: c.id, label: c.label })));
                    const journalSources = computed(() => [...new Set(journalToutes.value.map(x => x.t.source || 'manuel'))].sort());
                    //  Ouvrir une opération : un brouillon, rien n'est écrit avant « Enregistrer »
                    const ouvrirOperation = (id) => {
                        if (journal.ouvert === id) { journal.ouvert = null; journal.brouillon = null; return; }
                        const t = _txParId(id);
                        if (!t) return;
                        const quand = String(t.datetime || (t.date ? t.date + 'T12:00' : '')).slice(0, 16);
                        journal.ouvert = id; journal.confirmerSuppression = null;
                        journal.brouillon = { libelle: t.libelle || '', montant: Number(t.montant) || 0, datetime: quand, categorieId: t.categorieId || '', compteId: t.compteId == null ? '' : String(t.compteId), note: t.note || '', lecon: !!t.lecon };
                    };
                    const _seauDeTx = (id) => {
                        for (const [an, d] of Object.entries(donneesAnnuelles.value || {})) {
                            const arr = d && Array.isArray(d.transactionsReelles) ? d.transactionsReelles : [];
                            const i = arr.findIndex(x => x && x.id === id);
                            if (i >= 0) return { an, arr, i };
                        }
                        return null;
                    };
                    const enregistrerOperation = () => {
                        const id = journal.ouvert, b = journal.brouillon, s = _seauDeTx(id);
                        if (!s || !b) return false;
                        const t = s.arr[s.i];
                        const montant = Math.abs(Number(String(b.montant).replace(',', '.')));
                        if (!(montant > 0)) return false;
                        t.libelle = String(b.libelle || '').trim() || t.libelle;
                        t.montant = Math.round(montant * 100) / 100;
                        if (b.datetime && /^\d{4}-\d{2}-\d{2}/.test(b.datetime)) {
                            t.datetime = b.datetime.length >= 16 ? b.datetime.slice(0, 16) : b.datetime.slice(0, 10) + 'T12:00';
                            t.date = b.datetime.slice(0, 10);
                            t.mois = Number(b.datetime.slice(5, 7));
                        }
                        if (b.categorieId && b.categorieId !== t.categorieId) { t.categorieId = b.categorieId; t.categorieSource = 'vous'; delete t.aVerifier; delete t.iaConfiance; }
                        const cpt = b.compteId === '' ? null : ((comptes.value || []).find(c => String(c.id) === String(b.compteId)) || {}).id;
                        t.compteId = cpt === undefined ? t.compteId : cpt;
                        const note = String(b.note || '').trim();
                        if (note) t.note = note; else delete t.note;
                        if (b.lecon) t.lecon = true; else delete t.lecon;
                        //  Une date changée d'année : l'opération rejoint son seau annuel
                        const an = t.date ? String(Number(t.date.slice(0, 4))) : s.an;
                        if (an !== String(s.an)) {
                            s.arr.splice(s.i, 1);
                            if (!donneesAnnuelles.value[an]) donneesAnnuelles.value[an] = JSON.parse(JSON.stringify({ ...donneesAnnuelles.value[s.an], transactionsReelles: [] }));
                            if (!Array.isArray(donneesAnnuelles.value[an].transactionsReelles)) donneesAnnuelles.value[an].transactionsReelles = [];
                            donneesAnnuelles.value[an].transactionsReelles.push(t);
                        }
                        journal.ouvert = null; journal.brouillon = null;
                        calculationTick.value++;
                        handleDataChange();
                        return true;
                    };
                    const supprimerOperation = (id) => {
                        if (journal.confirmerSuppression !== id) { journal.confirmerSuppression = id; return false; }
                        const s = _seauDeTx(id);
                        if (!s) return false;
                        s.arr.splice(s.i, 1);
                        journal.ouvert = null; journal.brouillon = null; journal.confirmerSuppression = null;
                        calculationTick.value++;
                        handleDataChange();
                        return true;
                    };
                    //  La même dépense, aujourd'hui (le café de tous les matins)
                    const ressaisirOperation = (id) => {
                        const t = _txParId(id);
                        if (!t) return null;
                        const n = new Date(), an = String(n.getFullYear());
                        if (!donneesAnnuelles.value[an] || !Array.isArray(donneesAnnuelles.value[an].transactionsReelles)) return null;
                        const dt = _ymd(n) + 'T' + String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0');
                        const copie = { id: Date.now(), datetime: dt, date: dt.slice(0, 10), mois: n.getMonth() + 1, libelle: t.libelle, montant: t.montant,
                                        categorieId: t.categorieId, compteId: t.compteId == null ? null : t.compteId, source: 'manuel', ...(t.categorieSource ? { categorieSource: t.categorieSource } : {}) };
                        donneesAnnuelles.value[an].transactionsReelles.push(copie);
                        journal.ouvert = null; journal.brouillon = null;
                        calculationTick.value++;
                        handleDataChange();
                        return copie.id;
                    };
                    const filtrerJournalCategorie = (id) => { journal.cat = id || ''; journal.vue = 'date'; };
                    const filtrerJournalLibelle = (lib) => { journal.q = String(lib || ''); journal.vue = 'date'; journal.ouvert = null; };
                    const effacerFiltresJournal = () => { Object.assign(journal, { q: '', cat: '', compte: '', source: '', aVerifier: false }); };

'''
TPL = r'''                    <!-- ═══ v37.57 : LE JOURNAL, OUTIL DE TRAVAIL — chercher, filtrer, ranger par catégorie, corriger sur place, retenir ═══ -->
                    <div data-journal class="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                        <div class="px-4 md:px-6 py-3 border-b border-gray-100 bg-slate-50 space-y-2.5">
                            <div class="flex flex-wrap items-center gap-2">
                                <h3 class="font-black uppercase tracking-widest text-gray-700 text-xs md:text-sm mr-auto">📋 Journal</h3>
                                <div class="inline-flex rounded-xl bg-white border border-gray-200 p-0.5" role="tablist">
                                    <button v-for="v in [['date', '🗓️ Par date'], ['categorie', '🗂️ Par catégorie'], ['lecons', '💡 Leçons']]" :key="'jv_' + v[0]" type="button" :data-journal-vue="v[0]"
                                            @click="journal.vue = v[0]" :aria-pressed="journal.vue === v[0]"
                                            :class="['px-2.5 py-1 rounded-lg text-[11px] font-black transition-colors', journal.vue === v[0] ? 'bg-slate-800 text-white' : 'text-gray-600 hover:bg-gray-100']">{{ v[1] }}</button>
                                </div>
                            </div>
                            <div class="flex flex-wrap items-center gap-1.5">
                                <input type="search" data-journal-recherche v-model="journal.q" placeholder="🔎 Chercher : marjane, café, 180, une note…"
                                       class="flex-1 min-w-[12rem] text-xs font-semibold px-3 py-2 rounded-xl border border-gray-200 bg-white outline-none focus:border-blue-400"/>
                                <div class="inline-flex flex-wrap gap-1">
                                    <button v-for="p in [['cycle', 'Ce cycle'], ['precedent', 'Cycle précédent'], ['trois', '3 cycles'], ['tout', 'Tout']]" :key="'jp_' + p[0]" type="button" :data-journal-periode="p[0]"
                                            @click="journal.periode = p[0]"
                                            :class="['px-2.5 py-1.5 rounded-lg text-[11px] font-black border transition-colors', journal.periode === p[0] ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300']">{{ p[1] }}</button>
                                </div>
                            </div>
                            <div class="flex flex-wrap items-center gap-1.5">
                                <select data-journal-filtre-cat v-model="journal.cat" class="max-w-[14rem] text-[11px] font-bold px-2 py-1.5 rounded-lg border border-gray-200 bg-white outline-none focus:border-blue-400">
                                    <option value="">Toutes les catégories</option>
                                    <optgroup v-for="g in categoriesPourRanger" :key="'jg_' + g.label" :label="g.label">
                                        <option v-for="c in g.items" :key="'jc_' + c.id" :value="c.id">{{ c.label }}</option>
                                    </optgroup>
                                </select>
                                <select data-journal-filtre-compte v-model="journal.compte" class="max-w-[11rem] text-[11px] font-bold px-2 py-1.5 rounded-lg border border-gray-200 bg-white outline-none focus:border-blue-400">
                                    <option value="">Tous les comptes</option>
                                    <option v-for="c in journalComptes" :key="'jco_' + c.id" :value="String(c.id)">{{ c.label }}</option>
                                </select>
                                <select data-journal-filtre-source v-model="journal.source" class="text-[11px] font-bold px-2 py-1.5 rounded-lg border border-gray-200 bg-white outline-none focus:border-blue-400">
                                    <option value="">Toutes les sources</option>
                                    <option v-for="s in journalSources" :key="'jso_' + s" :value="s">{{ s }}</option>
                                </select>
                                <label class="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 cursor-pointer select-none">
                                    <input type="checkbox" data-journal-filtre-verifier v-model="journal.aVerifier" class="accent-amber-600"/> ⚠️ à vérifier
                                </label>
                                <button v-if="journal.q || journal.cat || journal.compte || journal.source || journal.aVerifier" type="button" data-journal-effacer @click="effacerFiltresJournal()"
                                        class="text-[11px] font-black text-gray-500 hover:text-red-600">✕ effacer les filtres</button>
                            </div>
                            <p data-journal-resume class="text-[11px] font-bold text-gray-600">
                                {{ journalResume.n }} opération(s) · <span class="text-red-700">−{{ formatMAD(journalResume.total) }}</span>
                                <span v-if="journalResume.n"> · moyenne {{ formatMAD(journalResume.moyenne) }}</span>
                                <span v-if="journalResume.lecons"> · 💡 {{ journalResume.lecons }} leçon(s)</span>
                                <span v-if="journalResume.aVerifier" class="text-amber-700"> · ⚠️ {{ journalResume.aVerifier }} à vérifier</span>
                                <span v-if="journalResume.sansDate" class="text-red-700"> · 📅 {{ journalResume.sansDate }} sans date</span>
                            </p>
                        </div>

                        <div v-if="!journalFiltrees.length" data-journal-vide class="p-8 md:p-12 text-center text-gray-400 italic text-sm">
                            {{ journalToutes.length ? 'Aucune opération ne correspond : élargissez la période ou effacez un filtre.' : 'Aucune transaction enregistrée.' }}
                        </div>

                        <!-- ── 🗓️ PAR DATE : le cycle en cours, puis les archives (cycles précédents), jour par jour ── -->
                        <div v-else-if="journal.vue === 'date'" data-journal-par-date>
                            <section v-for="c in journalParDate" :key="'jcy_' + c.cle" data-journal-cycle :data-cycle="c.cle" class="border-b border-gray-100 last:border-0">
                                <button type="button" data-journal-cycle-entete @click="journal.archivesOuvertes[c.cle] = !c.ouvert"
                                        :class="['w-full px-4 md:px-6 py-2 flex items-center gap-2 text-left', c.sansDate ? 'bg-red-50' : c.courant ? 'bg-emerald-50' : 'bg-gray-50 hover:bg-gray-100']">
                                    <span class="text-[10px] text-gray-400">{{ c.ouvert ? '▾' : '▸' }}</span>
                                    <span :class="['text-[11px] font-black uppercase tracking-wider', c.sansDate ? 'text-red-800' : c.courant ? 'text-emerald-800' : 'text-gray-600']">
                                        {{ c.sansDate ? '📅 ' + c.label : (c.courant ? 'Cycle en cours · ' : '🗄️ Archive · cycle ') + c.label }}</span>
                                    <span class="ml-auto text-[11px] font-black tabular-nums text-gray-600">{{ c.n }} op. · −{{ formatMAD(c.total) }}</span>
                                </button>
                                <div v-if="c.ouvert">
                                    <div v-for="j in c.jours" :key="'jj_' + c.cle + j.cle" data-journal-jour>
                                        <div class="px-4 md:px-6 pt-2 pb-1 flex items-baseline gap-2">
                                            <span class="text-[10px] font-black uppercase tracking-widest text-gray-400">{{ j.label }}</span>
                                            <span class="ml-auto text-[10px] font-black tabular-nums text-gray-400">−{{ formatMAD(j.total) }}</span>
                                        </div>
                                        <div v-for="x in j.ops" :key="'jo_' + x.t.id" data-journal-ligne :data-tx="x.t.id" :data-a-verifier="estACategoriser(x.t) ? '1' : null"
                                             :class="['mx-2 md:mx-4 mb-1 rounded-xl border transition-colors', journal.ouvert === x.t.id ? 'border-blue-300 bg-blue-50/40' : estACategoriser(x.t) ? 'border-amber-200 bg-amber-50' : 'border-transparent hover:border-gray-200 hover:bg-gray-50']">
                                            <div class="px-2 md:px-3 py-2 flex items-start gap-2">
                                                <button type="button" data-journal-ouvrir @click="ouvrirOperation(x.t.id)" :aria-expanded="journal.ouvert === x.t.id" class="flex-1 min-w-0 text-left">
                                                    <span class="block text-xs md:text-sm font-bold text-gray-900 truncate">
                                                        <span v-if="x.t.lecon" title="Leçon">📌 </span>{{ x.t.libelle || '(sans libellé)' }}
                                                        <span v-if="x.heure" class="text-[10px] font-semibold text-gray-400 tabular-nums"> · {{ x.heure }}</span>
                                                    </span>
                                                    <span v-if="x.t.note" data-journal-note class="block text-[11px] font-semibold text-violet-700 truncate">💡 {{ x.t.note }}</span>
                                                </button>
                                                <span class="text-xs md:text-sm font-black tabular-nums text-red-600 whitespace-nowrap">−{{ formatMAD(x.montant) }}</span>
                                            </div>
                                            <div class="px-2 md:px-3 pb-2 -mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-bold">
                                                <!-- v37.49 : un clic sur la catégorie la change (et le choix devient une règle) -->
                                                <select v-if="editionCategorieTx === x.t.id" data-journal-cat-select :value="x.t.categorieId"
                                                        @change="rangerTransaction(x.t.id, $event.target.value); editionCategorieTx = null" @blur="editionCategorieTx = null"
                                                        class="max-w-[12rem] text-[11px] font-bold px-1 py-0.5 border border-blue-300 rounded bg-white outline-none">
                                                    <optgroup v-for="g in categoriesPourRanger" :key="g.label" :label="g.label">
                                                        <option v-for="c in g.items" :key="c.id" :value="c.id">{{ c.label }}</option>
                                                    </optgroup>
                                                </select>
                                                <button v-else type="button" data-journal-cat :data-tx="x.t.id" @click="editionCategorieTx = x.t.id" title="Changer la catégorie"
                                                        :class="['text-left hover:underline decoration-dotted', estACategoriser(x.t) ? 'text-amber-900' : 'text-blue-700']">
                                                    <span v-if="estACategoriser(x.t)">⚠️ </span>{{ x.t.categorieId && x.t.categorieId !== 'cat_misc' ? (getCategorieLabel(x.t.categorieId) || '(Hors)') : 'À catégoriser' }}<span v-if="x.t.categorieSource === 'ia'" class="text-[9px] font-black text-violet-700"> · IA</span><span v-else-if="x.t.categorieSource === 'défaut'" class="text-[9px] font-black text-amber-700"> · par défaut</span>
                                                </button>
                                                <span v-if="x.t.categorieId && x.fam !== x.t.categorieId" class="text-gray-400">· {{ x.famLabel }}</span>
                                                <span class="text-gray-400">· {{ (comptes.find(c => String(c.id) === String(x.t.compteId)) || {}).label || 'sans compte' }}</span>
                                                <span :class="['px-1.5 py-0.5 rounded uppercase text-[9px] font-black', x.t.source === 'banque' ? 'bg-indigo-100 text-indigo-700' : x.t.source === 'telegram' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500']">{{ x.t.source || 'manuel' }}</span>
                                            </div>
                                            <!-- L'opération ouverte : tout se corrige ici, une note s'y attache -->
                                            <div v-if="journal.ouvert === x.t.id && journal.brouillon" data-journal-edition class="px-2 md:px-3 pb-3 pt-1 border-t border-blue-100 space-y-2">
                                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    <label class="text-[10px] font-black uppercase tracking-wider text-gray-500">Libellé
                                                        <input type="text" data-journal-edit-libelle v-model="journal.brouillon.libelle" class="mt-0.5 w-full text-xs font-bold px-2 py-1.5 rounded-lg border border-gray-200 bg-white outline-none focus:border-blue-400 normal-case tracking-normal"/>
                                                    </label>
                                                    <label class="text-[10px] font-black uppercase tracking-wider text-gray-500">Montant (DH)
                                                        <input type="number" inputmode="decimal" step="0.01" min="0" data-journal-edit-montant v-model="journal.brouillon.montant" class="mt-0.5 w-full text-xs font-bold px-2 py-1.5 rounded-lg border border-gray-200 bg-white outline-none focus:border-blue-400 tabular-nums"/>
                                                    </label>
                                                    <label class="text-[10px] font-black uppercase tracking-wider text-gray-500">Date
                                                        <input type="datetime-local" data-journal-edit-date v-model="journal.brouillon.datetime" class="mt-0.5 w-full text-xs font-bold px-2 py-1.5 rounded-lg border border-gray-200 bg-white outline-none focus:border-blue-400"/>
                                                    </label>
                                                    <label class="text-[10px] font-black uppercase tracking-wider text-gray-500">Catégorie
                                                        <select data-journal-edit-cat v-model="journal.brouillon.categorieId" class="mt-0.5 w-full text-xs font-bold px-2 py-1.5 rounded-lg border border-gray-200 bg-white outline-none focus:border-blue-400 normal-case tracking-normal">
                                                            <option value="">À catégoriser</option>
                                                            <option v-if="journal.brouillon.categorieId && !categoriesPourRanger.some(g => g.items.some(c => c.id === journal.brouillon.categorieId))" data-journal-edit-cat-actuelle :value="journal.brouillon.categorieId">{{ getCategorieLabel(journal.brouillon.categorieId) || journal.brouillon.categorieId }} (actuelle)</option>
                                                            <optgroup v-for="g in categoriesPourRanger" :key="'je_' + g.label" :label="g.label">
                                                                <option v-for="c in g.items" :key="'jec_' + c.id" :value="c.id">{{ c.label }}</option>
                                                            </optgroup>
                                                        </select>
                                                    </label>
                                                    <label class="text-[10px] font-black uppercase tracking-wider text-gray-500 sm:col-span-2">Compte
                                                        <select data-journal-edit-compte v-model="journal.brouillon.compteId" class="mt-0.5 w-full text-xs font-bold px-2 py-1.5 rounded-lg border border-gray-200 bg-white outline-none focus:border-blue-400 normal-case tracking-normal">
                                                            <option value="">Sans compte</option>
                                                            <option v-for="c in journalComptes" :key="'jeo_' + c.id" :value="String(c.id)">{{ c.label }}</option>
                                                        </select>
                                                    </label>
                                                </div>
                                                <label class="block text-[10px] font-black uppercase tracking-wider text-violet-700">💡 Ce que je retiens
                                                    <textarea data-journal-edit-note v-model="journal.brouillon.note" rows="2" placeholder="ex. « Marjane le samedi soir : panier +40 %, y aller en semaine »"
                                                              class="mt-0.5 w-full text-xs font-semibold px-2 py-1.5 rounded-lg border border-violet-200 bg-white outline-none focus:border-violet-400 normal-case tracking-normal"></textarea>
                                                </label>
                                                <div class="flex flex-wrap items-center gap-2">
                                                    <label class="inline-flex items-center gap-1 text-[11px] font-bold text-violet-800 cursor-pointer select-none mr-auto">
                                                        <input type="checkbox" data-journal-edit-lecon v-model="journal.brouillon.lecon" class="accent-violet-600"/> 📌 C'est une leçon
                                                    </label>
                                                    <button type="button" data-journal-meme @click="filtrerJournalLibelle(x.t.libelle)" class="px-2.5 py-1.5 rounded-lg text-[11px] font-black text-slate-700 bg-slate-100 hover:bg-slate-200">🔎 Toutes les « {{ String(x.t.libelle || '').slice(0, 18) }} »</button>
                                                    <button type="button" data-journal-ressaisir @click="ressaisirOperation(x.t.id)" class="px-2.5 py-1.5 rounded-lg text-[11px] font-black text-emerald-800 bg-emerald-50 hover:bg-emerald-100">↻ Ressaisir aujourd'hui</button>
                                                    <button type="button" data-journal-supprimer @click="supprimerOperation(x.t.id)"
                                                            :class="['px-2.5 py-1.5 rounded-lg text-[11px] font-black', journal.confirmerSuppression === x.t.id ? 'bg-red-600 text-white' : 'text-red-700 bg-red-50 hover:bg-red-100']">{{ journal.confirmerSuppression === x.t.id ? 'Confirmer la suppression' : '🗑 Supprimer' }}</button>
                                                    <button type="button" data-journal-enregistrer @click="enregistrerOperation()" class="px-3 py-1.5 rounded-lg text-[11px] font-black text-white bg-blue-600 hover:bg-blue-700">✓ Enregistrer</button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </div>

                        <!-- ── 🗂️ PAR CATÉGORIE : chaque famille, ses lignes, l'écart au cycle précédent ── -->
                        <div v-else-if="journal.vue === 'categorie'" data-journal-par-categorie class="divide-y divide-gray-100">
                            <div v-for="f in journalParCategorie" :key="'jf_' + f.id" data-journal-famille :data-cat="f.id">
                                <button type="button" data-journal-famille-entete @click="journal.famillesOuvertes[f.id] = !f.ouvert" class="w-full px-4 md:px-6 py-2.5 text-left hover:bg-gray-50">
                                    <div class="flex items-baseline gap-2">
                                        <span class="text-[10px] text-gray-400">{{ f.ouvert ? '▾' : '▸' }}</span>
                                        <span class="text-sm font-black text-gray-800 truncate">{{ f.label }}</span>
                                        <span class="text-[10px] font-bold text-gray-400">{{ f.n }} op.</span>
                                        <span v-if="f.ecart != null" data-journal-ecart :class="['text-[10px] font-black', f.ecart > 0.05 ? 'text-red-600' : f.ecart < -0.05 ? 'text-emerald-600' : 'text-gray-400']"
                                              :title="'Cycle précédent : ' + formatMAD(f.precedent)">{{ f.ecart > 0 ? '▲ +' : '▼ −' }}{{ Math.abs(Math.round(f.ecart * 100)) }} % vs cycle préc.</span>
                                        <span class="ml-auto text-sm font-black tabular-nums text-red-700">−{{ formatMAD(f.total) }}</span>
                                    </div>
                                    <div class="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden"><div class="h-full bg-slate-500" :style="{ width: Math.max(2, Math.round(f.part * 100)) + '%' }"></div></div>
                                </button>
                                <ul v-if="f.ouvert" class="pb-2">
                                    <li v-for="g in f.lignes" :key="'jl_' + g.id" data-journal-ligne-cat :data-cat="g.id" class="px-4 md:px-6 py-1.5 pl-8 md:pl-10 flex flex-wrap items-baseline gap-x-2">
                                        <button type="button" data-journal-voir-cat @click="filtrerJournalCategorie(g.id)" class="text-xs font-bold text-blue-700 hover:underline">{{ g.label }}</button>
                                        <span class="text-[10px] font-bold text-gray-400">{{ g.n }} × · moy. {{ formatMAD(g.moyenne) }}<span v-if="g.dernier"> · dernier {{ g.dernier.slice(8, 10) }}/{{ g.dernier.slice(5, 7) }}</span></span>
                                        <span class="ml-auto text-xs font-black tabular-nums text-gray-700">−{{ formatMAD(g.total) }}</span>
                                        <span v-if="g.top.length" class="w-full text-[10px] text-gray-400 truncate">{{ g.top.join(' · ') }}</span>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        <!-- ── 💡 LEÇONS : ce que vous avez retenu, par catégorie ── -->
                        <div v-else data-journal-lecons class="px-4 md:px-6 py-3 space-y-3">
                            <p v-if="!journalLecons.length" class="text-xs text-gray-500 italic">Aucune leçon sur cette période. Ouvrez une opération (un clic) et écrivez « ce que je retiens » : elle apparaîtra ici, rangée par catégorie.</p>
                            <div v-for="f in journalLecons" :key="'jlf_' + f.id" data-journal-lecon-famille>
                                <p class="text-[11px] font-black uppercase tracking-widest text-violet-800 mb-1">{{ f.label }} · {{ f.ops.length }}</p>
                                <ul class="space-y-1.5">
                                    <li v-for="x in f.ops" :key="'jlo_' + x.t.id" data-journal-lecon class="rounded-xl border border-violet-100 bg-violet-50/50 px-3 py-2">
                                        <p class="text-xs font-semibold text-violet-900">{{ x.t.lecon ? '📌 ' : '💡 ' }}{{ x.t.note || '(leçon sans note)' }}</p>
                                        <p class="text-[10px] font-bold text-gray-500 mt-0.5">
                                            {{ x.ymd ? x.ymd.slice(8, 10) + '/' + x.ymd.slice(5, 7) + '/' + x.ymd.slice(0, 4) : 'sans date' }} · {{ x.t.libelle }} · −{{ formatMAD(x.montant) }} · {{ x.catLabel }}
                                            <button type="button" data-journal-lecon-ouvrir @click="journal.vue = 'date'; journal.q = ''; ouvrirOperation(x.t.id)" class="text-blue-700 hover:underline ml-1">ouvrir</button>
                                        </p>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>

'''
sub('logique du journal', "                    const transactionsReellesTriees = computed(() => {", JS + "                    const transactionsReellesTriees = computed(() => {")
d = src.index('                    <div class="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">\n                        <div class="px-4 md:px-6 py-3 md:py-4 border-b border-gray-100 bg-slate-50 flex items-center justify-between">\n                            <h3 class="font-black uppercase tracking-widest text-gray-700 text-xs md:text-sm">📋 Journal</h3>')
f = src.index('                    <!-- v37.49 : les règles de catégorisation, visibles -->')
assert d < f and src.count('<h3 class="font-black uppercase tracking-widest text-gray-700 text-xs md:text-sm">📋 Journal</h3>') == 1
src = src[:d] + TPL + src[f:]
sub('exposer', "transactionsReellesTriees, supprimerTransactionReelle, ajouterTransactionReelle,",
    "transactionsReellesTriees, supprimerTransactionReelle, ajouterTransactionReelle,\n                        journal, journalToutes, journalFiltrees, journalResume, journalParDate, journalParCategorie, journalLecons, journalComptes, journalSources,\n                        ouvrirOperation, enregistrerOperation, supprimerOperation, ressaisirOperation, filtrerJournalCategorie, filtrerJournalLibelle, effacerFiltresJournal,")
sub('banque : « 7) » = le jour', r"const j = l.match(/^(\d{1,2})\s*[|¦│]?\s+(?=.*\p{L}{3})(.*)$/u);",
    r"const j = l.match(/^(\d{1,2})\s*[|¦│)\]]?\s+(?=.*\p{L}{3})(.*)$/u);   // v37.57 : « 7) GOOGLE… » — « | » lu « ) »")
io.open(F, 'w', encoding='utf-8').write(src)
print('✔ v37.57 — le journal, outil de travail (vues, filtres, archives par cycle, édition, leçons)')
