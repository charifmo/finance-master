/*  Santé Master — LES CALCULS DÉTERMINISTES (miroir exact de sante_lib.php ; parité vérifiée par test_sante_parite.mjs).
    Unités de stockage : lipides et glycémie en g/L, bilirubine en mg/L. Aides au suivi, pas un diagnostic.
    Navigateur : window.SanteCalc.creer({ catalogue, aliments }) ; Node : require('./sante_calculs.js').creer(...). */
(function (racine, fabrique) {
    if (typeof module === 'object' && module.exports) module.exports = fabrique();
    else racine.SanteCalc = fabrique();
})(typeof self !== 'undefined' ? self : this, function () {
    const KCAL_PAR_KG = 7700;
    const num = (v) => {
        if (v === null || v === undefined || v === '' || typeof v === 'boolean') return null;
        if (typeof v === 'string') v = v.replace(/[\s  ]/g, '').replace(',', '.');
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    };
    const arr = (v, d = 2) => v === null ? null : Math.round(v * 10 ** d) / 10 ** d;
    //  arrondi « PHP » (demi vers le haut en valeur absolue) pour la parité
    const rnd = (v, d = 0) => { const f = 10 ** d; return Math.sign(v) * Math.round(Math.abs(v) * f + 1e-9) / f; };
    const norm = (s) => String(s || '').trim().toLowerCase()
        .replace(/[éèêë]/g, 'e').replace(/[àâ]/g, 'a').replace(/[îï]/g, 'i').replace(/ô/g, 'o').replace(/[ûù]/g, 'u').replace(/ç/g, 'c').replace(/œ/g, 'oe').replace(/’/g, "'")
        .replace(/[^a-z0-9%]+/g, ' ').trim();
    const ymd = /^(\d{4})-(\d{2})-(\d{2})$/;
    const jourUTC = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86400000;

    function creer({ catalogue, aliments } = {}) {
        const M = (catalogue && catalogue.marqueurs) || {};
        const A = aliments || {};
        const age = (naissance, date) => {
            const n = ymd.exec(naissance || ''), d = ymd.exec(date || new Date().toISOString().slice(0, 10));
            if (!n || !d) return null;
            let a = +d[1] - +n[1];
            if (+d[2] < +n[2] || (+d[2] === +n[2] && +d[3] < +n[3])) a--;
            return a;
        };
        const val = (bilan, cle) => { const x = ((bilan || {}).valeurs || {})[cle]; return x && typeof x === 'object' ? num(x.v) : num(x); };
        const bornes = (bilan, cle) => {
            const x = ((bilan || {}).valeurs || {})[cle], m = M[cle] || {};
            const min = x && typeof x === 'object' && x.min !== undefined && x.min !== null ? num(x.min) : num(m.min);
            const max = x && typeof x === 'object' && x.max !== undefined && x.max !== null ? num(x.max) : num(m.max);
            return [min, max];
        };
        const statut = (bilan, cle) => {
            const v = val(bilan, cle); if (v === null) return 'inconnu';
            const [min, max] = bornes(bilan, cle);
            if (min !== null && v < min) return 'bas';
            if (max !== null && v > max) return 'haut';
            return 'normal';
        };
        const ratioTgHdl = (tg, hdl) => (tg === null || !hdl) ? null : arr(tg / hdl, 2);
        const nonHdl = (ct, hdl) => (ct === null || hdl === null) ? null : arr(ct - hdl, 2);
        const homaIr = (gly, ins) => (gly === null || ins === null) ? null : arr(gly * 5.551 * ins / 22.5, 2);
        const tyg = (tg, gly) => (tg === null || gly === null || tg <= 0 || gly <= 0) ? null : arr(Math.log(tg * 100 * gly * 100 / 2), 2);
        const score2 = (a, sexe, fumeur, pas, ct, hdl, region = 'moderate') => {
            const manque = [];
            if (a === null) manque.push('âge');
            if (pas === null) manque.push('pression artérielle systolique');
            if (ct === null) manque.push('cholestérol total');
            if (hdl === null) manque.push('HDL');
            if (manque.length) return { risque: null, raison: 'à compléter : ' + manque.join(', ') };
            if (sexe !== 'H') return { risque: null, raison: 'formule femme non intégrée' };
            if (a < 40 || a > 69) return { risque: null, raison: 'SCORE2 couvre 40 à 69 ans' };
            const E = { low: [-0.5699, 0.7476], moderate: [-0.1565, 0.8009], high: [0.3207, 0.9360], very_high: [0.5836, 0.8294] };
            const [s1, s2] = E[region] || E.moderate;
            const ca = (a - 60) / 5, cs = (pas - 120) / 20, cc = ct * 2.586 - 6, ch = (hdl * 2.586 - 1.3) / 0.5, f = fumeur ? 1 : 0;
            const x = 0.3742 * ca + 0.6012 * f + 0.2777 * cs + 0.1458 * cc - 0.2698 * ch - 0.0755 * ca * f - 0.0255 * ca * cs - 0.0281 * ca * cc + 0.0426 * ca * ch;
            const r = 1 - Math.pow(0.9605, Math.exp(x));
            const cal = 1 - Math.exp(-Math.exp(s1 + s2 * Math.log(-Math.log(1 - r))));
            const pct = rnd(cal * 100, 1);
            const [b1, b2] = a < 50 ? [2.5, 7.5] : [5, 10];
            return { risque: pct, niveau: pct < b1 ? 'faible à modéré' : (pct < b2 ? 'élevé' : 'très élevé'), region };
        };
        const gilbert = (bilan) => {
            const bt = statut(bilan, 'bili_t'), bl = val(bilan, 'bili_l');
            const hausse = bt === 'haut' || (bt === 'inconnu' && bl !== null && bl > 10);
            if (!hausse) return { statut: bt === 'inconnu' ? 'incomplet' : 'normal' };
            const hep = { asat: statut(bilan, 'asat'), alat: statut(bilan, 'alat'), ggt: statut(bilan, 'ggt') };
            const bc = statut(bilan, 'bili_c');
            const hautes = Object.keys(hep).filter(k => hep[k] === 'haut');
            if (hautes.length || bc === 'haut')
                return { statut: 'alerte', message: 'Bilirubine élevée avec ' + hautes.map(h => h.toUpperCase()).concat(bc === 'haut' ? ['bilirubine conjuguée'] : []).join(', ') + ' au-dessus de la norme : à discuter avec le médecin.' };
            if (Object.values(hep).includes('inconnu')) return { statut: 'incomplet', message: 'Bilirubine élevée : ASAT, ALAT et GGT nécessaires pour conclure.' };
            return { statut: 'gilbert', message: '🧬 Profil Gilbert (antioxydant bénin) : bilirubine libre élevée, transaminases et GGT normales.' };
        };
        const bmr = (kg, cm, a, sexe = 'H') => (kg === null || cm === null || a === null) ? null : rnd(10 * kg + 6.25 * cm - 5 * a + (sexe === 'F' ? -161 : 5));
        const bilanEnergie = (ingere, b, actives) => {
            if (ingere === null || b === null) return { depense: null, net: null };
            const dep = rnd(b + (actives || 0));
            return { depense: dep, net: rnd(ingere - dep) };
        };
        const projectionPoids = (pesees, cible, deficitMoyen = null, aujourdhui = null, jours = 28) => {
            aujourdhui = aujourdhui || new Date().toISOString().slice(0, 10);
            const p = (pesees || []).filter(x => x && x.date && num(x.kg) !== null).slice().sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
            if (!p.length || cible === null || cible === undefined) return { date: null, kg_semaine: null, raison: 'pesée ou objectif manquant' };
            const dernier = p[p.length - 1], actuel = num(dernier.kg);
            if (actuel <= cible) return { date: dernier.date, kg_semaine: null, atteint: true };
            const t0 = jourUTC(aujourdhui) - jours;
            const rec = p.filter(x => jourUTC(x.date) >= t0);
            let pente = null;
            if (rec.length >= 2) {
                const xs = rec.map(x => jourUTC(x.date)), ys = rec.map(x => num(x.kg)), n = xs.length;
                const mx = xs.reduce((s, v) => s + v, 0) / n, my = ys.reduce((s, v) => s + v, 0) / n;
                let nu = 0, de = 0; for (let i = 0; i < n; i++) { nu += (xs[i] - mx) * (ys[i] - my); de += (xs[i] - mx) ** 2; }
                if (de > 0) pente = nu / de;
            }
            let source = 'pesées';
            if ((pente === null || pente >= 0) && deficitMoyen !== null && deficitMoyen < 0) { pente = deficitMoyen / KCAL_PAR_KG; source = 'déficit moyen'; }
            if (pente === null || pente >= 0) return { date: null, kg_semaine: pente === null ? null : rnd(pente * 7, 2), raison: 'pas de baisse mesurée' };
            const jrs = Math.ceil((actuel - cible) / -pente - 1e-9);
            const d = new Date((jourUTC(dernier.date) + jrs) * 86400000).toISOString().slice(0, 10);
            return { date: d, kg_semaine: rnd(pente * 7, 2), source, jours: jrs };
        };
        const aliment = (nom) => {
            const n = norm(nom);
            for (const k of Object.keys(A)) if (norm(k) === n) return { nom: k, ...A[k] };
            for (const k of Object.keys(A)) for (const al of (A[k].alias || [])) if (norm(al) === n) return { nom: k, ...A[k] };
            return null;
        };
        const item = (it) => {
            const g = num(it.g) ?? 100, a = aliment(it.nom || '');
            if (a) {
                const f = g / 100;
                return { nom: a.nom, g, categorie: a.categorie, raffine: !!a.raffine, connu: true, kcal: rnd(a.kcal * f), prot: rnd(a.prot * f, 1), glu: rnd(a.glu * f, 1), lip: rnd(a.lip * f, 1), fib: rnd(a.fib * f, 1) };
            }
            return { nom: String(it.nom || '?'), g, categorie: String(it.categorie || 'mixte'), raffine: !!it.raffine, connu: false,
                     kcal: rnd(num(it.kcal) ?? 0), prot: rnd(num(it.prot) ?? 0, 1), glu: rnd(num(it.glu) ?? 0, 1), lip: rnd(num(it.lip) ?? 0, 1), fib: rnd(num(it.fib) ?? 0, 1) };
        };
        const scoreSequencage = (items, marche) => {
            const cats = items.map(i => i.categorie), det = [];
            let s = 50;
            if (cats[0] === 'fibres') { s += 20; det.push('+20 fibres en entrée'); }
            if (cats[0] === 'glucides') { s -= 20; det.push('−20 glucides en premier'); }
            const iG = cats.indexOf('glucides'), iPs = cats.map((c, i) => c === 'proteines' ? i : -1).filter(i => i >= 0);
            if (iPs.length && (iG === -1 || Math.max(...iPs) < iG)) { s += 15; det.push('+15 protéines avant les glucides'); }
            if (marche) { s += 15; det.push('+15 marche après le repas'); }
            const raf = items.filter(i => i.raffine).length;
            if (raf) { const m = Math.min(30, 10 * raf); s -= m; det.push('−' + m + ' raffiné (' + raf + ')'); }
            return { score: Math.max(0, Math.min(100, s)), detail: det };
        };
        const totauxRepas = (items) => {
            const t = { kcal: 0, prot: 0, glu: 0, lip: 0, fib: 0 };
            items.forEach(i => Object.keys(t).forEach(k => { t[k] += Number(i[k] || 0); }));
            return { kcal: rnd(t.kcal), prot: rnd(t.prot, 1), glu: rnd(t.glu, 1), lip: rnd(t.lip, 1), fib: rnd(t.fib, 1) };
        };
        const indicateurs = (bilan, profil = {}) => {
            const v = (k) => val(bilan, k);
            const a = age(profil.naissance, bilan.date);
            return {
                ratio_tg_hdl: ratioTgHdl(v('tg'), v('hdl')), non_hdl: nonHdl(v('ct'), v('hdl')), homa_ir: homaIr(v('glycemie'), v('insuline')), tyg: tyg(v('tg'), v('glycemie')),
                score2: score2(a, profil.sexe || 'H', !!profil.fumeur, num(bilan.pas_systolique ?? profil.pas_systolique), v('ct'), v('hdl'), profil.region_score2 || 'moderate'),
                gilbert: gilbert(bilan),
            };
        };
        //  v1.4 — PLAN PRÉVU / RÉALISÉ : les éléments du plan pour une date (« tous les jours » + ceux de son jour de semaine),
        //  cochés ou non dans journal[date].plan_fait, et la semaine en cours (lundi → date) : prévus, faits, taux, minutes.
        const JOURS_SEM = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
        const jourSemaine = (d) => JOURS_SEM[(new Date(d + 'T12:00:00Z').getUTCDay() + 6) % 7];
        const decaler = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
        //  v1.8 — un élément peut viser des jours précis (jours: ['lundi', 'jeudi']) ou une période (frequence: 'semaine' | 'mois',
        //  coché une fois dans la semaine / le mois) : ces derniers sont rendus à part (« periodiques »), hors du décompte du jour.
        function suiviPlan(plan, journal, date) {
            const items = plan && Array.isArray(plan.items) ? plan.items : [];
            const vise = (i, d) => !i.frequence && (Array.isArray(i.jours) && i.jours.length ? i.jours.includes(jourSemaine(d)) : (i.jour === 'tous' || i.jour === jourSemaine(d)));
            const duJour = (d) => items.filter(i => vise(i, d));
            const fait = (d, id) => !!((((journal || {})[d] || {}).plan_fait || {})[id]);
            const faitPeriode = (i) => {
                if (i.frequence === 'semaine') { const k0 = (new Date(date + 'T12:00:00Z').getUTCDay() + 6) % 7; for (let k = 0; k < 7; k++) if (fait(decaler(date, k - k0), i.id)) return true; return false; }
                const a = Number(date.slice(0, 4)), m = Number(date.slice(5, 7)), fin = new Date(Date.UTC(a, m, 0)).getUTCDate();
                for (let j = 1; j <= fin; j++) if (fait(date.slice(0, 8) + String(j).padStart(2, '0'), i.id)) return true;
                return false;
            };
            const idx = JOURS_SEM.indexOf(jourSemaine(date));
            let prevus = 0, faits = 0, minP = 0, minF = 0;
            for (let k = 0; k <= idx; k++) {
                const d = decaler(date, k - idx);
                duJour(d).forEach(i => { prevus++; minP += Number(i.duree_min || 0); if (fait(d, i.id)) { faits++; minF += Number(i.duree_min || 0); } });
            }
            return { jour: jourSemaine(date), du_jour: duJour(date).map(i => Object.assign({}, i, { fait: fait(date, i.id) })),
                     periodiques: items.filter(i => i.frequence === 'semaine' || i.frequence === 'mois').map(i => Object.assign({}, i, { fait: faitPeriode(i) })),
                     semaine: { du: decaler(date, -idx), prevus, faits, taux: prevus ? Math.round(100 * faits / prevus) : null, minutes_prevues: minP, minutes_faites: minF } };
        }
        return { num, norm, age, val, bornes, statut, ratioTgHdl, nonHdl, homaIr, tyg, score2, gilbert, bmr, bilanEnergie, projectionPoids, aliment, item, scoreSequencage, totauxRepas, indicateurs, suiviPlan, jourSemaine, decaler, JOURS_SEM, KCAL_PAR_KG };
    }
    return { creer };
});
