import fs from 'node:fs';
const FILE = new URL('./index.html', import.meta.url);
let s = fs.readFileSync(FILE, 'utf8');
const CRLF = s.includes('\r\n'); if (CRLF) s = s.split('\r\n').join('\n');
const sub = (from, to, n = 1) => { const c = s.split(from).length - 1;
    if (c !== n) throw new Error(`Ancre (${c}/${n}) : ${from.slice(0,110)}`); s = s.split(from).join(to); };

sub(`                    const CURRENT_VERSION = "37.4 Reponse-Jamais-Muette";`,
    `                    const CURRENT_VERSION = "37.5 Schema-Lisible-Gemini";`);

const E = [
`        { version: "37.5 Schema-Lisible-Gemini", date: "2026-09-23", changes: [`,
`            "CAUSE RÉELLE DE LA RÉPONSE MUETTE (exécution n8n #1005, « Lissage Dépenses Annuelles à 24 000 DH ») — l'agent échouait avec « Received tool input did not match expected schema — Required at calls[0].function / calls[0].args ». Ce n'était pas l'authentification.",`,
`            "MÉCANIQUE — la v37.0 avait ajouté au schéma de l'Intent Compiler un allOf de 19 if/then (requis par fonction). Gemini ne sait pas lire ces mots-clés : il ne voyait plus les champs function/args et envoyait un objet mal formé, que n8n rejetait AVANT l'outil. Preuve : les exécutions #996 à #1000 appelaient update_smart_goal correctement avec le même schéma sans allOf.",`,
`            "CORRECTIF — allOf retiré de tools_schema.php et du workflow (changement d'une ligne ; le reste du schéma est identique à l'octet près). Les requis par fonction restent imposés par la description de chaque fonction et par le moteur, qui refuse un paramètre manquant avec un message que le modèle lit et corrige. Vérifié en production : l'appel update_smart_goal {name, target_amount: 24000} arrive désormais intact.",`,
`            "VERROU — php tools_schema.php (donc --check et run_tests.sh) refuse tout mot-clé que Gemini ne comprend pas : allOf, anyOf, oneOf, not, if/then/else, const, $ref. L'ancien schéma en contenait 59.",`,
`            "SECOND BLOCAGE, DERRIÈRE — une fois l'appel réparé, pending_commit.php répondait 401 : n8n 2.x interdit $env dans les nœuds Code par défaut, donc FINANCE_USER/FINANCE_PASS étaient illisibles bien que définis. Il faut N8N_BLOCK_ENV_ACCESS_IN_NODE=false dans le docker-compose ; N8N_AUTH_CADDY.md l'indique désormais, avec la commande de vérification."`,
`        ] },`].join('\n');

sub(`                    const CHANGELOG = [\n`, `                    const CHANGELOG = [\n${E}\n`);
if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ version 37.5 + changelog');
