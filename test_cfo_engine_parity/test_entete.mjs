/**
 * v37.63 — LE PATRIMOINE PROJETÉ, TOUJOURS EN HAUT À DROITE.
 *   « En haut à droite j'avais la projection directe des comptes pour une période donnée, ça a tout simplement
 *   disparu ! Quand je l'effleurais, elle me donnait le détail des comptes, avec un clic vers le journal de chaque
 *   compte. » Sous ~1 300 px, la ligne de l'en-tête passait à la ligne et le bloc tombait À GAUCHE, sous l'année.
 *     A. statique · B. 1 265 px (votre écran) : sur la ligne de l'année, à droite · C. 1 024 px : à droite ·
 *     D. le détail des comptes au survol, le clic ouvre le relevé du compte · E. au toucher / au clavier.
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
console.log('\n  EN-TÊTE : LE PATRIMOINE PROJETÉ EN HAUT À DROITE\n  ' + '─'.repeat(80));

v('A. le bloc « Patrimoine Global Projeté » : collé à droite (ml-auto), atteignable au clavier / au toucher, « ⓘ »',
  /data-projection-entete tabindex="0"[^>]*class="ml-auto /.test(html) && /Patrimoine Global Projeté ⓘ/.test(html) && /group-focus-within:block/.test(html));
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
const erreurs = [], externes = [], envois = [];
const ouvrirPage = async (opts) => {
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    await page.clock.setFixedTime(new Date(2026, 9, 20, 8, 30, 0));
    page.on('pageerror', e => erreurs.push(String(e)));
    page.on('dialog', d => d.accept());
    page.on('request', r => { const u = r.url(); if (!u.startsWith('http://127.0.0.1') && !u.startsWith('blob:') && !u.startsWith('data:')) externes.push(u); });
    await page.route('**/webhook/**', route => route.abort());
    page.on('request', r => { if (r.method() === 'POST' && /save_data\.php/.test(r.url())) envois.push(Date.now()); });
    await page.goto(`http://127.0.0.1:${port}/finance/`, { waitUntil: 'load' });
    await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState.moisBudgetaire; }, null, { timeout: 30000 });
    await page.waitForTimeout(600);
    await page.evaluate(async (ST) => { const st = eval(ST); st.appMode = 'previsionnel'; await new Promise(r => setTimeout(r, 250)); st.activeTab = 'bilan'; }, ST);
    await page.waitForTimeout(500);
    return page;
};

const AUJ = 'new Date(2026, 9, 20)';
const analyser = (...textes) => page.evaluate(({ ST, textes, AUJ }) => { const st = eval(ST), a = eval(AUJ);
    return JSON.parse(JSON.stringify(textes.length > 1 ? st.bqAnalyserOCR(textes, { aujourdhui: a }) : st.bqAnalyser(textes[0], { aujourdhui: a }))); }, { ST, textes, AUJ });
const ops = (a) => a.operations.map(o => [o.dateOp, o.dateAchat || '', o.montant, o.libelle].join(' | '));
const attendre = (ms = 250) => page.waitForTimeout(ms);
const flottants = (p) => p.evaluate(() => [...document.querySelectorAll('button')].filter(b => getComputedStyle(b).position === 'fixed' && b.offsetWidth > 0 && b.offsetWidth < 80)
    .map(b => { const r = b.getBoundingClientRect(); return { t: b.textContent.trim().slice(0, 2), l: r.left, r: r.right, h: r.top, b: r.bottom, cx: (r.left + r.right) / 2, cy: (r.top + r.bottom) / 2 }; }));
const geo = (p) => p.evaluate(() => {
    const g = document.querySelector('[data-projection-entete]') || [...document.querySelectorAll('p')].find(e => /Patrimoine Global Projet/i.test(e.textContent)).closest('.group'), row = g.parentElement, sel = row.querySelector('select');
    const r = g.getBoundingClientRect(), rr = row.getBoundingClientRect(), rs = sel.getBoundingClientRect();
    return { droite: Math.round(rr.right - r.right), memeLigne: Math.abs((r.top + r.bottom) / 2 - (rs.top + rs.bottom) / 2) < 14, visible: r.width > 0 && r.height > 0 };
});
const detail = (p) => p.evaluate(() => { const d = document.querySelector('[data-projection-detail]') || [...document.querySelectorAll('div')].find(e => e.className.includes('group-hover:block') && /Répartition du Patrimoine Projeté/.test(e.textContent)); const r = d.getBoundingClientRect();
    return { visible: getComputedStyle(d).display !== 'none' && r.height > 0, comptes: [...d.querySelectorAll('span.cursor-pointer')].map(x => x.textContent.trim()) }; });
try {
    await section('B', async () => {
        const p = await ouvrirPage({ viewport: { width: 1265, height: 720 } });
        const g = await geo(p);
        v('B. 1 265 px (votre écran) : le patrimoine projeté sur la ligne de l\'année, en haut À DROITE', g.visible && g.memeLigne && g.droite <= 30, JSON.stringify(g));
        const montant = await p.evaluate(() => { const g = document.querySelector('[data-projection-entete]') || [...document.querySelectorAll('p')].find(e => /Patrimoine Global Projet/i.test(e.textContent)).closest('.group'); return g.querySelectorAll('p')[1].textContent; });
        const attendu = await p.evaluate((ST) => eval(ST).formatMAD(eval(ST).patrimoineProjeteGlobal), ST);
        v('  → le montant est celui du patrimoine projeté fin d\'année', montant.replace(/\s+/g, ' ').includes(attendu.replace(/\s+/g, ' ')), JSON.stringify([montant, attendu]));
        await p.context().close();
    });
    await section('C', async () => {
        const p = await ouvrirPage({ viewport: { width: 1024, height: 720 } });
        const g = await geo(p);
        v('C. 1 024 px : s\'il passe à la ligne, il reste À DROITE (plus jamais sous l\'année, à gauche)', g.visible && g.droite <= 30, JSON.stringify(g));
        await p.context().close();
    });
    await section('D', async () => {
        const p = await ouvrirPage({ viewport: { width: 1265, height: 720 } });
        const avant = await detail(p);
        await p.hover('text=Patrimoine Global Projeté'); await p.waitForTimeout(250);
        const d = await detail(p);
        v('D. effleuré : le détail des comptes apparaît (Courant, Épargne, urgence, ASSAFA)', !avant.visible && d.visible && d.comptes.length === 4 && d.comptes.some(c => /Compte Courant/.test(c)), JSON.stringify([avant.visible, d]));
        await p.click('.group-hover\\:block span.cursor-pointer >> nth=0'); await p.waitForTimeout(400);
        const r = await p.evaluate((ST) => ({ ouvert: eval(ST).showReleveModal, compte: eval(ST).compteReleve }), ST);
        await p.mouse.move(5, 700); await p.waitForTimeout(250);
        v('  → un clic sur « Compte Courant » ouvre SON relevé ; le détail se referme', r.ouvert === true && r.compte === 'cpt_acc_cc' && !(await detail(p)).visible, JSON.stringify(r));
        await p.context().close();
    });
    await section('E', async () => {
        const p = await ouvrirPage({ viewport: { width: 1265, height: 720 } });
        await p.evaluate(() => { const g = document.querySelector('[data-projection-entete]') || [...document.querySelectorAll('p')].find(e => /Patrimoine Global Projet/i.test(e.textContent)).closest('.group'); g.focus(); }); await p.waitForTimeout(250);
        v('E. au toucher / au clavier (sans survol) : le détail s\'ouvre aussi', (await detail(p)).visible);
        await p.context().close();
    });
    v('aucune erreur JavaScript', erreurs.length === 0, erreurs.slice(0, 3).join(' | '));
} finally {
    await browser.close();
    srv.close();
}
console.log('  ' + '─'.repeat(80));
console.log(ko === 0 ? '  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
