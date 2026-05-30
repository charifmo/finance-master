/**
 * fix_pilotage_sync_v2450.mjs
 * v24.50 Pilotage-Sync — Règle du 27 dans la Checklist
 *
 * Op 1  : Ajouter getDepensesCycle(cycleM, cycleA) après getDepensesMois
 * Op 2  : ajouterDepense → jourPrevu: new Date().getDate() par défaut
 * Op 3  : chargesFixesBudgetairesTriees → cycle-aware (pilotageViewedAn + filtre jourPrevu)
 * Op 4  : Ajouter chargesVarMensuellePilotage computed
 * Op 5  : Exposer chargesVarMensuellePilotage dans return setup()
 * Op 6  : Template v-if flux exceptionnels → getDepensesCycle
 * Op 7  : Template v-for flux exceptionnels → getDepensesCycle
 * Op 8  : Template chargesVariables v-for → chargesVarMensuellePilotage
 * Op 9  : resteAPayerDetailParCompte chocs → getDepensesCycle
 * Op 10 : Version bump
 * Op 11 : Changelog
 */

import { readFileSync, writeFileSync } from 'fs';

const FILE = 'C:/Users/HP/finance/index.html';
let html = readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n');

let opCount = 0;

function check(label, needle) {
    if (!html.includes(needle)) {
        console.error(`\n❌ ANCHOR NOT FOUND: ${label}`);
        console.error(`   Preview: ${JSON.stringify(needle.slice(0, 200))}`);
        process.exit(1);
    }
}

function replace(label, from, to) {
    check(label, from);
    const before = html;
    html = html.split(from).join(to);
    if (html === before) {
        console.error(`\n❌ NO CHANGE: ${label}`);
        process.exit(1);
    }
    opCount++;
    console.log(`✅ Op ${opCount} — ${label}`);
}

// ── Op 1 : getDepensesCycle ──────────────────────────────────────────────────
replace(
    'Op1 - Insert getDepensesCycle after getDepensesMois',
    `const getDepensesMois = (m, a) => {
                        if (!donneesAnnuelles.value[a]) return [];
                        return (donneesAnnuelles.value[a].depensesIrregulieres || []).filter(d => d.mois === m);
                    };`,
    `const getDepensesMois = (m, a) => {
                        if (!donneesAnnuelles.value[a]) return [];
                        return (donneesAnnuelles.value[a].depensesIrregulieres || []).filter(d => d.mois === m);
                    };
                    // v24.50 Pilotage-Sync : filtre cycle-aware avec règle du 27
                    // Un item avec jourPrevu >= jourDePaie appartient au cycle SUIVANT (mois+1)
                    const getDepensesCycle = (cycleM, cycleA) => {
                        const jdp = jourDePaie.value;
                        const mPrev = cycleM === 1 ? 12 : cycleM - 1;
                        const aPrev = cycleM === 1 ? cycleA - 1 : cycleA;
                        const result = [];
                        // Items du mois calendaire cycleM avec jourPrevu < jdp (ou sans jourPrevu = appartient au cycle mois)
                        if (donneesAnnuelles.value[cycleA]) {
                            (donneesAnnuelles.value[cycleA].depensesIrregulieres || [])
                                .filter(d => Number(d.mois) === cycleM && (!d.jourPrevu || Number(d.jourPrevu) < jdp))
                                .forEach(d => result.push(d));
                        }
                        // Items du mois précédent avec jourPrevu >= jdp (début de ce cycle)
                        if (donneesAnnuelles.value[aPrev]) {
                            (donneesAnnuelles.value[aPrev].depensesIrregulieres || [])
                                .filter(d => Number(d.mois) === mPrev && d.jourPrevu && Number(d.jourPrevu) >= jdp)
                                .forEach(d => result.push(d));
                        }
                        return result;
                    };`
);

// ── Op 2 : ajouterDepense → jourPrevu = today ────────────────────────────────
replace(
    'Op2 - ajouterDepense default jourPrevu = today',
    `const ajouterDepense = (m, a) => { if(donneesAnnuelles.value[a]) donneesAnnuelles.value[a].depensesIrregulieres.push({ id: Date.now(), mois: m, annee: a, nom: 'Nouveau', montant: 0, paye: false, montantPaye: 0, sourceCompte: 'courant', categorieId: 'cat_irr_depense_exceptionnelle' }); handleDataChange(); };`,
    `const ajouterDepense = (m, a) => { if(donneesAnnuelles.value[a]) donneesAnnuelles.value[a].depensesIrregulieres.push({ id: Date.now(), mois: m, annee: a, nom: 'Nouveau', montant: 0, paye: false, montantPaye: 0, sourceCompte: 'courant', categorieId: 'cat_irr_depense_exceptionnelle', jourPrevu: new Date().getDate() }); handleDataChange(); };`
);

// ── Op 3 : chargesFixesBudgetairesTriees cycle-aware ────────────────────────
replace(
    'Op3 - chargesFixesBudgetairesTriees cycle-aware',
    `const chargesFixesBudgetairesTriees = computed(() => {
                        calculationTick.value;
                        const mb = moisBudgetaire.value;
                        const d = donneesAnnuelles.value[mb.an];
                        if (!d) return [];
                        return Object.values(d.chargesFixes || {}).slice().sort((a, b) =>
                            (a.jourPrevu || 99) - (b.jourPrevu || 99));
                    });`,
    `// v24.50 Pilotage-Sync : cycle-aware — utilise pilotageViewedAn en mode retro
                    // filtre les charges avec jourPrevu >= jourDePaie (appartiennent au cycle suivant)
                    const chargesFixesBudgetairesTriees = computed(() => {
                        calculationTick.value;
                        const jdp = jourDePaie.value;
                        const an = isCyclePasse.value ? pilotageViewedAn.value : moisBudgetaire.value.an;
                        const d = donneesAnnuelles.value[an];
                        if (!d) return [];
                        const all = Object.values(d.chargesFixes || {});
                        const filtered = isCyclePasse.value
                            ? all.filter(f => !f.jourPrevu || Number(f.jourPrevu) < jdp)
                            : all;
                        return filtered.sort((a, b) => (a.jourPrevu || 99) - (b.jourPrevu || 99));
                    });`
);

// ── Op 4 : chargesVarMensuellePilotage computed ──────────────────────────────
replace(
    'Op4 - Add chargesVarMensuellePilotage computed',
    `const chargesFixesBudgetairesTriees = computed(() => {
                        calculationTick.value;
                        const jdp = jourDePaie.value;
                        const an = isCyclePasse.value ? pilotageViewedAn.value : moisBudgetaire.value.an;
                        const d = donneesAnnuelles.value[an];
                        if (!d) return [];
                        const all = Object.values(d.chargesFixes || {});
                        const filtered = isCyclePasse.value
                            ? all.filter(f => !f.jourPrevu || Number(f.jourPrevu) < jdp)
                            : all;
                        return filtered.sort((a, b) => (a.jourPrevu || 99) - (b.jourPrevu || 99));
                    });`,
    `const chargesFixesBudgetairesTriees = computed(() => {
                        calculationTick.value;
                        const jdp = jourDePaie.value;
                        const an = isCyclePasse.value ? pilotageViewedAn.value : moisBudgetaire.value.an;
                        const d = donneesAnnuelles.value[an];
                        if (!d) return [];
                        const all = Object.values(d.chargesFixes || {});
                        const filtered = isCyclePasse.value
                            ? all.filter(f => !f.jourPrevu || Number(f.jourPrevu) < jdp)
                            : all;
                        return filtered.sort((a, b) => (a.jourPrevu || 99) - (b.jourPrevu || 99));
                    });
                    // v24.50 Charges variables mensuelles — cycle-aware (pilotageViewedAn + règle du 27)
                    const chargesVarMensuellePilotage = computed(() => {
                        calculationTick.value;
                        const jdp = jourDePaie.value;
                        const an = isCyclePasse.value ? pilotageViewedAn.value : moisBudgetaire.value.an;
                        const d = donneesAnnuelles.value[an];
                        if (!d) return [];
                        return Object.values(d.chargesVariables || {}).filter(c => {
                            if (!c || c.periode !== 'mois') return false;
                            if (!isCyclePasse.value) return true;
                            return !c.jourPrevu || Number(c.jourPrevu) < jdp;
                        });
                    });`
);

// ── Op 5 : Exposer chargesVarMensuellePilotage dans return setup() ───────────
replace(
    'Op5 - Expose chargesVarMensuellePilotage in return setup()',
    `isFluxCetteSemaine, revenusBudgetairesTries, chargesFixesBudgetairesTriees,`,
    `isFluxCetteSemaine, revenusBudgetairesTries, chargesFixesBudgetairesTriees, chargesVarMensuellePilotage,`
);

// ── Op 6 : Template v-if flux exceptionnels → getDepensesCycle ───────────────
replace(
    'Op6 - Template v-if flux exceptionnels getDepensesCycle',
    `<div v-if="getDepensesMois(pilotageViewedMois, pilotageViewedAn).length > 0">`,
    `<div v-if="getDepensesCycle(pilotageViewedMois, pilotageViewedAn).length > 0">`
);

// ── Op 7 : Template v-for flux exceptionnels → getDepensesCycle ─────────────
replace(
    'Op7 - Template v-for flux exceptionnels getDepensesCycle',
    `<div v-for="dep in getDepensesMois(pilotageViewedMois, pilotageViewedAn)" :key="'dep'+dep.id"`,
    `<div v-for="dep in getDepensesCycle(pilotageViewedMois, pilotageViewedAn)" :key="'dep'+dep.id"`
);

// ── Op 8 : Template chargesVariables v-for → chargesVarMensuellePilotage ────
replace(
    'Op8 - Template chargesVariables v-for uses chargesVarMensuellePilotage',
    `<div v-for="cat in Object.values(donneesAnnuelles[moisBudgetaire.an]?.chargesVariables || {}).filter(c => c.periode === 'mois')" :key="cat.label">`,
    `<div v-for="cat in chargesVarMensuellePilotage" :key="cat.label">`
);

// ── Op 9 : resteAPayerDetailParCompte chocs → getDepensesCycle ──────────────
replace(
    'Op9 - resteAPayerDetailParCompte chocs use getDepensesCycle',
    `                        // Dépenses irrégulières du mois non payées
                        getDepensesMois(mois, an).forEach(dep => {
                            const m = Number(dep.montant || 0);
                            if (m > 0 && !isItemPaid(dep, m) && ok(dep)) {
                                const grp = getOrCreate(dep.sourceCompte || 'courant');
                                grp.montant += m; grp.parNature.choc += m;
                                grp.lignes.push({ nom: dep.nom || '?', montant: m, type: 'choc' });
                            }
                        });`,
    `                        // Dépenses irrégulières — v24.50 filtre cycle-aware (règle du 27)
                        getDepensesCycle(mois, an).forEach(dep => {
                            const m = Number(dep.montant || 0);
                            if (m > 0 && !isItemPaid(dep, m) && ok(dep)) {
                                const grp = getOrCreate(dep.sourceCompte || 'courant');
                                grp.montant += m; grp.parNature.choc += m;
                                grp.lignes.push({ nom: dep.nom || '?', montant: m, type: 'choc' });
                            }
                        });`
);

// ── Op 10 : Version bump ─────────────────────────────────────────────────────
replace(
    'Op10 - Version bump',
    `const CURRENT_VERSION = "24.40 Freeze-Retro";`,
    `const CURRENT_VERSION = "24.50 Pilotage-Sync";`
);

// ── Op 11 : Changelog ────────────────────────────────────────────────────────
replace(
    'Op11 - Changelog entry v24.50',
    `const CHANGELOG = [`,
    `const CHANGELOG = [
        { version: "24.50 Pilotage-Sync", date: "2026-05-30", changes: [
            "getDepensesCycle(cycleM, cycleA) : filtre règle du 27 — items mois-1 jourPrevu>=jdp inclus, items mois jourPrevu>=jdp exclus",
            "ajouterDepense : jourPrevu = new Date().getDate() par défaut pour les nouveaux items",
            "chargesFixesBudgetairesTriees : pilotageViewedAn en retro + filtre jourPrevu < jdp",
            "chargesVarMensuellePilotage : computed cycle-aware pour les variables mensuelles",
            "Checklist Pilotage : getDepensesCycle remplace getDepensesMois pour les flux exceptionnels",
            "resteAPayerDetailParCompte : getDepensesCycle pour les chocs"
        ] },`
);

// ── Écriture ──────────────────────────────────────────────────────────────────
writeFileSync(FILE, html.replace(/\n/g, '\r\n'), 'utf8');
console.log(`\n🎉 v24.50 Pilotage-Sync — ${opCount} opérations appliquées !`);
