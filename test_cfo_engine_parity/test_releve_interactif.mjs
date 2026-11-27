/**
 * v37.157 — LE RELEVÉ INTERACTIF : « comme la frise — je clique sur un truc, il me donne des options : aller dans la partie
 *   modifiable, modifier la date, la valeur ou le nom, et ça se modifie direct comme si je l'avais changé là-bas ; même chose
 *   pour supprimer ». Décor fictif, jeudi 29 oct. 2026, paie le 27 (cycle de novembre) : un flux « Paiement Notaire & Travaux »,
 *   un virement, une épargne de 3 000 / mois, le salaire, une créance attendue (Analyses 2 480), les charges fixes.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { twCompiler } from './tw_cache.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..');
const html = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8').split('\r\n').join('\n');

let ko = 0;
const v = (t, ok, d = '') => { if (!ok) ko++; console.log(`  ${ok ? '✅' : '❌'} ${t.padEnd(64)} ${ok ? '' : d}`); };
const section = async (nom, f) => { try { await f(); } catch (e) { v(`${nom} : exécution sans exception`, false, String(e && e.stack || e).slice(0, 300)); } };
console.log('\n  LE RELEVÉ INTERACTIF\n  ' + '─'.repeat(80));

v('A. chaque ligne prévue du Relevé garde ce qu\'elle représente (flux, virement, épargne, revenu, créance, groupe) ; lignes cliquables, une fenêtre d\'actions',
  /src: \{ k: 'flux', ref: dep \}/.test(html) && /src: \{ k: 'virement', ref: vir \}/.test(html) && /src: \{ k: 'epargne', ref: e, m \}/.test(html)
  && /src: \{ k: 'revenu', ref: r, m \}/.test(html) && /src: \{ k: 'creance', ref: c \}/.test(html) && /src: l\.src \|\| null/.test(html)
  && (html.match(/@click="e\.src && ouvrirActionReleve\(e\)"/g) || []).length === 3 && /data-action-releve/.test(html));
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
    d.epargne = [{ id: 7, nom: 'Alimentation Dépenses Annuelles & Projets', valeur: 3000, sourceCompte: 'courant', linkedAccountId: 'acc_da', jourPrevu: 5, exceptions: [] }];
    fx.comptes = [{ id: 'acc_cc', label: 'Compte Courant', type: 'liquide', solde: 9000, icone: '💳' }, { id: 'acc_da', label: 'Dépenses Annuelles & Projets', type: 'epargne', solde: 0, icone: '💰' }];
    fx.soldesInitiaux.assurances_tracker = [{ id: 9, libelle: 'Analyses', montant: 2480, dateRemboursement: '2026-11-16', compteDepot: 'courant', remboursement: false }];
    d.virementsInternes = [{ id: 601, mois: 11, sourceCompte: 'courant', destinationCompte: 'cpt_acc_da', montant: 1000, jourPrevu: 15 }];
    d.depensesIrregulieres = [{ id: 701, mois: 11, annee: 2026, nom: 'Paiement Notaire & Travaux', montant: 4000, paye: false, montantPaye: 0, sourceCompte: 'courant', jourPrevu: 20, categorieId: 'cat_irr_depense_exceptionnelle' }];
    d.consoRealiseeT0 = {}; d.consoClotureT0 = {}; d.banqueOperations = {};
    const T = (id, date, libelle, montant, categorieId, extra = {}) => ({ id, datetime: date + 'T12:00', date, mois: Number(date.slice(5, 7)), libelle, montant, categorieId, categorieSource: 'règle', compteId: 'acc_cc', source: 'banque', ...extra });
    d.transactionsReelles = []; const _ancien = [
        T(1, '2026-10-29', 'Société Régionale Mult', 221, 'cat_cv_factures__delect'),
        T(2, '2026-10-28', 'Orange', 49, 'cat_cv_factures__dtel'),
        T(3, '2026-10-29', 'khdra marché', 20, 'cat_cv_alimentation__dkhdra', { source: 'manuel' }),
        T(4, '2026-10-20', 'Syndic octobre', 300, 'cat_cf_syndic'),                                  // cycle d'octobre
        T(5, '2026-10-29', 'LIBELLE INCONNU', 300, 'cat_cf_syndic', { categorieSource: 'défaut', aVerifier: true }),
    ]; void _ancien;
    fx.donneesAnnuelles[2027] = JSON.parse(JSON.stringify(d));
    return fx;
};
//  le vrai CSS (Tailwind compilé) : la fenêtre doit passer DEVANT le Relevé (z-index), sinon on ne peut pas cliquer
const twBin = path.join(RACINE, 'node_modules/.bin/tailwindcss');
let tw = '';
if (fs.existsSync(twBin)) { const twTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-releve-'));
  fs.writeFileSync(path.join(twTmp, 'in.css'), '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
  fs.writeFileSync(path.join(twTmp, 'cfg.js'), 'module.exports={content:[' + JSON.stringify(path.join(RACINE, 'index.html')) + '],theme:{extend:{}}};');
  twCompiler(twBin, ['-c', path.join(twTmp, 'cfg.js'), '-i', path.join(twTmp, 'in.css'), '-o', path.join(twTmp, 'out.css'), '--minify'], { stdio: 'ignore' });
  tw = fs.readFileSync(path.join(twTmp, 'out.css'), 'utf8'); fs.rmSync(twTmp, { recursive: true, force: true }); }
const page0 = html
    .replace('<script src="https://unpkg.com/vue@3/dist/vue.global.js"', '<script src="/vue.js"')
    .replace('<script src="https://cdn.jsdelivr.net/npm/chart.js"', '<script src="/chart.js"')
    .replace(/<script src="https:\/\/cdn\.tailwindcss\.com"[^>]*><\/script>/, '<link rel="stylesheet" href="/tailwind.css">')
    .replace(/<script[^>]*src="https:\/\/[^"]*"[^>]*><\/script>/g, '');
const srv = http.createServer((req, res) => {
    const p = req.url.split('?')[0];
    const s = (c, b, ty = 'application/json') => { res.writeHead(c, { 'Content-Type': ty }); res.end(b); };
    if (p === '/finance/') return s(200, page0, 'text/html; charset=utf-8');
    if (p === '/tailwind.css') return s(200, tw, 'text/css');
    if (p === '/vue.js') return s(200, fs.readFileSync(vueJs), 'text/javascript');
    if (p === '/chart.js') return s(200, fs.readFileSync(chartJs), 'text/javascript');
    if (p === '/finance/finance_data.json') return s(200, JSON.stringify(fixture()));
    return s(200, '{"status":"ok"}');
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port;
const browser = await pw.chromium.launch({ executablePath: chromium, args: ['--no-sandbox', '--force-prefers-reduced-motion'] });
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
    const E = (f, ...a) => page.evaluate(({ ST, f, a }) => { const st = eval(ST); return new Function('st', 'a', 'return (' + f + ')(st, ...a)')(st, a); }, { ST, f: f.toString(), a });
    const attendre = (ms) => page.waitForTimeout(ms);
    const ouvrirReleve = async () => { await E((st) => { st.actionReleve = null; st.ouvrirReleveProjection(null); }); await attendre(600); };
    const cliquer = async (type, re) => {
        const lignes = page.locator('[data-releve-table] [data-releve-cliquable="' + type + '"]');
        const n = await lignes.count();
        for (let k = 0; k < n; k++) { const t = await lignes.nth(k).textContent(); if (!re || re.test(t)) { await lignes.nth(k).click(); await attendre(300); return t.replace(/\s+/g, ' ').trim(); } }
        return null;
    };
    const ligneTexte = (re) => page.$$eval('[data-releve-table] tr', (trs, src) => trs.map(t => t.textContent.replace(/\s+/g, ' ').trim()).filter(t => new RegExp(src).test(t)), re.source);

    await section('B', async () => {
        await ouvrirReleve();
        const K = await E((st) => [...new Set(st.journalHybridePourReleve.entries.filter(e => e.src).map(e => e.src.k))].sort());
        v('B. les lignes prévues du Relevé savent ce qu\'elles représentent : flux, virement, épargne, revenu, créance, groupe',
          ['creance', 'epargne', 'flux', 'groupe', 'revenu', 'virement'].every(k => K.includes(k)), JSON.stringify(K));
    });

    await section('C', async () => {
        const t = await cliquer('flux', /Notaire/);
        const F = await E((st) => st.actionReleve && { type: st.actionReleve.s.k, f: { ...st.actionReleve.f }, ou: st.actionReleve.ou });
        v('C. clic sur « ⚠️ Paiement Notaire & Travaux » : la fenêtre s\'ouvre, préremplie (nom, 4 000, novembre, le 20)',
          F && F.type === 'flux' && F.f.nom === 'Paiement Notaire & Travaux' && F.f.montant === 4000 && F.f.mois === 11 && Number(F.f.jour) === 20 && F.ou === 'Calendrier Pluriannuel', JSON.stringify({ t, F }));
        await page.fill('[data-ar-nom]', 'Notaire (acompte)'); await page.fill('[data-ar-montant]', '3500'); await page.fill('[data-ar-jour]', '12');
        await page.click('[data-ar-enregistrer]'); await attendre(500);
        const R = await E((st) => { const dep = st.donneesAnnuelles[2026].depensesIrregulieres[0]; return { nom: dep.nom, montant: dep.montant, jour: dep.jourPrevu, ouvert: !!st.actionReleve }; });
        const L = await ligneTexte(/Notaire/);
        v('  → « ✓ Enregistrer » modifie LE FLUX LUI-MÊME (Calendrier) : « Notaire (acompte) », 3 500, le 12 — et le Relevé le montre aussitôt',
          R.nom === 'Notaire (acompte)' && R.montant === 3500 && R.jour === 12 && !R.ouvert && L.length === 1 && /12 nov/.test(L[0]) && /Notaire \(acompte\)/.test(L[0]) && /3.500/.test(L[0]), JSON.stringify({ R, L }));
    });

    await section('D', async () => {
        await cliquer('epargne', /Transfert/);
        const F = await E((st) => ({ montant: st.actionReleve.f.montant, mois: st.actionReleve.moisNom }));
        await page.fill('[data-ar-montant]', '1500'); await page.click('[data-ar-enregistrer]'); await attendre(500);
        const R = await E((st) => { const ep = st.donneesAnnuelles[2026].epargne[0]; return { base: ep.valeur, nov: st.valeurEffective(ep, ep.valeur, 11), dec: st.valeurEffective(ep, ep.valeur, 12), exc: ep.exceptions }; });
        v('D. épargne : « Montant de Novembre » 3 000 → 1 500 : novembre seul change (exception), le montant de base reste 3 000, décembre aussi',
          F.montant === 3000 && F.mois === 'Novembre' && R.base === 3000 && R.nov === 1500 && R.dec === 3000 && R.exc.length === 1, JSON.stringify({ F, R }));
        await cliquer('epargne', /Transfert/);
        await page.click('[data-ar-supprimer]'); await attendre(150);
        const lib = await page.textContent('[data-ar-supprimer]');
        await page.click('[data-ar-supprimer]'); await attendre(500);
        const R2 = await E((st) => { const ep = st.donneesAnnuelles[2026].epargne[0]; return { nov: st.valeurEffective(ep, ep.valeur, 11), dec: st.valeurEffective(ep, ep.valeur, 12), lignes: st.donneesAnnuelles[2026].epargne.length }; });
        v('  → « 🗑️ Retirer ce mois-ci », confirmé (« Oui, retirer pour Novembre ») : rien en novembre, la ligne reste au budget (décembre 3 000)',
          /Oui, retirer pour Novembre/.test(lib) && R2.nov === 0 && R2.dec === 3000 && R2.lignes === 1, JSON.stringify({ lib, R2 }));
    });

    await section('E', async () => {
        await cliquer('virement', /Virement →/);
        await page.fill('[data-ar-jour]', '5'); await page.selectOption('[data-ar-mois]', '12'); await page.fill('[data-ar-montant]', '1200');
        await page.click('[data-ar-enregistrer]'); await attendre(500);
        const R = await E((st) => { const v = st.donneesAnnuelles[2026].virementsInternes[0]; return { mois: v.mois, jour: v.jourPrevu, montant: v.montant }; });
        v('E. virement : déplacé au 5 décembre, 1 200 — modifié dans le Calendrier', R.mois === 12 && R.jour === 5 && R.montant === 1200, JSON.stringify(R));
    });

    await section('F', async () => {
        await cliquer('revenu', /SALAIRE/);
        const F = await E((st) => st.actionReleve.f.montant);
        await page.fill('[data-ar-montant]', '18000'); await page.click('[data-ar-enregistrer]'); await attendre(500);
        const R = await E((st) => { const r = st.donneesAnnuelles[2026].revenus.salaire; return { base: r.base, nov: st.valeurEffective(r, r.base, 11) }; });
        v('F. salaire : « Montant de Novembre » 20 000 → 18 000 pour ce mois seulement (la base reste 20 000)', F === 20000 && R.base === 20000 && R.nov === 18000, JSON.stringify({ F, R }));
        await cliquer('creance', /Analyses/);
        await page.fill('[data-ar-date]', '2026-11-24'); await page.click('[data-ar-enregistrer]'); await attendre(500);
        const C = await E((st) => st.soldesInitiaux.assurances_tracker[0].dateRemboursement);
        v('  → créance « Analyses » : date attendue → 24/11/2026', C === '2026-11-24', String(C));
    });

    await section('G', async () => {
        await cliquer('flux', /Notaire/);
        await page.click('[data-ar-supprimer]'); await attendre(150);
        const lib = await page.textContent('[data-ar-supprimer]');
        await page.click('[data-ar-supprimer]'); await attendre(500);
        const R = await E((st) => st.donneesAnnuelles[2026].depensesIrregulieres.length);
        const L = await ligneTexte(/Notaire/);
        v('G. flux : « 🗑️ Supprimer » puis « Oui, supprimer » : supprimé du Calendrier, disparu du Relevé', /Oui, supprimer/.test(lib) && R === 0 && L.length === 0, JSON.stringify({ lib, R, L }));
    });

    await section('H', async () => {
        await cliquer('groupe', /Charges Fixes|Factures|semaine|Courses/i);
        const g = await page.$$eval('[data-ar-groupe]', els => els.map(e => e.textContent.trim()));
        await page.click('[data-ar-aller]'); await attendre(400);
        const R = await E((st) => ({ ouvert: st.showReleveModal, tab: st.activeTab, mode: st.appMode }));
        v('H. une ligne qui regroupe : la fenêtre le dit, « ↗ Ouvrir dans Budget Structurel » ferme le Relevé et y va',
          g.length === 1 && !R.ouvert && R.tab === 'parametres' && R.mode === 'previsionnel', JSON.stringify({ g, R }));
        await ouvrirReleve();
        await cliquer('virement', /Virement →/);
        await page.click('[data-ar-aller]'); await attendre(400);
        const V = await E((st) => ({ ouvert: st.showReleveModal, tab: st.activeTab, mois: [...st.moisOuverts] }));
        v('  → un virement : « ↗ Ouvrir dans Calendrier Pluriannuel », décembre déplié', !V.ouvert && V.tab === 'irregulieres' && V.mois.includes(12), JSON.stringify(V));
    });
    v('aucune erreur JavaScript', erreurs.length === 0, erreurs[0] || '');
} finally {
    await browser.close();
    srv.close();
}
console.log(ko === 0 ? '\n  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `\n  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
