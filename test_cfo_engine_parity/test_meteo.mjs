/**
 * v37.17 — MÉTÉO FINANCIÈRE ET RESPIRATION DU PRÉVISIONNEL.
 *
 *   Un écran qui rassure doit d'abord dire vrai. Cette suite vérifie donc les
 *   chiffres AVANT l'apparence :
 *     - le reste à vivre est celui que le Réalisé affiche déjà, et il obéit à
 *       une identité exacte : atterrissage + enveloppe conso restante = cash
 *       disponible. Dépenser le reste à vivre, pas un dirham de plus, fait
 *       atterrir à zéro — c'est ce qui autorise la Météo à l'écrire ;
 *     - les trois ciels (orage / nuages / soleil) suivent les seuils annoncés ;
 *     - la jauge du Prévisionnel suit le moteur du simulateur : sur douze mois,
 *       marge + épargne = surplusBudgetaireAnnuel, au dirham.
 *   Puis le rendu : la Météo est la même dans le Réalisé, le Prévisionnel et
 *   l'accueil mobile ; la barre se remplit à 100 % ; le téléphone ne déborde pas.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..');
const html = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8').split('\r\n').join('\n');

let ko = 0;
const v = (t, ok, d = '') => { if (!ok) ko++; console.log(`  ${ok ? '✅' : '❌'} ${t.padEnd(64)} ${ok ? '' : d}`); };
console.log('\n  MÉTÉO FINANCIÈRE & RESPIRATION DU PRÉVISIONNEL\n  ' + '─'.repeat(80));

/* ── A. Statique ─────────────────────────────────────────────────────── */
v('un seul composant Météo, enregistré', /const MeteoFinanciere = \{/.test(html) && html.includes("'meteo-financiere': MeteoFinanciere"));
v('posé dans le Réalisé, le Prévisionnel et l\'accueil mobile',
  (html.match(/<meteo-financiere\s/g) || []).length === 3, String((html.match(/<meteo-financiere\s/g) || []).length));
v('l\'animation de l\'icône respecte « réduire les animations »',
  /prefers-reduced-motion: reduce\)\s*\{\s*\.meteo-flotte\s*\{\s*animation:\s*none/.test(html));

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
    const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'twmeteo-'));
    fs.writeFileSync(path.join(tmp, 'in.css'), '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
    fs.writeFileSync(path.join(tmp, 'cfg.js'), 'module.exports={content:[' + JSON.stringify(path.join(RACINE, 'index.html')) + '],theme:{extend:{}}};');
    execFileSync(twBin, ['-c', path.join(tmp, 'cfg.js'), '-i', path.join(tmp, 'in.css'), '-o', path.join(tmp, 'out.css'), '--minify'], { stdio: 'ignore' });
    const css = fs.readFileSync(path.join(tmp, 'out.css'), 'utf8');
    return css.length > 10000 ? css : null;
});

/* ── B. Le décor : paie hier, un budget lisible à la main ────────────── */
const maintenant = new Date();
const T = maintenant.getDate();
const jourDePaie = Math.min(28, Math.max(2, T - 1));
const Y = maintenant.getFullYear(), MC = maintenant.getMonth() + 1;
const MOIS_BUDGET = T >= jourDePaie ? (MC === 12 ? 1 : MC + 1) : MC;
const AN_BUDGET = (T >= jourDePaie && MC === 12) ? Y + 1 : Y;

const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8'));
const base = fx.donneesAnnuelles[Object.keys(fx.donneesAnnuelles)[0]];
fx.donneesAnnuelles = {};
for (const an of [AN_BUDGET, AN_BUDGET + 1]) fx.donneesAnnuelles[an] = JSON.parse(JSON.stringify(base));
Object.assign(fx.soldesInitiaux, { moisActuel: MOIS_BUDGET, anneeActuelle: AN_BUDGET, jourDePaie,
    compteChargesFixes: 'courant', compteChargesVariables: 'courant', assurances_tracker: [] });
fx.comptes = [{ id: 1, label: 'Compte Courant', type: 'courant', solde: 3000, icone: '💳' }];
const neutre = { paye: false, montantPaye: 0, exceptions: [], showExceptions: false };
for (const an of Object.keys(fx.donneesAnnuelles)) {
    const d = fx.donneesAnnuelles[an];
    const Rv = (label, b, j) => ({ ...neutre, label, base: b, jourPrevu: j, destinationCompte: 'courant' });
    d.revenus = { salaire: Rv('SALAIRE', 20000, jourDePaie), bonif: Rv('—', 0), magasin: Rv('—', 0), cnss: Rv('—', 0), appart: Rv('—', 0), studio: Rv('—', 0) };
    const Fx = (label, valeur) => ({ ...neutre, label, valeur, jourPrevu: null });
    d.chargesFixes = { creditImmo: Fx('LOYER', 6000), creditStudio: Fx('—', 0), syndic: Fx('—', 0), nounou: Fx('—', 0), ecole: Fx('—', 0),
                       femmeMenage: Fx('—', 0), habitsCharif: Fx('—', 0), habitsBebe: Fx('—', 0), jouets: Fx('—', 0) };
    const V = (label, valeur, periode) => ({ ...neutre, label, valeur, periode, details: [] });
    d.chargesVariables = { alimentation: V('COURSES', 1000, 'semaine'), sante: V('—', 0, 'semaine'), sorties: V('—', 0, 'semaine'),
                           voiture: V('—', 0, 'semaine'), factures: { ...V('FACTURES', 800, 'mois'), categorieId: 'cat_cv_factures' } };
    d.epargne = [{ id: 31, nom: 'EPARGNE', valeur: 2000, sourceCompte: 'courant', jourPrevu: null }];
    d.depensesIrregulieres = [{ id: 41, mois: MOIS_BUDGET, annee: Number(an), nom: 'CADEAU', montant: 700, sourceCompte: 'courant' }];
    d.virementsInternes = []; d.transactionsReelles = [];
}
/*  Respiration du mois budgétaire, à la main :
      ressources 20 000 ; sorties 6 000 + 800 + 1 000 × 4,3 + 2 000 + 700 = 13 800
      marge 6 200 → 31 %, « ample ».                                          */
const RESP = { ressources: 20000, sorties: 13800, marge: 6200, pct: 31 };

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
    if (p === '/finance/finance_data.json') return s(200, JSON.stringify(fx));
    return s(200, '{"status":"ok"}');
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port;
const browser = await pw.chromium.launch({ executablePath: chromium, args: ['--no-sandbox'] });
const ST = 'document.querySelector("#app").__vue_app__._instance.setupState';
const ouvrir = async (opts, mode = 'reel', onglet = 'pilotage') => {
    const page = await browser.newPage(opts);
    const erreurs = []; page.on('pageerror', e => erreurs.push(String(e)));
    page.on('dialog', d => d.accept());
    await page.goto(`http://127.0.0.1:${port}/finance/`, { waitUntil: 'load' });
    await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState.moisBudgetaire; }, null, { timeout: 30000 });
    await page.waitForTimeout(600);
    await page.evaluate(async ({ ST, mode, onglet }) => { const st = eval(ST); st.appMode = mode; await new Promise(r => setTimeout(r, 250)); st.activeTab = onglet; }, { ST, mode, onglet });
    await page.waitForTimeout(600);
    return { page, erreurs };
};

try {
    const { page, erreurs } = await ouvrir({ viewport: { width: 1400, height: 1000 } });
    const present = await page.evaluate((ST) => !!eval(ST).meteoFinanciere, ST);
    v('la Météo est exposée', present, 'meteoFinanciere absent');
    if (!present) throw new Error('ABSENT');

    /* ── C. Le reste à vivre dit vrai ─────────────────────────────────── */
    const lire = () => page.evaluate((ST) => {
        const st = eval(ST);
        return { m: JSON.parse(JSON.stringify(st.meteoFinanciere)), env: st.enveloppeConsoRestante, cash: st.cashDispoPourConso,
                 rav: st.budgetConsoRestantReel, atterr: st.kpiAtterrissage.montant, jours: st.joursRestantsAvantPaie };
    }, ST);
    const scenario = async (solde) => {
        await page.evaluate(async ({ ST, solde }) => { const st = eval(ST); st.comptes[0].solde = solde; st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 120)); }, { ST, solde });
        return lire();
    };
    const s0 = await lire();
    v('reste à vivre = celui du Réalisé (budgetConsoRestantReel)', s0.m.rav === Math.round(s0.rav), JSON.stringify([s0.m.rav, s0.rav]));
    v('identité : atterrissage + enveloppe conso restante = cash disponible',
      Math.abs(s0.atterr + s0.env - s0.cash) <= 1, JSON.stringify(s0));
    v('par jour = reste à vivre ÷ jours jusqu\'à la paie (arrondi vers le bas)',
      s0.m.parJour === Math.max(0, Math.floor(s0.m.rav / Math.max(1, s0.jours))) && s0.m.parJour * Math.max(1, s0.jours) <= Math.max(0, s0.m.rav),
      JSON.stringify(s0.m));

    /* ── D. Les trois ciels ───────────────────────────────────────────── */
    // Orage : on vide le compte jusqu'à un découvert de fin de cycle.
    const orage = await scenario(-30000);
    v('compte à découvert en fin de cycle → ⛈️ Orage', orage.m.etat === 'orage' && orage.atterr < 0, JSON.stringify(orage.m));
    v('  → la raison cite la date et le montant du découvert',
      orage.m.raison.includes(orage.m.dateFin) && /-\s?\d/.test(orage.m.raison), orage.m.raison);
    // L'atterrissage suit le solde au dirham près : on le place à −10 DH.
    const auBord = await scenario(Math.round(-30000 - orage.atterr - 10));
    if (auBord.m.etat === 'orage' && auBord.m.rav > 0) {
        v('orage rattrapable : le conseil donne le plafond, et il fait atterrir à ~0',
          auBord.m.conseil.includes('rester à flot') && Math.abs(auBord.m.siRav) <= 1, JSON.stringify(auBord.m));
    } else {
        v('orage rattrapable (cas construit)', false, JSON.stringify(auBord.m));
    }
    // Nuages : atterrissage positif mais coussin < 5 % des revenus (1 000 DH ici).
    const n = await scenario(Math.round(-30000 + (0 - orage.atterr) + 500));
    v('coussin de fin de cycle < 5 % des revenus → ⛅ Nuages',
      n.m.etat === 'nuages' && n.atterr >= 0 && n.atterr < 1000 && /Coussin/.test(n.m.raison), JSON.stringify({ atterr: n.atterr, m: n.m }));
    // Soleil
    const sol = await scenario(60000);
    v('coussin confortable → ☀️ Soleil', sol.m.etat === 'soleil' && sol.atterr >= 1000, JSON.stringify(sol.m));
    v('  → le conseil chiffre la dépense par jour', sol.m.conseil.includes(new Intl.NumberFormat('fr-FR').format(sol.m.parJour)), sol.m.conseil);

    /* ── E. La respiration suit le moteur du simulateur ──────────────── */
    const r = await page.evaluate(({ ST, AN }) => {
        const st = eval(ST);
        const R = JSON.parse(JSON.stringify(st.respirationBudgetaire));
        let cumul = 0;
        for (let m = 1; m <= 12; m++) { const x = st.respirationDuMois(AN, m); cumul += x.marge + x.segments.find(s => s.cle === 'epargne').montant; }
        return { R, cumul: Math.round(cumul), surplus: Math.round(st.surplusBudgetaireAnnuel(AN)) };
    }, { ST, AN: AN_BUDGET });
    v(`respiration du mois : ${RESP.marge} DH libres sur ${RESP.ressources} (${RESP.pct} %, ample)`,
      r.R.ressources === RESP.ressources && r.R.sorties === RESP.sorties && r.R.marge === RESP.marge && r.R.pct === RESP.pct && r.R.niveau === 'ample',
      JSON.stringify({ ressources: r.R.ressources, sorties: r.R.sorties, marge: r.R.marge, pct: r.R.pct, niveau: r.R.niveau }));
    v('sur 12 mois, marge + épargne = surplusBudgetaireAnnuel (même moteur)', r.cumul === r.surplus, JSON.stringify(r));
    v('les segments + la marge remplissent exactement la barre',
      Math.abs(r.R.segments.reduce((s, x) => s + x.part, 0) + r.R.partMarge - 100) < 0.01, JSON.stringify(r.R.segments.map(s => s.part)));

    /* ── F. Le rendu, aux trois emplacements ──────────────────────────── */
    const domMeteo = (pg) => pg.evaluate(() => {
        const m = document.querySelector('[data-meteo]');
        if (!m) return null;
        const r = m.getBoundingClientRect();
        return { etat: m.dataset.etat, jour: m.querySelector('[data-meteo-jour]')?.textContent.trim(),
                 titre: m.querySelector('[data-meteo-titre]')?.textContent.trim(), haut: r.top + window.scrollY, hauteur: r.height };
    });
    const dReel = await domMeteo(page);
    const ordre = await page.evaluate(() => {
        const t = (s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().top : null; };
        return { meteo: t('[data-meteo]'), kpis: t('[data-cockpit-kpis]') };
    });
    v('Réalisé : la Météo chapeaute les trois chiffres', !!dReel && ordre.meteo < ordre.kpis, JSON.stringify({ dReel, ordre }));
    v('  → elle affiche le reste à vivre du jour',
      !!dReel && dReel.jour.replace(/\s/g, '') === new Intl.NumberFormat('fr-FR').format(sol.m.parJour).replace(/\s/g, '') + 'DH', JSON.stringify(dReel));
    await page.evaluate(async (ST) => { const st = eval(ST); st.appMode = 'previsionnel'; await new Promise(r => setTimeout(r, 200)); st.activeTab = 'pilotageTheo'; }, ST);
    await page.waitForTimeout(600);
    const dTheo = await domMeteo(page);
    v('Prévisionnel : la MÊME Météo, au même chiffre', !!dTheo && dTheo.etat === dReel.etat && dTheo.jour === dReel.jour, JSON.stringify({ dTheo, dReel }));
    const barre = await page.evaluate(() => {
        const b = document.querySelector('[data-respiration-barre]');
        if (!b) return null;
        const w = [...b.children].reduce((s, c) => s + c.getBoundingClientRect().width, 0);
        return { rempli: w / b.getBoundingClientRect().width, segments: [...b.children].map(c => c.dataset.segment),
                 pct: document.querySelector('[data-respiration-pct]')?.textContent.trim(),
                 cartes: [...document.querySelectorAll('[data-theo-carte]')].map(c => c.dataset.theoCarte) };
    });
    if (twCss) v('la barre de respiration est pleine, segment par segment', !!barre && Math.abs(barre.rempli - 1) < 0.01, JSON.stringify(barre));
    v('  → avec la marge libre en dernier, et le pourcentage annoncé',
      !!barre && barre.segments[barre.segments.length - 1] === 'marge' && barre.pct === RESP.pct + ' %', JSON.stringify(barre));
    v('  → une carte par poste, chaque ligne avec sa barre de poids',
      !!barre && ['revenus', 'fixes', 'mensuelles', 'conso', 'epargne', 'exceptionnel'].every(c => barre.cartes.includes(c)), JSON.stringify(barre && barre.cartes));
    // Le lien de la Météo mène au Réalisé
    await page.click('[data-meteo] [data-meteo-lien]');
    await page.waitForTimeout(500);
    v('le bouton de la Météo bascule vers le Réalisé',
      await page.evaluate((ST) => { const st = eval(ST); return st.appMode === 'reel' && st.activeTab === 'pilotage'; }, ST));
    // … et dans l'autre sens, depuis le Réalisé
    await page.click('[data-meteo] [data-meteo-lien]');
    await page.waitForTimeout(500);
    v('  → et depuis le Réalisé, « Voir le budget prévu » ouvre le Prévisionnel',
      await page.evaluate((ST) => { const st = eval(ST); return st.appMode === 'previsionnel' && st.activeTab === 'pilotageTheo'; }, ST));
    // Défaut trouvé en chemin : le garde-fou des onglets remplaçait « pilotage »
    await page.click('button[title="Mode Réalisé"]');
    await page.waitForTimeout(400);
    v('« Mode Réalisé » mène au Pilotage, plus à Saisie',
      await page.evaluate((ST) => { const st = eval(ST); return st.appMode + '/' + st.activeTab; }, ST) === 'reel/pilotage');
    v('aucune erreur JavaScript (bureau)', erreurs.length === 0, erreurs[0] || '');
    await page.close();

    /* ── G. Téléphone : l'accueil du Prévisionnel et le Réalisé ───────── */
    for (const [mode, onglet, nom] of [['previsionnel', 'dashboard', 'accueil Prévisionnel'], ['reel', 'pilotage', 'Réalisé']]) {
        const m = await ouvrir({ viewport: { width: 384, height: 832 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, mode, onglet);
        const d = await domMeteo(m.page);
        const debord = await m.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        v(`S24+ (${nom}) : Météo présente, aucun débordement`, !!d && debord <= 0, JSON.stringify({ d, debord }));
        if (twCss) v(`  → elle laisse de la place sous elle (< 75 % de l'écran)`, !!d && d.hauteur < 832 * 0.75, JSON.stringify(d));
        v(`  → aucune erreur JavaScript`, m.erreurs.length === 0, m.erreurs[0] || '');
        await m.page.close();
    }
} catch (e) {
    if (e.message !== 'ABSENT') { ko++; console.log('  ❌ exception : ' + e.message.split('\n')[0]); }
} finally {
    await browser.close();
    srv.close();
}
console.log('  ' + '─'.repeat(80));
console.log(ko === 0 ? '  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
