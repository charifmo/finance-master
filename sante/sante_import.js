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
    //  « 4 420 » → 4420 ; « 15,7 » → 15.7
    const nombre = (s) => { const n = Number(String(s).replace(/(\d)\s(?=\d{3}\b)/g, '$1').replace(',', '.')); return Number.isFinite(n) ? n : null; };
    //  v1.4 — un nombre ne commence jamais collé à une lettre (« HbA1c », « D2/D3 », « T4 ») et une heure n'est pas
    //  une valeur (« Cortisol 8 h 312 », « prélevé à 9h29 »).
    const RE_NB = /(?<![a-z0-9.,])(\d{1,3}(?:\s\d{3})+(?![.,]?\d)|\d+(?:[.,]\d+)?)(?!\s?h(?:\b|\d)|\d)/;
    //  v1.4 — les PDF des laboratoires écrivent souvent les tirets en signe moins (−), tiret demi-cadratin (–), etc. :
    //  « 15−05−2026 », « (4.28−6.00) ». Tout est ramené au tiret simple avant lecture.
    const unifier = (t) => String(t || '').replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-').replace(/[\u00A0\u202F\u2007]/g, ' ');

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

    function lireBilan(texte, catalogue, options) {
        texte = unifier(texte);
        const M = (catalogue && catalogue.marqueurs) || {};
        //  synonymes, du plus long au plus court (« bilirubine conjuguee » avant « bilirubine »)
        const syn = [];
        Object.entries(M).forEach(([k, m]) => [m.libelle].concat(m.alias || []).forEach(a => syn.push([norm(a), k])));
        syn.sort((a, b) => b[0].length - a[0].length);
        const valeurs = {}, nonReconnues = [];
        const trouvee = dateDuBilan(texte, options && options.aujourdhui);
        String(texte || '').split(/\r?\n/).forEach(brute => {
            const l = norm(brute);
            if (!l) return;
            const s = syn.find(([a]) => l === a || l.startsWith(a + ' ') || l.startsWith(a + ':') || l.startsWith(a + '.'));
            if (!s) { if (/\d/.test(l) && l.length < 120) nonReconnues.push(brute.trim()); return; }
            const [alias, cle] = s;
            if (valeurs[cle]) return;                       // la première occurrence compte
            let reste = l.slice(alias.length);
            //  pourcentage d'une formule leucocytaire (« neutrophiles 49.9 % 2206 ») : on garde la valeur absolue
            const pct = /^\s*:?\s*(\d+(?:[.,]\d+)?)\s*%\s+(\d{1,3}(?:\s\d{3})+|\d+)/.exec(reste);
            const m = pct ? null : RE_NB.exec(reste);
            const v = pct ? nombre(pct[2]) : (m ? nombre(m[1]) : null);
            if (v === null) { nonReconnues.push(brute.trim()); return; }
            if (!pct) reste = reste.slice(m.index + m[0].length);
            const o = { v };
            //  bornes : « 4.28 - 6.00 », « 150 000 - 400 000 » (milliers séparés), « < 1.50 », « > 30 »
            const N = '(?<![a-z0-9.,])(\\d{1,3}(?:\\s\\d{3})+(?![.,]?\\d)|\\d+(?:[.,]\\d+)?)';
            const intervalle = new RegExp(N + '\\s*(?:-|a|à)\\s*' + N).exec(reste);
            const inf = new RegExp('<\\s*' + N).exec(reste), sup = new RegExp('>\\s*' + N).exec(reste);
            if (intervalle) { o.min = nombre(intervalle[1]); o.max = nombre(intervalle[2]); }
            else { if (inf) o.max = nombre(inf[1]); if (sup) o.min = nombre(sup[1]); }
            valeurs[cle] = o;
        });
        return { date: trouvee ? trouvee.date : null, dateLigne: trouvee ? trouvee.ligne : '', valeurs, nonReconnues };
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
