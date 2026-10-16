/**
 * v37.57 — LE JOURNAL, OUTIL DE TRAVAIL.
 *   « Le journal n'est pas interactif alors qu'on doit vraiment l'utiliser pour les lessons learned :
 *   répertorier, archiver… une jolie architecture basée sur la praticité, par catégorie. »
 *   Mercredi 14 oct. 2026, paie le 27 : cycle en cours 27 sep → 26 oct, archive 27 août → 26 sep.
 *     A. statique · B. par date (cycle ouvert, archives repliées, jours) · C. chercher / filtrer ·
 *     D. par catégorie (familles, lignes, écart au cycle précédent) · E. corriger sur place, note, leçon,
 *     ressaisir, supprimer · F. leçons · G. une opération sans date · H. téléphone · I. « 7) GOOGLE ».
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
console.log('\n  JOURNAL : CHERCHER, RANGER, CORRIGER, RETENIR\n  ' + '─'.repeat(80));

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
    await page.clock.setFixedTime(new Date(2026, 9, 14, 10, 0, 0));
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
    [9007, '2026-09-28T10:00', 'objet bizarre', 55, null, CC],
];
try {
    await section('A', async () => {
        await page.evaluate(async ({ ST, OPS }) => { const st = eval(ST), d = st.donneesAnnuelles[2026];
            d.transactionsReelles = OPS.map(([id, dt, libelle, montant, cat, compte]) => ({ id, datetime: dt, date: dt.slice(0, 10), mois: Number(dt.slice(5, 7)), libelle, montant, categorieId: cat, compteId: compte, source: 'manuel', categorieSource: 'vous' }));
            d.transactionsReelles.push({ id: 9008, libelle: '7) GOOGLE*AGAINAI', montant: 68, categorieId: 'cat_irr_depense_exceptionnelle', compteId: null, source: 'banque' });
            d.transactionsReelles.find(t => t.id === 9007).aVerifier = true; delete d.transactionsReelles.find(t => t.id === 9007).categorieSource;
            localStorage.removeItem('fm.journal.v1');
            st.journal.periode = 'cycle'; st.journal.vue = 'date';
            st.calculationTick++; st.activeTab = 'saisie'; await new Promise(r => setTimeout(r, 500)); }, { ST, OPS });
        const h = html;
        v('A. trois vues (par date, par catégorie, leçons), recherche, période, filtres catégorie / compte / source / à vérifier',
          ['data-journal-vue', 'data-journal-recherche', 'data-journal-periode', 'data-journal-filtre-cat', 'data-journal-filtre-compte', 'data-journal-filtre-source', 'data-journal-filtre-verifier'].every(x => h.includes(x)));
        v('  → rien de nouveau côté serveur : « note » et « lecon » vivent sur l\'opération, dans le document unique', /t\.note = note/.test(h) && /t\.lecon = true/.test(h) && !/journal_operations/.test(h));
    });
    await section('B', async () => {
        const cy = await page.evaluate(() => [...document.querySelectorAll('[data-journal-cycle]')].map(c => [c.dataset.cycle, c.querySelector('[data-journal-cycle-entete]').textContent.replace(/\s+/g, ' ').trim(), c.querySelectorAll('[data-journal-ligne]').length]));
        v('B. « Ce cycle » : le cycle en cours 27 sep → 26 oct ouvert (4 op.), la ligne sans date en tête, à dater',
          cy.length === 2 && cy[0][0] === '0' && /Sans date/.test(cy[0][1]) && cy[1][0] === '202610' && /Cycle en cours · 27 sep → 26 oct/.test(cy[1][1]) && cy[1][2] === 5, JSON.stringify(cy));
        const jours = await page.evaluate(() => [...document.querySelectorAll('[data-journal-cycle][data-cycle="202610"] [data-journal-jour]')].map(j => j.textContent.replace(/\s+/g, ' ').trim().slice(0, 40)));
        v('  → jour par jour, le plus récent d\'abord, chacun avec son total (hier 13 oct. : 96 + 20 = 116 ; ven. 2 oct)',
          jours.length === 4 && /^Aujourd'hui−180 DH/.test(jours[0]) && /^Hier−116 DH/.test(jours[1]) && /^ven\. 2 oct−300 DH/.test(jours[2]), JSON.stringify(jours));
        await page.click('[data-journal-periode="tout"]'); await attendre();
        const tout = await page.evaluate(() => [...document.querySelectorAll('[data-journal-cycle]')].map(c => [c.dataset.cycle, /Archive/.test(c.textContent), c.querySelectorAll('[data-journal-ligne]').length]));
        v('  → « Tout » : le cycle d\'août-septembre est une ARCHIVE repliée (ses opérations ne s\'affichent pas)',
          JSON.stringify(tout) === JSON.stringify([['0', false, 1], ['202610', false, 5], ['202609', true, 0]]), JSON.stringify(tout));
        await page.click('[data-journal-cycle][data-cycle="202609"] [data-journal-cycle-entete]'); await attendre();
        const ouv = await page.evaluate(() => document.querySelectorAll('[data-journal-cycle][data-cycle="202609"] [data-journal-ligne]').length);
        v('  → un clic déplie l\'archive : 2 opérations (Marjane 140, café 30)', ouv === 2, String(ouv));
        const res = await J('st.journalResume');
        v('  → le résumé : 8 opérations, 889 DH, 1 à vérifier, 1 sans date', res.n === 8 && Math.round(res.total) === 889 && res.aVerifier === 1 && res.sansDate === 1, JSON.stringify(res));
    });
    await section('C', async () => {
        await page.fill('[data-journal-recherche]', 'marjane'); await attendre();
        const r = await page.evaluate(() => [...document.querySelectorAll('[data-journal-ligne]')].map(e => e.dataset.tx));
        v('C. chercher « marjane » : les 3 tickets, archives comprises (dépliées par la recherche)', JSON.stringify(r) === '["9001","9002","9005"]', JSON.stringify(r));
        await page.fill('[data-journal-recherche]', '96'); await attendre();
        v('  → chercher un montant (« 96 ») le trouve', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('[data-journal-ligne]')].map(e => e.dataset.tx))) === '["9002"]');
        await page.fill('[data-journal-recherche]', ''); await page.selectOption('[data-journal-filtre-cat]', MERE); await attendre();
        const f = await J('st.journalFiltrees.map(x => x.t.id)');
        v('  → filtrer « Alimentation » (une famille) prend ses lignes (les 3 Marjane) et ce qui est rangé sur elle (l\'objet bizarre, rangé par défaut)', JSON.stringify(f) === '[9001,9002,9007,9005]', JSON.stringify(f));
        await page.selectOption('[data-journal-filtre-cat]', ''); await page.selectOption('[data-journal-filtre-compte]', ''); await page.check('[data-journal-filtre-verifier]'); await attendre();
        v('  → « à vérifier » seul : l\'objet bizarre', JSON.stringify(await J('st.journalFiltrees.map(x => x.t.id)')) === '[9007]');
        await page.click('[data-journal-effacer]'); await attendre();
        v('  → « effacer les filtres » : tout revient', (await J('st.journalFiltrees.length')) === 8);
    });
    await section('D', async () => {
        await page.click('[data-journal-periode="cycle"]'); await page.click('[data-journal-vue="categorie"]'); await attendre();
        const fams = await page.evaluate(() => [...document.querySelectorAll('[data-journal-famille]')].map(f => [f.dataset.cat, f.querySelector('[data-journal-famille-entete]').textContent.replace(/\s+/g, ' ').trim()]));
        v('D. par catégorie : les familles du plus cher au moins cher (Alimentation 331, Voiture 300…)',
          fams.length >= 3 && fams[0][0] === MERE && fams[1][0] === 'cat_cv_voiture' && /−331 DH/.test(fams[0][1]), JSON.stringify(fams));
        v('  → et l\'écart au cycle précédent : Alimentation ▲ +136 % (331 contre 140), Sorties ▼ −33 % (20 contre 30)',
          /▲ \+136 % vs cycle préc\./.test(fams[0][1]) && fams.some(f => f[0] === 'cat_cv_sorties' && /▼ −33 % vs cycle préc\./.test(f[1])), JSON.stringify(fams));
        await page.click(`[data-journal-famille="${'cat_cv_alimentation'}"] [data-journal-famille-entete]`, { strict: false }).catch(() => page.click('[data-journal-famille][data-cat="cat_cv_alimentation"] [data-journal-famille-entete]'));
        await attendre();
        const lig = await page.evaluate(() => [...document.querySelectorAll('[data-journal-famille][data-cat="cat_cv_alimentation"] [data-journal-ligne-cat]')].map(l => l.textContent.replace(/\s+/g, ' ').trim()));
        v('  → déplier la famille : la ligne Marjane (2 ×, moyenne 138 DH, dernier 14/10, « Marjane ×2 »), puis ce qui est rangé sans ligne',
          lig.length === 2 && /^Marjane2 × · moy\. 138 DH · dernier 14\/10−276 DHMarjane ×2$/.test(lig[0]) && /\(sans ligne\)/.test(lig[1]), JSON.stringify(lig));
        await page.click('[data-journal-famille][data-cat="cat_cv_alimentation"] [data-journal-voir-cat]'); await attendre();
        v('  → un clic sur la ligne : retour à la vue par date, filtrée sur elle', (await J('[st.journal.vue, st.journal.cat, st.journalFiltrees.length]')).join() === 'date,' + MARJ + ',2');
        await page.selectOption('[data-journal-filtre-cat]', ''); await attendre();
    });
    await section('E', async () => {
        await page.click('[data-journal-ligne][data-tx="9002"] [data-journal-ouvrir]'); await attendre();
        v('E. un clic ouvre l\'opération : libellé, montant, date, catégorie, compte, « ce que je retiens »',
          ['data-journal-edit-libelle', 'data-journal-edit-montant', 'data-journal-edit-date', 'data-journal-edit-cat', 'data-journal-edit-compte', 'data-journal-edit-note', 'data-journal-edit-lecon'].every(Boolean)
          && await page.isVisible('[data-journal-ligne][data-tx="9002"] [data-journal-edit-note]'));
        await page.fill('[data-journal-edit-libelle]', 'Marjane Ménara'); await page.fill('[data-journal-edit-montant]', '106,5'.replace(',', '.'));
        await page.fill('[data-journal-edit-note]', 'Samedi soir : panier +40 %, y aller en semaine'); await page.check('[data-journal-edit-lecon]');
        await page.selectOption('[data-journal-edit-compte]', ''); await page.click('[data-journal-enregistrer]'); await attendre();
        const t = await tx(9002);
        v('  → « Enregistrer » : libellé, montant 106,5, compte retiré, note et 📌 leçon écrits sur l\'opération',
          t.libelle === 'Marjane Ménara' && t.montant === 106.5 && t.compteId === null && t.note === 'Samedi soir : panier +40 %, y aller en semaine' && t.lecon === true, JSON.stringify(t));
        v('  → la note s\'affiche sous l\'opération (💡)', /💡 Samedi soir/.test(await page.textContent('[data-journal-ligne][data-tx="9002"]')));
        await page.click('[data-journal-ligne][data-tx="9007"] [data-journal-ouvrir]'); await attendre();
        await page.selectOption('[data-journal-edit-cat]', 'cat_cv_sorties'); await page.click('[data-journal-enregistrer]'); await attendre();
        const t7 = await tx(9007);
        v('  → changer la catégorie : rangée « vous », plus « à vérifier »', t7.categorieId === 'cat_cv_sorties' && t7.categorieSource === 'vous' && !t7.aVerifier, JSON.stringify(t7));
        await page.click('[data-journal-ligne][data-tx="9003"] [data-journal-ouvrir]'); await attendre();
        await page.fill('[data-journal-edit-montant]', '0'); await page.click('[data-journal-enregistrer]'); await attendre();
        v('  → un montant à 0 est refusé (rien n\'est écrit, l\'opération reste ouverte)', (await tx(9003)).montant === 20 && (await J('st.journal.ouvert')) === 9003);
        await page.fill('[data-journal-edit-date]', '2027-01-03T10:00'); await page.fill('[data-journal-edit-montant]', '20'); await page.click('[data-journal-enregistrer]'); await attendre();
        v('  → une date changée d\'année : l\'opération passe dans le seau 2027', (await anDe(9003)) === '2027' && (await tx(9003)).mois === 1, String(await anDe(9003)));
        await page.click('[data-journal-periode="tout"]'); await attendre();
        await page.evaluate((ST) => eval(ST).ouvrirOperation(9005), ST); await attendre();   // le Marjane du 20 sept., dans l'archive
        const avant = await J('st.donneesAnnuelles[2026].transactionsReelles.length');
        await page.click('[data-journal-ressaisir]'); await attendre();
        const copie = await J('st.donneesAnnuelles[2026].transactionsReelles.slice(-1)[0]');
        v('  → « Ressaisir aujourd\'hui » (le Marjane du 20 sept.) : la même dépense, datée de MAINTENANT (14/10 10:00)',
          (await J('st.donneesAnnuelles[2026].transactionsReelles.length')) === avant + 1 && copie.libelle === 'Marjane' && copie.montant === 140 && copie.categorieId === MARJ && copie.datetime === '2026-10-14T10:00', JSON.stringify(copie));
        await page.click(`[data-journal-ligne][data-tx="${copie.id}"] [data-journal-ouvrir]`); await attendre();
        await page.click('[data-journal-supprimer]'); await attendre();
        v('  → « Supprimer » demande confirmation : rien n\'est supprimé au premier clic', !!(await tx(copie.id)) && /Confirmer/.test(await page.textContent('[data-journal-supprimer]')));
        await page.click('[data-journal-supprimer]'); await attendre();
        v('  → second clic : supprimée', !(await tx(copie.id)));
    });
    await section('F', async () => {
        await page.click('[data-journal-vue="lecons"]'); await attendre();
        const l = await page.evaluate(() => [...document.querySelectorAll('[data-journal-lecon]')].map(e => e.textContent.replace(/\s+/g, ' ').trim()));
        v('F. 💡 Leçons : l\'opération annotée, rangée sous sa catégorie, avec sa date et son montant',
          l.length === 1 && /📌 Samedi soir : panier \+40 %/.test(l[0]) && /13\/10\/2026 · Marjane Ménara · −107 DH/.test(l[0]), JSON.stringify(l));
        await page.click('[data-journal-lecon-ouvrir]'); await attendre();
        v('  → « ouvrir » : retour à la vue par date, l\'opération ouverte', (await J('[st.journal.vue, st.journal.ouvert]')).join() === 'date,9002' && await page.isVisible('[data-journal-ligne][data-tx="9002"] [data-journal-edition]'));
        await page.click('[data-journal-ligne][data-tx="9002"] [data-journal-ouvrir]'); await attendre();
    });
    await section('G', async () => {
        await page.click('[data-journal-ligne][data-tx="9008"] [data-journal-ouvrir]'); await attendre();
        await page.fill('[data-journal-edit-date]', '2026-10-07T12:00'); await page.click('[data-journal-enregistrer]'); await attendre();
        const t = await tx(9008);
        v('G. la ligne de banque SANS DATE : datée sur place (07/10), elle rejoint son cycle', t.date === '2026-10-07' && !(await page.$('[data-journal-cycle][data-cycle="0"]')), JSON.stringify(t));
        v('  → les préférences (vue, période) sont retenues sur cet appareil', /"periode":"tout"/.test(await page.evaluate(() => localStorage.getItem('fm.journal.v1') || '')));
    });
    await section('H', async () => {
        const tel = await ouvrirPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
        await tel.evaluate(async ({ ST, OPS }) => { const st = eval(ST), d = st.donneesAnnuelles[2026];
            d.transactionsReelles = OPS.map(([id, dt, libelle, montant, cat, compte]) => ({ id, datetime: dt, date: dt.slice(0, 10), mois: Number(dt.slice(5, 7)), libelle, montant, categorieId: cat, compteId: compte, source: 'manuel' }));
            st.calculationTick++; st.activeTab = 'saisie'; await new Promise(r => setTimeout(r, 500)); }, { ST, OPS });
        await tel.evaluate(() => document.querySelector('[data-journal]').scrollIntoView());
        await tel.tap('[data-journal-ligne][data-tx="9001"] [data-journal-ouvrir]'); await tel.waitForTimeout(300);
        const m = await tel.evaluate(() => { const W = window.innerWidth; return { sw: document.documentElement.scrollWidth, trop: [...document.querySelectorAll('[data-journal] *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > W + 1; }).length }; });
        v('H. téléphone 390 px : le journal et l\'opération ouverte tiennent dans l\'écran (plus de tableau à faire défiler)', m.sw <= 390 && m.trop === 0, JSON.stringify(m));
    });
    await section('I', async () => {
        const a = await page.evaluate((ST) => JSON.parse(JSON.stringify(eval(ST).bqAnalyser('Total des mouvements du 15.07.2026 au 14.10.2026  DÉBIT : 68,00 MAD CRÉDIT : 0,00 MAD\nOCTOBRE 2026\n7) GOOGLE*AGAINAI  - 68,00 MAD', { aujourdhui: new Date(2026, 9, 14) }))), ST);
        v('I. banque : « 7) GOOGLE*AGAINAI » (le jour « 07 » lu « 7) ») prend sa date, 07/10, et un libellé propre',
          a.operations.length === 1 && a.operations[0].dateOp === '2026-10-07' && a.operations[0].libelle === 'GOOGLE*AGAINAI', JSON.stringify(a.operations));
    });
    v('aucune erreur JavaScript', erreurs.length === 0, erreurs.slice(0, 3).join(' | '));
} finally {
    await browser.close();
    srv.close();
}
console.log('  ' + '─'.repeat(80));
console.log(ko === 0 ? '  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
