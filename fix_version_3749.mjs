/* v37.49 Categorisation — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.48 Semaine-Partielle";`, `const CURRENT_VERSION = "37.49 Categorisation";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.48 Semaine-Partielle", date: "2026-10-11", changes: [`,
`                    const CHANGELOG = [
        { version: "37.49 Categorisation", date: "2026-10-13", changes: [
            "« MCDONALD S » N'ÉTAIT PAS RANGÉ — l'ancien moteur (v32.60) prenait la première couche qui répondait : pas de marques, un petit dictionnaire, « Marjane » envoyé sur Alimentation au lieu de VOTRE ligne Marjane, et une hésitation entre deux lignes tranchée en silence.",
            "DES RÈGLES HORS-LIGNE COMPLÈTES — 60 thèmes, plus de 1 000 mots : français, darija en lettres latines (khodra, l7m, djej, 7out, bid, dwa, tbib, lisans, mazot, ghsil, 7allaq, hdiya…), arabe (خضرة, لحم, حوت, دوا, ليصانص — avec ou sans « ال »), enseignes du Maroc (McDo, KFC, Glovo, Marjane, Carrefour, Afriquia, Lydec, Inwi, Zara…). Le dictionnaire TRADUIT vers vos libellés (fast-food → « cafe Resto Wknd », gasoil → « diesel skoda »), jamais vers un identifiant figé : renommer une catégorie ne crée pas d'erreur. Une expression passe avant ses mots (« eau minérale » ≠ votre facture « eau »).",
            "UNE NOTE PAR PISTE, ET LE DOUTE À VOUS — vos corrections, vos libellés (le mot tapé EST une de vos lignes : samak, sqata, barber…), le dictionnaire et vos saisies passées proposent chacun avec une note. Sûr : rangé (« · règle », « · votre libellé », « · vous »). Doute (afriquia : essence ou diesel ? café : Cafe Charif ou cafe Resto Wknd ?) : rangé dans la catégorie mère, ⚠️ « à vérifier », les pistes en un clic. Une catégorie qui n'est plus portée par aucune ligne (« Marjane Lait »…) n'est jamais proposée, une poche d'épargne seulement à défaut d'une charge.",
            "L'IA QUAND LES RÈGLES NE SAVENT PAS — rien de trouvé : 🤖 l'IA (le webhook du CFO, en lecture seule, session « categorisation ») reçoit le libellé et VOS catégories, répond en JSON ; l'identifiant est vérifié. Confiance haute : rangé « · IA ». Moyenne ou basse : rangé à l'essai et laissé à vérifier. Injoignable ou réponse hors liste : la transaction attend. Une demande à la fois ; la saisie n'attend jamais.",
            "⚠️ À CATÉGORISER — un panneau surligné au-dessus du Journal : chaque transaction en doute ou inconnue, ses pistes, « autre… » (vos catégories vivantes), « 🤖 IA », « ✓ Appliquer les suggestions sûres » (votre « mcdonald s » du 13 oct. → cafe Resto Wknd). Dans le Journal, ces lignes sont surlignées, et un clic sur n'importe quelle catégorie la change. CHAQUE CHOIX À LA MAIN DEVIENT UNE RÈGLE : la fois suivante, le même libellé est rangé tout seul.",
            "📚 LES RÈGLES SONT VISIBLES — en bas de la Saisie : chaque thème, ses mots, et la catégorie où il arrive chez vous ; puis « Vos règles », apprises de vos choix.",
            "PREUVE — nouvelle suite « Catégorisation » : 34 contrôles sur un décor calqué sur vos catégories (mcdonald s, Marjane, khodra / خضرة / الخضرة, afriquia, café, zara, IA simulée : haute, moyenne, identifiant inventé, panne, une à la fois ; À catégoriser, Journal, règles, mobile). Rejouée sur la v37.48 : 16 contrôles en échec. Seize défauts réintroduits exprès : tous attrapés.",
        ] },
        { version: "37.48 Semaine-Partielle", date: "2026-10-11", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.49 Categorisation');
