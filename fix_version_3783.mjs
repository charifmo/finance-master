/* v37.83 CFO branché — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.82 Graphiques";`, `const CURRENT_VERSION = "37.83 CFO branché";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.82 Graphiques", date: "2026-10-29", changes: [`,
`                    const CHANGELOG = [
        { version: "37.83 CFO branché", date: "2026-10-29", changes: [
            "🔌 LE CFO SE BRANCHE TOUT SEUL — « C'est quoi ce truc ? » (« Configuration requise : collez l'URL du Webhook n8n »). L'adresse du CFO n'était mémorisée que dans le navigateur où on l'avait collée : sur un autre navigateur, un téléphone, ou après un effacement des données du site, il la redemandait. L'appli est servie par le même serveur que n8n : son webhook est à la même adresse (…/webhook/finance-cfo-web). Sans adresse enregistrée, l'appli la déduit d'elle-même — plus rien à coller. Une adresse enregistrée à la main garde la priorité ; en local (localhost, fichier) rien n'est deviné.",
            "PREUVE — la déduction (https, adresse du serveur, chemin du webhook ; rien en local, en fichier ni en localhost), la priorité de l'adresse enregistrée, et le CFO utilisable sans configuration. Rejouée sur la v37.82 : en échec.",
        ] },
        { version: "37.82 Graphiques", date: "2026-10-29", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.83');
