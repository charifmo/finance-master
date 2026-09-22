import fs from 'node:fs';
const FILE = new URL('./index.html', import.meta.url);
let s = fs.readFileSync(FILE, 'utf8');
const CRLF = s.includes('\r\n'); if (CRLF) s = s.split('\r\n').join('\n');
const sub = (from, to, n = 1) => { const c = s.split(from).length - 1;
    if (c !== n) throw new Error(`Ancre (${c}/${n}) : ${from.slice(0,110)}`); s = s.split(from).join(to); };

sub(`                    const CURRENT_VERSION = "37.0 Integrite-Supervision";`,
    `                    const CURRENT_VERSION = "37.1 Supervision-Epuree";`);

const E = [
`        { version: "37.1 Supervision-Epuree", date: "2026-09-22", changes: [`,
`            "SUPERVISION IA — MÉTADONNÉES TECHNIQUES ÉCARTÉES. Les chargeurs de documents accrochent à chaque vecteur des clés qui décrivent le FICHIER d'origine et non la règle métier : loc.lines.from/to, blobType, pageNumber, pdf.*. Elles noyaient les seules informations utiles. Le tri se fait côté serveur (get_ai_memory.php) : la charge utile diminue aussi, et la règle vit à un seul endroit. C'est une liste de REFUS et non d'autorisation — une clé métier imprévue reste visible plutôt que de disparaître en silence.",`,
`            "VECTEURS TROP COURTS FILTRÉS — un texte de moins de 30 caractères n'est pas une règle, c'est un résidu d'indexation (une date, un tag isolé « regle » ou « tg_1595… »). Le filtre est appliqué EN SQL (char_length, pas length : un « é » ne doit pas peser double en UTF-8) et AVANT le LIMIT — filtrer après coup aurait rendu le paramètre limit trompeur, en demandant 200 lignes pour n'en afficher que 40.",`,
`            "RIEN N'EST MASQUÉ EN SILENCE — l'onglet affiche combien de vecteurs ont été écartés et sous quel seuil, avec un bouton « Tout afficher » qui recharge sans filtre ni nettoyage (min_len=0&meta=all). Un compteur qui baisse sans explication inquiète plus qu'il ne rassure. Seuil ajustable par ?min_len= pour un usage direct de l'endpoint.",`,
`            "AFFICHAGE PROPRE — des métadonnées entièrement techniques deviennent null plutôt qu'un objet vide : aucun bandeau fantôme ne s'affiche sous une règle."`,
`        ] },`].join('\n');

sub(`                    const CHANGELOG = [\n`, `                    const CHANGELOG = [\n${E}\n`);
if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ version 37.1 + changelog');
