# -*- coding: utf-8 -*-
"""
v37.48 — UNE SEMAINE SAISIE EN PARTIE.

« Si je rentre une partie du budget et que la semaine finit — par exemple œufs 45 sur 50 —
la valeur comptabilisée de cette semaine sera 45 et non 50 ; 50 ne sera comptabilisé que si
je laisse le champ vide. »

La règle tient ligne par ligne : une ligne TAPÉE compte ce qui a été tapé (même 0) ; une ligne
qui a un ticket daté compte son ticket ; une ligne laissée VIDE compte son prévu une fois la
semaine écoulée. Jusqu'ici, une exception la cassait : un montant dans « Autre » ou un ticket
non rangé sur une ligne (ex. « Marjane » sur la catégorie Alimentation) faisait considérer
toute la catégorie comme « saisie en vrac » — ses lignes vides comptaient alors 0. « Autre »
est « hors de la liste » et un ticket non rangé l'est aussi : ils ne touchent plus aux lignes.
(Un ancien total de CYCLE, d'avant la saisie par semaine, couvre toujours ses semaines.)

Et la semaine EN COURS l'annonce : ce que ses lignes encore vides compteront dimanche soir.
"""
import io, sys

F = 'index.html'
src = io.open(F, encoding='utf-8').read()

def sub(label, a, b, n=1):
    global src
    c = src.count(a)
    if c != n:
        print(f'✖ {F} — {label} : {c} ancre(s), {n} attendue(s)'); sys.exit(1)
    src = src.replace(a, b)

# ── 1. Le moteur : plus de « réglée en vrac » pour une catégorie qui a des lignes ──
sub('defautsSemaine : signature + projection', """                    //  Les défauts d'UNE semaine (lundi ISO) : {} tant qu'elle n'est pas écoulée.
                    const defautsSemaine = (lundiISO) => {
                        const dimanche = _ymd(_decaler(lundiISO, 6));
                        if (!(dimanche < _ymd(new Date()))) return {};""",
"""                    //  Les défauts d'UNE semaine (lundi ISO) : {} tant qu'elle n'est pas écoulée.
                    //  v37.48 : projeter = ce qu'ELLE retiendra à sa clôture (semaine en cours).
                    const defautsSemaine = (lundiISO, projeter = false) => {
                        const dimanche = _ymd(_decaler(lundiISO, 6));
                        if (!projeter && !(dimanche < _ymd(new Date()))) return {};""")
sub('defautsSemaine : fin du bloc « en vrac »', """                            const g = T.parCle[key] || { total: 0, parPoste: {} };
                            //  Saisie EN VRAC cette semaine-là (« Autre », ou un ticket non ventilé sur
                            //  un poste) : la catégorie est réglée en bloc — pas de prévu ajouté aux
                            //  lignes vides, sinon la même dépense compterait deux fois.
                            const nonVentile = g.total - Object.values(g.parPoste || {}).reduce((s, x) => s + x, 0);
                            if ((cv.details || []).some(x => x && Number(x.montant) > 0) && (Number(vals[key] || 0) > 0 || nonVentile > 0.5)) return;
                            const idDe = {};""",
"""                            const g = T.parCle[key] || { total: 0, parPoste: {} };
                            //  v37.48 : LIGNE PAR LIGNE, sans exception — tapée (même 0) : ce qui est
                            //  tapé ; un ticket daté sur la ligne : le ticket ; VIDE : son prévu.
                            //  « Autre » (hors de la liste) et un ticket non rangé sur une ligne
                            //  s'ajoutent à la catégorie : ils ne vident plus les lignes de leur prévu
                            //  (avant : toute la catégorie passait « en vrac », ses lignes vides à 0).
                            const idDe = {};""")

# ── 2. La semaine en cours annonce sa clôture ──
sub('liberteCycle : défauts à venir', """                        const defsSem = defautsSemaine(lundiSel);                        // v37.31 : {} si pas écoulée""",
"""                        const defsSem = defautsSemaine(lundiSel);                        // v37.31 : {} si pas écoulée
                        //  v37.48 : la semaine EN COURS — ce que ses lignes encore vides compteront dimanche soir
                        const defsAVenir = decal === 0 && _semaineDansCycle(lundiSel) ? defautsSemaine(lundiSel, true) : {};""")
sub('liberteCycle : semaine.aVenir', """                                         defaut: categories.reduce((s, c) => s + (c.sem.defaut || 0), 0),
                                         budget: sb, engage: se, reste: sb - se,""",
"""                                         defaut: categories.reduce((s, c) => s + (c.sem.defaut || 0), 0),
                                         //  v37.48 : retenu au prévu à la clôture — les lignes encore vides, du plus gros au plus petit
                                         aVenir: (() => {
                                             const noms = {};
                                             categories.forEach(c => { noms[c.key] = c.label; c.sem.postes.forEach(p => { noms[p.cle] = p.nom; }); });
                                             return Object.entries(defsAVenir).map(([k, m]) => ({ cle: k, nom: String(noms[k] || k).trim(), montant: Math.round(m) }))
                                                 .sort((a, b) => b.montant - a.montant);
                                         })(),
                                         aVenirTotal: Object.values(defsAVenir).reduce((s, m) => s + Math.round(m), 0),
                                         budget: sb, engage: se, reste: sb - se,""")
sub('note de clôture', """                    ✓ Semaine écoulée : les lignes laissées vides comptent leur prévu ({{ formatMad(sm.defaut) }}). Tapez le vrai montant pour corriger — 0 si rien n'a été dépensé.
                </p>""",
"""                    ✓ Semaine écoulée : les lignes laissées vides comptent leur prévu ({{ formatMad(sm.defaut) }}). Tapez le vrai montant pour corriger — 0 si rien n'a été dépensé.
                </p>
                <!-- v37.48 : la semaine en cours annonce sa clôture — tapé = compté, vide = prévu -->
                <p v-if="sm.statut === 'en_cours' && sm.dansCycle && sm.aVenirTotal > 0" data-semaine-a-venir class="mb-2 rounded-lg bg-white/[0.07] ring-1 ring-white/15 px-2.5 py-1.5 text-[10px] font-semibold text-white/80 leading-snug">
                    ⏳ Dimanche soir, la semaine se clôt : une ligne tapée compte ce que vous avez tapé ; une ligne encore vide comptera son prévu — {{ sm.aVenir.slice(0, 3).map(l => l.nom + ' ' + formatMad(l.montant)).join(' · ') }}{{ sm.aVenir.length > 3 ? ' · + ' + (sm.aVenir.length - 3) + ' autre(s)' : '' }}, soit {{ formatMad(sm.aVenirTotal) }}. Rien dépensé ? Tapez 0.
                </p>""")

io.open(F, 'w', encoding='utf-8').write(src)
print('✔ index.html : semaine saisie en partie — tapé = compté, vide = prévu, ligne par ligne')
