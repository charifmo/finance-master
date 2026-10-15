/**
 * v37.55 — CALIBRER UNE FOIS, LE BON SOLDE TOUJOURS.
 *
 *   « Il ne voit pas le bon solde, il voit le total des soldes de mes comptes ! L'import se fait
 *   à chaque fois pour voir le RIB et le RIB n'est pas tout le temps affiché. Il faut un seul
 *   bouton pour calibrer le RIB. » — avec la capture « Détails du compte » d'Attijari Mobile.
 *
 *   Identité et RIB FICTIFS (clé juste) : banque/attijari_details.png (+ sa version 248 px,
 *   comme envoyée par une messagerie), banque/attijari_reel.png (l'accueil : « 000999B… »).
 *
 *     A. statique · B. le RIB et le n° (clé, lettre → chiffre, sosies OCR), l'écran « Détails du
 *     compte », le solde d'Attijari Mobile · C. le VRAI OCR : un bouton, une question, puis l'accueil
 *     reconnu sans question, le bon solde · D. téléphone.
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
console.log('\n  BANQUE : CALIBRER UNE FOIS, LE BON SOLDE TOUJOURS\n  ' + '─'.repeat(80));

/* ── A. Statique ─────────────────────────────────────────────────────── */
v('A. UN SEUL bouton « 🎯 Calibrer avec une capture » (plusieurs à la fois) ; plus de bouton par compte',
  (html.match(/data-calibrage-captures/g) || []).length === 1 && /accept="image\/\*" multiple class="hidden" data-calibrage-captures/.test(html) && !/data-calibrage-capture\b/.test(html));
v('  → le solde : plus aucun repli sur « Mes comptes » (le total) quand le « Compte chèque » n\'est pas lu',
  /c\.soldeSuivi === 'mesComptes' \? s\.mesComptes : \(s\.compteCheque \?\? s\.solde\)/.test(html) && !/s\.compteCheque \?\? s\.solde \?\? s\.mesComptes/.test(html));
v('  → « Mes comptes » est nommé pour ce qu\'il est : le TOTAL de vos comptes Attijari', /« Mes comptes » \(TOTAL de vos comptes Attijari\)/.test(html));
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

/* ── Le décor : vos 6 comptes, le Pilotage (factures, loyer, virement Assafa) ─ */
const CC = 'acc_cc', URGENCE = 1786532576196, ASSAFA = 1790780761917;
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
        { id: 'acc_lt', label: 'Épargne Long Terme', type: 'epargne', solde: 39000, icone: '🎯' },
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
            alimentation: V('Alimentation (Tqdya)', 0, 'semaine', [L('khdra', 200), L('Marjane ', 400)]),
            sorties: V('Sorties', 0, 'semaine', [L('cafe Resto Wknd', 400)]),
            voiture: V('Voiture', 0, 'semaine', [L('essence picanto', 300)]),
            sante: V('—', 0, 'semaine', []),
            factures: { ...V('Factures', 1399, 'mois', [L('elect', 200), L('elect marrakech villa', 800), L('tel', 99), L('eau', 300)]), categorieId: 'cat_cv_factures' },
        };
        d.epargne = []; d.depensesIrregulieres = []; d.consoRealiseeT0 = {};
        d.virementsInternes = an !== '2026' ? [] : [{ id: 9001, mois: 10, jourPrevu: 8, sourceCompte: 'cpt_' + ASSAFA, destinationCompte: 'courant', montant: 2200 }];
        d.transactionsReelles = [];
    }
    return fx;
};
const page0 = html
    .replace('<script src="https://unpkg.com/vue@3/dist/vue.global.js"', '<script src="/vue.js"')
    .replace('<script src="https://cdn.jsdelivr.net/npm/chart.js"', '<script src="/chart.js"')
    .replace(/<script src="https:\/\/cdn\.tailwindcss\.com"[^>]*><\/script>/, '')
    .replace(/<script[^>]*src="https:\/\/[^"]*"[^>]*><\/script>/g, '');
//  Le téléphone a besoin des vraies classes (positions des boutons flottants, largeurs) : Tailwind compilé si présent
const twBin = path.join(RACINE, 'node_modules/.bin/tailwindcss');
let twCss = '';
if (fs.existsSync(twBin)) {
    const { execFileSync } = await import('node:child_process');
    const tmp = fs.mkdtempSync(path.join((await import('node:os')).tmpdir(), 'tw-bq-'));
    fs.writeFileSync(path.join(tmp, 'in.css'), '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
    fs.writeFileSync(path.join(tmp, 'cfg.js'), 'module.exports={content:[' + JSON.stringify(path.join(RACINE, 'index.html')) + '],theme:{extend:{}}};');
    essai(() => execFileSync(twBin, ['-c', path.join(tmp, 'cfg.js'), '-i', path.join(tmp, 'in.css'), '-o', path.join(tmp, 'out.css'), '--minify'], { stdio: 'ignore' }));
    twCss = essai(() => fs.readFileSync(path.join(tmp, 'out.css'), 'utf8')) || '';
}
const TYPES = { '.js': 'text/javascript', '.gz': 'application/gzip', '.wasm': 'application/wasm' };
const srv = http.createServer((req, res) => {
    const p = req.url.split('?')[0];
    const s = (c, b, t = 'application/json') => { res.writeHead(c, { 'Content-Type': t }); res.end(b); };
    if (p === '/finance/') return s(200, twCss ? page0.replace('</head>', '<link rel="stylesheet" href="/tw.css"></head>') : page0, 'text/html; charset=utf-8');
    if (p === '/tw.css') return s(200, twCss, 'text/css');
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
const erreurs = [], externes = [];
const ouvrirPage = async (opts) => {
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    await page.clock.setFixedTime(new Date(2026, 9, 14, 10, 0, 0));
    page.on('pageerror', e => erreurs.push(String(e)));
    page.on('dialog', d => d.accept());
    page.on('request', r => { const u = r.url(); if (!u.startsWith('http://127.0.0.1') && !u.startsWith('blob:') && !u.startsWith('data:')) externes.push(u); });
    await page.route('**/webhook/**', route => route.abort());
    await page.goto(`http://127.0.0.1:${port}/finance/`, { waitUntil: 'load' });
    await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState.moisBudgetaire; }, null, { timeout: 30000 });
    await page.waitForTimeout(600);
    await page.evaluate(async (ST) => { const st = eval(ST); st.appMode = 'reel'; await new Promise(r => setTimeout(r, 250)); st.activeTab = 'saisie'; }, ST);
    await page.waitForTimeout(500);
    return page;
};
const page = await ouvrirPage({ viewport: { width: 1300, height: 1000 } });
const AUJ = 'new Date(2026, 9, 14)';
const analyser = (...textes) => page.evaluate(({ ST, textes, AUJ }) => { const st = eval(ST), a = eval(AUJ);
    return JSON.parse(JSON.stringify(textes.length > 1 ? st.bqAnalyserOCR(textes, { aujourdhui: a }) : st.bqAnalyser(textes[0], { aujourdhui: a }))); }, { ST, textes, AUJ });
const ops = (a) => a.operations.map(o => [o.dateOp, o.dateAchat || '', o.montant, o.libelle].join(' | '));
const classer = (libelle, montant) => page.evaluate(({ ST, libelle, montant }) => eval(ST).bqClasser({ libelle, montant }), { ST, libelle, montant });
const compte = (id) => page.evaluate(({ ST, id }) => JSON.parse(JSON.stringify(eval(ST).comptes.find(c => String(c.id) === String(id)))), { ST, id });
const RIB = '007450000999200012345615';        // fictif, clé 15 juste ; n° à l'écran : 000999B000123456
const ACCUEIL = (cheque) => `Bienvenue KARIM TESTEUR
Mes comptes ©
4 318,35 DH
Compte chèque
Compte chèque
000999B000123456
${cheque}
Dernières Opérations  Voir plus
Paiement SRM Marrakech-Safi
©  14 oct. 2026  -377,93 DH`;
const DETAILS = (num, rib) => `09:11  4G 77
<  Détails du compte
Compte chèque
4 213,32 DH
Agence
MARRAKECH GUELIZ
Nature
Compte chèque
Intitulé
M TESTEUR KARIM
N° de compte
${num}
RIB
${rib}
Solde
4 213,32 DH
Payer mes  Effectuer un
factures et rech.  virement`;

try {
    /* ── B. Le RIB, le n°, l'écran « Détails du compte », le solde ─────── */
    await section('B', async () => {
        const r = await page.evaluate(({ ST, RIB }) => { const st = eval(ST);
            return [st.bqRibValide(RIB), st.bqRibValide(RIB.slice(0, 22) + '16'), st.bqRibValide('007 450 0009992000123456 15'),
                    st.bqMemeCompte('000999B000123456', RIB), st.bqMemeCompte('0009998000123456', RIB), st.bqMemeCompte('000999E000123456', RIB),
                    st.bqMemeCompte('000999B000123457', RIB), st.bqMemeCompte('000999B000123456', '0009998000123456'), st.bqMemeCompte('000999B000123456', '000999E000123456')]; }, { ST, RIB });
        v('B. un RIB marocain : clé de contrôle vérifiée (97 − 22 premiers chiffres × 100 mod 97), espaces tolérés',
          r[0] === true && r[1] === false && r[2] === true, JSON.stringify(r));
        v('  → « 000999B000123456 » (accueil) = le RIB « … 0009992000123456 … » : le B devient 2 ; « 8 » lu pour « B » aussi',
          r[3] === true && r[4] === true, JSON.stringify(r));
        v('  → mais pas un autre compte : « …E… » (épargne, E → 5) ni un chiffre de différence ; n° ↔ n° aux sosies près',
          r[5] === false && r[6] === false && r[7] === true && r[8] === false, JSON.stringify(r));
        const d = await analyser(DETAILS('000999B000123456', RIB));
        v('  → « Détails du compte » : Attijari (code 007 du RIB), RIB + n°, « compte chèque », solde 4 213,32, AUCUNE opération',
          d.format === 'details' && d.banque === 'attijari' && JSON.stringify(d.identifiants) === JSON.stringify([RIB, '000999B000123456'])
          && d.signature === 'attijari|compte cheque' && d.soldes.compteCheque === 4213.32 && d.operations.length === 0, JSON.stringify(d));
        const d2 = await analyser(DETAILS('000999B000123486', RIB));
        v('  → un n° abîmé par l\'OCR (« …23486 ») n\'est PAS retenu : le RIB, à clé juste, fait foi',
          JSON.stringify(d2.identifiants) === JSON.stringify([RIB]), JSON.stringify(d2.identifiants));
        const a = await analyser(ACCUEIL('4 213,32 DH'));
        v('  → accueil Attijari : « Mes comptes » 4 318,35 (le total) et « Compte chèque » 4 213,32, chacun à sa place',
          a.soldes.mesComptes === 4318.35 && a.soldes.compteCheque === 4213.32 && a.soldes.solde == null && a.identifiants.includes('000999B000123456'), JSON.stringify([a.soldes, a.identifiants]));
        const a2 = await analyser(ACCUEIL('4 213,³²'));
        v('  → « Compte chèque » illisible : son solde reste VIDE — jamais le total « Mes comptes » à sa place',
          a2.soldes.mesComptes === 4318.35 && a2.soldes.compteCheque == null && a2.soldes.solde == null, JSON.stringify(a2.soldes));
        const n = await analyser(ACCUEIL('4 213,32 DH').replace('000999B000123456', '0009998000123456'));
        v('  → le n° lu tout en chiffres (« 0009998… », le B lu 8) est bien pris pour un n° de compte', n.identifiants.includes('0009998000123456'), JSON.stringify(n.identifiants));
        const perdu = await analyser('Bienvenue KARIM TESTEUR\n4 318,35 DH\nCompte chèque\nCompte chèque\n000999B000123456\n4 213,³²\nDernières Opérations  Voir plus\nPaiement SRM Marrakech-Safi\n©  14 oct. 2026  -377,93 DH');
        v('  → le libellé « Mes comptes » perdu par l\'OCR : son montant (le total) n\'est jamais pris pour le solde du compte',
          perdu.format === 'attijari_mobile' && perdu.soldes.compteCheque == null && perdu.soldes.solde == null, JSON.stringify(perdu.soldes));
        const sansLib = await analyser('Mes comptes ©\n4 318,35 DH\n4 213,32 DH\nDernières Opérations  Voir plus\nPaiement SRM Marrakech-Safi\n©  14 oct. 2026  -377,93 DH');
        v('  → le libellé « Compte chèque » perdu : le montant qui suit le total est bien le solde du compte',
          sansLib.soldes.mesComptes === 4318.35 && sansLib.soldes.compteCheque === 4213.32, JSON.stringify(sansLib.soldes));
        const parCode = await analyser('362 780 0001112223334445 78\nSolde disponible\n1 234,56 DH\nDernières opérations\n08/10/2026  -10,00\nRecharge');
        v('  → une banque que seul le RIB trahit (code 362 = Bank Assafa) : reconnue par le code de son RIB',
          parCode.banque === 'assafa', JSON.stringify([parCode.banque, parCode.identifiants]));
        const cb = await analyser('Mes comptes\n4 318,35 DH\nCompte chèque\n4 213,32 DH\nDernières Opérations  Voir plus\n(a)  PAIEMENT CB 141026 MARJANE  -126,60 DH\n14 oct. 2026');
        v('  → « PAIEMENT CB 141026 » : la date d\'achat lue sans séparateurs ; « (a) » (une icône) écarté',
          cb.operations.length === 1 && cb.operations[0].dateAchat === '2026-10-14' && cb.operations[0].libelle === 'PAIEMENT CB 141026 MARJANE', JSON.stringify(ops(cb)));
    });

    /* ── C. Le VRAI OCR : un bouton, une question, puis plus jamais ─────── */
    await section('C', async () => {
        await page.evaluate(async (ST) => { eval(ST).activeTab = 'tresorerie'; await new Promise(r => setTimeout(r, 300)); }, ST);
        await page.setInputFiles('[data-calibrage-captures]', path.join(BQ, 'attijari_details_whatsapp.png'));
        await page.waitForFunction((ST) => { const c = eval(ST).calibrageBanque; return !c.enCours && (c.attente.length || c.resultats.length); }, ST, { timeout: 120000 });
        const q = await page.evaluate(() => [...document.querySelectorAll('[data-calibrage-attente]')].map(e => e.textContent.replace(/\s+/g, ' ').trim()));
        v('C. 🎯 la capture « Détails du compte » (248 px, comme envoyée par WhatsApp) : « 🆕 Attijariwafa Bank · RIB… — à quel compte ? »',
          q.length === 1 && /Attijariwafa Bank · 007 450 0009992000123456 15/.test(q[0]), JSON.stringify(q));
        await page.selectOption('[data-calibrage-attente] [data-calibrage-reponse]', CC);
        await page.click('[data-calibrage-attente] [data-calibrage-associer]');
        await page.waitForTimeout(200);
        const cc = await compte(CC);
        const res = await page.evaluate(() => [...document.querySelectorAll('[data-calibrage-resultat]')].map(e => e.textContent.trim()));
        v('  → « Associer pour toujours » : le Compte Courant garde le RIB ET le n°, banque Attijari',
          cc.banque === 'attijari' && (cc.identifiants || []).includes(RIB) && (cc.identifiants || []).includes('000999B000123456') && /✓ Compte Courant : Attijariwafa Bank/.test(res.join(' ')),
          JSON.stringify([cc.banque, cc.identifiants, res]));
        //  Une autre fois : la même capture → reconnue, aucune question
        await page.setInputFiles('[data-calibrage-captures]', path.join(BQ, 'attijari_details.png'));
        await page.waitForFunction((ST) => { const c = eval(ST).calibrageBanque; return !c.enCours && c.resultats.length; }, ST, { timeout: 120000 });
        const re = await page.evaluate((ST) => [eval(ST).calibrageBanque.attente.length, eval(ST).calibrageBanque.resultats.map(r => r.texte)], ST);
        v('  → recalibrer avec la même capture : reconnue d\'emblée (aucune question)', re[0] === 0 && /✓ Compte Courant/.test(re[1].join(' ')), JSON.stringify(re));
        //  L'import de l'ACCUEIL (« 000999B… », pas de RIB à l'écran) : reconnu par le RIB calibré
        await page.evaluate((ST) => eval(ST).ouvrirImportBanque(), ST); await page.waitForTimeout(200);
        await page.setInputFiles('[data-import-fichiers]', [path.join(BQ, 'attijari_reel.png')]);
        await page.click('[data-import-analyser]');
        await page.waitForFunction((ST) => { const s = eval(ST).importBanque; return s.etape === 'revue' || (s.etape === 'depot' && !s.enCours); }, ST, { timeout: 180000 });
        await page.waitForTimeout(300);
        const cap = await page.evaluate((ST) => { const c = eval(ST).importBanque.captures[0]; return JSON.parse(JSON.stringify({ compteId: c.compteId, via: c.via, question: c.question, solde: c.soldeChoisi, ids: c.analyse.identifiants })); }, ST);
        v('  → l\'accueil Attijari (n° « 000999B… », aucun RIB à l\'écran) : reconnu « Compte Courant » SANS question',
          cap.compteId === CC && cap.via === 'identifiant' && !cap.question, JSON.stringify(cap));
        v('  → et le solde proposé est celui du COMPTE CHÈQUE, 4 213,32 — pas le total « Mes comptes » 4 318,35', cap.solde === 4213.32, JSON.stringify(cap));
        await page.evaluate((ST) => eval(ST).fermerImportBanque(), ST);
        //  « Compte chèque » illisible : rien plutôt que le total
        await page.evaluate((ST) => eval(ST).ouvrirImportBanque(), ST); await page.waitForTimeout(200);
        await page.fill('[data-import-texte]', ACCUEIL('4 213,³²'));
        await page.click('[data-import-analyser]');
        await page.waitForFunction((ST) => eval(ST).importBanque.etape === 'revue', ST, { timeout: 60000 }); await page.waitForTimeout(300);
        const ill = await page.evaluate((ST) => { const c = eval(ST).importBanque.captures[0]; return [c.compteId, c.soldeChoisi, c.appliquerSolde, (document.querySelector('[data-import-solde-illisible]') || {}).textContent || '', !!document.querySelector('[data-import-solde]')]; }, ST);
        v('  → « Compte chèque » illisible : AUCUN solde proposé, et c\'est dit (« illisible… le total n\'est jamais pris à sa place »)',
          ill[0] === CC && ill[1] == null && ill[2] === false && /illisible/.test(ill[3]) && /jamais pris à sa place/.test(ill[3]) && ill[4] === false, JSON.stringify(ill));
        await page.evaluate((ST) => eval(ST).fermerImportBanque(), ST);
        //  Le solde « Mes comptes » quand on l'a choisi, lui seulement
        await page.evaluate(({ ST, CC }) => { eval(ST).comptes.find(c => c.id === CC).soldeSuivi = 'mesComptes'; }, { ST, CC });
        await page.evaluate((ST) => eval(ST).ouvrirImportBanque(), ST); await page.waitForTimeout(200);
        await page.fill('[data-import-texte]', ACCUEIL('4 213,32 DH'));
        await page.click('[data-import-analyser]');
        await page.waitForFunction((ST) => eval(ST).importBanque.etape === 'revue', ST, { timeout: 60000 }); await page.waitForTimeout(300);
        const mc = await page.evaluate((ST) => eval(ST).importBanque.captures[0].soldeChoisi, ST);
        v('  → « Solde suivi : Mes comptes » choisi exprès : alors, et alors seulement, le total 4 318,35', mc === 4318.35, JSON.stringify(mc));
        await page.evaluate(({ ST, CC }) => { eval(ST).fermerImportBanque(); delete eval(ST).comptes.find(c => c.id === CC).soldeSuivi; }, { ST, CC });
        //  « Détails du compte » dans l'import : son solde, aucune opération
        await page.evaluate((ST) => eval(ST).ouvrirImportBanque(), ST); await page.waitForTimeout(200);
        await page.fill('[data-import-texte]', DETAILS('000999B000123456', RIB));
        await page.click('[data-import-analyser]');
        await page.waitForFunction((ST) => eval(ST).importBanque.etape === 'revue', ST, { timeout: 60000 }); await page.waitForTimeout(300);
        const dt = await page.evaluate((ST) => { const c = eval(ST).importBanque.captures[0]; return [c.compteId, c.soldeChoisi, (c.lignes || []).length]; }, ST);
        v('  → « Détails du compte » importé : reconnu, solde 4 213,32 proposé, aucune opération inventée', dt[0] === CC && dt[1] === 4213.32 && dt[2] === 0, JSON.stringify(dt));
        await page.evaluate((ST) => eval(ST).fermerImportBanque(), ST);
        v('  → tout sur place : aucune requête hors du serveur', externes.length === 0, JSON.stringify(externes.slice(0, 3)));
    });

    /* ── D. Le téléphone ──────────────────────────────────────────────── */
    await section('D', async () => {
        const tel = await ouvrirPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
        await tel.evaluate(async (ST) => { eval(ST).activeTab = 'tresorerie'; await new Promise(r => setTimeout(r, 400)); }, ST);
        await tel.evaluate(() => document.querySelector('[data-calibrage-bouton]').scrollIntoView({ block: 'center' }));
        const b = await tel.evaluate(() => { const r = document.querySelector('[data-calibrage-bouton]').getBoundingClientRect(); return [r.width, r.left, r.right, window.innerWidth, document.documentElement.scrollWidth]; });
        v('D. téléphone 390 px : le bouton « 🎯 Calibrer avec une capture » se voit et tient dans l\'écran', b[0] > 100 && b[1] >= 0 && b[2] <= b[3] && b[4] <= 390, JSON.stringify(b));
        await tel.setInputFiles('[data-calibrage-captures]', path.join(BQ, 'attijari_details_whatsapp.png'));
        await tel.waitForFunction((ST) => { const c = eval(ST).calibrageBanque; return !c.enCours && (c.attente.length || c.resultats.length); }, ST, { timeout: 120000 });
        const sw = await tel.evaluate(() => [document.documentElement.scrollWidth, document.querySelectorAll('[data-calibrage-attente]').length]);
        v('  → la question « à quel compte ? » s\'affiche dans l\'écran du téléphone, sans débordement', sw[0] <= 390 && sw[1] === 1, JSON.stringify(sw));
    });

    v('aucune erreur JavaScript', erreurs.length === 0, erreurs.slice(0, 3).join(' | '));
} finally {
    await browser.close();
    srv.close();
}
console.log('  ' + '─'.repeat(80));
console.log(ko === 0 ? '  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
