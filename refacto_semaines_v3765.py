# -*- coding: utf-8 -*-
"""
v37.65 — LES SEMAINES COUPÉES PAR LA PAIE.

« Vérifie les semaines qui tombent sur 2 cycles : j'avais rentré des infos faussées, ce n'est pas clair quoi
rentrer et jusqu'à quand ; l'appli me propose le réalisé sur une semaine même si cette semaine est partagée
entre 2 cycles, ce qui fausse les choses ! »
Depuis la v37.27, une semaine (lundi → dimanche) appartenait EN ENTIER au cycle où tombe son jeudi. Paie le
mardi 27 oct. : la semaine du 26 oct. au 1ᵉʳ nov. comptait dans le cycle de novembre, lundi 26 compris (payé
avec l'argent d'octobre) ; celle du 23 au 29 nov. aussi, alors que la paie suivante tombe le vendredi 27.
  • Une semaine coupée par la paie se saisit en DEUX MORCEAUX, chacun dans son cycle : « lundi 26 oct. »
    (le cycle d'octobre), puis « du 27 oct. au 1ᵉʳ nov. » (celui de novembre). Un cycle = ses jours, ni plus
    ni moins : la carte « Par semaine » le dit (« ✂️ semaine coupée par la paie »), ‹ › passent d'un morceau
    à l'autre.
  • Le prévu d'un morceau est au prorata de ses jours (6 jours = 6/7 du prévu de la semaine) : un poste
    « / sem » coûte valeur × jours du cycle ÷ 7 (31 jours = 4 sem. 3 j), une charge « / mois » se répartit
    sur les jours. Tenir son prévu chaque morceau = tenir le budget du cycle, au dirham près.
  • Les tickets du cycle sont ceux de SES jours ; le Relevé coupe ses lignes de charges variables à la veille
    de la paie (« semaine du 23 nov. au 26 nov. »).
  • Les saisies déjà faites ne bougent pas de cycle (schéma 20) : l'ancienne clé du lundi d'une semaine dont
    la paie tombe un mardi, un mercredi ou un jeudi désignait la partie d'APRÈS la paie — elle devient la clé
    du jour de paie. Paie un vendredi, un samedi, un dimanche : rien ne bouge.
"""
import io, sys
F = 'index.html'
src = io.open(F, encoding='utf-8').read()
def sub(label, a, b, n=1):
    global src
    if src.count(a) != n: print('✖', label, ':', src.count(a), 'ancre(s),', n, 'attendue(s)'); sys.exit(1)
    src = src.replace(a, b)

# ── 1. Les morceaux d'un cycle ; un cycle = ses jours ────────────────────────────────────────────────────
sub('semainesDuCycle',
"""                    /*  v37.29 — LES VRAIES SEMAINES D'UN CYCLE (fin du « × 4,3 »).
                        Le cycle du mois budgétaire M court du jour de paie de M−1 à la
                        veille du jour de paie de M (la fenêtre de la saisie par semaine) ;
                        une semaine lui appartient si son JEUDI y tombe (v37.27). Un cycle
                        compte donc 4 ou 5 semaines — jamais 4,3 — et l'année 52 ou 53.
                        Une catégorie « / sem » coûte valeur × N ce cycle-là ; une catégorie
                        « / mois » se répartit sur ses N semaines. */
                    const semainesDuCycle = (mois, an) => {
                        const jdp = Number((soldesInitiaux.value || {}).jourDePaie) || 27;
                        const m = Number(mois) || MOIS_BUDGETAIRE_COURANT();
                        const a = Number(an) || Number(moisBudgetaire?.value?.an) || new Date().getFullYear();
                        const debut = new Date(a, m - 2, jdp), fin = new Date(a, m - 1, jdp - 1);
                        const jeudi = new Date(debut.getFullYear(), debut.getMonth(), debut.getDate() + ((4 - debut.getDay() + 7) % 7));
                        let n = 0;
                        while (jeudi.getTime() <= fin.getTime() && n < 6) { n++; jeudi.setDate(jeudi.getDate() + 7); }
                        return n || 4;
                    };""",
"""                    /*  v37.65 — LES SEMAINES COUPÉES PAR LA PAIE (avant : la règle du jeudi, v37.27-29).
                        Le cycle du mois budgétaire M court du jour de paie de M−1 à la veille du
                        jour de paie de M. Ses MORCEAUX : ses semaines (lundi → dimanche), coupées
                        à ses bornes — paie un mardi, la semaine se saisit en deux morceaux, chacun
                        dans son cycle (« lundi 26 oct. » | « du 27 oct. au 1ᵉʳ nov. »). Un cycle
                        compte ses JOURS : un poste « / sem » coûte valeur × jours ÷ 7 (31 jours =
                        4 sem. 3 j), un poste « / mois » se répartit sur ses jours ; le prévu d'un
                        morceau est au prorata des siens. Tenir son prévu à chaque morceau = tenir
                        le budget du cycle. Sur l'année : 365 ÷ 7 semaines.
                        La part d'un morceau (partDuMorceau) : une semaine entière reçoit pile son
                        prévu ; les morceaux coupés se partagent l'arrondi — la somme des morceaux
                        vaut la part du cycle au dirham près (514 + 600 + 600 + 600 + 343 = 2 657).
                        → morceaux : [{ debut, fin, lundi, dimanche (Date), jours, coupe, avant, total, bornes }] */
                    const _bornesCycle = (mois, an) => {
                        const jdp = Number((soldesInitiaux.value || {}).jourDePaie) || 27;
                        const m = Number(mois) || MOIS_BUDGETAIRE_COURANT();
                        const a = Number(an) || Number(moisBudgetaire?.value?.an) || new Date().getFullYear();
                        return { mois: m, an: a, debut: new Date(a, m - 2, jdp), fin: new Date(a, m - 1, jdp - 1) };
                    };
                    const morceauxEntre = (debut, fin) => {
                        const out = [];
                        let d = new Date(debut.getFullYear(), debut.getMonth(), debut.getDate());
                        const d0 = d, f0 = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate());
                        const total = Math.round((f0 - d0) / 864e5) + 1;
                        while (d <= f0 && out.length < 8) {
                            const lundi = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
                            const dimanche = new Date(lundi.getFullYear(), lundi.getMonth(), lundi.getDate() + 6);
                            const f = dimanche < f0 ? dimanche : f0;
                            const jours = Math.round((f - d) / 864e5) + 1;
                            out.push({ debut: d, fin: f, lundi, dimanche, jours, coupe: jours < 7, avant: Math.round((d - d0) / 864e5), total, bornes: { debut: d0, fin: f0 } });
                            d = new Date(f.getFullYear(), f.getMonth(), f.getDate() + 1);
                        }
                        return out;
                    };
                    const morceauxDuCycle = (mois, an) => { const b = _bornesCycle(mois, an); return morceauxEntre(b.debut, b.fin); };
                    const joursDuCycle = (mois, an) => { const b = _bornesCycle(mois, an); return Math.round((b.fin - b.debut) / 864e5) + 1; };
                    //  Le morceau (et son cycle) qui contient une date — ISO ou Date
                    const morceauDe = (quand) => {
                        const d0 = quand instanceof Date ? quand : (() => { const [y, m, j] = String(quand).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, j); })();
                        const d = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate());
                        for (const k of [0, 1, -1, 2]) {
                            const t = new Date(d.getFullYear(), d.getMonth() + k, 1), b = _bornesCycle(t.getMonth() + 1, t.getFullYear());
                            if (d >= b.debut && d <= b.fin) {
                                const ms = morceauxEntre(b.debut, b.fin), i = ms.findIndex(x => d >= x.debut && d <= x.fin);
                                return { ...ms[i], rang: i + 1, nb: ms.length, cycle: { mois: b.mois, an: b.an, debut: b.debut, fin: b.fin, jours: Math.round((b.fin - b.debut) / 864e5) + 1 } };
                            }
                        }
                        return null;
                    };
                    const semainesDuCycle = (mois, an) => joursDuCycle(mois, an) / 7;
                    //  La part d'un montant de CYCLE (total arrondi, et sa valeur brute) qui revient à un
                    //  morceau : brut × jours ÷ jours du cycle, arrondi par les plus forts restes sur les
                    //  morceaux du cycle — une semaine entière tombe pile (600), la somme sur le total.
                    const partDuMorceau = (total, brut, mo) => {
                        const ms = morceauxEntre(mo.bornes.debut, mo.bornes.fin);
                        const x = ms.map(m => { const v = (Number(brut) || 0) * m.jours / mo.total; return Math.abs(v - Math.round(v)) < 1e-6 ? Math.round(v) : v; });
                        const base = x.map(v => Math.floor(v));
                        let reste = Math.round(Number(total) || 0) - base.reduce((s, v) => s + v, 0);
                        x.map((v, i) => [v - base[i], i]).filter(([f]) => f > 1e-9).sort((a, b) => b[0] - a[0] || a[1] - b[1])
                            .forEach(([, i]) => { if (reste > 0) { base[i]++; reste--; } });
                        if (reste) base[base.length - 1] += reste;
                        const i = ms.findIndex(m => m.avant === mo.avant);
                        return i < 0 ? 0 : base[i];
                    };
                    //  « 4 sem. 3 j » — ce que vaut un cycle en semaines, dit en jours
                    const libSemaines = (n) => { const j = Math.round((Number(n) || 0) * 7), s = Math.floor(j / 7), r = j % 7; return s + ' sem.' + (r ? ' ' + r + ' j' : ''); };""")

# ── 2. Le Relevé : une ligne par morceau, coupée à la veille de la paie ──────────────────────────────────
sub('relevé doc',
"""                    /*  v37.46 — LES CHARGES VARIABLES, SEMAINE PAR SEMAINE.
                        Le Relevé déduisait tout le budget variable d'un cycle le 15, d'un bloc.
                        On le répartit sur les semaines réelles du cycle (celles dont le JEUDI
                        tombe dans le cycle, comme semainesDuCycle) : une ligne par semaine,
                        datée de son lundi, borné au début du cycle.
                          • cycle à venir : parts égales sur les N semaines ;""",
"""                    /*  v37.46 — LES CHARGES VARIABLES, SEMAINE PAR SEMAINE.
                        Le Relevé déduisait tout le budget variable d'un cycle le 15, d'un bloc.
                        On le répartit sur les morceaux du cycle (v37.65 : ses semaines, coupées
                        à la paie, comme la saisie) : une ligne par morceau, datée de son premier jour.
                          • cycle à venir : au prorata des jours de chaque morceau ;""")
sub('relevé morceaux',
"""                        const semaines = [];
                        for (let j = plus(debut, (4 - debut.getDay() + 7) % 7); j <= fin && semaines.length < 6; j = plus(j, 7))
                            semaines.push({ lundi: plus(j, -3), dimanche: plus(j, 3) });
                        let lignes = semaines.map(s => {
                            const date = new Date(Math.max(s.lundi, debut, auj || debut));
                            const poids = auj ? Math.max(0, Math.round((s.dimanche - Math.max(s.lundi, auj)) / 864e5) + 1) : 1;
                            const enCours = !!auj && s.lundi <= auj && auj <= s.dimanche;
                            return { date, poids, enCours,
                                     libelle: '🛒 Charges variables — ' + (enCours ? 'semaine en cours (jusqu’au ' + lib(s.dimanche) + ')' : 'semaine du ' + lib(s.lundi) + ' au ' + lib(s.dimanche)) };
                        }).filter(l => l.poids > 0);""",
"""                        let lignes = morceauxEntre(debut, fin).map(s => {
                            const date = new Date(Math.max(s.debut, auj || s.debut));
                            const poids = auj ? Math.max(0, Math.round((s.fin - Math.max(s.debut, auj)) / 864e5) + 1) : s.jours;
                            const enCours = !!auj && s.debut <= auj && auj <= s.fin;
                            return { date, poids, enCours,
                                     libelle: '🛒 Charges variables — ' + (enCours ? 'semaine en cours (jusqu’au ' + lib(s.fin) + ')' : 'semaine du ' + lib(s.debut) + ' au ' + lib(s.fin)) };
                        }).filter(l => l.poids > 0);""")
sub('relevé plus inutile',
"""                        const jour0 = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
                        const plus = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
                        const lib = (d) => d.getDate() + ' ' + _MOIS_SEM[d.getMonth()];""",
"""                        const jour0 = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
                        const lib = (d) => d.getDate() + ' ' + _MOIS_SEM[d.getMonth()];""")

# ── 3. Schéma 20 : les saisies déjà faites restent dans leur cycle ───────────────────────────────────────
sub('migration',
"""                    // ── Patch v15.1 : corrige soldeInitial→solde + inclureLiquidite ──""",
"""                    // ── v37.65 : LES SEMAINES COUPÉES PAR LA PAIE (schéma 20) ──────────
                    //  Une saisie de semaine était rangée sous 'S' + son lundi et appartenait au
                    //  cycle de son JEUDI. Désormais 'S' + le premier jour du MORCEAU. Paie un mardi,
                    //  un mercredi ou un jeudi : l'ancienne clé du lundi désignait la partie d'APRÈS
                    //  la paie (le jeudi y tombe) — elle devient 'S' + le jour de paie et reste dans
                    //  son cycle. Paie un vendredi, un samedi, un dimanche : la clé du lundi désigne
                    //  déjà la partie d'avant, rien ne bouge. Saisies et cases closes.
                    const migrerSemainesCoupees = (data) => {
                        if (!data || (data._schemaVersion || 0) >= 20) return 0;
                        const jdp = Number((data.soldesInitiaux || {}).jourDePaie) || 27;
                        const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
                        const estPaie = (d) => [0, -1].some(k => new Date(d.getFullYear(), d.getMonth() + k, jdp).getTime() === d.getTime());
                        let n = 0;
                        Object.values(data.donneesAnnuelles || {}).forEach(a => ['consoRealiseeT0', 'consoClotureT0'].forEach(champ => {
                            const r = a && a[champ];
                            if (!r || typeof r !== 'object') return;
                            Object.keys(r).forEach(k => {
                                const m = /^S(\\d{4})-(\\d{2})-(\\d{2})$/.exec(k);
                                if (!m || !r[k] || typeof r[k] !== 'object') return;
                                const lundi = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
                                if (lundi.getDay() !== 1) return;
                                for (let i = 1; i <= 3; i++) {
                                    const d = new Date(lundi.getFullYear(), lundi.getMonth(), lundi.getDate() + i);
                                    if (!estPaie(d)) continue;
                                    const nk = 'S' + ymd(d);
                                    r[nk] = Object.assign({}, r[nk] && typeof r[nk] === 'object' ? r[nk] : {}, r[k]);
                                    delete r[k]; n++;
                                    break;
                                }
                            });
                        }));
                        return n;
                    };

                    // ── Patch v15.1 : corrige soldeInitial→solde + inclureLiquidite ──""")
sub('migration appel',
"""                            migrateEpargneToArray(data); // v17.15 : objet → tableau avant safeMerge""",
"""                            migrateEpargneToArray(data); // v17.15 : objet → tableau avant safeMerge
                            const _nSemCoupees = migrerSemainesCoupees(data);   // v37.65 : schéma 20
                            if (_nSemCoupees) addLog('✅ Semaines coupées par la paie : ' + _nSemCoupees + ' saisie(s) re-rangée(s) sous le jour de paie, dans leur cycle.', 'success');""")
sub('schéma 20',
"""                    const getExportData = () => ({ version: CURRENT_VERSION, _schemaVersion: 19,""",
"""                    const getExportData = () => ({ version: CURRENT_VERSION, _schemaVersion: 20,""")

# ── 4. Le compteur : morceaux, tickets, défauts, cases closes ────────────────────────────────────────────
sub('semaine du cycle',
"""                    const _semaineDansCycle = (lundiISO) => {
                        const t = _jeudiISO(lundiISO), { debut, fin } = consoT0Fenetre.value;
                        return t >= _ymd(debut) && t <= _ymd(fin);
                    };""",
"""                    //  v37.65 : un morceau (clé = son premier jour) appartient au cycle qui contient ce jour
                    const _semaineDansCycle = (debutISO) => {
                        const { debut, fin } = consoT0Fenetre.value;
                        return debutISO >= _ymd(debut) && debutISO <= _ymd(fin);
                    };""")
sub('doc clés',
"""                       Une semaine = un lundi (YYYY-MM-DD). Clé de stockage : 'S' + lundi,
                       dans consoRealiseeT0, comme les cycles. Une semaine appartient au
                       cycle où tombe son JEUDI : la majorité de ses jours. */""",
"""                       Une semaine = un lundi (YYYY-MM-DD). Clé de stockage : 'S' + lundi,
                       dans consoRealiseeT0, comme les cycles. v37.65 : une semaine coupée par
                       la paie se saisit en deux MORCEAUX, 'S' + le premier jour de chacun
                       (le lundi, puis le jour de paie) — chacun dans son cycle. */""")
sub('tickets du cycle',
"""                        const { debut, fin } = consoT0Fenetre.value;
                        const auj = new Date();
                        //  v37.31 : les tickets des SEMAINES du cycle (règle du jeudi, v37.27), comme
                        //  les saisies : du lundi de la 1ʳᵉ semaine au dimanche de la dernière.
                        //  Un ticket du lundi 5 oct. compte dans le cycle qui commence le jeudi 8.
                        const j1 = new Date(debut.getFullYear(), debut.getMonth(), debut.getDate() + ((4 - debut.getDay() + 7) % 7));
                        const jN = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate() - ((fin.getDay() - 4 + 7) % 7));
                        const lundi1 = new Date(j1.getFullYear(), j1.getMonth(), j1.getDate() - 3), dimN = new Date(jN.getFullYear(), jN.getMonth(), jN.getDate() + 3);
                        return _lireTickets(_ymd(lundi1), _ymd(dimN < auj ? dimN : auj));""",
"""                        const { debut, fin } = consoT0Fenetre.value;
                        const auj = new Date();
                        //  v37.65 : les tickets des JOURS du cycle, comme ses morceaux (avant : ceux de
                        //  ses semaines entières, règle du jeudi — un ticket de la veille de la paie
                        //  comptait dans le cycle suivant).
                        return _lireTickets(_ymd(debut), _ymd(fin < auj ? fin : auj));""")
sub('prévu hebdo',
"""                    const prevuHebdoLignes = (key, cv, budget, n) => {
                        const dets = (cv.details || []).filter(x => x && Number(x.montant) > 0);
                        if (!dets.length) return { [key]: Math.round(budget / n) };
                        const parts = _partsCycleLignes(cv, budget, n);
                        const out = {};
                        parts.forEach(p => { if (periodeDetail(p.x, cv) === 'semaine') out[cleDetailT0(key, p.x)] = Math.round(p.part / n); });
                        return out;
                    };""",
"""                    //  v37.65 : q = un morceau du cycle — sa part des lignes (partDuMorceau : une semaine
                    //  entière retombe pile sur son prévu, la somme des morceaux sur la part du cycle) ;
                    //  ou la part de semaine (jours ÷ 7) d'un morceau d'un autre cycle
                    const prevuHebdoLignes = (key, cv, budget, n, q = 1) => {
                        const dets = (cv.details || []).filter(x => x && Number(x.montant) > 0);
                        if (q && typeof q === 'object') {
                            const B = budgetCategorieRevise(cv);
                            if (!dets.length) return { [key]: partDuMorceau(budget, B, q) };
                            const poids = (x) => Number(x.montant) * facteurPeriode(periodeDetail(x, cv), n);
                            const W = dets.reduce((s, x) => s + poids(x), 0), out = {};
                            _partsCycleLignes(cv, budget, n).forEach(p => { if (periodeDetail(p.x, cv) === 'semaine') out[cleDetailT0(key, p.x)] = partDuMorceau(p.part, W > 0 ? B * poids(p.x) / W : 0, q); });
                            return out;
                        }
                        if (!dets.length) return { [key]: Math.round(budget / n * q) };
                        const parts = _partsCycleLignes(cv, budget, n);
                        const out = {};
                        parts.forEach(p => { if (periodeDetail(p.x, cv) === 'semaine') out[cleDetailT0(key, p.x)] = Math.round(p.part / n * q); });
                        return out;
                    };""")
sub('cases closes',
"""                        //  Les semaines du cycle (règle du jeudi)
                        const { debut, fin } = consoT0Fenetre.value;
                        const j = new Date(debut.getFullYear(), debut.getMonth(), debut.getDate() + ((4 - debut.getDay() + 7) % 7));
                        for (; j.getTime() <= fin.getTime(); j.setDate(j.getDate() + 7)) {
                            const lundi = _ymd(new Date(j.getFullYear(), j.getMonth(), j.getDate() - 3));
                            const fermes = CL['S' + lundi];
                            if (!fermes || !Object.keys(fermes).length) continue;
                            const vals = _valeursSemaine(lundi), T = _lireTickets(lundi, _ymd(_decaler(lundi, 6)));
                            cats.forEach(({ key, cv, budget }) => {
                                const g = T.parCle[key] || { total: 0, parPoste: {} }, idDe = idsDe(key, cv);
                                Object.entries(prevuHebdoLignes(key, cv, budget, n)).forEach(([cle, v]) => {""",
"""                        //  Les morceaux du cycle (v37.65 : ses semaines, coupées à la paie)
                        const { debut, fin } = consoT0Fenetre.value;
                        for (const s of morceauxEntre(debut, fin)) {
                            const lundi = _ymd(s.debut);
                            const fermes = CL['S' + lundi];
                            if (!fermes || !Object.keys(fermes).length) continue;
                            const vals = _valeursSemaine(lundi), T = _lireTickets(lundi, _ymd(s.fin));
                            cats.forEach(({ key, cv, budget }) => {
                                const g = T.parCle[key] || { total: 0, parPoste: {} }, idDe = idsDe(key, cv);
                                Object.entries(prevuHebdoLignes(key, cv, budget, n, s)).forEach(([cle, v]) => {""")
sub('défauts tête',
"""                    //  Les défauts d'UNE semaine (lundi ISO) : {} tant qu'elle n'est pas écoulée.
                    //  v37.48 : projeter = ce qu'ELLE retiendra à sa clôture (semaine en cours).
                    const defautsSemaine = (lundiISO, projeter = false) => {
                        const dimanche = _ymd(_decaler(lundiISO, 6));
                        if (!projeter && !(dimanche < _ymd(new Date()))) return {};""",
"""                    //  Les défauts d'UN morceau (son premier jour, ISO) : {} tant qu'il n'est pas écoulé.
                    //  v37.48 : projeter = ce qu'IL retiendra à sa clôture (morceau en cours).
                    //  v37.65 : un morceau coupé par la paie retient le prévu de SES jours (6 j = 6/7).
                    const defautsSemaine = (debutISO, projeter = false) => {
                        const mo = morceauDe(debutISO);
                        if (!mo) return {};
                        const lundiISO = debutISO, dimanche = _ymd(mo.fin), qSem = _semaineDansCycle(debutISO) ? mo : mo.jours / 7;
                        if (!projeter && !(dimanche < _ymd(new Date()))) return {};""")
sub('défauts prévu',
"""                            Object.entries(prevuHebdoLignes(key, cv, budget, n)).forEach(([cle, v]) => {
                                if (!(v > 0) || Object.prototype.hasOwnProperty.call(vals, cle)) return;   // saisi, même 0""",
"""                            Object.entries(prevuHebdoLignes(key, cv, budget, n, qSem)).forEach(([cle, v]) => {
                                if (!(v > 0) || Object.prototype.hasOwnProperty.call(vals, cle)) return;   // saisi, même 0""")
sub('défauts du cycle',
"""                        const { debut, fin } = consoT0Fenetre.value;
                        const out = {};
                        const j = new Date(debut.getFullYear(), debut.getMonth(), debut.getDate() + ((4 - debut.getDay() + 7) % 7));
                        for (; j.getTime() <= fin.getTime(); j.setDate(j.getDate() + 7)) {
                            const lundi = _ymd(new Date(j.getFullYear(), j.getMonth(), j.getDate() - 3));
                            const dft = defautsSemaine(lundi);
                            if (Object.keys(dft).length) out[lundi] = dft;
                        }
                        return out;""",
"""                        const { debut, fin } = consoT0Fenetre.value;
                        const out = {};
                        //  v37.65 : les morceaux du cycle — une semaine coupée par la paie n'y entre que par ses jours
                        for (const s of morceauxEntre(debut, fin)) {
                            const d0 = _ymd(s.debut), dft = defautsSemaine(d0);
                            if (Object.keys(dft).length) out[d0] = dft;
                        }
                        return out;""")

# ── 5. La carte « Par semaine » : le morceau affiché ─────────────────────────────────────────────────────
sub('carte semaine',
"""                        //  v37.27 : la SEMAINE affichée (lundi → dimanche), décalée de -1 / +1…
                        const auj = new Date();
                        const decal = semaineDecalage.value;
                        const idxAuj = (auj.getDay() + 6) % 7;
                        const lundiSel = _ymd(_decaler(_lundiISO(auj), 7 * decal));
                        const dimSel = _ymd(_decaler(lundiSel, 6));
                        const frac = decal < 0 ? 1 : (decal > 0 ? 0 : (idxAuj + 1) / 7);   // part de la semaine écoulée
                        const nSem = semainesDuCycle(mb.mois, mb.an);                       // v37.29 : 4 ou 5, jamais 4,3
                        const TS = _lireTickets(lundiSel, dimSel);
                        const valsSem = _valeursSemaine(lundiSel);
                        const baseCycle = consoT0SaisiesCycle.value;
                        const aSaisie = (cle) => Object.prototype.hasOwnProperty.call(valsSem, cle);
                        const defsSem = defautsSemaine(lundiSel);                        // v37.31 : {} si pas écoulée
                        //  v37.51 : les cases closes — de la semaine affichée (/ sem) et du cycle (/ 15 j, / cycle)
                        const closS = _cloturesConso.value['S' + lundiSel] || {}, closC = _cloturesConso.value['C' + consoT0CycleKey.value] || {};
                        //  v37.48 : la semaine EN COURS — ce que ses lignes encore vides compteront dimanche soir
                        const defsAVenir = decal === 0 && _semaineDansCycle(lundiSel) ? defautsSemaine(lundiSel, true) : {};""",
"""                        //  v37.27 : la SEMAINE affichée, décalée de -1 / +1… — v37.65 : le MORCEAU affiché
                        //  (une semaine coupée par la paie en compte deux, chacun dans son cycle)
                        const auj = new Date();
                        const decal = semaineDecalage.value;
                        let mSel = morceauDe(auj);
                        for (let k = 0; mSel && k < Math.abs(decal); k++)
                            mSel = morceauDe(decal < 0 ? _decaler(_ymd(mSel.debut), -1) : _decaler(_ymd(mSel.fin), 1));
                        const debutSel = _ymd(mSel.debut), finSel = _ymd(mSel.fin), lundiSel = _ymd(mSel.lundi), dimSel = _ymd(mSel.dimanche);
                        const idxAuj = Math.round((new Date(auj.getFullYear(), auj.getMonth(), auj.getDate()) - mSel.debut) / 864e5);
                        const frac = decal < 0 ? 1 : (decal > 0 ? 0 : (idxAuj + 1) / mSel.jours);   // part du morceau écoulée
                        const nSem = semainesDuCycle(mb.mois, mb.an);                       // v37.65 : jours du cycle ÷ 7
                        //  v37.65 : la part du morceau — dans le cycle, partDuMorceau (la part arrondie et sa
                        //  valeur brute) ; un morceau d'un autre cycle : 6/7 du prévu de la semaine
                        const dansSel = _semaineDansCycle(_ymd(mSel.debut));
                        const partSem = (brut, arrondi) => dansSel ? partDuMorceau(arrondi, brut, mSel) : Math.round(arrondi / nSem * mSel.jours / 7);
                        const TS = _lireTickets(debutSel, finSel);
                        const valsSem = _valeursSemaine(debutSel);
                        const baseCycle = consoT0SaisiesCycle.value;
                        const aSaisie = (cle) => Object.prototype.hasOwnProperty.call(valsSem, cle);
                        const defsSem = defautsSemaine(debutSel);                        // v37.31 : {} si pas écoulée
                        //  v37.51 : les cases closes — du morceau affiché (/ sem) et du cycle (/ 15 j, / cycle)
                        const closS = _cloturesConso.value['S' + debutSel] || {}, closC = _cloturesConso.value['C' + consoT0CycleKey.value] || {};
                        //  v37.48 : le morceau EN COURS — ce que ses lignes encore vides compteront à sa clôture
                        const defsAVenir = decal === 0 && _semaineDansCycle(debutSel) ? defautsSemaine(debutSel, true) : {};""")
sub('part brute',
"""                                            partCycle: Math.round(partCycle), engage: engP,""",
"""                                            partCycle: Math.round(partCycle), partBrute: budgetCategorieRevise(cv) * part, engage: engP,""")
sub('budget ligne / sem',
"""                                if (p.unite === 'semaine') {
                                    const bud = Math.round(p.partCycle / nSem);""",
"""                                if (p.unite === 'semaine') {
                                    const bud = partSem(p.partBrute, p.partCycle);""")
sub('prévu du morceau',
"""                            const prevuSemaine = Math.round((c.budget - prevuCycleLignes) / nSem);""",
"""                            //  v37.65 : avec des lignes « / sem », la somme de leurs prévus (la case tenue au prévu = la catégorie tenue)
                            const lignesSem = postesSem.filter(p => p.unite === 'semaine');
                            const prevuSemaine = lignesSem.length ? lignesSem.reduce((s, p) => s + p.budget, 0)
                                : partSem(budgetCategorieRevise(cv) - prevu.filter(p => p.unite !== 'semaine').reduce((s, p) => s + p.partBrute, 0), c.budget - prevuCycleLignes);""")
sub('nbSemaines',
"""joursCycle: joursCycleTotal.value, nbSemaines: nSem,""",
"""joursCycle: joursCycleTotal.value, nbSemaines: nSem, nbSemainesLib: libSemaines(nSem),""")
sub('objet semaine',
"""                                const lib = (iso) => { const t = _decaler(iso, 0); return t.getDate() + ' ' + _MOIS_COURTS[t.getMonth()]; };
                                const { debut, fin } = consoT0Fenetre.value, th = _jeudiISO(lundiSel);
                                return { decalage: decal, lundi: lundiSel, dimanche: dimSel, du: lib(lundiSel), au: lib(dimSel),
                                         statut: decal === 0 ? 'en_cours' : (decal < 0 ? 'passee' : 'avenir'),
                                         idxJour: decal === 0 ? idxAuj : null, frac, dansCycle: _semaineDansCycle(lundiSel),
                                         cycleRel: th < _ymd(debut) ? 'precedent' : (th > _ymd(fin) ? 'suivant' : null),
                                         //  v37.29 : « semaine 2 sur 4 » du cycle
                                         nb: nSem, rang: _semaineDansCycle(lundiSel) ? Math.round((_decaler(th, 0) - new Date(debut.getFullYear(), debut.getMonth(), debut.getDate() + ((4 - debut.getDay() + 7) % 7))) / 6048e5) + 1 : null,""",
"""                                const lib = (iso) => { const t = _decaler(iso, 0); return t.getDate() + ' ' + _MOIS_COURTS[t.getMonth()]; };
                                const { debut, fin } = consoT0Fenetre.value;
                                const dans = _semaineDansCycle(debutSel);
                                //  v37.65 : l'autre morceau d'une semaine coupée par la paie (dans l'autre cycle)
                                const autreDebut = debutSel > lundiSel ? lundiSel : _ymd(_decaler(finSel, 1)), autreFin = debutSel > lundiSel ? _ymd(_decaler(debutSel, -1)) : dimSel;
                                return { decalage: decal, debut: debutSel, fin: finSel, lundi: lundiSel, dimanche: dimSel, du: lib(debutSel), au: lib(finSel),
                                         jours: mSel.jours, coupe: mSel.coupe,
                                         autre: !mSel.coupe ? null : { du: lib(autreDebut), au: lib(autreFin), jours: Math.round((_decaler(autreFin, 0) - _decaler(autreDebut, 0)) / 864e5) + 1,
                                                                        rel: debutSel > lundiSel ? 'precedent' : 'suivant' },
                                         //  v37.65 : la clôture du morceau — le dimanche soir, ou la veille de la paie
                                         cloture: finSel === dimSel ? 'Dimanche soir' : 'Le ' + lib(finSel) + ' au soir (veille de paie)',
                                         statut: decal === 0 ? 'en_cours' : (decal < 0 ? 'passee' : 'avenir'),
                                         idxJour: decal === 0 ? idxAuj : null, frac, dansCycle: dans,
                                         cycleRel: debutSel < _ymd(debut) ? 'precedent' : (debutSel > _ymd(fin) ? 'suivant' : null),
                                         //  v37.29 : « semaine 2 sur 5 » du cycle — v37.65 : son morceau
                                         nb: mSel.nb, rang: dans ? mSel.rang : null, joursCycle: mSel.cycle.jours, nbLib: libSemaines(nSem),""")

# ── 6. Le gabarit de la carte ────────────────────────────────────────────────────────────────────────────
sub('titre carte',
"""                        <p class="text-[10px] md:text-[11px] font-black uppercase tracking-[0.12em] text-white/85" data-semaine-titre>Semaine du {{ sm.du }} au {{ sm.au }}</p>""",
"""                        <p class="text-[10px] md:text-[11px] font-black uppercase tracking-[0.12em] text-white/85" data-semaine-titre>{{ sm.jours === 1 ? 'Le ' + sm.du : 'Semaine du ' + sm.du + ' au ' + sm.au }} <button v-if="sm.coupe" type="button" data-semaine-coupe-badge @click="noteCoupe = !noteCoupe" :aria-expanded="noteCoupe ? 'true' : 'false'"
                                :title="'Semaine coupée par la paie : seulement ' + sm.jours + ' jour(s) dans ce cycle, prévu au prorata (' + sm.jours + '/7)'"
                                class="ml-1 normal-case tracking-normal font-bold text-amber-200 rounded-full ring-1 ring-amber-200/50 px-1.5 hover:bg-amber-200/10">✂️ {{ sm.jours }} j</button></p>""")
sub('rang carte',
"""                            <span v-if="sm.rang" data-semaine-rang class="font-bold text-white/70" :title="'Ce cycle compte ' + sm.nb + ' semaines : son budget = ' + sm.nb + ' × le prévu de la semaine'">sem. {{ sm.rang }}/{{ sm.nb }}</span>""",
"""                            <span v-if="sm.rang" data-semaine-rang class="font-bold text-white/70" :title="'Ce cycle compte ' + sm.joursCycle + ' jours (' + sm.nbLib + ') en ' + sm.nb + ' morceaux : son budget = le prévu de la semaine × ' + sm.joursCycle + ' ÷ 7'">sem. {{ sm.rang }}/{{ sm.nb }}</span>""")
sub('note coupée',
"""                <p v-if="!sm.dansCycle" data-semaine-hors class="mb-2 rounded-lg bg-white/[0.07] ring-1 ring-white/10 px-2.5 py-1.5 text-[10px] font-semibold text-white/75 leading-snug">
                    ℹ️ Cette semaine appartient au cycle {{ sm.cycleRel === 'precedent' ? 'précédent' : 'suivant' }} : elle ne change pas le Reste à dépenser ci-dessus.
                </p>""",
"""                <!-- v37.65 : une semaine coupée par la paie se saisit en deux morceaux, chacun dans son cycle —
                     au téléphone, la note se déplie d'une touche sur « ✂️ N j » (la Météo tient dans un écran) -->
                <p v-if="sm.coupe && sm.autre" data-semaine-coupee :class="['mb-2 rounded-lg bg-amber-300/15 ring-1 ring-amber-200/40 px-2.5 py-1.5 text-[10px] font-semibold text-white/90 leading-snug', noteCoupe ? '' : 'hidden md:block']">
                    ✂️ Semaine coupée par la paie : ici, seulement {{ sm.jours === 1 ? 'le ' + sm.du : 'du ' + sm.du + ' au ' + sm.au }} ({{ sm.jours }} j) — tapez ce qui est parti ces jours-là ; {{ sm.autre.jours === 1 ? 'le ' + sm.autre.du : 'du ' + sm.autre.du + ' au ' + sm.autre.au }} se saisit dans le cycle {{ sm.autre.rel === 'precedent' ? 'précédent (‹)' : 'suivant (›)' }}. Prévu au prorata : {{ sm.jours }}/7 de la semaine.
                </p>
                <p v-if="!sm.dansCycle" data-semaine-hors class="mb-2 rounded-lg bg-white/[0.07] ring-1 ring-white/10 px-2.5 py-1.5 text-[10px] font-semibold text-white/75 leading-snug">
                    ℹ️ {{ sm.coupe ? 'Ces jours appartiennent' : 'Cette semaine appartient' }} au cycle {{ sm.cycleRel === 'precedent' ? 'précédent' : 'suivant' }} : {{ sm.coupe ? 'ils ne changent' : 'elle ne change' }} pas le Reste à dépenser ci-dessus.
                </p>""")
sub('état de la note',
"""            data() { return { rx: null, rxEpingle: false, rxStyle: {}, rxTousPostes: false, ouvertes: { ...(etatUI['meteo.postes'] || {}) }, caseActive: null }; },""",
"""            data() { return { rx: null, rxEpingle: false, rxStyle: {}, rxTousPostes: false, ouvertes: { ...(etatUI['meteo.postes'] || {}) }, caseActive: null, noteCoupe: false }; },""")
sub('clôture annoncée',
"""                    ⏳ Dimanche soir, la semaine se clôt : une ligne tapée compte ce que vous avez tapé ;""",
"""                    ⏳ {{ sm.cloture }}, la semaine se clôt : une ligne tapée compte ce que vous avez tapé ;""")
sub('clé de saisie (gabarit)', 'sm.lundi', 'sm.debut', n=8)
sub('Rayons X semaines',
"""<span class="text-[10px] font-bold text-slate-400 tabular-nums" data-rx-prevu-semaines>cycle de {{ p.nbSemaines }} semaines</span>""",
"""<span class="text-[10px] font-bold text-slate-400 tabular-nums" data-rx-prevu-semaines>cycle de {{ p.joursCycle }} jours ({{ p.nbSemainesLib }})</span>""")
sub('Rayons X poste',
"""' sur ce cycle de ' + p.nbSemaines + ' semaines · '""",
"""' sur ce cycle de ' + p.joursCycle + ' jours · '""")
sub('Charges variables : semaines du cycle', """{{ cy.label }} : {{ cy.n }} sem. →""", """{{ cy.label }} : {{ libSemaines(cy.n) }} →""", n=2)
sub('Prévisionnel : semaines du cycle',
"""{{ formatMAD(respirationBudgetaire.consoParSemaine) }} par semaine × {{ respirationBudgetaire.semaines }} semaines ce cycle""",
"""{{ formatMAD(respirationBudgetaire.consoParSemaine) }} par semaine × {{ libSemaines(respirationBudgetaire.semaines) }} ce cycle""")
sub('règle du jeudi retirée',
"""                    const _lundiISO = (dt) => _ymd(new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() - ((dt.getDay() + 6) % 7)));
                    const _jeudiISO = (lundiISO) => _ymd(_decaler(lundiISO, 3));
""", "")
sub('exposition',
"""                        semainesDuCycle, semainesDeLAnnee, cyclesSemaines,""",
"""                        semainesDuCycle, semainesDeLAnnee, cyclesSemaines, morceauxDuCycle, morceauDe, joursDuCycle, libSemaines, partDuMorceau, migrerSemainesCoupees,""")

io.open(F, 'w', encoding='utf-8').write(src)

# ── 7. Le serveur (recalcul de secours de l'agent CFO) suit la même règle ───────────────────────────────
P = 'cfo_intent_engine.php'
php = io.open(P, encoding='utf-8').read()
a1 = """/*  v37.29 — Les semaines RÉELLES d'un cycle (miroir de semainesDuCycle, index.html).
    Le cycle du mois budgétaire M court du jour de paie de M−1 à la veille du jour de
    paie de M ; une semaine lui appartient si son JEUDI y tombe. 4 ou 5, jamais 4,3. */
function cfo_semaines_cycle(int $m, int $an, int $jdp): int {
    if ($jdp < 1) $jdp = 27;
    $debut = (new DateTimeImmutable('now', new DateTimeZone('UTC')))->setDate($an, $m - 1, $jdp)->setTime(12, 0);
    $fin   = (new DateTimeImmutable('now', new DateTimeZone('UTC')))->setDate($an, $m, $jdp - 1)->setTime(12, 0);
    $jeudi = $debut->modify('+' . ((4 - (int)$debut->format('w') + 7) % 7) . ' days');
    $n = 0;
    while ($jeudi <= $fin && $n < 6) { $n++; $jeudi = $jeudi->modify('+7 days'); }
    return $n ?: 4;
}
function cfo_semaines_annee(int $an, int $jdp): int {
    $s = 0; for ($m = 1; $m <= 12; $m++) $s += cfo_semaines_cycle($m, $an, $jdp);
    return $s;
}"""
b1 = """/*  v37.65 — Les semaines d'un cycle = ses JOURS ÷ 7 (miroir de semainesDuCycle, index.html).
    Le cycle du mois budgétaire M court du jour de paie de M−1 à la veille du jour de
    paie de M ; une semaine coupée par la paie compte dans chaque cycle pour ses jours
    (avant : la règle du jeudi, 4 ou 5). 31 jours = 4 sem. 3 j ; l'année = 365 ÷ 7. */
function cfo_jours_cycle(int $m, int $an, int $jdp): int {
    if ($jdp < 1) $jdp = 27;
    $debut = (new DateTimeImmutable('now', new DateTimeZone('UTC')))->setDate($an, $m - 1, $jdp)->setTime(12, 0);
    $fin   = (new DateTimeImmutable('now', new DateTimeZone('UTC')))->setDate($an, $m, $jdp - 1)->setTime(12, 0);
    return (int)$debut->diff($fin)->days + 1;
}
function cfo_semaines_cycle(int $m, int $an, int $jdp): float {
    return cfo_jours_cycle($m, $an, $jdp) / 7;
}
function cfo_semaines_annee(int $an, int $jdp): float {
    $s = 0.0; for ($m = 1; $m <= 12; $m++) $s += cfo_semaines_cycle($m, $an, $jdp);
    return $s;
}"""
if php.count(a1) != 1: print('✖ serveur : semaines', php.count(a1)); sys.exit(1)
php = php.replace(a1, b1)
a2 = """        // v37.29 : un mois MOYEN de l'année = ses semaines réelles ÷ 12 (plus × 4,3)"""
if php.count(a2) != 1: print('✖ serveur : mois moyen', php.count(a2)); sys.exit(1)
php = php.replace(a2, """        // v37.29 : un mois MOYEN de l'année = ses semaines ÷ 12 (v37.65 : 365 jours ÷ 7)""")
io.open(P, 'w', encoding='utf-8').write(php)
print('✔ v37.65 Semaines : coupées par la paie — chaque morceau dans son cycle, au prorata de ses jours')
