/* v37.96 Sauvegarde hors VPS — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.95 Telegram de secours";`, `const CURRENT_VERSION = "37.96 Sauvegarde hors VPS";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.95 Telegram de secours", date: "2026-11-02", changes: [`,
`                    const CHANGELOG = [
        { version: "37.96 Sauvegarde hors VPS", date: "2026-11-03", changes: [
            "💾 LA SAUVEGARDE QUITTE LE SERVEUR — tout vivait sur un seul VPS : s'il était perdu, tout l'était. Désormais, chaque nuit à 03:17, l'état de Finance Master (et de Santé Master) est copié, compressé, dans un dossier hors du site (30 jours gardés) ET envoyé dans votre conversation Telegram avec le bot du CFO : la copie est sur votre téléphone, hors du VPS. « php sauvegarde.php restaurer <fichier> --oui » la remet (l'état actuel est sauvegardé avant).",
            "🚨 SURVEILLANCE — chaque heure : les données se lisent-elles ? la dernière sauvegarde a-t-elle moins de 26 h ? n8n répond-il ? Sinon un message Telegram (au plus un toutes les 6 h par problème), puis « résolu » quand c'est réparé.",
            "Une fois sur le VPS : « sudo bash install.sh sauvegarde » (le jeton du bot est lu dans n8n, rangé dans /etc/finance-master, lisible par root seul ; rien n'est écrit dans le dépôt).",
            "PREUVE — nouvelle suite « Sauvegarde hors du VPS » contre un faux Telegram : envoi du fichier, contenu restaurable, rotation, une seule alerte puis « résolu », échec d'envoi signalé, restauration avec sauvegarde préalable, bon jeton (bot CFO, pas le bot santé), bon chat.",
        ] },
        { version: "37.95 Telegram de secours", date: "2026-11-02", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.96');
