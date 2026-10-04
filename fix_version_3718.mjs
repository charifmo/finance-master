/* v37.18 Logistique-Bancaire — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.17 Meteo-Financiere";`, `const CURRENT_VERSION = "37.18 Logistique-Bancaire";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.17 Meteo-Financiere", date: "2026-10-04", changes: [`,
`                    const CHANGELOG = [
        { version: "37.18 Logistique-Bancaire", date: "2026-10-04", changes: [
            "🛡️ SÉCURITÉ DES COMPTES — pour chaque compte bancaire : le solde du jour, sa courbe jusqu'au cycle de décembre, son POINT BAS, sa fin d'année, et le virement à faire. Tout vient du moteur du Relevé, projeté jusqu'en décembre : entrées affectées au compte, prélèvements affectés au compte, compte par compte. Vérifié : la fin d'année de chaque compte est celle du Relevé filtré sur ce compte.",
            "POURQUOI LE POINT BAS, ET PAS SEULEMENT LA FIN D'ANNÉE — un compte qui plonge en octobre et remonte en décembre finit l'année positif… après un découvert. « À virer » est donc ce qui garde le point bas à zéro, avec la date avant laquelle le faire et un compte d'où le faire (celui qui garde le plus de marge au plus bas). Preuve par l'acte dans les tests : on exécute les virements proposés, et plus aucun compte ne passe sous zéro jusqu'en décembre.",
            "OÙ PART L'ARGENT — chaque ligne, dans la file « À traiter », les entrées d'argent et toutes les cartes du Prévisionnel, porte une pastille discrète : un point de couleur et le nom court du compte. Au survol ou au tap : prélevé sur quel compte, selon quelle règle (réglage global des charges fixes ou variables, ou compte choisi sur la ligne), solde du jour, fin de cycle, point bas et virement éventuel. La règle est celle du Relevé, mot pour mot : la pastille nomme toujours le compte que le Relevé débitera.",
            "🎯 FOCUS BANCAIRE — un clic sur un compte, dans le Réalisé comme dans le Prévisionnel : la file, l'Urgence, la Progression, la carte Atterrissage, le bouton ⚡, les entrées d'argent, la jauge de respiration et les cartes ne parlent plus que de ce compte. Un bandeau rappelle le filtre et le retire d'un clic. La Météo, elle, reste globale. Le filtre n'est pas mémorisé : on n'oublie jamais qu'on regarde un seul compte.",
            "LA MÉTÉO GAGNE UNE LIGNE — « 🏦 Virer X DH sur Assafa avant le 10 oct., pour tenir jusqu'au 26 déc. » : le virement le plus pressant, et seulement s'il y en a un.",
        ] },
        { version: "37.17 Meteo-Financiere", date: "2026-10-04", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.18 Logistique-Bancaire');
