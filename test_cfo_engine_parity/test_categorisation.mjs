/**
 * v37.49 — CATÉGORISATION : RÈGLES HORS-LIGNE, IA, ET LE DOUTE À VOUS.
 *
 *   « C'est très important que l'appli sache catégoriser. Je veux des règles offline très
 *   complètes, darija et français, et s'il n'arrive pas à catégoriser il consulte l'IA — ici
 *   même mcdo il ne sait pas le catégoriser. S'il y a un doute : à catégoriser à la main,
 *   surligné. »
 *
 *   Le décor reprend VOS catégories (Alimentation (Tqdya) avec samak, l7m, kfta, djaj…,
 *   Sorties avec « cafe Resto Wknd » et « Cafe Charif », Voiture avec « essence picanto » et
 *   « diesel skoda »…), plus une catégorie restée au registre (« Marjane Lait ») qui ne doit
 *   jamais être proposée. L'IA est simulée (le webhook est intercepté).
 *
 *     A. statique · B. le moteur, libellé par libellé · C. il apprend de vos choix ·
 *     D. la saisie (sûr, doute, inconnu) · E. l'IA (haute, moyenne, id inventé, panne, une à la fois) ·
 *     F. À catégoriser et le journal · G. les règles visibles · H. le mobile.
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
console.log('\n  CATÉGORISATION : RÈGLES HORS-LIGNE, IA, DOUTE À VOUS\n  ' + '─'.repeat(80));

/* ── A. Statique ─────────────────────────────────────────────────────── */
v('A. le moteur à notes remplace les trois couches v32.60', /const categoriserLibelle = \(libelle\)/.test(html) && !/const _guessCategorieId = /.test(html) && !/const ALIAS_CATEGORIES = /.test(html));
v('  → panneau « À catégoriser », journal surligné, règles visibles, repli IA', /data-a-categoriser\b/.test(html) && /:data-a-verifier=/.test(html) && /data-regles-categorisation/.test(html) && /session_id: 'categorisation'/.test(html));

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

//  L'IA simulée : la réponse dépend du libellé ; on mesure la simultanéité
const ia = { requetes: [], enVol: 0, maxEnVol: 0 };
const REPONSES = {
    zzqx: { output: 'Voici :\n```json\n{"id": "cat_cv_sorties__dbarber", "confiance": "haute", "raison": "coupe de cheveux"}\n```' },
    'truc bizarre': { output: '<p>{&quot;id&quot;: &quot;cat_cv_alimentation&quot;, &quot;confiance&quot;: &quot;moyenne&quot;, &quot;raison&quot;: &quot;des courses ?&quot;}</p>' },
    'objet inconnu': { output: '{"id": "cat_invente", "confiance": "haute", "raison": "?"}' },
};

const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
await page.clock.setFixedTime(new Date(2026, 9, 13, 12, 0, 0));
const erreurs = []; page.on('pageerror', e => erreurs.push(String(e)));
page.on('dialog', d => d.accept());
await page.route('**/webhook/**', async (route) => {
    const corps = JSON.parse(route.request().postData() || '{}');
    ia.requetes.push(corps); ia.enVol++; ia.maxEnVol = Math.max(ia.maxEnVol, ia.enVol);
    const lib = ((corps.question || '').match(/Dépense : « ([^»]*) »/) || [])[1] || '';
    await new Promise(r => setTimeout(r, 400));
    ia.enVol--;
    if (lib === 'panne') return route.abort();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(REPONSES[lib] || { output: '{"id": null, "confiance": "basse", "raison": "rien"}' }) });
});
await page.goto(`http://127.0.0.1:${port}/finance/`, { waitUntil: 'load' });
await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState.moisBudgetaire; }, null, { timeout: 30000 });
await page.waitForTimeout(600);
await page.evaluate(async (ST) => { const st = eval(ST); st.appMode = 'reel'; await new Promise(r => setTimeout(r, 250)); st.activeTab = 'saisie'; }, ST);
await page.waitForTimeout(500);

const cat = (libs) => page.evaluate(({ ST, libs }) => { const st = eval(ST); const lab = (id) => id ? String(st.getCategorieLabel(id)).trim() : null;
    return Object.fromEntries(libs.map(l => { const r = st.categoriserLibelle(l); return [l, { statut: r.statut, cat: lab(r.id), source: r.source, candidats: r.candidats.map(lab) }]; })); }, { ST, libs });
const txs = () => page.evaluate((ST) => JSON.parse(JSON.stringify(eval(ST).donneesAnnuelles[2026].transactionsReelles)), ST);
const tx = async (libelle) => (await txs()).filter(t => t.libelle === libelle).pop() || null;
const idDe = (label) => page.evaluate(({ ST, label }) => { const c = (eval(ST).soldesInitiaux.categories || []).find(x => String(x.label).trim() === label && !x.archive); return c ? c.id : null; }, { ST, label });
const saisir = async (texte) => { const i = page.locator('input[placeholder="Ex: 200 courses"]'); await i.fill(texte); await page.waitForTimeout(150); };
const valider = async () => { await page.locator('input[placeholder="Ex: 200 courses"]').press('Enter'); await page.waitForTimeout(200); };
const badge = () => page.evaluate(() => { const b = document.querySelector('[data-saisie-cat]'); const i = document.querySelector('[data-saisie-cat-inconnue]');
    return { statut: b ? b.dataset.statut : null, texte: (b || i || {}).textContent ? (b || i).textContent.replace(/\s+/g, ' ').trim() : null,
             puces: [...document.querySelectorAll('[data-saisie-suggestion]')].map(x => x.textContent.trim()) }; });
const ligne = (txId) => page.evaluate((id) => { const l = document.querySelector(`[data-a-categoriser-ligne][data-tx="${id}"]`); return l ? l.textContent.replace(/\s+/g, ' ').trim() : null; }, txId);
const attendreIA = async () => { await page.waitForFunction((ST) => Object.keys(eval(ST).iaCategorisation.enCours).length === 0, ST, { timeout: 10000 }); await page.waitForTimeout(150); };

try {
    /* ── B. Le moteur, libellé par libellé ───────────────────────────── */
    await section('B', async () => {
        const r = await cat(['mcdonald s', 'McDo', 'burger king', 'glovo', 'Marjane', 'carrefour', 'alimentation']);
        v('B. « mcdonald s », « McDo », « burger king », « glovo » → cafe Resto Wknd (règle fast-food), sûr',
          //  v37.52 : l'ancien « mcdonald s » a été rangé d'office au chargement — il est désormais aussi « appris »
          ['mcdonald s', 'McDo', 'burger king', 'glovo'].every(l => r[l].statut === 'sur' && r[l].cat === 'cafe Resto Wknd' && (r[l].source === 'règle' || (l === 'mcdonald s' && r[l].source === 'appris'))), JSON.stringify(r));
        v('  → « Marjane » → VOTRE ligne Marjane (pas Alimentation, ni l\'ancienne « Marjane Lait »)',
          r.Marjane.statut === 'sur' && r.Marjane.cat === 'Marjane' && r.Marjane.source === 'libellé' && !r.Marjane.candidats.includes('Marjane Lait'), JSON.stringify(r.Marjane));
        v('  → « carrefour », « alimentation » → Alimentation (Tqdya), pas les poches d\'épargne « Épargne courses » ni « Alimentation depenses annuels »',
          r.carrefour.cat === 'Alimentation (Tqdya)' && r.carrefour.statut === 'sur' && r.alimentation.cat === 'Alimentation (Tqdya)' && r.alimentation.statut === 'sur', JSON.stringify([r.carrefour, r.alimentation]));
        const d = await cat(['khodra', 'خضرة', 'légumes', 'lhem', 'لحم', 'kefta', 'djej', '7out', 'bid', 'الخضرة']);
        const att = { khodra: 'khdra', 'خضرة': 'khdra', 'légumes': 'khdra', lhem: 'l7m', 'لحم': 'l7m', kefta: 'kfta', djej: 'djaj', '7out': 'samak', bid: 'Œufs', 'الخضرة': 'khdra' };
        v('  → darija et arabe : khodra / خضرة / الخضرة → khdra, lhem / لحم → l7m, kefta → kfta, djej → djaj, 7out → samak, bid → Œufs',
          Object.entries(att).every(([l, c]) => d[l].statut === 'sur' && d[l].cat === c), JSON.stringify(Object.fromEntries(Object.entries(d).map(([k, x]) => [k, x.cat + ' ' + x.statut]))));
        const e = await cat(['eau minerale sidi ali', 'eau', 'gasoil', 'lisans', 'ghsil', 'pharmacie', 'dwa', 'tbib', 'psy', 'lydec', 'recharge inwi', 'netflix', 'chatgpt plus', 'spotify']);
        const att2 = { 'eau minerale sidi ali': 'Alimentation (Tqdya)', eau: 'eau', gasoil: 'diesel skoda', lisans: 'essence picanto', ghsil: 'Ghsil voiture', pharmacie: 'Medicam (reste à charge)', dwa: 'Medicam (reste à charge)',
                       tbib: 'Medecin (reste à charge)', psy: 'Psy', lydec: 'elect', 'recharge inwi': 'tel', netflix: 'netflix', 'chatgpt plus': 'chatgpt', spotify: 'Factures' };
        v('  → « eau minerale » (expression) bat votre ligne « eau » ; gasoil → diesel skoda, lisans → essence picanto, dwa → Medicam, lydec → elect…',
          Object.entries(att2).every(([l, c]) => e[l].statut === 'sur' && e[l].cat === c), JSON.stringify(Object.fromEntries(Object.entries(e).map(([k, x]) => [k, x.cat + ' ' + x.statut]))));
        const f = await cat(['afriquia', 'café', 'zara', 'credit', 'hdiya l3id', 'zzqx']);
        v('  → DOUTE « afriquia » : essence picanto ou diesel skoda ? → Voiture (la mère), les deux en pistes',
          f.afriquia.statut === 'doute' && f.afriquia.cat === 'Voiture' && f.afriquia.candidats.includes('essence picanto') && f.afriquia.candidats.includes('diesel skoda'), JSON.stringify(f.afriquia));
        v('  → DOUTE « café » : cafe Resto Wknd ou Cafe Charif ? → Sorties',
          f['café'].statut === 'doute' && f['café'].cat === 'Sorties' && f['café'].candidats.includes('Cafe Charif') && f['café'].candidats.includes('cafe Resto Wknd'), JSON.stringify(f['café']));
        v('  → DOUTE « zara » (Habits Charif / Habits Bébé), « credit » (Immo / Studio), « hdiya l3id » (Dépense exceptionnelle, piste faible)',
          f.zara.statut === 'doute' && f.zara.candidats.includes('Habits Charif') && f.zara.candidats.includes('Habits Bébé')
          && f.credit.statut === 'doute' && f.credit.candidats.includes('Crédit Studio') && f['hdiya l3id'].statut === 'doute' && f['hdiya l3id'].cat === 'Dépense exceptionnelle',
          JSON.stringify([f.zara, f.credit, f['hdiya l3id']]));
        v('  → INCONNU « zzqx » : aucune piste (ce sera l\'IA)', f.zzqx.statut === 'inconnu' && f.zzqx.cat === null && f.zzqx.candidats.length === 0, JSON.stringify(f.zzqx));
        const dico = await page.evaluate((ST) => { const R = eval(ST).reglesCategorisation; return { themes: R.themes.length, mots: R.nbMots }; }, ST);
        const brut = html.slice(html.indexOf('const DICO_CATEGORIES = ['), html.indexOf('];', html.indexOf('const DICO_CATEGORIES = [')));
        const mots = [...brut.matchAll(/ m: '([^']*)'/g)].map(m => m[1].split('|'));
        const norm = (x) => x.toLowerCase().replace(/œ/g, 'oe').normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^\p{L}\p{N}]+/u).filter(Boolean).join(' ');
        const vu = new Map(); let doublons = 0;
        mots.forEach((liste, i) => liste.forEach(w => { const k = norm(w); if (vu.has(k) && vu.get(k) !== i) doublons++; vu.set(k, i); }));
        v(`  → le dictionnaire : ${dico.themes} thèmes, ${dico.mots} mots (≥ 60 et ≥ 1 000), aucun mot dans deux thèmes`, dico.themes >= 60 && dico.mots >= 1000 && doublons === 0 && mots.length === dico.themes, JSON.stringify([dico, doublons, mots.length]));
    });

    /* ── C. Il apprend de vos choix ──────────────────────────────────── */
    await section('C', async () => {
        await saisir('25 chez hamid'); await valider(); await attendreIA();
        const h = await tx('chez hamid');
        await page.evaluate(({ ST, id, cat }) => eval(ST).rangerTransaction(id, cat), { ST, id: h.id, cat: await idDe('Alimentation (Tqdya)') });
        await page.waitForTimeout(150);
        const r = await cat(['chez hamid', 'hamid']);
        v('C. « chez hamid » rangé à la main dans Alimentation → reconnu, sûr, source « vous » (et « hamid » seul aussi)',
          r['chez hamid'].statut === 'sur' && r['chez hamid'].cat === 'Alimentation (Tqdya)' && r['chez hamid'].source === 'vous' && r.hamid.cat === 'Alimentation (Tqdya)' && r.hamid.statut === 'sur', JSON.stringify(r));
        await saisir('40 café'); await page.waitForTimeout(100);
        const b0 = await badge();
        await page.click('[data-saisie-suggestion]:has-text("Cafe Charif")'); await page.waitForTimeout(100); await valider();
        const c = await tx('café');
        const r2 = await cat(['café']);
        v('  → « café » : doute, vous choisissez « Cafe Charif » → la fois suivante, Cafe Charif, sûr (« vous »)',
          b0.statut === 'doute' && c.categorieSource === 'vous' && !c.aVerifier && r2['café'].cat === 'Cafe Charif' && r2['café'].statut === 'sur' && r2['café'].source === 'vous', JSON.stringify([b0, c, r2]));
    });

    /* ── D. La saisie ─────────────────────────────────────────────────── */
    await section('D', async () => {
        await saisir('65 kfc');
        const b1 = await badge();
        v('D. « 65 kfc » : étiquette sûre « 🏷️ cafe Resto Wknd · règle », pas de puces', b1.statut === 'sur' && /cafe Resto Wknd · règle/.test(b1.texte) && b1.puces.length === 0, JSON.stringify(b1));
        await valider();
        const k = await tx('kfc');
        v('  → enregistrée : cafe Resto Wknd, source « règle », pas à vérifier', k && k.categorieId === await idDe('cafe Resto Wknd') && k.categorieSource === 'règle' && !k.aVerifier, JSON.stringify(k));
        await saisir('350 afriquia');
        const b2 = await badge();
        v('  → « 350 afriquia » : « ⚠️ Voiture · règle · à vérifier », pistes essence picanto / diesel skoda',
          b2.statut === 'doute' && b2.texte.startsWith('⚠️ Voiture') && /à vérifier/.test(b2.texte) && b2.puces.includes('essence picanto') && b2.puces.includes('diesel skoda'), JSON.stringify(b2));
        await valider();
        const a = await tx('afriquia');
        v('  → validée sans choisir : rangée dans Voiture À VÉRIFIER, surlignée dans le journal et dans « À catégoriser »',
          a.categorieId === await idDe('Voiture') && a.aVerifier === true && !!(await ligne(a.id))
          && await page.evaluate((id) => !!document.querySelector(`[data-journal-cat][data-tx="${id}"]`)?.closest('[data-journal-ligne][data-a-verifier]'), a.id), JSON.stringify(a));
        await page.click(`[data-a-categoriser-ligne][data-tx="${a.id}"] [data-ranger][data-cat="${await idDe('diesel skoda')}"]`); await page.waitForTimeout(200);
        const a2 = await tx('afriquia');
        v('  → un clic sur « diesel skoda » : rangée (« vous »), sortie de la liste, plus surlignée',
          a2.categorieId === await idDe('diesel skoda') && a2.categorieSource === 'vous' && !a2.aVerifier && !(await ligne(a.id))
          && await page.evaluate((id) => !document.querySelector(`[data-journal-cat][data-tx="${id}"]`)?.closest('[data-journal-ligne][data-a-verifier]'), a.id), JSON.stringify(a2));
    });

    /* ── E. L'IA ──────────────────────────────────────────────────────── */
    await section('E', async () => {
        const n0 = ia.requetes.length;
        await saisir('120 zzqx');
        const b = await badge();
        v('E. « 120 zzqx » : « 🤖 Inconnu des règles : l\'IA proposera une catégorie »', !b.statut && /Inconnu des règles/.test(b.texte || ''), JSON.stringify(b));
        await valider(); await attendreIA();
        const q = ia.requetes[n0] || {};
        const lignes = String(q.question || '').split('\n');
        v('  → une demande, session « categorisation », LECTURE SEULE, le libellé et le montant',
          ia.requetes.length === n0 + 1 && q.session_id === 'categorisation' && /LECTURE SEULE/.test(q.question) && /« zzqx », 120 DH/.test(q.question), JSON.stringify(q).slice(0, 300));
        v('  → la liste : VOS catégories vivantes (« … — barber — Sorties »), ni « Marjane Lait », ni revenus, ni Non catégorisé',
          lignes.includes((await idDe('barber')) + ' — barber — Sorties') && !/Marjane Lait|Revenu exceptionnel|Remboursement assurance|cat_misc|Salaire/.test(q.question), lignes.slice(4, 9).join(' | '));
        const z = await tx('zzqx');
        v('  → confiance haute : rangée dans barber, source « ia », pas à vérifier ; le journal dit « · IA »',
          z.categorieId === await idDe('barber') && z.categorieSource === 'ia' && !z.aVerifier && z.iaConfiance === 'haute'
          && await page.evaluate((id) => /barber · IA/.test(document.querySelector(`[data-journal-cat][data-tx="${id}"]`)?.textContent.replace(/\s+/g, ' ') || ''), z.id), JSON.stringify(z));
        await saisir('30 truc bizarre'); await valider(); await attendreIA();
        const t = await tx('truc bizarre');
        v('  → confiance moyenne (réponse en HTML échappé) : Alimentation À L\'ESSAI, à vérifier, « ✓ Alimentation (Tqdya) · IA » dans la liste',
          t.categorieId === await idDe('Alimentation (Tqdya)') && t.aVerifier === true && t.categorieSource === 'ia' && /✓ Alimentation \(Tqdya\) · IA/.test(await ligne(t.id) || ''), JSON.stringify([t, await ligne(t.id)]));
        await saisir('15 objet inconnu'); await valider(); await saisir('15 panne'); await valider(); await attendreIA();
        const o = await tx('objet inconnu'), p = await tx('panne');
        const msg = await page.evaluate((ST) => JSON.parse(JSON.stringify(eval(ST).iaCategorisation.messages)), ST);
        //  v37.52 : l'IA qui échoue ne laisse plus rien en attente — une catégorie PAR DÉFAUT (votre plus utilisée), à vérifier
        const alim = await idDe('Alimentation (Tqdya)');
        v('  → un id inventé par l\'IA est refusé, une panne aussi : rangées PAR DÉFAUT (Alimentation, la plus utilisée), à vérifier',
          o.categorieId === alim && o.categorieSource === 'défaut' && o.aVerifier === true && /ne voit aucune de vos catégories.*rangée par défaut dans « Alimentation \(Tqdya\) »/.test(msg[o.id] || '')
          && p.categorieId === alim && p.categorieSource === 'défaut' && p.aVerifier === true && /IA injoignable.*rangée par défaut/.test(msg[p.id] || '')
          && /✓ Alimentation \(Tqdya\) · par défaut/.test(await ligne(p.id) || ''), JSON.stringify([o, p, msg]));
        //  Saisies, doutes et anciennes transactions partent seuls à l'IA… une à la fois
        v('  → toutes les demandes de la session, une à la fois (jamais deux en vol), sans aucun bouton', ia.requetes.length >= 5 && ia.maxEnVol === 1 && !(await page.$('[data-ia-tout]')), JSON.stringify([ia.requetes.length, ia.maxEnVol]));
    });

    /* ── F. À catégoriser et le journal ──────────────────────────────── */
    await section('F', async () => {
        //  v37.52 : plus de bouton — la suggestion sûre est appliquée d'office, dès le chargement
        const m2 = await tx('mcdonald s');
        v('F. l\'ancien « mcdonald s » Non catégorisé : rangé d\'office dans cafe Resto Wknd (« règle »), hors de la liste, sans bouton',
          m2.categorieId === await idDe('cafe Resto Wknd') && m2.categorieSource === 'règle' && !m2.aVerifier && !(await ligne(m2.id)) && !(await page.$('[data-appliquer-sures]')), JSON.stringify(m2));
        const k = await tx('kfc');
        await page.click(`[data-journal-cat][data-tx="${k.id}"]`); await page.waitForTimeout(150);
        await page.selectOption('[data-journal-cat-select]', await idDe('barber')); await page.waitForTimeout(200);
        const k2 = await tx('kfc');
        v('  → journal : un clic sur la catégorie, une autre choisie → rangée (« vous »), le menu se referme',
          k2.categorieId === await idDe('barber') && k2.categorieSource === 'vous' && !(await page.$('[data-journal-cat-select]')), JSON.stringify(k2));
        const autre = await page.evaluate(() => [...(document.querySelector('[data-ranger-autre]')?.options || [])].map(o => o.textContent.trim()));
        v('  → « autre… » : vos catégories vivantes, lignes sous leur mère — sans revenus, ni « Marjane Lait »',
          autre.includes('· samak') && autre.includes('Alimentation (Tqdya)') && !autre.includes('· Marjane Lait') && !autre.includes('Marjane Lait') && !autre.some(x => /Salaire|Revenu exceptionnel|Non catégorisé/.test(x)), JSON.stringify(autre.slice(0, 8)));
    });

    /* ── G. Les règles, visibles ─────────────────────────────────────── */
    await section('G', async () => {
        await page.evaluate(() => { const d = document.querySelector('[data-regles-categorisation]'); d.open = true; d.scrollIntoView(); });
        await page.waitForTimeout(200);
        const g = await page.evaluate(() => ({
            themes: document.querySelectorAll('[data-regle-theme]').length,
            fast: [...document.querySelectorAll('[data-regle-theme]')].map(x => x.textContent.replace(/\s+/g, ' ').trim()).find(x => x.includes('Fast-food')),
            compte: document.querySelector('[data-regles-compte]')?.textContent.replace(/\s+/g, ' ').trim(),
            vous: document.querySelector('[data-regles-vous]')?.textContent.replace(/\s+/g, ' ').trim() }));
        v('G. 📚 les règles : 60 thèmes, chacun dit où il arrive chez vous (« Fast-food… → cafe Resto Wknd »)',
          g.themes === 60 && /Fast-food, livraison → cafe Resto Wknd/.test(g.fast || '') && /mcdo · macdo · mcdonald/.test(g.fast || '') && /\d+ mots \(français, darija, enseignes\), 60 thèmes/.test(g.compte || ''), JSON.stringify(g).slice(0, 300));
        //  (« chez » est un mot vide : la règle retient « hamid » ; « afriquia », rangé en D, en est une aussi)
        v('  → « Vos règles » : ce que vous avez rangé à la main (« hamid » → Alimentation, « cafe » → Cafe Charif, « afriquia » → diesel skoda)',
          /« hamid » → Alimentation \(Tqdya\)/.test(g.vous || '') && /« cafe » → Cafe Charif/.test(g.vous || '') && /« afriquia » → diesel skoda/.test(g.vous || ''), String(g.vous));
    });

    /* ── H. Le mobile ─────────────────────────────────────────────────── */
    await section('H', async () => {
        await page.evaluate(async (ST) => { eval(ST).openSaisieQuickModal(); await new Promise(r => setTimeout(r, 150)); }, ST);
        await page.fill('input[placeholder=\'Ex: "400 courses"\']', '45 bid'); await page.waitForTimeout(200);
        const e = await page.evaluate(() => document.querySelector('[data-saisie-etiquette-mobile]')?.textContent.replace(/\s+/g, ' ').trim());
        await page.fill('input[placeholder=\'Ex: "400 courses"\']', '45 zara'); await page.waitForTimeout(200);
        const e2 = await page.evaluate(() => [...document.querySelectorAll('[data-saisie-etiquette-mobile] [data-saisie-cat], [data-saisie-suggestions] [data-saisie-suggestion]')].map(x => x.textContent.replace(/\s+/g, ' ').trim()));
        v('H. saisie rapide mobile : « 45 bid » → 🏷️ Œufs · règle ; « 45 zara » → ⚠️ à vérifier + pistes Habits Charif / Habits Bébé',
          /🏷️ Œufs · règle/.test(e || '') && e2.some(x => x.startsWith('⚠️ Habits') && /à vérifier/.test(x)) && e2.includes('Habits Charif') && e2.includes('Habits Bébé'), JSON.stringify([e, e2]));
        await page.evaluate((ST) => eval(ST).closeSaisieQuickModal(), ST);
        v('aucune erreur JavaScript', erreurs.length === 0, erreurs[0] || '');
    });
} catch (e) {
    v('exécution sans exception', false, String(e && e.stack || e).slice(0, 400));
} finally {
    await browser.close(); srv.close();
}
console.log('  ' + '─'.repeat(80));
console.log(ko === 0 ? '  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
