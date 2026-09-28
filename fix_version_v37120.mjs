import fs from 'node:fs';
const FILE = new URL('./index.html', import.meta.url);
let s = fs.readFileSync(FILE, 'utf8');
const CRLF = s.includes('\r\n'); if (CRLF) s = s.split('\r\n').join('\n');
const sub = (from, to, n = 1) => { const c = s.split(from).length - 1;
    if (c !== n) throw new Error(`Ancre (${c}/${n}) : ${from.slice(0,110)}`); s = s.split(from).join(to); };

sub(`                    const CURRENT_VERSION = "37.11 Chat-Lisible";`,
    `                    const CURRENT_VERSION = "37.12 Cycle-Realise";`);

const E = [
`        { version: "37.12 Cycle-Realise", date: "2026-09-28", changes: [`,
`            "LE BUG, CONFIRMÉ — « paye » et « montantPaye » vivaient à plat sur la charge, et la charge vit dans donneesAnnuelles[ANNÉE], pas par mois. Cocher « Syndic payé » en octobre le laissait coché en novembre, en décembre, et jusqu'au 31 décembre. Le suivi mensuel ne repartait jamais de zéro. Votre diagnostic était exact.",`,
`            "L'EXÉCUTION QUITTE L'ÉTAT ANNUEL — jourPrevu ne bouge pas : c'est la théorie, et elle fonctionne. L'exécution part dans trackerRealise = { « 2026-10 » : { paye, montantPaye, dateReelle }, « 2026-11 » : … }. Une entrée absente vaut « à faire » : le basculement de cycle remet donc tout à traiter sans qu'aucun code ne « réinitialise » quoi que ce soit — il n'y a simplement rien à cette clé.",`,
`            "TROIS FONCTIONS ONT SUFFI — isItemPaid, getPaidAmount et toggleItemPaid étaient le seul passage vers l'état payé : journal du Relevé, Reste à payer, trésorerie disponible, compteurs, payload de l'IA. Les recâbler a rendu cyclique tout ce qui en dépend, sans toucher aux 39 points d'appel et sans risquer d'en oublier un. Le journal, lui, lit désormais l'état DU CYCLE QU'IL CONSTRUIT : la question ne se posait pas tant que l'état était annuel.",`,
`            "MIGRATION SANS PERTE, ET SANS DRAPEAU — un « paye » à plat ne peut décrire que le cycle où vous l'avez coché, le seul visible dans l'écran Réalisé : il y est rangé, puis le champ plat est supprimé. Rien à migrer la fois suivante, le champ n'existe plus. Les dépenses PONCTUELLES, elles, portent leur propre mois : leur pointage y reste attaché et ne se réinitialise pas — ce serait absurde pour une dépense qui n'arrive qu'une fois.",`,
`            "LA CHECKLIST DEVIENT UNE LISTE DE TÂCHES — dix-huit lignes rangées par catégorie ne disent pas quoi faire aujourd'hui. Section « À TRAITER » : uniquement ce qui reste, trié par échéance, en trois paquets — ⚠️ En retard, ⏳ Cette semaine, 📅 Plus tard. Section « ✅ TERMINÉ » repliée, avec la date de règlement de chaque ligne. Pointer une tâche la fait glisser de l'une à l'autre. La vue par catégorie est conservée sous un repli : elle reste la référence pour retrouver une ligne précise.",`,
`            "LE RANG DANS LE CYCLE, PAS LE JOUR DU MOIS — un cycle va du 27 au 26 : le j.1 vient APRÈS le j.27. Comparer bêtement deux numéros de jour classerait le j.1 « en retard » alors qu'il est encore à venir. Chaque échéance est ramenée à son rang depuis la paie (0 à 30), et c'est ce rang qui trie et qui range. Un contrôle dédié le vérifie : remplacer le rang par le jour brut fait tomber la suite.",`,
`            "LE RESTE À PAYER NE COMPTE QUE CE QUI RESTE — l'en-tête somme les restes de la section « À traiter », pas les montants dus : une avance partielle déjà versée n'est pas redemandée. Chaque clic sur une case le fait baisser du montant exact, vérifié dans le navigateur.",`,
`            "VÉRIFICATION — 16 suites vertes, dont une nouvelle (test_cycle_realise.mjs) qui charge l'application dans un vrai navigateur : migration, étanchéité entre cycles, avance partielle, dépense ponctuelle épinglée à son mois, reste à payer réactif, découpage par urgence et bascule d'une section à l'autre. Sabotages vérifiés : partager l'état entre cycles, ou ne plus filtrer « À traiter », font tomber la suite.",`,
`            "AU PASSAGE — le clonage d'une année repart d'un suivi VIERGE, côté application ET côté moteur PHP : sans cela, 2027 serait née avec les pointages de 2026. La parité JS/PHP déclare cette divergence, comme les précédentes : le JS de référence, figé avant ce chantier, ne connaît pas la clé."`,
`        ] },`].join('\n');

sub(`                    const CHANGELOG = [\n`, `                    const CHANGELOG = [\n${E}\n`);
if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ version 37.12 + changelog');
