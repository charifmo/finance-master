import fs from 'node:fs';
const FILE = new URL('./index.html', import.meta.url);
let s = fs.readFileSync(FILE, 'utf8');
const CRLF = s.includes('\r\n'); if (CRLF) s = s.split('\r\n').join('\n');
const sub = (from, to, n = 1) => { const c = s.split(from).length - 1;
    if (c !== n) throw new Error(`Ancre (${c}/${n}) : ${from.slice(0,110)}`); s = s.split(from).join(to); };

sub(`                    const CURRENT_VERSION = "37.12 Cycle-Realise";`,
    `                    const CURRENT_VERSION = "37.13 Inbox-Zero";`);

const E = [
`        { version: "37.13 Inbox-Zero", date: "2026-09-28", changes: [`,
`            "CE QU'ON FAIT AUJOURD'HUI PASSE DEVANT — « À TRAITER » et « TERMINÉ » remontent juste sous le résumé du cycle. Les listes de référence descendent tout en bas et s'ouvrent fermées : « Entrées d'Argent » (qu'on pointe une fois par cycle, le jour de la paie, et qui n'a pas à occuper l'écran les vingt-neuf autres jours) et « Vue détaillée par catégorie ». Le bandeau « Mode Régularisation » reste au-dessus de tout : c'est un avertissement, pas une liste.",`,
`            "LES DATES, TOUJOURS VISIBLES — chaque ligne porte un badge 📅 j.N, teinté comme son paquet : rose si l'échéance est passée, ambre si elle tombe dans les sept jours, neutre au-delà. La liste et le badge racontent ainsi la même chose.",`,
`            "ET QUAND IL N'Y A PAS DE DATE, ON LE DIT — vérifié dans le code : la checklist lit exactement le même champ que le Budget Structurel et que le Pilotage Théorique (item.jourPrevu). Il n'existe pas de seconde source. Si « Syndic » ou « École » n'affichaient aucun jour, c'est que la ligne n'en porte pas. Un badge « 📅 sans date » le dit maintenant en toutes lettres, et un bandeau compte ces lignes et indique où renseigner le champ — y compris le cas qui le rend invisible : sur une charge découpée en parts, le champ « Jour prévu » est masqué par le formulaire.",`,
`            "TRI CHRONOLOGIQUE STRICT — les lignes sont classées par rang dans le cycle, jamais par numéro de jour. Sur un cycle 27→26, le j.30 vient AVANT le j.1 : c'est ce que montre l'écran. Les lignes sans date ferment la liste, faute de savoir où les placer.",`,
`            "VÉRIFIÉ SUR LE RENDU, PAS SUR LE SOURCE — les positions verticales réelles sont mesurées dans un vrai navigateur : « À traiter » précède les deux listes de référence, et les deux sont fermées à l'ouverture. 16 suites vertes. Sabotages vérifiés : ouvrir « Entrées d'Argent » par défaut fait tomber la suite, retirer le repère du badge de date aussi.",`,
`            "UNE DE MES ASSERTIONS NE TESTAIT RIEN — le contrôle sur la cohérence des badges se terminait par « || true », donc il passait quoi qu'il arrive. Remplacé par deux contrôles réels : les deux teintes s'excluent, et chacune correspond au rang dans le cycle."`,
`        ] },`].join('\n');

sub(`                    const CHANGELOG = [\n`, `                    const CHANGELOG = [\n${E}\n`);
if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ version 37.13 + changelog');
