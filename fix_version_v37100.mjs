import fs from 'node:fs';
const FILE = new URL('./index.html', import.meta.url);
let s = fs.readFileSync(FILE, 'utf8');
const CRLF = s.includes('\r\n'); if (CRLF) s = s.split('\r\n').join('\n');
const sub = (from, to, n = 1) => { const c = s.split(from).length - 1;
    if (c !== n) throw new Error(`Ancre (${c}/${n}) : ${from.slice(0,110)}`); s = s.split(from).join(to); };

sub(`                    const CURRENT_VERSION = "37.9 Reparation-Et-Verdict";`,
    `                    const CURRENT_VERSION = "37.10 Oubli-Effectif";`);

const E = [
`        { version: "37.10 Oubli-Effectif", date: "2026-09-28", changes: [`,
`            "LE BOUTON « OUBLIER » NE POUVAIT PAS FONCTIONNER, ET LA CAUSE EST NETTE — le verrou de suppression n'acceptait qu'un identifiant ENTIER. Or le nœud PGVector de LangChain crée finance_vectors avec « id uuid PRIMARY KEY DEFAULT gen_random_uuid() » : chaque règle porte un UUID, et vos propres écrans l'affichaient (Règle #FE0505E9-BA36-4640-A0C4-8F076114FE92). Le serveur répondait donc invariablement ID_INVALIDE et la règle restait en base. Reproduit sur un PostgreSQL 16 à clés UUID : suppression refusée, ligne toujours présente.",`,
`            "CORRIGÉ ET RE-VÉRIFIÉ SUR LA MÊME BASE — entier ET uuid sont désormais reconnus, en liste blanche stricte, et le type RÉEL de la colonne est lu dans le catalogue pour choisir la comparaison (PostgreSQL ne compare pas un uuid à du texte sans transtypage explicite). Après correction : suppression acceptée, ligne effacée, liste qui ne la renvoie plus, archive qui conserve le vrai UUID. Une table à clés entières continue de fonctionner à l'identique, et une forme incompatible est refusée en le NOMMANT plutôt qu'en laissant remonter une erreur SQL.",`,
`            "L'ARCHIVE ÉTAIT ELLE AUSSI CASSÉE — elle écrivait (int)\\$ligne['id'], ce qui transformait un UUID en 0. Le filet de récupération aurait été inexploitable au moment précis où il aurait servi.",`,
`            "LES VERROUS N'ONT PAS BOUGÉ, ET C'EST MESURÉ — authentification en amont, en-tête anti-CSRF, origine identique, valeur toujours liée et jamais concaténée. Rejoués après la correction : injection SQL derrière un UUID valide refusée, UUID sans tirets refusé, entier sur colonne uuid refusé, requête sans en-tête refusée, origine étrangère refusée. 27 contrôles supplémentaires dans une suite dédiée.",`,
`            "SECONDE CAUSE, INDÉPENDANTE : UNE MÊME INFORMATION PEUT OCCUPER PLUSIEURS LIGNES. L'ingestion redécoupe et réindexe ; effacer l'une laissait les autres, sans que rien ne le dise. L'interface compte désormais les copies d'un même texte, les signale par un badge, et propose « Oublier les N copies » pour toutes les retirer d'un coup — chacune archivée séparément, un échec en cours de route étant rapporté au lieu d'être avalé.",`,
`            "ET CE QUI N'EST PAS UN BUG, MAIS QU'IL FALLAIT DIRE — l'agent relit les 8 derniers échanges de la conversation en cours (table chat_history). Une règle effacée du RAG peut donc encore être citée DANS cette conversation. C'est désormais indiqué après chaque suppression réussie, avec le geste qui règle la question : ouvrir une nouvelle conversation."`,
`        ] },`].join('\n');

sub(`                    const CHANGELOG = [\n`, `                    const CHANGELOG = [\n${E}\n`);
if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ version 37.10 + changelog');
