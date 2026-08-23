/**
 * v33.80 — Filtre de patrimoine + nettoyage de la liste
 * ---------------------------------------------------------------------------
 *  1. is_included_in_net_worth (défaut true). Décoché, l'actif est exclu de
 *     TOUS les agrégats : patrimoine net, totaux du tableau, projection
 *     pluriannuelle et revenus passifs. Il reste visible et éditable, grisé.
 *     (Exclure la valeur sans exclure le cash-flow produirait une projection
 *     incohérente : l'actif alimenterait la trésorerie sans figurer au bilan.)
 *  2. Le simulateur de revente quitte la liste : il vit dans la modale
 *     d'édition. Sur un terrain c'est l'onglet « Scénarios de Vente », sur les
 *     autres actifs un nouvel onglet « 🔮 Revente ». L'icône 🔮 de la liste
 *     ouvre directement la modale sur le bon onglet.
 */
import fs from 'node:fs';

const FILE = new URL('./index.html', import.meta.url);
let s = fs.readFileSync(FILE, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.split('\r\n').join('\n');
const sub = (from, to, n = 1) => {
    const c = s.split(from).length - 1;
    if (c !== n) throw new Error(`Ancre (${c}/${n}) :\n${from.slice(0, 200)}`);
    s = s.split(from).join(to);
};

/* ══════════════════════════════════════════════════════════════════════════
   1. SCHÉMA
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                    const _assetDefaultsV19 = () => ({`,
`                    const _assetDefaultsV19 = () => ({
                        // v33.80 : compte-t-il dans le patrimoine net ?
                        is_included_in_net_worth: true,`);

sub(
`                            isProductive: !!f.isProductive,`,
`                            isProductive: !!f.isProductive,
                            is_included_in_net_worth: f.is_included_in_net_worth !== false,`);

/* ══════════════════════════════════════════════════════════════════════════
   2. AGRÉGATS FILTRÉS
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                    const roiAssets    = computed(() => masterAssets.value.filter(a => a.isProductive));
                    const stressAssets = computed(() => masterAssets.value.filter(a => !a.isProductive));`,
`                    // v33.80 : seuls les actifs cochés alimentent les agrégats globaux
                    const estInclus = (a) => (a || {}).is_included_in_net_worth !== false;
                    const assetsInclus = computed(() => masterAssets.value.filter(estInclus));
                    const assetsExclus = computed(() => masterAssets.value.filter(a => !estInclus(a)));
                    const valeurExclue = computed(() => assetsExclus.value.reduce((s, a) => s + (Number(a.valeur_actuelle || a.value) || 0), 0));

                    // Les listes affichées gardent TOUS les actifs (grisés si exclus) ;
                    // ce sont les totaux qui filtrent.
                    const roiAssets    = computed(() => masterAssets.value.filter(a => a.isProductive));
                    const stressAssets = computed(() => masterAssets.value.filter(a => !a.isProductive));
                    const roiAssetsInclus    = computed(() => assetsInclus.value.filter(a => a.isProductive));
                    const stressAssetsInclus = computed(() => assetsInclus.value.filter(a => !a.isProductive));`);

// Totaux non productifs
sub(
`                    const totalConservateur = computed(() => stressAssets.value.reduce((s, a) => s + (Number(a.valeur_actuelle || a.value) || 0), 0));
                    const totalPessimiste   = computed(() => stressAssets.value.reduce((s, a) => s + (Number(a.val_pessimiste) || 0), 0));
                    const totalOptimiste    = computed(() => stressAssets.value.reduce((s, a) => s + (Number(a.val_optimiste) || 0), 0));

                    // ── v20.00 : Totaux Patrimoine de Jouissance (non-productifs) ──
                    const stressTotalValeur = computed(() => stressAssets.value.reduce((s, a) => s + (Number(a.valeur_actuelle || a.value) || 0), 0));
                    const stressTotalCredit = computed(() => stressAssets.value.reduce((s, a) => s + (Number(a.montant_credit) || 0), 0));
                    const stressTotalApport = computed(() => stressAssets.value.reduce((s, a) => s + (Number(a.apport_personnel) || 0), 0));
                    const stressTotalNet    = computed(() => stressAssets.value.reduce((s, a) => s + ((Number(a.valeur_actuelle || a.value) || 0) - (Number(a.montant_credit) || 0)), 0));`,
`                    const totalConservateur = computed(() => stressAssetsInclus.value.reduce((s, a) => s + (Number(a.valeur_actuelle || a.value) || 0), 0));
                    const totalPessimiste   = computed(() => stressAssetsInclus.value.reduce((s, a) => s + (Number(a.val_pessimiste) || 0), 0));
                    const totalOptimiste    = computed(() => stressAssetsInclus.value.reduce((s, a) => s + (Number(a.val_optimiste) || 0), 0));

                    // ── v20.00 : Totaux Patrimoine de Jouissance (non-productifs) ──
                    const stressTotalValeur = computed(() => stressAssetsInclus.value.reduce((s, a) => s + (Number(a.valeur_actuelle || a.value) || 0), 0));
                    const stressTotalCredit = computed(() => stressAssetsInclus.value.reduce((s, a) => s + (Number(a.montant_credit) || 0), 0));
                    const stressTotalApport = computed(() => stressAssetsInclus.value.reduce((s, a) => s + (Number(a.apport_personnel) || 0), 0));
                    const stressTotalNet    = computed(() => stressAssetsInclus.value.reduce((s, a) => s + ((Number(a.valeur_actuelle || a.value) || 0) - (Number(a.montant_credit) || 0)), 0));`);

sub(
`                    const globalValeurProductifs   = computed(() => roiAssets.value.reduce((s, a) => s + (Number(a.valeur_actuelle || a.value) || 0), 0));
                    const globalDetteProductifs    = computed(() => roiAssets.value.reduce((s, a) => s + (Number(a.montant_credit) || 0), 0));`,
`                    const globalValeurProductifs   = computed(() => roiAssetsInclus.value.reduce((s, a) => s + (Number(a.valeur_actuelle || a.value) || 0), 0));
                    const globalDetteProductifs    = computed(() => roiAssetsInclus.value.reduce((s, a) => s + (Number(a.montant_credit) || 0), 0));`);

// Revenus passifs
sub(
`                    const revenusPassifsNetsAnnuel = computed(() =>
                        assetsEconomics.value
                            .filter(e => (masterAssets.value.find(a => a.id === e.id) || {}).isProductive)`,
`                    const revenusPassifsNetsAnnuel = computed(() =>
                        assetsEconomics.value
                            .filter(e => { const a = masterAssets.value.find(x => x.id === e.id) || {};
                                           return a.isProductive && a.is_included_in_net_worth !== false; })`);

// Projection pluriannuelle
sub(
`                        const dette = cloneAssets.reduce((s, a) => s + (Number(a.montant_credit) || 0), 0);
                        const valeurActifs = cloneAssets.reduce((s, a) => s + (Number(a.valeur_actuelle || a.value) || 0), 0);
                        return { courant, dette, valeurActifs, comptes: cloneComptes, assets: cloneAssets, donneesAnnuelles: cloneAnnuel };`,
`                        // v33.80 : la projection ignore les actifs décochés
                        const retenus = cloneAssets.filter(a => a.is_included_in_net_worth !== false);
                        const dette = retenus.reduce((s, a) => s + (Number(a.montant_credit) || 0), 0);
                        const valeurActifs = retenus.reduce((s, a) => s + (Number(a.valeur_actuelle || a.value) || 0), 0);
                        return { courant, dette, valeurActifs, comptes: cloneComptes, assets: retenus, donneesAnnuelles: cloneAnnuel };`);

sub(
`                        estTerrainNu, quotePartPct, terrainScenarios, ZONAGES,`,
`                        estInclus, assetsInclus, assetsExclus, valeurExclue, roiAssetsInclus, stressAssetsInclus,
                        estTerrainNu, quotePartPct, terrainScenarios, ZONAGES,`);

/* ══════════════════════════════════════════════════════════════════════════
   3. MODALE — onglet Revente + ouverture ciblée
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                    const masterAssetOngletsDispos = computed(() => masterAssetEstTerrain.value
                        ? [['acquisition','🏞️ Origine & Valorisation'],['scenarios','💰 Scénarios de Vente'],['fiscalite','🧾 Fiscalité & Frais de Sortie']]
                        : [['acquisition','🏗️ Acquisition'],['financement','🏦 Financement'],['exploitation','🔑 Exploitation'],['fiscalite','🧾 Fiscalité']]);`,
`                    const masterAssetOngletsDispos = computed(() => masterAssetEstTerrain.value
                        ? [['acquisition','🏞️ Origine & Valorisation'],['scenarios','💰 Scénarios de Vente'],['fiscalite','🧾 Fiscalité & Frais de Sortie']]
                        : [['acquisition','🏗️ Acquisition'],['financement','🏦 Financement'],['exploitation','🔑 Exploitation'],['fiscalite','🧾 Fiscalité'],['revente','🔮 Revente']]);
                    // v33.80 : simulateur de revente hébergé par la modale
                    const masterAssetExitAnnee = ref(5);
                    const masterAssetExit = computed(() => exitSim(masterAssetForm.value, masterAssetExitAnnee.value));
                    const masterAssetExitMax = computed(() => exitMaxAnnees(masterAssetForm.value));`);

sub(
`                            const dispos = (estTerrainNu(masterAssetForm.value)
                                ? ['acquisition', 'scenarios', 'fiscalite']
                                : ['acquisition', 'financement', 'exploitation', 'fiscalite']);`,
`                            const dispos = (estTerrainNu(masterAssetForm.value)
                                ? ['acquisition', 'scenarios', 'fiscalite']
                                : ['acquisition', 'financement', 'exploitation', 'fiscalite', 'revente']);`);

// Ouverture ciblée depuis la liste
sub(
`                    const deleteMasterAsset = (id) => {`,
`                    // v33.80 : l'icône 🔮 de la liste ouvre la modale sur l'onglet de revente
                    const ouvrirSimulationRevente = (id) => {
                        const asset = masterAssets.value.find(a => a.id === id);
                        if (!asset) return;
                        editMasterAsset(id);
                        masterAssetTab.value = estTerrainNu(asset) ? 'scenarios' : 'revente';
                        masterAssetExitAnnee.value = Math.min(5, exitMaxAnnees(asset));
                    };

                    const deleteMasterAsset = (id) => {`);

sub(
`                        exitOpen, exitYears, exitMaxAnnees, toggleExit, setExitYear, exitSim,`,
`                        exitOpen, exitYears, exitMaxAnnees, toggleExit, setExitYear, exitSim,
                        ouvrirSimulationRevente, masterAssetExitAnnee, masterAssetExit, masterAssetExitMax,`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ v33.80 store appliqué');
