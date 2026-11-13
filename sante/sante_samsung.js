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
     * fichiers : [{ nom, texte }] (CSV de l'export, et éventuellement les JSON de jsons/…pedometer_day_summary/)
     * options.decalageMin : décalage horaire du navigateur (minutes), pour les rares dates sans time_offset
     * → { jours: { 'AAAA-MM-JJ': { pas, kcal_actives, fc_moy, sommeil_min, poids } }, pesees: [{date, kg}], lus: {type: n lignes}, sources: {...} }
     */
    function extraire(fichiers, options) {
        const defaut = options && Number.isFinite(options.decalageMin) ? options.decalageMin : 0;
        const parType = {};
        (fichiers || []).forEach(f => { const t = typeDuNom(f.nom); if (t && UTILES[t]) (parType[UTILES[t]] = parType[UTILES[t]] || []).push(f); });
        const lus = {}, jours = {}, pesees = {}, sources = {};
        const jour = (d) => jours[d] || (jours[d] = {});
        const chaque = (cle, fn) => (parType[cle] || []).forEach(f => { const t = table(f.texte); lus[cle] = (lus[cle] || 0) + t.lignes.length; fn(t); });

        //  appareils : quelle deviceuuid est la ligne « combinée » (device_group 0)
        const combines = new Set();
        chaque('appareils', (t) => { const u = t.col('deviceuuid'), g = t.col('device_group'); t.lignes.forEach(r => { if (u >= 0 && g >= 0 && String(r[g]).trim() === '0') combines.add(r[u]); }); });

        //  pas : pedometer_day_summary (combinée > plus grande) ; à défaut step_daily_trend (source -2 > plus grande), puis activity.day_summary
        const meilleurs = (cle, colPas, prefere) => {
            const best = {};
            chaque(cle, (t) => {
                const iD = t.col('day_time'), iP = t.col(colPas), iK = t.col('calorie');
                t.lignes.forEach(r => {
                    const d = dateDuJour(r[iD]), p = num(r[iP]); if (!d || p === null) return;
                    const cleTri = [prefere(t, r) ? 1 : 0, p];
                    if (!best[d] || cleTri[0] > best[d].k[0] || (cleTri[0] === best[d].k[0] && cleTri[1] > best[d].k[1])) best[d] = { k: cleTri, pas: p, kcal: iK >= 0 ? num(r[iK]) : null };
                });
            });
            return best;
        };
        const pasPed = meilleurs('pas', 'step_count', (t, r) => { const u = t.col('deviceuuid'), s = t.col('source_info'); return (u >= 0 && combines.has(r[u])) || (s >= 0 && String(r[s]).trim() !== ''); });
        const pasTend = meilleurs('pas_tendance', 'count', (t, r) => { const s = t.col('source_type'); return s >= 0 && String(r[s]).trim() === '-2'; });
        const pasAct = meilleurs('activite_jour', 'step_count', () => false);
        [[pasAct, 'activity.day_summary'], [pasTend, 'step_daily_trend'], [pasPed, 'pedometer_day_summary']].forEach(([b, src]) => Object.entries(b).forEach(([d, x]) => { jour(d).pas = Math.round(x.pas); sources.pas = src; if (x.kcal !== null && src === 'pedometer_day_summary') jour(d)._kcalMarche = x.kcal; }));

        //  kcal actives : calories_burned.details (active_calorie, la plus grande du jour) ; à défaut, les kcal de marche du podomètre
        const kcal = {};
        chaque('calories', (t) => { const iD = t.col('day_time'), iA = t.col('active_calorie'); t.lignes.forEach(r => { const d = dateDuJour(r[iD]), a = num(r[iA]); if (d && a !== null && (kcal[d] === undefined || a > kcal[d])) kcal[d] = a; }); });
        Object.entries(jours).forEach(([d, j]) => { if (j._kcalMarche !== undefined && kcal[d] === undefined) j.kcal_actives = Math.round(j._kcalMarche); delete j._kcalMarche; });
        Object.entries(kcal).forEach(([d, a]) => { jour(d).kcal_actives = Math.round(a); sources.kcal_actives = 'calories_burned.details'; });

        //  poids : start_time (UTC) + time_offset → jour local ; la dernière pesée du jour
        chaque('poids', (t) => {
            const iS = t.col('start_time'), iO = t.col('time_offset'), iW = t.col('weight');
            t.lignes.forEach(r => { const kg = num(r[iW]), d = dateLocale(r[iS], iO >= 0 ? decalage(r[iO]) : null, defaut), ms = msDe(r[iS]); if (!d || kg === null || kg < 20 || kg > 400) return; if (!pesees[d] || ms >= pesees[d].ms) pesees[d] = { ms, kg: Math.round(kg * 10) / 10 }; });
        });
        Object.entries(pesees).forEach(([d, p]) => { jour(d).poids = p.kg; });

        //  fréquence cardiaque : moyenne du jour (lectures horaires et ponctuelles ; 0 = capteur pas prêt, écarté)
        const fc = {};
        chaque('fc', (t) => { const iS = t.col('start_time'), iO = t.col('time_offset'), iH = t.col('heart_rate'); t.lignes.forEach(r => { const h = num(r[iH]), d = dateLocale(r[iS], iO >= 0 ? decalage(r[iO]) : null, defaut); if (!d || !h || h < 25 || h > 230) return; const a = fc[d] || (fc[d] = [0, 0]); a[0] += h; a[1]++; }); });
        Object.entries(fc).forEach(([d, a]) => { jour(d).fc_moy = Math.round(a[0] / a[1]); });

        //  sommeil : par jour de RÉVEIL (date locale de end_time) ; sleep_duration si présent, sinon fin − début ;
        //  une nuit en plusieurs morceaux figure aussi dans sleep_combined : on prend la combinée, pas les morceaux ; siestes écartées
        const sommeil = {};
        const ajouterSommeil = (t, ignorer) => {
            const iS = t.col('start_time'), iE = t.col('end_time'), iO = t.col('time_offset'), iD = t.col('sleep_duration');
            t.lignes.forEach(r => {
                if (ignorer(r)) return;
                const dec = iO >= 0 ? decalage(r[iO]) : null, d = dateLocale(r[iE], dec, defaut); if (!d) return;
                let min = iD >= 0 ? num(r[iD]) : null;
                if (!min) { const a = msDe(r[iS]), b = msDe(r[iE]); min = a !== null && b !== null && b > a ? (b - a) / 60000 : null; }
                if (min && min > 0 && min < 24 * 60) sommeil[d] = (sommeil[d] || 0) + min;
            });
        };
        chaque('sommeil', (t) => { const iC = t.col('combined_id'), iN = t.col('nap_score'); ajouterSommeil(t, (r) => (iC >= 0 && String(r[iC]).trim() !== '') || (iN >= 0 && num(r[iN]) > 0)); });
        chaque('sommeil_combine', (t) => ajouterSommeil(t, () => false));
        Object.entries(sommeil).forEach(([d, m]) => { jour(d).sommeil_min = Math.round(m); });

        //  secours : pas de CSV de pas, mais le détail par 10 min (jsons/…pedometer_day_summary/) → somme par jour, max entre fichiers
        if (!Object.values(jours).some(j => j.pas !== undefined)) {
            const parJour = {};
            (fichiers || []).filter(f => estBinningPas(f.nom)).forEach(f => {
                let items; try { items = JSON.parse(f.texte); } catch (e) { return; }
                if (!Array.isArray(items)) return;
                const somme = {};
                items.forEach(it => { const ms = num(it && it.start_time), p = num(it && (it.mStepCount ?? it.step_count)); if (ms === null || p === null) return; const d = new Date(ms + 60000 * defaut).toISOString().slice(0, 10); somme[d] = (somme[d] || 0) + p; });
                Object.entries(somme).forEach(([d, p]) => { if (!parJour[d] || p > parJour[d]) parJour[d] = p; });
                lus.detail_pas = (lus.detail_pas || 0) + 1;
            });
            Object.entries(parJour).forEach(([d, p]) => { jour(d).pas = Math.round(p); sources.pas = 'jsons (détail 10 min)'; });
        }
        //  v1.26 — LA COMPOSITION CORPORELLE : dans la table des pesées (montre, balance connectée) ou dans body_composition ;
        //  la dernière mesure du jour qui porte au moins une valeur de composition
        const compo = {};
        const COMPO = [['graisse_pct', 'body_fat', 2, 75], ['graisse_kg', 'body_fat_mass', 1, 250], ['muscle_kg', 'skeletal_muscle_mass', 5, 150], ['masse_maigre_kg', 'fat_free_mass', 15, 250],
                       ['muscle_total_kg', 'muscle_mass', 10, 250], ['eau_kg', 'total_body_water', 10, 150], ['bmr_kcal', 'basal_metabolic_rate', 500, 5000], ['graisse_viscerale', 'vfa_level', 1, 60]];
        const lireCompo = (t) => {
            const iS = t.col('start_time'), iO = t.col('time_offset'), iW = t.col('weight'), cols = COMPO.map(([k, c, a, b]) => [k, t.col(c), a, b]);
            if (!cols.some(([, i]) => i >= 0)) return;
            t.lignes.forEach(r => {
                const d = dateLocale(r[iS], iO >= 0 ? decalage(r[iO]) : null, defaut), ms = msDe(r[iS]); if (!d) return;
                const m = {}; cols.forEach(([k, i, a, b]) => { const v = i >= 0 ? num(r[i]) : null; if (v !== null && v >= a && v <= b) m[k] = Math.round(v * 10) / 10; });
                if (!Object.keys(m).length) return;
                const kg = iW >= 0 ? num(r[iW]) : null; if (kg !== null && kg >= 20 && kg <= 400) m.kg = Math.round(kg * 10) / 10;
                if (!compo[d] || ms >= compo[d].ms) compo[d] = { ms, ...m };
            });
        };
        chaque('poids', lireCompo);
        chaque('compo', lireCompo);

        //  v1.26 — LE VO₂ MAX : sa table (s'il y en a une) et celui de chaque séance
        const vo2 = {};
        const noterVo2 = (d, v, ms) => { if (d && v !== null && v >= 10 && v <= 90 && (!vo2[d] || ms >= vo2[d].ms)) vo2[d] = { ms, v: Math.round(v * 10) / 10 }; };
        chaque('vo2', (t) => { const iS = t.col('start_time'), iO = t.col('time_offset'), iV = [t.col('vo2_max'), t.col('vo2max'), t.col('value')].find(i => i >= 0) ?? -1;
            t.lignes.forEach(r => noterVo2(dateLocale(r[iS], iO >= 0 ? decalage(r[iO]) : null, defaut), iV >= 0 ? num(r[iV]) : null, msDe(r[iS]))); });

        //  v1.26 — LES SÉANCES : une ligne par séance ; le détail (live_data) donne les zones de FC et les temps par km
        const live = {}, loc = {};
        (fichiers || []).forEach(f => { const n = String(f.nom || '').replace(/\\/g, '/'); let m = RE_LIVE.exec(n); if (m) live[m[1].toLowerCase()] = f.texte; else if ((m = RE_LOC.exec(n))) loc[m[1].toLowerCase()] = f.texte; });
        const fcMax = options && Number.isFinite(options.fcMax) && options.fcMax > 100 ? options.fcMax : null;
        const seances = {};
        chaque('seances', (t) => {
            const c = (n) => t.col(n);
            const iS = c('start_time'), iE = c('end_time'), iO = c('time_offset'), iT = c('exercise_type'), iDu = c('duration'), iDi = c('distance'), iK = c('calorie'),
                  iFm = c('mean_heart_rate'), iFx = c('max_heart_rate'), iFn = c('min_heart_rate'), iVm = c('mean_speed'), iVx = c('max_speed'), iAg = c('altitude_gain'),
                  iN = c('count'), iNt = c('count_type'), iU = c('datauuid'), iL = c('live_data'), iV = [c('vo2_max'), c('vo2max')].find(i => i >= 0) ?? -1, iTi = [c('title'), c('custom_type')].find(i => i >= 0) ?? -1;
            t.lignes.forEach(r => {
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
                const cle = uuid.toLowerCase() || (iL >= 0 ? String(r[iL] || '').split('.')[0].toLowerCase() : '');
                if (live[cle] || loc[cle]) Object.assign(s, detailSeance(live[cle] || '[]', debut, fcMax, loc[cle]));
                if (s.distance_m && !s.vitesse_kmh) s.vitesse_kmh = Math.round(s.distance_m / s.duree_s * 36) / 10;
                seances[s.id] = s;
            });
        });
        return { jours, pesees: Object.entries(pesees).map(([date, p]) => ({ date, kg: p.kg })).sort((a, b) => a.date < b.date ? -1 : 1), lus, sources,
                 compo: Object.entries(compo).map(([date, x]) => { const { ms, ...m } = x; return { date, ...m }; }).sort((a, b) => a.date < b.date ? -1 : 1),
                 vo2: Object.entries(vo2).map(([date, x]) => ({ date, vo2max: x.v })).sort((a, b) => a.date < b.date ? -1 : 1),
                 seances: Object.values(seances).sort((a, b) => (a.date + a.heure) < (b.date + b.heure) ? -1 : 1) };
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
    function detailSeance(texte, debut, fcMax, texteLoc) {
        const lire = (t) => { try { const x = JSON.parse(t || '[]'); return Array.isArray(x) ? x : []; } catch (e) { return []; } };
        const items = lire(texte);
        let pts = items.map(it => ({ t: num(it && it.start_time), fc: num(it && it.heart_rate), d: num(it && it.distance), v: num(it && it.speed) })).filter(p => p.t !== null).sort((a, b) => a.t - b.t);
        //  la distance au fil de la séance : la clé « distance » du détail si elle existe ; sinon le TRACÉ (location_data : latitude,
        //  longitude) ; sinon la vitesse (m/s) intégrée dans le temps. Aucune des trois : pas de temps par km (rien d'inventé).
        if (!pts.some(p => p.d !== null)) {
            const g = lire(texteLoc).map(it => ({ t: num(it && it.start_time), la: num(it && it.latitude), lo: num(it && it.longitude) })).filter(p => p.t !== null && p.la !== null && p.lo !== null).sort((a, b) => a.t - b.t);
            if (g.length >= 2) {
                const rad = Math.PI / 180; let c = 0;
                const tr = g.map((p, i) => { if (i) { const a = g[i - 1], x = Math.sin((p.la - a.la) * rad / 2) ** 2 + Math.cos(a.la * rad) * Math.cos(p.la * rad) * Math.sin((p.lo - a.lo) * rad / 2) ** 2; c += 2 * 6371000 * Math.asin(Math.sqrt(x)); } return { t: p.t, fc: null, d: c }; });
                pts = pts.concat(tr).sort((a, b) => a.t - b.t);
            } else if (pts.filter(p => p.v !== null).length >= 2) {
                let c = 0, tPrec = null;
                pts.forEach(p => { if (p.v !== null && p.v >= 0) { if (tPrec !== null) c += p.v * Math.min(60, (p.t - tPrec) / 1000); tPrec = p.t; p.d = c; } });
            }
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
     * Ouvre un .zip (le dossier de l'export compressé) sans bibliothèque : répertoire central + DecompressionStream
     * (« deflate-raw »). Zip64 pris en charge (exports de plus de 65 535 fichiers). garder(nom) choisit quoi décompresser.
     * → [{ nom, texte }]
     */
    async function lireZip(octets, garder) {
        const buf = octets instanceof ArrayBuffer ? octets : octets.buffer.slice(octets.byteOffset, octets.byteOffset + octets.byteLength);
        const dv = new DataView(buf), n8 = (o) => Number(dv.getBigUint64(o, true));
        let e = -1;
        for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
        if (e < 0) throw new Error('ce fichier n’est pas un .zip lisible');
        let total = dv.getUint16(e + 10, true), cd = dv.getUint32(e + 16, true);
        if ((total === 0xffff || cd === 0xffffffff) && e >= 20 && dv.getUint32(e - 20, true) === 0x07064b50) {
            const z = n8(e - 20 + 8);
            if (dv.getUint32(z, true) === 0x06064b50) { total = n8(z + 32); cd = n8(z + 48); }
        }
        const dec = new TextDecoder(), sortie = [];
        let o = cd;
        for (let k = 0; k < total && o + 46 <= buf.byteLength; k++) {
            if (dv.getUint32(o, true) !== 0x02014b50) break;
            const methode = dv.getUint16(o + 10, true), lnom = dv.getUint16(o + 28, true), lext = dv.getUint16(o + 30, true), lcom = dv.getUint16(o + 32, true);
            let taille = dv.getUint32(o + 20, true), local = dv.getUint32(o + 42, true);
            const nom = dec.decode(new Uint8Array(buf, o + 46, lnom));
            if (taille === 0xffffffff || local === 0xffffffff) {          // champ supplémentaire zip64 (0x0001)
                let x = o + 46 + lnom; const fin = x + lext;
                while (x + 4 <= fin) {
                    const id = dv.getUint16(x, true), l = dv.getUint16(x + 2, true);
                    if (id === 0x0001) { let y = x + 4; if (dv.getUint32(o + 24, true) === 0xffffffff) y += 8; if (taille === 0xffffffff) { taille = n8(y); y += 8; } if (local === 0xffffffff) local = n8(y); break; }
                    x += 4 + l;
                }
            }
            o += 46 + lnom + lext + lcom;
            if (nom.endsWith('/') || !garder(nom)) continue;
            const ln = dv.getUint16(local + 26, true), le = dv.getUint16(local + 28, true);
            const brut = new Uint8Array(buf, local + 30 + ln + le, taille);
            let contenu;
            if (methode === 0) contenu = brut;
            else if (methode === 8) contenu = new Uint8Array(await new Response(new Blob([brut]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
            else continue;
            sortie.push({ nom, texte: estLiveData(nom) ? await texteDe(contenu) : dec.decode(contenu) });   // v1.26 : détail de séance gzip
        }
        return sortie;
    }

    return { UTILES, typeDuNom, estUtile, estBinningPas, estLiveData, texteDe, estExportSamsung, csvLignes, table, decalage, dateLocale, extraire, lireZip, detailSeance, nomSeance };
});
