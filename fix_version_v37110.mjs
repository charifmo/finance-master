import fs from 'node:fs';
const FILE = new URL('./index.html', import.meta.url);
let s = fs.readFileSync(FILE, 'utf8');
const CRLF = s.includes('\r\n'); if (CRLF) s = s.split('\r\n').join('\n');
const sub = (from, to, n = 1) => { const c = s.split(from).length - 1;
    if (c !== n) throw new Error(`Ancre (${c}/${n}) : ${from.slice(0,110)}`); s = s.split(from).join(to); };

sub(`                    const CURRENT_VERSION = "37.10 Oubli-Effectif";`,
    `                    const CURRENT_VERSION = "37.11 Chat-Lisible";`);

const E = [
`        { version: "37.11 Chat-Lisible", date: "2026-09-28", changes: [`,
`            "TROUVÉ EN CHEMIN, ET C'EST LE PLUS GRAVE — sur téléphone, la modale du CFO n'existait pas. Elle était imbriquée dans le conteneur « v-if=\\"!isMobile\\" » : l'arbre entier était absent, donc le bouton 🧠 flottant ouvrait le vide. Mesuré : showCfoModal passait bien à true, et #cfo-widget-modal restait introuvable dans le DOM. Le Teleport n'y changeait rien — il déplace un élément rendu, il ne le rend pas à la place d'un v-if faux. La modale vit désormais au premier niveau et s'ouvre sur les deux formats.",`,
`            "TYPOGRAPHIE — corps à 16 px sur téléphone et 17 px sur desktop (contre 14 px partout), interligne à 1,8, paragraphes espacés d'une ligne pleine, listes indentées avec des puces colorées, titres hiérarchisés, tableaux qui défilent seuls au lieu d'élargir la colonne. Tout cela dans une classe DISTINCTE (.cfo-msg) : la classe historique .cfo-html sert aussi à la bulle Merlin (texte clair sur fond sombre) et à l'intelligence marché, et y toucher aurait dégradé ces deux-là pour améliorer le chat.",`,
`            "STRUCTURE — fini le texte collé aux bords. Colonne de lecture centrée et bornée (max-w-3xl, mesurée à 768 px sur un écran de 1400). Vos messages : bulle compacte à droite, violet très pâle, coins arrondis. Les réponses du CFO : pleine largeur de la colonne, sans bulle, avec un avatar 🧠 à gauche — la distinction se fait par la forme, pas par une couleur de fond qui fatigue sur un texte long.",`,
`            "BARRE DE PROMPT — le champ devient un textarea qui grandit avec le texte puis plafonne à huit lignes et défile, au lieu d'une ligne unique où une question de trois lignes devenait illisible pendant la frappe. Le bouton « ENVOYER » quitte l'extérieur pour entrer DANS la barre, en icône. À gauche, les emplacements trombone et micro sont posés — en SVG et non en emoji, parce qu'un emoji ignore la couleur et reste vif même désactivé : ils avaient l'air actifs alors qu'ils ne font encore rien.",`,
`            "AU POUCE — sur téléphone la modale occupe l'écran entier (100dvh, pour que le clavier ne recouvre pas la barre), la barre passe sur deux rangs (le texte prend toute la largeur, les actions se rangent dessous) et le bouton d'envoi fait 44 px, le minimum confortable. À 412 px, trois éléments sur une même ligne laissaient au champ une colonne de six mots. La barre de titre a été compactée : l'identifiant de session et les libellés la faisaient passer sur deux lignes.",`,
`            "CLAVIER — Entrée envoie, Maj+Entrée passe à la ligne. Sur téléphone c'est l'inverse : Entrée passe à la ligne et l'envoi se fait au bouton, parce qu'au pouce Maj+Entrée n'existe pas.",`,
`            "DÉFILEMENT — le fil défile seul, la barre de saisie reste collée en bas quelle que soit la longueur de la conversation. Vérifié en injectant 40 messages : le fil déborde, la barre reste dans le cadre.",`,
`            "VÉRIFIÉ SUR UN RENDU RÉEL — le CDN Tailwind étant injoignable depuis mon environnement, la feuille du projet est désormais RECONSTRUITE localement pour les tests (tailwindcss v3, même source). Les largeurs, les débordements et les tailles de cible tactile sont donc mesurés, plus supposés. Nouvelle suite test_chat_ui.mjs, 30 contrôles sur les deux formats, 15 suites au total.",`,
`            "TROIS FOIS, MES PROPRES TESTS ONT MENTI — un sélecteur positionnel qui mesurait le bouton « micro » au lieu du bouton d'envoi (et validait donc « envoi désactivé » sur le mauvais élément), et deux assertions qui comptaient TOUS les messages alors que la réponse de l'agent arrive de façon asynchrone : le contrôle « Maj+Entrée n'envoie pas » échouait une fois sur trois. Un repère stable (data-cfo-send) et un comptage limité aux messages de l'utilisateur ont réglé les deux. Cinq exécutions consécutives au vert.",`,
`            "NOTE — le bloc « CFO & Audit » inline de la page mobile est sous un v-if=\\"false\\" depuis plusieurs versions : c'est du code mort, que personne ne rend. Il a été mis au même standard pour rester cohérent s'il était réactivé, et l'annotation le dit sur place. Sur téléphone, le CFO passe par le bouton 🧠 et la modale."`,
`        ] },`].join('\n');

sub(`                    const CHANGELOG = [\n`, `                    const CHANGELOG = [\n${E}\n`);
if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ version 37.11 + changelog');
