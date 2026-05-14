# Changelog — Finance Master

Toutes les modifications notables sont documentées ici.
Format : [version] — date — description

---

## [17.29] — 2026-05-14 — Scission en Sous-Catégories

### Refactoring majeur
- **Scinder refactorisé** : la scission crée désormais des **sous-catégories** (`parts[]`) imbriquées sous l'élément parent, au lieu de lignes indépendantes en bas de liste. Chaque part dispose de son propre label, montant et routage (destination/source compte).
- **Gestion des parts** : bouton ✂️ Scinder pour initialiser 2 parts (50/50), bouton `+ Ajouter une partie` pour en ajouter, bouton ✕ pour supprimer individuellement. Le montant parent est désactivé quand des parts existent.
- **Moteur bilan parts-aware** : les 4 blocs de calcul (revenus, charges fixes, charges variables, chocs) détectent `item.parts` et routent chaque sous-catégorie indépendamment vers son compte cible. Les exceptions parent sont distribuées proportionnellement.
- **UI imbriquée (8 sections)** : affichage avec `border-l-2` coloré (vert/orange/rouge/gris) pour Desktop et Mobile. Badge `✂️ N parties` sur le label parent. Total affiché sous les parts.

---

## [17.28] — 2026-05-14 — Debug Scission & Alerte Liquidité

### Corrections
- **Bouton ✂️ Scinder toujours visible** : suppression du `v-if="modeEdition"` — le bouton est maintenant affiché en permanence avec un style bleu uniforme (`border border-blue-200`, `hover:bg-blue-50`) sur Desktop et Mobile pour les 4 types de lignes (Revenus, Charges Fixes, Variables, Chocs).
- **Alerte Déficit** : si le Solde Courant passe en négatif dans le tableau Bilan, affichage en **rouge vif** + **fond rouge clair** + animation `pulse` + badge "⚠️ Déficit" (Desktop) / "⚠️" (Mobile).
- **Vérification routage** : confirmation que les selects "← Prélever sur" sont bien présents et fonctionnels sur toutes les charges fixes et variables — le moteur déduit les charges routées de `soldesComptes{}`/`soldesEpargne{}` via `_deduireChargesComptes()`.

---

## [17.27] — 2026-05-14 — Routage des Charges & Dispatch par Scission

### Nouveautés
- **Routage Charges Fixes** : chaque charge fixe dispose d'un champ `sourceCompte` avec select "← Prélever sur" (desktop + mobile). Les charges routées vers `cpt_*`/`ep_*` sont déduites du compte cible au lieu du Compte Courant.
- **Routage Charges Variables** : idem pour les charges variables — select "← Prélever sur" avec 3 groupes (Courant, Comptes bancaires, Objectifs épargne).
- **Moteur Bilan — Ventilation** : `fixCourant`/`varCourant` alimentent `curSolde`. Les charges routées sont déduites physiquement de `soldesComptes{}`/`soldesEpargne{}` via `_deduireChargesComptes()`.
- **Fonction Scinder (✂️)** : bouton disponible en mode édition sur Revenus, Charges Fixes, Charges Variables (`scinderLigneObj`) et Flux Exceptionnels (`scinderLigneArr`). Divise le montant en 2 et crée un clone "(Partie 2)" avec nouvel ID.
- **Dispatch multi-comptes** : combiné avec le routage, permet de scinder un revenu de 20 000 DH en 12 000 sur Courant + 8 000 sur Épargne.

---

## [17.26] — 2026-05-14 — Routage des Revenus vers comptes spécifiques

### Nouveautés
- **Ventilation revenus** : chaque source de revenu dispose d'un champ `destinationCompte` (défaut: `'courant'`). Un select "→ Verser sur" apparaît sous chaque revenu (desktop + mobile) avec 3 groupes : Compte Courant, Comptes bancaires (`cpt_*`), Objectifs épargne (`ep_*`).
- **Moteur Bilan — Routage** : les revenus sont ventilés par destination. `revCourant` alimente `curSolde`, les autres destinations créditent directement `soldesComptes{}` ou `soldesEpargne{}`.
- **Décalage paie** : en mode décalage, seul `revCourant` est reporté au mois suivant (`revMoisPrecedent`). Les revenus routés vers d'autres comptes sont crédités immédiatement.
- **Mois courant** : seul `revCourant` est ajouté à `solde_fin` (au lieu de `revMoisGenere` total). Les revenus routés sont crédités sur leurs comptes cibles dès le mois courant.

---

## [17.25] — 2026-05-14 — Liaison Physique Objectifs/Comptes

### Refonte majeure
- **Liaison Objectifs → Comptes** : chaque objectif d'épargne a un nouveau champ `linkedAccountId`. Un menu "🔗 Compte de rattachement" liste tous les comptes bancaires (desktop §4, CRUD Patrimoine & Objectifs, mobile).
- **Moteur Bilan — Translocation physique** : nouveau dictionnaire `soldesComptes{}` initialisé depuis `comptes[].solde`, évolue mois par mois en parallèle de `soldesEpargne`. Pour chaque objectif lié :
  - L'épargne mensuelle est déduite du Compte Courant et ajoutée au compte lié.
  - Les chocs imputés sur l'objectif (`ep_*`) sont physiquement déduits du compte lié.
- **Comptes Projetés (Time Machine)** : utilise `detailsComptes` de la ligne bilan cible au lieu de l'ancien système de deltas proportionnels → projections per-compte exactes.
- **Tooltip Patrimoine** : affiche les soldes projetés par compte bancaire physique (`cpt_*`) avec icône et label. Fallback sur le mode enveloppes virtuelles si aucun `detailsComptes` disponible.
- **Computed `detailsComptesFinal`** + helpers `getCompteLabel()` / `getCompteIcone()` ajoutés pour la résolution des clés `cpt_*`.

---

## [17.24] — 2026-05-14 — Comptes Bancaires dans les Sélecteurs

### Nouvelle fonctionnalité
- **Computed `comptesSelectOptions`** : expose tous les comptes bancaires (non-courant) de `comptes[]` pour les menus déroulants. Les comptes de type liquide, épargne, investissement et crédit apparaissent tous.
- **6 selects mis à jour** (3 desktop + 3 mobile) : `sourceCompte` (chocs), `destinationSurplus` (pilotage), `compteSourceCash` (Studio) affichent désormais les comptes bancaires (`cpt_<id>`) EN PLUS des objectifs épargne (`ep_<id>`).
- **Moteur bilan — `irregCourant`** : capture désormais TOUS les chocs non-épargne (`courant`, `cpt_*`, valeurs inconnues) au lieu du seul `'courant'`.
- **Auto-Sweep** : vérifie `destSurplus.startsWith('ep_')` au lieu de `!== 'courant'` — les comptes `cpt_*` restent dans le pool cash.
- **Root cause** : les selects n'itéraient que sur `donneesAnnuelles[].epargne` (objectifs §4). Les comptes bancaires créés dans "Architecture des Comptes" (comme "depenses annuels") n'apparaissaient nulle part dans les menus.

---

## [17.23] — 2026-05-14 — Hard-Reactive Accounts Fix

### Correction critique
- **`addObjectifEpargne` — init solde** : à la création d'un nouvel objectif, `soldesInitiaux['ep_<id>']` est immédiatement initialisé à 0. Élimine tout risque de `NaN` dans le moteur bilan.
- **Moteur bilan — enregistrement dynamique** : `epargneParCompte` est désormais calculé AVANT `irregParCompte`. Chaque clé `ep_*` découverte dans une année est auto-enregistrée dans `soldesEpargne` si absente. Les nouveaux objectifs (ex: "Vacances") sont pris en compte par l'imputation et l'auto-sweep dès leur création — même dans les années futures.
- **`irregParCompte` — union des clés** : itère sur `Set(soldesEpargne ∪ epargneParCompte)` au lieu de `Object.keys(soldesEpargne)` seul. Les chocs assignés à un compte nouvellement créé sont correctement imputés.
- **Debug log** : `console.log('[v17.23]')` ajouté dans `handleDataChange` et `addObjectifEpargne` pour tracer les comptes épargne visibles.
- **Root cause** : `soldesEpargne` n'était initialisé que depuis l'année de base (`anneeActuelle`). Les objectifs créés pour d'autres années, ou créés après le chargement initial, n'étaient jamais enregistrés dans le dictionnaire du moteur.

---

## [17.22] — 2026-05-14 — Correction Menus Dynamiques Mobile

### Correction critique
- **Mobile — sourceCompte chocs** : ajout du select dynamique (`v-for` sur `epargne[]`) sur chaque flux irrégulier mobile. L'utilisateur peut désormais choisir le compte source (courant ou épargne) depuis la vue mobile.
- **Mobile — destinationSurplus** : ajout du select dynamique dans la section Pilotage mobile. Le surplus mensuel peut être redirigé vers n'importe quel objectif d'épargne.
- **Mobile — compteSourceCash Studio** : ajout du select dynamique dans la carte Mensualité Studio mobile. La source du cash requis est configurable sur mobile.
- **Root cause** : les 3 selects desktop étaient déjà dynamiques (v17.21), mais les 3 équivalents mobiles étaient absents → les nouveaux objectifs d'épargne (ex: "vacances") n'apparaissaient nulle part sur mobile.

---

## [17.21] — 2026-05-14 — Comptes Épargne Dynamiques & Cash Studio

### Refonte majeure
- **Comptes 100% dynamiques** : les selects `destinationSurplus` et `sourceCompte` itèrent sur `donneesAnnuelles[].epargne` via `v-for`. Plus aucun compte figé en dur (urgence/LT).
- **Soldes initiaux dynamiques** : chaque objectif d'épargne a un champ "Solde actuel" dans §4, stocké en `soldesInitiaux['ep_<id>']`.
- **Moteur bilan refondé** : `curUrgence`/`curLT` remplacés par dictionnaire `soldesEpargne{}` initialisé dynamiquement. Imputation et Auto-Sweep fonctionnent sur n'importe quelle clé `ep_*`.
- **detailsEpargne** : chaque ligne bilan retourne `detailsEpargne: {...}` au lieu de `soldeUrgence`/`soldeLT`.
- **Tooltip patrimoine dynamique** : itère sur `detailsEpargneFinal` avec `getEpargneLabel()` pour afficher chaque poche nommée.
- **Cash Studio** : `appliquerMensualiteStudio` injecte le `cashRequis` comme choc irrégulier avec `sourceCompte` configurable. Select "Source du Cash" ajouté dans l'onglet Studio.

---

## [17.19] — 2026-05-14 — Moteur Patrimonial, Auto-Save, Auto-Sweep & Imputation Chocs

### Refonte majeure
- **Auto-Save (debounce 2s)** : `handleDataChange` déclenche un `saveToServer()` automatique après 2 secondes d'inactivité — plus de perte de saisie.
- **Source Compte pour les Chocs** : chaque dépense irrégulière a un champ `sourceCompte` (`courant`/`urgence`/`lt`). Sélecteur visible dans l'UI des Flux Exceptionnels.
- **Auto-Sweep** : nouveau champ `destinationSurplus` dans `soldesInitiaux`. Si le cashflow mensuel est positif, le surplus est redirigé vers le fonds urgence ou l'épargne LT selon le choix de l'utilisateur.
- **Imputation Analytique** : le moteur `bilan` sépare les chocs par `sourceCompte` (irregCourant, irregUrgence, irregLT). Chaque poche absorbe ses propres chocs.
- **Soldes cumulatifs** : `curUrgence` et `curLT` évoluent mois par mois dans le moteur. Chaque ligne retourne `soldeUrgence` et `soldeLT`.
- **UI Pilotage** : sélecteur "Destination du Surplus" ajouté sous le toggle Décalage Paie.

---

## [17.18] — 2026-05-13 — Patrimoine Global Projeté & Tooltip

### Refonte UX
- **Nouveau computed `patrimoineProjeteGlobal`** : additionne `soldeFinal` (cash) + `epargneTotaleFinal` (épargne générée) + `soldesInitiaux.bourse` pour une vision complète du patrimoine projeté.
- **Header "PROJ. FIN" → "Patrimoine Global Projeté"** : la valeur principale affiche désormais le patrimoine total, pas seulement le cash. Tooltip au survol avec répartition détaillée (Compte Courant / Total Épargne / Bourse).
- **KPI Dashboard** : carte "Projection Fin" remplacée par "Patrimoine Global" en vert emerald, avec sous-détail Cash + Épargne en texte compact.
- **Correction** : suppression de la fausse impression de déficit quand l'épargne accumulée n'était pas visible dans l'indicateur principal.

---

## [17.16] — 2026-05-13 — Time Machine Comptes (Projection par Date)

### Nouvelle fonctionnalité
- **Projection individuelle par compte à une date cible** : l'utilisateur peut sélectionner un mois et une année précis pour voir l'état prévisionnel de chaque compte à cette date.
- **2 nouveaux refs** : `moisCibleProjection` (défaut Décembre) et `anneeCibleProjectionComptes` (défaut année en cours).
- **Computed `comptesProjetes`** : recherche la ligne correspondante dans le `bilan` computed, calcule les deltas (Cash, Épargne, Investissement) et les répartit sur le premier compte de chaque type.
- **UI "Voyage dans le temps"** : bloc gradient indigo/violet avec 2 sélecteurs (Mois + Année) inséré au-dessus de la liste des comptes dans la section Architecture des Comptes.
- **Affichage enrichi** : chaque compte affiche `Solde actuel ➔ Solde projeté` avec indicateur delta coloré (▲ vert pour hausse, ▼ rouge pour baisse).

---

## [15.7] — 2026-05-03 — Fix déduction charges mois courant

### Correction critique
- **Rétablissement de la déduction `fRest + vRest + totEpBase`** dans le bloc `isCurrentMonth` du computed `bilan` (revert partiel de v15.5).
- Sans cette déduction, le solde de fin d'année était faussé par un excédent fictif (les charges courantes du mois en cours étaient ignorées de la projection).
- Nouveau (et définitif) calcul des 2 branches : `solde_fin = curSolde - fRest - vRest - totEpBase - totalIrregRestant;` — l'ajout de `revMoisGenere` quand `!salaireRecu` est conservé dans le bloc `else`.

---

## [15.6] — 2026-05-03 — Fix calcul injections cash

### Correction critique
- **Injections de cash ignorées par le bilan** : `isItemPaid()` retournait `true` pour tout montant négatif (rentrée d'argent) car `Number(item.montantPaye || 0) >= dueAmount` évalue `0 >= -115600` → `true`. Conséquence : toutes les injections de cash du Studio étaient considérées comme déjà encaissées et exclues de la projection du bilan.
- **Fix** : si `dueAmount < 0`, on se fie strictement au flag `item.paye === true` (la case à cocher manuelle), au lieu de comparer le `montantPaye` au montant dû.

---

## [15.5] — 2026-05-03 — Fix Bilan Current Month Math

### Correction critique
- **Mois courant ne déduit plus les charges du capital initial** : dans le bloc `isCurrentMonth` du computed `bilan`, la ligne `solde_fin = curSolde - fRest - vRest - totEpBase - totalIrregRestant` amputait artificiellement le `patrimoineLiquide` (qui est déjà du cash NET disponible) des charges courantes du mois → chute brutale dès le premier mois.
- **Nouveau calcul** : `solde_fin = curSolde - totalIrregRestant` (uniquement les flux exceptionnels restants). Appliqué aux deux branches (`decalagePaie` et `else`). L'ajout de `revMoisGenere` quand `!salaireRecu` est conservé dans le bloc else.

---

## [15.4] — 2026-05-03 — Fix Moteur Trésorerie Multi-Comptes

### Corrections critiques
- **Fix moteur `bilan`** : `curSolde` initialisé sur `patrimoineLiquide.value` (somme réelle des comptes) au lieu de `soldesInitiaux.courant` (champ legacy abandonné)
- **Fix épargne projetée** : `soldeUrgence`/`soldeLT` dans chaque row du bilan initialisés depuis `comptes[]` filtrés par type (`epargne`/`investissement`) au lieu de `soldesInitiaux.urgence/lt`
- **Fix fallbacks** : `soldeFinal` retourne `patrimoineLiquide.value` et `epargneTotaleFinal` retourne `patrimoineNet.value - patrimoineLiquide.value` quand le bilan est vide
- **Fix dashboard table** : ligne "Aujourd'hui" affiche `patrimoineLiquide` et `patrimoineNet − patrimoineLiquide` au lieu des champs legacy
- **Suppression inputs fantômes** : les deux champs `<input v-model="soldesInitiaux.courant">` (mobile top-bar + Pilotage base card) remplacés par affichage lecture-seule `patrimoineLiquide` + bouton "Gérer les comptes" → Budget Structurel

---

## [15.3] — 2026-05-03 — Patchs critiques de trésorerie (QA Audit)

### Corrections critiques
- **Fix 1 — Injections de cash doublées** : dans `bilan` computed (blocs `isCurrentMonth` et `else`), les entrées d'argent irrégulières déjà pointées comme payées étaient quand même soustraites du solde. Correction : `if (due < 0) return isItemPaid(d, due) ? s : s + due;`
- **Fix 2 — Variable fantôme `isPassed`** : `soldeFinal`, `epargneTotaleFinal`, `auditFinancier` et `lineChartConfig` filtraient sur `!b.isPassed` alors que `bilan` ne génère jamais cette propriété (il boucle uniquement sur les mois présents et futurs via `startM`). Condition retirée.
- **Fix 3 — `surplusMensuelMoyen` gonflé dans Audit** : `statsFluxAnnee` calculait le surplus sans déduire l'épargne, faussant la Jauge 2. Remplacé par `surplusMensuelBase.value` qui intègre déjà toutes les déductions (revenus − fixes − variables − épargne).

---

## [15.2] — 2026-05-03 — Patch patrimoineLiquide (double bug migration)

### Corrections critiques
- **Bug `soldeInitial` → `solde`** : `migrateToV15()` créait les comptes avec le champ `soldeInitial` alors que tous les calculés (`patrimoineLiquide`, `patrimoineNet`) lisent `c.solde` → tous les comptes migrés affichaient 0
- **Bug `inclureLiquidite: false`** : migration posait `false` pour "Épargne Long Terme" et "Bourse / CTO" → exclus du ruban alors que l'utilisateur les veut comptés
- **`patchV151()`** : patch idempotent appliqué au chargement — renomme `soldeInitial→solde` si `solde` absent, passe `inclureLiquidite` à `true` pour tous les comptes existants en base
- **`migrateToV15()` corrigée** : utilise désormais `solde` (pas `soldeInitial`) et `inclureLiquidite: true` pour les 4 comptes legacy — correct pour les futures installations fraîches

---

## [15.1] — 2026-05-03 — Corrections UX/UI (Sous-étape 3)

### Corrections critiques
- **Ruban fixe** : le solde affiché est maintenant `patrimoineLiquide` (somme des comptes avec `inclureLiquidite: true`) — plus de valeur statique hardcodée
- **`inclureLiquidite`** : nouveau toggle par compte — contrôle quels comptes entrent dans le calcul du patrimoine liquide (affiché dans le header)
- **Bug Changelog UI** : entrée v15.0 ajoutée dans le tableau `CHANGELOG` du setup Vue — la modale affiche maintenant les vraies notes de mise à jour

### Restructuration des onglets
- **⚙️ Moteur Mensuel → ⚙️ Budget Structurel** : renommage + CRUD comptes déplacé ici (architecture financière au même endroit)
- **🎯 Pilotage Mensuel** : nouvel onglet dédié extrait de Budget Structurel — contient checklist, pointage factures, toggles décalage paie, sélecteur mois/semaines
- **🛠️ Paramètres** : ne contient plus le CRUD comptes (déplacé dans Budget Structurel) — reste ribbon, finances globales, branding

### Nettoyage UI
- Suppression définitive du bloc "Copier le prompt IA" (desktop audit + mobile audit + mobile CFO) — sera remplacé par injection directe au CFO Agent (Phase 3)

---

## [15.0] — 2026-05-01

### Architecture
- Passage schema v14 → v15 : ajout `comptes[]` (comptes dynamiques) et `parametres{}` (réglages globaux)
- Migration idempotente au chargement : `migrateToV15()` garde `soldesInitiaux` intact, construit `comptes[]` et `parametres{}` à partir des données legacy
- Backup automatique `finance_data_v14_legacy.backup.json` déclenché à la première migration (idempotent, ne s'écrase jamais)
- Nouveau endpoint `backup_legacy.php` (POST) — sauvegarde froide avant migration
- Nouveau endpoint `upload_media.php` (POST multipart) — upload logo/favicon dans `/assets/`, validation MIME via finfo

### Nouveaux refs Vue 3
- `comptes` : tableau dynamique des comptes financiers
- `parametres` : objet de configuration globale (moisActuel, anneeActuelle, semainesRestantes, ribbon, branding)

### Calculs
- `patrimoineLiquide` : somme des comptes dont `inclureLiquidite !== false` (défaut : true pour tous)
- `patrimoineNet` : somme de tous les soldes de tous les comptes

### UI — Onglet Paramètres (🛠️)
- Nouveau tab `settings` dans la navigation latérale
- CRUD comptes : ajout, édition inline, suppression avec confirmation, réordonnancement (↑/↓)
- Toggles ribbon (4 cartes : Solde Mois, Cumulatif, Stats Annuelles, Projection)
- Paramètres finances globales (objectif fonds sécurité, hypothèse inflation)
- Branding : upload logo et favicon via `upload_media.php`

### Bilan
- Carte "Patrimoine Net" ajoutée aux KPIs du dashboard

---

## [13.8] et antérieur

Voir historique Git.
