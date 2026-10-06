/* v37.23 Reste-a-Depenser — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.22 Liste-de-Courses";`, `const CURRENT_VERSION = "37.23 Reste-a-Depenser";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.22 Liste-de-Courses", date: "2026-10-05", changes: [`,
`                    const CHANGELOG = [
        { version: "37.23 Reste-a-Depenser", date: "2026-10-06", changes: [
            "FINI LA DICTATURE DE LA DATE — la carte de droite ne raisonne plus à la semaine (qui exigeait de dater chaque ticket) mais au CYCLE de paie : « 💸 Reste à dépenser · d'ici la paie du 27 oct. ». Vous déclarez vos dépenses comme vous voulez : un total en vrac par catégorie (« Courses : 2 300 »), des tickets datés, ou les deux.",
            "LA RÈGLE, SANS DOUBLE COMPTAGE — pour chaque catégorie, l'engagé est le plus grand du compteur en vrac et de la somme des tickets datés du cycle, jamais leur somme. Les tickets comptent d'eux-mêmes (plus besoin de « ⚡ Depuis le réel »). Une catégorie que vous n'avez pas encore déclarée reste ESTIMÉE à son rythme attendu : déclarer « Courses » ne fait plus croire que « Sorties » n'a rien coûté. Rien de déclaré du tout : le reste est estimé au prorata du temps, et la carte l'écrit.",
            "LE RYTHME SANS MICRO-COMPTABILITÉ — sous le chiffre : ≈ par semaine, par jour, et jours avant la paie, déduits du temps qui reste. La jauge compare l'engagé du cycle au rythme attendu (repère blanc) : en avance, tenu ou dépassé, sans dater un seul ticket.",
            "SAISIR EN UN GESTE — survolez (ou touchez) une catégorie : le panneau Rayons X montre la liste de courses prévue, puis « 📝 Déjà dépensé ce cycle », un champ où taper le total ; vider le champ rend la catégorie à l'estimation. C'est le même compteur que le bloc « Réalisé à T0 », qui montre désormais votre saisie et, à côté, le total des tickets.",
            "UN SEUL ENDROIT POUR L'ARGENT À VIVRE — à gauche, l'état : le ciel, sa raison, l'action qui s'impose, les virements, l'atterrissage, le Sanctuaire. Le conseil ne chiffre plus « X par semaine » : il renvoie au Reste à dépenser. La ligne « filet du cycle » disparaît, son contenu EST la carte de droite. Plus deux chiffres concurrents.",
            "UNE SEULE VÉRITÉ — la carte lit le moteur du Réalisé (reste = enveloppe conso restante plafonnée par le cash) : le reste à vivre, l'atterrissage et le Relevé voient les mêmes dépenses. Au passage, le budget conso du cycle applique enfin l'exception du mois d'une charge variable, comme le Prévisionnel le faisait déjà.",
            "PREUVE — nouvelle suite « Reste à dépenser » (36 contrôles) qui remplace celle du Pulse ; Météo et Rayons X suivent la nouvelle logique ; parité JS/PHP intacte. Rejouée sur la v37.22 : échec ; quatre défauts réintroduits exprès (compteur et tickets additionnés, non déclaré compté à 0, tickets ignorés, conseil de gauche chiffré) sont tous attrapés.",
        ] },
        { version: "37.22 Liste-de-Courses", date: "2026-10-05", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.23 Reste-a-Depenser');
