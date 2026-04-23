# 🚀 FINANCE MASTER - LE GUIDE COMPLET (V11.5)

Ce fichier unique contient toutes les commandes nécessaires pour gérer l'application sans jamais perdre de données ni de temps.

---

## 💻 1. DÉVELOPPEMENT & TEST (SUR VOTRE PC)

### Dossier de travail :
C:\Users\HP\finance (ou via Git Bash : /c/Users/HP/finance)

### Lancer un test local :
Pour voir les modifications avant de publier :
1. Ouvrir Git Bash dans le dossier.
2. Taper : `python -m http.server 8000`
3. Aller sur : http://localhost:8000

---

## 📤 2. PUBLIER LES MODIFICATIONS (PC ➔ GITHUB)

À faire à chaque fois que tu modifies le code (avec ou sans Claude Code) :

```bash
# 1. Préparer les fichiers
git add .

# 2. Enregistrer la version (Change le message selon tes modifs)
git commit -m "Mise à jour : Intégration Studio par année et PDF"

# 3. Envoyer sur GitHub (le -f force la synchronisation si besoin)
git push origin main -f

# 1. Aller dans le dossier du site
cd /var/www/finance

# 2. Copier exactement le code de GitHub (écrase les fichiers locaux)
git fetch --all
git reset --hard origin/main

# 3. Rétablir les droits d'écriture (CRUCIAL pour sauver les données)
chown -R www-data:www-data /var/www/finance
chmod -R 777 /var/www/finance