/*  v37.95 — LES SUITES EN PARALLÈLE. run_tests.sh dépose la liste des suites (description, commande) ; ce lanceur
    les exécute par lots de JOBS (4 par défaut : une par cœur), les plus longues d'abord (durées de la dernière
    exécution, gardées hors du dépôt), et affiche les résultats DANS L'ORDRE de la liste. Une suite en échec ne
    coupe plus les autres : toutes tournent, et chaque échec est nommé à la fin avec sa sortie. Code de sortie 1
    au moindre échec. */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const [fichier, jobsArg] = process.argv.slice(2);
const JOBS = Math.max(1, Number(jobsArg) || os.cpus().length || 4);
const DUREES = path.join(os.tmpdir(), 'finance_master_durees_tests.json');
const lu = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return {}; } };
const durees = lu(DUREES);
const suites = fs.readFileSync(fichier, 'utf8').split('\n').filter(Boolean).map((l, i) => {
    const t = l.indexOf('\t');
    return { i, desc: l.slice(0, t), cmd: l.slice(t + 1).split('\x1f').filter(x => x !== '') };
});
const t0 = Date.now();
const fmt = (ms) => (ms / 1000).toFixed(1).replace('.', ',') + ' s';
const resultats = new Array(suites.length);
let prochainAffiche = 0;
const afficher = () => {
    while (prochainAffiche < suites.length && resultats[prochainAffiche]) {
        const r = resultats[prochainAffiche], s = suites[prochainAffiche];
        console.log(`▸ ${s.desc}  (${fmt(r.ms)})`);
        const lignes = r.sortie.replace(/\s+$/, '').split('\n');
        console.log(lignes.slice(r.code === 0 ? -2 : -25).join('\n'));
        if (r.code !== 0) console.log(`❌ ÉCHEC (${r.code}) : ${s.desc}`);
        prochainAffiche++;
    }
};
const lancer = (s) => new Promise((ok) => {
    const debut = Date.now();
    let sortie = '';
    const p = spawn(s.cmd[0], s.cmd.slice(1), { cwd: process.cwd(), env: process.env });
    const minuteur = setTimeout(() => { sortie += '\n⏱️  suite arrêtée : plus de 15 min'; p.kill('SIGKILL'); }, 15 * 60 * 1000);
    p.stdout.on('data', d => { sortie += d; }); p.stderr.on('data', d => { sortie += d; });
    p.on('error', e => { sortie += String(e); });
    p.on('close', (code) => { clearTimeout(minuteur); resultats[s.i] = { code: code === null ? 1 : code, sortie, ms: Date.now() - debut }; afficher(); ok(); });
});
//  les plus longues d'abord (inconnue = longue) : le dernier lot ne traîne pas une suite de 3 minutes seule
const file = suites.slice().sort((a, b) => (durees[b.desc] ?? 1e9) - (durees[a.desc] ?? 1e9));
const travailleur = async () => { while (file.length) await lancer(file.shift()); };
await Promise.all(Array.from({ length: Math.min(JOBS, suites.length) }, travailleur));
afficher();
const nouvelles = { ...durees }; suites.forEach(s => { nouvelles[s.desc] = resultats[s.i].ms; });
try { fs.writeFileSync(DUREES, JSON.stringify(nouvelles)); } catch { /* durées non gardées */ }
const echecs = suites.filter(s => resultats[s.i].code !== 0);
console.log(`\n⏱️  ${suites.length} suites en ${fmt(Date.now() - t0)} (${JOBS} en parallèle)`);
if (echecs.length) { console.log(`❌ ${echecs.length} suite(s) en échec : ${echecs.map(s => s.desc).join(' · ')}`); process.exit(1); }
console.log('✅ Toutes les suites passent.');
