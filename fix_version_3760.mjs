/* v37.60 Apprentissage — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.59 Rangees";`, `const CURRENT_VERSION = "37.60 Apprentissage";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.59 Rangees", date: "2026-10-18", changes: [`,
`                    const CHANGELOG = [
        { version: "37.60 Apprentissage", date: "2026-10-19", changes: [
            "🧠 UNE CORRECTION SUFFIT — la catégorie que VOUS choisissez pour un libellé l'emporte sur toutes celles que l'appli avait devinées pour lui (avant : noyée par la majorité des anciennes, ou contredite par une de vos lignes au même nom). Juste après : « 🧠 Retenu » et « Aussi les N autres « … » (de X à Y DH) » — un clic les range comme vous.",
            "⚖️ LE MONTANT DÉPARTAGE — un même libellé rangé par vous à deux endroits (« marjane » 45 DH → Sorties, 400 DH → Marjane) : la catégorie dont vos montants sont les plus proches.",
            "🏷️ LES NOMS — une opération de banque renommée (« MCDO ARR » → « McDonald's ») : le nom revient à chaque import, autres lectures comprises (« MCDO AR »), et la catégorie suit le nom. 🏦 LES CHOIX D'IMPORT — « Ajouter », « Ignorer », « Pointer » changé à la main pour un commerçant : proposé d'office la fois suivante (« 🧠 votre choix »).",
            "👁️ VISIBLE ET RÉVERSIBLE — Saisie › « 🧠 Ce que l'appli a appris de vous » : l'interrupteur « Apprendre de mes corrections », chaque règle apprise (catégories, noms, choix d'import), 🗑 pour l'oublier. Dans le document unique (parametres.apprentissage) ; rien dans n8n.",
            "🎯 LE POINTAGE D'UN ACHAT, ENFIN SENSÉ — « GOOGLE PAYMENTS » proposé sur « Vidange Skoda » (0 / 6 000), « Google MBC » sur « Divers Achats maison » déjà réglé : une catégorie seulement DEVINÉE (une piste, une catégorie « sœur ») suffisait. Désormais : une catégorie SÛRE, et la ligne est la sienne (plusieurs lignes de cette catégorie — elect, eau, tel — : un mot commun ou le montant juste) ; jamais une ligne réglée ; une dépense exceptionnelle au montant juste seulement.",
            "🧾 L'IMPORT DU 19/10 — les 0,00 DH (vérifications de carte) ignorés, affichés « 0 DH » ; « Remonter » posé sur une date n'invente plus de libellé (« TREN;LRR » collé à « MEGARA ») et la date cachée est celle de la ligne voisine (« 18/10? ») ; deux captures qui se chevauchent : la même opération lue autrement (« Google MBC Shahid » / « Google MBC &@ ») comptée une fois ; « Compte chèque » reconnu Attijari par ses « PAIEMENT CB 18 10 26 » (plus de « sans compte, répondez à la question »).",
            "PREUVE — nouvelle suite « Apprentissage » : 29 contrôles (corrections dans le journal, imports avec deux captures, textes OCR à la structure de vos captures du 19/10, contenu fictif). Rejouée sur la v37.59 : 17 contrôles en échec (et plusieurs sections n'y tournent pas). Vingt et un défauts réintroduits exprès : tous attrapés. Vos deux captures du 19/10, lues en local : chaque montant à sa ligne, les 0 DH ignorés, rien de pointé au hasard.",
        ] },
        { version: "37.59 Rangees", date: "2026-10-18", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.60 Apprentissage');
