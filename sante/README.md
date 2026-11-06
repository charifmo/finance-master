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
Le relais : l'appli Android **Health Connect Webhook** de Naveen MC ([mcnaveen/health-connect-webhook](https://github.com/mcnaveen/health-connect-webhook),
libre ; sur le Play Store `com.hcwebhook.app` en paiement unique d'environ 52 MAD, ou gratuite via l'APK des versions GitHub / Obtainium) lit Samsung Health via Health Connect et POSTe sur `sync_samsung.php` — à intervalle,
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
- v1.17 : les pas de plusieurs sources se comparent **minute par minute** (chaque mesure répartie sur ses minutes, la source la plus haute par minute) ; détail par source affiché sous « Mesures du jour » ; VO2 max, glycémie, fréquence respiratoire, température, masse maigre, tour de taille, énergie au repos lus.
- v1.16 : une synchro sans nouveauté (`"data": {}`) répond 200 (plus de 422). Plusieurs sources (téléphone, montre) :
  comparées **heure par heure** (la plus complète de chaque heure, puis somme des heures). Mesures en plus :
  distance, calories totales, séances d'exercice, SpO2, tension, hydratation, masse grasse, VFC, FC min/max ; la
  **taille** remplit `profil.taille_cm` (métabolisme de base). `sync_auto.recu` garde le nombre de mesures par type du
  dernier envoi. L'appli n'envoie que le nouveau : une pesée antérieure à la première synchro se note à la main.

## Pilotage (v1.16)

Même esprit que le cockpit de Finance : en tête l'état de la synchro, le choix de la période (7 / 30 / 90 j) et ce qui
manque (taille, pesée ancienne) ; puis les indicateurs clés (pas, calories actives, bilan net, poids, sommeil,
FC au repos, protocole, exercice, et SpO2 / tension / eau / VFC / masse grasse quand le téléphone les envoie), chacun
avec sa tendance sur 7 jours et une mini-courbe ; puis 4 graphiques (activité, poids, sommeil + FC repos, bilan
énergétique + protocole suivi). La journée (plan, en liste bornée et défilante, avec « À faire ensuite »), les
mesures du jour, la saisie et le bilan énergétique viennent après.
- L'ancien format « un jour » (`{"date", "steps", …}`) reste accepté ; jeton aussi possible dans `db_config.php`
  (`sante_samsung_token`).

## Importer un protocole (v1.8)

Onglet **Plans → 📥 Importer mon protocole** : PDF, Word, photo ou texte, de n'importe quelle forme. `sante_protocole.js`
range chaque ligne **par règles** (pas d'IA) :

- **cases du jour**, par moment (réveil … coucher, toute la journée), avec heure, jours précis ou rythme
  (1×/semaine, 1×/mois) ; les aliments d'un repas forment UNE case, le menu en détail ; les explications d'une action
  en détail ;
- **suppléments** (fiches POURQUOI / COMBIEN / QUAND, tableau de synthèse), **règles** à relire (interdits,
  avertissements, conseils), **objectifs** (tableau Marqueur / Départ / Cible → cibles des biomarqueurs dans Analyses),
  **ignoré** (titres, sommaire, explications « Pourquoi »).

Indices utilisés, valables pour tout document : phrases coupées recollées (minuscule, ligne non finie, suite de puce ;
une ligne vide termine un paragraphe), titres numérotés / à emoji / en capitales / courts, heures et mots de moment,
partie en gras d'une puce, quantités et gestes, « jamais / éviter / zéro / si », colonnes des tableaux, doublons.

**Écran de tri** : chaque ligne peut changer de catégorie, de moment, de texte, ou être supprimée avant d'enregistrer.
Chaque correction devient une **leçon** (`lecons_plan`), appliquée d'office aux imports suivants (🧠) ; le compteur
de corrections montre le progrès d'un import à l'autre. Le protocole remplace la checklist fixe de Pilotage.

**✨ Vérifier avec l'IA** (facultatif, v1.9) : le rangement (texte des lignes seulement) part par `sante_cmo.php` au
webhook de l'agent (`mode: verifier_protocole`) ; une branche dédiée du workflow (modèle sans outils ni mémoire,
consignes `sante/verif_protocole_prompt.md`, JSON contrôlé) rend des corrections : catégorie, moment, libellé, rythme,
fusion, ajout. L'appli écarte celles qui sont inapplicables, vous acceptez ou refusez chacune ; une correction acceptée
devient une leçon comme les autres.

## L'agent Telegram « Médecin-Chef IA » (v1.7)

Workflow n8n `[SANTÉ] - Médecin-Chef IA`, modèle dans `n8n/agent_sante.json`, consignes dans `sante/cmo_system_prompt.md`.
Publication (et republication après un `git pull`) : `sudo bash install.sh sante` — sauvegarde des workflows, puis
`n8n/maj_workflow_sante.php` reprend l'id du workflow Santé existant (l'agent maître l'appelle par cet id), le bot
**« Telegram santé account »** (jamais un autre), les identifiants Postgres / Gemini / OpenAI / Deepseek, les tables et
modèles déjà choisis, et y injecte les consignes et le catalogue des fonctions (`sante_catalogue_fonctions()`).
Retour arrière : `sudo bash install.sh sante-retour`.

- Entrées : Telegram (texte, vocal transcrit), la page (onglet Médecin-Chef IA → `sante_cmo.php`, qui relaie avec
  l'authentification du site ; le webhook `sante-cmo` refuse tout autre appel), l'agent maître (sous-workflow).
- Outils : `sante_lire` (GET `sante_api.php?lecture=1`), `sante_simuler` puis `sante_enregistrer` après « OUI »
  (POST `sante_api.php`, mode simulate / commit), `memoire_sante` (mémoire vectorielle existante).
- Les appels au VPS s'authentifient avec `FINANCE_USER` / `FINANCE_PASS` de n8n (voir `N8N_AUTH_CADDY.md`) ;
  `install.sh sante` vérifie leur présence.
- Réponses : texte (mise en forme Telegram du CFO, repli en texte brut), voix si la question était vocale.

## Phase 2

Workflow n8n du Médecin-Chef IA (Telegram « Telegram santé account », lecture `sante_api.php`, mémoire `sante_vectors`),
indexation des fichiers Santé de Google Drive, lecture des captures Samsung Health.

Les calculs aident au suivi ; ils ne remplacent pas l'avis du médecin.
