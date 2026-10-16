# -*- coding: utf-8 -*-
"""
v37.58 — LES LEÇONS, AVEC L'IA.

« Pour la partie leçons, il faut utiliser intelligemment l'IA. »
  • LES FAITS D'ABORD : l'application calcule le cycle (par famille : dépensé, budget, cycle précédent,
    moyenne des 3 cycles d'avant, lignes et libellés ; week-end ; petits achats ; vos notes ; vos leçons
    gardées). L'IA (webhook du CFO, LECTURE SEULE, session « lecons ») n'en reçoit que ces chiffres.
  • L'IA PROPOSE au plus 5 leçons (constat chiffré, action mesurable, enjeu en DH) et juge si vos leçons
    gardées ont été tenues. Au retour tout est vérifié : catégorie connue, chiffres retrouvés dans les
    faits (sinon « ⚠️ chiffre non retrouvé »). Rien n'est gardé sans vous : 📌 Garder / ✕ Écarter.
  • SANS IA : les signaux calculés (budget dépassé, hausse vs cycle précédent, petits achats, week-end).
  • « 🧠 Proposer » dans une opération ouverte : la note rédigée depuis l'historique du même libellé.
  • STOCKAGE : parametres.leconsIA et parametres.analyseLecons, dans le document unique. Rien dans n8n.
"""
import sys, pathlib
F = pathlib.Path('index.html')
src = F.read_text(encoding='utf-8')

def sub(label, anchor, repl):
    global src
    n = src.count(anchor)
    if n != 1:
        sys.exit(f'✖ {label} : {n} ancre(s), 1 attendue')
    src = src.replace(anchor, repl)

JS = r'''
                    /* ═══ v37.58 — LES LEÇONS, AVEC L'IA ══════════════════════════════════════════════
                       « Pour la partie leçons, il faut utiliser intelligemment l'IA. » L'IA ne reçoit pas
                       le journal brut : l'application calcule d'abord LES FAITS du cycle (par famille :
                       dépensé, budget, cycle précédent, moyenne des 3 cycles d'avant ; les lignes et leurs
                       libellés ; le week-end ; les petits achats ; VOS notes ; VOS leçons gardées) et
                       l'IA (le webhook du CFO, LECTURE SEULE, session « lecons ») en tire au plus cinq
                       leçons — un constat chiffré, une action mesurable, l'enjeu en DH — et juge si vos
                       leçons gardées ont été tenues. Tout est vérifié au retour : catégorie connue, chaque
                       chiffre du constat retrouvé dans les faits, sinon « ⚠️ chiffre non retrouvé ».
                       Rien n'est gardé sans vous (📌 Garder / ✕ Écarter). Sans IA, les signaux calculés
                       restent affichés. Ouvrir une opération : « 🧠 Proposer » rédige sa note à partir de
                       l'historique du même libellé. Stockage : parametres.leconsIA (les leçons gardées)
                       et parametres.analyseLecons (la dernière analyse), dans le document unique. */
                    const _reculCycle = (cle, n) => { let a = Math.floor(cle / 100), m = cle % 100; for (let i = 0; i < n; i++) { m--; if (!m) { m = 12; a--; } } return a * 100 + m; };
                    const _arr2 = (x) => Math.round((Number(x) || 0) * 100) / 100;
                    const iaLecons = reactive({ enCours: false, erreur: '', note: { enCours: false, erreur: '', id: null, texte: '', lecon: false } });
                    //  Le cycle analysé : le précédent si on le regarde, sinon celui en cours
                    const _cycleLecons = computed(() => {
                        const c = _cycleCourantJournal.value;
                        if (!c) return null;
                        return journal.periode === 'precedent' ? _reculCycle(c.cle, 1) : c.cle;
                    });
                    const leconsGardees = computed(() => {
                        calculationTick.value;
                        const l = parametres.value && Array.isArray(parametres.value.leconsIA) ? parametres.value.leconsIA : [];
                        return l.filter(x => x && x.id && x.titre).slice().sort((a, b) => (a.statut === 'appliquee' ? 1 : 0) - (b.statut === 'appliquee' ? 1 : 0) || String(b.creeLe || '').localeCompare(String(a.creeLe || '')));
                    });
                    //  LES FAITS d'un cycle — tout ce que l'IA a le droit de citer
                    const _faitsLecons = (cle) => {
                        const toutes = journalToutes.value.filter(x => x.cycle);
                        const du = toutes.filter(x => x.cycle.cle === cle);
                        const precs = [1, 2, 3].map(n => _reculCycle(cle, n));
                        const an = Math.floor(cle / 100), mois = cle % 100, jdp = jourDePaie.value;
                        //  Le budget du cycle, par famille (le même calcul que le Contrôle Budget vs Réel)
                        const budget = {};
                        try { _lignesControle(an, mois).forEach(r => { if (r.budget > 0) { const f = _familleDe(r.categorieId); budget[f] = (budget[f] || 0) + r.budget; } }); } catch (e) {}
                        //  L'avancement du cycle (jours écoulés / jours du cycle) — seulement pour le cycle en cours
                        const debut = jdp <= 1 ? new Date(an, mois - 1, 1) : new Date(an, mois - 2, jdp);
                        const fin = jdp <= 1 ? new Date(an, mois, 0) : new Date(an, mois - 1, jdp - 1);
                        const jours = Math.round((fin - debut) / 864e5) + 1;
                        const auj = new Date(); auj.setHours(0, 0, 0, 0);
                        const ecoules = Math.max(0, Math.min(jours, Math.round((auj - debut) / 864e5) + 1));
                        const fams = {};
                        const F = (x) => fams[x.fam] || (fams[x.fam] = { id: x.fam, famille: x.famLabel, depense: 0, n: 0, precedent: 0, precs: [0, 0, 0], lignes: {} });
                        du.forEach(x => {
                            const f = F(x); f.depense += x.montant; f.n++;
                            const lk = x.t.categorieId || 'cat_misc';
                            const g = f.lignes[lk] || (f.lignes[lk] = { ligne: x.catLabel, n: 0, total: 0, max: 0, libelles: {} });
                            g.n++; g.total += x.montant; g.max = Math.max(g.max, x.montant);
                            const lib = String(x.t.libelle || '').trim(); if (lib) g.libelles[lib] = (g.libelles[lib] || 0) + 1;
                        });
                        toutes.forEach(x => { const i = precs.indexOf(x.cycle.cle); if (i >= 0 && fams[x.fam]) fams[x.fam].precs[i] += x.montant; });
                        const total = du.reduce((s, x) => s + x.montant, 0);
                        const familles = Object.values(fams).map(f => {
                            const avec = f.precs.filter(v => v > 0);
                            const o = { id: f.id, famille: f.famille, depense: _arr2(f.depense), operations: f.n, part_pct: total ? Math.round(f.depense / total * 100) : 0,
                                        cycle_precedent: _arr2(f.precs[0]), moyenne_3_cycles_avant: avec.length ? _arr2(avec.reduce((s, v) => s + v, 0) / avec.length) : null,
                                        budget: budget[f.id] ? _arr2(budget[f.id]) : null,
                                        lignes: Object.values(f.lignes).sort((a, b) => b.total - a.total).slice(0, 5).map(g => ({ ligne: g.ligne, operations: g.n, total: _arr2(g.total), moyenne: _arr2(g.total / g.n), max: _arr2(g.max),
                                            libelles: Object.entries(g.libelles).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => n > 1 ? k + ' ×' + n : k) })) };
                            if (o.cycle_precedent) o.ecart_vs_precedent_pct = Math.round((o.depense - o.cycle_precedent) / o.cycle_precedent * 100);
                            if (o.budget) o.consomme_budget_pct = Math.round(o.depense / o.budget * 100);
                            return o;
                        }).sort((a, b) => b.depense - a.depense);
                        const weekend = du.filter(x => x.ymd && [0, 6].includes(new Date(x.ymd + 'T12:00').getDay()));
                        const petits = du.filter(x => x.montant < 50);
                        const notes = toutes.filter(x => [cle, ...precs].includes(x.cycle.cle) && String(x.t.note || '').trim())
                            .slice(0, 15).map(x => ({ date: x.ymd, libelle: x.t.libelle, montant: _arr2(x.montant), categorie: x.catLabel, note: String(x.t.note).trim().slice(0, 200), lecon: !!x.t.lecon }));
                        const gardees = leconsGardees.value.filter(l => l.statut !== 'appliquee').slice(0, 8)
                            .map(l => ({ id: l.id, titre: l.titre, action: l.action, categorie: l.categorieId ? _libCat(l.categorieId) : null, depuis_cycle: l.cycle }));
                        const enCours = (_cycleCourantJournal.value || {}).cle === cle;
                        return {
                            cycle: (_cycleJournal(_ymd(debut)) || {}).label || String(cle), cycle_en_cours: enCours,
                            ...(enCours ? { jours_ecoules: ecoules, jours_du_cycle: jours, avancement_pct: Math.round(ecoules / jours * 100) } : {}),
                            total_depense: _arr2(total), operations: du.length,
                            total_cycle_precedent: _arr2(toutes.filter(x => x.cycle.cle === precs[0]).reduce((s, x) => s + x.montant, 0)),
                            week_end: { operations: weekend.length, total: _arr2(weekend.reduce((s, x) => s + x.montant, 0)), part_pct: total ? Math.round(weekend.reduce((s, x) => s + x.montant, 0) / total * 100) : 0 },
                            petits_achats_moins_de_50: { operations: petits.length, total: _arr2(petits.reduce((s, x) => s + x.montant, 0)) },
                            familles, vos_notes: notes, vos_lecons_gardees: gardees,
                        };
                    };
                    //  Les signaux calculés, sans IA : ce que les chiffres disent déjà
                    const signauxLecons = computed(() => {
                        const cle = _cycleLecons.value;
                        if (!cle) return [];
                        const f = _faitsLecons(cle), out = [];
                        f.familles.forEach(x => {
                            if (x.budget && x.consomme_budget_pct >= 100) out.push({ niveau: 'rouge', cat: x.id, texte: x.famille + ' : ' + formatMAD(x.depense) + ' pour ' + formatMAD(x.budget) + ' budgétés (' + x.consomme_budget_pct + ' %)' });
                            else if (x.budget && f.avancement_pct && x.consomme_budget_pct > f.avancement_pct + 15) out.push({ niveau: 'orange', cat: x.id, texte: x.famille + ' : ' + x.consomme_budget_pct + ' % du budget à ' + f.avancement_pct + ' % du cycle' });
                            else if (x.ecart_vs_precedent_pct >= 30 && x.depense - x.cycle_precedent >= 100) out.push({ niveau: 'orange', cat: x.id, texte: x.famille + ' : ▲ +' + x.ecart_vs_precedent_pct + ' % vs le cycle précédent (' + formatMAD(x.depense) + ' contre ' + formatMAD(x.cycle_precedent) + ')' });
                        });
                        if (f.petits_achats_moins_de_50.operations >= 5) out.push({ niveau: 'gris', cat: null, texte: f.petits_achats_moins_de_50.operations + ' petits achats (< 50 DH) : ' + formatMAD(f.petits_achats_moins_de_50.total) + ' au total' });
                        if (f.operations >= 5 && f.week_end.part_pct >= 50) out.push({ niveau: 'gris', cat: null, texte: 'Le week-end : ' + f.week_end.part_pct + ' % des dépenses du cycle' });
                        return out.slice(0, 5);
                    });
                    //  Tous les nombres des faits (et leurs arrondis) : un chiffre de l'IA doit en être un
                    const _nombresDe = (o, s = new Set()) => {
                        if (typeof o === 'number' && isFinite(o)) { s.add(Math.round(o)); s.add(Math.round(Math.abs(o))); }
                        else if (typeof o === 'string') (o.match(/\d+(?:[.,]\d+)?/g) || []).forEach(n => s.add(Math.round(Number(n.replace(',', '.')))));
                        else if (o && typeof o === 'object') Object.values(o).forEach(v => _nombresDe(v, s));
                        return s;
                    };
                    const _chiffresVerifies = (texte, connus) => {
                        const nums = (String(texte || '').replace(/(\d)[\s  .](?=\d{3}\b)/g, '$1').match(/\d+(?:,\d+)?/g) || []).map(n => Number(n.replace(',', '.'))).filter(n => n >= 10);
                        const conn = [...connus];
                        return nums.every(n => conn.some(c => Math.abs(c - n) <= Math.max(1, c * 0.01)));
                    };
                    //  Le premier objet JSON (imbriqué) de la réponse qui porte la clé voulue
                    const _jsonIAAvec = (texte, cle) => {
                        const t = String(texte || '').replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
                        for (let i = t.indexOf('{'); i >= 0; i = t.indexOf('{', i + 1)) {
                            let prof = 0, dansChaine = false, echap = false;
                            for (let k = i; k < t.length; k++) {
                                const c = t[k];
                                if (dansChaine) { if (echap) echap = false; else if (c === '\\') echap = true; else if (c === '"') dansChaine = false; continue; }
                                if (c === '"') dansChaine = true;
                                else if (c === '{') prof++;
                                else if (c === '}' && --prof === 0) {
                                    try { const j = JSON.parse(t.slice(i, k + 1)); if (j && typeof j === 'object' && cle in j) return j; } catch (_) {}
                                    break;
                                }
                            }
                        }
                        return null;
                    };
                    const _appelIA = async (session, question) => {
                        const res = await fetch(cfoWebhookUrl.value || MARKET_WEBHOOK, {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ session_id: session, source: session, question }),
                        });
                        if (!res.ok) throw new Error('HTTP ' + res.status);
                        return _lireReponseCFO(await res.text()).html;
                    };
                    const _TYPES_LECON = ['alerte', 'habitude', 'economie', 'progres'];
                    const _questionLecons = (faits, familles) => [
                        "LEÇONS D'UN CYCLE DE DÉPENSES — LECTURE SEULE : aucun outil, aucune recherche, aucun propose_changes, aucun committer, aucun memory_writer.",
                        "Tu es le coach financier de l'utilisateur (Maroc, dirhams). Voici LES FAITS de son cycle de paie, calculés par l'application. Ce sont les SEULS chiffres que tu as le droit de citer : n'invente aucun montant, aucun pourcentage.",
                        'FAITS = ' + JSON.stringify(faits),
                        'Tire AU PLUS 5 leçons utiles, de la plus coûteuse à la moins coûteuse. Une leçon = un constat CHIFFRÉ tiré des faits + UNE action concrète et mesurable pour le prochain cycle (un plafond, une fréquence, un jour, un magasin) + l\'enjeu estimé en DH par cycle.',
                        'Appuie-toi sur ses notes (vos_notes) : ce qu\'il a déjà remarqué compte plus que tes hypothèses. Ne répète pas une leçon déjà gardée (vos_lecons_gardees) : juge plutôt si elle a été tenue ce cycle.',
                        'Pas de leçon creuse (« faites attention », « surveillez ») ; pas de morale. Si le cycle est sain, dis-le avec une leçon de type « progres ».',
                        'catégorie : un id de cette liste, ou null : ' + familles.map(f => f.id + ' (' + f.famille + ')').join(', '),
                        'Réponds UNIQUEMENT par ce JSON, sans texte autour :',
                        '{"bilan": "<une phrase>", "lecons": [{"type": "alerte" | "habitude" | "economie" | "progres", "titre": "<8 mots au plus>", "constat": "<1 phrase chiffrée>", "action": "<1 phrase>", "categorieId": "<id ou null>", "enjeu": <DH par cycle ou null>}], "suivis": [{"id": "<id d\'une leçon gardée>", "verdict": "tenue" | "pas_tenue" | "trop_tot", "commentaire": "<12 mots au plus>"}]}',
                    ].join('\n');
                    const _signatureLecons = (cle) => {
                        let h = 0;
                        const s = journalToutes.value.filter(x => x.cycle && x.cycle.cle === cle).map(x => x.t.id + ':' + x.montant + ':' + (x.t.categorieId || '') + ':' + (x.t.note || '')).sort().join('|')
                            + '#' + leconsGardees.value.map(l => l.id + l.statut).join('|');
                        for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
                        return String(h);
                    };
                    const analyseLecons = computed(() => {
                        calculationTick.value;
                        const a = parametres.value && parametres.value.analyseLecons;
                        if (!a || a.cycle !== _cycleLecons.value) return null;
                        return { ...a, aJour: a.signature === _signatureLecons(a.cycle) };
                    });
                    const analyserLeconsIA = async () => {
                        const cle = _cycleLecons.value;
                        if (!cle || iaLecons.enCours) return false;
                        iaLecons.enCours = true; iaLecons.erreur = '';
                        try {
                            const faits = _faitsLecons(cle);
                            if (!faits.operations) { iaLecons.erreur = 'Aucune opération sur ce cycle : rien à analyser.'; return false; }
                            const r = _jsonIAAvec(await _appelIA('lecons', _questionLecons(faits, faits.familles)), 'lecons');
                            if (!r || !Array.isArray(r.lecons)) throw new Error('réponse sans leçons');
                            const connus = _nombresDe(faits), ids = new Set(faits.familles.map(f => f.id).concat(_categoriesCandidates.value.map(c => c.id)));
                            const txt = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
                            const propositions = r.lecons.slice(0, 5).map((l, i) => {
                                const p = { id: 'lc_' + cle + '_' + Date.now().toString(36) + i, cycle: cle, cycleLabel: faits.cycle,
                                            type: _TYPES_LECON.includes(l && l.type) ? l.type : 'habitude', titre: txt(l && l.titre, 80), constat: txt(l && l.constat, 260), action: txt(l && l.action, 220),
                                            categorieId: l && ids.has(l.categorieId) ? l.categorieId : null, enjeu: Number(l && l.enjeu) > 0 ? Math.round(Number(l.enjeu)) : null };
                                p.verifie = _chiffresVerifies(p.constat, connus);
                                return p;
                            }).filter(p => p.titre && p.constat);
                            const gard = new Set(leconsGardees.value.map(l => l.id));
                            const suivis = (Array.isArray(r.suivis) ? r.suivis : []).filter(s => s && gard.has(s.id) && ['tenue', 'pas_tenue', 'trop_tot'].includes(s.verdict))
                                .map(s => ({ id: s.id, verdict: s.verdict, commentaire: txt(s.commentaire, 120) }));
                            suivis.forEach(s => { const l = parametres.value.leconsIA.find(x => x.id === s.id); if (l) l.suivi = { cycle: cle, verdict: s.verdict, commentaire: s.commentaire }; });
                            parametres.value.analyseLecons = { cycle: cle, cycleLabel: faits.cycle, date: new Date().toISOString().slice(0, 16), signature: _signatureLecons(cle), bilan: txt(r.bilan, 240), propositions, suivis };
                            calculationTick.value++;
                            handleDataChange();
                            return true;
                        } catch (e) {
                            iaLecons.erreur = "L'IA n'a pas répondu (" + (e && e.message || e) + ') : les signaux calculés ci-dessus restent valables.';
                            return false;
                        } finally { iaLecons.enCours = false; }
                    };
                    const garderLeconIA = (id) => {
                        const a = parametres.value.analyseLecons;
                        const p = a && (a.propositions || []).find(x => x.id === id);
                        if (!p) return false;
                        if (!Array.isArray(parametres.value.leconsIA)) parametres.value.leconsIA = [];
                        parametres.value.leconsIA.push({ ...p, statut: 'active', creeLe: new Date().toISOString().slice(0, 10) });
                        a.propositions = a.propositions.filter(x => x.id !== id);
                        a.signature = _signatureLecons(a.cycle);
                        calculationTick.value++; handleDataChange();
                        return true;
                    };
                    const ecarterLeconIA = (id) => {
                        const a = parametres.value.analyseLecons;
                        if (!a) return false;
                        a.propositions = (a.propositions || []).filter(x => x.id !== id);
                        calculationTick.value++; handleDataChange();
                        return true;
                    };
                    const basculerLeconAppliquee = (id) => {
                        const l = (parametres.value.leconsIA || []).find(x => x.id === id);
                        if (!l) return;
                        l.statut = l.statut === 'appliquee' ? 'active' : 'appliquee';
                        calculationTick.value++; handleDataChange();
                    };
                    const supprimerLeconIA = (id) => {
                        if (!Array.isArray(parametres.value.leconsIA)) return;
                        parametres.value.leconsIA = parametres.value.leconsIA.filter(x => x.id !== id);
                        calculationTick.value++; handleDataChange();
                    };
                    //  « 🧠 Proposer » dans une opération ouverte : la note, rédigée depuis l'historique du libellé
                    const _questionNote = (x, b) => {
                        const norm = _normJnl(b.libelle).trim();
                        const memes = journalToutes.value.filter(y => y.t.id !== x.t.id && _normJnl(y.t.libelle).trim() === norm).slice(0, 8)
                            .map(y => ({ date: y.ymd || null, montant: _arr2(y.montant) }));
                        const cle = x.cycle ? x.cycle.cle : null;
                        const fam = cle ? (_faitsLecons(cle).familles.find(f => f.id === _familleDe(b.categorieId || x.t.categorieId)) || null) : null;
                        const faits = { operation: { date: String(b.datetime || '').slice(0, 10) || null, libelle: b.libelle, montant: _arr2(b.montant), categorie: _libCat(b.categorieId || x.t.categorieId) },
                                        meme_libelle_avant: memes, meme_libelle_moyenne: memes.length ? _arr2(memes.reduce((s, y) => s + y.montant, 0) / memes.length) : null,
                                        famille_ce_cycle: fam && { famille: fam.famille, depense: fam.depense, budget: fam.budget, cycle_precedent: fam.cycle_precedent },
                                        vos_notes_recentes: journalToutes.value.filter(y => String(y.t.note || '').trim()).slice(0, 5).map(y => String(y.t.note).trim().slice(0, 120)) };
                        return [
                            "NOTE SUR UNE DÉPENSE — LECTURE SEULE : aucun outil, aucune recherche, aucun propose_changes, aucun committer, aucun memory_writer.",
                            "Rédige, à la première personne et dans le style de l'utilisateur (vos_notes_recentes), ce qu'il peut retenir de cette dépense : une phrase, 25 mots au plus, chiffrée UNIQUEMENT avec les faits, et utile la prochaine fois (comparer au prix habituel, au budget, à la fréquence).",
                            'FAITS = ' + JSON.stringify(faits),
                            '« lecon » vaut true seulement si cela mérite de changer une habitude (écart net au prix habituel ou au budget), sinon false.',
                            'Réponds UNIQUEMENT par ce JSON : {"note": "<la phrase>", "lecon": true | false}',
                        ].join('\n');
                    };
                    const suggererNoteIA = async () => {
                        const id = journal.ouvert, b = journal.brouillon;
                        const x = journalToutes.value.find(y => y.t.id === id);
                        if (!x || !b || iaLecons.note.enCours) return false;
                        Object.assign(iaLecons.note, { enCours: true, erreur: '', id, texte: '', lecon: false });
                        try {
                            const r = _jsonIAAvec(await _appelIA('lecons', _questionNote(x, b)), 'note');
                            const texte = String(r && r.note || '').replace(/\s+/g, ' ').trim().slice(0, 300);
                            if (!texte) throw new Error('réponse sans note');
                            if (journal.ouvert !== id) return false;
                            Object.assign(iaLecons.note, { texte, lecon: r.lecon === true });
                            return true;
                        } catch (e) {
                            iaLecons.note.erreur = "L'IA n'a pas répondu (" + (e && e.message || e) + ').';
                            return false;
                        } finally { iaLecons.note.enCours = false; }
                    };
                    const utiliserNoteIA = () => {
                        if (!journal.brouillon || iaLecons.note.id !== journal.ouvert || !iaLecons.note.texte) return;
                        journal.brouillon.note = iaLecons.note.texte;
                        if (iaLecons.note.lecon) journal.brouillon.lecon = true;
                        iaLecons.note.texte = '';
                    };
                    watch(() => journal.ouvert, () => { Object.assign(iaLecons.note, { erreur: '', id: null, texte: '', lecon: false }); });
'''
NOTE = r'''                                                <div class="block text-[10px] font-black uppercase tracking-wider text-violet-700">
                                                    <div class="flex items-center gap-2">
                                                        <span class="mr-auto">💡 Ce que je retiens</span>
                                                        <button type="button" data-journal-note-ia @click="suggererNoteIA()" :disabled="iaLecons.note.enCours"
                                                                class="px-2 py-0.5 rounded-md text-[10px] font-black normal-case tracking-normal text-violet-800 bg-violet-100 hover:bg-violet-200 disabled:opacity-50">{{ iaLecons.note.enCours ? '🧠 …' : '🧠 Proposer' }}</button>
                                                    </div>
                                                    <textarea data-journal-edit-note v-model="journal.brouillon.note" rows="2" placeholder="ex. « Marjane le samedi soir : panier +40 %, y aller en semaine »"
                                                              class="mt-0.5 w-full text-xs font-semibold px-2 py-1.5 rounded-lg border border-violet-200 bg-white outline-none focus:border-violet-400 normal-case tracking-normal"></textarea>
                                                    <div v-if="iaLecons.note.id === x.t.id && iaLecons.note.texte" data-journal-note-ia-proposition class="mt-1 flex items-start gap-2 rounded-lg bg-violet-50 border border-violet-200 px-2 py-1.5 normal-case tracking-normal">
                                                        <p class="text-xs font-semibold text-violet-900 mr-auto">🧠 {{ iaLecons.note.texte }}<span v-if="iaLecons.note.lecon" class="ml-1 text-[10px] font-black text-violet-700">· 📌 leçon</span></p>
                                                        <button type="button" data-journal-note-ia-utiliser @click="utiliserNoteIA()" class="shrink-0 px-2 py-0.5 rounded-md text-[10px] font-black text-white bg-violet-600 hover:bg-violet-700">✓ Utiliser</button>
                                                    </div>
                                                    <p v-if="iaLecons.note.id === x.t.id && iaLecons.note.erreur" data-journal-note-ia-erreur class="mt-1 text-[10px] font-bold text-amber-700 normal-case tracking-normal">{{ iaLecons.note.erreur }}</p>
                                                </div>
'''
VUE = r'''                        <div v-else data-journal-lecons class="px-4 md:px-6 py-3 space-y-3">
                            <!-- v37.58 : l'IA tire les leçons du cycle, à partir des faits calculés -->
                            <div data-lecons-ia class="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-3 space-y-2">
                                <div class="flex flex-wrap items-center gap-2">
                                    <p class="text-xs font-black text-violet-900 mr-auto">🧠 Les leçons du cycle <span class="font-bold text-violet-600">· {{ journal.periode === 'precedent' ? 'cycle précédent' : 'cycle en cours' }}</span></p>
                                    <button type="button" data-lecons-analyser @click="analyserLeconsIA()" :disabled="iaLecons.enCours"
                                            class="px-3 py-1.5 rounded-lg text-[11px] font-black text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50">
                                        {{ iaLecons.enCours ? "🧠 L'IA lit votre cycle…" : (analyseLecons ? (analyseLecons.aJour ? '↻ Relancer' : '↻ Mettre à jour (du nouveau depuis l\'analyse)') : '🧠 Analyser avec l\'IA') }}
                                    </button>
                                </div>
                                <ul v-if="signauxLecons.length" data-lecons-signaux class="flex flex-wrap gap-1.5">
                                    <li v-for="(s, i) in signauxLecons" :key="'ls_' + i" data-lecons-signal :data-niveau="s.niveau"
                                        :class="['text-[10px] font-bold px-2 py-1 rounded-lg border', s.niveau === 'rouge' ? 'bg-red-50 border-red-200 text-red-800' : s.niveau === 'orange' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-gray-50 border-gray-200 text-gray-700']">
                                        <button v-if="s.cat" type="button" @click="filtrerJournalCategorie(s.cat)" class="hover:underline text-left">📊 {{ s.texte }}</button><span v-else>📊 {{ s.texte }}</span>
                                    </li>
                                </ul>
                                <p v-if="iaLecons.erreur" data-lecons-erreur class="text-[11px] font-bold text-amber-700">{{ iaLecons.erreur }}</p>
                                <template v-if="analyseLecons">
                                    <p v-if="analyseLecons.bilan" data-lecons-bilan class="text-xs font-semibold text-violet-900">« {{ analyseLecons.bilan }} »</p>
                                    <ul class="space-y-1.5">
                                        <li v-for="p in analyseLecons.propositions" :key="p.id" data-lecon-ia :data-type="p.type" :data-verifie="p.verifie ? '1' : '0'" class="rounded-xl border border-violet-100 bg-white px-3 py-2">
                                            <p class="text-xs font-black text-violet-900">{{ { alerte: '🚨', habitude: '🔁', economie: '💰', progres: '🌱' }[p.type] || '💡' }} {{ p.titre }}
                                                <span v-if="p.enjeu" class="ml-1 text-[10px] font-black text-emerald-700">· enjeu ≈ {{ formatMAD(p.enjeu) }} / cycle</span></p>
                                            <p class="text-[11px] font-semibold text-gray-700 mt-0.5">{{ p.constat }}<span v-if="!p.verifie" data-lecon-ia-non-verifie class="ml-1 text-[10px] font-black text-amber-700">⚠️ chiffre non retrouvé dans vos données</span></p>
                                            <p class="text-[11px] font-bold text-violet-800 mt-0.5">→ {{ p.action }}</p>
                                            <div class="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-black">
                                                <button v-if="p.categorieId" type="button" @click="filtrerJournalCategorie(p.categorieId)" class="text-blue-700 hover:underline">🔎 {{ String(getCategorieLabel(p.categorieId) || '').trim() }}</button>
                                                <span class="mr-auto"></span>
                                                <button type="button" data-lecon-ia-garder @click="garderLeconIA(p.id)" class="px-2 py-1 rounded-md text-white bg-violet-600 hover:bg-violet-700">📌 Garder</button>
                                                <button type="button" data-lecon-ia-ecarter @click="ecarterLeconIA(p.id)" class="px-2 py-1 rounded-md text-gray-600 bg-gray-100 hover:bg-gray-200">✕ Écarter</button>
                                            </div>
                                        </li>
                                    </ul>
                                    <p class="text-[10px] font-bold text-gray-400">Analyse du {{ analyseLecons.date.slice(8, 10) }}/{{ analyseLecons.date.slice(5, 7) }} à {{ analyseLecons.date.slice(11, 16) }} · {{ analyseLecons.cycleLabel }} · l'IA ne voit que les chiffres calculés par l'application, et rien n'est gardé sans vous.</p>
                                </template>
                                <p v-else-if="!iaLecons.enCours" class="text-[11px] text-gray-500">L'IA reçoit les chiffres de ce cycle (par catégorie : dépensé, budget, cycle précédent, moyenne des 3 cycles d'avant), vos notes et vos leçons gardées ; elle propose au plus 5 leçons chiffrées, chacune avec une action. Vous gardez celles qui vous parlent.</p>
                            </div>
                            <div v-if="leconsGardees.length" data-lecons-gardees class="space-y-1.5">
                                <p class="text-[11px] font-black uppercase tracking-widest text-violet-800">📌 Mes leçons gardées · {{ leconsGardees.length }}</p>
                                <div v-for="l in leconsGardees" :key="'lg_' + l.id" data-lecon-gardee :data-statut="l.statut" :class="['rounded-xl border px-3 py-2', l.statut === 'appliquee' ? 'border-emerald-100 bg-emerald-50/40 opacity-70' : 'border-violet-200 bg-white']">
                                    <p class="text-xs font-black text-violet-900">{{ l.statut === 'appliquee' ? '✅' : '📌' }} {{ l.titre }} <span class="text-[10px] font-bold text-gray-400">· {{ l.cycleLabel }}</span></p>
                                    <p class="text-[11px] font-bold text-violet-800">→ {{ l.action }}</p>
                                    <p v-if="l.suivi" data-lecon-suivi :data-verdict="l.suivi.verdict" :class="['text-[10px] font-black mt-0.5', l.suivi.verdict === 'tenue' ? 'text-emerald-700' : l.suivi.verdict === 'pas_tenue' ? 'text-red-700' : 'text-gray-500']">
                                        {{ l.suivi.verdict === 'tenue' ? '👍 Tenue' : l.suivi.verdict === 'pas_tenue' ? '👎 Pas tenue' : '⏳ Trop tôt' }} ce cycle-ci<span v-if="l.suivi.commentaire"> — {{ l.suivi.commentaire }}</span></p>
                                    <div class="mt-1 flex gap-2 text-[10px] font-black">
                                        <button type="button" data-lecon-appliquee @click="basculerLeconAppliquee(l.id)" class="text-emerald-700 hover:underline">{{ l.statut === 'appliquee' ? '↺ La réactiver' : '✅ Acquise' }}</button>
                                        <button type="button" data-lecon-supprimer @click="supprimerLeconIA(l.id)" class="text-red-600 hover:underline">🗑</button>
                                    </div>
                                </div>
                            </div>
                            <p v-if="journalLecons.length" class="text-[11px] font-black uppercase tracking-widest text-violet-800 pt-1">✍️ Mes notes sur les opérations</p>
'''

A_JS = "                    const effacerFiltresJournal = () => { Object.assign(journal, { q: '', cat: '', compte: '', source: '', aVerifier: false }); };\n"
sub('JS', A_JS, A_JS + JS)

A_NOTE = '''                                                <label class="block text-[10px] font-black uppercase tracking-wider text-violet-700">💡 Ce que je retiens
                                                    <textarea data-journal-edit-note v-model="journal.brouillon.note" rows="2" placeholder="ex. « Marjane le samedi soir : panier +40 %, y aller en semaine »"
                                                              class="mt-0.5 w-full text-xs font-semibold px-2 py-1.5 rounded-lg border border-violet-200 bg-white outline-none focus:border-violet-400 normal-case tracking-normal"></textarea>
                                                </label>
'''
sub('note', A_NOTE, NOTE)

A_VUE = '''                        <div v-else data-journal-lecons class="px-4 md:px-6 py-3 space-y-3">
                            <p v-if="!journalLecons.length" class="text-xs text-gray-500 italic">Aucune leçon sur cette période. Ouvrez une opération (un clic) et écrivez « ce que je retiens » : elle apparaîtra ici, rangée par catégorie.</p>
'''
sub('vue', A_VUE, VUE + '''                            <p v-if="!journalLecons.length" class="text-xs text-gray-500 italic">Aucune note sur cette période. Ouvrez une opération (un clic) et écrivez « ce que je retiens » — ou « 🧠 Proposer » : elle apparaîtra ici, rangée par catégorie.</p>
''')

A_RET = "                        ouvrirOperation, enregistrerOperation, supprimerOperation, ressaisirOperation, filtrerJournalCategorie, filtrerJournalLibelle, effacerFiltresJournal,\n"
sub('return', A_RET, A_RET + "                        iaLecons, signauxLecons, analyseLecons, leconsGardees, analyserLeconsIA, garderLeconIA, ecarterLeconIA, basculerLeconAppliquee, supprimerLeconIA, suggererNoteIA, utiliserNoteIA,\n")

F.write_text(src, encoding='utf-8')
print('✔ v37.58 Lecons-IA : JS, note 🧠, vue Leçons, exports')
