/**
 * v37.109 — TAILWIND COMPILÉ UNE FOIS POUR TOUTES LES SUITES (accélère « bash run_tests.sh »).
 *
 *   34 suites compilaient chacune le CSS de l'appli (node_modules/.bin/tailwindcss sur index.html, plus d'1 Mo) : le même
 *   travail, refait à chaque suite et à chaque passe. twCompiler() se branche à la place de execFileSync(twBin, args, opts),
 *   avec les mêmes arguments (-c config -i entrée -o sortie --minify) et le même résultat (le fichier -o), mais garde le CSS
 *   produit dans le dossier temporaire, sous une clé = empreinte de la config, de l'entrée, de la version de Tailwind et de
 *   chaque fichier que la config nomme (index.html…). Un fichier de l'appli change : la clé change, on recompile. Plusieurs
 *   suites qui démarrent ensemble : une seule compile (verrou), les autres attendent son résultat.
 *   FM_TW_SANS_CACHE=1 : compile comme avant, sans rien garder.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const DOSSIER = path.join(os.tmpdir(), 'finance_master_tw_cache');
const attendre = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const lire = (f) => { try { return fs.readFileSync(f); } catch { return Buffer.from('∅' + f); } };

export function cleTailwind(twBin, args) {
    const val = (opt) => { const i = args.indexOf(opt); return i >= 0 ? args[i + 1] : null; };
    const h = crypto.createHash('sha1');
    const cfg = val('-c'), entree = val('-i');
    h.update(JSON.stringify(args.filter((a, i) => a.startsWith('-') && a !== '-o' && args[i - 1] !== '-o')));
    let version = '';
    try { version = fs.readFileSync(path.join(path.dirname(fs.realpathSync(twBin)), '..', 'package.json'), 'utf8'); } catch { version = twBin; }
    h.update(version);
    if (cfg) {
        const texte = lire(cfg);
        h.update(texte);
        //  chaque fichier que la config nomme (les chemins absolus entre guillemets) : son contenu fait partie de la clé
        for (const m of String(texte).matchAll(/"(\/[^"]+)"/g)) { h.update(m[1]); h.update(lire(m[1])); }
    }
    if (entree) h.update(lire(entree));
    return h.digest('hex');
}

export function twCompiler(twBin, args, opts) {
    const i = args.indexOf('-o'), sortie = i >= 0 ? args[i + 1] : null;
    if (!sortie || process.env.FM_TW_SANS_CACHE) return execFileSync(twBin, args, opts);
    fs.mkdirSync(DOSSIER, { recursive: true });
    const cle = cleTailwind(twBin, args), css = path.join(DOSSIER, cle + '.css'), verrou = path.join(DOSSIER, cle + '.lock');
    const copier = () => { fs.copyFileSync(css, sortie); return Buffer.alloc(0); };
    if (fs.existsSync(css)) return copier();
    let tenu = false;
    for (let t = 0; t < 1200 && !tenu; t++) {                       // 120 s au plus : un verrou plus vieux est abandonné
        try { fs.writeFileSync(verrou, String(process.pid), { flag: 'wx' }); tenu = true; }
        catch {
            if (fs.existsSync(css)) return copier();
            try { if (Date.now() - fs.statSync(verrou).mtimeMs > 120000) fs.rmSync(verrou, { force: true }); } catch { }
            attendre(100);
        }
    }
    try {
        if (fs.existsSync(css)) return copier();
        const r = execFileSync(twBin, args, opts);
        const tmp = css + '.' + process.pid + '.tmp';
        fs.copyFileSync(sortie, tmp);
        fs.renameSync(tmp, css);                                     // écrit d'un coup : jamais un CSS à moitié lu
        return r;
    } finally {
        if (tenu) fs.rmSync(verrou, { force: true });
    }
}
