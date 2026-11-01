/* v37.90 Connexion CFO — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.89 Courant au juste besoin";`, `const CURRENT_VERSION = "37.90 Connexion CFO";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.89 Courant au juste besoin", date: "2026-11-01", changes: [`,
`                    const CHANGELOG = [
        { version: "37.90 Connexion CFO", date: "2026-11-02", changes: [
            "📶 « ERREUR DE CONNEXION AU CFO — FAILED TO FETCH » — ce message du navigateur veut dire : AUCUNE réponse (une erreur du serveur en serait une). Au téléphone, la cause la plus fréquente : l'écran se verrouille ou on change d'appli pendant l'attente, Chrome suspend l'onglet et coupe la requête — alors que le CFO continue côté serveur.",
            "✅ DÉSORMAIS — pendant l'attente, l'écran reste allumé (quand le navigateur le permet). Sur « Failed to fetch », l'appli enquête et le dit en clair : pas de réseau ; « le CFO a bien reçu votre question, la connexion a été coupée pendant l'attente » (étapes notées par le VPS, l'écran est relu) ; une adresse de webhook enregistrée dans CE navigateur qui ne répond pas → la question repart aussitôt vers l'adresse du serveur, gardée pour la suite ; ou « le serveur répond, mais pas le CFO (n8n) » avec la commande à lancer sur le VPS. Un bouton « ↻ Renvoyer la question ».",
            "PREUVE — nouvelle suite « Connexion au CFO » (faux serveur finance.test) : adresse morte corrigée et réponse affichée, connexion coupée reconnue puis question renvoyée, n8n muet, hors ligne. Rejouée sur la v37.89 : en échec.",
        ] },
        { version: "37.89 Courant au juste besoin", date: "2026-11-01", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.90');
