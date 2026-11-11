/**
 * v37.100 — UNE CASE DE LA FRISE → LES OPÉRATIONS DERRIÈRE CE CHIFFRE (modifier, supprimer sur place).
 *   Décor fictif : paie le 27 ; jeudi 12 nov. 2026, cycle du 27 oct. au 26 nov. (morceaux 27 oct.–1ᵉʳ nov., 2–8, 9–15,
 *   16–22, 23–26). Courses : Marjane 600 / sem, Psy 400 / 15 j (catégories cat_cv_alimentation__dmarjane, __dpsy).
 *   Journal : Marjane 120 le 29 oct. ; Marjane 250 le 3 nov. et 180 le 5 nov. ; une épicerie 60 le 4 nov. rangée
 *   dans la catégorie mère (pas Marjane) ; Psy 400 le 9 nov.
 */
import fs from 'node:fs';
import os from 'node:os';
import { twCompiler } from './tw_cache.mjs';
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
console.log('\n  LA FRISE S’OUVRE SUR LE JOURNAL\n  ' + '─'.repeat(80));
v('A. cases et enveloppes cliquables ; un panneau avec modifier / supprimer / « Voir dans le Journal »',
  /data-frise-case role="button" tabindex="0" @click="ouvrirApercuFrise\(c, l, x\)"/.test(html) && /data-frise-enveloppe role="button"/.test(html)
  && /data-frise-apercu-supprimer @click="supprimerOperation\(o\.t\.id\)"/.test(html) && /data-frise-apercu-enregistrer @click="enregistrerOperation\(\)"/.test(html) && /data-frise-apercu-journal/.test(html));

const require = createRequire(import.meta.url);
const essai = (f) => { try { return f(); } catch { return null; } };
const pw = essai(() => require('playwright-core'));
const vueJs = essai(() => require.resolve('vue/dist/vue.global.js'));
const chartJs = essai(() => fs.existsSync(path.join(RACINE, 'node_modules/chart.js/dist/chart.umd.js')) && path.join(RACINE, 'node_modules/chart.js/dist/chart.umd.js'));
const chromium = process.env.CHROMIUM || ['/opt/pw-browsers/chromium'].find(p => essai(() => fs.existsSync(p) && fs.statSync(p).isFile()));
if (!pw || !vueJs || !chartJs || !chromium) { console.log('  ⏭️  partie navigateur ignorée'); console.log(ko === 0 ? '  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `  ❌ ${ko} contrôle(s) en échec`); process.exit(ko === 0 ? 0 : 1); }

const MARJANE = 'alimentation::1', PSY = 'alimentation::2';
const fixture = () => {
    const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8'));
    fx._schemaVersion = 21;
    const base = fx.donneesAnnuelles[Object.keys(fx.donneesAnnuelles)[0]];
    fx.donneesAnnuelles = { 2026: JSON.parse(JSON.stringify(base)) };
    Object.assign(fx.soldesInitiaux, { moisActuel: 11, anneeActuelle: 2026, jourDePaie: 27, compteChargesFixes: 'courant', compteChargesVariables: 'courant', assurances_tracker: [], voyageDebut: '', voyageFin: '' });
    fx.soldesInitiaux.categories = [];
    fx.comptes = [{ id: 'acc_cc', label: 'Compte Courant', type: 'liquide', solde: 30000, icone: '💳' }];
    const neutre = { paye: false, montantPaye: 0, exceptions: [], showExceptions: false };
    const d = fx.donneesAnnuelles[2026];
    const Rv = (label, b, j) => ({ ...neutre, label, base: b, jourPrevu: j, destinationCompte: 'courant' });
    d.revenus = { salaire: Rv('SALAIRE', 20000, 27), bonif: Rv('—', 0), magasin: Rv('—', 0), cnss: Rv('—', 0), appart: Rv('—', 0), studio: Rv('—', 0) };
    const Fx = (label, valeur) => ({ ...neutre, label, valeur, jourPrevu: null });
    d.chargesFixes = { creditImmo: Fx('—', 0), creditStudio: Fx('—', 0), syndic: Fx('—', 0), nounou: Fx('—', 0), ecole: Fx('—', 0), femmeMenage: Fx('—', 0), habitsCharif: Fx('—', 0), habitsBebe: Fx('—', 0), jouets: Fx('—', 0) };
    d.chargesVariables = {
        alimentation: { ...neutre, label: 'Courses', valeur: 0, periode: 'semaine', categorieId: 'cat_cv_alimentation',
                        details: [{ id: 1, nom: 'Marjane', montant: 600, periode: 'semaine', categorieId: 'cat_cv_alimentation__dmarjane' }, { id: 2, nom: 'Psy', montant: 400, periode: 'quinzaine', categorieId: 'cat_cv_alimentation__dpsy' }] },
        factures: { ...neutre, label: 'Factures', valeur: 0, periode: 'mois', details: [], categorieId: 'cat_cv_factures' },
    };
    d.epargne = []; d.depensesIrregulieres = []; d.virementsInternes = []; d.banqueOperations = {}; d.consoRealiseeT0 = {}; d.consoClotureT0 = {};
    const T = (id, date, libelle, montant, categorieId) => ({ id, datetime: date + 'T12:00', date, mois: Number(date.slice(5, 7)), libelle, montant, categorieId, compteId: 'acc_cc', source: 'manuel' });
    d.transactionsReelles = [T(11, '2026-10-29', 'Marjane début', 120, 'cat_cv_alimentation__dmarjane'), T(12, '2026-11-03', 'Marjane Hay Riad', 250, 'cat_cv_alimentation__dmarjane'), T(13, '2026-11-05', 'Marjane Ain Sebaa', 180, 'cat_cv_alimentation__dmarjane'),
                             T(14, '2026-11-04', 'Épicerie du coin', 60, 'cat_cv_alimentation'), T(15, '2026-11-09', 'Dr Psy', 400, 'cat_cv_alimentation__dpsy')];
    return fx;
};
//  v37.124 : le vrai CSS (Tailwind compilé depuis index.html) — ce qui passe devant quoi (le sélecteur de catégorie et le panneau)
const twBin = path.join(RACINE, 'node_modules/.bin/tailwindcss');
let tw = '';
if (fs.existsSync(twBin)) {
    const twTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-apercu-'));
    fs.writeFileSync(path.join(twTmp, 'in.css'), '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
    fs.writeFileSync(path.join(twTmp, 'cfg.js'), 'module.exports={content:[' + JSON.stringify(path.join(RACINE, 'index.html')) + '],theme:{extend:{}}};');
    twCompiler(twBin, ['-c', path.join(twTmp, 'cfg.js'), '-i', path.join(twTmp, 'in.css'), '-o', path.join(twTmp, 'out.css'), '--minify'], { stdio: 'ignore' });
    tw = fs.readFileSync(path.join(twTmp, 'out.css'), 'utf8');
    fs.rmSync(twTmp, { recursive: true, force: true });
}
const page0 = html.replace('<script src="https://unpkg.com/vue@3/dist/vue.global.js"', '<script src="/vue.js"').replace('<script src="https://cdn.jsdelivr.net/npm/chart.js"', '<script src="/chart.js"')
    .replace(/<script src="https:\/\/cdn\.tailwindcss\.com"[^>]*><\/script>/, tw ? '<link rel="stylesheet" href="/tailwind.css">' : '').replace(/<script[^>]*src="https:\/\/[^"]*"[^>]*><\/script>/g, '');
const srv = http.createServer((req, res) => {
    const p = req.url.split('?')[0];
    const s = (c, b, t = 'application/json') => { res.writeHead(c, { 'Content-Type': t }); res.end(b); };
    if (p === '/finance/') return s(200, page0, 'text/html; charset=utf-8');
    if (p === '/tailwind.css') return s(200, tw, 'text/css');
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
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
await page.clock.setFixedTime(new Date(2026, 10, 12, 10, 0, 0));
page.on('pageerror', e => erreurs.push(String(e)));
await page.route('**/webhook/**', route => route.abort());
await page.goto(`http://127.0.0.1:${port}/finance/`, { waitUntil: 'load' });
await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState.moisBudgetaire; }, null, { timeout: 30000 });
await page.waitForTimeout(800);
await page.evaluate(async (ST) => { const st = eval(ST); st.appMode = 'previsionnel'; await new Promise(r => setTimeout(r, 250)); st.activeTab = 'pilotageTheo'; st.friseOuverte = true; }, ST);
//  v37.130 : les cases par quinzaine de la frise comptent aussi les opérations du journal (Dr Psy, 400 DH le 9 nov. → 1ʳᵉ quinzaine)
{
    await page.waitForSelector('[data-frise-ligne][data-poste="alimentation::2"] [data-frise-quinzaine]', { timeout: 10000 });
    const q = await page.evaluate(() => [...document.querySelectorAll('[data-frise-ligne][data-poste="alimentation::2"] [data-frise-quinzaine]')].map(e => ({ t: e.textContent.replace(/\s+/g, ' ').trim(), ok: !!e.querySelector('[data-frise-quinzaine-payee]') })));
    v('frise : Psy, 1ʳᵉ quinzaine « 400 / 400 » grâce à l\u2019opération du journal (pas de ✓ à proposer) ; 2ᵉ « – / 400 » avec ✓',
      q.length === 2 && /400 \/ 400/.test(q[0].t) && !q[0].ok && /– \/ 400/.test(q[1].t) && q[1].ok, JSON.stringify(q));
}
await page.waitForSelector('[data-frise]');
const ops = () => page.$$eval('[data-frise-apercu-op]', l => l.map(e => e.getAttribute('data-tx') + ':' + e.querySelector('[data-frise-apercu-ouvrir]').textContent.replace(/\s+/g, ' ').trim()));
const total = () => page.textContent('[data-frise-apercu-total]').then(t => t.replace(/\s+/g, ' ').trim());
const caseMarjane = (i) => page.locator(`[data-frise-ligne][data-poste="${MARJANE}"] [data-frise-case]`).nth(i);

try {
    await section('M', async () => {
        //  v37.126 — « la frise n'est pas adaptée au portable ; ajouter un fond surlignant la semaine en cours pour toute la colonne »
        const mesure = () => page.evaluate(() => {
            const cat = document.querySelector('[data-frise-categorie]'), bande = cat && cat.querySelector('[data-frise-semaine-courante]');
            const caseEnCours = cat && cat.querySelector('[data-frise-case][data-etat="encours"], [data-frise-case][data-etat="depasse"]:nth-child(3)');
            const enc = [...cat.querySelectorAll('[data-frise-ligne]')].map(l => [...l.querySelectorAll('[data-frise-case]')]).find(c => c.length >= 3);
            const iEnc = [...document.querySelectorAll('[data-frise-morceau]')].findIndex(m => m.classList.contains('ring-sky-500'));
            const cellule = enc && iEnc >= 0 ? enc[iEnc] : null;
            const b = bande && bande.getBoundingClientRect(), c = cellule && cellule.getBoundingClientRect(), k = cat.getBoundingClientRect();
            const noms = [...document.querySelectorAll('[data-frise-nom]')].slice(0, 12);
            const cases = cat.querySelector('[data-frise-ligne] [data-frise-case]') ? cat.querySelector('[data-frise-ligne] [data-frise-case]').parentElement.getBoundingClientRect() : null;
            return { bande: !!bande, ecartG: b && c ? Math.abs(b.left - c.left) : 99, ecartD: b && c ? Math.abs(b.right - c.right) : 99, hauteur: b ? b.height / k.height : 0,
                     tronques: noms.filter(n => n.scrollWidth > n.clientWidth + 1).length, largeurCases: cases ? cases.width / k.width : 0 };
        });
        const pc = await mesure();
        v('M. ordinateur : la semaine en cours surlignée sur TOUTE la hauteur de la catégorie, pile sur sa colonne de cases (± 3 px)',
          pc.bande && pc.ecartG <= 3 && pc.ecartD <= 3 && pc.hauteur > 0.85, JSON.stringify(pc));
        await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(400);
        const tel = await mesure();
        v('  → téléphone : la bande pile sur la colonne aussi ; les noms des lignes ENTIERS (plus « Super marc… »), les cases sur toute la largeur',
          tel.bande && tel.ecartG <= 3 && tel.ecartD <= 3 && tel.tronques === 0 && tel.largeurCases > 0.85, JSON.stringify(tel));
        await page.setViewportSize({ width: 1280, height: 900 }); await page.waitForTimeout(300);
    });
    await section('B', async () => {
        await caseMarjane(1).click();
        await page.waitForSelector('[data-frise-apercu]');
        const L = await ops(), T = await total(), titre = await page.textContent('[data-frise-apercu-titre]'), sous = await page.textContent('[data-frise-apercu] .text-slate-500');
        v('B. la case Marjane du 2 au 8 nov. : les 2 opérations Marjane de ce morceau (5 nov., puis 3 nov.), pas l’épicerie ni le 29 oct.',
          L.length === 2 && L[0].startsWith('13:') && L[1].startsWith('12:') && /Marjane Ain Sebaa/.test(L[0]) && /5 nov/.test(L[0]) && /250/.test(L[1]), JSON.stringify(L));
        v('  → titre, période et total : « Marjane · Courses », du 2 nov. au 8 nov., 2 opérations · 430 DH',
          /Marjane/.test(titre) && /Courses/.test(titre) && /du 2 nov\. au 8 nov\./.test(sous) && /^2 opérations · 430/.test(T), JSON.stringify([titre, sous, T]));
    });
    await section('C', async () => {
        await page.click('[data-frise-apercu-op][data-tx="12"] [data-frise-apercu-ouvrir]');
        await page.waitForSelector('[data-frise-apercu-edition]');
        //  v37.124 — « quand je clique sur la catégorie, le menu ne sort pas » : il sortait DERRIÈRE le panneau de la frise
        await page.click('[data-frise-edit-cat] [data-cc-ouvrir]');
        await page.waitForSelector('[data-cc-panneau]', { state: 'visible', timeout: 3000 });
        const dessus = await page.evaluate(() => { const p = document.querySelector('[data-cc-panneau] [data-cc-recherche]'), r = p.getBoundingClientRect();
            const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!el && !!el.closest('[data-cc-panneau]'); });
        await page.fill('[data-cc-recherche]', 'marjane');
        await page.locator('[data-cc-panneau] [data-cc-option]').first().click();
        const ferme = !(await page.$('[data-cc-panneau]')), toujours = !!(await page.$('[data-frise-apercu-edition]'));
        v('  → la catégorie d’une opération : le sélecteur s’ouvre AU-DESSUS du panneau de la frise, la recherche marche, le choix referme le sélecteur (la fiche reste)',
          !!tw && dessus && ferme && toujours, JSON.stringify({ tw: !!tw, dessus, ferme, toujours }));
        await page.fill('[data-frise-edit-montant]', '260');
        await page.fill('[data-frise-edit-libelle]', 'Marjane Hay Riad (corrigé)');
        await page.click('[data-frise-apercu-enregistrer]'); await page.waitForTimeout(300);
        const L = await ops(), T = await total();
        const t = await page.evaluate((ST) => JSON.parse(JSON.stringify(eval(ST).donneesAnnuelles[2026].transactionsReelles.find(x => x.id === 12))), ST);
        const cell = (await caseMarjane(1).textContent()).replace(/\s+/g, '');
        v('C. modifiée sur place (260, libellé corrigé) : enregistrée dans le journal, le total et la case suivent (440)',
          t.montant === 260 && t.libelle === 'Marjane Hay Riad (corrigé)' && /corrigé/.test(L[1]) && /^2 opérations · 440/.test(T) && /^440\//.test(cell), JSON.stringify([t, T, cell]));
        await page.click('[data-frise-apercu-op][data-tx="13"] [data-frise-apercu-ouvrir]');
        await page.click('[data-frise-apercu-supprimer]'); await page.waitForTimeout(150);
        const confirme = await page.textContent('[data-frise-apercu-supprimer]');
        const encore = await page.evaluate((ST) => eval(ST).donneesAnnuelles[2026].transactionsReelles.some(x => x.id === 13), ST);
        v('  → « Supprimer » demande une confirmation (rien d’effacé au premier toucher)', /Confirmer/.test(confirme) && encore, confirme);
        await page.click('[data-frise-apercu-supprimer]'); await page.waitForTimeout(300);
        const L2 = await ops(), T2 = await total();
        const parti = await page.evaluate((ST) => !eval(ST).donneesAnnuelles[2026].transactionsReelles.some(x => x.id === 13), ST);
        v('  → confirmé : supprimée du journal, la liste et le total suivent (1 opération · 260)', parti && L2.length === 1 && /^1 opération · 260/.test(T2), JSON.stringify([L2, T2]));
        await page.click('[data-frise-apercu-fermer]'); await page.waitForTimeout(150);
        v('  → ✕ ferme le panneau, la frise reste ouverte', !(await page.$('[data-frise-apercu]')) && !!(await page.$('[data-frise]')), '');
    });
    await section('E', async () => {
        //  v37.120 — « il faut ajouter le bouton Ajouter » : une opération sur CE poste, dans CETTE période, sans quitter la frise
        await caseMarjane(1).click();
        await page.waitForSelector('[data-frise-apercu]');
        await page.click('[data-frise-apercu-ajouter]');
        await page.waitForSelector('[data-frise-apercu-ajout]');
        const pre = await page.evaluate(() => ({ lib: document.querySelector('[data-frise-ajout-libelle]').value, date: document.querySelector('[data-frise-ajout-date]').value, focus: document.activeElement && document.activeElement.hasAttribute('data-frise-ajout-montant') }));
        await page.fill('[data-frise-ajout-montant]', '90');
        await page.fill('[data-frise-ajout-libelle]', 'Marjane (ajout)');
        await page.click('[data-frise-ajout-valider]'); await page.waitForTimeout(300);
        const L = await ops(), T = await total(), cell = (await caseMarjane(1).textContent()).replace(/\s+/g, '');
        const t = await page.evaluate((ST) => JSON.parse(JSON.stringify(eval(ST).donneesAnnuelles[2026].transactionsReelles.find(x => x.libelle === 'Marjane (ajout)') || null)), ST);
        v('E. « ➕ Ajouter » dans la case Marjane (2 → 8 nov.) : libellé proposé « Marjane », date dans la période (8 nov.), le montant prêt à taper',
          /Marjane/.test(pre.lib) && pre.date === '2026-11-08' && pre.focus, JSON.stringify(pre));
        v('  → 90 enregistré dans CE poste, sûr (« vous »), daté du 8 nov. : la liste, le total et la case suivent (2 opérations · 350)',
          t && t.montant === 90 && t.date === '2026-11-08' && t.categorieSource === 'vous' && !t.aVerifier && L.length === 2 && /^2 opérations · 350/.test(T) && /^350\//.test(cell), JSON.stringify([t, L, T, cell]));
        await page.click('[data-frise-apercu-fermer]'); await page.waitForTimeout(150);
    });
    await section('D', async () => {
        await page.click(`[data-frise-ligne][data-poste="${PSY}"] [data-frise-enveloppe]`);
        await page.waitForSelector('[data-frise-apercu]');
        const L = await ops(), sous = await page.textContent('[data-frise-apercu] .text-slate-500');
        v('D. l’enveloppe du Psy (/ 15 j) : tout le cycle, du 27 oct. au 26 nov. — la séance du 9 nov.', L.length === 1 && /Dr Psy/.test(L[0]) && /Tout le cycle, du 27 oct\. au 26 nov\./.test(sous), JSON.stringify([L, sous]));
        await page.click('[data-frise-apercu-journal]'); await page.waitForTimeout(400);
        const J = await page.evaluate((ST) => { const st = eval(ST); return { tab: st.activeTab, mode: st.appMode, cat: st.journal.cat, frise: st.friseOuverte, periode: st.journal.periode }; }, ST);
        v('  → « Voir dans le Journal » : la Saisie s’ouvre, journal filtré sur le Psy, ce cycle', J.tab === 'saisie' && J.mode === 'reel' && J.cat === 'cat_cv_alimentation__dpsy' && !J.frise && J.periode === 'cycle', JSON.stringify(J));
    });
    v('aucune erreur JavaScript', erreurs.length === 0, erreurs[0] || '');
} finally { await browser.close(); srv.close(); }
console.log(ko === 0 ? '\n  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `\n  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
