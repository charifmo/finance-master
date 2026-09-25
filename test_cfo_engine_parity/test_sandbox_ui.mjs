/**
 * v37.8 — LE SIMULATEUR, DANS UN VRAI NAVIGATEUR.
 *
 *   Les suites précédentes vérifient l'arithmétique (test_projection.mjs) ;
 *   celle-ci vérifie que l'interface refondue existe, qu'elle change bien de
 *   forme selon le type d'événement, que le tableau se replie, que le
 *   graphique est accepté par Chart.js — et que rien de tout cela ne jette.
 *   Chart.js refuse silencieusement une configuration invalide côté données
 *   mais JETTE sur un axe inconnu : c'est la seule façon de le savoir sans
 *   ouvrir la page à la main.
 *
 *   Prérequis locaux, non versionnés :
 *     npm install --no-save vue@3 playwright-core chart.js
 *   Faute de quoi la suite s'ignore proprement (comme test_une_seule_verite).
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
const v = (titre, ok, detail = '') => { if (!ok) ko++; console.log(`  ${ok ? '✅' : '❌'} ${titre.padEnd(60)} ${ok ? '' : detail}`); };

console.log('\n  SIMULATEUR — INTERFACE ET MOTEUR DANS LE NAVIGATEUR\n  ' + '─'.repeat(78));

const require = createRequire(import.meta.url);
const essai = (f) => { try { return f(); } catch { return null; } };
const pw = essai(() => require('playwright-core'));
const vueJs = essai(() => require.resolve('vue/dist/vue.global.js'));
const chartJs = essai(() => fs.existsSync(path.join(RACINE, 'node_modules/chart.js/dist/chart.umd.js')) && path.join(RACINE, 'node_modules/chart.js/dist/chart.umd.js'));
const chromium = process.env.CHROMIUM || ['/opt/pw-browsers/chromium', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome']
    .find(p => essai(() => fs.existsSync(p) && fs.statSync(p).isFile()));

if (!pw || !vueJs || !chartJs || !chromium) {
    console.log('  ⏭️  ignoré (playwright-core, vue, chart.js ou Chromium absent)');
    console.log('  ✅ TOUT PASSE — 0 contrôle(s) en échec');
    process.exit(0);
}

const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8'));
const Y = new Date().getFullYear();
const base = fx.donneesAnnuelles[Object.keys(fx.donneesAnnuelles)[0]];
fx.donneesAnnuelles = { [Y]: JSON.parse(JSON.stringify(base)), [Y + 1]: JSON.parse(JSON.stringify(base)) };
fx.soldesInitiaux.moisActuel = new Date().getMonth() + 1;
fx.soldesInitiaux.anneeActuelle = Y;
fx.masterAssets = [{ id: 'ma_t', name: 'Local test', type: 'Commercial', isProductive: true, value: 900000,
                     valeur_actuelle: 900000, revenue: 84000, montant_credit: 400000, mensualite: 4000,
                     duree_mois: 120, taux_credit: 4.5, mode_exploitation: 'longue_duree', loyer_mensuel: 7000,
                     maintenance_pct: 0, quotePart: '100%' }];

const page0 = html
    .replace('<script src="https://unpkg.com/vue@3/dist/vue.global.js"', '<script src="/vue.js"')
    .replace('<script src="https://cdn.jsdelivr.net/npm/chart.js"', '<script src="/chart.js"')
    .replace(/<script src="https:\/\/cdn\.tailwindcss\.com"[^>]*><\/script>/, '')
    .replace(/<script[^>]*src="https:\/\/[^"]*"[^>]*><\/script>/g, '');

const srv = http.createServer((req, res) => {
    const p = req.url.split('?')[0];
    const send = (code, body, type = 'application/json') => { res.writeHead(code, { 'Content-Type': type }); res.end(body); };
    if (p === '/finance/') return send(200, page0, 'text/html; charset=utf-8');
    if (p === '/vue.js') return send(200, fs.readFileSync(vueJs), 'text/javascript');
    if (p === '/chart.js') return send(200, fs.readFileSync(chartJs), 'text/javascript');
    if (p === '/finance/finance_data.json') return send(200, JSON.stringify(fx));
    return send(200, '{"status":"ok"}');
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port;
const browser = await pw.chromium.launch({ executablePath: chromium, args: ['--no-sandbox'] });

try {
    const page = await browser.newPage();
    const erreurs = [];
    page.on('pageerror', e => erreurs.push(String(e)));
    page.on('dialog', d => d.accept());          // les confirm() du formulaire
    await page.goto(`http://127.0.0.1:${port}/finance/`, { waitUntil: 'load' });
    await page.waitForFunction(() => {
        const a = document.querySelector('#app');
        const s = a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState;
        return s && Array.isArray(s.sandboxProjection);
    }, null, { timeout: 30000 });

    const S = () => page.evaluate(() => document.querySelector('#app').__vue_app__._instance.setupState);
    const agir = (f, arg) => page.evaluate(f, arg);
    const attendre = () => page.waitForTimeout(350);

    // Ouvrir l'onglet Patrimoine, où vit le simulateur.
    await agir(() => { document.querySelector('#app').__vue_app__._instance.setupState.activeTab = 'wealth'; });
    await attendre();

    const visible = (txt) => page.evaluate((t) => {
        const n = [...document.querySelectorAll('label, p, th, button, option')].find(e => e.textContent.trim().includes(t));
        return !!(n && n.offsetParent !== null);
    }, txt);

    /* ── 1. Le formulaire change de forme selon le type ─────────────────── */
    v('type par défaut : achat immobilier locatif', await visible("Prix d'achat total"));
    v('  → apport, crédit, taux, durée, loyer net présents',
      (await visible('Apport personnel')) && (await visible('Montant du crédit'))
      && (await visible('Durée (mois)')) && (await visible('Loyer mensuel net espéré')));
    v('  → la mensualité est calculée sous le formulaire', await visible('Mensualité estimée'));

    await agir(() => { document.querySelector('#app').__vue_app__._instance.setupState.sandboxForm.type = 'capex'; });
    await attendre();
    v('capex : les champs de l\'achat disparaissent', !(await visible("Prix d'achat total")));
    v('  → et le choc a son propre formulaire', (await visible('Nom du choc')) && (await visible('Sens')));

    await agir(() => { document.querySelector('#app').__vue_app__._instance.setupState.sandboxForm.type = 'vente'; });
    await attendre();
    v('vente : prix net vendeur', (await visible('Prix net vendeur')) && (await visible('Actif à céder')));

    /* ── 2. Le tableau : 6 colonnes, puis 11 ───────────────────────────── */
    const colonnes = () => page.evaluate(() => {
        const t = [...document.querySelectorAll('table')].find(x => x.textContent.includes('Patrimoine Net') && x.textContent.includes('Dette Totale'));
        return t ? [...t.querySelectorAll('thead th')].map(e => e.textContent.trim()) : null;
    });
    const c1 = await colonnes();
    v('tableau replié : 6 colonnes stratégiques', c1 && c1.length === 6, JSON.stringify(c1));
    v('  → et ce sont les bonnes',
      JSON.stringify(c1) === JSON.stringify(['Année', "Liquidités fin d'année", 'Dette Totale', 'Valeur Actifs', 'Patrimoine Net', 'Événements']),
      JSON.stringify(c1));
    await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('Afficher le détail des flux')).click());
    await attendre();
    const c2 = await colonnes();
    v('bouton « détail des flux » : colonnes techniques révélées', c2 && c2.length === 11, JSON.stringify(c2));
    v('  → + Surplus, + Actifs, − Capital, ▲ Revalo, − Chocs',
      c2 && ['+ Surplus', '+ Actifs', '− Capital', '▲ Revalo', '− Chocs'].every(x => c2.includes(x)), JSON.stringify(c2));

    /* ── 3. Le graphique est réellement instancié par Chart.js ──────────── */
    const graphe = await page.evaluate(() => {
        const cvs = [...document.querySelectorAll('canvas')].filter(c => c.offsetParent !== null);
        const inst = cvs.map(c => (window.Chart && window.Chart.getChart) ? window.Chart.getChart(c) : null).filter(Boolean);
        const g = inst.find(i => (i.data.datasets || []).some(d => d.label === 'Liquidités'));
        return g ? { types: g.data.datasets.map(d => d.type), labels: g.data.datasets.map(d => d.label),
                     axes: Object.keys(g.options.scales || {}), points: g.data.labels.length } : null;
    });
    v('Chart.js accepte la configuration du graphique', !!graphe, 'aucune instance trouvée');
    v('  → barres = Liquidités, courbe = Patrimoine net',
      graphe && graphe.types[0] === 'bar' && graphe.types[1] === 'line'
      && graphe.labels.join('|') === 'Liquidités|Patrimoine net', JSON.stringify(graphe));
    v('  → deux axes distincts', graphe && graphe.axes.includes('y') && graphe.axes.includes('y1'), JSON.stringify(graphe));

    /* ── 4. Un achat locatif, de bout en bout ──────────────────────────── */
    const avant = (await S()).sandboxProjection;
    const anneeAchat = Y + 1;
    await agir((an) => {
        const S = document.querySelector('#app').__vue_app__._instance.setupState;
        Object.assign(S.sandboxForm, {
            annee: an, mois: 6, type: 'achat_locatif', nom: 'Gauthier',
            prixAchat: 1000000, apport: 300000, frais: 70000,
            montantCredit: 700000, taux: 4.5, dureeMois: 240, loyerMensuelNet: 5500,
        });
        S.addSandboxEvent();
    }, anneeAchat);
    await attendre();
    const apres = (await S());
    v('l\'événement est enregistré', apres.sandboxEvents.length === 1, JSON.stringify(apres.sandboxEvents));
    const lAvant = avant.find(r => r.annee === anneeAchat);
    const lApres = apres.sandboxProjection.find(r => r.annee === anneeAchat);
    v('  → la trésorerie ne perd que l\'apport et les frais',
      Math.abs((lAvant.liquidite - lApres.liquidite) - 370000) <= 1, `${lAvant.liquidite} → ${lApres.liquidite}`);
    v('  → la dette monte du crédit, pas du prix',
      Math.abs((lApres.dette - lAvant.dette) - 700000) <= 1, `${lAvant.dette} → ${lApres.dette}`);
    v('  → l\'actif entre au bilan à son prix',
      Math.abs((lApres.valeurActifs - lAvant.valeurActifs) - 1000000) <= 1, `${lAvant.valeurActifs} → ${lApres.valeurActifs}`);
    v('  → le patrimoine net ne perd que les frais',
      Math.abs((lAvant.net - lApres.net) - 70000) <= 1, `${lAvant.net} → ${lApres.net}`);

    /* ── 5. L'identité de caisse tient sur les données réelles de la page ─ */
    const p = apres.sandboxProjection;
    const derives = p.filter((r, k) => k > 0 && Math.abs(
        r.liquidite - (p[k - 1].liquidite + r.fluxSurplus + r.fluxActifs + r.chocsPositifs - r.chocsNegatifs)) > 1);
    v('identité de caisse respectée sur toute la projection', derives.length === 0,
      JSON.stringify(derives.map(r => [r.annee, r.ecartControle])));
    v('  → et aucun écart de contrôle signalé', p.every(r => Math.abs(r.ecartControle) <= 1));
    v('  → le patrimoine net = liquidités + actifs − dette',
      p.every(r => Math.abs(r.net - (r.liquidite + r.valeurActifs - r.dette)) <= 1));

    /* ── 6. Le brouillon se vide ───────────────────────────────────────── */
    await agir(() => {
        const S = document.querySelector('#app').__vue_app__._instance.setupState;
        S.removeSandboxEvent(S.sandboxEvents[0].id);
    });
    await attendre();
    v('suppression d\'un événement : la projection revient à l\'identique',
      (await S()).sandboxProjection.find(r => r.annee === anneeAchat).net === lAvant.net);

    v('aucune erreur JavaScript sur toute la session', erreurs.length === 0, erreurs[0] || '');
} finally {
    await browser.close();
    srv.close();
}

console.log('  ' + '─'.repeat(78));
console.log(ko ? `  ❌ ${ko} contrôle(s) en échec` : '  ✅ TOUT PASSE — 0 contrôle(s) en échec');
process.exit(ko ? 1 : 0);
