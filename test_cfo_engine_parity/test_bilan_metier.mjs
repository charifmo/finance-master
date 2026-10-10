/**
 * v37.45 — « l'onglet où y a plein de stats et de graphs useless, pas de graphes KPI
 * importants » et « les boutons de la barre latérale mal placés, surtout ceux d'en bas ».
 *
 *   LE BILAN (Prévisionnel › Bilan & Simulation), relu par un directeur financier :
 *     • plus de cartes qui répètent le bandeau, plus d'anneaux qui cachent le déficit ;
 *     • un verdict, quatre signaux vitaux avec leur repère, la trajectoire des comptes
 *       sur 12 mois, ce que coûte chaque poste, l'année mois par mois ;
 *     • chaque chiffre recoupé avec le moteur qui fait foi ailleurs : la Météo
 *       (respirationDuMois, « Fin de cycle »), le bandeau (mensualités, endettement,
 *       patrimoine global projeté), le Relevé de comptes.
 *   LA BARRE LATÉRALE :
 *     • le pied (outils, sauvegarde, annuler, données) toujours à l'écran, même en
 *       1280×720 ; les onglets défilent seuls ;
 *     • des outils nommés ; la sauvegarde en une ligne ; le menu « ⋯ » ;
 *     • journal technique, Google Drive et « Restaurer V10 » rangés dans Paramètres.
 */
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..');
let ko = 0, n = 0;
const v = (t, ok, d = '') => { n++; if (!ok) ko++; console.log(`  ${ok ? '✅' : '❌'} ${t.padEnd(78)} ${ok ? '' : d}`); };
console.log('\n  BILAN MÉTIER & BARRE LATÉRALE — les bons chiffres, au bon endroit\n  ' + '─'.repeat(94));
const require = createRequire(import.meta.url);
const essai = (f) => { try { return f(); } catch { return null; } };
const pw = essai(() => require('playwright-core'));
const vueJs = essai(() => require.resolve('vue/dist/vue.global.js'));
const chartJs = essai(() => fs.existsSync(path.join(RACINE, 'node_modules/chart.js/dist/chart.umd.js')) && path.join(RACINE, 'node_modules/chart.js/dist/chart.umd.js'));
const twBin = path.join(RACINE, 'node_modules/.bin/tailwindcss');
const chromium = process.env.CHROMIUM || ['/opt/pw-browsers/chromium'].find(p => essai(() => fs.existsSync(p) && fs.statSync(p).isFile()));
const fin = () => { console.log('  ' + '─'.repeat(94)); console.log(ko === 0 ? `  ✅ TOUT PASSE — ${n} contrôles` : `  ❌ ${ko} contrôle(s) en échec sur ${n}`); process.exit(ko === 0 ? 0 : 1); };
if (!pw || !vueJs || !chartJs || !chromium || !fs.existsSync(twBin)) { console.log('  ⏭️  ignoré (playwright-core, vue, chart.js, tailwindcss ou Chromium absent)'); fin(); }

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-bilan-'));
fs.writeFileSync(path.join(tmp, 'in.css'), '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
fs.writeFileSync(path.join(tmp, 'cfg.js'), 'module.exports={content:[' + JSON.stringify(path.join(RACINE, 'index.html')) + '],theme:{extend:{}}};');
execFileSync(twBin, ['-c', path.join(tmp, 'cfg.js'), '-i', path.join(tmp, 'in.css'), '-o', path.join(tmp, 'out.css'), '--minify'], { stdio: 'ignore' });
const tw = fs.readFileSync(path.join(tmp, 'out.css'), 'utf8');

const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8'));
const now = new Date(), Y = now.getFullYear();
const base = fx.donneesAnnuelles[Object.keys(fx.donneesAnnuelles)[0]];
fx.donneesAnnuelles = { [Y]: JSON.parse(JSON.stringify(base)), [Y + 1]: JSON.parse(JSON.stringify(base)) };
Object.values(fx.donneesAnnuelles).forEach((d, i) => (d.depensesIrregulieres || []).forEach(x => { x.annee = Y + i; }));
Object.assign(fx.soldesInitiaux, { anneeActuelle: Y, moisActuel: now.getMonth() + 1 });
const page0 = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8')
    .replace('<script src="https://unpkg.com/vue@3/dist/vue.global.js"', '<script src="/vue.js"')
    .replace('<script src="https://cdn.jsdelivr.net/npm/chart.js"', '<script src="/chart.js"')
    .replace(/<script src="https:\/\/cdn\.tailwindcss\.com"[^>]*><\/script>/, '<link rel="stylesheet" href="/tailwind.css">')
    .replace(/<script[^>]*src="https:\/\/[^"]*"[^>]*><\/script>/g, '');
let posts = 0;
const srv = http.createServer((req, res) => {
    const p = req.url.split('?')[0];
    const s = (c, b, t = 'application/json') => { res.writeHead(c, { 'Content-Type': t }); res.end(b); };
    if (req.method === 'POST' && p.endsWith('save_data.php')) posts++;
    if (p === '/finance/') return s(200, page0, 'text/html; charset=utf-8');
    if (p === '/vue.js') return s(200, fs.readFileSync(vueJs), 'text/javascript');
    if (p === '/chart.js') return s(200, fs.readFileSync(chartJs), 'text/javascript');
    if (p === '/tailwind.css') return s(200, tw, 'text/css');
    if (p === '/finance/finance_data.json') return s(200, JSON.stringify(fx));
    if (p.endsWith('get_ai_memory.php')) return s(200, JSON.stringify({ status: 'ok', rag: { regles: [] }, chat: [] }));
    return s(200, '{"status":"ok"}');
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const browser = await pw.chromium.launch({ executablePath: chromium, args: ['--no-sandbox'] });
const ST = 'document.querySelector("#app").__vue_app__._instance.setupState';
let dialogues = 0;
const ouvrir = async (w, h) => {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    page.setDefaultTimeout(5000);
    const erreurs = []; page.on('pageerror', e => erreurs.push(String(e)));
    page.on('dialog', d => { dialogues++; d.dismiss(); });
    await page.goto(`http://127.0.0.1:${srv.address().port}/finance/`, { waitUntil: 'load' });
    await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && Array.isArray(a.__vue_app__._instance.setupState.masterAssets); }, null, { timeout: 30000 });
    await page.waitForTimeout(900);
    return { page, erreurs };
};
const aller = (page, mode, tab, extra = '') => page.evaluate(({ ST, mode, tab, extra }) => { const st = eval(ST); st.appMode = mode; st.activeTab = tab; if (extra) (new Function('st', extra))(st); }, { ST, mode, tab, extra }).then(() => page.waitForTimeout(500));
const MAD = (x) => new Intl.NumberFormat('fr-FR').format(Math.round(Number(x) || 0)) + ' DH';
const norm = (s) => String(s || '').replace(/[\s  ]+/g, ' ').trim();

try {
    const { page, erreurs } = await ouvrir(1280, 720);
    await aller(page, 'previsionnel', 'dashboard', 'st.isSidebarCollapsed = false; st.anneeAffichage = ' + Y);

    /* ══ A. LE BILAN ══════════════════════════════════════════════════════ */
    const section = async (nom, f) => { try { await f(); } catch (e) { v(nom + ' : section complète sans exception', false, String(e && e.message || e).split('\n')[0].slice(0, 200)); } };
    await section('Bilan', async () => {
    console.log('  ── le Bilan : ce qui part, ce qui arrive');
    const texte = norm(await page.textContent('[data-bilan]'));
    v('l\'ancien tableau de bord est parti : ni « KPIs », ni anneaux, ni « Audit détaillé »',
      !/Tableau de bord & KPIs|Graphiques de Répartition|Audit détaillé|Où va votre argent|Reste à vivre moyen|Patrimoine Net/.test(texte), texte.slice(0, 200));
    v(`  → « Bilan ${Y} » : verdict, quatre signaux, trajectoire, postes, mois par mois`,
      texte.startsWith('Bilan ' + Y) && await page.isVisible('[data-bilan-verdict]') && (await page.$$('[data-signal]')).length === 4
      && await page.isVisible('[data-bilan-trajectoire]') && await page.isVisible('[data-bilan-postes]') && await page.isVisible('[data-bilan-mois]'));

    const B = await page.evaluate((ST) => {
        const st = eval(ST), A = st.bilanAnnee, an = A.an;
        const resp = Array.from({ length: 12 }, (_, i) => st.respirationDuMois(an, i + 1));
        const seg = (r, k) => (r.segments.find(s => s.cle === k) || {}).montant || 0;
        const ecartsMois = A.mois.map((x, i) => ({ m: x.m,
            fixes: Math.abs(x.credits + x.fixes - seg(resp[i], 'fixes')), autres: ['mensuelles', 'conso', 'exceptionnel', 'epargne'].map(k => Math.abs(x[k] - seg(resp[i], k))),
            marge: Math.abs(x.marge - resp[i].marge) }));
        const signaux = [...document.querySelectorAll('[data-signal]')].map(e => ({ cle: e.dataset.signal, niveau: e.dataset.niveau, valeur: e.querySelector('[data-signal-valeur]').textContent.trim(), texte: e.textContent.replace(/\s+/g, ' ') }));
        const postesDom = [...document.querySelectorAll('[data-poste]')].map(e => ({ cle: e.dataset.poste, largeur: parseFloat(e.querySelector('summary [style]').style.width) }));
        const points = [...document.querySelectorAll('[data-bilan-point]')].map(e => e.dataset.niveau);
        return { A: JSON.parse(JSON.stringify(A)), ecartsMois, signaux, postesDom, points,
                 margeMoy: resp.reduce((s, r) => s + r.marge, 0) / 12, margeMeteo: st.respirationGlobale.marge,
                 te: st.tauxEndettement, credits: st.totalCreditsMensuels, moisActuel: st.soldesInitiaux.moisActuel,
                 liq: st.patrimoineLiquide, dep: st.depensesMensuellesBase, obj: st.parametres.objectifFondsSecuriteMois,
                 verdict: JSON.parse(JSON.stringify(st.bilanVerdict)), marge: document.querySelector('[data-bilan-marge]').textContent.trim(),
                 total: document.querySelector('[data-bilan-total]').textContent.trim() };
    }, ST);
    const S = Object.fromEntries(B.signaux.map(s => [s.cle, s]));
    console.log('  ── les quatre signaux, recoupés');
    v('quatre signaux, chacun avec un niveau et son repère',
      ['solde', 'epargne', 'endettement', 'precaution'].every(k => S[k] && ['ok', 'attention', 'alerte', 'neutre'].includes(S[k].niveau) && /Repère|Objectif|repère/.test(S[k].texte)), JSON.stringify(B.signaux.map(s => [s.cle, s.niveau])));
    v('solde mensuel = moyenne des 12 mois du modèle de la Météo (respirationDuMois)',
      norm(S.solde.valeur) === norm(MAD(B.margeMoy)) && Math.abs(B.A.moy.marge - B.margeMoy) <= 1, S.solde.valeur + ' / ' + MAD(B.margeMoy));
    v('  → « ce mois-ci » = le chiffre de la Météo', norm(S.solde.texte).includes('ce mois-ci : ' + norm(MAD(B.margeMeteo))), S.solde.texte);
    v('  → déficit = « Alerte », dit en clair', B.A.moy.marge < 0 ? (S.solde.niveau === 'alerte' && /de plus qu’il ne rentre/.test(S.solde.texte)) : S.solde.niveau !== 'alerte', S.solde.niveau);
    const tx = (B.A.moy.epargne + B.A.moy.marge) / B.A.moy.ressources * 100;
    v('taux d\'épargne réel = (épargne programmée + solde) / ressources — le déficit le ronge',
      norm(S.epargne.valeur) === norm((Math.round(tx * 10) / 10).toLocaleString('fr-FR') + ' %') && (tx < 0 ? S.epargne.niveau === 'alerte' : true), S.epargne.valeur + ' / ' + tx.toFixed(2));
    v('endettement = le taux du bandeau (mensualités du mois / revenus)', norm(S.endettement.valeur) === norm((Math.round(B.te * 10) / 10).toLocaleString('fr-FR') + ' %')
      && S.endettement.niveau === (B.te > 40 ? 'alerte' : (B.te > 33 ? 'attention' : 'ok')), S.endettement.valeur + ' / ' + B.te);
    const nb = B.liq / B.dep;
    v('précaution = liquidités / dépenses mensuelles, objectif des Paramètres',
      norm(S.precaution.valeur) === norm((Math.round(nb * 10) / 10).toLocaleString('fr-FR') + ' mois') && S.precaution.texte.includes('Objectif : ' + B.obj + ' mois'), S.precaution.valeur + ' / ' + nb.toFixed(2));
    const rang = { alerte: 0, attention: 1, ok: 2 };
    v('verdict : un point par signal, le pire d\'abord', B.points.length >= 4 && B.points.every((x, i) => i === 0 || rang[x] >= rang[B.points[i - 1]]) && B.verdict.niveau === B.points[0], JSON.stringify(B.points));

    console.log('  ── où part l\'argent, mois par mois');
    v('chaque mois : crédits + charges fixes = les charges fixes de la Météo ; les autres postes, au dirham',
      B.ecartsMois.every(e => e.fixes <= 1 && e.autres.every(x => x <= 1) && e.marge <= 1), JSON.stringify(B.ecartsMois.filter(e => e.fixes > 1 || e.autres.some(x => x > 1))));
    const mA = B.A.mois[B.moisActuel - 1];
    v('  → les crédits du mois = les mensualités du bandeau', mA && Math.abs(mA.credits - Math.round(B.credits)) <= 1, JSON.stringify([mA && mA.credits, B.credits]));
    const sommePostes = B.A.postes.reduce((s, p) => s + p.moyenne, 0);
    v('  → Σ postes = total engagé ; ressources − total = ce qui reste ou manque',
      Math.abs(sommePostes - B.A.moy.sorties) <= B.A.postes.length && Math.abs(B.A.moy.ressources - B.A.moy.sorties - B.A.moy.marge) <= 2
      && norm(B.total) === norm(MAD(B.A.moy.sorties)) && norm(B.marge) === norm((B.A.moy.marge < 0 ? 'Il manque ' + MAD(-B.A.moy.marge) : 'Il reste ' + MAD(B.A.moy.marge)) + ' par mois.'),
      JSON.stringify({ sommePostes, moy: B.A.moy, marge: B.marge }));
    v('  → chaque % = montant / ressources, et la barre a la même longueur',
      B.A.postes.every(p => p.pct === Math.round(p.moyenne / B.A.moy.ressources * 100)) && B.postesDom.every(d => { const p = B.A.postes.find(x => x.cle === d.cle); return Math.abs(d.largeur - Math.min(100, p.pct)) <= 1; }),
      JSON.stringify(B.postesDom));
    v('  → les crédits ont leur propre ligne (ils étaient noyés dans les charges fixes)', B.A.postes.some(p => p.cle === 'credits' && p.moyenne > 0));
    const premier = B.A.postes[0];
    await page.click(`[data-poste="${premier.cle}"] > summary`);
    await page.waitForTimeout(200);
    const det = await page.$$eval(`[data-poste="${premier.cle}"] li`, els => els.filter(e => e.getBoundingClientRect().height > 0).map(e => e.textContent.replace(/\s+/g, ' ').trim()));
    const sommeDet = premier.lignes.reduce((s, l) => s + l.moyenne, 0);
    v('un clic sur un poste déplie son détail, dont la somme = le poste', det.length === premier.lignes.length && det.length > 0 && Math.abs(sommeDet - premier.moyenne) <= premier.lignes.length, JSON.stringify({ det: det.slice(0, 3), sommeDet, p: premier.moyenne }));

    console.log('  ── la trajectoire : le Relevé, 12 mois');
    const T = await page.evaluate((ST) => { const st = eval(ST); const t = st.bilanTrajectoire, mb = st.moisBudgetaire;
        return { t: JSON.parse(JSON.stringify(t)), mb: { m: mb.mois, a: mb.an }, meteo: st.kpiAtterrissageGlobal.montant, global: st.patrimoineProjeteGlobal,
                 bas: document.querySelector('[data-bilan-point-bas]').textContent.trim(), canv: [...document.querySelectorAll('[data-bilan] canvas')].map(c => c.width * c.height) }; }, ST);
    v('12 mois, à partir du cycle en cours', T.t.points.length === 12 && T.t.points[0].cycle === T.mb.m + '-' + T.mb.a, JSON.stringify(T.t.points.map(p => p.cycle)));
    v('  → fin du 1er mois, compte courant = « Fin de cycle » de la Météo', T.t.points[0].courant === Math.round(T.meteo), JSON.stringify([T.t.points[0].courant, T.meteo]));
    const dec = T.t.points.find(p => p.cycle === '12-' + Y);
    v('  → fin décembre, tous comptes = « Patrimoine global projeté » du bandeau', !!dec && Math.abs(dec.total - Math.round(T.global)) <= 1, JSON.stringify([dec, T.global]));
    v('  → le point bas est le plus bas du courant, daté et affiché',
      T.t.pointBas.montant <= Math.min(...T.t.points.map(p => p.courant)) && !!T.t.pointBas.date && norm(T.bas) === norm(MAD(T.t.pointBas.montant)), JSON.stringify(T.t.pointBas));
    v('  → découvert annoncé si, et seulement si, le courant passe sous zéro', (!!T.t.decouvert) === (T.t.pointBas.montant < 0)
      && (!T.t.decouvert || B.verdict.points[0].texte.startsWith('Le compte courant passe sous zéro le ' + T.t.decouvert.date)), JSON.stringify(T.t.decouvert));
    v('les deux graphiques sont dessinés (trajectoire, mois par mois)', T.canv.length === 2 && T.canv.every(x => x > 0), JSON.stringify(T.canv));

    console.log('  ── le Bilan suit le budget, en direct');
    const m2 = ((T.mb.m + 1) % 12) + 1, a2 = T.mb.m + 2 > 12 ? T.mb.a + 1 : T.mb.a;
    const S1 = await page.evaluate(async ({ ST, m2, a2 }) => { const st = eval(ST);
        const avant = { pp: (st.bilanAnnee.postes.find(p => p.cle === 'exceptionnel') || { moyenne: 0 }).moyenne, mois: a2 === st.bilanAnnee.an ? st.bilanAnnee.mois[m2 - 1].marge : null,
                        traj: st.bilanTrajectoire.points.find(p => p.cycle === m2 + '-' + a2).courant };
        const d = st.donneesAnnuelles[a2];
        d.depensesIrregulieres.push({ id: 9901, mois: m2, annee: a2, nom: 'Toiture', montant: 24000, paye: false, montantPaye: 0, sourceCompte: 'courant' });
        st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 400));
        const apres = { pp: (st.bilanAnnee.postes.find(p => p.cle === 'exceptionnel') || { moyenne: 0 }).moyenne, mois: a2 === st.bilanAnnee.an ? st.bilanAnnee.mois[m2 - 1].marge : null,
                        traj: st.bilanTrajectoire.points.find(p => p.cycle === m2 + '-' + a2).courant,
                        ligne: ((st.bilanAnnee.postes.find(p => p.cle === 'exceptionnel') || {}).lignes || []).some(l => /^Toiture/.test(l.nom)) };
        d.depensesIrregulieres.pop(); st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 300));
        return { avant, apres }; }, { ST, m2, a2 });
    v('une dépense ponctuelle de 24 000 DH dans deux mois : la trajectoire du courant baisse d\'autant',
      S1.avant.traj - S1.apres.traj === 24000, JSON.stringify(S1));
    v('  → « Dépenses ponctuelles » : + 2 000 DH par mois, la ligne « Toiture » au détail ; ce mois-là : − 24 000',
      a2 !== Y || (S1.apres.pp - S1.avant.pp === 2000 && S1.apres.ligne && S1.avant.mois - S1.apres.mois === 24000), JSON.stringify(S1));
    const S2 = await page.evaluate(async (ST) => { const st = eval(ST); const r = st.donneesAnnuelles[st.anneeAffichage].revenus;
        Object.values(r).forEach(x => { x.base = x.base * 4; }); st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 400));
        const s = Object.fromEntries(st.bilanSignaux.map(x => [x.cle, x.niveau])), titre = st.bilanVerdict.titre, pts = st.bilanVerdict.points.map(p => p.texte), niv = st.bilanVerdict.points.map(p => p.niveau);
        Object.values(r).forEach(x => { x.base = x.base / 4; }); st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 300));
        return { s, titre, pts, niv }; }, ST);
    v('revenus × 4 : solde et endettement passent au vert, le verdict ne parle plus de déficit',
      S2.s.solde === 'ok' && S2.s.endettement === 'ok' && !S2.pts.some(t => /de plus qu’il ne rentre/.test(t)), JSON.stringify(S2));
    v('  → budget mixte : le verdict range toujours le pire d\'abord', S2.niv.includes('ok') && S2.niv.some(x => x !== 'ok') && S2.niv.every((x, i) => i === 0 || rang[x] >= rang[S2.niv[i - 1]]), JSON.stringify(S2.niv));
    await page.click('[data-signal="precaution"] button');
    await page.waitForTimeout(300);
    v('« Régler → » mène à l\'objectif de précaution (Paramètres)', await page.evaluate((ST) => eval(ST).activeTab === 'settings', ST));
    await aller(page, 'previsionnel', 'dashboard');
    await page.click('[data-bilan-fin] button');
    await page.waitForTimeout(300);
    v('« Voir le Relevé → » ouvre le Relevé de comptes', await page.evaluate((ST) => eval(ST).showReleveModal === true, ST));
    await page.evaluate((ST) => { eval(ST).showReleveModal = false; }, ST);
    });

    /* ══ B. LA BARRE LATÉRALE ════════════════════════════════════════════ */
    await page.evaluate((ST) => { const st = eval(ST); st.showReleveModal = false; st.showCfoModal = false; st.showChangelog = false; }, ST);
    const geo = async (pg) => pg.evaluate(() => { const b = document.querySelector('[data-barre]'), p = document.querySelector('[data-barre-pied]'), nav = b.querySelector('nav');
        const r = p.getBoundingClientRect(); return { bas: r.bottom, haut: r.top, h: innerHeight, defile: b.scrollHeight > b.clientHeight + 1, navDeborde: nav.scrollHeight > nav.clientHeight + 1, navDefile: getComputedStyle(nav).overflowY }; });
    //  Faire défiler les onglets jusqu'en bas : le dernier doit sortir au-dessus du pied.
    const atteignable = (pg) => pg.evaluate(async () => {
        const nav = document.querySelector('[data-barre] nav'), pied = document.querySelector('[data-barre-pied]');
        nav.scrollTop = nav.scrollHeight; await new Promise(r => setTimeout(r, 60));
        const btns = [...nav.querySelectorAll('button')].filter(x => x.getBoundingClientRect().height > 0);
        const der = btns[btns.length - 1].getBoundingClientRect(), p = pied.getBoundingClientRect();
        const res = { defile: nav.scrollHeight > nav.clientHeight + 1, derBas: Math.round(der.bottom), piedHaut: Math.round(p.top), piedBas: Math.round(p.bottom), h: innerHeight };
        nav.scrollTop = 0; return res; });
    await section('Barre : géométrie', async () => {
    console.log('  ── la barre latérale : le pied toujours visible');
    for (const [mode, tab] of [['previsionnel', 'dashboard'], ['reel', 'pilotage']]) {
        await aller(page, mode, tab);
        const g = await geo(page);
        v(`1280×720 (${mode === 'reel' ? 'Réalisé' : 'Prévisionnel'}) : le pied est entier à l'écran, le menu ne défile plus d'un bloc`, g.bas <= g.h + 0.5 && g.haut > 0 && !g.defile, JSON.stringify(g));
        v(`  → tous les onglets tiennent sans défiler`, !g.navDeborde && g.navDefile === 'auto', JSON.stringify(g));
    }
    {
        const o = await ouvrir(1280, 600);
        await aller(o.page, 'previsionnel', 'dashboard', 'st.isSidebarCollapsed = false');
        const r = await atteignable(o.page);
        v('1280×600 : les onglets défilent seuls, le dernier sort au-dessus du pied', r.defile && r.derBas <= r.piedHaut + 1 && r.piedBas <= r.h + 0.5, JSON.stringify(r));
        await o.page.close();
    }
    for (const [w, h] of [[1366, 768], [1440, 900]]) {
        const o = await ouvrir(w, h);
        await aller(o.page, 'previsionnel', 'dashboard', 'st.isSidebarCollapsed = false');
        const g = await geo(o.page);
        v(`${w}×${h} : le pied est entier à l'écran`, g.bas <= g.h + 0.5 && !g.defile && !g.navDeborde, JSON.stringify(g));
        await o.page.close();
    }
    });
    await section('Barre : outils', async () => {
    const bar = norm(await page.textContent('[data-barre]'));
    v('plus de « Sauver sur VPS », de journal, de Drive ni de « Restaurer Data V10 » dans le menu',
      !/Sauver sur VPS|Restaurer|Cloud Drive|Connecter Drive|Configurer Client ID|Serveur VPS|Actions IA|Changelog/i.test(bar) && !(await page.$('[data-barre] .font-mono')), bar.slice(-200));
    const outils = await page.$$eval('[data-outil]', els => els.map(e => [e.dataset.outil, e.textContent.replace(/\s+/g, ' ').trim(), e.getAttribute('aria-label')]));
    v('outils nommés : 🧠 CFO, 📑 Relevé, 🪄 Merlin (c\'étaient trois émojis muets)',
      outils.length === 3 && /CFO$/.test(outils[0][1]) && /Relevé$/.test(outils[1][1]) && /Merlin$/.test(outils[2][1]) && outils.every(o => o[2]), JSON.stringify(outils));
    await page.click('[data-outil="cfo"]'); await page.waitForTimeout(200);
    const cfo = await page.evaluate((ST) => { const st = eval(ST); const x = st.showCfoModal; st.showCfoModal = false; return x; }, ST);
    await page.click('[data-outil="releve"]'); await page.waitForTimeout(200);
    const rel = await page.evaluate((ST) => { const st = eval(ST); const x = st.showReleveModal; st.showReleveModal = false; return x; }, ST);
    await page.waitForTimeout(200);
    await page.click('[data-outil="merlin"]'); await page.waitForTimeout(200);
    const mer = await page.evaluate((ST) => { const st = eval(ST); const x = st.merlinActive; if (x) st.toggleMerlin(); return x; }, ST);
    v('  → chacun ouvre son outil (CFO, Relevé, Merlin)', cfo === true && rel === true && mer === true, JSON.stringify([cfo, rel, mer]));

    });
    await section('Barre : sauvegarde et données', async () => {
    console.log('  ── la sauvegarde en une ligne, les données dans un menu');
    const etat = async (s) => page.evaluate(async ({ ST, s }) => { const st = eval(ST); st.serverSyncStatus = s; await new Promise(r => setTimeout(r, 80)); return document.querySelector('[data-sauvegarde]').textContent.replace(/\s+/g, ' ').trim(); }, { ST, s });
    const etats = { synced: await etat('synced'), modified: await etat('modified'), error: await etat('error'), saving: await etat('saving') };
    v('état de la sauvegarde : Enregistré, Modifié, Échec, Envoi…', /^Enregistré/.test(etats.synced) && /^Modifié/.test(etats.modified) && /^Échec/.test(etats.error) && /^Envoi/.test(etats.saving), JSON.stringify(etats));
    await etat('modified');
    const p0 = posts;
    await page.click('[data-sauvegarde]');
    await page.waitForTimeout(700);
    const apresClic = await page.evaluate((ST) => ({ s: eval(ST).serverSyncStatus, t: document.querySelector('[data-sauvegarde]').textContent.replace(/\s+/g, ' ').trim() }), ST);
    v('  → un clic enregistre (POST au serveur) et revient à « Enregistré »', posts > p0 && apresClic.s === 'synced' && /^Enregistré/.test(apresClic.t), JSON.stringify({ posts, p0, apresClic }));
    await aller(page, 'reel', 'pilotage');
    await page.click('[data-menu-donnees-bouton]'); await page.waitForTimeout(200);
    const items = await page.$$eval('[data-menu-donnees] [role="menuitem"]', els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()));
    v('menu « ⋯ » : exporter, importer, PDF, Google Drive, nouveautés, réglages',
      ['Exporter les données', 'Importer', 'PDF', 'Google Drive', 'Nouveautés', 'Sauvegarde & données'].every(t => items.some(i => i.includes(t))), JSON.stringify(items));
    await page.mouse.click(900, 400); await page.waitForTimeout(200);
    v('  → un clic à côté le referme', !(await page.$('[data-menu-donnees]')));
    await page.click('[data-menu-donnees-bouton]'); await page.waitForTimeout(200);
    await page.click('[data-vers-reglages-donnees]'); await page.waitForTimeout(500);
    const reg = await page.evaluate((ST) => { const st = eval(ST); const z = document.querySelector('[data-reglages-donnees]');
        return { mode: st.appMode, tab: st.activeTab, vis: !!z && z.getBoundingClientRect().height > 0, texte: (document.querySelector('[data-reglages-sauvegarde]') || {}).parentElement?.textContent.replace(/\s+/g, ' ') || '' }; }, ST);
    v('  → « Sauvegarde & données… » mène à Paramètres, même depuis le Réalisé', reg.mode === 'previsionnel' && reg.tab === 'settings' && reg.vis, JSON.stringify({ ...reg, texte: '' }));
    v('Paramètres : serveur, journal technique, Google Drive, fichiers et une zone sensible',
      ['Enregistrer maintenant', 'Tester la connexion', 'Journal technique', 'Google Drive', 'Exporter', 'Importer', 'Zone sensible', 'Restaurer les données du 7 avril'].every(t => reg.texte.includes(t)), reg.texte.slice(0, 300));
    const avantRest = await page.evaluate((ST) => JSON.stringify(eval(ST).donneesAnnuelles).length, ST);
    const d0 = dialogues;
    await page.click('[data-restaurer-v10]'); await page.waitForTimeout(300);
    const apresRest = await page.evaluate((ST) => JSON.stringify(eval(ST).donneesAnnuelles).length, ST);
    v('  → « Restaurer » demande confirmation ; refusée, rien ne bouge', dialogues === d0 + 1 && apresRest === avantRest, JSON.stringify({ dialogues, d0, avantRest, apresRest }));
    await page.click('[data-version-nouveautes]'); await page.waitForTimeout(300);
    v('la version ouvre les nouveautés (le changelog n\'est plus un faux onglet)', await page.isVisible('text=Historique des Versions'));
    await page.evaluate((ST) => { eval(ST).showChangelog = false; }, ST);

    });
    await page.evaluate((ST) => { const st = eval(ST); st.showChangelog = false; st.menuDonnees = false; }, ST);
    await section('Barre repliée', async () => {
    console.log('  ── barre repliée');
    await aller(page, 'previsionnel', 'dashboard', 'st.isSidebarCollapsed = true');
    await page.click('[data-menu-donnees-bouton]'); await page.waitForTimeout(250);
    const rep = await page.evaluate(() => { const m = document.querySelector('[data-menu-donnees]'), b = document.querySelector('[data-barre]');
        const r = m.getBoundingClientRect(), rb = b.getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { gauche: r.left, barre: rb.right, haut: r.top, bas: r.bottom, h: innerHeight, dedans: !!el && m.contains(el) }; });
    v('le menu « ⋯ » s\'ouvre à droite de la barre, entier et cliquable', rep.gauche >= rep.barre - 1 && rep.haut >= 0 && rep.bas <= rep.h && rep.dedans, JSON.stringify(rep));
    await page.mouse.click(900, 300); await page.waitForTimeout(150);
    const sansNom = await page.$$eval('[data-barre] button', els => els.filter(b => b.getBoundingClientRect().width > 0).filter(b => !(b.getAttribute('aria-label') || b.getAttribute('title') || '').trim() && !/[\p{L}\p{N}]/u.test(b.textContent)).map(b => b.outerHTML.slice(0, 80)));
    v('  → chaque bouton de la barre repliée a un nom', sansNom.length === 0, JSON.stringify(sansNom));
    const g2 = await geo(page);
    v('  → le pied reste entier à l\'écran', g2.bas <= g2.h + 0.5 && !g2.defile, JSON.stringify(g2));
    const r2 = await atteignable(page);
    v('  → les icônes d\'onglets défilent, la dernière sort au-dessus du pied', r2.derBas <= r2.piedHaut + 1 && r2.piedBas <= r2.h + 0.5, JSON.stringify(r2));
    });
    v('aucune erreur JavaScript', erreurs.length === 0, erreurs.slice(0, 2).join(' | '));
} catch (e) {
    v('scène complète sans exception', false, String(e && e.stack || e).slice(0, 600));
} finally {
    await browser.close();
    srv.close();
}
fin();
