/* v37.19 Sync-Coherente — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.18 Logistique-Bancaire";`, `const CURRENT_VERSION = "37.19 Sync-Coherente";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.18 Logistique-Bancaire", date: "2026-10-04", changes: [`,
`                    const CHANGELOG = [
        { version: "37.19 Sync-Coherente", date: "2026-10-05", changes: [
            "VOTRE SIGNALEMENT, REPRODUIT — « sur un autre PC, c'est comme si les données s'écrasaient ». Joué pour de vrai : le vrai save_data.php, deux navigateurs (deux PC), en mode fichier ET avec une vraie base Postgres. Deux défauts, tous deux confirmés.",
            "DÉFAUT 1 (mode Postgres) — LIRE AILLEURS QUE LÀ OÙ L'ON ÉCRIT. Les sauvegardes allaient dans la base, mais l'appli relisait au démarrage le FICHIER finance_data.json, que plus rien ne mettait à jour. Un autre PC ouvrait donc l'appli sur un état ancien — puis le ré-enregistrait par-dessus le bon, à la première modification ou au premier auto-backup. Désormais l'appli lit par save_data.php, la même porte que l'écriture ; chaque écriture en base est recopiée dans le fichier ; et une base encore vide laisse voir le fichier existant au lieu de valeurs par défaut.",
            "DÉFAUT 2 (les deux modes) — UN ONGLET OUBLIÉ ÉCRASAIT LES AUTRES. Un onglet resté ouvert sur le PC A, sur une version périmée, enregistrait par-dessus ce que le PC B venait d'enregistrer, sans le moindre avertissement. Désormais chaque sauvegarde dit au serveur sur quelle version elle a travaillé ; si le serveur a bougé entre-temps, il REFUSE (409) et rien n'est écrasé. Le bandeau propose alors : recharger la version du serveur, ou imposer celle de l'appareil — un choix explicite, jamais un accident.",
            "REVENIR SUR UN ONGLET LE MET À JOUR — dès que l'onglet redevient visible, l'appli relit le serveur. Sans modification en cours, l'écran se met à jour tout seul ; avec des saisies non enregistrées, le bandeau demande quoi faire.",
            "L'AGENT CFO N'EST PAS CASSÉ — ses écritures (n8n) ne présentent pas de version : elles sont acceptées exactement comme avant. Le journal indique maintenant la source des données (postgres ou fichier) à l'ouverture et à chaque sauvegarde.",
            "PREUVE — nouvelle suite « deux PC » : ce que l'un enregistre, l'autre le lit ; l'onglet périmé est refusé et prévenu ; « Recharger » et « Imposer » font ce qu'ils disent ; le retour sur l'onglet rattrape ; un troisième PC ouvert à froid voit le dernier état ; le fichier suit la base. Rejouée sur la v37.18 : 13 échecs.",
        ] },
        { version: "37.18 Logistique-Bancaire", date: "2026-10-04", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.19 Sync-Coherente');
