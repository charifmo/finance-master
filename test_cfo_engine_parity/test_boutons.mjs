/**
 * v37.62 — TROIS BOUTONS FLOTTANTS : 🧠 📑 ➕.
 *   « Laisse juste brain, journal et + » : au téléphone, 🪄 Merlin et 💾 disparaissent ; 🧠 📑 ➕ sur une rangée,
 *   en bas à droite, au lieu d'une colonne posée sur les montants du journal. Mardi 20 oct. 2026.
 *     A. statique · B. trois boutons, une rangée, rien ne se chevauche · C. le milieu de l'écran est libre ·
 *     D. chacun répond · E. ordinateur : Merlin au pied de la barre · F. l'envoi au VPS reste automatique.
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
console.log('\n  BOUTONS FLOTTANTS : 🧠 📑 ➕\n  ' + '─'.repeat(80));

v('A. au téléphone, plus de 🪄 ni de 💾 flottants ; Merlin reste au pied de la barre latérale (ordinateur)',
  !/'bottom-20 left-4 w-12 h-12 text-xl'/.test(html) && !/title="Sauver sur VPS">\s*💾/.test(html) && /merlin-wand-btn rounded-lg border/.test(html));
v('  → les changements partent seuls au VPS (2 s après la modification)', /_autoSaveTimer = setTimeout\(\(\) => \{ saveToServer\(\); \}, 2000\);/.test(html));
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
    await page.evaluate(async (ST) => { const st = eval(ST); st.appMode = 'reel'; await new Promise(r => setTimeout(r, 250)); st.activeTab = 'saisie'; }, ST);
    await page.waitForTimeout(500);
    return page;
};
const page = await ouvrirPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const AUJ = 'new Date(2026, 9, 20)';
const analyser = (...textes) => page.evaluate(({ ST, textes, AUJ }) => { const st = eval(ST), a = eval(AUJ);
    return JSON.parse(JSON.stringify(textes.length > 1 ? st.bqAnalyserOCR(textes, { aujourdhui: a }) : st.bqAnalyser(textes[0], { aujourdhui: a }))); }, { ST, textes, AUJ });
const ops = (a) => a.operations.map(o => [o.dateOp, o.dateAchat || '', o.montant, o.libelle].join(' | '));
const attendre = (ms = 250) => page.waitForTimeout(ms);
const flottants = (p) => p.evaluate(() => [...document.querySelectorAll('button')].filter(b => getComputedStyle(b).position === 'fixed' && b.offsetWidth > 0 && b.offsetWidth < 80)
    .map(b => { const r = b.getBoundingClientRect(); return { t: b.textContent.trim().slice(0, 2), l: r.left, r: r.right, h: r.top, b: r.bottom, cx: (r.left + r.right) / 2, cy: (r.top + r.bottom) / 2 }; }));
try {
    await section('B', async () => {
        await page.evaluate(async ({ ST, CC }) => { const st = eval(ST);
            st.donneesAnnuelles[2026].transactionsReelles = Array.from({ length: 14 }, (_, i) => ({ id: 8000 + i, datetime: '2026-10-' + String(5 + i).padStart(2, '0') + 'T12:00', date: '2026-10-' + String(5 + i).padStart(2, '0'),
                mois: 10, libelle: 'achat ' + i, montant: 100 + i, categorieId: 'cat_cv_alimentation', compteId: CC, source: 'manuel' }));
            st.calculationTick++; st.activeTab = 'saisie'; await new Promise(r => setTimeout(r, 400)); }, { ST, CC });
        const fl = await flottants(page);
        const noms = fl.map(x => x.t).sort().join(' ');
        const chev = []; fl.forEach((a, i) => fl.slice(i + 1).forEach(b => { if (a.l < b.r && b.l < a.r && a.h < b.b && b.h < a.b) chev.push(a.t + '×' + b.t); }));
        v('B. téléphone 390 px : trois boutons flottants exactement — 🧠 📑 ➕', fl.length === 3 && ['🧠', '📑', '➕'].every(t => fl.some(x => x.t === t)), noms);
        const ys = fl.map(x => x.cy);
        v('  → sur UNE rangée (mêmes hauteurs), aucun ne chevauche l\'autre', Math.max(...ys) - Math.min(...ys) <= 6 && chev.length === 0, JSON.stringify([ys, chev]));
        const touch = await page.evaluate((fl) => fl.map(x => (document.elementFromPoint(x.cx, x.cy) || {}).textContent.trim().slice(0, 2)), fl);
        v('  → chacun se touche (rien n\'est posé dessus)', JSON.stringify(touch) === JSON.stringify(fl.map(x => x.t)), JSON.stringify(touch));
    });
    await section('C', async () => {
        const H = await page.evaluate(() => window.innerHeight);
        const fl = await flottants(page);
        v('C. le milieu de l\'écran est libre : les boutons sont dans la bande du bas (au-dessus des onglets)', fl.every(x => x.h >= H - 170), JSON.stringify(fl.map(x => [x.t, Math.round(x.h)])));
        //  les montants du journal, ligne après ligne, ne passent plus sous un bouton tant qu'ils sont au-dessus de cette bande
        await page.evaluate(() => document.querySelector('[data-journal-ligne]').scrollIntoView({ block: 'start' })); await attendre();
        const caches = await page.evaluate((H) => [...document.querySelectorAll('[data-journal-ligne]')].map(l => { const r = l.getBoundingClientRect(); return r; })
            .filter(r => r.top > 60 && r.bottom < H - 170).map(r => { const e = document.elementFromPoint(r.right - 20, (r.top + r.bottom) / 2); return e && e.closest('button[class*="fixed"]') ? 1 : 0; }).reduce((s, x) => s + x, 0), H);
        v('  → aucune ligne du journal à l\'écran n\'a son montant sous un bouton', caches === 0, String(caches));
    });
    await section('D', async () => {
        await page.click('[data-flottant="cfo"]'); await attendre(400);
        const cfo = await page.evaluate((ST) => eval(ST).showCfoModal, ST);
        await page.evaluate((ST) => { eval(ST).showCfoModal = false; }, ST); await attendre();
        await page.click('[data-flottant="releve"]'); await attendre(400);
        const rel = await page.evaluate((ST) => eval(ST).showReleveModal, ST);
        await page.evaluate((ST) => { eval(ST).showReleveModal = false; }, ST); await attendre();
        await page.click('[data-flottant="saisie"]'); await attendre(400);
        const sai = await page.evaluate((ST) => eval(ST).showSaisieQuickModal, ST);
        const pendant = (await flottants(page)).map(x => x.t).filter(t => ['🧠', '📑'].includes(t));
        v('D. 🧠 ouvre le CFO, 📑 le relevé, ➕ la saisie rapide', cfo === true && rel === true && sai === true, JSON.stringify([cfo, rel, sai]));
        v('  → la saisie rapide ouverte, 🧠 et 📑 s\'effacent', pendant.length === 0, JSON.stringify(pendant));
        await page.evaluate((ST) => eval(ST).closeSaisieQuickModal(), ST);
    });
    await section('E', async () => {
        const pc = await ouvrirPage({ viewport: { width: 1300, height: 900 } });
        const fl = (await flottants(pc)).map(x => x.t);
        const m = await pc.evaluate((ST) => { const st = eval(ST); const b = document.querySelector('button.merlin-wand-btn'); if (!b) return null; b.click(); const x = st.merlinActive; if (x) st.toggleMerlin(); return x; }, ST);
        v('E. ordinateur : aucun 🪄 ni 💾 flottant ; Merlin au pied de la barre latérale, qui s\'active', !fl.includes('🪄') && !fl.includes('💾') && m === true, JSON.stringify([fl, m]));
    });
    await section('F', async () => {
        envois.length = 0;
        await page.evaluate(async (ST) => { const st = eval(ST); st.saisieRapide = '12 pain'; await new Promise(r => setTimeout(r, 100)); st.validerSaisieForm(); }, ST);
        await page.waitForTimeout(3200);
        v('F. une saisie au téléphone part seule au VPS (sans 💾), en moins de 3 s', envois.length >= 1, String(envois.length));
    });
    v('aucune erreur JavaScript', erreurs.length === 0, erreurs.slice(0, 3).join(' | '));
} finally {
    await browser.close();
    srv.close();
}
console.log('  ' + '─'.repeat(80));
console.log(ko === 0 ? '  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
