/**
 * v37.4 — Une réponse sans contenu ne doit jamais s'afficher comme un JSON brut.
 *   Régression observée en production : la bulle du CFO affichait
 *   {"session_id":"c44fdff8-…"} à la place d'une réponse. Cause : le nœud
 *   « AI Agent » porte continueOnFail, donc en cas d'échec n8n émet un item
 *   sans clé `output` ; JSON.stringify supprime alors `html` du corps de
 *   réponse, et le dernier repli de l'application recopiait le JSON entier.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8').split('\r\n').join('\n');

const debut = html.indexOf('const _echapper');
const fin = html.indexOf("+ '</div>';");
if (debut < 0 || fin < 0) { console.log('  ❌ _lireReponseCFO introuvable dans index.html'); process.exit(1); }
const { _lireReponseCFO } = new Function(html.slice(debut, fin + "+ '</div>';".length) + '\n return { _lireReponseCFO };')();

let ko = 0;
const v = (titre, ok, detail = '') => {
    if (!ok) ko++;
    console.log(`  ${ok ? '✅' : '❌'} ${titre.padEnd(56)} ${ok ? '' : detail}`);
};

console.log('\n  LECTURE DES RÉPONSES DU CFO\n  ' + '─'.repeat(74));

// Le cas exact remonté en production
const PROD = '{"session_id":"c44fdff8-ab8d-4abb-8878-a510fd6d6e4e"}';
const r = _lireReponseCFO(PROD);
v('cas production : le JSON brut n\'est pas recopié', !r.html.includes('"session_id"'), r.html.slice(0, 80));
v('  → l\'identifiant de session n\'est pas affiché', !r.html.includes('c44fdff8-ab8d-4abb-8878-a510fd6d6e4e'));
v('  → l\'échec est signalé', r.vide === true);

// Réponses valides : aucune ne doit être dénaturée
for (const [champ, brut] of [['html', '{"html":"<p>OK</p>"}'], ['output', '{"output":"OK"}'],
                             ['response', '{"response":"OK"}'], ['message', '{"message":"OK"}'],
                             ['text', '{"text":"OK"}']]) {
    const x = _lireReponseCFO(brut);
    v(`champ « ${champ} » rendu tel quel`, x.vide === false && x.html.includes('OK'), x.html.slice(0, 60));
}

// Cause d'échec transmise par le workflow
const e = _lireReponseCFO('{"html":"","session_id":"x","erreur":"401 Unauthorized"}');
v('cause du workflow remontée à l\'écran', e.html.includes('401 Unauthorized'), e.html.slice(0, 80));

const e2 = _lireReponseCFO('{"session_id":"x","error":{"message":"pending_commit.php a répondu 500"}}');
v('erreur objet {message} remontée', e2.html.includes('500'), e2.html.slice(0, 80));

// Cas dégradés
v('réponse vide → message explicite', _lireReponseCFO('').vide === true);
v('html vide → traité comme absent', _lireReponseCFO('{"html":"   "}').vide === true);
v('page HTML d\'erreur rendue telle quelle', _lireReponseCFO('<html>401 Unauthorized</html>').html.includes('401'));

// Sécurité : une cause hostile ne doit pas s'injecter dans la bulle
const x = _lireReponseCFO('{"session_id":"x","error":"<img src=q onerror=alert(1)>"}');
v('contenu hostile dans la cause échappé', x.html.includes('&lt;img') && !x.html.includes('<img'), x.html.slice(0, 90));

console.log('  ' + '─'.repeat(74));
console.log(`  ${ko ? '❌ ÉCHEC' : '✅ TOUT PASSE'} — ${ko} contrôle(s) en échec\n`);
process.exit(ko ? 1 : 0);
