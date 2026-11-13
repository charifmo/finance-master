/* v37.141 Des prix de terrains, rien d'autre — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.140 La calibration foncière";`, `const CURRENT_VERSION = "37.141 Des prix de terrains, rien d'autre";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.140 La calibration foncière", date: "2026-11-13", changes: [`,
`                    const CHANGELOG = [
        { version: "37.141 Des prix de terrains, rien d'autre", date: "2026-11-13", changes: [
            "🏷️ « CES RÉSULTATS SONT NULS : DES MAISONS, DES APPARTEMENTS… » — les prix observés ne gardent plus que des TERRAINS : (1) une page de LISTE d'un portail (« Découvrez 17 annonces pour Ventes Immobilières à Chaibate », « Ventes Immobilières à Bin El Ouidane », « اكتشف 12 إعلان », une rubrique Avito ou Mubawab) n'est plus prise pour une annonce — son « prix » était celui d'une annonce quelconque, d'où un « comparable » à 7 DH/m² ; (2) un bien bâti (appartement, maison, villa, local) ou une annonce sans type reconnu est écarté ; (3) un prix au m² invraisemblable pour un terrain (moins de 20 ou plus de 30 000 DH/m²) n'est pas gardé (« prix incohérent »).",
            "📐 La calibration vient maintenant APRÈS l'analyse de l'Intelligence Marché (et avant la liste des articles), comme demandé.",
            "📱 La page Facebook officielle de la commune (facebook.com/communeouahatsidibrahim) est ciblée par défaut (signal public indexé par les moteurs, non vérifié).",
            "PREUVE — test_veille_presse.php (126) : pages de liste (FR, AR, rubriques Avito / Mubawab) écartées, appartement et maison écartés, 7 DH/m² marqué incohérent, 1 ha à 1,8 MDH → 180 DH/m² ; test_veille_presse.mjs (110) : la calibration après l'analyse et avant les articles.",
        ] },
        { version: "37.140 La calibration foncière", date: "2026-11-13", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.141');
