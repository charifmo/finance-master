/* v37.69 Coquille — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.68 Ménage";`, `const CURRENT_VERSION = "37.69 Coquille";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.68 Ménage", date: "2026-10-28", changes: [`,
`                    const CHANGELOG = [
        { version: "37.69 Coquille", date: "2026-10-28", changes: [
            "🐚 LE WORKFLOW n8n DU CFO DEVIENT UNE COQUILLE — « Je veux refaire le CFO s'il le faut pour éviter ce genre de problème critique. » Les modifications du budget passaient déjà par le moteur du VPS (pending_commit.php) ; mais le contexte lu par le modèle était fabriqué DANS n8n (sur Telegram, il laissait tomber la lecture calculée par l'appli) et ses consignes étaient figées dans le nœud « AI Agent ». Désormais le nœud « Build Agent Input » demande les deux au VPS (cfo_contexte.php + cfo_system_prompt.md) : un git pull suffit pour faire évoluer ce que le CFO lit et les règles qu'il suit. Si le VPS ne répond pas, le nœud garde une copie de secours identique et le CFO répond quand même.",
            "📜 DES CONSIGNES QUI INTERDISENT DE RECALCULER — nouvelle règle §0 « tu lis, tu ne calcules pas » : le compte de chaque ligne est celui de l'appli (jamais supposé courant), montant_ce_cycle intègre les exceptions, budget_ce_cycle est déjà le coût du cycle (jamais × 4,33), « combien virer sur le Courant » se lit dans alimentation_du_courant ; un chiffre absent se dit absent, une estimation se présente comme telle. L'ancienne consigne « pour tout le reste, lis le JSON et calcule » est retirée.",
            "INSTALLATION EN UNE COMMANDE, RÉVERSIBLE — « sudo bash install.sh cfo » sauvegarde vos workflows, ne change que les deux nœuds concernés dans le workflow actif (identifiants Telegram, Gemini, Postgres et OpenAI intacts), l'importe, le publie et redémarre n8n ; « sudo bash install.sh cfo-retour » remet la version d'avant.",
            "PREUVE — nouvelle suite « Le workflow n8n du CFO : une coquille » : 16 contrôles, dont le code du nœud exécuté comme n8n le ferait — VPS joignable (il suit des consignes changées par un git pull), puis injoignable (copie de secours) — et la copie de secours qui donne exactement le même contexte que le VPS. Cinq défauts réintroduits exprès (lecture du moteur absente côté VPS, consignes non servies, AI Agent non branché, secours sans la lecture du moteur, consignes du VPS ignorées) : tous attrapés.",
        ] },
        { version: "37.68 Ménage", date: "2026-10-28", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.69 Coquille');
