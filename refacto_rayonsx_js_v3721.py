# -*- coding: utf-8 -*-
"""
v37.21 Rayons-X — PARTIE MOTEUR (getters).

  1. infoCompte gagne une identité visuelle : `tag` (le nom de la banque quand
     le libellé en contient une — « Principale Assafa » → « Assafa » — sinon le
     nom court) et `initiales` (2-3 lettres pour le monogramme coloré). Si deux
     comptes sont à la même banque, le tag retombe sur le nom court : un tag
     ne doit jamais désigner deux comptes.
  2. pulseHebdo remonte, catégorie par catégorie, les transactions de la
     semaine qui composent le dépensé (libellé, montant, date, compte payeur),
     le compte des charges variables, et les dépenses hors budget conso.
  3. sanctuaireHebdo regroupe les prélèvements des 7 jours PAR COMPTE payeur :
     « combien doit rester sur quel compte, et pour quoi ».
"""
import io, sys
F = 'index.html'
src = io.open(F, encoding='utf-8').read()
edits = []
def sub(label, anchor, replacement, expected=1):
    n = src.count(anchor)
    if n != expected:
        print(f'✖ {label} : {n} ancre(s), {expected} attendue(s)'); sys.exit(1)
    edits.append((anchor, replacement))

# ── 1. Identité visuelle des comptes ────────────────────────────────────────
sub('infoCompte : tag et initiales', """                    const PALETTE_COMPTES = ['bg-indigo-500', 'bg-amber-500', 'bg-teal-500', 'bg-pink-500', 'bg-lime-500', 'bg-cyan-500', 'bg-fuchsia-500', 'bg-yellow-400'];
                    const infoCompte = (key) => {
                        const k = key || _cleCourant.value;
                        const liste = comptes.value || [];
                        const i = liste.findIndex(c => 'cpt_' + c.id === k);
                        const base = _infoCompteKey(k);
                        const label = i >= 0 ? (liste[i].label || base.label) : (k === 'courant' ? 'Compte Courant' : base.label);
                        return {
                            key: k, label, icone: i >= 0 ? (liste[i].icone || base.icon) : base.icon,
                            court: (String(label).replace(/^compte\\s+/i, '') || label),
                            couleur: k.startsWith('ep_') ? 'bg-violet-400' : PALETTE_COMPTES[Math.max(0, i) % PALETTE_COMPTES.length],
                            reel: k === _cleCourant.value || k.startsWith('cpt_'),
                        };
                    };""", """                    const PALETTE_COMPTES = ['bg-indigo-500', 'bg-amber-500', 'bg-teal-500', 'bg-pink-500', 'bg-lime-500', 'bg-cyan-500', 'bg-fuchsia-500', 'bg-yellow-400'];
                    //  v37.21 : la banque, quand le libellé la nomme. C'est ce que l'œil
                    //  cherche (« c'est le compte Assafa »), pas « Principale ».
                    const BANQUES = [
                        [/assafa/i, 'Assafa'], [/attijari/i, 'Attijari'], [/\\bcih\\b/i, 'CIH'],
                        [/bmce|bank of africa|\\bboa\\b/i, 'BOA'], [/populaire|chaabi|\\bbcp\\b/i, 'BP'],
                        [/cr[ée]dit du maroc|\\bcdm\\b/i, 'CDM'], [/\\bbmci\\b/i, 'BMCI'],
                        [/soci[ée]t[ée] g[ée]n[ée]rale|saham/i, 'SG'], [/barid/i, 'Barid'], [/umnia/i, 'Umnia'],
                        [/\\bcfg\\b/i, 'CFG'], [/akhdar/i, 'Akhdar'], [/yousr/i, 'Al Yousr'], [/revolut/i, 'Revolut'],
                        [/esp[èe]ces|liquide/i, 'Espèces'],
                    ];
                    const banqueDe = (label) => { const b = BANQUES.find(([re]) => re.test(String(label || ''))); return b ? b[1] : null; };
                    const initialesDe = (nom) => {
                        const s = String(nom || '?').trim();
                        if (/^[A-Z]{2,4}$/.test(s)) return s.slice(0, 3);
                        const mots = s.split(/[\\s'’-]+/).filter(w => w && !/^(de|du|des|la|le|les|d|l)$/i.test(w));
                        return (mots.length >= 2 ? mots[0][0] + mots[1][0] : (mots[0] || s).slice(0, 2)).toUpperCase();
                    };
                    const infoCompte = (key) => {
                        const k = key || _cleCourant.value;
                        const liste = comptes.value || [];
                        const i = liste.findIndex(c => 'cpt_' + c.id === k);
                        const base = _infoCompteKey(k);
                        const label = i >= 0 ? (liste[i].label || base.label) : (k === 'courant' ? 'Compte Courant' : base.label);
                        const court = (String(label).replace(/^compte\\s+/i, '') || label);
                        const banque = banqueDe(label);
                        const tag = banque && liste.filter(c => banqueDe(c.label) === banque).length <= 1 ? banque : court;
                        return {
                            key: k, label, icone: i >= 0 ? (liste[i].icone || base.icon) : base.icon,
                            court, tag, initiales: initialesDe(tag),
                            couleur: k.startsWith('ep_') ? 'bg-violet-400' : PALETTE_COMPTES[Math.max(0, i) % PALETTE_COMPTES.length],
                            reel: k === _cleCourant.value || k.startsWith('cpt_'),
                        };
                    };""")

# ── 2. Pulse : les transactions derrière chaque total ───────────────────────
sub('helpers de date et de transaction', """                    const _JOURS_SEMAINE = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
                    const pulseHebdo = computed(() => {""", """                    const _JOURS_SEMAINE = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
                    //  v37.21 — RAYONS X : ce qui compose chaque total, ligne à ligne.
                    const _JOURS_COURTS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
                    const _dateCourte = (d) => {
                        const auj = new Date();
                        if (d.getFullYear() === auj.getFullYear() && d.getMonth() === auj.getMonth() && d.getDate() === auj.getDate()) return 'auj.';
                        return _JOURS_COURTS[d.getDay()] + ' ' + d.getDate();
                    };
                    const _txRayonX = (t, dt, cleVar) => {
                        const [y, mo, j] = dt.split('-').map(Number);
                        const cpt = (comptes.value || []).find(c => String(c.id) === String(t.compteId));
                        const compte = cpt ? infoCompte('cpt_' + cpt.id) : null;
                        return {
                            id: t.id, date: dt, quand: _dateCourte(new Date(y, mo - 1, j)),
                            libelle: t.libelle || '(sans libellé)', montant: Math.round((Number(t.montant) || 0) * 100) / 100,
                            compte,
                            //  Payée depuis un autre compte que celui des charges variables :
                            //  le Relevé, lui, l'imputera au compte des variables.
                            horsCompte: !!(compte && cleVar && compte.key !== cleVar),
                        };
                    };
                    const _parDateDesc = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (Number(b.id) || 0) - (Number(a.id) || 0));
                    //  L'échéance réelle d'une ligne du cycle, à partir de son jour du mois.
                    const _dateEcheance = (jour, retard) => {
                        const j = Number(jour);
                        if (!j) return null;
                        const a = new Date(), base = new Date(a.getFullYear(), a.getMonth(), a.getDate());
                        let d = new Date(base.getFullYear(), base.getMonth(), j);
                        if (retard && d > base) d = new Date(base.getFullYear(), base.getMonth() - 1, j);
                        if (!retard && d < base) d = new Date(base.getFullYear(), base.getMonth() + 1, j);
                        return _dateCourte(d);
                    };
                    const pulseHebdo = computed(() => {""")
sub('catégories : une liste de transactions',
    """                            cats.push({ key, label: cv.label || key, budget: cv.periode === 'semaine' ? v : v / 4.3, depense: 0 });""",
    """                            cats.push({ key, label: cv.label || key, budget: cv.periode === 'semaine' ? v : v / 4.3, depense: 0, tx: [] });""")
sub('le compte des variables', """                        const dMin = _ymd(lundi), dMax = _ymd(auj);
                        let nbTx = 0, horsBudget = 0, nbHors = 0;""", """                        const dMin = _ymd(lundi), dMax = _ymd(auj);
                        let nbTx = 0, horsBudget = 0, nbHors = 0;
                        const cleVar = compteDeFlux('variable');
                        const horsTx = [];""")
sub('chaque transaction rangée sous son total', """                                if (!c) { if (m > 0) { horsBudget += m; nbHors++; } return; }
                                c.depense += m; nbTx++;""", """                                const tx = _txRayonX(t, dt, cleVar);
                                if (!c) { if (m > 0) { horsBudget += m; nbHors++; horsTx.push(tx); } return; }
                                c.depense += m; nbTx++; c.tx.push(tx);""")
sub('exposer transactions et compte', """                            reelSansDates: nbTx === 0 && consoT0Renseigne.value,
                            categories: cats.filter(c => c.budget > 0 || c.depense > 0)
                                .map(c => ({ ...c, budget: Math.round(c.budget), depense: Math.round(c.depense),
                                             pct: c.budget > 0 ? Math.min(100, Math.round(c.depense / c.budget * 100)) : 100 }))
                                .sort((a, b) => b.budget - a.budget),""", """                            reelSansDates: nbTx === 0 && consoT0Renseigne.value,
                            compte: infoCompte(cleVar),
                            horsBudgetTx: horsTx.sort(_parDateDesc),
                            categories: cats.filter(c => c.budget > 0 || c.depense > 0)
                                .map(({ tx, ...c }) => {
                                    const transactions = tx.sort(_parDateDesc);
                                    const autres = {};
                                    transactions.forEach(t => { if (t.horsCompte) autres[t.compte.key] = t.compte; });
                                    return { ...c, budget: Math.round(c.budget), depense: Math.round(c.depense),
                                             reste: Math.round(c.budget - c.depense), nb: transactions.length, transactions,
                                             comptesAutres: Object.values(autres),
                                             pct: c.budget > 0 ? Math.min(100, Math.round(c.depense / c.budget * 100)) : 100 };
                                })
                                .sort((a, b) => b.budget - a.budget),""")

# ── 3. Sanctuaire : par compte payeur ───────────────────────────────────────
sub('sanctuaire par compte', """                            .map(t => ({ libelle: t.libelle, nature: t.nature, badge: t.badge, jourPrevu: t.jourPrevu,
                                         reste: Math.max(0, t.due - (t.regle || 0)), retard: t.rang < r, rang: t.rang }))
                            .filter(t => t.reste > 0)
                            .sort((a, b) => a.rang - b.rang);
                        const parNature = {};
                        lignes.forEach(t => { parNature[t.nature] = (parNature[t.nature] || 0) + t.reste; });
                        return {""", """                            .map(t => ({ libelle: t.libelle, nature: t.nature, badge: t.badge, jourPrevu: t.jourPrevu,
                                         reste: Math.max(0, t.due - (t.regle || 0)), retard: t.rang < r, rang: t.rang,
                                         groupe: t.groupe, icone: t.icone, compteKey: t.compte,
                                         quand: _dateEcheance(t.jourPrevu, t.rang < r) }))
                            .filter(t => t.reste > 0)
                            .sort((a, b) => a.rang - b.rang);
                        const parNature = {};
                        lignes.forEach(t => { parNature[t.nature] = (parNature[t.nature] || 0) + t.reste; });
                        //  v37.21 : « combien doit rester sur quel compte ». Un groupe par
                        //  compte payeur — la règle de routage du Relevé (compteDeFlux).
                        const groupes = {};
                        lignes.forEach(t => { (groupes[t.compteKey] = groupes[t.compteKey] || []).push(t); });
                        const totalLignes = lignes.reduce((s, t) => s + t.reste, 0);
                        const parCompte = Object.entries(groupes).map(([k, ls]) => {
                            const montant = ls.reduce((s, t) => s + t.reste, 0);
                            return { ...infoCompte(k), montant: Math.round(montant), nb: ls.length,
                                     retard: Math.round(ls.filter(t => t.retard).reduce((s, t) => s + t.reste, 0)),
                                     part: totalLignes > 0 ? montant / totalLignes * 100 : 0, lignes: ls };
                        }).sort((a, b) => b.montant - a.montant);
                        return {
                            parCompte,""")

for a, r in edits: src = src.replace(a, r, 1)
io.open(F, 'w', encoding='utf-8').write(src)
print(f'✔ {len(edits)} modifications appliquées à {F}')
