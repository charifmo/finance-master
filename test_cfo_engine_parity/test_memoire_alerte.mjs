/**
 * v37.32 — L'INTERFACE SE SOUVIENT · LE DÉCOUVERT D'ABORD.
 *
 *   1. « Quand je déplie un mois du Calendrier pluriannuel ou une catégorie du
 *      Budget Structurel, tout se referme au rechargement. » L'état des tiroirs vit
 *      désormais dans le localStorage (par appareil), jamais dans les données.
 *   2. « Le découvert est noyé dans un paragraphe ; la carte de droite affiche par
 *      jour / par semaine. » Un bloc rouge en tête de la Météo donne, pour chaque
 *      compte dans le rouge : son nom, ce qui manque, et le virement de sauvetage.
 *      Plus de « par semaine » ni de « par jour ».
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
console.log('\n  L\'INTERFACE SE SOUVIENT · LE DÉCOUVERT D\'ABORD\n  ' + '─'.repeat(80));

/* ── A. Statique ─────────────────────────────────────────────────────── */
v('plus aucun drapeau d\'interface écrit dans les données (showDetails / showExceptions basculés)', !/\.show(Details|Exceptions) = !/.test(html));
v('tous les accordéons <details> mémorisés (sauf le mode Voyage, piloté par ses dates)',
  (html.match(/<details\s/g) || []).length === (html.match(/<details[^>]*@toggle="uiFixer\(/g) || []).length + 1 && /data-voyage :open="modeVoyageActif"/.test(html));
v('plus de tuiles « ≈ par semaine » / « par jour » ; un bloc d\'alerte découvert', !/data-liberte-semaine|data-meteo-jour/.test(html) && /data-meteo-decouvert/.test(html));

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


/* ── B. Le décor : horloge fixe (mercredi 14 oct. 2026, paie le 8), un compte courant, Assafa, un livret ── */
const JDP = 8;
const SC = { maintenant: new Date(2026, 9, 14, 10, 0, 0), mois: 11, an: 2026 };
const fixture = (sc) => {
    const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8'));
    const base = fx.donneesAnnuelles[Object.keys(fx.donneesAnnuelles)[0]];
    fx.donneesAnnuelles = {};
    for (const an of [sc.an - 1, sc.an, sc.an + 1]) fx.donneesAnnuelles[an] = JSON.parse(JSON.stringify(base));
    Object.assign(fx.soldesInitiaux, { moisActuel: sc.mois, anneeActuelle: sc.an, jourDePaie: JDP,
        compteChargesFixes: 'courant', compteChargesVariables: 'courant', assurances_tracker: [], voyageDebut: '', voyageFin: '' });
    fx.comptes = [
        { id: 1, label: 'Compte Courant', type: 'courant', solde: 1000, icone: '💳' },
        { id: 2, label: 'Compte Assafa', type: 'epargne', solde: 300, icone: '🏛️' },
        { id: 3, label: 'Livret Réserve', type: 'epargne', solde: 50000, icone: '🏦' },
    ];
    const neutre = { paye: false, montantPaye: 0, exceptions: [], showExceptions: false };
    for (const an of Object.keys(fx.donneesAnnuelles)) {
        const d = fx.donneesAnnuelles[an];
        const Rv = (label, b, j) => ({ ...neutre, label, base: b, jourPrevu: j, destinationCompte: 'courant' });
        d.revenus = { salaire: Rv('SALAIRE', 0, JDP), bonif: Rv('—', 0), magasin: Rv('—', 0), cnss: Rv('—', 0), appart: Rv('—', 0), studio: Rv('—', 0) };
        const Fx = (label, valeur, j) => ({ ...neutre, label, valeur, jourPrevu: j });
        d.chargesFixes = { creditImmo: Fx('LOYER', 6000, 20), creditStudio: Fx('—', 0), syndic: Fx('—', 0), nounou: Fx('—', 0), ecole: Fx('—', 0),
                           femmeMenage: Fx('—', 0), habitsCharif: Fx('—', 0), habitsBebe: Fx('—', 0), jouets: Fx('—', 0) };
        const V = (label, valeur, periode, details = []) => ({ ...neutre, label, valeur, periode, details, showDetails: false });
        d.chargesVariables = {
            alimentation: V('COURSES', 1000, 'semaine', [{ id: 1, nom: 'Marjane', montant: 600 }, { id: 2, nom: 'L7m', montant: 400 }]),
            sorties: V('SORTIES', 400, 'semaine'), voiture: V('—', 0, 'semaine'), sante: V('—', 0, 'semaine'),
            factures: { ...V('FACTURES', 300, 'mois'), categorieId: 'cat_cv_factures' },
        };
        d.epargne = []; d.depensesIrregulieres = []; d.virementsInternes = []; d.transactionsReelles = []; d.consoRealiseeT0 = {};
    }
    return fx;
};
let fxCourant = null;
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
    if (p === '/finance/finance_data.json') return s(200, JSON.stringify(fxCourant));
    return s(200, '{"status":"ok"}');
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port;
const browser = await pw.chromium.launch({ executablePath: chromium, args: ['--no-sandbox'] });
const ST = 'document.querySelector("#app").__vue_app__._instance.setupState';
const ouvrir = async (sc, opts = { viewport: { width: 1400, height: 1100 } }) => {
    fxCourant = fixture(sc);
    const page = await browser.newPage(opts);
    await page.clock.setFixedTime(sc.maintenant);
    const erreurs = []; page.on('pageerror', e => erreurs.push(String(e)));
    page.on('dialog', d => d.accept());
    await page.goto(`http://127.0.0.1:${port}/finance/`, { waitUntil: 'load' });
    await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState.moisBudgetaire; }, null, { timeout: 30000 });
    await page.waitForTimeout(600);
    await page.evaluate(async (ST) => { const st = eval(ST); st.appMode = 'reel'; await new Promise(r => setTimeout(r, 250)); st.activeTab = 'pilotage'; }, ST);
    await page.waitForTimeout(500);
    return { page, erreurs };
};
const sansEsp = (t) => String(t || '').replace(/\s/g, '');

const recharger = async (page) => {
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState.moisBudgetaire; }, null, { timeout: 30000 });
    await page.waitForTimeout(700);
};
const aller = (page, mode, onglet) => page.evaluate(async ({ ST, mode, onglet }) => { const st = eval(ST); st.appMode = mode; await new Promise(r => setTimeout(r, 250)); st.activeTab = onglet; await new Promise(r => setTimeout(r, 300)); }, { ST, mode, onglet });
const donnees = (page) => page.evaluate((ST) => JSON.stringify(eval(ST).donneesAnnuelles), ST);
const nf = (n) => new Intl.NumberFormat('fr-FR').format(n).replace(/\s/g, '');

try {
    /* ══ C. LA MÉMOIRE DES TIROIRS ══════════════════════════════════════ */
    const { page, erreurs } = await ouvrir(SC);
    const avant = await donnees(page);
    //  Calendrier pluriannuel : on replie janvier (ouvert par défaut), on déplie février
    await aller(page, 'previsionnel', 'irregulieres');
    const enTete = (m) => page.locator('h3', { hasText: new RegExp('^Mois ' + m + ' - ') }).first();
    await enTete(1).click(); await enTete(2).click(); await page.waitForTimeout(200);
    //  Budget Structurel : les lignes de calcul de COURSES, les périodes de LOYER
    await aller(page, 'previsionnel', 'parametres');
    await page.locator('button', { hasText: 'Voir Lignes de calcul' }).first().click();
    await page.locator('button', { hasText: 'Gérer Périodes' }).nth(0).click();
    await page.waitForTimeout(200);
    const bs = () => page.evaluate(() => ({ details: [...document.querySelectorAll('button')].filter(b => /Fermer Détails/.test(b.textContent)).length,
                                            periodes: [...document.querySelectorAll('button')].filter(b => /Masquer options/.test(b.textContent)).length }));
    const bs0 = await bs();
    //  Pilotage : le tiroir « 🏢 Charges fixes » de la file (v37.34) ; la Météo : les postes de COURSES
    await aller(page, 'reel', 'pilotage');
    await page.locator('#pilotage-inbox [data-tiroir="fixe"] > summary').click(); await page.waitForTimeout(150);
    await page.click('[data-pulse-ouvrir][data-cat="alimentation"]'); await page.waitForTimeout(200);
    const apres = await donnees(page);
    const stocke = await page.evaluate(() => JSON.parse(localStorage.getItem('finance_ui_v1') || '{}'));
    v('C. ouvrir / fermer des tiroirs n\'écrit RIEN dans les données financières', avant === apres, 'données modifiées');
    v('  → tout est dans le localStorage (finance_ui_v1)', JSON.stringify(stocke['calendrier.moisOuverts']) === JSON.stringify([4, 6, 7, 8, 9, 10, 12, 2])
      && stocke['budget.variables.alimentation.details'] === true && stocke['pilotage.tiroir.fixe'] === true && stocke['meteo.postes'] && stocke['meteo.postes'].alimentation === true,
      JSON.stringify(stocke));
    await recharger(page);
    await aller(page, 'previsionnel', 'irregulieres');
    const cal = await page.evaluate((ST) => [...eval(ST).moisOuverts], ST);
    const visibles = await page.evaluate(() => [...document.querySelectorAll('h3')].filter(h => /^Mois \d+ - /.test(h.textContent.trim())).map(h => [Number(h.textContent.trim().split(' ')[1]), h.parentElement.nextElementSibling && getComputedStyle(h.parentElement.nextElementSibling).display !== 'none']));
    v('  → après rechargement, le Calendrier : janvier replié, février déplié — comme laissés', !cal.includes(1) && cal.includes(2)
      && visibles.find(x => x[0] === 1)[1] === false && visibles.find(x => x[0] === 2)[1] === true, JSON.stringify([cal, visibles.slice(0, 3)]));
    await aller(page, 'previsionnel', 'parametres');
    const bs1 = await bs();
    v('  → le Budget Structurel : les lignes de calcul et les périodes restent ouvertes', bs0.details === 1 && bs0.periodes === 1 && bs1.details === 1 && bs1.periodes === 1, JSON.stringify([bs0, bs1]));
    await aller(page, 'reel', 'pilotage');
    const pil = await page.evaluate(() => ({ entrees: document.querySelector('#pilotage-inbox [data-tiroir="fixe"]')?.open,
                                             postes: !!document.querySelector('[data-pulse-postes][data-cat="alimentation"]') }));
    v('  → le Pilotage (tiroir « Charges fixes ») et la Météo (postes de COURSES) aussi', pil.entrees === true && pil.postes, JSON.stringify(pil));
    //  Sans choix enregistré : le comportement d'avant (le CFO ouvre le panneau qu'il remplit)
    await page.evaluate(async (ST) => { const st = eval(ST); st.donneesAnnuelles[st.moisBudgetaire.an].chargesVariables.sorties.showExceptions = true; await new Promise(r => setTimeout(r, 100)); }, ST);
    await aller(page, 'previsionnel', 'parametres');
    const bs2 = await bs();
    v('  → sans choix enregistré, un panneau ouvert par les données (le CFO) s\'ouvre toujours', bs2.periodes === 2, JSON.stringify(bs2));
    v('aucune erreur JavaScript (mémoire, bureau)', erreurs.length === 0, erreurs[0] || '');
    await page.close();
    //  Téléphone : un accordéon du Budget (💰 Revenus) et le mois du calendrier mobile
    const mo = await ouvrir(SC, { viewport: { width: 384, height: 832 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await mo.page.evaluate(async (ST) => { const st = eval(ST); st.appMode = 'previsionnel'; await new Promise(r => setTimeout(r, 300)); st.activeMobileTab = 'parametres'; await new Promise(r => setTimeout(r, 300)); }, ST);
    const ouvrirRevenus = () => mo.page.evaluate(() => { const d = [...document.querySelectorAll('details')].find(x => x.className.includes('border-green-500')); if (d) d.open = true; return !!d; });
    v('téléphone : l\'accordéon 💰 Revenus existe', await ouvrirRevenus());
    await mo.page.waitForTimeout(200);
    await recharger(mo.page);
    await mo.page.evaluate(async (ST) => { const st = eval(ST); st.appMode = 'previsionnel'; await new Promise(r => setTimeout(r, 300)); st.activeMobileTab = 'parametres'; await new Promise(r => setTimeout(r, 300)); }, ST);
    const mob = await mo.page.evaluate(() => { const d = [...document.querySelectorAll('details')]; return { revenus: d.find(x => x.className.includes('border-green-500'))?.open, boussole: d.find(x => x.querySelector('summary')?.textContent.includes('🧭'))?.open }; });
    v('  → après rechargement : 💰 Revenus reste ouvert, 🧭 (ouvert par défaut) aussi', mob.revenus === true && mob.boussole === true, JSON.stringify(mob));
    v('aucune erreur JavaScript (mémoire, téléphone)', mo.erreurs.length === 0, mo.erreurs[0] || '');
    await mo.page.close();

    /* ══ D. LE DÉCOUVERT D'ABORD ════════════════════════════════════════ */
    const al = await ouvrir(SC);
    const etat = () => al.page.evaluate((ST) => { const st = eval(ST), a = st.atterrissageCycle;
        return { comptes: a.comptes.map(c => ({ key: c.key, label: c.label, atterrissage: c.atterrissage })), meteo: JSON.parse(JSON.stringify({ etat: st.meteoFinanciere.etat, decouverts: st.meteoFinanciere.decouverts })) }; }, ST);
    const bloc = () => al.page.evaluate(() => { const b = document.querySelector('[data-meteo-decouvert]'); const m = document.querySelector('[data-meteo]');
        return { bloc: !!b, avantCarte: !!b && b.getBoundingClientRect().top < m.querySelector('[data-liberte]').getBoundingClientRect().top,
                 lignes: b ? [...b.querySelectorAll('[data-meteo-decouvert-compte]')].map(l => ({ cle: l.dataset.compte, nom: l.querySelector('[data-meteo-decouvert-nom]')?.textContent.trim(),
                     montant: l.querySelector('[data-meteo-decouvert-montant]')?.textContent.replace(/\s/g, ''), sauvetage: l.querySelector('[data-meteo-sauvetage]')?.textContent.replace(/\s+/g, ' ').trim(),
                     evitable: !!l.querySelector('[data-meteo-decouvert-evitable]') })) : [],
                 raison: m.querySelector('[data-meteo-raison]')?.textContent.trim(), tuiles: m.querySelectorAll('[data-meteo-jour], [data-liberte-semaine]').length,
                 jours: m.querySelector('[data-liberte-jours]')?.textContent.trim() }; });
    const solde = (k, x) => al.page.evaluate(async ({ ST, k, x }) => { const st = eval(ST); st.comptes.find(c => c.id === k).solde = x; st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 250)); }, { ST, k, x });
    //  D1. Le courant plonge (1 000 − loyer 6 000 − la conso) ; le livret couvre
    let e = await etat(), b = await bloc();
    const cc = e.comptes.find(c => c.key === 'cpt_1');
    const manque = Math.ceil(-cc.atterrissage);
    v(`D. le courant finit le cycle à ${nf(cc.atterrissage)} : bloc rouge en tête de la Météo, avant la carte « Reste à dépenser »`,
      cc.atterrissage < 0 && e.meteo.etat === 'orage' && b.bloc && b.avantCarte, JSON.stringify([cc, e.meteo.etat, b.bloc, b.avantCarte]));
    const l1 = b.lignes[0] || {};
    v(`  → le compte (« Courant », son nom court) et ce qui manque (− ${nf(manque)} DH), en gros`, b.lignes.length === 1 && l1.cle === 'cpt_1' && l1.nom === 'Courant' && l1.montant === '−' + nf(manque) + 'DH', JSON.stringify(b.lignes));
    v('  → l\'action de sauvetage : « Virer X depuis Réserve avant le … »', /^➜ Virer [\d\s ]+ DH depuis .*Réserve avant le /.test(l1.sauvetage || '') && sansEsp(l1.sauvetage).includes(nf(manque) + 'DH'), String(l1.sauvetage));
    v('  → le paragraphe ne répète plus le découvert ; plus de tuiles par jour / par semaine ; « (dans N j) »',
      b.raison === 'Un compte finit le cycle dans le rouge : le virement ci-dessus l’évite.' && b.tuiles === 0 && /^\(dans \d+ j\)$/.test(b.jours || ''), JSON.stringify([b.raison, b.tuiles, b.jours]));
    //  D2. Plus aucun compte pour couvrir : on le dit
    await solde(3, 100);
    b = await bloc();
    v('D2. aucun compte ne couvre l\'écart : « Il manque X … aucun compte ne le couvre seul »', b.lignes.length === 1 && /^➜ Il manque .* aucun compte ne le couvre seul/.test(b.lignes[0].sauvetage), JSON.stringify(b.lignes));
    //  D3. Le courant tient si l'on s'en tient au Reste à dépenser : on le dit aussi
    await solde(3, 50000); await solde(1, 7000);
    e = await etat(); b = await bloc();
    const cc3 = e.comptes.find(c => c.key === 'cpt_1');
    v('D3. découvert seulement si TOUT le budget conso part : « ou : tenez-vous au Reste à dépenser »',
      cc3.atterrissage < 0 && b.lignes.length === 1 && b.lignes[0].evitable, JSON.stringify([cc3.atterrissage, b.lignes]));
    //  D4. Un AUTRE compte dans le rouge (Assafa) : il a son bloc, avec son virement
    await solde(1, 30000); await solde(2, -800);
    e = await etat(); b = await bloc();
    const as = e.comptes.find(c => c.key === 'cpt_2');
    v(`D4. Assafa finit à ${nf(as.atterrissage)} (courant sain) : bloc « Assafa », − ${nf(Math.ceil(-as.atterrissage))} DH, virement depuis un compte qui couvre`,
      as.atterrissage < 0 && b.lignes.length === 1 && b.lignes[0].cle === 'cpt_2' && b.lignes[0].nom === 'Assafa' && b.lignes[0].montant === '−' + nf(Math.ceil(-as.atterrissage)) + 'DH'
      && /^➜ Virer .* depuis /.test(b.lignes[0].sauvetage), JSON.stringify([as, b.lignes]));
    //  D5. Tout va bien : pas de bloc, le paragraphe revient
    await solde(2, 5000);
    e = await etat(); b = await bloc();
    v('D5. aucun compte dans le rouge : pas de bloc, la Météo parle normalement', !b.bloc && e.meteo.decouverts.length === 0 && !!b.raison && !/rouge/.test(b.raison), JSON.stringify([b.bloc, b.raison]));
    v('aucune erreur JavaScript (découvert)', al.erreurs.length === 0, al.erreurs[0] || '');
    await al.page.close();
} catch (e) {
    v('exécution sans exception', false, String(e && e.stack || e).slice(0, 400));
} finally {
    await browser.close(); srv.close();
}
console.log('  ' + '─'.repeat(80));
console.log(ko === 0 ? '  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
