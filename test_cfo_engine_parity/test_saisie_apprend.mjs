/**
 * v37.106 — LA SAISIE APPREND DE VOUS, POUR TAPER MOINS.
 *
 *   « Pour l'apprentissage je parlais plus en général de la saisie […] ce n'est pas assez bien fait pour gagner du temps et en
 *   efficacité au fur et à mesure. »
 *
 *   D'après l'historique (6 mois, hors imports) : A. vos habitudes en un appui · B. tout rempli, la catégorie suit, et ça apprend
 *   à chaque saisie · C. l'autocomplétion · D. le montant habituel · E. un libellé avec un chiffre ; l'interrupteur · F. au téléphone.
 *   Décor : vos catégories (celui de la catégorisation), historique FICTIF.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..');
const html = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8').split('\r\n').join('\n');


let ko = 0, n = 0;
const v = (t, ok, d = '') => { n++; if (!ok) ko++; console.log(`  ${ok ? '✅' : '❌'} ${t.padEnd(78)} ${ok ? '' : String(d).slice(0, 600)}`); };
const section = async (nom, f) => { try { await f(); } catch (e) { v(`${nom} : exécution sans exception`, false, String(e && e.stack || e).slice(0, 400)); } };
console.log('\n  LA SAISIE APPREND DE VOUS, POUR TAPER MOINS\n  ' + '─'.repeat(80));

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
    console.log(ko === 0 ? `  ✅ TOUT PASSE — ${n} contrôles` : `  ❌ ${ko} contrôle(s) en échec`);
    process.exit(ko === 0 ? 0 : 1);
}

/* ── Le décor : vos catégories ───────────────────────────────────────── */
const fixture = () => {
    const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8'));
    const base = fx.donneesAnnuelles[Object.keys(fx.donneesAnnuelles)[0]];
    fx.donneesAnnuelles = {};
    for (const an of [2026, 2027]) fx.donneesAnnuelles[an] = JSON.parse(JSON.stringify(base));
    Object.assign(fx.soldesInitiaux, { moisActuel: 10, anneeActuelle: 2026, jourDePaie: 27, compteChargesFixes: 'courant', compteChargesVariables: 'courant',
                                       assurances_tracker: [], voyageDebut: '', voyageFin: '' });
    //  Une catégorie restée au registre, plus portée par aucune ligne
    fx.soldesInitiaux.categories = [{ id: 'cat_cv_alimentation__dmarjane_lait', label: 'Marjane Lait', type: 'charge_variable_detail', parent: 'cat_cv_alimentation', archive: false }];
    fx.comptes = [{ id: 1, label: 'Compte Courant', type: 'courant', solde: 9000, icone: '💳' }];
    const neutre = { paye: false, montantPaye: 0, exceptions: [], showExceptions: false };
    const L = (nom, montant, periode) => ({ nom, montant, ...(periode ? { periode } : {}) });
    for (const an of Object.keys(fx.donneesAnnuelles)) {
        const d = fx.donneesAnnuelles[an];
        const Fx = (label, valeur) => ({ ...neutre, label, valeur, jourPrevu: null });
        d.chargesFixes = { creditImmo: Fx('Crédit Immo + Assur', 5000), creditStudio: Fx('Crédit Studio', 2000), syndic: Fx('Syndic', 300), nounou: Fx('Nounou', 2500),
                           ecole: Fx('École', 1500), femmeMenage: Fx('Femme de ménage', 1200), habitsCharif: Fx('Habits Charif', 300), habitsBebe: Fx('Habits Bébé', 300), jouets: Fx('Jouets', 200) };
        const V = (label, valeur, periode, details) => ({ ...neutre, label, valeur, periode, details });
        d.chargesVariables = {
            alimentation: V('Alimentation (Tqdya)', 0, 'semaine', [L('samak', 75), L('l7m', 75), L('kfta', 150), L('djaj', 40), L('sqata', 150), L('khdra', 200), L('dessert', 100),
                                                                 L('Œufs', 50), L('Marjane ', 400), L('Nuggets', 100), L('lhrri', 1200, 'cycle')]),
            sorties: V('Sorties', 0, 'semaine', [L('cafe Resto Wknd', 400), L('Cafe Charif', 100), L('barber', 60, 'quinzaine')]),
            voiture: V('Voiture', 0, 'semaine', [L('essence picanto', 300), L('diesel skoda', 350), L('Ghsil voiture', 40)]),
            sante: V('Santé', 0, 'semaine', [L('Medicam (reste à charge)', 200, 'cycle'), L('Medecin (reste à charge)', 500, 'cycle'), L('Psy', 500, 'quinzaine'), L('psy charif', 300, 'cycle'), L('complement', 500, 'cycle')]),
            factures: { ...V('Factures', 0, 'mois', [L('elect', 200), L('tel', 99), L('internet', 250), L('eau', 300), L('netflix', 98), L('IA', 500), L('chatgpt', 200)]), categorieId: 'cat_cv_factures' },
        };
        d.epargne = [{ id: 1, nom: 'Alimentation depenses annuels', valeur: 1000, sourceCompte: 'courant', exceptions: [] },
                     { id: 2, nom: 'Épargne courses', valeur: 500, sourceCompte: 'courant', exceptions: [] }];
        d.depensesIrregulieres = []; d.virementsInternes = []; d.consoRealiseeT0 = {};
        //  Deux « Marjane » rangés AUTOMATIQUEMENT par l'ancien moteur dans la catégorie mère,
        //  un « café » dans Sorties, et le « mcdonald s » resté Non catégorisé
        d.transactionsReelles = an !== '2026' ? [] : [
            { id: 501, datetime: '2026-10-10T21:08', date: '2026-10-10', mois: 10, libelle: 'Marjane', montant: 176, categorieId: 'cat_cv_alimentation', compteId: 1, source: 'manuel' },
            { id: 502, datetime: '2026-10-10T21:09', date: '2026-10-10', mois: 10, libelle: 'Marjane', montant: 80, categorieId: 'cat_cv_alimentation', compteId: 1, source: 'manuel' },
            { id: 503, datetime: '2026-10-13T11:03', date: '2026-10-13', mois: 10, libelle: 'mcdonald s', montant: 65, categorieId: 'cat_misc', compteId: 1, source: 'manuel' },
        ];
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
    const s = (c, b, t = 'application/json') => { res.writeHead(c, { 'Content-Type': t }); res.end(b); };
    if (p === '/finance/') return s(200, page0, 'text/html; charset=utf-8');
    if (p === '/vue.js') return s(200, fs.readFileSync(vueJs), 'text/javascript');
    if (p === '/chart.js') return s(200, fs.readFileSync(chartJs), 'text/javascript');
    if (p === '/finance/finance_data.json') return s(200, JSON.stringify(fixture2()));
    return s(200, '{"status":"ok"}');
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port;
const browser = await pw.chromium.launch({ executablePath: chromium, args: ['--no-sandbox'] });
const ST = 'document.querySelector("#app").__vue_app__._instance.setupState';

//  L'historique (fictif) : ce que la saisie doit apprendre — et ce qu'elle doit ignorer
const tx = (id, ymd, libelle, montant, extra = {}) => ({ id, datetime: ymd + 'T10:00', date: ymd, mois: Number(ymd.slice(5, 7)), libelle, montant, categorieId: 'cat_misc', compteId: 1, source: 'manuel', ...extra });
const HISTO = [
    tx(1001, '2026-10-12', 'Cafe Charif', 25), tx(1002, '2026-10-11', 'Cafe Charif', 25), tx(1003, '2026-10-09', 'Cafe Charif', 30), tx(1004, '2026-10-07', 'Cafe Charif', 25), tx(1005, '2026-10-05', 'Cafe Charif', 25),
    tx(1011, '2026-10-06', 'diesel skoda', 300), tx(1012, '2026-09-29', 'diesel skoda', 300), tx(1013, '2026-09-22', 'diesel skoda', 280),
    tx(1021, '2026-10-10', 'Voyage marrakech station service', 60), tx(1022, '2026-10-10', 'Voyage marrakech diesel', 120), tx(1023, '2026-09-12', 'Voyage marrakech diesel', 120),
    tx(1031, '2026-10-08', 'Habit charif 2', 30), tx(1032, '2026-09-20', 'Habit charif 2', 30),
    tx(1041, '2026-01-05', 'abonnement salle', 200), tx(1042, '2026-02-05', 'abonnement salle', 200),                 // plus de 6 mois : oublié
    tx(1051, '2026-10-09', 'MARJANE MARRAKECH', 350, { source: 'banque' }), tx(1052, '2026-10-02', 'MARJANE MARRAKECH', 300, { source: 'banque' }),   // import : pas une saisie
    tx(1061, '2026-10-03', 'cadeau anniversaire', 150),                                                               // une seule fois : pas une habitude
];
const fixture2 = () => { const fx = fixture(); fx.donneesAnnuelles[2026].transactionsReelles = JSON.parse(JSON.stringify(HISTO)); return fx; };

const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
await page.clock.setFixedTime(new Date(2026, 9, 13, 12, 0, 0));   // mardi 13 octobre 2026
const erreurs = []; page.on('pageerror', e => erreurs.push(String(e)));
page.on('dialog', d => d.accept());
await page.route('**/webhook/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ output: '{"id": null, "confiance": "basse", "raison": "test"}' }) }));
await page.goto(`http://127.0.0.1:${port}/finance/`, { waitUntil: 'load' });
await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState.moisBudgetaire; }, null, { timeout: 30000 });
//  les données du décor sont arrivées (l'appli démarre d'abord sur un état vide : sous charge, le serveur répond après)
await page.waitForFunction((ST) => { const st = eval(ST); return (st.donneesAnnuelles[2026]?.transactionsReelles || []).some(t => t.id === 1001); }, ST, { timeout: 30000 });
await page.evaluate(async (ST) => { const st = eval(ST); st.appMode = 'reel'; await Vue.nextTick(); st.activeTab = 'saisie'; await Vue.nextTick(); }, ST);
const CHAMP = 'input[placeholder="Ex: 200 courses"]';
await page.waitForSelector(CHAMP, { state: 'visible', timeout: 10000 });
const etat = () => page.evaluate((ST) => { const st = eval(ST); return JSON.parse(JSON.stringify({ texte: st.saisieRapide, montant: st.saisieForm.montant, libelle: st.saisieForm.libelle, cat: st.saisieForm.categorieId })); }, ST);
const puces = () => page.$$eval('[data-saisie-habitudes]:not(.-mt-1) [data-saisie-habitude]', l => l.map(b => b.textContent.replace(/\s+/g, ' ').trim()));
const completions = () => page.$$eval('[data-saisie-completions] [data-saisie-completer]', l => l.map(b => b.textContent.replace(/\s+/g, ' ').trim()));
const taper = async (t) => { await page.fill(CHAMP, t); await page.evaluate(() => Vue.nextTick()); };

try {
    await section('A', async () => {
        await page.waitForSelector('[data-saisie-habitudes] [data-saisie-habitude]', { state: 'visible', timeout: 10000 });
        const p = await puces();
        v('A. champ vide : « ⚡ Vos habitudes », les plus fréquentes et récentes d’abord (Cafe Charif · 25 DH, diesel skoda · 300 DH)',
          p[0] === 'Cafe Charif · 25 DH' && p.includes('diesel skoda · 300 DH') && p.includes('Voyage marrakech diesel · 120 DH') && p.length <= 6, JSON.stringify(p));
        v('  → ni un libellé de plus de 6 mois, ni un import bancaire, ni une saisie faite une seule fois', !p.some(x => /abonnement|MARJANE|cadeau/.test(x)), JSON.stringify(p));
    });
    await section('B', async () => {
        await page.click('[data-saisie-habitudes]:not(.-mt-1) [data-saisie-habitude][data-cle="diesel skoda"]');
        await page.waitForFunction((ST) => eval(ST).saisieForm.montant === 300, ST, { timeout: 5000 });
        const e = await etat();
        v('B. un appui sur « diesel skoda · 300 DH » : tout est rempli (« diesel skoda 300 »), la catégorie suit (diesel skoda)', e.texte === 'diesel skoda 300' && e.montant === 300 && e.libelle === 'diesel skoda' && /diesel_skoda/.test(e.cat), JSON.stringify(e));
        v('  → les habitudes s’effacent dès que le champ est rempli', !(await page.$('[data-saisie-habitudes]:not(.-mt-1)')));
        await page.locator(CHAMP).press('Enter');
        await page.waitForFunction((ST) => eval(ST).saisieRapide === '', ST, { timeout: 5000 });
        const n = await page.evaluate((ST) => eval(ST).donneesAnnuelles[2026].transactionsReelles.filter(t => t.libelle === 'diesel skoda').length, ST);
        const h = await page.evaluate((ST) => (eval(ST).habitudesSaisie.find(x => x.cle === 'diesel skoda') || {}).n, ST);
        v('  → Entrée : enregistrée ; l’habitude compte maintenant 4 fois (elle apprend à chaque saisie)', n === 4 && h === 4, JSON.stringify([n, h]));
    });
    await section('C', async () => {
        await taper('voy');
        const c = await completions();
        v('C. « voy » : vos libellés passés qui commencent ainsi, avec catégorie et montant habituel', c.length === 2 && c.some(x => /^Voyage marrakech station service.*60 DH$/.test(x)) && c.some(x => /^Voyage marrakech diesel.*120 DH$/.test(x)), JSON.stringify(c));
        await page.click('[data-saisie-completions] [data-saisie-completer][data-cle="voyage marrakech station service"]');
        let e = await etat();
        v('  → un appui complète : « Voyage marrakech station service 60 », la liste se ferme', e.texte === 'Voyage marrakech station service 60' && e.montant === 60 && (await completions()).length === 0, JSON.stringify(e));
        await taper('45 voy'); await page.click('[data-saisie-completions] [data-saisie-completer][data-cle="voyage marrakech diesel"]');
        e = await etat();
        v('  → « 45 voy » puis « Voyage marrakech diesel » : le montant tapé (45) est gardé', e.libelle === 'Voyage marrakech diesel' && e.montant === 45, JSON.stringify(e));
        await taper('café ch');
        v('  → accents et majuscules ne comptent pas : « café ch » → Cafe Charif', (await completions()).some(x => /^Cafe Charif/.test(x)), JSON.stringify(await completions()));
    });
    await section('D', async () => {
        await taper('cafe charif');
        await page.waitForSelector('[data-saisie-montant-habituel]', { state: 'visible', timeout: 5000 });
        const b = (await page.textContent('[data-saisie-montant-habituel]')).replace(/\s+/g, ' ').trim();
        v('D. « cafe charif » sans montant : « 💡 25 DH d’habitude » (et plus de liste : le libellé est complet)', /💡 25 DH d.habitude/.test(b) && (await completions()).length === 0, b);
        await page.click('[data-saisie-montant-habituel]');
        const e = await etat();
        v('  → un appui met 25 DH', e.montant === 25 && e.libelle === 'cafe charif', JSON.stringify(e));
    });
    await section('E', async () => {
        await taper('');
        await page.click('[data-saisie-habitudes]:not(.-mt-1) [data-saisie-habitude][data-cle="habit charif 2"]');
        const e = await etat();
        v('E. un libellé avec un chiffre (« Habit charif 2 ») : le montant reste 30, le « 2 » reste dans le libellé', e.montant === 30 && e.libelle === 'Habit charif 2', JSON.stringify(e));
        await taper('');
        await page.evaluate((ST) => eval(ST).basculerApprentissage(), ST); await page.evaluate(() => Vue.nextTick());
        const off = await page.$('[data-saisie-habitudes]');
        await page.evaluate((ST) => eval(ST).basculerApprentissage(), ST); await page.evaluate(() => Vue.nextTick());
        v('  → l’apprentissage coupé (🧠) : plus d’habitudes proposées ; rallumé : elles reviennent', !off && !!(await page.$('[data-saisie-habitudes]')));
    });
    await section('F', async () => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.evaluate(async (ST) => { const st = eval(ST); st.openSaisieQuickModal(); await Vue.nextTick(); }, ST);
        await page.waitForSelector('.fixed.inset-0.z-\\[80\\] [data-saisie-habitude]', { state: 'visible', timeout: 5000 });
        await page.click('.fixed.inset-0.z-\\[80\\] [data-saisie-habitude][data-cle="cafe charif"]');
        v('F. au téléphone (saisie rapide) : les mêmes habitudes, un appui → « Cafe Charif 25 »', (await etat()).texte === 'Cafe Charif 25');
        await page.evaluate((ST) => eval(ST).closeSaisieQuickModal(), ST);
        v('aucune erreur JavaScript', erreurs.length === 0, erreurs[0] || '');
    });
} catch (e) {
    v('exécution sans exception', false, String(e && e.stack || e).slice(0, 400));
} finally {
    await browser.close(); srv.close();
}
console.log('  ' + '─'.repeat(80));
console.log(ko === 0 ? `  ✅ TOUT PASSE — ${n} contrôles` : `  ❌ ${ko} contrôle(s) en échec sur ${n}`);
process.exit(ko === 0 ? 0 : 1);
