# Protéger `/finance/` avec Caddy (basic_auth)

> **Pourquoi ici et pas un jeton dans l'application ?**
> Un jeton utilisable par l'interface doit être écrit dans `index.html`, donc
> lisible par quiconque fait « afficher la source ». C'était une sécurité en
> trompe-l'œil, retirée en v37.2. Caddy authentifie **avant** que PHP ne soit
> atteint : le navigateur s'authentifie une fois, et tous les appels de
> l'application (lecture *et* suppression) passent naturellement.

---

## 1. Générer le mot de passe haché

Sur le VPS :

```bash
caddy hash-password
```

La commande demande le mot de passe deux fois et affiche un hachage bcrypt
commençant par `$2a$14$…`. **Copiez-le tel quel.**

Variante non interactive (attention : le mot de passe apparaît dans
l'historique du shell) :

```bash
caddy hash-password --plaintext 'VotreMotDePasse'
```

> Si `caddy` n'est pas dans le `PATH` parce qu'il tourne en conteneur :
> ```bash
> docker exec -it <nom_du_conteneur_caddy> caddy hash-password
> ```

---

## 2. Le bloc à ajouter au Caddyfile

Dans le bloc de site qui sert déjà `n8n.beau.ink`, **avant** la directive qui
traite `/finance/` :

```caddyfile
n8n.beau.ink {

    # ── Finance Master : accès protégé ────────────────────────────────
    #  basic_auth est évalué AVANT le reste : PHP n'est jamais atteint
    #  sans authentification valide.
    @finance path /finance /finance/*
    basic_auth @finance {
        mohamed $2a$14$REMPLACEZ_PAR_VOTRE_HACHAGE
    }

    # … vos directives existantes (reverse_proxy vers n8n, php_fastcgi, etc.)
}
```

* `mohamed` : le nom d'utilisateur que vous taperez dans la fenêtre du navigateur.
* Le hachage est celui produit à l'étape 1. **Jamais le mot de passe en clair.**
* Le matcher `@finance` couvre `/finance` *et* tout ce qui est dessous
  (`/finance/index.html`, `/finance/get_ai_memory.php`, `/finance/save_data.php`…).

### Si `/finance/` est servi par `php_fastcgi`

Ajoutez la transmission de l'en-tête d'authentification, pour que PHP puisse
constater que Caddy est bien en place (c'est ce que vérifie `auth_amont()`
dans `get_ai_memory.php`) :

```caddyfile
    php_fastcgi unix//run/php/php8.3-fpm.sock {
        env HTTP_AUTHORIZATION {http.request.header.Authorization}
    }
```

> Sans cette ligne, la lecture fonctionne mais **la suppression reste
> refusée** : le code ne voit aucune preuve d'authentification et choisit de
> ne pas détruire. C'est volontaire — voir la section 5.

---

## 3. Appliquer

```bash
caddy validate --config /etc/caddy/Caddyfile   # vérifie AVANT de recharger
sudo systemctl reload caddy                    # rechargement sans coupure
```

En conteneur :
```bash
docker exec -it <caddy> caddy validate --config /etc/caddy/Caddyfile
docker exec -it <caddy> caddy reload --config /etc/caddy/Caddyfile
```

---

## 4. Vérifier

```bash
# Sans identifiants → 401
curl -s -o /dev/null -w '%{http_code}\n' https://n8n.beau.ink/finance/

# Avec identifiants → 200
curl -s -o /dev/null -w '%{http_code}\n' -u 'mohamed:VotreMotDePasse' https://n8n.beau.ink/finance/

# PHP voit-il l'authentification ? (nécessaire pour la suppression)
curl -s -u 'mohamed:VotreMotDePasse' \
     'https://n8n.beau.ink/finance/get_ai_memory.php?table=rag&limit=1' \
     | grep -o '"avertissement"' && echo "→ en-tête NON transmis : voir §2" \
                                 || echo "→ en-tête transmis, suppression active"
```

Dans le navigateur : rechargez `https://n8n.beau.ink/finance/`, saisissez vos
identifiants une fois. Le bandeau orange de l'onglet **Supervision IA**
disparaît et l'icône 🗑️ devient fonctionnelle.

---

## 5. Ce que ça protège — et ce que ça ne protège pas

**Protégé désormais :** toute l'application, y compris `save_data.php` qui
acceptait jusqu'ici d'écraser l'intégralité de votre état financier sans le
moindre contrôle. C'était l'exposition la plus grave, bien avant la
Supervision IA.

**À savoir :**

* **n8n doit continuer à joindre `/finance/`.** Les nœuds `Tool: Intent
  Compiler` et `Tool: Committer` appellent `pending_commit.php` et
  `save_data.php`. Deux options :
  * ajouter les identifiants dans les nœuds HTTP de n8n (authentification
    basique), ou
  * exclure les deux fichiers du matcher :
    ```caddyfile
    @finance path /finance /finance/*
    @api     path /finance/pending_commit.php /finance/save_data.php
    basic_auth @finance {
        mohamed $2a$14$…
    }
    # @api n'est pas couvert par basic_auth
    ```
    La seconde option **laisse ces deux endpoints ouverts** : c'est un
    compromis, pas une solution. Préférez la première.
* **HTTPS est indispensable.** L'authentification basique transmet les
  identifiants encodés en base64, pas chiffrés. Caddy fournit TLS
  automatiquement — ne désactivez pas cette protection.
* **Le code ne fait pas confiance aveuglément.** `get_ai_memory.php` cherche
  la preuve que la requête est passée par une authentification et refuse
  toute suppression à défaut. Entre un `git pull` et la mise à jour du
  Caddyfile, il existe une fenêtre pendant laquelle un endpoint de
  destruction serait ouvert : le code échoue en refusant de détruire.
* **Toute suppression est archivée** dans `vectors_supprimes.jsonl` (à côté
  des scripts PHP, exclu du dépôt). Si l'écriture de l'archive échoue, la
  suppression est annulée — une règle effacée par erreur reste récupérable.
