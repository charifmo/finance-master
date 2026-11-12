/* v37.133 Le Réalisé écrit dans le journal — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.132 Rangé à un seul endroit";`, `const CURRENT_VERSION = "37.133 Le Réalisé écrit dans le journal";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.132 Rangé à un seul endroit", date: "2026-11-12", changes: [`,
`                    const CHANGELOG = [
        { version: "37.133 Le Réalisé écrit dans le journal", date: "2026-11-12", changes: [
            "📝 « UNE FACTURE QUI FIGURE QUELQUE PART MAIS NON MODIFIABLE : ÇA DOIT ÊTRE DANS LE JOURNAL, ÉDITABLE » — cocher une facture (ligne de « Factures » : eau, tel, internet, IA…) ou une dépense exceptionnelle (Appart Aga, Nejar…) dans le Réalisé crée maintenant une VRAIE opération du journal : son nom, son montant, sa catégorie, son compte, datée dans son cycle. « + ajouter 45 » ajoute une opération de 45. Décocher retire ces opérations. Le Réalisé ne garde plus de montant à part : tout se voit et se corrige dans le Journal (et dans la frise, ✏️).",
            "Les montants DÉJÀ cochés avant cette version (ex. « eau : 70 DH, aucune opération ») : l'aperçu de la frise propose « 📝 En faire une opération du journal (modifiable) » — un geste, et c'est une opération comme les autres.",
            "Les charges fixes, l'épargne et les virements ne changent pas (un relevé bancaire les apporte : pas de doublon).",
            "PREUVE — test_voyage_saisie P : « eau » cochée → l'opération « eau » 300 DH (sa catégorie), décochée → disparue ; un ancien 70 DH coché → le bouton en fait l'opération « eau » 70 DH, toujours 70 comptés. test_depenses_exceptionnelles K2 : « Révision chaudière » cochée → opération 300 DH dans sa catégorie, « + 45 » → une opération de 45, décochée → plus rien.",
        ] },
        { version: "37.132 Rangé à un seul endroit", date: "2026-11-12", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.133');
