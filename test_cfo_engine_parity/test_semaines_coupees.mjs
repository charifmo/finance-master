/**
 * v37.65 — LES SEMAINES COUPÉES PAR LA PAIE.
 *
 *   « Vérifie les semaines qui tombent sur 2 cycles : ce n'est pas clair quoi rentrer et jusqu'à quand ;
 *   l'appli me propose le réalisé sur une semaine même si elle est partagée entre 2 cycles. »
 *   Paie le 27. Mardi 27 oct. 2026, jour de paie : le cycle de novembre court du 27 oct. au 26 nov. (31 jours).
 *   La semaine du 26 oct. au 1ᵉʳ nov. se saisit en deux morceaux : « le 26 oct. » (cycle d'octobre) et
 *   « du 27 oct. au 1ᵉʳ nov. » (6 jours, cycle de novembre) ; celle du 23 au 29 nov. aussi (4 jours | 3 jours).
 *   Prévus : Marjane 600 / sem, Resto 400 / sem, Essence 300 / sem. Calculs faits à la main :
 *     • novembre = 4 sem. 3 j : Marjane 600 × 31 / 7 = 2 657 ; morceau de 6 jours : 600 × 6 / 7 = 514 ;
 *     • « le 26 oct. » : 600 / 7 = 86 ; « du 23 au 26 nov. » : 600 × 4 / 7 = 343 ;
 *     • 514 + 600 + 600 + 600 + 343 = 2 657 : tenir son prévu à chaque morceau = tenir le budget du cycle ;
 *     • Pain 10 / sem (44 sur le cycle) : 8,57 · 10 · 10 · 10 · 5,71 → 8 · 10 · 10 · 10 · 6 — le dirham d'arrondi
 *       va au plus fort reste (5,71), pas au premier morceau.
 *     A. statique · B. les morceaux d'un cycle · C. la carte, le jour de paie · D. saisir chaque morceau dans
 *     son cycle · E. les tickets du cycle = ceux de ses jours · F. le Relevé coupé à la veille de la paie ·
 *     G. v37.66 : les saisies faites AVANT la paie restent au cycle qui finit (schéma 21 : la v37.65 les avait
 *        re-rangées au jour de paie, elles reviennent au lundi) ·
 *     H. le titre dit ce qu'on voit (« Début du cycle », « Cycle précédent ») ; plus de note à déplier.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..');
const html = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8').split('\r\n').join('\n');

let ko = 0;
const v = (t, ok, d = '') => { if (!ok) ko++; console.log(`  ${ok ? '✅' : '❌'} ${t.padEnd(64)} ${ok ? '' : d}`); };
const section = async (nom, f) => { try { await f(); } catch (e) { v(`${nom} : exécution sans exception`, false, String(e && e.stack || e).slice(0, 300)); } };
console.log('\n  SEMAINES COUPÉES PAR LA PAIE : CHAQUE MORCEAU DANS SON CYCLE\n  ' + '─'.repeat(80));

/* ── A. Statique ─────────────────────────────────────────────────────── */
v('A. plus de « règle du jeudi » : aucun calcul ne cherche le jeudi d\'une semaine',
  !/\(4 - debut\.getDay\(\) \+ 7\) % 7/.test(html) && !/_jeudiISO/.test(html));
v('  → un cycle compte ses jours (÷ 7) ; schéma 21 ; les saisies d\'avant la paie rendues au cycle qui finit',
  /const semainesDuCycle = \(mois, an\) => joursDuCycle\(mois, an\) \/ 7;/.test(html) && /_schemaVersion: (2[1-9]|[3-9]\d),/.test(html) && /const _nSemCoupees = migrerSemainesCoupees\(data\);/.test(html));
const php = fs.readFileSync(path.join(RACINE, 'cfo_intent_engine.php'), 'utf8');
v('  → le serveur (recalcul de secours) suit la même règle', /return cfo_jours_cycle\(\$m, \$an, \$jdp\) \/ 7;/.test(php) && !/\$jeudi/.test(php));

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

/* ── Le décor ────────────────────────────────────────────────────────── */
const MARJANE = 'alimentation::1', RESTO = 'sorties::1', ESSENCE = 'voiture::1';
const fixture = () => {
    const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8'));
    delete fx._schemaVersion;                                   // des données d'avant la v37.65
    const base = fx.donneesAnnuelles[Object.keys(fx.donneesAnnuelles)[0]];
    fx.donneesAnnuelles = {};
    for (const an of [2026, 2027]) fx.donneesAnnuelles[an] = JSON.parse(JSON.stringify(base));
    Object.assign(fx.soldesInitiaux, { moisActuel: 10, anneeActuelle: 2026, jourDePaie: 27, compteChargesFixes: 'courant', compteChargesVariables: 'courant',
                                       assurances_tracker: [], voyageDebut: '', voyageFin: '' });
    fx.soldesInitiaux.categories = [];
    fx.comptes = [{ id: 'acc_cc', label: 'Compte Courant', type: 'liquide', solde: 30000, icone: '💳' }];
    const neutre = { paye: false, montantPaye: 0, exceptions: [], showExceptions: false };
    for (const an of Object.keys(fx.donneesAnnuelles)) {
        const d = fx.donneesAnnuelles[an];
        const Rv = (label, b, j) => ({ ...neutre, label, base: b, jourPrevu: j, destinationCompte: 'courant' });
        d.revenus = { salaire: Rv('SALAIRE', 20000, 27), bonif: Rv('—', 0), magasin: Rv('—', 0), cnss: Rv('—', 0), appart: Rv('—', 0), studio: Rv('—', 0) };
        const Fx = (label, valeur) => ({ ...neutre, label, valeur, jourPrevu: null });
        d.chargesFixes = { creditImmo: Fx('—', 0), creditStudio: Fx('—', 0), syndic: Fx('—', 0), nounou: Fx('—', 0),
                           ecole: Fx('—', 0), femmeMenage: Fx('—', 0), habitsCharif: Fx('—', 0), habitsBebe: Fx('—', 0), jouets: Fx('—', 0) };
        const V = (label, cat, details) => ({ ...neutre, label, valeur: 0, periode: 'semaine', categorieId: cat, details });
        d.chargesVariables = {
            alimentation: V('Courses', 'cat_cv_alimentation', [{ id: 1, nom: 'Marjane', montant: 600, categorieId: 'cat_cv_alimentation__dmarjane' }]),
            sorties: V('Sorties', 'cat_cv_sorties', [{ id: 1, nom: 'Resto', montant: 400 }]),
            voiture: V('Voiture', 'cat_cv_voiture', [{ id: 1, nom: 'Essence', montant: 300 }]),
            sante: V('Boulangerie', 'cat_cv_sante', [{ id: 1, nom: 'Pain', montant: 10 }]),
            factures: { ...neutre, label: 'Factures', valeur: 0, periode: 'mois', details: [], categorieId: 'cat_cv_factures' },
        };
        d.epargne = []; d.depensesIrregulieres = []; d.virementsInternes = []; d.banqueOperations = {};
        d.transactionsReelles = an !== '2026' ? [] : [
            //  la veille de la paie (lundi 26 oct.) : cycle d'octobre ; le jour de paie : cycle de novembre
            { id: 701, date: '2026-10-26', mois: 10, libelle: 'MARJANE', montant: 120, compteId: 'acc_cc', categorieId: 'cat_cv_alimentation__dmarjane' },
            { id: 702, date: '2026-10-27', mois: 10, libelle: 'MARJANE', montant: 80, compteId: 'acc_cc', categorieId: 'cat_cv_alimentation__dmarjane' },
        ];
        //  Des saisies faites avant la v37.65 (clé = le lundi, règle du jeudi)
        d.consoRealiseeT0 = an !== '2026' ? {} : {
            'S2026-10-19': { [MARJANE]: 590 },          // semaine entière du cycle d'octobre : ne bouge pas
            'S2026-10-26': { [RESTO]: 150 },            // tapé AVANT la paie (mardi 27) : les jours d'avant la paie, cycle d'octobre
            'S2026-11-23': { [ESSENCE]: 0 },            // paie le VENDREDI 27 nov. : c'était déjà la partie d'avant
        };
        d.consoClotureT0 = an !== '2026' ? {} : { 'S2026-10-26': { [ESSENCE]: true } };
    }
    return fx;
};
//  Le téléphone a besoin des vraies classes (hidden md:block) : Tailwind compilé si présent
const twBin = path.join(RACINE, 'node_modules/.bin/tailwindcss');
let twCss = '';
if (fs.existsSync(twBin)) {
    const { execFileSync } = await import('node:child_process');
    const tmp = fs.mkdtempSync(path.join((await import('node:os')).tmpdir(), 'tw-sc-'));
    fs.writeFileSync(path.join(tmp, 'in.css'), '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
    fs.writeFileSync(path.join(tmp, 'cfg.js'), 'module.exports={content:[' + JSON.stringify(path.join(RACINE, 'index.html')) + '],theme:{extend:{}}};');
    essai(() => execFileSync(twBin, ['-c', path.join(tmp, 'cfg.js'), '-i', path.join(tmp, 'in.css'), '-o', path.join(tmp, 'out.css'), '--minify'], { stdio: 'ignore' }));
    twCss = essai(() => fs.readFileSync(path.join(tmp, 'out.css'), 'utf8')) || '';
}
const page0 = html
    .replace('<script src="https://unpkg.com/vue@3/dist/vue.global.js"', '<script src="/vue.js"')
    .replace('<script src="https://cdn.jsdelivr.net/npm/chart.js"', '<script src="/chart.js"')
    .replace(/<script src="https:\/\/cdn\.tailwindcss\.com"[^>]*><\/script>/, twCss ? '<link rel="stylesheet" href="/tw.css">' : '')
    .replace(/<script[^>]*src="https:\/\/[^"]*"[^>]*><\/script>/g, '');
const srv = http.createServer((req, res) => {
    const p = req.url.split('?')[0];
    const s = (c, b, t = 'application/json') => { res.writeHead(c, { 'Content-Type': t }); res.end(b); };
    if (p === '/finance/') return s(200, page0, 'text/html; charset=utf-8');
    if (p === '/tw.css') return s(200, twCss, 'text/css');
    if (p === '/vue.js') return s(200, fs.readFileSync(vueJs), 'text/javascript');
    if (p === '/chart.js') return s(200, fs.readFileSync(chartJs), 'text/javascript');
    if (p === '/finance/finance_data.json') return s(200, JSON.stringify(fixture()));
    return s(200, '{"status":"ok"}');
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port;
const browser = await pw.chromium.launch({ executablePath: chromium, args: ['--no-sandbox'] });
const ST = 'document.querySelector("#app").__vue_app__._instance.setupState';
const erreurs = [], envois = [];
const ouvrirPage = async (quand, opts = { viewport: { width: 1280, height: 900 } }) => {
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    await page.clock.setFixedTime(quand);
    page.on('pageerror', e => erreurs.push(String(e)));
    await page.route('**/webhook/**', route => route.abort());
    page.on('request', r => { if (r.method() === 'POST' && /save_data\.php/.test(r.url())) envois.push(r.postData()); });
    await page.goto(`http://127.0.0.1:${port}/finance/`, { waitUntil: 'load' });
    await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState.moisBudgetaire; }, null, { timeout: 30000 });
    await page.waitForTimeout(600);
    await page.evaluate(async (ST) => { const st = eval(ST); st.appMode = 'previsionnel'; await new Promise(r => setTimeout(r, 250)); st.activeTab = 'pilotageTheo'; }, ST);
    await page.waitForTimeout(500);
    return page;
};
//  La carte « Par semaine » telle que la Météo la calcule
const carte = (page) => page.evaluate((ST) => {
    const st = eval(ST), L = st.liberteCycle, s = L.semaine;
    const poste = (cat, cle) => { const c = L.categories.find(x => x.key === cat); const p = c && c.sem.postes.find(x => x.cle === cle); return p ? { budget: p.budget, saisi: p.saisi, tickets: p.tickets, engage: p.engage } : null; };
    return JSON.parse(JSON.stringify({ du: s.du, au: s.au, debut: s.debut, fin: s.fin, jours: s.jours, coupe: s.coupe, autre: s.autre, rang: s.rang, nb: s.nb, dans: s.dansCycle, rel: s.cycleRel,
        cloture: s.cloture, statut: s.statut, budget: s.budget, marjane: poste('alimentation', 'alimentation::1'), resto: poste('sorties', 'sorties::1'), essence: poste('voiture', 'voiture::1'),
        pain: poste('sante', 'sante::1') }));
}, ST);
const texte = (page, sel) => page.evaluate((sel) => [...document.querySelectorAll(sel)].filter(e => e.offsetParent !== null).map(e => e.textContent.replace(/\s+/g, ' ').trim()), sel);
const naviguer = async (page, d) => { await page.evaluate(({ ST, d }) => eval(ST).changerSemaine(d), { ST, d }); await page.waitForTimeout(250); };

try {
    const page = await ouvrirPage(new Date(2026, 9, 27, 10, 0, 0));

    /* ── B. Les morceaux d'un cycle ─────────────────────────────────────── */
    await section('B', async () => {
        const B = await page.evaluate((ST) => {
            const st = eval(ST), j = (m, a) => st.morceauxDuCycle(m, a).map(x => x.jours);
            const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            return { nov: j(11, 2026), oct: j(10, 2026), dec: j(12, 2026), bornesNov: st.morceauxDuCycle(11, 2026).map(x => iso(x.debut) + '→' + iso(x.fin)),
                     libNov: st.libSemaines(st.semainesDuCycle(11, 2026)), libOct: st.libSemaines(st.semainesDuCycle(10, 2026)), annee: st.semainesDeLAnnee(2026) * 7 };
        }, ST);
        v('B. novembre (27 oct. → 26 nov.) : 6 + 7 + 7 + 7 + 4 jours = 31, soit « 4 sem. 3 j »',
          B.nov.join('+') === '6+7+7+7+4' && B.libNov === '4 sem. 3 j', JSON.stringify(B));
        v('  → ses morceaux : du 27 oct. (mardi, la paie) au 1ᵉʳ nov., …, du 23 au 26 nov. (veille de paie)',
          B.bornesNov[0] === '2026-10-27→2026-11-01' && B.bornesNov[4] === '2026-11-23→2026-11-26', B.bornesNov.join(' '));
        v('  → octobre (27 sept. → 26 oct.) : 1 + 7 × 4 + 1 = 30 jours (« 4 sem. 2 j ») ; décembre : 3 + 7 × 3 + 6',
          B.oct.join('+') === '1+7+7+7+7+1' && B.libOct === '4 sem. 2 j' && B.dec.join('+') === '3+7+7+7+6', JSON.stringify([B.oct, B.dec]));
        v('  → l\'année 2026 : 365 jours (et non 52 ou 53 semaines entières)', Math.round(B.annee) === 365, String(B.annee));
    });

    /* ── C. La carte, le jour de paie ─────────────────────────────────── */
    await section('C', async () => {
        const c = await carte(page);
        v('C. le jour de paie, la carte s\'ouvre sur « du 27 oct. au 1 nov. » : 6 jours, morceau 1/5 de novembre',
          c.debut === '2026-10-27' && c.fin === '2026-11-01' && c.jours === 6 && c.coupe && c.rang === 1 && c.nb === 5 && c.dans && c.statut === 'en_cours', JSON.stringify(c));
        v('  → prévus au prorata de 6 jours : Marjane 514, Resto 343, Essence 257, Pain 8 (600, 400, 300, 10 × 6/7)',
          c.marjane.budget === 514 && c.resto.budget === 343 && c.essence.budget === 257 && c.pain.budget === 8 && c.budget === 1122, JSON.stringify([c.marjane, c.resto, c.essence, c.pain, c.budget]));
        const t = await texte(page, '[data-semaine-titre]'), n = await page.$$('[data-semaine-coupee]');
        v('  → l\'écran : « Début du cycle · mar. 27 oct. → dim. 1 nov. · 6 j »', t.length === 1 && t[0] === 'Début du cycle · mar. 27 oct. → dim. 1 nov. · 6 j', t[0]);
        v('  → plus de note « semaine coupée » qui embrouillait : le titre dit les dates à taper', n.length === 0, String(n.length));
    });

    /* ── D. Saisir chaque morceau dans son cycle ─────────────────────── */
    await section('D', async () => {
        const saisiCycle = () => page.evaluate((ST) => { const st = eval(ST); const c = st.liberteCycle.categories.find(x => x.key === 'alimentation'); return { saisi: c.saisi, cle: Object.keys(st.donneesAnnuelles[2026].consoRealiseeT0) }; }, ST);
        const avant = await saisiCycle();
        await page.evaluate((ST) => eval(ST).saisirSemaineConso('2026-10-27', 'alimentation::1', 450), ST); await page.waitForTimeout(250);
        const apres = await saisiCycle();
        v('D. Marjane 450 tapé « du 27 oct. au 1 nov. » : rangé sous le jour de paie, compté en novembre',
          apres.cle.includes('S2026-10-27') && apres.saisi === avant.saisi + 450 && avant.saisi === 0, JSON.stringify([avant, apres]));
        await naviguer(page, -1);
        const p = await carte(page);
        v('  → ‹ : « le 26 oct. », 1 jour, du cycle précédent ; Marjane y prévoit 86 (600 / 7) ; clôture la veille de paie',
          p.debut === '2026-10-26' && p.fin === '2026-10-26' && p.jours === 1 && !p.dans && p.rel === 'precedent' && p.rang === null && p.marjane.budget === 86
          && p.cloture === 'Le 26 oct. au soir (veille de paie)' && p.autre && p.autre.rel === 'suivant', JSON.stringify(p));
        const t = await texte(page, '[data-semaine-titre]');
        v('  → l\'écran : « Cycle précédent · lun. 26 oct. · 1 j »', t.length === 1 && t[0] === 'Cycle précédent · lun. 26 oct. · 1 j', t[0]);
        const eng0 = await page.evaluate((ST) => eval(ST).consoEngageeT0, ST);
        await page.evaluate((ST) => eval(ST).saisirSemaineConso('2026-10-26', 'alimentation::1', 70), ST); await page.waitForTimeout(250);
        const eng1 = await page.evaluate((ST) => eval(ST).consoEngageeT0, ST);
        v('  → 70 tapé le 26 oct. : rangé à part, ne touche pas le cycle de novembre', eng1 === eng0, `${eng0} → ${eng1}`);
        await naviguer(page, 0);
        for (let k = 0; k < 4; k++) await naviguer(page, 1);
        const f = await carte(page);
        v('  → › × 4 : « du 23 au 26 nov. », 4 jours, morceau 5/5 ; Marjane 343 (600 × 4/7) ; clôture le 26 nov. au soir',
          f.debut === '2026-11-23' && f.fin === '2026-11-26' && f.jours === 4 && f.rang === 5 && f.marjane.budget === 343 && f.cloture === 'Le 26 nov. au soir (veille de paie)' && f.autre.du === '27 nov.' && f.autre.au === '29 nov.',
          JSON.stringify(f));
        const parts = [], pains = [];
        await naviguer(page, 0);
        for (let k = 0; k < 5; k++) { const c = await carte(page); parts.push(c.marjane.budget); pains.push(c.pain.budget); await naviguer(page, 1); }
        const somme = { b: await page.evaluate((ST) => eval(ST).liberteCycle.categories.find(x => x.key === 'alimentation').budget, ST), parts };
        v('  → 514 + 600 + 600 + 600 + 343 = 2 657 = le budget Marjane du cycle (600 × 31 / 7)',
          somme.b === 2657 && somme.parts.join('+') === '514+600+600+600+343' && somme.parts.reduce((s, x) => s + x, 0) === somme.b, JSON.stringify(somme));
        v('  → Pain 10 / sem : 8 + 10 + 10 + 10 + 6 = 44 — le dirham d\'arrondi au plus fort reste (5,71), pas au premier (8,57)',
          pains.join('+') === '8+10+10+10+6', JSON.stringify(pains));
        await naviguer(page, 0);
    });

    /* ── E. Les tickets du cycle = ceux de ses jours ───────────────────── */
    await section('E', async () => {
        const T = await page.evaluate((ST) => { const c = eval(ST).liberteCycle.categories.find(x => x.key === 'alimentation'); return JSON.parse(JSON.stringify({ total: c.tickets, tx: c.transactions.map(x => x.montant) })); }, ST);
        v('E. le ticket MARJANE du 27 oct. (80) compte en novembre ; celui de la veille (26 oct., 120), en octobre',
          T.total === 80 && T.tx.join() === '80', JSON.stringify(T));
        const c = await carte(page);
        v('  → la carte du 27 oct. : Marjane max(450 tapé, 80 de tickets) = 450', c.marjane.tickets === 80 && c.marjane.engage === 450, JSON.stringify(c.marjane));
    });

    /* ── F. Le Relevé coupé à la veille de la paie ─────────────────────── */
    await section('F', async () => {
        const L = await page.evaluate((ST) => JSON.parse(JSON.stringify(eval(ST).semainesVariablesDuCycle(12, 2026, 3000).map(l => l.libelle.replace('🛒 Charges variables — ', '') + ' = ' + l.montant))), ST);
        v('F. décembre, 3 000 DH : 300 + 700 + 700 + 700 + 600 — au prorata des jours (3, 7, 7, 7, 6)',
          L.join(' | ') === 'semaine du 27 nov. au 29 nov. = 300 | semaine du 30 nov. au 6 déc. = 700 | semaine du 7 déc. au 13 déc. = 700 | semaine du 14 déc. au 20 déc. = 700 | semaine du 21 déc. au 26 déc. = 600', L.join(' | '));
        const R = await page.evaluate((ST) => { const st = eval(ST), c = st.atterrissageCycle.comptes.find(x => x.courant); return c.lignes.filter(l => /Charges variables/.test(l.libelle)).map(l => l.libelle); }, ST);
        v('  → le cycle en cours finit « du 23 nov. au 26 nov. » (plus de semaine qui déborde après la paie)',
          R.length === 5 && R[0] === '🛒 Charges variables — semaine en cours (jusqu’au 1 nov.)' && R[4] === '🛒 Charges variables — semaine du 23 nov. au 26 nov.', R.join(' | '));
    });

    /* ── G. Les saisies faites avant la paie restent au cycle qui finit ────── */
    await section('G', async () => {
        const G = await page.evaluate((ST) => { const d = eval(ST).donneesAnnuelles[2026]; return JSON.parse(JSON.stringify({ r: d.consoRealiseeT0, c: d.consoClotureT0 })); }, ST);
        v('G. la saisie « S2026-10-26 » (Resto 150, tapée avant la paie) reste le 26 — au cycle d\'octobre',
          (G.r['S2026-10-26'] || {})['sorties::1'] === 150 && !('sorties::1' in (G.r['S2026-10-27'] || {})), JSON.stringify(G.r));
        v('  → sa case close aussi ; la semaine du 19 oct. et celle du 23 nov. ne bougent pas',
          (G.c['S2026-10-26'] || {})['voiture::1'] === true && !G.c['S2026-10-27'] && (G.r['S2026-10-19'] || {})['alimentation::1'] === 590 && (G.r['S2026-11-23'] || {})['voiture::1'] === 0, JSON.stringify(G));
        const c = await carte(page);
        v('  → la carte du 27 oct. (novembre) ne la compte pas : Resto 0', c.resto.saisi === 0, JSON.stringify(c.resto));
        await naviguer(page, -1);
        const p = await carte(page);
        await naviguer(page, 0);
        v('  → ‹ « Cycle précédent · lun. 26 oct. » : Resto 150', p.resto.saisi === 150 && p.debut === '2026-10-26', JSON.stringify(p.resto));
        await page.waitForTimeout(2600);
        const dernier = envois.length ? JSON.parse(envois[envois.length - 1]) : null;
        v('  → l\'envoi au VPS porte le schéma 21 ou plus (22 depuis la v37.67)', !!dernier && dernier._schemaVersion >= 21 && !!dernier.donneesAnnuelles['2026'].consoRealiseeT0['S2026-10-26'], dernier ? String(dernier._schemaVersion) : 'aucun envoi');
        const trois = await page.evaluate((ST) => {
            const st = eval(ST), D = (v, k) => ({ ...(v ? { _schemaVersion: v } : {}), soldesInitiaux: { jourDePaie: 27 }, donneesAnnuelles: { 2026: { consoRealiseeT0: { [k]: { x: 1 } }, consoClotureT0: { [k]: { x: true } } } } });
            const v20 = D(20, 'S2026-10-27'), v19 = D(0, 'S2026-10-26'), v21 = D(21, 'S2026-10-27');
            const n = [st.migrerSemainesCoupees(v20), st.migrerSemainesCoupees(v19), st.migrerSemainesCoupees(v21)];
            return { n, v20: [Object.keys(v20.donneesAnnuelles[2026].consoRealiseeT0), Object.keys(v20.donneesAnnuelles[2026].consoClotureT0)],
                     v19: Object.keys(v19.donneesAnnuelles[2026].consoRealiseeT0), v21: Object.keys(v21.donneesAnnuelles[2026].consoRealiseeT0) };
        }, ST);
        v('  → schéma 20 (re-rangé par la v37.65) : rendu au lundi 26 (saisies et cases closes) ; schéma 19 et 21 : rien ne bouge',
          JSON.stringify(trois) === JSON.stringify({ n: [2, 0, 0], v20: [['S2026-10-26'], ['S2026-10-26']], v19: ['S2026-10-26'], v21: ['S2026-10-27'] }), JSON.stringify(trois));
    });
    await page.context().close();

    /* ── H. Au téléphone : le titre suffit, rien à déplier ─────────────────── */
    if (twCss) await section('H', async () => {
        const tel = await ouvrirPage(new Date(2026, 9, 27, 10, 0, 0), { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
        const t = await texte(tel, '[data-semaine-titre]');
        v('H. téléphone : « Début du cycle · mar. 27 oct. → dim. 1 nov. · 6 j », sans note à déplier',
          t.length === 1 && t[0] === 'Début du cycle · mar. 27 oct. → dim. 1 nov. · 6 j' && !(await tel.$('[data-semaine-coupee]')), JSON.stringify(t));
        await tel.context().close();
    });
    v('aucune erreur JavaScript', erreurs.length === 0, erreurs[0] || '');
} catch (e) {
    v('exécution sans exception', false, String(e && e.stack || e).slice(0, 400));
} finally { await browser.close(); srv.close(); }

console.log(ko === 0 ? '  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
