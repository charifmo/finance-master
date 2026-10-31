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
console.log('\n  SOLDE ATTIJARI À UN SEUL CHIFFRE APRÈS LA VIRGULE\n  ' + '─'.repeat(80));

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


v('A. un solde à un chiffre (« 5 107,⁸ DH », zéro final tu) est lu à l\u2019en-tête ; les centimes relus acceptent un chiffre',
  /Attijari affiche « 5 107,⁸ DH »/.test(html) && /lu\.match\(\/\^\(\\d\)\(\?!\\d\)\/\)/.test(html));
const V = (lignes) => `13:06  4G 66
Bienvenue KARIM TESTEUR  à
Mes comptes ©
5 212,11 DH
${lignes}
Octobre 2026
Paiement Recharge inwi (*)
31 oct. 2026  -20,00 DH
PAIEMENT CB 31 10 26 MARJANE M…
31 oct. 2026  -31,85 DH
Accueil  Comptes  ®  Cartes  Menu`;
try {
    await section('B', async () => {
        for (const [nom, l] of [['sur une ligne « 5 107,8 DH »', 'Compte chèque\n000999B000123456\n5 107,8 DH'], ['coupé « 5 107, » / « 8 DH »', 'Compte chèque\n000999B000123456\n5 107,\n8 DH'], ['sans devise « 5 107,8 »', 'Compte chèque\n000999B000123456\n5 107,8'], ['deux chiffres « 5 107,80 DH »', 'Compte chèque\n000999B000123456\n5 107,80 DH']]) {
            const a = await analyser(V(l));
            v('B. ' + nom + ' : compte chèque 5 107,80 et total 5 212,11', a.soldes.compteCheque === 5107.8 && a.soldes.mesComptes === 5212.11, JSON.stringify(a.soldes));
        }
        const a = await analyser(V('Compte chèque\n000999B000123456\n5 107,8 DH'));
        v('  → les opérations gardent leurs deux chiffres : -20,00 et -31,85', JSON.stringify(a.operations.map(o => o.montant)) === '[-20,-31.85]', JSON.stringify(a.operations.map(o => o.montant)));
    });
} finally { await browser.close(); srv.close(); }
console.log(ko === 0 ? '\n  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `\n  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
