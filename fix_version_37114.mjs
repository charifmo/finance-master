/* v37.114 Le ruban du voyage — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.113 Le voyage d'abord";`, `const CURRENT_VERSION = "37.114 Le ruban du voyage";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.113 Le voyage d'abord", date: "2026-11-08", changes: [`,
`                    const CHANGELOG = [
        { version: "37.114 Le ruban du voyage", date: "2026-11-08", changes: [
            "🎗️ EN VOYAGE, UN RUBAN EN TÊTE DE L'APPLI — « ✈️ En voyage — Marrakech · jour 3/6 · 1 250 / 3 000 DH prévus (42 %) », une barre avec le repère du rythme, le reste (ou « dépassé de … »), et sur ordinateur le rythme (« 1 500 prévus à ce jour ») et la dépense du jour. Bleu dans le rythme, orange au-dessus, rouge au-delà du budget.",
            "🪶 Il ne recouvre rien : une ligne fine dans l'en-tête (Prévisionnel, Réalisé, téléphone), qui pousse le reste. ▴ le réduit en pastille « ✈️ 42 % » (retenu sur cet appareil, pour ce voyage) ; un clic sur « ✈️ En voyage » ouvre le bloc du voyage. Il disparaît après le voyage.",
        ] },
        { version: "37.113 Le voyage d'abord", date: "2026-11-08", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.114');
