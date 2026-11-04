/* v37.100 Frise → Journal — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.99 Mes applis";`, `const CURRENT_VERSION = "37.100 Frise → Journal";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.99 Mes applis", date: "2026-11-04", changes: [`,
`                    const CHANGELOG = [
        { version: "37.100 Frise → Journal", date: "2026-11-04", changes: [
            "🔎 LA FRISE S'OUVRE SUR LE JOURNAL — touchez une case (un poste, un morceau de semaine) : la liste des opérations saisies derrière ce chiffre s'affiche, la plus récente en premier, avec leur date, leur compte et le total. Touchez une barre « / 15 j » ou « / cycle » : les opérations du poste sur tout le cycle.",
            "✏️ MODIFIER OU SUPPRIMER SUR PLACE — une opération touchée s'ouvre : libellé, montant, date, catégorie, compte, puis « ✓ Enregistrer » ; « 🗑️ Supprimer » demande une confirmation. La case, le total et la frise se mettent à jour aussitôt.",
            "📝 CE QUI N'EST PAS UNE OPÉRATION est dit aussi : un montant saisi pour la semaine sans date (il se corrige dans la Météo), ou un morceau compté au prévu parce que rien n'a été tapé.",
            "📋 « Voir dans le Journal » ouvre la Saisie, journal filtré sur ce poste et ce cycle.",
        ] },
        { version: "37.99 Mes applis", date: "2026-11-04", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.100');
