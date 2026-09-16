/**
 * v34.13 — Correctif : le "Total Chocs" comptait aussi les injections (argent qui ENTRE)
 * ---------------------------------------------------------------------------
 * DIAGNOSTIC (confirmé, pas supposé — capture fournie : Top 3 = 37 000 + 19 000
 *   + 8 000 = 64 000 DH, badge affichait "Total Chocs 485 290 DH")
 *
 *   v34.11 sommait Math.abs(montant) sur TOUTES les lignes de
 *   depensesIrregulieres, dépenses ET injections confondues — en suivant la
 *   formule demandée à l'époque. Mais une ligne à montant NÉGATIF dans ce
 *   tableau n'est pas une "dépense stockée avec le mauvais signe" : c'est une
 *   INJECTION délibérée — l'app l'étiquette elle-même "Injection Banque" dans
 *   son propre formulaire (remboursement, crédit débloqué...). L'exemple le
 *   plus parlant : injecterFluxCashStudio() pousse une ligne "Déblocage
 *   Crédit (Taxes + Surplus)" à montant NÉGATIF pouvant se chiffrer en
 *   centaines de milliers de DH pour un achat immobilier — exactement le
 *   genre de montant qui, une fois passé au Math.abs, suffit à expliquer
 *   l'écart entre 64 000 DH (le vrai poids) et 485 290 DH (le chiffre faux).
 *
 *   Le client confirme la définition attendue de "chocs" : les dépenses
 *   ponctuelles au sens propre — voyages, anniversaires, vidanges. Une entrée
 *   d'argent n'est jamais un "choc" à ajouter au poids, quel que soit son
 *   signe de stockage.
 *
 * CORRECTIF — pas un nouveau calcul, une correction de référence
 *   chocsSorties (déjà calculé juste au-dessus, déjà filtré par le même
 *   `chocs` que top3Chocs et par le toggle _inclureLT) EST la somme brute des
 *   seules lignes de dépense de l'année — exactement "Total Chocs". Le
 *   Math.abs sur l'ensemble du tableau (v34.11) est supprimé ; totalChocsAnnuel
 *   devient un alias de chocsSorties. Bénéfice additionnel : le badge devient
 *   interne cohérent — top3, % et total viennent enfin tous de la même liste
 *   filtrée, ce qui n'était pas le cas en v34.11 (le total, lui, ignorait
 *   _inclureLT).
 * ══════════════════════════════════════════════════════════════════════════
 */
import fs from 'node:fs';

const FILE = new URL('./index.html', import.meta.url);
let s = fs.readFileSync(FILE, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.split('\r\n').join('\n');
const sub = (from, to, n = 1) => {
    const c = s.split(from).length - 1;
    if (c !== n) throw new Error(`Ancre (${c}/${n}) :\n${from.slice(0, 220)}`);
    s = s.split(from).join(to);
};

sub(
`                        const netAnnuel = chocsSorties - chocsEntrees;
                        // v34.11 : total BRUT (poids réel) — somme des valeurs absolues de
                        //   TOUTES les lignes de l'année, dépenses ET injections confondues.
                        //   Non filtré par _inclureLT : le panneau "Flux Exceptionnels" auquel
                        //   ce total doit correspondre au dirham près ne filtre pas non plus.
                        const totalChocsAnnuel = (Array.isArray(d.depensesIrregulieres) ? d.depensesIrregulieres : [])
                            .filter(c => Number(c.annee) === Number(anneeAffichage.value))
                            .reduce((sum, c) => sum + Math.abs(Number(c.montant) || 0), 0);`,
`                        const netAnnuel = chocsSorties - chocsEntrees;
                        // v34.13 : "Total Chocs" = chocsSorties, PAS Math.abs(tout le tableau).
                        //   Une ligne à montant négatif est une INJECTION (l'app l'étiquette
                        //   elle-même "Injection Banque" — remboursement, crédit débloqué :
                        //   voir injecterFluxCashStudio). Ce n'est jamais un "choc" au sens où
                        //   le client l'entend (voyages, anniversaires, vidanges) : l'ajouter au
                        //   poids via Math.abs (v34.11) gonflait le total de tout déblocage de
                        //   crédit ou remboursement exceptionnel de l'année. chocsSorties est
                        //   déjà la somme des seules lignes de dépense, déjà filtrée par le même
                        //   tableau "chocs" que top3Chocs (_inclureLT) — total, top3 et % viennent
                        //   enfin tous de la même liste.
                        const totalChocsAnnuel = chocsSorties;`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ v34.13 — Total Chocs = chocsSorties (injections exclues)');
