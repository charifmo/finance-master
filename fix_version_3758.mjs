/* v37.58 Lecons-IA — bump de version + entrée de changelog. */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'index.html';
let src = readFileSync(F, 'utf8');
const sub = (label, anchor, replacement) => {
    const n = src.split(anchor).length - 1;
    if (n !== 1) { console.error(`✖ ${label} : ${n} ancre(s), 1 attendue`); process.exit(1); }
    src = src.replace(anchor, replacement);
};
sub('CURRENT_VERSION', `const CURRENT_VERSION = "37.57 Journal";`, `const CURRENT_VERSION = "37.58 Lecons-IA";`);
sub('CHANGELOG',
`                    const CHANGELOG = [
        { version: "37.57 Journal", date: "2026-10-16", changes: [`,
`                    const CHANGELOG = [
        { version: "37.58 Lecons-IA", date: "2026-10-16", changes: [
            "🧠 LES LEÇONS DU CYCLE, PAR L'IA — Journal › 💡 Leçons › « Analyser avec l'IA ». L'application calcule d'abord LES FAITS (par catégorie : dépensé, budget, cycle précédent, moyenne des 3 cycles d'avant, lignes et libellés ; le week-end ; les petits achats ; vos notes ; vos leçons gardées) ; l'IA n'a que ces chiffres. Elle propose au plus 5 leçons : un constat chiffré, UNE action mesurable, l'enjeu en DH par cycle.",
            "🔍 VÉRIFIÉ AU RETOUR — catégorie inconnue : retirée ; chaque chiffre du constat cherché dans les faits, sinon « ⚠️ chiffre non retrouvé dans vos données ». Rien n'est gardé sans vous : 📌 Garder / ✕ Écarter.",
            "📌 LES LEÇONS GARDÉES SUIVIES — à l'analyse suivante, l'IA dit si chacune a été tenue (👍 / 👎 / ⏳) ; « ✅ Acquise » la range et ne l'envoie plus. « ↻ Mettre à jour » dès que le cycle a bougé depuis l’analyse.",
            "📊 SANS IA AUSSI — les signaux calculés restent affichés : budget dépassé, budget consommé plus vite que le cycle, hausse vs le cycle précédent, petits achats, week-end. IA injoignable : dit clairement, rien de perdu.",
            "✍️ « 🧠 PROPOSER » DANS UNE OPÉRATION — l'IA rédige « ce que je retiens » à partir de l'historique du même libellé et du budget ; « ✓ Utiliser » remplit la note (et coche « leçon » si l'écart le mérite). Votre note n'est jamais écrasée sans clic.",
            "🗄️ STOCKAGE — le document unique : parametres.leconsIA (gardées) et parametres.analyseLecons (la dernière analyse). Le webhook du CFO existant, en lecture seule : rien à changer dans n8n.",
            "📨 TELEGRAM VÉRIFIÉ — le formateur des réponses envoyait « < 500 DH » ou « & » nus en HTML : Telegram REFUSE alors tout le message (400), vous ne receviez rien ; pareil au-delà de 4 096 caractères ou avec une balise non refermée ; les tableaux arrivaient collés (« Marjane331 DH »). Désormais : texte ré-échappé, balises équilibrées, tableaux « Marjane · 331 DH », réponse longue en plusieurs messages « (1/3) », une seule réponse vocale. Liste blanche TELEGRAM_CHAT_IDS (n8n) : sans elle, rien ne change ; avec elle, un inconnu qui trouve le bot est ignoré. Dans super_agent_cfo.json et super_agent_cfo_audio.json : à réimporter dans n8n pour prendre effet.",
            "PREUVE — nouvelle suite « Leçons : l'IA » : 27 contrôles (IA simulée) ; rejouée sur la v37.57 : 9 contrôles en échec (et plusieurs sections n'y tournent pas) ; quinze défauts réintroduits exprès : tous attrapés. Nouvelle suite « Telegram » : 21 contrôles, le code des nœuds exécuté tel quel ; sur les workflows d'avant : 13 en échec ; neuf défauts réintroduits : tous attrapés.",
        ] },
        { version: "37.57 Journal", date: "2026-10-16", changes: [`);
writeFileSync(F, src);
console.log('✔ version 37.58 Lecons-IA');
