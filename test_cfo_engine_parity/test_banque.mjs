/**
 * v37.53 — CALIBRAGE BANCAIRE (RIB / EMPREINTE) & RÉCONCILIATION AUTOMATIQUE.
 *
 *   « Automatiser la mise à jour quotidienne de mes soldes ET le remplissage des opérations
 *   oubliées, à partir de mes banques marocaines (Attijariwafa Bank, Bank Assafa, Saham). »
 *
 *   Les 4 cas réels, tels que décrits : Attijarinet (texte collé, banque/attijari_web.txt),
 *   Attijari Mobile, Bank Assafa, Saham (maquettes fidèles rendues en PNG, banque/*.png) —
 *   LUES PAR LE VRAI OCR embarqué (vendor/ocr), dans le navigateur. Aucun appel IA pour lire.
 *   Mercredi 14 oct. 2026, paie le 27 (cycle 27 sept. → 26 oct.).
 *
 *     A. statique · B. le parseur, texte par texte (bruit OCR, colonnes, tabulations) ·
 *     C. calibrer « Compte urgence » d'une capture Saham (empreinte) · D. l'import : OCR,
 *     questions (RIB inconnus), propositions ligne à ligne · E. appliquer : soldes, journal,
 *     Pilotage, frais, registre · F. « À vérifier » · G. recoller : rien n'est refait ·
 *     H. Ctrl+V d'une image et d'un texte.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..');
const BQ = path.join(ICI, 'banque');
const html = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8').split('\r\n').join('\n');

let ko = 0;
const v = (t, ok, d = '') => { if (!ok) ko++; console.log(`  ${ok ? '✅' : '❌'} ${t.padEnd(64)} ${ok ? '' : d}`); };
const section = async (nom, f) => { try { await f(); } catch (e) { v(`${nom} : exécution sans exception`, false, String(e && e.stack || e).slice(0, 300)); } };
console.log('\n  BANQUE : CALIBRAGE, LECTURE LOCALE, RÉCONCILIATION\n  ' + '─'.repeat(80));

/* ── A. Statique ─────────────────────────────────────────────────────── */
const parseur = html.slice(html.indexOf('BANQUE:PARSEUR:DEBUT'), html.indexOf('BANQUE:PARSEUR:FIN'));
v('A. l\'OCR est embarqué (tesseract.js 5.1.1, cœur SIMD, français), servi par le VPS',
  ['tesseract.min.js', 'worker.min.js', 'tesseract-core-simd-lstm.wasm.js', 'lang/fra.traineddata.gz'].every(f => fs.existsSync(path.join(RACINE, 'vendor/ocr', f)))
  && /new URL\('vendor\/ocr\/', document\.baseURI\)/.test(html));
v('  → le parseur est pur : aucun appel réseau, aucune IA', parseur.length > 3000 && !/fetch\(|webhook|XMLHttpRequest/.test(parseur));
v('  → la modale d\'import (Saisie et Trésorerie) et la section de calibrage', /data-import-ouvrir-saisie/.test(html) && /data-import-ouvrir /.test(html) && /data-calibrage /.test(html) && /data-import-banque /.test(html));

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

/* ── Le décor : vos 6 comptes, vos catégories ───────────────────────── */
const CC = 'acc_cc', LT = 'acc_lt', BOURSE = 'acc_bo', ANNUELS = 1778756866808, URGENCE = 1786532576196, ASSAFA = 1790780761917;
const fixture = () => {
    const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8'));
    const base = fx.donneesAnnuelles[Object.keys(fx.donneesAnnuelles)[0]];
    fx.donneesAnnuelles = {};
    for (const an of [2026, 2027]) fx.donneesAnnuelles[an] = JSON.parse(JSON.stringify(base));
    Object.assign(fx.soldesInitiaux, { moisActuel: 10, anneeActuelle: 2026, jourDePaie: 27, compteChargesFixes: 'courant', compteChargesVariables: 'courant',
                                       assurances_tracker: [], voyageDebut: '', voyageFin: '' });
    fx.soldesInitiaux.categories = [];
    fx.comptes = [
        { id: CC, label: 'Compte Courant', type: 'liquide', solde: 6300, icone: '💳' },
        { id: LT, label: 'Épargne Long Terme', type: 'epargne', solde: 39000, icone: '🎯' },
        { id: BOURSE, label: 'Bourse / CTO', type: 'investissement', solde: 4000, icone: '📈' },
        { id: ANNUELS, label: 'depenses annuels', type: 'liquide', solde: 9200 },
        { id: URGENCE, label: 'Compte urgence', type: 'liquide', solde: 5000 },
        { id: ASSAFA, label: 'Compte Principale ASSAFA', type: 'liquide', solde: 1580 },
    ];
    const neutre = { paye: false, montantPaye: 0, exceptions: [], showExceptions: false };
    const L = (nom, montant, periode) => ({ nom, montant, ...(periode ? { periode } : {}) });
    for (const an of Object.keys(fx.donneesAnnuelles)) {
        const d = fx.donneesAnnuelles[an];
        const Rv = (label, b, j) => ({ ...neutre, label, base: b, jourPrevu: j, destinationCompte: 'courant' });
        d.revenus = { salaire: Rv('SALAIRE', 20000, 27), magasin: Rv('Loyer magasin', 5000, 3), bonif: Rv('—', 0), cnss: Rv('—', 0), appart: Rv('—', 0), studio: Rv('—', 0) };
        const Fx = (label, valeur) => ({ ...neutre, label, valeur, jourPrevu: null });
        d.chargesFixes = { creditImmo: Fx('Crédit Immo + Assur', 5000), creditStudio: Fx('—', 0), syndic: Fx('Syndic', 300), nounou: Fx('Nounou', 2500),
                           ecole: Fx('École', 1500), femmeMenage: Fx('—', 0), habitsCharif: Fx('—', 0), habitsBebe: Fx('—', 0), jouets: Fx('—', 0) };
        const V = (label, valeur, periode, details) => ({ ...neutre, label, valeur, periode, details });
        d.chargesVariables = {
            alimentation: V('Alimentation (Tqdya)', 0, 'semaine', [L('samak', 75), L('l7m', 75), L('khdra', 200), L('Œufs', 50), L('Marjane ', 400), L('lhrri', 1200, 'cycle')]),
            sorties: V('Sorties', 0, 'semaine', [L('cafe Resto Wknd', 400), L('Cafe Charif', 100)]),
            voiture: V('Voiture', 0, 'semaine', [L('essence picanto', 300), L('diesel skoda', 350)]),
            sante: V('—', 0, 'semaine', []),
            factures: { ...V('Factures', 1399, 'mois', [L('elect', 200), L('elect marrakech villa', 800), L('tel', 99), L('eau', 300)]), categorieId: 'cat_cv_factures' },
        };
        //  « elect » déjà réglée ce cycle
        d.chargesVariables.factures.details[0].trackerRealise = { '10-2026': { paye: true, montantPaye: 200, dateReelle: '2026-10-05' } };
        d.epargne = []; d.depensesIrregulieres = []; d.consoRealiseeT0 = {};
        //  Le virement Assafa → Courant de 2 200 attendu ce cycle (le 8)
        d.virementsInternes = an !== '2026' ? [] : [{ id: 9001, mois: 10, jourPrevu: 8, sourceCompte: 'cpt_' + ASSAFA, destinationCompte: 'courant', montant: 2200 }];
        //  Ce que vous avez déjà saisi : un Marjane à 34 DH le 5 (la banque dira 33,73 le 4, comptabilisé le 6)
        d.transactionsReelles = an !== '2026' ? [] : [
            { id: 701, datetime: '2026-10-05T18:00', date: '2026-10-05', mois: 10, libelle: 'Marjane', montant: 34, categorieId: 'cat_cv_alimentation__dmarjane', compteId: CC, source: 'manuel' },
            { id: 702, datetime: '2026-10-10T21:08', date: '2026-10-10', mois: 10, libelle: 'Marjane', montant: 176, categorieId: 'cat_cv_alimentation__dmarjane', compteId: CC, source: 'manuel' },
        ];
    }
    return fx;
};
const page0 = html
    .replace('<script src="https://unpkg.com/vue@3/dist/vue.global.js"', '<script src="/vue.js"')
    .replace('<script src="https://cdn.jsdelivr.net/npm/chart.js"', '<script src="/chart.js"')
    .replace(/<script src="https:\/\/cdn\.tailwindcss\.com"[^>]*><\/script>/, '')
    .replace(/<script[^>]*src="https:\/\/[^"]*"[^>]*><\/script>/g, '');
const TYPES = { '.js': 'text/javascript', '.gz': 'application/gzip', '.wasm': 'application/wasm' };
const srv = http.createServer((req, res) => {
    const p = req.url.split('?')[0];
    const s = (c, b, t = 'application/json') => { res.writeHead(c, { 'Content-Type': t }); res.end(b); };
    if (p === '/finance/') return s(200, page0, 'text/html; charset=utf-8');
    if (p === '/vue.js') return s(200, fs.readFileSync(vueJs), 'text/javascript');
    if (p === '/chart.js') return s(200, fs.readFileSync(chartJs), 'text/javascript');
    if (p === '/finance/finance_data.json') return s(200, JSON.stringify(fixture()));
    if (p.startsWith('/finance/vendor/')) {
        const f = path.join(RACINE, decodeURIComponent(p.slice('/finance/'.length)));
        return fs.existsSync(f) ? s(200, fs.readFileSync(f), TYPES[path.extname(f)] || 'application/octet-stream') : s(404, 'absent', 'text/plain');
    }
    return s(200, '{"status":"ok"}');
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port;
const browser = await pw.chromium.launch({ executablePath: chromium, args: ['--no-sandbox'] });
const ST = 'document.querySelector("#app").__vue_app__._instance.setupState';
const page = await browser.newPage({ viewport: { width: 1300, height: 1000 } });
await page.clock.setFixedTime(new Date(2026, 9, 14, 10, 0, 0));
const erreurs = [], externes = [], webhooks = [];
page.on('pageerror', e => erreurs.push(String(e)));
page.on('dialog', d => d.accept());
page.on('request', r => { const u = r.url(); if (!u.startsWith('http://127.0.0.1') && !u.startsWith('blob:') && !u.startsWith('data:')) externes.push(u); });
let idCafe = null;
//  L'IA (v37.52) : lente (2,5 s) ; sûre d'elle pour CARAMELIO (un café), en panne pour le reste
await page.route('**/webhook/**', async (route) => {
    const corps = route.request().postData() || '';
    webhooks.push(corps);
    await new Promise(r => setTimeout(r, 2500));
    if (/CARAMELIO/.test(corps) && idCafe) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ output: JSON.stringify({ id: idCafe, confiance: 'haute', raison: 'salon de thé' }) }) });
    return route.abort();
});
await page.goto(`http://127.0.0.1:${port}/finance/`, { waitUntil: 'load' });
await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState.moisBudgetaire; }, null, { timeout: 30000 });
await page.waitForTimeout(600);
await page.evaluate(async (ST) => { const st = eval(ST); st.appMode = 'reel'; await new Promise(r => setTimeout(r, 250)); st.activeTab = 'tresorerie'; }, ST);
await page.waitForTimeout(500);
idCafe = await page.evaluate((ST) => ((eval(ST).soldesInitiaux.categories || []).find(c => String(c.label).trim() === 'cafe Resto Wknd') || {}).id || null, ST);

const WEB = fs.readFileSync(path.join(BQ, 'attijari_web.txt'), 'utf8');
const analyser = (texte) => page.evaluate(({ ST, texte }) => JSON.parse(JSON.stringify(eval(ST).bqAnalyser(texte, { aujourdhui: new Date(2026, 9, 14) }))), { ST, texte });
const ops = (a) => a.operations.map(o => [o.dateOp, o.dateAchat || '', o.montant, o.libelle].join(' | '));
const compte = (id) => page.evaluate(({ ST, id }) => JSON.parse(JSON.stringify(eval(ST).comptes.find(c => String(c.id) === String(id)))), { ST, id });
const txs = () => page.evaluate((ST) => JSON.parse(JSON.stringify(eval(ST).donneesAnnuelles[2026].transactionsReelles)), ST);
const caps = () => page.evaluate((ST) => JSON.parse(JSON.stringify(eval(ST).importBanque.captures.map(c => ({ id: c.id, source: c.source, banque: c.analyse.banque, format: c.analyse.format,
    compteId: c.compteId, via: c.via, question: c.question, solde: c.soldeChoisi, appliquer: c.appliquerSolde,
    lignes: (c.lignes || []).map(l => ({ lib: l.op.libelle, m: l.op.montant, type: l.type, action: l.action, deja: !!l.dejaTraitee, doublon: l.doublon, cat: l.cat && l.cat.statut, marchand: l.marchand })) })))), ST);
const ligne = (c, debut) => (c.lignes || []).find(l => l.lib.startsWith(debut)) || {};
const ouvrir = async () => { await page.evaluate((ST) => eval(ST).ouvrirImportBanque(), ST); await page.waitForTimeout(200); };
const deposer = async (fichiers, texte) => {
    if (fichiers.length) await page.setInputFiles('[data-import-fichiers]', fichiers.map(f => path.join(BQ, f)));
    if (texte != null) await page.fill('[data-import-texte]', texte);
    await page.click('[data-import-analyser]');
    await page.waitForFunction((ST) => { const s = eval(ST).importBanque; return s.etape === 'revue' || (s.etape === 'depot' && !s.enCours); }, ST, { timeout: 180000 });
    await page.waitForTimeout(200);
};
const repondre = async (capId, compteId, rib) => page.evaluate(async ({ ST, capId, compteId, rib }) => {
    const st = eval(ST), cap = st.importBanque.captures.find(c => c.id === capId);
    const bloc = [...document.querySelectorAll('[data-import-capture]')][st.importBanque.captures.indexOf(cap)];
    const sel = bloc.querySelector('[data-import-reponse]');
    sel.value = String(compteId); sel.dispatchEvent(new Event('change'));
    if (rib) { const i = bloc.querySelector('[data-import-rib]'); i.value = rib; i.dispatchEvent(new Event('input')); }
    await new Promise(r => setTimeout(r, 50));
    bloc.querySelector('[data-import-associer]').click();
    await new Promise(r => setTimeout(r, 150));
}, { ST, capId, compteId, rib });

try {
    /* ── B. Le parseur, texte par texte ──────────────────────────────── */
    await section('B', async () => {
        const w = await analyser(WEB);
        v('B. Attijarinet : 5 opérations, dates comptables « 14 / oct » recollées, la vraie date CB gardée',
          w.banque === 'attijari' && w.format === 'attijari_web' && JSON.stringify(ops(w)) === JSON.stringify([
              '2026-10-14 | 2026-10-14 | -1000 | AWBGAB MARRAKECH E 14 10 09H01',
              '2026-10-13 | 2026-10-11 | -42.5 | PAIEMENT CB 11/10/26 CARAMELIO',
              '2026-10-08 | 2026-10-06 | -270 | PAIEMENT CB 06/10/26 LA BONNE P CHE',
              '2026-10-06 | 2026-10-03 | -40.53 | PAIEMENT CB 03/10/26 CARREFOUR EX M',
              '2026-10-06 | 2026-10-04 | -33.73 | PAIEMENT CB 04/10/26 MARJ MENARA G']), JSON.stringify(ops(w)));
        v('  → le n° de compte de l\'URL (7654321) ; DÉBIT 1 386,76 = la somme des lignes', JSON.stringify(w.identifiants) === '["7654321"]' && w.totaux.debit === 1386.76
          && Math.abs(w.operations.reduce((s, o) => s - o.montant, 0) - 1386.76) < 0.001, JSON.stringify([w.identifiants, w.totaux]));
        //  Le même relevé, collé en tableau (tabulations) et sans l'URL
        const t = await analyser(WEB.replace(/\n(\d{2})\noct\n/g, '\n$1 oct\t').replace(/\n(- [\d ,]+MAD)/g, '\t$1').replace(/https:.*$/m, ''));
        v('  → collé en tableau (tabulations) : les mêmes 5 opérations', JSON.stringify(ops(t)) === JSON.stringify(ops(w)), JSON.stringify(ops(t)));
        //  Saham lu « en colonnes » (les montants tous à la fin) — ce que fait parfois l'OCR
        const col = await analyser('BONJOUR KARIM TESTEUR\nCompte chèque dirhams\n5 174,09 DH\nTRANSACTIONS RÉCENTES\nEmission d\'un virement mobile tiers sah…\n05/10/2026\n'
            + 'Reception vrt instantane n : 269890 de …\n04/10/2026\nReception vrt instantane n : 268271 de …\n01/10/2026\nEmission vrt instantane n 174182 en fa…\n29/08/2026\n'
            + '-4 900,00 Dh\n+5 000,00 Dh\n+5 000,00 Dh\n-6 000,00 Dh\n');
        v('  → Saham « en colonnes » : chaque montant rendu à sa ligne, le solde 5 174,09, l\'empreinte',
          col.banque === 'saham' && JSON.stringify(col.operations.map(o => [o.dateOp, o.montant])) === '[["2026-10-05",-4900],["2026-10-04",5000],["2026-10-01",5000],["2026-08-29",-6000]]'
          && col.soldes.compteCheque === 5174.09 && col.signature === 'saham|compte cheque dirhams' && col.identifiants.length === 0, JSON.stringify([col.operations, col.soldes, col.signature]));
        //  Bank Assafa, espaces insécables, tiret « − », libellé sur deux lignes
        const as = await analyser('190 780 2100345600071234 52\nSolde disponible\n9 101,35 Dhs\nVOS DERNIÈRES OPÉRATIONS\n08 Octobre − 17,60 Dhs\nCom - VIR INST #16110487 , box\n'
            + '08 Octobre - 2 200,00 Dhs\nVIREMENT EMIS EN FAVEUR DE TESTEUR\nKarim attijari box\n');
        v('  → Bank Assafa : RIB, solde 9 101,35, « − » et espaces insécables, libellé sur deux lignes',
          as.banque === 'assafa' && JSON.stringify(as.identifiants) === '["190780210034560007123452"]' && as.soldes.solde === 9101.35
          && JSON.stringify(ops(as)) === JSON.stringify(['2026-10-08 |  | -17.6 | Com - VIR INST #16110487 , box', '2026-10-08 |  | -2200 | VIREMENT EMIS EN FAVEUR DE TESTEUR Karim attijari box']), JSON.stringify([as.identifiants, as.soldes, ops(as)]));
        const an = await analyser('VOS DERNIÈRES OPÉRATIONS\n28 Décembre - 50,00 Dhs\nRETRAIT GAB\n08 Octobre - 17,60 Dhs\nCom - VIR INST\n');
        v('  → « 28 Décembre » sans année, lu le 14 oct. 2026 : décembre 2025 (pas 2026, dans le futur)', JSON.stringify(an.operations.map(o => o.dateOp)) === '["2025-12-28","2026-10-08"]', JSON.stringify(an.operations.map(o => o.dateOp)));
        const k = await page.evaluate((ST) => { const st = eval(ST); const c = (l, m) => st.bqClasser({ libelle: l, montant: m });
            return [c('AWBGAB MARRAKECH E 14 10 09H01', -1000), c('GAB BANK ASSAFA S 13 10', -1500), c('Com - VIR INST #16110487 , box', -17.6), c('VIREMENT EMIS EN FAVEUR DE TESTEUR', -2200),
                    c('Reception vrt instantane n : 269890', 5000), c("Emission d'un virement mobile tiers", -4900), c('PAIEMENT CB 11/10/26 CARAMELIO', -42.5), c('Paiement SRM Marrakech-Sa', -377.93),
                    st.bqMarchand({ libelle: 'PAIEMENT CB 11/10/26 CARAMELIO' }), st.bqMarchand({ libelle: 'Paiement SRM Marrakech-Sa' })]; }, ST);
        v('  → la nature : GAB, GAB, frais, virement, virement, virement, achat, achat ; commerçants CARAMELIO, SRM Marrakech-Sa',
          JSON.stringify(k) === JSON.stringify(['gab', 'gab', 'frais', 'virement', 'virement', 'virement', 'achat', 'achat', 'CARAMELIO', 'SRM Marrakech-Sa']), JSON.stringify(k));
    });

    /* ── C. Calibrer « Compte urgence » d'une capture Saham ──────────── */
    await section('C', async () => {
        //  v37.55 : un seul bouton « 🎯 Calibrer avec une capture » ; un compte inconnu → « à quel compte ? », une fois
        await page.setInputFiles('[data-calibrage-captures]', path.join(BQ, 'saham_mobile.png'));
        await page.waitForFunction((ST) => !eval(ST).calibrageBanque.enCours && (eval(ST).calibrageBanque.attente.length || eval(ST).calibrageBanque.resultats.length), ST, { timeout: 120000 });
        await page.selectOption('[data-calibrage-attente] [data-calibrage-reponse]', String(URGENCE));
        await page.click('[data-calibrage-attente] [data-calibrage-associer]');
        await page.waitForTimeout(200);
        const u = await compte(URGENCE);
        const msg = await page.evaluate(() => [...document.querySelectorAll('[data-calibrage-resultat]')].map(e => e.textContent.trim()).join(' | '));
        v('C. 🎯 Calibrer avec la capture Saham → « Compte urgence » : banque Saham, empreinte « compte chèque dirhams » (pas de RIB à l\'écran)',
          u.banque === 'saham' && JSON.stringify(u.empreintes) === '["saham|compte cheque dirhams"]' && !(u.identifiants || []).length && /Saham Bank · empreinte/.test(msg || ''), JSON.stringify([u, msg]));
    });

    /* ── D. L'import : OCR réel, questions, propositions ─────────────── */
    let c0 = [];
    await section('D', async () => {
        await ouvrir();
        const t0 = Date.now();
        await deposer(['attijari_mobile.png', 'assafa_mobile.png', 'saham_mobile.png'], WEB);
        c0 = await caps();
        const q = Object.fromEntries(c0.map(c => [c.format, c.question || ('auto:' + c.via)]));
        v(`D. 4 captures lues sur place (${Math.round((Date.now() - t0) / 100) / 10} s) : Attijarinet, Attijari Mobile, Bank Assafa, Saham`,
          JSON.stringify(c0.map(c => c.format)) === '["attijari_web","attijari_mobile","assafa_mobile","saham_mobile"]', JSON.stringify(c0.map(c => c.format)));
        v('  → RIB / n° inconnus → la question ; Saham reconnu à son empreinte (calibrée en C), sans question',
          q.attijari_web === 'identifiant' && q.attijari_mobile === 'identifiant' && q.assafa_mobile === 'identifiant' && q.saham_mobile === 'auto:empreinte', JSON.stringify(q));
        const qtxt = await page.evaluate(() => [...document.querySelectorAll('[data-import-question]')].map(x => x.textContent.replace(/\s+/g, ' ').trim()));
        v('  → « 🆕 Nouveau RIB détecté (190 780 2100345600071234 52). À quel compte l\'associer ? »', qtxt.some(x => x.includes('Nouveau RIB détecté (190 780 2100345600071234 52). À quel compte l\'associer ?')), JSON.stringify(qtxt));
        await repondre('texte', CC);
        c0 = await caps();
        v('  → « Associer pour toujours » : Attijarinet → Compte Courant ; la capture mobile (autre n°) le demande encore',
          c0[0].compteId === CC && c0[1].question === 'identifiant' && (await compte(CC)).banque === 'attijari' && JSON.stringify((await compte(CC)).identifiants) === '["7654321"]', JSON.stringify(c0.map(c => [c.compteId, c.question])));
        await repondre(c0[1].id, CC);
        await repondre(c0[2].id, ASSAFA);
        c0 = await caps();
        const [web, mob, as, sa] = c0;
        v('  → Assafa → Compte Principale ASSAFA ; tous les comptes connus', mob.compteId === CC && as.compteId === ASSAFA && sa.compteId === URGENCE
          && JSON.stringify((await compte(CC)).identifiants) === '["7654321","000999B000123456"]' && JSON.stringify((await compte(ASSAFA)).identifiants) === '["190780210034560007123452"]', JSON.stringify(c0.map(c => c.compteId)));
        //  Attijarinet
        v('  → AWBGAB : 🚫 ignoré (retrait espèces) ; MARJ MENARA G 33,73 : ✓ déjà dans le journal (Marjane 34 le 5)',
          ligne(web, 'AWBGAB').action === 'ignorer' && ligne(web, 'AWBGAB').type === 'gab' && ligne(web, 'PAIEMENT CB 04/10/26 MARJ').action === 'deja:701', JSON.stringify(web.lignes));
        v('  → CARREFOUR EX M : ajouté, ✓ sûr ; CARAMELIO et LA BONNE P CHE : ajoutés EN SUSPENS',
          ligne(web, 'PAIEMENT CB 03/10/26 CARREFOUR').action === 'ajouter' && ligne(web, 'PAIEMENT CB 03/10/26 CARREFOUR').cat === 'sur'
          && ligne(web, 'PAIEMENT CB 11/10/26 CARAMELIO').action === 'ajouter' && ligne(web, 'PAIEMENT CB 11/10/26 CARAMELIO').cat !== 'sur'
          && ligne(web, 'PAIEMENT CB 06/10/26 LA BONNE').action === 'ajouter' && ligne(web, 'PAIEMENT CB 06/10/26 LA BONNE').cat !== 'sur', JSON.stringify(web.lignes));
        const tot = await page.evaluate(() => document.querySelector('[data-import-totaux]')?.textContent.replace(/\s+/g, ' ').trim());
        v('  → « débits ✓ total banque 1 387 DH » : la lecture est vérifiée par le relevé lui-même', /débits ✓ total banque/.test(tot || ''), String(tot));
        //  Attijari Mobile
        const srm = ligne(mob, 'Paiement SRM');
        v('  → SRM 377,93 : 📌 pointer « elect marrakech villa » (facture du Pilotage) ; GAB BANK ASSAFA : ignoré ; solde « Compte chèque » 4 213,32',
          /^pointer:/.test(srm.action) && srm.action.includes('elect marrakech villa') && ligne(mob, 'GAB BANK').action === 'ignorer' && mob.solde === 4213.32 && mob.appliquer, JSON.stringify([srm, mob.solde]));
        //  Bank Assafa
        v('  → Assafa : frais 17,60 regroupés ; virement 2 200 pointé (Assafa → Courant du Pilotage) ; 1 200 ignoré ; solde 9 101,35',
          ligne(as, 'Com - VIR').action === 'frais' && /^pointer:Virement:9001$/.test(ligne(as, 'VIREMENT EMIS EN FAVEUR DE TESTEUR Karim attijari box').action)
          && ligne(as, 'VIREMENT EMIS EN FAVEUR DE TESTEUR Karim attijari ok').action === 'ignorer' && as.solde === 9101.35, JSON.stringify([as.lignes, as.solde]));
        //  Saham
        const recus = sa.lignes.filter(l => l.m === 5000);
        v('  → Saham : les virements jamais en dépenses — 5 000 reçu le 4 pointé sur « Loyer magasin », le second (même montant) ignoré, 29/08 hors cycle',
          sa.lignes.every(l => l.type === 'virement' && l.action !== 'ajouter') && recus.length === 2 && /^pointer:Revenu:\d+:Loyer magasin$/.test(recus[0].action) && recus[1].action === 'ignorer'
          && ligne(sa, 'Emission vrt instantane').action === 'ignorer' && sa.solde === 5174.09, JSON.stringify(sa.lignes));
        v('  → aucun appel à l\'IA, aucune requête hors du serveur (OCR embarqué)', webhooks.length === 0 && externes.length === 0, JSON.stringify([webhooks.length, externes.slice(0, 3)]));
    });

    /* ── E. Appliquer ─────────────────────────────────────────────────── */
    await section('E', async () => {
        const r = await page.evaluate((ST) => JSON.parse(JSON.stringify(eval(ST).resumeImportBanque)), ST);
        v('E. le résumé avant d\'appliquer : 3 à ajouter (2 en suspens), 1 déjà au journal, 3 à pointer, 1 frais, 6 ignorées, 3 soldes',
          r.ajouter === 3 && r.suspens === 2 && r.deja === 1 && r.pointer === 3 && r.frais === 1 && r.ignorer === 6 && r.soldes === 3, JSON.stringify(r));
        await page.click('[data-import-appliquer]'); await page.waitForTimeout(400);
        const [cc, as, ur] = [await compte(CC), await compte(ASSAFA), await compte(URGENCE)];
        v('  → soldes : Courant 4 213, ASSAFA 9 101, urgence 5 174 — le montant exact gardé (4 213,32)',
          cc.solde === 4213 && as.solde === 9101 && ur.solde === 5174 && cc.soldeBanque.montant === 4213.32 && as.soldeBanque.montant === 9101.35, JSON.stringify([cc.solde, as.solde, ur.solde, cc.soldeBanque]));
        const t = await txs();
        const bq = t.filter(x => x.source === 'banque');
        const de = (lib) => bq.find(x => x.libelle === lib) || {};
        const alim = 'cat_cv_alimentation';
        v('  → journal : CARAMELIO 42,50 le 11/10 et LA BONNE P CHE 270 le 06/10 EN SUSPENS ; CARREFOUR EX M 40,53 le 03/10 rangé (Alimentation)',
          de('CARAMELIO').montant === 42.5 && de('CARAMELIO').date === '2026-10-11' && de('CARAMELIO').aVerifier === true && de('CARAMELIO').compteId === CC
          && de('LA BONNE P CHE').date === '2026-10-06' && de('LA BONNE P CHE').aVerifier === true
          && de('CARREFOUR EX M').montant === 40.53 && de('CARREFOUR EX M').date === '2026-10-03' && de('CARREFOUR EX M').categorieId === alim && !de('CARREFOUR EX M').aVerifier, JSON.stringify(bq));
        const frais = bq.find(x => /^Frais bancaires/.test(x.libelle)) || {};
        v('  → les frais : UNE ligne « Frais bancaires · Bank Assafa » 17,60, hors de vos catégories de vie courante',
          frais.montant === 17.6 && frais.libelle === 'Frais bancaires · Bank Assafa' && frais.categorieId === 'cat_irr_depense_exceptionnelle' && frais.compteId === ASSAFA, JSON.stringify(frais));
        v('  → ni retrait, ni virement dans le journal ; le Marjane saisi à la main est lié à son opération',
          bq.length === 4 && !bq.some(x => /GAB|VIREMENT|vrt|virement/i.test(x.libelle)) && !!(t.find(x => x.id === 701) || {}).banqueHash, JSON.stringify(bq.map(x => x.libelle)));
        const p = await page.evaluate((ST) => { const st = eval(ST); const t = (n) => [...st.tachesPilotageToutes, ...st.entreesPilotageToutes].find(x => x.libelle === n) || {};
            return { villa: t('elect marrakech villa').regle, vir: t('Virement ASSAFA → Courant').paye, virs: st.tachesPilotageToutes.filter(x => x.nature === 'virement').map(x => [x.libelle, x.paye]), mag: [t('Loyer magasin').regle, t('Loyer magasin').paye] }; }, ST);
        v('  → Pilotage : « elect marrakech villa » 377,93 / 800 ; le virement 2 200 pointé ; « Loyer magasin » 5 000 reçu',
          p.villa === 377.93 && p.virs.length === 1 && p.virs[0][1] === true && p.mag[0] === 5000 && p.mag[1] === true, JSON.stringify(p));
        const reg = await page.evaluate((ST) => JSON.parse(JSON.stringify(eval(ST).donneesAnnuelles[2026].banqueOperations || {})), ST);
        const st = Object.values(reg).reduce((s, e) => { s[e.s] = (s[e.s] || 0) + 1; return s; }, {});
        v('  → 14 empreintes au registre : 3 ajoutées, 1 journal, 3 pilotage, 1 frais, 6 ignorées (+ l\'opération du 29/08)',
          Object.keys(reg).length === 14 && st.ajoutee === 3 && st.journal === 1 && st.pilotage === 3 && st.frais === 1 && st.ignoree === 6, JSON.stringify(st));
        const fin = await page.evaluate(() => document.querySelector('[data-import-fini]')?.textContent.replace(/\s+/g, ' ').trim());
        v('  → « ✓ Relevé appliqué » : 3 ajoutées dont 2 en suspens, 3 pointées, 3 soldes', /3 opération\(s\) ajoutée\(s\).*dont 2 en suspens/.test(fin || '') && /3 pointée\(s\)/.test(fin || '') && /3 solde\(s\)/.test(fin || ''), String(fin));
    });

    /* ── F. « À vérifier » ────────────────────────────────────────────── */
    await section('F', async () => {
        await page.evaluate(async (ST) => { const st = eval(ST); st.fermerImportBanque(); st.activeTab = 'saisie'; await new Promise(r => setTimeout(r, 300)); }, ST);
        await page.waitForFunction((ST) => Object.keys(eval(ST).iaCategorisation.enCours).length === 0, ST, { timeout: 15000 });
        await page.waitForTimeout(400);
        const t = await txs();
        const ids = ['CARAMELIO', 'LA BONNE P CHE'].map(l => (t.find(x => x.libelle === l) || {}).id);
        const l = await page.evaluate((ids) => ids.map(id => !!document.querySelector(`[data-a-categoriser-ligne][data-tx="${id}"]`)), ids);
        const src = await page.evaluate(() => [...document.querySelectorAll('tr')].filter(r => /CARAMELIO/.test(r.textContent)).map(r => r.textContent.replace(/\s+/g, ' ')).join(' | '));
        v('F. CARAMELIO et LA BONNE P CHE attendent dans « ⚠️ À vérifier » (un clic pour les ranger), source BANQUE au journal',
          l.every(Boolean) && t.filter(x => ids.includes(x.id)).every(x => x.aVerifier === true) && /banque/i.test(src), JSON.stringify([l, src.slice(0, 160)]));
        const cara = t.find(x => x.libelle === 'CARAMELIO') || {}, bonne = t.find(x => x.libelle === 'LA BONNE P CHE') || {};
        v('  → l\'IA, même sûre d\'elle, ne fait que PRÉ-REMPLIR : CARAMELIO → cafe Resto Wknd (IA), toujours en suspens ; l\'autre par défaut',
          !!idCafe && cara.categorieId === idCafe && cara.categorieSource === 'ia' && cara.aVerifier === true && bonne.categorieSource === 'défaut' && bonne.aVerifier === true, JSON.stringify([cara, bonne]));
    });

    /* ── G. Recoller : rien n'est refait ─────────────────────────────── */
    await section('G', async () => {
        const n0 = (await txs()).length;
        await page.evaluate((ST) => eval(ST).activeTab = 'tresorerie', ST);
        await ouvrir();
        //  Le même relevé, une ligne de plus (15 oct.), et une lettre lue de travers par l'OCR (CARAMELI0)
        const web2 = WEB.replace('CARAMELIO', 'CARAMELI0').replace('https:', '13\noct\nPAIEMENT CB 12/10/26 MAROC TELECOM\n- 120,00 MAD\n15\noct\nPAIEMENT CB 14/10/26 BIM MARRAKECH\n- 25,90 MAD\n'
            + '15\noct\nPAIEMENT CB 13/10/26 ACIMA\n- 61,20 MAD\n14\noct\nCOMMISSION SUR VIREMENT\n- 5,50 MAD\n14\noct\nFRAIS TENUE DE COMPTE\n- 10,00 MAD\n20\nsept\nPAIEMENT CB 18/09/26 SRM MARRAKECH\n- 300,00 MAD\nhttps:');
        //  Un « bim » saisi à la main le 11 : trois jours AVANT l'achat CB du 14, dans la tolérance (±4 j)
        await page.evaluate(async (ST) => { const st = eval(ST); st.donneesAnnuelles[2026].transactionsReelles.push({ id: 801, datetime: '2026-10-11T19:00', date: '2026-10-11', mois: 10, libelle: 'bim', montant: 26,
            categorieId: 'cat_cv_alimentation', compteId: 'acc_cc', source: 'manuel' }); st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 200)); }, ST);
        await deposer(['attijari_mobile.png', 'attijari_mobile.png', 'assafa_mobile.png', 'saham_mobile.png'], web2);
        const c = await caps();
        const nouvelles = c.flatMap(x => x.lignes.filter(l => !l.deja && !l.doublon));
        v('G. recollé le lendemain : aucune question, tout est reconnu (RIB, n°, empreinte)', c.every(x => x.compteId && (x.via === 'identifiant' || x.via === 'empreinte')), JSON.stringify(c.map(x => [x.format, x.via])));
        const nv = (debut) => nouvelles.find(l => l.lib.includes(debut)) || {};
        v('  → les 14 opérations déjà traitées (même « CARAMELI0 » mal lu) ; seules les 6 nouvelles sont proposées',
          nouvelles.length === 6 && c.flatMap(x => x.lignes).filter(l => l.deja).length === 14, JSON.stringify(nouvelles.map(l => [l.lib, l.action])));
        v('  → BIM 25,90 (CB du 14) : ✓ déjà au journal (« bim » 26 saisi le 11, trois jours avant)', nv('BIM MARRAKECH').action === 'deja:801', JSON.stringify(nv('BIM MARRAKECH')));
        v('  → MAROC TELECOM 120 : 📌 pointé sur « tel » (facture du Pilotage, même sans montant commun) — jamais au journal',
          /^pointer:Factures:/.test(nv('MAROC TELECOM').action), JSON.stringify(nv('MAROC TELECOM')));
        v('  → SRM 300 du 20 sept. (cycle précédent) : pas pointé sur « eau » 300 de CE cycle ; ACIMA ajouté (sûr)',
          nv('PAIEMENT CB 18/09/26 SRM').action === 'ajouter' && nv('ACIMA').action === 'ajouter' && nv('ACIMA').cat === 'sur', JSON.stringify([nv('PAIEMENT CB 18/09/26 SRM'), nv('ACIMA')]));
        v('  → la même capture déposée deux fois : la seconde marquée « déjà sur une autre capture »', c[2].lignes.length === 2 && c[2].lignes.every(l => l.doublon), JSON.stringify(c[2].lignes));
        //  Le solde « Mes comptes » plutôt que « Compte chèque »
        await page.evaluate(async ({ ST, CC }) => { const st = eval(ST); st.comptes.find(x => x.id === CC).soldeSuivi = 'mesComptes'; st.changerCompteCapture(st.importBanque.captures[1], CC); await new Promise(r => setTimeout(r, 100)); }, { ST, CC });
        v('  → Attijari : solde suivi « Mes comptes » → 4 318,35 proposé', (await caps())[1].solde === 4318.35, String((await caps())[1].solde));
        await page.click('[data-import-appliquer]'); await page.waitForTimeout(400);
        const t = await txs();
        const fr = t.find(x => /Attijariwafa Bank \(2 op\.\)/.test(x.libelle)) || {};
        v('  → appliqué : ACIMA, SRM de septembre et UNE ligne de frais (5,50 + 10 = 15,50) ; aucun doublon',
          t.length === n0 + 4 && t.filter(x => x.libelle === 'CARAMELIO' || x.libelle === 'CARAMELI0').length === 1 && !t.some(x => x.libelle === 'BIM MARRAKECH')
          && t.some(x => x.libelle === 'ACIMA') && fr.montant === 15.5 && fr.libelle === 'Frais bancaires · Attijariwafa Bank (2 op.)', JSON.stringify([n0, t.length, t.map(x => x.libelle)]));
        const tel = await page.evaluate((ST) => (eval(ST).tachesPilotageToutes.find(x => x.libelle === 'tel') || {}).regle, ST);
        v('  → « tel » : 120 réglés au Pilotage', tel === 120, String(tel));
        v('  → et le solde du Courant suit « Mes comptes » : 4 318', (await compte(CC)).solde === 4318, String((await compte(CC)).solde));
    });

    /* ── I. Un RIB n'appartient qu'à un compte ─────────────────────────── */
    await section('I', async () => {
        await page.evaluate((ST) => eval(ST).calibrerCompte('acc_lt', null, { identifiant: '7654321' }), ST);
        const [cc, lt] = [await compte(CC), await compte(LT)];
        v('I. associer 7654321 à « Épargne Long Terme » le retire du Compte Courant', (lt.identifiants || []).includes('7654321') && !(cc.identifiants || []).includes('7654321'), JSON.stringify([cc.identifiants, lt.identifiants]));
        await page.evaluate((ST) => eval(ST).calibrerCompte('acc_cc', null, { identifiant: '7654321' }), ST);
    });

    /* ── H. Ctrl+V ────────────────────────────────────────────────────── */
    await section('H', async () => {
        await ouvrir();
        const png = fs.readFileSync(path.join(BQ, 'assafa_mobile.png')).toString('base64');
        const r = await page.evaluate(async ({ ST, png }) => {
            const st = eval(ST);
            const bin = Uint8Array.from(atob(png), ch => ch.charCodeAt(0));
            const dt = new DataTransfer();
            dt.items.add(new File([bin], 'collée.png', { type: 'image/png' }));
            document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
            const dt2 = new DataTransfer(); dt2.setData('text/plain', 'Total des mouvements du 01/10/2026 au 14/10/2026');
            document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt2, bubbles: true, cancelable: true }));
            await new Promise(r => setTimeout(r, 200));
            return { n: st.importBanque.fichiers.length, nom: (st.importBanque.fichiers[0] || {}).nom, texte: st.importBanque.texte, vignettes: document.querySelectorAll('[data-import-vignette]').length };
        }, { ST, png });
        v('H. Ctrl+V d\'une capture : une vignette ; Ctrl+V d\'un texte : dans la zone de texte', r.n === 1 && r.nom === 'collée.png' && r.vignettes === 1 && /Total des mouvements/.test(r.texte), JSON.stringify(r));
        await page.evaluate((ST) => eval(ST).fermerImportBanque(), ST);
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
