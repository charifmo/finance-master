import fs from 'node:fs';
const FILE = new URL('./index.html', import.meta.url);
let s = fs.readFileSync(FILE, 'utf8');
const CRLF = s.includes('\r\n'); if (CRLF) s = s.split('\r\n').join('\n');
const sub = (from, to, n = 1) => { const c = s.split(from).length - 1;
    if (c !== n) throw new Error(`Ancre (${c}/${n}) : ${from.slice(0,110)}`); s = s.split(from).join(to); };

sub(`                    const CURRENT_VERSION = "36.1 Epargne-Sans-Nom";`,
    `                    const CURRENT_VERSION = "37.0 Integrite-Supervision";`);

const E = [
`        { version: "37.0 Integrite-Supervision", date: "2026-09-21", changes: [`,
`            "CAUSE RACINE DES LIBELLÉS VIDES — trouvée, et ce n'était ni l'interface ni l'agent. cfo_sanitize_finance_data SUPPRIMAIT la clé `+"`nom`"+` de chaque ligne d'épargne, en la traitant comme un simple synonyme de `+"`label`"+`. Or c'est précisément `+"`obj.nom`"+` que le template Vue affiche (index.html:2408 desktop, 3569 mobile) : chaque commit du CFO vidait donc le champ « Nom de l'objectif » de TOUTES les lignes, de TOUS les exercices. Pour les revenus et les charges l'interface lit bien `+"`label`"+`, la purge y reste correcte — l'épargne était le seul cas inversé. Ma réponse précédente attribuait ces noms vides à une saisie utilisateur : c'était faux.",`,
`            "COUCHE D'INTÉGRITÉ UNIQUE (cfo_integrity.php) — une seule définition de « donnée saine », deux points d'appel : le moteur à chaque écriture, et le balayage de réparation sur l'historique. Elle garantit qu'aucun libellé vide, montant non numérique, signe incohérent ou compte lié fantôme n'atteint le disque. Chaque correction est RAPPORTÉE (integrite_corrections) : rien ne se répare en silence.",`,
`            "AUTO-NOMMAGE CONTEXTUEL — un libellé manquant n'est pas remplacé par « Sans nom », qui ne renseigne personne et réintroduirait le problème. Un virement prend le nom de son compte de destination (« Virement vers Épargne Long Terme »), une dépense ponctuelle son mois et son sens (une dépense négative est une ENTRÉE d'argent), un objectif sa cible.",`,
`            "ÉTANCHÉITÉ PRÉSERVÉE — l'intégrité à l'écriture est bornée aux exercices ciblés. Un exercice hors périmètre n'est pas touché, même pour être « réparé » : le scellé prime sur la bonne intention. Le balayage global, lui, est explicite et lancé à la main.",`,
`            "SCHÉMA n8n VERROUILLÉ PAR FONCTION — un schéma qui liste tous les paramètres possibles n'impose rien. Un allOf de if/then rend désormais chaque champ vital obligatoire POUR SA FONCTION (19 contraintes), y compris le « au moins un parmi » de set_recurring_savings. Plus une instruction d'intégrité permanente dans le prompt CFO : libellé jamais vide, comptes vérifiés avant d'être cités, montants positifs sauf dépense ponctuelle, exercice explicite.",`,
`            "repair_finance_data.php DEVIENT UN BALAYAGE GLOBAL — inventaire, nettoyage de format, intégrité sur toutes les collections de tous les exercices, objectifs sans versement, et signalements non corrigés automatiquement. Idempotent : le second passage annonce « aucune anomalie ». La table de montants codés en dur de la v36.1 a été RETIRÉE : une réparation ponctuelle rejouée à chaque lancement écraserait vos saisies futures.",`,
`            "NOUVEAU — ESPACE 🧠 SUPERVISION IA. Deux onglets : les règles mémorisées par l'agent (finance_vectors, colonne embedding jamais lue) et l'historique des conversations (chat_history), groupé par session et rendu en bulles lisibles. Le JSON LangChain est décodé côté serveur pour n'exposer que l'auteur et le texte. Filtre plein texte et bouton de rafraîchissement ; chargement paresseux pour ne pas peser sur le démarrage.",`,
`            "get_ai_memory.php — connexion PDO avec REPLI SUR PLUSIEURS HÔTES (postgres-psy, localhost, 127.0.0.1, postgres, db) et, surtout, il DIT lequel a répondu : la panne DNS de postgres-psy devient diagnosticable au lieu d'être une erreur opaque. Introspection des colonnes avant tout SELECT, donc une table absente ou renommée donne un message explicite et n'empêche pas l'autre de s'afficher.",`,
`            "⚠️ EXPOSITION — cet endpoint renvoie vos conversations. Aucun fichier de ce dossier n'est authentifié (save_data.php accepte d'écraser tout l'état financier sans contrôle) : un jeton FACULTATIF est prévu via 'ai_memory_token' dans db_config.php. Sans lui l'endpoint répond mais affiche un bandeau d'avertissement dans l'application."`,
`        ] },`].join('\n');

sub(`                    const CHANGELOG = [\n`, `                    const CHANGELOG = [\n${E}\n`);
if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ version 37.0 + changelog');
