import { readFileSync, writeFileSync } from 'fs';

const filePath = 'C:/Users/HP/finance/index.html';
let html = readFileSync(filePath, 'utf8');
html = html.replace(/\r\n/g, '\n');

let ops = 0;
const check = (label, ok) => {
    if (!ok) { console.error('❌ ' + label); process.exit(1); }
    ops++;
    console.log('✅ ' + label);
};

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 1 : bilan computed — courantCompte find doit inclure type 'liquide'
//
// La fonction _log mappe déjà 'courant' → courantCptKey, mais courantCptKey
// vaut null si aucun compte de type 'courant' n'existe → toutes les transactions
// des revenus/charges restent sous la clé littérale 'courant' au lieu de la clé
// physique 'cpt_<id>', donc invisibles dans le relevé du compte physique.
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_COURANT_FIND = `const courantCompte = comptes.value.find(c => c.type === 'courant');
                        const courantCptKey = courantCompte ? 'cpt_' + courantCompte.id : null;`;

const NEW_COURANT_FIND = `// v23.12 : type 'liquide' = compte courant physique (même rôle que 'courant')
                        const courantCompte = comptes.value.find(c => c.type === 'courant' || c.type === 'liquide');
                        const courantCptKey = courantCompte ? 'cpt_' + courantCompte.id : null;`;

check('Op1 courantCompte find in bilan', html.includes(OLD_COURANT_FIND));
html = html.replace(OLD_COURANT_FIND, NEW_COURANT_FIND);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Version bump → 23.12 Relevé-Sync
// ═══════════════════════════════════════════════════════════════════════════════
check('Version anchor', html.includes('"23.11 Checklist-Tréso-Fix"'));
html = html.replace('"23.11 Checklist-Tréso-Fix"', '"23.12 Relevé-Sync"');

writeFileSync(filePath, html, 'utf8');
console.log(`\n🎉 Done — ${ops}/2 ops. Fichier écrit.`);
