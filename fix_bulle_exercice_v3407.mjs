/**
 * v34.07 — Bulle « Dépenses Annuelles » : bornage sur l'exercice affiché
 * ---------------------------------------------------------------------------
 * La bulle chaînait les cycles du cycle courant jusqu'à Décembre de l'exercice
 * affiché, puis montrait TOUT le chaînage. En vue 2027 elle affichait donc le
 * solde T0 de septembre 2026 en tête, les obligations de fin 2026 dans la
 * liste, et des totaux qui mélangeaient deux exercices — alors que
 * l'atterrissage, lui, était juste.
 *
 * Le chaînage n'est PAS le problème : c'est lui qui donne le solde d'ouverture
 * de 2027 (l'atterrissage au 31 décembre 2026). Ce qu'il manquait, c'est la
 * FENÊTRE : ce qui précède l'exercice affiché est déjà contenu dans le solde
 * d'ouverture, le réafficher ligne à ligne le compte deux fois à l'œil.
 *
 *  1. Solde d'ouverture contextualisé.
 *     Exercice courant → solde instantané T0 (pivot ⏰ AUJOURD'HUI du Relevé).
 *     Exercice futur   → solde APRÈS la dernière ligne de l'exercice précédent,
 *                        c'est-à-dire l'atterrissage du 31 décembre d'avant.
 *                        Le libellé suit : « 🔮 Solde initial 2027 ».
 *  2. Lignes filtrées sur `annee === anneeCible`. En vue 2027 la liste démarre
 *     à la première obligation de 2027, plus une seule ligne de 2026.
 *  3. Totaux (Σ Reste à payer, Alimentations prévues) sommés sur ces seules
 *     lignes, et en-têtes millésimés.
 *
 *  INVARIANT GARANTI PAR CONSTRUCTION — aucune ligne ne s'intercale entre la
 *  dernière ligne de l'exercice précédent et la première de l'exercice affiché
 *  (le journal est chronologique et contigu), donc :
 *      atterrissage = ouverture + alimentations − obligations
 *  et l'atterrissage reste celui du moteur (`j.soldeAtterrissage`), inchangé,
 *  donc toujours égal au KPI du bandeau.
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
   1. MOTEUR — kpiDepensesAnnuelles borné à l'exercice affiché
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                        const j = _buildJournalReleve([key], cycles);

                        let soldeActuel = Number(cpt.solde) || 0;
                        const sorties = [], entrees = [];
                        let _ci = 0;
                        (j.entries || []).forEach(e => {
                            if (e.type === 'cycle_sep') { _ci++; return; }
                            if (e.type === 'initial') { soldeActuel = Number(e.montant) || 0; return; }
                            const _pc = String(cycles[_ci] || (curM + '-' + curA)).split('-').map(Number);
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
                                           + (cibleA > curA ? " '" + String(aCyc).slice(-2) : ''),
                                soldeApres: Number(e.soldeCompteApres) || 0
                            };
                            (e.type === 'credit' ? entrees : sorties).push(row);
                        });

                        const _r2 = (v) => Math.round(v * 100) / 100;
                        return {
                            exists: true,
                            key,
                            label: cpt.label || cpt.nom || 'Dépenses Annuelles',
                            icone: cpt.icone || '📅',
                            soldeActuel,                                        // solde instantané (T0)
                            sorties,                                            // obligations non soldées de ce compte
                            entrees,                                            // alimentations / versements prévus
                            nbSorties: sorties.length,
                            totalSorties: _r2(sorties.reduce((a, r) => a + r.montant, 0)),  // = reste à payer
                            totalEntrees: _r2(entrees.reduce((a, r) => a + r.montant, 0)),
                            soldeFinal: _r2(Number(j.soldeAtterrissage || 0)),  // atterrissage projeté
                            moisFin: 'Décembre ' + cibleA,
                            anneeCible: cibleA
                        };
                    });`,
`                        const j = _buildJournalReleve([key], cycles);
                        const estExerciceFutur = cibleA > curA;

                        // v34.07 : on collecte TOUT le chaînage (il porte le report de solde),
                        //   puis on le borne à l'exercice affiché. Les deux temps sont distincts :
                        //   le chaînage calcule, la fenêtre montre.
                        let soldeT0 = Number(cpt.solde) || 0;
                        const lignes = [];
                        let _ci = 0;
                        (j.entries || []).forEach(e => {
                            if (e.type === 'cycle_sep') { _ci++; return; }
                            if (e.type === 'initial') { soldeT0 = Number(e.montant) || 0; return; }
                            const _pc = String(cycles[_ci] || (curM + '-' + curA)).split('-').map(Number);
                            const mCyc = _pc[0] || curM, aCyc = _pc[1] || curA;
                            lignes.push({
                                libelle: e.libelle,
                                montant: Number(e.montant) || 0,
                                type: e.type,
                                jour: e.jourPrevu || null,
                                mois: mCyc,
                                annee: aCyc,
                                moisLabel: _mAB[mCyc] || '',
                                // v32.71 : suffixe d'année dès que la projection déborde de l'exercice courant
                                dateLabel: (e.jourPrevu ? e.jourPrevu + ' ' : '') + (_mAB[mCyc] || '')
                                           + (estExerciceFutur ? " '" + String(aCyc).slice(-2) : ''),
                                soldeApres: Number(e.soldeCompteApres) || 0
                            });
                        });

                        // ── Solde d'OUVERTURE de l'exercice affiché ──────────────────────
                        //   Exercice courant → le solde instantané T0 (⏰ AUJOURD'HUI).
                        //   Exercice futur   → le solde APRÈS la dernière ligne de l'exercice
                        //     précédent = l'atterrissage du 31 décembre d'avant. Le journal
                        //     étant chronologique et contigu, rien ne s'intercale entre cette
                        //     ligne et la première de l'exercice affiché : l'invariant
                        //     « atterrissage = ouverture + entrées − sorties » est exact.
                        //   Aucune ligne antérieure (exercice futur sans mouvement d'ici là)
                        //     → l'ouverture vaut T0, ce qui est la bonne réponse.
                        let soldeOuverture = soldeT0;
                        if (estExerciceFutur) {
                            for (let i = lignes.length - 1; i >= 0; i--) {
                                if (lignes[i].annee < cibleA) { soldeOuverture = lignes[i].soldeApres; break; }
                            }
                        }

                        // ── Fenêtre : uniquement les lignes de l'exercice affiché ─────────
                        const _lignesEx = lignes.filter(r => r.annee === cibleA);
                        const sorties = _lignesEx.filter(r => r.type !== 'credit');
                        const entrees = _lignesEx.filter(r => r.type === 'credit');

                        const _r2 = (v) => Math.round(v * 100) / 100;
                        return {
                            exists: true,
                            key,
                            label: cpt.label || cpt.nom || 'Dépenses Annuelles',
                            icone: cpt.icone || '📅',
                            estExerciceFutur,
                            // v34.07 : le libellé dit ce que le chiffre est vraiment
                            labelSoldeInitial: estExerciceFutur ? ('🔮 Solde initial ' + cibleA) : '⏰ Solde actuel',
                            soldeActuel: _r2(soldeOuverture),                   // ouverture de l'exercice affiché
                            soldeT0: _r2(soldeT0),                              // solde instantané, hors fenêtre
                            sorties,                                            // obligations de l'exercice affiché
                            entrees,                                            // alimentations de l'exercice affiché
                            nbSorties: sorties.length,
                            totalSorties: _r2(sorties.reduce((a, r) => a + r.montant, 0)),  // = reste à payer
                            totalEntrees: _r2(entrees.reduce((a, r) => a + r.montant, 0)),
                            soldeFinal: _r2(Number(j.soldeAtterrissage || 0)),  // atterrissage projeté (moteur, inchangé)
                            moisFin: 'Décembre ' + cibleA,
                            anneeCible: cibleA
                        };
                    });`);

/* ══════════════════════════════════════════════════════════════════════════
   2. UI — libellés contextualisés (desktop + mobile : 2 occurrences chacun)
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                                    <span class="text-[9px] font-black uppercase tracking-widest text-gray-400">⏰ Solde actuel</span>`,
`                                    <span class="text-[9px] font-black uppercase tracking-widest text-gray-400">{{ kpiDepensesAnnuelles.labelSoldeInitial }}</span>`,
    2);

sub(
`                                    <span class="text-[8px] font-black uppercase tracking-widest text-gray-500">📌 Obligations à venir</span>`,
`                                    <span class="text-[8px] font-black uppercase tracking-widest text-gray-500">📌 Obligations {{ kpiDepensesAnnuelles.anneeCible }}</span>`,
    2);

sub(
`                                    <span class="text-[9px] font-black uppercase tracking-widest text-gray-500">💎 Alimentations prévues</span>`,
`                                    <span class="text-[9px] font-black uppercase tracking-widest text-gray-500">💎 Alimentations {{ kpiDepensesAnnuelles.anneeCible }}</span>`,
    2);

sub(
`                                    <span class="text-[9px] font-black uppercase tracking-widest text-gray-400">Σ Reste à payer</span>`,
`                                    <span class="text-[9px] font-black uppercase tracking-widest text-gray-400">Σ Reste à payer {{ kpiDepensesAnnuelles.anneeCible }}</span>`,
    2);

/* ── Commentaire du bloc pivot : il ne décrit plus le bon objet ──────────── */
sub(
`                                <!-- Solde instantané (T0) — miroir du pivot ⏰ AUJOURD'HUI du Relevé -->`,
`                                <!-- v34.07 : ouverture de l'exercice affiché — T0 sur l'exercice courant,
                                     atterrissage du 31 décembre précédent sur un exercice futur -->`,
    2);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ v34.07 — bulle Dépenses Annuelles bornée à l\'exercice affiché');
