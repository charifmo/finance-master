import fs from 'node:fs';
const FILE = new URL('./index.html', import.meta.url);
let s = fs.readFileSync(FILE, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.split('\r\n').join('\n');
const sub = (from, to, n = 1) => {
    const c = s.split(from).length - 1;
    if (c !== n) throw new Error(`Ancre (${c}/${n}) : ${from.slice(0, 120)}`);
    s = s.split(from).join(to);
};

sub(`                    const CURRENT_VERSION = "34.07 Bulle-Exercice";`,
    `                    const CURRENT_VERSION = "34.08 Sidebar-Footer";`);

const ENTREE = [
    `        { version: "34.08 Sidebar-Footer", date: "2026-09-16", changes: [`,
    `            "ERGONOMIE CORRIGÉE — les 3 boutons ronds (🧠 CFO, 📑 Journal, 🪄 Merlin) flottaient en position fixed, ancrés md:left-6 : exactement la largeur de la sidebar. Sur desktop ils recouvraient les derniers liens du menu (Undo/Redo, pied VPS), rendus non cliquables.",`,
    `            "CHOIX — intégration en pied de sidebar plutôt que déplacement en bas à droite. La sidebar avait déjà ce pattern : un footer conditionnel sous flex flex-col justify-between (colonne d'icônes 💾📤📄 repliée, panneau VPS/Drive déplié). Les 3 actions IA rejoignent ce pied dans le même langage visuel — pas un nouveau motif d'interaction (speed dial) à apprendre pour un ERP.",`,
    `            "DESKTOP : les 3 boutons ne sont plus fixed. Nouveau bloc « Actions IA » en dernier enfant de la nav, avant le pied VPS — colonne d'icônes 10×10 replié, ligne pleine largeur dépliée.",`,
    `            "MOBILE : inchangé au pixel près — la sidebar n'existe pas (v-if=\\"!isMobile\\"), les 3 boutons restent flottants en bas à droite, juste scopés v-if=\\"isMobile\\" et débarrassés des classes md:* désormais mortes.",`,
    `            "La bulle d'astuce « Mode Merlin actif », ancrée sur l'ancienne position du bouton (bottom-6 left-6), est scopée mobile pour la même raison : sur desktop elle pointerait vers un bouton qui n'est plus là. Le titre du bouton dans la sidebar suffit.",`,
    `            "Non touché : la bulle de réponse de Merlin (résultat de l'audit, panneau modal transitoire) — hors du périmètre signalé, elle n'est pas une gêne permanente."`,
    `        ] },`,
].join('\n');

sub(`                    const CHANGELOG = [\n`, `                    const CHANGELOG = [\n${ENTREE}\n`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ version 34.08 + changelog');
