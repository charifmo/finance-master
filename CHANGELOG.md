# Changelog — Finance Master

Toutes les modifications notables sont documentées ici.
Format : [version] — date — description

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
- `patrimoineLiquide` : somme des soldes de tous les comptes de type `liquide`
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
