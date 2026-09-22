import fs from 'node:fs';
const FILE = new URL('./index.html', import.meta.url);
let s = fs.readFileSync(FILE, 'utf8');
const CRLF = s.includes('\r\n'); if (CRLF) s = s.split('\r\n').join('\n');
const sub = (from, to, n = 1) => { const c = s.split(from).length - 1;
    if (c !== n) throw new Error(`Ancre (${c}/${n}) : ${from.slice(0,110)}`); s = s.split(from).join(to); };

sub(`                    const CURRENT_VERSION = "37.1 Supervision-Epuree";`,
    `                    const CURRENT_VERSION = "37.2 Caddy-Et-Oubli";`);

const E = [
`        { version: "37.2 Caddy-Et-Oubli", date: "2026-09-22", changes: [`,
`            "JETON APPLICATIF RETIRÉ — il aurait dû être écrit en clair dans index.html pour que l'interface s'en serve, donc lisible par quiconque affiche la source. Une sécurité en trompe-l'œil vaut moins que pas de sécurité, parce qu'elle rassure à tort. La protection passe à Caddy (basic_auth sur /finance/), documentée dans CADDY_SECURITE.md : elle couvre TOUTE l'application, y compris save_data.php qui acceptait jusqu'ici d'écraser l'intégralité de l'état financier sans le moindre contrôle.",`,
`            "SUPPRESSION D'UNE RÈGLE MÉMORISÉE — icône 🗑️ sur chaque carte, confirmation qui RAPPELLE le texte visé (demander « voulez-vous supprimer ? » sans dire quoi invite à cliquer oui par réflexe), retrait immédiat de la liste puis rechargement. POST {action:'delete_vector', id:N} vers get_ai_memory.php.",`,
`            "LE CODE NE FAIT PAS CONFIANCE AVEUGLÉMENT — entre un git pull et la mise à jour du Caddyfile, il existe une fenêtre où un endpoint de destruction serait ouvert à tout internet. Le serveur cherche donc la PREUVE d'une authentification amont (PHP_AUTH_USER, REMOTE_USER, en-tête Authorization Basic) et refuse toute suppression à défaut — la lecture, elle, continue. Échouer en refusant de détruire, jamais en détruisant.",`,
`            "ANTI-CSRF — une authentification basique est rejouée automatiquement par le navigateur : un site tiers pourrait déclencher une suppression à votre insu. La requête doit porter un en-tête que seul du JavaScript peut poser (donc soumis au contrôle CORS) et provenir de la même origine. Identifiant contrôlé comme entier strictement positif, requête préparée.",`,
`            "FILET DE RÉCUPÉRATION — toute règle supprimée est archivée en JSONL (texte, métadonnées, auteur, horodatage) AVANT l'exécution du DELETE. Si l'archive ne peut pas être écrite, la suppression est ANNULÉE. « Définitivement » se dit à l'utilisateur, pas à la base.",`,
`            "VÉRIFIÉ contre un vrai PostgreSQL : refus sans authentification (base intacte), suppression effective derrière auth avec archivage nominatif, et six garde-fous exercés — en-tête CSRF absent, origine étrangère, identifiant non entier (tentative d'injection SQL), identifiant négatif, identifiant inexistant, action inconnue."`,
`        ] },`].join('\n');

sub(`                    const CHANGELOG = [\n`, `                    const CHANGELOG = [\n${E}\n`);
if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ version 37.2 + changelog');
