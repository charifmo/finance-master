/**
 * v37.105 — LE COMPTE SUIT LA CATÉGORIE, ET VOS CHOIX SONT RETENUS.
 *
 *   « Quand je change de catégorie, le compte qui est lié à la catégorie se sélectionne automatiquement ; et il faut améliorer
 *   l'apprentissage, ça va me permettre d'être plus efficace et gagner du temps. »
 *
 *   Décor FICTIF : Compte Courant (défaut), Compte Principale ASSAFA (la charge « Voiture », l'épargne), Espèces (la source de
 *   « Voyage Marrakech »). A. le compte d'une catégorie · B. journal : le compte suit · C. à l'écran, un compte choisi à la main
 *   ne bouge plus et il est retenu · D. la fois suivante ; « Ce que l'appli a appris » ; oublier · E. revenir au compte de la
 *   ligne · F. la saisie.
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
const v = (t, ok, d = '') => { n++; if (!ok) ko++; console.log(`  ${ok ? '✅' : '❌'} ${t.padEnd(78)} ${ok ? '' : String(d).slice(0, 700)}`); };
const section = async (nom, f) => { try { await f(); } catch (e) { v(`${nom} : exécution sans exception`, false, String(e && e.stack || e).slice(0, 400)); } };
console.log('\n  LE COMPTE SUIT LA CATÉGORIE, ET VOS CHOIX SONT RETENUS\n  ' + '─'.repeat(80));

v('statique : le compte d\u2019une catégorie, retenu, branché sur la saisie, le journal et la frise',
  /const compteDeLaCategorie = \(catId\) =>/.test(html) && /const retenirCompteCategorie = /.test(html) && (html.match(/@change="compteBrouillonModifie\(\)"/g) || []).length === 2 && /data-apprentissage-comptes/.test(html));

const require = createRequire(import.meta.url);
const essai = (f) => { try { return f(); } catch { return null; } };
const pw = essai(() => require('playwright-core'));
const vueJs = essai(() => require.resolve('vue/dist/vue.global.js'));
const chartJs = path.join(RACINE, 'node_modules/chart.js/dist/chart.umd.js');
const chromium = process.env.CHROMIUM || '/opt/pw-browsers/chromium';
if (!pw || !vueJs || !fs.existsSync(chartJs) || !fs.existsSync(chromium)) {
    console.log('  ⏭️  partie navigateur ignorée (playwright-core, vue, chart.js ou Chromium absent)');
    console.log(ko === 0 ? `  ✅ TOUT PASSE — ${n} contrôles` : `  ❌ ${ko} contrôle(s) en échec`);
    process.exit(ko === 0 ? 0 : 1);
}

const fixture = () => {
    const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8'));
    const base = fx.donneesAnnuelles[Object.keys(fx.donneesAnnuelles)[0]];
    fx.donneesAnnuelles = {};
    for (const an of [2026, 2027]) fx.donneesAnnuelles[an] = JSON.parse(JSON.stringify(base));
    Object.assign(fx.soldesInitiaux, { moisActuel: 10, anneeActuelle: 2026, jourDePaie: 27, compteChargesFixes: 'courant', compteChargesVariables: 'courant', assurances_tracker: [], voyageDebut: '', voyageFin: '' });
    fx.soldesInitiaux.categories = [];
    fx.comptes = [{ id: 1, label: 'Compte Courant', type: 'courant', solde: 9000, icone: '💳' }, { id: 2, label: 'Compte Principale ASSAFA', type: 'courant', solde: 4000, icone: '🏦' }, { id: 3, label: 'Espèces', type: 'liquide', solde: 500, icone: '💵' }];
    const neutre = { paye: false, montantPaye: 0, exceptions: [], showExceptions: false };
    for (const an of Object.keys(fx.donneesAnnuelles)) {
        const d = fx.donneesAnnuelles[an];
        d.chargesFixes = { syndic: { ...neutre, label: 'Syndic', valeur: 300, jourPrevu: null } };
        d.chargesVariables = {
            voiture: { ...neutre, label: 'Voiture', valeur: 0, periode: 'semaine', compte: 'cpt_2', details: [{ nom: 'diesel skoda', montant: 350 }, { nom: 'essence picanto', montant: 300 }] },
            factures: { ...neutre, label: 'Factures', valeur: 0, periode: 'mois', details: [{ nom: 'elect', montant: 200 }, { nom: 'eau', montant: 300 }] },
            alimentation: { ...neutre, label: 'Alimentation (Tqdya)', valeur: 0, periode: 'semaine', details: [{ nom: 'khdra', montant: 200 }] },
        };
        d.epargne = [{ id: 1, nom: 'Epargne urgence', valeur: 500, sourceCompte: 'cpt_2', exceptions: [] }];
        d.virementsInternes = []; d.consoRealiseeT0 = {};
        d.depensesIrregulieres = an === '2026' ? [{ id: 801, mois: 11, annee: 2026, nom: 'Voyage Marrakech', montant: 1500, paye: false, montantPaye: 0, sourceCompte: 'cpt_3', categorieId: 'cat_irr_depense_exceptionnelle' }] : [];
        d.transactionsReelles = an !== '2026' ? [] : [
            { id: 701, datetime: '2026-10-12T09:41', date: '2026-10-12', mois: 10, libelle: 'Voyage marrakech station service', montant: 60, categorieId: 'cat_cv_alimentation', categorieSource: 'ia', compteId: 1, source: 'manuel' },
            { id: 702, datetime: '2026-10-12T10:00', date: '2026-10-12', mois: 10, libelle: 'gasoil', montant: 200, categorieId: 'cat_misc', compteId: 1, source: 'manuel' },
        ];
    }
    return fx;
};
const page0 = html
    .replace('<script src="https://unpkg.com/vue@3/dist/vue.global.js"', '<script src="/vue.js"')
    .replace('<script src="https://cdn.jsdelivr.net/npm/chart.js"', '<script src="/chart.js"')
    .replace(/<script src="https:\/\/cdn\.tailwindcss\.com"[^>]*><\/script>/, '')
    .replace(/<script[^>]*src="https:\/\/[^"]*"[^>]*><\/script>/g, '');
const sauvegardes = [];
const srv = http.createServer((req, res) => {
    const p = req.url.split('?')[0];
    const s = (c, b, t = 'application/json') => { res.writeHead(c, { 'Content-Type': t }); res.end(b); };
    if (req.method === 'POST' && /save_data\.php$/.test(p)) {
        let corps = ''; req.on('data', x => { corps += x; }); req.on('end', () => { try { sauvegardes.push(JSON.parse(corps)); } catch { } s(200, '{"status":"ok"}'); });
        return;
    }
    if (p === '/finance/') return s(200, page0, 'text/html; charset=utf-8');
    if (p === '/vue.js') return s(200, fs.readFileSync(vueJs), 'text/javascript');
    if (p === '/chart.js') return s(200, fs.readFileSync(chartJs), 'text/javascript');
    if (p === '/finance/finance_data.json') return s(200, JSON.stringify(fixture()));
    return s(200, '{"status":"ok"}');
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const browser = await pw.chromium.launch({ executablePath: chromium, args: ['--no-sandbox'] });
const ST = 'document.querySelector("#app").__vue_app__._instance.setupState';
const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
await page.clock.setFixedTime(new Date(2026, 9, 13, 12, 0, 0));
const erreurs = []; page.on('pageerror', e => erreurs.push(String(e)));
page.on('dialog', d => d.accept());
await page.route('**/webhook/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ output: '{"id": null, "confiance": "basse", "raison": "test"}' }) }));
await page.goto(`http://127.0.0.1:${srv.address().port}/finance/`, { waitUntil: 'load' });
await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState.moisBudgetaire; }, null, { timeout: 30000 });
//  les données du décor sont arrivées (l'appli démarre d'abord sur un état vide : sous charge, le serveur répond après)
await page.waitForFunction((ST) => { const st = eval(ST); return (st.comptes || []).length === 3 && (st.donneesAnnuelles[2026]?.transactionsReelles || []).some(t => t.id === 701); }, ST, { timeout: 30000 });


const ouvrirOp = (id) => page.evaluate(({ ST, id }) => { const st = eval(ST); st.journal.ouvert = null; st.journal.brouillon = null; st.ouvrirOperation(id); }, { ST, id });
const brouillon = () => page.evaluate((ST) => { const b = eval(ST).journal.brouillon; return b ? JSON.parse(JSON.stringify(b)) : null; }, ST);
const poserCat = (cat) => page.evaluate(async ({ ST, cat }) => { eval(ST).journal.brouillon.categorieId = cat; await Vue.nextTick(); }, { ST, cat });
const tx = (id) => page.evaluate(({ ST, id }) => JSON.parse(JSON.stringify(eval(ST).donneesAnnuelles[2026].transactionsReelles.find(t => t.id === id) || null)), { ST, id });
const appris = () => page.evaluate((ST) => JSON.parse(JSON.stringify((eval(ST).parametres.apprentissage || {}).comptes || {})), ST);
const DIESEL = 'cat_cv_voiture__ddiesel_skoda', FACT = 'cat_cv_factures__delect', VOY = 'cat_irr_l_voyage_marrakech', EPU = 'cat_ep_epargne_urgence';

try {
    await section('A', async () => {
        const r = await page.evaluate(({ ST, ids }) => { const st = eval(ST); return Object.fromEntries(ids.map(i => { const c = st.compteDeLaCategorie(i); return [i, c ? { id: c.id, raison: c.raison } : null]; })); }, { ST, ids: [DIESEL, FACT, VOY, EPU, 'cat_misc'] });
        v('A. le compte d’une catégorie : diesel skoda → ASSAFA (celui de « Voiture ») ; elect → le compte par défaut des variables (Courant)',
          r[DIESEL]?.id === 2 && /compte de « diesel skoda » \(charge variable\)/.test(r[DIESEL].raison) && r[FACT]?.id === 1, JSON.stringify(r));
        v('  → « Voyage Marrakech » (dépense exceptionnelle, source Espèces) → Espèces ; l’épargne → sa source (ASSAFA) ; « Non catégorisé » → rien',
          r[VOY]?.id === 3 && /Voyage Marrakech/.test(r[VOY].raison) && r[EPU]?.id === 2 && r['cat_misc'] === null, JSON.stringify(r));
    });
    await section('B', async () => {
        await ouvrirOp(701);
        await poserCat(VOY);
        let b = await brouillon();
        v('B. journal : « station service » passée en « Voyage Marrakech » → le compte devient Espèces, et l’écran dit pourquoi',
          b.compteId === '3' && /compte de « Voyage Marrakech » \(dépense exceptionnelle\)/.test(b.compteAuto), JSON.stringify(b));
        await poserCat(DIESEL); b = await brouillon();
        v('  → puis « diesel skoda » → ASSAFA', b.compteId === '2', JSON.stringify(b));
        await ouvrirOp(702); b = await brouillon();
        v('  → ouvrir une autre opération ne change pas son compte (seul un changement de catégorie le fait)', b.compteId === '1' && !b.compteAuto, JSON.stringify(b));
    });
    await section('C', async () => {
        //  à l'écran, comme vous : le sélecteur de catégorie, puis le compte choisi à la main
        await page.evaluate(async (ST) => { const st = eval(ST); st.appMode = 'reel'; await Vue.nextTick(); st.activeTab = 'saisie'; await Vue.nextTick(); st.journal.ouvert = null; st.journal.brouillon = null; await Vue.nextTick(); st.ouvrirOperation(701); }, ST);
        await page.waitForSelector('[data-journal-edit-cat] [data-cc-ouvrir]', { state: 'visible', timeout: 10000 });
        await page.click('[data-journal-edit-cat] [data-cc-ouvrir]'); await page.fill('[data-cc-panneau] [data-cc-recherche]', 'diesel'); await page.click(`[data-cc-panneau] [data-cc-option][data-id="${DIESEL}"]`);
        await page.waitForSelector('[data-journal-compte-auto]');
        const auto = (await page.textContent('[data-journal-compte-auto]')).trim(), val = await page.inputValue('[data-journal-edit-compte]');
        v('C. à l’écran : diesel skoda choisi → le compte passe à ASSAFA, « 🔗 compte de « diesel skoda » (charge variable) »', val === '2' && /🔗 compte de « diesel skoda »/.test(auto), JSON.stringify([val, auto]));
        await page.selectOption('[data-journal-edit-compte]', '1');
        await page.click('[data-journal-edit-cat] [data-cc-ouvrir]'); await page.fill('[data-cc-panneau] [data-cc-recherche]', 'voyage'); await page.click(`[data-cc-panneau] [data-cc-option][data-id="${VOY}"]`);
        await page.click('[data-journal-edit-cat] [data-cc-ouvrir]'); await page.fill('[data-cc-panneau] [data-cc-recherche]', 'diesel'); await page.click(`[data-cc-panneau] [data-cc-option][data-id="${DIESEL}"]`);
        v('  → le compte choisi À LA MAIN (Courant) ne bouge plus, même si la catégorie change encore', await page.inputValue('[data-journal-edit-compte]') === '1' && !(await page.$('[data-journal-compte-auto]')));
        await page.click('[data-journal-enregistrer]');
        await page.waitForSelector('[data-journal-appris]');
        const t = await tx(701), msg = (await page.textContent('[data-journal-appris]')).replace(/\s+/g, ' '), a = await appris();
        v('  → enregistré (diesel skoda, Courant) ; RETENU : « « diesel skoda » se paiera avec « Compte Courant », sans vous redemander »',
          t.categorieId === DIESEL && t.compteId === 1 && /« diesel skoda » se paiera avec « Compte Courant », sans vous redemander/.test(msg) && String(a[DIESEL]?.compteId) === '1', JSON.stringify([t.compteId, msg, a]));
    });
    await section('D', async () => {
        await ouvrirOp(702); await poserCat(FACT); await poserCat(DIESEL);   // « gasoil » est déjà rangé d'office en diesel skoda (règle sûre) : on passe par une autre catégorie
        const b = await brouillon();
        v('D. la fois suivante (« gasoil » passé en diesel skoda) : Courant d’office, « appris : « diesel skoda » se paie avec « Compte Courant » »',
          b.compteId === '1' && /appris : « diesel skoda » se paie avec « Compte Courant »/.test(b.compteAuto), JSON.stringify(b));
        await page.evaluate(async (ST) => { const st = eval(ST); st.journal.ouvert = null; st.journal.brouillon = null; await Vue.nextTick(); }, ST);
        const li = await page.$$eval('[data-apprentissage-compte-cat]', l => l.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
        v('  → « Ce que l’appli a appris » : « 💳 Comptes par catégorie » → « diesel skoda » → Compte Courant', li.length === 1 && /« diesel skoda » → Compte Courant/.test(li[0]), JSON.stringify(li));
        await page.evaluate((ST) => eval(ST).oublierCompteAppris('cat_cv_voiture__ddiesel_skoda'), ST);
        await ouvrirOp(702); await poserCat(FACT); await poserCat(DIESEL);
        v('  → 🗑 oublié : diesel skoda reprend le compte de sa ligne (ASSAFA)', (await brouillon()).compteId === '2' && !(await appris())[DIESEL]);
    });
    await section('E', async () => {
        //  revenir au compte de la ligne efface le choix appris
        await page.evaluate((ST) => { eval(ST).retenirCompteCategorie('cat_cv_voiture__ddiesel_skoda', 3); }, ST);
        const r = await page.evaluate((ST) => eval(ST).retenirCompteCategorie('cat_cv_voiture__ddiesel_skoda', 2), ST);
        v('E. vous reprenez le compte de la ligne (ASSAFA) : le choix appris (Espèces) est oublié, et c’est dit', !(await appris())[DIESEL] && /reprend le compte de sa ligne/.test(r || ''), r);
    });
    await section('F', async () => {
        //  la saisie : la catégorie trouvée par les règles amène son compte ; un compte choisi à la main est retenu
        await page.evaluate(async (ST) => { const st = eval(ST); st.journal.ouvert = null; st.journal.brouillon = null; st.resetSaisieForm(); await Vue.nextTick(); }, ST);
        await page.fill('input[placeholder="Ex: 200 courses"]', '45 diesel');
        await page.waitForFunction((ST) => eval(ST).saisieForm.categorieId === 'cat_cv_voiture__ddiesel_skoda', ST, { timeout: 5000 });
        const s1 = await page.evaluate((ST) => { const st = eval(ST); return { c: st.saisieForm.compteId, cat: st.saisieCompteCat }; }, ST);
        const puce = await page.getAttribute('[data-saisie-compte]', 'title'), txtPuce = (await page.textContent('[data-saisie-compte]')).trim();
        v('F. saisie « 45 diesel » : diesel skoda (règles) → compte ASSAFA d’office, la puce 🔗 dit pourquoi', s1.c === 2 && /diesel skoda/.test(puce || '') && txtPuce.startsWith('🔗'), JSON.stringify([s1, puce, txtPuce]));
        await page.evaluate((ST) => { const st = eval(ST); st.saisieForm.compteId = 3; st.compteSaisieModifie(); }, ST);
        await page.locator('input[placeholder="Ex: 200 courses"]').press('Enter');
        await page.waitForFunction((ST) => eval(ST).saisieRapide === '', ST, { timeout: 5000 });
        v('  → validée avec Espèces choisi à la main : retenu pour diesel skoda', String((await appris())[DIESEL]?.compteId) === '3', JSON.stringify(await appris()));
        await page.fill('input[placeholder="Ex: 200 courses"]', '30 diesel');
        await page.waitForFunction((ST) => eval(ST).saisieForm.categorieId === 'cat_cv_voiture__ddiesel_skoda', ST, { timeout: 5000 });
        v('  → « 30 diesel » ensuite : Espèces d’office', await page.evaluate((ST) => eval(ST).saisieForm.compteId, ST) === 3);
        await page.evaluate(async (ST) => { const st = eval(ST); st.resetSaisieForm(); await Vue.nextTick(); }, ST);
        await page.fill('input[placeholder="Ex: 200 courses"]', '80 bidule');
        await page.waitForFunction((ST) => eval(ST).saisieForm.libelle === 'bidule', ST, { timeout: 5000 });
        await page.evaluate((ST) => eval(ST).choisirCategorieSaisie('cat_irr_l_voyage_marrakech'), ST);
        v('  → une catégorie choisie à la main (Voyage Marrakech) amène aussi son compte (Espèces)', await page.evaluate((ST) => eval(ST).saisieForm.compteId, ST) === 3);
        await page.evaluate((ST) => eval(ST).resetSaisieForm(), ST);
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
