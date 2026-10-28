/* v37.70 Un compte — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.69 Coquille";`, `const CURRENT_VERSION = "37.70 Un compte";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.69 Coquille", date: "2026-10-28", changes: [`,
`                    const CHANGELOG = [
        { version: "37.70 Un compte", date: "2026-10-28", changes: [
            "🔗 UNE ÉPARGNE VA TOUJOURS SUR UN VRAI COMPTE — « Pourquoi cette duplication de comptes ? Toujours cette confusion entre objectif et compte : je veux une résolution une fois pour toutes. » Les virements d'épargne avaient été recréés pour partir du compte du salaire, mais SANS compte de destination. Une épargne sans destination devenait une « poche » virtuelle : l'argent quittait la source sans arriver sur aucun compte, le patrimoine projeté affichait une poche « Urgence » à côté du vrai « Compte urgence », et l'Épargne Long Terme passait sous zéro (elle paie le syndic sans plus rien recevoir). À chaque chargement, une épargne sans compte est désormais rattachée quand il n'y a aucun doute : la même épargne reliée dans une autre année, sinon l'unique compte dont le nom figure dans le sien (« Epargne urgence » → « Compte urgence »), jamais son propre compte source.",
            "PLUS DE PIÈGE DANS L'ÉCRAN — le sélecteur « Vers : » ne propose plus « 🎯 Enveloppe virtuelle » comme un choix normal : une épargne sans compte s'affiche « ⚠️ Aucun compte — à choisir », en rouge ; une poche restée sans compte se nomme « 🎯 … (sans compte) » partout, pour ne jamais passer pour un compte bancaire.",
            "LE CFO NE PEUT PLUS EN CRÉER — son moteur demande le compte qui reçoit (destination_account) ; sans lui, il le reprend de la même épargne ou le déduit du nom, et à défaut il refuse et doit vous demander. Pour faire partir une épargne d'un autre compte, il la modifie sur place (update_recurring_savings : même ligne, mêmes exceptions) au lieu de la supprimer et la recréer ; ses consignes le lui disent.",
            "↩️ ANNULER DIT SA PILE — « toujours que 4 disponibles : il oublie ? » Le bouton indique « n disponibles sur 50 » et depuis quand : pile retrouvée après rechargement, depuis l'ouverture de l'appli, ou repartie de zéro parce que les données ont été modifiées ailleurs (autre appareil, CFO, correction automatique) — elle n'écrase jamais ce que vous n'avez pas vu.",
            "PREUVE — deux nouvelles suites : « Une épargne va toujours sur un vrai compte » côté appli (12 contrôles, décor fictif) et côté moteur du CFO (9 contrôles). Rejouées sur la v37.69 : 9 et 9 en échec. Huit défauts réintroduits exprès (rattachement absent, source acceptée comme destination, premier compte pris au hasard, poche non signalée, ajout sans destination accepté, source changée ignorée, nom du compte non utilisé, contrôle fait après l'écriture) : tous attrapés. Vérifié sur vos données : les 5 épargnes rattachées (Urgence → Compte urgence, Long Terme → Épargne Long Terme, dépenses annuelles → depenses annuels), plus aucune poche, Épargne Long Terme redevenue positive fin 2027, total inchangé.",
        ] },
        { version: "37.69 Coquille", date: "2026-10-28", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.70 Un compte');
