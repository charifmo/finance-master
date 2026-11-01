/* v37.89 Courant au juste besoin — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.88 Compte chèque";`, `const CURRENT_VERSION = "37.89 Courant au juste besoin";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.88 Compte chèque", date: "2026-10-31", changes: [`,
`                    const CHANGELOG = [
        { version: "37.89 Courant au juste besoin", date: "2026-11-01", changes: [
            "🔄 LE COURANT ALIMENTÉ AU JUSTE BESOIN — « Il faut un virement chaque début de cycle, avec la valeur requise. » Le CFO avait posé 9 100 DH le 28 de chaque mois : le 28 janvier appartient au cycle de FÉVRIER (après la paie du 27) — janvier restait à − 7 880, février recevait deux fois ; 9 100 tous les mois même quand le Courant n'en avait plus besoin (52 672 DH dessus en novembre) ; des allers-retours Courant → Assafa le même jour. Nouveau, dans Flux exceptionnels : « 🔄 Calculer et poser les virements » — pour chaque cycle à venir, UN virement du compte du salaire vers le Courant, le jour de paie (le 27 déc. ouvre janvier), du montant qui garde le Courant au-dessus de zéro sur tout le cycle, calculé par le Relevé cycle après cycle (rien quand il n'en faut pas). Il remplace les virements salaire ↔ Courant de ces cycles ; « ↩️ Annuler » remet tout. Il signale le compte du salaire qui passerait sous zéro et les gros virements qui partent du Courant (« Faire partir du compte du salaire » en un clic).",
            "🧮 LE CFO DEMANDE, L'APPLI CALCULE — nouvel outil app_action : le CFO demande « alimenter le Courant » ou « adapter une épargne au potentiel » ; l'appli l'exécute avec SON moteur au rechargement qui suit l'échange et l'écrit dans le fil (« 🧮 Calculé par l'appli, pas par le CFO »). Ses consignes (§0bis) lui interdisent de refaire ces calculs et de promettre un solde que l'appli n'a pas calculé. Sa lecture donne, pour chaque cycle, la date exacte de son virement ; le moteur refuse un virement identique à un virement existant.",
            "📊 SURPLUS DÉTAILLÉ — « Net moyen hors virements du calendrier » : 63 000 DH virés d'un coup en décembre comptaient comme l'épargne de ce mois et rendaient la moyenne négative (− 263) ; hors virements ponctuels : + 4 987.",
            "PREUVE — nouvelle suite « Le Courant alimenté au juste besoin » : plan cycle par cycle (7 000 puis rien), janvier posé le 27 décembre, anciens virements remplacés, Courant jamais sous zéro, Annuler, demande du CFO exécutée au chargement puis consommée, app_action et doublon côté moteur, moyenne hors virements. Rejouée sur la v37.88 : en échec.",
        ] },
        { version: "37.88 Compte chèque", date: "2026-10-31", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.89');
