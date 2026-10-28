/**
 * v37.68 — LES EN-TÊTES DE COMPTE NE SONT PAS DES OPÉRATIONS · LES CORRECTIONS APPROUVÉES, UNE FOIS.
 *
 *   1. À l'import d'une capture bancaire, l'intitulé du compte et son solde (« Compte chèque 5 … ») que
 *      l'OCR retrouve au milieu de la liste quand l'écran défile était lu comme une opération (une
 *      « dépense » de plusieurs milliers de DH qui mangeait le reste à dépenser). Ce n'en est plus une.
 *   2. Corrections approuvées par l'utilisateur, appliquées au chargement, une seule fois (schéma 23) :
 *      a. une opération importée désignée par son empreinte est retirée, sa ligne du registre « ignorée » ;
 *      b. les années suivantes qui envoyaient le salaire et la bonification sur le Courant suivent le
 *         compte de cette année ; l'« épargne » Courant → ce compte (trajet inverse) est retirée.
 *   Décor fictif (KARIM TESTEUR), paie le 27, 12 nov. 2026.
 *     A. statique · B. le parseur · C. la correction, objet par objet · D. au chargement de l'appli.
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
console.log('\n  EN-TÊTES DE COMPTE · CORRECTIONS APPROUVÉES (SCHÉMA 23)\n  ' + '─'.repeat(80));

/* ── A. Statique ─────────────────────────────────────────────────────── */
v('A. le parseur écarte les en-têtes de compte ; schéma 23 ; la correction est appelée au chargement',
  /const BQ_ENTETE_COMPTE = \/\^compte\\s\*\(cheque\|courant\)\\b\/;/.test(html) && /\.filter\(o => !BQ_ENTETE_COMPTE\.test\(bqNorm\(o\.libelle\)\.trim\(\)\)\)/.test(html)
  && /_schemaVersion: 23,/.test(html) && /const _corr = corrigerDonneesApprouvees\(data\);/.test(html));
v('  → aucune donnée réelle dans le code : une empreinte de 8 caractères par opération retirée',
  /const OPERATIONS_RETIREES = new Set\(\['[0-9a-f]{8}'\]\);/.test(html));

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

/* ── Le décor : des données d'avant la v37.68 (schéma 22), salaire 2027 sur le Courant ── */
const fixture = () => {
    const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8'));
    fx._schemaVersion = 22;
    const base = fx.donneesAnnuelles[Object.keys(fx.donneesAnnuelles)[0]];
    fx.donneesAnnuelles = {};
    for (const an of [2026, 2027, 2028]) fx.donneesAnnuelles[an] = JSON.parse(JSON.stringify(base));
    Object.assign(fx.soldesInitiaux, { moisActuel: 11, anneeActuelle: 2026, jourDePaie: 27, compteChargesFixes: 'cpt_900', compteChargesVariables: 'courant',
                                       assurances_tracker: [], voyageDebut: '', voyageFin: '' });
    fx.soldesInitiaux.categories = [];
    fx.comptes = [{ id: 'acc_cc', label: 'Compte Courant', type: 'liquide', solde: 5000, icone: '💳' },
                  { id: 900, label: 'Compte Salaire', type: 'liquide', solde: 1000, icone: '🏦' },
                  { id: 901, label: 'Compte Épargne', type: 'epargne', solde: 0, icone: '🐷' }];
    for (const an of Object.keys(fx.donneesAnnuelles)) {
        const d = fx.donneesAnnuelles[an];
        const Rv = (label, b, dest) => ({ label, base: b, jourPrevu: 27, destinationCompte: dest, exceptions: [] });
        d.revenus = { salaire: Rv('SALAIRE', 20000, an === '2026' ? 'cpt_900' : 'courant'), bonif: Rv('BONIF', 3000, an === '2026' ? 'cpt_900' : 'courant'),
                      magasin: Rv('MAGASIN', 2000, 'courant'), cnss: Rv('—', 0, 'courant'), appart: Rv('—', 0, 'courant'), studio: Rv('—', 0, 'courant') };
        d.epargne = an === '2026' ? [] : [
            { id: 51, nom: 'Vers Compte Salaire', label: 'Vers Compte Salaire', valeur: 15000, sourceCompte: 'courant', linkedAccountId: 900, exceptions: [] },   // le trajet inverse
            { id: 52, nom: 'Urgence', label: 'Urgence', valeur: 1000, sourceCompte: 'courant', linkedAccountId: 901, exceptions: [] },
        ];
        d.depensesIrregulieres = []; d.virementsInternes = []; d.consoRealiseeT0 = {}; d.consoClotureT0 = {};
        d.banqueOperations = {};
        d.transactionsReelles = [];
    }
    return fx;
};
const page0 = html
    .replace('<script src="https://unpkg.com/vue@3/dist/vue.global.js"', '<script src="/vue.js"')
    .replace('<script src="https://cdn.jsdelivr.net/npm/chart.js"', '<script src="/chart.js"')
    .replace(/<script src="https:\/\/cdn\.tailwindcss\.com"[^>]*><\/script>/, '')
    .replace(/<script[^>]*src="https:\/\/[^"]*"[^>]*><\/script>/g, '');
const envois = [];
const srv = http.createServer((req, res) => {
    const p = req.url.split('?')[0];
    const s = (c, b, t = 'application/json') => { res.writeHead(c, { 'Content-Type': t }); res.end(b); };
    if (p === '/finance/') return s(200, page0, 'text/html; charset=utf-8');
    if (p === '/vue.js') return s(200, fs.readFileSync(vueJs), 'text/javascript');
    if (p === '/chart.js') return s(200, fs.readFileSync(chartJs), 'text/javascript');
    if (p === '/finance/finance_data.json') return s(200, JSON.stringify(fixture()));
    if (p === '/finance/save_data.php' && req.method === 'POST') { let b = ''; req.on('data', c => { b += c; }); req.on('end', () => { envois.push(b); s(200, '{"status":"ok"}'); }); return; }
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
await page.waitForTimeout(1200);

try {
    /* ── B. Le parseur ─────────────────────────────────────────────────── */
    await section('B', async () => {
        //  Saham, écran qui a défilé : l'en-tête « Compte chèque 5 » et son solde au milieu des opérations
        const texte = 'BONJOUR KARIM TESTEUR\nCompte chèque dirhams\n5 174,09 DH\nTRANSACTIONS RÉCENTES\n'
            + 'Paiement CB MARJANE TEST\n27/10/2026\n-300,00 Dh\n'
            + 'Compte chèque 5\n27/10/2026\n-6 543,21 Dh\n'
            + 'Reception vrt instantane n : 268271 de …\n26/10/2026\n+500,00 Dh\n';
        const a = await page.evaluate(({ ST, texte }) => JSON.parse(JSON.stringify(eval(ST).bqAnalyser(texte, { aujourdhui: new Date(2026, 10, 12) }))), { ST, texte });
        const ops = a.operations.map(o => o.libelle + ' ' + o.montant);
        v('B. l\'en-tête « Compte chèque 5 » (−6 543,21) n\'est plus une opération ; les 2 vraies restent',
          !ops.some(o => /^Compte chèque/i.test(o)) && ops.length === 2 && ops.some(o => /MARJANE TEST -300$/.test(o)) && ops.some(o => / 500$/.test(o)), JSON.stringify(ops));
        v('  → le solde du compte, lui, est toujours lu dans l\'en-tête (5 174,09)', a.soldes && a.soldes.compteCheque === 5174.09, JSON.stringify(a.soldes));
    });

    /* ── C. La correction, objet par objet ─────────────────────────────── */
    await section('C', async () => {
        const C = await page.evaluate((ST) => {
            const st = eval(ST);
            const vecteurs = [st._empreinte(''), st._empreinte('a')];                 // FNV-1a 32 bits : 811c9dc5, e40c292c
            st.OPERATIONS_RETIREES.add(st._empreinte('2026-11-02|bqtest01|6543.21'));
            const D = (v) => ({ _schemaVersion: v, soldesInitiaux: { anneeActuelle: 2026 }, comptes: [{ id: 'cc', type: 'liquide' }, { id: 900, type: 'liquide' }],
                donneesAnnuelles: {
                    2026: { revenus: { salaire: { destinationCompte: 'cpt_900' }, bonif: { destinationCompte: 'cpt_900' } },
                            transactionsReelles: [{ id: 1, date: '2026-11-02', banqueHash: 'bqtest01', montant: 6543.21 }, { id: 2, date: '2026-11-02', banqueHash: 'bqtest02', montant: 6543.21 }],
                            banqueOperations: { bqtest01: { s: 'ajoutee', x: 1 }, bqtest02: { s: 'ajoutee', x: 2 } } },
                    2027: { revenus: { salaire: { destinationCompte: 'courant' }, bonif: { destinationCompte: 'cpt_cc' } },
                            epargne: [{ sourceCompte: 'courant', linkedAccountId: 900 }, { sourceCompte: 'courant', linkedAccountId: 901 }, { sourceCompte: 'cpt_901', linkedAccountId: 900 }] },
                } });
            const a = D(22), na = st.corrigerDonneesApprouvees(a), b = D(23), nb = st.corrigerDonneesApprouvees(b);
            const c = D(22); c.donneesAnnuelles[2026].revenus.salaire.destinationCompte = 'courant'; c.donneesAnnuelles[2026].revenus.bonif.destinationCompte = 'courant';
            const nc = st.corrigerDonneesApprouvees(c);
            return JSON.parse(JSON.stringify({ vecteurs, nReelle: st.OPERATIONS_RETIREES.size, na, nb, nc,
                tx: a.donneesAnnuelles[2026].transactionsReelles.map(t => t.id), reg: a.donneesAnnuelles[2026].banqueOperations,
                rev27: [a.donneesAnnuelles[2027].revenus.salaire.destinationCompte, a.donneesAnnuelles[2027].revenus.bonif.destinationCompte],
                ep27: a.donneesAnnuelles[2027].epargne, revB: b.donneesAnnuelles[2027].revenus.salaire.destinationCompte, epC: c.donneesAnnuelles[2027].epargne.length }));
        }, ST);
        v('C. l\'empreinte est un FNV-1a 32 bits (vecteurs connus) ; une seule opération réelle désignée',
          JSON.stringify(C.vecteurs) === '["811c9dc5","e40c292c"]' && C.nReelle === 2, JSON.stringify([C.vecteurs, C.nReelle]));
        v('  → l\'opération désignée est retirée, sa jumelle (autre ligne du registre) reste ; le registre la dit « ignorée »',
          JSON.stringify(C.tx) === '[2]' && C.reg.bqtest01.s === 'ignoree' && !('x' in C.reg.bqtest01) && /En-tête de compte/.test(C.reg.bqtest01.r) && C.reg.bqtest02.s === 'ajoutee', JSON.stringify([C.tx, C.reg]));
        v('  → 2027 : salaire (« courant ») et bonification (« cpt_cc ») sur cpt_900 ; seule l\'épargne Courant → 900 est retirée',
          JSON.stringify(C.rev27) === '["cpt_900","cpt_900"]' && C.ep27.length === 2 && !C.ep27.some(e => e.sourceCompte === 'courant' && e.linkedAccountId === 900)
          && JSON.stringify(C.na) === '{"operations":1,"revenus":2,"epargnes":1}', JSON.stringify([C.rev27, C.ep27, C.na]));
        v('  → déjà au schéma 23 : rien ne bouge ; salaire de cette année sur le Courant : 2027 inchangé',
          C.revB === 'courant' && JSON.stringify(C.nb) === '{"operations":0,"revenus":0,"epargnes":0}' && C.nc.revenus === 0 && C.nc.epargnes === 0 && C.epC === 3, JSON.stringify([C.nb, C.nc, C.epC]));
    });

    /* ── D. Au chargement ──────────────────────────────────────────────── */
    await section('D', async () => {
        const D = await page.evaluate((ST) => { const st = eval(ST), d = st.donneesAnnuelles;
            return JSON.parse(JSON.stringify({ r: [2027, 2028].map(a => [d[a].revenus.salaire.destinationCompte, d[a].revenus.bonif.destinationCompte]),
                ep: [2027, 2028].map(a => d[a].epargne.map(e => e.nom)), log: st.serverLogs.map(l => l.msg).filter(m => /^🏦/.test(m)),
                al: st._lectureCFO().alimentation_du_courant.alerte_donnees })); }, ST);
        v('D. au chargement : salaire et bonification 2027-2028 sur « Compte Salaire », l\'épargne inverse retirée, Urgence gardée',
          JSON.stringify(D.r) === JSON.stringify([['cpt_900', 'cpt_900'], ['cpt_900', 'cpt_900']]) && JSON.stringify(D.ep) === '[["Urgence"],["Urgence"]]', JSON.stringify([D.r, D.ep]));
        v('  → le journal le dit ; le CFO n\'a plus d\'alerte « salaire baladeur »',
          D.log.length === 1 && /4 ligne\(s\)\), 2 virement\(s\) inverse\(s\) retiré\(s\)/.test(D.log[0]) && D.al === null, JSON.stringify(D));
        await page.evaluate((ST) => { eval(ST).donneesAnnuelles[2026].revenus.studio.base = 1; }, ST);
        await page.waitForTimeout(2800);
        const e = envois.length ? JSON.parse(envois[envois.length - 1]) : null;
        v('  → l\'enregistrement porte le schéma 23 (la correction ne se rejouera pas)', !!e && e._schemaVersion === 23, e ? String(e._schemaVersion) : 'aucun envoi');
    });
    v('aucune erreur JavaScript', erreurs.length === 0, erreurs[0] || '');
} finally {
    await browser.close();
    srv.close();
}
console.log(ko === 0 ? '\n  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `\n  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
