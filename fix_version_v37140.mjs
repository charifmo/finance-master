import fs from 'node:fs';
const FILE = new URL('./index.html', import.meta.url);
let s = fs.readFileSync(FILE, 'utf8');
const CRLF = s.includes('\r\n'); if (CRLF) s = s.split('\r\n').join('\n');
const sub = (from, to, n = 1) => { const c = s.split(from).length - 1;
    if (c !== n) throw new Error(`Ancre (${c}/${n}) : ${from.slice(0,110)}`); s = s.split(from).join(to); };

sub(`                    const CURRENT_VERSION = "37.13 Inbox-Zero";`,
    `                    const CURRENT_VERSION = "37.14 Mois-Budgetaire";`);

const E = [
`        { version: "37.14 Mois-Budgetaire", date: "2026-09-28", changes: [`,
`            "D'ABORD CE QUI ÉTAIT DÉJÀ JUSTE, PARCE QUE ÇA CHANGE LE DIAGNOSTIC — mesuré avant de toucher au code, sur le cas exact du ticket (revenu « Appartement » avec exception M9, cycle 27 sep → 26 oct) : moisBudgetaire vaut bien 10, getDueRevenu rend 4 000 DH et non 0, et la charge apparaît au montant plein dans la checklist. Le Pilotage RÉALISÉ n'a jamais appliqué l'exception M9 au cycle d'octobre. Le Relevé non plus : son évaluateur reçoit le mois du cycle qu'il construit. La notion de mois budgétaire existait déjà et fonctionnait — sur ces deux surfaces.",`,
`            "CE QUI ÉTAIT FAUX, ET QUI EXPLIQUE CE QUE VOUS VOYIEZ — le Pilotage THÉORIQUE n'appliquait les exceptions qu'aux CHARGES FIXES. Les revenus, les charges variables et l'épargne passaient en valeur brute, sans jamais regarder leurs règles. Un revenu suspendu s'affichait donc plein dans un écran et à zéro dans l'autre : deux vérités pour la même donnée.",`,
`            "LA FAUTE LA PLUS COÛTEUSE — surplusBudgetaireAnnuel, le surplus qui alimente TOUT le simulateur, faisait « valeur × 12 » sans jamais lire les exceptions. Un revenu suspendu trois mois était compté douze, et l'écart repartait dans chaque ligne de projection. Il se compte désormais mois budgétaire par mois budgétaire, chacun évalué avec ses propres règles. Vérifié : retirer une exception d'un mois fait bouger le surplus annuel d'exactement un mois de ce flux — auparavant, de zéro.",`,
`            "TROISIÈME TROU — la checklist prenait le montant brut du détail d'une charge variable en ignorant l'exception portée par sa CATÉGORIE. Or c'est là qu'elle se règle : le formulaire ne propose pas de règle sur une ligne de détail. Suspendre « Factures » laissait donc « élect » à traiter.",`,
`            "UN SEUL ÉVALUATEUR, PARTOUT — valeurEffective(item, base, moisBudgétaire) tranche désormais pour les deux getters centraux, le Pilotage Théorique, la checklist du Réalisé, le journal du Relevé, les flux mensuels et le surplus annuel. Le mois qu'on lui passe est TOUJOURS un mois budgétaire, jamais un mois civil. En rétro-navigation, c'est le mois du cycle CONSULTÉ, pas celui du cycle en cours.",`,
`            "PREUVE DE NON-RÉGRESSION — la nouvelle suite construit son jeu de données autour de la date du jour (jour de paie posé à hier, pour que mois civil de début ≠ mois budgétaire) et pose, pour chaque famille de flux, une paire : l'une suspendue sur le mois civil, l'autre sur le mois budgétaire. La première doit rester due, la seconde tomber à zéro. Rejouée contre la v37.13, elle échoue sur 6 contrôles ; sur la v37.14, elle passe. 17 suites vertes."`,
`        ] },`].join('\n');

sub(`                    const CHANGELOG = [\n`, `                    const CHANGELOG = [\n${E}\n`);
if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ version 37.14 + changelog');
