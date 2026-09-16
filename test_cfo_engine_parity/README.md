# Parité moteur JS → PHP

Ce dossier prouve que `cfo_intent_engine.php` se comporte **exactement** comme le
JavaScript qu'il remplace, celui qui vivait dans le nœud n8n « Tool: Intent Compiler »
avant la phase 3 du refactoring.

## Lancer

```bash
node run_js.mjs && php run_php.php && python3 compare.py
```

Sortie attendue : `27/27 cas strictement identiques`.
Le script rend un code retour non nul au moindre écart — utilisable en CI.

## Contenu

| Fichier | Rôle |
|---|---|
| `ref_js.mjs` | Le moteur JavaScript **d'origine**, extrait verbatim du nœud n8n avant refactoring. Figé : c'est la référence, il ne doit plus bouger. |
| `fixture.json` | Un état financier complet et réaliste — exercice 2026, revenus, charges fixes, charges variables avec sous-lignes, épargne au schéma array, dépenses irrégulières, comptes, objectifs, actifs productifs et fonciers. |
| `cases.json` | 27 scénarios couvrant les 18 fonctions du catalogue. |
| `run_js.mjs` / `run_php.php` | Exécutent les mêmes cas sur chaque moteur. |
| `compare.py` | Compare le résultat **et** l'état muté, en neutralisant ce qui est volatil par construction. |

## Ce qui est neutralisé, et pourquoi

Deux choses diffèrent nécessairement entre deux exécutions, quel que soit le moteur :

- les identifiants, dérivés de l'horloge (`Date.now()` / `microtime()`) ;
- le suffixe base36 aléatoire des clés techniques créées par un `add` — ce suffixe
  existe justement pour que trois ajouts du même libellé produisent trois clés
  distinctes (fix v15.14).

`compare.py` les remplace par `<id>` et `_*`. **Tout le reste est comparé au
caractère près**, y compris les montants, les libellés, l'ordre des clés, la forme
des collections vides et les journaux d'opérations.

## Couverture

18 fonctions du catalogue, plus : correspondance approximative avec accents et
fautes de frappe, redistribution proportionnelle sur sous-lignes, ciblage d'une
sous-ligne, transfert entre comptes en deux appels, épargne en pourcentage du
reliquat, clonage d'année, auto-création d'un exercice absent, multi-exercices,
cible introuvable (clarification), et appel hors catalogue.
