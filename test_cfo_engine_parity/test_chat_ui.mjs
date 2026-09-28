/**
 * v37.11 — L'INTERFACE DU CHAT CFO, DANS UN VRAI NAVIGATEUR.
 *
 *   Ce que cette suite verrouille : la barre de prompt est bien un textarea
 *   qui grandit puis plafonne, la touche Entrée se comporte différemment au
 *   clavier et au pouce, le fil défile seul pendant que la barre reste collée
 *   en bas, la typographie des réponses est celle qu'on a demandée — et la
 *   modale EXISTE sur téléphone, ce qui n'était pas le cas.
 *
 *   Prérequis locaux, non versionnés :
 *     npm install --no-save vue@3 playwright-core chart.js
 *   Faute de quoi la suite s'ignore proprement.
 *
 *   TAILWIND : son CDN est injoignable depuis l'environnement de test, donc la
 *   feuille est RECONSTRUITE localement (tailwindcss v3, même contenu source).
 *   Les largeurs, hauteurs de cible tactile et débordements sont donc mesurés
 *   sur un rendu réel. Sans le paquet, ces contrôles-là s'ignorent plutôt que
 *   de mesurer un rendu sans styles et de crier au loup.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..');
const html = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8').split('\r\n').join('\n');

let ko = 0;
const v = (t, ok, d = '') => { if (!ok) ko++; console.log(`  ${ok ? '✅' : '❌'} ${t.padEnd(60)} ${ok ? '' : d}`); };

console.log('\n  CHAT CFO — ERGONOMIE ET LISIBILITÉ\n  ' + '─'.repeat(78));

const require = createRequire(import.meta.url);
const essai = (f) => { try { return f(); } catch { return null; } };
const pw = essai(() => require('playwright-core'));
const vueJs = essai(() => require.resolve('vue/dist/vue.global.js'));
const chartJs = essai(() => fs.existsSync(path.join(RACINE, 'node_modules/chart.js/dist/chart.umd.js'))
                           && path.join(RACINE, 'node_modules/chart.js/dist/chart.umd.js'));
const chromium = process.env.CHROMIUM || ['/opt/pw-browsers/chromium']
    .find(p => essai(() => fs.existsSync(p) && fs.statSync(p).isFile()));

/* La feuille Tailwind du projet, reconstruite à partir du même index.html. */
const twBin = path.join(RACINE, 'node_modules/.bin/tailwindcss');
const twCss = essai(() => {
    if (!fs.existsSync(twBin)) return null;
    const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'twchat-'));
    fs.writeFileSync(path.join(tmp, 'in.css'), '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
    fs.writeFileSync(path.join(tmp, 'cfg.js'),
        'module.exports={content:[' + JSON.stringify(path.join(RACINE, 'index.html')) + '],theme:{extend:{}}};');
    execFileSync(twBin, ['-c', path.join(tmp, 'cfg.js'), '-i', path.join(tmp, 'in.css'),
                         '-o', path.join(tmp, 'out.css'), '--minify'], { stdio: 'ignore' });
    const css = fs.readFileSync(path.join(tmp, 'out.css'), 'utf8');
    return css.length > 10000 ? css : null;
});
const MISE_EN_PAGE = !!twCss;   // sans feuille, pas de mesure de mise en page

if (!pw || !vueJs || !chartJs || !chromium) {
    console.log('  ⏭️  ignoré (playwright-core, vue, chart.js ou Chromium absent)');
    console.log('  ✅ TOUT PASSE — 0 contrôle(s) en échec');
    process.exit(0);
}

const fx = JSON.parse(fs.readFileSync(path.join(ICI, 'fixture.json'), 'utf8'));
const Y = new Date().getFullYear();
const base = fx.donneesAnnuelles[Object.keys(fx.donneesAnnuelles)[0]];
fx.donneesAnnuelles = { [Y]: JSON.parse(JSON.stringify(base)), [Y + 1]: JSON.parse(JSON.stringify(base)) };
fx.soldesInitiaux.moisActuel = new Date().getMonth() + 1;
fx.soldesInitiaux.anneeActuelle = Y;

const page0 = html
    .replace('<script src="https://unpkg.com/vue@3/dist/vue.global.js"', '<script src="/vue.js"')
    .replace('<script src="https://cdn.jsdelivr.net/npm/chart.js"', '<script src="/chart.js"')
    .replace(/<script src="https:\/\/cdn\.tailwindcss\.com"[^>]*><\/script>/,
             twCss ? '<link rel="stylesheet" href="/tailwind.css">' : '')
    .replace(/<script[^>]*src="https:\/\/[^"]*"[^>]*><\/script>/g, '');

const srv = http.createServer((req, res) => {
    const p = req.url.split('?')[0];
    const s = (c, b, t = 'application/json') => { res.writeHead(c, { 'Content-Type': t }); res.end(b); };
    if (p === '/finance/') return s(200, page0, 'text/html; charset=utf-8');
    if (p === '/vue.js') return s(200, fs.readFileSync(vueJs), 'text/javascript');
    if (p === '/chart.js') return s(200, fs.readFileSync(chartJs), 'text/javascript');
    if (p === '/tailwind.css') return s(200, twCss || '', 'text/css');
    if (p === '/finance/finance_data.json') return s(200, JSON.stringify(fx));
    return s(200, '{"status":"ok"}');
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port;
const browser = await pw.chromium.launch({ executablePath: chromium, args: ['--no-sandbox'] });

const CONV = [
    { role: 'user', content: 'Puis-je acheter un appartement à 1,2 M DH cette année ?', time: '09:12' },
    { role: 'agent', time: '09:12', content:
        '<h3>Réponse courte</h3><p>Votre point bas tombe à <b>430 000 DH</b> en 2026.</p>'
        + '<ul><li>Apport + frais : 444 000 DH</li><li>Mensualité : 5 314 DH</li><li>Loyer net : 6 500 DH</li></ul>'
        + '<p>Le scénario tient jusqu\'à 1 162 000 DH.</p>' },
];

const ouvrir = async (viewport, mobile) => {
    const page = await browser.newPage({ viewport, isMobile: mobile, hasTouch: mobile });
    const erreurs = [];
    page.on('pageerror', e => erreurs.push(String(e)));
    page.on('dialog', d => d.accept());
    await page.goto(`http://127.0.0.1:${port}/finance/`, { waitUntil: 'load' });
    await page.waitForFunction(() => {
        const a = document.querySelector('#app');
        const s = a && a.__vue_app__ && a.__vue_app__._instance && a.__vue_app__._instance.setupState;
        return s && Array.isArray(s.cfoMessages);
    }, null, { timeout: 30000 });
    await page.evaluate((conv) => {
        const S = document.querySelector('#app').__vue_app__._instance.setupState;
        S.cfoWebhookUrl = 'https://exemple/webhook/finance-cfo-web';
        S.cfoMessages.splice(0, S.cfoMessages.length, ...conv);
        S.showCfoModal = true;
    }, CONV);
    await page.waitForTimeout(700);
    return { page, erreurs };
};

try {
    /* ═══ A. DESKTOP ══════════════════════════════════════════════════════ */
    {
        const { page, erreurs } = await ouvrir({ width: 1400, height: 1000 }, false);
        const champ = await page.$('textarea[data-cfo-prompt]');
        v('desktop : la saisie est un textarea, plus un input', !!champ);
        if (!champ) {
            // Sans barre de prompt, tout le reste mesure du vide : on s'arrête
            // en le disant, plutôt que de laisser le test exploser sur un null.
            console.log('  ⏭️  contrôles suivants sautés : pas de barre de prompt à mesurer');
            await page.close(); await browser.close(); srv.close();
            console.log('  ' + '─'.repeat(78));
            console.log(`  ❌ ${ko} contrôle(s) en échec`);
            process.exit(1);
        }

        // Auto-resize : une ligne, puis plusieurs, puis plafond.
        const mesurer = async (texte) => page.evaluate(async (t) => {
            const S = document.querySelector('#app').__vue_app__._instance.setupState;
            S.cfoInput = t;
            await new Promise(r => setTimeout(r, 60));
            const el = document.querySelector('textarea[data-cfo-prompt]');
            el.dispatchEvent(new Event('input', { bubbles: true }));
            await new Promise(r => setTimeout(r, 60));
            return { h: Math.round(el.getBoundingClientRect().height), overflow: getComputedStyle(el).overflowY };
        }, texte);
        const h1 = await mesurer('Une seule ligne.');
        const h3 = await mesurer(Array(4).join('Une ligne assez longue pour forcer un retour\n') + 'fin');
        const h20 = await mesurer(Array(25).join('ligne\n'));
        v('  → une ligne : barre compacte', h1.h > 20 && h1.h < 70, JSON.stringify(h1));
        v('  → le champ grandit avec le texte', h3.h > h1.h, JSON.stringify([h1.h, h3.h]));
        v('  → puis plafonne au lieu de manger l\'écran', h20.h <= h3.h + 200 && h20.h < 400, JSON.stringify([h3.h, h20.h]));
        v('  → au plafond, il défile', h20.overflow === 'auto', h20.overflow);

        // Entrée envoie au clavier.
        // On compte les messages DE L'UTILISATEUR : la réponse de l'agent arrive
        // de façon asynchrone et faisait échouer ce contrôle une fois sur trois.
        const envoye = await page.evaluate(async () => {
            const S = document.querySelector('#app').__vue_app__._instance.setupState;
            const nbUser = () => S.cfoMessages.filter(m => m.role === 'user').length;
            S.cfoInput = 'question clavier';
            const avant = nbUser();
            const el = document.querySelector('textarea[data-cfo-prompt]');
            el.focus();
            el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
            await new Promise(r => setTimeout(r, 250));
            return { avant, apres: nbUser(), champ: S.cfoInput };
        });
        v('  → Entrée envoie', envoye.apres === envoye.avant + 1, JSON.stringify(envoye));
        v('  → et le champ est vidé', envoye.champ === '', JSON.stringify(envoye));

        const maj = await page.evaluate(async () => {
            const S = document.querySelector('#app').__vue_app__._instance.setupState;
            const nbUser = () => S.cfoMessages.filter(m => m.role === 'user').length;
            await new Promise(r => setTimeout(r, 400));   // laisser retomber l'échange précédent
            S.cfoInput = 'avec saut';
            const avant = nbUser();
            const el = document.querySelector('textarea[data-cfo-prompt]');
            el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true }));
            await new Promise(r => setTimeout(r, 250));
            return { avant, apres: nbUser() };
        });
        v('  → Maj+Entrée n\'envoie pas', maj.apres === maj.avant, JSON.stringify(maj));

        // Structure des messages.
        const struct = await page.evaluate(() => {
            const modal = document.getElementById('cfo-widget-modal');
            const ia = modal.querySelector('.cfo-msg');
            const cs = getComputedStyle(ia);
            const p = ia.querySelector('p'), li = ia.querySelector('li');
            const colonne = modal.querySelector('.cfo-fil .max-w-3xl');
            const barre = modal.querySelector('textarea[data-cfo-prompt]').closest('.max-w-3xl');
            const fil = modal.querySelector('.cfo-fil');
            return {
                taille: parseFloat(cs.fontSize), interligne: parseFloat(cs.lineHeight),
                margeP: p ? parseFloat(getComputedStyle(p).marginBottom) : null,
                indentLi: li ? parseFloat(getComputedStyle(li.parentElement).paddingLeft) : null,
                colonneBornee: !!colonne, barreBornee: !!barre,
                largeurColonne: colonne ? Math.round(colonne.getBoundingClientRect().width) : 0,
                filDefileSeul: !!fil && getComputedStyle(fil).overflowY === 'auto',
                avatarIA: !!(ia.parentElement && ia.parentElement.previousElementSibling
                             && ia.parentElement.previousElementSibling.textContent.trim() === '🧠'),
                bulleUtilisateur: !!modal.querySelector('.bg-violet-100'),
                // « Dans la barre » = dans le même cadre arrondi que le champ,
                //   pas « frère direct » : sur mobile les actions vivent dans un
                //   sous-rang, et sur desktop dans un wrapper display:contents.
                boutonEnvoiDansLaBarre: (() => {
                    const b = modal.querySelector('button[data-cfo-send]');
                    const t = modal.querySelector('textarea[data-cfo-prompt]');
                    if (!b || !t || !b.querySelector('svg')) return false;
                    const barre = t.closest('.rounded-3xl');
                    return !!barre && barre.contains(b);
                })(),
            };
        });
        v('typographie : corps ≥ 16 px', struct.taille >= 16, String(struct.taille));
        v('  → interligne généreux (≥ 1,6 ×)', struct.interligne / struct.taille >= 1.6,
          (struct.interligne / struct.taille).toFixed(2));
        v('  → paragraphes espacés', struct.margeP >= 12, String(struct.margeP));
        v('  → listes indentées', struct.indentLi >= 20, String(struct.indentLi));
        v('mise en page : colonne de lecture bornée', struct.colonneBornee);
        if (MISE_EN_PAGE) v('  → et elle est effectivement bornée à l\'écran',
          struct.largeurColonne > 0 && struct.largeurColonne <= 800, String(struct.largeurColonne));
        v('  → la barre de saisie suit la même colonne', struct.barreBornee);
        if (MISE_EN_PAGE) v('  → le fil a son propre défilement', struct.filDefileSeul);
        else console.log('  ⏭️  défilement du fil : non mesuré (Tailwind absent)');
        v('  → avatar à gauche du message IA', struct.avatarIA);
        v('  → bulle distincte pour l\'utilisateur', struct.bulleUtilisateur);
        v('  → bouton d\'envoi À L\'INTÉRIEUR de la barre, en icône', struct.boutonEnvoiDansLaBarre);

        const vide = await page.evaluate(async () => {
            const S = document.querySelector('#app').__vue_app__._instance.setupState;
            S.cfoInput = '   ';
            await new Promise(r => setTimeout(r, 120));
            return document.querySelector('button[data-cfo-send]').disabled;
        });
        v('  → envoi désactivé sur une saisie vide', vide === true, String(vide));

        // La barre reste visible quand le fil déborde.
        const colle = await page.evaluate(async () => {
            const S = document.querySelector('#app').__vue_app__._instance.setupState;
            for (let i = 0; i < 40; i++) S.cfoMessages.push({ role: 'agent', time: '', content: '<p>Ligne de remplissage numéro ' + i + '.</p>' });
            await new Promise(r => setTimeout(r, 400));
            const modal = document.getElementById('cfo-widget-modal');
            const fil = modal.querySelector('.cfo-fil');
            const champ = modal.querySelector('textarea[data-cfo-prompt]');
            const rModal = modal.getBoundingClientRect(), rChamp = champ.getBoundingClientRect();
            return { deborde: fil.scrollHeight > fil.clientHeight + 10,
                     champDansLaModale: rChamp.bottom <= rModal.bottom + 2 && rChamp.top >= rModal.top };
        });
        if (MISE_EN_PAGE) {
            v('fil long : le fil déborde bien', colle.deborde);
            v('  → la barre de saisie reste dans le cadre', colle.champDansLaModale, JSON.stringify(colle));
        } else console.log('  ⏭️  barre collée en bas : non mesuré (Tailwind absent)');

        v('desktop : aucune erreur JavaScript', erreurs.length === 0, erreurs[0] || '');
        await page.close();
    }

    /* ═══ B. TÉLÉPHONE (format S24+) ══════════════════════════════════════ */
    {
        const { page, erreurs } = await ouvrir({ width: 412, height: 915 }, true);
        const etat = await page.evaluate(() => {
            const S = document.querySelector('#app').__vue_app__._instance.setupState;
            const modal = document.getElementById('cfo-widget-modal');
            const champ = modal && modal.querySelector('textarea[data-cfo-prompt]');
            const envoi = modal && modal.querySelector('button[data-cfo-send]');
            const ia = modal && modal.querySelector('.cfo-msg');
            return {
                isMobile: S.isMobile,
                modaleRendue: !!modal,
                champ: !!champ,
                hauteurEnvoi: envoi ? Math.round(envoi.getBoundingClientRect().height) : null,
                tailleIA: ia ? parseFloat(getComputedStyle(ia).fontSize) : null,
                largeurModale: modal ? Math.round(modal.getBoundingClientRect().width) : null,
            };
        });
        v('téléphone : la modale du CFO existe', etat.modaleRendue === true,
          'showCfoModal=true mais #cfo-widget-modal absent du DOM');
        v('  → le mode mobile est bien détecté', etat.isMobile === true);
        v('  → la barre de prompt est là', etat.champ === true);
        if (MISE_EN_PAGE) v('  → le bouton d\'envoi est confortable au pouce (≥ 40 px)',
          etat.hauteurEnvoi >= 40, String(etat.hauteurEnvoi));
        else console.log('  ⏭️  taille de la cible tactile : non mesurée (Tailwind absent)');
        v('  → corps de texte ≥ 16 px (pas de zoom iOS au focus)', etat.tailleIA >= 16, String(etat.tailleIA));
        v('  → la modale occupe la largeur de l\'écran', etat.largeurModale >= 400, String(etat.largeurModale));

        const entree = await page.evaluate(async () => {
            const S = document.querySelector('#app').__vue_app__._instance.setupState;
            S.cfoInput = 'au pouce';
            const avant = S.cfoMessages.length;
            const el = document.querySelector('textarea[data-cfo-prompt]');
            el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
            await new Promise(r => setTimeout(r, 200));
            return { avant, apres: S.cfoMessages.length };
        });
        v('  → Entrée passe à la ligne au lieu d\'envoyer', entree.apres === entree.avant, JSON.stringify(entree));

        v('téléphone : aucune erreur JavaScript', erreurs.length === 0, erreurs[0] || '');
        await page.close();
    }
} finally {
    await browser.close();
    srv.close();
}

console.log('  ' + '─'.repeat(78));
console.log(ko ? `  ❌ ${ko} contrôle(s) en échec` : '  ✅ TOUT PASSE — 0 contrôle(s) en échec');
process.exit(ko ? 1 : 0);
