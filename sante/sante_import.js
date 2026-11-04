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
    const RE_NB = /(\d{1,3}(?:\s\d{3})+|\d+(?:[.,]\d+)?)/;

    function lireBilan(texte, catalogue) {
        const M = (catalogue && catalogue.marqueurs) || {};
        //  synonymes, du plus long au plus court (« bilirubine conjuguee » avant « bilirubine »)
        const syn = [];
        Object.entries(M).forEach(([k, m]) => [m.libelle].concat(m.alias || []).forEach(a => syn.push([norm(a), k])));
        syn.sort((a, b) => b[0].length - a[0].length);
        const valeurs = {}, nonReconnues = [];
        let date = null;
        String(texte || '').split(/\r?\n/).forEach(brute => {
            const l = norm(brute);
            if (!l) return;
            const d = /\b(\d{2})[\/.-](\d{2})[\/.-](\d{4})\b/.exec(brute);
            if (d && !date) date = d[3] + '-' + d[2] + '-' + d[1];
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
            const intervalle = /(\d+(?:[.,]\d+)?)\s*(?:-|a|à)\s*(\d+(?:[.,]\d+)?)/.exec(reste);
            const inf = /<\s*(\d+(?:[.,]\d+)?)/.exec(reste), sup = />\s*(\d+(?:[.,]\d+)?)/.exec(reste);
            if (intervalle) { o.min = nombre(intervalle[1]); o.max = nombre(intervalle[2]); }
            else { if (inf) o.max = nombre(inf[1]); if (sup) o.min = nombre(sup[1]); }
            valeurs[cle] = o;
        });
        return { date, valeurs, nonReconnues };
    }
    return { lireBilan, norm, nombre };
});
