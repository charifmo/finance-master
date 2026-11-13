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

## Pourquoi des pas ou des mesures manquent : le diagnostic (v1.24)
La chaîne est Samsung Health (et la montre) → **Health Connect** → l'appli webhook du téléphone → `sync_samsung.php`. Chaque maillon
peut perdre des mesures :
- **Samsung Health n'écrit pas dans Health Connect** (autorisation d'écriture absente) : seuls les pas comptés par Android
  (`com.android.healthconnect.phone…`, « téléphone ») arrivent, avec calories actives et distance ; ni la montre, ni le sommeil,
  ni la FC. Réglage : Samsung Health › Paramètres › Health Connect › Autorisations des applis › Samsung Health › tout autoriser.
  Samsung recopie ses données avec du retard (minutes à heures) et ne partage pas la FC au repos (Santé l'estime d'après la FC).
- **L'appli webhook endormie par Android** (« Synchro il y a 3 h ») : Batterie › Non restreinte ; chaque type coché dans l'appli.
- **Côté serveur** : deux mesures d'une même appli sur le même intervalle dans un envoi s'écrasaient ; on garde la plus grande.

Le serveur relève, à chaque envoi, quels types arrivent et de quelles applis (`sync_auto.vus`) : Pilotage signale ce qui manque
(`data-manque="hc_samsung" | "hc_types" | "hc_veille"`). Il garde aussi le résumé des 30 derniers envois dans `backups/hc_envois.json`
(derrière le mot de passe du site). Sur le serveur : `sudo php /var/www/finance/sante/hc_diagnostic.php` (ajoutez `--brut` pour des
exemples de mesures) dit ce qui arrive, d'où, ce qui arrive en retard, et où chercher. Le script répond 404 par le web.
v1.25 : chaque tentative du téléphone est notée, même refusée (`backups/hc_tentatives.json`, 60 dernières : heure, code HTTP,
mode d'authentification, taille, types reçus, message). Une synchro forcée qui ne laisse aucune ligne s'est arrêtée avant PHP
(mot de passe refusé par Caddy, mauvaise adresse, pas de réseau). Avant tout relevé, le diagnostic lit aussi l'appli d'origine
des pas déjà stockés.

## Une vraie journée de mesures (v1.23)
Montre + téléphone écrivent des pas presque à chaque minute : une journée dépasse vite 1 500 mesures par type. Jusqu'à la v1.22,
seules les 1 500 **premières** étaient gardées et le reste de la journée était jeté à chaque synchro (les pas s'arrêtaient vers 9 h).
Désormais (`sante_hc_compacter`, dans `sante_integrity.php`), au-delà de 1 200 mesures, les plus anciennes sont regroupées en une
valeur par minute (source `s000000`) : pour les pas, kcal, distance, eau, la source qui compte le plus dans la minute — la règle même
du total, qui ne change donc pas, et un renvoi ne compte pas double ; pour la FC, la moyenne de la minute. Les 300 plus récentes
restent telles quelles ; plafond 2 000 (les plus anciennes partent). La courbe « heure par heure » compte aussi minute par minute.
Les mesures déjà jetées avant la mise à jour ne reviennent que si le téléphone les renvoie.

## Lecture des comptes rendus, « à vérifier », validation par l'IA (v1.21)
- **Le lecteur** (`sante_import.js`) a été mis au point sur de vrais PDF de trois laboratoires (aucune donnée réelle n'est dans le dépôt : les tests
  utilisent des textes fictifs de même mise en page). Il lit : les **bornes entre parenthèses** sans coller la valeur d'un résultat antérieur ; la
  **valeur absolue** de la ligne « Soit : 2 206 /mm3 » d'une formule leucocytaire (à défaut : leucocytes × %) ; le **nom sur une ligne et la valeur
  quelques lignes plus bas** (Cerba : « 1,42 g/l   N : 0,66 à 1,33 », « Résultat : 0,46 ng/ml », y compris coupé en trois lignes) ; les noms à
  tirets, parenthèses ou « / » (« Cholestérol − HDL », « ALAT(GPT) ») ; « à 8 heures » n'est pas une valeur ; une numération en G/L est ramenée à /mm³.
  Chaque valeur garde sa **ligne source** (survol dans l'aperçu et dans la liste des documents).
- **Le catalogue** passe à 53 biomarqueurs : CRP, urée, créatinine, DFG, acide urique, albumine, VS, ionogramme (sodium, potassium, chlore,
  bicarbonates, protéines totales, calcium), CPK, LDH, PTH, SHBG, prolactine, estradiol ; nouveau système « Rein, ionogramme & inflammation ».
- **« ❓ à vérifier »** : une valeur dix fois sous le bas de la norme ou dix fois au-dessus du haut (un pourcentage lu pour un nombre, une autre
  unité) n'est plus affichée comme une alerte médicale ▲▼ : repère violet, encadré récapitulatif au-dessus du tableau. Même règle en JS
  (`sante_calculs.js`) et en PHP (`sante_lib.php`) ; un vrai résultat très bas (hémoglobine 4,6) reste « bas ».
- **« 🧠 Faire valider par l'IA »** (dans l'aperçu d'import) : le Médecin-Chef IA relit le texte du document et les valeurs lues et propose des
  corrections (valeur, bornes, ajout d'un résultat oublié, retrait d'une fausse valeur). Mode `verifier_bilan` du relais `sante_cmo.php` → même
  branche n8n que la vérification du protocole (modèle sans outils ni mémoire, consignes `verif_bilan_prompt.md`). **Garde-fou** : toute
  proposition doit citer une ligne copiée du document qui contient le nombre proposé — sinon elle est écartée d'office. Chaque proposition
  s'accepte ou se refuse ; rien ne s'applique seul. Après une mise à jour du dépôt : `sudo bash install.sh sante` republie l'agent.
- La liste « Bilans et documents » se réduit (repliée par défaut, l'état est retenu sur l'appareil).

## Plans nutrition et exercice (v1.4 — remplacés en v1.18 par un seul « Mon plan santé »)

v1.18 : on ne crée plus de plan nutrition ou exercice séparé. Un plan séparé d'avant reste affiché et se fond d'un clic
(« Les réunir dans mon plan santé ») dans le plan santé, en gardant ses identifiants, donc l'historique du réalisé.


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

## L'export Samsung Health complet : composition, séances, historique (v1.26)
La synchro automatique (Health Connect) ne transmet ni le muscle squelettique, ni le détail des séances, ni l'historique ancien.
L'**export Samsung Health** (Samsung Health › Paramètres › Télécharger les données personnelles) les contient : on choisit le
**dossier** `samsunghealth_…` (ou son `.zip`) dans l'onglet Samsung & Poids, et tout est lu d'un coup, où que soient les fichiers :
- **composition corporelle** (table des pesées ou `body_composition`) : poids, % et kg de graisse, muscle squelettique, masse maigre,
  eau, métabolisme de base, graisse viscérale — vues Jours / Semaines / Mois avec moyenne, min, max ;
- **séances** (`com.samsung.shealth.exercise`) : type, durée, distance, vitesse, FC moyenne et max, calories, pas, dénivelé, VO₂ max ;
  à partir du détail `<uuid>…live_data.json` (et du tracé `…location_data.json`) : **zones de FC** (en % de la FC max = 220 − âge du
  profil) et **temps par km** ;
- **tout l'historique** (10 ans au plus).

Samsung ne publie pas le format de l'export : il est rétro-documenté, et la lecture est tolérante — CSV à n'importe quelle profondeur,
détail de séance sous `jsons/` ou `files/`, compressé en gzip ou non, distance tirée de la clé `distance`, sinon du tracé GPS, sinon
de la vitesse ; sans aucune des trois, pas de temps par km (rien n'est inventé). Un code de séance inconnu est affiché tel quel.

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

## Importer un protocole (v1.8) — « Mon plan santé »

v1.18 :
- documents **sans sections numérotées** : les rubriques se reconnaissent à leur nom (« Compléments — vue d'ensemble »,
  « Activité physique », « Vigilance », « KPI — bilan à 3 mois », « Médecins »…) ; avant la première, les **blocs
  horaires** (« ~9h00   PETIT-DÉJEUNER », « RÉVEIL   Marche à jeun ») fixent le moment ; « À MANGER » = une case repas
  (menu en détail), « À PRENDRE » = une case « Prendre : … » ; « puis » et « · » séparent deux gestes ; un jour seul
  sur sa ligne (« Mercredi ») fixe les jours des lignes suivantes ;
- **garde-fou** `pasUneAction` : un coût, une durée de cure, une mise en garde, un palier de progression, un conseil,
  une question ne deviennent jamais une case — ni par les règles, ni par une leçon, ni par une proposition de l'IA
  (refusée d'office) ; un plan enregistré avant propose « Les ranger dans les règles à relire » (les leçons fautives
  sont corrigées) ; le prompt de vérification liste ces cas.


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
