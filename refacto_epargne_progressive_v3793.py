#!/usr/bin/env python3
"""v37.93 — L'ÉPARGNE SE CONSTRUIT PEU À PEU : LES GROS VIREMENTS DE FIN D'ANNÉE VERS LE MÊME COMPTE SONT ABSORBÉS.

« Pourquoi un gros montant envoyé à la fin de l'année vers urgence ? Pourquoi ne pas construire petit à petit ? »
  Les 40 000 + 20 000 DH de décembre vers Compte urgence étaient un « écrêtage » du CFO : l'argent laissé dormir
  toute l'année, vidé d'un coup en décembre. Avec la réserve de la v37.91, l'épargne mensuelle s'arrêtait en août
  pour laisser ces gros virements partir.

  Désormais, « adapter l'épargne au potentiel » ABSORBE les virements ponctuels qui vont vers le MÊME compte que la
  ligne adaptée (Compte urgence) sur les mois adaptés : ils sont retirés, et la ligne prend chaque mois ce que le
  mois dégage — l'épargne se construit régulièrement, sans bloc de fin d'année. Les virements vers d'autres comptes
  (3 000 vers Long Terme) restent, avec leur réserve. « Retirer l'adaptation » remet les virements absorbés.
"""
import io, sys

F = 'index.html'
src = io.open(F, encoding='utf-8').read()
def sub(label, old, new):
    global src
    c = src.count(old)
    if c != 1:
        print(f'✖ {label} : {c} ancre(s), 1 attendue'); sys.exit(1)
    src = src.replace(old, new)

sub('adaptation : absorbe les virements ponctuels vers le même compte',
"""                        const cap = Number(plafond) > 0 ? Number(plafond) : null;
                        const valeurs = {};
                        /*  v37.91 — L'ANNÉE ENTIÈRE, PAS MOIS PAR MOIS.""",
"""                        const cap = Number(plafond) > 0 ? Number(plafond) : null;
                        const valeurs = {};
                        //  v37.93 : les virements ponctuels vers le MÊME compte que la ligne, sur les mois adaptés, sont ABSORBÉS
                        //  (retirés, gardés pour « Retirer l'adaptation ») : l'épargne se construit chaque mois, pas d'un bloc en décembre
                        const destK = cleDeCompte(String(destEpargne(obj))), dA = donneesAnnuelles.value[a];
                        const absorbes = ((obj.adapteePotentiel && obj.adapteePotentiel.an === a && obj.adapteePotentiel.virementsAbsorbes) || []).slice();
                        if (Array.isArray(dA.virementsInternes)) dA.virementsInternes = dA.virementsInternes.filter(v => {
                            if (!v) return true;
                            const c = cycleDuVirement(v, a);
                            if (c.a !== a || !mois.includes(c.m) || cleDeCompte(String(v.destinationCompte || 'courant')) !== destK) return true;
                            if (!(sensEpargne(v.sourceCompte || 'courant', v.destinationCompte || 'courant') > 0)) return true;
                            absorbes.push(JSON.parse(JSON.stringify(v))); return false;
                        });
                        calculationTick.value++;
                        /*  v37.91 — L'ANNÉE ENTIÈRE, PAS MOIS PAR MOIS.""")
sub('adaptation : garde les virements absorbés',
"""                        obj.adapteePotentiel = { an: a, plafond: cap, le: _aujourdhuiISO(), mois: valeurs };""",
"""                        obj.adapteePotentiel = { an: a, plafond: cap, le: _aujourdhuiISO(), mois: valeurs, virementsAbsorbes: absorbes };""")
sub('retrait : remet les virements absorbés',
"""                    const retirerAdaptationEpargne = (obj) => {
                        if (!obj) return;""",
"""                    const retirerAdaptationEpargne = (obj) => {
                        if (!obj) return;
                        //  v37.93 : les virements ponctuels absorbés reviennent
                        const _ap = obj.adapteePotentiel || {}, _dR = (donneesAnnuelles.value || {})[_ap.an];
                        if (_dR && (_ap.virementsAbsorbes || []).length) { if (!Array.isArray(_dR.virementsInternes)) _dR.virementsInternes = []; _ap.virementsAbsorbes.forEach(v => _dR.virementsInternes.push(v)); }""")
#  le compte rendu au CFO / au fil : combien de virements absorbés
sub('fil du CFO : virements absorbés',
"""                                    fait.push('⚖️ « ' + (obj.nom || obj.label) + ' » adaptée au potentiel en ' + an + ' : ' + Object.entries(mo).map(([m, v]) => _MOIS_COURTS[m - 1] + ' ' + formatMAD(v)).join(' · '));""",
"""                                    const _abs = (obj.adapteePotentiel || {}).virementsAbsorbes || [];
                                    fait.push('⚖️ « ' + (obj.nom || obj.label) + ' » adaptée au potentiel en ' + an + ' : ' + Object.entries(mo).map(([m, v]) => _MOIS_COURTS[m - 1] + ' ' + formatMAD(v)).join(' · ')
                                              + (_abs.length ? ' — ' + _abs.length + ' virement(s) ponctuel(s) vers le même compte absorbé(s) (' + formatMAD(_abs.reduce((s, v) => s + Math.abs(Number(v.montant) || 0), 0)) + ') : l’épargne se construit chaque mois' : ''));""")
io.open(F, 'w', encoding='utf-8').write(src)
print('✔ v37.93 : épargne progressive, virements ponctuels vers le même compte absorbés')
