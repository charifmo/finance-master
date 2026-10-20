/**
 * v37.61 — LA SAISIE, SIMPLE ET JUSTE.
 *   « Fais un audit de la partie saisie pour la rendre la plus simple à utiliser de ma part, et détecte les
 *   erreurs et problèmes. » Mardi 20 oct. 2026, au téléphone (390 px), vos gestes rejoués.
 *     A. statique · B. le montant lu dans le texte · C. rien de périmé · D. « ⚙️ Ajuster » · E. l'heure de la
 *     saisie · F. la bonne année, jamais une saisie perdue · G. la saisie rapide (le ➕) · H. « ✓ ajouté · ↶ Annuler »
 *     · I. « déjà saisi » · J. le compte appris · K. le journal au téléphone.
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
console.log('\n  SAISIE : SIMPLE ET JUSTE\n  ' + '─'.repeat(80));

v('A. la saisie propose la liste du journal (familles, lignes) : plus de « — », plus de revenus, plus de « Misc »',
  !/v-for="g in categoriesForSelect"/.test(html) && (html.match(/data-saisie-categorie/g) || []).length >= 2 && !/<option value="cat_misc">📦 Misc<\/option>/.test(html));
v('  → les repères des tests existants gardés (champ de la page, champ de la saisie rapide, import en tête)',
  html.includes('placeholder="Ex: 200 courses"') && html.includes(`placeholder='Ex: "400 courses"'`) && /data-import-ouvrir-rapide @click="closeSaisieQuickModal\(\); ouvrirImportBanque\(\)"/.test(html));
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
    await page.clock.setFixedTime(new Date(2026, 9, 20, 8, 30, 0));
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
const page = await ouvrirPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const AUJ = 'new Date(2026, 9, 20)';
const analyser = (...textes) => page.evaluate(({ ST, textes, AUJ }) => { const st = eval(ST), a = eval(AUJ);
    return JSON.parse(JSON.stringify(textes.length > 1 ? st.bqAnalyserOCR(textes, { aujourdhui: a }) : st.bqAnalyser(textes[0], { aujourdhui: a }))); }, { ST, textes, AUJ });
const ops = (a) => a.operations.map(o => [o.dateOp, o.dateAchat || '', o.montant, o.libelle].join(' | '));
const J = (expr) => page.evaluate(({ ST, expr }) => { const st = eval(ST); return JSON.parse(JSON.stringify(eval(expr) ?? null)); }, { ST, expr });
const attendre = (ms = 200) => page.waitForTimeout(ms);
const IN = 'input[placeholder="Ex: 200 courses"]';
const taper = async (txt) => { await page.fill(IN, txt); await attendre(150); };
const remettre = () => page.evaluate(async (ST) => { const st = eval(ST); st.resetSaisieForm(); st.showSaisieDetails = false; st.showSaisieQuickModal = false; await new Promise(r => setTimeout(r, 120)); }, ST);
const poser = (liste) => page.evaluate(async ({ ST, liste }) => { const st = eval(ST); st.donneesAnnuelles[2026].transactionsReelles = liste; if (st.donneesAnnuelles[2027]) delete st.donneesAnnuelles[2027];
    st.calculationTick++; st.activeTab = 'saisie'; await new Promise(r => setTimeout(r, 300)); }, { ST, liste });
const derniere = (lib) => page.evaluate(({ ST, lib }) => { const st = eval(ST); const all = Object.entries(st.donneesAnnuelles).flatMap(([a, d]) => (d.transactionsReelles || []).map(t => ({ ...t, an: a }))).filter(t => t.libelle === lib); return JSON.parse(JSON.stringify(all.pop() || null)); }, { ST, lib });
try {
    await poser([]);
    await section('B', async () => {
        const cas = { 'Marjane 1 250': [1250, 'Marjane'], 'café 15dh': [15, 'café'], '15 DH café': [15, 'café'], '7up 10': [10, '7up'], 'iam 4g 50': [50, 'iam 4g'],
                      'courses 2 kg 30': [30, 'courses 2 kg'], '1.250 loyer': [1250, 'loyer'], '25,5 taxi': [25.5, 'taxi'], '200 courses': [200, 'courses'], '١٥٠ خبز': [150, 'خبز'],
                      'loyer 3 500 dhs': [3500, 'loyer'], 'café': [null, 'café'], 'abonnement 4g': [null, 'abonnement 4g'], '2 kg tomates 30': [30, '2 kg tomates'] };
        const r = await page.evaluate(({ ST, cas }) => { const st = eval(ST); return Object.keys(cas).map(c => { const p = st._parseSaisieRapide(c); return [c, p.montant, p.libelle]; }); }, { ST, cas });
        const faux = r.filter(([c, m, l]) => cas[c][0] !== m || cas[c][1] !== l);
        v('B. « Marjane 1 250 » = 1 250 DH (pas 1) ; « 7up 10 » = 10 (pas 7) ; « iam 4g 50 » = 50 ; « 1.250 » = 1 250 ; « café 15dh » → « café » ; ١٥٠ = 150',
          faux.length === 0, JSON.stringify(faux));
    });
    await section('C', async () => {
        await remettre(); await taper('50 café'); await taper('café');
        const a = await J('[st.saisieForm.montant, st.saisieForm.libelle]');
        const actif = await page.evaluate(() => !document.querySelector('button[title="Ajouter"]').disabled);
        v('C. « 50 café » puis le nombre effacé : plus de montant, ➕ éteint, « 💵 montant ? »', a[0] === null && a[1] === 'café' && !actif && await page.isVisible('[data-saisie-sans-montant]'), JSON.stringify([a, actif]));
        await taper('50 café'); await taper('50');
        const b = await J('[st.saisieForm.montant, st.saisieForm.libelle, st.saisieForm.categorieId]');
        v('  → « 50 café » puis le libellé effacé : plus de « café », plus de catégorie', b[0] === 50 && b[1] === '' && b[2] === '', JSON.stringify(b));
    });
    await section('D', async () => {
        await remettre(); await taper('30 café');
        const avant = await J('st.saisieForm.categorieId');
        await page.click('[data-saisie-ajuster]'); await attendre();
        await page.fill('[data-saisie-details] input[placeholder="Libellé"]', 'essence'); await attendre();
        const apres = await J('st.saisieForm.categorieId');
        v('D. « ⚙️ Ajuster » : le libellé changé en « essence » change la catégorie (café → essence)', /cafe/.test(avant) && /essence/.test(apres), JSON.stringify([avant, apres]));
        await page.selectOption('[data-saisie-details] [data-saisie-categorie]', ''); await attendre();
        const auto = await J('[st.saisieCatSource, st.saisieForm.categorieId]');
        v('  → « 🤖 Automatique » rend la main aux règles (plus un choix « à la main » de « non catégorisé »)', auto[0] !== 'manuel' && /essence/.test(auto[1]), JSON.stringify(auto));
        await page.click('[data-saisie-ajuster]'); await remettre();
    });
    await section('E', async () => {
        await poser([]); await remettre();
        await page.clock.setFixedTime(new Date(2026, 9, 20, 21, 40, 0));
        await taper('12 pain'); await page.press(IN, 'Enter'); await attendre(250);
        const t = await derniere('pain');
        v('E. la page ouverte depuis 08:30, validée à 21:40 : la saisie est datée 21:40 (plus l\'heure du formulaire)', t && t.datetime === '2026-10-20T21:40', JSON.stringify(t && t.datetime));
        await taper('18 taxi'); await page.click('[data-saisie-ajuster]'); await attendre();
        await page.fill('[data-saisie-details] [data-saisie-date]', '2026-10-18T19:00'); await attendre();
        const lab = await page.textContent('[data-saisie-ajuster]');
        await page.press(IN, 'Enter'); await attendre(250);
        const t2 = await derniere('taxi');
        v('  → une date CHOISIE est gardée (18/10 19:00)', t2 && t2.datetime === '2026-10-18T19:00', JSON.stringify(t2 && t2.datetime));
    });
    await section('F', async () => {
        await remettre(); await taper('80 resto'); await page.click('[data-saisie-ajuster]'); await attendre();
        await page.fill('[data-saisie-details] [data-saisie-date]', '2027-01-02T12:00'); await attendre();
        await page.press(IN, 'Enter'); await attendre(250);
        const t = await derniere('resto');
        v('F. une saisie du 2 janvier 2027 va dans 2027 (créée au besoin), pas dans l\'année affichée', t && t.an === '2027' && t.libelle === 'resto' && t.mois === 1, JSON.stringify(t && [t.an, t.date]));
        const r = await page.evaluate(async (ST) => { const st = eval(ST); const sauv = st.donneesAnnuelles[2026]; delete st.donneesAnnuelles[2026];
            st.resetSaisieForm(); st.saisieRapide = '45 boucher'; await new Promise(r => setTimeout(r, 120));
            const ok = st.validerSaisieForm(); const cree = st.donneesAnnuelles[2026]; const trouve = !!cree && (cree.transactionsReelles || []).some(t => t.libelle === 'boucher');
            const budget = !!cree && !!cree.chargesVariables && Object.keys(cree.chargesVariables).length > 0;
            if (cree) sauv.transactionsReelles.push(...cree.transactionsReelles); st.donneesAnnuelles[2026] = sauv; st.calculationTick++;
            return { ok, trouve, budget }; }, ST);
        v('  → l\'année manquante : créée (avec son budget, copie de la plus proche) ; la saisie n\'est JAMAIS perdue', r.ok === true && r.trouve && r.budget, JSON.stringify(r));
        const r2 = await page.evaluate(async (ST) => { const st = eval(ST); const sauv = { ...st.donneesAnnuelles }; Object.keys(st.donneesAnnuelles).forEach(k => delete st.donneesAnnuelles[k]);
            st.resetSaisieForm(); st.saisieRapide = '45 boucher'; await new Promise(r => setTimeout(r, 120));
            const ok = st.validerSaisieForm(); const garde = st.saisieRapide, err = st.saisieErreur;
            Object.assign(st.donneesAnnuelles, sauv); st.resetSaisieForm(); st.calculationTick++; return { ok, garde, err }; }, ST);
        v('  → et si rien ne peut l\'accueillir : le formulaire reste rempli et l\'appli le dit (« NON enregistrée »)', r2.ok === false && r2.garde === '45 boucher' && /NON enregistrée/.test(r2.err), JSON.stringify(r2));
        await page.evaluate((ST) => { const st = eval(ST); st.showSaisieDetails = false; }, ST);
    });
    await section('G', async () => {
        await page.evaluate(async (ST) => { eval(ST).openSaisieQuickModal(); await new Promise(r => setTimeout(r, 300)); }, ST);
        const g = await page.evaluate(() => { const m = document.querySelector('.fixed.inset-0.z-\\[80\\]');
            const vis = [...m.querySelectorAll('input, select, button')].filter(e => e.offsetParent);
            return { focus: document.activeElement && document.activeElement.hasAttribute('data-saisie-rapide-champ'), n: vis.length, premier: (vis[1] && vis[1].textContent || '').trim() }; });
        v('G. la saisie rapide (➕) : le clavier s\'ouvre tout de suite ; 4 éléments (✕, import, le champ, Valider) au lieu de 9', g.focus && g.n === 4 && /Importer mes captures/.test(g.premier), JSON.stringify(g));
        await page.fill('[data-saisie-rapide-champ]', '45 zara'); await attendre();
        const et = await page.textContent('[data-saisie-rapide-etiquette]');
        v('  → l\'étiquette : 💵 45 DH, le compte, « Maintenant », « ⚙️ Ajuster »', /45\sDH/.test(et) && /Compte Courant/.test(et) && /Maintenant/.test(et) && /Ajuster/.test(et), et.replace(/\s+/g, ' '));
        await page.click('.fixed.inset-0.z-\\[80\\] [data-saisie-ajuster]'); await attendre();
        v('  → « ⚙️ Ajuster » ouvre date, montant, catégorie, compte, libellé', (await page.$$('.fixed.inset-0.z-\\[80\\] [data-saisie-details] input, .fixed.inset-0.z-\\[80\\] [data-saisie-details] select')).length === 5);
        await page.evaluate((ST) => eval(ST).closeSaisieQuickModal(), ST); await remettre();
    });
    await section('H', async () => {
        await poser([]); await remettre();
        await page.evaluate(async (ST) => { eval(ST).openSaisieQuickModal(); await new Promise(r => setTimeout(r, 200)); }, ST);
        await page.fill('[data-saisie-rapide-champ]', '15 café'); await attendre();
        await page.press('[data-saisie-rapide-champ]', 'Enter'); await attendre(300);
        const ann = await page.textContent('[data-saisie-annonce]');
        const n1 = await J('st.donneesAnnuelles[2026].transactionsReelles.length');
        v('H. après « Valider » : « ✓ café · 15 DH → cafe Resto Wknd · Compte Courant » (la saisie rapide se ferme)', /✓ café · 15 DH → cafe Resto Wknd · Compte Courant/.test(ann.replace(/\s+/g, ' ')) && n1 === 1, ann);
        await page.click('[data-saisie-annuler]'); await attendre();
        v('  → « ↶ Annuler » la retire aussitôt', (await J('st.donneesAnnuelles[2026].transactionsReelles.length')) === 0 && !(await page.$('[data-saisie-annonce]')));
    });
    await section('I', async () => {
        await poser([{ id: 7001, datetime: '2026-10-20T08:10', date: '2026-10-20', mois: 10, libelle: 'café', montant: 15, categorieId: 'cat_cv_sorties__dcafe_resto_wknd', compteId: CC, source: 'manuel' }]);
        await remettre(); await taper('15 café');
        const d = await page.textContent('[data-saisie-deja-vue]');
        v('I. « 15 café » déjà saisi ce matin : « ⚠️ Déjà saisi aujourd\'hui à 08:10 » (on peut valider quand même)', /Déjà saisi aujourd'hui à 08:10/.test(d) && await page.evaluate(() => !document.querySelector('button[title="Ajouter"]').disabled), d);
        await taper('16 café');
        v('  → un autre montant : rien à signaler', !(await page.$('[data-saisie-deja-vue]')));
    });
    await section('J', async () => {
        await poser([{ id: 7101, datetime: '2026-10-12T10:00', date: '2026-10-12', mois: 10, libelle: 'pressing', montant: 40, categorieId: 'cat_irr_depense_exceptionnelle', compteId: ASSAFA, source: 'manuel' }]);
        await remettre(); await taper('35 pressing');
        const c = await J('st.saisieForm.compteId');
        const chip = await page.textContent('[data-saisie-compte]');
        v('J. « 35 pressing » : le compte de votre dernier « pressing » (ASSAFA), « · appris »', String(c) === String(ASSAFA) && /ASSAFA/.test(chip) && /appris/.test(chip), JSON.stringify([c, chip]));
        await page.click('[data-saisie-ajuster]'); await attendre();
        await page.selectOption('[data-saisie-details] [data-saisie-compte-choix]', CC); await attendre();
        await taper('36 pressing');
        v('  → un compte choisi par vous n\'est plus remplacé', (await J('st.saisieForm.compteId')) === CC);
        await remettre();
    });
    await section('K', async () => {
        await poser([]);
        const res = await page.textContent('[data-journal-resume]');
        v('K. journal vide : « 0 DH », plus « −0 DH »', !/−0\sDH/.test(res) && /·\s0\sDH/.test(res), res.replace(/\s+/g, ' '));
        const replie = await page.evaluate(() => [!!document.querySelector('[data-journal-filtres-bouton]'), !!document.querySelector('[data-journal-filtres]')]);
        await page.click('[data-journal-filtres-bouton]'); await attendre();
        v('  → au téléphone, les filtres sont repliés derrière « ⚙️ Filtres » (un toucher les ouvre)', replie[0] && !replie[1] && !!(await page.$('[data-journal-filtres]')), JSON.stringify(replie));
        await poser([{ id: 7201, datetime: '2026-10-19T10:00', date: '2026-10-19', mois: 10, libelle: 'pain', montant: 5, categorieId: 'cat_cv_alimentation', compteId: CC, source: 'manuel' },
                     { id: 7202, datetime: '2026-09-10T10:00', date: '2026-09-10', mois: 9, libelle: 'pain', montant: 5, categorieId: 'cat_cv_alimentation', compteId: CC, source: 'manuel' }]);
        v('  → l\'en-tête compte les opérations du cycle en cours : « 1 op. ce cycle »', /1 op\. ce cycle/.test(await page.textContent('[data-saisie-compteur]')));
        const m = await page.evaluate(() => { const W = window.innerWidth; return { sw: document.documentElement.scrollWidth }; });
        v('  → rien ne déborde à 390 px', m.sw <= 390, JSON.stringify(m));
    });
    v('aucune erreur JavaScript', erreurs.length === 0, erreurs.slice(0, 3).join(' | '));
} finally {
    await browser.close();
    srv.close();
}
console.log('  ' + '─'.repeat(80));
console.log(ko === 0 ? '  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
