/* v37.67 CFO lucide — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.66 Frise";`, `const CURRENT_VERSION = "37.67 CFO lucide";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.66 Frise", date: "2026-10-27", changes: [`,
`                    const CHANGELOG = [
        { version: "37.67 CFO lucide", date: "2026-10-27", changes: [
            "🧭 LE CFO LIT, IL NE CALCULE PLUS — « Pourquoi le CFO se trompe ? D'où il prend ces infos ? Pourquoi il dit que toutes ces charges sont prises du compte courant alors que non ? » Le résumé envoyé au CFO lisait sourceCompte, un champ abandonné depuis la v20 (les charges suivent le compte par défaut de leur nature, ou leur propre compte) : il valait « courant » sur chaque ligne. Il donnait aussi le montant de base sans les exceptions (un crédit suspendu toute l’année comptait encore) et le montant « / semaine » brut, que le modèle multipliait par 4,33. Désormais chaque ligne porte le compte du moteur (payée depuis / arrive sur), le montant de CE cycle (exceptions comprises) et, pour les charges variables, le budget du cycle (jours ÷ 7, rythmes des postes compris), avec une règle de lecture qui interdit de recalculer.",
            "💸 COMBIEN VIRER SUR LE COURANT — nouveau bloc « alimentation du Courant », lu dans le journal du Relevé : pour le cycle en cours et les 3 suivants, ce que le Courant encaisse lui-même (loyers, CNSS), ce qui en sort (charges variables, épargnes, dépenses ponctuelles), ce qu'il reçoit déjà par virement, et le virement à faire depuis le compte du salaire ; le virement permanent conseillé est le plus gros des 3 prochains cycles, arrondi à la centaine. Si le salaire n'arrive pas sur le même compte selon les années, l'appli le signale.",
            "TELEGRAM AUSSI — le CFO sur Telegram lit le fichier brut du serveur : la même lecture y est enregistrée à chaque sauvegarde, et le champ abandonné sourceCompte est retiré des charges fixes et variables (schéma 22 ; celui des épargnes et des dépenses, qui sert, est gardé).",
            "↩️ ANNULER : 50 RETOURS, QUI SURVIVENT AU RECHARGEMENT — « Pourquoi il n'y a que 3 Undo ? » La pile (30 pas) vivait dans la mémoire de l'onglet : recharger la page, rouvrir l'appli ou laisser le téléphone fermer l'onglet la vidait. Elle passe à 50 retours et est recopiée dans le navigateur ; au chargement elle revient si les données chargées sont exactement celles de son dernier pas — sinon (modifiées sur un autre appareil ou par le CFO) elle est jetée, pour ne jamais revenir par-dessus des données qu'on n'a pas vues.",
            "PREUVE — nouvelle suite « Le CFO lit le moteur » : 22 contrôles (décor fictif : salaire sur un compte à part, charges fixes par défaut sur ce compte, une exception à 0, Courses 700 / sem → 3 100 sur 31 jours, 2 000 à virer en décembre, 2 100 ensuite). Rejouée sur la v37.66 : 12 en échec. Onze défauts réintroduits exprès (horodatage dans la lecture — chaque ré-enregistrement créait un faux conflit entre deux PC —, compte supposé courant, exceptions ignorées, × 4,33, virements reçus ignorés, champ mort gardé, 30 pas, pile non restaurée, pile restaurée sans contrôle, lecture absente du fichier, salaire baladeur non signalé) : tous attrapés. Vérifié sur les vraies données : charges fixes depuis le compte du salaire, crédit suspendu à 0, enregistrer puis recharger redonne le même état au dirham et la pile revient.",
        ] },
        { version: "37.66 Frise", date: "2026-10-27", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.67 CFO lucide');
