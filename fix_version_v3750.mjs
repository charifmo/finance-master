import fs from 'node:fs';
const FILE = new URL('./index.html', import.meta.url);
let s = fs.readFileSync(FILE, 'utf8');
const CRLF = s.includes('\r\n'); if (CRLF) s = s.split('\r\n').join('\n');
const sub = (from, to, n = 1) => { const c = s.split(from).length - 1;
    if (c !== n) throw new Error(`Ancre (${c}/${n}) : ${from.slice(0,110)}`); s = s.split(from).join(to); };

sub(`                    const CURRENT_VERSION = "37.4 Reponse-Jamais-Muette";`,
    `                    const CURRENT_VERSION = "37.5 Dates-Tolerantes";`);

const E = [
`        { version: "37.5 Dates-Tolerantes", date: "2026-09-24", changes: [`,
`            "CAUSE DE LA PANNE TROUVÉE — « met une date cible pr chaque objectif » ne renvoyait aucune réponse. La v36.0 n'acceptait pour date_cible que le format AAAA-MM et REJETAIT tout le reste EN SILENCE, à commencer par « 2027-12-31 » qui est la forme la plus naturelle. Le champ disparaissait, l'opération échouait faute de champ modifiable — et le message d'erreur réclamait… date_cible. Contradiction parfaite : le modèle reessayait, en boucle, jusqu'à épuiser ses 20 itérations. L'agent mourait alors sans produire de sortie, d'où le {\\"session_id\\"} affiché.",`,
`            "CORRECTIF — on CONVERTIT au lieu d'exiger une forme précise. AAAA-MM, AAAA-MM-JJ, l'ISO complet, JJ/MM/AAAA, MM/AAAA, « décembre 2027 », « dec 2027 », « December 2027 », « fin 2027 » et une année seule sont tous ramenés au AAAA-MM que l'application attend (input type=\\"month\\"). Une date réellement illisible n'est plus ignorée : elle est refusée en NOMMANT le champ et en listant les formats acceptés, pour que le modèle corrige en un tour au lieu de boucler.",`,
`            "UN OUTIL NE DOIT PLUS TUER L'AGENT — le nœud Intent Compiler levait une exception sur ERROR_OUT_OF_CATALOG. Comme le nœud AI Agent porte continueOnFail, une exception le laisse sans champ output : l'utilisateur reçoit une réponse vide, sans la moindre explication. L'intention (empêcher le modèle d'enchaîner sur une autre fonction) était bonne, le moyen mauvais. L'erreur est désormais RETOURNÉE avec le catalogue réel et la consigne de ne pas substituer — le modèle peut l'expliquer, ce qu'un agent mort ne peut pas faire.",`,
`            "LEÇON RETENUE — un champ fourni puis ignoré en silence est pire qu'un champ refusé. Le contrat d'arguments (v36.0) signalait déjà les paramètres inconnus et les valeurs hors bornes ; les dates échappaient à ce filet parce qu'elles étaient validées plus loin, dans la fonction d'application. Elles rejoignent le contrat, où le reste est déjà contrôlé."`,
`        ] },`].join('\n');

sub(`                    const CHANGELOG = [\n`, `                    const CHANGELOG = [\n${E}\n`);
if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ version 37.5 + changelog');
