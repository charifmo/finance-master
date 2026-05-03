# Changelog — Finance Master

Toutes les modifications notables sont documentées ici.
Format : [version] — date — description

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
