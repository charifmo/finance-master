/**
 * v37.103 — LE COMPTE D'UNE LIGNE DE DÉTAIL EST CELUI DE SA DÉPENSE.
 *
 *   « elect marrakech villa » est une ligne de détail de la dépense variable « Factures », dont le compte choisi
 *   (Budget Structurel) est ASSAFA. Le Mode Réalisé l'affichait prélevée sur « Courant » : « aucun compte choisi sur
 *   cette ligne » — la liste ignorait le compte de la dépense parente, alors que le radar et le Relevé la prélèvent
 *   sur Assafa. Une ligne de détail qui a son propre compte le garde ; une dépense sans compte reste sur le Courant.
 *   Décor FICTIF.
 */
import fs from 'node:fs';
import { twCompiler } from './tw_cache.mjs';   // v37.109 : Tailwind compilé une fois pour toutes les suites
import http from 'node:http';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..');
const html = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8').split('\r\n').join('\n');
let ko = 0;
const v = (t, ok, d = '') => { if (!ok) ko++; console.log(`  ${ok ? '✅' : '❌'} ${t.padEnd(74)} ${ok ? '' : (typeof d === 'string' ? d : JSON.stringify(d))}`); };
console.log('\n  LE COMPTE D\'UNE LIGNE DE DÉTAIL = CELUI DE SA DÉPENSE\n  ' + '─'.repeat(80));
v('la liste de Réalisé route une ligne de détail sur le compte de sa dépense (refCompte)', /const refCompte = \(ref && ref\.compte\) \? ref : \(parent \|\| ref\)/.test(html) && /'variable', cat\)\);/.test(html));

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
const twBin = path.join(RACINE, 'node_modules/.bin/tailwindcss');
const twCss = essai(() => {
    if (!fs.existsSync(twBin)) return null;
    const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'twpointage-'));
    fs.writeFileSync(path.join(tmp, 'in.css'), '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
    fs.writeFileSync(path.join(tmp, 'cfg.js'), 'module.exports={content:[' + JSON.stringify(path.join(RACINE, 'index.html')) + '],theme:{extend:{}}};');
    twCompiler(twBin, ['-c', path.join(tmp, 'cfg.js'), '-i', path.join(tmp, 'in.css'), '-o', path.join(tmp, 'out.css'), '--minify'], { stdio: 'ignore' });
    const css = fs.readFileSync(path.join(tmp, 'out.css'), 'utf8');
    return css.length > 10000 ? css : null;
});

const JDP = 8;
const SC = { maintenant: new Date(2026, 9, 14, 10, 0, 0), mois: 11, an: 2026 };
const fixture = (sc) => {
    const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8'));
    const base = fx.donneesAnnuelles[Object.keys(fx.donneesAnnuelles)[0]];
    fx.donneesAnnuelles = {};
    for (const an of [sc.an - 1, sc.an, sc.an + 1]) fx.donneesAnnuelles[an] = JSON.parse(JSON.stringify(base));
    Object.assign(fx.soldesInitiaux, { moisActuel: sc.mois, anneeActuelle: sc.an, jourDePaie: JDP,
        compteChargesFixes: 'courant', compteChargesVariables: 'courant', assurances_tracker: [], voyageDebut: '', voyageFin: '' });
    fx.comptes = [
        { id: 1, label: 'Compte Courant', type: 'courant', solde: 2000, icone: '💳' },
        { id: 2, label: 'Compte Assafa', type: 'epargne', solde: 1000, icone: '🏛️' },
        { id: 3, label: 'Livret Réserve', type: 'epargne', solde: 50000, icone: '🏦' },
    ];
    const neutre = { paye: false, montantPaye: 0, exceptions: [], showExceptions: false };
    for (const an of Object.keys(fx.donneesAnnuelles)) {
        const d = fx.donneesAnnuelles[an];
        const Rv = (label, b, j, dest) => ({ ...neutre, label, base: b, jourPrevu: j, destinationCompte: dest || 'courant' });
        d.revenus = { salaire: Rv('SALAIRE', 0, JDP), bonif: Rv('—', 0), magasin: Rv('—', 0), cnss: Rv('—', 0),
                      appart: Rv('LOYER APPART', 4000, 12, 'cpt_2'), studio: Rv('—', 0) };
        const Fx = (label, valeur, j, exceptions = []) => ({ ...neutre, label, valeur, jourPrevu: j, exceptions });
        d.chargesFixes = { creditImmo: Fx('LOYER', 6000, 20), creditStudio: Fx('CRÉDIT STUDIO', 3000, 15, [{ moisDebut: 11, moisFin: 11, nouvelleValeur: 0 }]),
                           syndic: Fx('—', 0), nounou: Fx('—', 0), ecole: Fx('—', 0),
                           femmeMenage: Fx('—', 0), habitsCharif: Fx('—', 0), habitsBebe: Fx('—', 0), jouets: Fx('—', 0) };
        const V = (label, valeur, periode) => ({ ...neutre, label, valeur, periode, details: [], showDetails: false });
        const detail = (id, nom, montant, jourPrevu, extra = {}) => ({ id, nom, montant, periode: 'mois', jourPrevu, ...extra });
        d.chargesVariables = {
            alimentation: V('COURSES', 0, 'semaine'), sorties: V('SORTIES', 0, 'semaine'), voiture: V('—', 0, 'semaine'), sante: V('—', 0, 'semaine'),
            //  « Factures » (compte choisi : Assafa = cpt_2) et ses lignes de détail, qui n'ont pas de compte à elles
            factures: { ...V('FACTURES', 1050, 'mois'), categorieId: 'cat_cv_factures', compte: 'cpt_2',
                        details: [detail(901, 'elect marrakech villa', 700, 6), detail(902, 'internet', 250, 12), detail(903, 'eau spéciale', 100, 14, { compte: 'cpt_3' })] },
            //  une autre dépense variable SANS compte choisi : celle-ci tombe bien sur le compte par défaut (Courant)
            loisirs: { ...V('LOISIRS', 80, 'mois'), categorieId: 'cat_cv_loisirs', details: [detail(911, 'cinéma', 80, 9)] },
        };
        d.epargne = [{ ...neutre, id: 21, nom: 'Réserve', valeur: 500, sourceCompte: 'courant', linkedAccountId: 'cpt_3', jourPrevu: 25 }];
        d.depensesIrregulieres = Number(an) !== sc.an ? [] : [
            { id: 701, mois: 10, annee: sc.an, nom: 'PRIME exceptionnelle', montant: -23781, sourceCompte: 'cpt_2', jourPrevu: 10 },
            { id: 702, mois: 10, annee: sc.an, nom: 'TOIT', montant: 5000, sourceCompte: 'courant', jourPrevu: 18 },
            { id: 703, mois: 11, annee: sc.an, nom: 'ASSURANCE', montant: 1200, sourceCompte: 'courant', jourPrevu: 5 },
            { id: 704, mois: 12, annee: sc.an, nom: 'NOTAIRE', montant: -12000, sourceCompte: 'cpt_2', jourPrevu: 3 },
        ];
        d.virementsInternes = []; d.transactionsReelles = []; d.consoRealiseeT0 = {};
    }
    return fx;
};
let fxCourant = null;
const page0 = html
    .replace('<script src="https://unpkg.com/vue@3/dist/vue.global.js"', '<script src="/vue.js"')
    .replace('<script src="https://cdn.jsdelivr.net/npm/chart.js"', '<script src="/chart.js"')
    .replace(/<script src="https:\/\/cdn\.tailwindcss\.com"[^>]*><\/script>/, twCss ? '<link rel="stylesheet" href="/tailwind.css">' : '')
    .replace(/<script[^>]*src="https:\/\/[^"]*"[^>]*><\/script>/g, '');
const srv = http.createServer((req, res) => {
    const p = req.url.split('?')[0];
    const s = (c, b, t = 'application/json') => { res.writeHead(c, { 'Content-Type': t }); res.end(b); };
    if (p === '/finance/') return s(200, page0, 'text/html; charset=utf-8');
    if (p === '/vue.js') return s(200, fs.readFileSync(vueJs), 'text/javascript');
    if (p === '/chart.js') return s(200, fs.readFileSync(chartJs), 'text/javascript');
    if (p === '/tailwind.css') return s(200, twCss || '', 'text/css');
    if (p === '/finance/finance_data.json') return s(200, JSON.stringify(fxCourant));
    return s(200, '{"status":"ok"}');
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port;
const browser = await pw.chromium.launch({ executablePath: chromium, args: ['--no-sandbox'] });
const ST = 'document.querySelector("#app").__vue_app__._instance.setupState';
const pret = (page) => page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState.moisBudgetaire; }, null, { timeout: 30000 });
const auPilotage = async (page) => { await page.evaluate(async (ST) => { const st = eval(ST); st.appMode = 'reel'; await new Promise(r => setTimeout(r, 250)); st.activeTab = 'pilotage'; }, ST); await page.waitForTimeout(500); };
const ouvrir = async (sc, opts = { viewport: { width: 1400, height: 1100 } }) => {
    fxCourant = fixture(sc);
    const page = await browser.newPage(opts);
    await page.clock.setFixedTime(sc.maintenant);
    const erreurs = []; page.on('pageerror', e => erreurs.push(String(e)));
    page.on('dialog', d => d.accept());
    await page.goto(`http://127.0.0.1:${port}/finance/`, { waitUntil: 'load' });
    await pret(page); await page.waitForTimeout(600);
    await auPilotage(page);
    return { page, erreurs };
};
const nf = (n) => new Intl.NumberFormat('fr-FR').format(n).replace(/\s/g, '');
const sansEsp = (t) => String(t || '').replace(/\s/g, '');
const attendre = (page, ms = 300) => page.waitForTimeout(ms);


const infos = (page) => page.evaluate((ST) => {
    const st = eval(ST);
    const l = (nom) => { const t = st.tachesPilotageToutes.find(x => x.libelle === nom); return t ? { compte: t.compte, nom: st.infoCompte(t.compte).nom || st.getNomCompte(t.compte.replace(/^cpt_/, 'cpt_')), regle: st.regleDeRoutage(t.nature, t.refCompte || t.ref) } : null; };
    return { elec: l('elect marrakech villa'), internet: l('internet'), eau: l('eau spéciale'), cinema: l('cinéma'),
             comptes: st.comptes.map(c => [c.id, c.label]) };
}, ST);
try {
    const { page, erreurs } = await ouvrir(SC);
    const r = await infos(page);
    v('« elect marrakech villa » (dépense Factures → Assafa) : prélevée sur ASSAFA, plus sur Courant', r.elec && r.elec.compte === 'cpt_2', r.elec);
    v('  → la bulle le dit : « Compte choisi sur cette charge variable »', r.elec && /Compte choisi sur cette charge variable/.test(r.elec.regle), r.elec);
    v('  → toutes les lignes du détail suivent leur dépense (internet aussi)', r.internet && r.internet.compte === 'cpt_2', r.internet);
    v('  → une ligne de détail qui a SON compte le garde (eau spéciale → Livret, cpt_3)', r.eau && r.eau.compte === 'cpt_3', r.eau);
    v('  → une dépense SANS compte reste sur le compte par défaut (cinéma → Courant)', r.cinema && r.cinema.compte === 'cpt_1', r.cinema);
    //  ce que montre la puce de la liste à l'écran
    const puce = await page.evaluate(() => {
        const ligne = [...document.querySelectorAll('#pilotage-inbox [data-tache]')].find(x => /elect marrakech villa/.test(x.textContent));
        return ligne ? ligne.textContent.replace(/\s+/g, ' ') : null;
    });
    v('  → à l\'écran, la ligne de la liste affiche le compte Assafa', puce && /Assafa/i.test(puce) && !/Courant/.test(puce.replace(/Compte Courant/g, '')), puce);
    v('aucune erreur JavaScript', erreurs.length === 0, erreurs[0] || '');
    await page.close();
} finally { await browser.close(); srv.close(); }
console.log(ko === 0 ? '\n  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `\n  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
