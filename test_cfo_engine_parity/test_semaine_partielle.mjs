/**
 * v37.48 — UNE SEMAINE SAISIE EN PARTIE.
 *
 *   « Si je rentre une partie du budget et la semaine finit, par exemple œufs 45 sur 50,
 *   la valeur comptabilisée de cette semaine sera 45 et non 50 ; 50 ne sera comptabilisé
 *   que si je laisse le champ vide. »
 *
 *   Contre des calculs faits à la main, dans un cycle de 5 semaines (paie le 8 : 8 oct. →
 *   7 nov. 2026). COURSES : Marjane 600 / sem, Œufs 50 / sem, Samak 75 / sem, Hri 1 000 / cycle ;
 *   SORTIES 400 / sem, sans ligne. Prévu d'une semaine : 600 + 50 + 75 + 400 = 1 125 DH.
 *   Budget du cycle : 725 × 5 + 1 000 + 400 × 5 = 6 625 DH.
 *
 *     A. statique ;
 *     B. dimanche 18 oct., 21 h — semaine du 12 au 18 EN COURS : Œufs 45 et Marjane 180 tapés,
 *        Samak vide, un ticket « MARJANE » 100 non rangé sur une ligne. La note annonce la
 *        clôture : SORTIES 400 · Samak 75, soit 475 DH ;
 *     C. lundi 19 oct., 9 h — la semaine se clôt : Œufs 45 (pas 50), Marjane 180, Samak 75 ;
 *        l'engagé monte de 475, exactement ce que la note annonçait ;
 *     D. « Autre » tapé : Samak garde son prévu ;
 *     E. corriger : Samak tapé 0 → 0 ; vider Œufs → 50 ; un ticket rangé sur Samak le remplace ;
 *     F. l'affichage de la semaine close et de la semaine en cours.
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
console.log('\n  SEMAINE SAISIE EN PARTIE : TAPÉ = COMPTÉ, VIDE = PRÉVU\n  ' + '─'.repeat(80));

/* ── A. Statique ─────────────────────────────────────────────────────── */
const corps = (html.match(/const defautsSemaine = \(lundiISO[^]*?\n {20}\};/) || [''])[0];
v('A. le défaut d\'une semaine ne « règle plus en vrac » une catégorie à lignes', !!corps && !/nonVentile/.test(corps) && !/vals\[key\]/.test(corps), corps.slice(0, 120));
v('  → la semaine en cours annonce sa clôture (note + projection)', /data-semaine-a-venir/.test(html) && /defautsSemaine\(lundiSel, true\)/.test(html));

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
const JDP = 8;
const S1 = '2026-10-05', S2 = '2026-10-12', S3 = '2026-10-19';
const SEMAINE = 600 + 50 + 75 + 400;                         // 1 125
const BUDGET = (600 + 50 + 75) * 5 + 1000 + 400 * 5;         // 6 625
const fixture = () => {
    const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8'));
    const base = fx.donneesAnnuelles[Object.keys(fx.donneesAnnuelles)[0]];
    fx.donneesAnnuelles = {};
    for (const an of [2025, 2026, 2027]) fx.donneesAnnuelles[an] = JSON.parse(JSON.stringify(base));
    Object.assign(fx.soldesInitiaux, { moisActuel: 11, anneeActuelle: 2026, jourDePaie: JDP,
        compteChargesFixes: 'courant', compteChargesVariables: 'courant', assurances_tracker: [], voyageDebut: '', voyageFin: '' });
    fx.comptes = [{ id: 1, label: 'Compte Courant', type: 'courant', solde: 90000, icone: '💳' }];
    const neutre = { paye: false, montantPaye: 0, exceptions: [], showExceptions: false };
    for (const an of Object.keys(fx.donneesAnnuelles)) {
        const d = fx.donneesAnnuelles[an];
        const Rv = (label, b, j) => ({ ...neutre, label, base: b, jourPrevu: j, destinationCompte: 'courant' });
        d.revenus = { salaire: Rv('SALAIRE', 20000, JDP), bonif: Rv('—', 0), magasin: Rv('—', 0), cnss: Rv('—', 0), appart: Rv('—', 0), studio: Rv('—', 0) };
        const Fx = (label, valeur) => ({ ...neutre, label, valeur, jourPrevu: null });
        d.chargesFixes = { creditImmo: Fx('LOYER', 6000), creditStudio: Fx('—', 0), syndic: Fx('—', 0), nounou: Fx('—', 0), ecole: Fx('—', 0),
                           femmeMenage: Fx('—', 0), habitsCharif: Fx('—', 0), habitsBebe: Fx('—', 0), jouets: Fx('—', 0) };
        const V = (label, valeur, periode, details = []) => ({ ...neutre, label, valeur, periode, details });
        d.chargesVariables = {
            alimentation: V('COURSES', 725, 'semaine', [{ id: 1, nom: 'Marjane', montant: 600 }, { id: 2, nom: 'Œufs', montant: 50 },
                                                         { id: 3, nom: 'Samak', montant: 75 }, { id: 4, nom: 'Hri', montant: 1000, periode: 'cycle' }]),
            sorties: V('SORTIES', 400, 'semaine'), voiture: V('—', 0, 'mois'), sante: V('—', 0, 'semaine'),
            factures: { ...V('FACTURES', 399, 'mois', [{ id: 11, nom: 'tel', montant: 99 }, { id: 12, nom: 'eau', montant: 300 }]), categorieId: 'cat_cv_factures' },
        };
        d.epargne = []; d.depensesIrregulieres = []; d.virementsInternes = []; d.transactionsReelles = []; d.consoRealiseeT0 = {};
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
const sansEsp = (t) => String(t || '').replace(/\s/g, '');
const trie = (o) => JSON.stringify(Object.entries(o || {}).sort(([a], [b]) => a < b ? -1 : 1));
const nf = (n) => new Intl.NumberFormat('fr-FR').format(n).replace(/\s/g, '');

//  La même semaine du 12 au 18 dans les deux horloges : Œufs 45, Marjane 180, Samak vide,
//  un ticket MARJANE 100 le samedi 17 sur la catégorie (non rangé sur une ligne).
const ouvrir = async (maintenant) => {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
    await page.clock.setFixedTime(maintenant);
    const erreurs = []; page.on('pageerror', e => erreurs.push(String(e)));
    page.on('dialog', d => d.accept());
    await page.goto(`http://127.0.0.1:${port}/finance/`, { waitUntil: 'load' });
    await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState.moisBudgetaire; }, null, { timeout: 30000 });
    await page.waitForTimeout(600);
    await page.evaluate(async ({ ST, S2 }) => { const st = eval(ST), an = st.moisBudgetaire.an;
        st.saisirSemaineConso(S2, 'alimentation::2', 45);
        st.saisirSemaineConso(S2, 'alimentation::1', 180);
        const cv = st.donneesAnnuelles[an].chargesVariables.alimentation;
        st.donneesAnnuelles[an].transactionsReelles.push({ id: 9101, date: '2026-10-17', libelle: 'MARJANE', montant: 100, categorieId: cv.categorieId, compteId: 1, source: 'test' });
        st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 150));
        st.appMode = 'reel'; await new Promise(r => setTimeout(r, 250)); st.activeTab = 'pilotage'; }, { ST, S2 });
    await page.waitForTimeout(500);
    return { page, erreurs };
};
const etat = (page) => page.evaluate((ST) => { const st = eval(ST), L = st.liberteCycle;
    const c = (k) => L.categories.find(x => x.key === k) || {};
    return { engage: L.engage, budget: L.budget, env: Math.round(st.enveloppeConsoRestante), semaine: JSON.parse(JSON.stringify(L.semaine)),
             defauts: JSON.parse(JSON.stringify(st.consoDefautsDuCycle)), alim: c('alimentation').engage, sorties: c('sorties').engage,
             alimSem: (c('alimentation').sem || {}).engage, postesSem: Object.fromEntries(((c('alimentation').sem || {}).postes || []).map(p => [p.nom, p.engage])),
             catId: st.donneesAnnuelles[st.moisBudgetaire.an].chargesVariables.alimentation.categorieId,
             samakId: st.donneesAnnuelles[st.moisBudgetaire.an].chargesVariables.alimentation.details[2].categorieId }; }, ST);
const saisir = (page, lundi, k, m) => page.evaluate(async ({ ST, lundi, k, m }) => { eval(ST).saisirSemaineConso(lundi, k, m); await new Promise(r => setTimeout(r, 100)); }, { ST, lundi, k, m });
const note = (page, sel) => page.evaluate((sel) => document.querySelector(sel)?.textContent.replace(/\s+/g, ' ').trim() || null, sel);

let dimanche = null;
try {
    /* ── B. Dimanche soir : la semaine du 12 au 18 est encore EN COURS ── */
    await section('B', async () => {
        const { page, erreurs } = await ouvrir(new Date(2026, 9, 18, 21, 0, 0));
        const e = await etat(page);
        dimanche = e;
        v(`B. dimanche 21 h : seule la semaine du 5 est close (rien saisi → ${nf(SEMAINE)} au prévu)`,
          JSON.stringify(Object.keys(e.defauts)) === JSON.stringify([S1]) && trie(e.defauts[S1]) === trie({ 'alimentation::1': 600, 'alimentation::2': 50, 'alimentation::3': 75, sorties: 400 }),
          JSON.stringify(e.defauts));
        v('  → semaine du 12 : COURSES = 45 + 180 = 225 (le ticket 100 non rangé : max(225, 100))',
          e.semaine.lundi === S2 && e.semaine.statut === 'en_cours' && e.alimSem === 225, JSON.stringify([e.semaine.lundi, e.alimSem]));
        v(`  → cycle : engagé ${nf(SEMAINE)} + 225 = 1 350, enveloppe ${nf(BUDGET)} − 1 350 = 5 275`,
          e.engage === 1350 && e.budget === BUDGET && e.env === 5275, JSON.stringify([e.engage, e.budget, e.env]));
        v('  → la clôture annoncée : SORTIES 400, Samak 75 — soit 475 (Œufs et Marjane : tapés)',
          JSON.stringify(e.semaine.aVenir.map(l => [l.nom, l.montant])) === '[["SORTIES",400],["Samak",75]]' && e.semaine.aVenirTotal === 475,
          JSON.stringify([e.semaine.aVenir, e.semaine.aVenirTotal]));
        await (await page.$('[data-semaine-nav]')).scrollIntoViewIfNeeded();
        const n = await note(page, '[data-semaine-a-venir]');
        v('  → la note le dit : « Dimanche soir… tapée compte ce que vous avez tapé… SORTIES 400 DH · Samak 75 DH, soit 475 DH »',
          !!n && n.includes('une ligne tapée compte ce que vous avez tapé') && sansEsp(n).includes('SORTIES400DH·Samak75DH,soit475DH') && n.includes('Tapez 0'), String(n));
        v('aucune erreur JavaScript (dimanche)', erreurs.length === 0, erreurs[0] || '');
        await page.close();
    });

    /* ── C → F. Lundi matin : la semaine du 12 au 18 est close ─────────── */
    const { page, erreurs } = await ouvrir(new Date(2026, 9, 19, 9, 0, 0));
    await section('C', async () => {
        const e = await etat(page);
        v('C. lundi 9 h : la semaine du 12 se clôt — seul Samak (vide) et SORTIES reçoivent leur prévu',
          trie(e.defauts[S2]) === trie({ 'alimentation::3': 75, sorties: 400 }), JSON.stringify(e.defauts[S2]));
        const sem2 = await page.evaluate(async ({ ST }) => { const st = eval(ST); st.semaineDecalage = -1; await new Promise(r => setTimeout(r, 120));
            const c = st.liberteCycle.categories.find(x => x.key === 'alimentation'); const out = { total: c.sem.engage, postes: Object.fromEntries(c.sem.postes.map(p => [p.nom, p.engage])), lundi: st.liberteCycle.semaine.lundi, aVenir: st.liberteCycle.semaine.aVenirTotal };
            st.semaineDecalage = 0; await new Promise(r => setTimeout(r, 120)); return out; }, { ST });
        v('  → ligne par ligne : Œufs 45, Marjane 180, Samak 75, Hri 0 — total 300',
          sem2.lundi === S2 && sem2.postes['Œufs'] === 45 && sem2.postes.Marjane === 180 && sem2.postes.Samak === 75 && sem2.postes.Hri === 0 && sem2.total === 300, JSON.stringify(sem2));
        v('  → une semaine close n\'a plus rien à annoncer (sa clôture est faite)', sem2.aVenir === 0, JSON.stringify(sem2));
        v('  → cycle : COURSES 725 + 300 = 1 025, SORTIES 400 × 2 = 800, engagé 1 825',
          e.alim === 1025 && e.sorties === 800 && e.engage === 1825, JSON.stringify([e.alim, e.sorties, e.engage]));
        v('  → l\'engagé monte de 475 depuis dimanche soir : exactement la clôture annoncée ; enveloppe 5 275 − 475 = 4 800',
          !!dimanche && e.engage - dimanche.engage === dimanche.semaine.aVenirTotal && e.env === 4800, JSON.stringify([dimanche && dimanche.engage, e.engage, e.env]));
    });

    /* ── D. « Autre » est hors de la liste : il ne vide pas les lignes ── */
    await section('D', async () => {
        await saisir(page, S2, 'alimentation', 900);
        const e = await etat(page);
        v('D. « Autre » 900 la semaine du 12 : Samak garde son prévu — COURSES 1 025 + 900 = 1 925',
          e.defauts[S2]['alimentation::3'] === 75 && e.alim === 1925, JSON.stringify([e.defauts[S2], e.alim]));
        await saisir(page, S2, 'alimentation', '');
    });

    /* ── E. Corriger une ligne ───────────────────────────────────────── */
    await section('E', async () => {
        await saisir(page, S2, 'alimentation::3', 0);
        let e = await etat(page);
        v('E. Samak tapé 0 (« rien dépensé ») : plus de prévu — COURSES 725 + 225 = 950',
          !('alimentation::3' in (e.defauts[S2] || {})) && e.alim === 950, JSON.stringify([e.defauts[S2], e.alim]));
        await saisir(page, S2, 'alimentation::3', '');
        await saisir(page, S2, 'alimentation::2', '');
        e = await etat(page);
        v('  → vider Œufs lui rend son prévu (50) : COURSES 725 + 180 + 50 + 75 = 1 030',
          e.defauts[S2]['alimentation::2'] === 50 && e.alim === 1030, JSON.stringify([e.defauts[S2], e.alim]));
        await saisir(page, S2, 'alimentation::2', 45);
        await page.evaluate(async ({ ST }) => { const st = eval(ST), an = st.moisBudgetaire.an;
            const samak = st.donneesAnnuelles[an].chargesVariables.alimentation.details[2].categorieId;
            st.donneesAnnuelles[an].transactionsReelles.push({ id: 9102, date: '2026-10-14', libelle: 'POISSONNIER', montant: 60, categorieId: samak, compteId: 1, source: 'test' });
            st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 150)); }, { ST });
        e = await etat(page);
        v('  → un ticket rangé sur Samak (60, le 14) remplace son prévu cette semaine-là',
          !('alimentation::3' in (e.defauts[S2] || {})) && e.defauts[S2].sorties === 400, JSON.stringify(e.defauts[S2]));
        await page.evaluate(async ({ ST }) => { const st = eval(ST), an = st.moisBudgetaire.an;
            st.donneesAnnuelles[an].transactionsReelles = st.donneesAnnuelles[an].transactionsReelles.filter(t => t.id !== 9102);
            st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 150)); }, { ST });
    });

    /* ── F. L'affichage ──────────────────────────────────────────────── */
    await section('F', async () => {
        await (await page.$('[data-semaine-nav]')).scrollIntoViewIfNeeded();
        const n3 = await note(page, '[data-semaine-a-venir]');
        v('F. semaine du 19 en cours, rien tapé : « Marjane 600 DH · SORTIES 400 DH · Samak 75 DH · + 1 autre(s), soit 1 125 DH »',
          !!n3 && sansEsp(n3).includes('Marjane600DH·SORTIES400DH·Samak75DH·+1autre(s),soit1125DH'), String(n3));
        await page.click('[data-semaine-prec]'); await page.waitForTimeout(250);
        const ouvert = await page.$('[data-pulse-poste-saisie][data-poste="alimentation::3"]');
        if (!ouvert || !(await ouvert.isVisible())) { await page.click('[data-pulse-ouvrir][data-cat="alimentation"]'); await page.waitForTimeout(250); }
        const vue = await page.evaluate(() => ({
            cases: Object.fromEntries([...document.querySelectorAll('[data-pulse-poste-saisie][data-poste^="alimentation::"]')].map(i => [i.dataset.poste, [i.value, i.dataset.defaut || '']])),
            aVenir: !!document.querySelector('[data-semaine-a-venir]'),
            defaut: document.querySelector('[data-semaine-defaut]')?.textContent.replace(/\s+/g, ' ').trim() }));
        v('  → semaine du 12 close : Œufs « 45 », Marjane « 180 » (tapés) ; Samak « 75 » retenu au prévu',
          JSON.stringify(vue.cases['alimentation::2']) === '["45",""]' && JSON.stringify(vue.cases['alimentation::1']) === '["180",""]' && JSON.stringify(vue.cases['alimentation::3']) === '["75","1"]',
          JSON.stringify(vue.cases));
        v('  → la note de semaine close (475 au prévu) remplace l\'annonce', !vue.aVenir && !!vue.defaut && sansEsp(vue.defaut).includes('(475DH)'), JSON.stringify(vue));
        await page.evaluate(async (ST) => { eval(ST).semaineDecalage = 1; await new Promise(r => setTimeout(r, 150)); }, ST);
        v('  → une semaine à venir n\'annonce rien', !(await page.$('[data-semaine-a-venir]')));
        v('aucune erreur JavaScript (lundi)', erreurs.length === 0, erreurs[0] || '');
    });
    await page.close();
} catch (e) {
    v('exécution sans exception', false, String(e && e.stack || e).slice(0, 400));
} finally {
    await browser.close(); srv.close();
}
console.log('  ' + '─'.repeat(80));
console.log(ko === 0 ? '  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
