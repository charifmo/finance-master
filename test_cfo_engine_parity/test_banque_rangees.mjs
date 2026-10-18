/**
 * v37.59 — CHAQUE MONTANT SUR SA LIGNE.
 *   « Attention gros décalage entre la capture et le résultat interprété par l'appli, revois ça en urgence. »
 *   Attijari Mobile, écran « Compte chèque » : l'OCR a lu la colonne des 11 libellés, PUIS celle des 11 montants ;
 *   recollés dans l'ordre (le premier libellé, sous « Remonter », écarté ; l'écran lu « date d'abord »), chaque
 *   montant glissait d'une ligne. Identité, opérations et montants FICTIFS (banque/attijari_compte.*).
 *   Dimanche 18 oct. 2026.
 *     A. statique · B. les rangées de l'écran (l'OCR lit par colonnes) · C. le texte que l'OCR a vraiment rendu
 *     (colonnes séparées) · D. le VRAI OCR sur la maquette (pleine résolution et WhatsApp) · E. les imports
 *     décalés réparés (corriger, retirer, sans voler l'opération d'une autre) · F. un écran inconnu.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..');
const BQ = path.join(ICI, 'banque');
const html = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8').split('\r\n').join('\n');

let ko = 0;
const v = (t, ok, d = '') => { if (!ok) ko++; console.log(`  ${ok ? '✅' : '❌'} ${t.padEnd(64)} ${ok ? '' : d}`); };
const section = async (nom, f) => { try { await f(); } catch (e) { v(`${nom} : exécution sans exception`, false, String(e && e.stack || e).slice(0, 300)); } };
console.log('\n  BANQUE : CHAQUE MONTANT SUR SA LIGNE\n  ' + '─'.repeat(80));

v('A. l\'OCR range chaque ligne lue à sa HAUTEUR sur la capture avant toute analyse',
  /const _texteParRangees = \(data\) =>/.test(html) && /let texte = _texteParRangees\(data\);/.test(html));
v('  → l\'anti-doublon compare le COMMERÇANT, sans « PAIEMENT CB 18 10 26 » (commun à tous les paiements par carte)',
  /const _bqCoeur = /.test(html));
v('  → la maquette est fictive (TESTEUR KARIM) : aucune vraie capture dans le dépôt',
  /TESTEUR KARIM/.test(fs.readFileSync(path.join(BQ, 'attijari_compte.html'), 'utf8')) && !fs.readdirSync(BQ).some(f => /\.jpe?g$/i.test(f)));
const require = createRequire(import.meta.url);
const essai = (f) => { try { return f(); } catch { return null; } };
const pw = essai(() => require('playwright-core'));
const vueJs = essai(() => require.resolve('vue/dist/vue.global.js'));
const chartJs = essai(() => fs.existsSync(path.join(RACINE, 'node_modules/chart.js/dist/chart.umd.js'))
                           && path.join(RACINE, 'node_modules/chart.js/dist/chart.umd.js'));
const chromium = process.env.CHROMIUM || ['/opt/pw-browsers/chromium']
    .find(p => essai(() => fs.existsSync(p) && fs.statSync(p).isFile()));
if (!pw || !vueJs || !chartJs || !chromium) {
    console.log('  ⏭️  partie navigateur ignorée (playwright-core, vue, chart.js ou Chromium absent)');
    console.log(ko === 0 ? '  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `  ❌ ${ko} contrôle(s) en échec`);
    process.exit(ko === 0 ? 0 : 1);
}

/* ── Le décor : vos 6 comptes, le Pilotage (factures, loyer, virement Assafa) ─ */
const CC = 'acc_cc', URGENCE = 1786532576196, ASSAFA = 1790780761917;
const fixture = () => {
    const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8'));
    const base = fx.donneesAnnuelles[Object.keys(fx.donneesAnnuelles)[0]];
    fx.donneesAnnuelles = {};
    for (const an of [2026, 2027]) fx.donneesAnnuelles[an] = JSON.parse(JSON.stringify(base));
    Object.assign(fx.soldesInitiaux, { moisActuel: 10, anneeActuelle: 2026, jourDePaie: 27, compteChargesFixes: 'courant', compteChargesVariables: 'courant',
                                       assurances_tracker: [], voyageDebut: '', voyageFin: '' });
    fx.soldesInitiaux.categories = [];
    fx.comptes = [
        { id: CC, label: 'Compte Courant', type: 'liquide', solde: 6300, icone: '💳' },
        { id: 'acc_lt', label: 'Épargne Long Terme', type: 'epargne', solde: 39000, icone: '🎯' },
        { id: URGENCE, label: 'Compte urgence', type: 'liquide', solde: 5000 },
        { id: ASSAFA, label: 'Compte Principale ASSAFA', type: 'liquide', solde: 1580 },
    ];
    const neutre = { paye: false, montantPaye: 0, exceptions: [], showExceptions: false };
    const L = (nom, montant, periode) => ({ nom, montant, ...(periode ? { periode } : {}) });
    for (const an of Object.keys(fx.donneesAnnuelles)) {
        const d = fx.donneesAnnuelles[an];
        const Rv = (label, b, j) => ({ ...neutre, label, base: b, jourPrevu: j, destinationCompte: 'courant' });
        d.revenus = { salaire: Rv('SALAIRE', 20000, 27), magasin: Rv('Loyer magasin', 5000, 3), bonif: Rv('—', 0), cnss: Rv('—', 0), appart: Rv('—', 0), studio: Rv('—', 0) };
        const Fx = (label, valeur) => ({ ...neutre, label, valeur, jourPrevu: null });
        d.chargesFixes = { creditImmo: Fx('Crédit Immo + Assur', 5000), creditStudio: Fx('—', 0), syndic: Fx('Syndic', 300), nounou: Fx('Nounou', 2500),
                           ecole: Fx('École', 1500), femmeMenage: Fx('—', 0), habitsCharif: Fx('—', 0), habitsBebe: Fx('—', 0), jouets: Fx('—', 0) };
        const V = (label, valeur, periode, details) => ({ ...neutre, label, valeur, periode, details });
        d.chargesVariables = {
            alimentation: V('Alimentation (Tqdya)', 0, 'semaine', [L('khdra', 200), L('Marjane ', 400)]),
            sorties: V('Sorties', 0, 'semaine', [L('cafe Resto Wknd', 400)]),
            voiture: V('Voiture', 0, 'semaine', [L('essence picanto', 300)]),
            sante: V('—', 0, 'semaine', []),
            factures: { ...V('Factures', 1399, 'mois', [L('elect', 200), L('elect marrakech villa', 800), L('tel', 99), L('eau', 300)]), categorieId: 'cat_cv_factures' },
        };
        d.epargne = []; d.depensesIrregulieres = []; d.consoRealiseeT0 = {};
        d.virementsInternes = an !== '2026' ? [] : [{ id: 9001, mois: 10, jourPrevu: 8, sourceCompte: 'cpt_' + ASSAFA, destinationCompte: 'courant', montant: 2200 }];
        d.transactionsReelles = [];
    }
    return fx;
};
const page0 = html
    .replace('<script src="https://unpkg.com/vue@3/dist/vue.global.js"', '<script src="/vue.js"')
    .replace('<script src="https://cdn.jsdelivr.net/npm/chart.js"', '<script src="/chart.js"')
    .replace(/<script src="https:\/\/cdn\.tailwindcss\.com"[^>]*><\/script>/, '')
    .replace(/<script[^>]*src="https:\/\/[^"]*"[^>]*><\/script>/g, '');
//  Le téléphone a besoin des vraies classes (positions des boutons flottants, largeurs) : Tailwind compilé si présent
const twBin = path.join(RACINE, 'node_modules/.bin/tailwindcss');
let twCss = '';
if (fs.existsSync(twBin)) {
    const { execFileSync } = await import('node:child_process');
    const tmp = fs.mkdtempSync(path.join((await import('node:os')).tmpdir(), 'tw-bq-'));
    fs.writeFileSync(path.join(tmp, 'in.css'), '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
    fs.writeFileSync(path.join(tmp, 'cfg.js'), 'module.exports={content:[' + JSON.stringify(path.join(RACINE, 'index.html')) + '],theme:{extend:{}}};');
    essai(() => execFileSync(twBin, ['-c', path.join(tmp, 'cfg.js'), '-i', path.join(tmp, 'in.css'), '-o', path.join(tmp, 'out.css'), '--minify'], { stdio: 'ignore' }));
    twCss = essai(() => fs.readFileSync(path.join(tmp, 'out.css'), 'utf8')) || '';
}
const TYPES = { '.js': 'text/javascript', '.gz': 'application/gzip', '.wasm': 'application/wasm' };
const srv = http.createServer((req, res) => {
    const p = req.url.split('?')[0];
    const s = (c, b, t = 'application/json') => { res.writeHead(c, { 'Content-Type': t }); res.end(b); };
    if (p === '/finance/') return s(200, twCss ? page0.replace('</head>', '<link rel="stylesheet" href="/tw.css"></head>') : page0, 'text/html; charset=utf-8');
    if (p === '/tw.css') return s(200, twCss, 'text/css');
    if (p === '/vue.js') return s(200, fs.readFileSync(vueJs), 'text/javascript');
    if (p === '/chart.js') return s(200, fs.readFileSync(chartJs), 'text/javascript');
    if (p === '/finance/finance_data.json') return s(200, JSON.stringify(fixture()));
    if (p.startsWith('/finance/vendor/')) {
        const f = path.join(RACINE, decodeURIComponent(p.slice('/finance/'.length)));
        return fs.existsSync(f) ? s(200, fs.readFileSync(f), TYPES[path.extname(f)] || 'application/octet-stream') : s(404, 'absent', 'text/plain');
    }
    return s(200, '{"status":"ok"}');
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port;
const browser = await pw.chromium.launch({ executablePath: chromium, args: ['--no-sandbox'] });
const ST = 'document.querySelector("#app").__vue_app__._instance.setupState';
const erreurs = [], externes = [];
const ouvrirPage = async (opts) => {
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    await page.clock.setFixedTime(new Date(2026, 9, 18, 21, 15, 0));
    page.on('pageerror', e => erreurs.push(String(e)));
    page.on('dialog', d => d.accept());
    page.on('request', r => { const u = r.url(); if (!u.startsWith('http://127.0.0.1') && !u.startsWith('blob:') && !u.startsWith('data:')) externes.push(u); });
    await page.route('**/webhook/**', route => route.abort());
    await page.goto(`http://127.0.0.1:${port}/finance/`, { waitUntil: 'load' });
    await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState.moisBudgetaire; }, null, { timeout: 30000 });
    await page.waitForTimeout(600);
    await page.evaluate(async (ST) => { const st = eval(ST); st.appMode = 'reel'; await new Promise(r => setTimeout(r, 250)); st.activeTab = 'saisie'; }, ST);
    await page.waitForTimeout(500);
    return page;
};
const page = await ouvrirPage({ viewport: { width: 1300, height: 1000 } });
const AUJ = 'new Date(2026, 9, 18)';
const analyser = (...textes) => page.evaluate(({ ST, textes, AUJ }) => { const st = eval(ST), a = eval(AUJ);
    return JSON.parse(JSON.stringify(textes.length > 1 ? st.bqAnalyserOCR(textes, { aujourdhui: a }) : st.bqAnalyser(textes[0], { aujourdhui: a }))); }, { ST, textes, AUJ });
const ops = (a) => a.operations.map(o => [o.dateOp, o.dateAchat || '', o.montant, o.libelle].join(' | '));

//  La capture fictive : 11 opérations, le bouton « Remonter » posé sur la première
const ATTENDU = [
    ['2026-10-18', -400, /^AWBGAB/], ['2026-10-18', -163.4, /Carrefou/], ['2026-10-18', -31.5, /MCDO A/], ['2026-10-18', -72, /MCDO A/],
    ['2026-10-18', -214.8, /PHCIE/], ['2026-10-17', 600, /^VIR WEB DE TESTEUR/], ['2026-10-17', -119.99, /^G2ABVSHOP/], ['2026-10-17', -58, /YA TOP/],
    ['2026-10-17', -147.25, /MARJ/], ['2026-10-17', -44, /C TOP/], ['2026-10-17', -250, /AFRQ/],
];
const conforme = (a) => a.operations.length === ATTENDU.length && ATTENDU.every(([d, m, re], i) => { const o = a.operations[i]; return o && o.dateOp === d && o.montant === m && re.test(o.libelle); });
const ecarts = (a) => a.operations.map((o, i) => [o.dateOp, o.montant, o.libelle, ATTENDU[i] && ATTENDU[i][2].test(o.libelle) && ATTENDU[i][1] === o.montant ? 'ok' : '✖']);
//  Ce que l'OCR a VRAIMENT rendu sur l'écran « Compte chèque » (structure réelle, contenu fictif) : la colonne
//  des libellés et des dates, puis la barre du bas, puis la colonne des montants
const LIBS = ['AWBGAB OX 1 Remonter 28', 'PAIEMENT CB 18 10 26 Carrefour (...', 'PAIEMENT CB 1810 26 MCDO ARR...', 'PAIEMENT CB 1810 26 MCDO AR...',
              'PAIEMENT CB18 10 26 PHCIE CE...', 'VIR WEB DE TESTEUR KARIM (*)', 'G2ABVSHOP', 'PAIEMENT CB 15/10/26 YA TOP B.….', 'PAIEMENT CB 15/10/26 MARJ MA...',
              'PAIEMENT CB 15/10/26 C TOP', 'PAIEMENT CB 17 10 26 AFRQ D A.'];
const DATES = ['18 oct. 2026', '18 oct. 2026', '18 oct. 2026', '18 oct. 2026', '18 oct. 2026', '17 oct. 2026', '17 oct. 2026', '17 oct. 2026', '17 oct. 2026', '17 oct. 2026', '17 oct. 2026'];
const MONTANTS = ['-400,00 DH', '-163,40 DH', '-31,50 DH', '-72,00 DH', '-214,80 DH', '+600,00 DH', '-119,99 DH', '-58,00 DH', '-147,25 DH', '-44,00 DH', '-250,00 DH'];
const COLONNES = ['21:12 & © & »', '', '[7', '', 'A', '', 'Accueil', '', 'Compte chèque', '2 418,35 DH ©', '',
    ...LIBS.flatMap((l, i) => [l, DATES[i], '']), '5 =', '', 'Comptes                               Cartes', '', "'H      O", '', 'Ni SE all €', '', 'v Q', '',
    ...MONTANTS, '', 'Oo', 'oo', '', 'Menu', '', '<  x'].join('\n');
//  Les lignes de Tesseract (data.lines), dans l'ordre où il les rend : la colonne de gauche puis celle de droite
const lignesOCR = (perdre = []) => {
    const out = [];
    LIBS.forEach((l, i) => { const y = 300 + i * 150; if (!perdre.includes(i)) out.push({ text: l + '\n', bbox: { x0: 140, y0: y, x1: 660, y1: y + 42 } });
                             out.push({ text: DATES[i] + '\n', bbox: { x0: 140, y0: y + 55, x1: 420, y1: y + 95 } }); });
    MONTANTS.forEach((m, i) => { const y = 300 + i * 150 + 2; out.push({ text: m + '\n', bbox: { x0: 690, y0: y, x1: 880, y1: y + 40 } }); });
    return [{ text: 'Compte chèque\n', bbox: { x0: 240, y0: 120, x1: 580, y1: 165 } }, { text: '2 418,35 DH ©\n', bbox: { x0: 260, y0: 180, x1: 540, y1: 225 } }, ...out,
            { text: 'Accueil\n', bbox: { x0: 40, y0: 2040, x1: 140, y1: 2075 } }, { text: 'Comptes\n', bbox: { x0: 200, y0: 2040, x1: 340, y1: 2075 } }];
};
const rangees = (perdre) => page.evaluate(({ ST, lignes }) => eval(ST).bqTexteParRangees({ text: lignes.map(l => l.text).join(''), lines: lignes }), { ST, lignes: lignesOCR(perdre) });

try {
    await section('B', async () => {
        const t = await rangees([]);
        v('B. l\'OCR rend la colonne des libellés puis celle des montants : chaque montant revient sur la ligne de SON libellé',
          /^AWBGAB OX 1 Remonter 28\t-400,00 DH$/m.test(t) && /^PAIEMENT CB 18 10 26 Carrefour \(\.\.\.\t-163,40 DH$/m.test(t) && /^VIR WEB DE TESTEUR KARIM \(\*\)\t\+600,00 DH$/m.test(t), t.slice(0, 400));
        const a = await analyser(t);
        v('  → et l\'analyse est juste : 11 opérations, chaque montant avec son libellé et sa date', conforme(a), JSON.stringify(ecarts(a)));
        const t2 = await rangees([0]);
        const a2 = await analyser(t2);
        v('  → le premier libellé PERDU (sous « Remonter ») ne décale plus rien : « Carrefour −163,40 », pas « −400 »',
          a2.operations.length === 10 && a2.operations[0].montant === -163.4 && /Carrefour/.test(a2.operations[0].libelle)
          && a2.operations.every((o, i) => ATTENDU[i + 1][1] === o.montant && ATTENDU[i + 1][2].test(o.libelle) && ATTENDU[i + 1][0] === o.dateOp), JSON.stringify(a2.operations.map(o => [o.montant, o.libelle])));
    });
    await section('C', async () => {
        const a = await analyser(COLONNES);
        v('C. le texte en colonnes que l\'OCR a vraiment rendu : reconnu Attijari (« Compte chèque »), lu libellé d\'abord',
          a.banque === 'attijari' && a.format === 'attijari_mobile' && a.soldes.compteCheque === 2418.35, JSON.stringify([a.banque, a.format, a.soldes]));
        v('  → 11 opérations, AUCUN décalage (Carrefour −163,40, PHCIE −214,80, VIR WEB +600, G2ABVSHOP −119,99…)', conforme(a), JSON.stringify(ecarts(a)));
        v('  → « Remonter » n\'est pas un libellé ; le bout de barre d\'état (« Ni SE all € ») n\'est pas une opération',
          !a.operations.some(o => /remonter|Ni SE/i.test(o.libelle)), JSON.stringify(a.operations.map(o => o.libelle)));
        v('  → « PAIEMENT CB18 10 26 PHCIE » : la date d\'achat collée à « CB » est lue', a.operations[4] && a.operations[4].dateAchat === '2026-10-18', JSON.stringify(a.operations[4]));
        const b = await analyser('Compte chèque\n1 000,00 DH\n2) PAIEMENT CB 18 10 26 BIM SAFI\t-12,00 DH\n18 oct. 2020');
        v('  → l\'icône ↗ lue « 2) » n\'entre pas dans le libellé ; « 18 oct. 2020 » (l\'année abîmée sous le bouton) → 2026',
          b.operations.length === 1 && b.operations[0].libelle === 'PAIEMENT CB 18 10 26 BIM SAFI' && b.operations[0].dateOp === '2026-10-18', JSON.stringify(b.operations));
    });
    await section('D', async () => {
        if (process.env.BQ_SANS_OCR) return;   // les mutants de logique sautent l'OCR (long)
        for (const [f, nom] of [['attijari_compte.png', 'pleine résolution'], ['attijari_compte_whatsapp.png', 'WhatsApp (462 px)']]) {
            await page.evaluate((ST) => eval(ST).ouvrirImportBanque(), ST); await page.waitForTimeout(200);
            await page.setInputFiles('[data-import-fichiers]', [path.join(BQ, f)]);
            await page.click('[data-import-analyser]');
            await page.waitForFunction((ST) => { const s = eval(ST).importBanque; return s.etape === 'revue' || (s.etape === 'depot' && !s.enCours); }, ST, { timeout: 300000 });
            const a = await page.evaluate((ST) => JSON.parse(JSON.stringify(eval(ST).importBanque.captures[0].analyse)), ST);
            v(`D. le VRAI OCR, ${nom} : 11 opérations, chaque montant face à son libellé, dates justes`, conforme(a), JSON.stringify(ecarts(a)));
            v('  → aucune icône dans les libellés (« 2) » / « 7) » pour ↗), aucune année lue de travers (2020)',
              a.operations.every(o => !/^\d\)/.test(o.libelle) && /^2026-/.test(o.dateOp)), JSON.stringify(a.operations.map(o => [o.dateOp, o.libelle])));
            await page.evaluate((ST) => eval(ST).fermerImportBanque(), ST);
        }
    });
    await section('E', async () => {
        //  L'import décalé de la v37.58, tel qu'il est dans vos données : chaque montant (et sa date) sous le libellé suivant
        const r = await page.evaluate(async ({ ST, CC }) => {
            const st = eval(ST), d = st.donneesAnnuelles[2026];
            const N = (s) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]/g, '').slice(0, 32);
            d.transactionsReelles = [
                { id: 7001, date: '2026-10-18', mois: 10, libelle: '18 10 26 Carrefour (', montant: 400, categorieId: 'cat_cv_alimentation', categorieSource: 'règle', compteId: CC, source: 'banque', banqueHash: 'bqold01', banqueMarchand: N('18 10 26 Carrefour (') },
                { id: 7002, date: '2026-10-18', mois: 10, libelle: '18 10 26 MCDO ARR', montant: 163.4, categorieId: 'cat_cv_sorties', categorieSource: 'règle', compteId: CC, source: 'banque', banqueHash: 'bqold02', banqueMarchand: N('18 10 26 MCDO ARR') },
                { id: 7003, date: '2026-10-17', mois: 10, libelle: '15/10/26 YA TOP B', montant: 119.99, categorieId: 'cat_cv_sorties', categorieSource: 'vous', compteId: CC, source: 'banque', banqueHash: 'bqold03', banqueMarchand: N('15/10/26 YA TOP B') },
                { id: 7004, date: '2026-10-17', mois: 10, libelle: 'courses', montant: 80, categorieId: 'cat_cv_alimentation', compteId: CC, source: 'manuel' },
            ];
            const E = (h, dt, m, l, s, x) => [h, { c: CC, d: dt, m, l: N(l), s, t: '2026-10-16', ...(x ? { x } : {}) }];
            d.banqueOperations = Object.fromEntries([
                E('bqold01', '2026-10-18', -400, 'PAIEMENT CB 18 10 26 Carrefour (', 'ajoutee', 7001),
                E('bqold02', '2026-10-18', -163.4, 'PAIEMENT CB 1810 26 MCDO ARR', 'ajoutee', 7002),
                E('bqold04', '2026-10-18', -214.8, 'VIR WEB DE TESTEUR KARIM', 'ignoree'),
                E('bqold05', '2026-10-17', 600, 'G2ABVSHOP', 'ignoree'),
                E('bqold03', '2026-10-17', -119.99, 'PAIEMENT CB 15/10/26 YA TOP B', 'ajoutee', 7003),
            ]);
            st.calculationTick++;
            st.ouvrirImportBanque();
            return true;
        }, { ST, CC });
        await page.evaluate(({ ST, COLONNES }) => { eval(ST).importBanque.texte = COLONNES; }, { ST, COLONNES });
        await page.evaluate((ST) => eval(ST).analyserImportBanque(), ST);
        await page.waitForFunction((ST) => eval(ST).importBanque.etape === 'revue', ST, { timeout: 30000 });
        await page.evaluate(async ({ ST, CC }) => { const st = eval(ST), cap = st.importBanque.captures[0];
            if (!cap.compteId) { cap.reponse.compteId = CC; st.repondreCompteCapture(cap); } await new Promise(r => setTimeout(r, 200)); }, { ST, CC });
        const L = await page.evaluate((ST) => JSON.parse(JSON.stringify(eval(ST).importBanque.captures[0].lignes.map(l => [l.op.montant, l.op.libelle.slice(0, 26), l.type, l.action, l.decale && l.decale.l]))), ST);
        const lg = (m) => L.find(l => l[0] === m) || [];
        v('E. l\'ancien import décalé est reconnu : « Carrefour » −400 était le RETRAIT → « 🗑 Retirer » du journal',
          lg(-400)[2] === 'gab' && lg(-400)[3] === 'retirer:7001', JSON.stringify(lg(-400)));
        v('  → le vrai Carrefour (−163,40), importé sous « MCDO » → « ✏️ Corriger », pas un 2e ajout', lg(-163.4)[3] === 'corriger:7002' && /MCDO/.test(lg(-163.4)[4] || ''), JSON.stringify(lg(-163.4)));
        v('  → la pharmacie (−214,80), ignorée à tort comme « VIR WEB » : enfin proposée au journal', /^(ajouter|pointer)/.test(lg(-214.8)[3] || '') && lg(-214.8)[2] === 'achat', JSON.stringify(lg(-214.8)));
        v('  → le virement reçu (+600) reste un virement ignoré', lg(600)[2] === 'virement' && lg(600)[3] === 'ignorer', JSON.stringify(lg(600)));
        const m = await page.evaluate((ST) => eval(ST).importBanque.captures[0].lignes.map(l => l.marchand), ST);
        v('  → le commerçant s\'affiche sans la date d\'achat collée : « Carrefour », « PHCIE CE », pas « 18 10 26 Carrefour ( »',
          m.includes('Carrefour') && m.includes('PHCIE CE') && !m.some(x => /^\d{2} ?\d{2} ?\d{2}\b|\($/.test(x)), JSON.stringify(m));
        const badges = await page.evaluate(() => [...document.querySelectorAll('[data-import-badge="decale"]')].map(b => b.textContent.trim()));
        const resume = await page.textContent('[data-import-resume]');
        v('  → la revue le dit : « ✏️ Importée sous « … » », « 2 à corriger · 1 à retirer (import décalé) »',
          badges.length === 3 && /2 à corriger · 1 à retirer \(import décalé\)/.test(resume), JSON.stringify([badges, resume]));
        await page.click('[data-import-appliquer]'); await page.waitForTimeout(300);
        const apres = await page.evaluate((ST) => { const st = eval(ST), d = st.donneesAnnuelles[2026];
            return JSON.parse(JSON.stringify({ tx: d.transactionsReelles.map(t => [t.id, t.libelle, t.montant, t.categorieId, t.categorieSource || '']), reg: Object.keys(d.banqueOperations), fini: (document.querySelector('[data-import-fini-decale]') || {}).textContent || '' })); }, ST);
        const t = (id) => apres.tx.find(x => x[0] === id);
        v('  → appliqué : le faux « Carrefour 400 » est retiré ; « MCDO 163,40 » devient « Carrefour (SAFI…) »',
          !t(7001) && t(7002) && /Carrefour/.test(t(7002)[1]) && t(7002)[2] === 163.4, JSON.stringify(apres.tx));
        v('  → une catégorie choisie par VOUS est gardée (G2ABVSHOP, ex-« YA TOP », reste dans la vôtre)', t(7003) && /G2ABVSHOP/.test(t(7003)[1]) && t(7003)[3] === 'cat_cv_sorties' && t(7003)[4] === 'vous', JSON.stringify(t(7003)));
        v('  → votre saisie manuelle n\'est pas touchée ; aucune opération en double', t(7004) && t(7004)[1] === 'courses' && apres.tx.filter(x => x[2] === 163.4).length === 1 && apres.tx.filter(x => x[2] === 119.99).length === 1, JSON.stringify(apres.tx));
        v('  → les anciennes empreintes décalées sont oubliées, les justes enregistrées', !apres.reg.includes('bqold01') && !apres.reg.includes('bqold02') && !apres.reg.includes('bqold03') && apres.reg.length >= 11, JSON.stringify(apres.reg));
        v('  → le bilan le dit', /1 opération\(s\) corrigée|2 opération\(s\) corrigée/.test(apres.fini) && /1 retirée/.test(apres.fini), apres.fini);
        //  Réimporter la même capture : tout est déjà traité, rien ne bouge
        await page.evaluate(({ ST, COLONNES }) => { const st = eval(ST); st.ouvrirImportBanque(); st.importBanque.texte = COLONNES; }, { ST, COLONNES });
        await page.evaluate((ST) => eval(ST).analyserImportBanque(), ST);
        await page.waitForFunction((ST) => eval(ST).importBanque.etape === 'revue', ST, { timeout: 30000 });
        const re = await page.evaluate((ST) => JSON.parse(JSON.stringify(eval(ST).importBanque.captures[0].lignes.map(l => [l.op.montant, l.action, !!l.dejaTraitee]))), ST);
        v('  → réimporter la même capture : les 11 lignes « déjà traitées », rien à corriger', re.length === 11 && re.every(x => x[2]), JSON.stringify(re));
        await page.evaluate((ST) => eval(ST).fermerImportBanque(), ST);
    });
    await section('E2', async () => {
        //  Deux achats de 72,00 DH le même jour : celui déjà importé à l'identique ne se fait pas « voler » son empreinte
        const MEME = ['Compte chèque', '1 000,00 DH', 'PAIEMENT CB 18 10 26 BIM SAFI\t-72,00 DH', '18 oct. 2026', 'PAIEMENT CB 18 10 26 MCDO ARRIVEE 2\t-72,00 DH', '18 oct. 2026', 'Accueil Comptes Cartes Menu'].join('\n');
        await page.evaluate(({ ST, CC }) => { const st = eval(ST), d = st.donneesAnnuelles[2026];
            const lignes = st.bqAnalyser(['Compte chèque', '1 000,00 DH', 'PAIEMENT CB 18 10 26 MCDO ARRIVEE 2\t-72,00 DH', '18 oct. 2026'].join('\n'), { aujourdhui: new Date(2026, 9, 18) }).operations;
            d.transactionsReelles = [{ id: 7010, date: '2026-10-18', mois: 10, libelle: 'MCDO ARRIVEE 2', montant: 72, categorieId: 'cat_cv_sorties', compteId: CC, source: 'banque' }];
            d.banqueOperations = {};
            const h = st.bqHash(CC, lignes[0]);
            d.banqueOperations[h] = { c: CC, d: '2026-10-18', m: -72, l: lignes[0].libelle.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 32), s: 'ajoutee', t: '2026-10-16', x: 7010 };
            st.calculationTick++; st.ouvrirImportBanque(); }, { ST, CC });
        await page.evaluate(({ ST, MEME }) => { eval(ST).importBanque.texte = MEME; }, { ST, MEME });
        await page.evaluate((ST) => eval(ST).analyserImportBanque(), ST);
        await page.waitForFunction((ST) => eval(ST).importBanque.etape === 'revue', ST, { timeout: 30000 });
        await page.evaluate(async ({ ST, CC }) => { const st = eval(ST), cap = st.importBanque.captures[0];
            if (!cap.compteId) { cap.reponse.compteId = CC; st.repondreCompteCapture(cap); } await new Promise(r => setTimeout(r, 200)); }, { ST, CC });
        const L = await page.evaluate((ST) => JSON.parse(JSON.stringify(eval(ST).importBanque.captures[0].lignes.map(l => [l.op.libelle, l.action, !!l.dejaTraitee, !!l.decale]))), ST);
        v('E2. deux achats de 72 DH le même jour : MCDO (déjà importé) reste « déjà traité », BIM est un NOUVEL achat — pas une « correction »',
          L.length === 2 && L.find(l => /MCDO/.test(l[0]))[2] === true && L.find(l => /BIM/.test(l[0]))[3] === false && /^(ajouter|pointer)/.test(L.find(l => /BIM/.test(l[0]))[1]), JSON.stringify(L));
        await page.evaluate((ST) => eval(ST).fermerImportBanque(), ST);
    });
    await section('F', async () => {
        //  Un écran inconnu (aucune banque reconnue), lu en colonnes, une icône lue comme un mot après la liste
        const INCONNU = ['Mon compte', 'Solde 950,00', 'Boulangerie du coin', '12/10/2026', 'Station service', '11/10/2026', 'Librairie', '10/10/2026',
                         'Zx ab €', '-12,50', '-300,00', '-45,90'].join('\n');
        const a = await analyser(INCONNU);
        v('F. écran inconnu en colonnes : chaque montant à son libellé (le bout d\'interface « Zx ab € » ne prend rien)',
          JSON.stringify(a.operations.map(o => [o.libelle, o.montant])) === '[["Boulangerie du coin",-12.5],["Station service",-300],["Librairie",-45.9]]', JSON.stringify(a.operations.map(o => [o.dateOp, o.libelle, o.montant])));
    });
    v('aucune erreur JavaScript', erreurs.length === 0, erreurs.slice(0, 3).join(' | '));
} finally {
    await browser.close();
    srv.close();
}
console.log('  ' + '─'.repeat(80));
console.log(ko === 0 ? '  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
