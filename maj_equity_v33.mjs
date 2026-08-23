/**
 * Mise à jour des données d'equity — masterAssets uniquement.
 * ---------------------------------------------------------------------------
 * Usage :  node maj_equity_v33.mjs "chemin/vers/export.json"
 *
 * RÈGLE : tout le reste du fichier (soldesInitiaux, donneesAnnuelles, comptes,
 * parametres, wealthGoals, studioExpl, gConfig) est recopié à l'identique.
 * Sur les actifs déjà présents, SEULS les champs explicitement listés sont
 * écrasés — les autres (frais d'acquisition, travaux, régime fiscal…) sont
 * conservés. Un backup horodaté est écrit avant toute modification.
 */
import fs from 'node:fs';
import path from 'node:path';

const SRC = process.argv[2];
if (!SRC) { console.error('Usage : node maj_equity_v33.mjs "<export.json>"'); process.exit(1); }

const raw = fs.readFileSync(SRC, 'utf8');
const data = JSON.parse(raw);

// ── Backup horodaté ────────────────────────────────────────────────────────
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backup = path.join(path.dirname(SRC), path.basename(SRC, '.json') + '.backup-' + stamp + '.json');
fs.writeFileSync(backup, raw, 'utf8');

const assets = Array.isArray(data.masterAssets) ? data.masterAssets : [];
const findBy = (re) => assets.find(a => re.test(String(a.name || '')));
const patch = (asset, champs, label) => {
    if (!asset) { console.log('  ⚠️  introuvable :', label); return; }
    const avant = {};
    Object.keys(champs).forEach(k => { avant[k] = asset[k]; });
    Object.assign(asset, champs);
    const diffs = Object.keys(champs).filter(k => String(avant[k]) !== String(champs[k]));
    console.log('  ✏️ ', asset.name, '→', diffs.length ? diffs.map(k => `${k}: ${avant[k]} → ${champs[k]}`).join(', ') : 'aucun changement');
};

// Gabarit d'un actif non productif détenu en propre (aucun crédit)
const nouveauFoncier = (id, name, type, valeur, quotePart) => ({
    id, name, type, isProductive: false, quotePart,
    value: valeur, revenue: 0, val_pessimiste: 0, val_optimiste: 0,
    annees_total: 0, annees_restantes: 0,
    prix_acquisition: valeur, frais_acquisition: 0, travaux: 0,
    valeur_actuelle: valeur, taux_revalorisation: 3, frais_revente_pct: 3,
    apport_personnel: valeur, montant_credit: 0, type_credit: 'classique',
    taux_credit: 0, duree_mois: 0, mensualite: 0, assurance_mensuelle: 0,
    marge_totale: 0, mode_marge: 'lineaire', taux_ibraa: 0, mois_deja_payes: 0,
    mode_exploitation: 'aucun', loyer_mensuel: 0, adr: 0, taux_occupation: 0,
    frais_plateforme_pct: 0, frais_cohost_pct: 0, maintenance_pct: 0,
    syndic: 0, internet: 0, electricite_eau: 0, consommables: 0, assurance_pno: 0,
    regime_fiscal: 'exonere', taux_marginal: 37, abattement_pct: 40,
    taux_liberatoire: 20, amortissement_bati_pct: 0,
    amortissement_mobilier_pct: 0, part_bati_pct: 0, _v: 19,
});

console.log('── Actifs existants mis à jour ──');

// 2. Studio Airbnb
patch(findBy(/studio/i), {
    prix_acquisition: 1135000,
    valeur_actuelle: 1340000,
    apport_personnel: 370000,
    montant_credit: 765560,
    duree_mois: 240,
    type_credit: 'mourabaha',
    mensualite: 5145,
    assurance_mensuelle: 300,
    marge_totale: 469240,
    taux_ibraa: 70,
    mode_exploitation: 'courte_duree',
    adr: 800,
    taux_occupation: 60,
    frais_plateforme_pct: 3,
    frais_cohost_pct: 20,
    maintenance_pct: 5,
    syndic: 250, internet: 250, electricite_eau: 350, consommables: 200, assurance_pno: 100,
    regime_fiscal: 'foncier_bareme',
}, 'Studio Airbnb');

// 3. Appartement Almaz
patch(findBy(/almaz/i), {
    prix_acquisition: 1200000,
    valeur_actuelle: 1300000,
    apport_personnel: 230000,
    montant_credit: 889193,
    duree_mois: 240,
    isProductive: false,
    mode_exploitation: 'aucun',
}, 'Appartement Almaz');

// 4. Anciens actifs
patch(findBy(/bouskoura/i), {
    prix_acquisition: 660000,
    valeur_actuelle: 900000,
    loyer_mensuel: 7000,
    mode_exploitation: 'commercial',
    regime_fiscal: 'foncier_bareme',
}, 'Local Bouskoura');

patch(findBy(/wafabourse|cto/i), {
    prix_acquisition: 4400,
    valeur_actuelle: 4400,
    isProductive: true,
}, 'CTO Wafabourse');

// 1. Terrains et indivision — créés seulement s'ils n'existent pas déjà
console.log('── Actifs ajoutés ──');
const nouveaux = [
    ['ma_terrain_nord', 'Terrain Nord (Ouahat Sidi Brahim)', 'Terrain', 11200000, '35%', /ouahat|terrain nord|foncier nord/i],
    ['ma_terrain_est', 'Terrain Est (Al Ouidane)', 'Terrain', 1260000, '35%', /ouidane|terrain est|foncier est/i],
    ['ma_villa_riad_salam', 'Villa Riad Salam', 'Résidentiel', 1050000, '35%', /riad salam/i],
];
for (const [id, name, type, valeur, qp, re] of nouveaux) {
    const existant = findBy(re);
    if (existant) {
        patch(existant, { prix_acquisition: valeur, valeur_actuelle: valeur, quotePart: qp,
                          isProductive: false, mode_exploitation: 'aucun', taux_revalorisation: 3 }, name);
    } else {
        assets.push(nouveauFoncier(id, name, type, valeur, qp));
        console.log('  ➕', name, '·', valeur.toLocaleString('fr-FR'), 'DH ·', qp);
    }
}

data.masterAssets = assets;
data._schemaVersion = 19;

// ── Contrôle : rien d'autre n'a bougé ──────────────────────────────────────
const avant = JSON.parse(raw);
const intacts = ['soldesInitiaux', 'donneesAnnuelles', 'comptes', 'parametres', 'wealthGoals', 'studioExpl', 'gConfig'];
console.log('── Contrôle d\'intégrité ──');
intacts.forEach(k => {
    const ok = JSON.stringify(avant[k]) === JSON.stringify(data[k]);
    console.log(' ', ok ? '✅' : '❌', k, ok ? 'intact' : 'MODIFIÉ !');
});

// ── Patrimoine net ─────────────────────────────────────────────────────────
const N = (v) => Number(v) || 0;
const valeurTotale = assets.reduce((s, a) => s + (N(a.valeur_actuelle) || N(a.prix_acquisition) || N(a.value)), 0);
const detteTotale = assets.reduce((s, a) => s + N(a.montant_credit), 0);
const liquide = (data.comptes || []).filter(c => c.inclureLiquidite !== false).reduce((s, c) => s + N(c.solde), 0);
const fmt = (v) => Math.round(v).toLocaleString('fr-FR') + ' DH';

console.log('── Patrimoine ──');
assets.forEach(a => console.log('  ', (a.valeur_actuelle || a.value ? fmt(N(a.valeur_actuelle) || N(a.value)) : '0 DH').padStart(16), '·', a.name, N(a.montant_credit) ? '(crédit ' + fmt(N(a.montant_credit)) + ')' : ''));
console.log('  Valeur des actifs :', fmt(valeurTotale));
console.log('  Dette totale      :', fmt(detteTotale));
console.log('  PATRIMOINE NET    :', fmt(valeurTotale - detteTotale));
console.log('  + liquidités      :', fmt(liquide), '→ net global', fmt(valeurTotale - detteTotale + liquide));

const OUT = process.argv[3] || path.join(process.cwd(), 'finance_v33_equity_maj.json');
fs.writeFileSync(OUT, JSON.stringify(data, null, 2), 'utf8');
console.log('\nBackup :', backup);
console.log('Sortie :', OUT);
