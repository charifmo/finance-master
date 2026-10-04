/* v37.17 Meteo-Financiere — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.16 Cockpit-Pilotage";`, `const CURRENT_VERSION = "37.17 Meteo-Financiere";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.16 Cockpit-Pilotage", date: "2026-10-04", changes: [`,
`                    const CHANGELOG = [
        { version: "37.17 Meteo-Financiere", date: "2026-10-04", changes: [
            "LA MÉTÉO FINANCIÈRE, EN TÊTE DES DEUX VUES — le même bandeau chapeaute le Pilotage Réalisé, le Prévisionnel et, sur téléphone, l'accueil du Prévisionnel. ☀️ Grand soleil, ⛅ Ciel voilé ou ⛈️ Orage, et toujours la RAISON écrite en clair, puis un conseil chiffré. Orage = un compte réel finit le cycle à découvert. Nuages = plus rien de dépensable, coussin de fin de cycle sous 5 % des revenus, ou budget prévu en déficit. Soleil = le reste.",
            "LE RESTE À VIVRE, EN GRAND — « combien je peux dépenser aujourd'hui » : le budget conso réellement dépensable (déjà calculé par le Réalisé : le plus petit de l'enveloppe restante et du cash disponible), divisé par les jours jusqu'à la paie. Vérifié : atterrissage + enveloppe conso restante = cash disponible, au dirham. Dépenser ce reste à vivre, et pas un dirham de plus, fait donc atterrir le compte à zéro : c'est ce qui autorise la Météo à écrire « pour rester à flot : pas plus de X DH ».",
            "LE PRÉVISIONNEL RESPIRE — la « respiration budgétaire » : une barre où chaque poste (fixes, factures, conso courante, épargne, exceptionnel) prend sa vraie place face aux revenus, la marge libre en hachures vertes ; en déficit, un repère montre où s'arrêtent les revenus. Puis une carte par poste, chaque ligne avec la barre de son poids. Les conventions sont celles du simulateur (exceptions au mois budgétaire, hebdomadaire × 4,3) : sur douze mois, marge + épargne = surplusBudgetaireAnnuel, au dirham. La conso courante hebdomadaire, absente de l'ancienne vue, y figure enfin — c'est souvent le plus gros poste.",
            "À TRAITER, FINITIONS — cartes à liseré de couleur par nature. Le variable et l'exceptionnel ont un vrai champ « Saisir … DH » (leur montant réel varie) ; le fixe garde un champ discret pour une avance, et porte une pastille « ⚡ échue » quand le bouton de validation le prend en charge. Survoler ce bouton allume exactement les lignes qu'il va cocher.",
            "TROUVÉ EN CHEMIN, ET CORRIGÉ — « Mode Réalisé », dans la barre latérale comme sur téléphone, menait à Saisie au lieu du Pilotage : le garde-fou qui change d'onglet en changeant de mode ne connaissait pas « pilotage » côté Réalisé (ni « pilotageTheo » côté Prévisionnel), et remplaçait le choix aussitôt fait.",
            "SOBRIÉTÉ — l'icône météo flotte doucement, sauf si le système demande moins d'animations ; même chose pour les transitions de la liste.",
        ] },
        { version: "37.16 Cockpit-Pilotage", date: "2026-10-04", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.17 Meteo-Financiere');
