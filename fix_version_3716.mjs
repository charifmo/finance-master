/* v37.16 Cockpit-Pilotage — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};

sub('CURRENT_VERSION',
    `const CURRENT_VERSION = "37.15 Releve-Cycle";`,
    `const CURRENT_VERSION = "37.16 Cockpit-Pilotage";`);

sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.15 Releve-Cycle", date: "2026-09-28", changes: [`,
`                    const CHANGELOG = [
        { version: "37.16 Cockpit-Pilotage", date: "2026-10-04", changes: [
            "POURQUOI LES BULLES SE CHEVAUCHAIENT — mesuré image par image sur votre vidéo, puis reproduit sur le code d'avant. La bulle de « Budget conso restant » laissait passer la souris (pointer-events-none) jusqu'à la carte du dessous, qui ouvrait la sienne ; pendant le fondu de 150 ms, DEUX bulles étaient visibles l'une sur l'autre, et une fois le fondu fini, celle qui restait n'était plus celle qu'on lisait. Un z-index plus haut n'y aurait rien changé : les deux bulles l'auraient eu. La règle est désormais : une seule bulle ouverte à la fois, opaque, en absolute z-[200] shadow-2xl sur un parent relative, et qui capte la souris — on peut descendre dedans pour la lire sans réveiller la carte du dessous. Au survol sur ordinateur, au tap sur téléphone ; un clic l'épingle, Échap ou un clic ailleurs la ferme.",
            "TROIS CHIFFRES EN TÊTE, AUCUN AVEC SA PROPRE FORMULE — 🔥 Urgence = ce qu'il reste à décaisser d'ici 7 jours, retard compris et chiffré à part : c'est exactement la somme des paquets « En retard » et « Cette semaine » de la liste, qu'on peut donc vérifier à l'œil. 📈 Progression = réglé / total du cycle (payé + avances versées), barre épaisse avec un repère « aujourd'hui » pour comparer l'argent au temps, et le détail par nature (Fixe, Variable, Épargne, Exceptionnel) pour qu'un gros flux exceptionnel n'écrase pas la lecture des charges courantes. 🚨 Atterrissage = le solde de fin de cycle, lu dans le moteur du Relevé compte par compte ; en cas de découvert, la carte passe au rouge vif et dit « Découvert projeté le 26 octobre : − X DH », y compris quand c'est un AUTRE compte que le courant qui plonge.",
            "UN SEUL ATTERRISSAGE À L'ÉCRAN — l'ancien onglet en affichait trois : la couverture de la bulle « Reste à payer », le Relevé, et un « 🏁 Atterrissage » en bas de page tiré d'un vieux calcul qui mélangeait tous les comptes (−20 929 DH contre −6 098 DH sur le même jeu de données). Ce dernier disparaît ; la carte est contrôlée égale au Relevé, au dirham.",
            "À TRAITER, CATÉGORISÉ — trois paquets « ⚠️ En retard », « ⏳ Cette semaine », « 📅 Reste du mois », chacun avec son nombre de lignes et son montant ; chaque ligne porte avant son nom un badge [🏢 Fixe] [🛒 Variable] [💎 Épargne] [⚠️ Exceptionnel]. Sur téléphone, le nom passe sur deux lignes au lieu d'être tronqué.",
            "VALIDATION EN UN CLIC, ET POURQUOI « ÉCHUES » — le bouton coche d'un coup les charges FIXES dont la date est arrivée (retard + aujourd'hui), avance partielle complétée au dû. Il ne coche pas celles de vendredi : marquer payée une charge pas encore prélevée gonflerait l'atterrissage de son montant. D'où son nom, « Valider les charges échues », plutôt que « de la semaine ». Un bandeau confirme et propose ↩ Annuler, qui rend l'état exact d'avant, avance comprise.",
            "TROUVÉ EN CHEMIN, ET CORRIGÉ — en régularisation d'un cycle passé, « Entrées d'argent » et la vue par catégorie cochaient le cycle EN COURS : pointer « Appartement » sur septembre l'enregistrait comme encaissé en octobre. Lecture et écriture se font désormais sur le cycle affiché. Et les montants « / 600 DH » perdent enfin leur « DH » : le code le retirait avec une espace ordinaire alors que le format utilise une espace insécable.",
            "RIEN DE PERDU — le budget conso restant (et sa bulle « Disponible réel ») vit dans le bloc « Réalisé à T0 » ; les comptes du cycle sont dans un repli « 🏦 Comptes du cycle », avec pour chacun le solde d'aujourd'hui, les entrées, les sorties et l'atterrissage, ligne à ligne comme dans le Relevé ; le sélecteur de cycle et « Clôturer » remontent dans l'en-tête. Le bascule « À T0 / Cette sem. / Fin cycle » disparaît : les trois cartes couvrent désormais ces trois horizons à la fois.",
            "PREUVE — nouvelle suite navigateur (55 contrôles), jeu de données bâti autour de la date du jour, montants choisis pour que chaque total se lise à la main : Urgence 3 350 = 1 900 + 1 450, réglé 1 800 / 8 500, courant −450 = Relevé. Elle mesure aussi la bulle réelle (z-index 200, fond opaque, au-dessus de la file), le glissement d'une carte vers celle du dessous (jamais deux bulles), et l'écran d'un S24+ (aucun débordement, tap pour ouvrir et fermer). Rejouée sur le code d'avant : elle échoue.",
        ] },
        { version: "37.15 Releve-Cycle", date: "2026-09-28", changes: [`);

writeFileSync(F, src);
console.log('✔ version 37.16 Cockpit-Pilotage');
