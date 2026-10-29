/**
 * v37.78 — UNE OPÉRATION DU JOURNAL RANGÉE SUR UNE LIGNE DU PILOTAGE LA RÈGLE.
 *
 *   « Facture élec déjà saisie, mais elle apparaît à 0 dans la partie saisie. »
 *   Décor fictif (KARIM TESTEUR), jeudi 29 oct. 2026, paie le 27 (cycle de novembre : 27 oct. → 26 nov.) :
 *     Factures (mensuel) : elect 200 le 6, tel 99 le 6 ; charge fixe Syndic 300 ; Courses (semaine) : khdra.
 *     A. statique · B. le Pilotage · C. ce qui ne règle rien · D. la case et le journal · E. le Relevé.
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
console.log('\n  UNE OPÉRATION DU JOURNAL RÈGLE SA LIGNE DU PILOTAGE\n  ' + '─'.repeat(80));

v('A. réglé = le plus grand de la case et du journal, pour les lignes du Pilotage seulement ; « par défaut » ne règle rien',
  /const regleParJournal = \(item, cle\) =>/.test(html) && /t\.categorieSource === 'défaut'\) return;/.test(html) && /return j > Math\.abs\(Number\(p\) \|\| 0\) \? sg \* j : p;/.test(html));

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
    d.epargne = []; d.depensesIrregulieres = []; d.virementsInternes = []; d.consoRealiseeT0 = {}; d.consoClotureT0 = {}; d.banqueOperations = {};
    const T = (id, date, libelle, montant, categorieId, extra = {}) => ({ id, datetime: date + 'T12:00', date, mois: Number(date.slice(5, 7)), libelle, montant, categorieId, categorieSource: 'règle', compteId: 'acc_cc', source: 'banque', ...extra });
    d.transactionsReelles = [
        T(1, '2026-10-29', 'Société Régionale Mult', 221, 'cat_cv_factures__delect'),
        T(2, '2026-10-28', 'Orange', 49, 'cat_cv_factures__dtel'),
        T(3, '2026-10-29', 'khdra marché', 20, 'cat_cv_alimentation__dkhdra', { source: 'manuel' }),
        T(4, '2026-10-20', 'Syndic octobre', 300, 'cat_cf_syndic'),                                  // cycle d'octobre
        T(5, '2026-10-29', 'LIBELLE INCONNU', 300, 'cat_cf_syndic', { categorieSource: 'défaut', aVerifier: true }),
    ];
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
await page.clock.setFixedTime(new Date(2026, 9, 29, 12, 0, 0));
page.on('pageerror', e => erreurs.push(String(e)));
await page.route('**/webhook/**', route => route.abort());
await page.goto(`http://127.0.0.1:${port}/finance/`, { waitUntil: 'load' });
await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState.moisBudgetaire; }, null, { timeout: 30000 });
await page.waitForTimeout(1200);
await page.evaluate(async (ST) => { const st = eval(ST); st.appMode = 'reel'; await new Promise(r => setTimeout(r, 250)); st.activeTab = 'pilotage'; await new Promise(r => setTimeout(r, 500)); }, ST);
const taches = () => page.evaluate((ST) => Object.fromEntries(eval(ST).tachesPilotageToutes.map(t => [t.libelle, { paye: t.paye, regle: t.regle, due: t.due }])), ST);

try {
    await section('B', async () => {
        const T = await taches();
        v('B. « elect » 200 : réglée par « Société Régionale Mult » 221 (journal, 29 oct. — cycle de novembre)', T.elect && T.elect.paye === true && T.elect.regle === 221, JSON.stringify(T.elect));
        v('  → « tel » 99 : 49 réglés par Orange, 50 restent (pas « payée »)', T.tel && T.tel.paye === false && T.tel.regle === 49, JSON.stringify(T.tel));
    });
    await section('B2', async () => {
        //  le cas rapporté : prévu 350, 221 payés — la ligne reste « à traiter » et dit ce qui est déjà réglé
        await page.evaluate(async (ST) => { const st = eval(ST); st.donneesAnnuelles[2026].chargesVariables.factures.details[0].montant = 350; st.donneesAnnuelles[2026].chargesVariables.factures.valeur = 449; st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 500)); }, ST);
        const L = await page.evaluate(() => { const ligne = (nom) => [...document.querySelectorAll('[data-par-journal]')].map(e => e.closest('div.flex, div') && e.parentElement).find(p => p && new RegExp('\\b' + nom + '\\b').test(p.textContent));
            const badges = [...document.querySelectorAll('[data-par-journal]')].filter(e => e.offsetParent !== null).map(e => e.textContent.replace(/\s+/g, ' ').trim());
            const places = [...document.querySelectorAll('input[data-saisie]')].filter(e => e.offsetParent !== null).map(e => e.placeholder);
            return { badges, places }; });
        v('B2. prévu 350, 221 payés : la ligne le dit « 🧾 221 réglés » (elect), « 🧾 49 réglés » (tel) ; la case vide propose « 221 🧾 »',
          L.badges.includes('🧾 221 réglés') && L.badges.includes('🧾 49 réglés') && L.places.some(x => /^221 🧾$/.test(x.replace(/\s/g, ' '))), JSON.stringify(L));
        await page.evaluate(async (ST) => { const st = eval(ST); st.donneesAnnuelles[2026].chargesVariables.factures.details[0].montant = 200; st.donneesAnnuelles[2026].chargesVariables.factures.valeur = 299; st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 400)); }, ST);
    });
    await section('C', async () => {
        const T = await taches();
        v('C. « Syndic » : l\'opération du 20 oct. (cycle d\'octobre) et celle rangée « par défaut » ne règlent rien', T.Syndic && T.Syndic.paye === false && T.Syndic.regle === 0, JSON.stringify(T.Syndic));
        const k = await page.evaluate((ST) => { const st = eval(ST); const it = st.donneesAnnuelles[2026].chargesVariables.alimentation.details[0]; return [it.categorieId, st.regleParJournal(it, st.cyclePilotage)]; }, ST);
        v('  → un poste de la semaine (khdra) n\'est pas une ligne : le journal ne le « règle » pas (il a sa saisie)', k[1] === 0 && /khdra/.test(k[0] || ''), JSON.stringify(k));
        const oct = await page.evaluate((ST) => { const st = eval(ST); const it = st.donneesAnnuelles[2026].chargesFixes.syndic; return st.regleParJournal(it, '2026-10'); }, ST);
        v('  → et l\'opération du 20 oct. règle bien le Syndic… du cycle d\'octobre', oct === 300, String(oct));
    });
    await section('D', async () => {
        await page.evaluate(async (ST) => { const st = eval(ST); const it = st.donneesAnnuelles[2026].chargesVariables.factures.details[0]; st.setMontantPayeCycle(it, 221, st.cyclePilotage); await new Promise(r => setTimeout(r, 200)); }, ST);
        let T = await taches();
        v('D. la case « elect » aussi remplie (221) : 221, pas 442 — le même paiement vu deux fois', T.elect.regle === 221 && T.elect.paye, JSON.stringify(T.elect));
        await page.evaluate(async (ST) => { const st = eval(ST); const it = st.donneesAnnuelles[2026].chargesVariables.factures.details[1]; st.setMontantPayeCycle(it, 99, st.cyclePilotage); await new Promise(r => setTimeout(r, 200)); }, ST);
        T = await taches();
        v('  → « tel » : la case dit 99 (tout), le journal 49 : réglée, 99', T.tel.regle === 99 && T.tel.paye, JSON.stringify(T.tel));
    });
    await section('E', async () => {
        await page.evaluate(async (ST) => { const st = eval(ST); const it = st.donneesAnnuelles[2026].chargesVariables.factures.details[1]; st.setMontantPayeCycle(it, 0, st.cyclePilotage); st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 300)); }, ST);
        const L = await page.evaluate((ST) => { const st = eval(ST); const c = st.atterrissageCycle.comptes.find(x => x.courant); return (c.lignes || []).filter(l => /elect|tel|Factures/i.test(l.libelle)).map(l => [l.libelle, Math.round(l.montant)]); }, ST);
        v('E. le Relevé ne projette plus « elect » (déjà sortie du compte) : « Total Factures » = les 50 qui restent sur « tel » (et non 299)',
          L.length === 1 && /Total Factures/.test(L[0][0]) && L[0][1] === 50, JSON.stringify(L));
    });
    v('aucune erreur JavaScript', erreurs.length === 0, erreurs[0] || '');
} finally {
    await browser.close();
    srv.close();
}
console.log(ko === 0 ? '\n  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `\n  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
