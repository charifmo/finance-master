import { readFileSync, writeFileSync } from 'fs';

const SRC  = 'C:/Users/HP/finance/index.html';
let html = readFileSync(SRC, 'utf8').replace(/\r\n/g, '\n');
const orig = html;

let errors = 0;
const check = (label, str) => {
    if (!html.includes(str)) { console.error('❌ ANCHOR NOT FOUND:', label); errors++; }
    else console.log('✅', label);
};
const replace = (label, from, to) => {
    if (!html.includes(from)) { console.error('❌ REPLACE ANCHOR NOT FOUND:', label); errors++; return; }
    html = html.split(from).join(to);
    console.log('✅ REPLACED:', label);
};

// ──────────────────────────────────────────────────────────────────────────────
// VÉRIFICATION DES ANCRES
// ──────────────────────────────────────────────────────────────────────────────

check('Ancre bouton Merlin closing tag', "            🪄\n        </button>");
check('Ancre commentaire Merlin',        "<!-- v17.98 : Bouton flottant Baguette Magique MERLIN");

if (errors > 0) { console.error(`\n${errors} ancre(s) manquante(s) — abandon.`); process.exit(1); }

// ──────────────────────────────────────────────────────────────────────────────
// INSERTION : FAB Journal flottant — au-dessus de Merlin, toujours visible
//
// Positions sûres :
//   Mobile  : bottom-[11.5rem] right-4   → 184px = au-dessus du save FAB (bottom-32 = 128px + h-12 = 48px → top 176px)
//   Desktop : md:bottom-24 md:left-6     → 96px  = 8px gap au-dessus de Merlin (bottom-6 + h-16 = 88px)
//   z-index : 9996 < Merlin (9998) → jamais devant Merlin
// ──────────────────────────────────────────────────────────────────────────────

replace(
    'Insertion FAB Journal au-dessus de Merlin',
    "            🪄\n        </button>",
    `            🪄
        </button>

        <!-- v26.71 FAB Journal — toujours visible, au-dessus de Merlin, jamais superposé au bouton save -->
        <button @click="ouvrirReleve()"
            title="Ouvrir le Journal / Relevé"
            class="fixed z-[9996] rounded-full flex items-center justify-center border-2 transition-all hover:scale-110 shadow-xl
                   bottom-[11.5rem] right-4 w-12 h-12 text-xl
                   md:bottom-24 md:left-6 md:right-auto md:w-16 md:h-16 md:text-3xl
                   bg-gradient-to-br from-indigo-600 to-violet-700 text-white border-indigo-400/60 shadow-indigo-900/50">
            📑
        </button>`
);

// ──────────────────────────────────────────────────────────────────────────────
// BUMP VERSION  26.70 → 26.71
// ──────────────────────────────────────────────────────────────────────────────

replace(
    'Bump version 26.70 → 26.71',
    'v26.70 Creances-Loop-Fix',
    'v26.71 FAB-Journal-Fix'
);

// ──────────────────────────────────────────────────────────────────────────────
// SAUVEGARDE
// ──────────────────────────────────────────────────────────────────────────────

if (errors > 0) { console.error(`\n${errors} erreur(s) — fichier NON modifié.`); process.exit(1); }
if (html === orig) { console.warn('\n⚠️  Aucun changement détecté — vérifier les ancres.'); process.exit(1); }

writeFileSync(SRC, html.replace(/\n/g, '\r\n'), 'utf8');
console.log('\n✅ index.html mis à jour → v26.71 FAB-Journal-Fix');
