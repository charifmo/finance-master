/* v37.152 Les restes du cycle d'avant — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.151 Tests légers, moyens ou complets";`, `const CURRENT_VERSION = "37.152 Les restes du cycle d'avant";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.151 Tests légers, moyens ou complets", date: "2026-11-26", changes: [`,
`                    const CHANGELOG = [
        { version: "37.152 Les restes du cycle d'avant", date: "2026-11-27", changes: [
            "⏮️ « UN MÉCANISME POUR REPORTER OU MARQUER COMME PAYÉ, EN HAUT DU NOUVEAU CYCLE, EN SURLIGNANT LES CHARGES NON RENSEIGNÉES DEPUIS LE CYCLE D'AVANT » — une ligne non réglée d'un cycle clos ne passait pas dans le suivant (chaque cycle n'a que ses propres lignes) : elle sortait des prévisions sans qu'on le voie. Le Pilotage du nouveau cycle s'ouvre maintenant sur « Restés sans suite — cycle de … » : les entrées non pointées d'abord, puis les charges par jour ; « rien saisi » surligné, « 49 saisis sur 99 » pour une ligne entamée ; les totaux à payer et à encaisser.",
            "TROIS GESTES par ligne — ✓ Payé / Reçu : cochée dans SON cycle (comme en Mode Régularisation). ↪ Reporter (vers ce cycle ou l'un des 11 suivants) : le reste devient un flux exceptionnel « ↪ tel (reporté de Novembre 2026) » — une charge, ou une entrée en négatif —, à traiter dans le cycle choisi et compté par le Relevé et la projection ; la ligne d'origine est close et garde où elle est partie (jamais comptée deux fois). ✕ Clore : rien de plus attendu (une enveloppe pas toute dépensée n'est pas une dette). L'épargne et les virements : Fait ou Clore. Les enveloppes de la semaine n'y figurent pas. Pas de bandeau en consultant un cycle passé ; la liste vide, il disparaît.",
            "PREUVE — test_restes_cycle.mjs (vrai navigateur, 13 contrôles, au 28 nov., paie le 27) : SALAIRE, tel (49 / 99), Syndic, Nounou listés, pas « elect » (réglée par le journal) ni les courses ; ✓ Payé sur Syndic → payé en novembre, décembre garde le sien ; ↪ Reporter tel → flux de 50 dû le 28 nov. dans le cycle de décembre, à côté du tel de décembre (99, intact), projection fin 2026 −50 au dirham ; SALAIRE reporté en janvier 2027 → entrée de 20 000 le 27 déc. (cycle de janvier, pas décembre) ; ✕ Clore Nounou → aucun flux ; rétro → pas de bandeau.",
        ] },
        { version: "37.151 Tests légers, moyens ou complets", date: "2026-11-26", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.152');
