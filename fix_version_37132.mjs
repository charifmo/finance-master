/* v37.132 Rangé à un seul endroit — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.131 Le cycle en deux parts";`, `const CURRENT_VERSION = "37.132 Rangé à un seul endroit";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.131 Le cycle en deux parts", date: "2026-11-11", changes: [`,
`                    const CHANGELOG = [
        { version: "37.132 Rangé à un seul endroit", date: "2026-11-12", changes: [
            "🐞 « TOUT EST RÉPERTORIÉ ET NON RÉPERTORIÉ À LA FOIS ! » (frise, bloc Factures) — l'aperçu de « Autres factures (sans ligne) » listait TOUTES les opérations des factures (Claude, Gemini, internet, netflix… 11 opérations, 1 644 DH) alors que la ligne n'en compte que 152 : il prenait la catégorie mère Factures avec toutes ses sous-catégories. Il ne montre plus que les opérations restées dans « Factures » sans sous-catégorie ; Claude reste sous IA, internet sous internet — à un seul endroit.",
            "✅ Une facture (ou dépense exceptionnelle) comptée sans aucune opération (« eau : 70 / 100 », « aucune opération dans le journal ») dit maintenant d'où vient le chiffre : « 70 DH réglés dans le Réalisé (case cochée ou + ajouter), sans opération dans le journal ».",
            "PREUVE — test_voyage_saisie P : « facture inwi » (restée dans Factures) + « Claude » (rangée dans IA) → l'aperçu « Autres factures » ne montre que « facture inwi », celui d'IA que « Claude » ; « eau » cochée dans le Réalisé → la note.",
        ] },
        { version: "37.131 Le cycle en deux parts", date: "2026-11-11", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.132');
