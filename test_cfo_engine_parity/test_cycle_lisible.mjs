/**
 * v37.77 — LE CYCLE SE LIT COMME LE RELEVÉ.
 *
 *   « Le journal est plus parlant que ton truc : rendre le gros chiffre compréhensible, voir dans quelles
 *     cases j'ai dépassé, pourquoi le Courant sera négatif le 30 nov., et les jours du mois au lieu des J-X. »
 *   Décor fictif (KARIM TESTEUR), jeudi 12 nov. 2026, paie le 27 :
 *     • Courses : Marjane 600 / semaine (700 tapés du 27 oct. au 1ᵉʳ nov. : dépassé), Psy 400 / quinzaine ;
 *     • Épargne LT 1 000 : un choc de 6 000 le 15 nov., 8 000 reçus du Livret le 22 → − 5 000 le 15.
 *     A. statique · B. le Relevé daté · C. pourquoi ce point bas · D. les dépassements dans la Météo · E. le zoom.
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
const t = (s) => String(s || '').replace(/\s+/g, ' ').trim();
console.log('\n  LE CYCLE SE LIT COMME LE RELEVÉ\n  ' + '─'.repeat(80));

v('A. Relevé : colonne « Date », plus aucun « J.x » ; le pourquoi du point bas ; le calcul du Reste à dépenser ; les dépassements',
  (html.match(/>Date<\/th>/g) || []).length >= 2 && !/'J\.' \+ e\.jourPrevu|'j\.' \+ e\.jourPrevu/.test(html)
  && /data-radar-pourquoi/.test(html) && /data-meteo-virement-pourquoi/.test(html) && /data-pulse-calcul-clair/.test(html) && /data-meteo-depassements/.test(html));
v('  → un compte de « Vos comptes » ouvre son Relevé (les 3 Météo branchées)', (html.match(/@frise="friseOuverte = true" @releve="ouvrirReleve"/g) || []).length === 3 && /@click="\$emit\('releve', c\.key\)"/.test(html));

const require = createRequire(import.meta.url);
const essai = (f) => { try { return f(); } catch { return null; } };
const pw = essai(() => require('playwright-core'));
const vueJs = essai(() => require.resolve('vue/dist/vue.global.js'));
const chartJs = essai(() => fs.existsSync(path.join(RACINE, 'node_modules/chart.js/dist/chart.umd.js')) && path.join(RACINE, 'node_modules/chart.js/dist/chart.umd.js'));
const chromium = process.env.CHROMIUM || ['/opt/pw-browsers/chromium'].find(p => essai(() => fs.existsSync(p) && fs.statSync(p).isFile()));
if (!pw || !vueJs || !chartJs || !chromium) {
    console.log('  ⏭️  partie navigateur ignorée (playwright-core, vue, chart.js ou Chromium absent)');
    console.log(ko === 0 ? '  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `  ❌ ${ko} contrôle(s) en échec`);
    process.exit(ko === 0 ? 0 : 1);
}

const MARJANE = 'alimentation::1', PSY = 'alimentation::2';
const fixture = () => {
    const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8'));
    fx._schemaVersion = 24;
    const base = fx.donneesAnnuelles[Object.keys(fx.donneesAnnuelles)[0]];
    fx.donneesAnnuelles = { 2026: JSON.parse(JSON.stringify(base)), 2027: JSON.parse(JSON.stringify(base)) };
    Object.assign(fx.soldesInitiaux, { moisActuel: 11, anneeActuelle: 2026, jourDePaie: 27, compteChargesFixes: 'courant', compteChargesVariables: 'courant', assurances_tracker: [], voyageDebut: '', voyageFin: '' });
    fx.soldesInitiaux.categories = [];
    fx.comptes = [{ id: 800, label: 'Compte Courant', type: 'liquide', solde: 30000, icone: '💳' },
                  { id: 801, label: 'Épargne Long Terme', type: 'epargne', solde: 1000, icone: '🐷' },
                  { id: 802, label: 'Livret Réserve', type: 'epargne', solde: 30000, icone: '🏦' }];
    const neutre = { paye: false, montantPaye: 0, exceptions: [], showExceptions: false };
    for (const an of Object.keys(fx.donneesAnnuelles)) {
        const d = fx.donneesAnnuelles[an];
        const Rv = (label, b, j) => ({ ...neutre, label, base: b, jourPrevu: j, destinationCompte: 'courant' });
        d.revenus = { salaire: Rv('SALAIRE', 20000, 27), bonif: Rv('—', 0), magasin: Rv('—', 0), cnss: Rv('—', 0), appart: Rv('—', 0), studio: Rv('—', 0) };
        const Fx = (label, valeur) => ({ ...neutre, label, valeur, jourPrevu: null });
        d.chargesFixes = { creditImmo: Fx('—', 0), creditStudio: Fx('—', 0), syndic: Fx('—', 0), nounou: Fx('—', 0), ecole: Fx('—', 0), femmeMenage: Fx('—', 0), habitsCharif: Fx('—', 0), habitsBebe: Fx('—', 0), jouets: Fx('—', 0) };
        const V = (label, cat, details) => ({ ...neutre, label, valeur: 0, periode: 'semaine', categorieId: cat, details });
        d.chargesVariables = {
            alimentation: V('Courses', 'cat_cv_alimentation', [{ id: 1, nom: 'Marjane', montant: 600, periode: 'semaine' }, { id: 2, nom: 'Psy', montant: 400, periode: 'quinzaine' }]),
            factures: { ...neutre, label: 'Factures', valeur: 0, periode: 'mois', details: [], categorieId: 'cat_cv_factures' },
        };
        d.epargne = []; d.banqueOperations = {}; d.transactionsReelles = []; d.consoClotureT0 = {};
        d.depensesIrregulieres = an === '2026' ? [{ id: 701, mois: 11, annee: 2026, nom: 'Travaux', montant: 6000, sourceCompte: 'cpt_801', jourPrevu: 15, paye: false, montantPaye: 0 }] : [];
        d.virementsInternes = an === '2026' ? [{ id: 702, mois: 11, sourceCompte: 'cpt_802', destinationCompte: 'cpt_801', montant: 8000, jourPrevu: 22 }] : [];
        d.consoRealiseeT0 = an !== '2026' ? {} : { 'S2026-10-27': { [MARJANE]: 700, [PSY]: 400 }, 'S2026-11-02': { [MARJANE]: 600 }, 'S2026-11-09': { [MARJANE]: 300, [PSY]: 400 } };
    }
    return fx;
};
const page0 = html
    .replace('<script src="https://unpkg.com/vue@3/dist/vue.global.js"', '<script src="/vue.js"')
    .replace('<script src="https://cdn.jsdelivr.net/npm/chart.js"', '<script src="/chart.js"')
    .replace(/<script src="https:\/\/cdn\.tailwindcss\.com"[^>]*><\/script>/, '')
    .replace(/<script[^>]*src="https:\/\/[^"]*"[^>]*><\/script>/g, '');
const srv = http.createServer((req, res) => {
    const p = req.url.split('?')[0];
    const s = (c, b, ty = 'application/json') => { res.writeHead(c, { 'Content-Type': ty }); res.end(b); };
    if (p === '/finance/') return s(200, page0, 'text/html; charset=utf-8');
    if (p === '/vue.js') return s(200, fs.readFileSync(vueJs), 'text/javascript');
    if (p === '/chart.js') return s(200, fs.readFileSync(chartJs), 'text/javascript');
    if (p === '/finance/finance_data.json') return s(200, JSON.stringify(fixture()));
    return s(200, '{"status":"ok"}');
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port;
const browser = await pw.chromium.launch({ executablePath: chromium, args: ['--no-sandbox'] });
const ST = 'document.querySelector("#app").__vue_app__._instance.setupState';
const erreurs = [];
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
await page.clock.setFixedTime(new Date(2026, 10, 12, 10, 0, 0));
page.on('pageerror', e => erreurs.push(String(e)));
await page.route('**/webhook/**', route => route.abort());
await page.goto(`http://127.0.0.1:${port}/finance/`, { waitUntil: 'load' });
await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState.moisBudgetaire; }, null, { timeout: 30000 });
await page.waitForTimeout(1200);
const aller = (mode, onglet) => page.evaluate(async ({ ST, mode, onglet }) => { const st = eval(ST); st.appMode = mode; await new Promise(r => setTimeout(r, 250)); st.activeTab = onglet; await new Promise(r => setTimeout(r, 700)); }, { ST, mode, onglet });

try {
    await section('B', async () => {
        const D = await page.evaluate((ST) => { const st = eval(ST);
            return [st.dateReleve({ jourPrevu: 30, cycle: '12-2026' }), st.dateReleve({ jourPrevu: 5, cycle: '12-2026' }), st.dateReleve({ jourPrevu: 28, cycle: '11-2026' }),
                    st.dateReleve({ jourPrevu: 31, cycle: '3-2026' }), st.dateReleve({ jourPrevu: 29, cycle: '1-2027' }), st.dateReleve({ jourPrevu: null }), st.dateReleve({ jourPrevu: 6 })]; }, ST);
        v('B. le jour du mois : 30 du cycle de déc. → « lun. 30 nov. » ; 5 → « sam. 5 déc. » ; 28 du cycle de nov. → « mer. 28 oct. »',
          D[0] === 'lun. 30 nov.' && D[1] === 'sam. 5 déc.' && D[2] === 'mer. 28 oct.', JSON.stringify(D));
        v('  → 31 du cycle de mars → « sam. 28 févr. » (fin du mois) ; 29 du cycle de janv. 2027 → « mar. 29 déc. » (2026) ; sans jour : rien ; sans cycle : le cycle en cours',
          D[3] === 'sam. 28 févr.' && D[4] === 'mar. 29 déc.' && D[5] === '' && D[6] === 'ven. 6 nov.', JSON.stringify(D));
        await page.evaluate(async (ST) => { eval(ST).ouvrirReleve('cpt_801'); await new Promise(r => setTimeout(r, 600)); }, ST);
        const R = await page.evaluate(() => [...document.querySelectorAll('table tbody tr')].filter(r => r.offsetParent !== null && r.cells.length >= 5)
            .map(r => ({ d: r.cells[0].textContent.trim(), l: r.textContent.replace(/\s+/g, ' ') })).filter(x => /Travaux|Virement/.test(x.l)));
        v('  → le Relevé de l\'Épargne LT : « Travaux » le « dim. 15 nov. », le virement reçu le « dim. 22 nov. »',
          R.some(x => /Travaux/.test(x.l) && x.d === 'dim. 15 nov.') && R.some(x => /Virement reçu/.test(x.l) && x.d === 'dim. 22 nov.') && !R.some(x => /^j\.|^J\./.test(x.d)), JSON.stringify(R));
        await page.evaluate(async (ST) => { eval(ST).showReleveModal = false; await new Promise(r => setTimeout(r, 200)); }, ST);
    });

    await section('C', async () => {
        const P = await page.evaluate((ST) => JSON.parse(JSON.stringify((eval(ST).radarComptes.comptes.find(c => c.key === 'cpt_801') || {}).pourquoi || null)), ST);
        v('C. pourquoi le point bas de l\'Épargne LT : le 15 nov., 6 000 de sorties (Travaux), avant le virement reçu le 22 nov.',
          P && P.depuis === '15 nov.' && P.jusque === '15 nov.' && P.sorties === 6000 && P.principales[0].libelle === 'Travaux' && P.entrees[0].quand === '22 nov.' && /Virement reçu/.test(P.entrees[0].libelle), JSON.stringify(P));
        await aller('previsionnel', 'pilotageTheo');
        const txt = await page.evaluate(() => [...document.querySelectorAll('[data-radar-pourquoi]')].filter(e => e.offsetParent !== null).map(e => e.textContent.replace(/\s+/g, ' ').trim()));
        v('  → écrit sous le compte dans « Sécurité des comptes »', txt.length >= 1 && /^Pourquoi \? Le 15 nov\., 6 000 DH de sorties \(Travaux 6 000 DH\) avant les prochaines entrées : Virement reçu ← Livret Réserve 8 000 DH le 22 nov\.$/.test(txt[0].replace(/ | /g, ' ')), JSON.stringify(txt));
        await aller('reel', 'pilotage');
        const vb = await page.evaluate(() => [...document.querySelectorAll('[data-meteo-virement-pourquoi]')].filter(e => e.offsetParent !== null).map(e => e.textContent.replace(/\s+/g, ' ').trim()));
        v('  → et dans la grande case des virements', vb.length === 1 && /^Pourquoi : 6 000 DH de sorties le 15 nov\., avant Virement reçu ← Livret Réserve le 22 nov\.$/.test(vb[0].replace(/ | /g, ' ')), JSON.stringify(vb));
    });

    await section('D', async () => {
        const M = await page.evaluate(() => { const b = document.querySelector('[data-meteo-depassements]');
            return { vu: !!b && b.offsetParent !== null, lignes: b ? [...b.querySelectorAll('[data-meteo-depassement]')].map(e => e.textContent.trim()) : [], titre: b ? b.querySelector('p').textContent.replace(/\s+/g, ' ').trim() : '',
                     badge: document.querySelector('[data-frise-nb-depassements]')?.textContent.trim() }; });
        v('D. la Météo montre les cases dépassées (les mêmes que la frise) : Marjane 700 pour 514, et le Psy',
          M.vu && /^⚠️ 2 dépassements ce cycle/.test(M.titre) && M.lignes.some(l => /^🟠 Marjane : 700 DH pour 514 prévus/.test(l)) && M.lignes.some(l => /Psy/.test(l)) && M.badge === '· ⚠️ 2', JSON.stringify(M));
        await page.click('[data-meteo-depassements-frise]'); await page.waitForTimeout(400);
        const F = await page.evaluate(() => document.querySelectorAll('[data-frise] [data-frise-alerte]').length);
        v('  → « voir dans la frise » l\'ouvre sur ses 2 alertes', F === 2, String(F));
        await page.click('[data-frise-fermer]'); await page.waitForTimeout(200);
    });

    await section('E', async () => {
        await page.click('[data-meteo] [data-meteo-atterrissage][data-compte="cpt_801"]'); await page.waitForTimeout(400);
        const Z = await page.evaluate((ST) => { const st = eval(ST); return { ouvert: st.showReleveModal, filtre: JSON.parse(JSON.stringify(st.releveComptesFiltres)) }; }, ST);
        v('E. un clic sur « Épargne LT » dans « Vos comptes » : son Relevé s\'ouvre, filtré sur lui', Z.ouvert === true && JSON.stringify(Z.filtre) === '["cpt_801"]', JSON.stringify(Z));
    });
    v('aucune erreur JavaScript', erreurs.length === 0, erreurs[0] || '');
} finally {
    await browser.close();
    srv.close();
}
console.log(ko === 0 ? '\n  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `\n  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
