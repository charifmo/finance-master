/* v37.138 Trois circuits et les nouveautés — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.137 Brave pour les réseaux sociaux";`, `const CURRENT_VERSION = "37.138 Trois circuits et les nouveautés";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.137 Brave pour les réseaux sociaux", date: "2026-11-12", changes: [`,
`                    const CHANGELOG = [
        { version: "37.138 Trois circuits et les nouveautés", date: "2026-11-12", changes: [
            "🧭 TROIS CIRCUITS, chacun ses critères — ACTUALITÉS (la note « projet » reste pour elles seules), ANNONCES, SIGNAUX SOCIAUX. Les annonces et les posts ne passent plus par la note « projet » qui les jetait (20 annonces trouvées par Brave, 0 retenue).",
            "🏷️ ANNONCES : une annonce n'est pas un comparable. Le serveur extrait ce qu'elle dit — prix demandé (total et/ou au m² ; le prix au m² n'est « calculé » que si prix et surface sont écrits), surface, lieu, date, type, zonage, constructibilité, titre foncier, accès — et ce qu'elle ne dit pas reste « inconnu ». Doublons fusionnés (même lien, même prix et même surface, même titre). L'application classe : « comparable » seulement pour un terrain, au lieu du bien, de surface connue du même ordre (÷4 à ×4), prix connu, zonage non contradictoire ; sinon « indication de marché », avec ses raisons. Toujours « prix demandé », jamais un prix de vente ; moins de 3 comparables solides : aucune réévaluation (« comparables insuffisants »).",
            "💬 SIGNAUX SOCIAUX : gardés seulement s'ils nomment le lieu et ont une adresse, dédupliqués, avec leur date si elle est connue et le niveau de lecture (« titre et extrait d'un moteur — publication complète non lue, véracité non vérifiée ») ; cités comme « signal non vérifié », jamais comme un fait ; aucun pertinent : rien n'est affiché.",
            "🗞️ CONTEXTE GÉNÉRAL plafonné à 4 ÉVÉNEMENTS distincts (plus 4 articles du même fait) ; exception, 2 au plus, pour une évolution majeure documentée : financement, marché attribué, tracé, démarrage des travaux.",
            "🆕 CE QUI EST NOUVEAU depuis l'analyse précédente : la base de la collecte sait quand CE bien a vu chaque article pour la première fois. Chaque actualité, annonce et signal est « nouveau », « mise à jour » (nouveau lien sur une histoire déjà connue) ou « déjà connu » ; la carte le dit (« 🆕 Depuis l'analyse du … : 2 nouveaux événements · 1 mise à jour · 3 déjà connus », ou « Rien de nouveau depuis l'analyse du … ») et le CFO doit le séparer, sans reformuler l'ancien comme du neuf.",
            "🔢 Compteurs PAR ÉTAPE (« 754 résultats lus par les moteurs → N actualités candidates → M retenues · annonces : X lues (Y comparables, Z indications) · signaux sociaux : S gardés ») ; « vérifiés par l'IA » devient « sélectionnés pour leur pertinence » ; « articles lus » devient « actualités retenues ».",
            "🐞 Un prix mal lu : « façade RN9, 180 DH/m² » donnait 9 DH/m² (le 9 de RN9 collé au prix) — corrigé.",
            "🛠️ Sur le VPS : « php cfo_veille_collecte.php chercher plan de mobilité ledesk » dit si un article est dans le corpus ; chaque ligne du journal indique son origine (« (cron) » ou « (manuel) »).",
            "PREUVE — test_veille_presse.php (120) : extraction des prix (« 180 DH/m² », « 3,5 MDH », « 1 200 000 DH », « 900 درهم للمتر », « RN9, 210 DH/m² »), surfaces (ha, m², هكتارات), doublons, signaux (lieu exigé, dédupliqués, trop vieux écartés, jamais forcés), contexte 4 événements + exception « décroche le marché », statuts de nouveauté ; test_veille_presse.mjs (101) : compteurs par étape, comparable / indications et leurs raisons, signal non vérifié, question (NOUVEAU, [A1], [I1], « AUCUNE réévaluation »), « Rien de nouveau », et sur le VRAI serveur : 1re revue « première analyse », 2e revue « déjà connu » / « mise à jour » ; test_veille_collecte (21, SQLite et PostgreSQL 16) : revue précédente, 1re vue par bien, « chercher ».",
        ] },
        { version: "37.137 Brave pour les réseaux sociaux", date: "2026-11-12", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.138');
