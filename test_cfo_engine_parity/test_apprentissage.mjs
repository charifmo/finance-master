/**
 * v37.60 — L'APPLICATION APPREND DE VOS CORRECTIONS.
 *   « Ajoute une option learning : si je corrige quelque chose, l'appli apprend d'après ma correction ; si je
 *   corrige une fois, on alimente un dictionnaire, ou quelque chose de plus intelligent. »
 *   Et, le 19/10 : « pourquoi les propositions sont à côté de la plaque — Google Payments et Vidange Skoda,
 *   c'est quoi la relation ? » Lundi 19 oct. 2026. Textes OCR à la structure réelle, contenu FICTIF.
 *     A. statique · B. une catégorie corrigée une fois · C. le montant départage · D. couper, oublier ·
 *     E. un nom corrigé revient à l'import · F. un choix d'import retenu · G. l'import du 19/10 (pointage,
 *     0 DH, « Remonter », captures qui se chevauchent) · H. téléphone.
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
console.log('\n  APPRENTISSAGE : UNE CORRECTION, RETENUE\n  ' + '─'.repeat(80));

v('A. « 🧠 Ce que l\'appli a appris de vous » : l\'interrupteur, les catégories, les noms, les choix d\'import, 🗑',
  ['data-apprentissage', 'data-apprentissage-actif', 'data-apprentissage-categorie', 'data-apprentissage-nom', 'data-apprentissage-action', 'data-apprentissage-oublier'].every(x => html.includes(x)));
v('  → stocké dans le document unique (parametres.apprentissage), les catégories apprises des opérations elles-mêmes',
  /p\.apprentissage = \{\}/.test(html) && /const _memoireCategories = computed/.test(html));
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
        d.epargne = []; d.depensesIrregulieres = an === '2026' ? [{ id: 7700, nom: 'Vidange Skoda', montant: 6000, mois: 10, categorieId: 'cat_cv_voiture' }] : []; d.consoRealiseeT0 = {};
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
    await page.clock.setFixedTime(new Date(2026, 9, 19, 9, 30, 0));
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
const AUJ = 'new Date(2026, 9, 19)';
const analyser = (...textes) => page.evaluate(({ ST, textes, AUJ }) => { const st = eval(ST), a = eval(AUJ);
    return JSON.parse(JSON.stringify(textes.length > 1 ? st.bqAnalyserOCR(textes, { aujourdhui: a }) : st.bqAnalyser(textes[0], { aujourdhui: a }))); }, { ST, textes, AUJ });
const ops = (a) => a.operations.map(o => [o.dateOp, o.dateAchat || '', o.montant, o.libelle].join(' | '));
const SORT = 'cat_cv_sorties', MARJ = 'cat_cv_alimentation__dmarjane', CAFE = 'cat_cv_sorties__dcafe_resto_wknd';
const J = (expr) => page.evaluate(({ ST, expr }) => { const st = eval(ST); return JSON.parse(JSON.stringify(eval(expr))); }, { ST, expr });
const cat = (lib, m) => page.evaluate(({ ST, lib, m }) => JSON.parse(JSON.stringify(eval(ST).categoriserLibelle(lib, m))), { ST, lib, m });
const tx = (id) => page.evaluate(({ ST, id }) => { const st = eval(ST); for (const d of Object.values(st.donneesAnnuelles)) { const t = (d.transactionsReelles || []).find(x => x.id === id); if (t) return JSON.parse(JSON.stringify(t)); } return null; }, { ST, id });
const attendre = (ms = 250) => page.waitForTimeout(ms);
const T = (id, date, libelle, montant, categorieId, categorieSource, extra = {}) => ({ id, datetime: date + 'T12:00', date, mois: Number(date.slice(5, 7)), libelle, montant, categorieId, categorieSource, compteId: CC, source: 'manuel', ...extra });
const poser = (liste) => page.evaluate(async ({ ST, liste }) => { const st = eval(ST); st.donneesAnnuelles[2026].transactionsReelles = liste; st.donneesAnnuelles[2026].banqueOperations = {};
    st.calculationTick++; st.journal.periode = 'tout'; st.journal.vue = 'date'; st.activeTab = 'saisie'; await new Promise(r => setTimeout(r, 400)); }, { ST, liste });
const corriger = async (id, champs) => {
    await page.click(`[data-journal-ligne][data-tx="${id}"] [data-journal-ouvrir]`); await attendre();
    if (champs.libelle != null) await page.fill('[data-journal-edit-libelle]', champs.libelle);
    if (champs.cat) await page.selectOption('[data-journal-edit-cat]', champs.cat);
    await page.click('[data-journal-enregistrer]'); await attendre(350);
};
const importer = async (...textes) => {
    await page.evaluate(({ ST, texte }) => { const st = eval(ST); st.ouvrirImportBanque(); st.importBanque.texte = texte; }, { ST, texte: textes.join('\n\n') });
    await page.evaluate((ST) => eval(ST).analyserImportBanque(), ST);
    await page.waitForFunction((ST) => eval(ST).importBanque.etape === 'revue', ST, { timeout: 30000 });
    await page.evaluate(async ({ ST, CC }) => { const st = eval(ST);
        for (const cap of st.importBanque.captures) if (!cap.compteId) { cap.reponse.compteId = CC; st.repondreCompteCapture(cap); }
        await new Promise(r => setTimeout(r, 250)); }, { ST, CC });
    return page.evaluate((ST) => JSON.parse(JSON.stringify(eval(ST).importBanque.captures.flatMap(c => (c.lignes || []).map(l => ({ date: l.op.date, m: l.op.montant, lib: l.op.libelle, marchand: l.marchand,
        type: l.type, action: l.action, appris: l.appris, doublon: l.doublon, cat: l.cat && l.cat.id, statut: l.cat && l.cat.statut, cibles: l.cibles.map(c => c.libelle), deduite: !!l.op.dateDeduite }))))), ST);
};
//  Les deux captures du 19/10, telles que l'OCR les rend (rangées), contenu fictif : le haut de la liste, puis le bas
//  (le bouton « Remonter » posé sur la date de la première ligne ; trois lignes en commun)
const HAUT = ['09:25\tL\'aat|K 82', '[4          Compte chèque\tv Q', '2418,35 DH ©', 'Octobre 2026',
    '7)   PAIEMENT CB 19 10 26 MARJANE...\t-41,60 DH', '19 oct. 2026', '7)   PAIEMENT CB 18 10 26 MCDO AR...\t-31,50 DH', '18 oct. 2026',
    '7)   PAIEMENT CB 18 10 26 AFRQ D A...\t-300,00 DH', '18 oct. 2026', '7)   PAIEMENT CB1810 26 GARAGE MEGARA…\t-156,00 DH', '18 oct. 2026',
    '7)   Google MBC Shahid(*)\t-489,90 DH', '18 oct. 2026', '7)   GOOGLE PAYMENTS TEM(*)\t0,00 DH', '18 oct. 2026',
    'A æ =\tOo', 'oo', 'Accueil           Comptes                                     Cartes\tMenu', "'H      O\t<  x"].join('\n');
const BAS = ['09:25 ®,\tNi Sal @', '[7\tCompte chèque\tv Q', '2418,355DH ©', 'Google MBC &@\t-489,90 DH', 'TREN;LRR 1 Remonter',
    'PAIEMENT CB 18 10 26 GARAGE MEGARA...\t-156,00 DH', '18 oct. 2026', 'GOOGLE PAYMENTS TEM(*)\t0,00 DH', '18 oct. 2026',
    'VIR WEB DE TESTEUR KARIM (*)\t+250,00 DH', '18 oct. 2026', 'AWBGAB SALE KARIA 1710 O8H...\t-400,00 DH', '17 oct. 2026',
    'PAIEMENT CB 17 10 26 Carrefour (...\t-163,40 DH', '17 oct. 2026', 'A\t5 =\tOo', 'Accueil\tComptes                               Cartes\tMenu'].join('\n');

try {
    await section('B', async () => {
        await poser([T(9101, '2026-10-15', 'zzqx resto', 120, MARJ, 'règle'), T(9102, '2026-10-16', 'zzqx resto', 90, MARJ, 'règle'), T(9103, '2026-10-17', 'zzqx resto', 110, MARJ, 'règle')]);
        const avant = await cat('zzqx resto', 100);
        await corriger(9103, { cat: SORT });
        const apres = await cat('zzqx resto', 100);
        v('B. une catégorie corrigée UNE fois l\'emporte sur les 2 anciennes devinées : « zzqx resto » → Sorties, sûr, « votre choix »',
          avant.source !== 'vous' && apres.id === SORT && apres.statut === 'sur' && apres.source === 'vous', JSON.stringify([avant.id, apres]));
        const msg = await page.textContent('[data-journal-appris]');
        v('  → l\'appli le dit (« 🧠 Retenu ») et propose les 2 autres « zzqx resto » (90 à 120 DH)',
          /🧠 Retenu/.test(msg) && /Aussi les 2 autre\(s\) « zzqx resto » \(90 DH à 120 DH\)/.test(msg.replace(/\s+/g, ' ')), msg.replace(/\s+/g, ' '));
        await page.click('[data-journal-appris-similaires]'); await attendre();
        const t1 = await tx(9101), t2 = await tx(9102);
        v('  → un clic : les 2 autres rangées dans Sorties (« vous »)', t1.categorieId === SORT && t2.categorieId === SORT && t1.categorieSource === 'vous' && /2 autre/.test(await page.textContent('[data-journal-appris]')), JSON.stringify([t1, t2]));
    });
    await section('C', async () => {
        await poser([T(9201, '2026-10-10', 'marjane', 50, SORT, 'vous'), T(9202, '2026-10-12', 'marjane', 40, SORT, 'vous'),
                     T(9203, '2026-10-11', 'marjane', 420, MARJ, 'vous'), T(9204, '2026-10-14', 'marjane', 380, MARJ, 'vous')]);
        const petit = await cat('marjane', 45), gros = await cat('marjane', 400);
        v('C. le même libellé, rangé par vous à deux endroits : le MONTANT départage — « marjane » 45 DH → Sorties, 400 DH → Marjane',
          petit.id === SORT && petit.statut === 'sur' && /autour de 45 DH/.test(petit.raison) && gros.id === MARJ && gros.statut === 'sur' && /autour de 400 DH/.test(gros.raison), JSON.stringify([petit, gros]));
        v('  → votre choix tranche même contre une de vos lignes au même nom (« Marjane ») : pas de « à vérifier »', petit.statut === 'sur' && petit.source === 'vous');
    });
    await section('D', async () => {
        await poser([T(9301, '2026-10-17', 'zzqx resto', 110, SORT, 'vous')]);
        await page.evaluate((ST) => { const st = eval(ST); st.uiFixer('saisie.apprentissage', true); }, ST); await attendre();
        const ligne = await page.textContent('[data-apprentissage-categorie][data-cle="zzqx resto"]');
        v('D. le panneau montre la règle apprise : « zzqx resto » → Sorties', /zzqx resto/.test(ligne) && /Sorties/.test(ligne), ligne);
        await page.click('[data-apprentissage-actif]'); await attendre();
        const coupe = await cat('zzqx resto', 100);
        v('  → « Apprendre de mes corrections » décoché : la règle ne joue plus', coupe.source !== 'vous' && /apprentissage coupé/.test(await page.textContent('[data-apprentissage-compte]')), JSON.stringify(coupe));
        await page.click('[data-apprentissage-actif]'); await attendre();
        await page.click('[data-apprentissage-categorie][data-cle="zzqx resto"] [data-apprentissage-oublier]'); await attendre();
        const oublie = await cat('zzqx resto', 100);
        v('  → 🗑 l\'oublie : ce libellé n\'apprend plus rien ; « tout réapprendre » le rend', oublie.source !== 'vous' && (await J('Object.keys(st.parametres.apprentissage.oublis)')).includes('zzqx resto'), JSON.stringify(oublie));
        await page.click('[data-apprentissage-reapprendre]'); await attendre();
        v('  → (réappris)', (await cat('zzqx resto', 100)).source === 'vous');
    });
    await section('E', async () => {
        await poser([T(9401, '2026-10-17', 'MCDO ARR', 24.5, CAFE, 'règle', { source: 'banque', banqueMarchand: 'mcdoarr', banqueHash: 'bqx1', banqueLibelle: 'PAIEMENT CB 17 10 26 MCDO ARR' }),
                     T(9402, '2026-10-16', 'MCDO ARR', 30, CAFE, 'règle', { source: 'banque', banqueMarchand: 'mcdoarr', banqueHash: 'bqx2', banqueLibelle: 'PAIEMENT CB 16 10 26 MCDO ARR' })]);
        await corriger(9401, { libelle: "McDonald's", cat: SORT });
        const noms = await J('st.parametres.apprentissage.noms');
        const msg = (await page.textContent('[data-journal-appris]')).replace(/\s+/g, ' ');
        v('E. une opération de banque renommée : « MCDO ARR » s\'appellera « McDonald\'s » aux prochains imports', noms.mcdoarr && noms.mcdoarr.nom === "McDonald's" && /s'appellera « McDonald's »/.test(msg), JSON.stringify([noms, msg]));
        await page.click('[data-journal-appris-similaires]'); await attendre();
        const t2 = await tx(9402);
        v('  → l\'autre « MCDO ARR » renommée et rangée d\'un clic', t2.libelle === "McDonald's" && t2.categorieId === SORT, JSON.stringify(t2));
        const L = await importer(HAUT);
        const mc = L.find(l => l.m === -31.5);
        v('  → à l\'import, « MCDO AR » (une autre lecture) arrive « McDonald\'s », rangé Sorties SÛR (la catégorie suit le nom)',
          mc && mc.marchand === "McDonald's" && mc.appris && mc.appris.nom && mc.cat === SORT && mc.statut === 'sur', JSON.stringify(mc));
        v('  → le 🧠 le signale dans la revue', (await page.$$('[data-import-nom-appris]')).length === 1);
        await page.evaluate((ST) => eval(ST).fermerImportBanque(), ST);
    });
    await section('F', async () => {
        await poser([]);
        let L = await importer(HAUT);
        const afrq = L.find(l => l.m === -300);
        v('F. « AFRQ » −300 : proposé « Pointer eau » (le montant de la facture)', afrq && /^pointer:/.test(afrq.action), JSON.stringify(afrq));
        await page.evaluate((ST) => { const l = eval(ST).importBanque.captures[0].lignes.find(x => x.op.montant === -300); l.action = 'ajouter'; }, ST);
        await page.click('[data-import-appliquer]'); await attendre(300);
        const fini = await page.textContent('[data-import-fini-appris]');
        const act = await J('st.parametres.apprentissage.actions');
        v('  → vous le changez en « Ajouter » : retenu (« 🧠 1 choix retenu »)', /1 choix retenu/.test(fini) && Object.values(act).some(e => e.c && e.c.ajouter === 1 && /AFRQ/.test(e.brut)), JSON.stringify([fini, act]));
        const AUTRE = ['Compte chèque', '1 000,00 DH', 'PAIEMENT CB 12 10 26 AFRQ D AG...\t-300,00 DH', '12 oct. 2026'].join('\n');
        L = await importer(AUTRE);
        const af2 = L.find(l => /AFRQ/.test(l.lib));
        v('  → l\'import suivant : « AFRQ » est « Ajouter » d\'office, « 🧠 votre choix »', af2 && af2.action === 'ajouter' && af2.appris && af2.appris.action === 1
          && (await page.$$('[data-import-badge="appris"]')).length === 1, JSON.stringify(af2));
        await page.evaluate((ST) => eval(ST).fermerImportBanque(), ST);
        await page.evaluate((ST) => { const st = eval(ST); st.uiFixer('saisie.apprentissage', true); }, ST); await attendre();
        v('  → et le panneau le montre : « AFRQ D A » → ➕ ajouter au journal', /AFRQ[^→]*→ ➕ ajouter au journal/.test((await page.textContent('[data-apprentissage-actions]')).replace(/\s+/g, ' ')));
    });
    await section('G', async () => {
        await poser([]);
        await page.evaluate((ST) => { const st = eval(ST); if (st.parametres.apprentissage) { st.parametres.apprentissage.actions = {}; st.parametres.apprentissage.noms = {}; } st.calculationTick++; }, ST);
        //  deux captures, comme depuis le téléphone : l'OCR est simulé (il rend le texte de chacune), tout le reste est réel
        const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAACCAYAAACZgbYnAAAAD0lEQVR4nGP4z8DAwMAAAA4AAf8C6p5/AAAAAElFTkSuQmCC', 'base64');
        await page.evaluate(({ ST, HAUT, BAS }) => { const st = eval(ST);
            const file = [HAUT, HAUT, BAS, BAS];
            window.Tesseract = { createWorker: async () => ({ setParameters: async () => {}, recognize: async () => ({ data: { text: file.shift() || '', lines: [], words: [] } }) }) };
            st.ouvrirImportBanque(); }, { ST, HAUT, BAS });
        await page.setInputFiles('[data-import-fichiers]', [{ name: 'haut.png', mimeType: 'image/png', buffer: png }, { name: 'bas.png', mimeType: 'image/png', buffer: png }]);
        await page.click('[data-import-analyser]');
        await page.waitForFunction((ST) => eval(ST).importBanque.etape === 'revue', ST, { timeout: 30000 });
        await page.evaluate(async ({ ST, CC }) => { const st = eval(ST);
            for (const cap of st.importBanque.captures) if (!cap.compteId) { cap.reponse.compteId = CC; st.repondreCompteCapture(cap); }
            await new Promise(r => setTimeout(r, 250)); }, { ST, CC });
        const L = await page.evaluate((ST) => JSON.parse(JSON.stringify(eval(ST).importBanque.captures.flatMap(c => (c.lignes || []).map(l => ({ date: l.op.date, m: l.op.montant, lib: l.op.libelle, marchand: l.marchand,
            type: l.type, action: l.action, appris: l.appris, doublon: l.doublon, cat: l.cat && l.cat.id, statut: l.cat && l.cat.statut, cibles: l.cibles.map(c => c.libelle), deduite: !!l.op.dateDeduite }))))), ST);
        const caps = await J('st.importBanque.captures.map(c => [c.analyse.banque, c.analyse.signature])');
        v('G. les deux écrans « Compte chèque » reconnus Attijari (plus de « sans compte, répondez à la question »)', caps.length === 2 && caps.every(c => c[0] === 'attijari'), JSON.stringify(caps));
        const meg = L.filter(l => l.m === -156);
        v('  → « GARAGE MEGARA » −156 n\'est pointé ni sur « Vidange Skoda » (0 / 6 000, exceptionnelle) ni ailleurs par une catégorie devinée',
          meg.length === 2 && !meg.some(l => /Vidange/.test(l.action + l.cibles.join())) && meg.filter(l => !l.doublon).every(l => l.action === 'ajouter'), JSON.stringify(meg));
        const gg = L.filter(l => l.m === -489.9);
        v('  → « Google MBC » : rangé, pas pointé sur une facture prise au hasard parmi elect / eau / tel', gg.filter(l => !l.doublon).every(l => !/^pointer:/.test(l.action)), JSON.stringify(gg));
        v('  → les 0,00 DH (vérifications de carte) : ignorés, jamais ajoutés', L.filter(l => l.m === 0).every(l => l.type === 'nul' && l.action !== 'ajouter' || l.doublon) && L.filter(l => l.m === 0).length === 2, JSON.stringify(L.filter(l => l.m === 0)));
        v('  → « Remonter » posé sur une date n\'invente plus de libellé (« TREN;LRR ») ; la date cachée est déduite (18/10)',
          !L.some(l => /TREN|LRR/.test(l.lib)) && gg.some(l => l.deduite && l.date === '2026-10-18'), JSON.stringify(gg));
        v('  → les deux captures se chevauchent : Google MBC, MEGARA, GOOGLE PAYMENTS comptés UNE fois',
          gg.filter(l => !l.doublon).length === 1 && meg.filter(l => !l.doublon).length === 1, JSON.stringify([gg, meg]));
        const signes = await page.evaluate(() => [...document.querySelectorAll('[data-import-ligne][data-type="nul"]')].map(e => e.textContent.replace(/\s+/g, ' ')));
        v('  → affiché « 0 DH », pas « −0 DH »', signes.length >= 1 && signes.every(s => !/−0 DH/.test(s)), JSON.stringify(signes));
        await page.evaluate((ST) => eval(ST).fermerImportBanque(), ST);
    });
    await section('G2', async () => {
        //  « MAROC TELECOM » (sûr : tel) quand « tel » n'est pas au Pilotage ce mois-ci : la seule autre ligne des Factures (« eau »)
        //  est une SŒUR, sans mot commun ni montant juste — l'achat va au journal, pas sur la facture d'eau
        await poser([]);
        await page.evaluate(async (ST) => { const st = eval(ST); st.donneesAnnuelles[2026].chargesVariables.factures.details.forEach(d => { if (d.nom !== 'eau') d.montant = 0; });
            st.calculationTick++; await new Promise(r => setTimeout(r, 300)); }, ST);
        const k = await cat('maroc telecom', 120);
        const lignes = await J('st.tachesPilotageToutes.filter(t => t.groupe === "Factures").map(t => t.libelle)');
        const L = await importer(['Compte chèque', '1 000,00 DH', 'PAIEMENT CB 18 10 26 MAROC TELECOM\t-120,00 DH', '18 oct. 2026'].join('\n'));
        v('G2. un achat sûr dont la ligne n\'est pas au Pilotage n\'est pas pointé sur sa « sœur » (MAROC TELECOM ≠ facture d\'eau)',
          /tel$/.test(k.id || '') && k.statut === 'sur' && JSON.stringify(lignes) === '["eau"]' && L.length === 1 && L[0].action === 'ajouter' && !L[0].cibles.length, JSON.stringify([k.id, lignes, L]));
        await page.evaluate((ST) => eval(ST).fermerImportBanque(), ST);
    });
    await section('H', async () => {
        const tel = await ouvrirPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
        await tel.evaluate(async (ST) => { const st = eval(ST); st.parametres.apprentissage = { actif: true, noms: { mcdoarr: { nom: "McDonald's", brut: 'MCDO ARR', n: 1, t: '2026-10-19' } },
            actions: { afrqda: { c: { ajouter: 1 }, dernier: 'ajouter', brut: 'AFRQ D A', nom: 'AFRQ D A', t: '2026-10-19' } }, oublis: {} };
            st.uiFixer('saisie.apprentissage', true); st.calculationTick++; st.activeTab = 'saisie'; await new Promise(r => setTimeout(r, 400)); }, ST);
        await tel.evaluate(() => document.querySelector('[data-apprentissage]').scrollIntoView());
        const m = await tel.evaluate(() => { const W = window.innerWidth; return { sw: document.documentElement.scrollWidth, trop: [...document.querySelectorAll('[data-apprentissage] *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > W + 1; }).length }; });
        v('H. téléphone 390 px : le panneau tient dans l\'écran', m.sw <= 390 && m.trop === 0, JSON.stringify(m));
        if (process.env.CAPTURE) await tel.screenshot({ path: process.env.CAPTURE });
    });
    v('aucune erreur JavaScript', erreurs.length === 0, erreurs.slice(0, 3).join(' | '));
} finally {
    await browser.close();
    srv.close();
}
console.log('  ' + '─'.repeat(80));
console.log(ko === 0 ? '  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
