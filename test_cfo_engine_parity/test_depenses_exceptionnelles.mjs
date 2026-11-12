/**
 * v37.103 — CHAQUE DÉPENSE EXCEPTIONNELLE A SA CATÉGORIE, ET LE MÉNAGE SE FAIT TOUT SEUL.
 *
 *   « Pourquoi les exceptionnelles ne paraissent pas dans la liste ? » — « Je veux rien faire à la main. »
 *
 *   « Four maman », « Nejar »… (onglet Flux) tombaient toutes dans l'unique « Dépense exceptionnelle » :
 *   absentes des menus, et une dépense « Four maman » de 1 400 DH n'était pas reliée à sa ligne de 1 200 DH.
 *   Désormais chaque ligne porte sa catégorie (« · Four maman », sous « Dépense exceptionnelle ») et les
 *   opérations déjà saisies y sont rangées d'office, puis enregistrées. Décor FICTIF.
 *
 *     A. au chargement : les catégories · B. le ménage des opérations · C. enregistré, une fois ·
 *     D. les menus · E. les règles · F. le Contrôle (prévu / réel) · G. renommer · H. supprimer ·
 *     I. une nouvelle ligne · J. idempotent.
 */
import fs from 'node:fs';
import { twCompiler } from './tw_cache.mjs';   // v37.109 : Tailwind compilé une fois pour toutes les suites
import http from 'node:http';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..');
const html = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8').split('\r\n').join('\n');

let ko = 0, n = 0;
const v = (t, ok, d = '') => { n++; if (!ok) ko++; console.log(`  ${ok ? '✅' : '❌'} ${t.padEnd(78)} ${ok ? '' : String(d).slice(0, 700)}`); };
const section = async (nom, f) => { try { await f(); } catch (e) { v(`${nom} : exécution sans exception`, false, String(e && e.stack || e).slice(0, 400)); } };
console.log('\n  DÉPENSES EXCEPTIONNELLES : UNE CATÉGORIE CHACUNE, LE MÉNAGE TOUT SEUL\n  ' + '─'.repeat(80));

v('statique : la fonction de rangement existe et est branchée au chargement et après chaque modification',
  /const rangerDepensesExceptionnelles = \(\) =>/.test(html) && /const _irr = rangerDepensesExceptionnelles\(\);/.test(html) && /_rangerExceptionnellesPlusTard\(\)/.test(html));

const require = createRequire(import.meta.url);
const essai = (f) => { try { return f(); } catch { return null; } };
const pw = essai(() => require('playwright-core'));
const vueJs = essai(() => require.resolve('vue/dist/vue.global.js'));
const chartJs = path.join(RACINE, 'node_modules/chart.js/dist/chart.umd.js');
const chromium = process.env.CHROMIUM || '/opt/pw-browsers/chromium';
if (!pw || !vueJs || !fs.existsSync(chartJs) || !fs.existsSync(chromium)) {
    console.log('  ⏭️  partie navigateur ignorée (playwright-core, vue, chart.js ou Chromium absent)');
    console.log(ko === 0 ? `  ✅ TOUT PASSE — ${n} contrôles` : `  ❌ ${ko} contrôle(s) en échec`);
    process.exit(ko === 0 ? 0 : 1);
}

//  v37.107 : le vrai CSS (Tailwind compilé depuis index.html) — pour vérifier ce qui passe devant quoi dans la frise
const twBin = path.join(RACINE, 'node_modules/.bin/tailwindcss');
let tw = '';
if (fs.existsSync(twBin)) {
    const twTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-exc-'));
    fs.writeFileSync(path.join(twTmp, 'in.css'), '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
    fs.writeFileSync(path.join(twTmp, 'cfg.js'), 'module.exports={content:[' + JSON.stringify(path.join(RACINE, 'index.html')) + '],theme:{extend:{}}};');
    twCompiler(twBin, ['-c', path.join(twTmp, 'cfg.js'), '-i', path.join(twTmp, 'in.css'), '-o', path.join(twTmp, 'out.css'), '--minify'], { stdio: 'ignore' });
    tw = fs.readFileSync(path.join(twTmp, 'out.css'), 'utf8');
    fs.rmSync(twTmp, { recursive: true, force: true });
}
const P = 'cat_irr_depense_exceptionnelle';
const fixture = () => {
    const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8'));
    const base = fx.donneesAnnuelles[Object.keys(fx.donneesAnnuelles)[0]];
    fx.donneesAnnuelles = {};
    for (const an of [2026, 2027]) fx.donneesAnnuelles[an] = JSON.parse(JSON.stringify(base));
    Object.assign(fx.soldesInitiaux, { moisActuel: 10, anneeActuelle: 2026, jourDePaie: 27, compteChargesFixes: 'courant', compteChargesVariables: 'courant', assurances_tracker: [], voyageDebut: '', voyageFin: '' });
    fx.soldesInitiaux.categories = [];
    fx.comptes = [{ id: 1, label: 'Compte Courant', type: 'courant', solde: 9000, icone: '💳' }];
    const neutre = { paye: false, montantPaye: 0, exceptions: [], showExceptions: false };
    for (const an of Object.keys(fx.donneesAnnuelles)) {
        const d = fx.donneesAnnuelles[an];
        d.chargesFixes = { syndic: { ...neutre, label: 'Syndic', valeur: 300, jourPrevu: null } };
        d.chargesVariables = { alimentation: { ...neutre, label: 'Alimentation (Tqdya)', valeur: 0, periode: 'semaine', details: [{ nom: 'khdra', montant: 200 }, { nom: 'Marjane', montant: 400 }] } };
        d.epargne = [{ id: 1, nom: 'Epargne urgence', valeur: 500, sourceCompte: 'courant', exceptions: [] }];
        d.virementsInternes = []; d.consoRealiseeT0 = {};
        const dep = (id, mois, nom, montant, extra = {}) => ({ id, mois, annee: Number(an), nom, montant, paye: false, montantPaye: 0, sourceCompte: 'courant', ...extra });
        d.depensesIrregulieres = an === '2026' ? [
            dep(801, 11, 'Four maman', 1200, { categorieId: P, jourPrevu: 5 }),               // l'état d'avant : toutes dans la mère
            dep(802, 11, 'Nejar', 1300, { categorieId: P, jourPrevu: 12 }),
            dep(803, 12, 'Nouveau', 0, { categorieId: P }),                                   // pas encore nommée : reste dans la mère
            dep(804, 10, 'Remboursement CNOPS', -800, { categorieId: 'cat_irr_revenu_exceptionnel' }),
            dep(805, 9, 'Assurance auto', 3000, { categorieId: 'cat_irr_assurance', sourceAssurance: true }),
            dep(807, 11, 'Frigo', 6000, { categorieId: P }),
        ] : [dep(806, 3, 'four  MAMAN', 500)];                                                // même nom l'an prochain, sans catégorie
        const tx = (id, libelle, montant, categorieId, extra = {}) => ({ id, datetime: '2026-11-0' + (id % 9 + 1) + 'T10:00', date: '2026-11-0' + (id % 9 + 1), mois: 11, libelle, montant, categorieId, compteId: 1, source: 'manuel', ...extra });
        d.transactionsReelles = an !== '2026' ? [] : [
            tx(901, 'Four maman', 1400, P, { categorieSource: 'ia', iaConfiance: 'moyenne', aVerifier: true }),
            tx(902, 'nejar salon', 300, P, { categorieSource: 'vous' }),                         // rangée à la main dans la mère : il n'y avait rien d'autre
            tx(903, '7) GOOGLE*AGAINAI', 68, P, { source: 'banque' }),                          // ne nomme aucune ligne : reste
            tx(904, 'four maman', 100, 'cat_misc'),
            tx(905, 'Four maman', 50, 'cat_cv_alimentation', { categorieSource: 'ia', aVerifier: true }),   // proposée ailleurs, à vérifier : suit sa ligne
            tx(906, 'Frigo', 70, 'cat_cv_alimentation', { categorieSource: 'vous' }),                       // VOTRE choix, même s'il nomme une ligne : intouché
        ];
    }
    return fx;
};

const page0 = html
    .replace('<script src="https://unpkg.com/vue@3/dist/vue.global.js"', '<script src="/vue.js"')
    .replace('<script src="https://cdn.jsdelivr.net/npm/chart.js"', '<script src="/chart.js"')
    .replace(/<script src="https:\/\/cdn\.tailwindcss\.com"[^>]*><\/script>/, tw ? '<link rel="stylesheet" href="/tailwind.css">' : '')
    .replace(/<script[^>]*src="https:\/\/[^"]*"[^>]*><\/script>/g, '');
const sauvegardes = [];
const srv = http.createServer((req, res) => {
    const p = req.url.split('?')[0];
    const s = (c, b, t = 'application/json') => { res.writeHead(c, { 'Content-Type': t }); res.end(b); };
    if (req.method === 'POST' && /save_data\.php$/.test(p)) {
        let corps = ''; req.on('data', x => { corps += x; }); req.on('end', () => { try { sauvegardes.push(JSON.parse(corps)); } catch { } s(200, '{"status":"ok"}'); });
        return;
    }
    if (p === '/finance/') return s(200, page0, 'text/html; charset=utf-8');
    if (p === '/vue.js') return s(200, fs.readFileSync(vueJs), 'text/javascript');
    if (p === '/tailwind.css') return s(200, tw, 'text/css');
    if (p === '/chart.js') return s(200, fs.readFileSync(chartJs), 'text/javascript');
    if (p === '/finance/finance_data.json') return s(200, JSON.stringify(fixture()));
    return s(200, '{"status":"ok"}');
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const browser = await pw.chromium.launch({ executablePath: chromium, args: ['--no-sandbox'] });
const ST = 'document.querySelector("#app").__vue_app__._instance.setupState';
const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
await page.clock.setFixedTime(new Date(2026, 9, 13, 12, 0, 0));
const erreurs = []; page.on('pageerror', e => erreurs.push(String(e)));
page.on('dialog', d => d.accept());
await page.route('**/webhook/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ output: '{"id": null, "confiance": "basse", "raison": "test"}' }) }));
await page.goto(`http://127.0.0.1:${srv.address().port}/finance/`, { waitUntil: 'load' });
await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState.moisBudgetaire; }, null, { timeout: 30000 });
//  les données du décor sont arrivées (l'appli démarre d'abord sur un état vide : sous charge, le serveur répond après)
await page.waitForFunction((ST) => { const st = eval(ST); return (st.donneesAnnuelles[2026]?.transactionsReelles || []).some(t => t.id === 901) && (st.donneesAnnuelles[2027]?.depensesIrregulieres || []).some(d => d.id === 806); }, ST, { timeout: 30000 });

const lire = () => page.evaluate((ST) => {
    const st = eval(ST), D = st.donneesAnnuelles;
    return JSON.parse(JSON.stringify({
        deps: Object.fromEntries([...D[2026].depensesIrregulieres, ...D[2027].depensesIrregulieres].map(d => [d.id, d.categorieId])),
        txs: Object.fromEntries(D[2026].transactionsReelles.map(t => [t.id, { cat: t.categorieId, source: t.categorieSource || null, aVerifier: !!t.aVerifier }])),
        reg: st.soldesInitiaux.categories.filter(c => /^cat_irr/.test(c.id)).map(c => ({ id: c.id, label: c.label, parent: c.parent, type: c.type, archive: !!c.archive })),
        menu: (st.categoriesPourRanger.find(g => /Exceptionnel/.test(g.label)) || { items: [] }).items.map(i => i.label),
    }));
}, ST);
const F = 'cat_irr_l_four_maman', N = 'cat_irr_l_nejar';

try {
    await section('A', async () => {
        const e = await lire();
        const four = e.reg.find(c => c.id === F), nej = e.reg.find(c => c.id === N);
        v('A. au chargement : « Four maman » et « Nejar » ont leur catégorie, fille de « Dépense exceptionnelle »',
          four && four.label === 'Four maman' && four.parent === P && four.type === 'irreguliere' && nej && nej.label === 'Nejar' && nej.parent === P, JSON.stringify(e.reg));
        v('  → les lignes la portent (2026 et 2027, même nom = même catégorie) ; « Nouveau » reste dans la mère',
          e.deps[801] === F && e.deps[806] === F && e.deps[802] === N && e.deps[803] === P, JSON.stringify(e.deps));
        v('  → revenu exceptionnel et remboursement d’assurance intouchés', e.deps[804] === 'cat_irr_revenu_exceptionnel' && e.deps[805] === 'cat_irr_assurance', JSON.stringify(e.deps));
    });
    await section('B', async () => {
        const t = (await lire()).txs;
        v('B. « Four maman » 1 400 DH (rangé par l’IA dans « Dépense exceptionnelle ») → Four maman, « votre libellé », plus à vérifier',
          t[901].cat === F && t[901].source === 'libellé' && !t[901].aVerifier, JSON.stringify(t[901]));
        v('  → « nejar salon » (rangée à la main dans la mère) → Nejar ; « four maman » non catégorisée → Four maman',
          t[902].cat === N && t[904].cat === F, JSON.stringify([t[902], t[904]]));
        v('  → proposée ailleurs par l’IA, à vérifier, libellé exact → Four maman ; « Frigo » rangé PAR VOUS ailleurs : intouché',
          t[905].cat === F && !t[905].aVerifier && t[906].cat === 'cat_cv_alimentation' && t[906].source === 'vous', JSON.stringify([t[905], t[906]]));
        v('  → « 7) GOOGLE*AGAINAI » ne nomme aucune ligne : reste dans « Dépense exceptionnelle »', t[903].cat === P, JSON.stringify(t[903]));
    });
    await section('C', async () => {
        const t0 = Date.now();
        while (Date.now() - t0 < 15000 && !sauvegardes.some(b => (b.donneesAnnuelles?.[2026]?.transactionsReelles || []).some(x => x.id === 901 && x.categorieId === F))) await new Promise(r => setTimeout(r, 100));
        const b = sauvegardes.find(b => (b.donneesAnnuelles?.[2026]?.transactionsReelles || []).some(x => x.id === 901 && x.categorieId === F));
        v('C. le ménage est ENREGISTRÉ sur le serveur (sans rien toucher) : opérations et catégories',
          !!b && b.soldesInitiaux.categories.some(c => c.id === F) && b.donneesAnnuelles[2026].depensesIrregulieres.some(d => d.id === 801 && d.categorieId === F), String(sauvegardes.length) + ' sauvegarde(s)');
    });
    await section('D', async () => {
        const e = await lire();
        v('D. menu « ⚡ Exceptionnel » : Dépense exceptionnelle, · Four maman, · Nejar — ni « Nouveau », ni revenus, ni assurance',
          e.menu[0] === 'Dépense exceptionnelle' && e.menu.includes('· Four maman') && e.menu.includes('· Nejar') && e.menu.includes('· Frigo') && !e.menu.some(x => /Nouveau|CNOPS|Remboursement|Revenu/.test(x)), JSON.stringify(e.menu));
        await page.evaluate(async (ST) => { const st = eval(ST); st.appMode = 'reel'; await Vue.nextTick(); st.activeTab = 'saisie'; await Vue.nextTick(); }, ST);
        //  v37.104 — la catégorie se choisit dans un sélecteur avec recherche : on l'ouvre (saisie → « ⚙️ Ajuster ») et on lit le groupe « ⚡ Exceptionnel »
        await page.fill('input[placeholder="Ex: 200 courses"]', '40 essai');
        await page.click('[data-saisie-ajuster]');
        await page.click('[data-saisie-details] [data-saisie-categorie] [data-cc-ouvrir]');
        await page.waitForSelector('[data-cc-panneau] [data-cc-liste]', { timeout: 10000 });
        const opts = await page.evaluate(() => { let g = '', out = [];
            for (const el of document.querySelector('[data-cc-panneau] [data-cc-liste]').children) { if (el.tagName === 'P') g = el.textContent.trim(); else if (g === '⚡ Exceptionnel' && el.matches('[data-cc-option]')) out.push(el.querySelector('[data-cc-libelle]').textContent.trim()); }
            return out; });
        await page.keyboard.press('Escape'); await page.fill('input[placeholder="Ex: 200 courses"]', '');
        v('  → et dans la liste à l’écran (le même menu que sur le téléphone)', opts.includes('· Four maman') && opts.includes('· Nejar'), JSON.stringify(opts));
    });
    await section('E', async () => {
        const r = await page.evaluate((ST) => { const st = eval(ST); return ['four maman', 'Four maman 2e versement', 'nejar'].map(l => { const x = st.categoriserLibelle(l); return { l, id: x.id, statut: x.statut, source: x.source }; }); }, ST);
        v('E. les règles reconnaissent les lignes : « four maman », « Four maman 2e versement » → Four maman, « nejar » → Nejar (sûr)',
          r[0].id === F && r[0].statut === 'sur' && r[1].id === F && r[2].id === N && r[2].statut === 'sur', JSON.stringify(r));
    });
    await section('F', async () => {
        const rows = await page.evaluate((ST) => { const st = eval(ST); st.anneeAffichage = 2026; st.moisControle = 11; return JSON.parse(JSON.stringify(st.controleBudgetVsReel)); }, ST);
        const four = rows.find(x => x.categorieId === F), nej = rows.find(x => x.categorieId === N);
        v('F. Contrôle de novembre : « Four maman » 1 200 prévus / 1 550 réels (1 400 + 100 + 50), « Nejar » 1 300 / 300',
          four && four.budget === 1200 && four.realise === 1550 && four.label === 'Four maman' && nej && nej.budget === 1300 && nej.realise === 300, JSON.stringify(rows.filter(x => /irr/.test(x.categorieId))));
    });
    await section('G', async () => {
        //  renommer comme à l'écran : le nom change à chaque frappe (@input → handleDataChange)
        for (const nom of ['Neja', 'Naj', 'Najjar']) await page.evaluate(({ ST, nom }) => { const st = eval(ST); st.donneesAnnuelles[2026].depensesIrregulieres.find(d => d.id === 802).nom = nom; st.handleDataChange(); }, { ST, nom });
        await page.waitForFunction((ST) => { const st = eval(ST); return st.donneesAnnuelles[2026].depensesIrregulieres.find(d => d.id === 802).categorieId === 'cat_irr_l_najjar'; }, ST, { timeout: 10000 });
        const e = await lire();
        v('G. « Nejar » renommée « Najjar » (tapée lettre par lettre) : nouvelle catégorie, ses opérations la suivent',
          e.txs[902].cat === 'cat_irr_l_najjar' && e.reg.some(c => c.id === 'cat_irr_l_najjar' && c.label === 'Najjar'), JSON.stringify([e.txs[902], e.reg]));
        v('  → ni « Nejar », ni les noms tapés en route (« Neja », « Naj ») ne restent au registre ou au menu',
          !e.reg.some(c => /^cat_irr_l_(nejar|neja|naj)$/.test(c.id)) && e.menu.includes('· Najjar') && !e.menu.some(x => /Nejar|Neja$|Naj$/.test(x)), JSON.stringify([e.reg.map(c => c.id), e.menu]));
    });
    await section('H', async () => {
        await page.evaluate((ST) => { const st = eval(ST); st.anneeAffichage = 2026; st.supprimerDepense(802); }, ST);
        await page.waitForFunction((ST) => !eval(ST).soldesInitiaux.categories.some(c => c.id === 'cat_irr_l_najjar'), ST, { timeout: 10000 });
        const e = await lire();
        v('H. la ligne « Najjar » supprimée : son opération revient dans « Dépense exceptionnelle », la catégorie quitte le menu',
          e.txs[902].cat === P && !e.menu.includes('· Najjar'), JSON.stringify([e.txs[902], e.menu]));
    });
    await section('I', async () => {
        await page.evaluate((ST) => { const st = eval(ST); st.ajouterDepense(12, 2026); }, ST);
        await page.waitForFunction((ST) => eval(ST).donneesAnnuelles[2026].depensesIrregulieres.some(d => d.nom === 'Nouveau' && d.id !== 803), ST, { timeout: 5000 });
        await page.evaluate((ST) => { const st = eval(ST); const d = st.donneesAnnuelles[2026].depensesIrregulieres.filter(x => x.nom === 'Nouveau' && x.id !== 803).pop(); d.nom = 'Machine à laver'; d.montant = 4000; st.handleDataChange(); }, ST);
        await page.waitForFunction((ST) => eval(ST).soldesInitiaux.categories.some(c => c.id === 'cat_irr_l_machine_a_laver'), ST, { timeout: 10000 });
        const r = await page.evaluate((ST) => { const st = eval(ST); const x = st.categoriserLibelle('machine a laver'); return { id: x.id, statut: x.statut }; }, ST);
        const e = await lire();
        v('I. une nouvelle ligne « Machine à laver » : sa catégorie apparaît au menu, et « machine a laver » y est rangée d’office',
          e.menu.includes('· Machine à laver') && r.id === 'cat_irr_l_machine_a_laver' && r.statut === 'sur', JSON.stringify([e.menu, r]));
    });
    await section('J', async () => {
        const b = await page.evaluate((ST) => eval(ST).rangerDepensesExceptionnelles(), ST);
        v('J. relancé : plus rien à faire (le ménage est idempotent)', b.lignes === 0 && b.registre === 0 && b.transactions === 0, JSON.stringify(b));
    });
    await section('K', async () => {
        //  v37.105 — « Il n'y a pas les dépenses exceptionnelles ici ! » : la frise du cycle (27 sept. → 26 oct., horloge du test au 13 oct.)
        await page.evaluate(async (ST) => {
            const st = eval(ST), d = st.donneesAnnuelles[2026];
            d.depensesIrregulieres.push({ id: 810, mois: 10, annee: 2026, nom: 'Cadeau mariage', montant: 500, jourPrevu: 12, paye: false, montantPaye: 0, sourceCompte: 'courant', categorieId: 'cat_irr_depense_exceptionnelle' },
                                        { id: 811, mois: 10, annee: 2026, nom: 'Révision chaudière', montant: 300, jourPrevu: 20, paye: false, montantPaye: 0, sourceCompte: 'courant', categorieId: 'cat_irr_depense_exceptionnelle' },
                                        { id: 812, mois: 10, annee: 2026, nom: 'Remboursement mutuelle', montant: -400, paye: false, montantPaye: 0, sourceCompte: 'courant', categorieId: 'cat_irr_revenu_exceptionnel' });
            st.rangerDepensesExceptionnelles();
            d.transactionsReelles.push({ id: 9101, date: '2026-10-14', datetime: '2026-10-14T10:00', mois: 10, libelle: 'cadeau mariage', montant: 650, categorieId: 'cat_irr_l_cadeau_mariage', compteId: 1, source: 'manuel' },
                                       { id: 9102, date: '2026-10-12', datetime: '2026-10-12T10:00', mois: 10, libelle: 'imprévu', montant: 40, categorieId: 'cat_irr_depense_exceptionnelle', compteId: 1, source: 'manuel' });
            st.calculationTick++; st.friseOuverte = true; await Vue.nextTick();
        }, ST);
        const f = await page.evaluate((ST) => { const fc = eval(ST).friseCycle; return JSON.parse(JSON.stringify({ du: fc.du, au: fc.au, exc: fc.categories.find(c => c.key === '__exceptionnel') || null, alertes: fc.alertes })); }, ST);
        const L = (f.exc || { lignes: [] }).lignes, cad = L.find(l => l.nom === 'Cadeau mariage'), rev = L.find(l => l.nom === 'Révision chaudière'), aut = L.find(l => /Autres/.test(l.nom));
        v('K. la frise du cycle a son bloc « ⚡ Dépenses exceptionnelles » : Cadeau mariage 650 / 500 (dépassé), Révision chaudière 0 / 300, Autres 40',
          !!f.exc && cad && cad.engage === 650 && cad.enveloppe === 500 && cad.depasse && rev && rev.engage === 0 && rev.enveloppe === 300 && aut && aut.engage === 40 && !L.some(l => /mutuelle/i.test(l.nom)), JSON.stringify(f.exc));
        v('  → un repère à la date prévue (12 oct., le milieu du cycle), le total du bloc 690 / 800, et le dépassement dans les alertes de la frise',
          cad.seances.length === 1 && cad.seances[0].quand === '12 oct.' && cad.seances[0].etat === 'paye' && f.exc.engage === 690 && f.exc.budget === 800
          && f.alertes.some(a => /Cadeau mariage \(dépense exceptionnelle\) : 650 DH pour 500 prévus — dépassement de 150 DH/.test(a)), JSON.stringify([cad.seances, f.exc.engage, f.exc.budget, f.alertes]));
        await page.waitForSelector('[data-frise-categorie][data-cat="__exceptionnel"]', { state: 'visible', timeout: 10000 });
        const bloc = (await page.textContent('[data-frise-categorie][data-cat="__exceptionnel"]')).replace(/\s+/g, ' ');
        v('  → à l’écran : « ⚡ Dépenses exceptionnelles », « Cadeau mariage / cycle », « 650 / 500 DH sur le cycle »', /⚡ Dépenses exceptionnelles/.test(bloc) && /Cadeau mariage \/ cycle/.test(bloc) && /650 \/ 500 DH sur le cycle/.test(bloc), bloc.slice(0, 300));
        if (tw) {
            const cache = await page.evaluate(() => {
                const l = document.querySelector('[data-frise-ligne][data-poste="irr_810"]'); l.scrollIntoView({ block: 'center' });
                const ch = l.querySelector('[data-frise-chiffres]'), mk = l.querySelector('[data-frise-seance]');
                const r = ch.getBoundingClientRect(), m = mk.getBoundingClientRect(), cy = (r.top + r.bottom) / 2;
                const chevauche = m.left < r.right && m.right > r.left;
                const points = Array.from({ length: 21 }, (_, i) => r.left + 2 + (r.width - 4) * i / 20);
                const caches = points.filter(x => { const e = document.elementFromPoint(x, cy); return !e || !e.closest('[data-frise-chiffres]'); }).length;
                return { chevauche, caches, opacite: getComputedStyle(mk).opacity };
            });
            v('  → le repère du 12 oct. tombe SUR « 650 / 500 DH sur le cycle » : les chiffres restent devant (aucun point caché), repère translucide',
              cache.chevauche && cache.caches === 0 && Number(cache.opacite) < 1, JSON.stringify(cache));
        }
        await page.click('[data-frise-categorie][data-cat="__exceptionnel"] [data-frise-ligne][data-poste="irr_810"] [data-frise-enveloppe]');
        await page.waitForSelector('[data-frise-apercu]', { state: 'visible', timeout: 5000 });
        const ap = (await page.textContent('[data-frise-apercu]')).replace(/\s+/g, ' ');
        v('  → la toucher montre l’opération derrière (« cadeau mariage », 650 DH), comme les autres lignes', /cadeau mariage/i.test(ap) && /650/.test(ap) && !/imprévu/.test(ap), ap.slice(0, 300));
        await page.evaluate((ST) => { const st = eval(ST); st.fermerApercuFrise(); st.friseOuverte = false; }, ST);
        //  v37.128 — « APPART AGADIR PAYÉ SUR RÉALISÉ, NON PAYÉ SUR LA FRISE — IL FAUT UN AUDIT POUR TOUT ALIGNER » :
        //  cochée dans le Réalisé (sans opération), la ligne compte dans la frise ; « + ajouter » aussi ; chaque ligne = le réglé du Réalisé
        const audit = await page.evaluate(async (ST) => {
            const st = eval(ST), D = st.donneesAnnuelles[2026], dep = (id) => D.depensesIrregulieres.find(x => x.id === id);
            const frise = async () => { st.calculationTick++; await Vue.nextTick(); const e = st.friseCycle.categories.find(c => c.key === '__exceptionnel'); return Object.fromEntries(e.lignes.map(l => [l.cle, l.engage])); };
            const realise = () => Object.fromEntries(D.depensesIrregulieres.filter(x => x.montant > 0).map(x => ['irr_' + x.id, Math.round(st.getPaidAmount(x, x.montant))]));
            st.friseOuverte = true;
            const avant = await frise();
            st.toggleItemPaid(dep(811), 300);
            const coche = await frise(), rCoche = realise(), jCoche = D.transactionsReelles.filter(t => t.source === 'realise').map(t => [t.libelle, t.montant, t.categorieId]);
            st.ajouterAuRegle(dep(811), 300, '+45');
            const ajoute = await frise(), rAjoute = realise(), jAjoute = D.transactionsReelles.filter(t => t.source === 'realise').map(t => t.montant);
            st.toggleItemPaid(dep(811), 300);   // décocher
            const decoche = await frise(), jDecoche = D.transactionsReelles.filter(t => t.source === 'realise').length;
            st.friseOuverte = false;
            return { avant, coche, rCoche, ajoute, rAjoute, decoche, jCoche, jAjoute, jDecoche };
        }, ST);
        v('K2. « Révision chaudière » cochée dans le Réalisé, sans opération : la frise passe de 0 à 300 / 300 (le chiffre du Réalisé)',
          audit.avant.irr_811 === 0 && audit.coche.irr_811 === 300 && audit.rCoche.irr_811 === 300, JSON.stringify(audit));
        v('  → « + ajouter 45 » dans le Réalisé : 345 des deux côtés ; décochée : 0 ; Cadeau mariage (journal) : 650 partout',
          audit.ajoute.irr_811 === 345 && audit.rAjoute.irr_811 === 345 && audit.decoche.irr_811 === 0 && audit.coche.irr_810 === 650 && audit.rCoche.irr_810 === 650, JSON.stringify(audit));
        v('  → audit : chaque ligne exceptionnelle de la frise = le réglé du Réalisé', Object.keys(audit.ajoute).filter(k => k !== 'irr_autres').length === 2 && Object.keys(audit.ajoute).filter(k => k !== 'irr_autres').every(k => audit.ajoute[k] === audit.rAjoute[k]), JSON.stringify([audit.ajoute, audit.rAjoute]));
        const frappe = await page.evaluate(async (ST) => { const st = eval(ST), D = st.donneesAnnuelles[2026], dep = D.depensesIrregulieres.find(x => x.id === 811), out = [];
            for (const v of ['2', '25', '250', '25']) { st.setMontantPayeCycle(dep, v); st.calculationTick++; await Vue.nextTick(); out.push(D.transactionsReelles.filter(t => t.source === 'realise').map(t => t.montant)); }
            const regle = Math.round(st.getPaidAmount(dep, 300));
            st.setMontantPayeCycle(dep, ''); st.calculationTick++; await Vue.nextTick();
            return { out, regle, fin: D.transactionsReelles.filter(t => t.source === 'realise').length }; }, ST);
        v('  → montant partiel tapé lettre par lettre (2 → 25 → 250 → 25) : UNE opération qui suit (2, 25, 250, 25), pas d\u2019accumulation ; vidé : plus rien',
          JSON.stringify(frappe.out) === '[[2],[25],[250],[25]]' && frappe.regle === 25 && frappe.fin === 0, JSON.stringify(frappe));
        v('  → v37.133 : cocher crée l\u2019opération « Révision chaudière » 300 DH dans SA catégorie (journal, modifiable) ; « + 45 » : l\u2019opération passe à 345 (une seule, modifiable) ; décocher la retire',
          JSON.stringify(audit.jCoche) === '[["Révision chaudière",300,"cat_irr_l_revision_chaudiere"]]' && JSON.stringify(audit.jAjoute) === '[345]' && audit.jDecoche === 0, JSON.stringify([audit.jCoche, audit.jAjoute, audit.jDecoche]));
    });
    await section('L', async () => {
        //  v37.107 — « C'est déjà en saisie et toujours attendu » : une opération rangée dans la catégorie d'une dépense exceptionnelle
        //  la règle (Relevé, projection, Pilotage). Cycle du 13 oct. : 27 sept. → 26 oct.
        const lire = () => page.evaluate(async (ST) => { const st = eval(ST); st.calculationTick++; await Vue.nextTick();
            const D = st.donneesAnnuelles[2026], dep = (id) => D.depensesIrregulieres.find(x => x.id === id);
            return { payeCadeau: st.isItemPaid(dep(810), 500), payeChaud: st.isItemPaid(dep(811), 300), regleChaud: st.getPaidAmount(dep(811), 300),
                     lignes: st.atterrissageCycle.comptes.flatMap(c => (c.lignes || []).map(l => [l.libelle, Math.round(l.montant)])).filter(([x]) => /Cadeau|Révision|Abonnements/i.test(x)) }; }, ST);
        let r = await lire();
        v('L. « Cadeau mariage » déjà saisi (650 DH dans sa catégorie) : réglé, le Relevé ne l\u2019attend plus ; « Révision chaudière » (rien de saisi) reste attendue en entier',
          r.payeCadeau === true && r.payeChaud === false && !r.lignes.some(([x]) => /Cadeau/.test(x)) && r.lignes.some(([x, m]) => /Révision chaudière/.test(x) && m === 300), JSON.stringify(r));
        await page.evaluate((ST) => { const st = eval(ST); st.donneesAnnuelles[2026].transactionsReelles.push({ id: 9103, date: '2026-10-10', datetime: '2026-10-10T09:00', mois: 10, libelle: 'acompte chaudière', montant: 120, categorieId: 'cat_irr_l_revision_chaudiere', compteId: 1, source: 'manuel' }); }, ST);
        r = await lire();
        v('  → un acompte de 120 DH saisi pour la chaudière : 120 réglés, le Relevé n\u2019attend plus que les 180 qui restent',
          r.regleChaud === 120 && r.lignes.some(([x, m]) => /Révision chaudière/.test(x) && m === 180), JSON.stringify(r));
        //  et une charge variable MENSUELLE sans ligne de détail, réglée par sa propre catégorie
        const cv = await page.evaluate(async (ST) => { const st = eval(ST), D = st.donneesAnnuelles[2026];
            D.chargesVariables.abonnements = { label: 'Abonnements', valeur: 150, periode: 'mois', paye: false, montantPaye: 0, exceptions: [], categorieId: 'cat_cv_abonnements' };
            st.calculationTick++; await Vue.nextTick();
            const avant = st.isItemPaid(D.chargesVariables.abonnements, 150);
            D.transactionsReelles.push({ id: 9104, date: '2026-10-05', datetime: '2026-10-05T09:00', mois: 10, libelle: 'netflix spotify', montant: 150, categorieId: 'cat_cv_abonnements', compteId: 1, source: 'manuel' });
            st.calculationTick++; await Vue.nextTick();
            return { avant, apres: st.isItemPaid(D.chargesVariables.abonnements, 150) }; }, ST);
        v('  → une charge variable mensuelle SANS détail (« Abonnements ») : réglée dès qu\u2019une opération de sa catégorie est saisie', cv.avant === false && cv.apres === true, JSON.stringify(cv));
        v('aucune erreur JavaScript', erreurs.length === 0, erreurs[0] || '');
    });
} catch (e) {
    v('exécution sans exception', false, String(e && e.stack || e).slice(0, 400));
} finally {
    await browser.close(); srv.close();
}
console.log('  ' + '─'.repeat(80));
console.log(ko === 0 ? `  ✅ TOUT PASSE — ${n} contrôles` : `  ❌ ${ko} contrôle(s) en échec sur ${n}`);
process.exit(ko === 0 ? 0 : 1);
