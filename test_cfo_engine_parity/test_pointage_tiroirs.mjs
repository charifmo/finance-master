/**
 * v37.34 — UN FLUX POINTÉ N'EST PLUS PROJETÉ · LA CHECKLIST EN TIROIRS.
 *
 *   1. « La prime exceptionnelle de 23 781 DH, une fois cochée, apparaît à
 *      47 562 DH dans le Relevé. » La case enregistrait le montant SIGNÉ
 *      (− 23 781) ; le moteur, en valeur absolue, lisait « pas réglée, reste
 *      23 781 − (− 23 781) ». Un pointage se lit désormais en montant.
 *   2. « Une entrée d'argent s'affiche − 23 781 DH. » Elle s'affiche + 23 781, en vert.
 *   3. « Un parchemin où tout est mélangé. » Un tiroir par nature, seulement le
 *      reste à faire ; ce qui est pointé part dans « Déjà validé ».
 *
 *   Tous les montants attendus sont calculés À LA MAIN depuis le décor ci-dessous.
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
console.log('\n  UN FLUX POINTÉ N\'EST PLUS PROJETÉ · LA CHECKLIST EN TIROIRS\n  ' + '─'.repeat(80));

/* ── A. Statique ─────────────────────────────────────────────────────── */
v('plus de liste en doublon sous la file (« Vue détaillée par catégorie », 2e « Entrées d\'Argent »)',
  !/Vue détaillée par catégorie<\/?/.test(html.replace(/"[^"\n]*Vue détaillée par catégorie[^"\n]*"/g, '')) && !/uiOuvert\('pilotage\.entrees'/.test(html));
v('l\'ancienne checklist du téléphone affiche aussi une entrée en « + »',
  /Number\(dep\.montant\) < 0 \? '\+ ' \+ formatMAD\(-Number\(dep\.montant\)\)/.test(html));

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
    const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'twpointage-'));
    fs.writeFileSync(path.join(tmp, 'in.css'), '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
    fs.writeFileSync(path.join(tmp, 'cfg.js'), 'module.exports={content:[' + JSON.stringify(path.join(RACINE, 'index.html')) + '],theme:{extend:{}}};');
    execFileSync(twBin, ['-c', path.join(tmp, 'cfg.js'), '-i', path.join(tmp, 'in.css'), '-o', path.join(tmp, 'out.css'), '--minify'], { stdio: 'ignore' });
    const css = fs.readFileSync(path.join(tmp, 'out.css'), 'utf8');
    return css.length > 10000 ? css : null;
});

/* ── B. Le décor : mercredi 14 oct. 2026, paie le 8 → cycle du 8 oct. au 7 nov.
   Rang du jour = 6 ; « sous 7 j » = rangs 6 à 13.
     Assafa  :  1 000 · + LOYER APPART 4 000 (j.12, rang 4 : en retard)
                      · + PRIME exceptionnelle 23 781 (j.10, rang 2 : en retard)   → 28 781
     Courant :  2 000 · − LOYER 6 000 (j.20, rang 12) − Réserve 500 (j.25, rang 17)
                      − TOIT 5 000 (j.18, rang 10) − ASSURANCE 1 200 (j.5, rang 28) → − 10 700
     Livret  : 50 000 · + Réserve 500                                              → 50 500
     CRÉDIT STUDIO (3 000) : suspendu en novembre (exception à 0).
     NOTAIRE (+ 12 000 sur Assafa) : cycle de DÉCEMBRE (12 j.3). */
const JDP = 8;
const SC = { maintenant: new Date(2026, 9, 14, 10, 0, 0), mois: 11, an: 2026 };
const fixture = (sc) => {
    const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8'));
    const base = fx.donneesAnnuelles[Object.keys(fx.donneesAnnuelles)[0]];
    fx.donneesAnnuelles = {};
    for (const an of [sc.an - 1, sc.an, sc.an + 1]) fx.donneesAnnuelles[an] = JSON.parse(JSON.stringify(base));
    Object.assign(fx.soldesInitiaux, { moisActuel: sc.mois, anneeActuelle: sc.an, jourDePaie: JDP,
        compteChargesFixes: 'courant', compteChargesVariables: 'courant', assurances_tracker: [], voyageDebut: '', voyageFin: '' });
    fx.comptes = [
        { id: 1, label: 'Compte Courant', type: 'courant', solde: 2000, icone: '💳' },
        { id: 2, label: 'Compte Assafa', type: 'epargne', solde: 1000, icone: '🏛️' },
        { id: 3, label: 'Livret Réserve', type: 'epargne', solde: 50000, icone: '🏦' },
    ];
    const neutre = { paye: false, montantPaye: 0, exceptions: [], showExceptions: false };
    for (const an of Object.keys(fx.donneesAnnuelles)) {
        const d = fx.donneesAnnuelles[an];
        const Rv = (label, b, j, dest) => ({ ...neutre, label, base: b, jourPrevu: j, destinationCompte: dest || 'courant' });
        d.revenus = { salaire: Rv('SALAIRE', 0, JDP), bonif: Rv('—', 0), magasin: Rv('—', 0), cnss: Rv('—', 0),
                      appart: Rv('LOYER APPART', 4000, 12, 'cpt_2'), studio: Rv('—', 0) };
        const Fx = (label, valeur, j, exceptions = []) => ({ ...neutre, label, valeur, jourPrevu: j, exceptions });
        d.chargesFixes = { creditImmo: Fx('LOYER', 6000, 20), creditStudio: Fx('CRÉDIT STUDIO', 3000, 15, [{ moisDebut: 11, moisFin: 11, nouvelleValeur: 0 }]),
                           syndic: Fx('—', 0), nounou: Fx('—', 0), ecole: Fx('—', 0),
                           femmeMenage: Fx('—', 0), habitsCharif: Fx('—', 0), habitsBebe: Fx('—', 0), jouets: Fx('—', 0) };
        const V = (label, valeur, periode) => ({ ...neutre, label, valeur, periode, details: [], showDetails: false });
        d.chargesVariables = {
            alimentation: V('COURSES', 0, 'semaine'), sorties: V('SORTIES', 0, 'semaine'), voiture: V('—', 0, 'semaine'), sante: V('—', 0, 'semaine'),
            factures: { ...V('FACTURES', 0, 'mois'), categorieId: 'cat_cv_factures' },
        };
        d.epargne = [{ ...neutre, id: 21, nom: 'Réserve', valeur: 500, sourceCompte: 'courant', linkedAccountId: 'cpt_3', jourPrevu: 25 }];
        d.depensesIrregulieres = Number(an) !== sc.an ? [] : [
            { id: 701, mois: 10, annee: sc.an, nom: 'PRIME exceptionnelle', montant: -23781, sourceCompte: 'cpt_2', jourPrevu: 10 },
            { id: 702, mois: 10, annee: sc.an, nom: 'TOIT', montant: 5000, sourceCompte: 'courant', jourPrevu: 18 },
            { id: 703, mois: 11, annee: sc.an, nom: 'ASSURANCE', montant: 1200, sourceCompte: 'courant', jourPrevu: 5 },
            { id: 704, mois: 12, annee: sc.an, nom: 'NOTAIRE', montant: -12000, sourceCompte: 'cpt_2', jourPrevu: 3 },
        ];
        d.virementsInternes = []; d.transactionsReelles = []; d.consoRealiseeT0 = {};
    }
    return fx;
};
let fxCourant = null;
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
    if (p === '/finance/finance_data.json') return s(200, JSON.stringify(fxCourant));
    return s(200, '{"status":"ok"}');
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port;
const browser = await pw.chromium.launch({ executablePath: chromium, args: ['--no-sandbox'] });
const ST = 'document.querySelector("#app").__vue_app__._instance.setupState';
const pret = (page) => page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState.moisBudgetaire; }, null, { timeout: 30000 });
const auPilotage = async (page) => { await page.evaluate(async (ST) => { const st = eval(ST); st.appMode = 'reel'; await new Promise(r => setTimeout(r, 250)); st.activeTab = 'pilotage'; }, ST); await page.waitForTimeout(500); };
const ouvrir = async (sc, opts = { viewport: { width: 1400, height: 1100 } }) => {
    fxCourant = fixture(sc);
    const page = await browser.newPage(opts);
    await page.clock.setFixedTime(sc.maintenant);
    const erreurs = []; page.on('pageerror', e => erreurs.push(String(e)));
    page.on('dialog', d => d.accept());
    await page.goto(`http://127.0.0.1:${port}/finance/`, { waitUntil: 'load' });
    await pret(page); await page.waitForTimeout(600);
    await auPilotage(page);
    return { page, erreurs };
};
const nf = (n) => new Intl.NumberFormat('fr-FR').format(n).replace(/\s/g, '');
const sansEsp = (t) => String(t || '').replace(/\s/g, '');
const attendre = (page, ms = 300) => page.waitForTimeout(ms);

//  Le moteur (atterrissage du cycle, radar jusqu'en décembre) et l'état de la prime
const moteur = (page) => page.evaluate((ST) => {
    const st = eval(ST);
    const a = Object.fromEntries(st.atterrissageCycle.comptes.map(c => [c.key, c.atterrissage]));
    const lignesAssafa = (st.atterrissageCycle.comptes.find(c => c.key === 'cpt_2') || { lignes: [] }).lignes.map(l => [l.libelle, l.montant]);
    const j = st._buildJournalReleve ? null : null;
    const prime = st.donneesAnnuelles[2026].depensesIrregulieres.find(d => d.id === 701);
    return { a, lignesAssafa, irr: Math.round(st.resteAPayerIrregulier), urgence: st.kpiUrgence.montant,
             radarAssafa: (st.radarComptes.comptes.find(c => c.key === 'cpt_2') || {}).fin,
             entreesAnnee: Math.round((st.statsFluxAnnee || {}).totalEntrees),
             prime: JSON.stringify(prime.trackerRealise || {}) };
}, ST);
//  Ce que montre la file : tiroirs (ouverts ?, en-têtes, lignes), déjà validé
const file = (page) => page.evaluate(() => {
    const inbox = document.querySelector('#pilotage-inbox');
    const t = (el, s) => (el && el.querySelector(s) ? el.querySelector(s).textContent.replace(/\s+/g, ' ').trim() : null);
    const tiroirs = [...inbox.querySelectorAll('[data-tiroir]')].map(d => ({
        cle: d.dataset.tiroir, ouvert: d.open, titre: t(d, '[data-tiroir-titre]'), nb: t(d, '[data-tiroir-nb]'),
        retard: t(d, '[data-tiroir-retard]'), proche: t(d, '[data-tiroir-proche]'),
        payer: t(d, '[data-tiroir-payer]'), encaisser: t(d, '[data-tiroir-encaisser]'),
        lignes: [...d.querySelectorAll('[data-tache], [data-entree]')].map(r => ({
            nom: t(r, '[data-tache-nom]'), nature: r.dataset.natureLigne, entree: r.hasAttribute('data-entree'), tache: r.hasAttribute('data-tache'),
            badge: t(r, '[data-entree-badge]'), montant: t(r, '[data-entree-montant]'),
            vert: /\btext-emerald-300\b/.test((r.querySelector('[data-entree-montant]') || {}).className || ''),
            visible: !!r.closest('details[open]') && r.getBoundingClientRect().height > 0 })),
    }));
    const dv = inbox.querySelector('[data-deja-valide]');
    return {
        tiroirs, compteur: t(inbox, '[data-pointage-compteur]'), suspendus: t(inbox, '[data-suspendus]'),
        valide: dv ? { ouvert: dv.open, titre: t(dv, '[data-deja-valide-titre]'),
                       lignes: [...dv.querySelectorAll('[data-valide]')].map(r => ({ nom: t(r, '[data-valide-nom]'), badge: t(r, '[data-badge-nature]'),
                           barre: getComputedStyle(r.querySelector('[data-valide-nom]')).textDecorationLine, montant: t(r, '[data-valide-montant]'),
                           vert: /\btext-emerald-400\b/.test((r.querySelector('[data-valide-montant]') || {}).className || '') })) } : null,
        vueDetaillee: [...document.querySelectorAll('summary')].some(s => /Vue détaillée par catégorie/.test(s.textContent)),
        entreesArgent: [...document.querySelectorAll('summary')].filter(s => /Entrées d'Argent/.test(s.textContent)).length,
    };
});
const T = (f, cle) => f.tiroirs.find(x => x.cle === cle) || { lignes: [] };
const ligne = (f, cle, nom) => T(f, cle).lignes.find(l => l.nom === nom) || {};
const cocher = async (page, tiroir, nom) => {
    const sel = `#pilotage-inbox [data-tiroir="${tiroir}"]`;
    const ouvert = await page.evaluate((s) => document.querySelector(s)?.open, sel);
    if (!ouvert) { await page.click(sel + ' > summary'); await attendre(page, 200); }
    await page.locator(sel + ' [data-tache], ' + sel + ' [data-entree]').filter({ hasText: nom }).locator('input[type=checkbox]').click();
    await attendre(page, 650);   // la ligne sort en glissant (0,28 s)
};
const decocher = async (page, nom) => {
    const sel = '#pilotage-inbox [data-deja-valide]';
    if (!(await page.evaluate((s) => document.querySelector(s)?.open, sel))) { await page.click(sel + ' > summary'); await attendre(page, 200); }
    await page.locator(sel + ' [data-valide]').filter({ hasText: nom }).locator('input[type=checkbox]').click();
    await attendre(page, 650);
};
const solde = (page, k, x) => page.evaluate(async ({ ST, k, x }) => { const st = eval(ST); st.comptes.find(c => c.id === k).solde = x; st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 300)); }, { ST, k, x });

try {
    const { page, erreurs } = await ouvrir(SC);
    /* ══ C. LE DÉCOR, AVANT TOUT POINTAGE ═══════════════════════════════ */
    let m = await moteur(page);
    v('C. avant pointage : Assafa 28 781, Courant − 10 700, Livret 50 500 (calcul à la main)',
      m.a.cpt_2 === 28781 && m.a.cpt_1 === -10700 && m.a.cpt_3 === 50500, JSON.stringify(m.a));
    v('  → l\'Urgence ne compte que ce qui se DÉCAISSE (LOYER 6 000 + TOIT 5 000), pas la prime',
      m.urgence === 11000, String(m.urgence));

    /* ══ D. LA PRIME POINTÉE PAR LA v37.33 (montant signé) : plus de double ══ */
    await page.evaluate(async (ST) => { const st = eval(ST);
        const p = st.donneesAnnuelles[2026].depensesIrregulieres.find(d => d.id === 701);
        p.trackerRealise = { '2026-10': { paye: true, montantPaye: -23781, dateReelle: '2026-10-12' } };   // ce qu'écrivait la case
        st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 200)); }, ST);
    await solde(page, 2, 24781);                // la banque l'a reçue : 1 000 + 23 781
    m = await moteur(page);
    v('D. prime pointée (− 23 781, format v37.33) et reçue : Assafa finit à 28 781, pas 76 343',
      m.a.cpt_2 === 28781, JSON.stringify([m.a.cpt_2, m.lignesAssafa]));
    v('  → le Relevé d\'Assafa ne projette plus la prime (ni 23 781, ni 47 562)',
      !m.lignesAssafa.some(([l]) => /PRIME/.test(l)), JSON.stringify(m.lignesAssafa));
    v('  → les chocs restants du cycle : TOIT + ASSURANCE = 6 200, la prime n\'y est plus', m.irr === 6200, String(m.irr));
    let f = await file(page);
    v('  → la checklist la montre « Déjà validé » (+ 23 781), plus dans le tiroir ⚡',
      !T(f, 'exceptionnel').lignes.some(l => l.nom === 'PRIME exceptionnelle') && !!f.valide && f.valide.lignes.some(l => l.nom === 'PRIME exceptionnelle' && sansEsp(l.montant) === '+' + nf(23781) + 'DH'),
      JSON.stringify([T(f, 'exceptionnel').lignes.map(l => l.nom), f.valide]));

    /* ══ E. POINTÉE DANS LA NOUVELLE CHECKLIST : un montant positif ═══════ */
    await page.evaluate(async (ST) => { const st = eval(ST);
        st.donneesAnnuelles[2026].depensesIrregulieres.find(d => d.id === 701).trackerRealise = {};
        st.forceUpdateCalculations(); await new Promise(r => setTimeout(r, 200)); }, ST);
    await solde(page, 2, 1000);
    f = await file(page);
    const pr = ligne(f, 'exceptionnel', 'PRIME exceptionnelle');
    v('E. la prime est une ENTRÉE du tiroir ⚡ : « 💚 Entrée », « + 23 781 DH » en vert',
      pr.entree && !pr.tache && pr.badge === '💚 Entrée' && sansEsp(pr.montant) === '+' + nf(23781) + 'DH' && pr.vert, JSON.stringify(pr));
    v('  → l\'en-tête du tiroir ⚡ : + 23 781 à encaisser, 6 200 à payer',
      sansEsp(T(f, 'exceptionnel').encaisser) === '+' + nf(23781) + 'DH' && sansEsp(T(f, 'exceptionnel').payer) === nf(6200) + 'DH', JSON.stringify(T(f, 'exceptionnel')));
    await cocher(page, 'exceptionnel', 'PRIME exceptionnelle');
    m = await moteur(page);
    v('  → cocher enregistre un montant POSITIF (23 781), plus le signe', /"paye":true/.test(m.prime) && /"montantPaye":23781[,}]/.test(m.prime), m.prime);
    await solde(page, 2, 24781);
    m = await moteur(page);
    v('  → reçue : Assafa 28 781 — la prime compte UNE fois', m.a.cpt_2 === 28781, String(m.a.cpt_2));
    f = await file(page);
    const pv = (f.valide && f.valide.lignes.find(l => l.nom === 'PRIME exceptionnelle')) || {};
    v('  → elle quitte le tiroir et passe dans « Déjà validé » : barrée, « + 23 781 DH » en vert',
      !T(f, 'exceptionnel').lignes.some(l => l.nom === 'PRIME exceptionnelle') && pv.barre === 'line-through' && sansEsp(pv.montant) === '+' + nf(23781) + 'DH' && pv.vert,
      JSON.stringify([T(f, 'exceptionnel').lignes.map(l => l.nom), pv]));

    /* ══ F. REÇUE EN PARTIE : le reste, une fois ═══════════════════════════ */
    await decocher(page, 'PRIME exceptionnelle');
    f = await file(page);
    v('F. décocher dans « Déjà validé » la remet dans le tiroir ⚡', T(f, 'exceptionnel').lignes.some(l => l.nom === 'PRIME exceptionnelle'), JSON.stringify(T(f, 'exceptionnel').lignes));
    await page.locator('#pilotage-inbox [data-tiroir="exceptionnel"] [data-entree]').filter({ hasText: 'PRIME' }).locator('input[type=number]').fill('10000');
    await attendre(page, 300);
    await solde(page, 2, 11000);
    m = await moteur(page);
    v('  → 10 000 reçus sur 23 781 : il reste 13 781 à venir, Assafa finit à 28 781', m.a.cpt_2 === 28781 && /"montantPaye":10000/.test(m.prime), JSON.stringify([m.a.cpt_2, m.prime]));
    v('  → les chocs restants (signés) : 6 200 − 13 781 = − 7 581', m.irr === -7581, String(m.irr));

    /* ══ G. REÇUE EN AVANCE : le NOTAIRE de décembre, pointé en octobre ═══ */
    m = await moteur(page);
    const radarAvant = m.radarAssafa, entreesAvant = m.entreesAnnee;
    await page.evaluate(async (ST) => { const st = eval(ST);
        const n = st.donneesAnnuelles[2026].depensesIrregulieres.find(d => d.id === 704);
        st.toggleItemPaid(n, n.montant); await new Promise(r => setTimeout(r, 200)); }, ST);   // l'écran du Calendrier passe le montant SIGNÉ
    await solde(page, 2, 11000 + 12000);
    m = await moteur(page);
    v(`G. le NOTAIRE de décembre, reçu en avance : la fin d'année d'Assafa ne bouge pas (${nf(radarAvant)})`,
      Number.isFinite(radarAvant) && m.radarAssafa === radarAvant, JSON.stringify([radarAvant, m.radarAssafa]));
    const notaire = await page.evaluate((ST) => JSON.stringify(eval(ST).donneesAnnuelles[2026].depensesIrregulieres.find(d => d.id === 704).trackerRealise), ST);
    v('  → cochée avec son montant signé (− 12 000), elle s\'enregistre en positif (12 000)', /"paye":true/.test(notaire) && /"montantPaye":12000[,}]/.test(notaire), notaire);
    v('  → et les entrées restantes de l\'année (tableau de flux) perdent ses 12 000 : déjà encaissés',
      Number.isFinite(entreesAvant) && entreesAvant - m.entreesAnnee === 12000, JSON.stringify([entreesAvant, m.entreesAnnee]));

    /* ══ H. UNE DÉPENSE : rien ne change pour elle ═════════════════════ */
    await cocher(page, 'exceptionnel', 'TOIT');
    await solde(page, 1, 2000 - 5000);
    m = await moteur(page);
    v('H. le TOIT payé (5 000) et pointé : le courant finit toujours à − 10 700', m.a.cpt_1 === -10700, String(m.a.cpt_1));

    /* ══ I. LES TIROIRS ════════════════════════════════════════════════ */
    //  Écran neuf : aucune préférence d'interface ; le banc recharge le décor d'origine,
    //  on y repointe le NOTAIRE (reçu en avance) et le TOIT, sans toucher aux tiroirs.
    await page.evaluate(() => { localStorage.removeItem('finance_ui_v1'); });
    await page.reload({ waitUntil: 'load' }); await pret(page); await page.waitForTimeout(600); await auPilotage(page);
    await page.evaluate(async (ST) => { const st = eval(ST); const deps = st.donneesAnnuelles[2026].depensesIrregulieres;
        [704, 702].forEach(id => { const d = deps.find(x => x.id === id); st.toggleItemPaid(d, d.montant); });
        await new Promise(r => setTimeout(r, 650)); }, ST);
    f = await file(page);
    v('I. un tiroir par nature présente, dans l\'ordre : Entrées, Fixes, Épargne, Exceptionnels',
      JSON.stringify(f.tiroirs.map(x => x.cle)) === '["entrees","fixe","epargne","exceptionnel"]'
      && f.tiroirs[0].titre === "🟢 Entrées d'Argent" && f.tiroirs[3].titre === '⚡ Flux exceptionnels', JSON.stringify(f.tiroirs.map(x => [x.cle, x.titre])));
    v('  → tous fermés d\'office : l\'écran tient en quelques en-têtes', f.tiroirs.every(x => !x.ouvert) && f.tiroirs.every(x => x.lignes.every(l => !l.visible)), JSON.stringify(f.tiroirs.map(x => x.ouvert)));
    v('  → chaque en-tête dit combien, l\'urgence et le montant',
      T(f, 'entrees').nb === '1 à encaisser' && T(f, 'entrees').retard === '⚠️ 1 en retard' && sansEsp(T(f, 'entrees').encaisser) === '+' + nf(4000) + 'DH'
      && T(f, 'fixe').nb === '1 à traiter' && T(f, 'fixe').proche === '⏳ 1 sous 7 j' && sansEsp(T(f, 'fixe').payer) === nf(6000) + 'DH'
      && T(f, 'epargne').retard === null && T(f, 'epargne').proche === null && sansEsp(T(f, 'epargne').payer) === nf(500) + 'DH',
      JSON.stringify(f.tiroirs.map(({ lignes, ...x }) => x)));
    v('  → chaque ligne vit dans le tiroir de sa nature ; seulement ce qui reste à faire',
      f.tiroirs.every(x => x.lignes.every(l => x.cle === 'entrees' ? (l.entree && l.nature === 'revenu') : l.nature === x.cle))
      && JSON.stringify(T(f, 'exceptionnel').lignes.map(l => l.nom)) === '["PRIME exceptionnelle","ASSURANCE"]', JSON.stringify(f.tiroirs.map(x => [x.cle, x.lignes.map(l => l.nom)])));
    v('  → le suspendu du mois est dit en une ligne (CRÉDIT STUDIO), pas en case grisée',
      f.suspendus === '⏸️ Suspendu ce mois : CRÉDIT STUDIO' && !f.tiroirs.some(x => x.lignes.some(l => l.nom === 'CRÉDIT STUDIO')), String(f.suspendus));
    v('  → « Déjà validé » en bas, replié : le TOIT (le NOTAIRE est du cycle de décembre)', !!f.valide && !f.valide.ouvert && f.valide.titre === '✅ Déjà validé (1)'
      && JSON.stringify(f.valide.lignes.map(l => l.nom)) === '["TOIT"]', JSON.stringify(f.valide));
    v('  → plus de doublon : ni « Vue détaillée par catégorie », ni second « Entrées d\'Argent »', !f.vueDetaillee && f.entreesArgent === 1, JSON.stringify([f.vueDetaillee, f.entreesArgent]));
    //  Pointer le LOYER : le tiroir Fixes se vide et disparaît, la ligne part dans « Déjà validé »
    const avantLoyer = f.compteur;
    await cocher(page, 'fixe', 'LOYER');
    f = await file(page);
    const lv = (f.valide.lignes.find(l => l.nom === 'LOYER') || {});
    v('  → pointer le LOYER : le tiroir Fixes, vide, disparaît ; « 🏢 Fixe · LOYER » barré dans « Déjà validé »',
      !f.tiroirs.some(x => x.cle === 'fixe') && lv.badge === '🏢 Fixe' && lv.barre === 'line-through' && sansEsp(lv.montant) === nf(6000) + 'DH' && !lv.vert,
      JSON.stringify([f.tiroirs.map(x => x.cle), lv]));
    v(`  → le compteur suit : ${avantLoyer} → ${f.compteur}`, avantLoyer === '1 / 6 faits' && f.compteur === '2 / 6 faits', JSON.stringify([avantLoyer, f.compteur]));
    await decocher(page, 'LOYER');
    f = await file(page);
    v('  → le décocher le remet dans son tiroir', T(f, 'fixe').lignes.some(l => l.nom === 'LOYER') && f.compteur === '1 / 6 faits', JSON.stringify([f.tiroirs.map(x => x.cle), f.compteur]));

    /* ══ J. LA MÉMOIRE ET L'URGENCE ═══════════════════════════════════ */
    const donneesAvant = await page.evaluate((ST) => JSON.stringify(eval(ST).donneesAnnuelles), ST);
    await page.click('#pilotage-inbox [data-tiroir="epargne"] > summary'); await attendre(page, 200);
    const stocke = await page.evaluate(() => JSON.parse(localStorage.getItem('finance_ui_v1') || '{}'));
    const donneesApres = await page.evaluate((ST) => JSON.stringify(eval(ST).donneesAnnuelles), ST);
    v('J. ouvrir le tiroir Épargne : retenu dans le localStorage, pas dans les données',
      stocke['pilotage.tiroir.epargne'] === true && donneesAvant === donneesApres, JSON.stringify(stocke));
    await page.reload({ waitUntil: 'load' }); await pret(page); await page.waitForTimeout(600); await auPilotage(page);
    f = await file(page);
    v('  → après rechargement : Épargne et Fixes (ouverts à la main) restent ouverts, les autres fermés',
      T(f, 'epargne').ouvert && T(f, 'fixe').ouvert && !T(f, 'entrees').ouvert && !T(f, 'exceptionnel').ouvert, JSON.stringify(f.tiroirs.map(x => [x.cle, x.ouvert])));
    await page.click('[data-kpi="urgence"]'); await attendre(page, 500);
    f = await file(page);
    v('  → la carte « Urgence » ouvre les tiroirs qui portent l\'urgent (Entrées, Fixes, ⚡)',
      T(f, 'entrees').ouvert && T(f, 'fixe').ouvert && T(f, 'exceptionnel').ouvert && T(f, 'entrees').lignes.every(l => l.visible), JSON.stringify(f.tiroirs.map(x => [x.cle, x.ouvert])));
    v('aucune erreur JavaScript (bureau)', erreurs.length === 0, erreurs[0] || '');
    await page.close();

    /* ══ K. TÉLÉPHONE ════════════════════════════════════════════════════ */
    if (twCss) {
        const mo = await ouvrir(SC, { viewport: { width: 384, height: 832 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
        await mo.page.click('[data-kpi="urgence"]'); await attendre(mo.page, 500);
        const mob = await mo.page.evaluate(() => ({
            debord: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            lignes: [...document.querySelectorAll('#pilotage-inbox [data-tache], #pilotage-inbox [data-entree]')].filter(r => r.getBoundingClientRect().height > 0)
                .map(r => { const b = r.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.right)]; }),
            w: window.innerWidth }));
        v('K. téléphone : tiroirs ouverts, chaque ligne tient dans l\'écran, aucun débordement',
          mob.debord <= 0 && mob.lignes.length >= 3 && mob.lignes.every(([g, d]) => g >= 0 && d <= mob.w), JSON.stringify(mob));
        v('  → aucune erreur JavaScript (téléphone)', mo.erreurs.length === 0, mo.erreurs[0] || '');
        await mo.page.close();
    } else console.log('  ⏭️  téléphone non mesuré (Tailwind absent)');
} catch (err) {
    v('exécution sans exception', false, String(err && err.stack || err).slice(0, 400));
} finally {
    await browser.close(); srv.close();
}
console.log('  ' + '─'.repeat(80));
console.log(ko === 0 ? '  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
