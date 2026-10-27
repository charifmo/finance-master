/**
 * v37.65 — LE CFO N8N COMPTE LES JOURS DU CYCLE, COMME L'APPLICATION.
 *   Le moteur inline du workflow n8n (« Tool: Intent Compiler ») convertissait encore une
 *   charge « / sem » avec un facteur figé : valeur × 4,3. L'application et le recalcul de
 *   secours du serveur (cfo_intent_engine.php) comptent, eux, les semaines du cycle de paie :
 *   jours du cycle ÷ 7, ligne par ligne (/sem ×N, /15 j ×N/2, /cycle ×1), exception du mois
 *   comprise. On exécute ici le code des nœuds TEL QU'IL EST DANS LE JSON, contre des valeurs
 *   calculées à la main (données fictives) :
 *     A. plus aucun « × 4,3 » dans un nœud Code · B. la durée des cycles (paie le 27)
 *     C. le coût d'une charge sur UN cycle · D. le net mensuel de secours, mois par mois
 *     E. le reliquat (mois moyen : 12 cycles ÷ 12) · F. le nœud entier, de l'appel au pending
 *     G. un Intent Compiler sans moteur inline délègue au serveur (même règle)
 *   Usage : node test_n8n_jours_cycle.mjs [workflow.json …]   (défaut : les deux workflows)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..');
let ko = 0;
const v = (t, ok, d = '') => { if (!ok) ko++; console.log(`  ${ok ? '✅' : '❌'} ${t.padEnd(70)} ${ok ? '' : d}`); };
const c2 = (x) => Math.round(x * 100) / 100;
console.log('\n  LE CFO N8N COMPTE LES JOURS DU CYCLE, COMME L\'APPLICATION\n  ' + '─'.repeat(86));

//  Un foyer FICTIF : un revenu de 10 000 DH, paie le 27, exercice 2026 vu depuis janvier
//  (aucun mois passé, janvier = mois courant avec un solde nul).
const foyer = (chargesVariables, si = {}) => ({
    soldesInitiaux: { jourDePaie: 27, anneeActuelle: 2026, moisActuel: 1, courant: 0, ...si },
    comptes: [],
    donneesAnnuelles: {
        2026: { revenus: { salaire: { label: 'Salaire fictif', base: 10000 } }, chargesFixes: {}, chargesVariables, epargne: [], depensesIrregulieres: [] },
        2028: { revenus: { salaire: { label: 'Salaire fictif', base: 10000 } }, chargesFixes: {}, chargesVariables, epargne: [], depensesIrregulieres: [] }
    }
});
const hebdo = (valeur, extra = {}) => ({ label: 'Courses fictives', valeur, periode: 'semaine', ...extra });
//  Rythmes mêlés sur une catégorie « / sem » : 700 /sem, 1 400 /15 j, 500 /cycle, 350 sans rythme (hérite : /sem)
const RYTHMES = { label: 'Marché fictif', valeur: 0, periode: 'semaine', details: [
    { label: 'Fruits', montant: 700, periode: 'semaine' }, { label: 'Gaz', montant: 1400, periode: 'quinzaine' },
    { label: 'Pressing', montant: 500, periode: 'cycle' }, { label: 'Pain', montant: 350 }] };

//  Jours de chaque cycle 2026, paie le 27, comptés au calendrier : le cycle de M court du
//  27 de M−1 au 26 de M (déc. 2025 → janv. 31 j ; janv. → févr. 31 ; févr. → mars 28 ; …).
const JOURS_2026 = [31, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30];

const WF = (process.argv.length > 2 ? process.argv.slice(2) : ['super_agent_cfo.json', 'super_agent_cfo_audio.json'].map(f => path.join(RACINE, f)))
    .map(f => [path.basename(f), JSON.parse(fs.readFileSync(f, 'utf8'))]);

for (const [f, w] of WF) {
    console.log('  · ' + f);
    const codes = w.nodes.filter(n => n.parameters && typeof n.parameters.jsCode === 'string');
    const fautifs = codes.filter(n => /\*\s*4[.,]3\b|\b4[.,]3\s*\*/.test(n.parameters.jsCode)).map(n => n.name);
    v('A. aucun nœud Code ne multiplie par 4,3', codes.length > 0 && !fautifs.length, fautifs.join(', ') || 'aucun nœud Code');

    const ic = w.nodes.find(n => n.name === 'Tool: Intent Compiler');
    const code = ic && ic.parameters.jsCode;
    if (!code) { v('Tool: Intent Compiler présent', false, 'nœud absent'); continue; }
    if (!/function computeMonthlyNetCourant\b/.test(code)) {
        v('G. pas de moteur inline : les calls partent à pending_commit.php (cfo_cout_variable_cycle)',
          /pending_commit\.php/.test(code) && /httpRequest\(/.test(code) && /\bcalls\b/.test(code) && !/periode\s*===\s*["']semaine["']/.test(code));
        continue;
    }

    //  Les fonctions de calcul, extraites du nœud et exécutées telles quelles
    const a = code.indexOf('const _CY = '), b = code.indexOf('const FUNCTION_CATALOG = {');
    if (a < 0 || b < a) { v('bloc de calcul repérable (const _CY … FUNCTION_CATALOG)', false, a + ' ' + b); continue; }
    const M = new Function(code.slice(a, b) + `
        return { computeReliquat, computeMonthlyNetCourant,
                 joursCycle: typeof joursCycle === 'function' ? joursCycle : null,
                 coutVariableCycle: typeof coutVariableCycle === 'function' ? coutVariableCycle : null };`)();

    {
        const j = M.joursCycle ? Array.from({ length: 12 }, (_, i) => M.joursCycle(i + 1, 2026, 27)) : null;
        v('B. cycles 2026 (paie le 27) : 31 31 28 31 30 31 30 31 31 30 31 30 jours',
          JSON.stringify(j) === JSON.stringify(JOURS_2026), JSON.stringify(j));
        v('  → mars 2028 (27 févr. → 26 mars, bissextile) : 29 jours ; janv. 2027 : 31',
          !!M.joursCycle && M.joursCycle(3, 2028, 27) === 29 && M.joursCycle(1, 2027, 27) === 31);
    }
    {
        const cvc = M.coutVariableCycle;
        const cout = (cv, m, an = 2026, exc = true) => cvc ? c2(cvc(cv, m, an, 27, exc)) : NaN;
        v('C. 1 000 /sem, cycle de 31 j (nov. 2026) → 4 428,57 (1 000 × 31 ÷ 7)', cout(hebdo(1000), 11) === 4428.57, String(cout(hebdo(1000), 11)));
        v('  → 28 j (mars 2026) → 4 000,00 · 30 j (déc.) → 4 285,71 · 29 j (mars 2028) → 4 142,86',
          cout(hebdo(1000), 3) === 4000 && cout(hebdo(1000), 12) === 4285.71 && cout(hebdo(1000), 3, 2028) === 4142.86,
          [cout(hebdo(1000), 3), cout(hebdo(1000), 12), cout(hebdo(1000), 3, 2028)].join(' '));
        v('  → 2 000 /mois : 2 000 quel que soit le cycle', cout({ valeur: 2000, periode: 'mois' }, 11) === 2000 && cout({ valeur: 2000, periode: 'mois' }, 3) === 2000);
        v('  → rythmes par ligne, nov. : 700×31/7 + 1 400×31/14 + 500 + 350×31/7 = 8 250', cout(RYTHMES, 11) === 8250, String(cout(RYTHMES, 11)));
        const mois = { valeur: 0, periode: 'mois', details: [{ montant: 1200 }, { montant: 70, periode: 'semaine' }] };
        v('  → catégorie /mois : ligne sans rythme ×1, ligne /sem ×N (nov. : 1 200 + 310 = 1 510)', cout(mois, 11) === 1510, String(cout(mois, 11)));
        const exc = hebdo(1000, { exceptions: [{ moisDebut: 11, moisFin: 11, nouvelleValeur: 1400 }] });
        v('  → exception de novembre (1 400 /sem) : 6 200 en nov., 4 285,71 en déc.', cout(exc, 11) === 6200 && cout(exc, 12) === 4285.71, cout(exc, 11) + ' ' + cout(exc, 12));
        v('  → sans exceptions (reliquat) : 4 428,57 en nov.', cout(exc, 11, 2026, false) === 4428.57, String(cout(exc, 11, 2026, false)));
        const excL = { valeur: 0, periode: 'semaine', details: [{ montant: 700, periode: 'semaine' }, { montant: 500, periode: 'cycle' }],
                       exceptions: [{ moisDebut: 12, moisFin: 12, nouvelleValeur: 2100 }] };
        v('  → l\'exception remplace les lignes (déc. : 2 100 × 30/7 = 9 000) ; nov. : 3 100 + 500', cout(excL, 12) === 9000 && cout(excL, 11) === 3600, cout(excL, 12) + ' ' + cout(excL, 11));
    }
    {
        const nets = (fd, an = 2026) => M.computeMonthlyNetCourant(fd, an).map(x => x.net);
        //  10 000 − 1 000 × jours ÷ 7, arrondi au dirham : 31 j → 5 571 · 30 j → 5 714 · 28 j → 6 000
        const ATTENDU = [5571, 5571, 6000, 5571, 5714, 5571, 5714, 5571, 5571, 5714, 5571, 5714];
        v('D. net mensuel de secours, 1 000 /sem : 5 571 (31 j) · 5 714 (30 j) · 6 000 (28 j)',
          JSON.stringify(nets(foyer({ courses: hebdo(1000) }))) === JSON.stringify(ATTENDU), JSON.stringify(nets(foyer({ courses: hebdo(1000) }))));
        const n = nets(foyer({ courses: hebdo(1000, { exceptions: [{ moisDebut: 11, moisFin: 11, nouvelleValeur: 1400 }] }), marche: RYTHMES }));
        //  déc. (30 j) : 10 000 − 4 285,71 − (3 000 + 3 000 + 500 + 1 500) = −2 285,71 → −2 286
        v('  → exception + rythmes, nov. : 10 000 − 6 200 − 8 250 = −4 450 ; déc. : −2 286',
          n[10] === -4450 && n[11] === -2286, JSON.stringify(n));
        const sansPaie = foyer({ courses: hebdo(1000) }); delete sansPaie.soldesInitiaux.jourDePaie;
        v('  → jour de paie absent : 27 par défaut (mêmes nets)', JSON.stringify(nets(sansPaie)) === JSON.stringify(ATTENDU), JSON.stringify(nets(sansPaie)));
    }
    {
        //  Un mois MOYEN : Σ des 12 cycles ÷ 12, sans exception. 700 /sem = 100 DH par jour.
        const rel = (cv, an, si) => M.computeReliquat(foyer({ courses: cv }, si), an);
        v('E. reliquat 2026, 700 /sem : 10 000 − 100 × 365 ÷ 12 = 6 958,33', rel(hebdo(700), 2026) === 6958.33, String(rel(hebdo(700), 2026)));
        v('  → 2028 (366 j) : 6 950,00 ; paie le 31 : toujours 366 j, 6 950,00',
          rel(hebdo(700), 2028) === 6950 && rel(hebdo(700), 2028, { jourDePaie: 31 }) === 6950, rel(hebdo(700), 2028) + ' ' + rel(hebdo(700), 2028, { jourDePaie: 31 }));
        v('  → l\'exception d\'un mois ne déplace pas le reliquat (6 958,33)',
          rel(hebdo(700, { exceptions: [{ moisDebut: 11, moisFin: 11, nouvelleValeur: 5000 }] }), 2026) === 6958.33);
        const r = M.computeReliquat(foyer({ marche: { ...RYTHMES, details: RYTHMES.details.slice(0, 3) } }), 2026);
        v('  → rythmes : 10 000 − (200 × 365 ÷ 12 + 500) = 3 416,67', r === 3416.67, String(r));
    }
    {
        //  Le nœud ENTIER : « épargne 100 % du net » sans net fourni par l'appli → recalcul de secours
        const Async = Object.getPrototypeOf(async function () {}).constructor;
        const envoye = [];
        const $ = (nom) => ({ first: () => ({ json: nom === 'Build Agent Input' ? { session_id: 'test_jours_cycle', finance_data_raw: foyer({ courses: hebdo(700) }) } : {} }) });
        const query = { calls: [{ function: 'set_recurring_savings', args: { name: 'Épargne fictive', percentage_of_reliquat: 100, year: 2026 } }] };
        let sortie = null, err = '';
        try {
            sortie = JSON.parse(await new Async('query', '$', code).call({ helpers: { httpRequest: async (r) => { envoye.push(r.body); return { status: 'ok' }; } } }, query, $));
        } catch (e) { err = e.message; }
        const op = envoye.length ? (envoye[0].operations || []).find(o => o.type === 'add_epargne') : null;
        const exc = op && Array.isArray(op.exceptions) ? op.exceptions.map(e => e.nouvelleValeur) : null;
        //  10 000 − 100 × jours du cycle
        const ATTENDU = JOURS_2026.map(j => 10000 - 100 * j);
        v('F. nœud complet : l\'épargne posée mois par mois = 10 000 − 100 × jours du cycle',
          !!sortie && sortie.pending_saved === true && JSON.stringify(exc) === JSON.stringify(ATTENDU), err || JSON.stringify(exc));
    }
}
console.log('  ' + '─'.repeat(86));
console.log(ko === 0 ? '  ✅ TOUT PASSE — 0 contrôle(s) en échec' : `  ❌ ${ko} contrôle(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
