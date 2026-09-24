import fs from 'node:fs';
const FILE = new URL('./index.html', import.meta.url);
let s = fs.readFileSync(FILE, 'utf8');
const CRLF = s.includes('\r\n'); if (CRLF) s = s.split('\r\n').join('\n');
const sub = (from, to, n = 1) => { const c = s.split(from).length - 1;
    if (c !== n) throw new Error(`Ancre (${c}/${n}) : ${from.slice(0,110)}`); s = s.split(from).join(to); };

sub(`                    const CURRENT_VERSION = "37.6 Dates-Tolerantes";`,
    `                    const CURRENT_VERSION = "37.7 Retour-Ecriture";`);

const E = [
`        { version: "37.7 Retour-Ecriture", date: "2026-09-24", changes: [`,
`            "LE MOTEUR ÉCRIVAIT BIEN — reproduction locale des trois « date cible = 2027-12 » sur vos objectifs (Fonds d'urgence, Lissage Dépenses Annuelles, Épargne Long Terme) : les trois passent, date_cible vaut 2027-12 dans l'état muté, et operations_appliquees les liste une à une. Le « ✓ appliqué » du CFO disait vrai.",`,
`            "C'EST L'ÉCRAN QUI NE SUIVAIT PAS — l'agent n'écrit pas dans l'onglet ouvert : il écrit sur le VPS (pending_commit.php compile, le nœud Committer relit le pending et le POSTe à save_data.php). Or executerImportFusion() n'était appelé qu'au montage de la page et à l'import d'un fichier. JAMAIS après un tour de conversation. L'onglet affichait donc, indéfiniment, l'état chargé au démarrage. Voilà le symptôme qui revient depuis la v35.5 : « le CFO dit que c'est appliqué, mais rien ne bouge dans l'UI ». Les champs DATE CIBLE vides de votre capture ne sont pas vides sur le serveur.",`,
`            "AGGRAVANT — le garde-fou anti-écrasement de la v35.5 voyait la divergence et se taisait. Il annulait l'auto-backup et écrivait une ligne dans un journal que personne n'ouvre : l'onglet devenait incapable de sauvegarder, sans le moindre signe à l'écran.",`,
`            "CORRECTIF — après CHAQUE échange avec le CFO (chat et Merlin, même webhook donc même Committer), l'application relit le serveur et compare la signature. Si l'état a changé et que l'onglet n'a rien à perdre, il se recharge et le dit dans le fil : « 🔄 Écran resynchronisé ». La confirmation vient désormais de l'état réellement relu, plus du récit du modèle.",`,
`            "ON N'ÉCRASE RIEN SANS DEMANDER — si vous avez des modifications non sauvegardées, aucun rechargement automatique : un bandeau nomme l'arbitrage (recharger perd vos saisies ; les garder écrasera l'écriture du serveur au prochain « Sauver sur VPS ») et vous laisse trancher. Le même bandeau s'affiche quand l'auto-backup refuse de partir.",`,
`            "RESTE À VOUS — la valeur cible de 10 000 DH sur « Épargne Long Terme » et « Fonds d'urgence » vient du repli inventé par l'ancien moteur ; je ne la corrige pas d'office, c'est une décision financière. Le repli est en revanche devenu inatteignable depuis la v36.0 : target_amount est un paramètre requis, strictement positif."`,
`        ] },`].join('\n');

sub(`                    const CHANGELOG = [\n`, `                    const CHANGELOG = [\n${E}\n`);
if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ version 37.7 + changelog');
