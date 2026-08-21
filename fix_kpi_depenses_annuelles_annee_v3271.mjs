/**
 * v32.71 — Dépenses-Annuelles-Année : le KPI Topbar suit le sélecteur d'année
 * ---------------------------------------------------------------------------
 * S'applique sur une base v32.70 (fix_kpi_depenses_annuelles_v3270.mjs).
 *
 * BUG : kpiDepensesAnnuelles calculait son horizon depuis moisBudgetaire seul
 *       → figé sur Décembre de l'exercice courant. Passer la Topbar sur 2027
 *       ne changeait ni l'atterrissage ni la liste des obligations.
 * FIX  : l'horizon suit anneeAffichage. On chaîne TOUS les cycles du cycle
 *        courant jusqu'à Décembre de l'exercice affiché (le solde du compte se
 *        reporte de cycle en cycle, donc la projection doit être cumulative).
 *        Une année passée ne déclenche aucune projection arrière (Math.max).
 */
import fs from 'node:fs';

const FILE = new URL('./index.html', import.meta.url);
let s = fs.readFileSync(FILE, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.split('\r\n').join('\n');

const sub = (from, to) => {
    const c = s.split(from).length - 1;
    if (c !== 1) throw new Error(`Ancre introuvable ou ambiguë (${c}/1) :\n${from.slice(0, 160)}`);
    s = s.replace(from, to);
};

/* 1. Horizon de projection piloté par anneeAffichage ----------------------- */
sub(
`                        const curM = moisBudgetaire.value.mois, curA = moisBudgetaire.value.an;
                        // Cycles projetés : cycle courant → Décembre de l'exercice en cours
                        const cycles = [];
                        for (let m = curM; m <= 12; m++) cycles.push(m + '-' + curA);`,
`                        const curM = moisBudgetaire.value.mois, curA = moisBudgetaire.value.an;
                        // v32.71 : l'horizon SUIT le sélecteur d'année de la Topbar (anneeAffichage).
                        //   Le solde se reporte de cycle en cycle : on chaîne donc TOUS les cycles
                        //   du cycle courant jusqu'à Décembre de l'exercice affiché.
                        //   Exercice passé sélectionné → on reste sur l'exercice courant (pas de projection arrière).
                        const cibleA = Math.max(Number(anneeAffichage.value) || curA, curA);
                        const cycles = [];
                        for (let a = curA; a <= cibleA; a++) {
                            for (let m = (a === curA ? curM : 1); m <= 12; m++) cycles.push(m + '-' + a);
                        }`);

/* 2. Année portée par chaque ligne + suffixe d'année sur les dates --------- */
sub(
`                            const mCyc = Number(String(cycles[_ci] || (curM + '-' + curA)).split('-')[0]) || curM;
                            const row = {
                                libelle: e.libelle,
                                montant: Number(e.montant) || 0,
                                jour: e.jourPrevu || null,
                                mois: mCyc,
                                moisLabel: _mAB[mCyc] || '',
                                dateLabel: (e.jourPrevu ? e.jourPrevu + ' ' : '') + (_mAB[mCyc] || ''),`,
`                            const _pc = String(cycles[_ci] || (curM + '-' + curA)).split('-').map(Number);
                            const mCyc = _pc[0] || curM, aCyc = _pc[1] || curA;
                            const row = {
                                libelle: e.libelle,
                                montant: Number(e.montant) || 0,
                                jour: e.jourPrevu || null,
                                mois: mCyc,
                                annee: aCyc,
                                moisLabel: _mAB[mCyc] || '',
                                // v32.71 : suffixe d'année dès que la projection déborde de l'exercice courant
                                dateLabel: (e.jourPrevu ? e.jourPrevu + ' ' : '') + (_mAB[mCyc] || '')
                                           + (cibleA > curA ? " '" + String(aCyc).slice(-2) : ''),`);

/* 3. Exposition de l'année cible ------------------------------------------ */
sub(
`                            moisFin: 'Décembre ' + curA
                        };`,
`                            moisFin: 'Décembre ' + cibleA,
                            anneeCible: cibleA
                        };`);

sub(
`totalSorties: 0, totalEntrees: 0, soldeFinal: 0, moisFin: '' };`,
`totalSorties: 0, totalEntrees: 0, soldeFinal: 0, moisFin: '', anneeCible: 0 };`);

/* 4. « Ouvrir le relevé complet » : même horizon que le KPI ---------------- */
sub(
`                        const curM = moisBudgetaire.value.mois, curA = moisBudgetaire.value.an;
                        ouvrirReleve(key);
                        anneesSelectionnees.value = [curA];
                        moisSelectionnes.value = Array.from({ length: 12 - curM + 1 }, (_, i) => curM + i);`,
`                        const curA = moisBudgetaire.value.an;
                        const cibleA = kpiDepensesAnnuelles.value.anneeCible || curA;
                        ouvrirReleve(key);
                        // v32.71 : même horizon que le KPI. cyclesReleveActifs fait le produit
                        // mois × années puis élague le passé → cycle courant … Décembre cibleA.
                        anneesSelectionnees.value = Array.from({ length: cibleA - curA + 1 }, (_, i) => curA + i);
                        moisSelectionnes.value = [1,2,3,4,5,6,7,8,9,10,11,12];`);

/* 5. Sous-titre des cartes : horizon visible ------------------------------- */
sub(
`<p class="text-[8px] font-bold uppercase text-gray-400">Reste -{{ formatMAD(kpiDepensesAnnuelles.totalSorties) }}</p>`,
`<p class="text-[8px] font-bold uppercase text-gray-400">Reste -{{ formatMAD(kpiDepensesAnnuelles.totalSorties) }} · fin {{ kpiDepensesAnnuelles.anneeCible }}</p>`);
sub(
`<span class="text-[7px] font-black uppercase text-gray-400">Reste -{{ formatMAD(kpiDepensesAnnuelles.totalSorties) }}</span>`,
`<span class="text-[7px] font-black uppercase text-gray-400">Reste -{{ formatMAD(kpiDepensesAnnuelles.totalSorties) }} · fin {{ kpiDepensesAnnuelles.anneeCible }}</span>`);

/* 6. Version + CHANGELOG --------------------------------------------------- */
sub(
`                    const CURRENT_VERSION = "32.70 Depenses-Annuelles";`,
`                    const CURRENT_VERSION = "32.71 Depenses-Annuelles-Annee";`);

sub(
`                    const CHANGELOG = [
`,
`                    const CHANGELOG = [
        { version: "32.71 Depenses-Annuelles-Annee", date: "2026-08-21", changes: [
            "FIX : le KPI Topbar « Dépenses Annuelles » ignorait le sélecteur d'année — l'horizon était figé sur Décembre de l'exercice courant. Il suit désormais anneeAffichage : passer la Topbar sur 2027 projette le compte du cycle courant jusqu'à Décembre 2027 (chaînage cumulatif des cycles, le solde se reportant d'un cycle au suivant).",
            "Une année passée sélectionnée ne déclenche aucune projection arrière : l'horizon reste l'exercice courant (Math.max).",
            "Tooltip : suffixe d'année ('27) sur les dates dès que la projection déborde de l'exercice courant, et l'atterrissage affiche « Décembre <année cible> ». Les cartes KPI (desktop + mobile) affichent « Reste -X · fin <année> ».",
            "Le bouton « Ouvrir le relevé complet » pré-sélectionne désormais la plage d'années courante→cible dans le popup RELEVÉ DE COMPTES, pour un horizon strictement identique à celui du KPI."
        ] },
`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ v32.71 appliquée');
