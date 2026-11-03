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
| `index.html` | l'appli (5 onglets : Pilotage, Analyses, Nutrition, Samsung & Poids, Médecin-Chef IA) |
| `sante_calculs.js` / `sante_lib.php` | les calculs, identiques en JS et en PHP (test de parité) : TG/HDL, non-HDL, HOMA-IR, TyG, SCORE2, règle de Gilbert, Mifflin-St Jeor, bilan énergétique, projection de poids, score de séquençage |
| `sante_import.js` | lecture d'un compte rendu (texte, PDF, image) |
| `sante_integrity.php` | forme de l'état, dates, nombres : tout ce qui entre y passe |
| `sante_intent_engine.php` | le catalogue du Médecin-Chef IA : `add_lab_panel`, `update_biomarker`, `log_daily_nutrition`, `log_workout_activity`, `sync_samsung_health`, `update_supplement_protocol`, `update_health_goal` |
| `sante_store.php`, `save_sante.php` | stockage : table `sante_state` (créée seule), fichier de secours, 30 sauvegardes, refus 409 d'un onglet périmé |
| `sante_api.php` | l'API du Médecin-Chef IA : `GET ?lecture=1` (ce qu'il lit), `POST {calls, mode: simulate|commit}` |
| `sync_samsung.php` | webhook Health Connect / Samsung Health (jeton obligatoire) |
| `biomarqueurs.json`, `aliments.json`, `explications.json` | catalogue des biomarqueurs, table des aliments (valeurs indicatives / 100 g), explications de Merlin |
| `sql/sante_state.sql`, `sql/sante_vectors.sql` | tables PostgreSQL (`sante_vectors` est séparée de `finance_vectors`) |

## Webhook Samsung Health

Dans `/var/www/finance/db_config.php` (jamais commité), ajouter : `'sante_samsung_token' => '<un long jeton aléatoire>',`.
L'appli qui envoie les données (Health Connect → webhook) poste en JSON sur `https://<hôte>/finance/sante/sync_samsung.php`
avec l'en-tête `X-Sante-Token` et l'authentification `basic_auth` du site.

## Phase 2

Workflow n8n du Médecin-Chef IA (Telegram « Telegram santé account », lecture `sante_api.php`, mémoire `sante_vectors`),
indexation des fichiers Santé de Google Drive, lecture des captures Samsung Health.

Les calculs aident au suivi ; ils ne remplacent pas l'avis du médecin.
