/**
 * v37.145 — L'OCR RÉEL, MÉMORISÉ ENTRE DEUX EXÉCUTIONS (accélère « bash run_tests.sh »).
 *
 *   Les suites Banque font tourner le VRAI Tesseract (wasm) sur des captures fixes : c'était le chemin critique de la TNR
 *   (95 s seule, plus de 200 s quand tout tourne en parallèle). Tesseract est déterministe : la même image, avec les mêmes
 *   réglages et les mêmes fichiers, rend le même résultat. brancherCacheOCR(contexte) enveloppe worker.recognize() dans la
 *   page : la clé = empreinte de l'image RÉELLEMENT envoyée à Tesseract (le canvas après le prétraitement de l'appli :
 *   recadrage, seuil, canal), des réglages en cours (setParameters) et des arguments, et des fichiers de vendor/ocr
 *   (version de Tesseract, cœur wasm, langue). Le code de l'appli change ce qu'il envoie → la clé change → le vrai OCR
 *   repasse. Première exécution (ou cache vidé) : tout est réellement lu. Comme tw_cache.mjs pour Tailwind.
 *   FM_OCR_SANS_CACHE=1 : l'OCR réel à chaque fois, rien n'est gardé.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOSSIER = path.join(os.tmpdir(), 'finance_master_ocr_cache');
let versionOCR = null;
const version = () => {
    if (versionOCR) return versionOCR;
    const h = crypto.createHash('sha1');
    for (const f of ['tesseract.min.js', 'worker.min.js', 'tesseract-core-simd-lstm.wasm.js', 'lang/fra.traineddata.gz']) {
        try { h.update(f); h.update(fs.readFileSync(path.join(RACINE, 'vendor/ocr', f))); } catch { h.update('∅' + f); }
    }
    return (versionOCR = h.digest('hex').slice(0, 16));
};
export const statsOCR = { lus: 0, memorises: 0 };

/** À appeler sur le contexte (ou la page) AVANT d'ouvrir l'appli. */
export async function brancherCacheOCR(cible) {
    if (process.env.FM_OCR_SANS_CACHE) return;
    fs.mkdirSync(DOSSIER, { recursive: true });
    const v = version();
    await cible.exposeFunction('__fmCacheOCR', (op, cle, valeur) => {
        const f = path.join(DOSSIER, v + '-' + String(cle).replace(/[^a-f0-9]/g, '') + '.json');
        if (op === 'lire') { try { const t = fs.readFileSync(f, 'utf8'); statsOCR.memorises++; return t; } catch { return null; } }
        if (op === 'ecrire') { statsOCR.lus++; const tmp = f + '.' + process.pid + '.' + Math.random().toString(16).slice(2) + '.tmp'; try { fs.writeFileSync(tmp, valeur); fs.renameSync(tmp, f); } catch { try { fs.rmSync(tmp, { force: true }); } catch { } } return true; }
        return null;
    });
    await cible.addInitScript(() => {
        //  le résultat de Tesseract est un graphe (un mot connaît sa ligne, la ligne ses mots) : sérialisé avec des renvois
        const aplatir = (racine) => {
            const vus = new Map(), table = [];
            const enc = (x) => {
                if (x === null || typeof x !== 'object') return x;
                if (vus.has(x)) return { $r: vus.get(x) };
                const id = table.length; vus.set(x, id); table.push(null);
                table[id] = Array.isArray(x) ? x.map(enc) : Object.fromEntries(Object.entries(x).filter(([, y]) => typeof y !== 'function').map(([k, y]) => [k, enc(y)]));
                return { $r: id };
            };
            enc(racine);
            return JSON.stringify(table);
        };
        const regonfler = (texte) => {
            const table = JSON.parse(texte), objets = table.map(x => Array.isArray(x) ? [] : {});
            const dec = (x) => (x && typeof x === 'object' && typeof x.$r === 'number' && Object.keys(x).length === 1) ? objets[x.$r] : (x && typeof x === 'object' ? x : x);
            table.forEach((x, i) => { const o = objets[i]; if (Array.isArray(x)) x.forEach((y, k) => { o[k] = dec(y); }); else Object.entries(x).forEach(([k, y]) => { o[k] = dec(y); }); });
            return objets[0];
        };
        const empreinte = async (texte) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(texte)))).map(b => b.toString(16).padStart(2, '0')).join('');
        const imageEnTexte = async (img) => {
            if (img && typeof img.toDataURL === 'function') return img.toDataURL('image/png');
            if (img instanceof Blob) return Array.from(new Uint8Array(await img.arrayBuffer())).join(',');
            if (img && img.data && img.width) return img.width + 'x' + img.height + ':' + Array.from(img.data).join(',');
            return String(img);
        };
        const envelopper = (T) => {
            if (!T || T.__fmCacheOCR || typeof T.createWorker !== 'function') return T;
            const creer = T.createWorker.bind(T);
            T.createWorker = async (...a) => {
                const w = await creer(...a);
                let params = {};
                const setP = w.setParameters.bind(w), reco = w.recognize.bind(w);
                w.setParameters = async (p) => { params = { ...params, ...(p || {}) }; return setP(p); };
                w.recognize = async (img, opts, sortie) => {
                    const cle = await empreinte(JSON.stringify([a.slice(0, 2), params, opts || null, sortie || null]) + '|' + await imageEnTexte(img));
                    const deja = await window.__fmCacheOCR('lire', cle);
                    if (deja) return regonfler(deja);
                    const r = await reco(img, opts, sortie);
                    try { await window.__fmCacheOCR('ecrire', cle, aplatir(r)); } catch { /* non mémorisé */ }
                    return r;
                };
                return w;
            };
            T.__fmCacheOCR = true;
            return T;
        };
        let reel;
        Object.defineProperty(window, 'Tesseract', { configurable: true, get: () => reel, set: (v) => { reel = envelopper(v); } });
    });
}
