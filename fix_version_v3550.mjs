import fs from 'node:fs';
const FILE = new URL('./index.html', import.meta.url);
let s = fs.readFileSync(FILE, 'utf8');
const CRLF = s.includes('\r\n'); if (CRLF) s = s.split('\r\n').join('\n');
const sub = (from, to, n = 1) => { const c = s.split(from).length - 1;
    if (c !== n) throw new Error(`Ancre (${c}/${n}) : ${from.slice(0,120)}`); s = s.split(from).join(to); };

sub(`                    const CURRENT_VERSION = "35.4 Studio-Contractuel";`,
    `                    const CURRENT_VERSION = "35.5 Annee-Verrouillee";`);

const E = [
`        { version: "35.5 Annee-Verrouillee", date: "2026-09-18", changes: [`,
`            "BUG 2 — FUITE INTER-ANNÉES, reproduite puis corrigée. Le sélecteur d'exercice du contexte CFO ne cherchait un millésime que dans la QUESTION COURANTE. Dès que l'année était citée un tour plus tôt puis suivie d'une relance (« et mes versements ? »), repli silencieux sur l'année de l'application. Reproduction exacte du cas signalé : l'ancien code renvoie 2026 (total versements 10 500 DH — le chiffre faux annoncé), le nouveau renvoie 2027 (13 000 DH — celui de l'interface). L'historique récent sert désormais de repli, le millésime explicite de la question restant prioritaire.",`,
`            "BUG 2, second trou — le résumé des exercices non exposés comptait revenus, charges fixes et dépenses irrégulières, mais PAS l'épargne. Le modèle n'avait aucun moyen de connaître les versements d'une autre année et comblait avec ce qu'il avait sous la main. versements_planifies et total_versements_planifies sont ajoutés par exercice : quelques dizaines d'octets qui suppriment la possibilité même de l'hallucination.",`,
`            "BUG 2, côté écriture — cfo_years() retombait sur date('Y'), l'HORLOGE DU SERVEUR. Toute opération sans year atterrissait sur l'année civile quel que soit l'exercice discuté. Nouvel ordre : year explicite > annee_contexte (l'exercice réellement exposé au modèle, transmis par n8n) > soldesInitiaux.anneeActuelle > horloge. La réponse porte désormais annee_defaut_utilisee, annee_defaut_source et exercices_touches : l'année choisie n'est plus une décision invisible.",`,
`            "BUG 1 — LE SMART GOAL N'A JAMAIS ÉCHOUÉ. Vérifié de bout en bout : l'engine crée bien l'objectif, _internal.finance_data le contient avec tous les exercices, le Committer poste ce bloc entier et save_data.php écrit le corps brut sans filtrer. L'écriture aboutit — puis elle est écrasée. L'auto-backup de l'onglet ouvert poste l'état EN MÉMOIRE toutes les 15 minutes sans jamais relire le serveur : dernier écrivain gagne, et le commit de l'agent disparaît sans qu'aucune erreur n'apparaisse nulle part.",`,
`            "CORRECTIF BUG 1 — l'auto-backup (chemin non surveillé) relit une signature de l'état serveur avant d'écrire. Si elle a changé depuis notre dernier échange, il n'écrit PAS et l'annonce explicitement. La sauvegarde manuelle reste inconditionnelle : elle est intentionnelle. Une perte de données silencieuse devient un conflit visible."`,
`        ] },`].join('\n');

sub(`                    const CHANGELOG = [\n`, `                    const CHANGELOG = [\n${E}\n`);
if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ version 35.5 + changelog');
