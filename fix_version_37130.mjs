/* v37.130 Les quinzaines dans la frise — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.129 Hors budget, expliqué";`, `const CURRENT_VERSION = "37.130 Les quinzaines dans la frise";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.129 Hors budget, expliqué", date: "2026-11-11", changes: [`,
`                    const CHANGELOG = [
        { version: "37.130 Les quinzaines dans la frise", date: "2026-11-11", changes: [
            "📈 « C'EST RÉSOLU DANS LA MÉTÉO, PAS DANS LA FRISE » — dans la frise du cycle, chaque poste « / 15 j » (et « / cycle ») a maintenant, sous son enveloppe, UNE CASE PAR QUINZAINE, alignée sur les colonnes des semaines (1ʳᵉ quinzaine sous ses semaines, 2ᵉ sous les siennes). Chaque case dit réel / prévu (le réel compte aussi les opérations du journal), verte si payée, rouge si dépassée, bleue en cours. La toucher ouvre la saisie sur place (« +50 » / « -20 » corrigent) ; ✓ = payée au prévu. Même règle que la Météo : les deux écrans montrent et modifient les mêmes chiffres.",
            "Météo : le ✓ n'est plus proposé sur une quinzaine déjà couverte par une opération du journal.",
            "PREUVE — test_frise_cycle : Psy, 2 cases (800 / 400 et – / 400), largeurs 20 et 11 jours sur 31 ; ✓ sur la 2ᵉ → 400 le 16 nov. ; la 1ʳᵉ retapée 450 → 450 dans une seule semaine. test_frise_apercu : l'opération « Dr Psy » remplit la 1ʳᵉ quinzaine (400 / 400, pas de ✓).",
        ] },
        { version: "37.129 Hors budget, expliqué", date: "2026-11-11", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.130');
