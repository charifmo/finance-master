/**
 * v37.47 — « Le surplus brut, c'est après que j'ai effectué toutes les charges : combien
 * il reste sur le courant ET Assafa à la fin du mois. Le surplus net est celui après le
 * transfert de toutes les épargnes. […] des flags à cocher pour distinguer les comptes,
 * ou les déduire de leur fonction : maintenant tout est mélangé ! »
 *
 *   Le décor ressemble aux comptes réels : un Courant qui reçoit les revenus, Assafa qui
 *   paie les charges fixes (le Courant l'alimente par une ligne « Compte Principale
 *   ASSAFA »), des Dépenses annuelles qui paient les dépenses ponctuelles, un compte
 *   urgence, une épargne long terme. Tous les montants attendus sont calculés À LA MAIN.
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
console.log('\n  LE SURPLUS DU PÉRIMÈTRE DE FONCTIONNEMENT — brut, épargne, net\n  ' + '─'.repeat(94));
const require = createRequire(import.meta.url);
const essai = (f) => { try { return f(); } catch { return null; } };
const pw = essai(() => require('playwright-core'));
const vueJs = essai(() => require.resolve('vue/dist/vue.global.js'));
const chromium = process.env.CHROMIUM || ['/opt/pw-browsers/chromium'].find(p => essai(() => fs.existsSync(p) && fs.statSync(p).isFile()));
const fin = () => { console.log('  ' + '─'.repeat(94)); console.log(ko === 0 ? `  ✅ TOUT PASSE — ${n} contrôles` : `  ❌ ${ko} contrôle(s) en échec sur ${n}`); process.exit(ko === 0 ? 0 : 1); };
if (!pw || !vueJs || !chromium) { console.log('  ⏭️  ignoré (playwright-core, vue ou Chromium absent)'); fin(); }

/* ── Le décor : vendredi 9 octobre 2026, paie le 27 → mois budgétaire = octobre.
   Comptes : 1 Courant 6 000 · 2 Assafa 1 500 (paie les charges fixes) · 3 Dépenses annuels 9 000 ·
             4 Compte urgence 5 000 · 5 Épargne LT 39 000 — TOUS « liquide » sauf le LT.
   Revenus → Courant : Salaire 20 000 (j.27), Magasin 7 000 (j.6).
   Charges fixes (payées par Assafa) : Crédit 8 000, École 1 000. Factures 1 000 / mois (Courant).
   Épargne depuis le Courant : Urgence 3 000 → 4 · Dépenses annuels 2 000 → 3 ·
             « Compte Principale ASSAFA » 9 000 → 2 (PAS de l'épargne) · Poche voyage 500 (virtuelle).
   2026 : novembre — Courant → Assafa 1 000 (interne), LT → Dépenses annuels 4 000 (hors périmètre),
            « Vidange » 3 000 payée par les Dépenses annuels, « Cadeau » 700 payé par le Courant ;
          décembre — Dépenses annuels → Courant 2 500 (reprise), Courant → LT 1 200 (épargne),
            « Prime » + 4 000 sur le Courant.
   NOVEMBRE : brut 27 000 − 9 000 − 1 000 − 700 = 16 300 · épargne 3 000 + 2 000 + 500 = 5 500 · net 10 800
   DÉCEMBRE : brut 27 000 + 4 000 − 9 000 − 1 000 = 21 000 · épargne 5 500 − 2 500 + 1 200 = 4 200 · net 16 800
   JANVIER 2027 (rien d'exceptionnel) : brut 17 000 · épargne 5 500 · net 11 500
   OCTOBRE (mois en cours, rien de pointé) : brut 6 000 + 1 500 + 17 000 = 24 500 · épargne 5 500 · net 19 000 */
const SC = { maintenant: new Date(2026, 9, 9, 10, 0, 0), mois: 10, an: 2026 };
const decor = () => {
    const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8'));
    const base = fx.donneesAnnuelles[Object.keys(fx.donneesAnnuelles)[0]];
    fx.donneesAnnuelles = {};
    Object.assign(fx.soldesInitiaux, { moisActuel: 10, anneeActuelle: 2026, jourDePaie: 27, compteChargesFixes: 'cpt_2', compteChargesVariables: 'courant', assurances_tracker: [], voyageDebut: '', voyageFin: '' });
    fx.comptes = [
        { id: 1, label: 'Compte Courant', type: 'liquide', solde: 6000, icone: '💳' },
        { id: 2, label: 'Compte Principale ASSAFA', type: 'liquide', solde: 1500, icone: '🏛️' },
        { id: 3, label: 'Dépenses annuels', type: 'liquide', solde: 9000, icone: '📅' },
        { id: 4, label: 'Compte urgence', type: 'liquide', solde: 5000, icone: '🛟' },
        { id: 5, label: 'Épargne LT', type: 'epargne', solde: 39000, icone: '🎯' },
    ];
    const neutre = { paye: false, montantPaye: 0, exceptions: [], showExceptions: false };
    for (const an of [2026, 2027]) {
        const d = JSON.parse(JSON.stringify(base));
        const Rv = (label, b, j) => ({ ...neutre, label, base: b, jourPrevu: j, destinationCompte: 'courant' });
        d.revenus = { salaire: Rv('Salaire', 20000, 27), magasin: Rv('Magasin', 7000, 6), bonif: Rv('—', 0), cnss: Rv('—', 0), appart: Rv('—', 0), studio: Rv('—', 0) };
        const Fx = (label, valeur, j) => ({ ...neutre, label, valeur, jourPrevu: j });
        d.chargesFixes = { creditImmo: Fx('Crédit', 8000, 1), ecole: Fx('École', 1000, 2), creditStudio: Fx('—', 0), syndic: Fx('—', 0), nounou: Fx('—', 0),
                           femmeMenage: Fx('—', 0), habitsCharif: Fx('—', 0), habitsBebe: Fx('—', 0), jouets: Fx('—', 0) };
        const V = (label, valeur, periode) => ({ ...neutre, label, valeur, periode, details: [], showDetails: false });
        d.chargesVariables = { alimentation: V('COURSES', 0, 'semaine'), sorties: V('SORTIES', 0, 'semaine'), voiture: V('—', 0, 'semaine'), sante: V('—', 0, 'semaine'),
                               factures: { ...V('FACTURES', 1000, 'mois'), categorieId: 'cat_cv_factures', jourPrevu: 6 } };
        d.epargne = [
            { id: 21, nom: 'Urgence', valeur: 3000, sourceCompte: 'courant', linkedAccountId: 4, jourPrevu: 1 },
            { id: 22, nom: 'Dépenses annuels', valeur: 2000, sourceCompte: 'courant', linkedAccountId: 3, jourPrevu: 1 },
            { id: 23, nom: 'Compte Principale ASSAFA', valeur: 9000, sourceCompte: 'courant', linkedAccountId: 2, jourPrevu: 1 },
            { id: 24, nom: 'Poche voyage', valeur: 500, sourceCompte: 'courant', jourPrevu: 1 },
        ];
        d.virementsInternes = an !== 2026 ? [] : [
            { id: 31, mois: 11, sourceCompte: 'courant', destinationCompte: 'cpt_2', montant: 1000 },
            { id: 32, mois: 11, sourceCompte: 'cpt_5', destinationCompte: 'cpt_3', montant: 4000 },
            { id: 33, mois: 12, sourceCompte: 'cpt_3', destinationCompte: 'courant', montant: 2500 },
            { id: 34, mois: 12, sourceCompte: 'courant', destinationCompte: 'cpt_5', montant: 1200 },
        ];
        d.depensesIrregulieres = an !== 2026 ? [] : [
            { id: 41, mois: 11, annee: 2026, nom: 'Vidange', montant: 3000, sourceCompte: 'cpt_3', paye: false, montantPaye: 0 },
            { id: 42, mois: 11, annee: 2026, nom: 'Cadeau', montant: 700, sourceCompte: 'courant', paye: false, montantPaye: 0 },
            { id: 43, mois: 12, annee: 2026, nom: 'Prime', montant: -4000, sourceCompte: 'courant', paye: false, montantPaye: 0 },
        ];
        d.transactionsReelles = []; d.consoRealiseeT0 = {};
        fx.donneesAnnuelles[an] = d;
    }
    return fx;
};
const FX = decor();
const page0 = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8')
    .replace('<script src="https://unpkg.com/vue@3/dist/vue.global.js"', '<script src="/vue.js"')
    .replace(/<script[^>]*src="https:\/\/[^"]*"[^>]*><\/script>/g, '');
const srv = http.createServer((req, res) => {
    const p = req.url.split('?')[0];
    const s = (c, b, t = 'application/json') => { res.writeHead(c, { 'Content-Type': t }); res.end(b); };
    if (p === '/finance/') return s(200, page0, 'text/html; charset=utf-8');
    if (p === '/vue.js') return s(200, fs.readFileSync(vueJs), 'text/javascript');
    if (p === '/finance/finance_data.json') return s(200, JSON.stringify(FX));
    if (p.endsWith('get_ai_memory.php')) return s(200, JSON.stringify({ status: 'ok', rag: { regles: [] }, chat: [] }));
    return s(200, '{"status":"ok"}');
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const browser = await pw.chromium.launch({ executablePath: chromium, args: ['--no-sandbox'] });
const ST = 'document.querySelector("#app").__vue_app__._instance.setupState';
const lire = (page, an) => page.evaluate(async ({ ST, an }) => {
    const st = eval(ST); st.anneeAffichage = an; await new Promise(r => setTimeout(r, 200));
    return Object.fromEntries(st.surplusParMois.filter(r => !r.isPast).map(r => [r.mNum, { brut: Math.round(r.brut), ep: Math.round(r.epargne), versee: Math.round(r.epargneVersee || 0), net: Math.round(r.net) }]));
}, { ST, an });
const egal = (o, brut, ep, net) => !!o && o.brut === brut && o.ep === ep && o.net === net;

try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.clock.setFixedTime(SC.maintenant);
    const erreurs = []; page.on('pageerror', e => erreurs.push(String(e)));
    page.on('dialog', d => d.dismiss());
    await page.goto(`http://127.0.0.1:${srv.address().port}/finance/`, { waitUntil: 'load' });
    await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && Array.isArray(a.__vue_app__._instance.setupState.masterAssets); }, null, { timeout: 30000 });
    await page.waitForTimeout(800);

    /* ══ A. LE PÉRIMÈTRE, DÉDUIT DE LA FONCTION ═══════════════════════════ */
    console.log('  ── le périmètre de fonctionnement, déduit de la fonction des comptes');
    const P = await page.evaluate((ST) => { const st = eval(ST); return { F: [...st.comptesFonctionnement].sort(), per: st.perimetreSurplus }; }, ST);
    v('auto : le Courant (revenus) et Assafa (charges fixes) — pas les autres « liquide »', JSON.stringify(P.F) === JSON.stringify(['cpt_1', 'cpt_2']), JSON.stringify(P.F));

    /* ══ B. LES MOIS À VENIR, CALCULÉS À LA MAIN ══════════════════════════ */
    console.log('  ── brut, épargne, net : les mois à venir');
    let s26 = await lire(page, 2026), s27 = await lire(page, 2027);
    v('novembre : brut 16 300 (charges fixes d\'Assafa comprises, virement Courant → Assafa neutre)', s26[11] && s26[11].brut === 16300, JSON.stringify(s26[11]));
    v('  → épargne 5 500 : « Compte Principale ASSAFA » (9 000) n\'est PAS de l\'épargne', s26[11] && s26[11].ep === 5500, JSON.stringify(s26[11]));
    v('  → la « Vidange » payée par les Dépenses annuels n\'est pas dans le brut ; net 10 800', egal(s26[11], 16300, 5500, 10800), JSON.stringify(s26[11]));
    v('décembre : reprise de 2 500 depuis les Dépenses annuels, 1 200 vers le LT → épargne 4 200', egal(s26[12], 21000, 4200, 16800), JSON.stringify(s26[12]));
    v('janvier 2027 : brut 17 000 · épargne 5 500 · net 11 500', egal(s27[1], 17000, 5500, 11500), JSON.stringify(s27[1]));
    v('octobre (mois en cours) : brut = solde réel Courant + Assafa (7 500) + le mois (17 000)', egal(s26[10], 24500, 5500, 19000), JSON.stringify(s26[10]));
    const versee = await page.evaluate(async (ST) => { const st = eval(ST); st.anneeAffichage = 2026;
        const ep = st.donneesAnnuelles[2026].epargne.find(x => x.id === 21);
        st.toggleItemPaid(ep, 3000, st.cyclePilotage); st.comptes.find(c => c.id === 1).solde = 3000; st.forceUpdateCalculations();
        await new Promise(r => setTimeout(r, 300));
        const o = st.surplusParMois.find(r => r.isCurrent);
        const res = { brut: Math.round(o.brut), ep: Math.round(o.epargne), versee: Math.round(o.epargneVersee), net: Math.round(o.net) };
        st.toggleItemPaid(ep, 3000, st.cyclePilotage); st.comptes.find(c => c.id === 1).solde = 6000; st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 300));
        return res; }, ST);
    v('  → l\'épargne « Urgence » versée (3 000 sortis du Courant) : brut et net inchangés, ✓ 3 000 versés', versee.brut === 24500 && versee.ep === 5500 && versee.versee === 3000 && versee.net === 19000, JSON.stringify(versee));

    /* ══ C. LE CHOIX FORCÉ, COMPTE PAR COMPTE ═════════════════════════════ */
    console.log('  ── la case « Fonctionnement », compte par compte');
    await page.evaluate((ST) => { const st = eval(ST); st.appMode = 'previsionnel'; st.activeTab = 'parametres'; st.anneeAffichage = 2026; }, ST);
    await page.waitForTimeout(500);
    const cases = async () => page.$$eval('[data-fonctionnement]', els => els.map(e => [e.dataset.compte, e.checked, (e.closest('label').textContent || '').includes('(auto)')]));
    let C = await cases();
    v('Architecture des comptes : une case par compte, cochée pour Courant et Assafa, « (auto) »',
      C.length === 5 && C.every(([id, coche, auto]) => coche === (id === '1' || id === '2') && auto), JSON.stringify(C));
    await page.click('[data-fonctionnement][data-compte="2"]'); await page.waitForTimeout(400);
    const decoche = await page.evaluate((ST) => { const st = eval(ST); return { f: st.comptes.find(c => c.id === 2).fonctionnement, F: [...st.comptesFonctionnement].sort() }; }, ST);
    s26 = await lire(page, 2026);
    v('décocher Assafa : enregistré sur le compte (fonctionnement = false)', decoche.f === false && JSON.stringify(decoche.F) === '["cpt_1"]', JSON.stringify(decoche));
    v('  → novembre : ses charges fixes sortent du brut ; les 9 000 + 1 000 qui l\'alimentent deviennent de l\'épargne',
      egal(s26[11], 25300, 15500, 9800), JSON.stringify(s26[11]));
    v('  → « ↺ auto » proposé', await page.isVisible('[data-fonctionnement-auto]'));
    await page.click('[data-fonctionnement-auto]'); await page.waitForTimeout(400);
    const auto = await page.evaluate((ST) => { const st = eval(ST); return { a: 'fonctionnement' in st.comptes.find(c => c.id === 2), F: [...st.comptesFonctionnement].sort() }; }, ST);
    s26 = await lire(page, 2026);
    v('  → « ↺ auto » : retour à la déduction, novembre redevient 16 300 / 5 500 / 10 800', !auto.a && JSON.stringify(auto.F) === '["cpt_1","cpt_2"]' && egal(s26[11], 16300, 5500, 10800), JSON.stringify({ auto, nov: s26[11] }));
    await page.click('[data-fonctionnement][data-compte="3"]'); await page.waitForTimeout(400);
    s26 = await lire(page, 2026);
    v('cocher les Dépenses annuels : la Vidange entre dans le brut, LT → DA (4 000) devient une reprise',
      egal(s26[11], 13300, -500, 13800), JSON.stringify(s26[11]));
    await page.evaluate((ST) => { const st = eval(ST); st.showSurplusTooltip = true; }, ST); await page.waitForTimeout(300);
    const signe = await page.$eval('[data-surplus-epargne][data-mois="11"]', e => e.textContent.replace(/\s+/g, ''));
    v('  → une épargne négative s\'affiche « + » (une reprise ajoute au net)', /^\+500DH/.test(signe), signe);
    await page.evaluate((ST) => { const st = eval(ST); st.showSurplusTooltip = false; st.remettreFonctionnementAuto(3); }, ST); await page.waitForTimeout(300);

    /* ══ D. LA BULLE, LA MÉTÉO, LE BILAN, LE CFO ══════════════════════════ */
    console.log('  ── la bulle dit le périmètre ; la Météo, le Bilan et le CFO suivent la même règle');
    await page.evaluate((ST) => { const st = eval(ST); st.activeTab = 'dashboard'; st.showSurplusTooltip = true; }, ST); await page.waitForTimeout(400);
    const bulle = (await page.textContent('[data-surplus-perimetre]')).replace(/\s+/g, ' ');
    v('la bulle « Surplus détaillé » nomme les comptes : Courant + Assafa, et l\'épargne vers les autres',
      bulle.includes('Compte Courant + Compte Principale ASSAFA') && bulle.includes('Dépenses annuels') && bulle.includes('Épargne LT'), bulle);
    await page.evaluate((ST) => { eval(ST).showSurplusTooltip = false; }, ST);
    const R = await page.evaluate((ST) => { const st = eval(ST); const r11 = st.respirationDuMois(2026, 11), r12 = st.respirationDuMois(2026, 12);
        const seg = (r) => Object.fromEntries(r.segments.map(s => [s.cle, Math.round(s.montant)]));
        return { m11: Math.round(r11.marge), m12: Math.round(r12.marge), s11: seg(r11), hors11: r11.horsPerimetreSorties, res12: Math.round(r12.ressources),
                 bilanHors: (st.bilanAnnee || {}).moy && st.bilanAnnee.moy.horsPerimetre }; }, ST);
    v('Météo / Bilan : la marge de novembre = le surplus net (10 800), celle de décembre aussi (16 800)', R.m11 === 10800 && R.m12 === 16800, JSON.stringify(R));
    v('  → leur épargne n\'inclut plus « Compte Principale ASSAFA » (5 500)', R.s11.epargne === 5500, JSON.stringify(R.s11));
    v('  → la Vidange payée par les Dépenses annuels est mise à part (3 000), pas comptée deux fois', R.hors11 === 3000 && R.s11.exceptionnel === 700, JSON.stringify(R));
    v('  → le Bilan le dit : « Non compté ci-dessus … payées par vos comptes d\'épargne »', R.bilanHors === 250 && await page.isVisible('[data-bilan-hors-perimetre]'), JSON.stringify(R.bilanHors));

    //  Le CFO (serveur PHP) : même net, au dirham
    const tmpJson = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'surplus-php-')), 'fd.json');
    fs.writeFileSync(tmpJson, JSON.stringify(FX));
    const php = essai(() => execFileSync('php', ['-r', `require '${path.join(RACINE, 'cfo_intent_engine.php').replace(/'/g, "\\'")}'; $fd = json_decode(file_get_contents('${tmpJson}')); cfo_sanitize_finance_data($fd); echo json_encode(array_column(cfo_compute_monthly_net_courant($fd, 2026), 'net', 'mois'));`], { encoding: 'utf8' }));
    const netPhp = php ? JSON.parse(php) : null;
    v('le CFO (serveur PHP) : même net qu\'à l\'écran — novembre 10 800, décembre 16 800', !!netPhp && netPhp[11] === 10800 && netPhp[12] === 16800, String(php));
    v('aucune erreur JavaScript', erreurs.length === 0, erreurs.slice(0, 2).join(' | '));
} catch (e) {
    v('scène complète sans exception', false, String(e && e.stack || e).slice(0, 600));
} finally {
    await browser.close();
    srv.close();
}
fin();
