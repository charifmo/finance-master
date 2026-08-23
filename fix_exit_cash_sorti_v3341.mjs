/**
 * v33.41 — Simulateur de sortie : corriger l'effort cumulé
 * ---------------------------------------------------------------------------
 * BUG : « C · Cash sorti » ne comptait que les échéances À VENIR sur l'horizon
 * choisi, en ignorant tout ce qui a déjà été versé depuis le déblocage.
 * Sur l'Appartement Almaz (66 mois payés à 8 332 DH), 549 912 DH d'effort
 * disparaissaient : le simulateur annonçait un gain de +80 563 DH à l'année 1
 * là où l'opération est en réalité largement déficitaire à cette date.
 *
 * L'effort cumulé se compte depuis l'ORIGINE : apport + toutes les échéances
 * versées (passées + futures) + frais et travaux initiaux.
 *
 * Corrige aussi :
 *  - le libellé B, qui mélangeait « capital restant dû » (crédit classique) et
 *    « solde de rachat marge non échue comprise » (Mourabaha) ;
 *  - la borne du curseur, calée sur la durée totale au lieu des mois restants.
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
   1. Borne du curseur : années de crédit RESTANTES
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                    const exitMaxAnnees = (a) => {
                        const n = Math.round(N((a || {}).duree_mois) / 12);
                        return n > 0 ? n : 20;
                    };`,
`                    const exitMaxAnnees = (a) => {
                        // v33.41 : on borne sur ce qu'il RESTE à courir, pas sur la durée
                        // totale — 66 mois déjà payés sur 180 laissent 9,5 ans, pas 15.
                        const reste = Math.max(0, Math.round(N((a || {}).duree_mois)) - moisPayesEffectifs(a || {}));
                        const n = Math.ceil(reste / 12);
                        return n > 0 ? n : 20;
                    };`);

/* ══════════════════════════════════════════════════════════════════════════
   2. exitSim : effort cumulé depuis l'origine
   ══════════════════════════════════════════════════════════════════════════ */
sub(
`                        // B — capital restant dû à la fin de l'année N
                        let crd = 0, detailIbraa = null;
                        if (N(a.montant_credit) > 0 && N(a.duree_mois) > 0) {
                            if (String(a.type_credit) === 'mourabaha') {
                                // Mourabaha : ce qu'il faut réellement verser pour solder,
                                // marge non échue comprise, diminuée de l'Ibra'a.
                                const sa = soldeAnticipe(a, Math.round(N(a.mois_deja_payes)) + An * 12);
                                crd = sa.solde; detailIbraa = sa;
                            } else {
                                crd = amortissementAnnuel(a, An - 1).capitalRestant;
                            }
                        }`,
`                        // B — ce qu'il reste à solder à la fin de l'année N
                        //   classique → capital restant dû
                        //   Mourabaha → solde de rachat : capital + marge non échue − Ibra'a
                        const moisDejaPayes = moisPayesEffectifs(a);
                        let crd = 0, detailIbraa = null;
                        const estMourabaha = String(a.type_credit) === 'mourabaha';
                        if (N(a.montant_credit) > 0 && N(a.duree_mois) > 0) {
                            if (estMourabaha) {
                                const sa = soldeAnticipe(a, moisDejaPayes + An * 12);
                                crd = sa.solde; detailIbraa = sa;
                            } else {
                                crd = amortissementAnnuel(a, An - 1).capitalRestant;
                            }
                        }`);

sub(
`                        // C — cash sorti (effort cumulé)
                        const mens = N(a.mensualite) > 0 ? N(a.mensualite)
                                   : mensualiteClassique(a.montant_credit, a.taux_credit, a.duree_mois);
                        // les échéances s'arrêtent à la fin du crédit
                        const moisEcheances = N(a.montant_credit) > 0
                            ? Math.min(An * 12, Math.max(0, Math.round(N(a.duree_mois) - N(a.mois_deja_payes))))
                            : 0;
                        const fraisInit = coutTotalRevient(a) - N(a.prix_acquisition);
                        const cashSorti = N(a.apport_personnel) + (mens + N(a.assurance_mensuelle)) * moisEcheances + fraisInit;`,
`                        // C — cash sorti : effort cumulé DEPUIS L'ORIGINE
                        //   apport + toutes les échéances versées (déjà payées + à venir
                        //   jusqu'à la revente, plafonnées au terme) + frais et travaux.
                        //   v33.41 : les mensualités déjà versées étaient omises.
                        const p = creditParams(a);
                        const mens = p.mens > 0 ? p.mens
                                   : mensualiteClassique(a.montant_credit, a.taux_credit, a.duree_mois);
                        const echeanceTotale = mens + N(a.assurance_mensuelle);
                        const aUnCredit = N(a.montant_credit) > 0 || N(a.capital_initial) > 0;
                        const moisRestants = aUnCredit ? Math.max(0, Math.round(N(a.duree_mois)) - moisDejaPayes) : 0;
                        const moisFuturs = Math.min(An * 12, moisRestants);
                        const moisEcheances = aUnCredit ? moisDejaPayes + moisFuturs : 0;
                        const fraisInit = coutTotalRevient(a) - N(a.prix_acquisition);
                        const cashSorti = N(a.apport_personnel) + echeanceTotale * moisEcheances + fraisInit;`);

sub(
`                            cashSorti: r0(cashSorti), mensualite: r0(mens),
                            moisEcheances, fraisInit: r0(fraisInit),`,
`                            cashSorti: r0(cashSorti), mensualite: r0(mens),
                            moisEcheances, moisDejaPayes, moisFuturs, estMourabaha,
                            echeanceTotale: r0(echeanceTotale),
                            dejaVerse: r0(echeanceTotale * moisDejaPayes),
                            fraisInit: r0(fraisInit),`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ v33.41 effort cumulé corrigé');
