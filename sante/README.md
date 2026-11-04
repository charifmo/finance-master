# Santé Master

Application sœur de Finance Master, même architecture : une page Vue 3 + Tailwind + Chart.js, un backend PHP
déterministe, l'état dans PostgreSQL (JSONB) avec un fichier de secours, et un agent IA (n8n) qui n'agit que par
un catalogue strict.

Adresse : **`/finance/sante/`** (même protection `basic_auth` Caddy que Finance Master, aucune configuration à ajouter).

## Données personnelles

Le dépôt est **public** : aucune donnée de santé réelle n'y est écrite. L'appli démarre vide ; le dossier
initial (profil, bilans, protocole) se charge par **« 📂 Importer mon dossier »** (fichier `.json` fourni à part).
`sante_data.json`, `sante/backups/` et tout fichier `*prive*` / `*dossier*.json` sont ignorés par git.
`seed_demo.json` est un profil **fictif** pour essayer l'appli.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | l'appli (6 onglets : Pilotage, Analyses, Nutrition, Plans, Samsung & Poids, Médecin-Chef IA) |
| `sante_calculs.js` / `sante_lib.php` | les calculs, identiques en JS et en PHP (test de parité) : TG/HDL, non-HDL, HOMA-IR, TyG, SCORE2, règle de Gilbert, Mifflin-St Jeor, bilan énergétique, projection de poids, score de séquençage, suivi d'un plan (prévu / réalisé de la semaine) |
| `sante_import.js` | lecture d'un compte rendu (texte, PDF, image) : biomarqueurs, bornes, date du bilan (prélèvement d'abord) ; lecture d'un plan nutrition / exercice en texte libre |
| `sante_integrity.php` | forme de l'état, dates, nombres : tout ce qui entre y passe |
| `sante_intent_engine.php` | le catalogue du Médecin-Chef IA : `add_lab_panel`, `update_biomarker`, `log_daily_nutrition`, `log_workout_activity`, `sync_samsung_health`, `update_supplement_protocol`, `update_health_goal` |
| `sante_store.php`, `save_sante.php` | stockage : table `sante_state` (créée seule), fichier de secours, 30 sauvegardes, refus 409 d'un onglet périmé |
| `sante_api.php` | l'API du Médecin-Chef IA : `GET ?lecture=1` (ce qu'il lit), `POST {calls, mode: simulate|commit}` |
| `sync_samsung.php` | webhook Health Connect / Samsung Health (jeton obligatoire) |
| `biomarqueurs.json`, `aliments.json`, `explications.json` | catalogue des biomarqueurs, table des aliments (valeurs indicatives / 100 g), explications de Merlin |
| `sql/sante_state.sql`, `sql/sante_vectors.sql` | tables PostgreSQL (`sante_vectors` est séparée de `finance_vectors`) |

## Analyses : import, provenance, corrections (v1.4)

- **Plusieurs fichiers d'un coup** (glisser-déposer ou choix multiple) : PDF texte, PDF scanné (OCR page par page), photos
  (OCR), texte. Tout est lu dans le navigateur. Chaque fichier donne un aperçu : date trouvée (la date de **prélèvement**
  passe avant l'ouverture du dossier et l'édition ; jamais une date de naissance, d'antériorité ou future), valeurs
  reconnues modifiables, lignes non reconnues à vérifier.
- **Chaque valeur garde son document** (`valeurs[k].doc` → `bilan.documents[]`) : le tableau l'indique au survol,
  « 🔦 » surligne les valeurs d'un document, « 🗑 » supprime le document **et ses valeurs** (second clic de confirmation).
- **Corriger** : « ✏️ Modifier les valeurs » dans le tableau, ou « ▾ Lignes » d'un document ; une valeur corrigée est
  marquée `edite` (✎). Vider la case la supprime.
- **🧹 Tout effacer** : les analyses seules, ou toute l'appli ; confirmé en tapant `EFFACER`. Le serveur garde ses
  30 sauvegardes tournantes.

## Plans nutrition et exercice (v1.4)

Onglet **Plans** : le plan de la nutritionniste ou du coach s'importe d'un PDF, d'un Word `.docx`, d'une photo ou d'un
texte. Les jours (« Lundi », « Tous les jours ») et, pour la nutrition, les repas (« Petit-déjeuner »…) servent de titres ;
chaque autre ligne devient un élément, corrigeable avant d'enregistrer. Chaque jour, on coche ce qui est **réalisé**
(`journal[date].plan_fait`) ; la semaine affiche prévu / réalisé, le taux et, pour l'exercice, les minutes. Le
Médecin-Chef IA lit le plan du jour et la semaine (`sante_api.php?lecture=1` → `plans`).

## Export Samsung Health (v1.5)

Samsung Health → ≡ → Paramètres → « Télécharger les données personnelles ». L'export arrive dans
`Download/Samsung Health/samsunghealth_<compte>_<horodatage>/` : **un CSV par mesure à la racine**
(`<type>.<horodatage>.csv`), `jsons/` (détail minute / 10 min) et `files/` (photos). Samsung ne publie pas de
spécification ; le format suivi ici est celui vérifié sur des exports réels 2025-2026 (outil
[v-2841/samsung-health-export](https://github.com/v-2841/samsung-health-export)).

L'onglet Samsung & Poids prend **tout l'export d'un geste** : le dossier compressé (`.zip`, « Mes fichiers » → appui
long → Compresser), le dossier entier, ou ses fichiers (`sante_samsung.js`, sans bibliothèque ; zip64 compris). Seuls
sont lus : `tracker.pedometer_day_summary` (pas : la ligne **combinée** de Samsung, `device_profile.device_group = 0`),
`calories_burned.details` (kcal actives), `health.weight` (poids, UTC + `time_offset` → jour local),
`tracker.heart_rate` (FC moyenne du jour), `sleep` / `sleep_combined` (minutes par jour de réveil, siestes écartées,
une nuit en morceaux comptée une fois). Secours : sans CSV de pas, le détail par 10 min de `jsons/`. Le journal reprend
la dernière année ; les pesées, tout l'historique. Un CSV « maison » (colonne `date` + `steps` / `weight`…) reste accepté.

## Synchro automatique depuis le téléphone (v1.5)

Une page web ne peut pas lire Samsung Health (Android ne donne pas accès aux fichiers ni à Health Connect aux sites).
Le relais : l'appli Android gratuite **HC Webhook** ([mcnaveen/health-connect-webhook](https://github.com/mcnaveen/health-connect-webhook),
Play Store `com.hcwebhook.app`) lit Samsung Health via Health Connect et POSTe sur `sync_samsung.php` — à intervalle,
à heure fixe, ou d'un appui sur son widget « Synchroniser ».

- Réglage depuis l'onglet Samsung & Poids → « 🔑 Préparer ma synchro automatique » : `sante_jeton.php` (réservé à une
  requête authentifiée par Caddy) crée le jeton dans `sante_jeton_samsung.php`, à côté des données (ignoré par git) ;
  la page donne l'adresse et les en-têtes JSON à coller dans l'appli (`Authorization: Basic …` fabriqué dans le
  navigateur à partir du mot de passe du site, jamais envoyé ; `X-Sante-Token`).
- `sante_hc.php` lit le format de l'appli (`steps`, `active_calories`, `weight`, `sleep`, `heart_rate`,
  `resting_heart_rate`), envois incrémentaux et renvois : les morceaux sont rangés par clé (id Health Connect ou heure)
  dans `journal[date].hc` (8 jours), puis les totaux du jour refaits — un renvoi remplace, ne s'additionne pas.
  Pas / kcal « Quotidien » (défaut de l'appli) : le total du jour remplace. Siestes écartées. Dates locales (décalage
  de la mesure, sinon Africa/Casablanca).
- `sync_auto` (dernière synchro reçue) s'affiche dans l'onglet ; revenir sur la page relit l'état.
- L'ancien format « un jour » (`{"date", "steps", …}`) reste accepté ; jeton aussi possible dans `db_config.php`
  (`sante_samsung_token`).

## Phase 2

Workflow n8n du Médecin-Chef IA (Telegram « Telegram santé account », lecture `sante_api.php`, mémoire `sante_vectors`),
indexation des fichiers Santé de Google Drive, lecture des captures Samsung Health.

Les calculs aident au suivi ; ils ne remplacent pas l'avis du médecin.
