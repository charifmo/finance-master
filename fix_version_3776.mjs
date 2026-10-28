/* v37.76 Dictionnaire — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.75 Vos comptes";`, `const CURRENT_VERSION = "37.76 Dictionnaire";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.75 Vos comptes", date: "2026-10-28", changes: [`,
`                    const CHANGELOG = [
        { version: "37.76 Dictionnaire", date: "2026-10-28", changes: [
            "🛒 CARREFOUR VA DANS « SUPER MARCHÉ », SANS IA — « Il n'a pas su ajouter Carrefour à Supermarché ! » Le dictionnaire traduisait bien « carrefour » en « supermarché »… qui touchait deux de vos lignes par le début du mot (« Super marché » et une autre ligne « Super marché … » dans une autre catégorie) : ex aequo, la note tombait sous le seuil, l'opération partait à l'IA. La ligne qui s'écrit EXACTEMENT comme le mot (« Super marché » = « supermarché ») passe désormais devant : rangée, sûre, sans un token. Même chose pour BIM, Acima, Label'Vie, Kazyon, Hanout…",
            "📚 UN DICTIONNAIRE BEAUCOUP PLUS RICHE — enseignes du Maroc et variantes darija pour 19 thèmes : supermarchés, fast-food et livraison, restaurants, cafés, mode, sport, maison et électroménager, téléphone (Orange Maroc, IAM, inwi), abonnements (Spotify, Shahid, Apple, Google Play…), IA et logiciels, analyses (les libellés bancaires tronqués « LAB D AN… »), pharmacie, voyages (Airbnb, Booking, RAM, Ryanair…), jouets, bébé, cadeaux, stations-service, transport, impôts et administration.",
            "🔤 VOS VARIANTES ENTRENT AU DICTIONNAIRE — « Une fois que je corrige quelque chose de l'IA ou de suspendu, il l'ajoute au dictionnaire sous variantes. » Une correction de catégorie (journal, « À catégoriser »), une opération en suspens validée telle quelle, ou une réponse SÛRE de l'IA : le commerçant (le premier mot qui le nomme — pas « paiement », ni une ville) entre au dictionnaire, vers votre catégorie. « Carrefour Market Gueliz » profite de « carrefour » appris, même si l'opération d'origine a été supprimée. Votre correction l'emporte toujours sur l'IA, et vos choix ne sont plus mis en doute par le dictionnaire. Chaque variante est listée dans « Ce que l'appli a appris », avec 🗑 pour l'oublier.",
            "✅ UNE OPÉRATION EN SUSPENS ENREGISTRÉE SANS CHANGER SA CATÉGORIE EST VALIDÉE — avant, elle restait « à vérifier ». Un libellé inconnu rangé d'office « par défaut » n'est jamais validé ainsi : il ne devine rien.",
            "📈 LA FRISE DU CYCLE, EN VUE — « Le bouton pour accéder au visualiseur de cycle et semaines doit être visible. » Un bouton « 📈 Cycle et semaines » dans l'en-tête du Pilotage, et un vrai bouton « Voir le cycle et ses semaines » dans la Météo (au lieu d'un petit lien souligné).",
            "PREUVE — nouvelle suite « Dictionnaire et variantes » : Carrefour et cinq autres enseignes rangés sûrs malgré « Super marché Karim » ; une correction devient une variante, survit à la suppression de l'opération, s'affiche et s'oublie ; une opération en suspens validée et apprise, jamais un rangement par défaut ; une réponse sûre de l'IA apprise, une réponse moyenne non, votre correction la remplace et l'IA ne l'écrase plus ; votre choix devant le dictionnaire ; la frise. Rejouée sur la v37.75 : en échec ; défauts réintroduits exprès : attrapés.",
        ] },
        { version: "37.75 Vos comptes", date: "2026-10-28", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.76 Dictionnaire');
