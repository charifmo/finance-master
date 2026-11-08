/**
 * v37.108 — LE VOYAGE : UNE LIGNE À SON NOM, UNE CASE À LA SAISIE.
 *
 *   « Quand je déclare une période de voyage, j'ai un truc à cocher dans chaque saisie avec un rappel en haut « tu es en voyage » ;
 *   si je coche, ça part dans la case exceptionnelle du voyage, créée automatiquement quand je dis que je serai en voyage vers
 *   telle destination pour telle période ; si je ne coche pas, le traitement normal reste. »
 *
 *   Décor : vos catégories (celui de la catégorisation), horloge au mardi 13 oct. 2026.
 *     A. la ligne créée · B. le rappel et la case · C. décochée : normal · D. cochée : le voyage, elle reste cochée, l'apprentissage
 *     n'est pas pollué · E. le budget se consomme · F. hors des dates · G. la destination change · H. effacer ; la frise.
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
console.log('\n  LE VOYAGE : UNE LIGNE À SON NOM, UNE CASE À LA SAISIE\n  ' + '─'.repeat(80));

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
    if (p === '/finance/finance_data.json') return s(200, JSON.stringify(fixture()));
    return s(200, '{"status":"ok"}');
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port;
const browser = await pw.chromium.launch({ executablePath: chromium, args: ['--no-sandbox'] });
const ST = 'document.querySelector("#app").__vue_app__._instance.setupState';

const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
await page.clock.setFixedTime(new Date(2026, 9, 13, 12, 0, 0));   // mardi 13 octobre 2026 (cycle : 27 sept. → 26 oct.)
const erreurs = []; page.on('pageerror', e => erreurs.push(String(e)));
page.on('dialog', d => d.accept());
await page.route('**/webhook/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ output: '{"id": null, "confiance": "basse", "raison": "test"}' }) }));
await page.goto(`http://127.0.0.1:${port}/finance/`, { waitUntil: 'load' });
await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState.moisBudgetaire; }, null, { timeout: 30000 });
await page.waitForFunction((ST) => { const st = eval(ST); return (st.donneesAnnuelles[2026]?.transactionsReelles || []).some(t => t.id === 501); }, ST, { timeout: 30000 });
await page.evaluate(async (ST) => { const st = eval(ST); st.appMode = 'reel'; await Vue.nextTick(); st.activeTab = 'saisie'; await Vue.nextTick(); }, ST);
const CHAMP = 'input[placeholder="Ex: 200 courses"]';
await page.waitForSelector(CHAMP, { state: 'visible', timeout: 10000 });
const VOY = 'cat_irr_l_voyage_marrakech';
const deps = () => page.evaluate((ST) => JSON.parse(JSON.stringify(eval(ST).donneesAnnuelles[2026].depensesIrregulieres.filter(d => d.voyage || /Voyage/.test(d.nom || '')))), ST);
const tx = (lib) => page.evaluate(({ ST, lib }) => JSON.parse(JSON.stringify(eval(ST).donneesAnnuelles[2026].transactionsReelles.filter(t => t.libelle === lib).pop() || null)), { ST, lib });
const saisir = async (texte) => { await page.fill(CHAMP, texte); await page.waitForFunction(({ ST, texte }) => { const st = eval(ST); return st.saisieRapide === texte && st.saisieForm.montant > 0; }, { ST, texte }, { timeout: 5000 });
    await page.locator(CHAMP).press('Enter'); await page.waitForFunction((ST) => eval(ST).saisieRapide === '', ST, { timeout: 5000 }); };

try {
    await section('A', async () => {
        await page.evaluate((ST) => { const st = eval(ST); st.setVoyage('voyageDebut', '2026-10-11'); st.setVoyage('voyageFin', '2026-10-16'); st.setVoyage('voyageDestination', 'Marrakech'); st.setVoyage('voyageBudget', '3000'); }, ST);
        const d = await deps();
        const cat = await page.evaluate((ST) => (eval(ST).soldesInitiaux.categories || []).find(c => c.id === 'cat_irr_l_voyage_marrakech') || null, ST);
        v('A. voyage déclaré (Marrakech, 11 → 16 oct., budget 3 000) : « Voyage Marrakech » créée dans le Flux, au 11 oct., avec sa catégorie',
          d.length === 1 && d[0].nom === 'Voyage Marrakech' && d[0].mois === 10 && d[0].jourPrevu === 11 && d[0].montant === 3000 && d[0].categorieId === VOY && !!cat, JSON.stringify([d, cat]));
    });
    await section('B', async () => {
        await page.waitForSelector('[data-saisie-voyage-bandeau]', { state: 'visible', timeout: 5000 });
        const b = (await page.textContent('[data-saisie-voyage-bandeau]')).replace(/\s+/g, ' ');
        v('B. à la saisie : « ✈️ Vous êtes en voyage — Marrakech (du 11 oct. au 16 oct.) », la case « Dépense du voyage » (décochée d’office)',
          /✈️ Vous êtes en voyage — Marrakech/.test(b) && /du 11 oct\. au 16 oct\./.test(b) && /Dépense du voyage → « Voyage Marrakech »/.test(b) && !(await page.isChecked('[data-saisie-voyage-bandeau] [data-saisie-voyage]')), b);
    });
    await section('C', async () => {
        await saisir('45 diesel');
        const t = await tx('diesel');
        v('C. case décochée : « 45 diesel » suit le traitement normal (diesel skoda, par les règles)', t && /diesel_skoda/.test(t.categorieId) && t.categorieSource !== 'voyage', JSON.stringify(t));
    });
    await section('D', async () => {
        await page.check('[data-saisie-voyage-bandeau] [data-saisie-voyage]');
        await page.fill(CHAMP, '120 diesel');
        await page.waitForFunction((ST) => eval(ST).saisieForm.montant === 120, ST, { timeout: 5000 });
        const puce = (await page.textContent('[data-saisie-cat-voyage]')).trim();
        await page.locator(CHAMP).press('Enter'); await page.waitForFunction((ST) => eval(ST).saisieRapide === '', ST, { timeout: 5000 });
        const t = await tx('diesel');
        v('D. case cochée : la pastille dit « ✈️ Voyage Marrakech » ; enregistrée dans la ligne du voyage (source « voyage »), rien à vérifier',
          /✈️ Voyage Marrakech/.test(puce) && t.montant === 120 && t.categorieId === VOY && t.categorieSource === 'voyage' && !t.aVerifier && t.compteId === 1, JSON.stringify([puce, t]));
        await saisir('60 restaurant');
        const r = await tx('restaurant');
        v('  → la case reste cochée : « 60 restaurant » va aussi au voyage (pas besoin de recocher)', await page.isChecked('[data-saisie-voyage-bandeau] [data-saisie-voyage]') && r.categorieId === VOY, JSON.stringify(r));
        const c = await page.evaluate((ST) => { const x = eval(ST).categoriserLibelle('diesel'); return x.id; }, ST);
        v('  → l’apprentissage n’est pas pollué : « diesel » reste diesel skoda pour les règles (pas « Voyage Marrakech »)', /diesel_skoda/.test(c || ''), c);
    });
    await section('E', async () => {
        const e = await page.evaluate(async (ST) => { const st = eval(ST); st.calculationTick++; await Vue.nextTick(); const dep = st.donneesAnnuelles[2026].depensesIrregulieres.find(d => d.voyage);
            return { paye: st.isItemPaid(dep, 3000), regle: st.getPaidAmount(dep, 3000), lignes: st.atterrissageCycle.comptes.flatMap(c => (c.lignes || []).map(l => [l.libelle, Math.round(l.montant)])).filter(([x]) => /Voyage/.test(x)) }; }, ST);
        v('E. le budget du voyage se consomme : 180 DH réglés sur 3 000, le Relevé n’attend plus que 2 820', e.paye === false && e.regle === 180 && e.lignes.some(([x, m]) => /Voyage Marrakech/.test(x) && m === 2820), JSON.stringify(e));
    });
    await section('R', async () => {
        //  v37.114 — le ruban du voyage, en tête de l'appli : visible, sans rien recouvrir, réductible
        const texte = async () => (await page.textContent('[data-ruban-voyage]')).replace(/\s+/g, ' ');
        await page.waitForSelector('[data-ruban-voyage]', { state: 'visible', timeout: 5000 });
        const t1 = await texte();
        v('R. en voyage : le ruban en tête — « ✈️ En voyage — Marrakech · jour 3/6 », 180 / 3 000 DH prévus (6 %), reste 2 820, dans le rythme (1 500 prévus à ce jour), aujourd’hui 180',
          /✈️ En voyage — Marrakech · jour 3\/6/.test(t1) && /180 \/ 3\s000 DH prévus \(6 %\)/.test(t1) && /reste 2\s820 DH/.test(t1) && /dans le rythme \(1\s500 prévus à ce jour\)/.test(t1) && /aujourd’hui 180 DH/.test(t1)
          && await page.getAttribute('[data-ruban-voyage]', 'data-etat') === 'ok', t1);
        const place = await page.evaluate(() => { const r = document.querySelector('[data-ruban-voyage]'), b = r.getBoundingClientRect(), tete = r.parentElement;
            const sous = r.nextElementSibling ? r.nextElementSibling.getBoundingClientRect() : null;
            return { h: Math.round(b.height), dansTete: tete.classList.contains('sticky'), recouvre: sous ? sous.top < b.bottom - 1 : true, haut: Math.round(b.top) }; });
        v('  → fin (≤ 40 px), dans l’en-tête collant, rien en dessous n’est recouvert (il pousse, il ne masque pas)', place.h > 0 && place.h <= 40 && place.dansTete && !place.recouvre, JSON.stringify(place));
        await page.click('[data-ruban-voyage-reduire]');
        await page.waitForSelector('[data-ruban-voyage-mini]', { state: 'visible', timeout: 3000 });
        const mini = (await page.textContent('[data-ruban-voyage-mini]')).replace(/\s+/g, ' ').trim();
        await page.evaluate(async (ST) => { const st = eval(ST); st.appMode = 'previsionnel'; st.activeTab = 'dashboard'; await Vue.nextTick(); }, ST);
        await page.waitForSelector('[data-ruban-voyage]', { state: 'visible', timeout: 5000 });
        const miniAilleurs = !!(await page.$('[data-ruban-voyage-mini]')) && !(await page.$('[data-ruban-voyage-titre]'));
        v('  → ▴ le réduit en pastille « ✈️ 6 % ▾ » ; retenu ailleurs dans l’appli (Prévisionnel)', mini === '✈️ 6 % ▾' && miniAilleurs, JSON.stringify([mini, miniAilleurs]));
        await page.click('[data-ruban-voyage-mini]');
        await page.waitForSelector('[data-ruban-voyage-titre]', { state: 'visible', timeout: 3000 });
        //  dépassé : rouge, « dépassé de … »
        await page.evaluate(async (ST) => { const st = eval(ST); st.donneesAnnuelles[2026].depensesIrregulieres.find(d => d.voyage).montant = 150; st.calculationTick++; await Vue.nextTick(); }, ST);
        const t2 = await texte(), e2 = await page.getAttribute('[data-ruban-voyage]', 'data-etat');
        await page.evaluate(async (ST) => { const st = eval(ST); st.donneesAnnuelles[2026].depensesIrregulieres.find(d => d.voyage).montant = 300; st.calculationTick++; await Vue.nextTick(); }, ST);
        const t3 = await texte(), e3 = await page.getAttribute('[data-ruban-voyage]', 'data-etat');
        await page.evaluate(async (ST) => { const st = eval(ST); st.donneesAnnuelles[2026].depensesIrregulieres.find(d => d.voyage).montant = 3000; st.calculationTick++; await Vue.nextTick(); }, ST);
        v('  → budget de 150 : « dépassé de 30 DH » (rouge) ; budget de 300 : au-dessus du rythme (150 prévus à ce jour, orange)',
          e2 === 'depasse' && /dépassé de 30 DH/.test(t2) && e3 === 'avance' && /au-dessus du rythme \(150 prévus à ce jour\)/.test(t3), JSON.stringify([e2, t2, e3, t3]));
        //  un clic sur le titre : le bloc du voyage (Réalisé › Pilotage), ouvert
        await page.click('[data-ruban-voyage-titre]');
        await page.waitForFunction(() => { const d = document.querySelector('details[data-voyage]'); return d && d.open; }, null, { timeout: 5000 });
        const ou = await page.evaluate((ST) => [eval(ST).appMode, eval(ST).activeTab], ST);
        v('  → un clic sur « ✈️ En voyage » ouvre le bloc du voyage (Réalisé › Pilotage)', ou[0] === 'reel' && ou[1] === 'pilotage', JSON.stringify(ou));
        await page.evaluate(async (ST) => { const st = eval(ST); st.activeTab = 'saisie'; await Vue.nextTick(); }, ST);
        await page.waitForSelector(CHAMP, { state: 'visible', timeout: 10000 });
    });
    await section('F', async () => {
        await page.evaluate(async (ST) => { const st = eval(ST); st.saisieForm.datetime = '2026-10-20T10:00'; st.saisieForm.dateFixee = true; await Vue.nextTick(); }, ST);
        const bandeau = !!(await page.$('[data-saisie-voyage-bandeau]'));
        await page.fill(CHAMP, '30 diesel'); await page.waitForFunction((ST) => eval(ST).saisieForm.montant === 30, ST, { timeout: 5000 });
        await page.evaluate((ST) => { const st = eval(ST); st.saisieForm.datetime = '2026-10-20T10:00'; st.saisieForm.dateFixee = true; }, ST);
        await page.locator(CHAMP).press('Enter'); await page.waitForFunction((ST) => eval(ST).saisieRapide === '', ST, { timeout: 5000 });
        const t = await tx('diesel');
        v('F. une saisie datée après le voyage (20 oct.) : pas de rappel, traitement normal même si la case était cochée', !bandeau && t.montant === 30 && /diesel_skoda/.test(t.categorieId), JSON.stringify([bandeau, t]));
    });
    await section('G', async () => {
        await page.evaluate((ST) => eval(ST).setVoyage('voyageDestination', 'Agadir'), ST);
        const d = await deps(), r = await tx('restaurant');
        v('G. destination changée en Agadir : la ligne devient « Voyage Agadir », les dépenses du voyage la suivent', d.length === 1 && d[0].nom === 'Voyage Agadir' && d[0].categorieId === 'cat_irr_l_voyage_agadir' && r.categorieId === 'cat_irr_l_voyage_agadir', JSON.stringify([d, r]));
    });
    await section('I', async () => {
        //  v37.112 — « le CFO remplit la saisie (Voyage Marrakech) mais met le compte courant » : la ligne du voyage est payée
        //  par un autre compte ; une saisie que les règles ne connaissent pas part sur le compte par défaut, puis l'IA la range
        const AG = 'cat_irr_l_voyage_agadir';
        await page.evaluate(({ ST }) => { const st = eval(ST); st.comptes.push({ id: 2, label: 'Compte Voyage', type: 'epargne', solde: 5000, icone: '✈️' }); st.activeTab = 'pilotage'; }, { ST });
        //  le compte du voyage se choisit là où on le déclare (Pilotage) : « payé par »
        await page.waitForSelector('details[data-voyage]', { state: 'attached', timeout: 5000 });
        await page.evaluate(() => { document.querySelector('details[data-voyage]').open = true; });
        await page.waitForSelector('[data-voyage-compte]', { state: 'visible', timeout: 5000 });
        const fondVoyage = await page.getAttribute('details[data-voyage]', 'class');
        v('  → en voyage, le bloc « Voyage · absence » a un fond OPAQUE (plus de voile transparent sur la page claire : DU, AU, VERS, PAYÉ PAR lisibles)',
          /\bbg-sky-950\b/.test(fondVoyage) && !/bg-sky-950\//.test(fondVoyage), fondVoyage);
        const avantCompte = await page.$eval('[data-voyage-compte]', e => e.value);
        await page.selectOption('[data-voyage-compte]', 'cpt_2');
        const ligneCompte = await page.evaluate(({ ST, AG }) => { const st = eval(ST); return [st.donneesAnnuelles[2026].depensesIrregulieres.find(d => d.categorieId === AG).sourceCompte, st.soldesInitiaux.voyageCompte]; }, { ST, AG });
        const dejaSaisies = await page.evaluate((ST) => eval(ST).donneesAnnuelles[2026].transactionsReelles.filter(t => t.categorieSource === 'voyage').map(t => String(t.compteId)), ST);
        v('I. « payé par » à côté de la destination : courant d’office ; « Compte Voyage » choisi → la ligne du voyage le prend, retenu pour le prochain voyage ; les saisies déjà faites (case cochée) le rejoignent',
          avantCompte === 'courant' && ligneCompte[0] === 'cpt_2' && ligneCompte[1] === 'cpt_2' && dejaSaisies.length >= 2 && dejaSaisies.every(c => c === '2'), JSON.stringify([avantCompte, ligneCompte, dejaSaisies]));
        //  v37.118 — un lien visible vers la ligne du voyage dans le Flux
        await page.click('[data-voyage-voir-flux]');
        await page.waitForSelector('[data-dep-id][data-surligne]', { state: 'visible', timeout: 5000 }).catch(() => { });
        const flux = await page.evaluate(({ ST, AG }) => { const st = eval(ST), dep = st.donneesAnnuelles[2026].depensesIrregulieres.find(d => d.categorieId === AG), el = document.querySelector('[data-dep-id][data-surligne]');
            return { mode: st.appMode, tab: st.activeTab, surligne: el ? el.getAttribute('data-dep-id') : null, id: String(dep.id), nom: el ? /Voyage Agadir/.test(el.innerHTML) || !!el.querySelector('input') : false }; }, { ST, AG });
        const mobile = await page.evaluate(async ({ ST }) => { const st = eval(ST); st.isMobile = true; const ok = await st.allerLigneVoyageFlux(); const r = { ok, tab: st.activeMobileTab, el: !!document.querySelector('[data-dep-id][data-surligne]') }; st.isMobile = false; return r; }, { ST });
        v('  → « ⚡ Voir dans le Flux → » ouvre le Flux (Prévisionnel) sur la ligne du voyage, surlignée ; sur téléphone aussi (onglet Flux)',
          flux.mode === 'previsionnel' && flux.tab === 'irregulieres' && flux.surligne === flux.id && mobile.ok && mobile.tab === 'flux' && mobile.el, JSON.stringify([flux, mobile]));
        await page.evaluate(async (ST) => { const st = eval(ST); st.appMode = 'reel'; st.activeTab = 'pilotage'; await Vue.nextTick(); document.querySelector('details[data-voyage]').open = true; }, ST);
        await page.waitForSelector('[data-voyage-compte]', { state: 'visible', timeout: 5000 });
        //  la liaison RESTE : le voyage modifié ensuite (budget), puis l'appli rechargée depuis ce qu'elle enregistre
        await page.evaluate((ST) => eval(ST).setVoyage('voyageBudget', '3000'), ST);
        const apresModif = await page.evaluate(({ ST, AG }) => eval(ST).donneesAnnuelles[2026].depensesIrregulieres.find(d => d.categorieId === AG).sourceCompte, { ST, AG });
        await page.evaluate((ST) => { const st = eval(ST); st.executerImportFusion(JSON.parse(JSON.stringify(st.getExportData()))); }, ST);
        await page.waitForFunction((ST) => eval(ST).voyageCompteCle === 'cpt_2', ST, { timeout: 5000 }).catch(() => { });
        const apresRecharge = await page.evaluate((ST) => [eval(ST).voyageCompteCle, eval(ST).soldesInitiaux.voyageCompte, document.querySelector('[data-voyage-compte]') && document.querySelector('[data-voyage-compte]').value], ST);
        v('  → la liaison reste : budget du voyage modifié ensuite, puis appli rechargée depuis ce qu’elle enregistre — toujours « Compte Voyage »',
          apresModif === 'cpt_2' && apresRecharge[0] === 'cpt_2' && apresRecharge[1] === 'cpt_2' && apresRecharge[2] === 'cpt_2', JSON.stringify([apresModif, apresRecharge]));
        await page.evaluate(async (ST) => { const st = eval(ST); st.activeTab = 'saisie'; await Vue.nextTick(); st.saisieForm.datetime = ''; st.saisieForm.dateFixee = false; st.saisieVoyageCoche = false; }, ST);
        await page.waitForSelector(CHAMP, { state: 'visible', timeout: 10000 });
        await page.evaluate((ST) => { eval(ST).saisieVoyageCoche = true; }, ST);
        await page.waitForFunction((ST) => String(eval(ST).saisieForm.compteId) === '2', ST, { timeout: 5000 }).catch(() => {});
        const coche = await page.evaluate((ST) => String(eval(ST).saisieForm.compteId), ST);
        await page.evaluate((ST) => { eval(ST).saisieVoyageCoche = false; }, ST);
        await page.waitForFunction((ST) => String(eval(ST).saisieForm.compteId) !== '2', ST, { timeout: 5000 }).catch(() => {});
        const decoche = await page.evaluate((ST) => String(eval(ST).saisieForm.compteId), ST);
        v('  → la case « ✈️ Dépense du voyage » cochée : le compte affiché devient celui de la ligne (Compte Voyage) ; décochée : il revient',
          coche === '2' && decoche === '1', JSON.stringify([coche, decoche]));
        //  v37.113 — case cochée PUIS un libellé connu (« diesel », payé d'habitude par le courant) : le compte affiché reste celui du voyage
        await page.evaluate((ST) => { eval(ST).saisieVoyageCoche = true; }, ST);
        await page.fill(CHAMP, '70 diesel');
        await page.waitForFunction((ST) => eval(ST).saisieForm.montant === 70, ST, { timeout: 5000 });
        const affiche = await page.evaluate((ST) => [String(eval(ST).saisieForm.compteId), eval(ST).saisieCompteCat], ST);
        await page.locator(CHAMP).press('Enter'); await page.waitForFunction((ST) => eval(ST).saisieRapide === '', ST, { timeout: 5000 });
        const d70 = await tx('diesel');
        await page.evaluate((ST) => { eval(ST).saisieVoyageCoche = false; }, ST);
        await page.fill(CHAMP, '35 diesel');
        await page.waitForFunction((ST) => eval(ST).saisieForm.montant === 35, ST, { timeout: 5000 });
        const afficheSans = await page.evaluate((ST) => String(eval(ST).saisieForm.compteId), ST);
        await page.fill(CHAMP, '');
        v('  → case cochée puis « 70 diesel » (payé d’habitude par le courant) : le formulaire montre le Compte Voyage, enregistré dessus ; case décochée : « diesel » reprend le courant',
          affiche[0] === '2' && /Voyage Agadir/.test(affiche[1] || '') && d70.montant === 70 && String(d70.compteId) === '2' && d70.categorieSource === 'voyage' && afficheSans === '1', JSON.stringify([affiche, d70, afficheSans]));
        await page.evaluate(({ ST, id }) => { const st = eval(ST); st.donneesAnnuelles[2026].transactionsReelles = st.donneesAnnuelles[2026].transactionsReelles.filter(t => t.id !== id); st.calculationTick++; }, { ST, id: d70.id });
        //  l'IA (le CFO) range « zqrv tbkl » dans le voyage : le compte suit
        await page.unroute('**/webhook/**');
        await page.route('**/webhook/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ output: JSON.stringify({ id: AG, confiance: 'haute', raison: 'hébergement pendant le voyage' }) }) }));
        await saisir('250 zqrv tbkl');
        await page.waitForFunction((ST) => { const t = eval(ST).donneesAnnuelles[2026].transactionsReelles.filter(x => x.libelle === 'zqrv tbkl').pop(); return t && t.categorieSource === 'ia'; }, ST, { timeout: 10000 });
        const riad = await tx('zqrv tbkl');
        v('  → saisie inconnue, rangée ensuite par l’IA du CFO dans « Voyage Agadir » : le compte passe du courant au Compte Voyage',
          riad.categorieId === AG && riad.categorieSource === 'ia' && String(riad.compteId) === '2' && riad.compteAuto === '2', JSON.stringify(riad));
        //  un compte choisi à la main n'est jamais déplacé
        await page.evaluate((ST) => { const st = eval(ST); st.saisieForm.compteId = 1; st.compteSaisieModifie(); }, ST);
        await saisir('90 wxmj pqzd');
        await page.waitForFunction((ST) => { const t = eval(ST).donneesAnnuelles[2026].transactionsReelles.filter(x => x.libelle === 'wxmj pqzd').pop(); return t && t.categorieSource === 'ia'; }, ST, { timeout: 10000 });
        const souk = await tx('wxmj pqzd');
        v('  → compte choisi à la main (courant), puis rangé par l’IA dans le voyage : il reste sur le courant', souk.categorieId === AG && String(souk.compteId) === '1' && souk.compteAuto === false, JSON.stringify(souk));
        //  les saisies d'avant la correction : réalignées au chargement (sauf la main et la banque)
        const r = await page.evaluate(({ ST, AG }) => { const st = eval(ST), T = st.donneesAnnuelles[2026].transactionsReelles;
            const base = { datetime: '2026-10-12T20:00', date: '2026-10-12', mois: 10, montant: 100, categorieId: AG };
            T.push({ ...base, id: 901, libelle: 'ancien ia', compteId: 1, source: 'manuel', categorieSource: 'ia' },
                   { ...base, id: 902, libelle: 'ancien voyage', compteId: 1, source: 'manuel', categorieSource: 'voyage' },
                   { ...base, id: 903, libelle: 'ancien vous', compteId: 1, source: 'manuel', categorieSource: 'vous' },
                   { ...base, id: 904, libelle: 'ancien banque', compteId: 1, source: 'banque', categorieSource: 'ia' },
                   { ...base, id: 905, libelle: 'ancien journal', compteId: 1, source: 'manuel', categorieSource: 'ia', compteAuto: false },
                   //  v37.115 : posée sur le courant par l'appli, puis passée par le CFO sur le compte 7 (Dépenses annuelles) : on n'y touche plus
                   { ...base, id: 906, libelle: 'changé par le CFO', compteId: 7, source: 'manuel', categorieSource: 'voyage', compteAuto: '1' },
                   //  la 37.112 avait écrit « true » : déplacée ensuite par le CFO (pas sur le compte par défaut) → intouchable aussi
                   { ...base, id: 907, libelle: 'ancien true CFO', compteId: 7, source: 'manuel', categorieSource: 'ia', compteAuto: true },
                   { ...base, id: 908, libelle: 'auto resté', compteId: 1, source: 'manuel', categorieSource: 'ia', compteAuto: '1' });
            const n = st.realignerComptesSaisies(), n2 = st.realignerComptesSaisies();
            return { n, n2, c: Object.fromEntries(T.filter(t => t.id >= 901).map(t => [t.libelle, t.compteId])) }; }, { ST, AG });
        v('  → réparation au chargement : les anciennes saisies rangées par l’IA ou par la case voyage passent au Compte Voyage (« diesel » et « restaurant » de D y sont déjà)  ; ni la main, ni la banque, ni un compte corrigé au journal, ni un compte changé ensuite par le CFO (v37.115) ; une 2ᵉ fois : rien',
          r.n === 3 && r.n2 === 0 && r.c['auto resté'] === 2 && r.c['changé par le CFO'] === 7 && r.c['ancien true CFO'] === 7 && r.c['restaurant'] === 2 && r.c['wxmj pqzd'] === 1 && r.c['diesel'] === 1 && r.c['ancien ia'] === 2 && r.c['ancien voyage'] === 2 && r.c['ancien vous'] === 1 && r.c['ancien banque'] === 1 && r.c['ancien journal'] === 1, JSON.stringify(r));
        await page.evaluate((ST) => { const st = eval(ST); st.donneesAnnuelles[2026].transactionsReelles = st.donneesAnnuelles[2026].transactionsReelles.filter(t => !(t.id >= 901 && t.id <= 908) && !['zqrv tbkl', 'wxmj pqzd'].includes(t.libelle)); }, ST);
        await page.unroute('**/webhook/**');
        await page.route('**/webhook/**', r2 => r2.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ output: '{"id": null, "confiance": "basse", "raison": "test"}' }) }));
    });
    await section('H', async () => {
        await page.evaluate((ST) => eval(ST).effacerVoyage(), ST);
        let d = await deps();
        const bandeau = !!(await page.$('[data-saisie-voyage-bandeau]'));
        v('H. voyage effacé : la ligne reste (on y a dépensé), le rappel disparaît — et le ruban aussi', d.length === 1 && d[0].nom === 'Voyage Agadir' && !bandeau && !(await page.$('[data-ruban-voyage]')), JSON.stringify([d, bandeau]));
        await page.evaluate((ST) => { const st = eval(ST); st.setVoyage('voyageDebut', '2026-10-20'); st.setVoyage('voyageFin', '2026-10-24'); st.setVoyage('voyageDestination', 'Rome'); st.calculationTick++; st.friseOuverte = true; }, ST);
        const f = await page.evaluate(async (ST) => { await Vue.nextTick(); const fc = eval(ST).friseCycle; const b = fc.categories.find(c => c.key === '__exceptionnel'); return b ? b.lignes.map(l => [l.nom, l.engage, l.enveloppe]) : null; }, ST);
        v('  → un voyage à Rome sans budget : sa ligne est dans la frise (0 / 0), à côté de celle d’Agadir', !!f && f.some(([n]) => n === 'Voyage Rome') && f.some(([n, e]) => n === 'Voyage Agadir' && e === 180), JSON.stringify(f));
        await page.evaluate((ST) => { const st = eval(ST); st.friseOuverte = false; st.effacerVoyage(); }, ST);
        d = await deps();
        v('  → effacé sans y avoir rien dépensé : « Voyage Rome » disparaît du Flux', !d.some(x => x.nom === 'Voyage Rome') && d.some(x => x.nom === 'Voyage Agadir'), JSON.stringify(d.map(x => x.nom)));
        //  v37.116 — un premier voyage (aucun compte retenu) : le compte de vos dépenses exceptionnelles est proposé d'office
        const fes = await page.evaluate((ST) => { const st = eval(ST), d = st.donneesAnnuelles[2026];
            st.soldesInitiaux.voyageCompte = '';
            d.depensesIrregulieres.push({ id: 7701, nom: 'Assurance auto', mois: 12, annee: 2026, montant: 4000, sourceCompte: 'cpt_2' }, { id: 7702, nom: 'Vignette', mois: 1, annee: 2026, montant: 700, sourceCompte: 'cpt_2' },
                                        { id: 7703, nom: 'Cadeau', mois: 5, annee: 2026, montant: 300, sourceCompte: 'courant' });
            st.setVoyage('voyageDebut', '2026-12-20'); st.setVoyage('voyageFin', '2026-12-22'); st.setVoyage('voyageDestination', 'Fès');
            const dep = d.depensesIrregulieres.find(x => x.nom === 'Voyage Fès'); return [dep && dep.sourceCompte, st.voyageCompteCle]; }, ST);
        await page.evaluate((ST) => { const st = eval(ST), d = st.donneesAnnuelles[2026]; st.effacerVoyage(); d.depensesIrregulieres = d.depensesIrregulieres.filter(x => ![7701, 7702, 7703].includes(x.id)); }, ST);
        v('  → premier voyage sans compte retenu : « payé par » propose d’office le compte de vos dépenses exceptionnelles (Compte Voyage), pas le courant',
          fes[0] === 'cpt_2' && fes[1] === 'cpt_2', JSON.stringify(fes));
        v('aucune erreur JavaScript', erreurs.length === 0, erreurs[0] || '');
    });
    await section('V', async () => {
        //  v37.117 — « toujours aucun budget prévu, et on ne voit pas le budget lié » : votre ligne « Voyage … » (créée à la main,
        //  1 500 DH) et celle créée à la déclaration coexistaient ; le ruban lisait la 2ᵉ, à 0
        const lignes = (nom) => page.evaluate(({ ST, nom }) => Object.values(eval(ST).donneesAnnuelles).flatMap(d => (d.depensesIrregulieres || []).filter(x => x.nom === nom)).map(x => JSON.parse(JSON.stringify(x))), { ST, nom });
        await page.evaluate((ST) => { const st = eval(ST); st.effacerVoyage(); st.soldesInitiaux.voyageCompte = '';
            st.donneesAnnuelles[2026].depensesIrregulieres.push({ id: 8801, nom: 'Voyage Tanger', mois: 12, annee: 2026, jourPrevu: 3, montant: 1500, paye: false, montantPaye: 0, sourceCompte: 'cpt_2' });
            st.setVoyage('voyageDebut', '2026-12-05'); st.setVoyage('voyageFin', '2026-12-08'); st.setVoyage('voyageDestination', 'Tanger'); }, ST);
        const t1 = await lignes('Voyage Tanger'), b1 = await page.evaluate((ST) => [eval(ST).voyageBudgetLigne, eval(ST).soldesInitiaux.voyageDepId], ST);
        v('V. une ligne « Voyage Tanger » (1 500 DH) existe déjà : la déclaration la REPREND — pas de doublon, son budget et son compte gardés, au départ du voyage',
          t1.length === 1 && t1[0].id === 8801 && t1[0].montant === 1500 && t1[0].sourceCompte === 'cpt_2' && t1[0].jourPrevu === 5 && t1[0].voyage === true && b1[0] === '1500' && b1[1] === 8801, JSON.stringify([t1, b1]));
        await page.evaluate((ST) => eval(ST).setVoyage('voyageFin', '2026-12-09'), ST);
        const t2 = await lignes('Voyage Tanger');
        await page.evaluate((ST) => eval(ST).setVoyage('voyageBudget', '1800'), ST);
        const t3 = await lignes('Voyage Tanger');
        v('  → changer les dates ne remet plus le budget à 0 ; la case « budget » règle le montant de la ligne (1 800)', t2[0].montant === 1500 && t3[0].montant === 1800, JSON.stringify([t2[0].montant, t3[0].montant]));
        //  votre cas : les DEUX lignes déjà là (version d'avant) — fusionnées au chargement
        const r = await page.evaluate(async (ST) => { const st = eval(ST), d = st.donneesAnnuelles[2026];
            st.effacerVoyage();
            d.depensesIrregulieres = d.depensesIrregulieres.filter(x => x.nom !== 'Voyage Tanger');
            d.depensesIrregulieres.push({ id: 8811, nom: 'Voyage Fès', mois: 11, annee: 2026, jourPrevu: 4, montant: 1500, paye: false, montantPaye: 0, sourceCompte: 'courant' },
                                        { id: 8812, nom: 'Voyage Fès', mois: 11, annee: 2026, jourPrevu: 6, montant: 0, paye: false, montantPaye: 0, sourceCompte: 'cpt_2', voyage: true });
            Object.assign(st.soldesInitiaux, { voyageDebut: '2026-11-06', voyageFin: '2026-11-08', voyageDestination: 'Fès', voyageBudget: '', voyageDepId: 8812, voyageCompte: 'cpt_2' });
            st.executerImportFusion(JSON.parse(JSON.stringify(st.getExportData())));
            await new Promise(res => setTimeout(res, 400));
            const f = Object.values(st.donneesAnnuelles).flatMap(x => (x.depensesIrregulieres || []).filter(y => y.nom === 'Voyage Fès'));
            return { f: JSON.parse(JSON.stringify(f)), dep: st.soldesInitiaux.voyageDepId, budget: st.voyageBudgetLigne, statut: st.serverSyncStatus }; }, ST);
        v('  → les deux lignes déjà là (la vôtre à 1 500 DH, celle de la déclaration à 0) : fusionnées au chargement — la vôtre reste, sur le compte « payé par », budget 1 500 visible, enregistré',
          r.f.length === 1 && r.f[0].id === 8811 && r.f[0].montant === 1500 && r.f[0].sourceCompte === 'cpt_2' && r.dep === 8811 && r.budget === '1500' && r.statut === 'modified', JSON.stringify(r));
        await page.evaluate((ST) => { const st = eval(ST), d = st.donneesAnnuelles[2026]; st.effacerVoyage(); d.depensesIrregulieres = d.depensesIrregulieres.filter(x => x.nom !== 'Voyage Fès'); }, ST);
        v('  → aucune erreur JavaScript (V)', erreurs.length === 0, erreurs[0] || '');
    });
} catch (e) {
    v('exécution sans exception', false, String(e && e.stack || e).slice(0, 400));
} finally {
    await browser.close(); srv.close();
}
console.log('  ' + '─'.repeat(80));
console.log(ko === 0 ? `  ✅ TOUT PASSE — ${n} contrôles` : `  ❌ ${ko} contrôle(s) en échec sur ${n}`);
process.exit(ko === 0 ? 0 : 1);
