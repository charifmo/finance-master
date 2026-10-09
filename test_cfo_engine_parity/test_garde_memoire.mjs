/**
 * v37.38 — CE QUI EST DEMANDÉ EST ÉCRIT ; LA RECHERCHE CONNAÎT LE BIEN.
 *
 *   Le signalement : « mémorise ces deux actifs » — le CFO écrit l'Actif Nord,
 *   oublie l'Actif Est / Al Ouidane, et répond « j'ai mémorisé les deux ». Puis
 *   « Actualiser » sur la carte de l'Actif Nord ramène des prix de villas pour
 *   un terrain de 7 ha en zone SHL2 sur la RN9.
 *
 *   La scène est jouée pour de vrai : PostgreSQL jetable (finance_vectors à
 *   clés UUID, chat_history comme l'écrit le nœud « Save Conversation »), les
 *   VRAIS cfo_memoire_garde.php et get_ai_memory.php sous `php -S` (4 workers,
 *   pour la concurrence), un faux webhook d'ingestion qui écrit dans
 *   finance_vectors comme le sous-workflow n8n, et un vrai navigateur.
 *
 *     A. Le garde-mémoire, côté serveur : rattrapage, exactement une fois,
 *        refus et questions respectés, règle effacée jamais ressuscitée,
 *        échec d'écriture repris, Telegram couvert, verrous d'appel.
 *     B. Le chat : consigne « un appel par entité », reçu affiché, l'entité
 *        oubliée écrite et relue en base.
 *     C. La Recherche Éclair : la fiche mémorisée de CET actif, et elle seule,
 *        part avec la question ; la méthode experte aussi.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..');
let ko = 0, n = 0;
const v = (t, ok, d = '') => { n++; if (!ok) ko++; console.log(`  ${ok ? '✅' : '❌'} ${t.padEnd(74)} ${ok ? '' : d}`); };
console.log('\n  GARDE-MÉMOIRE & RECHERCHE ÉCLAIR — PostgreSQL, php -S, navigateur\n  ' + '─'.repeat(90));

const require = createRequire(import.meta.url);
const essai = (f) => { try { return f(); } catch { return null; } };
const pw = essai(() => require('playwright-core'));
const vueJs = essai(() => require.resolve('vue/dist/vue.global.js'));
const chartJs = essai(() => fs.existsSync(path.join(RACINE, 'node_modules/chart.js/dist/chart.umd.js')) && path.join(RACINE, 'node_modules/chart.js/dist/chart.umd.js'));
const chromium = process.env.CHROMIUM || ['/opt/pw-browsers/chromium'].find(p => essai(() => fs.existsSync(p) && fs.statSync(p).isFile()));
const php = essai(() => execFileSync('which', ['php']).toString().trim());
const pgBin = ['/usr/lib/postgresql/16/bin', '/usr/lib/postgresql/15/bin', '/usr/lib/postgresql/14/bin'].find(p => fs.existsSync(path.join(p, 'initdb')));
const fin = () => { console.log('  ' + '─'.repeat(90)); console.log(ko === 0 ? `  ✅ TOUT PASSE — ${n} contrôles` : `  ❌ ${ko} contrôle(s) en échec sur ${n}`); process.exit(ko === 0 ? 0 : 1); };
if (!pw || !vueJs || !chartJs || !chromium || !php || !pgBin || process.env.SANS_PG) {
    console.log('  ⏭️  ignoré (playwright-core, vue, chart.js, Chromium, php ou PostgreSQL absent)');
    fin();
}

const portLibre = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const attendre = (ms) => new Promise(r => setTimeout(r, ms));
const attendrePort = async (port) => {
    for (let i = 0; i < 80; i++) {
        if (await new Promise(r => { const c = net.connect(port, '127.0.0.1', () => { c.end(); r(true); }); c.on('error', () => r(false)); })) return;
        await attendre(100);
    }
    throw new Error('port ' + port + ' muet');
};

/* ── PostgreSQL jetable ──────────────────────────────────────────────────── */
const pgPort = await portLibre();
const pgDir = fs.mkdtempSync(path.join('/var/tmp', 'pg-garde-'));
execFileSync('chown', ['postgres:postgres', pgDir]);
const en = (cmd, args) => execFileSync('runuser', ['-u', 'postgres', '--', path.join(pgBin, cmd), ...args], { stdio: 'ignore' });
en('initdb', ['-D', pgDir + '/data', '-A', 'trust', '-U', 'postgres']);
en('pg_ctl', ['-D', pgDir + '/data', '-o', `-p ${pgPort} -k ${pgDir} -c listen_addresses=127.0.0.1`, '-l', pgDir + '/log', '-w', 'start']);
const arreterPg = () => { try { en('pg_ctl', ['-D', pgDir + '/data', '-m', 'immediate', 'stop']); } catch (_) {} };
const sql = (q, vars = {}) => execFileSync('psql', ['-h', '127.0.0.1', '-p', String(pgPort), '-U', 'postgres', '-d', 'finance', '-At', '-q', '-v', 'ON_ERROR_STOP=1',
    ...Object.entries(vars).flatMap(([k, val]) => ['-v', k + '=' + val])], { input: q }).toString().trim();
execFileSync('psql', ['-h', '127.0.0.1', '-p', String(pgPort), '-U', 'postgres', '-c', 'CREATE DATABASE finance'], { stdio: 'ignore' });
const schema = () => sql(`
    SET client_min_messages TO WARNING;
    DROP TABLE IF EXISTS finance_vectors, chat_history, cfo_memoire_garde;
    CREATE TABLE finance_vectors (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), text text, metadata jsonb);
    CREATE TABLE chat_history (id serial PRIMARY KEY, session_id varchar(255) NOT NULL, message jsonb NOT NULL, created_at timestamptz DEFAULT NOW());`);
schema();
// Ce qu'écrit le nœud « Save Conversation » : deux lignes, un seul NOW().
const echange = (session, humain, ia, ilYa = '0 seconds') => sql(`INSERT INTO chat_history (session_id, message, created_at) VALUES
    (:'s', jsonb_build_object('type','human','data',jsonb_build_object('content', CAST(:'h' AS text))), NOW() - CAST(:'d' AS interval)),
    (:'s', jsonb_build_object('type','ai','data',jsonb_build_object('content', CAST(:'a' AS text))), NOW() - CAST(:'d' AS interval));`,
    { s: session, h: humain, a: ia, d: ilYa });
const vecteur = (texte, session = 'agent') => sql(`INSERT INTO finance_vectors (text, metadata) VALUES (:'t',
    jsonb_build_object('categorie','contexte','source','cfo_agent_memory_writer','session_id', CAST(:'s' AS text)))`, { t: texte, s: session });
const compte = (motif) => Number(sql(`SELECT count(*) FROM finance_vectors WHERE text ILIKE :'m'`, { m: '%' + motif + '%' }));

/* ── Faux webhook d'ingestion : ce que fait le sous-workflow n8n ──────────── */
let panne = () => false, menteur = () => false; const ingeres = [];
const ingest = http.createServer((req, res) => {
    let b = ''; req.on('data', c => b += c);
    req.on('end', async () => {
        let d = {}; try { d = JSON.parse(b); } catch (_) {}
        ingeres.push(d);
        const texte = String(d.texte || '').trim(), cat = String(d.categorie || 'general');
        await attendre(250);   // l'embedding prend du temps : de quoi faire se chevaucher les appels concurrents
        if (texte.length < 5 || !['preference', 'regle', 'contexte', 'general'].includes(cat) || panne(texte)) {
            res.writeHead(500, { 'Content-Type': 'application/json' }); return res.end('{"message":"Error in workflow"}');
        }
        // le « menteur » répond ok sans rien écrire : le garde-fou doit RELIRE la base, pas croire le webhook
        if (!menteur(texte)) sql(`INSERT INTO finance_vectors (text, metadata) VALUES (:'t', jsonb_build_object('categorie', CAST(:'c' AS text), 'source','cfo_agent_memory_writer','session_id', CAST(:'s' AS text)))`,
            { t: texte, c: cat, s: String(d.session_id || '') });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(JSON.stringify({ status: 'ok', memorise: true, texte, categorie: cat })));   // n8n : du JSON dans une chaîne
    });
});
const ingestPort = await portLibre();
await new Promise(r => ingest.listen(ingestPort, '127.0.0.1', r));

/* ── Le docroot, comme le VPS ────────────────────────────────────────────── */
const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8'));
const Y = new Date().getFullYear();
const base = fx.donneesAnnuelles[Object.keys(fx.donneesAnnuelles)[0]];
fx.donneesAnnuelles = { [Y]: JSON.parse(JSON.stringify(base)), [Y + 1]: JSON.parse(JSON.stringify(base)) };
fx.soldesInitiaux.anneeActuelle = Y;
const terrain = (id, name, extra) => ({ id, name, type: 'Terrain Nu', isProductive: false, value: 16450000, revenue: 0, taux_credit: 0, annees_total: 0, annees_restantes: 0,
    val_pessimiste: 0, val_optimiste: 0, quotePart: '35%', apport_personnel: 0, montant_credit: 0, valeur_actuelle: 0, ...extra });
fx.masterAssets = [
    terrain('ma_5', 'Terrain Nord (Ouahat Sidi Brahim)', { surface_totale: 70000, zonage_actuel: 'Agricole', zonage_cible: 'SHL2', prix_m2: 235, prix_m2_cible: 600 }),
    terrain('ma_6', 'Terrain Est (Al Ouidane)', { value: 3675000, surface_totale: 30000, zonage_actuel: 'Agricole' }),
    { ...terrain('ma_7', 'Villa Riad Salam', { value: 1400000 }), type: 'Résidentiel' },
];
const CAPTURES = process.env.CAPTURES || '';
let tw = '';
if (CAPTURES) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-garde-'));
    fs.writeFileSync(path.join(tmp, 'in.css'), '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
    fs.writeFileSync(path.join(tmp, 'cfg.js'), 'module.exports={content:[' + JSON.stringify(path.join(RACINE, 'index.html')) + '],theme:{extend:{}}};');
    execFileSync(path.join(RACINE, 'node_modules/.bin/tailwindcss'), ['-c', path.join(tmp, 'cfg.js'), '-i', path.join(tmp, 'in.css'), '-o', path.join(tmp, 'out.css'), '--minify'], { stdio: 'ignore' });
    tw = fs.readFileSync(path.join(tmp, 'out.css'), 'utf8');
    fs.mkdirSync(CAPTURES, { recursive: true });
}
const html = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8')
    .replace('<script src="https://unpkg.com/vue@3/dist/vue.global.js"', '<script src="/vue.js"')
    .replace('<script src="https://cdn.jsdelivr.net/npm/chart.js"', '<script src="/chart.js"')
    .replace(/<script src="https:\/\/cdn\.tailwindcss\.com"[^>]*><\/script>/, CAPTURES ? '<link rel="stylesheet" href="/tailwind.css">' : '')
    .replace(/<script[^>]*src="https:\/\/[^"]*"[^>]*><\/script>/g, '');
const doc = fs.mkdtempSync(path.join(os.tmpdir(), 'garde-'));
const F = path.join(doc, 'finance');
fs.mkdirSync(F);
fs.writeFileSync(path.join(F, 'index.html'), html);
for (const f of ['save_data.php', 'cfo_memoire_garde.php', 'cfo_memoire_lib.php', 'get_ai_memory.php', 'cfo_rag_ids.php'])
    if (fs.existsSync(path.join(RACINE, f))) fs.copyFileSync(path.join(RACINE, f), path.join(F, f));   // absents sur une version antérieure
fs.writeFileSync(path.join(F, 'finance_data.json'), JSON.stringify(fx));
fs.writeFileSync(path.join(F, 'db_config.php'), `<?php return ['host' => '127.0.0.1', 'port' => '${pgPort}', 'dbname' => 'finance', 'user' => 'postgres', 'password' => '',
    'memory_ingest_url' => 'http://127.0.0.1:${ingestPort}/webhook/finance-memory-ingest'];`);
// Une règle que l'utilisateur a effacée depuis la Supervision IA (archive de get_ai_memory.php)
fs.writeFileSync(path.join(F, 'vectors_supprimes.jsonl'), JSON.stringify({ supprime_le: '2026-10-01T10:00:00+00:00', id: 'f64decdb-8e65-4a78-990a-a2ab402b3afd',
    texte: 'Mon plafond resto est de 1 500 DH par mois.' }) + '\n');
fs.copyFileSync(vueJs, path.join(doc, 'vue.js'));
fs.copyFileSync(chartJs, path.join(doc, 'chart.js'));
if (CAPTURES) fs.writeFileSync(path.join(doc, 'tailwind.css'), tw);
const port = await portLibre();
const srv = spawn(php, ['-S', '127.0.0.1:' + port, '-t', doc], { stdio: 'ignore', env: { ...process.env, PHP_CLI_SERVER_WORKERS: '4' } });
await attendrePort(port);
const BASE = `http://127.0.0.1:${port}/finance/`;
const garder = async (entetes = { 'X-Requested-With': 'XMLHttpRequest' }, corps = { action: 'garantir' }, methode = 'POST') => {
    const r = await fetch(BASE + 'cfo_memoire_garde.php', { method: methode, headers: { 'Content-Type': 'application/json', ...entetes },
        body: methode === 'POST' ? JSON.stringify(corps) : undefined });
    const t = await r.text(); let d = null; try { d = JSON.parse(t); } catch (_) {}
    return { code: r.status, d, t };
};
const statuts = (r) => (r ? r.entites : []).map(e => e.titre + '=' + e.statut).join(' | ');

const DEMANDE = "Mémorise ces deux actifs :\n"
    + "Actif Nord (Ouahat Sidi Brahim) : terrain de 7 hectares en zone SHL2 sur la RN9, titre foncier, indivision 35 %.\n"
    + "Actif Est / Al Ouidane : terrain agricole de 3 ha sur la route d'Al Ouidane, près de Marrakech, non constructible en attente du SDAU.";
// « le terrain est » : le verbe ne doit jamais passer pour l'Actif Est
const NORD_CFO = "L'Actif Nord (Ouahat Sidi Brahim) : 7 hectares en zone SHL2 le long de la RN9 ; le terrain est titré, détenu en indivision à 35 %.";

let browser = null;
// Chaque partie s'exécute même si la précédente échoue : un rejeu sur une
// version antérieure doit montrer TOUT ce qui manque, pas la première panne.
const partie = async (nom, f) => { try { await f(); } catch (e) { v(nom + ' : sans exception', false, String(e && e.stack || e).slice(0, 400)); } };
try {
  await partie('A', async () => {
    /* ═══ A. LE GARDE-MÉMOIRE, CÔTÉ SERVEUR ═══════════════════════════════ */
    console.log('  ── A. serveur : rattrapage, une seule fois, refus respectés');
    vecteur(NORD_CFO);                                                       // le seul appel memory_writer du CFO
    echange('web_1', DEMANDE, "<p>J'ai bien mémorisé les deux actifs : l'Actif Nord et l'Actif Est.</p>", '2 days');
    echange('tg_42', 'Retiens que je préfère louer des Airbnb plutôt que des hôtels', "C'est noté !", '1 day');
    echange('web_1', "Qu'as-tu mémorisé sur mes terrains ?", "J'ai mémorisé l'Actif Nord.", '20 hours');
    echange('web_1', "Ne mémorise pas ça, c'est juste une idée : acheter un terrain de 500 m² à Bouskoura.", "D'accord, je n'enregistre rien.", '19 hours');
    echange('market_intel_ma_5', "Recherche Éclair, mémorise : Terrain Nord (Ouahat Sidi Brahim), 70 000 m² en zone agricole, cible SHL2, prix au m² retenu 235 DH.", '<p>Prix…</p>', '18 hours');
    echange('web_1', 'Mémorise que mon plafond resto est de 1 500 DH par mois', 'Mémorisé.', '17 hours');
    echange('web_1', "Mémorise que j'ai ouvert un compte au Crédit du Maroc en 2015", 'Mémorisé.', '45 days');
    echange('tg_42', 'Mémorise que le Local Bouskoura est loué 4 500 DH par mois à Hadri Parfums depuis 2021', 'Mémorisé !', '16 hours');
    echange('web_1', 'Mémorise que la Villa Riad Salam est louée 9 000 DH par mois depuis mars 2024, bail de 3 ans.', 'Mémorisé.', '15 hours');
    panne = (t) => t.includes('Hadri');
    menteur = (t) => t.includes('Riad Salam');

    const r1 = await garder();
    v('premier passage : 200, première passe sur 30 jours', r1.code === 200 && r1.d?.status === 'ok' && r1.d.premiere_passe === true, r1.t.slice(0, 300));
    const recu = (d, s, motif) => (d?.recus || []).find(r => r.session_id === s && (r.extrait || '').includes(motif));
    const rA = recu(r1.d, 'web_1', 'deux actifs');
    v('la demande « deux actifs » : Nord en mémoire, Est RATTRAPÉ', statuts(rA) === 'Actif Nord (Ouahat Sidi Brahim)=en_memoire | Actif Est / Al Ouidane=ecrite', statuts(rA));
    v('  → l\'Actif Est est en base, une fois', compte('Actif Est / Al Ouidane') === 1, String(compte('Actif Est / Al Ouidane')));
    v('  → l\'Actif Nord n\'est pas dupliqué', compte('Actif Nord') === 1, String(compte('Actif Nord')));
    const idEst = sql(`SELECT id FROM finance_vectors WHERE text LIKE 'Actif Est / Al Ouidane%'`);
    v('  → le reçu cite l\'identifiant RÉEL de la ligne écrite', rA && rA.entites[1].regle_id === idEst, (rA && rA.entites[1].regle_id) + ' ≠ ' + idEst);
    v('  → métadonnées : catégorie contexte, session garde_memoire:web_1',
      !!idEst && sql(`SELECT metadata->>'categorie' || '|' || (metadata->>'session_id') FROM finance_vectors WHERE id = :'i'`, { i: idEst }) === 'contexte|garde_memoire:web_1');
    v('Telegram : la préférence Airbnb est écrite aussi', statuts(recu(r1.d, 'tg_42', 'Airbnb')).endsWith('=ecrite') && compte('Airbnb') === 1, statuts(recu(r1.d, 'tg_42', 'Airbnb')));
    v('« qu\'as-tu mémorisé ? » : rien d\'écrit, aucun reçu', !recu(r1.d, 'web_1', "Qu'as-tu") && compte('terrains ?') === 0);
    v('« ne mémorise pas ça » : rien d\'écrit', compte('Bouskoura de 500') === 0 && compte('500 m²') === 0);
    v('la Recherche Éclair (market_intel_*) est ignorée', !(r1.d?.recus || []).some(r => r.session_id.startsWith('market_intel_')));
    const rF = recu(r1.d, 'web_1', '1 500');
    v('la règle effacée dans la Supervision IA n\'est pas ressuscitée', rF && rF.entites[0].statut === 'supprimee' && compte('1 500 DH') === 0, statuts(rF));
    v('hors fenêtre (45 jours) : non traité à la première passe', compte('Crédit du Maroc') === 0 && !recu(r1.d, 'web_1', 'Crédit'));
    const rH = recu(r1.d, 'tg_42', 'Hadri');
    v('webhook en panne : échec DIT, avec la cause, et rien en base', rH && rH.entites[0].statut === 'echec' && /HTTP 500/.test(rH.entites[0].erreur || '') && compte('Hadri') === 0, JSON.stringify(rH?.entites));
    v('  → l\'échange est marqué « à reprendre »', rH && rH.a_reprendre === true);
    const rR = recu(r1.d, 'web_1', 'Riad Salam');
    v('webhook qui répond « ok » sans écrire : le garde-fou RELIT la base, et le dit',
      rR && rR.entites[0].statut === 'echec' && /introuvable en base/.test(rR.entites[0].erreur || '') && compte('Riad Salam') === 0, JSON.stringify(rR?.entites));
    v('compteurs : 2 écrites, 2 échecs', r1.d.ecrites === 2 && r1.d.echecs === 2, `${r1.d.ecrites} / ${r1.d.echecs}`);
    v('le webhook n\'a été appelé que pour ce qui manquait (4 appels)', ingeres.length === 4, String(ingeres.length));

    panne = () => false; menteur = () => false;
    const r2 = await garder();
    const rH2 = recu(r2.d, 'tg_42', 'Hadri'), rR2 = recu(r2.d, 'web_1', 'Riad Salam');
    v('deuxième passage : les écritures en échec sont reprises et réussissent', rH2 && rH2.reprise && rH2.entites[0].statut === 'ecrite' && compte('Hadri') === 1
      && rR2 && rR2.entites[0].statut === 'ecrite' && compte('Riad Salam') === 1, statuts(rH2) + ' / ' + statuts(rR2));
    v('  → rien d\'autre n\'est réécrit (exactement une fois)', (r2.d.recus || []).length === 2 && ingeres.length === 6 && compte('Actif Est') === 1, `${(r2.d.recus || []).length} reçus, ${ingeres.length} appels`);
    const r3 = await garder();
    v('troisième passage : rien à faire', r3.d?.status === 'ok' && r3.d.recus.length === 0 && r3.d.premiere_passe === false && ingeres.length === 6, r3.t.slice(0, 200));

    echange('web_2', "Retiens que mon Terrain Sud fait 2 hectares à Tit Mellil, en zone industrielle, loué 4 000 DH par mois.", "Parfait, c'est mémorisé.");
    const quatre = await Promise.all([garder(), garder(), garder(), garder()]);
    v('4 appels lancés ensemble : une seule écriture', compte('Tit Mellil') === 1 && ingeres.length === 7, `${compte('Tit Mellil')} ligne(s), ${ingeres.length} appels`);
    v('  → un seul des quatre rend le reçu', quatre.filter(q => (q.d?.recus || []).some(r => r.session_id === 'web_2')).length === 1);

    const sansEntete = await garder({});
    v('verrou : sans X-Requested-With → 400', sansEntete.code === 400 && sansEntete.d?.error === 'ENTETE_MANQUANT');
    const etrangere = await garder({ 'X-Requested-With': 'XMLHttpRequest', Origin: 'https://evil.example' });
    v('verrou : autre origine → 403', etrangere.code === 403 && etrangere.d?.error === 'ORIGINE_ETRANGERE');
    const get = await garder({}, null, 'GET');
    v('verrou : GET → 405', get.code === 405);
    v('aucun texte accepté de l\'appelant : seul chat_history est lu', !fs.readFileSync(path.join(RACINE, 'cfo_memoire_garde.php'), 'utf8').match(/\$corps\[['"](?:texte|question|contenu)/));
  });

    /* ═══ B. LE CHAT : CONSIGNE, REÇU, BASE ═══════════════════════════════ */
    console.log('  ── B. chat : un appel par entité exigé, reçu affiché');
    schema();
    let ctx, page, erreurs = [];
  await partie('B', async () => {
    browser = await pw.chromium.launch({ executablePath: chromium, args: ['--no-sandbox'] });
    ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
    await ctx.addInitScript(() => { try { localStorage.setItem('cfo_webhook_url', 'https://n8n.test/webhook/finance-cfo-web'); } catch (_) {} });
    const envoyes = [];
    // Le faux workflow n8n : l'agent n'écrit QUE l'Actif Nord, affirme les deux,
    // et « Save Conversation » enregistre l'échange — exactement le signalement.
    await ctx.route('https://n8n.test/**', async (route) => {
        const req = route.request();
        if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST' } });
        const b = JSON.parse(req.postData() || '{}');
        envoyes.push(b);
        let rep = "<p>Votre surplus du mois est de 6 000 DH.</p>";
        if (/Actif Nord/.test(b.question)) { vecteur(NORD_CFO); rep = "<p>C'est fait : j'ai bien <b>mémorisé les deux actifs</b>, l'Actif Nord et l'Actif Est.</p>"; }
        echange(b.session_id, b.question, rep);
        await route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ html: rep, session_id: b.session_id }) });
    });
    page = await ctx.newPage();
    page.on('pageerror', e => erreurs.push(String(e)));
    page.on('dialog', d => d.accept());
    await page.goto(BASE, { waitUntil: 'load' });
    await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__._instance && Array.isArray(a.__vue_app__._instance.setupState.cfoMessages); }, null, { timeout: 30000 });
    await page.waitForTimeout(800);
    const ST = 'document.querySelector("#app").__vue_app__._instance.setupState';
    await page.evaluate((ST) => { const S = eval(ST); S.showCfoModal = true; S.cfoMessages.splice(0); }, ST);
    await page.evaluate(({ ST, q }) => eval(ST).consulterCFO(q), { ST, q: DEMANDE });
    await page.waitForTimeout(400);
    const envoi = envoyes[envoyes.length - 1] || {};
    v('la question part avec la consigne « un appel memory_writer par entité »', /⟦GARDE-MÉMOIRE⟧[\s\S]*UNE FOIS PAR ENTITÉ[\s\S]*⟦\/GARDE-MÉMOIRE⟧/.test(envoi.question || ''), (envoi.question || '').slice(-200));
    v('  → la bulle de l\'utilisateur, elle, reste celle qu\'il a tapée', await page.evaluate((ST) => eval(ST).cfoMessages.find(m => m.role === 'user')?.content, ST) === DEMANDE);
    const recuDom = await page.$('[data-recu-memoire]');
    v('un reçu de mémorisation suit la réponse du CFO', !!recuDom);
    const txt = recuDom ? (await recuDom.innerText()).replace(/\s+/g, ' ') : '';
    v('  → « 2/2 entités en mémoire, vérifiées en base »', /2\/2 entités en mémoire, vérifiées en base/.test(txt), txt.slice(0, 160));
    v('  → l\'Actif Nord : en mémoire', /Actif Nord \(Ouahat Sidi Brahim\) — en mémoire/.test(txt), txt);
    v('  → l\'Actif Est / Al Ouidane : rattrapé, relu en base', /Actif Est \/ Al Ouidane — rattrapée/.test(txt), txt);
    v('  → l\'écart entre la parole du CFO et la base est dit', /Le CFO en avait omis 1/.test(txt), txt);
    v('  → statuts lisibles par la machine', (await page.$$eval('[data-gm-statut]', els => els.map(e => e.dataset.gmStatut).join(','))) === 'en_memoire,ecrite');
    v('en base : Nord une fois, Est une fois', compte('Actif Nord') === 1 && compte('Actif Est / Al Ouidane') === 1, `${compte('Actif Nord')} / ${compte('Actif Est / Al Ouidane')}`);
    const chatSup = await page.evaluate(async () => (await (await fetch('/finance/get_ai_memory.php?table=chat&limit=20')).json()).chat.messages);
    const humain = chatSup.find(m => m.auteur === 'Vous' && m.contenu.includes('Actif Nord'));
    v('Supervision IA : la consigne n\'apparaît pas dans l\'historique affiché', humain && !humain.contenu.includes('⟦') && humain.contenu === DEMANDE, humain && humain.contenu.slice(-120));
    if (CAPTURES) {
        await page.evaluate((ST) => { const S = eval(ST); S.chatFullScreen = true; }, ST).catch(() => {});
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(CAPTURES, '1_recu_memorisation.png') });
    }
    // On compte les REÇUS, pas les messages : d'autres avis peuvent légitimement
    // s'ajouter au fil (« Écran resynchronisé »), selon l'état du serveur.
    const recusDans = () => page.evaluate((ST) => eval(ST).cfoMessages.filter(m => String(m.content).includes('data-recu-memoire')).length, ST);
    const nAvant = await recusDans();
    await page.evaluate(({ ST }) => eval(ST).consulterCFO('Quel est mon surplus ce mois-ci ?'), { ST });
    await page.waitForTimeout(300);
    const derniere = envoyes[envoyes.length - 1].question;
    v('question ordinaire : ni consigne, ni reçu', derniere === 'Quel est mon surplus ce mois-ci ?' && await recusDans() === nAvant, derniere);
  });
  const ST = 'document.querySelector("#app").__vue_app__._instance.setupState';
  await partie('C', async () => {

    /* ═══ C. LA RECHERCHE ÉCLAIR CONNAÎT LE BIEN ══════════════════════════ */
    console.log('  ── C. Recherche Éclair : la fiche de CET actif part avec la question');
    const questions = [];
    await ctx.route('https://n8n.beau.ink/**', async (route) => {
        const req = route.request();
        if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST' } });
        const b = JSON.parse(req.postData() || '{}');
        questions.push(b.question);
        await route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ html:
            '<p><b>Source : Recherche Internet.</b></p><ul><li>(a) Terrains agricoles en cours de requalification SHL2 le long de la RN9 : 450 à 700 DH/m² selon la profondeur de façade.</li>'
            + '<li>(b) Le plan d\'aménagement de la commune prévoit l\'élargissement de la RN9.</li><li>(c) Indivision : une vente suppose l\'accord des co-indivisaires.</li></ul>'
            + '<p>Requêtes utilisées : « prix m² terrain SHL2 RN9 Ouahat Sidi Brahim 2026 » · « plan d\'aménagement Ouahat Sidi Brahim SHL2 » · « transaction terrain 7 ha RN9 Marrakech »</p>' }) });
    });
    const intel = async (id) => {
        await page.evaluate(({ ST, id }) => { const S = eval(ST); S.activeTab = 'wealth'; S.chatFullScreen = false; S.showCfoModal = false;
            S.marketIntel = Object.assign({}, S.marketIntel, { [id]: Object.assign({}, S.marketIntel[id] || {}, { open: true }) });
            const a = S.masterAssets.find(x => x.id === id); return S.chargerMarketIntel(a); }, { ST, id });
        await page.waitForTimeout(200);
        return questions[questions.length - 1] || '';
    };
    const qN = await intel('ma_5');
    v('Terrain Nord : la fiche mémorisée part VERBATIM', qN.includes('« ' + NORD_CFO + ' »'), qN.slice(0, 400));
    v('  → avec la fiche de l\'application (70 000 m², 7 ha, Agricole → cible SHL2)', /Surface : 70[\s  ]000 m² \(7 ha\)/.test(qN) && qN.includes('Zonage : Agricole → cible SHL2'), qN.slice(0, 600));
    v('  → variables repérées : 7 hectares · SHL2 · RN9 · indivision', /Variables repérées : 7 hectares · SHL2 · RN9 · indivision/.test(qN), (qN.match(/Variables repérées : .*/) || [''])[0]);
    v('  → la fiche de l\'Actif Est n\'y est pas (« Ouidane » absent)', !/Ouidane/.test(qN));
    v('  → méthode : requêtes expertes, génériques INTERDITES, requêtes listées',
      /2 à 3 requêtes web_search EXPERTES/.test(qN) && /INTERDIT : une requête générique \(« prix villa »/.test(qN) && /Requêtes utilisées :/.test(qN));
    v('  → lecture seule : ni propose_changes, ni memory_writer', /LECTURE SEULE : aucun propose_changes, aucun committer, aucun memory_writer/.test(qN));
    v('  → la question ne déclenche pas le garde-mémoire', !/⟦/.test(qN) && !/m[ée]moris(e|er)\b|retiens/i.test(qN));
    const bandeau = await page.$eval('tr [data-mi-contexte]', el => el.innerText.replace(/\s+/g, ' ')).catch(() => '');
    v('la carte montre la fiche injectée et ses variables', /Fiche mémorisée injectée/i.test(bandeau) && /SHL2/.test(bandeau) && /RN9/.test(bandeau) && /Ouahat Sidi Brahim/.test(bandeau), bandeau);
    v('la synthèse s\'affiche, requêtes comprises', /Requêtes utilisées/.test(await page.$eval('tr .cfo-html', el => el.innerText).catch(() => '')));
    if (CAPTURES) {
        const ligne = await page.$('tr [data-mi-contexte]');
        if (ligne) await ligne.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        const boite = await page.evaluate(() => { const el = document.querySelector('tr [data-mi-contexte]'); const c = el && el.closest('td'); if (!c) return null; const r = c.getBoundingClientRect(); return { x: Math.max(0, r.x), y: Math.max(0, r.y - 60), width: Math.min(r.width, 1360), height: r.height + 70 }; });
        await page.screenshot({ path: path.join(CAPTURES, '2_recherche_eclair_nord.png'), clip: boite || undefined });
    }

    const qE = await intel('ma_6');
    v('Terrain Est : SA fiche — celle que le garde-mémoire a rattrapée', qE.includes("Actif Est / Al Ouidane : terrain agricole de 3 ha") && /non constructible/.test(qE) && /SDAU/.test(qE), qE.slice(0, 500));
    v('  → et pas celle de l\'Actif Nord', !qE.includes(NORD_CFO) && !/Ouahat/.test(qE.replace(/• Nom :.*\n/, '')));
    const qV = await intel('ma_7');
    v('Villa sans fiche : l\'agent doit lire sa mémoire AVANT le web', /aucune trouvée[\s\S]*AVANT toute recherche web, appelle finance_rag avec « Villa Riad Salam »/.test(qV), qV.slice(0, 500));
    v('  → la carte le dit', !!(await page.$('tr [data-mi-sans-fiche]')));
    await ctx.route('**/get_ai_memory.php*', (route) => route.fulfill({ status: 500, body: 'Erreur PHP' }));
    const qK = await intel('ma_5');
    v('mémoire illisible : la recherche part quand même, avec finance_rag exigé', /n'a pas pu être lue[\s\S]*appelle finance_rag/.test(qK) && /Surface : 70/.test(qK));
    v('  → la carte le dit', !!(await page.$('tr [data-mi-memoire-ko]')));
  });
    v('aucune erreur JavaScript dans la page', erreurs.length === 0, erreurs.join(' | '));
} catch (e) {
    v('scène complète sans exception', false, String(e && e.stack || e));
} finally {
    if (browser) await browser.close().catch(() => {});
    srv.kill();
    ingest.close();
    arreterPg();
}
fin();
