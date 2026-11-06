/* v37.103 Exceptionnelles rangées — bump de version (Finance 37.103, Santé 1.22) + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const remplacer = (F, label, anchor, replacement) => {
    const src = readFileSync(F, 'utf8'), n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${F} — ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    writeFileSync(F, src.replace(anchor, replacement));
};
remplacer('index.html', 'CURRENT_VERSION', `const CURRENT_VERSION = "37.102 Santé enregistre";`, `const CURRENT_VERSION = "37.103 Exceptionnelles rangées";`);
remplacer('index.html', 'CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.102 Santé enregistre", date: "2026-11-04", changes: [`,
`                    const CHANGELOG = [
        { version: "37.103 Exceptionnelles rangées", date: "2026-11-06", changes: [
            "⚡ CHAQUE DÉPENSE EXCEPTIONNELLE A SA CATÉGORIE — « Four maman », « Nejar »… (onglet Flux) n'apparaissaient pas dans la liste des catégories : elles tombaient toutes dans l'unique « Dépense exceptionnelle ». Chacune y est désormais, sous « Dépense exceptionnelle » (« · Four maman »), dans tous les menus ; les règles et l'IA les reconnaissent (« four maman » y est rangé d'office).",
            "🧹 LE MÉNAGE TOUT SEUL — au chargement, les opérations déjà saisies qui nomment une de ces lignes y sont rangées (et enregistrées) : celles de « Dépense exceptionnelle » ou non catégorisées, et celles « à vérifier » proposées ailleurs par l'IA dont le libellé est exactement le nom de la ligne. Vos rangements à la main ailleurs ne bougent pas. Une ligne renommée : ses opérations la suivent ; supprimée : elles reviennent dans « Dépense exceptionnelle ».",
            "📊 Le Contrôle compare chaque ligne à son réel : « Four maman — 1 200 prévus, 1 400 dépensés ».",
            "🔢 Deux opérations créées dans la même milliseconde (import bancaire) pouvaient avoir le MÊME identifiant ; une correction ou un rangement tombait alors sur la mauvaise ligne. Chaque identifiant est désormais unique.",
            "🧾 Le compte d'une ligne de détail est celui de sa dépense : « elect marrakech villa » (détail de « Factures », Compte Principal ASSAFA) n'apparaît plus sur le Courant dans le Réalisé.",
            "🩺 SANTÉ 1.22 — LA v1.20 REVIENT, AVEC LA v1.21 : une ancienne version de Santé (1.3) avait été remise en ligne par-dessus la v1.20 (cockpit, plans, synchro du téléphone…), et son enregistrement effaçait ce que la v1.20 avait ajouté. Au premier chargement, Santé rétablit tout seul ces données depuis la dernière copie de sauvegarde v1.20, avec ce que vous aviez saisi depuis (cases, pesées, pas, bilans), et le dit en haut de l'écran.",
            "🩺 Santé 1.21 (incluse) : les vrais comptes rendus de labo (PDF) lus de façon fiable, une valeur très éloignée de la norme marquée « ❓ à vérifier » (pas une alerte), « 🧠 Faire valider par l'IA » qui relit la lecture et ne peut rien inventer.",
            "🩺 Santé : « ✓ enregistré » ne s'affiche plus quand une modification faite pendant l'envoi n'est pas encore partie (elle est renvoyée aussitôt).",
        ] },
        { version: "37.102 Santé enregistre", date: "2026-11-04", changes: [`);
remplacer('sante/index.html', 'VERSION', `const VERSION = '1.21';`, `const VERSION = '1.22';`);
{ const F = 'sante/index.html', t = readFileSync(F, 'utf8'); writeFileSync(F, t.split('?v=1.21"').join('?v=1.22"')); }   // les scripts locaux suivent la version (cache)
console.log('✔ version 37.103 (Santé 1.22)');
