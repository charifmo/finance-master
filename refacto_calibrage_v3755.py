# -*- coding: utf-8 -*-
"""
v37.55 — CALIBRER UNE FOIS, LE BON SOLDE TOUJOURS.

« Il ne voit pas le bon solde, il voit le total des soldes de mes comptes ! L'import se fait à chaque
fois pour voir le RIB, et le RIB n'est pas tout le temps affiché. Il faut un seul bouton pour calibrer
le RIB. » — avec la capture « Détails du compte » d'Attijari Mobile.
  • LE SOLDE : quand le « Compte chèque » n'était pas lu, l'import se rabattait sur « Mes comptes »
    (le total de tous vos comptes). Plus jamais : le solde suivi, ou aucun (« solde illisible »).
  • LE N° ET LE RIB : l'accueil montre « 000999B… », le RIB contient « 0009992… » — la lettre devient
    un chiffre dans un RIB marocain (A, J → 1 ; B, K, S → 2…). Ils sont maintenant rapprochés, sosies
    de l'OCR compris (8 lu pour B) : un compte calibré est reconnu à chaque import, sans question.
  • L'ÉCRAN « DÉTAILS DU COMPTE » est lu : RIB (clé de contrôle vérifiée), n° de compte (gardé
    seulement s'il colle au RIB), nature, solde ; la banque se déduit du code du RIB (007 Attijari…).
  • UN SEUL BOUTON « 🎯 Calibrer avec une capture » (plusieurs à la fois) : chaque compte reconnu est
    mis à jour ; un compte inconnu demande une fois « À quel compte ? ».
DÉPÔT PUBLIC : aucun RIB réel ici — les RIB de test sont fictifs, à clé juste.
"""
import io, sys

def patcher(F, subs):
    src = io.open(F, encoding='utf-8').read()
    for label, a, b in subs:
        c = src.count(a)
        if c != 1:
            print(f'✖ {F} — {label} : {c} ancre(s), 1 attendue'); sys.exit(1)
        src = src.replace(a, b)
    return src

PARSEUR = r'''                    /* ══ v37.55 BANQUE:PARSEUR:DEBUT ══════════════════════════════════════════════
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
                        const m = t.match(/^([a-z]{1,3}|[A-Za-z]{1,2}[&@][A-Za-z]{0,2}|[A-Za-z]\))\s+(?=\p{Lu})/u);
                        if (m && !BQ_PETITS.has(m[1])) t = t.slice(m[0].length);
                        return t.replace(/(\s+(?:[_*°"'’“”|.,;:<>]+|dhs?|mad|ph))+$/i, '').trim();
                    };
                    //  v37.55 — LE RIB MAROCAIN : 3 chiffres banque, 3 ville, 16 compte, 2 clé (97 − (22 premiers × 100) mod 97).
                    //  Une lettre du n° de compte devient un chiffre dans le RIB (A, J → 1 ; B, K, S → 2 ; … I, R, Z → 9) :
                    //  « 000999B000123456 » à l'écran = « 0009992000123456 » dans le RIB.
                    const BQ_CODES = { '007': 'attijari', '362': 'assafa', '022': 'saham' };
                    const _bqChiffreRib = (c) => /[A-Z]/.test(c) ? String('123456789123456789234567890'.charAt('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.indexOf(c)) || '') : c;
                    const bqRibValide = (x) => {
                        const r = String(x || '').replace(/\s/g, '');
                        if (!/^\d{24}$/.test(r) || typeof BigInt !== 'function') return false;
                        return (97n - (BigInt(r.slice(0, 22)) * 100n) % 97n) === BigInt(r.slice(22));
                    };
                    //  L'OCR confond 8 et B, 0 et O, 1 et I, 5 et S, 2 et Z, 6 et G
                    const BQ_SOSIES = { 8: 'B', 0: 'O', 1: 'I', 5: 'S', 2: 'Z', 6: 'G', B: '8', O: '0', D: '0', Q: '0', I: '1', L: '1', S: '5', Z: '2', G: '6' };
                    //  Le même compte ? identiques ; un n° à l'écran face au RIB (lettre → chiffre, sosies OCR) ; deux n° aux
                    //  sosies près ; sinon l'un contient l'autre (7 signes au moins)
                    const bqMemeCompte = (a, b) => {
                        const x = String(a || '').toUpperCase().replace(/[^0-9A-Z]/g, ''), y = String(b || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
                        if (!x || !y) return false;
                        if (x === y) return true;
                        const rib = [x, y].find(v => /^\d{24}$/.test(v)), autre = rib === x ? y : x;
                        if (rib && autre.length === 16) {
                            const part = rib.slice(6, 22);
                            return [...autre].every((c, i) => c === part[i] || _bqChiffreRib(c) === part[i] || (BQ_SOSIES[c] && _bqChiffreRib(BQ_SOSIES[c]) === part[i]));
                        }
                        if (x.length === y.length && x.length >= 10 && !rib)
                            return [...x].every((c, i) => c === y[i] || BQ_SOSIES[c] === y[i]);
                        const [c, l] = x.length <= y.length ? [x, y] : [y, x];
                        return c.length >= 7 && l.includes(c);
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
                        //  v37.55 : « PAIEMENT CB 141026 MARJ… » — la date d'achat sans séparateurs
                        r = r.replace(/(\bcb\s+)(\d{2}) ?(\d{2}) ?(\d{2})(?!\d)/gi, (m, pre, j, mo, a) => { dates.push({ j: +j, m: +mo, a: +a }); return pre + ' '; });
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
                        //  v37.55 : un n° seul sur sa ligne, tout en chiffres (« 0009998000123456 » : le B lu 8)
                        tete.forEach(l => { const v = String(l).trim(); if (/^\d{12,20}$/.test(v)) noter(v); });
                        (String(texte || '').match(/compte\/(\d{5,})/gi) || []).forEach(m => noter(m.split('/')[1]));
                        //  v37.55 : un RIB à clé juste, où qu'il soit sur l'écran, est sûr — et son code dit la banque
                        (String(texte || '').match(/\d[\d ]{20,40}\d/g) || []).forEach(m => { const d = m.replace(/ /g, ''); if (bqRibValide(d)) noter(d); });
                        const parCode = identifiants.filter(bqRibValide).map(x => BQ_CODES[x.slice(0, 3)]).find(Boolean);
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
                        let intitule = lIntitule ? bqNorm(lIntitule).replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim() : '';
                        const score = {
                            attijari: (/attijari|wafa/.test(nTout) ? 5 : 0) + (/total des mouvements/.test(nTout) ? 4 : 0) + (/mes comptes/.test(nTete) ? 3 : 0)
                                    + (/\bawbgab\b|\bawb\b/.test(nTout) ? 2 : 0) + (/\bmad\b/.test(nTout) ? 1 : 0) + (/compte\/\d/.test(nTout) ? 3 : 0)
                                    + (identifiants.some(x => /[A-Z]/.test(x)) ? 3 : 0) + (/dernieres operations/.test(nTete) && !/vos dernieres/.test(nTete) ? 1 : 0),
                            assafa: (/assafa/.test(nTete) ? 5 : 0) + (/vos dernieres operations/.test(nTout) ? 4 : 0) + (/\bdhs\b/.test(nTout) ? 2 : 0) + (identifiants.some(x => x.length === 24) ? 1 : 0),
                            saham: (/saham/.test(nTout) ? 5 : 0) + (/transactions recentes/.test(nTout) ? 4 : 0) + (/bonjour/.test(nTete) ? 2 : 0) + (/compte cheque dirhams/.test(nTete) ? 2 : 0),
                        };
                        if (parCode) score[parCode] += 8;
                        const [banque, sc] = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
                        const bq = sc >= 3 ? banque : 'autre';
                        let format = bq === 'attijari' ? (/total des mouvements|compte\/\d/.test(nTout) ? 'attijari_web' : 'attijari_mobile')
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
                        //  v37.55 : Attijari Mobile — le solde du COMPTE CHÈQUE est celui qui suit son libellé ; un montant sans
                        //  libellé après « Mes comptes » est le sien. Jamais le total « Mes comptes » à sa place.
                        if (format === 'attijari_mobile') {
                            if (soldes.compteCheque == null && soldes.mesComptes != null && soldes.solde != null && soldes.solde !== soldes.mesComptes) soldes.compteCheque = soldes.solde;
                            delete soldes.solde;
                        }
                        //  v37.55 : l'écran « Détails du compte » (Agence, Nature, Intitulé, N° de compte, RIB, Solde) : de quoi
                        //  calibrer, aucune opération. Le n° lu n'est gardé que s'il colle au RIB (sinon l'OCR l'a abîmé).
                        const lignesN = lignes.map(l => bqNorm(l).trim());
                        const iNum = lignesN.findIndex(l => /^n\W{0,3}de compte\b/.test(l));
                        if (/details du compte/.test(nTout) || (iNum >= 0 && /(^|\n)rib\b/.test(nTout))) {
                            const ribs = identifiants.filter(bqRibValide);
                            const num = iNum >= 0 && lignes[iNum + 1] ? String(lignes[iNum + 1]).toUpperCase().replace(/[^0-9A-Z]/g, '') : '';
                            const ids = ribs.length ? [...ribs, ...(num && ribs.some(r => bqMemeCompte(num, r)) ? [num] : [])]
                                                    : [...new Set([...(num.length >= 10 ? [num] : []), ...identifiants])];
                            const montantSous = (re) => { const i = lignesN.findIndex(l => re.test(l)); const t = i >= 0 && lignes[i + 1] ? _bqLigne(lignes[i + 1]) : null; return t && t.montants[0] ? t.montants[0].v : null; };
                            const premier = lignes.map(_bqLigne).find(t => t.montants.length);
                            const solde = montantSous(/^solde$/) ?? (premier ? premier.montants[0].v : null);
                            const iNat = lignesN.findIndex(l => /^nature$/.test(l));
                            intitule = iNat >= 0 && lignes[iNat + 1] ? bqNorm(lignes[iNat + 1]).replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim() : intitule;
                            const bqD = parCode || bq;
                            return { banque: bqD, format: 'details', identifiants: ids, intitule, signature: bqD + '|' + intitule,
                                     soldes: solde != null ? { compteCheque: solde } : {}, totaux: null, operations: [] };
                        }
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
H.append(("même compte : RIB ↔ n°", """                    //  Le même compte : identiques, ou l'un contient l'autre (n° de compte dans le RIB), 7 signes au moins
                    const _memeId = (a, b) => {
                        const x = _idNorm(a), y = _idNorm(b);
                        if (!x || !y) return false;
                        if (x === y) return true;
                        const [c, l] = x.length <= y.length ? [x, y] : [y, x];
                        return c.length >= 7 && l.includes(c);
                    };""", """                    //  Le même compte : v37.55 — le n° de l'écran face au RIB (lettre → chiffre, sosies de l'OCR), voir bqMemeCompte
                    const _memeId = (a, b) => bqMemeCompte(_idNorm(a), _idNorm(b));"""))
H.append(("solde : jamais le total à la place du compte", """                        cap.soldeChoisi = cap.analyse.banque === 'attijari'
                            ? (c.soldeSuivi === 'mesComptes' ? (s.mesComptes ?? s.compteCheque ?? s.solde) : (s.compteCheque ?? s.solde ?? s.mesComptes))
                            : (s.solde ?? s.compteCheque ?? s.mesComptes);
                        cap.soldeChoisi = cap.soldeChoisi == null ? null : cap.soldeChoisi;""",
"""                        //  v37.55 : le solde SUIVI, ou aucun — jamais le total « Mes comptes » à la place du compte chèque
                        cap.soldeChoisi = cap.analyse.banque === 'attijari'
                            ? (c.soldeSuivi === 'mesComptes' ? s.mesComptes : (s.compteCheque ?? s.solde))
                            : (s.solde ?? s.compteCheque);
                        cap.soldeChoisi = cap.soldeChoisi == null ? null : cap.soldeChoisi;
                        cap.soldeIllisible = cap.soldeChoisi == null && Object.keys(s).length > 0;"""))
H.append(("revue : solde illisible annoncé", """                            <!-- Les opérations -->""",
"""                            <p v-if="cap.compteId && cap.soldeIllisible" data-import-solde-illisible class="px-3 py-2 text-[11px] font-bold text-amber-800 bg-amber-50 border-b border-amber-100">⚠️ Solde « {{ (comptes.find(c => String(c.id) === String(cap.compteId)) || {}).soldeSuivi === 'mesComptes' ? 'Mes comptes' : 'Compte chèque' }} » illisible sur cette capture : solde non mis à jour (le total « Mes comptes » n'est jamais pris à sa place).</p>
                            <!-- Les opérations -->"""))
H.append(("calibrage : état", """                    const calibrageBanque = reactive({ compteId: null, enCours: false, message: '', saisie: {} });""",
"""                    const calibrageBanque = reactive({ enCours: false, message: '', saisie: {}, attente: [], resultats: [] });"""))
H.append(("calibrage : un seul bouton (code)", """                    //  Calibrer un compte d'une capture, depuis la section dédiée
                    const calibrerAvecCapture = async (compteId, liste) => {
                        const f = [...(liste || [])].find(x => x && /^image\\//.test(x.type));
                        if (!f) return;
                        Object.assign(calibrageBanque, { compteId, enCours: true, message: 'Lecture de la capture…' });
                        try {
                            const a = bqAnalyserOCR(await ocrCapture(f));
                            const autre = resoudreCompteReleve(a);
                            const c = calibrerCompte(compteId, a);
                            const quoi = a.identifiants.length ? a.identifiants.map(idLisible).join(', ') : (a.signature && !/\\|$/.test(a.signature) ? 'empreinte ' + signatureLisible(a.signature) : null);
                            calibrageBanque.message = !quoi ? 'Aucun RIB ni intitulé lisible sur cette capture.'
                                : '✓ ' + (c ? c.label : '') + ' : ' + nomBanque(a.banque) + ' · ' + quoi
                                  + (autre.compteId && String(autre.compteId) !== String(compteId) ? ' (retiré de « ' + ((_compteParId(autre.compteId) || {}).label || '') + ' »)' : '');
                        } catch (e) {
                            calibrageBanque.message = 'Lecture impossible : ' + (e && e.message || e);
                        } finally { calibrageBanque.enCours = false; }
                    };""",
"""                    //  v37.55 — UN SEUL BOUTON : « 🎯 Calibrer avec une capture » (l'écran « Détails du compte », l'accueil…,
                    //  plusieurs à la fois). Un compte reconnu est complété ; un inconnu demande une fois « À quel compte ? ».
                    let _calSeq = 0;
                    const _quoiCalibrage = (a) => a.identifiants.length ? a.identifiants.map(idLisible).join(', ')
                        : (a.signature && !/\\|$/.test(a.signature) ? 'empreinte ' + signatureLisible(a.signature) : null);
                    const calibrerCaptures = async (liste) => {
                        const fichiers = [...(liste || [])].filter(x => x && /^image\\//.test(x.type));
                        if (!fichiers.length) return;
                        Object.assign(calibrageBanque, { enCours: true, message: 'Lecture de ' + fichiers.length + ' capture(s)…', resultats: [] });
                        try {
                            for (const f of fichiers) {
                                const nom = f.name || 'capture';
                                let a;
                                try { a = bqAnalyserOCR(await ocrCapture(f)); }
                                catch (e) { calibrageBanque.resultats.push({ nom, ok: false, texte: 'Lecture impossible : ' + (e && e.message || e) }); continue; }
                                const quoi = _quoiCalibrage(a);
                                if (!quoi) { calibrageBanque.resultats.push({ nom, ok: false, texte: 'Aucun RIB, n° de compte ni intitulé lisible.' }); continue; }
                                const r = resoudreCompteReleve(a);
                                if (r.compteId) {
                                    const c = calibrerCompte(r.compteId, a);
                                    calibrageBanque.resultats.push({ nom, ok: true, texte: '✓ ' + (c ? c.label : '') + ' : ' + nomBanque(a.banque) + ' · ' + quoi });
                                } else calibrageBanque.attente.push({ id: ++_calSeq, nom, analyse: a, quoi, reponse: '', candidats: r.candidats || [] });
                            }
                        } finally { calibrageBanque.enCours = false; calibrageBanque.message = ''; }
                    };
                    const associerCalibrage = (x) => {
                        if (!x || !x.reponse) return;
                        const c = calibrerCompte(x.reponse, x.analyse);
                        calibrageBanque.attente = calibrageBanque.attente.filter(y => y.id !== x.id);
                        if (c) calibrageBanque.resultats.push({ nom: x.nom, ok: true, texte: '✓ ' + c.label + ' : ' + nomBanque(x.analyse.banque) + ' · ' + x.quoi });
                    };"""))
H.append(("calibrage : exposer", "optionsLigneBanque, resumeImportBanque, appliquerImportBanque, calibrerAvecCapture, retirerIdentifiant, retirerEmpreinte,",
          "optionsLigneBanque, resumeImportBanque, appliquerImportBanque, calibrerCaptures, associerCalibrage, retirerIdentifiant, retirerEmpreinte,"))
H.append(("exposer bqMemeCompte", "bqHash, bqLibProche, bqAnalyserOCR, ocrCapture,", "bqHash, bqLibProche, bqAnalyserOCR, bqMemeCompte, bqRibValide, ocrCapture,"))
H.append(("calibrage : un seul bouton (écran)", """                            <button type="button" data-import-ouvrir @click="ouvrirImportBanque()" class="shrink-0 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow">📥 Importer captures / relevé</button>
                        </div>""", """                            <label data-calibrage-bouton @dragover.prevent @drop.prevent="calibrerCaptures($event.dataTransfer && $event.dataTransfer.files)"
                                   title="L'écran « Détails du compte » de votre appli (RIB, n° de compte), ou l'accueil : plusieurs captures à la fois"
                                   :class="['shrink-0 cursor-pointer px-3 py-2 rounded-xl border-2 border-dashed text-xs font-black transition-colors', calibrageBanque.enCours ? 'border-indigo-400 bg-indigo-100 text-indigo-700' : 'border-indigo-300 bg-white text-indigo-700 hover:bg-indigo-50']">
                                🎯 {{ calibrageBanque.enCours ? 'Lecture…' : 'Calibrer avec une capture' }}
                                <input type="file" accept="image/*" multiple class="hidden" data-calibrage-captures @change="calibrerCaptures($event.target.files); $event.target.value = ''"/>
                            </label>
                            <button type="button" data-import-ouvrir @click="ouvrirImportBanque()" class="shrink-0 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow">📥 Importer captures / relevé</button>
                        </div>
                        <!-- v37.55 : ce que la calibration a lu, et les comptes à désigner une fois -->
                        <div v-if="calibrageBanque.enCours || calibrageBanque.attente.length || calibrageBanque.resultats.length" data-calibrage-retour class="px-4 md:px-6 py-3 border-b border-gray-100 bg-white space-y-2">
                            <p v-if="calibrageBanque.enCours" class="text-[11px] font-bold text-indigo-700">{{ calibrageBanque.message }}</p>
                            <p v-for="(r, i) in calibrageBanque.resultats" :key="'cr_' + i" data-calibrage-resultat :class="['text-[11px] font-bold', r.ok ? 'text-emerald-700' : 'text-red-600']">{{ r.texte }} <span class="font-semibold text-gray-400">· {{ r.nom }}</span></p>
                            <div v-for="x in calibrageBanque.attente" :key="'ca_' + x.id" data-calibrage-attente class="rounded-xl border border-amber-200 bg-amber-50 p-2.5 space-y-1.5">
                                <p class="text-[11px] font-black text-amber-900">🆕 {{ nomBanque(x.analyse.banque) }} · {{ x.quoi }} — à quel compte l'associer ?</p>
                                <div class="flex flex-wrap items-center gap-1.5">
                                    <select data-calibrage-reponse v-model="x.reponse" class="flex-1 min-w-[10rem] text-xs font-bold px-2 py-1.5 rounded-lg border border-amber-300 bg-white outline-none">
                                        <option value="">Choisir le compte…</option>
                                        <option v-for="c in comptes" :key="'car_' + c.id" :value="c.id">{{ c.icone || '🏦' }} {{ c.label }}</option>
                                    </select>
                                    <button type="button" data-calibrage-associer @click="associerCalibrage(x)" :disabled="!x.reponse" class="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-black">Associer pour toujours</button>
                                </div>
                            </div>
                        </div>"""))
H.append(("calibrage : plus de bouton par compte", """                                        <label :class="['shrink-0 cursor-pointer text-[11px] font-black px-2.5 py-1 rounded-lg border border-dashed transition-colors', calibrageBanque.enCours && calibrageBanque.compteId === c.id ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-gray-300 text-gray-600 hover:border-indigo-400 hover:text-indigo-700']"
                                               @dragover.prevent @drop.prevent="calibrerAvecCapture(c.id, $event.dataTransfer && $event.dataTransfer.files)" title="Déposez (ou choisissez) une capture de ce compte : son RIB ou son empreinte est mémorisé">
                                            📷 {{ calibrageBanque.enCours && calibrageBanque.compteId === c.id ? 'Lecture…' : 'Calibrer avec une capture' }}
                                            <input type="file" accept="image/*" class="hidden" data-calibrage-capture @change="calibrerAvecCapture(c.id, $event.target.files); $event.target.value = ''"/>
                                        </label>
                                    </div>
                                    <p v-if="calibrageBanque.message && calibrageBanque.compteId === c.id" data-calibrage-message class="text-[10px] font-bold text-indigo-700">{{ calibrageBanque.message }}</p>""",
"""                                    </div>"""))
H.append(("solde suivi : libellés clairs", """                                            <option value="compteCheque">Solde suivi : « Compte chèque »</option>
                                            <option value="mesComptes">Solde suivi : « Mes comptes »</option>""",
"""                                            <option value="compteCheque">Solde suivi : « Compte chèque » (ce compte)</option>
                                            <option value="mesComptes">Solde suivi : « Mes comptes » (TOTAL de vos comptes Attijari)</option>"""))
H.append(("texte d'aide du calibrage", """<p class="text-[10px] text-indigo-700 mt-0.5">Une capture suffit : le RIB (ou le n° de compte) est reconnu ensuite, partout. Sans RIB à l'écran (Saham), c'est l'empreinte « banque + intitulé » qui parle.</p>""",
"""<p class="text-[10px] text-indigo-700 mt-0.5">Une fois pour toutes : la capture « Détails du compte » de votre appli (RIB + n° de compte). Ensuite l'accueil suffit — son n° est rapproché du RIB. Sans RIB à l'écran (Saham), c'est l'empreinte « banque + intitulé » qui parle.</p>"""))
H.append(("calibrage : en-tête lisible au téléphone", """                            <div class="min-w-0 flex-1">
                                <h3 class="font-black uppercase tracking-widest text-indigo-800 text-sm">🎯 Calibrage Bancaire &amp; RIB</h3>""",
"""                            <div class="min-w-0 w-full md:w-auto md:flex-1">
                                <h3 class="font-black uppercase tracking-widest text-indigo-800 text-sm">🎯 Calibrage Bancaire &amp; RIB</h3>"""))
src = patcher('index.html', H)
d = src.index('                    /* ══ v37.54 BANQUE:PARSEUR:DEBUT')
f = src.index('/* ══ BANQUE:PARSEUR:FIN ══ */') + len('/* ══ BANQUE:PARSEUR:FIN ══ */')
src = src[:d] + PARSEUR.rstrip('\n') + src[f:]
io.open('index.html', 'w', encoding='utf-8').write(src)
print("✔ v37.55 — calibrer une fois (un seul bouton, Détails du compte, n° ↔ RIB), le solde suivi seulement")
