/**
 * v37.51 — CLÔTURER UNE CASE DU RÉALISÉ.
 *
 *   « Je veux un bouton (clôturer cette catégorie pour cette semaine ou cycle ou 15 j) pour
 *   chaque case du réalisé, pour que l'appli n'attende plus un ajout. » — « Il se peut que je
 *   dépasse le budget d'une case et que j'y rajoute même après l'avoir clôturée : ça ne se
 *   désactive pas, ça me dit dépassement. »
 *
 *   Contre des calculs faits à la main. Mercredi 14 oct. 2026, 10 h ; cycle de 5 semaines (paie
 *   le 8 : 8 oct. → 7 nov.). COURSES : Marjane 600 / sem, Œufs 50 / sem, Samak 75 / sem,
 *   Hri 1 000 / cycle ; SORTIES 400 / sem, sans ligne. Budget conso : 725 × 5 + 1 000 + 400 × 5
 *   = 6 625. La semaine du 5 oct. est écoulée, rien saisi : 600 + 50 + 75 + 400 = 1 125 au prévu.
 *   FACTURES (Pilotage) : tel 99, eau 300. LOYER 6 000. SALAIRE 20 000.
 *
 *     A. statique ;
 *     M. MÉTÉO — une ligne / sem close pour la semaine (libère son reste), dépassement après
 *        clôture, semaine écoulée (plus « au prévu »), ligne / cycle close pour le cycle,
 *        catégorie sans ligne, rouvrir, « effacer tout le cycle », clôture rechargée ;
 *     P. PILOTAGE — 🔒 d'une case à moitié réglée (eau 54 / 300), « + ajouter » après clôture,
 *        dépassement, décocher = rouvrir, close à 0, charge fixe avec avance, revenu reçu en partie.
 *
 *   v37.65 — LES SEMAINES COUPÉES PAR LA PAIE : le cycle (31 jours) commence le jeudi 8 par un morceau
 *   de 4 jours (du 8 au 11), l'ex-« semaine du 5 ». Calculs à la main : budget 4 211 + 1 771 = 5 982 ;
 *   du 8 au 11, rien saisi : Marjane 343, Œufs 28, Samak 43, SORTIES 228 — soit 642 au prévu.
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
console.log('\n  CLÔTURER UNE CASE : PLUS RIEN N\'EST ATTENDU, RIEN NE SE BLOQUE\n  ' + '─'.repeat(80));

/* ── A. Statique ─────────────────────────────────────────────────────── */
v('A. une case close est « faite » (isItemPaid lit cloture)', /if \(e\.cloture\) return true;/.test(html));
v('  → les restes « dû − réglé » passent tous par resteDuItem (plus aucun Math.max direct)',
  !/Math\.max\(0, (\w+) - getPaidAmount\(\w+, \1/.test(html.replace(/const resteDuItem = [^\n]*/, '')) && (html.match(/resteDuItem\(/g) || []).length === 19,
  String((html.match(/resteDuItem\(/g) || []).length));
v('  → un 🔒 sur chaque ligne à traiter, chaque poste de la Météo, chaque catégorie sans poste',
  /data-cloturer @click="cloturerItem\(t\.ref, cyclePilotage\)"/.test(html) && (html.match(/data-pulse-cloturer/g) || []).length === 2);
v('  → les trois Météo écoutent le 🔒', (html.match(/@cloturer="basculerClotureConso"/g) || []).length === 3);
v('  → « Déjà validé » : on peut toujours ajouter, aucun champ désactivé', /data-valide-ajout/.test(html) && !/data-valide-ajout[^>]*:?disabled/.test(html));

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
const JDP = 8;
const S1 = '2026-10-08', S2 = '2026-10-12';                  // v37.65 : le cycle commence le jeudi 8
const BUDGET = 4211 + 1771;                                  // 5 982 : (725 × 31 / 7 + 1 000) + 400 × 31 / 7
const DEBUT = 343 + 28 + 43 + 228;                           // 642 : du 8 au 11 (4 j), au prévu
let clotureChargee = null;                                    // consoClotureT0 servi au chargement (M10)
const fixture = () => {
    const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8'));
    const base = fx.donneesAnnuelles[Object.keys(fx.donneesAnnuelles)[0]];
    fx.donneesAnnuelles = {};
    for (const an of [2025, 2026, 2027]) fx.donneesAnnuelles[an] = JSON.parse(JSON.stringify(base));
    Object.assign(fx.soldesInitiaux, { moisActuel: 11, anneeActuelle: 2026, jourDePaie: JDP,
        compteChargesFixes: 'courant', compteChargesVariables: 'courant', assurances_tracker: [], voyageDebut: '', voyageFin: '' });
    fx.comptes = [{ id: 1, label: 'Compte Courant', type: 'courant', solde: 90000, icone: '💳' }];
    const neutre = { paye: false, montantPaye: 0, exceptions: [], showExceptions: false };
    for (const an of Object.keys(fx.donneesAnnuelles)) {
        const d = fx.donneesAnnuelles[an];
        const Rv = (label, b, j) => ({ ...neutre, label, base: b, jourPrevu: j, destinationCompte: 'courant' });
        d.revenus = { salaire: Rv('SALAIRE', 20000, JDP), bonif: Rv('—', 0), magasin: Rv('—', 0), cnss: Rv('—', 0), appart: Rv('—', 0), studio: Rv('—', 0) };
        const Fx = (label, valeur) => ({ ...neutre, label, valeur, jourPrevu: null });
        d.chargesFixes = { creditImmo: Fx('LOYER', 6000), creditStudio: Fx('—', 0), syndic: Fx('—', 0), nounou: Fx('—', 0), ecole: Fx('—', 0),
                           femmeMenage: Fx('—', 0), habitsCharif: Fx('—', 0), habitsBebe: Fx('—', 0), jouets: Fx('—', 0) };
        const V = (label, valeur, periode, details = []) => ({ ...neutre, label, valeur, periode, details });
        d.chargesVariables = {
            alimentation: V('COURSES', 725, 'semaine', [{ id: 1, nom: 'Marjane', montant: 600 }, { id: 2, nom: 'Œufs', montant: 50 },
                                                         { id: 3, nom: 'Samak', montant: 75 }, { id: 4, nom: 'Hri', montant: 1000, periode: 'cycle' }]),
            sorties: V('SORTIES', 400, 'semaine'), voiture: V('—', 0, 'mois'), sante: V('—', 0, 'semaine'),
            factures: { ...V('FACTURES', 399, 'mois', [{ id: 11, nom: 'tel', montant: 99 }, { id: 12, nom: 'eau', montant: 300 }]), categorieId: 'cat_cv_factures' },
        };
        d.epargne = []; d.depensesIrregulieres = []; d.virementsInternes = []; d.transactionsReelles = []; d.consoRealiseeT0 = {};
        if (clotureChargee && Number(an) === 2026) d.consoClotureT0 = JSON.parse(JSON.stringify(clotureChargee));
    }
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
const sansEsp = (t) => String(t || '').replace(/\s/g, '');
const attendre = (page, ms) => page.waitForTimeout(ms);

const ouvrir = async () => {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
    await page.clock.setFixedTime(new Date(2026, 9, 14, 10, 0, 0));
    const erreurs = []; page.on('pageerror', e => erreurs.push(String(e)));
    page.on('dialog', d => d.accept());
    await page.goto(`http://127.0.0.1:${port}/finance/`, { waitUntil: 'load' });
    await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState.moisBudgetaire; }, null, { timeout: 30000 });
    await attendre(page, 600);
    await page.evaluate(async (ST) => { const st = eval(ST); st.appMode = 'reel'; await new Promise(r => setTimeout(r, 250)); st.activeTab = 'pilotage'; }, ST);
    await attendre(page, 500);
    return { page, erreurs };
};
//  Le moteur de la Météo, tel que l'écran le lit
const meteo = (page) => page.evaluate(({ ST, S1 }) => { const st = eval(ST), L = st.liberteCycle;
    const c = (k) => L.categories.find(x => x.key === k) || { sem: { postes: [] } };
    const p = (k, cle) => c(k).sem.postes.find(x => x.cle === cle) || {};
    const pick = (x) => ({ engage: x.engage, clos: x.clos, eco: x.eco, exces: x.exces });
    return { engage: Math.round(st.consoEngageeT0), eco: Math.round(st.consoEcoT0), env: Math.round(st.enveloppeConsoRestante), reste: L.reste, lundi: L.semaine.lundi,
             parCat: JSON.stringify(st.consoResteParCategorie.reduce((s, l) => s + l.montant, 0)), parCompte: JSON.stringify(st.enveloppeConsoParCompte),
             oeufs: pick(p('alimentation', 'alimentation::2')), hri: pick(p('alimentation', 'alimentation::4')),
             sorties: { clos: c('sorties').sem.clos, eco: c('sorties').sem.eco, ecoS: c('sorties').sem.ecoS },
             alimEcoS: c('alimentation').sem.ecoS, defS1: JSON.parse(JSON.stringify(st.consoDefautsDuCycle[S1] || {})),
             stock: JSON.parse(JSON.stringify((st.donneesAnnuelles[2026] || {}).consoClotureT0 || {})) }; }, { ST, S1 }).catch(e => ({ erreur: String(e) }));
const saisir = (page, lundi, k, m) => page.evaluate(async ({ ST, lundi, k, m }) => { eval(ST).saisirSemaineConso(lundi, k, m); await new Promise(r => setTimeout(r, 120)); }, { ST, lundi, k, m });
const basculer = (page, lundi, k, u) => page.evaluate(async ({ ST, lundi, k, u }) => { eval(ST).basculerClotureConso(lundi, k, u); await new Promise(r => setTimeout(r, 120)); }, { ST, lundi, k, u });
//  Un 🔒 de la Météo VISIBLE (plusieurs Météo vivent dans le DOM)
const cliquerMeteo = (page, sel) => page.evaluate(async (sel) => {
    const el = [...document.querySelectorAll(sel)].find(e => e.offsetParent !== null);
    if (!el) return false; el.click(); await new Promise(r => setTimeout(r, 200)); return true; }, sel);
const texteMeteo = (page, sel) => page.evaluate((sel) => { const el = [...document.querySelectorAll(sel)].find(e => e.offsetParent !== null);
    return el ? el.textContent.replace(/\s+/g, ' ').trim() : null; }, sel);

try {
    /* ══ M. LA MÉTÉO ══════════════════════════════════════════════════════ */
    const { page, erreurs } = await ouvrir();
    await section('M1', async () => {
        const e = await meteo(page);
        v(`M1. départ : le morceau du 8 au 11 au prévu (642) — engagé 642, enveloppe ${BUDGET} − 642 = 5 340`,
          e.engage === DEBUT && e.eco === 0 && e.env === BUDGET - DEBUT && e.lundi === S2, JSON.stringify(e));
    });
    await section('M2', async () => {
        await saisir(page, S2, 'alimentation::2', 30);
        let e = await meteo(page);
        v('M2. Œufs 30 tapés cette semaine : engagé 672, enveloppe 5 310 (les 20 restants attendus)', e.engage === DEBUT + 30 && e.env === BUDGET - DEBUT - 30, JSON.stringify(e));
        if (!(await cliquerMeteo(page, '[data-pulse-poste-saisie][data-poste="alimentation::2"]'))) await cliquerMeteo(page, '[data-pulse-ouvrir][data-cat="alimentation"]');
        const ok = await cliquerMeteo(page, '[data-pulse-cloturer][data-poste="alimentation::2"]');
        e = await meteo(page);
        v('  → 🔒 Œufs (cette semaine) : 20 libérés — engagé 672 inchangé, enveloppe 5 310 − 20 = 5 290',
          ok && e.oeufs.clos === true && e.oeufs.eco === 20 && e.engage === DEBUT + 30 && e.eco === 20 && e.env === BUDGET - DEBUT - 50, JSON.stringify([ok, e]));
        v('  → rangé pour la SEMAINE du 12 : consoClotureT0["S2026-10-12"]', JSON.stringify(e.stock) === '{"S2026-10-12":{"alimentation::2":true}}', JSON.stringify(e.stock));
        v('  → le reste à dépenser, le reste par catégorie et par compte suivent (5 290)',
          e.reste === 5290 && e.parCat === '5290' && e.parCompte === '{"courant":5290}', JSON.stringify([e.reste, e.parCat, e.parCompte]));
        const t = await texteMeteo(page, '[data-pulse-poste][data-poste="alimentation::2"] [data-pulse-prevu]');
        const l = await texteMeteo(page, '[data-pulse-ligne][data-cat="alimentation"] [data-pulse-libere]');
        v('  → la ligne le dit : « 🔒 20 libérés » ; la catégorie aussi', !!t && sansEsp(t).includes('🔒20libérés') && !!l && sansEsp(l) === '🔒20libérés', JSON.stringify([t, l]));
    });
    await section('M3', async () => {
        const actif = await page.evaluate(() => { const i = [...document.querySelectorAll('[data-pulse-poste-saisie][data-poste="alimentation::2"]')].find(e => e.offsetParent !== null); return i ? !i.disabled && !i.readOnly : null; });
        await saisir(page, S2, 'alimentation::2', 70);
        const e = await meteo(page);
        v('M3. après clôture, la case reste ouverte : Œufs 70 — engagé 712, rien de libéré, enveloppe 5 270',
          actif === true && e.oeufs.clos === true && e.oeufs.eco === 0 && e.oeufs.exces === 20 && e.engage === DEBUT + 70 && e.env === BUDGET - DEBUT - 70, JSON.stringify([actif, e]));
        const t = await texteMeteo(page, '[data-pulse-poste][data-poste="alimentation::2"] [data-pulse-poste-depasse]');
        v('  → elle le dit : « dépassement +20 »', !!t && sansEsp(t) === 'dépassement+20', String(t));
    });
    await section('M4', async () => {
        await saisir(page, S1, 'alimentation::2', 25);
        let e = await meteo(page);
        v('M4. du 8 au 11 (écoulé), Œufs 25 tapés sur 28 prévus (pas clos) : engagé 642 − 28 + 25 + 70 = 709, enveloppe 5 273',
          e.engage === DEBUT - 28 + 25 + 70 && e.env === BUDGET - (DEBUT - 28 + 25 + 70), JSON.stringify(e));
        await basculer(page, S1, 'alimentation::2', 'semaine');
        e = await meteo(page);
        v('  → 🔒 Œufs du 8 au 11 : ses 3 restants libérés — enveloppe 5 270', e.engage === 709 && e.eco === 3 && e.env === 5270, JSON.stringify(e));
        await basculer(page, S1, 'alimentation::3', 'semaine');
        e = await meteo(page);
        v('  → 🔒 Samak (vide) du 8 au 11 : plus « au prévu » (0 compté), ses 43 libérés — engagé 666',
          !('alimentation::3' in e.defS1) && e.defS1.sorties === 228 && e.engage === 666 && e.eco === 46 && e.env === 5270, JSON.stringify(e));
    });
    await section('M5', async () => {
        await saisir(page, S2, 'alimentation::4', 600);
        let e = await meteo(page);
        v('M5. Hri (/ cycle) 600 cette semaine : engagé 1 266, enveloppe 5 982 − 1 266 − 46 = 4 670', e.engage === 1266 && e.env === 4670, JSON.stringify(e));
        const ok = await cliquerMeteo(page, '[data-pulse-cloturer][data-poste="alimentation::4"]');
        e = await meteo(page);
        v('  → 🔒 Hri : close pour le CYCLE — 400 libérés, enveloppe 4 270',
          ok && e.hri.clos === true && e.hri.eco === 400 && e.eco === 446 && e.env === 4270 && e.stock['C11-2026'] && e.stock['C11-2026']['alimentation::4'] === true, JSON.stringify([ok, e]));
        const t = await texteMeteo(page, '[data-pulse-poste][data-poste="alimentation::4"] [data-pulse-prevu]');
        v('  → « 🔒 400 libérés » ; la ligne de COURSES ne compte que la semaine (20 → 0 : Œufs dépassé)', !!t && sansEsp(t).includes('🔒400libérés') && e.alimEcoS === 0, JSON.stringify([t, e.alimEcoS]));
        await saisir(page, S2, 'alimentation::4', 1100);
        e = await meteo(page);
        v('  → Hri 1 100 après clôture : dépassement +100, plus rien de libéré — enveloppe 5 982 − 1 766 − 46 = 4 170',
          e.hri.exces === 100 && e.hri.eco === 0 && e.engage === 1766 && e.env === 4170, JSON.stringify(e));
    });
    await section('M6', async () => {
        const ok = await cliquerMeteo(page, '[data-pulse-cloturer][data-poste="sorties"]');
        let e = await meteo(page);
        v('M6. SORTIES (sans ligne) close pour la semaine, rien tapé : 400 libérés — enveloppe 3 770',
          ok && e.sorties.clos === true && e.sorties.eco === 400 && e.env === 3770, JSON.stringify([ok, e]));
        const l = await texteMeteo(page, '[data-pulse-ligne][data-cat="sorties"] [data-pulse-libere]');
        v('  → « 🔒 400 libérés » sur sa ligne', !!l && sansEsp(l) === '🔒400libérés', String(l));
        const lignes = await page.evaluate((ST) => { const st = eval(ST); return st.consoResteParCategorie.map(l => { const c = st.consoCategoriesT0.find(x => x.key === l.key); return [l.key, l.montant, c.budget - c.engage - c.eco]; }); }, ST);
        v('  → le reste par catégorie : SORTIES perd ses 400 libérés (1 771 − 228 − 400), COURSES n\'éponge rien', lignes.length === 2 && lignes.every(([, m, x]) => m === x) && lignes.find(l => l[0] === 'sorties')[1] === 1771 - 228 - 400,
          JSON.stringify(lignes));
        await cliquerMeteo(page, '[data-pulse-cloturer][data-poste="sorties"]');
        e = await meteo(page);
        v('  → un second 🔒 la rouvre : enveloppe 4 170', e.sorties.clos === false && e.env === 4170 && !('sorties' in (e.stock['S2026-10-12'] || {})), JSON.stringify(e));
    });
    await section('M7', async () => {
        await page.evaluate(async (ST) => { eval(ST).resetConsoT0(); await new Promise(r => setTimeout(r, 150)); }, ST);
        const e = await meteo(page);
        v('M7. « effacer tout le cycle » efface aussi ses cases closes : retour à 642 / 5 340', e.engage === DEBUT && e.eco === 0 && e.env === BUDGET - DEBUT && JSON.stringify(e.stock) === '{}', JSON.stringify(e));
        v('aucune erreur JavaScript (Météo)', erreurs.length === 0, erreurs[0] || '');
    });
    await page.close();

    await section('M8', async () => {
        clotureChargee = { 'S2026-10-05': { sorties: true } };
        const { page: p2, erreurs: e2 } = await ouvrir();
        const e = await meteo(p2);
        //  v37.65 : une clôture d'avant la v37.65 (clé du lundi 5 ; le jeudi 8 est le jour de paie) est re-rangée au 8
        v('M8. rechargée depuis le serveur (ancienne clé du lundi 5) : re-rangée au jeudi 8 — SORTIES close du 8 au 11 : engagé 414, 228 libérés, enveloppe 5 340',
          e.engage === DEBUT - 228 && e.eco === 228 && e.env === BUDGET - DEBUT && JSON.stringify(e.stock) === '{"S2026-10-08":{"sorties":true}}', JSON.stringify(e));
        const exp = await p2.evaluate((ST) => { const st = eval(ST); const x = typeof st.getExportData === 'function' ? st.getExportData() : { donneesAnnuelles: st.donneesAnnuelles };
            return JSON.stringify(JSON.parse(JSON.stringify(x)).donneesAnnuelles[2026].consoClotureT0); }, ST);
        v('  → et repart ainsi à la sauvegarde', exp === '{"S2026-10-08":{"sorties":true}}', exp);
        v('aucune erreur JavaScript (rechargement)', e2.length === 0, e2[0] || '');
        clotureChargee = null;
        await p2.close();
    });

    /* ══ P. LE PILOTAGE ═══════════════════════════════════════════════════ */
    const { page: pp, erreurs: ep } = await ouvrir();
    const pil = () => pp.evaluate((ST) => { const st = eval(ST);
        const t = (n) => { const x = [...st.tachesPilotageToutes, ...st.entreesPilotageToutes].find(y => y.libelle === n) || {}; return { paye: x.paye, clos: x.clos, regle: x.regle }; };
        const etat = (n) => { const all = st.donneesAnnuelles[2026]; const it = [...all.chargesVariables.factures.details, ...Object.values(all.chargesFixes), ...Object.values(all.revenus)].find(y => (y.nom || y.label) === n);
            return JSON.stringify((it && it.trackerRealise) || {}); };
        return { eau: t('eau'), tel: t('tel'), loyer: t('LOYER'), sal: t('SALAIRE'), etatEau: etat('eau'),
                 reste: Math.round(st.resteATraiterPilotage), fact: JSON.stringify(st.resteAPayerFacturesParCompte), fixes: JSON.stringify(st.resteAPayerFixesParCompte),
                 regle: st.dejaValidePilotage.regle, attente: Math.round(st.revenusEnAttenteCourant),
                 fixe: JSON.stringify((st.kpiProgression.natures.find(n => n.cle === 'fixe') || {})) }; }, ST);
    const ouvrirTiroir = async (cle) => { const sel = `#pilotage-inbox [data-tiroir="${cle}"]`;
        if (!(await pp.evaluate((s) => document.querySelector(s)?.open, sel))) { await pp.click(sel + ' > summary'); await attendre(pp, 200); } };
    const ouvrirValide = async () => { const sel = '#pilotage-inbox [data-deja-valide]';
        if (!(await pp.evaluate((s) => document.querySelector(s)?.open, sel))) { await pp.click(sel + ' > summary'); await attendre(pp, 200); } };
    const valide = (nom) => pp.evaluate((nom) => { const r = [...document.querySelectorAll('#pilotage-inbox [data-deja-valide] [data-valide]')].find(x => x.querySelector('[data-valide-nom]').textContent.trim() === nom);
        const t = (s) => r && r.querySelector(s) ? r.querySelector(s).textContent.replace(/\s+/g, ' ').trim() : null;
        return r ? { clos: t('[data-valide-clos]'), dep: t('[data-valide-depassement]'), montant: t('[data-valide-montant]'),
                     rouge: /\btext-rose-300\b/.test(r.querySelector('[data-valide-montant]').className), ajout: !!r.querySelector('[data-valide-ajout]') && !r.querySelector('[data-valide-ajout]').disabled } : null; }, nom);
    const ajouter = async (nom, txt) => { await ouvrirValide();
        const i = pp.locator('#pilotage-inbox [data-deja-valide] [data-valide]').filter({ hasText: nom }).locator('[data-valide-ajout]');
        await i.fill(txt); await i.press('Enter'); await attendre(pp, 300); };
    const setRegle = (n, x) => pp.evaluate(async ({ ST, n, x }) => { const st = eval(ST); const t = [...st.tachesPilotageToutes, ...st.entreesPilotageToutes].find(y => y.libelle === n);
        st.setMontantPayeCycle(t.ref, x, st.cyclePilotage); await new Promise(r => setTimeout(r, 150)); }, { ST, n, x });

    await section('P1', async () => {
        await setRegle('eau', 54);
        const e = await pil();
        v('P1. eau 54 / 300 : à traiter LOYER 6 000 + tel 99 + eau 246 = 6 345 ; factures 99 + 246 = 345',
          e.eau.paye === false && e.reste === 6345 && e.fact === '{"courant":345}', JSON.stringify(e));
        await ouvrirTiroir('variable');
        const n = await pp.evaluate(() => [...document.querySelectorAll('#pilotage-inbox [data-tiroir] [data-tache], #pilotage-inbox [data-tiroir] [data-entree]')].map(r => !!r.querySelector('[data-cloturer]')));
        v('  → un 🔒 sur chaque ligne à traiter', n.length >= 3 && n.every(Boolean), JSON.stringify(n));
    });
    await section('P2', async () => {
        await pp.locator('#pilotage-inbox [data-tiroir="variable"] [data-tache]').filter({ hasText: 'eau' }).locator('[data-cloturer]').click();
        await attendre(pp, 650);
        const e = await pil();
        v('P2. 🔒 eau : close à 54 — plus rien n\'est attendu : à traiter 6 099, factures 99',
          e.eau.clos === true && e.eau.paye === true && e.eau.regle === 54 && e.reste === 6099 && e.fact === '{"courant":99}', JSON.stringify(e));
        v('  → l\'état du cycle garde le réglé et dit « cloture »', /"montantPaye":54/.test(e.etatEau) && /"cloture":true/.test(e.etatEau), e.etatEau);
        await ouvrirValide();
        const r = await valide('eau');
        v('  → « Déjà validé » : 🔒 clôturé · 246 libérés, 54 DH, « + ajouter » ouvert',
          !!r && sansEsp(r.clos) === '🔒clôturé·246libérés' && sansEsp(r.montant) === '54DH' && !r.dep && r.ajout && e.regle === 54, JSON.stringify([r, e.regle]));
    });
    await section('P3', async () => {
        await ajouter('eau', '+30');
        let e = await pil(), r = await valide('eau');
        v('P3. « +30 » après clôture : 84 réglés, toujours close — 216 libérés, factures 99',
          e.eau.clos === true && e.eau.regle === 84 && e.fact === '{"courant":99}' && !!r && sansEsp(r.clos) === '🔒clôturé·216libérés', JSON.stringify([e, r]));
        await ajouter('eau', '250');
        e = await pil(); r = await valide('eau');
        v('  → « 250 » de plus : 334 / 300 — « dépassement +34 », montant en rouge, rien ne se bloque',
          e.eau.regle === 334 && !!r && sansEsp(r.dep) === 'dépassement+34' && sansEsp(r.montant) === '334DH' && r.rouge && r.ajout && !r.clos.includes('libérés') && e.regle === 334, JSON.stringify([e, r]));
    });
    await section('P4', async () => {
        await ouvrirValide();
        await pp.locator('#pilotage-inbox [data-deja-valide] [data-valide]').filter({ hasText: 'eau' }).locator('input[type=checkbox]').click();
        await attendre(pp, 650);
        let e = await pil();
        v('P4. décocher une case réglée en entier (334 ≥ 300) : remise à traiter, comme avant', e.eau.paye === false && e.eau.clos === false && e.eau.regle === 0 && e.reste === 6399, JSON.stringify(e));
        await setRegle('eau', 54);
        await pp.evaluate(async (ST) => { const st = eval(ST); const t = st.tachesPilotageToutes.find(y => y.libelle === 'eau'); st.cloturerItem(t.ref, st.cyclePilotage); await new Promise(r => setTimeout(r, 150)); }, ST);
        await ouvrirValide();
        await pp.locator('#pilotage-inbox [data-deja-valide] [data-valide]').filter({ hasText: 'eau' }).locator('input[type=checkbox]').click();
        await attendre(pp, 650);
        e = await pil();
        v('  → décocher une case CLOSE à 54 la rouvre avec ses 54 : à traiter de nouveau, reste 246',
          e.eau.paye === false && e.eau.clos === false && e.eau.regle === 54 && e.reste === 6345 && e.fact === '{"courant":345}', JSON.stringify(e));
    });
    await section('P5', async () => {
        const surplus = () => pp.evaluate(async (ST) => { const st = eval(ST); st.anneeAffichage = 2026; await new Promise(r => setTimeout(r, 150));
            return Math.round((st.surplusParMois.find(x => x.mNum === st.moisBudgetaire.mois) || {}).brut); }, ST);
        const s0 = await surplus();
        await ouvrirTiroir('variable');
        await pp.locator('#pilotage-inbox [data-tiroir="variable"] [data-tache]').filter({ hasText: 'tel' }).locator('[data-cloturer]').click();
        await attendre(pp, 650);
        const e = await pil(), r = await valide('tel');
        v('P5. tel close sans rien régler : 0 DH réglé (pas son dû), 99 libérés ; factures 246',
          e.tel.clos === true && e.tel.regle === 0 && e.regle === 0 && e.fact === '{"courant":246}' && !!r && sansEsp(r.montant) === '0DH' && sansEsp(r.clos) === '🔒clôturé·99libérés', JSON.stringify([e, r]));
        const prog = await pp.evaluate((ST) => JSON.stringify(eval(ST).kpiProgression.natures.find(n => n.cle === 'variable')), ST);
        v('  → progression des variables : eau 54 / 300, tel 0 / 0 — 54 / 300', /"regle":54,"total":300/.test(prog), prog);
        const s1 = await surplus();
        v('  → le surplus du mois n\'attend plus les 99 du tel : + 99', s1 - s0 === 99, JSON.stringify([s0, s1]));
    });
    await section('P6', async () => {
        await setRegle('LOYER', 2000);
        let e = await pil();
        v('P6. LOYER, 2 000 d\'avance : reste 4 000 ; progression des fixes 2 000 / 6 000', e.fixes === '{"courant":4000}' && /"regle":2000,"total":6000/.test(e.fixe), JSON.stringify(e));
        await pp.evaluate(async (ST) => { const st = eval(ST); const t = st.tachesPilotageToutes.find(y => y.libelle === 'LOYER'); st.cloturerItem(t.ref, st.cyclePilotage); await new Promise(r => setTimeout(r, 150)); }, ST);
        e = await pil();
        v('  → clos : plus rien à payer sur les fixes ; progression 2 000 / 2 000 (100 %)', e.fixes === '{}' && /"regle":2000,"total":2000,"pct":100/.test(e.fixe), JSON.stringify(e));
    });
    await section('P7', async () => {
        const sal = () => pp.evaluate((ST) => JSON.stringify(eval(ST).journalHybride.entries.filter(x => x.libelle === 'SALAIRE').map(x => [x.montant, x.etat])), ST);
        await pp.evaluate(async (ST) => { const st = eval(ST); const t = st.entreesPilotageToutes.find(y => y.libelle === 'SALAIRE'); st.cloturerItem(t.ref, st.cyclePilotage); await new Promise(r => setTimeout(r, 150)); }, ST);
        const j0 = await sal();
        v('P7. SALAIRE clos sans rien recevoir : le journal le compte réalisé à 0, pas à 20 000', j0 === '[[0,"realise"]]', j0);
        await pp.evaluate(async (ST) => { const st = eval(ST); const t = st.entreesPilotageToutes.find(y => y.libelle === 'SALAIRE'); st.toggleItemPaid(t.ref, t.due, st.cyclePilotage); await new Promise(r => setTimeout(r, 150)); }, ST);
        await setRegle('SALAIRE', 15000);
        const avant = (await pil()).attente;
        await pp.evaluate(async (ST) => { const st = eval(ST); const t = st.entreesPilotageToutes.find(y => y.libelle === 'SALAIRE'); st.cloturerItem(t.ref, st.cyclePilotage); await new Promise(r => setTimeout(r, 150)); }, ST);
        const e = await pil();
        v('  → rouvert, reçu 15 000 / 20 000 puis clos : plus rien n\'est attendu (revenus en attente → 0)',
          e.sal.clos === true && e.sal.regle === 15000 && avant === 20000 && e.attente === 0, JSON.stringify([avant, e.attente, e.sal]));
        v('aucune erreur JavaScript (Pilotage)', ep.length === 0, ep[0] || '');
    });
    await pp.close();
} catch (e) {
    v('exécution sans exception', false, String(e && e.stack || e).slice(0, 400));
} finally {
    await browser.close(); srv.close();
}
console.log('  ' + '─'.repeat(80));
console.log(ko === 0 ? '  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
