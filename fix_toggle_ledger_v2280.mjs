import { readFileSync, writeFileSync } from 'fs';

const filePath = 'C:/Users/HP/finance/index.html';
let html = readFileSync(filePath, 'utf8');

// Normalize CRLF → LF
html = html.replace(/\r\n/g, '\n');

let ops = 0;

// ── Op 1 : Replace toggleItemPaid with ledger-aware version ──────────────────
const OLD_TOGGLE = `const toggleItemPaid = (item, dueAmount) => {\n                        if (isItemPaid(item, dueAmount)) {\n                            item.paye = false;\n                            item.montantPaye = 0;\n                        } else {\n                            item.paye = true;\n                            item.montantPaye = dueAmount;\n                        }\n                        handleDataChange();\n                    };`;

const NEW_TOGGLE = `const toggleItemPaid = (item, dueAmount) => {\n                        // v22.80 Pilotage-Ledger : synchronise compte.solde au pointage\n                        const wasAlreadyPaid = isItemPaid(item, dueAmount);\n                        if (wasAlreadyPaid) {\n                            item.paye = false;\n                            item.montantPaye = 0;\n                        } else {\n                            item.paye = true;\n                            item.montantPaye = dueAmount;\n                        }\n                        // Déterminer si c'est un revenu (les revenus ont un champ 'base')\n                        const isRevenu = 'base' in item;\n                        const compteKey = isRevenu\n                            ? (item.destinationCompte || 'courant')\n                            : (item.sourceCompte || 'courant');\n                        // Résoudre le compte cible dans comptes.value\n                        let compteCible = null;\n                        if (compteKey === 'courant') {\n                            compteCible = (comptes.value || []).find(c => c.type === 'courant');\n                        } else if (compteKey.startsWith('cpt_')) {\n                            const cptId = compteKey.slice(4);\n                            compteCible = (comptes.value || []).find(c => String(c.id) === String(cptId));\n                        } else if (compteKey.startsWith('ep_')) {\n                            // Compte épargne — pas de mutation directe sur solde ici\n                            compteCible = null;\n                        }\n                        if (compteCible) {\n                            // signe : +1 pour revenu, -1 pour charge\n                            const signe = isRevenu ? 1 : -1;\n                            // delta : si on coche → ±montant ; si on décoche → ∓montant\n                            const delta = wasAlreadyPaid ? -signe * dueAmount : signe * dueAmount;\n                            compteCible.solde = Math.round(((Number(compteCible.solde) || 0) + delta) * 100) / 100;\n                        }\n                        handleDataChange();\n                    };`;

if (html.includes(OLD_TOGGLE)) {
    html = html.replace(OLD_TOGGLE, NEW_TOGGLE);
    ops++;
    console.log('✅ Op 1 : toggleItemPaid → ledger-aware');
} else {
    console.error('❌ Op 1 FAILED : toggleItemPaid old string not found');
    // Debug: try to find what's there
    const idx = html.indexOf('const toggleItemPaid');
    if (idx !== -1) {
        console.log('Found toggleItemPaid at index', idx);
        console.log('Context:', JSON.stringify(html.slice(idx, idx + 400)));
    }
    process.exit(1);
}

// ── Op 2 : Version bump 22.80 Pilotage-Nominatif → 22.80 Pilotage-Ledger ────
const OLD_VERSION = `"22.80 Pilotage-Nominatif"`;
const NEW_VERSION = `"22.80 Pilotage-Ledger"`;

if (html.includes(OLD_VERSION)) {
    html = html.replace(OLD_VERSION, NEW_VERSION);
    ops++;
    console.log('✅ Op 2 : Version bump → 22.80 Pilotage-Ledger');
} else {
    console.error('❌ Op 2 FAILED : version string not found');
    process.exit(1);
}

// ── Write ─────────────────────────────────────────────────────────────────────
writeFileSync(filePath, html, 'utf8');
console.log(`\n🎉 Done — ${ops}/2 ops applied. File written.`);
