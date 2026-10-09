/**
 * v37.40 — AJOUTER, MODIFIER, METTRE EN PAUSE, RETIRER UN JOURNAL, DEPUIS L'ÉCRAN.
 * v37.42 — le 🧪 essaie chaque porte du média (Google, Bing, sa page de recherche, sa page
 *          d'accueil), toutes lues sans RSS ; GET dit ce qui manque au PHP du serveur.
 *
 *   La scène, jouée pour de vrai : PostgreSQL jetable, les VRAIS
 *   cfo_veille_sources.php et cfo_veille_presse.php sous `php -S`, une presse
 *   simulée qui note chaque requête reçue, et un vrai navigateur qui clique
 *   dans la fenêtre « Sources de la revue de presse » comme vous le feriez.
 *
 *     A. Le serveur : la liste d'origine, les verrous, les saisies refusées
 *        (rien n'est écrit).
 *     B. L'écran : ajouter (adresse collée), modifier, mettre en pause,
 *        retirer puis rétablir, tester — et la revue de presse suit vos
 *        réglages. Une mise à jour qui livre un nouveau média ne ressuscite pas
 *        celui que vous avez retiré. Sans base : lecture seule, dit.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..');
let ko = 0, n = 0;
const v = (t, ok, d = '') => { n++; if (!ok) ko++; console.log(`  ${ok ? '✅' : '❌'} ${t.padEnd(76)} ${ok ? '' : d}`); };
console.log('\n  MÉDIAS RÉGLABLES DEPUIS L\'ÉCRAN — PostgreSQL, php -S, navigateur\n  ' + '─'.repeat(92));

const require = createRequire(import.meta.url);
const essai = (f) => { try { return f(); } catch { return null; } };
const pw = essai(() => require('playwright-core'));
const vueJs = essai(() => require.resolve('vue/dist/vue.global.js'));
const chartJs = essai(() => fs.existsSync(path.join(RACINE, 'node_modules/chart.js/dist/chart.umd.js')) && path.join(RACINE, 'node_modules/chart.js/dist/chart.umd.js'));
const chromium = process.env.CHROMIUM || ['/opt/pw-browsers/chromium'].find(p => essai(() => fs.existsSync(p) && fs.statSync(p).isFile()));
const php = essai(() => execFileSync('which', ['php']).toString().trim());
const pgBin = ['/usr/lib/postgresql/16/bin', '/usr/lib/postgresql/15/bin', '/usr/lib/postgresql/14/bin'].find(p => fs.existsSync(path.join(p, 'initdb')));
const fin = () => { console.log('  ' + '─'.repeat(92)); console.log(ko === 0 ? `  ✅ TOUT PASSE — ${n} contrôles` : `  ❌ ${ko} contrôle(s) en échec sur ${n}`); process.exit(ko === 0 ? 0 : 1); };
if (!pw || !vueJs || !chartJs || !chromium || !php || !pgBin || process.env.SANS_PG) { console.log('  ⏭️  ignoré (playwright-core, vue, chart.js, Chromium, php ou PostgreSQL absent)'); fin(); }

const portLibre = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const attendre = (ms) => new Promise(r => setTimeout(r, ms));
const attendrePort = async (port) => {
    for (let i = 0; i < 80; i++) {
        if (await new Promise(r => { const c = net.connect(port, '127.0.0.1', () => { c.end(); r(true); }); c.on('error', () => r(false)); })) return;
        await attendre(100);
    }
    throw new Error('port ' + port + ' muet');
};

/* ── PostgreSQL jetable ──────────────────────────────────────────────── */
const pgPort = await portLibre();
const pgDir = fs.mkdtempSync(path.join('/var/tmp', 'pg-sources-'));
execFileSync('chown', ['postgres:postgres', pgDir]);
const en = (cmd, args) => execFileSync('runuser', ['-u', 'postgres', '--', path.join(pgBin, cmd), ...args], { stdio: 'ignore' });
en('initdb', ['-D', pgDir + '/data', '-A', 'trust', '-U', 'postgres']);
en('pg_ctl', ['-D', pgDir + '/data', '-o', `-p ${pgPort} -k ${pgDir} -c listen_addresses=127.0.0.1`, '-l', pgDir + '/log', '-w', 'start']);
const arreterPg = () => { try { en('pg_ctl', ['-D', pgDir + '/data', '-m', 'immediate', 'stop']); } catch (_) {} };
execFileSync('psql', ['-h', '127.0.0.1', '-p', String(pgPort), '-U', 'postgres', '-c', 'CREATE DATABASE finance'], { stdio: 'ignore' });
const sql = (q) => execFileSync('psql', ['-h', '127.0.0.1', '-p', String(pgPort), '-U', 'postgres', '-d', 'finance', '-At', '-q', '-c', q]).toString().trim();
const enBase = () => { const t = essai(() => sql('SELECT donnees::text FROM cfo_veille_sources WHERE id = 1')); return t ? JSON.parse(t) : null; };

/* ── La presse, simulée : elle note chaque requête ──────────────────── */
const recues = [];
const rss = (items) => '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel>' + items.map(i =>
    `<item><title>${i[0]}</title><link>${i[1]}</link><pubDate>${i[2]}</pubDate><source url="https://${i[3]}">${i[4]}</source></item>`).join('') + '</channel></rss>';
const presse = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x'); const q = u.searchParams.get('q') || '';
    recues.push({ chemin: u.pathname, q, hote: u.host, s: u.searchParams.get('s') });
    // v37.41 : ce serveur sert aussi de PROXY HTTP à PHP — il joue le site marrakechtoday.ma, SANS RSS :
    //   sa recherche rend une page HTML WordPress (« نتائج البحث عن … » / « Résultats pour … »).
    if (u.host === 'marrakechtoday.ma') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        // v37.42 : sa page d'accueil — un bloc de une (« widget ») et un <article>
        if (u.searchParams.get('s') === null) return res.end(`<!DOCTYPE html><html><head><title>Marrakech Today — l'actualité de Marrakech</title></head><body>
            <nav class="menu"><a href="http://marrakechtoday.ma/category/immobilier/">Immobilier et foncier à Marrakech</a></nav>
            <article><h3><a href="http://marrakechtoday.ma/2026/10/07/kawkab/">Le Kawkab s'impose dans le derby régional face au MAS</a></h3></article>
            <div class="widget une"><h2><a href="http://marrakechtoday.ma/2026/10/08/agence-urbaine-rn9/">L'Agence urbaine ouvre la bande RN9 aux activités logistiques</a></h2></div></body></html>`);
        const terme = u.searchParams.get('s') || '';
        const resultats = terme === 'Marrakech' ? `
            <article><h2><a href="http://marrakechtoday.ma/2026/10/05/tamansourt-lotissement/">Tamansourt : un nouveau lotissement autorisé par la commune</a></h2><time datetime="2026-10-05">5 oct.</time></article>
            <article><h2><a href="http://marrakechtoday.ma/2026/09/21/rocade-nord/">Marrakech : la rocade nord avance vers la RN9</a></h2><time datetime="2026-09-21">21 sept.</time></article>` : '<p>Aucun résultat.</p>';
        return res.end(`<!DOCTYPE html><html><head><title>Résultats pour ${terme} - Marrakech Today</title></head><body>
            <nav class="menu"><a href="http://marrakechtoday.ma/category/immobilier/">Immobilier et foncier à Marrakech</a></nav>
            <main><h1>Résultats pour : ${terme}</h1>${resultats}</main>
            <aside class="sidebar"><h3><a href="http://marrakechtoday.ma/2026/10/08/foot/">Le Kawkab s'impose dans le derby régional</a></h3></aside></body></html>`);
    }
    res.writeHead(200, { 'Content-Type': 'application/rss+xml; charset=utf-8' });
    // v37.42 : Bing Actualités enrobe le lien de l'article (apiclick.aspx?…&url=…)
    if (u.pathname === '/bing') return res.end(!q.startsWith('site:marrakechtoday.ma') ? rss([]) : '<?xml version="1.0" encoding="utf-8"?><rss version="2.0"><channel><title>Bing</title>'
        + '<item><title>Tamansourt : la commune lance la révision du plan d\'aménagement</title><link>http://www.bing.com/news/apiclick.aspx?ref=FexRss&amp;aid=&amp;tid=T9&amp;'
        + 'url=https%3a%2f%2fmarrakechtoday.ma%2f2026%2f09%2f30%2fplan-tamansourt%2f&amp;c=1&amp;mkt=fr-ma</link><pubDate>Wed, 30 Sep 2026 08:00:00 GMT</pubDate></item></channel></rss>');
    if (q.startsWith('site:marrakechtoday.ma')) return res.end(rss([
        ['Tamansourt : un nouveau lotissement autorisé - Marrakech Today', 'https://news.google.com/rss/articles/T1', 'Mon, 05 Oct 2026 08:00:00 GMT', 'marrakechtoday.ma', 'Marrakech Today'],
        ['Marrakech : la rocade nord avance - Marrakech Today', 'https://news.google.com/rss/articles/T2', 'Mon, 21 Sep 2026 08:00:00 GMT', 'marrakechtoday.ma', 'Marrakech Today']]));
    res.end(rss([]));
});
const pPresse = await portLibre();
await new Promise(r => presse.listen(pPresse, '127.0.0.1', r));

/* ── Le docroot, comme le VPS ─────────────────────────────────────────── */
const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8'));
const Y = new Date().getFullYear();
const base = fx.donneesAnnuelles[Object.keys(fx.donneesAnnuelles)[0]];
fx.donneesAnnuelles = { [Y]: JSON.parse(JSON.stringify(base)), [Y + 1]: JSON.parse(JSON.stringify(base)) };
fx.soldesInitiaux.anneeActuelle = Y;
fx.masterAssets = [{ id: 'ma_5', name: 'Terrain Nord (Ouahat Sidi Brahim)', type: 'Terrain Nu', isProductive: false, value: 11200000, revenue: 0, taux_credit: 0,
    annees_total: 0, annees_restantes: 0, val_pessimiste: 0, val_optimiste: 0, quotePart: '35%', apport_personnel: 0, montant_credit: 0, valeur_actuelle: 0, surface_totale: 70000 }];
const CAPTURES = process.env.CAPTURES || '';
let tw = '';
if (CAPTURES) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-sources-'));
    fs.writeFileSync(path.join(tmp, 'in.css'), '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
    fs.writeFileSync(path.join(tmp, 'cfg.js'), 'module.exports={content:[' + JSON.stringify(path.join(RACINE, 'index.html')) + '],theme:{extend:{}}};');
    execFileSync(path.join(RACINE, 'node_modules/.bin/tailwindcss'), ['-c', path.join(tmp, 'cfg.js'), '-i', path.join(tmp, 'in.css'), '-o', path.join(tmp, 'out.css'), '--minify'], { stdio: 'ignore' });
    tw = fs.readFileSync(path.join(tmp, 'out.css'), 'utf8');
    fs.mkdirSync(CAPTURES, { recursive: true });
}
const html = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8')
    .replace('<script src="https://unpkg.com/vue@3/dist/vue.global.js"', '<script src="/vue.js"')
    .replace('<script src="https://cdn.jsdelivr.net/npm/chart.js"', '<script src="/chart.js"')
    .replace(/<script src="https:\/\/cdn\.tailwindcss\.com"[^>]*><\/script>/, CAPTURES ? '<link rel="stylesheet" href="/tailwind.css">' : '')
    .replace(/<script[^>]*src="https:\/\/[^"]*"[^>]*><\/script>/g, '');
const doc = fs.mkdtempSync(path.join(os.tmpdir(), 'sources-'));
const F = path.join(doc, 'finance');
fs.mkdirSync(F);
fs.writeFileSync(path.join(F, 'index.html'), html);
for (const f of ['save_data.php', 'cfo_veille_presse.php', 'cfo_veille_lib.php', 'cfo_veille_serveur.php', 'cfo_veille_sources.php'])
    if (fs.existsSync(path.join(RACINE, f))) fs.copyFileSync(path.join(RACINE, f), path.join(F, f));   // absents sur une version antérieure
fs.writeFileSync(path.join(F, 'finance_data.json'), JSON.stringify(fx));
// Les VRAIES sources d'origine ; Google redirigé vers la presse simulée. Les flux d'origine sont
// retirés ici : sur le VPS ils sont sur le site du média, ici ils pointeraient sur 127.0.0.1.
const SRC = JSON.parse(fs.readFileSync(path.join(RACINE, 'veille_sources.json'), 'utf8'));
const ecrireSources = (sources) => fs.writeFileSync(path.join(F, 'veille_sources.json'), JSON.stringify({ ...SRC, delai_s: 2,
    moteurs: SRC.moteurs.map(m => ({ ...m, gabarit: m.role === 'site' ? `http://127.0.0.1:${pPresse}/bing?q={q}` : `http://127.0.0.1:${pPresse}/gnews?q={q}&hl=${m.langue}` })),
    sources: sources.map(({ flux, ...s }) => s) }));
ecrireSources(SRC.sources);
const NB = SRC.sources.length;
const DBCFG = `<?php return ['host' => '127.0.0.1', 'port' => '${pgPort}', 'dbname' => 'finance', 'user' => 'postgres', 'password' => ''];`;
fs.writeFileSync(path.join(F, 'db_config.php'), DBCFG);
fs.copyFileSync(vueJs, path.join(doc, 'vue.js'));
fs.copyFileSync(chartJs, path.join(doc, 'chart.js'));
if (CAPTURES) fs.writeFileSync(path.join(doc, 'tailwind.css'), tw);
const port = await portLibre();
// PHP (curl) passe par la presse simulée pour les sites en http:// — 127.0.0.1 reste direct (no_proxy)
const srv = spawn(php, ['-S', '127.0.0.1:' + port, '-t', doc], { stdio: 'ignore', env: { ...process.env,
    http_proxy: `http://127.0.0.1:${pPresse}`, HTTP_PROXY: `http://127.0.0.1:${pPresse}`, no_proxy: '127.0.0.1,localhost', NO_PROXY: '127.0.0.1,localhost' } });
await attendrePort(port);
const BASE = `http://127.0.0.1:${port}/finance/`;
const appel = async (corps, entetes = { 'X-Requested-With': 'XMLHttpRequest' }) => {
    const r = await fetch(BASE + 'cfo_veille_sources.php', corps ? { method: 'POST', headers: { 'Content-Type': 'application/json', ...entetes }, body: JSON.stringify(corps) } : {});
    const t = await r.text(); let d = null; try { d = JSON.parse(t); } catch (_) {}
    return { code: r.status, d, t };
};

let browser = null;
const partie = async (nom, f) => { try { await f(); } catch (e) { v(nom + ' : sans exception', false, String(e && e.stack || e).slice(0, 400)); } };
try {
  await partie('A', async () => {
    console.log('  ── A. serveur : liste d\'origine, verrous, saisies refusées');
    const g = await appel(null);
    v(`GET : la liste d'origine (${NB} médias), stockage PostgreSQL`, g.code === 200 && g.d?.sources?.length === NB && g.d.stockage === 'postgres'
      && g.d.sources.every(s => s.origine === 'origine'), g.t.slice(0, 200));
    const liste = g.d?.sources || [];
    v('GET : ce que le PHP du serveur sait faire — ici curl présent, mode parallèle, rien à installer',
      g.d?.prerequis?.mode_reseau === 'parallele' && Array.isArray(g.d.prerequis.manquants) && g.d.prerequis.manquants.length === 0 && g.d.prerequis.commande === '', JSON.stringify(g.d?.prerequis));
    v('POST sans X-Requested-With → 400', (await appel({ action: 'enregistrer', sources: liste }, {})).code === 400);
    v('POST d\'une autre origine → 403', (await appel({ action: 'enregistrer', sources: liste }, { 'X-Requested-With': 'XMLHttpRequest', Origin: 'https://evil.example' })).code === 403);
    const loc = await appel({ action: 'enregistrer', sources: [...liste, { nom: 'Interne', domaine: 'localhost', portee: 'locale', langue: 'fr' }] });
    v('« localhost » refusé, avec la raison', loc.code === 400 && loc.d?.error === 'SOURCES_INVALIDES' && /n'est pas l'adresse d'un site/.test(loc.d.message), loc.t.slice(0, 200));
    const ail = await appel({ action: 'enregistrer', sources: [...liste, { nom: 'Média', domaine: 'exemple.ma', portee: 'locale', langue: 'fr', flux: 'https://evil.example/?q={q}' }] });
    v('flux hors du site du média refusé, avec la raison', ail.code === 400 && /doit être sur le site du média/.test(ail.d?.message || ''), ail.t.slice(0, 200));
    v('61 médias refusés', (await appel({ action: 'enregistrer', sources: Array.from({ length: 61 }, (_, i) => ({ nom: 'M' + i, domaine: `m${i}.ma`, portee: 'locale', langue: 'fr' })) })).code === 400);
    v('après ces refus, rien n\'est écrit en base', enBase() === null);
    v('action inconnue → 400', (await appel({ action: 'detruire' })).code === 400);
  });

  console.log('  ── B. l\'écran : ajouter, modifier, pause, retirer, rétablir, tester');
  browser = await pw.chromium.launch({ executablePath: chromium, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  await ctx.route('**/get_ai_memory.php*', (route) => route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ok', rag: { regles: [] } }) }));
  await ctx.route('https://n8n.beau.ink/**', async (route) => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } });
      await route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ html: '<p>ok</p>' }) });
  });
  const page = await ctx.newPage();
  const erreurs = []; page.on('pageerror', e => erreurs.push(String(e)));
  page.on('dialog', d => d.accept());
  const ST = 'document.querySelector("#app").__vue_app__._instance.setupState';
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && Array.isArray(a.__vue_app__._instance.setupState.masterAssets); }, null, { timeout: 30000 });
  await page.waitForTimeout(500);
  const ligne = (dom) => page.$(`[data-vs-source][data-domaine="${dom}"]`);
  const texteLigne = async (dom) => { const l = await ligne(dom); return l ? (await l.textContent()).replace(/\s+/g, ' ') : ''; };
  const calme = () => page.waitForFunction((ST) => { const S = eval(ST); return !S.veilleSources.enregistrement && !S.veilleSources.chargement; }, ST, { timeout: 15000 });

  await partie('B', async () => {
    await page.evaluate((ST) => { eval(ST).activeTab = 'supervision'; }, ST);
    await page.waitForTimeout(300);
    await page.click('[data-sup-sources]');
    await page.waitForSelector('[data-vs-modale] [data-vs-source]', { timeout: 10000 });
    v('Supervision IA → « 📰 Sources presse » ouvre la fenêtre', !!(await page.$('[data-vs-modale]')));
    v('  → rien ne manque au PHP du serveur : pas de bandeau de prérequis', !(await page.$('[data-vs-prerequis]')));
    const nbLoc = SRC.sources.filter(s => s.portee === 'locale').length;
    v(`les ${NB} médias, groupés : presse locale (${nbLoc}) et nationale (${NB - nbLoc})`,
      (await page.$$('[data-vs-source]')).length === NB && (await page.$$('[data-vs-groupe="locale"] [data-vs-source]')).length === nbLoc);

    // ── ajouter, en collant une adresse complète
    await page.click('[data-vs-ajouter]');
    await page.fill('[data-vs-nom]', 'Marrakech Today');
    await page.fill('[data-vs-domaine]', 'https://www.marrakechtoday.ma/actualites/foncier?page=2');
    await page.selectOption('[data-vs-portee]', 'locale');
    await page.selectOption('[data-vs-langue]', 'fr');
    await page.check('[data-vs-wordpress]');
    await page.click('[data-vs-valider]'); await calme();
    v('ajouter : le message le confirme', /Marrakech Today ajouté/.test(await page.textContent('[data-vs-message]').catch(() => '')));
    v('  → la ligne apparaît, « ajoutée par vous », « recherche du site »', /ajoutée par vous/.test(await texteLigne('marrakechtoday.ma')) && /recherche du site/.test(await texteLigne('marrakechtoday.ma')));
    const b1 = enBase();
    const mt = (b1?.sources || []).find(s => s.domaine === 'marrakechtoday.ma');
    v('  → en base : domaine extrait de l\'adresse collée, recherche WordPress (RSS ou page) sur son site', mt && mt.flux === 'https://marrakechtoday.ma/?s={q}' && !('origine' in mt), JSON.stringify(mt));

    // ── une saisie refusée : rien ne change
    await page.click('[data-vs-ajouter]');
    await page.fill('[data-vs-nom]', 'Intranet');
    await page.fill('[data-vs-domaine]', 'localhost');
    await page.click('[data-vs-valider]'); await calme();
    v('saisie refusée : la raison s\'affiche, le formulaire reste ouvert', /n'est pas l'adresse d'un site/.test(await page.textContent('[data-vs-erreur]').catch(() => '')) && !!(await page.$('[data-vs-form]')));
    v('  → la base n\'a pas bougé', JSON.stringify(enBase()) === JSON.stringify(b1));
    await page.click('[data-vs-form] button:has-text("Annuler")');

    // ── modifier
    await (await ligne('ledesk.ma')).$('[data-vs-modifier]').then(b => b.click());
    await page.selectOption('[data-vs-portee]', 'locale');
    await page.click('[data-vs-valider]'); await calme();
    v('modifier : Le Desk passe en presse locale, « modifiée »', /modifiée/.test(await texteLigne('ledesk.ma')) && !!(await page.$('[data-vs-groupe="locale"] [data-domaine="ledesk.ma"]')));

    // ── mettre en pause
    await (await ligne('hespress.com')).$('[data-vs-actif]').then(b => b.click()); await calme();
    v('pause : Hespress « en pause », actif=false en base', /en pause/.test(await texteLigne('hespress.com')) && enBase().sources.find(s => s.domaine === 'hespress.com').actif === false);

    // ── retirer
    await (await ligne('kech24.com')).$('[data-vs-supprimer]').then(b => b.click()); await calme();
    v('retirer : Kech24 disparaît, proposé au rétablissement', !(await ligne('kech24.com')) && /Kech24/.test(await page.textContent('[data-vs-supprimees]').catch(() => '')));

    // ── tester
    // ── modifier sa recherche : adresse saisie à la main (le site n'a pas de RSS)
    await (await ligne('marrakechtoday.ma')).$('[data-vs-modifier]').then(b => b.click());
    v('modifier : la case WordPress est reconnue cochée', await page.isChecked('[data-vs-wordpress]'));
    await page.uncheck('[data-vs-wordpress]');
    await page.fill('[data-vs-flux]', 'http://marrakechtoday.ma/?s={q}');
    await page.click('[data-vs-valider]'); await calme();
    v('  → adresse de recherche enregistrée', enBase().sources.find(s => s.domaine === 'marrakechtoday.ma')?.flux === 'http://marrakechtoday.ma/?s={q}');
    await (await ligne('marrakechtoday.ma')).$('[data-vs-tester]').then(b => b.click());
    await page.waitForFunction(() => { const t = document.querySelector('[data-domaine="marrakechtoday.ma"] [data-vs-test]'); return t && !/Test en cours/.test(t.textContent); }, null, { timeout: 15000 });
    const test = (await page.textContent('[data-domaine="marrakechtoday.ma"] [data-vs-test]')).replace(/\s+/g, ' ');
    v('tester : Google Actualités sur ce site — 2 articles, le dernier cité', /✅ Google Actualités \(FR\) : 2 articles — dernier : « Tamansourt : un nouveau lotissement autorisé » \(2026-10-05\)/.test(test), test);
    v('  → chaque porte est dite en clair, dans l\'ordre (jamais « HTTP 0 »)', (await page.$$eval('[data-domaine="marrakechtoday.ma"] [data-vs-canal]', els => els.map(e => e.dataset.vsCanal))).join() === 'moteur,bing,recherche,accueil'
      && !/HTTP 0/.test(test), test);
    v('  → Bing Actualités : 1 article, le lien du journal extrait de l\'enrobage de Bing',
      /✅ Bing Actualités : 1 article — dernier : « Tamansourt : la commune lance la révision du plan d'aménagement » \(2026-09-30\)/.test(test), test);
    v('  → site SANS RSS : sa page de recherche est lue en HTML — 2 articles, le menu et la barre latérale écartés',
      /✅ Page de recherche du site \(lue en HTML\) : 2 articles — dernier : « Tamansourt : un nouveau lotissement autorisé par la commune » \(2026-10-05\)/.test(test), test);
    v('  → sa page d\'accueil aussi : 2 titres à la une (le menu écarté)', /✅ Page d'accueil \(lue en HTML\) : 2 titres à la une — en tête : « /.test(test), test);
    v('  → le site a bien été interrogé avec « Marrakech », et sur son accueil', recues.some(x => x.hote === 'marrakechtoday.ma' && x.s === 'Marrakech')
      && recues.some(x => x.hote === 'marrakechtoday.ma' && x.chemin === '/' && x.s === null));
    v('  → la presse a reçu « site:marrakechtoday.ma Marrakech »', recues.some(x => x.q === 'site:marrakechtoday.ma Marrakech'));
    if (CAPTURES) await page.screenshot({ path: path.join(CAPTURES, 'sources_presse.png') });

    // ── la revue de presse suit vos réglages
    recues.length = 0;
    await page.evaluate((ST) => { const S = eval(ST); S.fermerSourcesVeille(); S.activeTab = 'wealth';
        S.marketIntel = Object.assign({}, S.marketIntel, { ma_5: { open: true } }); return S.chargerMarketIntel(S.masterAssets[0]); }, ST);
    // v37.41 : une requête STRICTE par média local
    const locales = recues.filter(x => x.chemin === '/gnews' && /^site:\S+ /.test(x.q)).map(x => x.q).join('\n');
    const tout = recues.map(x => x.q).join('\n');
    v('« Actualiser » : Marrakech Today a sa requête stricte de presse locale', /^site:marrakechtoday\.ma \S/m.test(locales), locales);
    v('  → Le Desk aussi, désormais local', /^site:ledesk\.ma \S/m.test(locales));
    v('  → Hespress (en pause) n\'est plus interrogé', !tout.includes('hespress'));
    v('  → Kech24 (retiré) non plus', !tout.includes('kech24'));
    v('la carte offre le même accès : « 📰 Sources »', await page.$('tr [data-mi-sources]').then(async b => { await b.click(); await page.waitForSelector('[data-vs-modale] [data-vs-source]'); return true; }).catch(() => false));
    await calme();

    // ── une mise à jour livre un nouveau média
    ecrireSources([...SRC.sources, { nom: 'Nouveau Média', domaine: 'nouveaumedia.ma', portee: 'locale', langue: 'ar' }]);
    await page.evaluate((ST) => eval(ST).ouvrirSourcesVeille(), ST); await calme();
    v('mise à jour : le nouveau média apparaît, « nouvelle »', /nouvelle/.test(await texteLigne('nouveaumedia.ma')));
    v('  → Kech24, retiré par vous, le reste', !(await ligne('kech24.com')) && /Kech24/.test(await page.textContent('[data-vs-supprimees]').catch(() => '')));

    // ── rétablir, puis revenir à l'origine
    await page.click('[data-vs-restaurer]:has-text("Kech24")'); await calme();
    v('rétablir : Kech24 revient', !!(await ligne('kech24.com')) && !(await page.$('[data-vs-supprimees]')));
    await page.click('[data-vs-reinitialiser]'); await calme();
    const apres = await page.evaluate((ST) => eval(ST).veilleSources.liste.map(s => s.origine), ST);
    v(`revenir à l'origine : ${NB + 1} médias, tous d'origine, rien en base`, apres.length === NB + 1 && apres.every(o => o === 'origine') && enBase() === null, JSON.stringify(apres));

    // ── sans base : lecture seule, dit
    fs.renameSync(path.join(F, 'db_config.php'), path.join(F, 'db_config.off'));
    await page.evaluate((ST) => eval(ST).ouvrirSourcesVeille(), ST); await calme();
    v('sans base : la fenêtre le dit, l\'ajout est désactivé', !!(await page.$('[data-vs-lecture-seule]')) && await page.$eval('[data-vs-ajouter]', b => b.disabled));
    v('  → un enregistrement forcé est refusé (503), sans rien casser', (await appel({ action: 'enregistrer', sources: [] })).d?.error === 'STOCKAGE_INDISPONIBLE');
    fs.renameSync(path.join(F, 'db_config.off'), path.join(F, 'db_config.php'));
    v('aucune erreur JavaScript dans la page', erreurs.length === 0, erreurs.join(' | '));
  });
} catch (e) {
    v('scène complète sans exception', false, String(e && e.stack || e));
} finally {
    if (browser) await browser.close().catch(() => {});
    srv.kill(); presse.close(); arreterPg();
}
fin();
