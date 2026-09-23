# n8n derrière le Basic Auth Caddy — nœuds à corriger

Depuis que `basic_auth` protège `/finance/`, **tout appel n8n sans en-tête
`Authorization` reçoit un 401**. Le CFO ne peut alors plus lire l'état, ni
committer, ni écrire une transaction réelle — sans message d'erreur explicite,
juste des outils qui échouent.

Scan complet des 3 exports du dépôt (`super_agent_cfo_audio.json`,
`super_agent_cfo.json`, `cfo_memory_ingest.json`) : **aucun nœud « HTTP
Request » natif**, tous les appels passent par du JavaScript custom.

---

## 1. D'abord : les variables d'environnement n8n

**N'écrivez pas les identifiants dans les nœuds.** Un secret inscrit dans le
code part dans l'export JSON du workflow — donc dans ce dépôt Git, et dans son
historique pour toujours.

Sur le serveur n8n, ajoutez :

```bash
FINANCE_USER=mohamed
FINANCE_PASS=VotreMotDePasseEnClair
N8N_BLOCK_ENV_ACCESS_IN_NODE=false
```

> **La 3e ligne est indispensable en n8n 2.x.** Depuis la v2, n8n interdit
> `$env` dans les nœuds Code par défaut. Sans elle, `$env.FINANCE_USER` lève
> une erreur, le `try/catch` l'avale, aucun en-tête ne part → **401**, alors
> même que les deux variables sont bien définies dans le conteneur (cas vécu
> le 23/09, v37.5). Vérification sans afficher le secret :
> `docker exec n8n sh -c 'echo "${FINANCE_USER:+OK} ${FINANCE_PASS:+OK} $N8N_BLOCK_ENV_ACCESS_IN_NODE"'`
> doit afficher `OK OK false`.

* **Docker Compose** : dans `environment:` du service n8n.
* **systemd** : dans le fichier `EnvironmentFile`, ou `Environment=` de l'unité.
* Puis **redémarrez n8n** (les variables sont lues au démarrage).

> `FINANCE_PASS` est le mot de passe **en clair**, pas le hachage bcrypt du
> Caddyfile. Caddy compare le clair reçu au hachage qu'il stocke.

Si ces variables sont absentes, le bloc ci-dessous laisse `authHeader` vide et
la requête part comme avant : rien n'est cassé, l'échec reste là où il était.

---

## 2. Préambule à coller en TÊTE de chaque nœud concerné

Identique dans les quatre nœuds — copiez-le tel quel, tout en haut du code :

```javascript
// ── v37.3 : authentification Caddy (basic_auth sur /finance/) ──────────
//  Les identifiants viennent des variables d'environnement n8n, JAMAIS du
//  code : un secret écrit ici partirait dans l'export JSON du workflow.
//  Définir sur le serveur n8n : FINANCE_USER et FINANCE_PASS.
let authHeader = '';
try {
  const u = $env.FINANCE_USER, p = $env.FINANCE_PASS;
  if (u && p) authHeader = 'Basic ' + Buffer.from(u + ':' + p).toString('base64');
} catch (e) { /* $env indisponible : on part sans en-tête, comme avant */ }
const authHeaders = authHeader ? { Authorization: authHeader } : {};
```

---

## 3. Les nœuds, un par un

### ▸ `Normalize Input` — *1 appel*

Cherchez `url: 'https://n8n.beau.ink/finance/save_data.php'` et ajoutez la
ligne `headers` :

```javascript
    const fetched = await this.helpers.httpRequest({
      method: 'GET',
      url: 'https://n8n.beau.ink/finance/save_data.php',
      headers: { ...authHeaders },          // ← AJOUTER
      json: true,
      timeout: 10000
    });
```

### ▸ `Tool: Committer` — *3 appels*

```javascript
  // (1) lecture du pending
  pending = await this.helpers.httpRequest({
    method: 'GET',
    url: PENDING_URL + '?session_id=' + encodeURIComponent(session_id),
    headers: { ...authHeaders },            // ← AJOUTER
    json: true,
    timeout: 10000
  });
```

```javascript
  // (2) écriture — la ligne headers EXISTE déjà, il faut la compléter
    headers: { 'Content-Type': 'application/json', ...authHeaders },
```

```javascript
  // (3) nettoyage du pending
    method: 'DELETE',
    url: PENDING_URL + '?session_id=' + encodeURIComponent(session_id),
    headers: { ...authHeaders },            // ← AJOUTER
    json: true,
    timeout: 5000
```

### ▸ `Tool: Transactions Réelles` — *1 appel*

Ligne `headers` existante, à compléter :

```javascript
      headers: { 'Content-Type': 'application/json', ...authHeaders },
```

### ▸ `Tool: Intent Compiler` — *1 appel — DÉJÀ FAIT par vous*

```javascript
    headers: { ...authHeaders },            // ← déjà présent chez vous
```

Si vous y avez codé le base64 en dur, remplacez-le par le préambule du §2 pour
que le secret sorte du workflow.

---

## 4. Nœuds qui n'ont **PAS** besoin d'être modifiés

| Nœud | Pourquoi |
|---|---|
| `Tool: Memory Writer` | Appelle `/webhook/finance-memory-ingest` — un webhook **n8n**, pas `/finance/`. Hors du matcher Caddy. |
| Workflow `cfo_memory_ingest.json` (7 nœuds) | Écrit dans PostgreSQL **en direct** via le nœud pgVector. Ne passe jamais par HTTP. |
| Tous les autres nœuds | Aucun appel réseau vers le VPS. |

---

## 5. Vérifier

Après redémarrage de n8n et mise à jour des nœuds :

```bash
# 1. Sans identifiants → 401 attendu
curl -s -o /dev/null -w '%{http_code}\n' https://n8n.beau.ink/finance/save_data.php

# 2. Avec → 200 attendu
curl -s -o /dev/null -w '%{http_code}\n' \
     -u 'mohamed:VotreMotDePasse' https://n8n.beau.ink/finance/save_data.php
```

Puis, dans le CFO : posez une question simple (« quel est mon surplus ? »). Si
`Normalize Input` n'est pas authentifié, le contexte financier arrive vide et
l'agent répond qu'il ne trouve pas les données — c'est le symptôme à guetter.

Enfin, testez une écriture (« passe le loyer à 4500 ») puis **OUI** : cela
exerce `Tool: Intent Compiler` **et** `Tool: Committer`, donc 4 des 6 appels.

---

## 6. ⚠️ Un second workflow existe dans le dépôt

`super_agent_cfo.json` (20 nœuds) contient les **mêmes appels** non
authentifiés, dans `Normalize Input`, `Tool: Committer`, `Tool: Intent
Compiler` et `Tool: Budget Engine`.

C'est la version **antérieure** au refactoring de la phase 3 : elle contient
encore `Tool: Budget Engine`, supprimé depuis. Elle n'a donc pas été corrigée
ici — le faire reviendrait à maintenir du code mort.

**Si ce workflow tourne encore dans votre n8n, il échouera en 401.** Vérifiez
la liste de vos workflows actifs : soit vous le désactivez, soit dites-le-moi
et je le mets à jour.
