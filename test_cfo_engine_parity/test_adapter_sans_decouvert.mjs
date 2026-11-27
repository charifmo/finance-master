/**
 * v37.154 — « ⚖️ ADAPTER AU POTENTIEL » NE MET PLUS LE COMPTE SOURCE À DÉCOUVERT, ET MONTRE AVANT D'APPLIQUER.
 *   Vécu : « Alimentation Dépenses Annuelles & Projets » adaptée au potentiel → 22 210 versés en décembre depuis ASSAFA,
 *   qui finissait à −12 217. Le potentiel est un budget théorique (entrées − sorties du mois) et le reste des mois d'avant
 *   s'accumulait sur le dernier. Décor fictif, jeudi 29 oct. 2026, paie le 27 (cycle de novembre en cours) : le salaire de
 *   novembre est déjà reçu et en partie dépensé (Courant à 15 000), le potentiel théorique de chaque mois est ≈ 18 000.
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
console.log('\n  ADAPTER AU POTENTIEL SANS DÉCOUVERT, AVEC APERÇU\n  ' + '─'.repeat(80));

v('A. l\'adaptation lit le point bas du compte source au Relevé et réduit le mois versé au plus près ; le bouton ⚖️ ouvre un aperçu',
  /const _basDuCompte = \(a, cle\) =>/.test(html) && /const proposerAdaptation = /.test(html) && /data-apercu-adaptation/.test(html)
  && (html.match(/@click="proposerAdaptation\(obj, anneeAffichage, plafondAdaptation\[obj\.id\]\)"/g) || []).length === 2);
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

const fixture = () => {
    const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8'));
    fx._schemaVersion = 24;
    const base = fx.donneesAnnuelles[Object.keys(fx.donneesAnnuelles)[0]];
    fx.donneesAnnuelles = { 2026: JSON.parse(JSON.stringify(base)) };
    Object.assign(fx.soldesInitiaux, { moisActuel: 11, anneeActuelle: 2026, jourDePaie: 27, compteChargesFixes: 'courant', compteChargesVariables: 'courant', assurances_tracker: [], voyageDebut: '', voyageFin: '' });
    fx.soldesInitiaux.categories = [];
    fx.comptes = [{ id: 'acc_cc', label: 'Compte Courant', type: 'liquide', solde: 9000, icone: '💳' }];
    const neutre = { paye: false, montantPaye: 0, exceptions: [], showExceptions: false };
    const d = fx.donneesAnnuelles[2026];
    const Rv = (label, b, j) => ({ ...neutre, label, base: b, jourPrevu: j, destinationCompte: 'courant' });
    d.revenus = { salaire: Rv('SALAIRE', 20000, 27), bonif: Rv('—', 0), magasin: Rv('—', 0), cnss: Rv('—', 0), appart: Rv('—', 0), studio: Rv('—', 0) };
    const Fx = (label, valeur, j) => ({ ...neutre, label, valeur, jourPrevu: j });
    d.chargesFixes = { creditImmo: Fx('—', 0), creditStudio: Fx('—', 0), syndic: Fx('Syndic', 300, 10), nounou: Fx('—', 0), ecole: Fx('—', 0), femmeMenage: Fx('—', 0), habitsCharif: Fx('—', 0), habitsBebe: Fx('—', 0), jouets: Fx('—', 0) };
    d.chargesVariables = {
        alimentation: { ...neutre, label: 'Courses', valeur: 0, periode: 'semaine', details: [{ nom: 'khdra', montant: 200, periode: 'semaine' }] },
        factures: { ...neutre, label: 'Factures', valeur: 299, periode: 'mois', details: [{ nom: 'elect', montant: 200, jourPrevu: 6 }, { nom: 'tel', montant: 99, jourPrevu: 6 }] },
    };
    d.epargne = [{ id: 7, nom: 'Alimentation Dépenses Annuelles & Projets', valeur: 3000, sourceCompte: 'courant', linkedAccountId: 'acc_da', exceptions: [] }];
    fx.comptes = [{ id: 'acc_cc', label: 'Compte Courant', type: 'liquide', solde: 15000, icone: '💳' }, { id: 'acc_da', label: 'Dépenses Annuelles & Projets', type: 'epargne', solde: 0, icone: '💰' }];
    d.revenus.salaire.trackerRealise = { '2026-11': { paye: true, montantPaye: 0 } };   // le salaire de novembre est déjà sur le compte (et presque dépensé)
    d.depensesIrregulieres = []; d.virementsInternes = []; d.consoRealiseeT0 = {}; d.consoClotureT0 = {}; d.banqueOperations = {};
    const T = (id, date, libelle, montant, categorieId, extra = {}) => ({ id, datetime: date + 'T12:00', date, mois: Number(date.slice(5, 7)), libelle, montant, categorieId, categorieSource: 'règle', compteId: 'acc_cc', source: 'banque', ...extra });
    d.transactionsReelles = []; const _ancien = [
        T(1, '2026-10-29', 'Société Régionale Mult', 221, 'cat_cv_factures__delect'),
        T(2, '2026-10-28', 'Orange', 49, 'cat_cv_factures__dtel'),
        T(3, '2026-10-29', 'khdra marché', 20, 'cat_cv_alimentation__dkhdra', { source: 'manuel' }),
        T(4, '2026-10-20', 'Syndic octobre', 300, 'cat_cf_syndic'),                                  // cycle d'octobre
        T(5, '2026-10-29', 'LIBELLE INCONNU', 300, 'cat_cf_syndic', { categorieSource: 'défaut', aVerifier: true }),
    ]; void _ancien;
    fx.donneesAnnuelles[2027] = JSON.parse(JSON.stringify(d));
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
const browser = await pw.chromium.launch({ executablePath: chromium, args: ['--no-sandbox', '--force-prefers-reduced-motion'] });
const ST = 'document.querySelector("#app").__vue_app__._instance.setupState';
const erreurs = [];
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
await page.clock.setFixedTime(new Date(2026, 9, 29, 12, 0, 0));
page.on('pageerror', e => erreurs.push(String(e)));
await page.route('**/webhook/**', route => route.abort());
await page.goto(`http://127.0.0.1:${port}/finance/`, { waitUntil: 'load' });
await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState.moisBudgetaire; }, null, { timeout: 30000 });
await page.waitForTimeout(1200);
await page.evaluate(async (ST) => { const st = eval(ST); st.appMode = 'reel'; await new Promise(r => setTimeout(r, 250)); st.activeTab = 'pilotage'; await new Promise(r => setTimeout(r, 500)); }, ST);
const taches = () => page.evaluate((ST) => Object.fromEntries(eval(ST).tachesPilotageToutes.map(t => [t.libelle, { paye: t.paye, regle: t.regle, due: t.due }])), ST);

try {
    const E = (f, ...a) => page.evaluate(({ ST, f, a }) => { const st = eval(ST); return new Function('st', 'a', 'return (' + f + ')(st, ...a)')(st, a); }, { ST, f: f.toString(), a });
    const attendre = (ms) => page.waitForTimeout(ms);
    let P;
    await section('B', async () => {
        P = await E((st) => { const ep = st.donneesAnnuelles[2026].epargne[0], vir = (st.donneesAnnuelles[2026].virementsInternes || []).length;
            const pr = st.proposerAdaptation(ep, 2026);
            return { lignes: pr.lignes.map(l => [l.mois, l.actuel, l.propose, l.plafonne]), basAvant: pr.basAvant, basApres: pr.basApres, compte: pr.compte,
                     excApres: JSON.stringify(ep.exceptions), ap: !!ep.adapteePotentiel, vir: (st.donneesAnnuelles[2026].virementsInternes || []).length === vir }; });
        console.log('    aperçu :', JSON.stringify(P));
        v('B. l\'aperçu propose novembre et décembre, et en RÉDUIT au moins un (sans la garde, le Courant passait sous zéro)',
          P.lignes.length === 2 && P.lignes.some(l => l[3] !== null && l[3] > l[2]), JSON.stringify(P));
        v('  → point bas du Courant après : ≥ 0', P.basApres !== null && P.basApres >= 0, JSON.stringify(P));
        v('  → calcul À BLANC : rien n\'a changé (exceptions, adaptation, virements)', P.excApres === '[]' && !P.ap && P.vir, JSON.stringify(P));
        await attendre(300);
        const vu = await page.$$eval('[data-apercu-adaptation] [data-apercu-ligne]', els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()));
        const red = await page.$$eval('[data-apercu-plafonne]', els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()));
        v('  → la fenêtre montre les 2 mois, actuel et proposé, et dit pourquoi un mois est réduit (« Compte Courant resterait ≥ 0 »)',
          vu.length === 2 && red.length >= 1 && /resterait ≥ 0/.test(red[0]), JSON.stringify({ vu, red }));
    });
    await section('C', async () => {
        await page.click('[data-apercu-annuler]'); await attendre(200);
        const R = await E((st) => ({ ouvert: !!st.propositionAdaptation, exc: JSON.stringify(st.donneesAnnuelles[2026].epargne[0].exceptions) }));
        v('C. Annuler : la fenêtre se ferme, rien n\'est appliqué', !R.ouvert && R.exc === '[]' && (await page.$$('[data-apercu-adaptation]')).length === 0, JSON.stringify(R));
        await E((st) => { st.appMode = 'previsionnel'; st.activeTab = 'wealth'; }); await attendre(600);
        await page.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));
        await page.locator('[data-adapter-potentiel]:visible').first().click(); await attendre(400);
        v('  → le bouton ⚖️ « Adapter au potentiel » ouvre l\'aperçu (il n\'applique plus directement)',
          (await page.$$('[data-apercu-adaptation]')).length === 1 && await E((st) => JSON.stringify(st.donneesAnnuelles[2026].epargne[0].exceptions) === '[]'));
    });
    await section('D', async () => {
        await page.click('[data-apercu-valider]'); await attendre(500);
        const R = await E((st) => { const ep = st.donneesAnnuelles[2026].epargne[0];
            return { v11: st.valeurEffective(ep, ep.valeur, 11), v12: st.valeurEffective(ep, ep.valeur, 12), plaf: ep.adapteePotentiel && ep.adapteePotentiel.plafonnes, ouvert: !!st.propositionAdaptation }; });
        v('D. Valider : appliqué tel que montré (novembre ' + P.lignes[0][2] + ', décembre ' + P.lignes[1][2] + '), la réduction est notée sur l\'adaptation',
          !R.ouvert && R.v11 === P.lignes[0][2] && R.v12 === P.lignes[1][2] && R.plaf && Object.keys(R.plaf).length >= 1, JSON.stringify(R));
        const bas = await E((st) => st.basDuCompteAdapte(2026, st.cleDeCompte('courant')));
        v('  → le Relevé du Courant, cycle par cycle : novembre et décembre jamais sous zéro', bas[11] >= 0 && bas[12] >= 0, JSON.stringify(bas));
    });
    await section('E', async () => {
        //  le chemin direct (CFO, « Recalibrer l'année ») a la même garde
        const R = await E((st) => { const ep = st.donneesAnnuelles[2026].epargne[0]; st.retirerAdaptationEpargne(ep); const v = st.adapterEpargneAuPotentiel(ep, 2026); return { v, plaf: ep.adapteePotentiel.plafonnes }; });
        v('E. appel direct (CFO, recalibrage) : mêmes montants, même garde', R.v[11] === P.lignes[0][2] && R.v[12] === P.lignes[1][2] && Object.keys(R.plaf).length >= 1, JSON.stringify(R));
    });
    await section('F', async () => {
        //  un Courant à découvert MÊME SANS cette épargne : 0 versé, et l'aperçu le dit (plutôt que de faire semblant)
        const R = await E((st) => { const ep = st.donneesAnnuelles[2026].epargne[0]; st.retirerAdaptationEpargne(ep); st.comptes[0].solde = 1000; st.forceUpdateCalculations();
            const pr = st.proposerAdaptation(ep, 2026); return { propose: pr.lignes.map(l => l.propose), sousZero: pr.sousZero.map(z => z.nom) }; });
        await page.waitForTimeout(300);
        const msg = await page.$$eval('[data-apercu-sous-zero]', els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()));
        v('F. Courant à 1 000 (sous zéro même sans épargne) : rien n\'est versé, et la fenêtre dit « reste sous zéro … même sans cette épargne »',
          JSON.stringify(R.propose) === '[0,0]' && R.sousZero.length >= 1 && msg.length >= 1 && /même sans cette épargne/.test(msg[0]), JSON.stringify({ R, msg }));
        await page.click('[data-apercu-annuler]');
    });
    v('aucune erreur JavaScript', erreurs.length === 0, erreurs[0] || '');
} finally {
    await browser.close();
    srv.close();
}
console.log(ko === 0 ? '\n  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `\n  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
