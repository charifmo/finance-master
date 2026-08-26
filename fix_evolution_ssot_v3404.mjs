/**
 * v34.04 — Le mode « Soldes » du Relevé rejoint le SSOT
 * ---------------------------------------------------------------------------
 * ANOMALIE : la vue Soldes affichait pour le Compte Courant −22 329 / −22 008 /
 * −20 453 / −20 048 de septembre à décembre, alors que le journal détaillé
 * donne −174 / +147 / +1 702 / +2 107.
 *
 * Signature du défaut : les VARIATIONS mensuelles sont identiques des deux
 * côtés (+321, +1 555, +405) — seul le point de départ diffère, d'exactement
 * 22 155 DH. C'est le même écart que celui corrigé en v34.01 : releveEvolution
 * était le dernier consommateur resté branché sur l'ancien moteur bilan
 * (bilanLignes[].detailsComptes), pendant que le journal et la bulle étaient
 * déjà passés sur _buildJournalReleve.
 *
 * Correctif : la vue Soldes calcule chaque palier avec le moteur du journal,
 * en chaînant du cycle courant jusqu'au mois affiché. Les trois vues — journal
 * détaillé, mode Soldes et bulle du dashboard — lisent désormais le même
 * moteur, donc affichent le même chiffre par construction.
 */
import fs from 'node:fs';

const FILE = new URL('./index.html', import.meta.url);
let s = fs.readFileSync(FILE, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.split('\r\n').join('\n');

const DEBUT = `                    const releveEvolution = computed(() => {`;
const FIN = `                    const deplacerDepense = (dep) => {`;
const i0 = s.indexOf(DEBUT), i1 = s.indexOf(FIN, i0);
if (i0 < 0 || i1 < 0) throw new Error('bloc releveEvolution introuvable');

const NOUVEAU = String.raw`                    // v34.04 : soldes issus du MOTEUR DU JOURNAL, plus de l'ancien bilan.
                    //   Pour chaque mois affiché, on rejoue la chaîne depuis le cycle courant
                    //   jusqu'à ce mois et on lit les soldes finaux. Le palier de décembre est
                    //   donc, au dirham près, l'atterrissage du journal détaillé.
                    const releveEvolution = computed(() => {
                        calculationTick.value;
                        const curM = moisBudgetaire.value.mois, curA = moisBudgetaire.value.an;
                        const _mNL = ['','Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

                        let aFs = anneesSelectionnees.value.slice();
                        let mFs = moisSelectionnes.value.slice();
                        // override cycle (releveActiveCycle) conservé pour compatibilité
                        const _acEv = releveActiveCycle.value;
                        if (_acEv) {
                            const _cdEv = cyclesDisponibles.value.find(c => c.key === _acEv);
                            if (_cdEv) {
                                aFs = [...new Set([_cdEv.an, _cdEv.anPrev])];
                                mFs = [...new Set([_cdEv.mois, _cdEv.moisPrev])];
                            }
                        }
                        if (!aFs.length) aFs = [curA];
                        if (!mFs.length) mFs = [1,2,3,4,5,6,7,8,9,10,11,12];

                        // Paliers à afficher : uniquement le présent et le futur
                        const cibles = [];
                        aFs.forEach(a => mFs.forEach(m => {
                            const an = Number(a), mo = Number(m);
                            if (an > curA || (an === curA && mo >= curM)) cibles.push({ a: an, m: mo });
                        }));
                        cibles.sort((x, y) => (x.a - y.a) || (x.m - y.m));
                        if (!cibles.length) return [];

                        const onglets = releveOnglets.value;
                        const comptesFiltres = releveComptesFiltres.value;
                        const tabsToShow = isGlobalView.value ? onglets : onglets.filter(t => comptesFiltres.includes(t.key));

                        const rows = [];
                        let gIdx = -1;
                        cibles.forEach(cible => {
                            const cycles = [];
                            for (let a = curA; a <= cible.a; a++) {
                                const finMois = (a === cible.a) ? cible.m : 12;
                                for (let m = (a === curA ? curM : 1); m <= finMois; m++) cycles.push(m + '-' + a);
                            }
                            const soldes = (_buildJournalReleve([], cycles) || {}).soldesFinaux || {};
                            gIdx++;
                            const label = (_mNL[cible.m] || '') + ' ' + cible.a;
                            tabsToShow.forEach((t, ti) => {
                                rows.push({ mois: label, _compteLabel: t.label, _compteIcon: t.icon, _compteKey: t.key,
                                            solde: Number(soldes[t.key]) || 0, _gMois: gIdx, _isNewMonth: ti === 0 });
                            });
                        });
                        return rows;
                    });

`;

s = s.slice(0, i0) + NOUVEAU + s.slice(i1);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ v34.04 appliquée');
