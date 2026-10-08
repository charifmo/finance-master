# -*- coding: utf-8 -*-
"""
v37.29 Semaines-Reelles — PARTIE SERVEUR (cfo_intent_engine.php).

  L'application envoie au CFO son net mensuel déjà calculé (surplus_mensuel_net_courant,
  v28.10) : c'est lui qui fait foi. Le recalcul serveur ne sert qu'en secours, mais il
  doit appliquer la MÊME règle que l'écran : une charge variable « / sem » coûte
  valeur × les semaines réelles du cycle (4 ou 5 : les jeudis entre le jour de paie de
  M−1 et la veille de celui de M), et non plus × 4,3.
"""
import io, sys
F = 'cfo_intent_engine.php'
src = io.open(F, encoding='utf-8').read()
edits = []
def sub(label, anchor, replacement, expected=1):
    n = src.count(anchor)
    if n != expected:
        print(f'✖ {label} : {n} ancre(s), {expected} attendue(s)'); sys.exit(1)
    edits.append((anchor, replacement))

sub('règle des semaines', """function cfo_compute_reliquat($fd, $yr) {""",
"""/*  v37.29 — Les semaines RÉELLES d'un cycle (miroir de semainesDuCycle, index.html).
    Le cycle du mois budgétaire M court du jour de paie de M−1 à la veille du jour de
    paie de M ; une semaine lui appartient si son JEUDI y tombe. 4 ou 5, jamais 4,3. */
function cfo_semaines_cycle(int $m, int $an, int $jdp): int {
    if ($jdp < 1) $jdp = 27;
    $debut = (new DateTimeImmutable('now', new DateTimeZone('UTC')))->setDate($an, $m - 1, $jdp)->setTime(12, 0);
    $fin   = (new DateTimeImmutable('now', new DateTimeZone('UTC')))->setDate($an, $m, $jdp - 1)->setTime(12, 0);
    $jeudi = $debut->modify('+' . ((4 - (int)$debut->format('w') + 7) % 7) . ' days');
    $n = 0;
    while ($jeudi <= $fin && $n < 6) { $n++; $jeudi = $jeudi->modify('+7 days'); }
    return $n ?: 4;
}
function cfo_semaines_annee(int $an, int $jdp): int {
    $s = 0; for ($m = 1; $m <= 12; $m++) $s += cfo_semaines_cycle($m, $an, $jdp);
    return $s;
}
function cfo_jour_de_paie($fd): int {
    return (int)(oget(oget($fd, 'soldesInitiaux', onew()), 'jourDePaie') ?: 27) ?: 27;
}

function cfo_compute_reliquat($fd, $yr) {""")
sub('reliquat : mois moyen', """        $sumVar += (oget($o, 'periode') === 'semaine') ? $v * 4.3 : $v;""",
"""        // v37.29 : un mois MOYEN de l'année = ses semaines réelles ÷ 12 (plus × 4,3)
        $sumVar += (oget($o, 'periode') === 'semaine') ? $v * cfo_semaines_annee((int)$yr, cfo_jour_de_paie($fd)) / 12 : $v;""")
sub('net mensuel : jour de paie', """    $curM   = (int)(oget($si, 'moisActuel') ?: (((int)$year === $curA) ? (int)date('n') : 1));
""", """    $curM   = (int)(oget($si, 'moisActuel') ?: (((int)$year === $curA) ? (int)date('n') : 1));
    $jdp    = cfo_jour_de_paie($fd);   // v37.29
""")
sub('net mensuel : semaines du cycle', """                if (oget($cv, 'periode') === 'semaine') $v *= 4.3;""",
"""                if (oget($cv, 'periode') === 'semaine') $v *= cfo_semaines_cycle($m, (int)$year, $jdp);   // v37.29""")

for a, r in edits: src = src.replace(a, r, 1)
io.open(F, 'w', encoding='utf-8').write(src)
print(f'✔ {len(edits)} modifications appliquées à {F}')
