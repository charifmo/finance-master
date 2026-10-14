/**
 * v37.52 — LA CATÉGORISATION SE FAIT SEULE.
 *
 *   « Pourquoi j'ai besoin d'appuyer sur IA ? Si l'appli n'arrive pas à catégoriser, elle fait
 *   appel à l'IA ; si l'appel à l'IA échoue, elle met un truc par défaut, sans que j'appuie sur
 *   un bouton. »
 *
 *   Le décor de la suite v37.49 (vos catégories), plus cinq transactions en attente au
 *   chargement : « Hri » (votre ligne « lhrri », autre graphie), « zzqx » (l'IA sait), « panne »
 *   (l'IA est injoignable), « afriquia » (doute des règles : Voiture), une sans libellé.
 *   L'IA est simulée (le webhook est intercepté).
 *
 *     A. statique · B. au chargement, sans un clic · C. une seule demande par transaction et
 *     par session · D. le panneau « À vérifier » et le journal · E. « 🤖 relancer l'IA » ·
 *     F. la saisie (sûr, inconnu, doute) · G. confirmer d'un clic.
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
console.log('\n  CATÉGORISATION AUTOMATIQUE : RÈGLES → IA → PAR DÉFAUT, SANS BOUTON\n  ' + '─'.repeat(80));

/* ── A. Statique ─────────────────────────────────────────────────────── */

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
            //  v37.52 : arrivées sans catégorie (agent, import, autre appareil) ou laissées en doute
            { id: 601, datetime: '2026-10-13T12:00', date: '2026-10-13', mois: 10, libelle: 'Hri', montant: 1500, categorieId: 'cat_misc', compteId: 1, source: 'agent' },
            { id: 602, datetime: '2026-10-13T12:01', date: '2026-10-13', mois: 10, libelle: 'zzqx', montant: 120, categorieId: 'cat_misc', compteId: 1, source: 'agent' },
            { id: 603, datetime: '2026-10-13T12:02', date: '2026-10-13', mois: 10, libelle: 'panne', montant: 15, categorieId: 'cat_misc', compteId: 1, source: 'agent' },
            { id: 604, datetime: '2026-10-13T12:03', date: '2026-10-13', mois: 10, libelle: 'afriquia', montant: 350, categorieId: 'cat_cv_voiture', categorieSource: 'règle', aVerifier: true, compteId: 1, source: 'manuel' },
            { id: 605, datetime: '2026-10-13T12:04', date: '2026-10-13', mois: 10, libelle: 'Sans libellé', montant: 40, categorieId: 'cat_misc', compteId: 1, source: 'agent' },
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

/* ── A. Statique ─────────────────────────────────────────────────────── */
v('A. plus de bouton « Appliquer les suggestions sûres » ni « Demander à l\'IA »', !/data-appliquer-sures/.test(html) && !/data-ia-tout/.test(html));
v('  → le balayage automatique, posé une fois le moteur défini', /watch\(\(\) => aCategoriser\.value\.map\([^\n]*\n\s*\(\) => _balayerACategoriser\(\), \{ immediate: true \}\)/.test(html)
  && html.indexOf('() => _balayerACategoriser()') > html.indexOf('const calculationTick'));
v('  → l\'IA en panne : une catégorie par défaut (piste des règles, la plus utilisée, Dépense exceptionnelle)', /const _categorieParDefaut = /.test(html) && /_poserParDefaut\(txId, 'IA injoignable/.test(html));

//  L'IA simulée : « panne » échoue tant que iaPanne le dit ; on mesure la simultanéité
const ia = { requetes: [], enVol: 0, maxEnVol: 0, panne: new Set(['panne']) };
const REPONSES = {
    zzqx: { output: '{"id": "cat_cv_sorties__dbarber", "confiance": "haute", "raison": "coupe de cheveux"}' },
    panne: { output: '{"id": "cat_cv_sorties__dbarber", "confiance": "haute", "raison": "enfin joignable"}' },
};
const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
await page.clock.setFixedTime(new Date(2026, 9, 13, 12, 30, 0));
const erreurs = []; page.on('pageerror', e => erreurs.push(String(e)));
page.on('dialog', d => d.accept());
await page.route('**/webhook/**', async (route) => {
    const corps = JSON.parse(route.request().postData() || '{}');
    ia.requetes.push(corps); ia.enVol++; ia.maxEnVol = Math.max(ia.maxEnVol, ia.enVol);
    const lib = ((corps.question || '').match(/Dépense : « ([^»]*) »/) || [])[1] || '';
    await new Promise(r => setTimeout(r, 300));
    ia.enVol--;
    if (ia.panne.has(lib) || ia.panne.has('*')) return route.abort();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(REPONSES[lib] || { output: '{"id": null, "confiance": "basse", "raison": "rien"}' }) });
});
await page.goto(`http://127.0.0.1:${port}/finance/`, { waitUntil: 'load' });
await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState.moisBudgetaire; }, null, { timeout: 30000 });
await page.waitForTimeout(600);
await page.evaluate(async (ST) => { const st = eval(ST); st.appMode = 'reel'; await new Promise(r => setTimeout(r, 250)); st.activeTab = 'saisie'; }, ST);
await page.waitForTimeout(500);

const txs = () => page.evaluate((ST) => JSON.parse(JSON.stringify(eval(ST).donneesAnnuelles[2026].transactionsReelles)), ST);
const txId = async (id) => (await txs()).find(t => t.id === id) || null;
const tx = async (libelle) => (await txs()).filter(t => t.libelle === libelle).pop() || null;
const idDe = (label) => page.evaluate(({ ST, label }) => { const c = (eval(ST).soldesInitiaux.categories || []).find(x => String(x.label).trim() === label && !x.archive); return c ? c.id : null; }, { ST, label });
const saisir = async (texte) => { const i = page.locator('input[placeholder="Ex: 200 courses"]'); await i.fill(texte); await page.waitForTimeout(150); };
const valider = async () => { await page.locator('input[placeholder="Ex: 200 courses"]').press('Enter'); await page.waitForTimeout(200); };
const badge = () => page.evaluate(() => { const b = document.querySelector('[data-saisie-cat]'); return b ? { statut: b.dataset.statut, texte: b.textContent.replace(/\s+/g, ' ').trim() } : null; });
const ligne = (id) => page.evaluate((id) => { const l = document.querySelector(`[data-a-categoriser-ligne][data-tx="${id}"]`); return l ? l.textContent.replace(/\s+/g, ' ').trim() : null; }, id);
const messages = () => page.evaluate((ST) => JSON.parse(JSON.stringify(eval(ST).iaCategorisation.messages)), ST);
const attendreIA = async () => { await page.waitForFunction((ST) => Object.keys(eval(ST).iaCategorisation.enCours).length === 0, ST, { timeout: 15000 }); await page.waitForTimeout(250); };
const requetesPour = (lib) => ia.requetes.filter(q => new RegExp('Dépense : « ' + lib + ' »').test(q.question || '')).length;

try {
    await attendreIA();
    /* ── B. Au chargement, sans un clic ──────────────────────────────── */
    await section('B', async () => {
        const [alim, lhrri, barber, voiture] = [await idDe('Alimentation (Tqdya)'), await idDe('lhrri'), await idDe('barber'), await idDe('Voiture')];
        const [hri, zz, pa, af, sl, mc] = [await txId(601), await txId(602), await txId(603), await txId(604), await txId(605), await tx('mcdonald s')];
        const m = await messages();
        v('B. « Hri » : votre ligne « lhrri » (autre graphie), rangée d\'office par les règles, sans IA',
          hri.categorieId === lhrri && hri.categorieSource === 'libellé' && !hri.aVerifier && requetesPour('Hri') === 0, JSON.stringify(hri));
        v('  → « mcdonald s » : la règle sûre appliquée d\'office (fast-food → cafe Resto Wknd)', mc.categorieId === await idDe('cafe Resto Wknd') && mc.categorieSource === 'règle' && !mc.aVerifier, JSON.stringify(mc));
        v('  → « zzqx » : inconnu des règles → l\'IA, appelée d\'office, range dans barber (haute)',
          zz.categorieId === barber && zz.categorieSource === 'ia' && !zz.aVerifier && requetesPour('zzqx') === 1, JSON.stringify(zz));
        v('  → « panne » : IA injoignable → PAR DÉFAUT dans Alimentation (la plus utilisée), à vérifier',
          pa.categorieId === alim && pa.categorieSource === 'défaut' && pa.aVerifier === true && /IA injoignable.*rangée par défaut dans « Alimentation \(Tqdya\) », à vérifier/.test(m[603] || ''), JSON.stringify([pa, m[603]]));
        v('  → « afriquia » (doute) : l\'IA consultée aussi ; sans réponse utile, Voiture est gardée, à vérifier',
          voiture === 'cat_cv_voiture' && af.categorieId === voiture && af.aVerifier === true && requetesPour('afriquia') === 1 && /gardée dans « Voiture »/.test(m[604] || ''), JSON.stringify([af, m[604]]));
        v('  → sans libellé : rien à demander à l\'IA — par défaut, à vérifier', sl.categorieId === alim && sl.categorieSource === 'défaut' && sl.aVerifier === true && requetesPour('Sans libellé') === 0, JSON.stringify(sl));
        v('  → plus rien « Non catégorisé » ; trois demandes, une à la fois', !(await txs()).some(t => t.categorieId === 'cat_misc') && ia.requetes.length === 3 && ia.maxEnVol === 1
          && ia.requetes.every(q => q.session_id === 'categorisation'), JSON.stringify([ia.requetes.length, ia.maxEnVol]));
    });
    /* ── C. Une seule demande par transaction et par session ─────────── */
    await section('C', async () => {
        await page.evaluate(async (ST) => { eval(ST).forceUpdateCalculations(); await new Promise(r => setTimeout(r, 300)); }, ST);
        await attendreIA();
        v('C. un recalcul ne redemande rien à l\'IA (toujours 3 demandes)', ia.requetes.length === 3, String(ia.requetes.length));
    });
    /* ── D. Le panneau « À vérifier » et le journal ───────────────────── */
    await section('D', async () => {
        const d = await page.evaluate(() => ({ titre: document.querySelector('[data-a-categoriser] h3')?.textContent.trim(),
            aide: document.querySelector('[data-a-categoriser-aide]')?.textContent.replace(/\s+/g, ' ').trim() }));
        v('D. « ⚠️ À vérifier (3) » : panne, afriquia, sans libellé — rien n\'y attend une action', d.titre === '⚠️ À vérifier (3)' && /Rangées d'office/.test(d.aide || ''), JSON.stringify(d));
        const l = await ligne(603);
        v('  → « ✓ Alimentation (Tqdya) · par défaut », « 🤖 relancer l\'IA », le message', /✓ Alimentation \(Tqdya\) · par défaut/.test(l || '') && /relancer l'IA/.test(l || '') && /IA injoignable/.test(l || ''), String(l));
        v('  → les lignes rangées (Hri, zzqx) ne sont plus dans la liste', !(await ligne(601)) && !(await ligne(602)));
        const j = await page.evaluate(() => { const c = document.querySelector('[data-journal-cat][data-tx="603"]'); return c ? { txt: c.textContent.replace(/\s+/g, ' ').trim(), surligne: !!c.closest('tr[data-a-verifier]') } : null; });
        v('  → journal : « Alimentation (Tqdya) · par défaut », ligne surlignée', !!j && /· par défaut/.test(j.txt) && j.surligne, JSON.stringify(j));
    });
    /* ── E. Relancer l'IA ────────────────────────────────────────────── */
    await section('E', async () => {
        ia.panne.clear();
        await page.click('[data-a-categoriser-ligne][data-tx="603"] [data-ia-une]'); await page.waitForTimeout(100); await attendreIA();
        const pa = await txId(603);
        v('E. « 🤖 relancer l\'IA » sur « panne », l\'IA de retour : barber (haute), sortie de la liste',
          pa.categorieId === await idDe('barber') && pa.categorieSource === 'ia' && !pa.aVerifier && !(await ligne(603)) && requetesPour('panne') === 2, JSON.stringify(pa));
    });
    /* ── F. La saisie ─────────────────────────────────────────────────── */
    await section('F', async () => {
        await saisir('45 hri');
        const b = await badge();
        const n0 = ia.requetes.length;
        await valider(); await attendreIA();
        const h = await tx('hri');
        v('F. « 45 hri » : 🏷️ lhrri, sûr ; enregistrée sans IA', !!b && b.statut === 'sur' && /lhrri/.test(b.texte) && h.categorieId === await idDe('lhrri') && !h.aVerifier && ia.requetes.length === n0, JSON.stringify([b, h]));
        ia.panne.add('*');
        await saisir('30 qwerty'); await valider(); await attendreIA();
        const q = await tx('qwerty');
        v('  → « 30 qwerty » (inconnu), IA injoignable : par défaut, à vérifier — jamais « Non catégorisé »',
          requetesPour('qwerty') === 1 && q.categorieId === await idDe('Alimentation (Tqdya)') && q.categorieSource === 'défaut' && q.aVerifier === true, JSON.stringify(q));
        ia.panne.clear();
        await saisir('200 afriquia'); await valider(); await attendreIA();
        v('  → « 200 afriquia » (doute) : l\'IA est consultée aussi, sans bouton', requetesPour('afriquia') === 2, String(requetesPour('afriquia')));
    });
    /* ── G. Confirmer d'un clic ──────────────────────────────────────── */
    await section('G', async () => {
        const alim = await idDe('Alimentation (Tqdya)');
        await page.click(`[data-a-categoriser-ligne][data-tx="605"] [data-ranger][data-cat="${alim}"]`); await page.waitForTimeout(200);
        const s = await txId(605);
        v('G. ✓ sur « Alimentation · par défaut » : confirmée (« vous »), sortie de la liste', s.categorieId === alim && s.categorieSource === 'vous' && !s.aVerifier && !(await ligne(605)), JSON.stringify(s));
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
