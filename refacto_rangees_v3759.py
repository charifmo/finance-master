# -*- coding: utf-8 -*-
"""
v37.59 — CHAQUE MONTANT SUR SA LIGNE.

« Attention gros décalage entre la capture et le résultat interprété par l'appli, revois ça en urgence. »
Attijari Mobile, écran « Compte chèque » : l'OCR lit la colonne des 11 libellés, PUIS la colonne des 11
montants. L'application les recollait dans l'ordre ; le premier libellé (« AWBGAB… », sous le bouton
« Remonter ») écarté, et l'écran non reconnu (lu « date d'abord »), CHAQUE montant glissait d'une ligne :
« Carrefour » avec le montant du retrait GAB, « VIR WEB » avec celui de la pharmacie (ignorée comme virement),
« G2ABVSHOP » avec celui du virement reçu… et le dernier montant sur un bout de la barre d'état.
  • LES RANGÉES DE L'ÉCRAN : chaque ligne lue par l'OCR est rangée à sa HAUTEUR sur la capture ; un montant
    rejoint le libellé qui est à son niveau. L'ordre de lecture de l'OCR ne décide plus de rien.
  • L'écran « Compte chèque » d'Attijari reconnu (« PAIEMENT CB 17 10 26 », « VIR WEB », « AWBGAB ») : lu
    « libellé d'abord », comme l'accueil.
  • Des montants restés en colonne (texte collé, écran inconnu) vont aux opérations DATÉES, jamais à un bout
    d'interface lu comme un libellé.
  • « Remonter » (le bouton posé sur la liste) n'est pas un libellé ; « CB17 10 26 » donne sa date d'achat, et
    le commerçant s'affiche sans elle (« Carrefour », plus « 17 10 26 Carrefour ( ») ;
    l'icône ↗ lue « 2) » n'entre pas dans le libellé ; une année lue « 2020 » sous le bouton est devinée.
  • L'ANTI-DOUBLON compare le COMMERÇANT : « PAIEMENT CB 18 10 26 MCDO » et « … Carrefour », même jour, même
    montant, passaient pour la même opération (les 10 premiers signes, « paiementcb », suffisaient) : le vrai
    achat restait « déjà traité », jamais ajouté.
  • LES IMPORTS DÉCALÉS RÉPARÉS : une ligne de même compte, même date, même montant au centime, déjà importée
    sous le libellé de sa voisine, n'est plus ajoutée une seconde fois : « ✏️ Corriger » (l'opération du journal
    reprend son vrai libellé et sa catégorie, sauf une catégorie choisie par vous) ou « 🗑 Retirer » (un retrait,
    un virement ajouté à tort). Seulement après les correspondances exactes de toute la capture.
"""
import io, sys
F = 'index.html'
src = io.open(F, encoding='utf-8').read()
def sub(label, a, b):
    global src
    if src.count(a) != 1: print('✖', label, ':', src.count(a), 'ancre(s)'); sys.exit(1)
    src = src.replace(a, b)

# 1. Les rangées : le texte de l'OCR reconstruit par hauteur, avant la relecture des centimes
sub('rangées',
"""                    const _relireCentimes = async (w, cv, data) => {
                        let texte = data.text || '';
""",
"""                    //  v37.59 — LES RANGÉES DE L'ÉCRAN. L'OCR lit parfois une colonne entière puis l'autre (Attijari
                    //  « Compte chèque » : 11 libellés, puis 11 montants) ; recollés dans l'ordre, un libellé perdu
                    //  décalait TOUS les montants. Ici chaque ligne lue est rangée à sa hauteur sur la capture : un
                    //  montant rejoint le libellé qui est à son niveau (séparés par une tabulation, il le suit
                    //  immédiatement). Deux lignes qui se chevauchent en largeur ne sont jamais fusionnées.
                    const _texteParRangees = (data) => {
                        const lignes = (data && Array.isArray(data.lines) ? data.lines : [])
                            .filter(l => l && l.bbox && String(l.text || '').trim() && l.bbox.y1 > l.bbox.y0);
                        if (lignes.length < 2) return (data && data.text) || '';
                        const rangees = [];
                        lignes.slice().sort((a, b) => (a.bbox.y0 + a.bbox.y1) - (b.bbox.y0 + b.bbox.y1)).forEach(l => {
                            const b = l.bbox, h = b.y1 - b.y0;
                            let meilleure = null, taux = 0;
                            rangees.forEach(r => {
                                if (r.items.some(x => x.bbox.x0 < b.x1 && b.x0 < x.bbox.x1)) return;
                                const t = (Math.min(r.y1, b.y1) - Math.max(r.y0, b.y0)) / Math.max(1, Math.min(h, r.y1 - r.y0));
                                if (t > taux) { taux = t; meilleure = r; }
                            });
                            if (meilleure && taux >= 0.5) meilleure.items.push(l);
                            else rangees.push({ y0: b.y0, y1: b.y1, items: [l] });
                        });
                        return rangees.sort((a, b) => a.y0 - b.y0)
                            .map(r => r.items.sort((a, b) => a.bbox.x0 - b.bbox.x0).map(l => String(l.text).replace(/\\s*\\n\\s*/g, ' ').trim()).join('\\t'))
                            .join('\\n');
                    };
                    const _relireCentimes = async (w, cv, data) => {
                        let texte = _texteParRangees(data);
""")

# 2. « Remonter » (le bouton flottant posé sur la liste) n'est pas un libellé
sub('remonter',
"""                        const net = (x) => x.replace(/\\(\\*\\)/g, ' ').replace(/[.…]{2,}|…/g, ' ').replace(/\\s+/g, ' ').trim();""",
"""                        const net = (x) => x.replace(/\\(\\*\\)/g, ' ').replace(/[.…]{2,}|…/g, ' ')
                            .replace(/(^|\\s)\\S{0,2}\\s*\\b(?:remonter|haut de page)\\b\\s*\\S{0,2}(?=\\s|$)/gi, ' ')   // v37.59 : le bouton « ↑ Remonter »
                            .replace(/\\s+/g, ' ').trim();""")

# 3. L'écran « Compte chèque » d'Attijari Mobile reconnu
sub('attijari',
"""                                    + (/\\bawbgab\\b|\\bawb\\b/.test(nTout) ? 2 : 0) + (/\\bmad\\b/.test(nTout) ? 1 : 0) + (/compte\\/\\d/.test(nTout) ? 3 : 0)""",
"""                                    + (/\\bawbgab\\b|\\bawb\\b/.test(nTout) ? 2 : 0) + (/\\bmad\\b/.test(nTout) ? 1 : 0) + (/compte\\/\\d/.test(nTout) ? 3 : 0)
                                    + (/paiement cb ?\\d{2}/.test(nTout) ? 2 : 0) + (/\\bvir web\\b/.test(nTout) ? 1 : 0)   // v37.59 : l'écran « Compte chèque »""")

# 4. Des montants restés en colonne vont aux opérations DATÉES (pas à un bout d'interface)
sub('essais',
"""                            const sans = ops.filter(o => !o.montants.length);
                            if (fin.length && sans.length === fin.length) sans.forEach((o, i) => o.montants.push(...fin[i].montants));
                            else if (fin.length && ops.length) ops[ops.length - 1].montants.push(...fin.flatMap(t => t.montants));
                            return { tt, ops, note: _bqNote(ops) + (premier && (premier.D ? 'D' : 'L') === tt ? 0.5 : 0) };""",
"""                            const sans = ops.filter(o => !o.montants.length);
                            const datees = sans.filter(o => o.dates.length || o.datesLib.length);   // v37.59 : pas un bout d'interface
                            if (fin.length && sans.length === fin.length) sans.forEach((o, i) => o.montants.push(...fin[i].montants));
                            else if (fin.length && datees.length === fin.length) datees.forEach((o, i) => o.montants.push(...fin[i].montants));
                            else if (fin.length && ops.length) ops[ops.length - 1].montants.push(...fin.flatMap(t => t.montants));
                            return { tt, ops, note: _bqNote(ops) + (premier && (premier.D ? 'D' : 'L') === tt ? 0.5 : 0) };""")

# 5. « PAIEMENT CB17 10 26 PHCIE » : la date d'achat collée à « CB »
sub('cb collé',
"""                        r = r.replace(/(\\bcb\\s+)(\\d{2}) ?(\\d{2}) ?(\\d{2})(?!\\d)/gi,""",
"""                        r = r.replace(/(\\bcb\\s*)(\\d{2}) ?(\\d{2}) ?(\\d{2})(?!\\d)/gi,""")

# 6. Une icône lue « 2) », « 7) » en tête de libellé (sans mois d'en-tête : ce n'est pas un jour)
sub('icône chiffre',
"""                        const m = t.match(/^([a-z]{1,3}|[A-Za-z]{1,2}[&@][A-Za-z]{0,2}|[A-Za-z]\\))\\s+(?=\\p{Lu})/u);""",
"""                        const m = t.match(/^([a-z]{1,3}|[A-Za-z]{1,2}[&@][A-Za-z]{0,2}|[A-Za-z0-9]\\))\\s+(?=\\p{Lu})/u);   // v37.59 : « 2) » = l'icône ↗""")

# 7. Une année lue de travers (« 18 oct. 2020 » sous le bouton « Remonter ») : plus d'un an d'écart, l'année est devinée
sub('année',
"""                        let a = d.a != null ? (d.a < 100 ? 2000 + d.a : d.a) : ref.getFullYear();
                        if (d.a == null && new Date(a, d.m - 1, d.j)""",
"""                        let a = d.a != null ? (d.a < 100 ? 2000 + d.a : d.a) : ref.getFullYear();
                        const devinee = d.a == null || Math.abs(a - ref.getFullYear()) > 1;   // v37.59 : « 2020 » lu pour « 2026 »
                        if (devinee) a = ref.getFullYear();
                        if (devinee && new Date(a, d.m - 1, d.j)""")

# 8. LES IMPORTS DÉCALÉS : même compte, même date, même montant au centime, libellé différent — l'opération a été
#    importée sous le libellé de sa voisine. On la corrige (ou on la retire du journal), on ne l'ajoute pas deux fois.
sub('proposer',
"""                    const _proposer = (cap, deja, reservees) => {
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
                            if (type === 'gab') { l.raison = 'Retrait espèces'; return l; }""",
"""                    //  v37.59 — UN IMPORT DÉCALÉ : même compte, même date, même montant au centime, mais un autre libellé (la
                    //  v37.58 collait parfois le montant au libellé de la ligne voisine). Seulement après les correspondances
                    //  exactes de toute la capture : deux achats du même montant le même jour gardent chacun le leur.
                    const _importDecale = (reg, compteId, op, pris) => {
                        const m = Math.round(op.montant * 100), d = op.dateOp || op.date, lib = bqLibNorm(op.libelle);
                        return reg.find(e => !pris.has(e.h) && String(e.c) === String(compteId) && e.d === d && Math.round(Number(e.m) * 100) === m && !bqLibProche(e.l, lib)) || null;
                    };
                    const _oublierOpBanque = (h) => Object.values(donneesAnnuelles.value || {}).forEach(d => { if (d && d.banqueOperations) delete d.banqueOperations[h]; });
                    const _proposer = (cap, deja, reservees) => {
                        const reg = _registreBanque(), pris = new Set(), txPris = new Set(), occ = {};
                        const prep = cap.analyse.operations.map(op => {
                            const base = bqHash(cap.compteId, op);
                            occ[base] = (occ[base] || 0) + 1;
                            return { op, hash: base + (occ[base] > 1 ? '-' + occ[base] : ''), e: null };
                        });
                        //  l'opération du journal liée à une ligne déjà traitée n'est plus libre pour une autre (même montant, même jour)
                        prep.forEach(p => { if (deja.has(p.hash)) return; p.e = _dejaTraitee(reg, cap.compteId, p.op, p.hash, pris); if (p.e) { pris.add(p.e.h); if (p.e.x != null) txPris.add(p.e.x); } });
                        cap.lignes = prep.map(({ op, hash, e }) => {
                            const type = bqClasser(op), marchand = bqMarchand(op);
                            const l = { op, hash, type, marchand, cat: null, journal: null, cibles: [], action: 'ignorer', raison: '', dejaTraitee: null, doublon: false, decale: null };
                            if (deja.has(hash)) { l.doublon = true; l.action = 'aucune'; return l; }
                            deja.add(hash);
                            if (e) { l.dejaTraitee = e; l.action = 'aucune'; return l; }
                            const dec = _importDecale(reg, cap.compteId, op, pris);
                            if (dec && dec.s !== 'ignoree') {
                                const tx = dec.s === 'ajoutee' && dec.x != null ? _toutesTx().find(t => String(t.id) === String(dec.x)) : null;
                                if (tx || dec.s !== 'ajoutee') {
                                    pris.add(dec.h);
                                    l.decale = { h: dec.h, l: tx ? tx.libelle : dec.l, s: dec.s, t: dec.t, tx: tx ? tx.id : null };
                                    if (!tx) { l.dejaTraitee = dec; l.action = 'aucune'; return l; }   // pointée, rapprochée : rien à refaire
                                    if (type === 'achat') { l.cat = categoriserLibelle(marchand); l.action = 'corriger:' + tx.id; }
                                    else { l.action = 'retirer:' + tx.id; l.raison = type === 'gab' ? 'Retrait espèces' : type === 'frais' ? 'Frais' : type === 'virement' ? 'Virement : déjà dans le solde' : 'Entrée : déjà dans le solde'; }
                                    return l;
                                }
                            }
                            if (type === 'gab') { l.raison = 'Retrait espèces'; return l; }""")

sub('options',
"""                    const optionsLigneBanque = (l) => {
                        const o = [];""",
"""                    const optionsLigneBanque = (l) => {
                        const o = [];
                        if (l.decale && l.decale.tx != null) {
                            if (l.type === 'achat') o.push({ v: 'corriger:' + l.decale.tx, t: '✏️ Corriger « ' + l.decale.l + ' » → « ' + l.marchand + ' »' });
                            o.push({ v: 'retirer:' + l.decale.tx, t: '🗑 Retirer « ' + l.decale.l + ' » du journal' });
                        }""")

sub('résumé',
"""                        const r = { ajouter: 0, suspens: 0, deja: 0, pointer: 0, ignorer: 0, frais: 0, traitees: 0, soldes: 0, sansCompte: 0 };""",
"""                        const r = { ajouter: 0, suspens: 0, deja: 0, pointer: 0, ignorer: 0, frais: 0, traitees: 0, soldes: 0, sansCompte: 0, corriger: 0, retirer: 0 };""")

sub('appliquer st',
"""                        const st = { ajoutees: 0, suspens: 0, deja: 0, pointees: 0, ignorees: 0, frais: 0, soldes: 0 };""",
"""                        const st = { ajoutees: 0, suspens: 0, deja: 0, pointees: 0, ignorees: 0, frais: 0, soldes: 0, corrigees: 0, retirees: 0 };""")

sub('appliquer corriger',
"""                                } else if (a === 'deja') {
                                    const tx = _toutesTx().find(t => String(t.id) === cible);""",
"""                                } else if (a === 'corriger' || a === 'retirer') {
                                    //  v37.59 : l'import décalé — l'opération du journal reprend son vrai libellé, ou en sort
                                    const s = _seauDeTx(Number(cible)) || _seauDeTx(cible);
                                    const tx = s && s.arr[s.i];
                                    if (l.decale) _oublierOpBanque(l.decale.h);
                                    if (tx && a === 'corriger') {
                                        tx.libelle = l.marchand; tx.banqueLibelle = l.op.libelle; tx.banqueMarchand = bqLibNorm(l.marchand); tx.banqueHash = l.hash;
                                        if (tx.categorieSource !== 'vous') {
                                            const r = l.cat || categoriserLibelle(l.marchand);
                                            tx.categorieId = r.id || 'cat_misc'; tx.categorieSource = r.id ? (r.source || 'règle') : undefined;
                                            if (!r.id) delete tx.categorieSource;
                                            if (r.statut === 'sur') delete tx.aVerifier; else tx.aVerifier = true;
                                        }
                                        _enregistrerOp(cap.compteId, l, 'ajoutee', { x: tx.id });
                                        st.corrigees++;
                                    } else {
                                        if (tx) { s.arr.splice(s.i, 1); st.retirees++; }
                                        _enregistrerOp(cap.compteId, l, 'ignoree', { r: (l.raison || '') + ' — retirée (import décalé)' });
                                    }
                                } else if (a === 'deja') {
                                    const tx = _toutesTx().find(t => String(t.id) === cible);""")

# 9. La revue : le badge, le résumé, le bilan
sub('badge',
"""                                        <template v-else>
                                            <span v-if="l.type === 'gab'" data-import-badge="gab\"""",
"""                                        <template v-else>
                                            <span v-if="l.decale" data-import-badge="decale" class="text-[10px] font-black px-2 py-0.5 rounded-full bg-orange-50 text-orange-800 border border-orange-300" :title="'Importée le ' + String(l.decale.t || '').slice(8, 10) + '/' + String(l.decale.t || '').slice(5, 7) + ' avec le libellé de la ligne voisine'">✏️ Importée sous « {{ l.decale.l }} »</span>
                                            <span v-else-if="l.type === 'gab'" data-import-badge="gab\"""")

sub('résumé texte',
"""                            {{ resumeImportBanque.ajouter }} à ajouter ({{ resumeImportBanque.suspens }} en suspens) · """,
"""                            <template v-if="resumeImportBanque.corriger || resumeImportBanque.retirer"><b class="text-orange-800">✏️ {{ resumeImportBanque.corriger }} à corriger · {{ resumeImportBanque.retirer }} à retirer (import décalé)</b> · </template>{{ resumeImportBanque.ajouter }} à ajouter ({{ resumeImportBanque.suspens }} en suspens) · """)

sub('bilan',
"""                        <li>✓ {{ importBanque.resume.deja }} déjà dans le journal</li>""",
"""                        <li v-if="importBanque.resume.corrigees || importBanque.resume.retirees" data-import-fini-decale>✏️ {{ importBanque.resume.corrigees }} opération(s) corrigée(s), {{ importBanque.resume.retirees }} retirée(s) du journal (import décalé)</li>
                        <li>✓ {{ importBanque.resume.deja }} déjà dans le journal</li>""")

# 10. Exposé pour les tests
sub('export',
"""bqAnalyserOCR, bqMemeCompte, bqRibValide, rattacherTicketsALaLigne, ocrCapture,""",
"""bqAnalyserOCR, bqMemeCompte, bqRibValide, rattacherTicketsALaLigne, ocrCapture, bqTexteParRangees: _texteParRangees,""")

# 11. L'ANTI-DOUBLON COMPARE LE COMMERÇANT : « PAIEMENT CB 18 10 26 MCDO » et « PAIEMENT CB 18 10 26 Carrefour »
#     partagent leurs 16 premiers signes — ils passaient pour la même opération (même jour, même montant :
#     « déjà traitée », le vrai achat jamais ajouté). Le préfixe de la banque et la date d'achat ne comptent plus.
sub('proche',
"""                    const bqLibProche = (a, b) => {
                        if (!a || !b) return false;
                        if (a === b || a.includes(b) || b.includes(a) || a.slice(0, 10) === b.slice(0, 10)) return true;""",
"""                    const _bqCoeur = (s) => String(s || '').replace(/^(paiement|paiment|achat|pmt|reglement)(par)?(cb|carte|tpe|internet|mobile)?\\d{0,6}/, '')
                        .replace(/^(virweb|virinst|vir)(de|emis|recu)?/, '');
                    const bqLibProche = (a0, b0) => {
                        if (!a0 || !b0) return false;
                        if (a0 === b0) return true;
                        //  v37.59 : le commerçant, sans « PAIEMENT CB 18 10 26 » (commun à tous les paiements par carte)
                        const ca = _bqCoeur(a0), cb = _bqCoeur(b0);
                        const [a, b] = ca.length >= 3 && cb.length >= 3 ? [ca, cb] : [a0, b0];
                        if (a === b || a.includes(b) || b.includes(a) || a.slice(0, 10) === b.slice(0, 10)) return true;""")

# 12. Le commerçant sans la date d'achat collée (« PAIEMENT CB 17 10 26 Carrefour ( » → « Carrefour »)
sub('marchand',
"""                        .replace(/\\b\\d{1,2}[\\/.-]\\d{1,2}[\\/.-]\\d{2,4}\\b/g, ' ').replace(/\\(\\*\\)|\\.{2,}|…/g, ' ').replace(/\\s+/g, ' ').trim() || String(op.libelle || '').trim();""",
"""                        .replace(/\\b\\d{1,2}[\\/.-]\\d{1,2}[\\/.-]\\d{2,4}\\b/g, ' ').replace(/\\(\\*\\)|\\.{2,}|…/g, ' ')
                        .replace(/^\\s*\\d{2} ?\\d{2} ?\\d{2}(?!\\d)\\s*/, '').replace(/[\\s(\\-.,;:]+$/, '')   // v37.59 : « 17 10 26 Carrefour ( »
                        .replace(/\\s+/g, ' ').trim() || String(op.libelle || '').trim();""")

io.open(F, 'w', encoding='utf-8').write(src)
print('✔ v37.59 Rangees : rangées de l’écran, anti-doublon par commerçant, imports décalés réparés')
