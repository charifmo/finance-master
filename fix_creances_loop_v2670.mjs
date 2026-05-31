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

check('Ancre créances section', "// ===== CRÉANCES DÉCLARÉES : assurances_tracker (remboursement:true) — ligne détaillée par créance =====");
check('Ancre toggleAssuranceRembourse', "const toggleAssuranceRembourse = (item) => {");
check('Ancre _syncAssuranceCashflow call in toggle', "_syncAssuranceCashflow(item); // cleanup dans les deux directions (plus d'injection)");

if (errors > 0) { console.error(`\n${errors} ancre(s) manquante(s) — abandon.`); process.exit(1); }

// ──────────────────────────────────────────────────────────────────────────────
// CHANTIER 1 + 2 : INJECTION UNIVERSELLE + ROUTAGE DYNAMIQUE
// Avant : filtre dur sur dateRemboursement (si absent → silencieusement ignoré)
// Après : si pas de dateRemboursement, injection dans le cycle courant (secours)
//         Routage compte : compteDepot → courant par défaut (explicite)
// ──────────────────────────────────────────────────────────────────────────────

replace(
    'CHANTIER 1+2 : créances injection universelle',
    `// ===== CRÉANCES DÉCLARÉES : assurances_tracker (remboursement:true) — ligne détaillée par créance =====
                            (_si.assurances_tracker || []).forEach(c => {
                                if (!c.remboursement) return; // uniquement "Déclaré" (coché)
                                if (!c.dateRemboursement) return;
                                const _dr = new Date(c.dateRemboursement);
                                if ((_dr.getMonth() + 1) !== m || _dr.getFullYear() !== a) return; // filtre cycle exact
                                const amt = Math.round(Number(c.montantRembourse || c.montant || 0) * 100) / 100;
                                if (amt <= 0) return;
                                const _lbl = '💰 Créance : ' + (c.libelle || ((c.assureur || '') + (c.type ? ' ' + c.type : '')) || 'Remboursement');
                                out.push({ account: _normKey(c.compteDepot || 'courant'), libelle: _lbl, montant: amt, type: 'credit', jourPrevu: _dr.getDate(), internal: false });
                            });`,
    `// ===== CRÉANCES DÉCLARÉES : assurances_tracker (remboursement:true) — INJECTION UNIVERSELLE =====
                            // v26.70 : zéro filtrage catégorie — toutes créances Déclarées incluses.
                            // Si dateRemboursement absente → injection de secours dans le cycle courant.
                            (_si.assurances_tracker || []).forEach(c => {
                                if (!c.remboursement) return; // seules les créances "Déclaré" cochées
                                // Routage cycle : dateRemboursement si définie, sinon cycle courant (secours)
                                let _cycleM = curM, _cycleA = curA, _jourPrevu = jdp;
                                if (c.dateRemboursement) {
                                    const _dr = new Date(c.dateRemboursement);
                                    _cycleM = _dr.getMonth() + 1; _cycleA = _dr.getFullYear(); _jourPrevu = _dr.getDate();
                                }
                                if (_cycleM !== m || _cycleA !== a) return; // filtre cycle exact
                                const amt = Math.round(Number(c.montantRembourse || c.montant || 0) * 100) / 100;
                                if (amt <= 0) return;
                                const _compteTarget = _normKey(c.compteDepot || 'courant'); // routage dynamique : compteDepot → courant par défaut
                                const _lbl = '💰 Créance : ' + (c.libelle || [c.assureur, c.type].filter(Boolean).join(' ') || 'Remboursement');
                                out.push({ account: _compteTarget, libelle: _lbl, montant: amt, type: 'credit', jourPrevu: _jourPrevu, internal: false });
                            });`
);

// ──────────────────────────────────────────────────────────────────────────────
// CHANTIER 3 : RÉACTIVITÉ — forceUpdateCalculations() explicite dans toggleAssuranceRembourse
// ──────────────────────────────────────────────────────────────────────────────

replace(
    'CHANTIER 3 : réactivité toggle créance',
    `const toggleAssuranceRembourse = (item) => {
                        item.remboursement = !item.remboursement;
                        _syncAssuranceCashflow(item); // cleanup dans les deux directions (plus d'injection)
                        handleDataChange();
                    };`,
    `const toggleAssuranceRembourse = (item) => {
                        item.remboursement = !item.remboursement;
                        _syncAssuranceCashflow(item); // cleanup dans les deux directions (plus d'injection)
                        forceUpdateCalculations(); // v26.70 : réactivité immédiate journal après toggle déclaré
                        handleDataChange();
                    };`
);

// ──────────────────────────────────────────────────────────────────────────────
// BUMP VERSION
// ──────────────────────────────────────────────────────────────────────────────

replace(
    'Bump version 26.50 → 26.70',
    'v26.50 Workflow-Creances-Fix',
    'v26.70 Creances-Loop-Fix'
);

// ──────────────────────────────────────────────────────────────────────────────
// SAUVEGARDE
// ──────────────────────────────────────────────────────────────────────────────

if (errors > 0) { console.error(`\n${errors} erreur(s) — fichier NON modifié.`); process.exit(1); }
if (html === orig) { console.warn('\n⚠️  Aucun changement détecté — vérifier les ancres.'); process.exit(1); }

writeFileSync(SRC, html.replace(/\n/g, '\r\n'), 'utf8');
console.log('\n✅ index.html mis à jour → v26.70 Creances-Loop-Fix');
