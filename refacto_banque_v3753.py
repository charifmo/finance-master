# -*- coding: utf-8 -*-
"""
v37.53 — CALIBRAGE BANCAIRE (RIB / EMPREINTE) & RÉCONCILIATION AUTOMATIQUE.

« Je veux automatiser la mise à jour quotidienne de mes soldes ET le remplissage des opérations
oubliées, à partir de mes banques marocaines (Attijariwafa Bank, Bank Assafa, Saham). »

  BRIQUE 1 — CALIBRAGE : Trésorerie › « 🎯 Calibrage Bancaire & RIB » : banque, RIB / n° de compte,
     empreinte (banque + intitulé, quand l'écran ne montre aucun RIB), solde suivi chez Attijari
     (« Compte chèque » ou « Mes comptes »), calibrage par capture. À l'import : RIB connu → le
     compte ; RIB inconnu → « Nouveau RIB détecté… À quel compte ? » (mémorisé) ; pas de RIB →
     l'empreinte, sinon la même question (RIB facultatif).
  BRIQUE 2 — LECTURE LOCALE, 0 DH : un parseur JavaScript (texte collé Attijarinet, CSV, texte OCR)
     pour Attijarinet, Attijari Mobile, Bank Assafa, Saham ; l'OCR (Tesseract.js 5.1.1) est
     EMBARQUÉ (vendor/ocr, même origine), deux lectures par capture fusionnées.
  BRIQUE 3 — TRI : solde proposé (arrondi, montant exact gardé) ; empreinte de chaque opération
     (compte + date comptable + libellé + montant) → jamais réimportée ; retraits GAB ignorés par
     défaut ; virements jamais en dépenses (pointés dans le Pilotage ou ignorés) ; frais regroupés
     en une ligne ; factures / charges proposées au pointage ; achats CB rapprochés du journal
     (±4 jours, ±2 DH) sinon ajoutés (source BANQUE) — sûr : rangé, doute : EN SUSPENS.
"""
import io, sys

def patcher(F, subs):
    src = io.open(F, encoding='utf-8').read()
    for label, a, b in subs:
        c = src.count(a)
        if c != 1:
            print(f'✖ {F} — {label} : {c} ancre(s), 1 attendue'); sys.exit(1)
        src = src.replace(a, b)
    io.open(F, 'w', encoding='utf-8').write(src)

PARSEUR = r'''                    /* ══ v37.53 BANQUE:PARSEUR:DEBUT ══════════════════════════════════════════════
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
                    const BQ_MONTANT = /(^|[^\d,.])([+-]?) ?(\d{1,3}(?:[ .]\d{3})+|\d+)[,.](\d{2})(?!\d)(?: ?(mad|dhs|dh|drh)\b)?/gi;
                    const BQ_DATE_NUM = /(^|[^\d])(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4}|\d{2})(?!\d)/g;
                    const BQ_DATE_TXT = new RegExp('(^|[^\\d])(\\d{1,2})(?:er)? ?(' + BQ_RE_MOIS + ')\\.?(?: (\\d{4}))?(?![a-zà-ÿ])', 'gi');
                    const BQ_DATE_GAB = /(^|\s)(\d{2}) (\d{2}) \d{2}h\d{2}\b/gi;           // « AWBGAB … E 14 10 09H01 »
                    //  Les titres qui ouvrent la liste des opérations
                    const BQ_TITRES = /dernieres operations|transactions recentes|total des mouvements|derniers mouvements|historique des operations|liste des operations|mes operations/;
                    //  Les lignes d'interface qui ne sont jamais une opération
                    const BQ_BRUIT = /^(voir (tout|plus)|tout voir|afficher plus|accueil|comptes?|mes comptes|operations|virements?|paiements?|cartes?|plus|menu|profil|services|filtrer|rechercher|aujourd ?hui|hier|historique|releve|date|libelle|montant|debit|credit|solde|transferts?|mon compte|parametres|deconnexion)( (comptes?|virements?|cartes?|plus|operations|transferts?|services|profil))*$/;
                    const BQ_CREDIT = /reception|\brecu\b|versement|\bcredit\b|remboursement|salaire|virement recu|vir recu|\bdepot\b|annulation/;

                    //  Une date { j, m, a | null } → ISO, l'année devinée si l'écran la tait :
                    //  la plus récente qui ne soit pas dans le futur (à 7 jours près).
                    const bqResoudreDate = (d, aujourdhui) => {
                        if (!d) return null;
                        const ref = aujourdhui instanceof Date ? aujourdhui : new Date();
                        let a = d.a != null ? (d.a < 100 ? 2000 + d.a : d.a) : ref.getFullYear();
                        if (d.a == null && new Date(a, d.m - 1, d.j) > new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + 7)) a -= 1;
                        if (!(d.m >= 1 && d.m <= 12 && d.j >= 1 && d.j <= 31)) return null;
                        return a + '-' + String(d.m).padStart(2, '0') + '-' + String(d.j).padStart(2, '0');
                    };
                    const bqMontantDe = (ent, dec) => Number(String(ent).replace(/[ .]/g, '') + '.' + dec);
                    //  Une ligne : ses montants, ses dates, et ce qui reste de texte
                    const _bqLigne = (raw) => {
                        const montants = [], dates = [];
                        let r = raw.replace(BQ_MONTANT, (m, pre, signe, ent, dec, dev) => {
                            montants.push({ v: bqMontantDe(ent, dec), signe: signe || '', devise: dev ? dev.toLowerCase() : '' });
                            return pre + ' ';
                        });
                        r = r.replace(BQ_DATE_NUM, (m, pre, j, mo, a) => { dates.push({ j: +j, m: +mo, a: +a }); return pre + ' '; });
                        r = r.replace(BQ_DATE_TXT, (m, pre, j, mois, a) => { dates.push({ j: +j, m: BQ_MOIS[bqNorm(mois)], a: a ? +a : null }); return pre + ' '; });
                        r = r.replace(BQ_DATE_GAB, (m, pre, j, mo) => { dates.push({ j: +j, m: +mo, a: null, gab: true }); return pre + ' '; });
                        const net = (x) => x.replace(/\(\*\)/g, ' ').replace(/\.{2,}|…/g, ' ').replace(/\s+/g, ' ').trim();
                        const reste = net(r);
                        const texte = net(raw.replace(BQ_MONTANT, (m, pre) => pre + ' '));
                        const lettres = (reste.match(/\p{L}/gu) || []).length;
                        const bruit = /https?:\/\/|www\./i.test(raw) || BQ_BRUIT.test(bqNorm(reste).replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim());
                        return { raw, reste, texte, montants, dates, L: lettres >= 3 && !bruit, D: lettres < 3 && dates.length > 0, A: montants.length > 0, bruit: bruit || (lettres > 0 && lettres < 3 && !dates.length && !montants.length) };
                    };
                    //  Le texte en lignes : tabulations, « | » et colonnes collées deviennent des lignes ;
                    //  « 14 » suivi de « oct » (Attijarinet) redevient « 14 oct ».
                    const _bqLignes = (texte) => {
                        const brutes = String(texte || '').replace(/\r/g, '').replace(/\t+/g, '\n').replace(/ \| /g, '\n')
                            .replace(/[‐-―−]/g, '-').replace(/[^\S\n]+/g, ' ').split('\n').map(l => l.trim()).filter(Boolean);
                        const out = [];
                        for (let i = 0; i < brutes.length; i++) {
                            const l = brutes[i], s = brutes[i + 1];
                            if (/^\d{1,2}$/.test(l) && s && new RegExp('^(' + BQ_RE_MOIS + ')\\.?( \\d{4})?$', 'i').test(s)) { out.push(l + ' ' + s); i++; continue; }
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
                    const _bqNote = (ops) => ops.reduce((s, o) => s + (o.montants.length === 1 ? 2 : (o.montants.length ? 0 : -2)) + (o.dates.length || o.datesLib.length ? 1 : -1) + (o.libs.length ? 1 : -2), 0);

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
                        const lIntitule = tete.find(l => /\bcompte\b/.test(bqNorm(l)) && !/mes comptes|total des/.test(bqNorm(l)));
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
                        const essais = ['D', 'L'].map(tt => {
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
                            return { date: dateAchat || dateOp, dateOp: dateOp || dateAchat, dateAchat, libelle, montant: signe * m.v, brut: o.libs.join(' / ') };
                        });
                        return { banque: bq, format, identifiants, intitule, signature: bq + '|' + intitule, soldes, totaux, operations };
                    };
                    //  Deux lectures OCR de la même capture (binarisations différentes) : l'une voit ce
                    //  que l'autre rate (un solde vert sur fond vert, une date grise).
                    const bqFusionner = (a, b) => {
                        if (!a) return b; if (!b) return a;
                        const q = (x) => x.operations.reduce((s, o) => s + (o.dateOp ? 1 : 0) + 1, 0) + (Object.keys(x.soldes).length ? 1 : 0);
                        const [p, s] = q(a) >= q(b) ? [a, b] : [b, a];
                        const ops = p.operations.slice();
                        const cle = (o) => (o.dateOp || '') + '|' + Math.round(o.montant * 100);
                        const n = {}; ops.forEach(o => { n[cle(o)] = (n[cle(o)] || 0) + 1; });
                        s.operations.forEach(o => { if (o.dateOp && (n[cle(o)] || 0) === 0) { ops.push(o); } else if (n[cle(o)]) n[cle(o)]--; });
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
                        if (/^com\b|^comm?\.?\s*-|commission|\bfrais\b|agios|cotisation|\btimbre\b|\btaxe\b|\btva\b/.test(n)) return 'frais';
                        if (/virement|\bvir\b|\bvrt\b|\bvirt\b|transfert|mise a disposition/.test(n)) return 'virement';
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
                    /* ══ BANQUE:PARSEUR:FIN ══ */
'''

MODULE = r'''                    /* ═══════════════════════════════════════════════════════════════════════════
                       v37.53 — CALIBRAGE BANCAIRE & RÉCONCILIATION AUTOMATIQUE
                       Une capture (ou un texte collé) → le bon compte (RIB / n° calibré, sinon
                       l'empreinte « banque + intitulé », sinon une question, mémorisée), son solde,
                       et chaque opération rangée : déjà dans le journal, pointée dans le Pilotage,
                       ajoutée (source BANQUE, le doute EN SUSPENS dans « À vérifier »), ignorée
                       (retrait espèces, virement déjà dans le solde) ou regroupée (frais).
                       Chaque opération traitée laisse son empreinte : la recoller ne la refait jamais.
                       ═══════════════════════════════════════════════════════════════════════════ */
                    const BANQUES_CB = [
                        { cle: 'attijari', nom: 'Attijariwafa Bank', court: 'Attijari' },
                        { cle: 'assafa', nom: 'Bank Assafa', court: 'Assafa' },
                        { cle: 'saham', nom: 'Saham Bank', court: 'Saham' },
                        { cle: 'autre', nom: 'Autre banque', court: 'Autre' },
                    ];
                    const nomBanque = (k) => (BANQUES_CB.find(b => b.cle === k) || {}).nom || 'Banque non reconnue';
                    const _idNorm = (x) => String(x || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
                    //  « 362780920110100084189738 » → « 362 780 9201101000841897 38 »
                    const idLisible = (x) => { const v = _idNorm(x); return v.length === 24 ? v.slice(0, 3) + ' ' + v.slice(3, 6) + ' ' + v.slice(6, 22) + ' ' + v.slice(22) : v; };
                    //  Le même compte : identiques, ou l'un contient l'autre (n° de compte dans le RIB), 7 signes au moins
                    const _memeId = (a, b) => {
                        const x = _idNorm(a), y = _idNorm(b);
                        if (!x || !y) return false;
                        if (x === y) return true;
                        const [c, l] = x.length <= y.length ? [x, y] : [y, x];
                        return c.length >= 7 && l.includes(c);
                    };
                    const signatureLisible = (s) => { const [b, i] = String(s || '').split('|'); return nomBanque(b) + (i ? ' · « ' + i + ' »' : ''); };
                    const _compteParId = (id) => (comptes.value || []).find(c => String(c.id) === String(id)) || null;

                    //  À quel compte appartient une capture ?
                    const resoudreCompteReleve = (a) => {
                        const parId = [];
                        (a.identifiants || []).forEach(x => (comptes.value || []).forEach(c => {
                            if ((c.identifiants || []).some(y => _memeId(x, y)) && !parId.includes(c)) parId.push(c);
                        }));
                        if (parId.length === 1) return { compteId: parId[0].id, via: 'identifiant', question: null };
                        if (parId.length > 1) return { compteId: null, via: null, question: 'ambigu', candidats: parId.map(c => c.id) };
                        if ((a.identifiants || []).length) return { compteId: null, via: null, question: 'identifiant' };
                        const parEmp = (comptes.value || []).filter(c => (c.empreintes || []).includes(a.signature));
                        if (parEmp.length === 1) return { compteId: parEmp[0].id, via: 'empreinte', question: null };
                        return { compteId: null, via: null, question: parEmp.length > 1 ? 'ambigu' : 'empreinte', candidats: parEmp.map(c => c.id) };
                    };
                    //  Mémoriser « cette capture = ce compte » : sa banque, ses identifiants (un RIB n'appartient
                    //  qu'à un compte : retiré des autres), son empreinte quand l'écran ne montre aucun RIB.
                    const calibrerCompte = (compteId, a, ajout = {}) => {
                        const c = _compteParId(compteId);
                        if (!c) return null;
                        if (a && a.banque && a.banque !== 'autre' && !c.banque) c.banque = a.banque;
                        const nouveaux = [...((a && a.identifiants) || []), ajout.identifiant, ajout.rib].map(_idNorm).filter(x => x && x.length >= 5);
                        const ids = [...new Set([...(c.identifiants || []).map(_idNorm), ...nouveaux])];
                        c.identifiants = ids;
                        (comptes.value || []).forEach(o => { if (o !== c && Array.isArray(o.identifiants)) o.identifiants = o.identifiants.filter(y => !nouveaux.includes(_idNorm(y))); });
                        if (a && !(a.identifiants || []).length && a.signature && !/\|$/.test(a.signature))
                            c.empreintes = [...new Set([...(c.empreintes || []), a.signature])];
                        handleDataChange();
                        return c;
                    };
                    const retirerIdentifiant = (c, x) => { c.identifiants = (c.identifiants || []).filter(y => y !== x); handleDataChange(); };
                    const retirerEmpreinte = (c, x) => { c.empreintes = (c.empreintes || []).filter(y => y !== x); handleDataChange(); };
                    const ajouterIdentifiantCompte = (c, x) => { const v = _idNorm(x); if (v.length < 5) return false; calibrerCompte(c.id, null, { identifiant: v }); return true; };

                    /* ── L'OCR EMBARQUÉ (vendor/ocr, repli CDN) ─────────────────────────────── */
                    const _ocr = { worker: null, promesse: null, progres: null };
                    const _chargerScript = (src) => new Promise((ok, ko) => {
                        const s = document.createElement('script'); s.src = src; s.async = true;
                        s.onload = ok; s.onerror = () => ko(new Error('script ' + src)); document.head.appendChild(s);
                    });
                    const _workerOCR = () => {
                        if (_ocr.promesse) return _ocr.promesse;
                        _ocr.promesse = (async () => {
                            const base = new URL('vendor/ocr/', document.baseURI).href;
                            if (!window.Tesseract) {
                                try { await _chargerScript(base + 'tesseract.min.js'); }
                                catch (e) { await _chargerScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js'); }
                            }
                            const logger = (m) => { if (_ocr.progres && m && typeof m.progress === 'number') _ocr.progres(m); };
                            try {
                                _ocr.worker = await window.Tesseract.createWorker('fra', 1, { workerPath: base + 'worker.min.js', corePath: base + 'tesseract-core-simd-lstm.wasm.js', langPath: base + 'lang', logger });
                            } catch (e) {
                                _ocr.worker = await window.Tesseract.createWorker('fra', 1, { logger });           // le CDN par défaut
                            }
                            return _ocr.worker;
                        })();
                        _ocr.promesse.catch(() => { _ocr.promesse = null; });
                        return _ocr.promesse;
                    };
                    //  Une capture → une image propre : agrandie si elle est petite, sombre → inversée
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
                    };

                    /* ── L'IMPORT ───────────────────────────────────────────────────────────── */
                    const importBanque = reactive({ ouvert: false, etape: 'depot', texte: '', fichiers: [], captures: [], erreur: '', resume: null, enCours: false });
                    const calibrageBanque = reactive({ compteId: null, enCours: false, message: '', saisie: {} });
                    let _fichierSeq = 0;
                    const ouvrirImportBanque = () => {
                        Object.assign(importBanque, { ouvert: true, etape: 'depot', texte: '', fichiers: [], captures: [], erreur: '', resume: null, enCours: false });
                    };
                    const fermerImportBanque = () => {
                        importBanque.fichiers.forEach(f => { try { URL.revokeObjectURL(f.url); } catch (_) {} });
                        importBanque.ouvert = false;
                    };
                    const ajouterFichiersBanque = (liste) => {
                        [...(liste || [])].forEach(f => {
                            if (!f) return;
                            if (/^image\//.test(f.type)) importBanque.fichiers.push({ id: ++_fichierSeq, nom: f.name || ('capture ' + _fichierSeq), url: URL.createObjectURL(f), fichier: f, statut: 'attente', progres: 0, textes: null });
                            else if (/^text\/|\.csv$|\.txt$/i.test(f.type + ' ' + f.name)) f.text().then(t => { importBanque.texte = (importBanque.texte ? importBanque.texte + '\n\n' : '') + t; });
                        });
                    };
                    const retirerFichierBanque = (id) => { importBanque.fichiers = importBanque.fichiers.filter(f => f.id !== id); };
                    //  Ctrl+V : une image (capture), ou du texte (Attijarinet) — où que soit le curseur dans la fenêtre
                    const _collerBanque = (e) => {
                        if (!importBanque.ouvert || importBanque.etape !== 'depot') return;
                        const dt = e.clipboardData;
                        if (!dt) return;
                        const images = [...(dt.items || [])].filter(it => it.kind === 'file' && /^image\//.test(it.type)).map(it => it.getAsFile()).filter(Boolean);
                        if (images.length) { e.preventDefault(); ajouterFichiersBanque(images); return; }
                        if (e.target && e.target.matches && e.target.matches('[data-import-texte]')) return;   // le champ s'en charge
                        const t = dt.getData('text/plain');
                        if (t) { e.preventDefault(); importBanque.texte = (importBanque.texte ? importBanque.texte + '\n\n' : '') + t; }
                    };
                    watch(() => importBanque.ouvert, (o) => {
                        if (o) window.addEventListener('paste', _collerBanque);
                        else window.removeEventListener('paste', _collerBanque);
                    });
                    const deposerBanque = (e) => ajouterFichiersBanque(e.dataTransfer && e.dataTransfer.files);

                    //  Le registre : chaque opération déjà traitée (tous seaux annuels)
                    const _registreBanque = () => {
                        const out = [];
                        Object.values(donneesAnnuelles.value || {}).forEach(d => Object.entries((d && d.banqueOperations) || {}).forEach(([h, e]) => out.push({ h, ...e })));
                        return out;
                    };
                    const _seauDe = (iso) => (donneesAnnuelles.value || {})[Number(String(iso || '').slice(0, 4))] || (donneesAnnuelles.value || {})[anneeAffichage.value];
                    //  Déjà traitée ? Son empreinte exacte, ou (l'OCR a lu une lettre de travers) même compte,
                    //  même date, même montant et un libellé qui commence pareil.
                    const _dejaTraitee = (reg, compteId, op, hash, pris) => {
                        const lib = bqLibNorm(op.libelle);
                        const m = Math.round(op.montant * 100);
                        return reg.find(e => !pris.has(e.h) && (e.h === hash || (String(e.c) === String(compteId) && e.d === (op.dateOp || op.date) && Math.round(e.m * 100) === m
                            && (e.l === lib || (e.l && lib && (e.l.slice(0, 10) === lib.slice(0, 10) || e.l.startsWith(lib) || lib.startsWith(e.l)))))));
                    };
                    const _enregistrerOp = (compteId, l, statut, extra = {}) => {
                        const d = _seauDe(l.op.dateOp || l.op.date);
                        if (!d) return;
                        if (!d.banqueOperations || typeof d.banqueOperations !== 'object') d.banqueOperations = {};
                        d.banqueOperations[l.hash] = { c: compteId, d: l.op.dateOp || l.op.date, m: l.op.montant, l: bqLibNorm(l.op.libelle), s: statut, t: _aujourdhuiISO(), ...extra };
                    };
                    const _jours = (a, b) => Math.round((new Date(a) - new Date(b)) / 864e5);
                    const _toutesTx = () => {
                        const out = [];
                        Object.values(donneesAnnuelles.value || {}).forEach(d => (d && Array.isArray(d.transactionsReelles) ? d.transactionsReelles : []).forEach(t => out.push(t)));
                        return out;
                    };
                    //  Déjà saisi à la main ? ±2 DH, de la date d'achat − 4 j à la date comptable + 4 j
                    const _matchJournal = (op, marchand, pris) => {
                        const m = Math.abs(op.montant), d1 = op.dateAchat || op.dateOp || op.date, d2 = op.dateOp || op.date;
                        const mn = bqLibNorm(marchand).slice(0, 5);
                        return _toutesTx().filter(t => t && !pris.has(t.id) && Math.abs((Number(t.montant) || 0) - m) <= 2
                                && t.date && _jours(t.date, d1) >= -4 && _jours(t.date, d2) <= 4
                                && (!t.banqueHash || (t.banqueMarchand && mn && t.banqueMarchand.startsWith(mn))))
                            .sort((a, b) => Math.abs(a.montant - m) - Math.abs(b.montant - m) || Math.abs(_jours(a.date, d1)) - Math.abs(_jours(b.date, d1)))[0] || null;
                    };
                    //  Une ligne du Pilotage qui attend ce paiement ? Montant (reste ou dû, ±1 DH), catégorie (la même, une
                    //  piste, ou la même famille — les factures), mots communs. Une ligne déjà réglée reste proposée, plus bas.
                    const _dansCycle = (iso) => { const { debut, fin } = consoT0Fenetre.value; return !!iso && iso >= _ymd(debut) && iso <= _ymd(fin); };
                    const _ciblesPilotage = (op, marchand, r, type) => {
                        if (!_dansCycle(op.dateOp || op.date)) return [];
                        const m = Math.abs(op.montant);
                        const mots = new Set(bqNorm(marchand).split(/[^a-z0-9]+/).filter(w => w.length >= 4));
                        const parents = new Map(_categoriesCandidates.value.map(c => [c.id, c.parent || null]));
                        const pr = r && r.id ? parents.get(r.id) : null;
                        const pool = op.montant > 0
                            ? entreesPilotageToutes.value
                            : tachesPilotageToutes.value.filter(t => type === 'virement' ? ['virement', 'epargne'].includes(t.nature) : ['fixe', 'variable', 'exceptionnel', 'epargne'].includes(t.nature));
                        //  Un achat SÛR d'une catégorie que le Pilotage ne suit pas (des courses « BIM MARRAKECH ») ne
                        //  se rapproche que par son montant : un nom de ville n'en fait pas la facture « … marrakech villa ».
                        const suivie = !!(r && r.id) && pool.some(t => { const c = t.ref && t.ref.categorieId; return c && (c === r.id || (pr && parents.get(c) === pr)); });
                        const parMots = !(type === 'achat' && r && r.statut === 'sur' && !suivie);
                        return pool.map(t => {
                            const reste = Math.max(0, t.due - (t.regle || 0));
                            const cat = t.ref && t.ref.categorieId;
                            let s = 0, famille = false;
                            if (Math.abs(reste - m) <= 1 || Math.abs(t.due - m) <= 1) s += 50;
                            if (parMots) {
                                if (cat && r && r.id === cat) { s += 45; famille = true; }
                                else if (cat && r && (r.candidats || []).includes(cat)) { s += 35; famille = true; }
                                else if (cat && pr && parents.get(cat) === pr) { s += 15; famille = true; }
                                if (bqNorm(t.libelle).split(/[^a-z0-9]+/).some(w => w.length >= 4 && mots.has(w))) s += 30;
                            }
                            if (t.paye) s -= 25;
                            return { cle: t.cle, libelle: t.libelle, due: t.due, regle: t.regle || 0, nature: t.nature, score: s, famille };
                        }).filter(c => c.score >= (type === 'achat' ? (c.famille ? 10 : 40) : 50)).sort((a, b) => b.score - a.score).slice(0, 3);
                    };
                    //  Les propositions d'une capture dont le compte est connu
                    const _proposer = (cap, deja, reservees) => {
                        const reg = _registreBanque(), pris = new Set(), txPris = new Set(), occ = {};
                        cap.lignes = cap.analyse.operations.map(op => {
                            const base = bqHash(cap.compteId, op);
                            occ[base] = (occ[base] || 0) + 1;
                            const hash = base + (occ[base] > 1 ? '-' + occ[base] : '');
                            const type = bqClasser(op), marchand = bqMarchand(op);
                            const l = { op, hash, type, marchand, cat: null, journal: null, cibles: [], action: 'ignorer', raison: '', dejaTraitee: null, doublon: false };
                            if (deja.has(hash)) { l.doublon = true; l.action = 'aucune'; return l; }
                            deja.add(hash);
                            const e = _dejaTraitee(reg, cap.compteId, op, hash, pris);
                            if (e) { pris.add(e.h); l.dejaTraitee = e; l.action = 'aucune'; return l; }
                            if (type === 'gab') { l.raison = 'Retrait espèces'; return l; }
                            if (type === 'frais') { l.action = 'frais'; return l; }
                            if (type === 'achat') {
                                l.cat = categoriserLibelle(marchand);
                                l.journal = _matchJournal(op, marchand, txPris);
                                if (l.journal) { txPris.add(l.journal.id); l.action = 'deja:' + l.journal.id; }
                            }
                            l.cibles = _ciblesPilotage(op, marchand, l.cat, type);
                            if (l.action.startsWith('deja:')) return l;
                            //  Une ligne du Pilotage n'est proposée qu'une fois par défaut (deux 5 000 reçus ≠ deux loyers).
                            //  Un achat dont la catégorie est suivie au Pilotage (une facture) y est pointé, jamais ajouté :
                            //  au journal, il resterait dû au Pilotage — compté deux fois.
                            const libre = l.cibles.find(c => !reservees.has(c.cle) && (type !== 'achat' || c.famille || c.score >= 50));
                            if (libre) { reservees.add(libre.cle); l.action = 'pointer:' + libre.cle; return l; }
                            if (type === 'achat') { l.action = 'ajouter'; return l; }
                            l.raison = type === 'virement' ? 'Virement : déjà dans le solde' : 'Entrée : déjà dans le solde';
                            return l;
                        });
                        const s = cap.analyse.soldes || {}, c = _compteParId(cap.compteId) || {};
                        cap.soldeChoisi = cap.analyse.banque === 'attijari'
                            ? (c.soldeSuivi === 'mesComptes' ? (s.mesComptes ?? s.compteCheque ?? s.solde) : (s.compteCheque ?? s.solde ?? s.mesComptes))
                            : (s.solde ?? s.compteCheque ?? s.mesComptes);
                        cap.soldeChoisi = cap.soldeChoisi == null ? null : cap.soldeChoisi;
                        cap.appliquerSolde = cap.soldeChoisi != null;
                    };
                    const _reproposer = () => {
                        const deja = new Set(), reservees = new Set();
                        importBanque.captures.forEach(cap => { if (cap.compteId) _proposer(cap, deja, reservees); else cap.lignes = []; });
                    };
                    const analyserImportBanque = async () => {
                        importBanque.erreur = ''; importBanque.enCours = true; importBanque.etape = 'analyse';
                        const aujourdhui = new Date();
                        const captures = [];
                        try {
                            if (String(importBanque.texte || '').trim())
                                captures.push({ id: 'texte', source: 'Texte collé', analyse: bqAnalyser(importBanque.texte, { aujourdhui }) });
                            for (const f of importBanque.fichiers) {
                                f.statut = 'ocr'; f.progres = 0;
                                try {
                                    f.textes = await ocrCapture(f.fichier, (p) => { f.progres = Math.round(p * 100); });
                                    const [a, b] = f.textes.map(t => bqAnalyser(t, { aujourdhui }));
                                    captures.push({ id: 'f' + f.id, source: f.nom, vignette: f.url, analyse: bqFusionner(a, b) });
                                    f.statut = 'ok'; f.progres = 100;
                                } catch (e) { f.statut = 'erreur'; importBanque.erreur = 'Lecture impossible de « ' + f.nom + ' » : ' + (e && e.message || e); }
                            }
                        } finally { importBanque.enCours = false; }
                        captures.forEach(cap => {
                            Object.assign(cap, resoudreCompteReleve(cap.analyse), { reponse: { compteId: '', rib: '' }, lignes: [], appliquerSolde: false, soldeChoisi: null });
                            cap.vide = !cap.analyse.operations.length && !Object.keys(cap.analyse.soldes || {}).length;
                        });
                        importBanque.captures = captures;
                        _reproposer();
                        importBanque.etape = captures.length ? 'revue' : 'depot';
                        if (!captures.length && !importBanque.erreur) importBanque.erreur = 'Rien à lire : déposez une capture ou collez le texte du relevé.';
                    };
                    //  La réponse à « À quel compte ? » — mémorisée pour toujours
                    const repondreCompteCapture = (cap) => {
                        const id = cap.reponse.compteId;
                        if (!id) return;
                        calibrerCompte(id, cap.analyse, { rib: cap.reponse.rib });
                        importBanque.captures.forEach(o => { if (!o.compteId || o === cap) Object.assign(o, resoudreCompteReleve(o.analyse)); });
                        if (!cap.compteId) { cap.compteId = id; cap.via = 'choix'; cap.question = null; }
                        _reproposer();
                    };
                    const changerCompteCapture = (cap, id) => { cap.compteId = id || null; cap.via = id ? 'choix' : null; _reproposer(); };
                    const optionsLigneBanque = (l) => {
                        const o = [];
                        if (l.journal) o.push({ v: 'deja:' + l.journal.id, t: '✓ Déjà dans le journal (' + (l.journal.libelle || '') + ', ' + formatMAD(l.journal.montant) + ')' });
                        l.cibles.forEach(c => o.push({ v: 'pointer:' + c.cle, t: '📌 Pointer « ' + c.libelle + ' » (' + formatNombre(c.regle) + ' / ' + formatNombre(c.due) + ')' }));
                        if (l.type === 'frais') o.push({ v: 'frais', t: '🧾 Frais bancaires (une ligne)' });
                        if (l.op.montant < 0) o.push({ v: 'ajouter', t: '➕ Ajouter au journal' });
                        o.push({ v: 'ignorer', t: '🚫 Ignorer' + (l.raison ? ' (' + l.raison + ')' : '') });
                        return o;
                    };
                    const resumeImportBanque = computed(() => {
                        const r = { ajouter: 0, suspens: 0, deja: 0, pointer: 0, ignorer: 0, frais: 0, traitees: 0, soldes: 0, sansCompte: 0 };
                        importBanque.captures.forEach(cap => {
                            if (!cap.compteId) { r.sansCompte += cap.analyse.operations.length; return; }
                            if (cap.appliquerSolde) r.soldes++;
                            (cap.lignes || []).forEach(l => {
                                if (l.dejaTraitee || l.doublon) { r.traitees++; return; }
                                const a = l.action.split(':')[0];
                                if (a === 'ajouter') { r.ajouter++; if (!l.cat || l.cat.statut !== 'sur') r.suspens++; }
                                else if (a in r) r[a]++;
                            });
                        });
                        return r;
                    });
                    //  Les frais regroupés : une catégorie « frais / banque » si vous en avez une, sinon Dépense exceptionnelle
                    const _categorieFrais = () => {
                        const cats = _categoriesCandidates.value;
                        const c = cats.find(x => /frais|banc|banque|commission/.test(bqNorm(x.label)));
                        return c ? c.id : (cats.some(x => x.id === 'cat_irr_depense_exceptionnelle') ? 'cat_irr_depense_exceptionnelle' : 'cat_misc');
                    };
                    const _txBanque = (date, libelle, montant, compteId, extra) => {
                        const d = _seauDe(date);
                        if (!d) return null;
                        if (!Array.isArray(d.transactionsReelles)) d.transactionsReelles = [];
                        const tx = { id: Date.now() + Math.floor(Math.random() * 100000), datetime: null, date, mois: Number(String(date).slice(5, 7)),
                                     libelle, montant: Math.round(Math.abs(montant) * 100) / 100, compteId, source: 'banque', ...extra };
                        d.transactionsReelles.push(tx);
                        return tx;
                    };
                    const appliquerImportBanque = () => {
                        const st = { ajoutees: 0, suspens: 0, deja: 0, pointees: 0, ignorees: 0, frais: 0, soldes: 0 };
                        const taches = [...tachesPilotageToutes.value, ...entreesPilotageToutes.value];
                        importBanque.captures.forEach(cap => {
                            if (!cap.compteId) return;
                            const compte = _compteParId(cap.compteId);
                            if (compte && cap.appliquerSolde && cap.soldeChoisi != null) {
                                compte.solde = Math.round(cap.soldeChoisi);
                                compte.soldeBanque = { montant: cap.soldeChoisi, date: new Date().toISOString(), banque: cap.analyse.banque };
                                st.soldes++;
                            }
                            const frais = [];
                            (cap.lignes || []).forEach(l => {
                                if (l.dejaTraitee || l.doublon) return;
                                const [a, cible] = [l.action.split(':')[0], l.action.split(':').slice(1).join(':')];
                                if (a === 'ajouter') {
                                    const r = l.cat || categoriserLibelle(l.marchand), sur = r.statut === 'sur';
                                    const extra = { categorieId: r.id || 'cat_misc', banqueHash: l.hash, banqueLibelle: l.op.libelle, banqueMarchand: bqLibNorm(l.marchand) };
                                    if (r.id) extra.categorieSource = r.source || 'règle';
                                    if (!sur) extra.aVerifier = true;
                                    const tx = _txBanque(l.op.date, l.marchand, l.op.montant, cap.compteId, extra);
                                    _enregistrerOp(cap.compteId, l, 'ajoutee', { x: tx && tx.id });
                                    st.ajoutees++; if (!sur) st.suspens++;
                                } else if (a === 'deja') {
                                    const tx = _toutesTx().find(t => String(t.id) === cible);
                                    if (tx) { tx.banqueHash = l.hash; if (!tx.banqueMarchand) tx.banqueMarchand = bqLibNorm(l.marchand); if (!tx.compteId) tx.compteId = cap.compteId; }
                                    _enregistrerOp(cap.compteId, l, 'journal', { x: tx && tx.id });
                                    st.deja++;
                                } else if (a === 'pointer') {
                                    const t = taches.find(x => x.cle === cible);
                                    if (t) ajouterAuRegle(t.ref, t.due, Math.abs(l.op.montant), cyclePilotage.value);
                                    _enregistrerOp(cap.compteId, l, 'pilotage', { k: cible });
                                    st.pointees++;
                                } else if (a === 'frais') frais.push(l);
                                else { _enregistrerOp(cap.compteId, l, 'ignoree', { r: l.raison || '' }); st.ignorees++; }
                            });
                            if (frais.length) {
                                const total = frais.reduce((s, l) => s + Math.abs(l.op.montant), 0);
                                const date = frais.map(l => l.op.date).sort().pop();
                                const tx = _txBanque(date, 'Frais bancaires · ' + nomBanque(cap.analyse.banque) + (frais.length > 1 ? ' (' + frais.length + ' op.)' : ''), total, cap.compteId,
                                                     { categorieId: _categorieFrais(), categorieSource: 'règle', banqueLibelle: frais.map(l => l.op.libelle).join(' / ') });
                                frais.forEach(l => _enregistrerOp(cap.compteId, l, 'frais', { x: tx && tx.id }));
                                st.frais += frais.length;
                            }
                        });
                        calculationTick.value++;
                        handleDataChange();
                        importBanque.resume = st;
                        importBanque.etape = 'fini';
                        return st;
                    };
                    //  Calibrer un compte d'une capture, depuis la section dédiée
                    const calibrerAvecCapture = async (compteId, liste) => {
                        const f = [...(liste || [])].find(x => x && /^image\//.test(x.type));
                        if (!f) return;
                        Object.assign(calibrageBanque, { compteId, enCours: true, message: 'Lecture de la capture…' });
                        try {
                            const [t0, t2] = await ocrCapture(f);
                            const a = bqFusionner(bqAnalyser(t0), bqAnalyser(t2));
                            const autre = resoudreCompteReleve(a);
                            const c = calibrerCompte(compteId, a);
                            const quoi = a.identifiants.length ? a.identifiants.map(idLisible).join(', ') : (a.signature && !/\|$/.test(a.signature) ? 'empreinte ' + signatureLisible(a.signature) : null);
                            calibrageBanque.message = !quoi ? 'Aucun RIB ni intitulé lisible sur cette capture.'
                                : '✓ ' + (c ? c.label : '') + ' : ' + nomBanque(a.banque) + ' · ' + quoi
                                  + (autre.compteId && String(autre.compteId) !== String(compteId) ? ' (retiré de « ' + ((_compteParId(autre.compteId) || {}).label || '') + ' »)' : '');
                        } catch (e) {
                            calibrageBanque.message = 'Lecture impossible : ' + (e && e.message || e);
                        } finally { calibrageBanque.enCours = false; }
                    };
                    const BANQUES_SELECT = BANQUES_CB;
'''

TPL_CALIBRAGE = r'''
                    <!-- 🎯 v37.53 : CALIBRAGE BANCAIRE & RIB — chaque compte reconnu à sa capture -->
                    <div data-calibrage class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                        <div class="px-6 py-4 border-b border-gray-100 bg-indigo-50 flex flex-wrap items-center gap-2">
                            <div class="min-w-0 flex-1">
                                <h3 class="font-black uppercase tracking-widest text-indigo-800 text-sm">🎯 Calibrage Bancaire &amp; RIB</h3>
                                <p class="text-[10px] text-indigo-700 mt-0.5">Une capture suffit : le RIB (ou le n° de compte) est reconnu ensuite, partout. Sans RIB à l'écran (Saham), c'est l'empreinte « banque + intitulé » qui parle.</p>
                            </div>
                            <button type="button" data-import-ouvrir @click="ouvrirImportBanque()" class="shrink-0 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow">📥 Importer captures / relevé</button>
                        </div>
                        <div class="divide-y divide-gray-100">
                            <div v-for="c in comptes" :key="'cal_' + c.id" data-calibrage-compte :data-compte="c.id" class="px-4 md:px-6 py-3 flex flex-col md:flex-row md:items-start gap-2 md:gap-4">
                                <div class="flex items-center gap-2 md:w-48 shrink-0">
                                    <span class="text-lg">{{ c.icone || '🏦' }}</span>
                                    <p class="font-black text-gray-800 text-sm leading-tight">{{ c.label }}</p>
                                </div>
                                <div class="flex-1 min-w-0 space-y-1.5">
                                    <div class="flex flex-wrap items-center gap-1.5">
                                        <select data-calibrage-banque :value="c.banque || ''" @change="c.banque = $event.target.value || undefined; handleDataChange()"
                                                class="text-[11px] font-bold px-2 py-1 rounded-lg border border-gray-200 bg-white text-gray-700 outline-none focus:border-indigo-400">
                                            <option value="">Banque…</option>
                                            <option v-for="b in BANQUES_SELECT" :key="b.cle" :value="b.cle">{{ b.nom }}</option>
                                        </select>
                                        <select v-if="c.banque === 'attijari'" data-calibrage-solde :value="c.soldeSuivi || 'compteCheque'" @change="c.soldeSuivi = $event.target.value; handleDataChange()"
                                                title="Attijari Mobile affiche deux soldes : lequel suivre pour ce compte ?"
                                                class="text-[11px] font-bold px-2 py-1 rounded-lg border border-gray-200 bg-white text-gray-700 outline-none focus:border-indigo-400">
                                            <option value="compteCheque">Solde suivi : « Compte chèque »</option>
                                            <option value="mesComptes">Solde suivi : « Mes comptes »</option>
                                        </select>
                                        <span v-for="x in (c.identifiants || [])" :key="'id_' + x" data-calibrage-id class="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200 tabular-nums">
                                            🔢 {{ idLisible(x) }}<button type="button" @click="retirerIdentifiant(c, x)" :aria-label="'Retirer ' + x" class="text-indigo-400 hover:text-red-600">×</button>
                                        </span>
                                        <span v-for="x in (c.empreintes || [])" :key="'em_' + x" data-calibrage-empreinte class="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                                            🖐️ {{ signatureLisible(x) }}<button type="button" @click="retirerEmpreinte(c, x)" :aria-label="'Retirer ' + x" class="text-amber-400 hover:text-red-600">×</button>
                                        </span>
                                    </div>
                                    <div class="flex flex-wrap items-center gap-1.5">
                                        <input type="text" data-calibrage-saisie :placeholder="'RIB ou n° de compte (ex. 362 780 9201101000841897 38)'" v-model="calibrageBanque.saisie[c.id]"
                                               @keydown.enter="ajouterIdentifiantCompte(c, calibrageBanque.saisie[c.id]) && (calibrageBanque.saisie[c.id] = '')"
                                               class="flex-1 min-w-[12rem] text-[11px] font-bold px-2 py-1 rounded-lg border border-gray-200 bg-white outline-none focus:border-indigo-400 tabular-nums"/>
                                        <label :class="['shrink-0 cursor-pointer text-[11px] font-black px-2.5 py-1 rounded-lg border border-dashed transition-colors', calibrageBanque.enCours && calibrageBanque.compteId === c.id ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-gray-300 text-gray-600 hover:border-indigo-400 hover:text-indigo-700']"
                                               @dragover.prevent @drop.prevent="calibrerAvecCapture(c.id, $event.dataTransfer && $event.dataTransfer.files)" title="Déposez (ou choisissez) une capture de ce compte : son RIB ou son empreinte est mémorisé">
                                            📷 {{ calibrageBanque.enCours && calibrageBanque.compteId === c.id ? 'Lecture…' : 'Calibrer avec une capture' }}
                                            <input type="file" accept="image/*" class="hidden" data-calibrage-capture @change="calibrerAvecCapture(c.id, $event.target.files); $event.target.value = ''"/>
                                        </label>
                                    </div>
                                    <p v-if="calibrageBanque.message && calibrageBanque.compteId === c.id" data-calibrage-message class="text-[10px] font-bold text-indigo-700">{{ calibrageBanque.message }}</p>
                                </div>
                            </div>
                        </div>
                    </div>
'''

TPL_MODALE = r'''        <!-- ═══ v37.53 : IMPORT BANCAIRE — captures (Ctrl+V, dépôt, plusieurs à la fois) ou texte collé ═══ -->
        <div v-if="importBanque.ouvert" data-import-banque @click.self="fermerImportBanque" class="fixed inset-0 z-[85] bg-slate-900/80 backdrop-blur-sm flex items-end md:items-center justify-center">
            <div class="bg-white w-full md:max-w-3xl md:rounded-2xl max-h-[92vh] overflow-y-auto rounded-t-3xl shadow-2xl">
                <div class="p-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
                    <div>
                        <h3 class="font-black uppercase tracking-widest text-sm text-indigo-700">🏦 Importer depuis la banque</h3>
                        <p class="text-[10px] text-gray-500 font-semibold">Lu sur place, sans IA : Attijari (web et mobile), Bank Assafa, Saham.</p>
                    </div>
                    <button title="Fermer" aria-label="Fermer" @click="fermerImportBanque" class="text-gray-400 hover:text-gray-800 text-2xl font-black w-8 h-8">×</button>
                </div>

                <!-- 1. Dépôt -->
                <div v-if="importBanque.etape === 'depot' || importBanque.etape === 'analyse'" class="p-4 space-y-3">
                    <label data-import-depot @dragover.prevent @drop.prevent="deposerBanque($event)"
                           class="block cursor-pointer rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50/60 hover:bg-indigo-50 px-4 py-5 text-center transition-colors">
                        <span class="block text-2xl">📷</span>
                        <span class="block text-sm font-black text-indigo-800">Déposez vos captures, ou Ctrl+V</span>
                        <span class="block text-[11px] font-semibold text-indigo-700/80">Plusieurs à la fois · sur mobile : touchez pour choisir dans vos photos</span>
                        <input type="file" accept="image/*,.txt,.csv,text/plain,text/csv" multiple class="hidden" data-import-fichiers @change="ajouterFichiersBanque($event.target.files); $event.target.value = ''"/>
                    </label>
                    <div v-if="importBanque.fichiers.length" class="flex flex-wrap gap-2">
                        <div v-for="f in importBanque.fichiers" :key="'if_' + f.id" data-import-vignette :data-statut="f.statut" class="relative w-20">
                            <img :src="f.url" :alt="f.nom" class="w-20 h-28 object-cover object-top rounded-lg border border-gray-200"/>
                            <div v-if="f.statut === 'ocr'" class="absolute inset-x-0 bottom-0 h-1.5 bg-black/20 rounded-b-lg overflow-hidden"><div class="h-full bg-indigo-500 transition-all" :style="{ width: f.progres + '%' }"></div></div>
                            <span v-if="f.statut === 'ok'" class="absolute top-1 right-1 text-xs">✅</span>
                            <span v-if="f.statut === 'erreur'" class="absolute top-1 right-1 text-xs">⚠️</span>
                            <button v-if="importBanque.etape === 'depot'" type="button" @click="retirerFichierBanque(f.id)" :aria-label="'Retirer ' + f.nom" class="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-white border border-gray-300 text-[10px] font-black text-gray-600 hover:text-red-600">×</button>
                        </div>
                    </div>
                    <textarea data-import-texte v-model="importBanque.texte" rows="4" placeholder="…ou collez ici le texte du relevé (Attijarinet : sélectionnez la liste des mouvements, Ctrl+C, Ctrl+V)"
                              class="w-full text-xs font-mono p-3 rounded-xl border border-gray-200 outline-none focus:border-indigo-400 bg-slate-50"></textarea>
                    <p v-if="importBanque.erreur" data-import-erreur class="text-[11px] font-bold text-red-600">{{ importBanque.erreur }}</p>
                    <button type="button" data-import-analyser @click="analyserImportBanque()" :disabled="importBanque.enCours || (!importBanque.fichiers.length && !importBanque.texte.trim())"
                            class="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-sm shadow">
                        {{ importBanque.enCours ? '🔎 Lecture des captures…' : '🔎 Analyser' }}
                    </button>
                </div>

                <!-- 2. Revue : compte, solde, chaque opération -->
                <div v-if="importBanque.etape === 'revue'" class="p-4 space-y-4">
                    <p v-if="importBanque.erreur" data-import-erreur class="text-[11px] font-bold text-red-600">{{ importBanque.erreur }}</p>
                    <div v-for="cap in importBanque.captures" :key="'cap_' + cap.id" data-import-capture :data-banque="cap.analyse.banque" :data-format="cap.analyse.format"
                         class="rounded-2xl border border-gray-200 overflow-hidden">
                        <div class="px-3 py-2.5 bg-slate-50 border-b border-gray-100 flex flex-wrap items-center gap-2">
                            <img v-if="cap.vignette" :src="cap.vignette" alt="" class="w-8 h-10 object-cover object-top rounded border border-gray-200"/>
                            <div class="min-w-0 flex-1">
                                <p class="text-xs font-black text-gray-800 truncate">{{ nomBanque(cap.analyse.banque) }} <span class="font-semibold text-gray-400">· {{ cap.source }}</span></p>
                                <p class="text-[10px] font-semibold text-gray-500 truncate">
                                    <template v-if="cap.analyse.identifiants.length">🔢 {{ cap.analyse.identifiants.map(idLisible).join(' · ') }}</template>
                                    <template v-else-if="cap.analyse.intitule">🖐️ « {{ cap.analyse.intitule }} » (aucun RIB à l'écran)</template>
                                    · {{ cap.analyse.operations.length }} opération(s)
                                    <template v-if="cap.analyse.totaux && cap.analyse.totaux.debit != null"> · <span data-import-totaux :class="Math.abs(cap.analyse.operations.filter(o => o.montant < 0).reduce((s, o) => s - o.montant, 0) - cap.analyse.totaux.debit) < 0.01 ? 'text-emerald-700' : 'text-red-600'">débits {{ Math.abs(cap.analyse.operations.filter(o => o.montant < 0).reduce((s, o) => s - o.montant, 0) - cap.analyse.totaux.debit) < 0.01 ? '✓' : '≠' }} total banque {{ formatMAD(cap.analyse.totaux.debit) }}</span></template>
                                </p>
                            </div>
                            <select data-import-compte :value="cap.compteId || ''" @change="changerCompteCapture(cap, $event.target.value)"
                                    class="text-[11px] font-black px-2 py-1 rounded-lg border border-gray-200 bg-white outline-none focus:border-indigo-400">
                                <option value="">Compte ?</option>
                                <option v-for="c in comptes" :key="'ic_' + c.id" :value="c.id">{{ c.icone || '🏦' }} {{ c.label }}</option>
                            </select>
                            <span v-if="cap.via === 'identifiant' || cap.via === 'empreinte'" data-import-via class="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">{{ cap.via === 'identifiant' ? 'reconnu au RIB' : 'reconnu à l’empreinte' }}</span>
                        </div>
                        <!-- La question, une seule fois -->
                        <div v-if="!cap.compteId" data-import-question :data-type="cap.question" class="px-3 py-3 bg-amber-50 border-b border-amber-200 space-y-2">
                            <p class="text-xs font-black text-amber-900">
                                <template v-if="cap.question === 'identifiant'">🆕 Nouveau {{ cap.analyse.identifiants[0].length === 24 ? 'RIB' : 'n° de compte' }} détecté ({{ idLisible(cap.analyse.identifiants[0]) }}). À quel compte l'associer ?</template>
                                <template v-else-if="cap.question === 'ambigu'">🤔 Plusieurs comptes portent ce RIB ou cette empreinte. Lequel ?</template>
                                <template v-else>🖐️ Capture {{ nomBanque(cap.analyse.banque) }}{{ cap.analyse.intitule ? ' « ' + cap.analyse.intitule + ' »' : '' }}, sans RIB visible. À quel compte l'associer ?</template>
                            </p>
                            <div class="flex flex-wrap items-center gap-1.5">
                                <select data-import-reponse v-model="cap.reponse.compteId" class="text-[11px] font-black px-2 py-1 rounded-lg border border-amber-300 bg-white outline-none">
                                    <option value="">Choisir le compte…</option>
                                    <option v-for="c in comptes.filter(x => cap.question !== 'ambigu' || (cap.candidats || []).some(i => String(i) === String(x.id)))" :key="'iq_' + c.id" :value="c.id">{{ c.icone || '🏦' }} {{ c.label }}</option>
                                </select>
                                <input v-if="cap.question !== 'identifiant'" type="text" data-import-rib v-model="cap.reponse.rib" placeholder="RIB (facultatif)"
                                       class="flex-1 min-w-[9rem] text-[11px] font-bold px-2 py-1 rounded-lg border border-amber-300 bg-white outline-none tabular-nums"/>
                                <button type="button" data-import-associer @click="repondreCompteCapture(cap)" :disabled="!cap.reponse.compteId"
                                        class="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white text-[11px] font-black">Associer pour toujours</button>
                            </div>
                        </div>
                        <template v-else>
                            <!-- Le solde -->
                            <label v-if="cap.soldeChoisi != null" data-import-solde class="px-3 py-2 flex items-center gap-2 border-b border-gray-100 cursor-pointer hover:bg-slate-50">
                                <input type="checkbox" v-model="cap.appliquerSolde" class="w-4 h-4 accent-indigo-600"/>
                                <span class="text-xs font-bold text-gray-700 flex-1">Mettre à jour le solde de « {{ (comptes.find(c => String(c.id) === String(cap.compteId)) || {}).label }} »</span>
                                <span class="text-xs font-black tabular-nums text-gray-400 line-through">{{ formatMAD((comptes.find(c => String(c.id) === String(cap.compteId)) || {}).solde) }}</span>
                                <span class="text-xs font-black tabular-nums text-indigo-700" :title="'Exact : ' + cap.soldeChoisi.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' DH'">→ {{ formatMAD(cap.soldeChoisi) }}</span>
                            </label>
                            <!-- Les opérations -->
                            <ul class="divide-y divide-gray-100">
                                <li v-for="l in cap.lignes" :key="'il_' + l.hash" data-import-ligne :data-type="l.type" :data-action="l.action.split(':')[0]" :data-hash="l.hash"
                                    :class="['px-3 py-2 flex flex-col md:flex-row md:items-center gap-1.5 md:gap-3', l.dejaTraitee || l.doublon ? 'opacity-50' : '']">
                                    <div class="flex items-baseline gap-2 min-w-0 md:flex-1">
                                        <span class="text-[10px] font-bold text-gray-500 tabular-nums shrink-0">{{ (l.op.date || '').slice(8, 10) }}/{{ (l.op.date || '').slice(5, 7) }}</span>
                                        <span class="text-xs font-bold text-gray-900 truncate" :title="l.op.libelle">{{ l.type === 'achat' ? l.marchand : l.op.libelle }}</span>
                                        <span :class="['text-xs font-black tabular-nums shrink-0', l.op.montant < 0 ? 'text-red-700' : 'text-emerald-700']">{{ l.op.montant > 0 ? '+' : '−' }}{{ formatMAD(Math.abs(l.op.montant)) }}</span>
                                    </div>
                                    <div class="flex flex-wrap items-center gap-1.5 shrink-0">
                                        <span v-if="l.dejaTraitee" data-import-badge="traitee" class="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">↺ déjà traitée le {{ String(l.dejaTraitee.t || '').slice(8, 10) }}/{{ String(l.dejaTraitee.t || '').slice(5, 7) }}</span>
                                        <span v-else-if="l.doublon" data-import-badge="doublon" class="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">↺ déjà sur une autre capture</span>
                                        <template v-else>
                                            <span v-if="l.type === 'gab'" data-import-badge="gab" class="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">🚫 Retrait espèces</span>
                                            <span v-else-if="l.type === 'virement'" data-import-badge="virement" class="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">🔄 Virement</span>
                                            <span v-else-if="l.type === 'frais'" data-import-badge="frais" class="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">🧾 Frais</span>
                                            <span v-else-if="l.action.startsWith('deja:')" data-import-badge="journal" class="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">✓ Déjà dans le journal</span>
                                            <span v-else-if="l.action === 'ajouter' && l.cat && l.cat.statut === 'sur'" data-import-badge="sur" class="text-[10px] font-black px-2 py-0.5 rounded-full bg-white text-emerald-800 border border-emerald-300">✓ {{ getCategorieLabel(l.cat.id) }} · sûr</span>
                                            <span v-else-if="l.action === 'ajouter'" data-import-badge="suspens" class="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300">⚠️ En suspens{{ l.cat && l.cat.id ? ' · ' + getCategorieLabel(l.cat.id) + ' ?' : '' }}</span>
                                            <select data-import-action :value="l.action" @change="l.action = $event.target.value"
                                                    class="text-[10px] font-bold px-1.5 py-1 rounded-lg border border-gray-200 bg-white text-gray-700 outline-none max-w-[16rem]">
                                                <option v-for="o in optionsLigneBanque(l)" :key="o.v" :value="o.v">{{ o.t }}</option>
                                            </select>
                                        </template>
                                    </div>
                                </li>
                                <li v-if="!cap.lignes.length" class="px-3 py-2 text-[11px] font-semibold text-gray-400">Aucune opération lue sur cette capture.</li>
                            </ul>
                        </template>
                    </div>
                    <div class="sticky bottom-0 bg-white pt-2 pb-1 border-t border-gray-100">
                        <p data-import-resume class="text-[11px] font-bold text-gray-600 mb-2">
                            {{ resumeImportBanque.ajouter }} à ajouter ({{ resumeImportBanque.suspens }} en suspens) · {{ resumeImportBanque.deja }} déjà au journal · {{ resumeImportBanque.pointer }} à pointer · {{ resumeImportBanque.frais }} frais · {{ resumeImportBanque.ignorer }} ignorée(s) · {{ resumeImportBanque.traitees }} déjà traitée(s){{ resumeImportBanque.soldes ? ' · ' + resumeImportBanque.soldes + ' solde(s)' : '' }}{{ resumeImportBanque.sansCompte ? ' · ' + resumeImportBanque.sansCompte + ' sans compte (répondez à la question)' : '' }}
                        </p>
                        <div class="flex gap-2">
                            <button type="button" @click="importBanque.etape = 'depot'" class="px-4 py-3 rounded-xl border border-gray-200 text-gray-600 font-black text-sm">← Retour</button>
                            <button type="button" data-import-appliquer @click="appliquerImportBanque()" class="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow">✓ Appliquer</button>
                        </div>
                    </div>
                </div>

                <!-- 3. Fait -->
                <div v-if="importBanque.etape === 'fini' && importBanque.resume" data-import-fini class="p-5 space-y-3">
                    <p class="text-lg font-black text-emerald-700">✓ Relevé appliqué</p>
                    <ul class="text-sm font-bold text-gray-700 space-y-1">
                        <li>➕ {{ importBanque.resume.ajoutees }} opération(s) ajoutée(s) au journal (source BANQUE)<template v-if="importBanque.resume.suspens"> — dont {{ importBanque.resume.suspens }} en suspens dans « ⚠️ À vérifier »</template></li>
                        <li>✓ {{ importBanque.resume.deja }} déjà dans le journal</li>
                        <li>📌 {{ importBanque.resume.pointees }} pointée(s) dans le Pilotage</li>
                        <li>🧾 {{ importBanque.resume.frais }} frais regroupés · 🚫 {{ importBanque.resume.ignorees }} ignorée(s)</li>
                        <li>🏦 {{ importBanque.resume.soldes }} solde(s) mis à jour</li>
                    </ul>
                    <button type="button" @click="fermerImportBanque" class="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm">Fermer</button>
                </div>
            </div>
        </div>

'''

H = []
#  Le dictionnaire : « SRM » (Société Régionale Multiservices : eau, électricité), « MARJ » (Marjane, tronqué sur les tickets CB)
H.append(('dico : SRM', "|radeema|radeej|radeef|", "|radeema|radeej|radeef|srm|"))
H.append(('dico : MARJ', "|marjane|marjan|", "|marjane|marjan|marj|"))
#  Une opération bancaire en doute reste EN SUSPENS, même si l'IA est sûre d'elle
H.append(('IA : la banque reste à vérifier', "if (conf === 'haute') delete u.aVerifier; else u.aVerifier = true;",
          "if (conf === 'haute' && u.source !== 'banque') delete u.aVerifier; else u.aVerifier = true;   // v37.53 : la banque, en suspens"))
H.append(('le module', """                    onBeforeUnmount(() => {
                        if (_resizeHandler) window.removeEventListener('resize', _resizeHandler);""",
          PARSEUR + "\n" + MODULE + """
                    onBeforeUnmount(() => {
                        if (_resizeHandler) window.removeEventListener('resize', _resizeHandler);"""))
H.append(('exports', "estClotureItem, cloturerItem, ajouterAuRegle, basculerClotureConso, consoEcoT0, entreesPilotageToutes,",
          """estClotureItem, cloturerItem, ajouterAuRegle, basculerClotureConso, consoEcoT0, entreesPilotageToutes,
                        // v37.53 — calibrage bancaire & import
                        BANQUES_SELECT, nomBanque, idLisible, signatureLisible, importBanque, calibrageBanque, ouvrirImportBanque, fermerImportBanque,
                        ajouterFichiersBanque, retirerFichierBanque, deposerBanque, analyserImportBanque, repondreCompteCapture, changerCompteCapture,
                        optionsLigneBanque, resumeImportBanque, appliquerImportBanque, calibrerAvecCapture, retirerIdentifiant, retirerEmpreinte,
                        ajouterIdentifiantCompte, calibrerCompte, resoudreCompteReleve, bqAnalyser, bqFusionner, bqClasser, bqMarchand, bqHash, ocrCapture,"""))
#  Trésorerie : la section de calibrage ; le solde lu à la banque, au centime, sous chaque compte
H.append(('Trésorerie : calibrage', "                    <!-- ⚖️ Rapprochement Bancaire -->", TPL_CALIBRAGE.lstrip('\n') + "\n                    <!-- ⚖️ Rapprochement Bancaire -->"))
H.append(('Trésorerie : solde banque', """<p class="text-[9px] text-emerald-600 font-bold mt-0.5">✏️ Éditable</p>""",
          """<p v-if="c.soldeBanque" data-solde-banque class="text-[9px] text-indigo-600 font-bold mt-0.5 tabular-nums" :title="'Lu à la banque le ' + new Date(c.soldeBanque.date).toLocaleString('fr-FR') + ' : ' + Number(c.soldeBanque.montant).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' DH'">🏦 {{ Number(c.soldeBanque.montant).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) }} · {{ new Date(c.soldeBanque.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) }}</p>
                                    <p v-else class="text-[9px] text-emerald-600 font-bold mt-0.5">✏️ Éditable</p>"""))
#  Saisie : le bouton d'import
H.append(('Saisie : bouton', """<span class="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full self-start md:self-auto">{{ transactionsReellesTriees.length }} tx — {{ anneeAffichage }}</span>""",
          """<div class="flex items-center gap-2 self-start md:self-auto">
                            <button type="button" data-import-ouvrir-saisie @click="ouvrirImportBanque()" title="Captures d'écran ou relevé collé : solde, opérations oubliées, rapprochement" class="text-xs font-black text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1 rounded-full">🏦 Importer la banque</button>
                            <span class="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">{{ transactionsReellesTriees.length }} tx — {{ anneeAffichage }}</span>
                        </div>"""))
H.append(('la modale', """        <div v-if="showSaisieQuickModal\"""", TPL_MODALE + """        <div v-if="showSaisieQuickModal\""""))
patcher('index.html', H)
print("✔ v37.53 — calibrage bancaire, lecture locale (4 formats), OCR embarqué, réconciliation")
