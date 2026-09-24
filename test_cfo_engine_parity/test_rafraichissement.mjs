/**
 * v37.7 — L'écran doit suivre le serveur, sans jamais écraser une saisie.
 *
 *   Symptôme de production : le CFO annonce « ✓ appliqué », le VPS contient
 *   bien l'écriture (vérifié côté moteur), et l'onglet ouvert continue
 *   d'afficher l'état chargé au démarrage — les champs DATE CIBLE paraissent
 *   vides alors qu'ils valent 2027-12 sur le serveur.
 *
 *   Ce que cette suite verrouille, c'est la TABLE DE DÉCISION : quand
 *   recharger, quand se taire, et quand refuser de recharger. Le point
 *   délicat n'est pas de relire le serveur — c'est de ne PAS le faire quand
 *   l'utilisateur a des modifications non sauvegardées à l'écran.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8').split('\r\n').join('\n');

const DEBUT = 'let _serverSignature = null;';
const FIN   = "} catch (e) { addLog('❌ Rechargement impossible : ' + (e.message || e), 'error'); }";
const i = html.indexOf(DEBUT), j = html.indexOf(FIN);
if (i < 0 || j < 0) { console.log('  ❌ bloc de rafraîchissement introuvable dans index.html'); process.exit(1); }
const SOURCE = html.slice(i, j + FIN.length) + '\n};\n';

let ko = 0;
const v = (titre, ok, detail = '') => {
    if (!ko && !ok) {} if (!ok) ko++;
    console.log(`  ${ok ? '✅' : '❌'} ${titre.padEnd(60)} ${ok ? '' : detail}`);
};
const pause = (ms) => new Promise(r => setTimeout(r, ms));

/** Monte le bloc avec un serveur simulé et un état d'onglet contrôlé. */
const monter = ({ corpsServeur, statut = 'synced', echecReseau = false, reponseConfirm = true }) => {
    const journal = [], importes = [];
    const ref = (val) => ({ value: val });
    const serverSyncStatus = ref(statut);
    const serverLastSync   = ref('');
    const etatServeur = { corps: corpsServeur, echec: echecReseau, appels: 0 };
    const ctx = {
        ref,
        DATA_PATH: '/finance/finance_data.json',
        serverSyncStatus, serverLastSync,
        addLog: (m, t) => journal.push([t, m]),
        executerImportFusion: (d) => importes.push(d),
        confirm: () => reponseConfirm,
        fetch: async () => {
            etatServeur.appels++;
            if (etatServeur.echec) throw new Error('réseau coupé');
            return { ok: true, text: async () => etatServeur.corps };
        },
        setTimeout, Date,
    };
    const noms = Object.keys(ctx);
    const usine = new Function(...noms,
        SOURCE + '\n return { rafraichirDepuisServeur, forcerRechargementServeur, serveurDivergent, rafraichissementEnCours, _poserSignature: (t) => { _serverSignature = t === null ? null : _sig(t); } };');
    const api = usine(...noms.map(n => ctx[n]));
    api._poserSignature(corpsServeur);        // état vu au chargement de la page
    return { api, journal, importes, serverSyncStatus, serverLastSync, etatServeur };
};

const AVANT = JSON.stringify({ wealthGoals: [{ libelle: "Fonds d'urgence", date_cible: '' }] });
const APRES = JSON.stringify({ wealthGoals: [{ libelle: "Fonds d'urgence", date_cible: '2027-12' }] });

console.log('\n  RETOUR D\'ÉCRITURE — TABLE DE DÉCISION\n  ' + '─'.repeat(78));

// ── 1. Rien n'a bougé : on ne touche à rien, et on ne dit rien.
{
    const m = monter({ corpsServeur: AVANT });
    const r = await m.api.rafraichirDepuisServeur();
    v('serveur inchangé → aucun rechargement', r.change === false && r.applique === false, JSON.stringify(r));
    v('  → executerImportFusion n\'est pas appelé', m.importes.length === 0);
    v('  → aucun bandeau', m.api.serveurDivergent.value === false);
}

// ── 2. LE CAS DE PRODUCTION : l'agent a écrit, l'onglet n'a rien de local.
{
    const m = monter({ corpsServeur: AVANT });
    m.etatServeur.corps = APRES;                       // le Committer est passé par là
    const r = await m.api.rafraichirDepuisServeur();
    v('écriture de l\'agent + onglet propre → rechargement', r.change === true && r.applique === true, JSON.stringify(r));
    v('  → l\'état importé porte bien la date cible',
       m.importes.length === 1 && m.importes[0].wealthGoals[0].date_cible === '2027-12',
       JSON.stringify(m.importes));
    await pause(320);                                   // > les 250 ms du rétablissement différé
    v('  → l\'onglet repasse « synced », pas « modified »', m.serverSyncStatus.value === 'synced', m.serverSyncStatus.value);
    v('  → l\'heure de synchro est rafraîchie', m.serverLastSync.value !== '');
    const r2 = await m.api.rafraichirDepuisServeur();
    v('  → un second appel ne recharge pas en boucle', r2.change === false && m.importes.length === 1);
}

// ── 3. LE VERROU : des saisies non sauvegardées interdisent l'écrasement.
{
    const m = monter({ corpsServeur: AVANT, statut: 'modified' });
    m.etatServeur.corps = APRES;
    const r = await m.api.rafraichirDepuisServeur();
    v('saisies locales en cours → AUCUN rechargement', r.change === true && r.applique === false, JSON.stringify(r));
    v('  → rien n\'est importé par-dessus la saisie', m.importes.length === 0);
    v('  → le bandeau d\'arbitrage s\'affiche', m.api.serveurDivergent.value === true);
    v('  → le journal nomme la raison',
       m.journal.some(([, msg]) => /non sauvegard/i.test(msg)), JSON.stringify(m.journal));
}

// ── 4. Le réseau tombe : on ne conclut rien, et surtout on n'efface rien.
{
    const m = monter({ corpsServeur: AVANT, echecReseau: true });
    const r = await m.api.rafraichirDepuisServeur();
    v('serveur injoignable → pas de conclusion hâtive', r.change === false && r.applique === false, JSON.stringify(r));
    v('  → rien n\'est importé', m.importes.length === 0);
    v('  → pas de bandeau trompeur', m.api.serveurDivergent.value === false);
}

// ── 5. Corps vide : une réponse vide n'est pas un état à charger.
//      C'est par ce chemin qu'un fichier serveur tronqué viderait l'écran.
{
    const m = monter({ corpsServeur: AVANT });
    m.etatServeur.corps = '   ';
    const r = await m.api.rafraichirDepuisServeur();
    v('corps serveur vide → l\'écran n\'est pas vidé', r.applique === false && m.importes.length === 0, JSON.stringify(r));
}

// ── 6. JSON illisible : on le dit, on ne l'applique pas.
{
    const m = monter({ corpsServeur: AVANT });
    m.etatServeur.corps = '{ceci n\'est pas du JSON';
    const r = await m.api.rafraichirDepuisServeur();
    v('JSON serveur corrompu → refus explicite', r.change === true && r.applique === false, JSON.stringify(r));
    v('  → l\'échec est journalisé', m.journal.some(([t]) => t === 'error'), JSON.stringify(m.journal));
}

// ── 7. Aucune référence (le chargement initial avait échoué) : on s'abstient.
{
    const m = monter({ corpsServeur: AVANT });
    m.api._poserSignature(null);
    m.etatServeur.corps = APRES;
    const r = await m.api.rafraichirDepuisServeur();
    v('aucune référence serveur → abstention', r.change === false && m.importes.length === 0, JSON.stringify(r));
    v('  → aucun appel réseau inutile', m.etatServeur.appels === 0, String(m.etatServeur.appels));
}

// ── 8. Le bandeau : l'utilisateur tranche, et « Annuler » protège sa saisie.
{
    const m = monter({ corpsServeur: AVANT, statut: 'modified', reponseConfirm: false });
    m.etatServeur.corps = APRES;
    await m.api.forcerRechargementServeur();
    v('bandeau + « Annuler » → la saisie locale survit', m.importes.length === 0);
}
{
    const m = monter({ corpsServeur: AVANT, statut: 'modified', reponseConfirm: true });
    m.etatServeur.corps = APRES;
    await m.api.forcerRechargementServeur();
    v('bandeau + « Confirmer » → le serveur l\'emporte',
       m.importes.length === 1 && m.importes[0].wealthGoals[0].date_cible === '2027-12', JSON.stringify(m.importes));
    await pause(320);
    v('  → le bandeau disparaît et l\'onglet est « synced »',
       m.api.serveurDivergent.value === false && m.serverSyncStatus.value === 'synced');
}

console.log('  ' + '─'.repeat(78));
console.log(ko ? `  ❌ ${ko} contrôle(s) en échec` : '  ✅ TOUT PASSE — 0 contrôle(s) en échec');
process.exit(ko ? 1 : 0);
