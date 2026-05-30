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
// ██ Op 1 : bilan._log — rendre le mapping plus robuste
//    Avant : seul compte==='courant' est mappé
//    Après : aussi undefined/null, et IDs nus sans préfixe 'cpt_'
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_LOG_MAPPING = `const cle = (compte === 'courant' && courantCptKey) ? courantCptKey : compte;`;
const NEW_LOG_MAPPING = `// v23.15 : résolution défensive — 'courant' | null | bare-id → clé physique
                            const _resolveCle = (k) => {
                                if (!k || k === 'courant') return courantCptKey || 'courant';
                                if (/^\\d+$/.test(String(k))) return 'cpt_' + k; // ID numérique sans préfixe
                                return k;
                            };
                            const cle = _resolveCle(compte);`;
check('Op1 _log mapping robuste', html.includes(OLD_LOG_MAPPING));
html = html.replace(OLD_LOG_MAPPING, NEW_LOG_MAPPING);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 2 : bilan — normaliser destinationCompte dans le routing des revenus
//    Avant : revParCompte[dest] avec dest pouvant être un bare ID
//    Après : dest normalisé via _normKey avant toute accumulation
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_NORM_KEY = `// v23.12 : type 'liquide' = compte courant physique (même rôle que 'courant')
                        const courantCompte = comptes.value.find(c => c.type === 'courant' || c.type === 'liquide');
                        const courantCptKey = courantCompte ? 'cpt_' + courantCompte.id : null;`;
const NEW_NORM_KEY = `// v23.15 : type 'liquide' = compte courant physique (même rôle que 'courant')
                        const courantCompte = comptes.value.find(c => c.type === 'courant' || c.type === 'liquide');
                        const courantCptKey = courantCompte ? 'cpt_' + courantCompte.id : null;
                        // v23.15 : helper de normalisation utilisé partout dans les loops revenus/charges
                        const _normKey = (k) => {
                            if (!k || k === 'courant') return courantCptKey || 'courant';
                            if (/^\\d+$/.test(String(k))) return 'cpt_' + k;
                            return k;
                        };`;
check('Op2 _normKey helper', html.includes(OLD_NORM_KEY));
html = html.replace(OLD_NORM_KEY, NEW_NORM_KEY);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 3 : revenus routing — normaliser dest avant accumulation
//    (2 occurrences : isCurrentMonth + else branch)
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_REV_DEST_1 = `const dest = p.destinationCompte || 'courant';
                                        if (dest === 'courant') { revCourant += pv; }
                                        else { revParCompte[dest] = (revParCompte[dest] || 0) + pv; }`;
const NEW_REV_DEST_1 = `const dest = _normKey(p.destinationCompte);
                                        if (dest === courantCptKey || dest === 'courant') { revCourant += pv; }
                                        else { revParCompte[dest] = (revParCompte[dest] || 0) + pv; }`;
check('Op3a revenus parts dest', html.includes(OLD_REV_DEST_1));
html = html.replace(OLD_REV_DEST_1, NEW_REV_DEST_1);

const OLD_REV_DEST_2 = `const dest = (r || {}).destinationCompte || 'courant';
                                    if (dest === 'courant') { revCourant += effVal; }
                                    else { revParCompte[dest] = (revParCompte[dest] || 0) + effVal; }`;
const NEW_REV_DEST_2 = `const dest = _normKey((r || {}).destinationCompte);
                                    if (dest === courantCptKey || dest === 'courant') { revCourant += effVal; }
                                    else { revParCompte[dest] = (revParCompte[dest] || 0) + effVal; }`;
check('Op3b revenus else dest', html.includes(OLD_REV_DEST_2));
html = html.replace(OLD_REV_DEST_2, NEW_REV_DEST_2);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 4 : charges fixes routing — normaliser src
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_FIX_SRC_PARTS = `const src = p.sourceCompte || 'courant';
                                        if (src === 'courant') { fixCourant += pv; }
                                        else { fixParCompte[src] = (fixParCompte[src] || 0) + pv; }`;
const NEW_FIX_SRC_PARTS = `const src = _normKey(p.sourceCompte);
                                        if (src === courantCptKey || src === 'courant') { fixCourant += pv; }
                                        else { fixParCompte[src] = (fixParCompte[src] || 0) + pv; }`;
check('Op4a chargesFixes parts src', html.includes(OLD_FIX_SRC_PARTS));
html = html.replace(OLD_FIX_SRC_PARTS, NEW_FIX_SRC_PARTS);

const OLD_FIX_SRC_ELSE = `const src = (f || {}).sourceCompte || 'courant';\n                                    if (src === 'courant') { fixCourant += effVal; }\n                                    else { fixParCompte[src] = (fixParCompte[src] || 0) + effVal; }`;
const NEW_FIX_SRC_ELSE = `const src = _normKey((f || {}).sourceCompte);\n                                    if (src === courantCptKey || src === 'courant') { fixCourant += effVal; }\n                                    else { fixParCompte[src] = (fixParCompte[src] || 0) + effVal; }`;
check('Op4b chargesFixes else src', html.includes(OLD_FIX_SRC_ELSE));
html = html.replace(OLD_FIX_SRC_ELSE, NEW_FIX_SRC_ELSE);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 5 : charges variables routing — normaliser src
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_VAR_SRC_PARTS = `const src = p.sourceCompte || 'courant';
                                        if (src === 'courant') { varCourant += pv; }
                                        else { varParCompte[src] = (varParCompte[src] || 0) + pv; }`;
const NEW_VAR_SRC_PARTS = `const src = _normKey(p.sourceCompte);
                                        if (src === courantCptKey || src === 'courant') { varCourant += pv; }
                                        else { varParCompte[src] = (varParCompte[src] || 0) + pv; }`;
check('Op5a chargesVar parts src', html.includes(OLD_VAR_SRC_PARTS));
html = html.replace(OLD_VAR_SRC_PARTS, NEW_VAR_SRC_PARTS);

const OLD_VAR_SRC_ELSE = `const src = (curr || {}).sourceCompte || 'courant';
                                    if (src === 'courant') { varCourant += effVal; }
                                    else { varParCompte[src] = (varParCompte[src] || 0) + effVal; }`;
const NEW_VAR_SRC_ELSE = `const src = _normKey((curr || {}).sourceCompte);
                                    if (src === courantCptKey || src === 'courant') { varCourant += effVal; }
                                    else { varParCompte[src] = (varParCompte[src] || 0) + effVal; }`;
check('Op5b chargesVar else src', html.includes(OLD_VAR_SRC_ELSE));
html = html.replace(OLD_VAR_SRC_ELSE, NEW_VAR_SRC_ELSE);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 6 : toggleItemPaid — fix find(type==='courant') → inclure 'liquide'
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_TOGGLE_FIND = `if (compteKey === 'courant') {
                            compteCible = (comptes.value || []).find(c => c.type === 'courant');
                        } else if (compteKey.startsWith('cpt_')) {`;
const NEW_TOGGLE_FIND = `if (compteKey === 'courant') {
                            // v23.15 : inclure type 'liquide' comme compte courant principal
                            compteCible = (comptes.value || []).find(c => c.type === 'courant' || c.type === 'liquide');
                        } else if (compteKey.startsWith('cpt_')) {`;
check('Op6 toggleItemPaid find', html.includes(OLD_TOGGLE_FIND));
html = html.replace(OLD_TOGGLE_FIND, NEW_TOGGLE_FIND);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 7 : releveOnglets — icône pour type 'liquide'
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_RELEVE_ICON = `icon: c.icone || (c.type === 'courant' ? '💳' : c.type === 'epargne' ? '🏦' : '📈'), type: 'cpt'`;
const NEW_RELEVE_ICON = `icon: c.icone || (c.type === 'courant' || c.type === 'liquide' ? '💳' : c.type === 'epargne' ? '🏦' : '📈'), type: 'cpt'`;
check('Op7 releveOnglets icon', html.includes(OLD_RELEVE_ICON));
html = html.replace(OLD_RELEVE_ICON, NEW_RELEVE_ICON);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 8 : controleTotaux — fix find(type==='courant') → inclure 'liquide'
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_CTRL_FIND = `const _courantCpt = comptes.value.find(c => c.type === 'courant');
                            const _courantKey = _courantCpt ? 'cpt_' + _courantCpt.id : null;`;
const NEW_CTRL_FIND = `const _courantCpt = comptes.value.find(c => c.type === 'courant' || c.type === 'liquide');
                            const _courantKey = _courantCpt ? 'cpt_' + _courantCpt.id : null;`;
check('Op8 controleTotaux find', html.includes(OLD_CTRL_FIND));
html = html.replace(OLD_CTRL_FIND, NEW_CTRL_FIND);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 9 : CFO computed — fix find(type==='courant')
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_CFO_FIND = `const _courantCptCFO = comptes.value.find(c => c.type === 'courant');`;
const NEW_CFO_FIND = `const _courantCptCFO = comptes.value.find(c => c.type === 'courant' || c.type === 'liquide');`;
check('Op9 CFO computed find', html.includes(OLD_CFO_FIND));
html = html.replace(OLD_CFO_FIND, NEW_CFO_FIND);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 10 : courantId computed — fix find(type==='courant')
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_COURANT_ID = `const courantId = comptes.value.find(c => c.type === 'courant')?.id;`;
const NEW_COURANT_ID = `const courantId = comptes.value.find(c => c.type === 'courant' || c.type === 'liquide')?.id;`;
check('Op10 courantId find', html.includes(OLD_COURANT_ID));
html = html.replace(OLD_COURANT_ID, NEW_COURANT_ID);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 11 : sandboxProjection — fix find(type==='courant')
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_SANDBOX_FIND = `const courantCompte = comptes.value.find(c => c.type === 'courant');
                        for (const ev of sorted)`;
const NEW_SANDBOX_FIND = `const courantCompte = comptes.value.find(c => c.type === 'courant' || c.type === 'liquide');
                        for (const ev of sorted)`;
check('Op11 sandboxProjection find', html.includes(OLD_SANDBOX_FIND));
html = html.replace(OLD_SANDBOX_FIND, NEW_SANDBOX_FIND);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 12 : Changelog entry — insérer avant le premier item existant
// ═══════════════════════════════════════════════════════════════════════════════
const OLD_VER_ENTRY = `const CHANGELOG = [\n                        { version: "22.21 Saisie-Zen",`;
const NEW_VER_ENTRY = `const CHANGELOG = [\n                        { version: "23.15 Relevé-Intégral", date: "2026-05-29 — Fix Relevé Complet", changes: [\n                            "CAUSE RACINE : revenus/charges du Budget Structurel indexés sous clé littérale 'courant' au lieu de 'cpt_<id>' physique car type==='liquide' ignoré.",\n                            "FIX _log() : _resolveCle() gère 'courant', null/undefined, IDs nus → clé physique normalisée.",\n                            "FIX _normKey() : helper centralisé appliqué sur routing revenus/chargesFixes/chargesVariables.",\n                            "FIX toggleItemPaid, controleTotaux, CFO, courantId, sandboxProjection : find() étendu à type==='liquide'.",\n                            "FIX releveOnglets : icône 💳 pour type='liquide'."\n                        ] },\n                        { version: "22.21 Saisie-Zen",`;
check('Op12 changelog', html.includes(OLD_VER_ENTRY));
html = html.replace(OLD_VER_ENTRY, NEW_VER_ENTRY);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Op 13 : Version bump → 23.15 Relevé-Intégral
// ═══════════════════════════════════════════════════════════════════════════════
check('Op13 version string', html.includes('"23.12 Relevé-Sync"'));
html = html.replace('"23.12 Relevé-Sync"', '"23.15 Relevé-Intégral"');

writeFileSync(filePath, html, 'utf8');
console.log(`\n🎉 Done — ${ops}/13 ops. Fichier écrit.`);
