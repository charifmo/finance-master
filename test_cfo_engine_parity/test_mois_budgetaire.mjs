/**
 * v37.14 — MOIS BUDGÉTAIRE ≠ MOIS CIVIL.
 *
 *   La règle métier : une paie touchée le 27 septembre finance octobre. Le
 *   cycle « 27 sep → 26 oct » est donc le budget du MOIS 10, et une exception
 *   réglée sur M9 ne doit pas s'y appliquer.
 *
 *   MESURÉ AVANT CORRECTION, et c'est ce qui a orienté le chantier :
 *     - Pilotage RÉALISÉ : déjà juste. Un revenu porteur d'une exception M9
 *       rendait bien 4 000 DH sur le cycle d'octobre. Rien à corriger.
 *     - Pilotage THÉORIQUE : appliquait les exceptions aux SEULES charges
 *       fixes. Revenus, charges variables et épargne passaient en brut.
 *     - surplusBudgetaireAnnuel : « valeur × 12 », exceptions jamais lues —
 *       et ce surplus alimente tout le simulateur.
 *
 *   Cette suite fixe les trois surfaces sur la même règle, et vérifie qu'une
 *   exception posée sur le mois BUDGÉTAIRE s'applique, pendant que la même
 *   exception posée sur le mois CIVIL du début de cycle ne s'applique pas.
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
const v = (t, ok, d = '') => { if (!ok) ko++; console.log(`  ${ok ? '✅' : '❌'} ${t.padEnd(62)} ${ok ? '' : d}`); };

console.log('\n  MOIS BUDGÉTAIRE — UNE PAIE DU 27 FINANCE LE MOIS SUIVANT\n  ' + '─'.repeat(78));

const require = createRequire(import.meta.url);
const essai = (f) => { try { return f(); } catch { return null; } };
const pw = essai(() => require('playwright-core'));
const vueJs = essai(() => require.resolve('vue/dist/vue.global.js'));
const chartJs = essai(() => fs.existsSync(path.join(RACINE, 'node_modules/chart.js/dist/chart.umd.js'))
                           && path.join(RACINE, 'node_modules/chart.js/dist/chart.umd.js'));
const chromium = process.env.CHROMIUM || ['/opt/pw-browsers/chromium']
    .find(p => essai(() => fs.existsSync(p) && fs.statSync(p).isFile()));
if (!pw || !vueJs || !chartJs || !chromium) {
    console.log('  ⏭️  ignoré (playwright-core, vue, chart.js ou Chromium absent)');
    console.log('  ✅ TOUT PASSE — 0 contrôle(s) en échec');
    process.exit(0);
}

/* Le jeu de données est construit AUTOUR de la date du jour : le jour de paie
   est posé à hier, pour que le cycle en cours soit « hier → mois suivant » et
   que mois civil de début ≠ mois budgétaire. C'est le cas du ticket. */
const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8'));
const maintenant = new Date();
const Y = maintenant.getFullYear();
const MOIS_CIVIL = maintenant.getMonth() + 1;
const MOIS_BUDGET = MOIS_CIVIL === 12 ? 1 : MOIS_CIVIL + 1;
const jourDePaie = Math.max(1, maintenant.getDate() - 1);   // paie déjà passée → cycle du mois suivant

const base = fx.donneesAnnuelles[Object.keys(fx.donneesAnnuelles)[0]];
fx.donneesAnnuelles = { [Y]: JSON.parse(JSON.stringify(base)), [Y + 1]: JSON.parse(JSON.stringify(base)) };
fx.soldesInitiaux.moisActuel = MOIS_CIVIL;
fx.soldesInitiaux.anneeActuelle = Y;
fx.soldesInitiaux.jourDePaie = jourDePaie;

const dA = fx.donneesAnnuelles[Y];
const exc = (m) => [{ id: 1, moisDebut: m, moisFin: m, nouvelleValeur: 0 }];
//  Une paire par famille : l'un suspendu sur le mois CIVIL (ne doit rien faire),
//  l'autre sur le mois BUDGÉTAIRE (doit passer à zéro).
dA.revenus.appartCivil  = { label: 'Appart civil',  base: 4000, destinationCompte: 'courant', exceptions: exc(MOIS_CIVIL) };
dA.revenus.appartBudget = { label: 'Appart budget', base: 4000, destinationCompte: 'courant', exceptions: exc(MOIS_BUDGET) };
dA.chargesFixes.fixeCivil  = { label: 'Fixe civil',  valeur: 1500, jourPrevu: 5, exceptions: exc(MOIS_CIVIL) };
dA.chargesFixes.fixeBudget = { label: 'Fixe budget', valeur: 1500, jourPrevu: 6, exceptions: exc(MOIS_BUDGET) };
dA.chargesVariables.varCivil  = { label: 'Var civil',  valeur: 800, periode: 'mois', jourPrevu: 7,
    details: [{ id: 901, nom: 'detail civil', montant: 800 }], exceptions: exc(MOIS_CIVIL) };
dA.chargesVariables.varBudget = { label: 'Var budget', valeur: 800, periode: 'mois', jourPrevu: 8,
    details: [{ id: 902, nom: 'detail budget', montant: 800 }], exceptions: exc(MOIS_BUDGET) };
dA.epargne = [
    { id: 801, nom: 'Ep civil',  valeur: 700, sourceCompte: 'courant', jourPrevu: 9,  exceptions: exc(MOIS_CIVIL) },
    { id: 802, nom: 'Ep budget', valeur: 700, sourceCompte: 'courant', jourPrevu: 10, exceptions: exc(MOIS_BUDGET) },
];

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
    if (p === '/finance/finance_data.json') return s(200, JSON.stringify(fx));
    return s(200, '{"status":"ok"}');
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port;
const browser = await pw.chromium.launch({ executablePath: chromium, args: ['--no-sandbox'] });

try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    const erreurs = []; page.on('pageerror', e => erreurs.push(String(e)));
    page.on('dialog', d => d.accept());
    await page.goto(`http://127.0.0.1:${port}/finance/`, { waitUntil: 'load' });
    await page.waitForFunction(() => {
        const a = document.querySelector('#app');
        const s = a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState;
        return s && s.moisBudgetaire;
    }, null, { timeout: 30000 });
    await page.waitForTimeout(900);

    const lire = await page.evaluate((ctx) => {
        const st = document.querySelector('#app').__vue_app__._instance.setupState;
        const Y = ctx.Y;
        const d = st.donneesAnnuelles[Y];
        const theo = st.pilotageTheoLignes;
        const nom = (arr, n) => (arr || []).find(x => x.nom === n);
        const tache = (lib) => (st.tachesPilotage || []).find(t => t.libelle === lib);
        return {
            moisBudgetaire: st.moisBudgetaire.mois,
            cycle: st.pilotageCycleLabel,
            // ── Les deux getters centraux
            revCivil:  st.getDueRevenu(d.revenus.appartCivil, Y),
            revBudget: st.getDueRevenu(d.revenus.appartBudget, Y),
            fixeCivil:  st.getDueFixe(d.chargesFixes.fixeCivil, Y),
            fixeBudget: st.getDueFixe(d.chargesFixes.fixeBudget, Y),
            // ── Pilotage THÉORIQUE
            theoRevCivil:  !!nom(theo.revenus, 'Appart civil'),
            theoRevBudget: !!nom(theo.revenus, 'Appart budget'),
            theoFixeCivil:  !!nom(theo.fixes, 'Fixe civil'),
            theoFixeBudget: !!nom(theo.fixes, 'Fixe budget'),
            theoVarCivil:  !!nom(theo.variables, 'detail civil'),
            theoVarBudget: !!nom(theo.variables, 'detail budget'),
            theoEpCivil:  !!nom(theo.epargne, 'Ep civil'),
            theoEpBudget: !!nom(theo.epargne, 'Ep budget'),
            // ── Checklist du Pilotage RÉALISÉ
            listeFixeCivil:  !!tache('Fixe civil'),
            listeFixeBudget: !!tache('Fixe budget'),
            listeVarCivil:  !!tache('detail civil'),
            listeVarBudget: !!tache('detail budget'),
            listeEpCivil:  !!tache('Ep civil'),
            listeEpBudget: !!tache('Ep budget'),
            // ── Surplus annuel (moteur du simulateur) : un item suspendu UN mois
            //    doit peser 11 mois, pas 12.
            surplus: st.surplusBudgetaireAnnuel(Y),
        };
    }, { Y });

    v(`le cycle est identifié comme le budget du mois ${MOIS_BUDGET}`,
      lire.moisBudgetaire === MOIS_BUDGET, JSON.stringify({ attendu: MOIS_BUDGET, obtenu: lire.moisBudgetaire, cycle: lire.cycle }));

    console.log(`  ── mois civil de début : ${MOIS_CIVIL} · mois budgétaire : ${MOIS_BUDGET} · cycle : ${lire.cycle}`);

    /* ── Les getters centraux (déjà justes avant ce chantier) ─────────── */
    v('exception sur le mois CIVIL → le revenu reste dû', lire.revCivil === 4000, String(lire.revCivil));
    v('exception sur le mois BUDGÉTAIRE → le revenu tombe à 0', lire.revBudget === 0, String(lire.revBudget));
    v('  → même règle pour une charge fixe',
      lire.fixeCivil === 1500 && lire.fixeBudget === 0, JSON.stringify([lire.fixeCivil, lire.fixeBudget]));

    /* ── Pilotage THÉORIQUE : c'est ici que ça n'allait pas ───────────── */
    v('Théorique · revenu : civil affiché, budgétaire masqué',
      lire.theoRevCivil === true && lire.theoRevBudget === false, JSON.stringify(lire));
    v('  → charge fixe : civil affichée, budgétaire masquée',
      lire.theoFixeCivil === true && lire.theoFixeBudget === false, JSON.stringify(lire));
    v('  → charge variable : civil affichée, budgétaire masquée',
      lire.theoVarCivil === true && lire.theoVarBudget === false, JSON.stringify(lire));
    v('  → épargne : civil affichée, budgétaire masquée',
      lire.theoEpCivil === true && lire.theoEpBudget === false, JSON.stringify(lire));

    /* ── Checklist du RÉALISÉ : la même vérité que le Théorique ───────── */
    v('Réalisé · charge fixe : civil à traiter, budgétaire absente',
      lire.listeFixeCivil === true && lire.listeFixeBudget === false, JSON.stringify(lire));
    v('  → charge variable : l\'exception de la catégorie suspend son détail',
      lire.listeVarCivil === true && lire.listeVarBudget === false, JSON.stringify(lire));
    v('  → épargne : civil à traiter, budgétaire absente',
      lire.listeEpCivil === true && lire.listeEpBudget === false, JSON.stringify(lire));

    /* ── Les deux écrans disent-ils la même chose ? ───────────────────── */
    v('Théorique et Réalisé s\'accordent, ligne à ligne',
      lire.theoFixeCivil === lire.listeFixeCivil && lire.theoFixeBudget === lire.listeFixeBudget
      && lire.theoVarCivil === lire.listeVarCivil && lire.theoVarBudget === lire.listeVarBudget
      && lire.theoEpCivil === lire.listeEpCivil && lire.theoEpBudget === lire.listeEpBudget,
      JSON.stringify(lire));

    /* ── Surplus annuel : un mois suspendu se voit dans le total ──────── */
    const surplusRef = await page.evaluate((Y) => {
        const st = document.querySelector('#app').__vue_app__._instance.setupState;
        const d = st.donneesAnnuelles[Y];
        const avant = st.surplusBudgetaireAnnuel(Y);
        // On retire l'exception : le revenu doit alors peser douze mois.
        const sauv = d.revenus.appartBudget.exceptions;
        d.revenus.appartBudget.exceptions = [];
        const apres = st.surplusBudgetaireAnnuel(Y);
        d.revenus.appartBudget.exceptions = sauv;
        return { avant, apres, delta: Math.round(apres - avant) };
    }, Y);
    v('surplus annuel : un revenu suspendu UN mois pèse onze mois, pas douze',
      surplusRef.delta === 4000, JSON.stringify(surplusRef));

    v('aucune erreur JavaScript', erreurs.length === 0, erreurs[0] || '');
    await page.close();
} finally {
    await browser.close();
    srv.close();
}

console.log('  ' + '─'.repeat(78));
console.log(ko ? `  ❌ ${ko} contrôle(s) en échec` : '  ✅ TOUT PASSE — 0 contrôle(s) en échec');
process.exit(ko ? 1 : 0);
