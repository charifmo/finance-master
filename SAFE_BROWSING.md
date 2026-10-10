# Chrome : « hameçonnage détecté » sur n8n.beau.ink

Google Safe Browsing signale l'**hôte** `n8n.beau.ink`. L'application Finance,
servie sous `/finance/`, hérite donc de l'avertissement. Seul le propriétaire
du domaine peut faire lever le signalement, et Google ne le fait que si le site
est sain. On vérifie donc d'abord, puis on demande le réexamen.

## Pourquoi ce signalement

Deux causes possibles :

1. **Le faux positif connu des n8n auto-hébergés.** Le nom d'hôte contient
   « n8n », et la page de connexion de n8n est publique. Elle ressemble à celle
   de n8n.io : les filtres de Google y voient une imitation. Beaucoup
   d'instances auto-hébergées ont été signalées ainsi (n8n, Immich, Nextcloud…).
2. **Un vrai détournement.** Depuis octobre 2025, des campagnes d'hameçonnage
   servent leurs pages piégées par des **webhooks n8n** (rapport Cisco Talos).
   Un n8n pas à jour, ou dont le mot de passe a fuité, peut héberger à l'insu de
   son propriétaire un workflow qui sert une page HTML ou un formulaire.

## 1. Vérifier (une commande, lecture seule)

Sur le VPS, après `git pull` :

```bash
sudo bash /var/www/finance/install.sh securite
```

Elle affiche la version de n8n et chaque workflow **actif** qui expose quelque
chose au public : webhook, formulaire n8n, page HTML. Les deux webhooks de
l'application (`finance-cfo-web` et `finance-memory-ingest`, en POST, réponse
JSON) sont reconnus. Tout le reste est marqué **À VÉRIFIER**.

La commande ne modifie rien et ne redémarre rien.

- **`[OK] … très probablement un faux positif`** : passez à l'étape 2.
- **`[A VERIFIER]`** : ouvrez ce workflow dans n8n. Si vous ne l'avez pas créé :
  1. désactivez-le et supprimez-le ;
  2. changez le mot de passe de n8n ;
  3. mettez n8n à jour (`docker pull n8nio/n8n:latest`, puis recréez le
     conteneur).

  Demandez seulement ensuite le réexamen.

## 2. Demander le réexamen à Google

**Le plus rapide (2 minutes, sans vérification du domaine)** : le lien
« Contactez-nous » de la page d'avertissement, ou directement
<https://safebrowsing.google.com/safebrowsing/report_error/?hl=fr>.
URL à indiquer : `https://n8n.beau.ink/`. Texte à coller (retirez la phrase
« /finance/ is protected… » si le `basic_auth` de `CADDY_SECURITE.md` n'est
pas actif chez vous) :

> This is a private, self-hosted personal finance dashboard and a self-hosted
> n8n automation server, both operated by the domain owner on their own VPS.
> /finance/ is protected by HTTP basic authentication. The site does not
> impersonate any brand and does not collect third-party credentials. I
> audited every active n8n workflow: no public form or HTML page is served.
> The warning is most likely a false positive caused by the "n8n" hostname and
> the n8n login page.

**Le plus solide (Search Console)** :
1. Ajoutez la propriété de domaine `beau.ink` sur <https://search.google.com/search-console>
   (vérification par un enregistrement DNS TXT).
2. Ouvrez *Sécurité et actions manuelles → Problèmes de sécurité* : la page
   signalée y est nommée.
3. Cliquez « Demander un examen » avec le même texte.

Le délai va de quelques heures à quelques jours.

## 3. Éviter que ça revienne (facultatif)

- **Déjà fait dans le code (v37.44)** : l'application se déclare non indexable
  (`<meta name="robots" content="noindex, nofollow, noarchive, nosnippet">`).
  Son titre ne porte plus de numéro de version obsolète.
- **Le plus efficace** : servir l'application sur un nom **sans « n8n »**
  (par exemple `finance.beau.ink`) et ne pas exposer l'éditeur n8n au public.
  Côté n8n, seuls `/webhook/*` doivent être joignables ; le reste peut passer
  derrière le `basic_auth` de Caddy (voir `CADDY_SECURITE.md`) ou une liste
  d'adresses IP autorisées.
- Dans le bloc Caddy de l'hôte, un `robots.txt` qui refuse l'indexation :

  ```caddyfile
  respond /robots.txt "User-agent: *
  Disallow: /" 200
  header X-Robots-Tag "noindex, nofollow"
  ```

Sources : [n8n Community — sous-domaine n8n signalé](https://community.n8n.io/t/n8n-subdomain-got-flagged-as-deceptive-website-by-google/31251) ·
[n8n Community — URL signalée après OAuth](https://community.n8n.io/t/google-tagged-my-url-as-phishing-after-using-n8n-oauth/23278) ·
[It's FOSS — Safe Browsing et les apps auto-hébergées](https://itsfoss.com/news/google-safe-browsing-flags-immich/) ·
[The Hacker News — webhooks n8n détournés depuis octobre 2025](https://thehackernews.com/2026/04/n8n-webhooks-abused-since-october-2025.html) ·
[Google — signaler une erreur Safe Browsing](https://developers.google.com/safe-browsing/v4/reporting)
