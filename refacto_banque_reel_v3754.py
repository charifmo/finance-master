# -*- coding: utf-8 -*-
"""
v37.54 — LES VRAIES CAPTURES, ET LE TÉLÉPHONE D'ABORD.

« Vérifie que l'upload se fera principalement via mobile. » Les vraies captures (Saham sombre,
Bank Assafa, Attijari Mobile) et une capture PC d'Attijarinet ont montré ce que les maquettes
cachaient :
  • Attijari : les centimes en EXPOSANT (« 4 318,³⁵ DH ») se lisaient 5, 52… → relus seuls,
    agrandis, chiffres seulement, trois fois — deux lectures d'accord font foi : « 35 », « 32 » ;
  • le blanc sur orange (le n° du « Compte chèque ») disparaissait → une lecture sur le canal le
    plus sombre de chaque pixel ; sur un thème SOMBRE (Saham), le canal le plus clair inversé :
    montants verts ET dates grises lus d'un coup ; la lecture couleur reste ;
  • aucun solde lu sur un téléphone (texte clair sur bandeau coloré) → une 3e lecture, au seuil
    local, pour l'en-tête seulement ;
  • l'ordre « libellé puis date » (Attijari Mobile) perdait face à « date puis libellé » à cause de
    la publicité sous la liste → ce qu'un ordre laisse en tête coûte, une publicité finale non ;
  • deux lectures de la même opération (« 9/08 » pour « 29/08 », un jour illisible « pis ») sont
    reconnues comme une seule : même montant, libellé proche ; la date sûre l'emporte ;
  • Attijarinet en capture PC : le petit « oct » sous le jour se perd → le mois vient de
    l'en-tête « OCTOBRE 2026 » ; « 07/10 08H08 » sans « CB » = un retrait ;
  • les barres de menu (« VIREMENTS PAIEMENTS RECHARGES RIB »), les icônes lues « sp », « & »,
    « = », « — Pre », « Qi O LS », les « Dh » / « MAD » en exposant lus « ph », « mao », « ""° »
    → écartés ;
  • l'intitulé « COMPTE CARTE » (un bouton) n'est plus pris pour « Compte chèque dirhams » ;
  • l'empreinte anti-doublon compare les libellés par trigrammes (une lettre lue de travers).
TÉLÉPHONE : le sélecteur ouvre la GALERIE (image/* seul ; le texte / CSV a son bouton) ; une
capture pleine résolution est ramenée à ~1 300 px ; « 🏦 Importer mes captures » dans la saisie
rapide (le ➕ flottant) ; un format illisible le dit au lieu d'échouer en silence ; le ➕ n'est plus
caché sous la baguette Merlin (baguette et 💾 passent à gauche) ; les boutons flottants ne couvrent
plus les champs de la saisie rapide ni de l'import.
DÉPÔT PUBLIC : les exemples de RIB de l'appli sont fictifs (remplacés par motif : aucun numéro réel
n'est écrit ici) ; les fixtures de test aussi (identité « KARIM TESTEUR »).
"""
import io, re, sys

def patcher(F, subs):
    src = io.open(F, encoding='utf-8').read()
    for label, a, b in subs:
        c = src.count(a)
        if c != 1:
            print(f'✖ {F} — {label} : {c} ancre(s), 1 attendue'); sys.exit(1)
        src = src.replace(a, b)
    return src

PARSEUR = r'''                    /* ══ v37.54 BANQUE:PARSEUR:DEBUT ══════════════════════════════════════════════
                       LE RELEVÉ, LU SUR PLACE — 0 appel IA. Texte collé (Attijarinet), CSV, ou texte
                       extrait d'une capture par l'OCR embarqué : la même lecture. Pur (aucune donnée
                       de l'appli) : testable seul.
                         bqAnalyser(texte, { aujourdhui }) → { banque, format, identifiants, intitule,
                           signature, soldes, totaux, operations: [{ date, dateOp, dateAchat, libelle,
                           montant, brut }] }
                       Une opération = une date, un montant, un libellé, dans l'ordre de l'écran :
                       « date d'abord » (Attijarinet, Bank Assafa) ou « libellé d'abord » (Attijari
                       Mobile, Saham) — l'ordre qui découpe le mieux l'emporte. */
                    const BQ_MOIS = { janvier: 1, janv: 1, jan: 1, fevrier: 2, fevr: 2, fev: 2, mars: 3, mar: 3, avril: 4, avr: 4, mai: 5, juin: 6,
                                      juillet: 7, juil: 7, aout: 8, septembre: 9, sept: 9, sep: 9, octobre: 10, oct: 10, novembre: 11, nov: 11, decembre: 12, dec: 12 };
                    const bqNorm = (s) => String(s || '').toLowerCase().replace(/œ/g, 'oe').normalize('NFD').replace(/\p{M}/gu, '');
                    //  « févr », « déc », « août » : les accents tolérés dans le texte brut
                    const _bqMotif = (m) => m.replace(/a/g, '[aàâä]').replace(/e/g, '[eéèêë]').replace(/i/g, '[iîï]').replace(/o/g, '[oôö]').replace(/u/g, '[uùûü]');
                    const BQ_RE_MOIS = Object.keys(BQ_MOIS).sort((a, b) => b.length - a.length).map(_bqMotif).join('|');
                    //  v37.54 : la devise en exposant, telle que l'OCR la lit (« ph », « mao », « map », « ""° »…), est avalée avec le montant
                    const BQ_MONTANT = /(^|[^\d,.])([+-]?) ?(\d{1,3}(?:[ .]\d{3})+|\d+)[,.](\d{2})(?!\d)(?: ?(mad|dhs|dh|drh|ph|pn|man|mao|map|mau|van|dn|oh)\b| ?[°"'’“”*]{1,4}[a-z*"°']{0,3}(?=\s|$))?/gi;
                    const BQ_DATE_NUM = /(^|[^\d])(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4}|\d{2})(?!\d)/g;
                    const BQ_DATE_TXT = new RegExp('(^|[^\\d])(\\d{1,2})(?:er)? ?(' + BQ_RE_MOIS + ')\\.?(?: (\\d{4}))?(?![a-zà-ÿ])', 'gi');
                    const BQ_DATE_GAB = /(^|\s)(\d{2})[ \/](\d{2}) \d{2}h\d{2}\b/gi;      // « AWBGAB … E 14 10 09H01 », « … 07/10 08H08 »
                    //  Les titres qui ouvrent la liste des opérations
                    const BQ_TITRES = /dernieres operations|transactions recentes|total des mouvements|derniers mouvements|historique des operations|liste des operations|mes operations/;
                    //  Les lignes d'interface qui ne sont jamais une opération
                    const BQ_BRUIT = /^(voir (tout|plus)|tout voir|afficher plus|accueil|comptes?|mes comptes|operations|virements?|paiements?|cartes?|plus|menu|profil|services|filtrer|rechercher|aujourd ?hui|hier|historique|releve|date|libelle|montant|debit|credit|solde|transferts?|mon compte|parametres|deconnexion)( (comptes?|virements?|cartes?|plus|operations|transferts?|services|profil))*$/;
                    //  v37.54 : une barre de menu (« VIREMENTS PAIEMENTS RECHARGES RIB », « Accueil Comptes Cartes Menu ») n'est jamais un libellé
                    const BQ_MENU = new Set(['accueil', 'comptes', 'compte', 'cartes', 'carte', 'virements', 'virement', 'paiements', 'paiement', 'recharges', 'recharge', 'rib', 'plus', 'menu',
                        'autres', 'lifestyle', 'envoyer', 'payer', 'operations', 'transferts', 'transfert', 'services', 'profil', 'voir', 'tout', 'offres', 'decouvrir', 'mes', 'parametres', 'aide', 'contact']);
                    const _bqEstMenu = (n) => { const m = n.split(/[^a-z]+/).filter(w => w.length > 2); return m.length > 0 && m.every(w => BQ_MENU.has(w)); };
                    const BQ_MOIS_SEUL = new RegExp('^(' + Object.keys(BQ_MOIS).join('|') + ')\\.?( \\d{4})?$');
                    //  Les icônes lues comme des lettres en tête de libellé (« = », « & », « sp », « st&p »…)
                    const BQ_PETITS = new Set(['de', 'du', 'la', 'le', 'les', 'au', 'aux', 'en', 'un', 'une', 'et', 'l', 'd', 'a', 'n', 'el']);
                    const _bqLibelle = (x) => {
                        let t = String(x || '').replace(/^[\s|¦│=&@©®°;:'"“”‘’`~^*•·»«<>()\[\]{}_!?\\\/-]+(?=\p{L}|\d)/u, '')
                            .replace(/^[^\x00-\x7F\s\dÀà]\s+(?=\p{L})/u, '');      // une icône lue « Î », « œ », « æ » (« À » est un mot)
                        const m = t.match(/^([a-z]{1,3}|[A-Za-z]{1,2}[&@][A-Za-z]{0,2})\s+(?=\p{Lu})/u);
                        if (m && !BQ_PETITS.has(m[1])) t = t.slice(m[0].length);
                        return t.replace(/(\s+(?:[_*°"'’“”|.,;:<>]+|dhs?|mad|ph))+$/i, '').trim();
                    };
                    const BQ_CREDIT = /reception|\brecu\b|versement|\bcredit\b|remboursement|salaire|virement recu|vir recu|\bdepot\b|annulation/;

                    //  Une date { j, m, a | null } → ISO, l'année devinée si l'écran la tait :
                    //  la plus récente qui ne soit pas dans le futur (à 7 jours près).
                    const bqResoudreDate = (d, aujourdhui) => {
                        if (!d || d.inconnue) return null;
                        const ref = aujourdhui instanceof Date ? aujourdhui : new Date();
                        let a = d.a != null ? (d.a < 100 ? 2000 + d.a : d.a) : ref.getFullYear();
                        if (d.a == null && new Date(a, d.m - 1, d.j) > new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + 7)) a -= 1;
                        if (!(d.m >= 1 && d.m <= 12 && d.j >= 1 && d.j <= 31)) return null;
                        return a + '-' + String(d.m).padStart(2, '0') + '-' + String(d.j).padStart(2, '0');
                    };
                    const bqMontantDe = (ent, dec) => Number(String(ent).replace(/[ .]/g, '') + '.' + dec);
                    //  Une ligne : ses montants, ses dates, et ce qui reste de texte
                    const _bqLigne = (raw) => {
                        if (raw === BQ_JOUR_ILLISIBLE) return { raw, reste: '', texte: '', montants: [], dates: [{ inconnue: true }], L: false, D: true, A: false, bruit: false };
                        const montants = [], dates = [];
                        let r = raw.replace(BQ_MONTANT, (m, pre, signe, ent, dec, dev) => {
                            montants.push({ v: bqMontantDe(ent, dec), signe: signe || '', devise: dev ? dev.toLowerCase() : '' });
                            return pre + ' ';
                        });
                        r = r.replace(BQ_DATE_NUM, (m, pre, j, mo, a) => { dates.push({ j: +j, m: +mo, a: +a }); return pre + ' '; });
                        r = r.replace(BQ_DATE_TXT, (m, pre, j, mois, a) => { dates.push({ j: +j, m: BQ_MOIS[bqNorm(mois)], a: a ? +a : null }); return pre + ' '; });
                        r = r.replace(BQ_DATE_GAB, (m, pre, j, mo) => { dates.push({ j: +j, m: +mo, a: null, gab: true }); return pre + ' '; });
                        const net = (x) => x.replace(/\(\*\)/g, ' ').replace(/[.…]{2,}|…/g, ' ').replace(/\s+/g, ' ').trim();
                        const reste = _bqLibelle(net(r));
                        const texte = _bqLibelle(net(raw.replace(BQ_MONTANT, (m, pre) => pre + ' ')));
                        const lettres = (reste.match(/\p{L}/gu) || []).length;
                        const nr = bqNorm(reste).replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
                        //  v37.54 : des icônes lues comme des bouts de mots (« — Pre », « Qi O “ LS », « Le CG ») : aucun chiffre,
                        //  quatre morceaux au plus, aucun de plus de trois lettres, aucun petit mot en minuscules (« box », « ok »
                        //  sont la fin d'un libellé)
                        const morceaux = net(r).split(' ').filter(Boolean);
                        const icones = !/\d/.test(raw) && morceaux.length <= 4 && morceaux.every(x => (x.match(/\p{L}/gu) || []).length <= 3)
                                    && !morceaux.some(x => /^\p{Ll}{2,3}$/u.test(x));
                        const bruit = icones || /https?:\/\/|www\.|\.com\b|\.ma\//i.test(raw) || BQ_BRUIT.test(nr) || (!montants.length && !dates.length && _bqEstMenu(nr))
                                    || BQ_MOIS_SEUL.test(bqNorm(raw).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim());
                        return { raw, reste, texte, montants, dates, L: lettres >= 3 && !bruit, D: lettres < 3 && dates.length > 0, A: montants.length > 0, bruit: bruit || (lettres > 0 && lettres < 3 && !dates.length && !montants.length) };
                    };
                    //  Le texte en lignes : tabulations, « | » et colonnes collées deviennent des lignes ;
                    //  « 14 » suivi de « oct » (Attijarinet) redevient « 14 oct ».
                    const BQ_JOUR_ILLISIBLE = '⁇';
                    const _bqLignes = (texte) => {
                        const brutes = String(texte || '').replace(/\r/g, '').replace(/\t+/g, '\n').replace(/ \| /g, '\n')
                            .replace(/[‐-―−]/g, '-').replace(/[^\S\n]+/g, ' ').split('\n').map(l => l.trim()).filter(Boolean);
                        const out = [];
                        const reMois = new RegExp('^(' + BQ_RE_MOIS + ')\\.?( \\d{4})?$', 'i');
                        let ctx = null;                              // v37.54 : « OCTOBRE 2026 » — le mois des lignes qui suivent
                        for (let i = 0; i < brutes.length; i++) {
                            const l = brutes[i].replace(/(^|\s)_ ?(?=\d)/g, '$1-'), s = brutes[i + 1];
                            const mm = bqNorm(l).match(new RegExp('^(' + Object.keys(BQ_MOIS).join('|') + ') (\\d{4})$'));
                            if (mm) { ctx = mm[1] + ' ' + mm[2]; out.push(l); continue; }
                            if (/^\d{1,2}$/.test(l) && s && reMois.test(s)) { out.push(l + ' ' + s); i++; continue; }
                            //  le jour seul dans sa colonne (« 14 | »), le libellé à la ligne suivante
                            if (ctx && /^\d{1,2}$/.test(l) && +l >= 1 && +l <= 31 && s && /\p{L}{3}/u.test(s)) { out.push(l + ' ' + ctx); continue; }
                            //  le jour mal lu (« pis », « a ») : la ligne garde sa place, sa date viendra de l'autre lecture
                            if (ctx && /^\S{1,3}$/.test(l) && /\D/.test(l) && s && /\p{L}{3}/u.test(s) && /\d[,.]\d{2}\b/.test(s)) { out.push(BQ_JOUR_ILLISIBLE); continue; }
                            //  un petit mot seul (« ok », « box ») sous un libellé : la fin de ce libellé, passée à la ligne
                            const prec = out[out.length - 1];
                            if (/^\p{Ll}{2,3}$/u.test(l) && prec && /\p{L}{3}/u.test(prec) && !/\d[,.]\d{2}\b/.test(prec)) { out[out.length - 1] = prec + ' ' + l; continue; }
                            //  Capture PC d'Attijarinet : « 14 | AWBGAB … - 1 000,00 MAD », le « oct » perdu sous le jour
                            const j = l.match(/^(\d{1,2})\s*[|¦│]?\s+(?=.*\p{L}{3})(.*)$/u);
                            if (j && ctx && +j[1] >= 1 && +j[1] <= 31) { out.push(j[1] + ' ' + ctx); out.push(j[2]); continue; }
                            out.push(l);
                        }
                        return out;
                    };
                    //  Découper la liste : chaque opération commence à sa date (tete 'D') ou à son libellé (tete 'L')
                    const _bqDecouper = (toks, tete) => {
                        const ops = []; let cur = null;
                        const neuf = () => ({ libs: [], dates: [], datesLib: [], montants: [] });
                        for (const t of toks) {
                            if (tete === 'D') {
                                if (t.D) { if (cur) ops.push(cur); cur = neuf(); }
                                if (!cur) continue;
                            } else {
                                //  une opération complète (montant ou date déjà lus) cède la place au libellé suivant ;
                                //  sinon c'est la suite du même libellé (sur deux lignes)
                                if (t.L && cur && (cur.montants.length || cur.dates.length)) { ops.push(cur); cur = null; }
                                if (!cur) { if (!t.L) continue; cur = neuf(); }
                            }
                            if (t.L) { cur.libs.push(t.texte); cur.datesLib.push(...t.dates); }
                            else cur.dates.push(...t.dates);
                            cur.montants.push(...t.montants);
                        }
                        if (cur) ops.push(cur);
                        return ops;
                    };
                    //  v37.54 : un reste final sans montant (une publicité sous la liste, l'heure de la barre des tâches) ne
                    //  coûte rien — ce n'est pas une opération
                    const _bqNote = (ops) => ops.reduce((s, o, i) => (i === ops.length - 1 && !o.montants.length) ? s
                        : s + (o.montants.length === 1 ? 2 : (o.montants.length ? 0 : -2)) + (o.dates.length || o.datesLib.length ? 1 : -1) + (o.libs.length ? 1 : -2), 0);

                    const bqAnalyser = (texte, opts = {}) => {
                        const aujourdhui = opts.aujourdhui || new Date();
                        const lignes = _bqLignes(texte);
                        const toks = lignes.map(_bqLigne);
                        //  En-tête (comptes, soldes, RIB) | opérations : coupées au titre de la liste
                        let iTitre = lignes.findIndex(l => BQ_TITRES.test(bqNorm(l)));
                        if (iTitre < 0) {
                            //  Pas de titre : l'en-tête s'arrête au premier solde annoncé (« Solde », « Compte chèque »…)
                            const k = lignes.findIndex(l => /solde|mes comptes|compte (cheque|courant)|disponible/.test(bqNorm(l)));
                            iTitre = -1;
                            if (k >= 0) { const a = toks.findIndex((t, i) => i >= k && i <= k + 3 && t.A); iTitre = a >= 0 ? a : k; }
                        }
                        const tete = lignes.slice(0, iTitre + 1), corps = toks.slice(iTitre + 1).filter(t => !t.bruit && (t.L || t.D || t.A));
                        const nTete = bqNorm(tete.join('\n')), nTout = bqNorm(lignes.join('\n'));
                        //  Identifiants : RIB (24 chiffres), n° de compte alphanumérique, URL Attijarinet
                        const identifiants = [];
                        const noter = (x) => { const v = String(x).toUpperCase().replace(/[^0-9A-Z]/g, ''); if (v && !identifiants.includes(v)) identifiants.push(v); };
                        (tete.join('\n').match(/\d[\d ]{20,40}\d/g) || []).forEach(m => { const d = m.replace(/ /g, ''); if (d.length === 24) noter(d); });
                        (tete.join('\n').toUpperCase().match(/\b\d{3,}[A-Z]{1,2}\d{5,}\b/g) || []).forEach(m => { if (m.length >= 12 && m.length <= 20) noter(m); });
                        (String(texte || '').match(/compte\/(\d{5,})/gi) || []).forEach(m => noter(m.split('/')[1]));
                        //  Les soldes de l'en-tête, rangés sous le libellé qui les annonce
                        const soldes = {}; let cle = null, totaux = null;
                        tete.forEach(l => {
                            const n = bqNorm(l), t = _bqLigne(l);
                            if (/total des mouvements|^debit\b|^credit\b/.test(n)) return;
                            if (/mes comptes/.test(n)) cle = 'mesComptes';
                            else if (/compte (cheque|courant)|\bcheque\b/.test(n)) cle = 'compteCheque';
                            else if (/solde|disponible/.test(n)) cle = cle && !soldes[cle] ? cle : 'solde';
                            t.montants.forEach(m => {
                                const v = (m.signe === '-' ? -1 : 1) * m.v;
                                if (cle && soldes[cle] == null) soldes[cle] = v;
                                else if (soldes.solde == null) soldes.solde = v;
                            });
                        });
                        //  Attijarinet : « DÉBIT : 1 386,76 MAD   CRÉDIT : 0,00 MAD » — de quoi vérifier la lecture
                        const nPlat = nTout.replace(/\n/g, ' ');
                        if (/total des mouvements/.test(nPlat)) {
                            const v = (re) => { const x = nPlat.match(re); return x ? bqMontantDe(x[1].trim(), x[2]) : null; };
                            totaux = { debit: v(/debit\s*:?\s*(\d{1,3}(?:[ .]\d{3})*|\d+)[,.](\d{2})/), credit: v(/credit\s*:?\s*(\d{1,3}(?:[ .]\d{3})*|\d+)[,.](\d{2})/) };
                        }
                        //  L'intitulé (« Compte chèque dirhams ») et la banque
                        const lIntitule = tete.filter(l => /\bcompte\b/.test(bqNorm(l)) && !/mes comptes|mon compte|total des|https?:|www\.|\.com|\//.test(bqNorm(l)))
                            .map((l, i) => ({ l, s: (/cheque|courant|epargne|dirhams|devises|carnet/.test(bqNorm(l)) ? 2 : 0) + (/carte/.test(bqNorm(l)) ? 0 : 1) - i / 100 }))
                            .sort((a, b) => b.s - a.s).map(x => x.l)[0];
                        const intitule = lIntitule ? bqNorm(lIntitule).replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim() : '';
                        const score = {
                            attijari: (/attijari|wafa/.test(nTout) ? 5 : 0) + (/total des mouvements/.test(nTout) ? 4 : 0) + (/mes comptes/.test(nTete) ? 3 : 0)
                                    + (/\bawbgab\b|\bawb\b/.test(nTout) ? 2 : 0) + (/\bmad\b/.test(nTout) ? 1 : 0) + (/compte\/\d/.test(nTout) ? 3 : 0)
                                    + (identifiants.some(x => /[A-Z]/.test(x)) ? 3 : 0) + (/dernieres operations/.test(nTete) && !/vos dernieres/.test(nTete) ? 1 : 0),
                            assafa: (/assafa/.test(nTete) ? 5 : 0) + (/vos dernieres operations/.test(nTout) ? 4 : 0) + (/\bdhs\b/.test(nTout) ? 2 : 0) + (identifiants.some(x => x.length === 24) ? 1 : 0),
                            saham: (/saham/.test(nTout) ? 5 : 0) + (/transactions recentes/.test(nTout) ? 4 : 0) + (/bonjour/.test(nTete) ? 2 : 0) + (/compte cheque dirhams/.test(nTete) ? 2 : 0),
                        };
                        const [banque, sc] = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
                        const bq = sc >= 3 ? banque : 'autre';
                        const format = bq === 'attijari' ? (/total des mouvements|compte\/\d/.test(nTout) ? 'attijari_web' : 'attijari_mobile')
                                     : bq === 'assafa' ? 'assafa_mobile' : bq === 'saham' ? 'saham_mobile' : 'inconnu';
                        //  Les opérations : l'ordre qui découpe le mieux ; des montants restés en colonne à la fin sont rendus aux lignes
                        let fin = [];
                        while (corps.length && corps[corps.length - 1].A && !corps[corps.length - 1].L && !corps[corps.length - 1].D) fin.unshift(corps.pop());
                        const premier = corps.find(t => t.D || t.L);
                        //  v37.54 : l'ordre des écrans connus est un fait — Attijari Mobile et Saham : libellé puis date ; Bank Assafa
                        //  et Attijarinet : date puis libellé (même une capture qui commence au milieu d'une opération) ;
                        //  la note ne départage que les écrans inconnus
                        const ordre = { attijari_mobile: 'L', saham_mobile: 'L', assafa_mobile: 'D', attijari_web: 'D' }[format];
                        const essais = (ordre ? [ordre] : ['D', 'L']).map(tt => {
                            const ops = _bqDecouper(corps, tt);
                            const sans = ops.filter(o => !o.montants.length);
                            if (fin.length && sans.length === fin.length) sans.forEach((o, i) => o.montants.push(...fin[i].montants));
                            else if (fin.length && ops.length) ops[ops.length - 1].montants.push(...fin.flatMap(t => t.montants));
                            return { tt, ops, note: _bqNote(ops) + (premier && (premier.D ? 'D' : 'L') === tt ? 0.5 : 0) };
                        }).sort((a, b) => b.note - a.note);
                        const operations = essais[0].ops.filter(o => o.montants.length && o.libs.length).map(o => {
                            const m = o.montants.find(x => x.signe) || o.montants[0];
                            const libelle = o.libs.join(' ').replace(/\s+/g, ' ').replace(/[\s,;:-]+$/, '').trim();
                            const signe = m.signe === '-' ? -1 : m.signe === '+' ? 1 : (BQ_CREDIT.test(bqNorm(libelle)) ? 1 : -1);
                            const dateOp = bqResoudreDate(o.dates[0], aujourdhui);
                            const dLib = o.datesLib.find(d => !d.gab) || o.datesLib[0];
                            const dateAchat = bqResoudreDate(dLib, aujourdhui);
                            const op = { date: dateAchat || dateOp, dateOp: dateOp || dateAchat, dateAchat, libelle, montant: signe * m.v, brut: o.libs.join(' / ') };
                            if (!dateOp) op.sansDateOp = true;       // v37.54 : la date comptable n'a pas été lue (jour illisible)
                            return op;
                        });
                        return { banque: bq, format, identifiants, intitule, signature: bq + '|' + intitule, soldes, totaux, operations };
                    };
                    //  Deux lectures OCR de la même capture (binarisations différentes) : l'une voit ce
                    //  que l'autre rate (un solde vert sur fond vert, une date grise).
                    const bqFusionner = (a, b) => {
                        if (!a) return b; if (!b) return a;
                        const q = (x) => x.operations.reduce((s, o) => s + (o.dateOp && !o.sansDateOp ? 1 : 0) + 1, 0) + (Object.keys(x.soldes).length ? 1 : 0);
                        const [p, s] = q(a) >= q(b) ? [a, b] : [b, a];
                        //  v37.54 : la même opération dans les deux lectures — même montant, puis du plus sûr au plus lâche :
                        //  même date et libellé proche, même date, puis une date manquante, à 3 jours ou du même mois (« 9/08 »
                        //  pour « 29/08 » : un chiffre perdu) et un libellé proche — la date la plus tardive l'emporte
                        const ops = p.operations.slice(), pris = new Set(), libre = s.operations.map(() => true);
                        const ln = (o) => bqLibNorm(o.libelle), jours = (x, y) => Math.abs(new Date(x) - new Date(y)) / 864e5;
                        const tours = [
                            (x, o) => x.dateOp === o.dateOp && bqLibProche(ln(x), ln(o)),
                            (x, o) => x.dateOp === o.dateOp,
                            (x, o) => (x.sansDateOp || o.sansDateOp || jours(x.dateOp, o.dateOp) <= 3 || String(x.dateOp).slice(0, 7) === String(o.dateOp).slice(0, 7)) && bqLibProche(ln(x), ln(o)),
                        ];
                        tours.forEach(meme => s.operations.forEach((o, j) => {
                            if (!libre[j]) return;
                            const i = ops.findIndex((x, k) => !pris.has(k) && Math.round(x.montant * 100) === Math.round(o.montant * 100) && meme(x, o));
                            if (i < 0) return;
                            pris.add(i); libre[j] = false;
                            if (!o.sansDateOp && (ops[i].sansDateOp || String(o.dateOp) > String(ops[i].dateOp))) { const c = { ...ops[i], dateOp: o.dateOp }; delete c.sansDateOp; c.date = c.dateAchat || c.dateOp; ops[i] = c; }
                        }));
                        s.operations.forEach((o, j) => { if (libre[j] && o.dateOp && !o.sansDateOp) ops.push(o); });
                        const soldes = { ...s.soldes, ...p.soldes };
                        const identifiants = [...new Set([...p.identifiants, ...s.identifiants])];
                        const banque = p.banque !== 'autre' ? p.banque : s.banque;
                        return { ...p, banque, format: p.format !== 'inconnu' ? p.format : s.format, identifiants, soldes, intitule: p.intitule || s.intitule,
                                 signature: banque + '|' + (p.intitule || s.intitule), totaux: p.totaux || s.totaux, operations: ops.sort((x, y) => String(y.dateOp).localeCompare(String(x.dateOp))) };
                    };
                    //  La nature d'une opération : retrait, frais, virement, entrée, achat
                    const bqClasser = (op) => {
                        const n = bqNorm(op.libelle);
                        if (/\b(awb)?gab\b|retrait|\bdab\b/.test(n)) return 'gab';
                        //  v37.54 : un retrait chez une autre banque : « MARRAKECH ENNAKHIL 07/10 08H08 » (lieu, date, heure, pas de « CB »)
                        if (/\b\d{2}[\/ ]\d{2} \d{2}h\d{2}\b/.test(n) && !/paiement|achat|\bcb\b|\btpe\b/.test(n)) return 'gab';
                        if (/^com\b|^comm?\.?\s*-|commission|\bfrais\b|agios|cotisation|\btimbre\b|\btaxe\b|\btva\b/.test(n)) return 'frais';
                        //  v37.54 : l'OCR colle les mots (« Emission vrtinstantane n174182 ») ; « Emission » (Saham) = un virement émis
                        if (/virement|\bvir(\b|inst)|\bvrt|\bvirt\b|transfert|mise a disposition|^emission\b|instantane/.test(n)) return 'virement';
                        return op.montant > 0 ? 'credit' : 'achat';
                    };
                    //  Le commerçant : « PAIEMENT CB 11/10/26 CARAMELIO » → « CARAMELIO »
                    const bqMarchand = (op) => String(op.libelle || '')
                        .replace(/^(paiement|paiment|achat|pmt|reglement)\s*(par\s*)?(cb|carte|tpe|internet|mobile)?\s*/i, '')
                        .replace(/\b\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\b/g, ' ').replace(/\(\*\)|\.{2,}|…/g, ' ').replace(/\s+/g, ' ').trim() || String(op.libelle || '').trim();
                    //  L'empreinte d'une opération : compte + date comptable + libellé + montant exact
                    const bqLibNorm = (s) => bqNorm(s).replace(/[^a-z0-9]/g, '').slice(0, 32);
                    const bqHash = (compteId, op) => {
                        const s = [compteId, op.dateOp || op.date || '', bqLibNorm(op.libelle), Math.round(Math.abs(op.montant) * 100) * (op.montant < 0 ? -1 : 1)].join('|');
                        let h = 0x811c9dc5;
                        for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
                        return 'bq' + h.toString(16).padStart(8, '0');
                    };
                    //  v37.54 : deux libellés « proches » (l'OCR a lu une lettre, une icône de travers) : trigrammes communs (Dice)
                    const bqLibProche = (a, b) => {
                        if (!a || !b) return false;
                        if (a === b || a.includes(b) || b.includes(a) || a.slice(0, 10) === b.slice(0, 10)) return true;
                        const tri = (s) => { const o = new Map(); for (let i = 0; i < s.length - 2; i++) { const k = s.slice(i, i + 3); o.set(k, (o.get(k) || 0) + 1); } return o; };
                        const A = tri(a), B = tri(b); let c = 0, n = 0;
                        A.forEach((v, k) => { c += Math.min(v, B.get(k) || 0); n += v; }); B.forEach(v => { n += v; });
                        return n > 0 && 2 * c / n >= 0.6;
                    };
                    /* ══ BANQUE:PARSEUR:FIN ══ */
'''

H = []
H.append(('OCR : image, deux lectures, centimes', """                    //  Une capture → une image propre : agrandie si elle est petite, sombre → inversée
                    const _preparerImage = async (fichier) => {
                        const bmp = await createImageBitmap(fichier);
                        const k = bmp.width < 1000 ? Math.min(3, 1000 / bmp.width + 1) : 1;
                        const cv = document.createElement('canvas');
                        cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
                        const ctx = cv.getContext('2d');
                        ctx.imageSmoothingQuality = 'high';
                        ctx.drawImage(bmp, 0, 0, cv.width, cv.height);
                        return cv;
                    };
                    //  Deux lectures (binarisations Otsu puis Sauvola), fusionnées : l'une voit ce que l'autre rate
                    const ocrCapture = async (fichier, surProgres) => {
                        const w = await _workerOCR();
                        const img = await _preparerImage(fichier);
                        const textes = [];
                        for (const [i, seuil] of ['0', '2'].entries()) {
                            _ocr.progres = (m) => surProgres && surProgres((i + (m.status === 'recognizing text' ? m.progress : 0)) / 2);
                            await w.setParameters({ tessedit_pageseg_mode: '4', preserve_interword_spaces: '1', thresholding_method: seuil });
                            const { data } = await w.recognize(img);
                            textes.push(data.text || '');
                        }
                        _ocr.progres = null;
                        return textes;
                    };""",
"""                    //  v37.54 — une capture du téléphone (PNG, JPEG) ; un format que le navigateur ne lit pas le dit
                    const _chargerImage = async (fichier) => {
                        try { return await createImageBitmap(fichier); }
                        catch (e) {
                            const url = URL.createObjectURL(fichier);
                            try {
                                return await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i);
                                    i.onerror = () => ko(new Error('image illisible par ce navigateur (photo HEIC ?) — envoyez une capture d’écran')); i.src = url; });
                            } finally { setTimeout(() => URL.revokeObjectURL(url), 2000); }
                        }
                    };
                    //  Une image propre : un téléphone (portrait) ramené à ~1 300 px de large, un écran de PC agrandi
                    //  ×2 (son texte est petit). « min » : le canal le plus sombre de chaque pixel — le blanc sur
                    //  orange, le vert sur blanc deviennent du noir sur blanc. « max » (thème sombre) : le canal le
                    //  plus clair, inversé — le vert, le blanc et le gris sur noir deviennent du noir sur blanc.
                    const _preparerImage = (img, mode) => {
                        const w0 = img.width, h0 = img.height;
                        const k = h0 > w0 * 1.4 ? Math.max(1, Math.min(3, 1300 / w0)) : Math.max(1, Math.min(2, 3800 / w0));
                        const cv = document.createElement('canvas');
                        cv.width = Math.round(w0 * k); cv.height = Math.round(h0 * k);
                        const ctx = cv.getContext('2d');
                        ctx.imageSmoothingQuality = 'high';
                        ctx.drawImage(img, 0, 0, cv.width, cv.height);
                        if (mode === 'min') {
                            const d = ctx.getImageData(0, 0, cv.width, cv.height), p = d.data;
                            for (let i = 0; i < p.length; i += 4) { const m = Math.min(p[i], p[i + 1], p[i + 2]); p[i] = p[i + 1] = p[i + 2] = m; }
                            ctx.putImageData(d, 0, 0);
                        }
                        if (mode === 'max') {
                            const d = ctx.getImageData(0, 0, cv.width, cv.height), p = d.data;
                            for (let i = 0; i < p.length; i += 4) { const m = 255 - Math.max(p[i], p[i + 1], p[i + 2]); p[i] = p[i + 1] = p[i + 2] = m; }
                            ctx.putImageData(d, 0, 0);
                        }
                        return cv;
                    };
                    //  Les centimes en EXPOSANT (« 4 318,³⁵ DH ») : la zone après la virgule, relue seule, agrandie,
                    //  chiffres seulement. Seulement quand la lecture est douteuse (rien de net après la virgule,
                    //  ou une devise mal lue collée derrière : « 52PH », « 5"° »).
                    const BQ_JUNK_DEVISE = /^(?:P[H*]?|ph|pH|[°"'’“”*]+\\S{0,3})$/;
                    const _relireCentimes = async (w, cv, data) => {
                        let texte = data.text || '';
                        const mots = data.words || [];
                        const douteux = mots.filter((m, i) => {
                            if (!/\\d,/.test(m.text)) return false;
                            const s = mots[i + 1];
                            const memeLigne = s && Math.abs((s.bbox.y0 + s.bbox.y1) - (m.bbox.y0 + m.bbox.y1)) < (m.bbox.y1 - m.bbox.y0);
                            return !/,\\d{2}$/.test(m.text) || (memeLigne && BQ_JUNK_DEVISE.test(s.text));
                        });
                        if (!douteux.length) return texte;
                        await w.setParameters({ tessedit_pageseg_mode: '7', tessedit_char_whitelist: '0123456789DH' });
                        //  trois relectures (décalée de 3 px, au ras de la virgule, agrandie ×3) : deux qui s'accordent
                        //  font foi — une seule lecture se trompe d'un pixel près (« 52 » pour « 32 »)
                        for (const m of douteux) {
                            const v = (m.symbols || []).find(s => s.text === ',');
                            const lb = (m.line && m.line.bbox) || m.bbox;
                            const xv = v ? v.bbox.x1 : Math.round(m.bbox.x0 + (m.bbox.x1 - m.bbox.x0) * 0.6);
                            const y0 = Math.max(0, Math.min(m.bbox.y0, lb.y0) - 6), y1 = Math.min(cv.height, m.bbox.y1 + 4), x1 = Math.min(cv.width, m.bbox.x1 + 60);
                            const votes = {};
                            for (const [dx, k] of [[3, 2], [0, 2], [3, 3]]) {
                                const x0 = Math.max(0, xv + dx);
                                if (x1 - x0 < 4 || y1 - y0 < 4) continue;
                                const c2 = document.createElement('canvas');
                                c2.width = (x1 - x0) * k + 40; c2.height = (y1 - y0) * k + 40;
                                const g = c2.getContext('2d');
                                g.fillStyle = '#fff'; g.fillRect(0, 0, c2.width, c2.height); g.imageSmoothingQuality = 'high';
                                g.drawImage(cv, x0, y0, x1 - x0, y1 - y0, 20, 20, (x1 - x0) * k, (y1 - y0) * k);
                                const c = ((await w.recognize(c2)).data.text || '').replace(/\\s/g, '').match(/^(\\d{2})/);
                                if (c) votes[c[1]] = (votes[c[1]] || 0) + 1;
                            }
                            const [cc, nv] = Object.entries(votes).sort((p, q) => q[1] - p[1])[0] || [];
                            if (nv >= 2) texte = texte.replace(m.text, m.text.slice(0, m.text.indexOf(',') + 1) + cc + ' DH');
                        }
                        await w.setParameters({ tessedit_pageseg_mode: '4', tessedit_char_whitelist: '' });
                        return texte;
                    };
                    //  Le fond de l'écran : clair ou sombre (Saham) — sur une vignette de 64 px
                    const _ecranSombre = (img) => {
                        const c = document.createElement('canvas'); c.width = 64; c.height = Math.max(1, Math.round(64 * img.height / img.width));
                        const g = c.getContext('2d'); g.drawImage(img, 0, 0, c.width, c.height);
                        const p = g.getImageData(0, 0, c.width, c.height).data; let s = 0;
                        for (let i = 0; i < p.length; i += 4) s += 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
                        return s / (p.length / 4) < 100;
                    };
                    //  Deux lectures — le canal sombre (blanc sur orange, vert sur blanc) ou, sur un thème sombre, le canal
                    //  clair inversé (vert et gris sur noir) ; puis la couleur —, fusionnées : l'une voit ce que l'autre rate.
                    const ocrCapture = async (fichier, surProgres) => {
                        const w = await _workerOCR();
                        const img = await _chargerImage(fichier);
                        const textes = [];
                        const lire = async (i, n, mode, seuil) => {
                            _ocr.progres = (m) => surProgres && surProgres(Math.min(1, (i + (m.status === 'recognizing text' ? m.progress : 0)) / n));
                            const cv = _preparerImage(img, mode);
                            await w.setParameters({ tessedit_pageseg_mode: '4', preserve_interword_spaces: '1', thresholding_method: seuil, tessedit_char_whitelist: '' });
                            const { data } = await w.recognize(cv);
                            _ocr.progres = null;
                            textes.push(await _relireCentimes(w, cv, data));
                        };
                        await lire(0, 2, _ecranSombre(img) ? 'max' : 'min', '0');
                        await lire(1, 2, 'rgb', '0');
                        //  Un téléphone dont aucun solde n'a été lu (un texte clair sur un bandeau coloré, que le seuil global
                        //  noie avec son fond) : une troisième lecture au seuil local (Sauvola) — pour l'en-tête seulement
                        if (img.height > img.width * 1.4 && !textes.some(t => Object.keys(bqAnalyser(t).soldes).length)) {
                            await lire(2, 3, 'rgb', '2');
                            textes.enTete = 2;
                        }
                        return textes;
                    };
                    //  Les lectures d'une capture → une analyse ; la lecture « en-tête » n'apporte que soldes et numéros
                    const bqAnalyserOCR = (textes, opts) => {
                        const [a, b, c] = textes.map(t => bqAnalyser(t, opts));
                        const r = bqFusionner(a, b);
                        if (c && textes.enTete === 2) { r.soldes = { ...c.soldes, ...r.soldes }; r.identifiants = [...new Set([...r.identifiants, ...c.identifiants])]; }
                        return r;
                    };"""))
H.append(('anti-doublon : libellés proches', """                            && (e.l === lib || (e.l && lib && (e.l.slice(0, 10) === lib.slice(0, 10) || e.l.startsWith(lib) || lib.startsWith(e.l)))))));""",
"""                            && bqLibProche(e.l, lib))));   // v37.54 : trigrammes — une lettre, une icône lue de travers"""))
#  Téléphone : la galerie (image/* seul) ; le texte / CSV à part ; les mots qui conviennent au doigt
H.append(('dépôt : galerie', """                        <span class="block text-sm font-black text-indigo-800">Déposez vos captures, ou Ctrl+V</span>
                        <span class="block text-[11px] font-semibold text-indigo-700/80">Plusieurs à la fois · sur mobile : touchez pour choisir dans vos photos</span>
                        <input type="file" accept="image/*,.txt,.csv,text/plain,text/csv" multiple class="hidden" data-import-fichiers @change="ajouterFichiersBanque($event.target.files); $event.target.value = ''"/>
                    </label>""",
"""                        <span class="block text-sm font-black text-indigo-800"><span class="md:hidden">Touchez pour choisir vos captures</span><span class="hidden md:inline">Déposez vos captures, ou Ctrl+V</span></span>
                        <span class="block text-[11px] font-semibold text-indigo-700/80"><span class="md:hidden">dans vos photos · plusieurs à la fois</span><span class="hidden md:inline">Plusieurs à la fois · ou cliquez pour les choisir</span></span>
                        <input type="file" accept="image/*" multiple class="hidden" data-import-fichiers @change="ajouterFichiersBanque($event.target.files); $event.target.value = ''"/>
                    </label>
                    <label class="inline-flex items-center gap-1 cursor-pointer text-[11px] font-bold text-indigo-700 hover:underline">
                        📄 un relevé en texte ou CSV
                        <input type="file" accept=".txt,.csv,text/plain,text/csv" class="hidden" data-import-fichier-texte @change="ajouterFichiersBanque($event.target.files); $event.target.value = ''"/>
                    </label>"""))
#  Le total d'Attijarinet couvre toute la période : une capture n'en montre qu'une partie
H.append(('totaux : capture partielle', """<template v-if="cap.analyse.totaux && cap.analyse.totaux.debit != null"> · <span data-import-totaux :class="Math.abs(cap.analyse.operations.filter(o => o.montant < 0).reduce((s, o) => s - o.montant, 0) - cap.analyse.totaux.debit) < 0.01 ? 'text-emerald-700' : 'text-red-600'">débits {{ Math.abs(cap.analyse.operations.filter(o => o.montant < 0).reduce((s, o) => s - o.montant, 0) - cap.analyse.totaux.debit) < 0.01 ? '✓' : '≠' }} total banque {{ formatMAD(cap.analyse.totaux.debit) }}</span></template>""",
"""<template v-if="cap.analyse.totaux && cap.analyse.totaux.debit != null"> · <span data-import-totaux :class="Math.abs(cap.analyse.operations.filter(o => o.montant < 0).reduce((s, o) => s - o.montant, 0) - cap.analyse.totaux.debit) < 0.01 ? 'text-emerald-700' : 'text-gray-400'">{{ Math.abs(cap.analyse.operations.filter(o => o.montant < 0).reduce((s, o) => s - o.montant, 0) - cap.analyse.totaux.debit) < 0.01 ? 'débits ✓ total banque ' + formatMAD(cap.analyse.totaux.debit) : 'débits de la période : ' + formatMAD(cap.analyse.totaux.debit) + ' (capture partielle)' }}</span></template>"""))
#  Le ➕ flottant du téléphone ouvre la saisie rapide : l'import y est, en tête
H.append(('saisie rapide : importer', """                    <h3 class="font-black uppercase tracking-widest text-sm text-emerald-700">⚡ Saisie rapide</h3>
                    <button title="Fermer" aria-label="Fermer" @click="closeSaisieQuickModal" class="text-gray-400 hover:text-gray-800 text-2xl font-black w-8 h-8">×</button>
                </div>
                <div class="p-4 space-y-3">""",
"""                    <h3 class="font-black uppercase tracking-widest text-sm text-emerald-700">⚡ Saisie rapide</h3>
                    <button title="Fermer" aria-label="Fermer" @click="closeSaisieQuickModal" class="text-gray-400 hover:text-gray-800 text-2xl font-black w-8 h-8">×</button>
                </div>
                <div class="p-4 space-y-3">
                    <button type="button" data-import-ouvrir-rapide @click="closeSaisieQuickModal(); ouvrirImportBanque()"
                            class="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50 text-indigo-800 font-black text-sm">🏦 Importer mes captures bancaires</button>"""))
H.append(("import : lectures → analyse", """                                    const [a, b] = f.textes.map(t => bqAnalyser(t, { aujourdhui }));
                                    captures.push({ id: 'f' + f.id, source: f.nom, vignette: f.url, analyse: bqFusionner(a, b) });""",
"""                                    captures.push({ id: 'f' + f.id, source: f.nom, vignette: f.url, analyse: bqAnalyserOCR(f.textes, { aujourdhui }) });"""))
H.append(("calibrage : lectures → analyse", """                            const [t0, t2] = await ocrCapture(f);
                            const a = bqFusionner(bqAnalyser(t0), bqAnalyser(t2));""",
"""                            const a = bqAnalyserOCR(await ocrCapture(f));"""))
#  Téléphone : la baguette Merlin (v34.08) était posée PILE sur le ➕ (bottom-20 right-4 tous deux) et le 💾
#  mordait 8 px sur lui — le ➕ ne se touchait plus. Baguette et 💾 passent à gauche ; le ➕ garde le pouce droit.
H.append(("FAB Merlin à gauche", """                      'bottom-20 right-4 w-12 h-12 text-xl',
                      merlinActive ?""", """                      'bottom-20 left-4 w-12 h-12 text-xl',     // v37.54 : à gauche — à droite, il couvrait le ➕
                      merlinActive ?"""))
H.append(("bulle Merlin à gauche", """<div v-if="isMobile && merlinActive && !merlinBubble.open" class="fixed bottom-36 right-4 z-[9998]""",
"""<div v-if="isMobile && merlinActive && !merlinBubble.open" class="fixed bottom-48 left-4 z-[9998]"""))
H.append(("FAB 💾 à gauche", """            class="fixed bottom-32 right-4 z-50 bg-purple-600 text-white rounded-full w-12 h-12 flex items-center justify-center shadow-2xl shadow-purple-900/50 animate-pulse text-lg"
            title="Sauver sur VPS">""", """            class="fixed bottom-[8.5rem] left-4 z-50 bg-purple-600 text-white rounded-full w-12 h-12 flex items-center justify-center shadow-2xl shadow-purple-900/50 animate-pulse text-lg"
            title="Sauver sur VPS">"""))
#  …et les trois boutons flottants (z 9995+) passaient AU-DESSUS des fenêtres : ils couvraient Montant,
#  Catégorie, Libellé de la saisie rapide, et la zone de texte de l'import. Masqués le temps de ces fenêtres.
for nom, ancre in [('Merlin', '<button v-if="isMobile" @click="toggleMerlin"'), ('Journal', '<button v-if="isMobile" @click="ouvrirReleve()"'),
                   ('CFO', '<button v-if="isMobile" @click="showCfoModal = true"')]:
    H.append(('FAB ' + nom + ' masqué sous les fenêtres', ancre, ancre.replace('v-if="isMobile"', 'v-if="isMobile && !showSaisieQuickModal && !importBanque.ouvert"')))
#  Revue sur téléphone : le compte sur sa ligne (le nom de la capture n'est plus écrasé en « Attijari… ») ;
#  l'action prend la largeur qui reste (plus de « déjà dans le sold »)
H.append(("revue : compte pleine largeur au téléphone", """                            <select data-import-compte :value="cap.compteId || ''" @change="changerCompteCapture(cap, $event.target.value)"
                                    class="text-[11px] font-black px-2 py-1 rounded-lg border border-gray-200 bg-white outline-none focus:border-indigo-400">""",
"""                            <select data-import-compte :value="cap.compteId || ''" @change="changerCompteCapture(cap, $event.target.value)"
                                    class="w-full md:w-auto text-xs md:text-[11px] font-black px-2 py-1.5 md:py-1 rounded-lg border border-gray-200 bg-white outline-none focus:border-indigo-400">"""))
H.append(("revue : action large au téléphone", """                                                    class="text-[10px] font-bold px-1.5 py-1 rounded-lg border border-gray-200 bg-white text-gray-700 outline-none max-w-[16rem]">""",
"""                                                    class="flex-1 min-w-[10rem] md:flex-none md:max-w-[16rem] text-[11px] md:text-[10px] font-bold px-1.5 py-1.5 md:py-1 rounded-lg border border-gray-200 bg-white text-gray-700 outline-none">"""))
H.append(("exposer bqLibProche et bqAnalyserOCR", "bqAnalyser, bqFusionner, bqClasser, bqMarchand, bqHash, ocrCapture,", "bqAnalyser, bqFusionner, bqClasser, bqMarchand, bqHash, bqLibProche, bqAnalyserOCR, ocrCapture,"))
src = patcher('index.html', H)
#  Le parseur, en bloc (entre ses deux marqueurs)
d = src.index('                    /* ══ v37.53 BANQUE:PARSEUR:DEBUT')
f = src.index('/* ══ BANQUE:PARSEUR:FIN ══ */') + len('/* ══ BANQUE:PARSEUR:FIN ══ */')
assert src.count('BANQUE:PARSEUR:DEBUT') == 1 and src.count('BANQUE:PARSEUR:FIN') == 1
src = src[:d] + PARSEUR.rstrip('\n') + src[f:]
#  Dépôt public : l'exemple du champ de calibrage n'est pas un vrai RIB (sans effet s'il est déjà fictif)
#  Les exemples de RIB de l'appli : un RIB fictif (aucun RIB réel dans le code — le dépôt est public)
src = re.sub(r"RIB ou n° de compte \(ex\. [0-9 ]{20,40}\)", "RIB ou n° de compte (ex. 007 450 0001234567890123 45)", src)
src = re.sub(r"« [0-9]{24} » → « [0-9 ]{24,40} »", "« 007450000123456789012345 » → « 007 450 0001234567890123 45 »", src)
io.open('index.html', 'w', encoding='utf-8').write(src)
print("✔ v37.54 — vraies captures (exposants, canal sombre, Attijarinet PC, bruit), téléphone d'abord")
