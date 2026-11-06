/*  Santé Master — LECTURE D'UN COMPTE RENDU DE BILAN (texte collé, ou texte extrait d'un PDF / d'une image).
    Chaque ligne qui commence par un nom connu du catalogue (libellé ou synonyme) donne : la valeur (premier
    nombre après le nom), et les bornes si elles sont écrites (« 4.28 - 6.00 », « < 50 », « > 3.89 »).
    Rien n'est deviné : une ligne non reconnue est rendue telle quelle, pour vérification.
    Navigateur : window.SanteImport ; Node : require('./sante_import.js'). */
(function (racine, fabrique) {
    if (typeof module === 'object' && module.exports) module.exports = fabrique();
    else racine.SanteImport = fabrique();
})(typeof self !== 'undefined' ? self : this, function () {
    const norm = (s) => String(s || '').toLowerCase()
        .replace(/[éèêë]/g, 'e').replace(/[àâ]/g, 'a').replace(/[îï]/g, 'i').replace(/ô/g, 'o').replace(/[ûù]/g, 'u').replace(/ç/g, 'c').replace(/µ/g, 'u')
        .replace(/[^a-z0-9%.,<>\-/ ]+/g, ' ').replace(/\s+/g, ' ').trim();
    //  La même normalisation, mais les parenthèses restent : les bornes d'un laboratoire s'écrivent « (4.28−6.00) ».
    const normP = (s) => String(s || '').toLowerCase()
        .replace(/[éèêë]/g, 'e').replace(/[àâ]/g, 'a').replace(/[îï]/g, 'i').replace(/ô/g, 'o').replace(/[ûù]/g, 'u').replace(/ç/g, 'c').replace(/µ/g, 'u')
        .replace(/[^a-z0-9%.,<>\-/ ()]+/g, ' ').replace(/\s+/g, ' ').trim();
    //  « 4 420 » → 4420 ; « 15,7 » → 15.7
    const nombre = (s) => { const n = Number(String(s).replace(/(\d)\s(?=\d{3}\b)/g, '$1').replace(',', '.')); return Number.isFinite(n) ? n : null; };
    //  v1.4 — un nombre ne commence jamais collé à une lettre (« HbA1c », « D2/D3 », « T4 ») et une heure n'est pas
    //  une valeur (« Cortisol 8 h 312 », « prélevé à 9h29 »).
    //  v1.21 — « Cortisol à 8 heures 170,9 » : « 8 heures » (comme « 8 h » ou « 9h29 ») n'est pas la valeur.
    const RE_NB = /(?<![a-z0-9.,])(\d{1,3}(?:\s\d{3})+(?![.,]?\d)|\d+(?:[.,]\d+)?)(?!\s?h(?:eures?)?(?![a-z])|\d)/;
    //  v1.4 — les PDF des laboratoires écrivent souvent les tirets en signe moins (−), tiret demi-cadratin (–), etc. :
    //  « 15−05−2026 », « (4.28−6.00) ». Tout est ramené au tiret simple avant lecture.
    const unifier = (t) => String(t || '').replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-').replace(/[\u00A0\u202F\u2007]/g, ' ').replace(/\u00B3/g, '3').replace(/\u2079/g, '9');

    //  ── LA DATE DU BILAN ──
    //  Toutes les dates du texte sont lues, puis classées : la date de PRÉLÈVEMENT d'abord, puis « bilan / analyses du »,
    //  puis l'ouverture du dossier, puis l'édition. Jamais une date de naissance, ni celle d'un résultat antérieur
    //  (colonne « Antériorités »), ni une date future, ni avant 1990.
    const MOIS_TXT = { janvier: 1, janv: 1, fevrier: 2, fevr: 2, fev: 2, mars: 3, avril: 4, avr: 4, mai: 5, juin: 6, juillet: 7, juil: 7, aout: 8,
                       septembre: 9, sept: 9, octobre: 10, oct: 10, novembre: 11, nov: 11, decembre: 12, dec: 12 };
    const iso = (a, m, j) => {
        if (a < 100) a += 2000;
        const d = new Date(Date.UTC(a, m - 1, j));
        return d.getUTCFullYear() === a && d.getUTCMonth() === m - 1 && d.getUTCDate() === j ? a + '-' + String(m).padStart(2, '0') + '-' + String(j).padStart(2, '0') : null;
    };
    function datesDeLigne(brute) {
        const t = unifier(brute), out = [];
        let m;
        const reNum = /(?<!\d)(\d{1,2})([\/.-])(\d{1,2})\2(\d{4}|\d{2})(?![\d.,])/g;
        while ((m = reNum.exec(t))) { if (m[4].length === 2 && m[2] !== '/') continue; const d = iso(Number(m[4]), Number(m[3]), Number(m[1])); if (d) out.push(d); }
        const reIso = /(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/g;
        while ((m = reIso.exec(t))) { const d = iso(Number(m[1]), Number(m[2]), Number(m[3])); if (d) out.push(d); }
        const reTxt = /\b(\d{1,2})(?:er)? (janvier|janv|fevrier|fevr|fev|mars|avril|avr|mai|juin|juillet|juil|aout|septembre|sept|octobre|oct|novembre|nov|decembre|dec)\.? (\d{4})\b/g;
        const n = norm(t);
        while ((m = reTxt.exec(n))) { const d = iso(Number(m[3]), MOIS_TXT[m[2]], Number(m[1])); if (d) out.push(d); }
        return out;
    }
    const EXCLURE_DATE = /naissance|\bne(?:e| e)? le\b|\bddn\b|anteriorit|anterieur|precedent|ancien|derniere? (?:analyse|resultat)|historique/;
    const RANGS_DATE = [[/prele|prelev|recolte|collecte/, 1], [/(?:bilan|analyses?|examens?|resultats?|compte rendu)(?: biologiques?)? du\b/, 2],
                        [/dossier|enregistr|recu le|reception|admission|demande/, 3], [/edit|imprim|valid|sign/, 4]];
    function dateDuBilan(texte, aujourdhui) {
        let meilleure = null;
        unifier(texte).split(/\r?\n/).forEach((brute, i) => {
            const l = norm(brute);
            if (!l || EXCLURE_DATE.test(l)) return;
            const rang = (RANGS_DATE.find(([re]) => re.test(l)) || [null, 5])[1];
            datesDeLigne(brute).forEach(d => {
                if (d < '1990-01-01' || (aujourdhui && d > aujourdhui)) return;
                if (!meilleure || rang < meilleure.rang) meilleure = { date: d, rang, ligne: brute.trim().slice(0, 140) };
            });
        });
        return meilleure;
    }

    //  v1.21 — LA LECTURE DES VRAIS COMPTES RENDUS (laboratoires marocains et Cerba). Ce que les PDF imposent :
    //   • les bornes sont écrites ENTRE PARENTHÈSES, suivies de la valeur d'un résultat antérieur (« (150 000−400 000) 225 000 ») :
    //     on lit le contenu des parenthèses, jamais le chiffre d'après ;
    //   • la formule leucocytaire donne le pourcentage, puis une ligne « Soit : 2 206 /mm3 (1 400−7 700) » : la valeur absolue
    //     est celle qui se compare à la norme (à défaut, elle se calcule : leucocytes × %) ;
    //   • certains laboratoires (Cerba) écrivent le nom sur une ligne et « 1,42 g/l   N : 0,66 à 1,33 » quatre lignes plus bas ;
    //   • une numération en G/L (« 196 G/L ») est ramenée à /mm³ ; « 8 heures » n'est pas une valeur.
    const DIFF = ['neutro', 'eos', 'baso', 'lympho', 'mono'], COMPTES = new Set(['leuco', 'plaquettes'].concat(DIFF));
    const RE_ECHELLE = /^\s*(?:g\/l|giga\/l|(?:x\s?)?10\s?[39]\s?\/\s?(?:u?l|mm3)|k\/ul)(?![a-z])/;
    const NB = '(?<![a-z0-9.,])(\\d{1,3}(?:\\s\\d{3})+(?![.,]?\\d)|\\d+(?:[.,]\\d+)?)';
    const RE_INTER = new RegExp(NB + '\\s*(?:-|a|à)\\s*' + NB), RE_INF = new RegExp('<\\s*=?\\s*' + NB), RE_SUP = new RegExp('>\\s*=?\\s*' + NB);
    function bornesDe(t) {
        const i = RE_INTER.exec(t); if (i) return { min: nombre(i[1]), max: nombre(i[2]) };
        const inf = RE_INF.exec(t), sup = RE_SUP.exec(t), o = {};
        if (inf) o.max = nombre(inf[1]);
        if (sup) o.min = nombre(sup[1]);
        return 'min' in o || 'max' in o ? o : null;
    }
    function lireBornes(reste) {
        const re = /\(([^)]*)\)/g; let g;
        while ((g = re.exec(reste))) { const b = bornesDe(g[1]); if (b) return b; }           // « (4.28-6.00) », « (<5) », « (>0.40) »
        const n = /(?:^|\s)n\s*:\s*(.*)$/.exec(reste);                                          // « N : 0,66 à 1,33 »
        if (n) { const b = bornesDe(n[1]); if (b) return b; }
        return bornesDe(reste.slice(0, 60));                                                    // « 13 - 18 » écrit sans parenthèses
    }
    const RE_BRUIT = /site web|banque populaire|page n|page \d|dossier|edite le|preleve le|prelevement|attention|interpretation|risque|valeurs? (?:souhaitables|de reference|usuelles)|insuffisance|carence|stade|ans\b|hommes?\b|femmes?\b|trimestre|www\.|tel ?:|ice ?:|inp ?:/;
    function lireBilan(texte, catalogue, options) {
        texte = unifier(texte);
        const M = (catalogue && catalogue.marqueurs) || {};
        //  synonymes, du plus long au plus court (« bilirubine conjuguee » avant « bilirubine ») ; les mots peuvent être séparés
        //  par des espaces, tirets, parenthèses ou « / » (« Cholestérol − HDL », « ALAT(GPT) », « SGOT /ASAT »)
        const syn = [];
        Object.entries(M).forEach(([k, m]) => [m.libelle].concat(m.alias || []).forEach(a => {
            const t = normP(a).split(/[\s()\-/]+/).filter(Boolean);
            if (t.length) syn.push([new RegExp('^' + t.map(x => x.replace(/[.*+?^${}|[\]\\]/g, '\\$&')).join('[\\s()\\-/]+') + '(?=[\\s:.()]|$)'), k, t.join(' ').length]);
        }));
        syn.sort((a, b) => b[2] - a[2]);
        const trouveNom = (lr) => { for (const [re, k] of syn) { const m = re.exec(lr); if (m) return [m, k]; } return null; };
        const valeurs = {}, nonReconnues = [], sources = {};   // sources : la ligne du document d'où vient chaque valeur (preuve, et matière de la validation par l'IA)
        const trouvee = dateDuBilan(texte, options && options.aujourdhui);
        const lignes = String(texte || '').split(/\r?\n/), consommees = new Set();
        let dernierDiff = null;
        for (let i = 0; i < lignes.length; i++) {
            if (consommees.has(i)) continue;
            const brute = lignes[i], lr = normP(brute);
            if (!lr) continue;
            //  « Soit : 2 206 /mm3 (1 400−7 700) » : la valeur absolue de la formule leucocytaire qui précède
            if (dernierDiff && /^soit\b/.test(lr)) {
                const r = lr.replace(/^soit[\s:.]*/, ''), m = RE_NB.exec(r), o = valeurs[dernierDiff];
                if (m && o) {
                    const apres = r.slice(m.index + m[0].length), f = RE_ECHELLE.test(apres) ? 1000 : 1, bn = lireBornes(apres);
                    o.v = nombre(m[1]) * f;
                    if (bn) { if (bn.min != null) o.min = bn.min * f; if (bn.max != null) o.max = bn.max * f; }
                    sources[dernierDiff] = ((sources[dernierDiff] || '') + ' ⏎ ' + brute.trim()).slice(0, 200);
                }
                dernierDiff = null; continue;
            }
            const nom = trouveNom(lr);
            if (!nom) {
                //  les lignes qui contiennent un chiffre mais ne sont pas un résultat (pied de page, interprétation, objectif) ne sont pas signalées
                if (/^[a-z]/.test(lr) && /\d/.test(lr) && lr.length < 120 && !RE_BRUIT.test(lr)) nonReconnues.push(brute.trim());
                continue;
            }
            const [m0, cle] = nom;
            dernierDiff = DIFF.includes(cle) ? cle : null;
            if (valeurs[cle]) continue;                       // la première occurrence compte
            let reste = lr.slice(m0[0].length), source = brute.trim(), v = null, pct = null;
            //  formule leucocytaire sur une seule ligne (« neutrophiles 49.9 % 2206 ») : on garde la valeur absolue
            const pctLigne = DIFF.includes(cle) ? /^[\s:.)]*(\d+(?:[.,]\d+)?)\s*%\s+(\d{1,3}(?:\s\d{3})+|\d+)/.exec(reste) : null;
            const m = pctLigne ? null : RE_NB.exec(reste);
            if (pctLigne) { v = nombre(pctLigne[2]); reste = reste.slice(pctLigne[0].length); }
            else if (m) {
                v = nombre(m[1]); reste = reste.slice(m.index + m[0].length);
                if (DIFF.includes(cle) && /^\s*%/.test(reste)) { pct = v; v = null; }          // le pourcentage seul : la ligne « Soit » suit
            } else if (!/[a-z]{3}/.test(reste.replace(/\([^)]*\)/g, ' '))) {
                //  la valeur est sur une ligne suivante (« 1,42 g/l   N : 0,66 à 1,33 », « Résultat : 0,46 ng/ml ») : quatre lignes au plus,
                //  et seulement si la ligne du nom est « nue » (« Veuillez consulter le compte rendu ci-joint » n'attend aucune valeur) ;
                //  le nombre doit être suivi d'une unité ou de bornes — « 394, Bd Zerktouni » (pied de page) n'est pas un résultat
                //  (certains PDF coupent « ng/ml », « Résultat : » et « 0,46 » en trois lignes : le nombre nu n'est accepté qu'après
                //  une ligne « Résultat : » ou une unité seule)
                let ancre = false;
                for (let j = i + 1, vus = 0; j < lignes.length && vus < 4; j++) {
                    const lj = normP(lignes[j]); if (!lj) continue; vus++;
                    if (trouveNom(lj)) break;
                    const x = new RegExp('^(?:resultat[\\s:.]*)?(?:<\\s*)?(\\d{1,3}(?:\\s\\d{3})+(?![.,]?\\d)|\\d+(?:[.,]\\d+)?)(?=\\s*(?:[a-z%/]|\\(|<|>' + (ancre ? '|$' : '') + '))').exec(lj);
                    if (x) { v = nombre(x[1]); reste = lj.slice(x[0].length); source += ' ⏎ ' + lignes[j].trim(); consommees.add(j); break; }
                    if (/^(?:resultat[\s:.]*|[a-z%/]{1,10}(?:\/[a-z0-9]{1,6})?)$/.test(lj)) { ancre = true; source += ' ⏎ ' + lignes[j].trim(); }
                }
            }
            if (v === null && pct === null) { nonReconnues.push(brute.trim()); continue; }
            const f = COMPTES.has(cle) && RE_ECHELLE.test(reste) ? 1000 : 1, bn = lireBornes(reste);
            const o = { v: v === null ? null : v * f };
            if (pct !== null) o.pct = pct;
            if (bn) { if (bn.min != null) o.min = bn.min * f; if (bn.max != null) o.max = bn.max * f; }
            sources[cle] = source.slice(0, 200);
            valeurs[cle] = o;
        }
        //  un pourcentage sans valeur absolue : leucocytes × % (un calcul, pas une devinette — dit dans la ligne source)
        DIFF.forEach(k => {
            const o = valeurs[k]; if (!o) return;
            if (o.v !== null) { delete o.pct; return; }
            if (valeurs.leuco && valeurs.leuco.v) { o.v = Math.round(valeurs.leuco.v * o.pct / 100); sources[k] = ((sources[k] || '') + ' ⏎ (calculé : leucocytes × ' + o.pct + ' %)').slice(0, 200); delete o.pct; }
            else { nonReconnues.push(sources[k] || k); delete valeurs[k]; delete sources[k]; }
        });
        return { date: trouvee ? trouvee.date : null, dateLigne: trouvee ? trouvee.ligne : '', valeurs, nonReconnues, sources };
    }

    //  ── UN PLAN (nutrition ou exercice) ÉCRIT EN TEXTE LIBRE (PDF, Word, texte collé) ──
    //  Un titre de jour (« Lundi », « Mardi : », « Tous les jours », « Jours de repos ») ouvre un bloc ; pour la nutrition, un
    //  titre de repas (« Petit-déjeuner », « Déjeuner », « Collation », « Dîner ») aussi. Chaque autre ligne devient un
    //  élément du plan, rangé sous le jour et le repas en cours. Une durée (« 45 min », « 1 h 30 ») est lue pour l'exercice.
    //  Rien n'est inventé : la ligne est gardée telle quelle, l'aperçu permet de la corriger avant d'enregistrer.
    const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
    const MOMENTS_PLAN = [[/^petit[ -]?dej/, 'petit_dejeuner'], [/^(?:dejeuner|dejeune|midi)\b/, 'dejeuner'], [/^(?:collation|gouter|en[ -]cas|snack)/, 'collation'], [/^(?:diner|souper|soir)\b/, 'diner']];
    function lirePlan(texte, type) {
        const items = [], ignorees = [];
        let jour = 'tous', moment = type === 'nutrition' ? 'dejeuner' : '', titre = '';
        unifier(texte).split(/\r?\n/).forEach(brute => {
            const propre = brute.replace(/^\s*(?:(?:[•\-*·▪◦►✓✔☐□]|\d{1,2}[.)](?!\d))\s*)+/, '').trim();
            const l = norm(propre);
            if (!l) return;
            const j = JOURS.find(x => l === x || l.startsWith(x + ' ') || l.startsWith(x + ':'));
            const tous = /^(?:tous les jours|chaque jour|quotidien|au quotidien)\b/.test(l);
            if ((j || tous) && l.length <= 40) { jour = tous ? 'tous' : j; const reste = propre.replace(/^[^:]*:\s*/, ''); if (reste !== propre && reste) ajouter(reste); return; }
            if (type === 'nutrition') {
                const m = MOMENTS_PLAN.find(([re]) => re.test(l));
                if (m && l.length <= 40) { moment = m[1]; const reste = propre.replace(/^[^:]*:\s*/, ''); if (reste !== propre && reste) ajouter(reste); return; }
            }
            if (!titre && !items.length && /^(?:plan|programme|regime|menu|semaine)/.test(l) && l.length <= 80) { titre = propre; return; }
            ajouter(propre);
        });
        function ajouter(t) {
            if (t.length < 2 || !/[a-zA-ZÀ-ÿ]/.test(t)) { ignorees.push(t); return; }
            const o = { jour, texte: t.slice(0, 200) };
            if (type === 'nutrition') o.moment = moment;
            else { const h = /(\d+)\s*h\s*(\d{1,2})?/.exec(norm(t)), mn = /(\d+)\s*(?:min|mn)\b/.exec(norm(t)); const d = (h ? Number(h[1]) * 60 + Number(h[2] || 0) : 0) + (mn && !(h && h[2]) ? Number(mn[1]) : 0); if (d > 0 && d <= 600) o.duree_min = d; }
            items.push(o);
        }
        return { titre, items, ignorees };
    }
    return { lireBilan, lirePlan, dateDuBilan, unifier, norm, nombre, JOURS };
});
