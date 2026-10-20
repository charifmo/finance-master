/**
 * v37.54 — LES VRAIES CAPTURES, ET LE TÉLÉPHONE D'ABORD.
 *
 *   « Vérifie que l'upload se fera principalement via mobile. »
 *
 *   Les vraies captures (Saham en thème sombre, Bank Assafa, Attijari Mobile) et une capture PC
 *   d'Attijarinet, reproduites fidèlement en pleine résolution avec une identité fictive
 *   (banque/*_reel.png, banque/attijarinet_pc.png) — aucune donnée réelle dans ce dépôt public.
 *   Mercredi 14 oct. 2026, paie le 27.
 *
 *     A. statique (galerie, ➕, boutons flottants, RIB fictifs) · B. le parseur sur les textes que
 *     l'OCR rend vraiment (exposants, icônes, menus, jour illisible, mots collés) · C. le VRAI OCR
 *     sur les 4 captures, puis les propositions · D. le téléphone : le ➕, la galerie, la revue à
 *     390 px, une photo illisible.
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
console.log('\n  BANQUE : VRAIES CAPTURES, TÉLÉPHONE D\'ABORD\n  ' + '─'.repeat(80));

/* ── A. Statique ─────────────────────────────────────────────────────── */
v('A. le sélecteur ouvre la GALERIE du téléphone : image/* seul, plusieurs à la fois ; le texte / CSV a son propre bouton',
  /<input type="file" accept="image\/\*" multiple class="hidden" data-import-fichiers/.test(html)
  && /accept="\.txt,\.csv,text\/plain,text\/csv" class="hidden" data-import-fichier-texte/.test(html));
v('  → « 🏦 Importer mes captures bancaires » dans la saisie rapide (le ➕ flottant)',
  /data-import-ouvrir-rapide @click="closeSaisieQuickModal\(\); ouvrirImportBanque\(\)"/.test(html));
v('  → rien n\'est posé sur le ➕ : v37.62, plus de 🪄 ni de 💾 flottants au téléphone (« laisse juste brain, journal et + »)',
  !/'bottom-20 left-4 w-12 h-12 text-xl'/.test(html) && !/'bottom-20 right-4 w-12 h-12 text-xl'/.test(html) && !/fixed bottom-\[8\.5rem\] left-4 z-50 bg-purple-600/.test(html)
  && /data-flottant="saisie"\s+class="fixed bottom-20 right-4/.test(html));
v('  → 📑 🧠 masqués pendant la saisie rapide et l\'import (ils couvraient Montant, Catégorie, Libellé)',
  (html.match(/v-if="isMobile && !showSaisieQuickModal && !importBanque\.ouvert"/g) || []).length === 2);
v('  → l\'OCR : thème sombre (canal clair inversé), centimes relus trois fois, 3e lecture « en-tête » si aucun solde',
  /const _ecranSombre = /.test(html) && /mode === 'max'/.test(html) && /for \(const \[dx, k\] of \[\[3, 2\], \[0, 2\], \[3, 3\]\]\)/.test(html) && /textes\.enTete = 2/.test(html));
//  Dépôt PUBLIC : tout RIB écrit dans l'appli et les fixtures est fictif
const RIBS_FICTIFS = ['007 450 0001234567890123 45', '190 780 2100345600071234 52'];
const ribsDe = (s) => s.match(/\b\d{3} \d{3} \d{16} \d{2}\b/g) || [];
const fixtures = fs.readdirSync(BQ).filter(f => /\.(html|txt)$/.test(f)).map(f => fs.readFileSync(path.join(BQ, f), 'utf8')).join('\n');
v('  → dépôt public : les seuls RIB écrits (appli, fixtures) sont fictifs ; identité « KARIM TESTEUR »',
  [...ribsDe(html), ...ribsDe(fixtures)].every(r => RIBS_FICTIFS.includes(r)) && ribsDe(html).length >= 1 && /KARIM TESTEUR/.test(fixtures)
  && (html.match(/\b\d{24}\b/g) || []).every(x => x === '007450000123456789012345'), JSON.stringify([...new Set([...ribsDe(html), ...ribsDe(fixtures)])]));

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

//  Ce que l'OCR a VRAIMENT rendu de la capture PC (deux lectures : « pis » pour 08, « a » pour 07)
const PC = (j08, j07b) => `attijarinet.attijariwafa.com/particulier/consultation/compte/7654321/operation?tempsreel=true
Mon compte  formation  Diriger des personnes  France-Visas  Adobe Acrobat
DÉBIT /  CRÉDIT /  AUJOURD'HUI /  HIER /  CETTE SEMAINE /  CE MOIS /  MOIS DERNIER /  90 DERNIERS JOURS /  RECHERCHE AVANCÉE
Total des mouvements du 15.07.2026 au 14.10.2026  DÉBIT : 12 600,83 MAD CRÉDIT : 13 229,57 MAD
OCTOBRE 2026
14  |  AWBGAB MARRAKECH E 14 10 09H01(*)  - 1.000,00 Man
13  |  PAIEMENT CB 11/10/26 CARAMELIO  - 42,50 MAD
${j08}  |  PAIEMENT CB 06/10/26 LA BONNE P CHE  - 270,00 Man
07  |  PAIEMENT CB 03/10/26 CARREFOUR EX M  - 40,53 MAD
${j07b}  |  PAIEMENT CB 04/10/26 MARJ MENARA G  - 33,73 MAD
07  |  MARRAKECH ENNAKHIL 07/10 08H08  - 4 500,00 MAD
oct
12:53
14/10/2026`;
const PC_ATTENDU = ['2026-10-14 | 2026-10-14 | -1000 | AWBGAB MARRAKECH E 14 10 09H01', '2026-10-13 | 2026-10-11 | -42.5 | PAIEMENT CB 11/10/26 CARAMELIO',
    '2026-10-08 | 2026-10-06 | -270 | PAIEMENT CB 06/10/26 LA BONNE P CHE', '2026-10-07 | 2026-10-03 | -40.53 | PAIEMENT CB 03/10/26 CARREFOUR EX M',
    '2026-10-07 | 2026-10-04 | -33.73 | PAIEMENT CB 04/10/26 MARJ MENARA G', '2026-10-07 | 2026-10-07 | -4500 | MARRAKECH ENNAKHIL 07/10 08H08'];
const ATTIJARI_MOBILE = `13:06  4G 66
Bienvenue KARIM TESTEUR  à
Mes comptes ©
4 318,35 DH
Compte chèque
Compte chèque
000999B000123456
4 213,32 DH PH
Dernières Opérations  Voir plus
Paiement SRM Marrakech-Safi
©  14 oct. 2026  -377,93 DH
GAB BANK ASSAFA S 13 10 …
©  13 oct. 2026  -1 500,00 DH
Attijari Travel
Réservez votre séjour idéal en quelques
clics et profitez d'offres exclusives.
Découvrir les offres
Accueil  Comptes  ®  Cartes  Menu`;
//  Bank Assafa, telle que l'OCR la lit : icônes (« °) », « — Pre », « Qi O “ LS »), barre de menu, « ok » passé à la ligne
const ASSAFA_OCR = `= = PP
190 780 2100345600071234 52
9 101,35 Dhs ©  ‘
VOS DERNIÈRES OPÉRATIONS  NN
08 Octobre  - 17,60 DH P**
2
Com - VIR INST #16110487 , box
08 Octobre  - 2 200,00 DH DH °"*
°)   VIREMENT EMIS EN FAVEUR
DE TESTEUR Karim
attijari box
08 Octobre  - 17,60 "**
Com - VIR INST #16109985 , ok
08 Octobre  - 1 200,00 ""
=   VIREMENT EMIS EN FAVEUR
DE TESTEUR Karim attijari
ok
04 Octobre  - 2 100,00 DH °**
— Pre
æ  :  E
VIREMENTS  PAIEMENTS  RECHARGES  RIB
ll  O  <  x
Qi  O  “  LS`;
const SAHAM = (j29) => `BONJOUR KARIM TESTEUR +
CONTENT DE VOUS REVOIR !
COMPTE  CARTE
Compte chèque dirhams
5 174,09 DH [_ )
Envoyer  Payer  RIB  Plus
TRANSACTIONS RÉCENTES
|  sp Emission d'un virement mobile tiers … -4 900,00 "*
05/10/2026
|  Î Reception vrt instantane n : 269890 .…. +5 000,00 ""
04/10/2026
|  st&p Reception vrt instantane n : 268271 > +5 000,00 DH DH
01/10/2026
| Emission vrt instantane n 174182 en … -6 000,00 ph
${j29}
Voir plus >
Pensez à réserver vos dotations
ACCUEIL  VIREMENT  LIFESTYLE  AUTRES`;

try {
    /* ── B. Le parseur, sur ce que l'OCR rend vraiment ─────────────────── */
    await section('B', async () => {
        const at = await analyser(ATTIJARI_MOBILE);
        v('B. Attijari Mobile : « Mes comptes » 4 318,35 et « Compte chèque » 4 213,32 (« DH PH » en exposant avalé)',
          at.banque === 'attijari' && at.soldes.mesComptes === 4318.35 && at.soldes.compteCheque === 4213.32 && JSON.stringify(at.identifiants) === '["000999B000123456"]',
          JSON.stringify([at.soldes, at.identifiants]));
        v('  → « libellé puis date » malgré la publicité sous la liste : SRM 377,93 le 14, GAB 1 500 le 13',
          JSON.stringify(ops(at)) === JSON.stringify(['2026-10-14 |  | -377.93 | Paiement SRM Marrakech-Safi', '2026-10-13 |  | -1500 | GAB BANK ASSAFA S 13 10']), JSON.stringify(ops(at)));
        const pc = await analyser(PC('08', '07'));
        v('  → Attijarinet en capture PC : le jour seul dans sa colonne prend le mois de « OCTOBRE 2026 »',
          pc.format === 'attijari_web' && JSON.stringify(ops(pc)) === JSON.stringify(PC_ATTENDU), JSON.stringify(ops(pc)));
        v('  → n° 7654321 de l\'URL ; DÉBIT 12 600,83 de la période ; ni l\'URL ni la barre de favoris pour intitulé',
          JSON.stringify(pc.identifiants) === '["7654321"]' && pc.totaux.debit === 12600.83 && pc.intitule === '', JSON.stringify([pc.identifiants, pc.totaux, pc.intitule]));
        const fus = await analyser(PC('pis', '07'), PC('08', 'a'));
        v('  → un jour illisible (« pis », « a ») : l\'opération garde sa place, sa date vient de l\'autre lecture',
          JSON.stringify(ops(fus)) === JSON.stringify(PC_ATTENDU), JSON.stringify(ops(fus)));
        const seul = await analyser(PC('pis', '07'));
        v('  → seule, la lecture « pis » ne colle pas LA BONNE P CHE à CARAMELIO : 6 opérations, chacune son montant',
          seul.operations.length === 6 && seul.operations.every(o => /^-?\d+(\.\d+)?$/.test(String(o.montant))) && (seul.operations.find(o => /BONNE/.test(o.libelle)) || {}).montant === -270,
          JSON.stringify(ops(seul)));
        v('  → « MARRAKECH ENNAKHIL 07/10 08H08 » (lieu, date, heure, pas de CB) = un retrait ; « PAIEMENT CB … » non',
          await classer('MARRAKECH ENNAKHIL 07/10 08H08', -4500) === 'gab' && await classer('PAIEMENT CB 04/10/26 MARJ MENARA G', -33.73) === 'achat');
        const scr = await analyser('Mes comptes ©\n4 318,35 DH\nDernières Opérations  Voir plus\n©  14 oct. 2026  -377,93 DH\nGAB BANK ASSAFA S 13 10 …\n©  13 oct. 2026  -1 500,00 DH\nAttijari Travel\nRéservez votre séjour idéal en quelques\nDécouvrir les offres');
        v('  → Attijari Mobile capturé au milieu d\'une opération (son libellé au-dessus de l\'écran) : elle est laissée, GAB garde SA date',
          scr.format === 'attijari_mobile' && JSON.stringify(ops(scr)) === JSON.stringify(['2026-10-13 |  | -1500 | GAB BANK ASSAFA S 13 10']), JSON.stringify([scr.format, ops(scr)]));
        const inc = await analyser('MA BANQUE EN LIGNE\nSolde au 14/10 : 2 345,67\nHistorique des opérations\nPaiement Glovo\n12/10/2026  -85,00\nPaiement Jumia\n11/10/2026  -240,00\nDécouvrez nos offres\nprofitez de nos services en ligne');
        v('  → une banque inconnue, « libellé puis date », une publicité sous la liste : l\'ordre est deviné juste',
          inc.format === 'inconnu' && JSON.stringify(ops(inc)) === JSON.stringify(['2026-10-12 |  | -85 | Paiement Glovo', '2026-10-11 |  | -240 | Paiement Jumia']), JSON.stringify([inc.format, ops(inc)]));
        const T = 'Total des mouvements du 01/10/2026 au 14/10/2026  DÉBIT : 57,50 MAD CRÉDIT : 0,00 MAD\nOCTOBRE 2026\n';
        const fr = await analyser(T + '13  |  PAIEMENT CB 11/10/26 CARAMELIO  - 42,50 MAD\npis  |  FRAIS TENUE DE COMPTE  - 15,00 MAD',
                                  T + '13  |  PAIEMENT CB 11/10/26 CARAMELIO  - 42,5O MAD\n06  |  FRAIS TENUE DE COMPTE  - 15,00 MAD');
        const frais = fr.operations.find(o => o.montant === -15) || {};
        v('  → jour illisible et aucune date d\'achat dans le libellé (frais) : la date vient de l\'autre lecture',
          frais.dateOp === '2026-10-06' && frais.date === '2026-10-06' && !frais.sansDateOp && fr.operations.length === 2, JSON.stringify(ops(fr)));
        const as = await analyser(ASSAFA_OCR);
        v('  → Bank Assafa : RIB, solde 9 101,35 ; l\'opération du 04/10 sans libellé (coupée) est laissée',
          JSON.stringify(as.identifiants) === '["190780210034560007123452"]' && as.soldes.solde === 9101.35 && as.operations.length === 4 && !as.operations.some(o => o.montant === -2100),
          JSON.stringify([as.identifiants, as.soldes, ops(as)]));
        v('  → icônes et barre de menu écartées (« °) », « — Pre », « ll O < x », « Qi O “ LS ») ; « ok » passé à la ligne rendu au libellé',
          JSON.stringify(as.operations.map(o => o.libelle)) === JSON.stringify(['Com - VIR INST #16110487 , box', 'VIREMENT EMIS EN FAVEUR DE TESTEUR Karim attijari box',
              'Com - VIR INST #16109985 , ok', 'VIREMENT EMIS EN FAVEUR DE TESTEUR Karim attijari ok']), JSON.stringify(as.operations.map(o => o.libelle)));
        const sa = await analyser(SAHAM('29/08/2026'));
        v('  → Saham : « compte chèque dirhams » (pas « COMPTE CARTE »), 5 174,09, 4 opérations ; « ph », « ""° », « sp », « Î », « > » écartés',
          sa.signature === 'saham|compte cheque dirhams' && sa.soldes.compteCheque === 5174.09
          && JSON.stringify(ops(sa)) === JSON.stringify(['2026-10-05 |  | -4900 | Emission d\'un virement mobile tiers', '2026-10-04 |  | 5000 | Reception vrt instantane n : 269890',
              '2026-10-01 |  | 5000 | Reception vrt instantane n : 268271', '2026-08-29 |  | -6000 | Emission vrt instantane n 174182 en']), JSON.stringify([sa.signature, sa.soldes, ops(sa)]));
        const sa2 = await analyser(SAHAM('9/08/2026'), SAHAM('29/08/2026'));
        v('  → deux lectures, « 9/08 » et « 29/08 » : UNE opération, le 29/08 (le chiffre perdu ne crée pas de doublon)',
          JSON.stringify(sa2.operations.filter(o => o.montant === -6000).map(o => o.dateOp)) === '["2026-08-29"]' && sa2.operations.length === 4, JSON.stringify(ops(sa2)));
        v('  → mots collés par l\'OCR (« Emission vrtinstantane n174182enfaveur ») : toujours un VIREMENT, jamais une dépense',
          await classer('Emission vrtinstantane n174182enfaveur', -6000) === 'virement' && await classer('Reception vrtinstantane n:268271delap', 5000) === 'virement'
          && await classer('Emission d\'un virement mobile tiers saha', -4900) === 'virement' && await classer('Com - VIR INST #16110487 , box', -17.6) === 'frais');
        const proche = await page.evaluate((ST) => { const st = eval(ST);
            return [st.bqLibProche('paiementcb111026caramelio', 'paiementcb111026carameli0'), st.bqLibProche('receptionvrtinstantanen269890', 'emissionvrtinstantanen174182'),
                    st.bqLibProche('paiemcntcb111026caramelio', 'paiementcb111026caramelio')]; }, ST);
        v('  → l\'anti-doublon tolère une lettre lue de travers (« CARAMELI0 », « PAIEMCNT »), pas un autre libellé',
          proche[0] === true && proche[1] === false && proche[2] === true, JSON.stringify(proche));
    });

    /* ── C. Le VRAI OCR, sur les 4 captures pleine résolution ───────────── */
    await section('C', async () => {
        await page.evaluate((ST) => eval(ST).ouvrirImportBanque(), ST); await page.waitForTimeout(200);
        const F = ['saham_reel.png', 'assafa_reel.png', 'attijari_reel.png', 'attijarinet_pc.png'];
        await page.setInputFiles('[data-import-fichiers]', F.map(f => path.join(BQ, f)));
        const t0 = Date.now();
        await page.click('[data-import-analyser]');
        await page.waitForFunction((ST) => { const s = eval(ST).importBanque; return s.etape === 'revue' || (s.etape === 'depot' && !s.enCours); }, ST, { timeout: 300000 });
        const duree = (Date.now() - t0) / 1000;
        await page.waitForTimeout(300);
        const caps = await page.evaluate((ST) => JSON.parse(JSON.stringify(eval(ST).importBanque.captures.map(c => ({ source: c.source, a: c.analyse, question: c.question, compteId: c.compteId })))), ST);
        const cap = (s) => (caps.find(c => c.source === s) || {}).a || { operations: [], soldes: {}, identifiants: [] };
        const sa = cap('saham_reel.png'), as = cap('assafa_reel.png'), at = cap('attijari_reel.png'), pc = cap('attijarinet_pc.png');
        v('C. Saham, thème SOMBRE : montants verts ET dates grises lus — 4 opérations exactes, solde 5 174,09',
          sa.banque === 'saham' && sa.soldes.compteCheque === 5174.09 && JSON.stringify(sa.operations.map(o => [o.dateOp, o.montant])) === '[["2026-10-05",-4900],["2026-10-04",5000],["2026-10-01",5000],["2026-08-29",-6000]]'
          && sa.operations.every(o => !/DH|\.$|ONVAKO/.test(o.libelle)), JSON.stringify([sa.soldes, sa.operations.map(o => [o.dateOp, o.montant, o.libelle])]));
        v('  → Bank Assafa : RIB, solde 9 101,35, les 2 frais et les 2 virements, rien de la barre du bas',
          JSON.stringify(as.identifiants) === '["190780210034560007123452"]' && as.soldes.solde === 9101.35
          && JSON.stringify(as.operations.map(o => [o.dateOp, o.montant])) === '[["2026-10-08",-17.6],["2026-10-08",-2200],["2026-10-08",-17.6],["2026-10-08",-1200]]'
          && as.operations.every(o => !/RECHARGES|PAIEMENTS|Pre\b/.test(o.libelle)), JSON.stringify([as.identifiants, as.soldes, as.operations.map(o => [o.dateOp, o.montant, o.libelle])]));
        v('  → Attijari Mobile : centimes en EXPOSANT lus — 4 318,35 et 4 213,32 ; le n° blanc sur orange lu',
          at.soldes.mesComptes === 4318.35 && (at.soldes.compteCheque ?? at.soldes.solde) === 4213.32 && at.identifiants.includes('000999B000123456'),
          JSON.stringify([at.soldes, at.identifiants]));
        v('  → et ses opérations dans le bon ordre : SRM le 14, GAB le 13 (la publicité n\'est pas un libellé)',
          JSON.stringify(at.operations.map(o => [o.dateOp, o.montant, o.libelle.slice(0, 13)])) === '[["2026-10-14",-377.93,"Paiement SRM "],["2026-10-13",-1500,"GAB BANK ASSA"]]',
          JSON.stringify(at.operations.map(o => [o.dateOp, o.montant, o.libelle])));
        v('  → Attijarinet en capture PC : n° 7654321, les 6 lignes avec leur date (jour + mois d\'en-tête)',
          JSON.stringify(pc.identifiants) === '["7654321"]' && pc.format === 'attijari_web'
          && JSON.stringify(pc.operations.map(o => [o.dateOp, o.dateAchat, o.montant])) === JSON.stringify(PC_ATTENDU.map(x => { const [a, b, m] = x.split(' | '); return [a, b, +m]; })),
          JSON.stringify(pc.operations.map(o => [o.dateOp, o.dateAchat, o.montant, o.libelle])));
        v(`  → les 4 captures lues en ${duree.toFixed(0)} s, sur place (aucune requête hors du serveur)`, duree < 150 && externes.length === 0, JSON.stringify([duree, externes.slice(0, 3)]));
        const totaux = await page.evaluate(() => [...document.querySelectorAll('[data-import-totaux]')].map(e => e.textContent.trim()));
        v('  → capture PC partielle : « débits de la période : 12 601 DH (capture partielle) », pas un faux ✓',
          totaux.length === 1 && /débits de la période/.test(totaux[0]) && /capture partielle/.test(totaux[0]), JSON.stringify(totaux));
        //  Les comptes : n° Attijari et n° Attijarinet → Courant, RIB Assafa → ASSAFA, Saham (empreinte) → urgence
        const repondre = (source, compteId) => page.evaluate(async ({ ST, source, compteId }) => {
            const st = eval(ST), i = st.importBanque.captures.findIndex(c => c.source === source);
            const bloc = document.querySelectorAll('[data-import-capture]')[i], sel = bloc && bloc.querySelector('[data-import-reponse]');
            if (!sel) return false;
            sel.value = String(compteId); sel.dispatchEvent(new Event('change'));
            await new Promise(r => setTimeout(r, 50)); bloc.querySelector('[data-import-associer]').click(); await new Promise(r => setTimeout(r, 150));
            return true;
        }, { ST, source, compteId });
        for (const [s, id] of [['attijari_reel.png', CC], ['attijarinet_pc.png', CC], ['assafa_reel.png', ASSAFA], ['saham_reel.png', URGENCE]]) await repondre(s, id);
        await page.waitForTimeout(300);
        const L = await page.evaluate((ST) => JSON.parse(JSON.stringify(Object.fromEntries(eval(ST).importBanque.captures.map(c => [c.source, (c.lignes || []).map(l => [l.op.libelle.slice(0, 22), l.op.montant, l.type, l.action])])))), ST);
        const act = (s, debut) => ((L[s] || []).find(l => l[0].startsWith(debut)) || [])[3];
        v('  → Saham : les virements jamais en dépenses — l\'« Emission » du 29/08 ignorée, pas ajoutée au journal',
          (L['saham_reel.png'] || []).length === 4 && (L['saham_reel.png'] || []).every(l => l[2] === 'virement' && !/^ajouter/.test(l[3])), JSON.stringify(L['saham_reel.png']));
        v('  → Attijari : SRM pointé sur « elect marrakech villa » ; GAB ignoré ; PC : AWBGAB et ENNAKHIL = retraits ignorés',
          /^pointer:/.test(act('attijari_reel.png', 'Paiement SRM') || '') && act('attijari_reel.png', 'GAB BANK') === 'ignorer'
          && act('attijarinet_pc.png', 'AWBGAB') === 'ignorer' && act('attijarinet_pc.png', 'MARRAKECH ENNAKHIL') === 'ignorer'
          && (L['attijarinet_pc.png'] || []).find(l => l[0].startsWith('MARRAKECH ENNAKHIL'))[2] === 'gab', JSON.stringify([L['attijari_reel.png'], L['attijarinet_pc.png']]));
        v('  → Assafa : 2 frais regroupés, le virement 2 200 pointé (Assafa → Courant), 1 200 ignoré',
          (L['assafa_reel.png'] || []).filter(l => l[3] === 'frais').length === 2 && act('assafa_reel.png', 'VIREMENT EMIS') === 'pointer:Virement:9001'
          && ((L['assafa_reel.png'] || []).find(l => l[1] === -1200) || [])[3] === 'ignorer', JSON.stringify(L['assafa_reel.png']));
        await page.evaluate((ST) => eval(ST).fermerImportBanque(), ST);
        //  Les mêmes captures, envoyées par WhatsApp : 462 px de large, recompressées (comme vos vraies captures)
        await page.evaluate((ST) => eval(ST).ouvrirImportBanque(), ST); await page.waitForTimeout(200);
        const W = ['saham_reel_whatsapp.png', 'assafa_reel_whatsapp.png', 'attijari_reel_whatsapp.png'];
        await page.setInputFiles('[data-import-fichiers]', W.map(f => path.join(BQ, f)));
        await page.click('[data-import-analyser]');
        await page.waitForFunction((ST) => { const s = eval(ST).importBanque; return s.etape === 'revue' || (s.etape === 'depot' && !s.enCours); }, ST, { timeout: 300000 });
        await page.waitForTimeout(300);
        const pw2 = await page.evaluate((ST) => JSON.parse(JSON.stringify(eval(ST).importBanque.captures.map(c => ({ source: c.source, a: c.analyse })))), ST);
        const resume = (a) => JSON.stringify([a.identifiants, a.soldes.mesComptes ?? null, a.soldes.compteCheque ?? a.soldes.solde ?? null, a.operations.map(o => [o.dateOp, o.montant])]);
        const ref = { 'saham_reel_whatsapp.png': sa, 'assafa_reel_whatsapp.png': as, 'attijari_reel_whatsapp.png': at };
        const ecarts = pw2.filter(c => resume(c.a) !== resume(ref[c.source]));
        v('  → les mêmes captures envoyées par WhatsApp (462 px, recompressées) : mêmes soldes, mêmes n°, mêmes opérations',
          pw2.length === 3 && ecarts.length === 0, JSON.stringify(ecarts.map(c => [c.source, resume(c.a)])));
        v('  → et des libellés propres (pas d\'icône lue « Î », « œ » en tête)', pw2.every(c => c.a.operations.every(o => /^[A-Z]/.test(o.libelle))),
          JSON.stringify(pw2.map(c => c.a.operations.map(o => o.libelle))));
        await page.evaluate((ST) => eval(ST).fermerImportBanque(), ST);
    });

    /* ── D. Le téléphone ──────────────────────────────────────────────── */
    await section('D', async () => {
        const tel = await ouvrirPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
        const flottants = () => tel.evaluate(() => [...document.querySelectorAll('button')].filter(b => getComputedStyle(b).position === 'fixed' && b.offsetWidth > 0 && b.offsetWidth < 80)
            .map(b => { const r = b.getBoundingClientRect(); return { t: b.textContent.trim().slice(0, 2), l: r.left, r: r.right, h: r.top, b: r.bottom }; }));
        const fl = await flottants();
        const chev = []; fl.forEach((a, i) => fl.slice(i + 1).forEach(b => { if (a.l < b.r && b.l < a.r && a.h < b.b && b.h < a.b) chev.push(a.t + '×' + b.t); }));
        const plus = fl.find(x => x.t === '➕');
        const auCentre = plus && await tel.evaluate(({ x, y }) => (document.elementFromPoint(x, y) || {}).textContent.trim().slice(0, 2), { x: (plus.l + plus.r) / 2, y: (plus.h + plus.b) / 2 });
        v('D. téléphone 390 px : le ➕ se touche (plus rien posé dessus), aucun bouton flottant n\'en chevauche un autre',
          !!plus && auCentre === '➕' && chev.length === 0 && fl.length >= 3, JSON.stringify([auCentre, chev, fl.map(x => x.t)]));
        await tel.tap('button[title="Saisie rapide"]'); await tel.waitForTimeout(300);
        const fl2 = await flottants();
        v('  → saisie rapide ouverte : 🪄 📑 🧠 ne couvrent plus ses champs ; « 🏦 Importer mes captures bancaires » en tête',
          !fl2.some(x => ['🪄', '📑', '🧠'].includes(x.t)) && await tel.isVisible('[data-import-ouvrir-rapide]'), JSON.stringify(fl2.map(x => x.t)));
        await tel.tap('[data-import-ouvrir-rapide]'); await tel.waitForTimeout(300);
        const etat = await tel.evaluate((ST) => [eval(ST).importBanque.ouvert, eval(ST).showSaisieQuickModal], ST);
        const depot = await tel.textContent('[data-import-depot]');
        v('  → un toucher : la saisie rapide se ferme, l\'import s\'ouvre — « Touchez pour choisir vos captures · dans vos photos »',
          etat[0] === true && etat[1] === false && /Touchez pour choisir vos captures/.test(depot) && /dans vos photos/.test(depot), JSON.stringify([etat, depot.replace(/\s+/g, ' ')]));
        const debord = () => tel.evaluate(() => { const W = window.innerWidth;
            return { W, sw: document.documentElement.scrollWidth, trop: [...document.querySelectorAll('[data-import-banque] *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > W + 1 || r.left < -1); }).length }; });
        await tel.setInputFiles('[data-import-fichiers]', ['attijari_reel.png', 'saham_reel.png'].map(f => path.join(BQ, f)));
        await tel.waitForTimeout(300);
        const d1 = await debord();
        await tel.tap('[data-import-analyser]');
        await tel.waitForFunction((ST) => eval(ST).importBanque.etape === 'revue', ST, { timeout: 200000 }); await tel.waitForTimeout(400);
        const d2 = await debord();
        const largeur = await tel.evaluate(() => [...document.querySelectorAll('[data-import-compte]')].map(e => e.getBoundingClientRect().width));
        v('  → deux captures de la galerie lues ; la revue tient dans 390 px, le choix du compte sur toute la largeur',
          d1.trop === 0 && d2.trop === 0 && d2.sw <= 390 && largeur.length === 2 && largeur.every(w => w > 280), JSON.stringify([d1, d2, largeur]));
        //  Une photo que le navigateur ne sait pas lire (HEIC) : on le dit, au lieu d'échouer en silence
        await tel.evaluate((ST) => eval(ST).ouvrirImportBanque(), ST); await tel.waitForTimeout(200);
        await tel.setInputFiles('[data-import-fichiers]', [{ name: 'IMG_0412.HEIC', mimeType: 'image/heic', buffer: Buffer.from('ftypheic' + 'x'.repeat(200)) }]);
        await tel.tap('[data-import-analyser]');
        await tel.waitForFunction((ST) => !eval(ST).importBanque.enCours && eval(ST).importBanque.etape !== 'analyse', ST, { timeout: 60000 }); await tel.waitForTimeout(200);
        const err = await tel.evaluate((ST) => [eval(ST).importBanque.erreur, eval(ST).importBanque.fichiers.map(f => f.statut)], ST);
        v('  → une photo HEIC illisible : « image illisible par ce navigateur (photo HEIC ?) — envoyez une capture d\'écran »',
          /illisible par ce navigateur \(photo HEIC \?\)/.test(err[0]) && /IMG_0412\.HEIC/.test(err[0]) && err[1][0] === 'erreur', JSON.stringify(err));
    });

    v('aucune erreur JavaScript', erreurs.length === 0, erreurs.slice(0, 3).join(' | '));
} finally {
    await browser.close();
    srv.close();
}
console.log('  ' + '─'.repeat(80));
console.log(ko === 0 ? '  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
