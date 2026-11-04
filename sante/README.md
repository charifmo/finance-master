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

## CSV Samsung Health

Samsung Health → ≡ → Paramètres → « Télécharger les données personnelles ». Les CSV (un par mesure) arrivent dans
`Download/Samsung Health/<date>` ; l'onglet Samsung & Poids les prend plusieurs à la fois (ligne de description avant
l'en-tête sautée, `day_time` en ms ou `start_time`, maximum des pas si téléphone + montre).

## Webhook Samsung Health

Dans `/var/www/finance/db_config.php` (jamais commité), ajouter : `'sante_samsung_token' => '<un long jeton aléatoire>',`.
L'appli qui envoie les données (Health Connect → webhook) poste en JSON sur `https://<hôte>/finance/sante/sync_samsung.php`
avec l'en-tête `X-Sante-Token` et l'authentification `basic_auth` du site.

## Phase 2

Workflow n8n du Médecin-Chef IA (Telegram « Telegram santé account », lecture `sante_api.php`, mémoire `sante_vectors`),
indexation des fichiers Santé de Google Drive, lecture des captures Samsung Health.

Les calculs aident au suivi ; ils ne remplacent pas l'avis du médecin.
