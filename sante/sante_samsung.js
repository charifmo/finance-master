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
    On n'extrait que ce que l'appli suit : pas, kcal actives, FC moyenne, sommeil, poids. Le reste est ignoré.
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
    };
    const RE_NOM = /(?:^|\/)(com\.samsung\.[a-z0-9_.]+?)\.(\d{8,})\.csv$/i;
    const RE_BINNING_PAS = /(?:^|\/)jsons\/com\.samsung\.shealth\.tracker\.pedometer_day_summary\/.*\.json$/i;

    /** Le type Samsung d'un fichier d'après son nom (chemin compris), ou null. */
    const typeDuNom = (nom) => { const m = RE_NOM.exec(String(nom || '').replace(/\\/g, '/')); return m ? m[1].toLowerCase() : null; };
    /** Faut-il lire ce fichier ? (avant même de l'ouvrir : un export complet compte des milliers de fichiers) */
    const estUtile = (nom) => { const t = typeDuNom(nom); return !!(t && UTILES[t]); };
    const estBinningPas = (nom) => RE_BINNING_PAS.test(String(nom || '').replace(/\\/g, '/'));
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
        return { jours, pesees: Object.entries(pesees).map(([date, p]) => ({ date, kg: p.kg })).sort((a, b) => a.date < b.date ? -1 : 1), lus, sources };
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
            sortie.push({ nom, texte: dec.decode(contenu) });
        }
        return sortie;
    }

    return { UTILES, typeDuNom, estUtile, estBinningPas, estExportSamsung, csvLignes, table, decalage, dateLocale, extraire, lireZip };
});
