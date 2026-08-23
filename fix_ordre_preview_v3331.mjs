/**
 * v33.31 — Fix TDZ : le bloc d'aperçu de la modale (computed + watch) était
 * déclaré AVANT masterAssetForm. Les computed sont paresseux donc passaient,
 * mais le watch évalue son getter à la création → « Cannot access
 * 'masterAssetForm' before initialization », setup interrompu.
 * On déplace le bloc juste après la déclaration de masterAssetForm.
 */
import fs from 'node:fs';

const FILE = new URL('./index.html', import.meta.url);
let s = fs.readFileSync(FILE, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.split('\r\n').join('\n');

const DEBUT = `                    // v33.03 : aperçu live de l'économie de l'actif en cours d'édition`;
const FIN = `                    // ── v17.0 : Master Asset Engine (source unique de vérité) ──`;

const i0 = s.indexOf(DEBUT);
if (i0 < 0) throw new Error('début du bloc aperçu introuvable');
const i1 = s.indexOf(FIN, i0);
if (i1 < 0) throw new Error('fin du bloc aperçu introuvable');

const bloc = s.slice(i0, i1).replace(/\s+$/, '') + '\n\n';
s = s.slice(0, i0) + s.slice(i1);

const ANCRE = `                    const masterAssetForm = ref(_emptyMasterAssetForm());\n`;
if (s.split(ANCRE).length - 1 !== 1) throw new Error('ancre masterAssetForm introuvable/ambiguë');
s = s.replace(ANCRE, ANCRE + '\n' + bloc);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ v33.31 : bloc aperçu déplacé après masterAssetForm');
