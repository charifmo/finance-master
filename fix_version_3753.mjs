/* v37.53 Banque — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.52 Categorisation-Auto";`, `const CURRENT_VERSION = "37.53 Banque";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.52 Categorisation-Auto", date: "2026-10-14", changes: [`,
`                    const CHANGELOG = [
        { version: "37.53 Banque", date: "2026-10-14", changes: [
            "🏦 IMPORTER DEPUIS LA BANQUE — Saisie et Trésorerie : déposez vos captures (plusieurs à la fois, Ctrl+V, ou depuis les photos du téléphone) ou collez le texte d'Attijarinet. Tout est lu SUR PLACE, sans IA : Attijarinet (dates « 14 / oct », vraie date CB, total des débits vérifié), Attijari Mobile (« Mes comptes » et « Compte chèque »), Bank Assafa (RIB, solde vert), Saham (sans RIB). L'OCR est embarqué (vendor/ocr) : deux lectures par capture, fusionnées.",
            "🎯 CALIBRAGE BANCAIRE & RIB — Trésorerie : la banque de chaque compte, ses RIB / n° de compte, son empreinte (« Saham · compte chèque dirhams » quand l'écran ne montre aucun RIB), le solde suivi chez Attijari, et un bouton « Calibrer avec une capture ». À l'import : RIB connu → le compte ; RIB inconnu → « Nouveau RIB détecté… À quel compte l'associer ? », mémorisé pour toujours ; sans RIB → l'empreinte, sinon la même question (RIB facultatif).",
            "LE SOLDE — proposé pour chaque compte reconnu, arrondi dans l'appli, le montant exact gardé sous le compte (« 🏦 4 213,32 · 14/10 »).",
            "AUCUN DOUBLON — chaque opération traitée laisse son empreinte (compte, date comptable, libellé, montant) : recoller une capture qui chevauche ne refait rien, même si l'OCR a lu une lettre de travers ; la même capture déposée deux fois est vue.",
            "LE TRI — retraits GAB ignorés par défaut ; virements jamais en dépenses (pointés au Pilotage s'ils y sont attendus, sinon ignorés : le solde les reflète) ; frais regroupés en une ligne ; factures et charges pointées au Pilotage (« SRM » → « elect marrakech villa »), jamais ajoutées au journal (elles y seraient comptées deux fois) ; achats CB rapprochés du journal (±4 jours entre date d'achat et date comptable, ±2 DH) — déjà saisis : liés ; oubliés : ajoutés (source BANQUE), rangés si la règle est sûre, sinon EN SUSPENS dans « ⚠️ À vérifier ».",
            "PREUVE — nouvelle suite « Banque » : 46 contrôles, vos 4 cas lus par le VRAI OCR dans le navigateur (questions, propositions ligne à ligne, soldes, journal, Pilotage, frais, registre, recollage le lendemain, Ctrl+V). Rejouée sur la v37.52 : 11 contrôles en échec. Trente-quatre défauts réintroduits exprès : tous attrapés.",
        ] },
        { version: "37.52 Categorisation-Auto", date: "2026-10-14", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.53 Banque');
