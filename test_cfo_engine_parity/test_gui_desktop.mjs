/**
 * v37.44 — AUDIT DE L'INTERFACE DE BUREAU, VERROUILLÉ.
 *
 *   « Audit global de la GUI de l'appli desktop web et amélioration. »
 *
 *   Chaque onglet des deux modes, à 1280×720 (le portable, ou 1600 px à 125 %) et
 *   à 1440×900, avec le CSS Tailwind recompilé comme en production. Ce que
 *   l'audit a trouvé ne doit plus revenir :
 *     • aucun chiffre qui sort de sa carte (tableau de bord à 1280 px) ;
 *     • aucun libellé de menu tronqué ;
 *     • aucun texte sous 10 px (hors monogramme de compte, pastille fixe) ;
 *     • aucun texte pâle sur fond clair sous 3:1, aucun gris clair sur blanc ;
 *     • aucun bouton-icône sans nom ;
 *     • le Changelog et l'avertissement d'import s'ouvrent en mode Réalisé ;
 *     • Trésorerie et Budget Structurel ne se renvoient plus l'un à l'autre ;
 *     • le fonds de sécurité vaut N mois de DÉPENSES, jamais négatif ;
 *     • pas de pastille de quote-part vide ;
 *     • la Synthèse Réelle n'est plus « en construction » : l'année, mois par
 *       mois, avec les chiffres du Contrôle Budget vs Réel.
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
console.log('\n  INTERFACE DE BUREAU — lisibilité, débordements, accessibilité, cohérence\n  ' + '─'.repeat(94));
const require = createRequire(import.meta.url);
const essai = (f) => { try { return f(); } catch { return null; } };
const pw = essai(() => require('playwright-core'));
const vueJs = essai(() => require.resolve('vue/dist/vue.global.js'));
const chartJs = essai(() => fs.existsSync(path.join(RACINE, 'node_modules/chart.js/dist/chart.umd.js')) && path.join(RACINE, 'node_modules/chart.js/dist/chart.umd.js'));
const twBin = path.join(RACINE, 'node_modules/.bin/tailwindcss');
const chromium = process.env.CHROMIUM || ['/opt/pw-browsers/chromium'].find(p => essai(() => fs.existsSync(p) && fs.statSync(p).isFile()));
const fin = () => { console.log('  ' + '─'.repeat(94)); console.log(ko === 0 ? `  ✅ TOUT PASSE — ${n} contrôles` : `  ❌ ${ko} contrôle(s) en échec sur ${n}`); process.exit(ko === 0 ? 0 : 1); };
if (!pw || !vueJs || !chartJs || !chromium || !fs.existsSync(twBin)) { console.log('  ⏭️  ignoré (playwright-core, vue, chart.js, tailwindcss ou Chromium absent)'); fin(); }

// Le CSS de production : Tailwind compilé sur index.html (le CDN le fait à la volée)
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-gui-'));
fs.writeFileSync(path.join(tmp, 'in.css'), '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
fs.writeFileSync(path.join(tmp, 'cfg.js'), 'module.exports={content:[' + JSON.stringify(path.join(RACINE, 'index.html')) + '],theme:{extend:{}}};');
execFileSync(twBin, ['-c', path.join(tmp, 'cfg.js'), '-i', path.join(tmp, 'in.css'), '-o', path.join(tmp, 'out.css'), '--minify'], { stdio: 'ignore' });
const tw = fs.readFileSync(path.join(tmp, 'out.css'), 'utf8');

const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8'));
const now = new Date(), Y = now.getFullYear();
const base = fx.donneesAnnuelles[Object.keys(fx.donneesAnnuelles)[0]];
fx.donneesAnnuelles = { [Y]: JSON.parse(JSON.stringify(base)), [Y + 1]: JSON.parse(JSON.stringify(base)) };
Object.assign(fx.soldesInitiaux, { anneeActuelle: Y, moisActuel: now.getMonth() + 1 });
const html = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8');
const page0 = html
    .replace('<script src="https://unpkg.com/vue@3/dist/vue.global.js"', '<script src="/vue.js"')
    .replace('<script src="https://cdn.jsdelivr.net/npm/chart.js"', '<script src="/chart.js"')
    .replace(/<script src="https:\/\/cdn\.tailwindcss\.com"[^>]*><\/script>/, '<link rel="stylesheet" href="/tailwind.css">')
    .replace(/<script[^>]*src="https:\/\/[^"]*"[^>]*><\/script>/g, '');
const srv = http.createServer((req, res) => {
    const p = req.url.split('?')[0];
    const s = (c, b, t = 'application/json') => { res.writeHead(c, { 'Content-Type': t }); res.end(b); };
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
const ECRANS = [['previsionnel', 'pilotageTheo'], ['previsionnel', 'dashboard'], ['previsionnel', 'parametres'], ['previsionnel', 'irregulieres'],
    ['previsionnel', 'studio'], ['previsionnel', 'wealth'], ['previsionnel', 'supervision'], ['previsionnel', 'settings'],
    ['reel', 'pilotage'], ['reel', 'saisie'], ['reel', 'controle'], ['reel', 'tresorerie'], ['reel', 'syntheseReel']];

/* Les mesures, faites DANS la page */
const mesurer = () => {
    const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05; };
    const txt = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 50);
    const rgb = (c) => { const m = c.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/); return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null; };
    const lum = ([r, g, b]) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const fond = (el) => { for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.backgroundImage !== 'none') return null; const c = rgb(cs.backgroundColor); if (c && c[3] > 0.5) return c; } return [255, 255, 255, 1]; };
    const out = { petit: [], pale: [], grisSurBlanc: [], deverse: [], sansNom: [], effet: [] };
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); const vus = new Set();
    while (w.nextNode()) {
        const t = w.currentNode; if (!t.nodeValue.trim()) continue;
        const el = t.parentElement; if (!el || vus.has(el) || !vis(el) || ['SCRIPT', 'STYLE', 'OPTION'].includes(el.tagName)) continue; vus.add(el);
        const cs = getComputedStyle(el), fs = parseFloat(cs.fontSize);
        if (fs < 10 && !el.closest('[data-mono-compte]')) out.petit.push(fs + 'px ' + txt(el));
        const fg = rgb(cs.color), bg = fond(el);
        if (fg && bg && lum(bg) >= 0.8 && !el.closest('[disabled], [aria-hidden="true"]')) {
            const mix = [0, 1, 2].map(i => fg[i] * fg[3] + bg[i] * (1 - fg[3]));
            const ratio = (Math.max(lum(mix), lum(bg)) + 0.05) / (Math.min(lum(mix), lum(bg)) + 0.05);
            if (ratio < 3) out.pale.push(ratio.toFixed(2) + ' ' + cs.color + ' ' + txt(el));
            if (/^rgb\((156, 163, 175|148, 163, 184)\)$/.test(cs.color)) out.grisSurBlanc.push(cs.color + ' ' + txt(el));
        }
        const rg = document.createRange(); rg.selectNodeContents(t); const tr = rg.getBoundingClientRect();
        let bl = el; while (bl && getComputedStyle(bl).display.startsWith('inline')) bl = bl.parentElement;
        if (bl && tr.width > 0 && getComputedStyle(bl).overflowX === 'visible') { const br = bl.getBoundingClientRect(); if (tr.right > br.right + 2 || tr.left < br.left - 2) out.deverse.push(txt(el)); }
    }
    document.querySelectorAll('button').forEach(b => {
        if (!vis(b) || b.closest('details:not([open])')) return;
        const nom = (b.getAttribute('aria-label') || b.getAttribute('title') || '').trim();
        if (!nom && !/[\p{L}\p{N}]/u.test(b.textContent || '')) out.sansNom.push(b.outerHTML.slice(0, 90));
    });
    // L'effet de la feuille v37.44 sur chaque couleur de texte : feuille active, puis coupée.
    // Un texte qu'elle recolore doit être sur fond clair, et son contraste ne doit jamais baisser.
    const feuille = document.getElementById('v3744-lisibilite');
    if (!feuille) out.effet.push('feuille v3744-lisibilite absente');
    else {
        const els = [...vus], avec = els.map(e => getComputedStyle(e).color);
        feuille.disabled = true; const sans = els.map(e => getComputedStyle(e).color); feuille.disabled = false;
        const fonds = (el) => { for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const cs = getComputedStyle(e);
            if (cs.backgroundImage !== 'none') { const st = [...cs.backgroundImage.matchAll(/rgba?\([^)]*\)/g)].map(m => rgb(m[0])).filter(c => c && c[3] > 0.5); if (st.length) return st; }
            const c = rgb(cs.backgroundColor); if (c && c[3] > 0.5) return [c]; } return [[255, 255, 255, 1]]; };
        const ratio = (fg, bg) => { const m = [0, 1, 2].map(i => fg[i] * fg[3] + bg[i] * (1 - fg[3])); return (Math.max(lum(m), lum(bg)) + 0.05) / (Math.min(lum(m), lum(bg)) + 0.05); };
        els.forEach((el, i) => {
            if (avec[i] === sans[i]) return;
            const bgs = fonds(el), pire = (c) => Math.min(...bgs.map(b => ratio(rgb(c), b)));
            if (bgs.some(b => lum(b) < 0.5)) out.effet.push('foncé sur fond sombre : ' + sans[i] + ' → ' + avec[i] + ' ' + txt(el));
            else if (pire(avec[i]) < pire(sans[i]) - 0.01) out.effet.push('contraste baissé : ' + pire(sans[i]).toFixed(2) + ' → ' + pire(avec[i]).toFixed(2) + ' ' + txt(el));
        });
        out.recolores = els.filter((_, i) => avec[i] !== sans[i]).length;
    }
    out.menu = [...document.querySelectorAll('[data-nav-libelle]')].filter(vis).map(e => ({ t: e.textContent.trim(), coupe: e.scrollWidth > e.clientWidth + 1 || getComputedStyle(e).textOverflow === 'ellipsis' }));
    return out;
};

const ouvrir = async (w, h) => {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const erreurs = []; page.on('pageerror', e => erreurs.push(String(e)));
    page.on('dialog', d => d.dismiss());
    await page.goto(`http://127.0.0.1:${srv.address().port}/finance/`, { waitUntil: 'load' });
    await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && Array.isArray(a.__vue_app__._instance.setupState.masterAssets); }, null, { timeout: 30000 });
    await page.waitForTimeout(900);
    return { page, erreurs };
};
const aller = (page, mode, tab) => page.evaluate(({ ST, mode, tab }) => { const st = eval(ST); st.appMode = mode; st.activeTab = tab; }, { ST, mode, tab }).then(() => page.waitForTimeout(500));
const CAPTURES = process.env.CAPTURES || '';
try {
    for (const [W, H] of [[1280, 720], [1440, 900]]) {
        console.log(`  ── ${W}×${H} : les ${ECRANS.length} écrans`);
        const { page, erreurs } = await ouvrir(W, H);
        const tous = {};
        for (const [mode, tab] of ECRANS) { await aller(page, mode, tab); tous[mode + '/' + tab] = await page.evaluate(mesurer); }
        const parEcran = (k) => Object.entries(tous).filter(([, m]) => m[k].length).map(([e, m]) => e + ' : ' + m[k].slice(0, 3).join(' | ')).join(' ;; ');
        v(`aucun texte ne sort de sa carte (le tableau de bord débordait de 27 à 60 px)`, !parEcran('deverse'), parEcran('deverse'));
        const menu = Object.values(tous).flatMap(m => m.menu);
        v('aucun libellé du menu tronqué (« Calendrier Plurian… », « Patrimoine & Obje… »)', menu.length >= 13 && !menu.some(x => x.coupe)
          && ['Calendrier Pluriannuel', 'Patrimoine & Objectifs', 'Contrôle Budget vs Réel'].every(l => menu.some(x => x.t === l)), JSON.stringify(menu.filter(x => x.coupe)));
        v('aucun texte sous 10 px (hors monogramme de compte)', !parEcran('petit'), parEcran('petit'));
        v('aucun texte pâle sous 3:1 sur fond clair', !parEcran('pale'), parEcran('pale'));
        v('aucun gris clair (gray-400 / slate-400) posé sur fond clair', !parEcran('grisSurBlanc'), parEcran('grisSurBlanc'));
        const recolores = Object.values(tous).reduce((n, m) => n + (m.recolores || 0), 0);
        v(`la feuille ne fonce jamais un texte sur fond sombre, ni ne baisse un contraste (${recolores} textes recolorés)`, !parEcran('effet') && recolores > 0, parEcran('effet'));
        v('aucun bouton-icône sans nom (✕, ×, ↑, ↓…)', !parEcran('sansNom'), parEcran('sansNom'));
        if (W === 1280) {
            const kpi = await (async () => { await aller(page, 'previsionnel', 'dashboard'); return page.$$eval('[data-kpi-grille] > div', els => els.map(e => Math.round(e.getBoundingClientRect().width))); })();
            v('tableau de bord : les cinq cartes, assez larges pour leur chiffre (≥ 200 px)', kpi.length === 5 && kpi.every(x => x >= 200), JSON.stringify(kpi));
            if (CAPTURES) await page.screenshot({ path: path.join(CAPTURES, 'gui_tableau_de_bord_1280.png') });
        }
        v(`aucune erreur JavaScript (${W} px)`, erreurs.length === 0, erreurs.slice(0, 2).join(' | '));
        await page.close();
    }

    console.log('  ── la cohérence : fenêtres, soldes, fonds de sécurité, patrimoine, synthèse');
    const { page, erreurs } = await ouvrir(1280, 720);
    const head = await page.evaluate(() => ({ titre: document.title, robots: document.querySelector('meta[name="robots"]')?.content || '' }));
    const titreSource = (html.match(/<title>([^<]*)<\/title>/) || [])[1];
    v('titre de l\'onglet : « Finance Master — espace privé » (plus « v32.60 Auto-Categorisation »)', titreSource === 'Finance Master — espace privé' && !/v\d+\.\d+/.test(head.titre), titreSource + ' / ' + head.titre);
    v('la page se déclare non indexable (robots noindex) : elle n\'a rien à faire dans un moteur', /noindex/.test(head.robots) && /nofollow/.test(head.robots), head.robots);

    await aller(page, 'reel', 'pilotage');
    await page.click('button:has-text("Changelog")');
    await page.waitForTimeout(300);
    v('mode Réalisé : « Changelog » ouvre l\'historique des versions (il n\'ouvrait rien)', await page.isVisible('text=Historique des Versions'));
    await page.click('button[aria-label="Fermer"]:near(:text("Historique des Versions"))').catch(() => page.evaluate((ST) => { eval(ST).showChangelog = false; }, ST));
    await page.evaluate((ST) => { eval(ST).showImportWarning = true; }, ST); await page.waitForTimeout(250);
    v('mode Réalisé : l\'avertissement d\'import s\'affiche aussi', await page.evaluate(() => [...document.querySelectorAll('.fixed.inset-0')].some(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && /annuler/i.test(e.textContent); })));
    await page.evaluate((ST) => { eval(ST).showImportWarning = false; }, ST);

    await aller(page, 'reel', 'tresorerie');
    const aide = await page.textContent('[data-treso-aide]').catch(() => '');
    v('Trésorerie : « saisissez ici le solde réel » — plus « utilisez Budget Structurel »', /Saisissez ici le solde réel de chaque compte/.test(aide) && !/utilisez ⚙️ Budget Structurel\./.test(await page.textContent('body')), aide);
    await aller(page, 'previsionnel', 'parametres');
    await page.click('[data-solde-tresorerie]');
    await page.waitForTimeout(300);
    v('Budget Structurel : le renvoi ouvre la Trésorerie (mode Réalisé)', await page.evaluate((ST) => { const st = eval(ST); return st.appMode === 'reel' && st.activeTab === 'tresorerie'; }, ST));

    await aller(page, 'previsionnel', 'settings');
    const fonds = await page.evaluate((ST) => { const st = eval(ST); return { cible: st.cibleFondsSecurite, dep: st.depensesMensuellesBase, mois: st.parametres.objectifFondsSecuriteMois,
        surplus: st.surplusMensuelBase, texte: document.querySelector('[data-fonds-cible]')?.textContent.replace(/\s+/g, ' ') || '', couv: document.querySelector('[data-fonds-couverture]')?.textContent.replace(/\s+/g, ' ') || '' }; }, ST);
    const fmt = (x) => Math.round(x).toLocaleString('fr-FR').replace(/\s/g, ' ');
    v('fonds de sécurité : N mois × les dépenses mensuelles — jamais négatif', fonds.cible > 0 && fonds.cible === Math.round(fonds.dep * fonds.mois) && fonds.surplus < 0, JSON.stringify(fonds));
    v('  → l\'écran dit le calcul et la couverture actuelle', fonds.texte.replace(/\s/g, ' ').includes(fonds.mois + ' mois × ') && /Liquidités aujourd'hui : .* — (\d+ % de l'objectif|objectif atteint)/.test(fonds.couv), fonds.texte + ' || ' + fonds.couv);

    await aller(page, 'previsionnel', 'wealth');
    const qp = await page.$$eval('[data-quote-part]', els => els.map(e => e.textContent.trim()));
    const vides = await page.evaluate((ST) => eval(ST).masterAssets.filter(a => !String(a.quotePart || '').trim()).length, ST);
    v('patrimoine : pas de pastille de quote-part vide, « 35 » devient « 35 % »', qp.every(t => t !== '' && /%$/.test(t)) && qp.includes('35 %') && qp.length === 2 - vides, JSON.stringify({ qp, vides }));

    // deux dépenses réelles ce mois-ci (catégorie réelle de l'application), pour comparer Synthèse et Contrôle
    await page.evaluate((ST) => { const st = eval(ST), m = new Date().getMonth() + 1, a = st.anneeAffichage, d = st.donneesAnnuelles[a];
        const cv = Object.values(d.chargesVariables || {}).find(c => c && c.categorieId);
        const j = (x) => a + '-' + String(m).padStart(2, '0') + '-0' + x;
        d.transactionsReelles = [{ id: 9001, date: j(1), mois: m, libelle: 'MARJANE', montant: 640, categorieId: cv.categorieId, compteId: 1 },
                                 { id: 9002, date: j(2), mois: m, libelle: 'CARREFOUR', montant: 360, categorieId: cv.categorieId, compteId: 1 }];
        st.forceUpdateCalculations && st.forceUpdateCalculations(); }, ST);
    await aller(page, 'reel', 'syntheseReel');
    const syn = await page.evaluate((ST) => {
        const st = eval(ST);
        const lignes = [...document.querySelectorAll('[data-synthese-mois]')].map(r => ({ m: +r.dataset.syntheseMois, etat: r.dataset.etat, t: r.textContent.replace(/\s+/g, ' ').trim() }));
        const m = new Date().getMonth() + 1;
        st.moisControle = m;
        const ctl = { ...st.controleTotaux };
        const ligne = st.syntheseAnnee.mois.find(x => x.m === m);
        const cumul = st.syntheseAnnee.mois.filter(x => x.m <= m).reduce((s, x) => s + x.budget, 0);
        return { lignes, ctl, ligne, cumul, synCumul: st.syntheseAnnee.cumul, construction: /En construction/.test(document.body.textContent) };
    }, ST);
    v('Synthèse Réelle : plus « en construction » — douze mois', !syn.construction && syn.lignes.length === 12, JSON.stringify(syn.lignes.length));
    v('  → le mois en cours : les MÊMES prévu et réalisé que le Contrôle Budget vs Réel', syn.ligne && Math.round(syn.ligne.budget) === Math.round(syn.ctl.budget) && Math.round(syn.ligne.realise) === Math.round(syn.ctl.realise)
      && syn.ligne.realise === 1000 && syn.ligne.etat === 'courant', JSON.stringify({ ligne: syn.ligne, ctl: syn.ctl }));
    v('  → cumuls : les mois écoulés et le mois en cours, pas les mois à venir', Math.round(syn.synCumul.budget) === Math.round(syn.cumul) && syn.synCumul.nb === new Date().getMonth() + 1, JSON.stringify(syn.synCumul));
    v('  → les mois à venir sont marqués « à venir », sans écart inventé', syn.lignes.filter(l => l.etat === 'avenir').every(l => /à venir/.test(l.t) && /—/.test(l.t)), JSON.stringify(syn.lignes.filter(l => l.etat === 'avenir').slice(0, 2)));
    if (CAPTURES) await page.screenshot({ path: path.join(CAPTURES, 'gui_synthese.png') });
    const mClic = Math.max(1, new Date().getMonth());
    await page.click(`[data-synthese-mois="${mClic}"]`);
    await page.waitForTimeout(300);
    v('  → un clic sur un mois ouvre son détail par catégorie', await page.evaluate(({ ST, mClic }) => { const st = eval(ST); return st.activeTab === 'controle' && st.moisControle === mClic; }, { ST, mClic }));
    v('aucune erreur JavaScript', erreurs.length === 0, erreurs.slice(0, 2).join(' | '));
} catch (e) {
    v('scène complète sans exception', false, String(e && e.stack || e).slice(0, 500));
} finally {
    await browser.close();
    srv.close();
}
fin();
