import fs from 'node:fs';
const FILE = new URL('./index.html', import.meta.url);
let s = fs.readFileSync(FILE, 'utf8');
const CRLF = s.includes('\r\n'); if (CRLF) s = s.split('\r\n').join('\n');
const sub = (from, to, n = 1) => { const c = s.split(from).length - 1;
    if (c !== n) throw new Error(`Ancre (${c}/${n}) : ${from.slice(0,110)}`); s = s.split(from).join(to); };

sub(`                    const CURRENT_VERSION = "37.2 Caddy-Et-Oubli";`,
    `                    const CURRENT_VERSION = "37.4 Reponse-Jamais-Muette";`);

const E = [
`        { version: "37.4 Reponse-Jamais-Muette", date: "2026-09-23", changes: [`,
`            "BUG SIGNALÉ — le CFO répondait « {\\"session_id\\":\\"c44fdff8-…\\"} » dans la bulle de conversation, au lieu d'une réponse. Mécanique exacte : le nœud « Respond Webhook » construit { html: $('AI Agent')…json.output, session_id: … }, et le nœud « AI Agent » porte continueOnFail. Quand l'agent échoue, n8n émet un item SANS clé output ; JSON.stringify supprime les valeurs undefined, il ne reste donc que { session_id }. Côté application, le dernier repli de lecture était « || raw » : le JSON entier atterrissait dans la bulle.",`,
`            "CE QUI RENDAIT LA PANNE INDIAGNOSTICABLE — l'échec réel de l'agent (401, outil en erreur, itérations épuisées) n'apparaissait NULLE PART. L'utilisateur voyait un identifiant de session et devait deviner. Une erreur silencieuse coûte plus cher que l'erreur elle-même.",`,
`            "CORRECTIF APPLICATION — un lecteur unique (_lireReponseCFO) remplace les trois copies divergentes de « j.html || j.output || … || raw » (chat CFO et deux points de la bulle Merlin). Faute de contenu, il ne recopie JAMAIS le JSON : il affiche la cause quand le workflow l'a jointe, sinon explique que le nœud AI Agent a échoué et où regarder. Le contenu remonté est échappé — une cause hostile ne peut pas s'injecter dans la bulle.",`,
`            "CORRECTIF WORKFLOW — le responder émet désormais html TOUJOURS présent (chaîne vide plutôt qu'undefined, que JSON.stringify supprimerait) et joint erreur avec le message de l'agent. Vérifié en simulant les trois états (échec, succès, sortie vide) sur l'expression réelle extraite du fichier.",`,
`            "L'APPLICATION SEULE SUFFIT — testée contre l'ancien format de réponse : même sans réimport du workflow n8n, la bulle affiche une explication au lieu du JSON brut. Le réimport ajoute la cause précise, il n'est pas nécessaire pour que le symptôme disparaisse."`,
`        ] },`].join('\n');

sub(`                    const CHANGELOG = [\n`, `                    const CHANGELOG = [\n${E}\n`);
if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ version 37.4 + changelog');
