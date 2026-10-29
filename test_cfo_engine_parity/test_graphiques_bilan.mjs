/**
 * v37.82 — LES DEUX GRAPHIQUES DU BILAN, SÉLECTIONNABLES.
 *
 *   « Je veux ce graphique sélectionnable par compte, le même graphique pour les charges, sélectionnable par type
 *     de charges. » Décor fictif (KARIM TESTEUR), jeudi 12 nov. 2026, paie le 27 :
 *     Épargne LT 1 000 : un choc de 6 000 le 15 nov., 8 000 reçus du Livret le 22 → − 5 000 le 15 ;
 *     charges fixes Syndic 300 et Nounou 2 500, crédit 4 000 ; courses ; facture elect 200.
 *     A. statique · B. la trajectoire par compte · C. l'année par type de charges.
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
console.log('\n  LES DEUX GRAPHIQUES DU BILAN, SÉLECTIONNABLES\n  ' + '─'.repeat(80));

v('A. des pastilles par compte sous la trajectoire, par type de charges sous « mois par mois »',
  /data-bilan-compte-choix/.test(html) && /data-bilan-compte-tous/.test(html) && /data-bilan-type-choix/.test(html) && /data-bilan-type-tous/.test(html));

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
        d.chargesFixes = { creditImmo: Fx('Crédit immo', 4000), creditStudio: Fx('—', 0), syndic: Fx('Syndic', 300), nounou: Fx('Nounou', 2500), ecole: Fx('—', 0), femmeMenage: Fx('—', 0), habitsCharif: Fx('—', 0), habitsBebe: Fx('—', 0), jouets: Fx('—', 0) };
        const V = (label, cat, details) => ({ ...neutre, label, valeur: 0, periode: 'semaine', categorieId: cat, details });
        d.chargesVariables = {
            alimentation: V('Courses', 'cat_cv_alimentation', [{ id: 1, nom: 'Marjane', montant: 600, periode: 'semaine' }, { id: 2, nom: 'Psy', montant: 400, periode: 'quinzaine' }]),
            factures: { ...neutre, label: 'Factures', valeur: 200, periode: 'mois', details: [{ nom: 'elect', montant: 200, jourPrevu: 6 }], categorieId: 'cat_cv_factures' },
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

//  Ce que dessine réellement Chart.js dans la section demandée
const graphe = (section) => page.evaluate((sel) => { const cv = document.querySelector(sel + ' canvas'); const ch = cv && window.Chart && window.Chart.getChart(cv);
    return ch ? { type: ch.config.type, jeux: ch.data.datasets.map(d => ({ label: d.label, type: d.type || ch.config.type, data: d.data.slice(), stack: d.stack || null })), labels: ch.data.labels.slice() } : null; }, section);
const clic = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel).then(() => page.waitForTimeout(500));
const pointBas = () => page.evaluate(() => ({ nom: document.querySelector('[data-bilan-point-bas-nom]')?.textContent.replace(/\s+/g, ' ').trim(), m: document.querySelector('[data-bilan-point-bas]')?.textContent.replace(/\s+/g, ' ').trim(),
                                              quand: document.querySelector('[data-bilan-point-bas]')?.parentElement.querySelector('p:last-child')?.textContent.trim() }));
try {
    await aller('previsionnel', 'dashboard');
    await section('B', async () => {
        const choix = await page.evaluate(() => [...document.querySelectorAll('[data-bilan-compte-choix]')].map(b => b.dataset.compte));
        v('B. une pastille par compte réel : Courant d\'abord, puis Épargne LT, Livret (pas de poche virtuelle)', choix[0] === 'cpt_800' && choix.includes('cpt_801') && choix.includes('cpt_802') && !choix.some(k => k.startsWith('ep_')), JSON.stringify(choix));
        const g0 = await graphe('[data-bilan-trajectoire]'), p0 = await pointBas();
        v('  → sans sélection : la vue d\'ensemble d\'avant (« Tous vos comptes » + « Compte courant »), point bas du compte courant',
          g0 && g0.jeux.map(j => j.label).join() === 'Tous vos comptes,Compte courant' && /compte courant/.test(p0.nom), JSON.stringify([g0 && g0.jeux.map(j => j.label), p0]));
        await clic('[data-bilan-compte-choix][data-compte="cpt_801"]');
        const g1 = await graphe('[data-bilan-trajectoire]'), p1 = await pointBas();
        v('  → « Épargne Long Terme » cochée : UNE courbe, ses soldes de fin de mois ; point bas − 5 000 le 15 nov. 2026',
          g1 && g1.jeux.length === 1 && g1.jeux[0].label === 'Épargne Long Terme' && g1.jeux[0].type === 'line' && g1.jeux[0].data[0] === 3000 && /Épargne Long Terme/.test(p1.nom) && /5\s?000/.test(p1.m) && /15 nov\. 2026/.test(p1.quand), JSON.stringify([g1 && g1.jeux, p1]));
        await clic('[data-bilan-compte-choix][data-compte="cpt_802"]');
        const g2 = await graphe('[data-bilan-trajectoire]'), p2 = await pointBas();
        v('  → + « Livret » : deux courbes ; le point bas affiché est le plus bas des deux (l\'Épargne LT)',
          g2 && g2.jeux.length === 2 && g2.jeux[1].data[0] === 22000 && /des 2 comptes cochés — Épargne Long Terme/.test(p2.nom), JSON.stringify([g2 && g2.jeux.map(j => j.label), p2]));
        const fin = await page.evaluate(() => document.querySelector('[data-bilan-fin-sel]')?.textContent.replace(/\s+/g, ' ').trim());
        v('  → la ligne de fin cite chaque compte coché', /Épargne Long Terme/.test(fin) && /Livret Réserve/.test(fin), fin);
        const mem = await page.evaluate((ST) => JSON.stringify(eval(ST).bilanComptesSel), ST);
        v('  → la sélection est mémorisée (état de l\'interface)', mem === '["cpt_801","cpt_802"]', mem);
        await clic('[data-bilan-compte-tous]');
        const g3 = await graphe('[data-bilan-trajectoire]');
        v('  → « Vue d\'ensemble » : retour au graphique d\'avant', g3 && g3.jeux.map(j => j.label).join() === 'Tous vos comptes,Compte courant', JSON.stringify(g3 && g3.jeux.map(j => j.label)));
    });
    await section('C', async () => {
        const choix = await page.evaluate(() => [...document.querySelectorAll('[data-bilan-type-choix]')].map(b => b.dataset.type));
        v('C. une pastille par type de charges présent : crédits, fixes, factures, conso (pas les ponctuelles ni l\'épargne, absentes)',
          ['credits', 'fixes', 'mensuelles', 'conso'].every(k => choix.includes(k)) && !choix.includes('epargne') && !choix.includes('exceptionnel'), JSON.stringify(choix));
        const g0 = await graphe('[data-bilan-mois]');
        v('  → sans sélection : les ressources et tous les types empilés (comme avant)', g0 && g0.jeux[0].label === 'Ressources' && g0.jeux.length >= 6 - 1, JSON.stringify(g0 && g0.jeux.map(j => j.label)));
        await clic('[data-bilan-type-choix][data-type="fixes"]');
        await clic('[data-bilan-type-choix][data-type="credits"]');
        const g1 = await graphe('[data-bilan-mois]');
        v('  → « Charges fixes » + « Mensualités de crédit » : deux séries empilées, la ligne des ressources retirée',
          g1 && g1.jeux.map(j => j.label).join() === 'Mensualités de crédit,Charges fixes', JSON.stringify(g1 && g1.jeux.map(j => j.label)));
        await clic('[data-bilan-type-choix][data-type="credits"]');
        const g2 = await graphe('[data-bilan-mois]');
        const tot = (j) => j.data.reduce((s, x) => s + x, 0);
        v('  → « Charges fixes » seul : détaillé ligne par ligne — Nounou 2 500 et Syndic 300 par mois, 12 mois',
          g2 && g2.jeux.map(j => j.label).join() === 'Nounou,Syndic' && g2.jeux[0].data.every(x => x === 2500) && g2.jeux[1].data.every(x => x === 300) && g2.labels.length === 12 && tot(g2.jeux[0]) === 30000, JSON.stringify(g2 && g2.jeux.map(j => [j.label, j.data.slice(0, 3)])));
        await clic('[data-bilan-type-choix][data-type="fixes"]');
        await clic('[data-bilan-type-choix][data-type="mensuelles"]');
        const g3 = await graphe('[data-bilan-mois]');
        v('  → « Factures & mensuel » seul : sa ligne « Factures », 200 par mois', g3 && g3.jeux.length >= 1 && g3.jeux.some(j => j.label === 'Factures' && j.data.every(x => x === 200)), JSON.stringify(g3 && g3.jeux.map(j => [j.label, j.data.slice(0, 2)])));
        await clic('[data-bilan-type-tous]');
        const g4 = await graphe('[data-bilan-mois]');
        v('  → « Tous » : retour au graphique d\'avant', g4 && g4.jeux[0].label === 'Ressources', JSON.stringify(g4 && g4.jeux.map(j => j.label)));
    });
    v('aucune erreur JavaScript', erreurs.length === 0, erreurs[0] || '');
} finally {
    await browser.close();
    srv.close();
}
console.log(ko === 0 ? '\n  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `\n  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
