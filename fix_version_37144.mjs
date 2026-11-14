/* v37.144 La frise verrouille, compte juste et se règle sur place — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.143 Les publications, pas les pages";`, `const CURRENT_VERSION = "37.144 La frise verrouille, compte juste et se règle sur place";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.143 Les publications, pas les pages", date: "2026-11-13", changes: [`,
`                    const CHANGELOG = [
        { version: "37.144 La frise verrouille, compte juste et se règle sur place", date: "2026-11-14", changes: [
            "🔒 « LHRRI EST VERROUILLÉ POUR CE CYCLE MAIS PAS DANS LA FRISE » — la frise lit le même verrou que la Météo et le Réalisé : une enveloppe / 15 j ou / cycle close est grisée et dit « 🔒 Clôturé · 50 / 1 355 DH · 1 305 libérés » ; son bouton 🔓 / 🔒 la clôt ou la rouvre depuis la frise. Une case / sem close pour sa semaine porte « 🔒 » ; l'aperçu d'une case la clôt ou la rouvre pour cette semaine.",
            "🐟 « SAMAK : LES CASES DISENT 250 + 230, L'ENVELOPPE 250 / 500 » — le plus grand du tapé et du journal se prenait sur TOUT le cycle (250 tapés la 1ʳᵉ quinzaine contre 230 au journal la 2ᵉ → 250). Une ligne / 15 j ou / cycle se compte maintenant quinzaine par quinzaine — dans chacune le plus grand des deux, la règle des semaines — puis on additionne : 480 / 500, dans la Météo comme dans la frise.",
            "✏️ « CHANGER LE PRÉVU N'AFFICHE RIEN » — une petite fenêtre s'ouvre sur place : nom, montant, rythme (/ sem, / 15 j, / cycle), ce que ça fait sur le cycle, « aussi pour les années suivantes » ; « Tout le budget › » garde l'ancien chemin.",
            "✓ « C'EST QUOI CE ✓ ? PARFOIS IL DISPARAÎT » — il s'appelle maintenant « ✓ payé » : il inscrit le prévu de la quinzaine comme réglé, seulement pour une quinzaine commencée ; une fois inscrit, « ✕ » l'annule (le bouton ne s'évanouit plus sans trace). Expliqué dans la légende.",
            "💳 « CHAQUE LIGNE DE LA FRISE DOIT MENTIONNER SON COMPTE » — à côté du nom : « 💳 Assafa principal », « 💳 Compte Courant »… La règle du Relevé, mot pour mot : le compte choisi sur la charge, sinon celui des charges variables ; une dépense exceptionnelle, son compte source (la règle s'affiche au survol).",
            "PREUVE — test_frise_cycle.mjs : section F (verrou depuis la frise et depuis la Météo, case / sem close, aperçu, 400 + 300 = 700, ✓ payé ↔ ✕, le compte de chaque ligne) ; test_voyage_saisie.mjs (40) : la petite fenêtre du prévu, montant invalide refusé, 275 / 15 j enregistré.",
        ] },
        { version: "37.143 Les publications, pas les pages", date: "2026-11-13", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.144');
