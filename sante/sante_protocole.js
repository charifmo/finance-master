/*  Santé Master — RANGER UN PROTOCOLE (PDF, Word, photo, texte) EN : cases du jour, suppléments, règles, objectifs, ignoré.
    Aucune structure attendue : les règles s'appuient sur des indices présents dans tout document —
      • lignes : une phrase coupée par la mise en page est recollée (minuscule en tête, ligne précédente non finie,
        suite d'une puce) ;
      • titres : numérotés (« 3. … »), à emoji, en majuscules, courts et sans point ; un titre avec un moment ou une
        heure (« Réveil », « 17h00 — … », « Dîner 19h30 ») fixe le moment des lignes suivantes ;
      • action à cocher : ligne courte avec quantité / durée ou geste (marche, gélules, brossage…), libellé = la partie
        en gras (séparée par des espaces) ou la première phrase, le reste en détail ;
      • repas : les aliments d'un même repas forment UNE case (« Petit-déjeuner »), le menu en détail ;
      • règle : « jamais, éviter, zéro, pas de, si… », avertissements (⚠) ; explication : « pourquoi », définitions,
        phrases descriptives — rattachées en détail à l'action qu'elles expliquent ;
      • fréquence : jours nommés (« lundi + jeudi »), « 1 fois par semaine / par mois » ;
      • tableaux (colonnes) : suppléments (Produit / Dose / Heure), objectifs (Marqueur / Départ / Cible) ;
      • doublons fusionnés ; les LEÇONS apprises des corrections passées s'appliquent en dernier.
    Navigateur : window.SanteProtocole ; Node : require('./sante_protocole.js'). */
(function (racine, fabrique) {
    if (typeof module === 'object' && module.exports) module.exports = fabrique();
    else racine.SanteProtocole = fabrique();
})(typeof self !== 'undefined' ? self : this, function () {
    const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/œ/g, 'oe')
        .replace(/[’']/g, ' ').replace(/[^a-z0-9%<>.,/+\- ]+/g, ' ').replace(/\s+/g, ' ').trim();
    const unifier = (t) => String(t || '').replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, (c) => c === '\u2014' || c === '\u2013' ? '—' : '-')
        .replace(/[\u00A0\u202F\u2007]/g, ' ').replace(/\u00AD/g, '');
    const cle = (s) => norm(s).slice(0, 120);
    const MOMENTS = [['reveil', 'Réveil'], ['matin', 'Matin'], ['petit_dejeuner', 'Petit-déjeuner'], ['dejeuner', 'Déjeuner'], ['apres_midi', 'Après-midi'],
                     ['collation', 'Collation'], ['diner', 'Dîner'], ['soir', 'Soir'], ['coucher', 'Coucher'], ['journee', 'Toute la journée']];
    const LIB = Object.fromEntries(MOMENTS);
    const REPAS = ['petit_dejeuner', 'dejeuner', 'collation', 'diner'];
    const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
    const MOTS_MOMENT = [[/^(?:au )?r[eé]veil|^lever\b/i, 'reveil'], [/^petit[- ]?d[eé]j/i, 'petit_dejeuner'], [/^(?:d[eé]jeuner|midi)\b/i, 'dejeuner'],
        [/^(?:collation|go[uû]ter|en[- ]cas|pare[- ]feu|snack)/i, 'collation'], [/^apr[eè]s[- ]midi/i, 'apres_midi'], [/^(?:d[iî]ner|souper)\b/i, 'diner'],
        [/^soir(?:[eé]e)?\b/i, 'soir'], [/^(?:coucher|nuit|avant de dormir)/i, 'coucher'], [/^matin(?:[eé]e)?\b/i, 'matin'],
        [/^(?:toute la journ[eé]e|dans la journ[eé]e|au quotidien|chaque jour)/i, 'journee']];
    const RE_HEURE = /(?:^|\s|—)(\d{1,2})\s*h\s*(\d{2})?(?![a-z])/i;
    const momentDeLHeure = (h) => h < 5 ? 'coucher' : h < 10 ? 'matin' : h < 12 ? 'matin' : h < 15 ? 'dejeuner' : h < 19 ? 'collation' : h < 21 ? 'diner' : h < 22 ? 'soir' : 'coucher';
    const RE_QTE = /\d+(?:[.,]\d+)?\s*(?:g|mg|µg|ug|ml|cl|l|kcal|min|minutes?|h|s|cp|caps?|capsules?|g[eé]lules?|comprim[eé]s?|ampoules?|c\.|cuill|verres?|pas|s[eé]ries?|x|×|%)\b|\d+\s*(?:x|×)\s*\d+/i;
    const RE_GESTE = /\b(?:march|promen|brossage|dents|g[eé]lules?|comprim|capsules?|suppl[eé]ment|repos|douche|kegel|s[eé]ances?|[eé]tirement|respir|m[eé]dit|pes[eé]e|peser|mesurer|boire|prendre|faire|v[eé]lo|nage|course|squat|pompes|soleus)\w*/i;
    const RE_REGLE = /^(?:z[eé]ro|jamais|ne jamais|ne pas|ne rien|pas de|pas d[’']|aucune?|[eé]viter|[eé]vitez|interdit|surtout pas|proscrire|limiter|stop)(?![a-z])/i;
    const RE_INFO = /^(?:le|la|les|l[’']|ce|cet|cette|ces|c[’']est|il|elle|ils|elles|je|j[’']|on|cela|ceci|en effet|bonus|note|nb|remarque|à savoir|a savoir|rep[eè]re|car|parce|pourquoi|explication)\b/i;
    const RE_FREQ = /\b(\d+|une?)\s*(?:fois|x)\s*(?:par|\/)\s*(semaine|mois)\b/i;
    const RE_LIMITE = /\b(?:maximum|max\b|au plus|pas plus|au maximum|au-del[aà])/i;
    const premierePhrase = (s) => { const m = /^(.{12,140}?[.!?])(\s+|$)(.*)$/.exec(s); return m ? [m[1].replace(/[.!]$/, ''), m[3].trim()] : [s, '']; };
    const propre = (s) => String(s || '').replace(/\s+/g, ' ').replace(/\s*[:;,]\s*$/, '').replace(/^(?:[—–:,\s]|-(?!\d))+/, '').trim();
    const majuscule = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
    const motsDe = (s) => new Set(norm(s).replace(/minutes?/g, 'min').split(/[^a-z0-9]+/).filter(w => w.length > 1 && !['de', 'du', 'des', 'la', 'le', 'les', 'en', 'et', 'au', 'aux', 'un', 'une', 'a', 'par', 'pour', 'avec', 'sur'].includes(w)));
    //  doublon : presque tous les mots du plus court dans le plus long, ET au moins la moitié de ceux du plus long
    const recouvre = (a, b) => { const A = motsDe(a), B = motsDe(b); if (A.size < 3 || B.size < 3) return 0; let n = 0; A.forEach(w => { if (B.has(w)) n++; }); return n / Math.max(A.size, B.size) >= 0.5 ? n / Math.min(A.size, B.size) : 0; };

    //  ── 1. lignes « logiques » : puces, emoji, avertissements, segments (colonnes ou partie en gras), phrases recollées
    function preparer(brute) {
        const txt = unifier(brute).trim();
        if (!txt) return null;
        let s = txt, puce = false, emoji = '', avert = false;
        const mP = /^(?:[•●▪◦►✓✔☐□*–·]|-(?=\s))\s*/.exec(s);
        if (mP) { puce = true; s = s.slice(mP[0].length); }
        if (/^[⚠❗‼]/u.test(s)) { avert = true; s = s.replace(/^[⚠❗‼]\uFE0F?\s*/u, ''); }
        else { const mE = /^(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})[\uFE0F\u200D\p{Extended_Pictographic}\p{Emoji_Presentation}]*\s*/u.exec(s); if (mE && !/^\d/.test(s)) { emoji = mE[0].trim(); s = s.slice(mE[0].length); } }
        const segs = s.split(/\s{2,}|\t+/).map(x => x.trim()).filter(Boolean);
        return { brut: txt, s: s.replace(/\s{2,}|\t+/g, '   ').trim(), segs, puce, avert, emoji };
    }
    const aChapeau = (p) => p.segs.length >= 2 || /^[^:]{2,45}\s:\s/.test(p.s);
    const estSection = (p) => !p.puce && !p.emoji && /^(\d{1,2})[.)]\s+(\S[^:]{1,78})$/.test(p.s) && !RE_QTE.test(p.s.replace(/^\d{1,2}[.)]\s+/, ''));
    const majusculesEnTete = (s) => { const m = /^[A-ZÀ-ÖØ-Þ0-9'’\-\/ ]+(?=\s|$|\()/.exec(s); return !!m && m[0].replace(/[^A-ZÀ-ÖØ-Þ]/g, '').length >= 4; };
    const RE_QTE_TITRE = /\d+(?:[.,]\d+)?\s*(?:g|mg|ml|kcal|min|minutes|cp|caps|capsules|g[eé]lules?|comprim[eé]s?|ampoules?|pas|%)\b/i;
    const estTitre = (p) => !p.puce && !p.avert && p.s.length <= 90 && p.segs.length < 2 && !/[.;,!?]$/.test(p.s)
        && (!RE_QTE_TITRE.test(p.s) || majusculesEnTete(p.s) || !!p.emoji || RE_HEURE.test(p.s.slice(0, 12)));
    const RE_PIED = /^(?:page\s+)?\d+\s*(?:\/\s*\d+)?$|^document personnel|ne remplace pas (?:le|l[’'])|^bilan complet [aà] refaire/i;
    function lignesLogiques(texte) {
        const out = [];
        let vide = false;                                   // une ligne vide termine toujours un paragraphe (documents Word)
        unifier(texte).split(/\r?\n/).forEach(brute => {
            const p = preparer(brute); if (!p) { vide = true; return; }
            const apresVide = vide; vide = false;
            if (RE_PIED.test(p.s)) { p.pied = true; out.push(p); return; }
            const prev = out[out.length - 1];
            const suite = prev && !apresVide && !prev.pied && !p.puce && !p.emoji && !p.avert && !estSection(p) && !prev.section && (
                /^[a-zà-öø-ÿœ(—–«"]/.test(p.s)
                || (!/[.!?:;»)]$/.test(prev.s) && !estTitre(prev) && !estTitre(p) && prev.segs.length < 3 && !aChapeau(p))
                || ((prev.puce || prev.avert) && !aChapeau(p) && !estTitre(p) && p.segs.length < 3));
            if (suite) { const sep = /[a-zà-ÿ]-$/.test(prev.s) && /^[a-zà-ÿ]/.test(p.s) ? '' : ' '; prev.s += sep + p.s; prev.segs[prev.segs.length - 1] += sep + p.s; prev.brut += sep + p.brut; return; }
            p.section = estSection(p);
            out.push(p);
        });
        return out;
    }

    //  ── 2. le moment d'un titre (« Réveil », « 17h00 — Pare-feu », « Dîner 19h30 ») ; null si ce n'est pas un titre de moment
    function momentDuTitre(s) {
        const t = s.replace(/^[^A-Za-zÀ-ÿ0-9]+/, '');
        const mh = RE_HEURE.exec(t.slice(0, 18));
        const heure = mh ? String(mh[1]).padStart(2, '0') + ':' + (mh[2] || '00') : null;
        const parties = t.split(/\s+[—|]\s+|\s+-\s+/).map(x => x.trim()).filter(Boolean);
        let moment = null;
        for (const x of parties.concat([t])) { const y = x.replace(/^\d{1,2}\s*h\s*\d{0,2}\s*/i, ''); const m = MOTS_MOMENT.find(([re]) => re.test(y)); if (m) { moment = m[1]; break; } }
        if (!moment && !heure) return null;
        if (!moment) moment = momentDeLHeure(Number(mh[1]));
        const GENERIQUE = /^(?:au )?(?:r[eé]veil|petit[- ]?d[eé]jeuner|d[eé]jeuner|collation|d[iî]ner|souper|coucher|matin|soir|midi|nuit)\b(?:\s+\d{1,2}\s*h\s*\d{0,2})?$/i;
        const nom = parties.filter(x => !/^\d{1,2}\s*h\s*\d{0,2}$/i.test(x) && !GENERIQUE.test(x) && !/kcal|prot[eé]ines|^\W*$/i.test(x)).join(' — ');
        const info = parties.filter(x => /kcal|prot[eé]ines/i.test(x)).join(' · ').replace(/\s*\|\s*/g, ' · ');
        return { moment, heure, nom, info };
    }
    const catSection = (t) => {
        const n = norm(t);
        if (/sommaire|table des matieres/.test(n)) return 'ignorer';
        if (/complement|supplement|micronutri/.test(n)) return 'supplements';
        if (/\bkpi\b|indicateurs? de suivi|bilan a \d|objectifs? biolog|resultats? attendus|\bcibles?\b/.test(n)) return 'objectifs';
        if (/parametre|contexte|profil|introduction/.test(n)) return 'regles';
        if (/journee|heure par heure|planning|programme|routine|emploi du temps|semaine type|activite|exercice|sport|entrainement|musculation|renforcement|menus?\b/.test(n)) return 'actions';
        if (/aliment|nutrition|regle|grignotage|levier|conseil|astuce|psycholog|environnement|vigilance|securite|precaution|attention|a eviter|interdit/.test(n)) return 'regles';
        return 'auto';
    };
    const catSousTitre = (t) => {
        const n = norm(t);
        if (/^pourquoi\b/.test(n)) return 'explication';
        if (/synthese|vue rapide|recapitulatif|tableau/.test(n)) return 'synthese';
        if (/regles?|securite|precaution|attention|vigilance|a eviter|interdit|ecartes?|exclu|surveiller|prioritaire|de fond|autorise|a demander|prochain bilan/.test(n)) return 'regles';
        if (/quotidien|socle|routine|seances?|renforcement|musculation|programme|entrainement|cardio/.test(n)) return 'actions';
        return null;
    };
    const momentDuTexte = (s, defaut) => {
        const n = norm(s);
        if (/par jour|au total|dans la journee|chaque jour|plusieurs fois/.test(n)) return 'journee';
        if (/au reveil|reveil/.test(n)) return 'reveil';
        if (/\ble matin\b|a jeun le matin|matinal/.test(n)) return 'matin';
        if (/apres le dejeuner|au dejeuner|avant le dejeuner/.test(n)) return 'dejeuner';
        if (/apres le diner|au diner|le soir\b/.test(n)) return 'diner';
        if (/au coucher|avant de dormir/.test(n)) return 'coucher';
        if (/par jour|au total|dans la journee|chaque jour|plusieurs fois/.test(n)) return 'journee';
        return defaut || 'journee';
    };
    const joursDe = (s) => { const n = norm(s); const j = JOURS.filter(d => new RegExp('\\b' + d + '\\b').test(n)); return j.length && j.length < 7 ? j : null; };
    const dureeDe = (s) => { const n = norm(s); const h = /(\d+)\s*h\s*(\d{1,2})?\b/.exec(n), m = /(\d+)\s*(?:-\s*\d+\s*)?(?:min|mn)\b/.exec(n); const d = (h && !/\d+\s*h\s*\d{0,2}\s*:/.test(n) ? Number(h[1]) * 60 + Number(h[2] || 0) : 0) + (m ? Number(m[1]) : 0); return d > 0 && d <= 600 ? d : null; };

    //  ── 3. le rangement
    function analyser(texte, options) {
        const o = options || {};
        const lignes = lignesLogiques(texte);
        const elements = [];
        let titre = '', aSections = lignes.some(p => p.section), enTete = aSections;
        let section = { titre: '', cat: aSections ? 'ignorer' : 'auto' }, sous = null;
        let moment = null, heure = null, info = '', nomMoment = '', repas = null, derniere = null, supp = null, enTeteTable = null;
        let n = 0;
        const id = () => 'p' + (++n).toString(36) + Math.random().toString(36).slice(2, 6);
        const lieu = () => [section.titre, sous && sous.titre].filter(Boolean).join(' — ');
        const ajouter = (e) => { e.id = id(); e.cle = e.cle || cle(e.ligne || e.texte || e.nom || e.libelle); elements.push(e); return e; };
        const regle = (texte, ligne, raison) => ajouter({ bucket: 'regle', texte: propre(texte), section: lieu() || 'Règles', ligne, raison });
        const ignorer = (texte, raison) => ajouter({ bucket: 'ignorer', texte: propre(texte), ligne: texte, raison });
        const ajouterDetail = (cible, txt) => { cible.detail = (cible.detail ? cible.detail + '\n' : '') + propre(txt); };
        const action = (texte, ligne, extra) => {
            let t = propre(texte).replace(/\.$/, ''); if (!t) return null;
            if (/^\d+\s*s[eé]ances?\b/i.test(t) && sous && sous.titre && !(extra && extra.repas)) t = propre(sous.titre.split(/\s+—\s+/)[0]) + ' : ' + t;
            const e = Object.assign({ bucket: 'action', texte: t, detail: '', moment: moment || momentDuTexte(ligne, 'journee'), heure: heure || null, ligne, raison: 'action', deduit: !moment }, extra || {});
            if (!e.jours) { const j = joursDe(ligne); if (j) e.jours = j; }
            if (!e.frequence) { const f = RE_FREQ.exec(norm(ligne)); if (f && !e.jours && !RE_LIMITE.test(ligne)) e.frequence = f[2] === 'mois' ? 'mois' : 'semaine'; }
            if (e.duree_min === undefined) { const d = dureeDe(t); if (d) e.duree_min = d; }
            //  doublon (la même marche citée dans « la journée » et dans « activité ») : on complète l'existant
            //  …et seulement entre moments compatibles : deux actions placées par leurs titres à des moments différents restent deux
            const double = elements.find(x => x.bucket === 'action' && !x.repas && recouvre(x.texte, e.texte) >= 0.75 && (x.moment === e.moment || x.deduit || e.deduit));
            if (double) { if (e.detail) ajouterDetail(double, e.detail); double.ligne = double.ligne || ligne; derniere = double; return double; }
            derniere = ajouter(e); return derniere;
        };
        //  libellé (partie en gras ou première phrase) / détail (le reste) ; une heure en tête (« 12h30 : ») devient l'heure
        const decouper = (p) => {
            let s = p.s, h = null;
            const mh = /^(\d{1,2})\s*h\s*(\d{2})?\s*:?\s+/i.exec(s);
            if (mh) { h = String(mh[1]).padStart(2, '0') + ':' + (mh[2] || '00'); s = s.slice(mh[0].length); }
            const segs = s.split(/\s{3,}/).map(x => x.trim()).filter(Boolean);
            let lib, det;
            if (segs.length >= 2 && segs[0].length <= 120) { lib = segs[0]; det = segs.slice(1).join(' '); if (/:\s*$/.test(lib) && lib.split(/\s+/).length <= 4 && det.length <= 120) { lib = lib.replace(/\s*:\s*$/, '') + ' : ' + premierePhrase(det)[0]; det = premierePhrase(det)[1]; } }
            else { [lib, det] = premierePhrase(s.replace(/\s{3,}/g, ' ')); }
            if (lib.length > 140) { det = lib.slice(140) + ' ' + det; lib = lib.slice(0, 140); }
            return { lib: propre(lib), det: propre(det), heure: h };
        };
        const cellules = (p) => p.s.split(/\s{3,}/).map(x => x.trim()).filter(Boolean);
        const estEnTeteTable = (c) => c.length >= 2 && c.every(x => x.length <= 28 && !/\d/.test(x));

        for (const p of lignes) {
            //  sections numérotées
            if (p.section) {
                const t = p.s.replace(/^\d{1,2}[.)]\s+/, '');
                section = { titre: t, cat: catSection(t) }; sous = null; moment = null; heure = null; repas = null; derniere = null; supp = null; enTeteTable = null; enTete = false;
                if (/r[eè]gle d[ue]s? (.{3,60})$/i.test(t) && section.cat === 'regles') { const m = /r[eè]gle d[ue]s? (.{3,60})$/i.exec(t); action(majuscule(m[1]) + ' respecté', t, { moment: 'journee', raison: 'règle quotidienne' }); }
                continue;
            }
            if (enTete) { if (!titre) titre = p.s; else ignorer(p.s, 'en-tête du document'); continue; }
            if (!titre && !aSections && estTitre(p) && !momentDuTitre(p.s)) { titre = p.s; continue; }
            if (p.pied) { ignorer(p.s, 'pied de page'); continue; }
            const cat = section.cat;
            if (cat === 'ignorer') { ignorer(p.s, 'sommaire'); continue; }

            //  titres (emoji, majuscules, courts) : moment, sous-partie, produit
            if ((p.emoji || estTitre(p)) && !p.avert) {
                const m = (cat === 'actions' || cat === 'auto') ? momentDuTitre(p.s) : null;
                if (m) { moment = m.moment; heure = m.heure; nomMoment = m.nom; info = m.info; repas = null; derniere = null; sous = null; continue; }
                if (cat === 'supplements' && majusculesEnTete(p.s) && !/^(?:POURQUOI|COMBIEN|QUAND)\b/.test(p.s) && !(sous && sous.cat === 'synthese')) {
                    supp = ajouter({ bucket: 'supplement', nom: propre(p.s), dose: '', quand: '', pourquoi: '', notes: '', ligne: p.s, raison: 'fiche produit' }); continue;
                }
                sous = { titre: propre(p.s), cat: catSousTitre(p.s) }; enTeteTable = null;
                if (sous.cat === 'actions' || sous.cat === 'regles' || /semaine|hebdo|\bmois\b|chaque|quotidien|toute la journ/i.test(p.s)) { moment = null; heure = null; }
                if (/s[eé]quen/i.test(p.s) && repas) repas.sequence = true;
                if (sous.cat === 'actions' || sous.cat === 'regles' || sous.cat === 'explication') { if (!/s[eé]quen/i.test(p.s)) { repas = null; derniere = sous.cat === 'actions' ? null : derniere; } }
                continue;
            }
            const sc = sous && sous.cat;

            //  ── objectifs : un tableau Marqueur / Départ / Cible
            if (cat === 'objectifs' && sc !== 'regles') {
                const c = cellules(p);
                if (c.length >= 2) {
                    if (c.every(x => x.length <= 28) && c.filter(x => /^(?:marqueur|indicateur|param[eè]tre|d[eé]part|actuel|cible|objectif|r[eé]sultat|valeur)/i.test(x)).length >= 2) { ignorer(p.s, 'en-tête de tableau'); continue; }
                    const cibleTxt = c.slice(1).find(x => /[<>≤≥]\s*\d|^[+-]\s*\d|en (?:hausse|baisse)|[aà] doser|maintenir/i.test(x)) || c[2] || c[1];
                    ajouter({ bucket: 'objectif', libelle: propre(c[0]), depart: c.length >= 3 ? propre(c[1]) : '', cible: propre(String(cibleTxt).replace(/_{2,}.*$/, '')), ligne: p.s, raison: 'tableau d’objectifs' });
                    continue;
                }
                regle(p.s, p.s, 'note d’objectifs'); continue;
            }

            //  ── suppléments : fiches (POURQUOI / COMBIEN / QUAND), produits écartés, tableau de synthèse
            if (cat === 'supplements') {
                const c = cellules(p);
                if (sc === 'synthese' && c.length >= 3) {
                    if (enTeteTable === null && estEnTeteTable(c)) { enTeteTable = c; ignorer(p.s, 'en-tête de tableau'); continue; }
                    const [quand, produit, dose, avec] = c;
                    if (/rien/i.test(produit) || /^—*$/.test(produit)) { regle(quand + ' : ' + (avec || produit).replace(/—/g, '').trim() + ' — rien à prendre', p.s, 'fenêtre sans prise'); continue; }
                    const k = cle(produit).split(' ').filter(w => w.length > 2 && w !== 'hcl')[0] || cle(produit);
                    let s0 = elements.find(x => x.bucket === 'supplement' && cle(x.nom).replace(/^l /, '').includes(k));
                    const momentTxt = propre([quand, avec].filter(Boolean).join(' · '));
                    if (!s0) s0 = ajouter({ bucket: 'supplement', nom: propre(produit), dose: propre(dose), quand: momentTxt, pourquoi: '', notes: '', ligne: p.s, raison: 'tableau de synthèse' });
                    else { if (!s0.dose) s0.dose = propre(dose); s0.prises = (s0.prises ? s0.prises + ' + ' : '') + momentTxt; }
                    if (/par mois|\/\s*mois|mensuel|x\s*\/\s*mois|1x\/mois/i.test(quand)) action(propre(produit) + ' : ' + propre(dose) + (avec ? ' (' + propre(avec) + ')' : ''), p.s, { moment: 'journee', heure: null, frequence: 'mois', raison: 'prise mensuelle' });
                    continue;
                }
                if (sc === 'regles' && c.length >= 2) {
                    if (estEnTeteTable(c)) { ignorer(p.s, 'en-tête de tableau'); continue; }
                    regle((sous && /[eé]cart|exclu/i.test(sous.titre) ? 'Écarté — ' : '') + c[0] + ' : ' + c.slice(1).join(' '), p.s, 'produit écarté'); continue;
                }
                const mC = /^(POURQUOI|COMBIEN|QUAND|DOSE|POSOLOGIE|MOMENT)\b\s*:?\s*(.*)$/i.exec(p.s);
                if (mC && supp) {
                    const champ = /pourquoi/i.test(mC[1]) ? 'pourquoi' : /combien|dose|posologie/i.test(mC[1]) ? 'dose' : 'quand';
                    const [prem, reste] = premierePhrase(propre(mC[2]));
                    if (champ === 'pourquoi') supp.pourquoi = propre(mC[2]).slice(0, 400);
                    else { supp[champ] = prem; if (reste) supp.notes = (supp.notes ? supp.notes + ' ' : '') + reste; }
                    continue;
                }
                if (supp && !sc) { supp.notes = (supp.notes ? supp.notes + ' ' : '') + (p.avert ? '⚠ ' : '') + propre(p.s); continue; }
                if (p.avert || RE_REGLE.test(p.s)) { regle(p.s, p.s, 'précaution'); continue; }
                ignorer(p.s, 'explication'); continue;
            }

            //  ── règles : tout est à relire, sauf les gestes périodiques explicites (« se peser 1 fois par semaine »)
            if (cat === 'regles' || sc === 'regles' || sc === 'explication') {
                if (sc === 'explication') { ignorer(p.s, 'explication'); continue; }
                const f = RE_FREQ.exec(norm(p.s));
                if (f && !RE_LIMITE.test(p.s) && RE_GESTE.test(p.s.slice(0, 40))) { const d = decouper(p); action(d.lib, p.s, { moment: 'journee', heure: null, detail: d.det, frequence: f[2] === 'mois' ? 'mois' : 'semaine', raison: 'geste périodique' }); continue; }
                const c = cellules(p);
                regle(c.length >= 3 ? c[0] + ' : ' + c.slice(1).join(' · ') : p.s, p.s, p.avert ? 'avertissement' : 'règle'); continue;
            }

            //  ── la journée / l'activité (ou un document sans sections)
            const c = cellules(p);
            if (c.length >= 3 && !p.puce) { if (derniere) { if (!estEnTeteTable(c)) ajouterDetail(derniere, c.join(' · ')); } else ignorer(p.s, 'tableau'); continue; }
            if (p.avert) { regle(p.s, p.s, 'avertissement'); continue; }
            const d = decouper(p);
            if (/^si\b/i.test(d.lib) || RE_REGLE.test(d.lib)) { regle(p.s, p.s, 'condition / interdit'); continue; }
            if (/^(?:suppl[eé]ments?|compl[eé]ments?)\b/i.test(d.lib)) { action(d.lib + (d.det && !/:/.test(d.lib) ? ' : ' + d.det : ''), p.s, { heure: d.heure || heure, raison: 'prise de suppléments' }); continue; }
            //  explication, définition (« Zone 2 = … ») : en détail de l'action qu'elle précise
            if (!RE_QTE.test(d.lib.slice(0, 30)) && !RE_GESTE.test(d.lib.slice(0, 40)) && (RE_INFO.test(d.lib) || /^[^=]{2,30}=\s/.test(d.lib)) || /^[^=]{2,30}=\s/.test(d.lib)) {
                if (derniere && derniere.moment === (moment || derniere.moment)) ajouterDetail(derniere, p.s); else ignorer(p.s, 'explication');
                continue;
            }
            if (!p.puce && aChapeau(p) && !RE_QTE.test(d.lib) && !RE_GESTE.test(d.lib) && !d.heure) { regle(p.s, p.s, 'information'); continue; }
            //  repas : les aliments d'un même repas forment UNE case
            if (moment && REPAS.includes(moment) && !d.heure && !RE_GESTE.test(p.s.slice(0, 60))) {
                if (!repas) {
                    repas = action(LIB[moment] + (nomMoment ? ' « ' + majuscule(nomMoment.toLowerCase()) + ' »' : ''), p.s, { repas: true, heure, raison: 'repas', detail: info ? info : '' });
                    if (sous && /s[eé]quen/i.test(sous.titre)) repas.sequence = true;
                }
                ajouterDetail(repas, p.s.replace(/\s{3,}/g, ' '));
                continue;
            }
            action(d.lib, p.s, { heure: d.heure || heure, detail: d.det });
        }
        //  repas séquencé : le libellé le dit
        elements.forEach(e => { if (e.repas && e.sequence && !/séquencé/.test(e.texte)) e.texte = e.texte.replace(/^([^«]+?)(\s*«|$)/, (m, a, b) => a.trim() + ' séquencé' + (b ? ' «' : '')); delete e.sequence; });
        //  ── 4. les leçons apprises (corrections passées) en dernier
        const lecons = Array.isArray(o.lecons) ? o.lecons : [];
        if (lecons.length) {
            const parCle = {}; lecons.forEach(l => { if (l && l.cle) parCle[l.cle] = l; });
            elements.forEach(e => {
                const l = parCle[e.cle]; if (!l) return;
                if (l.bucket) e.bucket = l.bucket;
                if (l.moment) e.moment = l.moment;
                if (l.texte) { e.texte = l.texte; if (e.bucket === 'supplement') e.nom = l.texte; else if (e.bucket === 'objectif') e.libelle = l.texte; }
                if (l.bucket === 'action' && !e.moment) e.moment = 'journee';
                e.appris = true;
            });
        }
        elements.forEach(e => { if (e.texte === undefined) e.texte = e.nom || e.libelle || ''; delete e.deduit; });
        return { titre: propre(titre), elements };
    }

    //  objectifs : « Triglycérides <1,5 » → { cle: 'tg', op: '<', v: 1.5 } d'après les noms du catalogue
    function resoudreObjectif(o, catalogue) {
        const M = (catalogue && catalogue.marqueurs) || {};
        const n = norm(o.libelle);
        let k = null, lg = 0;
        Object.entries(M).forEach(([cleM, m]) => [m.libelle].concat(m.alias || []).forEach(a => { const x = norm(a); if (x.length >= 3 && (n === x || n.startsWith(x + ' ') || n.startsWith(x)) && x.length > lg) { k = cleM; lg = x.length; } }));
        //  « testostérone LIBRE », « fer sérique »… : un qualificatif absent du nom du catalogue = un autre dosage
        if (k && /\b(?:libre|biodisponible|seriques?|urinaires?|ratio)\b/.test(n) && !/\b(?:libre|biodisponible|seriques?|urinaires?|ratio)\b/.test(norm([M[k].libelle].concat(M[k].alias || []).join(' ')))) k = null;
        const m = /([<>≤≥])\s*(\d+(?:[.,]\d+)?)/.exec(String(o.cible || ''));
        return { cle: k, op: m ? (m[1] === '≤' ? '<' : m[1] === '≥' ? '>' : m[1]) : null, v: m ? Number(m[2].replace(',', '.')) : null };
    }
    return { analyser, lignesLogiques, momentDuTitre, resoudreObjectif, cle, norm, MOMENTS, LIB_MOMENTS: LIB, JOURS };
});
