/* v37.44 Interface-Desktop — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.43 Creances-Encaissees";`, `const CURRENT_VERSION = "37.44 Interface-Desktop";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.43 Creances-Encaissees", date: "2026-10-10", changes: [`,
`                    const CHANGELOG = [
        { version: "37.44 Interface-Desktop", date: "2026-10-10", changes: [
            "AUDIT DE L'INTERFACE DE BUREAU — les 13 écrans mesurés automatiquement à 1280 et 1440 px. Constat à 1280 px : 672 textes en 7 à 9 px, 234 textes pâles sous 3:1 sur fond clair (gris clairs à 2,5:1 sur blanc), trois libellés du menu coupés (« Calendrier Plurian… », « Patrimoine & Obje… », « Contrôle Budget vs… »), les chiffres du tableau de bord qui sortaient de leur carte (27 à 60 px), 41 boutons-icônes (✕, ×, ↑, ↓) sans nom. Aucune erreur JavaScript, aucun débordement horizontal.",
            "LISIBLE — sur ordinateur, plus aucun texte sous 10 px (sauf le monogramme du compte). Les gris et couleurs pâles posés sur fond clair passent au ton au-dessus (gris : 2,5:1 → 4,8:1) ; sur fond sombre, rien ne bouge — la surface la plus proche décide. Le menu affiche ses libellés en entier, sur deux lignes au besoin. Les cinq cartes du tableau de bord se rangent selon la largeur et gardent leur chiffre à l'intérieur. Chaque bouton-icône dit ce qu'il fait (Fermer, Supprimer, Monter, Descendre) au survol et au lecteur d'écran. Nouvel audit à 1280 px : 0 texte sous 10 px, 0 texte pâle sous 3:1 sur fond clair, 0 libellé coupé, 0 débordement.",
            "LES FENÊTRES PARTOUT — « Changelog » n'ouvrait rien en mode Réalisé, et l'avertissement d'import n'y apparaissait pas : les deux fenêtres étaient rangées dans la barre du Prévisionnel. Elles sont remontées au niveau de l'application.",
            "COHÉRENCE — Trésorerie disait « pour modifier les soldes, utilisez Budget Structurel » et Budget Structurel « éditable dans Trésorerie » : la Trésorerie dit maintenant « saisissez ici le solde réel », et Budget Structurel y renvoie d'un clic. Le fonds de sécurité visait N mois de SURPLUS (une cible négative quand le budget est en déficit) : il vise N mois de DÉPENSES (fixes + variables), et l'écran dit le calcul et la couverture actuelle. Patrimoine : plus de pastille de quote-part vide, « 35 » s'affiche « 35 % ».",
            "SYNTHÈSE RÉELLE — la page « En construction — Phase 5 » est remplacée : les douze mois de l'année, prévu, réalisé, écart et taux, avec les MÊMES chiffres que le Contrôle Budget vs Réel (le même calcul, mois par mois). Les cumuls ne comptent que les mois écoulés et le mois en cours ; les mois à venir sont marqués « à venir », sans écart inventé. Un clic sur un mois ouvre son détail par catégorie.",
            "CHROME « HAMEÇONNAGE DÉTECTÉ » SUR n8n.beau.ink — Google signale l'hôte, l'application hérite de l'avertissement. Nouveau : « sudo bash install.sh securite », un contrôle en lecture seule qui liste chaque workflow n8n actif exposant un webhook, un formulaire ou une page HTML ; les deux webhooks de l'application sont reconnus, tout le reste est « À VÉRIFIER ». La page se déclare non indexable (robots noindex) et l'onglet ne porte plus « v32.60 Auto-Categorisation ». SAFE_BROWSING.md : vérifier, demander le réexamen à Google, éviter la récidive.",
            "PREUVE — deux nouvelles suites : « Interface de bureau » (32 contrôles dans un vrai navigateur, 13 écrans à deux tailles ; la feuille de lisibilité recolore 339 textes, aucun sur fond sombre, aucun contraste en baisse) et « Contrôle anti-hameçonnage » (16 contrôles avec un faux docker : un n8n sain, un n8n détourné ; rien d'autre que lire). Rejouées sur la v37.43 : 19 échecs sur 21 puis arrêt (pas de Synthèse), et 12 échecs sur 16. __MUTANTS__",
        ] },
        { version: "37.43 Creances-Encaissees", date: "2026-10-10", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.44 Interface-Desktop');
