/**
 * v37.58 — LES LEÇONS, AVEC L'IA.
 *   « Pour la partie leçons, il faut utiliser intelligemment l'IA. »
 *   L'application calcule les FAITS du cycle ; l'IA (simulée : le webhook est intercepté) en tire des
 *   leçons chiffrées ; chaque chiffre est vérifié, rien n'est gardé sans vous.
 *   Mercredi 14 oct. 2026, paie le 27 : cycle en cours 27 sep → 26 oct, précédent 27 août → 26 sep.
 *     A. statique · B. signaux sans IA · C. l'analyse (faits envoyés, réponse vérifiée) · D. garder / écarter ·
 *     E. le suivi des leçons gardées · F. IA en panne · G. « 🧠 Proposer » une note · H. téléphone.
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
console.log('\n  LEÇONS : L\'IA LIT LE CYCLE, VOUS GARDEZ\n  ' + '─'.repeat(80));

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
const ia = { requetes: [], panne: false, lecons: null, note: null };
const ouvrirPage = async (opts) => {
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    await page.clock.setFixedTime(new Date(2026, 9, 14, 10, 0, 0));
    page.on('pageerror', e => erreurs.push(String(e)));
    page.on('dialog', d => d.accept());
    page.on('request', r => { const u = r.url(); if (!u.startsWith('http://127.0.0.1') && !u.startsWith('blob:') && !u.startsWith('data:')) externes.push(u); });
    await page.route('**/webhook/**', async (route) => {
        const corps = JSON.parse(route.request().postData() || '{}');
        ia.requetes.push(corps);
        if (ia.panne) return route.abort();
        const q = String(corps.question || '');
        const r = /^LEÇONS D'UN CYCLE/.test(q) ? ia.lecons : /^NOTE SUR UNE DÉPENSE/.test(q) ? ia.note : { output: '{"id": null, "confiance": "basse", "raison": "rien"}' };
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r) });
    });
    await page.goto(`http://127.0.0.1:${port}/finance/`, { waitUntil: 'load' });
    await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState.moisBudgetaire; }, null, { timeout: 30000 });
    await page.waitForTimeout(600);
    await page.evaluate(async (ST) => { const st = eval(ST); st.appMode = 'reel'; await new Promise(r => setTimeout(r, 250)); st.activeTab = 'saisie'; }, ST);
    await page.waitForTimeout(500);
    return page;
};
const page = await ouvrirPage({ viewport: { width: 1300, height: 1000 } });
const AUJ = 'new Date(2026, 9, 14)';
const analyser = (...textes) => page.evaluate(({ ST, textes, AUJ }) => { const st = eval(ST), a = eval(AUJ);
    return JSON.parse(JSON.stringify(textes.length > 1 ? st.bqAnalyserOCR(textes, { aujourdhui: a }) : st.bqAnalyser(textes[0], { aujourdhui: a }))); }, { ST, textes, AUJ });
const ops = (a) => a.operations.map(o => [o.dateOp, o.dateAchat || '', o.montant, o.libelle].join(' | '));
const classer = (libelle, montant) => page.evaluate(({ ST, libelle, montant }) => eval(ST).bqClasser({ libelle, montant }), { ST, libelle, montant });


const MERE = 'cat_cv_alimentation', MARJ = 'cat_cv_alimentation__dmarjane';
const J = (expr) => page.evaluate(({ ST, expr }) => { const st = eval(ST); return JSON.parse(JSON.stringify(eval(expr))); }, { ST, expr });
const tx = (id) => page.evaluate(({ ST, id }) => { const st = eval(ST); for (const d of Object.values(st.donneesAnnuelles)) { const t = (d.transactionsReelles || []).find(x => x.id === id); if (t) return JSON.parse(JSON.stringify(t)); } return null; }, { ST, id });
const anDe = (id) => page.evaluate(({ ST, id }) => { const st = eval(ST); for (const [a, d] of Object.entries(st.donneesAnnuelles)) if ((d.transactionsReelles || []).some(x => x.id === id)) return a; return null; }, { ST, id });
const attendre = (ms = 250) => page.waitForTimeout(ms);
//  Le décor : le cycle en cours (oct.), le précédent (sept.), un ticket sans date
const OPS = [
    [9001, '2026-10-14T09:10', 'Marjane', 180, MARJ, CC], [9002, '2026-10-13T18:00', 'Marjane', 96, MARJ, CC], [9003, '2026-10-13T08:30', 'café', 20, 'cat_cv_sorties', null],
    [9004, '2026-10-02T12:00', 'essence', 300, 'cat_cv_voiture', CC], [9005, '2026-09-20T10:00', 'Marjane', 140, MARJ, CC], [9006, '2026-09-05T10:00', 'café', 30, 'cat_cv_sorties', null],
    [9007, '2026-09-28T10:00', 'Marjane', 55, MARJ, CC],
];
const charger = (p) => p.evaluate(async ({ ST, OPS }) => { const st = eval(ST), d = st.donneesAnnuelles[2026];
    d.transactionsReelles = OPS.map(([id, dt, libelle, montant, cat, compte]) => ({ id, datetime: dt, date: dt.slice(0, 10), mois: Number(dt.slice(5, 7)), libelle, montant, categorieId: cat, compteId: compte, source: 'manuel', categorieSource: 'vous' }));
    d.transactionsReelles.find(t => t.id === 9005).note = 'Marjane le samedi : panier trop gros';
    localStorage.removeItem('fm.journal.v1');
    delete st.parametres.leconsIA; delete st.parametres.analyseLecons;
    st.journal.periode = 'cycle'; st.journal.vue = 'lecons';
    st.calculationTick++; st.activeTab = 'saisie'; await new Promise(r => setTimeout(r, 500)); }, { ST, OPS });
//  La réponse de l'IA : en HTML, dans un bloc ```json, avec des accolades imbriquées
const reponse = (o) => ({ output: '<p>Voici mon analyse :</p><pre>```json\n' + JSON.stringify(o, null, 1) + '\n```</pre>' });
const LECONS = {
    bilan: 'Alimentation en forte hausse, le reste est tenu.',
    lecons: [
        { type: 'alerte', titre: 'Marjane plus que doublé', constat: 'Alimentation : 331 DH ce cycle contre 140 DH au précédent (+136 %).', action: 'Un seul passage Marjane par semaine, 150 DH maximum.', categorieId: MERE, enjeu: 190 },
        { type: 'economie', titre: 'Essence', constat: 'Voiture : 450 DH de carburant ce mois.', action: 'Faire le plein le dimanche.', categorieId: 'cat_inexistante', enjeu: 'beaucoup' },
        { type: 'farfelu', titre: 'Petits cafés', constat: 'Sorties : 20 DH.', action: 'Café maison.', categorieId: 'cat_cv_sorties', enjeu: null },
        { type: 'alerte', titre: '', constat: 'sans titre : écartée', action: '—' },
    ],
    suivis: [{ id: 'lc_inconnue', verdict: 'tenue', commentaire: 'n/a' }],
};
try {
    await charger(page);
    await section('A', async () => {
        v('A. la vue Leçons a son analyse IA (« 🧠 Analyser avec l\'IA »), les signaux calculés et les leçons gardées',
          ['data-lecons-ia', 'data-lecons-analyser', 'data-lecons-signal', 'data-lecon-ia-garder', 'data-lecons-gardees', 'data-journal-note-ia'].every(x => html.includes(x)));
        v('  → l\'IA est en LECTURE SEULE (aucun outil, aucun committer) et ne cite que LES FAITS',
          /LEÇONS D'UN CYCLE DE DÉPENSES — LECTURE SEULE : aucun outil/.test(html) && /NOTE SUR UNE DÉPENSE — LECTURE SEULE/.test(html) && /SEULS chiffres que tu as le droit de citer/.test(html));
    });
    await section('B', async () => {
        const s = await page.evaluate(() => [...document.querySelectorAll('[data-lecons-signal]')].map(e => e.textContent.replace(/\s+/g, ' ').trim()));
        v('B. SANS IA, les chiffres parlent déjà : « Alimentation : ▲ +136 % vs le cycle précédent (331 DH contre 140 DH) »',
          s.some(x => /Alimentation.*▲ \+136 % vs le cycle précédent \(331 DH contre 140 DH\)/.test(x)), JSON.stringify(s));
        v('  → et aucune requête à l\'IA tant que vous ne demandez rien', ia.requetes.length === 0, String(ia.requetes.length));
    });
    await section('C', async () => {
        ia.lecons = reponse(LECONS);
        await page.click('[data-lecons-analyser]'); await page.waitForSelector('[data-lecon-ia]', { timeout: 5000 });
        const q = ia.requetes.at(-1);
        const faits = JSON.parse(q.question.match(/^FAITS = (.*)$/m)[1]);
        const ali = faits.familles.find(f => f.id === MERE);
        v('C. une requête, session « lecons », avec LES FAITS : Alimentation 331 DH (3 op.), 140 DH au cycle précédent, +136 %',
          ia.requetes.length === 1 && q.session_id === 'lecons' && ali && ali.depense === 331 && ali.operations === 3 && ali.cycle_precedent === 140 && ali.ecart_vs_precedent_pct === 136, JSON.stringify(ali));
        v('  → avec votre note (« Marjane le samedi… ») et l\'avancement du cycle (18 jours sur 30)',
          faits.vos_notes.some(n => /panier trop gros/.test(n.note)) && faits.jours_ecoules === 18 && faits.jours_du_cycle === 30, JSON.stringify([faits.jours_ecoules, faits.jours_du_cycle, faits.vos_notes]));
        v('  → des chiffres, pas le journal brut (aucune opération ni identifiant envoyé)', !/datetime|"id":9001|compteId/.test(q.question));
        const p = await J('st.analyseLecons');
        const t = (titre) => p.propositions.find(x => x.titre === titre);
        v('  → 3 leçons retenues sur 4 (celle sans titre est écartée), le bilan affiché',
          p.propositions.length === 3 && /Alimentation en forte hausse/.test(await page.textContent('[data-lecons-bilan]')), JSON.stringify(p.propositions.map(x => x.titre)));
        v('  → « 331 contre 140 (+136 %) » est VÉRIFIÉ ; « 450 DH de carburant » (inventé) : ⚠️ chiffre non retrouvé',
          t('Marjane plus que doublé').verifie === true && t('Essence').verifie === false
          && (await page.$$('[data-lecon-ia][data-verifie="0"] [data-lecon-ia-non-verifie]')).length === 1);
        v('  → catégorie inconnue → aucune ; enjeu non numérique → aucun ; type inconnu → « habitude »',
          t('Essence').categorieId === null && t('Essence').enjeu === null && t('Petits cafés').type === 'habitude' && t('Marjane plus que doublé').enjeu === 190);
        v('  → rien n\'est gardé sans vous', !((await J('st.parametres.leconsIA || []')).length));
    });
    let idGardee;
    await section('D', async () => {
        await page.click('[data-lecon-ia]:has-text("Marjane plus que doublé") [data-lecon-ia-garder]'); await attendre();
        await page.click('[data-lecon-ia]:has-text("Essence") [data-lecon-ia-ecarter]'); await attendre();
        const g = await J('st.parametres.leconsIA');
        idGardee = g[0] && g[0].id;
        v('D. « 📌 Garder » : la leçon rejoint « Mes leçons gardées », avec son action et son cycle',
          g.length === 1 && g[0].titre === 'Marjane plus que doublé' && g[0].statut === 'active' && /27 sep → 26 oct/.test(g[0].cycleLabel)
          && /Un seul passage Marjane/.test(await page.textContent('[data-lecons-gardees]')), JSON.stringify(g));
        v('  → « ✕ Écarter » la retire ; il reste une proposition', (await J('st.analyseLecons.propositions.map(x => x.titre)')).join() === 'Petits cafés');
        v('  → dans le document unique, sauvegardé avec le reste (parametres.leconsIA)', (await J('st.parametres.leconsIA.length')) === 1 && /const getExportData = \(\) => \(\{[^\n]*parametres: parametres\.value/.test(html));
        v('  → le bouton dit « ↻ Relancer » : l\'analyse est à jour', /Relancer/.test(await page.textContent('[data-lecons-analyser]')));
    });
    await section('E', async () => {
        await page.evaluate(async (ST) => { const st = eval(ST); st.donneesAnnuelles[2026].transactionsReelles.push({ id: 9010, datetime: '2026-10-14T19:00', date: '2026-10-14', mois: 10, libelle: 'Marjane', montant: 120, categorieId: 'cat_cv_alimentation__dmarjane', compteId: 'acc_cc', source: 'manuel' }); st.calculationTick++; await new Promise(r => setTimeout(r, 300)); }, ST);
        v('E. une nouvelle opération : « ↻ Mettre à jour (nouvelles opérations) »', /Mettre à jour/.test(await page.textContent('[data-lecons-analyser]')));
        ia.lecons = reponse({ bilan: 'Marjane encore en hausse.', lecons: [{ type: 'habitude', titre: 'Le soir', constat: 'Alimentation : 451 DH.', action: 'Liste avant de partir.', categorieId: MERE, enjeu: 100 }],
                              suivis: [{ id: idGardee, verdict: 'pas_tenue', commentaire: 'deux passages Marjane cette semaine' }] });
        await page.click('[data-lecons-analyser]'); await page.waitForSelector('[data-lecon-suivi]', { timeout: 5000 });
        const faits = JSON.parse(ia.requetes.at(-1).question.match(/^FAITS = (.*)$/m)[1]);
        v('  → l\'IA reçoit vos leçons gardées, pour juger si elles sont tenues', faits.vos_lecons_gardees.length === 1 && faits.vos_lecons_gardees[0].id === idGardee, JSON.stringify(faits.vos_lecons_gardees));
        const s = await page.textContent('[data-lecon-suivi]');
        v('  → son verdict s\'affiche sur la leçon : « 👎 Pas tenue ce cycle-ci — deux passages… »', /👎 Pas tenue ce cycle-ci — deux passages Marjane/.test(s), s);
        await page.click('[data-lecon-gardee] [data-lecon-appliquee]'); await attendre();
        v('  → « ✅ Acquise » : elle passe en bas, et n\'est plus envoyée à l\'IA', (await J('st.parametres.leconsIA[0].statut')) === 'appliquee'
          && (await J('st.leconsGardees.filter(l => l.statut !== "appliquee").length')) === 0);
    });
    await section('F', async () => {
        ia.panne = true;
        await page.click('[data-lecons-analyser]'); await page.waitForSelector('[data-lecons-erreur]', { timeout: 5000 });
        v('F. IA injoignable : dit clairement, les signaux calculés restent, l\'analyse précédente aussi',
          /n'a pas répondu/.test(await page.textContent('[data-lecons-erreur]')) && (await page.$$('[data-lecons-signal]')).length > 0 && (await page.$$('[data-lecon-ia]')).length === 1);
        const f = JSON.parse(ia.requetes.at(-1).question.match(/^FAITS = (.*)$/m)[1]);
        v('  → (la leçon « ✅ Acquise » n\'a plus été envoyée à l\'IA)', Array.isArray(f.vos_lecons_gardees) && f.vos_lecons_gardees.length === 0, JSON.stringify(f.vos_lecons_gardees));
        ia.panne = false;
    });
    await section('G', async () => {
        await page.click('[data-journal-vue="date"]'); await attendre();
        await page.click('[data-journal-ligne][data-tx="9001"] [data-journal-ouvrir]'); await attendre();
        ia.note = { output: '{"note": "Marjane à 180 DH : presque le double de mon panier habituel (96 DH), liste obligatoire.", "lecon": true}' };
        await page.click('[data-journal-note-ia]'); await page.waitForSelector('[data-journal-note-ia-proposition]', { timeout: 5000 });
        const faits = JSON.parse(ia.requetes.at(-1).question.match(/^FAITS = (.*)$/m)[1]);
        v('G. « 🧠 Proposer » : l\'IA reçoit l\'historique du même libellé (96, 140, 55, 120 DH)',
          JSON.stringify(faits.meme_libelle_avant.map(x => x.montant).sort((a, b) => a - b)) === '[55,96,120,140]' && faits.operation.montant === 180, JSON.stringify(faits.meme_libelle_avant));
        v('  → la proposition s\'affiche, la note n\'est pas écrasée sans votre clic', (await page.inputValue('[data-journal-edit-note]')) === '');
        await page.click('[data-journal-note-ia-utiliser]'); await attendre();
        v('  → « ✓ Utiliser » remplit la note et coche « 📌 C\'est une leçon »', /presque le double/.test(await page.inputValue('[data-journal-edit-note]')) && await page.isChecked('[data-journal-edit-lecon]'));
        await page.click('[data-journal-enregistrer]'); await attendre();
        const t = await tx(9001);
        v('  → enregistrée sur l\'opération', /presque le double/.test(t.note) && t.lecon === true, JSON.stringify(t));
    });
    await section('H', async () => {
        const tel = await ouvrirPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
        await charger(tel);
        ia.lecons = reponse(LECONS);
        await tel.tap('[data-lecons-analyser]'); await tel.waitForSelector('[data-lecon-ia]', { timeout: 5000 });
        await tel.tap('[data-lecon-ia-garder]'); await tel.waitForTimeout(300);
        await tel.evaluate(() => document.querySelector('[data-lecons-ia]').scrollIntoView());
        const m = await tel.evaluate(() => { const W = window.innerWidth; return { sw: document.documentElement.scrollWidth, trop: [...document.querySelectorAll('[data-journal] *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > W + 1; }).length }; });
        v('H. téléphone 390 px : les leçons de l\'IA tiennent dans l\'écran', m.sw <= 390 && m.trop === 0, JSON.stringify(m));
        if (process.env.CAPTURE) await tel.screenshot({ path: process.env.CAPTURE, fullPage: false });
    });
    v('aucune erreur JavaScript', erreurs.length === 0, erreurs.slice(0, 3).join(' | '));
} finally {
    await browser.close();
    srv.close();
}
console.log('  ' + '─'.repeat(80));
console.log(ko === 0 ? '  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
