/**
 * v37.71 — LA CAPTURE ATTIJARI « MES COMPTES » RECONNUE.
 *
 *   « Pourquoi il ne reconnaît pas le compte Attijari ? » — sur l'écran mobile « Mes comptes », la liste n'a
 *   d'autre titre que son mois (« Octobre 2026 ») : l'en-tête était coupé au total « Mes comptes », le n° du
 *   compte et le solde du compte chèque tombaient dans les opérations (« sans RIB visible »).
 *   Texte OCR fictif (même mise en page), n° et montants inventés.
 *     A. statique · B. le parseur · C. la reconnaissance du compte (n°, empreinte à un mot parasite près).
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
console.log('\n  ATTIJARI « MES COMPTES » : LE COMPTE RECONNU\n  ' + '─'.repeat(80));

/* ── A. Statique ─────────────────────────────────────────────────────── */
v('A. un mois seul sur sa ligne est le titre de la liste ; empreinte tolérante ; 3e lecture si « Mes comptes » illisible',
  /const BQ_TITRE_MOIS = /.test(html) && /BQ_TITRE_MOIS\.test\(bqNorm\(l\)\.trim\(\)\)/.test(html) && /const empPareille = /.test(html) && /textes\.every\(_mesComptesManque\)/.test(html));

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

/* ── Le décor ────────────────────────────────────────────────────────── */
const fixture = () => {
    const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8'));
    fx._schemaVersion = 23;
    Object.assign(fx.soldesInitiaux, { moisActuel: 11, anneeActuelle: 2026, jourDePaie: 27, assurances_tracker: [], voyageDebut: '', voyageFin: '' });
    fx.comptes = [{ id: 'acc_cc', label: 'Compte Courant', type: 'liquide', solde: 5000, banque: 'attijari', identifiants: [], empreintes: ['attijari|pad compte cheque'], soldeSuivi: 'mesComptes' },
                  { id: 900, label: 'Compte Épargne', type: 'epargne', solde: 0, banque: 'saham', empreintes: ['saham|compte cheque dirhams'] }];
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
const erreurs = [];
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.clock.setFixedTime(new Date(2026, 10, 12, 10, 0, 0));
page.on('pageerror', e => erreurs.push(String(e)));
await page.route('**/webhook/**', route => route.abort());
await page.goto(`http://127.0.0.1:${port}/finance/`, { waitUntil: 'load' });
await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState.moisBudgetaire; }, null, { timeout: 30000 });
await page.waitForTimeout(1000);

//  L'écran Attijari Mobile « Mes comptes », tel que l'OCR le rend (fictif)
const ECRAN = ['14:32 CRE eo           NES ll &', '|        Mes comptes       y Q', '9 876,00 DH ©', 'Compte chèque                         5', '111111X222222222',
    '5  432,10 DH 10 DH', 'Octobre 2026', '7)   GOOGLE PAYMENTS TEM(*)                 0,00 DH', '28 oct. 2026', '7)   PAIEMENT CB 2810 26 MARJANE..  -68,24 DH', '28 oct. 2026',
    '7)   Netflix com(*)                                      -119,07 DH', '28 oct. 2026', 'Accueil           Comptes                                     Cartes                Menu'].join('\n');
const analyser = (t) => page.evaluate(({ ST, t }) => JSON.parse(JSON.stringify(eval(ST).bqAnalyser(t, { aujourdhui: new Date(2026, 9, 28) }))), { ST, t });

try {
    /* ── B. Le parseur ─────────────────────────────────────────────────── */
    await section('B', async () => {
        const a = await analyser(ECRAN);
        v('B. le n° du compte (111111X222222222) est lu dans l\'en-tête', JSON.stringify(a.identifiants) === '["111111X222222222"]', JSON.stringify(a.identifiants));
        v('  → les deux soldes : « Mes comptes » 9 876,00 et « Compte chèque » 5 432,10', a.soldes.mesComptes === 9876 && a.soldes.compteCheque === 5432.1, JSON.stringify(a.soldes));
        v('  → 3 opérations, sans l\'en-tête « Compte chèque » parmi elles ; empreinte « attijari|compte cheque »',
          a.operations.length === 3 && !a.operations.some(o => /compte ch/i.test(o.libelle)) && a.operations[1].montant === -68.24 && a.signature === 'attijari|compte cheque', JSON.stringify(a.operations.map(o => o.libelle + ' ' + o.montant)));
        const sansMois = await analyser(ECRAN.replace('Octobre 2026\n', ''));
        v('  → sans la ligne du mois : comme avant (en-tête coupé au total) — le mois est bien ce qui manquait', sansMois.identifiants.length === 0, JSON.stringify(sansMois.identifiants));
        const saham = await analyser('BONJOUR KARIM TESTEUR\nCompte chèque dirhams\n5 174,09 DH\nTRANSACTIONS RÉCENTES\nEmission d\'un virement mobile tiers sah…\n05/10/2026\n-4 900,00 Dh\n');
        v('  → une autre banque (Saham, titre « Transactions récentes ») : inchangée', saham.soldes.compteCheque === 5174.09 && saham.operations.length === 1, JSON.stringify([saham.soldes, saham.operations.length]));
    });

    /* ── C. La reconnaissance du compte ───────────────────────────────── */
    await section('C', async () => {
        const C = await page.evaluate((ST) => { const st = eval(ST), r = (a) => { const x = st.resoudreCompteReleve(a); return [x.compteId, x.via, x.question]; };
            return { emp: r({ identifiants: [], signature: 'attijari|compte cheque' }), vide: r({ identifiants: [], signature: 'attijari|' }),
                     autreBanque: r({ identifiants: [], signature: 'cih|compte cheque' }), deuxMots: r({ identifiants: [], signature: 'attijari|pad cheque' }),
                     loin: r({ identifiants: [], signature: 'attijari|pad compte cheque perso joint' }) }; }, ST);
        v('C. empreinte mémorisée « attijari|pad compte cheque » ↔ lue « attijari|compte cheque » : Compte Courant reconnu', JSON.stringify(C.emp) === '["acc_cc","empreinte",null]', JSON.stringify(C.emp));
        v('  → empreinte vide (« attijari| ») ou autre banque : rien n\'est reconnu (la question est posée)',
          C.vide[0] === null && C.vide[2] === 'empreinte' && C.autreBanque[0] === null, JSON.stringify([C.vide, C.autreBanque]));
        v('  → deux mots en trop (« pad compte cheque perso joint ») : pas reconnu, la tolérance s\'arrête à un mot', C.loin[0] === null, JSON.stringify(C.loin));
        const a = await analyser(ECRAN);
        const D = await page.evaluate(({ ST, a }) => { const st = eval(ST); st.calibrerCompte('acc_cc', a); const x = st.resoudreCompteReleve(a); return [x.compteId, x.via, st.comptes.find(c => c.id === 'acc_cc').identifiants]; }, { ST, a });
        v('  → une fois associé, le n° est mémorisé : la capture suivante est reconnue par son n°', D[0] === 'acc_cc' && D[1] === 'identifiant' && D[2].includes('111111X222222222'), JSON.stringify(D));
    });
    v('aucune erreur JavaScript', erreurs.length === 0, erreurs[0] || '');
} finally {
    await browser.close();
    srv.close();
}
console.log(ko === 0 ? '\n  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `\n  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
