/* v37.115 La réponse ne se perd plus — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.114 Le ruban du voyage";`, `const CURRENT_VERSION = "37.115 La réponse ne se perd plus";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.114 Le ruban du voyage", date: "2026-11-08", changes: [`,
`                    const CHANGELOG = [
        { version: "37.115 La réponse ne se perd plus", date: "2026-11-08", changes: [
            "📶 UN APPEL PENDANT QUE LE CFO RÉFLÉCHIT : SA RÉPONSE N'EST PLUS PERDUE — la question passe par le VPS (cfo_relais.php), qui attend la réponse de n8n à la place du téléphone et la garde. Répondre à un appel, ouvrir une autre appli, verrouiller l'écran : au retour, la réponse s'affiche (« le CFO continue sur le serveur… »). Même si le téléphone a fermé l'onglet : « Réponse retrouvée sur le serveur ». Jamais de question posée deux fois.",
            "🧷 Le compte posé automatiquement est retenu tel quel : si le CFO (ou le journal, ou un autre appareil) le change ensuite — « passe les saisies depuis vendredi sur Assafa dépenses annuelles » —, plus rien ne le remet sur le compte de la catégorie (la 37.112 pouvait défaire le travail du CFO au rechargement).",
            "💾 Avant d'envoyer une question au CFO, vos changements en attente sont enregistrés : le CFO travaille sur vos derniers chiffres, et son écriture ne croise plus une sauvegarde de l'écran (moins de « Le serveur a changé, l'écran non »).",
        ] },
        { version: "37.114 Le ruban du voyage", date: "2026-11-08", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.115');
