/**
 * v37.19 — DEUX PC, UN SEUL ÉTAT.
 *
 *   Le signalement (05/10/2026) : « quand j'ouvre l'appli sur un autre PC,
 *   c'est comme si les données s'écrasaient : tout est oublié ».
 *
 *   Cette suite joue la scène pour de vrai : le VRAI save_data.php sous
 *   `php -S`, deux navigateurs (PC A, PC B), en mode fichier ET en mode
 *   PostgreSQL (si les binaires sont là). Elle a d'abord servi à REPRODUIRE la
 *   perte, sur la v37.18 ; elle verrouille ensuite la correction :
 *     1. ce que l'un enregistre, l'autre le lit en ouvrant l'appli ;
 *     2. un onglet resté ouvert sur une version périmée ne peut plus écraser
 *        l'écriture d'un autre PC : le serveur la refuse (409), et l'écran le dit ;
 *     3. revenir sur un onglet sans modification en cours le remet à jour tout seul.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..');
let ko = 0;
const v = (t, ok, d = '') => { if (!ok) ko++; console.log(`  ${ok ? '✅' : '❌'} ${t.padEnd(66)} ${ok ? '' : d}`); };
console.log('\n  DEUX PC, UN SEUL ÉTAT — vrai save_data.php, deux navigateurs\n  ' + '─'.repeat(82));

const require = createRequire(import.meta.url);
const essai = (f) => { try { return f(); } catch { return null; } };
const pw = essai(() => require('playwright-core'));
const vueJs = essai(() => require.resolve('vue/dist/vue.global.js'));
const chartJs = essai(() => fs.existsSync(path.join(RACINE, 'node_modules/chart.js/dist/chart.umd.js')) && path.join(RACINE, 'node_modules/chart.js/dist/chart.umd.js'));
const chromium = process.env.CHROMIUM || ['/opt/pw-browsers/chromium'].find(p => essai(() => fs.existsSync(p) && fs.statSync(p).isFile()));
const php = essai(() => execFileSync('which', ['php']).toString().trim());
if (!pw || !vueJs || !chartJs || !chromium || !php) {
    console.log('  ⏭️  ignoré (playwright-core, vue, chart.js, Chromium ou php absent)');
    console.log('  ✅ TOUT PASSE — 0 contrôle(s) en échec');
    process.exit(0);
}

const portLibre = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const attendre = (ms) => new Promise(r => setTimeout(r, ms));
const attendrePort = async (port, essais = 60) => {
    for (let i = 0; i < essais; i++) {
        const ok = await new Promise(r => { const c = net.connect(port, '127.0.0.1', () => { c.end(); r(true); }); c.on('error', () => r(false)); });
        if (ok) return true;
        await attendre(100);
    }
    return false;
};

/* ── Le décor : un docroot jetable, comme le VPS ─────────────────────────── */
const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8'));
const Y = new Date().getFullYear();
const base = fx.donneesAnnuelles[Object.keys(fx.donneesAnnuelles)[0]];
fx.donneesAnnuelles = { [Y]: JSON.parse(JSON.stringify(base)), [Y + 1]: JSON.parse(JSON.stringify(base)) };
fx.soldesInitiaux.moisActuel = new Date().getMonth() + 1;
fx.soldesInitiaux.anneeActuelle = Y;
fx.comptes = [{ id: 1, label: 'Compte Courant', type: 'courant', solde: 1000 }, { id: 2, label: 'Compte Assafa', type: 'epargne', solde: 500 }];

const html = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8')
    .replace('<script src="https://unpkg.com/vue@3/dist/vue.global.js"', '<script src="/vue.js"')
    .replace('<script src="https://cdn.jsdelivr.net/npm/chart.js"', '<script src="/chart.js"')
    .replace(/<script src="https:\/\/cdn\.tailwindcss\.com"[^>]*><\/script>/, '')
    .replace(/<script[^>]*src="https:\/\/[^"]*"[^>]*><\/script>/g, '');

const monter = (pg) => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'deuxpc-'));
    fs.mkdirSync(path.join(d, 'finance'));
    fs.writeFileSync(path.join(d, 'finance', 'index.html'), html);
    fs.copyFileSync(path.join(RACINE, 'save_data.php'), path.join(d, 'finance', 'save_data.php'));
    fs.writeFileSync(path.join(d, 'finance', 'finance_data.json'), JSON.stringify(fx));
    fs.copyFileSync(vueJs, path.join(d, 'vue.js'));
    fs.copyFileSync(chartJs, path.join(d, 'chart.js'));
    if (pg) fs.writeFileSync(path.join(d, 'finance', 'db_config.php'),
        `<?php return ['host' => '127.0.0.1', 'port' => '${pg.port}', 'dbname' => 'finance', 'user' => 'postgres', 'password' => ''];`);
    return d;
};

/* ── PostgreSQL jetable (ignoré proprement si indisponible) ────────────── */
const pgBin = ['/usr/lib/postgresql/16/bin', '/usr/lib/postgresql/15/bin', '/usr/lib/postgresql/14/bin'].find(p => fs.existsSync(path.join(p, 'initdb')));
const demarrerPg = async () => {
    if (!pgBin || process.env.SANS_PG) return null;
    try {
        const port = await portLibre();
        const dir = fs.mkdtempSync(path.join('/var/tmp', 'pg-deuxpc-'));
        execFileSync('chown', ['postgres:postgres', dir]);
        const en = (cmd, args) => execFileSync('runuser', ['-u', 'postgres', '--', path.join(pgBin, cmd), ...args], { stdio: 'ignore' });
        en('initdb', ['-D', dir + '/data', '-A', 'trust', '-U', 'postgres']);
        en('pg_ctl', ['-D', dir + '/data', '-o', `-p ${port} -k ${dir} -c listen_addresses=127.0.0.1`, '-l', dir + '/log', '-w', 'start']);
        execFileSync('psql', ['-h', '127.0.0.1', '-p', String(port), '-U', 'postgres', '-c', 'CREATE DATABASE finance'], { stdio: 'ignore' });
        return { port, dir, arreter: () => { try { en('pg_ctl', ['-D', dir + '/data', '-m', 'immediate', 'stop']); } catch (_) {} } };
    } catch (e) { console.log('  ⏭️  PostgreSQL indisponible (' + e.message.split('\n')[0] + ')'); return null; }
};
const lirePg = (pg) => {
    const out = execFileSync('psql', ['-h', '127.0.0.1', '-p', String(pg.port), '-U', 'postgres', '-d', 'finance', '-At', '-c', 'SELECT data FROM finance_state WHERE id = 1']).toString().trim();
    return out ? JSON.parse(out) : null;
};

const browser = await pw.chromium.launch({ executablePath: chromium, args: ['--no-sandbox'] });
const ST = 'document.querySelector("#app").__vue_app__._instance.setupState';

const scene = async (mode, pg) => {
    console.log(`  ── mode ${mode}`);
    const docroot = monter(pg);
    const port = await portLibre();
    const srv = spawn(php, ['-S', '127.0.0.1:' + port, '-t', docroot], { stdio: 'ignore' });
    await attendrePort(port);
    const URL0 = `http://127.0.0.1:${port}/finance/`;
    const verite = () => pg ? lirePg(pg) : JSON.parse(fs.readFileSync(path.join(docroot, 'finance', 'finance_data.json'), 'utf8'));
    const soldeServeur = (id) => { const d = verite(); return d ? Number((d.comptes || []).find(c => c.id === id)?.solde) : null; };
    const ouvrir = async () => {
        const ctx = await browser.newContext();             // un « PC » = un contexte isolé
        const page = await ctx.newPage();
        const erreurs = []; page.on('pageerror', e => erreurs.push(String(e)));
        page.on('dialog', d => d.accept());
        await page.goto(URL0, { waitUntil: 'load' });
        await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState.moisBudgetaire; }, null, { timeout: 30000 });
        await page.waitForTimeout(800);
        return { ctx, page, erreurs };
    };
    const modifier = (pc, id, solde) => pc.page.evaluate(({ ST, id, solde }) => { const st = eval(ST); st.comptes.find(c => c.id === id).solde = solde; st.handleDataChange(); }, { ST, id, solde });
    const soldeEcran = (pc, id) => pc.page.evaluate(({ ST, id }) => Number(eval(ST).comptes.find(c => c.id === id).solde), { ST, id });
    const etat = (pc) => pc.page.evaluate((ST) => ({ statut: eval(ST).serverSyncStatus, divergent: eval(ST).serveurDivergent }), ST);
    try {
        // Le premier enregistrement initialise le stockage (indispensable en Postgres).
        const A = await ouvrir();
        if (pg) v(`[${mode}] base encore vide : l'appli lit le fichier existant, pas des valeurs par défaut`,
                  await soldeEcran(A, 1) === 1000 && await soldeEcran(A, 2) === 500, JSON.stringify([await soldeEcran(A, 1), await soldeEcran(A, 2)]));
        await modifier(A, 1, 1001);
        await attendre(3000);
        v(`[${mode}] PC A enregistre`, soldeServeur(1) === 1001, String(soldeServeur(1)));

        // 1. Ce qu'un PC enregistre, l'autre le lit en ouvrant l'appli.
        const B = await ouvrir();
        v(`[${mode}] PC B, ouvert ensuite, lit ce que A a enregistré`, await soldeEcran(B, 1) === 1001, String(await soldeEcran(B, 1)));

        // 2. B modifie et enregistre ; A, resté ouvert sur l'ancienne version, modifie autre chose.
        await modifier(B, 2, 7777);
        await attendre(3000);
        v(`[${mode}] PC B enregistre sa modification`, soldeServeur(2) === 7777, String(soldeServeur(2)));
        await modifier(A, 1, 1002);
        await attendre(3000);
        v(`[${mode}] l'onglet périmé de A N'ÉCRASE PAS l'écriture de B`, soldeServeur(2) === 7777, `Assafa sur le serveur = ${soldeServeur(2)} (B avait mis 7777)`);
        const eA = await etat(A);
        v(`[${mode}]   → et A est prévenu (bandeau de conflit)`, eA.divergent === true, JSON.stringify(eA));
        // A choisit de recharger : il récupère B (sa saisie locale non sauvegardée est perdue, il l'a accepté)
        await A.page.evaluate((ST) => eval(ST).forcerRechargementServeur(), ST);
        await attendre(800);
        v(`[${mode}]   → « Recharger » rend à A la version de B`, await soldeEcran(A, 2) === 7777, String(await soldeEcran(A, 2)));

        // 3. Revenir sur un onglet sans modification en cours le remet à jour.
        await modifier(B, 1, 3333);
        await attendre(3000);
        await A.page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus')); });
        await attendre(1200);
        v(`[${mode}] revenir sur l'onglet de A le met à jour tout seul`, await soldeEcran(A, 1) === 3333, String(await soldeEcran(A, 1)));

        // 4. Un PC qui ouvre l'appli à froid voit le dernier état — et ne le ré-écrit pas en arrière.
        const C = await ouvrir();
        v(`[${mode}] un 3e PC ouvert à froid voit le dernier état`, await soldeEcran(C, 1) === 3333 && await soldeEcran(C, 2) === 7777,
          JSON.stringify([await soldeEcran(C, 1), await soldeEcran(C, 2)]));
        if (pg) {
            const f = JSON.parse(fs.readFileSync(path.join(docroot, 'finance', 'finance_data.json'), 'utf8'));
            v(`[${mode}] le fichier finance_data.json suit Postgres (anciens onglets, sauvegardes)`,
              Number(f.comptes.find(c => c.id === 1).solde) === 3333, String(f.comptes.find(c => c.id === 1).solde));
        }
        // 5. « Imposer la version de cet appareil » : le choix explicite gagne.
        await modifier(C, 2, 8888);                 // C enregistre…
        await attendre(3000);
        await modifier(B, 2, 4242);                 // …B, périmé, est refusé
        await attendre(3000);
        const refuse = soldeServeur(2);
        await B.page.evaluate((ST) => eval(ST).imposerMaVersion(), ST);
        await attendre(1200);
        v(`[${mode}] « Imposer » : refusé d'abord, puis la version choisie gagne`,
          refuse === 8888 && soldeServeur(2) === 4242 && (await etat(B)).divergent === false, JSON.stringify({ refuse, apres: soldeServeur(2), etat: await etat(B) }));

        // 6. Le protocole, vu du serveur.
        const g = await fetch(URL0 + 'save_data.php?t=' + Date.now());
        const version = g.headers.get('x-finance-version');
        const corps = await g.text();
        v(`[${mode}] GET annonce sa version (sha1 du texte servi)`, !!version && version.length === 40, String(version));
        const perime = await fetch(URL0 + 'save_data.php', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Finance-Base': 'f'.repeat(40) }, body: '{"comptes":[]}' });
        v(`[${mode}] POST sur une version périmée : 409, rien n'est écrit`, perime.status === 409 && soldeServeur(2) === 4242, String(perime.status));
        const agent = await fetch(URL0 + 'save_data.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: corps });
        const ja = await agent.json();
        v(`[${mode}] POST sans version (agent CFO n8n) : accepté comme avant`, agent.status === 200 && ja.status === 'ok' && !!ja.version, JSON.stringify(ja));

        v(`[${mode}] aucune erreur JavaScript`, [A, B, C].every(p => p.erreurs.length === 0), [A, B, C].flatMap(p => p.erreurs)[0] || '');
        for (const p of [A, B, C]) await p.ctx.close();
    } catch (e) {
        ko++; console.log(`  ❌ [${mode}] exception : ` + e.message.split('\n')[0]);
    } finally {
        srv.kill();
    }
};

try {
    await scene('fichier', null);
    const pg = await demarrerPg();
    if (pg) { try { await scene('postgres', pg); } finally { pg.arreter(); } }
} finally {
    await browser.close();
}
console.log('  ' + '─'.repeat(82));
console.log(ko === 0 ? '  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
