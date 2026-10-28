/**
 * v37.75 — LE PILOTAGE DIT OÙ EN EST CHAQUE COMPTE · LA BONNE VERSION SUR LE TÉLÉPHONE.
 *
 *   « Ajouter la somme sur chaque compte à l'instant pour comparer le réalisé avec ce qui est attendu,
 *     et une grande case où c'est écrit quel compte est concerné. »
 *   Décor fictif (KARIM TESTEUR), dimanche 1er nov. 2026, paie le 27 (cycle du 27 oct. au 26 nov.) :
 *     • Épargne LT 1 000 : un choc de 6 000 le 15 nov., puis 8 000 reçus du Livret le 22 → plonge à
 *       − 5 000 le 15 et finit à + 3 000 : la liste le montre, la grande case dit quoi virer, d'où, avant quand ;
 *     • Livret 30 000 (ne fait que donner) ; Coffre 400 (immobile) ; Bourse (non liquide, absente).
 *   « Toujours il ne reconnaît pas » : le téléphone tournait sur une ancienne version de l'appli.
 *     A. statique · B. vos comptes · C. la grande case · D. la version du serveur.
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
const nf = (x) => new Intl.NumberFormat('fr-FR').format(x).replace(/\s/g, ' ');
const sans = (s) => String(s || '').replace(/\s/g, '');
console.log('\n  VOS COMPTES DANS LE CYCLE · LA BONNE VERSION\n  ' + '─'.repeat(80));

v('A. « 🏦 Vos comptes » : colonnes Aujourd’hui / Au plus bas / Fin cycle ; la grande case des virements',
  /🏦 Vos comptes/.test(html) && /data-meteo-colonnes/.test(html) && /data-meteo-atterrissage-t0/.test(html) && /data-meteo-atterrissage-bas/.test(html)
  && /<div v-if="meteo\.virements && meteo\.virements\.length && !\(meteo\.decouverts && meteo\.decouverts\.length\)" data-meteo-virements/.test(html) && !/data-meteo-logistique>/.test(html));
v('  → la version du serveur lue à l\'ouverture et au retour sur l\'onglet (rechargement, ou bandeau si non sauvegardé)',
  /document\.addEventListener\('visibilitychange', _versionAuRetour\)/.test(html) && /const m = \/const CURRENT_VERSION = "\(\[\^"\]\+\)"\/\.exec/.test(html) && /data-nouvelle-version/.test(html));

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
    fx.comptes = [{ id: 800, label: 'Compte Courant', type: 'liquide', solde: 20000, icone: '💳' },
                  { id: 801, label: 'Épargne Long Terme', type: 'epargne', solde: 1000, icone: '🐷' },
                  { id: 802, label: 'Livret Réserve', type: 'epargne', solde: 30000, icone: '🏦' },
                  { id: 803, label: 'Coffre', type: 'liquide', solde: 400, icone: '🔒' },
                  { id: 804, label: 'Bourse / CTO', type: 'investissement', solde: 9000, icone: '📈' }];
    const d = fx.donneesAnnuelles[2026];
    d.epargne = []; d.consoRealiseeT0 = {}; d.consoClotureT0 = {}; d.banqueOperations = {}; d.transactionsReelles = [];
    d.depensesIrregulieres = [{ id: 701, mois: 11, annee: 2026, nom: 'Travaux', montant: 6000, sourceCompte: 'cpt_801', jourPrevu: 15, paye: false, montantPaye: 0 }];
    d.virementsInternes = [{ id: 702, mois: 11, sourceCompte: 'cpt_802', destinationCompte: 'cpt_801', montant: 8000, jourPrevu: 22 }];
    return fx;
};
const page0 = html
    .replace('<script src="https://unpkg.com/vue@3/dist/vue.global.js"', '<script src="/vue.js"')
    .replace('<script src="https://cdn.jsdelivr.net/npm/chart.js"', '<script src="/chart.js"')
    .replace(/<script src="https:\/\/cdn\.tailwindcss\.com"[^>]*><\/script>/, '')
    .replace(/<script[^>]*src="https:\/\/[^"]*"[^>]*><\/script>/g, '');
let serveurPlusRecent = false, lecturesVersion = 0;
const srv = http.createServer((req, res) => {
    const [p, q = ''] = req.url.split('?');
    const s = (c, b, t = 'application/json') => { res.writeHead(c, { 'Content-Type': t }); res.end(b); };
    if (p === '/finance/') {
        if (/(^|&)version=/.test(q)) { lecturesVersion++; if (serveurPlusRecent) return s(200, page0.replace(/const CURRENT_VERSION = "[^"]+"/, 'const CURRENT_VERSION = "99.0 Test"'), 'text/html; charset=utf-8'); }
        return s(200, page0, 'text/html; charset=utf-8');
    }
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
const T0 = new Date(2026, 10, 1, 10, 0, 0);
const ouvrir = async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.clock.setFixedTime(T0);
    page.on('pageerror', e => erreurs.push(String(e)));
    await page.route('**/webhook/**', route => route.abort());
    await page.goto(`http://127.0.0.1:${port}/finance/`, { waitUntil: 'load' });
    await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState.moisBudgetaire; }, null, { timeout: 30000 });
    await page.waitForTimeout(1200);
    await page.evaluate(async (ST) => { const st = eval(ST); st.appMode = 'reel'; await new Promise(r => setTimeout(r, 250)); st.activeTab = 'pilotage'; }, ST);
    await page.waitForTimeout(800);
    return { ctx, page };
};
const lire = (page) => page.evaluate(() => {
    const m = document.querySelector('[data-meteo]');
    const L = m ? [...m.querySelectorAll('[data-meteo-atterrissage]')].map(l => ({ cle: l.dataset.compte, nom: l.querySelector('[data-meteo-atterrissage-nom]')?.textContent.trim(),
        t0: l.querySelector('[data-meteo-atterrissage-t0]')?.textContent.trim(), bas: l.querySelector('[data-meteo-atterrissage-bas] > span')?.textContent.trim(),
        basQuand: l.querySelector('[data-meteo-atterrissage-bas-quand]')?.textContent.trim(), basRouge: /text-rose-300/.test(l.querySelector('[data-meteo-atterrissage-bas]')?.className || ''),
        fin: l.querySelector('[data-meteo-atterrissage-montant]')?.textContent.replace(/\s+/g, ' ').trim() })) : [];
    const V = m ? [...m.querySelectorAll('[data-meteo-virement]')].map(b => ({ cle: b.dataset.compte, montant: b.querySelector('[data-meteo-virement-montant]')?.textContent.replace(/\s+/g, ' ').trim(),
        vers: b.querySelector('[data-meteo-virement-vers]')?.textContent.replace(/\s+/g, ' ').trim(), depuis: b.querySelector('[data-meteo-virement-depuis]')?.textContent.replace(/\s+/g, ' ').trim(),
        quand: b.querySelector('[data-meteo-virement-quand]')?.textContent.replace(/\s+/g, ' ').trim() })) : [];
    return { L, V, titre: m?.querySelector('[data-meteo-virements] p')?.textContent.trim(), colonnes: m?.querySelector('[data-meteo-colonnes]')?.textContent.replace(/\s+/g, ' ').trim() };
});

try {
    const { ctx, page } = await ouvrir();
    await section('B', async () => {
        const e = await lire(page);
        const el = e.L.find(x => x.cle === 'cpt_801') || {}, lr = e.L.find(x => x.cle === 'cpt_802') || {}, cf = e.L.find(x => x.cle === 'cpt_803') || {};
        v('B. une ligne par compte réel liquide : Courant, Épargne LT, Livret, Coffre (pas la Bourse)',
          e.L.map(x => x.cle).join(',') === 'cpt_800,cpt_801,cpt_802,cpt_803' && /Aujourd’huiAuplusbasFincycle$/.test(sans(e.colonnes)) && /^🏦Voscomptesle/.test(sans(e.colonnes)), JSON.stringify([e.L.map(x => x.cle), e.colonnes]));
        v('  → Épargne LT : aujourd’hui + 1 000, au plus bas − 5 000 le 15 nov. (en rouge), fin de cycle + 3 000',
          sans(el.t0) === '+' + sans(nf(1000)) && sans(el.bas) === '−' + sans(nf(5000)) && el.basQuand === '15 nov.' && el.basRouge && sans(el.fin) === '+' + sans(nf(3000)) + 'DH', JSON.stringify(el));
        v('  → Livret : + 30 000 aujourd’hui, au plus bas + 22 000 le 22 nov. ; Coffre immobile : + 400, « aujourd’hui »',
          sans(lr.t0) === '+' + sans(nf(30000)) && sans(lr.bas) === '+' + sans(nf(22000)) && lr.basQuand === '22 nov.' && !lr.basRouge && sans(lr.fin) === '+' + sans(nf(22000)) + 'DH'
          && sans(cf.t0) === '+400' && sans(cf.bas) === '+400' && cf.basQuand === 'aujourd’hui' && sans(cf.fin) === '+400DH', JSON.stringify([lr, cf]));
        const t0s = await page.evaluate((ST) => Object.fromEntries(eval(ST).comptes.map(c => ['cpt_' + c.id, c.solde])), ST);
        v('  → « aujourd’hui » = le solde réel du compte (celui de la banque)', e.L.every(x => sans(x.t0).replace(/^[+−]/, '') === sans(nf(Math.abs(t0s[x.cle])))), JSON.stringify([t0s, e.L.map(x => x.t0)]));
    });

    await section('C', async () => {
        const e = await lire(page);
        const b = e.V.find(x => x.cle === 'cpt_801') || {};
        v('C. la grande case : « Virement à prévoir », 5 000 DH VERS Épargne Long Terme (nom complet)',
          /Virement à prévoir — pour tenir jusqu’au/.test(e.titre || '') && sans(b.montant) === sans(nf(5000)) + 'DH' && /^vers ÉL Épargne Long Terme$/.test(b.vers || ''), JSON.stringify([e.titre, b]));
        v('  → DEPUIS Livret Réserve, avant le 15 nov. ; sans lui, − 5 000 le 15 nov.',
          /^depuis LR Livret Réserve$/.test(b.depuis || '') && /^avant le 15 nov\. — sans lui, .+ descendrait à [−-]\s?5\s?000 DH le 15 nov\.$/.test(b.quand || ''), JSON.stringify(b));
        //  Un trou de 59 000 : le Livret (70 000, dont 62 000 partent le 22) n'a plus que 8 000 de marge, le Courant pas assez
        await page.evaluate(async (ST) => { const st = eval(ST), d = st.donneesAnnuelles[2026];
            st.comptes.find(c => c.id === 802).solde = 70000; d.depensesIrregulieres[0].montant = 60000; d.virementsInternes[0].montant = 62000;
            st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 400)); }, ST);
        const e2 = await lire(page);
        const b2 = e2.V.find(x => x.cle === 'cpt_801') || {};
        v('  → aucun compte ne couvre seul (Livret à 2 000) : la case le dit, en clair',
          sans(b2.montant) === sans(nf(59000)) + 'DH' && /^depuis : aucun compte ne couvre seul ce montant — à répartir$/.test(b2.depuis || ''), JSON.stringify(e2.V));
    });

    await section('D', async () => {
        //  1. Le serveur a une version plus récente, rien n'est à sauvegarder : l'appli se recharge seule — une fois
        serveurPlusRecent = true;
        await page.evaluate((ST) => { eval(ST).serverSyncStatus = 'synced'; }, ST);
        await page.clock.setFixedTime(new Date(T0.getTime() + 120000));
        const nav = page.waitForNavigation({ timeout: 15000 }).catch(() => null);
        await page.evaluate((ST) => { eval(ST).verifierVersion(); }, ST);
        await nav;
        v('D. version plus récente sur le serveur : l\'appli se recharge seule (« ?v=99.0 Test »)', /\?v=99\.0%20Test/.test(page.url()), page.url());
        await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance; }, null, { timeout: 30000 });
        await page.waitForTimeout(5500);
        const apres = await page.evaluate(() => ({ url: location.href, bandeau: document.querySelector('[data-nouvelle-version]')?.textContent.replace(/\s+/g, ' ').trim() }));
        v('  → la même version toujours annoncée après le rechargement : pas de boucle, un bandeau « Recharger »',
          /\?v=99\.0%20Test/.test(apres.url) && /Version 99\.0 Test disponible/.test(apres.bandeau || ''), JSON.stringify(apres));
        //  2. Des saisies non sauvegardées : jamais de rechargement, le bandeau
        const { ctx: ctx2, page: p2 } = await ouvrir();
        await p2.evaluate((ST) => { eval(ST).serverSyncStatus = 'modified'; }, ST);
        await p2.clock.setFixedTime(new Date(T0.getTime() + 600000));
        const url0 = p2.url();
        await p2.evaluate(async (ST) => { await eval(ST).verifierVersion(); await new Promise(r => setTimeout(r, 300)); }, ST);
        const m = await p2.evaluate(() => ({ url: location.href, bandeau: !!document.querySelector('[data-nouvelle-version]') }));
        v('  → modifications non sauvegardées : pas de rechargement, le bandeau seulement', m.url === url0 && m.bandeau, JSON.stringify(m));
        //  3. Même version : rien
        serveurPlusRecent = false;
        await p2.evaluate((ST) => { const st = eval(ST); st.nouvelleVersion = ''; st.serverSyncStatus = 'synced'; }, ST);
        await p2.clock.setFixedTime(new Date(T0.getTime() + 1200000));
        const r = await p2.evaluate(async (ST) => { const v = await eval(ST).verifierVersion(); return [v, location.href, !!document.querySelector('[data-nouvelle-version]')]; }, ST);
        v('  → même version : rien ne bouge ; relecture au plus une fois par minute', r[1] === url0 && !r[2] && /^37\./.test(String(r[0])) && lecturesVersion >= 3, JSON.stringify([r, lecturesVersion]));
        await ctx2.close();
    });
    await ctx.close();
    v('aucune erreur JavaScript', erreurs.length === 0, erreurs[0] || '');
} finally {
    await browser.close();
    srv.close();
}
console.log(ko === 0 ? '\n  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `\n  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
