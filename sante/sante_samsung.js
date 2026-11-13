/*  Santé Master — LECTURE DE L'EXPORT SAMSUNG HEALTH (« Télécharger les données personnelles »), tel quel.
    Format (rétro-documenté, vérifié sur des exports réels de 2025-2026 ; Samsung ne publie pas de spécification) :
      samsunghealth_<compte>_<horodatage>/
        <type>.<horodatage>.csv      un CSV par mesure, À LA RACINE (ex. com.samsung.health.weight.20261104123456.csv)
        jsons/<type>/<0-f>/<uuid>.binning_data.json   détail minute / 10 min (rarement utile ici)
        files/…                      photos (repas, profil, exercice) — ignorées
    CSV : ligne 1 = description « <type>,<version>,<n> » ; ligne 2 = en-tête ; BOM possible ; certaines colonnes sont
    préfixées (« com.samsung.health.heart_rate.start_time ») ; une virgule de trop en fin de ligne ; des champs entre
    guillemets (JSON). Heures : start_time / end_time en UTC + time_offset (« UTC+0100 ») ; day_time = minuit LOCAL du jour.
    Pas : plusieurs lignes par jour (téléphone, montre, et la ligne « combinée » que Samsung fusionne) → la ligne combinée
    (device_profile.device_group = 0, ou source_info rempli), sinon la plus grande.
    On n'extrait que ce que l'appli suit : pas, kcal actives, FC moyenne, sommeil, poids — et (v1.26) la COMPOSITION CORPORELLE
    (masse grasse, muscle squelettique, masse maigre, eau, métabolisme de base, graisse viscérale), les SÉANCES (type, durée,
    distance, vitesse, FC moyenne / max, calories, pas, dénivelé, VO₂ max ; zones de FC et temps par km tirés du détail
    jsons/com.samsung.shealth.exercise/…live_data.json) et le VO₂ max. TOUT l'historique de l'export. Le reste est ignoré.
    Navigateur : window.SanteSamsung ; Node : require('./sante_samsung.js'). */
(function (racine, fabrique) {
    if (typeof module === 'object' && module.exports) module.exports = fabrique();
    else racine.SanteSamsung = fabrique();
})(typeof self !== 'undefined' ? self : this, function () {
    //  les types utiles (le reste de l'export est ignoré sans être lu)
    const UTILES = {
        'com.samsung.shealth.tracker.pedometer_day_summary': 'pas',
        'com.samsung.shealth.step_daily_trend': 'pas_tendance',
        'com.samsung.shealth.activity.day_summary': 'activite_jour',
        'com.samsung.shealth.calories_burned.details': 'calories',
        'com.samsung.health.weight': 'poids',
        'com.samsung.shealth.tracker.heart_rate': 'fc',
        'com.samsung.shealth.sleep': 'sommeil',
        'com.samsung.shealth.sleep_combined': 'sommeil_combine',
        'com.samsung.health.device_profile': 'appareils',
        //  v1.26 — composition corporelle (balance, montre BIA), séances, VO₂ max
        'com.samsung.health.body_composition': 'compo',
        'com.samsung.shealth.exercise': 'seances',
        'com.samsung.health.exercise': 'seances',
        'com.samsung.shealth.vo2_max': 'vo2',
        'com.samsung.health.vo2_max': 'vo2',
        'com.samsung.shealth.vo2max': 'vo2',
    };
    const RE_NOM = /(?:^|\/)(com\.samsung\.[a-z0-9_.]+?)\.(\d{8,})\.csv$/i;
    const RE_BINNING_PAS = /(?:^|\/)jsons\/com\.samsung\.shealth\.tracker\.pedometer_day_summary\/.*\.json$/i;

    /** Le type Samsung d'un fichier d'après son nom (chemin compris), ou null. */
    const typeDuNom = (nom) => { const m = RE_NOM.exec(String(nom || '').replace(/\\/g, '/')); return m ? m[1].toLowerCase() : null; };
    /** Faut-il lire ce fichier ? (avant même de l'ouvrir : un export complet compte des milliers de fichiers) */
    const estUtile = (nom) => { const t = typeDuNom(nom); return !!(t && UTILES[t]); };
    const estBinningPas = (nom) => RE_BINNING_PAS.test(String(nom || '').replace(/\\/g, '/'));
    //  v1.26 — le détail d'une séance : « <uuid>.com.samsung.health.exercise.live_data.json » (FC, vitesse… au fil de la séance) et
    //  « <uuid>…location_data.json » (le tracé). Samsung ne publie pas le format ; selon la version de l'export, ces fichiers sont sous
    //  jsons/com.samsung.shealth.exercise/<x>/ ou ailleurs (files/…), parfois COMPRESSÉS en gzip : on les cherche partout, par leur nom.
    const RE_LIVE = /(?:^|\/)([^/.]+)\.[^/]*live_data[^/]*$/i;
    const RE_LOC = /(?:^|\/)([^/.]+)\.[^/]*location_data[^/]*$/i;
    const estLiveData = (nom) => { const n = String(nom || '').replace(/\\/g, '/'); return RE_LIVE.test(n) || RE_LOC.test(n); };
    /** Le texte d'un fichier lu en octets : décompressé s'il est en gzip (1f 8b), sinon décodé tel quel (UTF-8). */
    async function texteDe(octets) {
        const u = octets instanceof Uint8Array ? octets : new Uint8Array(octets);
        if (u.length > 2 && u[0] === 0x1f && u[1] === 0x8b && typeof DecompressionStream !== 'undefined') {
            try { return new TextDecoder().decode(new Uint8Array(await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer())); }
            catch (e) { return ''; }
        }
        return new TextDecoder().decode(u);
    }
    const estExportSamsung = (nom) => !!typeDuNom(nom) || /(?:^|\/)(jsons|files)\/com\.samsung\./i.test(String(nom || '').replace(/\\/g, '/'));

    /** CSV (guillemets, virgules et retours à la ligne dans les champs, BOM). */
    function csvLignes(texte) {
        const t = String(texte || '').replace(/^﻿/, ''), lignes = [];
        let champ = '', ligne = [], guil = false;
        for (let i = 0; i < t.length; i++) {
            const c = t[i];
            if (guil) { if (c === '"') { if (t[i + 1] === '"') { champ += '"'; i++; } else guil = false; } else champ += c; continue; }
            if (c === '"') guil = true;
            else if (c === ',') { ligne.push(champ); champ = ''; }
            else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; ligne.push(champ); champ = ''; if (ligne.some(x => x !== '')) lignes.push(ligne); ligne = []; }
            else champ += c;
        }
        ligne.push(champ); if (ligne.some(x => x !== '')) lignes.push(ligne);
        return lignes;
    }
    /** Une table Samsung : saute la ligne de description, lit l'en-tête ; col('weight') trouve aussi « com.samsung.health.weight.weight ». */
    function table(texte) {
        const l = csvLignes(texte);
        const desc = l.length && /^com\.samsung\./i.test(l[0][0] || '') && l[0].length <= 4 ? 1 : 0;
        const tete = (l[desc] || []).map(h => h.trim());
        const index = (nom) => { let i = tete.indexOf(nom); if (i < 0) i = tete.findIndex(h => h.endsWith('.' + nom)); return i; };
        return { tete, lignes: l.slice(desc + 1), col: index };
    }
    const num = (v) => { if (v === undefined || v === null || String(v).trim() === '') return null; const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
    //  « UTC+0100 », « UTC+01:00 », « UTC-5 », « GMT » → minutes
    const decalage = (s) => {
        const m = /^(?:UTC|GMT)\s*(?:([+-])(\d{1,2}):?(\d{2})?)?$/i.exec(String(s || '').trim());
        if (!m) return null; if (!m[1]) return 0;
        return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] || 0));
    };
    //  « 2026-11-01 06:12:00.000 » (UTC) + décalage → date LOCALE « 2026-11-01 »
    const dateLocale = (s, dec, defaut) => {
        const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(s || '').trim());
        if (!m) return null;
        const ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) + 60000 * (dec ?? defaut ?? 0);
        return new Date(ms).toISOString().slice(0, 10);
    };
    const msDe = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(s || '').trim()); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) : null; };
    //  day_time : « 2026-11-01 00:00:00.000 » (minuit local) ou, dans les vieux exports, des millisecondes
    const dateDuJour = (s) => { const v = String(s || '').trim(); if (/^\d{12,13}$/.test(v)) return new Date(Number(v)).toISOString().slice(0, 10); return /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null; };

    /**
     * v1.27 — L'EXTRACTEUR PAS À PAS. « ÇA SE BLOQUE APRÈS AVOIR IMPORTÉ LE DOSSIER EN ENTIER » : tout l'export était chargé en
     * mémoire d'un coup (la fréquence cardiaque de plusieurs années pèse des centaines de Mo) et l'onglet du téléphone mourait.
     * Désormais chaque fichier est lu À SON TOUR, ligne par ligne (en flux pour les gros CSV), réduit aussitôt à ce que l'appli
     * garde (un total par jour, une mesure, une séance), puis oublié. Les CSV peuvent arriver dans n'importe quel ordre :
     * ce qui dépend d'un autre fichier (la ligne « combinée » des pas, le détail d'une séance) est résolu à la fin.
     * options.decalageMin : décalage horaire (minutes) pour les rares dates sans time_offset ; options.fcMax : FC max (zones).
     */
    function creerExtracteur(options) {
        const defaut = options && Number.isFinite(options.decalageMin) ? options.decalageMin : 0;
        const fcMax = options && Number.isFinite(options.fcMax) && options.fcMax > 100 ? options.fcMax : null;
        const lus = {}, sources = {}, combines = new Set();
        const pasL = { pas: [], pas_tendance: [], activite_jour: [] };
        const kcal = {}, pesees = {}, fc = {}, sommeil = {}, compo = {}, vo2 = {}, seances = {}, binning = {};
        //  v1.28 — « MÊME COMPORTEMENT » : le détail minute par minute de TOUTES les séances (des milliers de fichiers sur des années)
        //  était gardé jusqu'à la fin : des centaines de Mo. Chaque détail est désormais réduit à son résultat (zones, temps par km)
        //  dès sa lecture ; seuls restent, en attendant leur moitié, la FC d'une séance sans distance (toutes les 10 s) ou un tracé.
        const detail = {}, fcSeule = {}, traceSeul = {};
        const espacer = (pts, ms) => { let dernier = -Infinity; return pts.filter((p, i) => { if (p.t - dernier >= ms || i === pts.length - 1) { dernier = p.t; return true; } return false; }); };
        const COMPO = [['graisse_pct', 'body_fat', 2, 75], ['graisse_kg', 'body_fat_mass', 1, 250], ['muscle_kg', 'skeletal_muscle_mass', 5, 150], ['masse_maigre_kg', 'fat_free_mass', 15, 250],
                       ['muscle_total_kg', 'muscle_mass', 10, 250], ['eau_kg', 'total_body_water', 10, 150], ['bmr_kcal', 'basal_metabolic_rate', 500, 5000], ['graisse_viscerale', 'vfa_level', 1, 60]];
        const noterVo2 = (d, v, ms) => { if (d && v !== null && v >= 10 && v <= 90 && (!vo2[d] || ms >= vo2[d].ms)) vo2[d] = { ms, v: Math.round(v * 10) / 10 }; };
        const loc_ = (r, iS, iO) => dateLocale(r[iS], iO >= 0 ? decalage(r[iO]) : null, defaut);

        //  pour chaque type : (col) => (ligne) => void — col(nom) trouve aussi « com.samsung.health.weight.weight »
        const TRAITER = {
            appareils: (c) => { const u = c('deviceuuid'), g = c('device_group'); return (r) => { if (u >= 0 && g >= 0 && String(r[g]).trim() === '0') combines.add(r[u]); }; },
            pas: (c) => pasLigne('pas', c, 'step_count', (r) => { const u = c('deviceuuid'), s = c('source_info'); return { uuid: u >= 0 ? r[u] : '', src: s >= 0 && String(r[s]).trim() !== '' }; }),
            pas_tendance: (c) => pasLigne('pas_tendance', c, 'count', (r) => { const s = c('source_type'); return { pref: s >= 0 && String(r[s]).trim() === '-2' }; }),
            activite_jour: (c) => pasLigne('activite_jour', c, 'step_count', () => ({})),
            calories: (c) => { const iD = c('day_time'), iA = c('active_calorie'); return (r) => { const d = dateDuJour(r[iD]), a = num(r[iA]); if (d && a !== null && (kcal[d] === undefined || a > kcal[d])) kcal[d] = a; }; },
            poids: (c) => {
                const iS = c('start_time'), iO = c('time_offset'), iW = c('weight'), compoL = ligneCompo(c);
                return (r) => { const kg = num(r[iW]), d = loc_(r, iS, iO), ms = msDe(r[iS]); compoL(r);
                                if (!d || kg === null || kg < 20 || kg > 400) return; if (!pesees[d] || ms >= pesees[d].ms) pesees[d] = { ms, kg: Math.round(kg * 10) / 10 }; };
            },
            compo: (c) => ligneCompo(c),
            fc: (c) => { const iS = c('start_time'), iO = c('time_offset'), iH = c('heart_rate'); return (r) => { const h = num(r[iH]), d = loc_(r, iS, iO); if (!d || !h || h < 25 || h > 230) return; const a = fc[d] || (fc[d] = [0, 0]); a[0] += h; a[1]++; }; },
            sommeil: (c) => { const iC = c('combined_id'), iN = c('nap_score'); return ligneSommeil(c, (r) => (iC >= 0 && String(r[iC]).trim() !== '') || (iN >= 0 && num(r[iN]) > 0)); },
            sommeil_combine: (c) => ligneSommeil(c, () => false),
            vo2: (c) => { const iS = c('start_time'), iO = c('time_offset'), iV = [c('vo2_max'), c('vo2max'), c('value')].find(i => i >= 0) ?? -1; return (r) => noterVo2(loc_(r, iS, iO), iV >= 0 ? num(r[iV]) : null, msDe(r[iS])); },
            seances: (c) => {
                const iS = c('start_time'), iE = c('end_time'), iO = c('time_offset'), iT = c('exercise_type'), iDu = c('duration'), iDi = c('distance'), iK = c('calorie'),
                      iFm = c('mean_heart_rate'), iFx = c('max_heart_rate'), iFn = c('min_heart_rate'), iVm = c('mean_speed'), iVx = c('max_speed'), iAg = c('altitude_gain'),
                      iN = c('count'), iNt = c('count_type'), iU = c('datauuid'), iL = c('live_data'), iV = [c('vo2_max'), c('vo2max')].find(i => i >= 0) ?? -1, iTi = [c('title'), c('custom_type')].find(i => i >= 0) ?? -1;
                return (r) => {
                    const dec = iO >= 0 ? decalage(r[iO]) : null, d = dateLocale(r[iS], dec, defaut), debut = msDe(r[iS]); if (!d || debut === null) return;
                    const fin = iE >= 0 ? msDe(r[iE]) : null;
                    let duree = iDu >= 0 ? num(r[iDu]) : null; duree = duree !== null && duree > 0 ? duree / 1000 : (fin && fin > debut ? (fin - debut) / 1000 : null);
                    if (!duree || duree < 60 || duree > 24 * 3600) return;
                    const type = iT >= 0 ? num(r[iT]) : null, uuid = iU >= 0 ? String(r[iU] || '').trim() : '';
                    const s = { id: uuid || 'S' + debut, date: d, heure: new Date(debut + 60000 * (dec ?? defaut)).toISOString().slice(11, 16), type, nom: nomSeance(type, iTi >= 0 ? r[iTi] : ''), duree_s: Math.round(duree) };
                    const pose = (k, i, f = 1, a = 0, b = Infinity, dec1 = 0) => { const v = i >= 0 ? num(r[i]) : null; if (v !== null && v * f >= a && v * f <= b) s[k] = dec1 ? Math.round(v * f * 10 ** dec1) / 10 ** dec1 : Math.round(v * f); };
                    pose('distance_m', iDi, 1, 1, 500000); pose('kcal', iK, 1, 1, 10000); pose('fc_moy', iFm, 1, 30, 230); pose('fc_max', iFx, 1, 30, 240); pose('fc_min', iFn, 1, 25, 230);
                    pose('vitesse_kmh', iVm, 3.6, 0.1, 120, 1); pose('vitesse_max_kmh', iVx, 3.6, 0.1, 150, 1); pose('denivele_m', iAg, 1, 0, 10000);
                    if (iN >= 0 && (iNt < 0 || /^(30001|0|1)?$/.test(String(r[iNt]).trim()))) pose('pas', iN, 1, 1, 200000);   // count_type 30001 = pas
                    if (iV >= 0) { const v = num(r[iV]); if (v !== null && v >= 10 && v <= 90) { s.vo2max = Math.round(v * 10) / 10; noterVo2(d, v, debut); } }
                    s._cle = uuid.toLowerCase() || (iL >= 0 ? String(r[iL] || '').split('.')[0].toLowerCase() : ''); s._debut = debut;
                    if (s.distance_m && !s.vitesse_kmh) s.vitesse_kmh = Math.round(s.distance_m / s.duree_s * 36) / 10;
                    seances[s.id] = s;
                };
            },
        };
        function pasLigne(cle, c, colPas, extra) {
            const iD = c('day_time'), iP = c(colPas), iK = c('calorie');
            return (r) => { const d = dateDuJour(r[iD]), p = num(r[iP]); if (!d || p === null) return; pasL[cle].push({ d, p, kcal: iK >= 0 ? num(r[iK]) : null, ...extra(r) }); };
        }
        function ligneCompo(c) {
            const iS = c('start_time'), iO = c('time_offset'), iW = c('weight'), cols = COMPO.map(([k, n, a, b]) => [k, c(n), a, b]);
            if (!cols.some(([, i]) => i >= 0)) return () => {};
            return (r) => {
                const d = loc_(r, iS, iO), ms = msDe(r[iS]); if (!d) return;
                const m = {}; cols.forEach(([k, i, a, b]) => { const v = i >= 0 ? num(r[i]) : null; if (v !== null && v >= a && v <= b) m[k] = Math.round(v * 10) / 10; });
                if (!Object.keys(m).length) return;
                const kg = iW >= 0 ? num(r[iW]) : null; if (kg !== null && kg >= 20 && kg <= 400) m.kg = Math.round(kg * 10) / 10;
                if (!compo[d] || ms >= compo[d].ms) compo[d] = { ms, ...m };
            };
        }
        function ligneSommeil(c, ignorer) {
            const iS = c('start_time'), iE = c('end_time'), iO = c('time_offset'), iD = c('sleep_duration');
            return (r) => {
                if (ignorer(r)) return;
                const d = dateLocale(r[iE], iO >= 0 ? decalage(r[iO]) : null, defaut); if (!d) return;
                let min = iD >= 0 ? num(r[iD]) : null;
                if (!min) { const a = msDe(r[iS]), b = msDe(r[iE]); min = a !== null && b !== null && b > a ? (b - a) / 60000 : null; }
                if (min && min > 0 && min < 24 * 60) sommeil[d] = (sommeil[d] || 0) + min;
            };
        }
        //  un CSV, ligne après ligne : la 1re (« com.samsung…,version,n ») est sautée, la suivante est l'en-tête
        function lecteurCsv(cle) {
            let etape = 0, tete = null, f = null;
            return (ligne) => {
                if (etape === 0) { etape = 1; if (/^com\.samsung\./i.test(ligne[0] || '') && ligne.length <= 4) return; }
                if (etape === 1) { tete = ligne.map(h => h.trim()); const col = (nom) => { let i = tete.indexOf(nom); if (i < 0) i = tete.findIndex(h => h.endsWith('.' + nom)); return i; }; f = TRAITER[cle](col); etape = 2; return; }
                lus[cle] = (lus[cle] || 0) + 1; f(ligne);
            };
        }
        const cleDe = (nom) => { const t = typeDuNom(nom); return t && UTILES[t] ? UTILES[t] : null; };
        const petitFichier = (nom, texte) => {
            const n = String(nom || '').replace(/\\/g, '/'); let m;
            if ((m = RE_LIVE.exec(n))) {
                const cle = m[1].toLowerCase(); let pts = pointsLive(texte);
                const aDistance = pts.some(p => p.d !== null) || pts.filter(p => p.v !== null).length >= 2;
                if (!aDistance && traceSeul[cle]) { pts = pts.concat(traceSeul[cle]).sort((a, b) => a.t - b.t); delete traceSeul[cle]; }
                detail[cle] = detailPoints(pts, null, fcMax);
                if (!aDistance && !detail[cle].par_km) fcSeule[cle] = espacer(pts.filter(p => p.fc !== null).map(p => ({ t: p.t, fc: p.fc, d: null, v: null })), 10000);
                return true;
            }
            if ((m = RE_LOC.exec(n))) {
                const cle = m[1].toLowerCase(), tr = pointsLoc(texte); if (tr.length < 2) return true;
                if (fcSeule[cle]) { detail[cle] = detailPoints(fcSeule[cle].concat(tr).sort((a, b) => a.t - b.t), null, fcMax); delete fcSeule[cle]; }
                else if (!detail[cle] || !detail[cle].par_km) traceSeul[cle] = tr;
                return true;
            }
            if (estBinningPas(n)) {
                let items; try { items = JSON.parse(texte); } catch (e) { return true; }
                if (!Array.isArray(items)) return true;
                const somme = {};
                items.forEach(it => { const ms = num(it && it.start_time), p = num(it && (it.mStepCount ?? it.step_count)); if (ms === null || p === null) return; const d = new Date(ms + 60000 * defaut).toISOString().slice(0, 10); somme[d] = (somme[d] || 0) + p; });
                Object.entries(somme).forEach(([d, p]) => { if (!binning[d] || p > binning[d]) binning[d] = p; });
                lus.detail_pas = (lus.detail_pas || 0) + 1;
                return true;
            }
            return false;
        };
        return {
            /** un fichier déjà en texte (petit fichier, ou tests) */
            ajouterTexte(nom, texte) {
                if (petitFichier(nom, texte)) return;
                const cle = cleDe(nom); if (!cle) return;
                const l = lecteurCsv(cle); csvLignes(texte).forEach(l);
            },
            /** un gros CSV lu en FLUX (ReadableStream d'octets) : jamais entier en mémoire. → nombre de lignes */
            async ajouterFlux(nom, flux) {
                const cle = cleDe(nom); if (!cle) { if (estLiveData(nom) || estBinningPas(nom)) this.ajouterTexte(nom, await texteDe(new Uint8Array(await new Response(flux).arrayBuffer()))); return; }
                const l = lecteurCsv(cle), p = analyseurCsv(l), dec = new TextDecoder(), lecteur = flux.getReader();
                for (;;) { const { done, value } = await lecteur.read(); if (done) break; p.morceau(dec.decode(value, { stream: true })); }
                p.morceau(dec.decode()); p.fin();
            },
            resultat() {
                const jours = {}, jour = (d) => jours[d] || (jours[d] = {});
                //  pas : pedometer_day_summary (combinée > plus grande) ; à défaut step_daily_trend (source -2 > plus grande), puis activity.day_summary
                const meilleurs = (rows, prefere) => { const best = {}; rows.forEach(x => { const k = [prefere(x) ? 1 : 0, x.p]; if (!best[x.d] || k[0] > best[x.d].k[0] || (k[0] === best[x.d].k[0] && k[1] > best[x.d].k[1])) best[x.d] = { k, pas: x.p, kcal: x.kcal }; }); return best; };
                const pasPed = meilleurs(pasL.pas, (x) => combines.has(x.uuid) || x.src), pasTend = meilleurs(pasL.pas_tendance, (x) => x.pref), pasAct = meilleurs(pasL.activite_jour, () => false);
                [[pasAct, 'activity.day_summary'], [pasTend, 'step_daily_trend'], [pasPed, 'pedometer_day_summary']].forEach(([b, src]) => Object.entries(b).forEach(([d, x]) => { jour(d).pas = Math.round(x.pas); sources.pas = src; if (x.kcal !== null && src === 'pedometer_day_summary') jour(d)._kcalMarche = x.kcal; }));
                Object.entries(jours).forEach(([d, j]) => { if (j._kcalMarche !== undefined && kcal[d] === undefined) j.kcal_actives = Math.round(j._kcalMarche); delete j._kcalMarche; });
                Object.entries(kcal).forEach(([d, a]) => { jour(d).kcal_actives = Math.round(a); sources.kcal_actives = 'calories_burned.details'; });
                Object.entries(pesees).forEach(([d, p]) => { jour(d).poids = p.kg; });
                Object.entries(fc).forEach(([d, a]) => { jour(d).fc_moy = Math.round(a[0] / a[1]); });
                Object.entries(sommeil).forEach(([d, m]) => { jour(d).sommeil_min = Math.round(m); });
                //  secours : aucun CSV de pas, mais le détail par 10 min (jsons/…pedometer_day_summary/)
                if (!Object.values(jours).some(j => j.pas !== undefined)) Object.entries(binning).forEach(([d, p]) => { jour(d).pas = Math.round(p); sources.pas = 'jsons (détail 10 min)'; });
                const ss = Object.values(seances).map(s => { const { _cle, _debut, ...x } = s;
                    if (detail[_cle]) Object.assign(x, detail[_cle]); else if (traceSeul[_cle]) Object.assign(x, detailPoints(traceSeul[_cle], _debut, fcMax)); return x; });
                return { jours, pesees: Object.entries(pesees).map(([date, p]) => ({ date, kg: p.kg })).sort((a, b) => a.date < b.date ? -1 : 1), lus, sources,
                         compo: Object.entries(compo).map(([date, x]) => { const { ms, ...m } = x; return { date, ...m }; }).sort((a, b) => a.date < b.date ? -1 : 1),
                         vo2: Object.entries(vo2).map(([date, x]) => ({ date, vo2max: x.v })).sort((a, b) => a.date < b.date ? -1 : 1),
                         seances: ss.sort((a, b) => (a.date + a.heure) < (b.date + b.heure) ? -1 : 1) };
            },
        };
    }

    /**
     * v1.27 — un analyseur CSV PAR MORCEAUX : on découpe aux fins de ligne qui ne sont pas entre guillemets (nombre pair de guillemets
     * depuis le début de l'enregistrement) ; une ligne sans guillemet est découpée aux virgules (rapide sur des centaines de Mo), une
     * ligne avec guillemets passe par csvLignes. ligne(champs) est appelée pour chaque enregistrement non vide.
     */
    function analyseurCsv(ligne) {
        let buf = '', scan = 0, q = 0, debut = true;
        const traiter = (rec) => { if (rec.endsWith('\r')) rec = rec.slice(0, -1); if (rec.indexOf('"') < 0) { const l = rec.split(','); if (l.some(x => x !== '')) ligne(l); } else csvLignes(rec).forEach(ligne); };
        return {
            morceau(t) {
                if (debut) { t = t.replace(/^\ufeff/, ''); debut = false; }
                buf += t;
                let rs = 0;
                for (;;) {
                    const nl = buf.indexOf('\n', scan);
                    if (nl < 0) { for (let k = buf.indexOf('"', scan); k >= 0; k = buf.indexOf('"', k + 1)) q++; scan = buf.length; break; }
                    for (let k = buf.indexOf('"', scan); k >= 0 && k < nl; k = buf.indexOf('"', k + 1)) q++;
                    scan = nl + 1;
                    if (q % 2 === 0) { traiter(buf.slice(rs, nl)); rs = nl + 1; q = 0; }
                }
                if (rs) { buf = buf.slice(rs); scan -= rs; }
            },
            fin() { if (buf !== '') traiter(buf); buf = ''; scan = 0; q = 0; },
        };
    }

    /** Compatibilité : tout l'export déjà en texte (tests, petits envois). Même résultat que l'extracteur pas à pas. */
    function extraire(fichiers, options) {
        const ex = creerExtracteur(options);
        (fichiers || []).forEach(f => ex.ajouterTexte(f.nom, f.texte));
        return ex.resultat();
    }

    //  v1.26 — le nom d'une séance d'après son code Samsung (codes publiés du SDK Samsung Health) ; inconnu : on le dit, on ne devine pas
    const TYPES_SEANCE = { 1001: 'Marche', 1002: 'Course', 11007: 'Vélo', 13001: 'Randonnée', 14001: 'Natation', 9002: 'Yoga', 0: 'Séance personnalisée' };
    function nomSeance(type, titre) {
        const t = String(titre || '').trim();
        if (t && !/^\d+$/.test(t)) return t.slice(0, 40);
        return type !== null && TYPES_SEANCE[type] ? TYPES_SEANCE[type] : (type !== null ? 'Séance (type ' + type + ')' : 'Séance');
    }

    /**
     * v1.26 — le détail d'une séance (live_data : [{ start_time (ms), heart_rate, speed (m/s), distance (m) … }]) →
     * zones de FC (secondes par zone, en % de la FC max : < 60, 60-70, 70-80, 80-90, ≥ 90) et temps par km (+ le reste).
     * La distance du détail est cumulée (croissante) ou par intervalle : les deux sont reconnues.
     */
    const lireJson = (t) => { try { const x = JSON.parse(t || '[]'); return Array.isArray(x) ? x : []; } catch (e) { return []; } };
    /** v1.28 — les points du détail d'une séance (live_data) : [{ t, fc, d, v }] triés. */
    const pointsLive = (texte) => lireJson(texte).map(it => ({ t: num(it && it.start_time), fc: num(it && it.heart_rate), d: num(it && it.distance), v: num(it && it.speed) })).filter(p => p.t !== null).sort((a, b) => a.t - b.t);
    /** v1.28 — le tracé (location_data) → distance CUMULÉE [{ t, fc: null, d }], un point toutes les 10 s au plus (léger en mémoire). */
    function pointsLoc(texte) {
        const g = lireJson(texte).map(it => ({ t: num(it && it.start_time), la: num(it && it.latitude), lo: num(it && it.longitude) })).filter(p => p.t !== null && p.la !== null && p.lo !== null).sort((a, b) => a.t - b.t);
        if (g.length < 2) return [];
        const rad = Math.PI / 180; let c = 0, dernier = -Infinity; const out = [];
        g.forEach((p, i) => {
            if (i) { const a = g[i - 1], x = Math.sin((p.la - a.la) * rad / 2) ** 2 + Math.cos(a.la * rad) * Math.cos(p.la * rad) * Math.sin((p.lo - a.lo) * rad / 2) ** 2; c += 2 * 6371000 * Math.asin(Math.sqrt(x)); }
            if (p.t - dernier >= 10000 || i === g.length - 1) { out.push({ t: p.t, fc: null, d: c }); dernier = p.t; }
        });
        return out;
    }
    function detailSeance(texte, debut, fcMax, texteLoc) {
        let pts = pointsLive(texte);
        //  la distance au fil de la séance : la clé « distance » du détail si elle existe ; sinon le TRACÉ (location_data : latitude,
        //  longitude) ; sinon la vitesse (m/s) intégrée dans le temps. Aucune des trois : pas de temps par km (rien d'inventé).
        if (!pts.some(p => p.d !== null) && texteLoc) { const tr = pointsLoc(texteLoc); if (tr.length >= 2) pts = pts.concat(tr).sort((a, b) => a.t - b.t); }
        return detailPoints(pts, debut, fcMax);
    }
    /** v1.28 — zones de FC et temps par km à partir de points [{ t, fc, d, v }] (distance absente : la vitesse intégrée). */
    function detailPoints(pts, debut, fcMax) {
        if (!pts.some(p => p.d !== null) && pts.filter(p => p.v !== null).length >= 2) {
            let c = 0, tPrec = null;
            pts.forEach(p => { if (p.v !== null && p.v >= 0) { if (tPrec !== null) c += p.v * Math.min(60, (p.t - tPrec) / 1000); tPrec = p.t; p.d = c; } });
        }
        if (!pts.length) return {};
        const out = {};
        const fcs = pts.filter(p => p.fc !== null && p.fc >= 30 && p.fc <= 240);
        if (fcs.length >= 2) {
            const fmax = fcMax || null;
            if (fmax) {
                const z = [0, 0, 0, 0, 0];
                fcs.forEach((p, i) => { const dt = i + 1 < fcs.length ? Math.min(60, (fcs[i + 1].t - p.t) / 1000) : 1; const pc = p.fc / fmax; z[pc < 0.6 ? 0 : pc < 0.7 ? 1 : pc < 0.8 ? 2 : pc < 0.9 ? 3 : 4] += dt; });
                out.zones_s = z.map(Math.round); out.fc_max_ref = fmax;
            }
        }
        const ds = pts.filter(p => p.d !== null && p.d >= 0);
        if (ds.length >= 2) {
            const croissante = ds.every((p, i) => i === 0 || p.d >= ds[i - 1].d);
            let cumul = 0; const tl = ds.map(p => { cumul = croissante ? p.d : cumul + p.d; return { t: p.t, d: cumul }; });
            const km = []; let k = 1, tPrec = Math.min(debut || tl[0].t, tl[0].t), dPrec = 0;
            for (let i = 1; i < tl.length; i++) {
                while (tl[i].d >= k * 1000) {
                    const a = tl[i - 1], b = tl[i], f = b.d > a.d ? (k * 1000 - a.d) / (b.d - a.d) : 1, tk = a.t + f * (b.t - a.t);
                    const seg = fcs.filter(p => p.t >= tPrec && p.t <= tk);
                    km.push({ km: 1, duree_s: Math.round((tk - tPrec) / 1000), fc: seg.length ? Math.round(seg.reduce((s, p) => s + p.fc, 0) / seg.length) : null });
                    tPrec = tk; dPrec = k * 1000; k++;
                }
            }
            const der = tl[tl.length - 1], reste = der.d - dPrec;
            if (reste >= 50) { const seg = fcs.filter(p => p.t >= tPrec); km.push({ km: Math.round(reste) / 1000, duree_s: Math.round((der.t - tPrec) / 1000), fc: seg.length ? Math.round(seg.reduce((s, p) => s + p.fc, 0) / seg.length) : null }); }
            if (km.length) out.par_km = km.slice(0, 200);
        }
        return out;
    }

    /**
     * v1.30 — PARCOURIR un .zip EN UNE SEULE LECTURE, du début à la fin. Sur Android, un fichier choisi dans « Mes fichiers » se lit
     * mal par sauts (chaque saut peut relire le fichier depuis le début) : la v1.27 sautait d'une entrée à l'autre (des milliers de
     * fois) et l'import ne finissait pas. Désormais : deux petites lectures (la fin du fichier, le répertoire central) pour savoir où
     * sont les entrées utiles, puis UN flux séquentiel ; chaque entrée retenue est passée, décompressée, à traiter(nom, flux) au fil de
     * l'eau, avec contre-pression (rien ne s'accumule en mémoire). Zip64 pris en charge. source : Blob / File, ou ArrayBuffer / Uint8Array.
     * options.progres(lus, total) : appelée au fil de la lecture (octets).
     */
    async function parcourirZip(source, garder, traiter, options) {
        const blob = source instanceof Blob ? source : new Blob([source instanceof ArrayBuffer ? new Uint8Array(source) : source]);
        const lire = async (a, b) => new DataView(await blob.slice(a, b).arrayBuffer());
        const taille = blob.size, queue = await lire(Math.max(0, taille - 65557), taille);
        let e = -1;
        for (let i = queue.byteLength - 22; i >= 0; i--) if (queue.getUint32(i, true) === 0x06054b50) { e = i; break; }
        if (e < 0) throw new Error('ce fichier n’est pas un .zip lisible');
        let total = queue.getUint16(e + 10, true), cdTaille = queue.getUint32(e + 12, true), cd = queue.getUint32(e + 16, true);
        if ((total === 0xffff || cd === 0xffffffff || cdTaille === 0xffffffff) && e >= 20 && queue.getUint32(e - 20, true) === 0x07064b50) {
            const z = Number(queue.getBigUint64(e - 20 + 8, true)), r = await lire(z, z + 56);
            if (r.getUint32(0, true) === 0x06064b50) { total = Number(r.getBigUint64(32, true)); cdTaille = Number(r.getBigUint64(40, true)); cd = Number(r.getBigUint64(48, true)); }
        }
        const rep = await lire(cd, cd + cdTaille), dec = new TextDecoder(), entrees = [];
        let o = 0;
        for (let k = 0; k < total && o + 46 <= rep.byteLength; k++) {
            if (rep.getUint32(o, true) !== 0x02014b50) break;
            const methode = rep.getUint16(o + 10, true), lnom = rep.getUint16(o + 28, true), lext = rep.getUint16(o + 30, true), lcom = rep.getUint16(o + 32, true);
            let tailleC = rep.getUint32(o + 20, true), local = rep.getUint32(o + 42, true);
            const nom = dec.decode(new Uint8Array(rep.buffer, rep.byteOffset + o + 46, lnom));
            if (tailleC === 0xffffffff || local === 0xffffffff) {          // champ supplémentaire zip64 (0x0001)
                let x = o + 46 + lnom; const fin = x + lext;
                while (x + 4 <= fin) {
                    const id = rep.getUint16(x, true), l = rep.getUint16(x + 2, true);
                    if (id === 0x0001) { let y = x + 4; if (rep.getUint32(o + 24, true) === 0xffffffff) y += 8; if (tailleC === 0xffffffff) { tailleC = Number(rep.getBigUint64(y, true)); y += 8; } if (local === 0xffffffff) local = Number(rep.getBigUint64(y, true)); break; }
                    x += 4 + l;
                }
            }
            o += 46 + lnom + lext + lcom;
            if (!nom.endsWith('/') && (methode === 0 || methode === 8) && garder(nom)) entrees.push({ nom, methode, tailleC, local });
        }
        if (!entrees.length) return 0;
        entrees.sort((a, b) => a.local - b.local);
        //  le flux séquentiel : on avance octet par octet dans le fichier, une entrée utile après l'autre
        const lecteur = blob.slice(entrees[0].local).stream().getReader(), progres = options && options.progres;
        let pos = entrees[0].local, k = 0, etat = 'attente', entete = new Uint8Array(30), nEntete = 0, aSauter = 0, reste = 0, ecrivain = null, fini = null;
        const ouvrir = async () => {
            const x = entrees[k], ts = new TransformStream({}, { highWaterMark: 4 });
            ecrivain = ts.writable.getWriter();
            const lisible = x.methode === 8 ? ts.readable.pipeThrough(new DecompressionStream('deflate-raw')) : ts.readable;
            fini = Promise.resolve(traiter(x.nom, lisible));
        };
        const fermer = async () => { await ecrivain.close(); await fini; ecrivain = null; fini = null; k++; etat = 'attente'; nEntete = 0; };
        let dernierProgres = 0;
        while (k < entrees.length) {
            const { done, value } = await lecteur.read();
            if (done) break;
            let i = 0;
            while (i < value.length && k < entrees.length) {
                const x = entrees[k];
                if (etat === 'attente') { const saut = x.local - (pos + i); if (saut > 0) { i += Math.min(saut, value.length - i); continue; } etat = 'entete'; }
                if (etat === 'entete') {
                    const n = Math.min(30 - nEntete, value.length - i); entete.set(value.subarray(i, i + n), nEntete); nEntete += n; i += n;
                    if (nEntete < 30) continue;
                    const dv = new DataView(entete.buffer); aSauter = dv.getUint16(26, true) + dv.getUint16(28, true); reste = x.tailleC; etat = 'saut';
                }
                if (etat === 'saut') { const n = Math.min(aSauter, value.length - i); aSauter -= n; i += n; if (aSauter > 0) continue; etat = 'donnees'; await ouvrir(); if (reste === 0) { await fermer(); continue; } }
                if (etat === 'donnees') {
                    const n = Math.min(reste, value.length - i);
                    await ecrivain.ready; await ecrivain.write(value.slice(i, i + n));   // une copie : le morceau du lecteur peut être réutilisé
                    reste -= n; i += n;
                    if (reste === 0) await fermer();
                }
            }
            pos += value.length;
            if (progres && (pos - dernierProgres > 4e6 || k >= entrees.length)) { dernierProgres = pos; await progres(pos, taille); }
        }
        try { await lecteur.cancel(); } catch (e) { /* déjà fini */ }
        if (ecrivain) await fermer();
        return k;
    }

    /** Compatibilité : les entrées retenues, en texte (le détail de séance gzip décompressé). → [{ nom, texte }] */
    async function lireZip(octets, garder) {
        const sortie = [];
        await parcourirZip(octets, garder, async (nom, flux) => { const u = new Uint8Array(await new Response(flux).arrayBuffer()); sortie.push({ nom, texte: estLiveData(nom) ? await texteDe(u) : new TextDecoder().decode(u) }); });
        return sortie;
    }

    return { UTILES, typeDuNom, estUtile, estBinningPas, estLiveData, texteDe, estExportSamsung, csvLignes, table, decalage, dateLocale, extraire, creerExtracteur, analyseurCsv, parcourirZip, lireZip, detailSeance, detailPoints, pointsLive, pointsLoc, nomSeance };
});
