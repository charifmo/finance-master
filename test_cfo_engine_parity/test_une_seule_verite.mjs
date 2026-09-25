/**
 * v37.8 — UN SEUL ATTERRISSAGE, partout, au dirham.
 *
 *   Régression vécue (25/09/2026, données réelles) : fin 2027, le bandeau
 *   affichait 157 020 DH, le Relevé de Comptes 241 020, le tableau pluriannuel
 *   257 074, et l'IA recevait une matrice issue d'un 4e calcul (Compte Courant
 *   −16 226 fin 2026 au lieu de +5 816). Quatre chiffres pour une seule réalité.
 *
 *   Causes : (1) un virement vers un compte à id texte (« acc_… ») sans préfixe
 *   ouvrait un registre fantôme, compté par le Relevé mais filtré du bandeau ;
 *   (2) la matrice IA et le bac à sable lisaient encore l'ancien moteur « bilan » ;
 *   (3) le bac à sable ajoutait les loyers une seconde fois.
 *
 *   Partie A (toujours) : contrôles statiques sur index.html + normaliseur de clé.
 *   Partie B (si Chromium + playwright-core + vue sont disponibles) : l'app est
 *   chargée avec un jeu de données synthétique qui reproduit le cas, et les quatre
 *   chiffres doivent être IDENTIQUES.
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..');
const html = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8').split('\r\n').join('\n');

let ko = 0;
const v = (titre, ok, detail = '') => {
    if (!ok) ko++;
    console.log(`  ${ok ? '✅' : '❌'} ${titre.padEnd(62)} ${ok ? '' : detail}`);
};
const corps = (debut, finMarqueur) => {
    const i = html.indexOf(debut); if (i < 0) return '';
    const j = html.indexOf(finMarqueur, i + debut.length); return j < 0 ? '' : html.slice(i, j);
};

console.log('\n  UN SEUL ATTERRISSAGE (bandeau = Relevé = IA = projection)\n  ' + '─'.repeat(74));

// ── A1. Le normaliseur de clé reconnaît les id texte ─────────────────────────
{
    const i = html.indexOf('const _cleCompte = ');
    const j = html.indexOf('};', i);
    v('normaliseur _cleCompte présent', i > 0 && j > i);
    const comptes = { value: [{ id: 'acc_x_cour' }, { id: 'acc_x_lt' }, { id: 1778756866808 }] };
    const _cleCompte = (i > 0 && j > i)
        ? new Function('comptes', html.slice(i, j + 2) + '\nreturn _cleCompte;')(comptes)
        : () => '(absent)';
    const C = 'cpt_acc_x_cour';
    const cas = [
        ['id texte sans préfixe → cpt_', 'acc_x_lt', 'cpt_acc_x_lt'],
        ['id numérique → cpt_', 1778756866808, 'cpt_1778756866808'],
        ['id numérique en texte → cpt_', '1778756866808', 'cpt_1778756866808'],
        ['clé déjà préfixée inchangée', 'cpt_acc_x_lt', 'cpt_acc_x_lt'],
        ['épargne virtuelle inchangée', 'ep_42', 'ep_42'],
        ["'courant' → compte courant physique", 'courant', C],
        ['vide → compte courant physique', '', C],
        ['id du compte courant sans préfixe → même clé', 'acc_x_cour', C],
    ];
    for (const [t, entree, attendu] of cas) {
        const r = _cleCompte(entree, C);
        v(t, r === attendu, `${JSON.stringify(entree)} → ${r} (attendu ${attendu})`);
    }
}

// ── A2. Plus aucun consommateur de l'ancien moteur pour les soldes projetés ──
{
    const matrice = corps('const obtenirEtatVisuelComplet = () => {', 'const _buildPayloadCFO = () => {');
    v('matrice IA : lit le moteur du Relevé', matrice.includes('_buildJournalReleve('));
    v('matrice IA : ne lit plus bilanLignes / detailsComptes',
      !/bilanLignes|detailsComptes/.test(matrice.replace(/\/\/.*$/gm, '')));
    v('objectifs IA : montant réel des comptes liés (wealthGoalsCalc)', matrice.includes('wealthGoalsCalc'));
    const payload = corps('const _buildPayloadCFO = () => {', 'const consulterCFO = async');
    v('JSON objectifs_epargne : wealthGoalsCalc', /objectifs_epargne = \(wealthGoalsCalc\.value/.test(payload));
    const sandbox = corps('const sandboxProjection = computed(() => {', 'const applySandbox = () => {');
    v('projection pluriannuelle : ancrée sur le Relevé', sandbox.includes('_buildJournalReleve('));
    const dcf = corps('const detailsComptesFinal = computed(() => {', '});');
    v("bandeau : aucun compte filtré sur le préfixe 'cpt_'", !dcf.includes("startsWith('cpt_')"));
    const nbNorm = (html.match(/\/\^\\d\+\$\/\.test\(/g) || []).length;
    v('un seul test « id numérique » (dans _cleCompte)', nbNorm === 1, `${nbNorm} occurrences`);
}

// ── B. Bout en bout dans un vrai navigateur (optionnel) ──────────────────────
const require = createRequire(import.meta.url);
const essai = (f) => { try { return f(); } catch { return null; } };
const pw = essai(() => require('playwright-core'));
const vueJs = essai(() => require.resolve('vue/dist/vue.global.js'));
const chromium = process.env.CHROMIUM || ['/opt/pw-browsers/chromium'].find(p => essai(() => fs.existsSync(p)));

if (!pw || !vueJs || !chromium) {
    console.log('  ⏭️  bout en bout ignoré (playwright-core, vue ou Chromium absent)');
} else {
    // Jeu de données synthétique : le cas exact du 25/09, en miniature.
    const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8'));
    const now = new Date(); const Y = now.getFullYear(); const M = now.getMonth() + 1;
    const base = fx.donneesAnnuelles[Object.keys(fx.donneesAnnuelles)[0]];
    fx.donneesAnnuelles = { [Y]: JSON.parse(JSON.stringify(base)), [Y + 1]: JSON.parse(JSON.stringify(base)) };
    fx.soldesInitiaux.moisActuel = M; fx.soldesInitiaux.anneeActuelle = Y;
    fx.comptes.push({ id: 'acc_test_lt', label: 'Épargne Long Terme', type: 'epargne', solde: 24760, inclureLiquidite: true });
    for (const a of [Y, Y + 1]) {
        const d = fx.donneesAnnuelles[a];
        d.epargne = [{ id: 991, nom: 'depenses annuels', label: 'depenses annuels', valeur: 7000,
                       linkedAccountId: 'acc_test_lt', sourceCompte: 'courant', exceptions: [] }];
        d.revenus = d.revenus || {};
        d.revenus.magasin = { label: 'Magasin', base: 7000, exceptions: [], destinationCompte: 'courant' };
    }
    fx.masterAssets = [{ id: 'ma_t', name: 'Local test', type: 'Commercial', isProductive: true, value: 900000,
                         valeur_actuelle: 900000, revenue: 84000, montant_credit: 0, quotePart: '100%' }];
    fx.wealthGoals = [{ id: 'wg_t', libelle: 'Réserve', montant_cible: 50000, montant_actuel: 17749,
                        comptesLies: ['cpt_acc_test_lt'] }];

    const page0 = html
        .replace('<script src="https://unpkg.com/vue@3/dist/vue.global.js"', '<script src="/vue.js"')
        .replace(/<script src="https:\/\/cdn\.tailwindcss\.com"[^>]*><\/script>/, '')
        .replace(/<script[^>]*src="https:\/\/[^"]*"[^>]*><\/script>/g, '')
        .replace('                    const consulterCFO = async (question) => {',
                 '                    window.__cfo = { _buildPayloadCFO };\n                    const consulterCFO = async (question) => {');
    const srv = http.createServer((req, res) => {
        const p = req.url.split('?')[0];
        const send = (code, body, type = 'application/json') => { res.writeHead(code, { 'Content-Type': type }); res.end(body); };
        if (p === '/finance/') return send(200, page0, 'text/html; charset=utf-8');
        if (p === '/vue.js') return send(200, fs.readFileSync(vueJs), 'text/javascript');
        if (p === '/finance/finance_data.json') return send(200, JSON.stringify(fx));
        return send(200, '{"status":"ok"}');
    });
    await new Promise(r => srv.listen(0, '127.0.0.1', r));
    const port = srv.address().port;
    const browser = await pw.chromium.launch({ executablePath: chromium, args: ['--no-sandbox'] });
    try {
        const page = await browser.newPage();
        const erreurs = []; page.on('pageerror', e => erreurs.push(String(e)));
        await page.goto(`http://127.0.0.1:${port}/finance/`, { waitUntil: 'load' });
        await page.waitForFunction(() => {
            const a = document.querySelector('#app'); const s = a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState;
            return s && s.comptes && s.comptes.some(c => c.id === 'acc_test_lt') && window.__cfo;
        }, null, { timeout: 30000 });
        const r = await page.evaluate(async (Y1) => {
            const S = document.querySelector('#app').__vue_app__._instance.setupState;
            S.anneeAffichage = Y1; await new Promise(z => setTimeout(z, 500));
            const sj = S.soldesProjetesJournal || {};
            const m = window.__cfo._buildPayloadCFO().matrice_cash_flow_calculee;
            const L = m.split('\n').find(l => l.includes('TOTAL DES COMPTES FIN'));
            const tot = L ? L.split(':').pop() : null;
            const ligne = (S.sandboxProjection || []).find(x => x.annee === Y1);
            return {
                cles: Object.keys(sj),
                releve: Math.round(Object.values(sj).reduce((a, b) => a + (Number(b) || 0), 0)),
                bandeau: Math.round(S.patrimoineProjeteGlobal),
                ia: tot ? Number(tot.replace(/[^\d]/g, '')) : null,
                iaFin: m.slice(-300),
                projection: ligne ? ligne.courant : null,
                loyersDansBudget: S.sandboxRevenusActifsDansBudget,
                objectif: (S.wealthGoalsCalc[0] || {}).montant_actuel,
            };
        }, Y + 1);
        v('aucun registre fantôme (clés cpt_/ep_ uniquement)', r.cles.every(k => /^(cpt_|ep_)/.test(k)), r.cles.join(', '));
        v('bandeau = Relevé', r.bandeau === r.releve, `${r.bandeau} ≠ ${r.releve}`);
        v('matrice IA (total) = Relevé', r.ia === r.releve, `${r.ia} ≠ ${r.releve} — ${JSON.stringify(r.iaFin)}`);
        v('projection pluriannuelle = Relevé', r.projection === r.releve, `${r.projection} ≠ ${r.releve}`);
        v('loyers au budget détectés (pas de double comptage)', r.loyersDansBudget === true);
        v('objectif lié = solde du compte, pas le montant déclaré', r.objectif === 24760, String(r.objectif));
        v('aucune erreur JavaScript', erreurs.length === 0, erreurs[0] || '');
    } finally {
        await browser.close(); srv.close();
    }
}

console.log(ko ? `\n  ❌ ${ko} contrôle(s) en échec` : '\n  ✅ TOUT PASSE — 0 contrôle(s) en échec');
process.exit(ko ? 1 : 0);
