/*  v37.146 — TROIS NIVEAUX DE TNR, CHOISIS SELON L'IMPACT DU CHANGEMENT.
    run_tests.sh dépose la liste COMPLÈTE des suites ; ce script la réduit selon les fichiers changés depuis origin/main
    (+ non commités), puis réécrit la liste. Appel : node choisir_suites.mjs <liste> <niveau> (auto | 1 | 2 | 3).

      Niveau 1 · CIBLÉ   — les suites qui touchent ce qui a changé : une suite modifiée ; une suite qui nomme un fichier
                           changé (cfo_veille_lib.php, sante_samsung.js…) ; pour index.html / sante/index.html, une suite qui
                           nomme un identifiant des lignes changées (data-…, une fonction, un calcul) ; + un socle rapide.
      Niveau 2 · DOMAINE — toutes les suites des domaines touchés (Finance, Santé, Veille), comme le périmètre v37.110.
      Niveau 3 · COMPLET — tout.

    Choix automatique :
      - un fichier du NOYAU commun (lanceurs de test, caches, paquets, installation, lanceur Mes applis, sauvegarde) → 3 ;
      - sinon, domaine par domaine : un fichier « cœur » du domaine (moteur, stockage, intégrité, données de test) ou un gros
        changement de son écran → 2 pour ce domaine ; sinon → 1 ;
      - un domaine que RIEN ne touche n'est pas testé (« si je ne change rien sur Santé, ne teste pas Santé »).
      - rien de changé (ou git absent) → 3.
    Le niveau 1 est une sélection par indices : avant de publier, le niveau 2 au moins (bash run_tests.sh 2). */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const [fichier, demande = 'auto'] = process.argv.slice(2);
const git = (args) => { try { return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 }); } catch { return null; } };
const lignes = fs.readFileSync(fichier, 'utf8').split('\n').filter(Boolean);
const suites = lignes.map(l => { const t = l.indexOf('\t'), cmd = l.slice(t + 1).split('\x1f').filter(Boolean).join(' ');
    const m = cmd.match(/test_cfo_engine_parity\/[\w.-]+\.(?:mjs|php)/); return { l, desc: l.slice(0, t), cmd, fichier: m ? m[0] : null }; });
const domaineDe = (s) => /^Santé Master/.test(s.desc) ? 'sante' : (/test_veille/.test(s.cmd) ? 'veille' : (/^(Mes applis|Sauvegarde hors du VPS)/.test(s.desc) ? 'commun' : 'finance'));

const base = process.env.BASE_TESTS || (git(['merge-base', 'HEAD', 'origin/main']) || '').trim();
const changes = [...new Set([...(base ? (git(['diff', '--name-only', base]) || '').split('\n') : []), ...(git(['diff', '--name-only', 'HEAD']) || '').split('\n'),
                             ...(git(['ls-files', '--others', '--exclude-standard']) || '').split('\n')].map(x => x.trim()).filter(Boolean))];
const NOYAU = /^(run_tests\.sh|run_parallel\.mjs|choisir_suites\.mjs|test_cfo_engine_parity\/(tw_cache|ocr_cache)\.mjs|package(-lock)?\.json|install\.sh|apps\.json|Caddyfile.*|lanceur\.js|sauvegarde\.php|test_cfo_engine_parity\/(test_lanceur\.mjs|test_sauvegarde\.php|test_choisir_suites\.mjs))$/;
const COEUR = {
    finance: /^(cfo_intent_engine\.php|save_data\.php|cfo_integrity\.php|tools_schema\.php|cfo_relais\.php|test_cfo_engine_parity\/(fixture\.json|cases\.json|run_js\.mjs|run_php\.php|compare\.py|ref_js\.mjs))$/,
    sante: /^sante\/(sante_lib\.php|sante_integrity\.php|sante_store\.php|save_sante\.php|sante_calculs\.js|sante_intent_engine\.php)$/,
    veille: /^$/,   // la veille est petite : son niveau 2 et son niveau 1 se valent presque
};
const domaineFichier = (f) => {
    if (NOYAU.test(f)) return 'noyau';
    if (/\.md$/.test(f) || /^fix_version_\d+\.mjs$/.test(f) || /^migrations\//.test(f)) return 'doc';
    if (/^sante\//.test(f) || /test_sante/.test(f)) return 'sante';
    if (/^(cfo_veille_|veille_|install_veille\.sh)/.test(f) || /test_veille/.test(f)) return 'veille';
    return 'finance';
};
const parDomaine = { finance: [], sante: [], veille: [], noyau: [], doc: [] };
changes.forEach(f => parDomaine[domaineFichier(f)].push(f));
const nbLignes = (f) => { const t = (base ? git(['diff', '--numstat', base, '--', f]) : '') || git(['diff', '--numstat', 'HEAD', '--', f]) || ''; return t.split('\n').filter(Boolean).reduce((a, l) => { const [x, y] = l.split('\t'); return a + (Number(x) || 0) + (Number(y) || 0); }, 0); };

//  les identifiants des lignes changées d'un écran : attributs data-…, et noms déclarés dans le fichier que ces lignes citent
function identifiants(f) {
    const diff = ((base ? git(['diff', '-U0', base, '--', f]) : '') || '') + (git(['diff', '-U0', 'HEAD', '--', f]) || '');
    const changees = diff.split('\n').filter(l => /^[+-](?![+-])/.test(l)).map(l => l.slice(1));
    let texte = ''; try { texte = fs.readFileSync(f, 'utf8'); } catch { }
    const declares = new Set([...texte.matchAll(/(?:const|let|function)\s+([A-Za-z_$][\w$]{5,})\s*[=(]/g)].map(m => m[1]));
    const ids = new Set();
    changees.forEach(l => {
        for (const m of l.matchAll(/data-[a-z0-9]+(?:-[a-z0-9]+)*/g)) ids.add(m[0]);
        for (const m of l.matchAll(/[A-Za-z_$][\w$]{5,}/g)) if (declares.has(m[0])) ids.add(m[0]);
    });
    return [...ids];
}
const SOCLE = {   // rapides et larges : le moteur, l'atterrissage, le Relevé, le cycle
    finance: /test_cfo_engine_parity\/(test_une_seule_verite|test_releve_cycle|test_mois_budgetaire|test_cycle_realise|test_resolution|test_integrite)\./,
    sante: /test_cfo_engine_parity\/test_sante_calculs\./,
    veille: /test_cfo_engine_parity\/test_veille_presse\.php/,
};

let niveau = { auto: null, 1: 1, cible: 1, 2: 2, domaine: 2, perimetre: 2, 3: 3, complet: 3 }[demande];
const raisons = [];
if (niveau === undefined) { console.error('Niveau inconnu : ' + demande + ' (auto, 1, 2 ou 3)'); process.exit(2); }
if (niveau === null) {
    if (!changes.length) { niveau = 3; raisons.push('rien de changé (ou git absent) : tout est rejoué'); }
    else if (parDomaine.noyau.length) { niveau = 3; raisons.push('noyau commun touché (' + parDomaine.noyau.slice(0, 3).join(', ') + ')'); }
}
let garder;
if (niveau === 3) garder = new Set(suites);
else {
    garder = new Set();
    for (const dom of ['finance', 'sante', 'veille']) {
        const fs_ = parDomaine[dom];
        if (!fs_.length) { if (niveau === null || niveau <= 2) raisons.push(dom + ' : rien de changé → non testé'); continue; }
        const ecran = dom === 'sante' ? 'sante/index.html' : (dom === 'finance' ? 'index.html' : null);
        const nEcran = ecran && fs_.includes(ecran) ? nbLignes(ecran) : 0;
        let n = niveau;
        if (n === null) {
            const coeur = fs_.filter(f => COEUR[dom].test(f));
            if (coeur.length) { n = 2; raisons.push(dom + ' : niveau 2 — fichier cœur touché (' + coeur.slice(0, 3).join(', ') + ')'); }
            else if (nEcran > (dom === 'sante' ? 300 : 400)) { n = 2; raisons.push(dom + ' : niveau 2 — gros changement de l\'écran (' + nEcran + ' lignes)'); }
            else n = 1;
        }
        const duDomaine = suites.filter(s => domaineDe(s) === dom);
        if (n === 2) { duDomaine.forEach(s => garder.add(s)); if (niveau !== null) raisons.push(dom + ' : niveau 2 demandé'); continue; }
        //  niveau 1 : ciblé
        const ids = ecran && fs_.includes(ecran) ? identifiants(ecran) : [];
        const noms = fs_.map(f => f.split('/').pop()).filter(x => !/^index\.html$/.test(x));
        //  un fichier CHARGÉ PAR L'ÉCRAN (sante_samsung.js dans sante/index.html…) : les suites qui ouvrent cet écran le testent aussi
        let ecranTexte = ''; try { ecranTexte = ecran ? fs.readFileSync(ecran, 'utf8') : ''; } catch { }
        const chargesParEcran = noms.filter(nm => ecranTexte.includes(nm));
        const ouvreEcran = (t) => dom === 'sante' ? /['"`/]sante\/(?:['"`]|index\.html)|\/sante\//.test(t) : /index\.html/.test(t);
        const choisies = duDomaine.filter(s => {
            if (!s.fichier) return false;
            if (fs_.includes(s.fichier) || SOCLE[dom].test(s.fichier)) return true;
            let t = ''; try { t = fs.readFileSync(s.fichier, 'utf8'); } catch { return true; }
            return noms.some(nm => t.includes(nm)) || ids.some(id => t.includes(id)) || (chargesParEcran.length > 0 && ouvreEcran(t));
        });
        if (chargesParEcran.length) raisons.push(dom + ' : ' + chargesParEcran.join(', ') + ' est chargé par l\'écran → les suites qui ouvrent l\'écran sont rejouées');
        choisies.forEach(s => garder.add(s));
        raisons.push(dom + ' : niveau 1 — ' + choisies.length + ' suite(s) sur ' + duDomaine.length + ' (fichiers et identifiants touchés' + (ids.length ? ' : ' + ids.slice(0, 6).join(', ') + (ids.length > 6 ? '…' : '') : '') + ' + socle)');
    }
    //  les suites communes : seulement si le noyau est touché (niveau 3) — jamais pour un changement d'un seul domaine
}
const niveauAffiche = niveau || Math.max(...raisons.map(r => (r.match(/niveau (\d)/) || [0, 1])[1]).map(Number), 1);
fs.writeFileSync(fichier, suites.filter(s => garder.has(s)).map(s => s.l).join('\n') + (garder.size ? '\n' : ''));
console.log('▸ TNR niveau ' + (niveau === 3 ? '3 (complet)' : niveauAffiche === 2 ? '2 (domaine)' : '1 (ciblé)') + ' : ' + garder.size + ' suite(s) sur ' + suites.length
    + (demande === 'auto' ? ' — choisi automatiquement (« bash run_tests.sh 1 | 2 | 3 » pour forcer)' : ''));
raisons.forEach(r => console.log('    · ' + r));
if (niveau !== 3 && niveauAffiche === 1) console.log('    ⚠️ niveau 1 = sélection par indices : avant de publier, au moins « bash run_tests.sh 2 »');
