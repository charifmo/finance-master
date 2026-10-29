/**
 * v37.64 — POURQUOI CE DÉCOUVERT ? ET UN REVENU ARRIVÉ SUR UN AUTRE COMPTE.
 *
 *   « Pourquoi le calcul n'est pas bien fait ? J'attends des entrées appartement et magasin sur le courant. »
 *   Le jour de paie (mardi 27 oct. 2026, cycle 27 oct. → 26 nov.). Le plan attend le salaire et la bonification
 *   sur le Courant, et garde le virement Courant → ASSAFA de 15 000 DH (le 20 nov.) qui devait y envoyer
 *   l'argent ; or le relevé importé d'ASSAFA montre les deux versements de l'employeur (19 310,55 et
 *   12 987,40 DH, le 27 oct.). Les loyers (magasin 5 000 le 3 nov., appartement 4 000 le 5 nov.) sont bien
 *   attendus sur le Courant. Identité, montants et libellés fictifs (KARIM TESTEUR).
 *     A. statique ;
 *     B. le calcul du découvert, ligne à ligne (« Pourquoi ? ») ;
 *     C. le salaire et la bonification arrivés sur ASSAFA — ni le virement entre vos comptes (4 000 DH,
 *        le montant exact du loyer de l'appartement), ni une entrée à 6 % d'un loyer ne sont pris pour un revenu ;
 *     D. « Retirer ce virement de novembre » : annuler ne retire rien ; confirmer le retire, le Courant
 *        remonte de 15 000 DH, le découvert et l'alerte disparaissent, l'envoi au VPS part ;
 *     E. une entrée POINTÉE sur un revenu compte, quel que soit son montant ;
 *     F. au cycle d'octobre (le 20 oct.), ces versements du 27 ne disent rien.
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
console.log('\n  POURQUOI CE DÉCOUVERT ? UN REVENU ARRIVÉ SUR UN AUTRE COMPTE\n  ' + '─'.repeat(80));

/* ── A. Statique ─────────────────────────────────────────────────────── */
v('A. la Météo dit pourquoi un compte finit dans le rouge (« Pourquoi ? », le calcul du compte)',
  /data-meteo-pourquoi :data-compte="q\.key"/.test(html) && /aujourd’hui \+ \{\{ chiffre\(q\.entrees\) \}\} d’entrées − \{\{ chiffre\(q\.sorties\) \}\} de sorties/.test(html));
v('  → et un revenu arrivé sur un autre compte, avec le virement qui devait faire ce trajet',
  /data-meteo-ailleurs :data-prevu="r\.prevu"/.test(html) && /data-meteo-retirer-virement @click="\$emit\('retirer-virement', v\)"/.test(html));
v('  → les trois Météo (Réalisé, Prévisionnel, Pilotage) branchent le retrait',
  (html.match(/@retirer-virement="retirerVirementPrevu"[^>]*><\/meteo-financiere>/g) || []).length === 3 && /'cloturer', 'retirer-virement'(, '[a-z-]+')*\]/.test(html));

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

/* ── Le décor : le Courant, ASSAFA (il paie les charges fixes), l'Épargne ─ */
const CC = 'acc_cc', LT = 'acc_lt', ASSAFA = 1790780761917;
const VIREMENT = 15000, SALAIRE = 19310.55, BONIF = 12987.4;
const fixture = () => {
    const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8'));
    const base = fx.donneesAnnuelles[Object.keys(fx.donneesAnnuelles)[0]];
    fx.donneesAnnuelles = {};
    for (const an of [2026, 2027]) fx.donneesAnnuelles[an] = JSON.parse(JSON.stringify(base));
    Object.assign(fx.soldesInitiaux, { moisActuel: 10, anneeActuelle: 2026, jourDePaie: 27, compteChargesFixes: 'cpt_' + ASSAFA, compteChargesVariables: 'courant',
                                       assurances_tracker: [], voyageDebut: '', voyageFin: '' });
    fx.soldesInitiaux.categories = [];
    fx.comptes = [
        { id: CC, label: 'Compte Courant', type: 'liquide', solde: 6300, icone: '💳' },
        { id: LT, label: 'Épargne Long Terme', type: 'epargne', solde: 2000, icone: '🎯' },
        { id: ASSAFA, label: 'Compte Principale ASSAFA', type: 'liquide', solde: 33000 },
    ];
    const neutre = { paye: false, montantPaye: 0, exceptions: [], showExceptions: false };
    const L = (nom, montant) => ({ nom, montant });
    for (const an of Object.keys(fx.donneesAnnuelles)) {
        const d = fx.donneesAnnuelles[an];
        const recu = (m) => an === '2026' ? { trackerRealise: { '2026-11': { paye: true, montantPaye: m, dateReelle: '2026-10-27' } } } : {};
        const Rv = (label, b, j, extra = {}) => ({ ...neutre, label, base: b, jourPrevu: j, destinationCompte: 'courant', ...extra });
        d.revenus = { salaire: Rv('SALAIRE', 20000, 27, recu(20000)), bonif: Rv('Bonification', 13000, 27, recu(13000)),
                      magasin: Rv('Loyer magasin', 5000, 3), appart: Rv('Loyer appartement', 4000, 5), cnss: Rv('—', 0), studio: Rv('—', 0) };
        const Fx = (label, valeur) => ({ ...neutre, label, valeur, jourPrevu: null });
        d.chargesFixes = { creditImmo: Fx('Crédit Immo + Assur', 5000), creditStudio: Fx('—', 0), syndic: Fx('Syndic', 300), nounou: Fx('Nounou', 2500),
                           ecole: Fx('École', 1500), femmeMenage: Fx('—', 0), habitsCharif: Fx('—', 0), habitsBebe: Fx('—', 0), jouets: Fx('—', 0) };
        const V = (label, valeur, periode, details) => ({ ...neutre, label, valeur, periode, details });
        d.chargesVariables = {
            alimentation: V('Alimentation', 0, 'semaine', [L('Marjane', 600)]),
            sorties: V('Sorties', 0, 'semaine', [L('Resto', 400)]),
            voiture: V('Voiture', 0, 'semaine', [L('Essence', 300)]),
            sante: V('—', 0, 'semaine', []),
            factures: { ...V('Factures', 1400, 'mois', [L('Électricité', 400), L('Téléphone', 200), L('Eau', 800)]), categorieId: 'cat_cv_factures' },
        };
        d.epargne = []; d.depensesIrregulieres = []; d.consoRealiseeT0 = {}; d.transactionsReelles = [];
        d.virementsInternes = an !== '2026' ? [] : [{ id: 9101, mois: 11, sourceCompte: 'courant', destinationCompte: 'cpt_' + ASSAFA, montant: VIREMENT }];
        //  Le relevé importé (déjà traité : tout « ignoré », « Virement : déjà dans le solde »)
        const op = (c, d8, m, l) => ({ c, d: d8, m, l, s: 'ignoree', r: 'Virement : déjà dans le solde' });
        d.banqueOperations = an !== '2026' ? {} : {
            bqsal: op(ASSAFA, '2026-10-27', SALAIRE, 'virementrecudeacmesarlsalaire'),
            bqbon: op(ASSAFA, '2026-10-27', BONIF, 'virementrecudeacmesarlprime'),
            //  un virement entre vos comptes, du montant EXACT du loyer de l'appartement : pas un revenu
            bqint1: op(CC, '2026-10-28', -4000, 'virwebverstesteurkarim'),
            bqint2: op(ASSAFA, '2026-10-28', 4000, 'virinstrecudetesteurkarim'),
            //  à 6 % du loyer du magasin : trop loin pour être lui
            bqloin: op(LT, '2026-10-29', 5300, 'virementrecudivers'),
        };
    }
    return fx;
};
const page0 = html
    .replace('<script src="https://unpkg.com/vue@3/dist/vue.global.js"', '<script src="/vue.js"')
    .replace('<script src="https://cdn.jsdelivr.net/npm/chart.js"', '<script src="/chart.js"')
    .replace(/<script src="https:\/\/cdn\.tailwindcss\.com"[^>]*><\/script>/, '')
    .replace(/<script[^>]*src="https:\/\/[^"]*"[^>]*><\/script>/g, '');
const TYPES = { '.js': 'text/javascript', '.gz': 'application/gzip', '.wasm': 'application/wasm' };
const srv = http.createServer((req, res) => {
    const p = req.url.split('?')[0];
    const s = (c, b, t = 'application/json') => { res.writeHead(c, { 'Content-Type': t }); res.end(b); };
    if (p === '/finance/') return s(200, page0, 'text/html; charset=utf-8');
    if (p === '/vue.js') return s(200, fs.readFileSync(vueJs), 'text/javascript');
    if (p === '/chart.js') return s(200, fs.readFileSync(chartJs), 'text/javascript');
    if (p === '/finance/finance_data.json') return s(200, JSON.stringify(fixture()));
    if (p.startsWith('/finance/vendor/')) {
        const f = path.join(RACINE, decodeURIComponent(p.slice('/finance/'.length)));
        return fs.existsSync(f) ? s(200, fs.readFileSync(f), TYPES[path.extname(f)] || 'application/octet-stream') : s(404, 'absent', 'text/plain');
    }
    return s(200, '{"status":"ok"}');
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port;
const browser = await pw.chromium.launch({ executablePath: chromium, args: ['--no-sandbox'] });
const ST = 'document.querySelector("#app").__vue_app__._instance.setupState';
const erreurs = [], envois = [];
const ouvrirPage = async (quand) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.clock.setFixedTime(quand);
    page.on('pageerror', e => erreurs.push(String(e)));
    await page.route('**/webhook/**', route => route.abort());
    page.on('request', r => { if (r.method() === 'POST' && /save_data\.php/.test(r.url())) envois.push(Date.now()); });
    await page.goto(`http://127.0.0.1:${port}/finance/`, { waitUntil: 'load' });
    await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState.moisBudgetaire; }, null, { timeout: 30000 });
    await page.waitForTimeout(600);
    await page.evaluate(async (ST) => { const st = eval(ST); st.appMode = 'previsionnel'; await new Promise(r => setTimeout(r, 250)); st.activeTab = 'pilotageTheo'; }, ST);
    await page.waitForTimeout(500);
    return page;
};
const etat = (page) => page.evaluate((ST) => {
    const st = eval(ST), m = st.meteoFinanciere, c = st.atterrissageCycle.comptes.find(x => x.courant);
    return JSON.parse(JSON.stringify({ ailleurs: st.revenusAilleurs, pourquoi: m.pourquoi, meteoAilleurs: m.ailleurs, decouverts: m.decouverts.map(d => d.key),
        courant: { key: c.key, t0: c.t0, entrees: c.entrees, sorties: c.sorties, fin: c.atterrissage },
        virements: st.donneesAnnuelles[2026].virementsInternes.map(x => x.id) }));
}, ST);
const texte = (page, sel) => page.evaluate((sel) => [...document.querySelectorAll(sel)].filter(e => e.offsetParent !== null).map(e => e.textContent.replace(/\s+/g, ' ').trim()), sel);
const sansEsp = (s) => String(s).replace(/[\s  ]/g, '');

try {
    /* ── B. Le calcul du découvert ─────────────────────────────────────── */
    let page = await ouvrirPage(new Date(2026, 9, 27, 10, 0, 0));
    let E = await etat(page);
    await section('B', async () => {
        const c = E.courant, q = (E.pourquoi || []).find(x => x.key === c.key);
        v('B. jour de paie : le Courant finit le cycle dans le rouge (le virement de 15 000 DH)', c.fin < 0 && E.decouverts.includes(c.key), JSON.stringify(c));
        v('  → « Pourquoi ? » : 6 300 aujourd\'hui + entrées − sorties = l\'atterrissage, au dirham',
          !!q && q.t0 === 6300 && q.t0 + q.entrees - q.sorties === q.atterrissage && q.atterrissage === c.fin, JSON.stringify(q && { t0: q.t0, e: q.entrees, s: q.sorties, a: q.atterrissage }));
        const cr = (q && q.credits) || [], db = (q && q.debits) || [];
        v('  → les loyers SONT attendus sur le Courant : magasin 5 000 le 3 nov., appartement 4 000 le 5 nov.',
          cr.length === 2 && cr[0].libelle === '💰 Loyer magasin' && cr[0].montant === 5000 && cr[0].quand === '3 nov.'
          && cr[1].libelle === '💰 Loyer appartement' && cr[1].montant === 4000 && cr[1].quand === '5 nov.' && q.entrees === 9000, JSON.stringify(cr));
        const vir = db.find(l => /Virement → Compte Principale ASSAFA/.test(l.libelle)), sem = db.filter(l => /Charges variables/.test(l.libelle));
        v('  → les sorties, de la plus grosse : le virement de 15 000 le 20 nov. en tête',
          !!vir && vir.montant === VIREMENT && vir.quand === '20 nov.' && db[0] === db.find(l => l === vir) && db.every((l, i) => i === 0 || db[i - 1].montant >= l.montant), JSON.stringify(db));
        v('  → les semaines de charges variables : UNE ligne « d\'ici le 26 novembre » ; les factures 1 400 le 6 nov.',
          sem.length === 1 && sem[0].nb >= 4 && sem[0].quand === 'd’ici le 26 novembre' && db.some(l => l.libelle === '🧾 Total Factures' && l.montant === 1400 && l.quand === '6 nov.'), JSON.stringify(sem));
        const resume = await texte(page, '[data-meteo-pourquoi-calcul]');
        v('  → l\'écran le dit : « Pourquoi ? Courant : 6 300 aujourd’hui + 9 000 d’entrées − … = − … DH »',
          resume.length === 1 && sansEsp(resume[0]).startsWith('Pourquoi?Courant:6300aujourd’hui+9000d’entrées−' + q.sorties + 'desorties=−' + (-q.atterrissage) + 'DH'), resume[0]);
    });

    /* ── C. Le salaire et la bonification, arrivés sur ASSAFA ───────────── */
    await section('C', async () => {
        const g = E.ailleurs || [];
        v('C. une seule alerte : Courant prévu, ASSAFA reçu', g.length === 1 && g[0].prevu === E.courant.key && g[0].recu === 'cpt_' + ASSAFA, JSON.stringify(g.map(x => [x.prevu, x.recu])));
        const a = g[0] || { revenus: [], virements: [] };
        v('  → SALAIRE (19 310,55, à 3,4 %) et Bonification (12 987,40) — 32 298 DH reçus le 27 oct.',
          a.libelles === 'SALAIRE et Bonification' && a.revenus.map(r => r.montant).join('|') === '19310.55|12987.4' && a.montant === 32298 && a.quand === '27 oct.' && a.plusieurs,
          JSON.stringify(a));
        v('  → ni le virement entre vos comptes (4 000 = le loyer de l\'appartement), ni l\'entrée à 6 % du magasin',
          !a.revenus.some(r => /appartement|magasin/i.test(r.libelle)) && g.length === 1);
        v('  → le virement prévu Courant → ASSAFA : 15 000 DH le 20 nov. (novembre)',
          a.virements.length === 1 && a.virements[0].id === 9101 && a.virements[0].an === 2026 && a.virements[0].montant === VIREMENT && a.virements[0].quand === '20 nov.' && a.virements[0].mois === 'novembre',
          JSON.stringify(a.virements));
        const t = await texte(page, '[data-meteo-ailleurs]');
        v('  → l\'écran : « SALAIRE et Bonification — 32 298 DH reçus le 27 oct. — sont arrivés sur Assafa, pas sur Courant »',
          t.length === 1 && /SALAIRE et Bonification — 32\s?298 DH reçus le 27 oct\. — sont arrivés sur Assafa, pas sur Courant \(relevé importé\) : Courant ne les a pas reçus\./.test(t[0]), t[0]);
        v('  → et le bouton « Retirer ce virement de novembre »',
          (await texte(page, '[data-meteo-retirer-virement]')).join('|') === 'Retirer ce virement de novembre');
    });

    /* ── D. Retirer le virement ────────────────────────────────────────── */
    await section('D', async () => {
        let msg = '';
        page.once('dialog', d => { msg = d.message(); d.dismiss(); });
        await page.click('[data-meteo-retirer-virement]'); await page.waitForTimeout(400);
        const E1 = await etat(page);
        v('D. « Annuler » : la question est posée, rien n\'est retiré',
          /Retirer du plan ce virement de 15\s?000\sDH \(novembre\)/.test(msg) && E1.virements.includes(9101) && E1.courant.fin === E.courant.fin, msg);
        const avant = envois.length;
        page.once('dialog', d => d.accept());
        await page.click('[data-meteo-retirer-virement]'); await page.waitForTimeout(500);
        const E2 = await etat(page);
        v('  → confirmé : le virement quitte le plan, le Courant remonte de 15 000 DH exactement',
          !E2.virements.includes(9101) && E2.courant.fin === E.courant.fin + VIREMENT, JSON.stringify([E.courant.fin, E2.courant.fin]));
        v('  → plus de découvert, plus d\'alerte, plus de « Pourquoi ? »',
          E2.courant.fin >= 0 && !E2.decouverts.length && !E2.meteoAilleurs.length && !(await page.$('[data-meteo-ailleurs]')) && !(await page.$('[data-meteo-pourquoi]')), JSON.stringify(E2.courant));
        await page.waitForTimeout(2600);
        v('  → l\'envoi au VPS part tout seul', envois.length > avant, `${avant} → ${envois.length}`);
    });
    await page.context().close();

    /* ── E. Une entrée pointée sur un revenu compte, quel que soit son montant ─ */
    page = await ouvrirPage(new Date(2026, 9, 27, 10, 0, 0));
    await section('E', async () => {
        //  Deux entrées pour un seul loyer : 4 000 sur le Courant (le bon compte, au dirham) et 3 900 sur l'Épargne
        //  (à 2,5 %) — la plus proche prend le loyer ; l'autre ne devient pas « le loyer arrivé ailleurs »
        const g0 = await page.evaluate((ST) => {
            const st = eval(ST), B = st.donneesAnnuelles[2026].banqueOperations;
            B.bqbon1 = { c: 'acc_cc', d: '2026-11-05', m: 4000, l: 'versementlocataireappart', s: 'ignoree' };
            B.bqbon2 = { c: 'acc_lt', d: '2026-11-04', m: 3900, l: 'virementrecuautre', s: 'ignoree' };
            st.calculationTick++;
            const r = JSON.parse(JSON.stringify(st.revenusAilleurs.map(x => x.libelles)));
            delete B.bqbon1; delete B.bqbon2; st.calculationTick++;
            return r;
        }, ST);
        v('E. 4 000 sur le Courant et 3 900 sur l\'Épargne pour le loyer de 4 000 : le Courant le prend, pas d\'alerte',
          g0.length === 1 && g0[0] === 'SALAIRE et Bonification', JSON.stringify(g0));
        const g = await page.evaluate((ST) => {
            const st = eval(ST);
            const i = st.revenusBudgetairesTries.findIndex(r => r.label === 'Loyer appartement');
            st.donneesAnnuelles[2026].banqueOperations.bqpointe = { c: 'acc_lt', d: '2026-10-30', m: 3000, l: 'versementlocataire', s: 'pilotage', k: 'Revenu:' + i + ':Loyer appartement' };
            st.calculationTick++;
            return JSON.parse(JSON.stringify(st.revenusAilleurs.map(x => ({ prevu: x.prevu, recu: x.recu, lib: x.libelles, v: x.virements.length }))));
        }, ST);
        v('  → 3 000 DH sur l\'Épargne POINTÉS sur le loyer de l\'appartement (25 % de moins) : il est arrivé là',
          g.length === 2 && g.some(x => x.recu === 'cpt_acc_lt' && x.lib === 'Loyer appartement' && x.v === 0), JSON.stringify(g));
        await page.waitForTimeout(300);
        const t = await texte(page, '[data-meteo-ailleurs]');
        v('  → dit dans la Météo (il explique le découvert du Courant), sans bouton (aucun virement prévu)',
          t.length === 2 && t.some(x => /Loyer appartement — 3\s?000 DH reçus le 30 oct\. — est arrivé sur .*, pas sur Courant .* Courant ne l’a pas reçu\./.test(x)), t.join(' ‖ '));
    });
    await page.context().close();

    /* ── F. Au cycle d'octobre, les versements du 27 ne disent rien ────────── */
    page = await ouvrirPage(new Date(2026, 9, 20, 10, 0, 0));
    await section('F', async () => {
        const F = await etat(page);
        v('F. le 20 oct. (cycle 27 sept. → 26 oct.) : aucune alerte', (F.ailleurs || []).length === 0 && !(await page.$('[data-meteo-ailleurs]')), JSON.stringify(F.ailleurs));
    });
    await page.context().close();
    v('aucune erreur JavaScript', erreurs.length === 0, erreurs[0] || '');
} catch (e) {
    v('exécution sans exception', false, String(e && e.stack || e).slice(0, 400));
} finally { await browser.close(); srv.close(); }

console.log(ko === 0 ? '  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
