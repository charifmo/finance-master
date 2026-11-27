/* v37.158 Copier une année, en choisissant quoi — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.157 Le Relevé interactif";`, `const CURRENT_VERSION = "37.158 Copier une année, en choisissant quoi";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.157 Le Relevé interactif", date: "2026-11-27", changes: [`,
`                    const CHANGELOG = [
        { version: "37.158 Copier une année, en choisissant quoi", date: "2026-11-27", changes: [
            "📋 « JE VEUX POUVOIR COPIER LES INPUTS DU CALENDRIER PLURIANNUEL ET DU BUDGET STRUCTUREL DE 2026 À 2027 — JE NE VEUX PAS CHANGER CHAMP PAR CHAMP SUR CHAQUE ANNÉE » + « ET JE PEUX CHOISIR CE QUE JE COPIE » — à côté de « + Nouvelle année » : « 📋 Copier vers… ». Vers une ou plusieurs années à venir, ou une année créée pour l'occasion.",
            "CHOISIR — six rubriques à cocher (Revenus, Charges fixes, Charges variables, Épargne · Flux exceptionnels, Virements), et dans chacune, ligne par ligne (« ▸ choisir », tout / rien). Budget : chaque ligne cochée REMPLACE la même ligne de l'année cible (montant, compte, jour, rythme, nom), le pointage repart à zéro, les lignes propres à la cible sont gardées, les lignes vides de remplissage ne sont jamais copiées. Les montants variables selon le mois : seulement si on coche l'option — jamais ceux d'« Adapter au potentiel », propres à l'année source. Calendrier : flux et virements au même mois, AJOUTÉS sans doubler ceux déjà présents (pas les virements posés par l'appli, ni les reports d'un cycle). L'aperçu dit, année par année, ce qui va changer. « ↩ Annuler la copie de 2026 » (à côté de l'année) remet l'année comme avant — ou la retire si elle avait été créée.",
            "PREUVE — test_copie_annee.mjs (vrai navigateur, vrai CSS) : 2026 modifiée → 2027 : aperçu (lignes mises à jour, « École 2027 » gardée, « Paiement Notaire » ajouté, « Assurance kia » pas doublée) ; les comptes de l'aperçu = les lignes proposées ; rubrique Virements et ligne Nounou décochées → ni l'une ni l'autre copiées ; Syndic 1 275 trimestriel, pointage à zéro ; épargne sans l'adaptation de 2026 ; « créer 2028 » avec les montants par mois : juin oui, décembre adapté non ; Annuler : 2028 disparaît, 2027 redevient comme avant.",
        ] },
        { version: "37.157 Le Relevé interactif", date: "2026-11-27", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.158');
