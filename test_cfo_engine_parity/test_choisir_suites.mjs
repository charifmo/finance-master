/**
 * v37.146 — TROIS NIVEAUX DE TNR, CHOISIS SELON L'IMPACT DU CHANGEMENT (choisir_suites.mjs), sur un dépôt git jetable :
 * un changement de Santé seul ne teste pas Finance (et inversement) ; une petite modification de l'écran ne rejoue que les
 * suites qui nomment ce qui a changé (+ un socle) ; un fichier cœur → tout le domaine ; le noyau → tout ; la doc seule → rien.
 * v37.151 — léger · moyen · full : le moyen de la Finance n'est plus tout le domaine (léger + socle moyen) ; deux domaines avec un
 * changement de fond → full ; un identifiant que presque toutes les suites citent ne trie plus rien ; le changelog ne compte pas.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ICI = path.dirname(fileURLToPath(import.meta.url)), RACINE = path.resolve(ICI, '..');
let ko = 0, n = 0;
const v = (t, ok, d = '') => { n++; if (!ok) ko++; console.log(`  ${ok ? '✅' : '❌'} ${t.padEnd(96)} ${ok ? '' : String(d).slice(0, 500)}`); };
console.log('\n  TNR À TROIS NIVEAUX — selon l\'impact du changement\n  ' + '─'.repeat(96));

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'niveaux-'));
const g = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const ecrire = (f, t) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), t); };
fs.copyFileSync(path.join(RACINE, 'choisir_suites.mjs'), path.join(dir, 'choisir_suites.mjs'));
ecrire('index.html', '<div data-frise-cloturer></div>\n<p data-meteo-x></p>\n<p>PREUVE — test_frise.mjs : cité dans le changelog</p>\n<script>const basculerClotureConso = () => 1;\nconst autreCalculLong = () => 2;\nconst chargesCommunes = () => 0;</script>\n');
ecrire('sante/index.html', '<div data-sante-a></div>\n<script src="sante_samsung.js"></script>\n');
ecrire('sante/sante_samsung.js', 'x\n'); ecrire('sante/sante_lib.php', 'x\n'); ecrire('cfo_intent_engine.php', 'x\n'); ecrire('cfo_veille_lib.php', 'x\n');
ecrire('run_parallel.mjs', 'x\n'); ecrire('README.md', 'x\n');
const T = {
    frise: "page.click('[data-frise-cloturer]') chargesCommunes", meteo: "page.click('[data-meteo-x]') chargesCommunes", socle: 'rien chargesCommunes', calcul: 'eval(ST).autreCalculLong() chargesCommunes',
    samsung: "require('../sante/sante_samsung.js')", sante_appli: "page.goto(U) // U = http://127.0.0.1/sante/", sante_calculs: 'rien', veille: "require('../cfo_veille_lib.php')", lanceur: 'rien',
};
const fichiers = { frise: 'test_frise.mjs', meteo: 'test_meteo.mjs', socle: 'test_une_seule_verite.mjs', calcul: 'test_calcul.mjs', samsung: 'test_sante_samsung.mjs',
                   sante_appli: 'test_sante_appli.mjs', sante_calculs: 'test_sante_calculs.php', veille: 'test_veille_presse.php', lanceur: 'test_lanceur.mjs' };
Object.entries(fichiers).forEach(([k, f]) => ecrire('test_cfo_engine_parity/' + f, T[k] + '\n'));
const DESC = { frise: 'Frise', meteo: 'Météo', socle: 'Un seul atterrissage', calcul: 'Calcul', samsung: 'Santé Master : Samsung', sante_appli: 'Santé Master : appli',
               sante_calculs: 'Santé Master : calculs', veille: 'Revue de presse', lanceur: 'Mes applis : lanceur' };
const liste = () => Object.entries(fichiers).map(([k, f]) => DESC[k] + '\t' + (f.endsWith('.php') ? 'php' : 'node') + '\x1f' + 'test_cfo_engine_parity/' + f + '\x1f').join('\n') + '\n';
g('init', '-q'); g('config', 'user.email', 't@t'); g('config', 'user.name', 't'); g('add', '-A'); g('commit', '-qm', 'base');
const BASE = g('rev-parse', 'HEAD').trim();
const choisir = (niveau = 'auto') => {
    const L = path.join(os.tmpdir(), 'niveaux-liste-' + process.pid + '.txt'); fs.writeFileSync(L, liste());   // hors du dépôt, comme le mktemp du lanceur
    const sortie = execFileSync('node', ['choisir_suites.mjs', L, niveau], { cwd: dir, encoding: 'utf8', env: { ...process.env, BASE_TESTS: BASE } });
    return { gardees: fs.readFileSync(L, 'utf8').split('\n').filter(Boolean).map(l => l.split('\t')[0]).sort(), sortie };
};
const remettre = () => { g('checkout', '-q', '--', '.'); g('clean', '-qfd'); };

let r = choisir();
v('A. rien de changé : niveau 3, tout est rejoué', r.gardees.length === 9 && /niveau 3/.test(r.sortie), r.sortie);
ecrire('sante/sante_samsung.js', 'y\n'); r = choisir();
v('B. seul sante_samsung.js change : niveau 1 Santé — la suite qui le lit, celle qui ouvre l\'écran qui le charge, le socle ; AUCUNE suite Finance, Veille ni commune',
  JSON.stringify(r.gardees) === JSON.stringify(['Santé Master : Samsung', 'Santé Master : appli', 'Santé Master : calculs'].sort()) && /finance : rien de changé → non testé/.test(r.sortie), JSON.stringify(r));
remettre();
ecrire('index.html', '<div data-frise-cloturer class="x"></div>\n<p data-meteo-x></p>\n<script>const basculerClotureConso = () => 1;\nconst autreCalculLong = () => 2;\nconst chargesCommunes = () => 0;</script>\n'); r = choisir();
v('C. une ligne de l\'écran Finance (data-frise-cloturer) : niveau 1 — la suite qui nomme cet attribut + le socle ; ni la Météo, ni Santé',
  JSON.stringify(r.gardees) === JSON.stringify(['Frise', 'Un seul atterrissage']) && /santé|sante : rien de changé/.test(r.sortie), JSON.stringify(r));
remettre();
ecrire('index.html', '<div data-frise-cloturer></div>\n<p data-meteo-x></p>\n<script>const basculerClotureConso = () => 1;\nconst autreCalculLong = () => 3;\nconst chargesCommunes = () => 0;</script>\n'); r = choisir();
v('  → un calcul changé (autreCalculLong) : la suite qui l\'appelle est rejouée', r.gardees.includes('Calcul') && !r.gardees.includes('Météo'), JSON.stringify(r));
remettre();
ecrire('test_cfo_engine_parity/test_frise.mjs', T.frise + ' // modifié\n'); r = choisir();
v('  → une suite modifiée, citée seulement dans le TEXTE de l\'écran (changelog) : elle seule (+ socle), pas toutes les suites qui ouvrent l\'écran',
  JSON.stringify(r.gardees) === JSON.stringify(['Frise', 'Un seul atterrissage']), JSON.stringify(r));
remettre();
ecrire('index.html', Array.from({ length: 500 }, (_, i) => '<p>' + i + '</p>').join('\n')); r = choisir();
v('D. un gros changement de l\'écran Finance (500 lignes) : MOYEN — le socle moyen (Météo, Un seul atterrissage) + la Frise (son attribut disparaît), pas tout le domaine (ni Calcul), pas Santé', JSON.stringify(r.gardees) === JSON.stringify(['Frise', 'Météo', 'Un seul atterrissage']) && /moyen \(niveau 2\)/.test(r.sortie), JSON.stringify(r));
remettre();
ecrire('cfo_intent_engine.php', 'y\n'); r = choisir();
v('E. le moteur du CFO (fichier cœur Finance) : moyen Finance (socle moyen)', JSON.stringify(r.gardees) === JSON.stringify(['Météo', 'Un seul atterrissage']) && /fichier cœur/.test(r.sortie), JSON.stringify(r));
ecrire('sante/sante_lib.php', 'y\n'); r = choisir();
v('  → ET le cœur Santé (changement de fond dans deux domaines) : full, tout', r.gardees.length === 9 && /changement de fond dans finance et sante/.test(r.sortie), JSON.stringify(r));
remettre();
ecrire('sante/sante_lib.php', 'y\n'); r = choisir();
v('  → la bibliothèque Santé (cœur Santé) : niveau 2 Santé seulement', JSON.stringify(r.gardees) === JSON.stringify(['Santé Master : Samsung', 'Santé Master : appli', 'Santé Master : calculs'].sort()), JSON.stringify(r));
remettre();
ecrire('run_parallel.mjs', 'y\n'); r = choisir();
v('F. le lanceur des tests (noyau commun) : niveau 3, tout', r.gardees.length === 9 && /noyau commun/.test(r.sortie), JSON.stringify(r));
remettre();
ecrire('README.md', 'y\n'); r = choisir();
v('G. la documentation seule : aucune suite', r.gardees.length === 0, JSON.stringify(r));
remettre();
ecrire('cfo_veille_lib.php', 'y\n'); r = choisir();
v('H. la veille seule : ses suites, rien d\'autre', JSON.stringify(r.gardees) === JSON.stringify(['Revue de presse']), JSON.stringify(r));
ecrire('sante/sante_samsung.js', 'y\n'); r = choisir('2');
v('I. niveau 2 forcé (veille + Santé touchées) : tout Santé et toute la veille, pas Finance', JSON.stringify(r.gardees) === JSON.stringify(['Revue de presse', 'Santé Master : Samsung', 'Santé Master : appli', 'Santé Master : calculs'].sort()), JSON.stringify(r));
r = choisir('3');
v('  → niveau 3 forcé : tout', r.gardees.length === 9);
const al = [choisir('leger').gardees, choisir('1').gardees, choisir('moyen').gardees, choisir('2').gardees, choisir('full').gardees.length];
v('  → les noms léger / moyen / full valent 1 / 2 / 3', JSON.stringify(al[0]) === JSON.stringify(al[1]) && JSON.stringify(al[2]) === JSON.stringify(al[3]) && al[4] === 9, JSON.stringify(al));
remettre();
ecrire('index.html', '<div data-frise-cloturer></div>\n<p data-meteo-x></p>\n<p>PREUVE — test_frise.mjs : cité dans le changelog</p>\n<script>const basculerClotureConso = () => 1;\nconst autreCalculLong = () => 2;\nconst chargesCommunes = () => 1;</script>\n'); r = choisir();
v('J. une ligne qui touche un identifiant cité par TOUTES les suites (chargesCommunes) : il ne trie rien — léger = le socle seul, et c\'est dit',
  JSON.stringify(r.gardees) === JSON.stringify(['Un seul atterrissage']) && /trop courants pour trier, écartés : chargesCommunes/.test(r.sortie), JSON.stringify(r));
remettre();
ecrire('index.html', '<div data-frise-cloturer></div>\n<p data-meteo-x></p>\n<p>PREUVE — test_frise.mjs : cité dans le changelog</p>\n<script>const basculerClotureConso = () => 1;\nconst autreCalculLong = () => 2;\nconst chargesCommunes = () => 0;\n                    const CHANGELOG = [\n        "on parle de autreCalculLong et data-frise-cloturer",\n    ];</script>\n'); r = choisir();
v('K. une phrase ajoutée au CHANGELOG qui cite des identifiants : elle ne désigne rien à tester (léger = le socle)',
  JSON.stringify(r.gardees) === JSON.stringify(['Un seul atterrissage']), JSON.stringify(r));
remettre();
fs.rmSync(dir, { recursive: true, force: true });
console.log('  ' + '─'.repeat(96));
console.log(ko === 0 ? `  ✅ TOUT PASSE — ${n} contrôles` : `  ❌ ${ko} contrôle(s) en échec sur ${n}`);
process.exit(ko === 0 ? 0 : 1);
