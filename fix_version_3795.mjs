/* v37.95 Telegram de secours — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.94 Janvier suivant";`, `const CURRENT_VERSION = "37.95 Telegram de secours";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.94 Janvier suivant", date: "2026-11-02", changes: [`,
`                    const CHANGELOG = [
        { version: "37.95 Telegram de secours", date: "2026-11-02", changes: [
            "📱 TELEGRAM « BAD REQUEST » : LA RÉPONSE ARRIVE QUAND MÊME — « Send Telegram : Bad request » (13:55, 22:25) : le CFO avait répondu, mais Telegram a refusé le message. En mode HTML, il rejette TOUT le message à la moindre mise en forme qu'il ne sait pas lire (une balise dans un bloc de code, par exemple) : vous ne receviez rien.",
            "✅ DÉSORMAIS — la mise en forme ne met plus aucune balise dans un bloc de code ; et si Telegram refuse encore, le message n'est plus perdu : il repart aussitôt en TEXTE BRUT par un second envoi (« Send Telegram (texte brut) », même bot), que Telegram ne peut pas refuser ; la réponse vocale suit. La mention « This message was sent automatically with n8n » disparaît. Sur le VPS : « sudo bash install.sh cfo » installe tout cela dans le workflow en service.",
            "PREUVE — la suite « Le workflow n8n du CFO » vérifie, après install.sh cfo : sortie « erreur » de Send Telegram reliée au secours en texte brut (même bot), suite vers la réponse vocale, mise en forme v37.95 (texte brut fourni, blocs de code nus), plus de mention n8n.",
        ] },
        { version: "37.94 Janvier suivant", date: "2026-11-02", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.95');
