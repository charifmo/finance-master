import fs from 'node:fs';
const FILE = new URL('./index.html', import.meta.url);
let s = fs.readFileSync(FILE, 'utf8');
const CRLF = s.includes('\r\n'); if (CRLF) s = s.split('\r\n').join('\n');
const sub = (from, to, n = 1) => { const c = s.split(from).length - 1;
    if (c !== n) throw new Error(`Ancre (${c}/${n}) : ${from.slice(0,110)}`); s = s.split(from).join(to); };

sub(`                    const CURRENT_VERSION = "36.0 Contrat-Moteur";`,
    `                    const CURRENT_VERSION = "36.1 Epargne-Sans-Nom";`);

const E = [
`        { version: "36.1 Epargne-Sans-Nom", date: "2026-09-18", changes: [`,
`            "AUDIT DE CLÉS DEMANDÉ — résultat : AUCUN décalage. Le template lie goal.versement_mensuel (ligne 2263), migrateGoalV19 lit o.versement_mensuel (ligne 9566), le moteur écrit versement_mensuel. Même chose pour le bloc violet : obj.nom et obj.valeur, exactement ce que le moteur écrit. L'hypothèse d'un nom de clé divergent est écartée, preuve à l'appui.",`,
`            "LA VRAIE CAUSE — les lignes de virement n'ont PAS DE NOM. Le champ « Nom de l'objectif » est facultatif et reste vide en pratique : l'utilisateur désigne ses virements par leur destination (« VERS : Épargne Long Terme »), jamais par un libellé qu'il n'a pas saisi. Or le moteur ne résolvait QUE par nom : « Épargne Long Terme » ne correspondait à aucune ligne, et le résolveur répondait en clés techniques (ep_101, ep_102…) — inexploitables. Reproduit à l'identique avant correction : status=needs_clarification, aucune ligne touchée.",`,
`            "CORRECTIF — une ligne d'épargne se désigne désormais aussi par le libellé de son compte de DESTINATION (linkedAccountId) et de son compte SOURCE. Chaque désignation porte une priorité : un libellé réellement saisi prime toujours sur une désignation déduite, donc une ligne nommée « Bourse / CTO » n'entre pas en concurrence avec une ligne simplement liée au compte du même nom.",`,
`            "MESSAGES D'AMBIGUÏTÉ RÉPARÉS — « Précise : \\"Bourse / CTO\\" ou \\"Bourse / CTO\\" ? » était impossible à trancher. Chaque option indique maintenant d'où vient sa désignation et sa clé : « \\"Livret A\\" (compte lié) [ep_301] ou \\"Livret B\\" (compte lié) [ep_302] ». Et le relevé d'opérations nomme une ligne sans nom par sa destination (« → Épargne Long Terme ») au lieu d'une chaîne vide.",`,
`            "RÉPARATION DES DONNÉES DÉJÀ ÉCRITES — la v36.0 empêche les mauvaises écritures futures, elle ne répare pas le passé. repair_finance_data.php remet les virements 2027 aux valeurs demandées (urgence 4 000, dépenses annuelles 2 000, long terme 7 000) et DÉDUIT le versement mensuel de chaque Smart Goal du virement qui alimente le compte correspondant — via le même classement que le moteur, car un simple « contient » échouait sur « Fonds d'urgence » ↔ « Compte urgence ». Simulation par défaut, sauvegarde horodatée avant toute écriture.",`,
`            "CIBLES À 10 000 DH SIGNALÉES, PAS CORRIGÉES — deux objectifs portent exactement 10 000 DH : la valeur que l'ancien create_objectif inventait faute de cible valide (supprimée en v36.0). Le script les signale mais n'y touche pas : seul l'utilisateur connaît le vrai montant."`,
`        ] },`].join('\n');

sub(`                    const CHANGELOG = [\n`, `                    const CHANGELOG = [\n${E}\n`);
if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ version 36.1 + changelog');
