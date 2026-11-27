/**
 * v37.152 — LES RESTES DU CYCLE D'AVANT, EN HAUT DU NOUVEAU CYCLE : payé, reporté ou clos.
 *
 *   « Je propose un mécanisme pour reporter ou marquer comme payé en haut du nouveau cycle, en surlignant les charges
 *     non renseignées depuis le cycle d'avant. »
 *   Décor fictif, samedi 28 nov. 2026, paie le 27 : le cycle de novembre (27 oct. → 26 nov.) vient de se clore.
 *     Il y reste : SALAIRE 20 000 (pas pointé), Syndic 300 (rien saisi), tel 99 (49 réglés par Orange), Nounou 500 ;
 *     « elect » est réglée (221 par le journal) ; les courses de la semaine sont une enveloppe (pas une ligne).
 *     A. statique · B. le bandeau · C. ✓ Payé · D. ↪ Reporter (ce cycle) · E. ↪ Reporter (janvier 2027) ·
 *     F. ✕ Clore · G. rétro et liste vide.
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
console.log('\n  LES RESTES DU CYCLE D’AVANT (payé, reporté, clos)\n  ' + '─'.repeat(80));

v('A. le bandeau « Restés sans suite » en haut du Pilotage (hors rétro), trois actions ; le report pose un flux exceptionnel et clôt l\'origine (reporte)',
  /data-restes-precedent/.test(html) && /v-if="!isPilotageRetro && restesCyclePrecedent\.lignes\.length"/.test(html)
  && (html.match(/data-reste-(paye|reporter|clore)/g) || []).length >= 3 && /reporte: \{ vers: cible\.cle, montant: l\.reste, id: flux\.id \}/.test(html));
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
    d.chargesFixes = { creditImmo: Fx('—', 0), creditStudio: Fx('—', 0), syndic: Fx('Syndic', 300, 10), nounou: Fx('Nounou', 500, 15), ecole: Fx('—', 0), femmeMenage: Fx('—', 0), habitsCharif: Fx('—', 0), habitsBebe: Fx('—', 0), jouets: Fx('—', 0) };
    d.chargesVariables = {
        alimentation: { ...neutre, label: 'Courses', valeur: 0, periode: 'semaine', details: [{ nom: 'khdra', montant: 200, periode: 'semaine' }] },
        factures: { ...neutre, label: 'Factures', valeur: 299, periode: 'mois', details: [{ nom: 'elect', montant: 200, jourPrevu: 6 }, { nom: 'tel', montant: 99, jourPrevu: 6 }] },
    };
    d.epargne = []; d.depensesIrregulieres = []; d.virementsInternes = []; d.consoRealiseeT0 = {}; d.consoClotureT0 = {}; d.banqueOperations = {};
    const T = (id, date, libelle, montant, categorieId, extra = {}) => ({ id, datetime: date + 'T12:00', date, mois: Number(date.slice(5, 7)), libelle, montant, categorieId, categorieSource: 'règle', compteId: 'acc_cc', source: 'banque', ...extra });
    d.transactionsReelles = [
        T(1, '2026-10-29', 'Société Régionale Mult', 221, 'cat_cv_factures__delect'),
        T(2, '2026-10-28', 'Orange', 49, 'cat_cv_factures__dtel'),
        T(3, '2026-10-29', 'khdra marché', 20, 'cat_cv_alimentation__dkhdra', { source: 'manuel' }),
        T(4, '2026-10-20', 'Syndic octobre', 300, 'cat_cf_syndic'),                                  // cycle d'octobre
        T(5, '2026-10-29', 'LIBELLE INCONNU', 300, 'cat_cf_syndic', { categorieSource: 'défaut', aVerifier: true }),
    ];
    fx.donneesAnnuelles[2027] = JSON.parse(JSON.stringify(d)); fx.donneesAnnuelles[2027].transactionsReelles = [];
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
const browser = await pw.chromium.launch({ executablePath: chromium, args: ['--no-sandbox', '--force-prefers-reduced-motion'] });
const ST = 'document.querySelector("#app").__vue_app__._instance.setupState';
const erreurs = [];
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
await page.clock.setFixedTime(new Date(2026, 10, 28, 12, 0, 0));
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
    const liste = () => E((st) => ({ nom: st.restesCyclePrecedent.nom, lignes: st.restesCyclePrecedent.lignes.map(l => [l.libelle, l.sens, l.reste, l.regle]), aPayer: st.restesCyclePrecedent.aPayer, aEncaisser: st.restesCyclePrecedent.aEncaisser }));
    const ecran = () => page.evaluate(() => [...document.querySelectorAll('[data-reste-ligne]')].filter(e => e.offsetParent !== null).map(e => e.dataset.libelle));
    const ligne = (lib) => page.locator('[data-reste-ligne][data-libelle="' + lib + '"]');
    const proj = () => E((st) => Math.round(st.patrimoineProjeteGlobal));

    await section('B', async () => {
        const L = await liste();
        v('B. au 28 nov. (cycle de décembre), le bandeau liste ce qui reste du cycle de novembre : l\'entrée d\'abord, puis par jour : tel (6), Syndic (10), Nounou (15) ; ni « elect » (réglée) ni les courses (enveloppe)',
          L.nom === 'Novembre 2026' && JSON.stringify(L.lignes) === JSON.stringify([['SALAIRE', 'credit', 20000, 0], ['tel', 'debit', 50, 49], ['Syndic', 'debit', 300, 0], ['Nounou', 'debit', 500, 0]]), JSON.stringify(L));
        v('  → totaux : 850 à payer, +20 000 à encaisser', L.aPayer === 850 && L.aEncaisser === 20000, JSON.stringify(L));
        const vu = await ecran();
        const etat = await ligne('tel').locator('[data-reste-etat]').textContent();
        const etat2 = await ligne('Syndic').locator('[data-reste-etat]').textContent();
        v('  → à l\'écran, en haut du Pilotage : les 4 lignes ; « tel » dit « 49 saisis sur 99 », « Syndic » dit « rien saisi »',
          JSON.stringify(vu) === JSON.stringify(['SALAIRE', 'tel', 'Syndic', 'Nounou']) && /49.*saisis sur.*99/.test(etat) && /rien saisi/.test(etat2), JSON.stringify({ vu, etat, etat2 }));
        const avant = await page.evaluate(() => { const b = document.querySelector('[data-restes-precedent]'), k = document.querySelector('[data-cockpit-kpis]'); return !!(b && k && (b.compareDocumentPosition(k) & Node.DOCUMENT_POSITION_FOLLOWING)); });
        v('  → le bandeau est AU-DESSUS des trois chiffres du cycle', avant);
    });

    let P0;
    await section('C', async () => {
        await ligne('Syndic').locator('[data-reste-paye]').click();
        await attendre(400);
        const R = await E((st) => { const it = st.donneesAnnuelles[2026].chargesFixes.syndic; const ops = st.donneesAnnuelles[2026].transactionsReelles.filter(t => t.source === 'realise' && /Syndic/.test(t.libelle)).map(t => [t.montant, t.date]);
            return { payeNov: st.isItemPaid(it, 300, '2026-11'), payeDec: st.isItemPaid(it, 300, '2026-12'), ops }; });
        v('C. ✓ Payé sur « Syndic » : coché DANS le cycle de novembre (comme une case cochée en rétro) ; décembre garde son propre Syndic à payer',
          R.payeNov && !R.payeDec && !(await ecran()).includes('Syndic'), JSON.stringify(R));
        P0 = await proj();
    });

    await section('D', async () => {
        await ligne('tel').locator('[data-reste-reporter]').click();
        await attendre(500);
        const R = await E((st) => {
            const d = st.donneesAnnuelles[2026], tel = d.chargesVariables.factures.details[1];
            const flux = d.depensesIrregulieres.filter(x => x.reportDe);
            const t = st.tachesPilotageToutes.find(x => /^↪ tel/.test(x.libelle)), telDec = st.tachesPilotageToutes.find(x => x.libelle === 'tel');
            const e = (tel.trackerRealise || {})['2026-11'] || {};
            return { flux: flux.map(x => ({ nom: x.nom, montant: x.montant, mois: x.mois, annee: x.annee, jour: x.jourPrevu })), dansDec: st.getDepensesCycle(12, 2026).some(x => x.reportDe), tache: t ? t.due : null, telDec: telDec ? telDec.due : null, clos: e.cloture === true, vers: e.reporte && e.reporte.vers };
        });
        v('D. ↪ Reporter « tel » (ce cycle) : un flux « ↪ tel (reporté de Novembre 2026) » de 50, dû aujourd\'hui (28 nov., après la paie → cycle de décembre)',
          JSON.stringify(R.flux) === JSON.stringify([{ nom: '↪ tel (reporté de Novembre 2026)', montant: 50, mois: 11, annee: 2026, jour: 28 }]) && R.dansDec, JSON.stringify(R));
        v('  → il est à traiter dans le Pilotage de décembre (50), à côté du « tel » de décembre (99, intact) ; l\'origine est close, « reportée vers 2026-12 »',
          R.tache === 50 && R.telDec === 99 && R.clos && R.vers === '2026-12' && !(await ecran()).includes('tel'), JSON.stringify(R));
        const P1 = await proj();
        v('  → la projection fin 2026 compte maintenant ces 50 (avant : ils avaient disparu des prévisions) : −50', P1 === P0 - 50, JSON.stringify({ P0, P1 }));
    });

    await section('E', async () => {
        await ligne('SALAIRE').locator('[data-reste-cible]').selectOption('2027-01');
        await ligne('SALAIRE').locator('[data-reste-reporter]').click();
        await attendre(500);
        const R = await E((st) => {
            const f = st.donneesAnnuelles[2026].depensesIrregulieres.find(x => x.reportDe && x.reportDe.nature === 'revenu');
            const s = st.donneesAnnuelles[2026].revenus.salaire, e = (s.trackerRealise || {})['2026-11'] || {};
            return { f: f && { montant: f.montant, mois: f.mois, annee: f.annee, jour: f.jourPrevu }, janv: st.getDepensesCycle(1, 2027).some(x => x === f), dec: st.getDepensesCycle(12, 2026).some(x => x === f), vers: e.reporte && e.reporte.vers };
        });
        v('E. ↪ Reporter le SALAIRE vers « Janvier 2027 » : une ENTRÉE de 20 000 (montant négatif) le 27 déc., donc dans le cycle de janvier 2027 — pas dans celui de décembre',
          R.f && R.f.montant === -20000 && R.f.mois === 12 && R.f.annee === 2026 && R.f.jour === 27 && R.janv && !R.dec && R.vers === '2027-01', JSON.stringify(R));
    });

    await section('G', async () => {
        await E((st) => { st.pilotageViewedCycle = '11-2026'; });
        await attendre(400);
        const n = await page.$$eval('[data-restes-precedent]', els => els.length);
        v('G. en consultant un cycle passé (Mode Régularisation), pas de bandeau', n === 0, String(n));
        await E((st) => { st.pilotageViewedCycle = null; });
        await attendre(400);
    });

    await section('F', async () => {
        const nFlux = await E((st) => st.donneesAnnuelles[2026].depensesIrregulieres.length);
        await ligne('Nounou').locator('[data-reste-clore]').click();
        await attendre(400);
        const R = await E((st, n0) => ({ clos: st.estClotureItem(st.donneesAnnuelles[2026].chargesFixes.nounou, '2026-11'), flux: st.donneesAnnuelles[2026].depensesIrregulieres.length - n0, reste: st.restesCyclePrecedent.lignes.length }), nFlux);
        v('F. ✕ Clore « Nounou » : close dans novembre, aucun flux créé ; plus rien ne reste', R.clos && R.flux === 0 && R.reste === 0, JSON.stringify(R));
        const n = await page.$$eval('[data-restes-precedent]', els => els.length);
        v('  → la liste vide, le bandeau disparaît', n === 0, String(n));
    });
    v('aucune erreur JavaScript', erreurs.length === 0, erreurs[0] || '');
} finally {
    await browser.close();
    srv.close();
}
console.log(ko === 0 ? '\n  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `\n  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
