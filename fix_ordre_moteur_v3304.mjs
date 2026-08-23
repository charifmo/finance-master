/**
 * v33.04 — Fix TDZ : le moteur doit être déclaré AVANT le CRUD masterAsset.
 *
 * masterAssetForm = ref(_emptyMasterAssetForm()) s'exécute au setup et appelle
 * migrateAssetV19, déclaré plus bas (juste avant la sandbox) → ReferenceError
 * "Cannot access 'migrateAssetV19' before initialization".
 * On déplace tout le bloc moteur juste avant la déclaration de masterAssets.
 * Les computed du moteur (assetsEconomics…) restent paresseux, donc référencer
 * masterAssets déclaré ensuite est sans risque.
 */
import fs from 'node:fs';

const FILE = new URL('./index.html', import.meta.url);
let s = fs.readFileSync(FILE, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.split('\r\n').join('\n');

const START = `                    // ═══════════════════════════════════════════════════════════════════
                    // v33.00 — SCHÉMA MASTER ASSET v19 + MOTEUR FINANCIER`;
const END = `                    // ─────────────────────────────────────────────────────
                    // ── v20.00 : SANDBOX / PROJECTIONS ────────────────────`;

const i0 = s.indexOf(START);
if (i0 < 0) throw new Error('début du bloc moteur introuvable');
const i1 = s.indexOf(END, i0);
if (i1 < 0) throw new Error('fin du bloc moteur introuvable');

const bloc = s.slice(i0, i1);
s = s.slice(0, i0) + s.slice(i1);

const ANCRE = `                    // ── v17.0 : Master Asset Engine (source unique de vérité) ──`;
if (s.split(ANCRE).length - 1 !== 1) throw new Error('ancre masterAssets introuvable/ambiguë');
s = s.replace(ANCRE, bloc + ANCRE);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ v33.04 : moteur déplacé avant le CRUD masterAsset');
