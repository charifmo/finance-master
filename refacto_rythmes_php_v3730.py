# -*- coding: utf-8 -*-
"""
v37.30 Rythmes-Par-Ligne — PARTIE SERVEUR (cfo_intent_engine.php).

  Miroir de l'application : chaque ligne de détail d'une charge variable porte son
  rythme (semaine | quinzaine | cycle) ; sans rythme, elle hérite de sa catégorie.
    • net mensuel de secours : coût du cycle LIGNE PAR LIGNE (N, N/2 ou 1) ;
    • `valeur` d'une catégorie à lignes = l'équivalent dans son unité (la somme
      brute tant que les lignes ont le rythme de la catégorie — parité intacte) ;
    • un nouveau total demandé par le CFO se répartit au prorata de cet
      équivalent, en gardant le rythme de chaque ligne.
"""
import io, sys
F = 'cfo_intent_engine.php'
src = io.open(F, encoding='utf-8').read()
edits = []
def sub(label, anchor, replacement, expected=1):
    n = src.count(anchor)
    if n != expected:
        print(f'✖ {label} : {n} ancre(s), {expected} attendue(s)'); sys.exit(1)
    edits.append((anchor, replacement, expected))

sub('règles des rythmes', """function cfo_compute_reliquat($fd, $yr) {""",
"""/*  v37.30 — UN RYTHME PAR LIGNE DE DÉTAIL (miroir de periodeDetail / coutVariableDuCycle,
    index.html). Sans rythme, une ligne hérite de sa catégorie : « semaine » → semaine,
    « mois » → cycle. Une ligne coûte montant × N (/sem), × N/2 (/15 j) ou × 1 (/cycle). */
function cfo_periode_detail($d, $cv): string {
    $p = oget($d, 'periode');
    if (in_array($p, ['semaine', 'quinzaine', 'cycle'], true)) return $p;
    return oget($cv, 'periode') === 'semaine' ? 'semaine' : 'cycle';
}
function cfo_facteur_periode(string $p, float $n): float { return $p === 'semaine' ? $n : ($p === 'quinzaine' ? $n / 2 : 1.0); }
function cfo_a_des_lignes($cv): bool { $d = oget($cv, 'details'); return is_array($d) && count($d) > 0; }
function cfo_exception_du_mois($item, int $m) {
    $v = null;
    foreach ((oget($item, 'exceptions') ?: []) as $e) {
        $md = (int)(oget($e, 'moisDebut', 0) ?: 0); $mf = (int)(oget($e, 'moisFin', 0) ?: 0);
        if ($md && $mf && $m >= $md && $m <= $mf) $v = (float)(oget($e, 'nouvelleValeur', 0) ?: 0);
    }
    return $v;
}
function cfo_cout_variable_cycle($cv, int $m, int $an, int $jdp, bool $avecExceptions = true): float {
    $n = cfo_semaines_cycle($m, $an, $jdp);
    $exc = $avecExceptions ? cfo_exception_du_mois($cv, $m) : null;
    if ($exc === null && cfo_a_des_lignes($cv)) {
        $s = 0.0;
        foreach (oget($cv, 'details') as $d) $s += (float)(oget($d, 'montant', 0) ?: 0) * cfo_facteur_periode(cfo_periode_detail($d, $cv), $n);
        return $s;
    }
    $v = $exc !== null ? $exc : (float)(oget($cv, 'valeur', 0) ?: 0);
    return oget($cv, 'periode') === 'semaine' ? $v * $n : $v;
}
function cfo_details_uniformes($cv): bool {
    $unite = oget($cv, 'periode') === 'semaine' ? 'semaine' : 'cycle';
    foreach ((oget($cv, 'details') ?: []) as $d) if (cfo_periode_detail($d, $cv) !== $unite) return false;
    return true;
}
//  `valeur` d'une catégorie à lignes : la somme brute si toutes ont son rythme (comme
//  avant) ; sinon l'équivalent dans son unité sur une année réelle, arrondi.
function cfo_valeur_equivalente($cv, int $an, int $jdp): float {
    $det = oget($cv, 'details') ?: [];
    $brut = 0.0; foreach ($det as $d) $brut += (float)(oget($d, 'montant', 0) ?: 0);
    if (cfo_details_uniformes($cv)) return $brut;
    $nMoy = cfo_semaines_annee($an, $jdp) / 12;
    $parCycle = 0.0;
    foreach ($det as $d) $parCycle += (float)(oget($d, 'montant', 0) ?: 0) * cfo_facteur_periode(cfo_periode_detail($d, $cv), $nMoy);
    return (float)round(oget($cv, 'periode') === 'semaine' ? $parCycle / $nMoy : $parCycle);
}
//  Un nouveau total (dans l'unité de la catégorie) réparti sur des lignes aux rythmes
//  MÊLÉS : chaque montant suit le même ratio, chaque ligne garde son rythme.
function cfo_redistribuer_rythmes(array $det, $cv, float $v, int $an, int $jdp): ?float {
    $eq = cfo_valeur_equivalente($cv, $an, $jdp);
    if ($eq == 0.0) return null;
    $ratio = $v / $eq;
    foreach ($det as $d) oset($d, 'montant', (int)round((float)oget($d, 'montant') * $ratio));
    return $ratio;
}

function cfo_compute_reliquat($fd, $yr) {""")
sub('reliquat : ligne par ligne', """        $v = (float)(oget($o, 'valeur', 0) ?: 0);
        // v37.29 : un mois MOYEN de l'année = ses semaines réelles ÷ 12 (plus × 4,3)
        $sumVar += (oget($o, 'periode') === 'semaine') ? $v * cfo_semaines_annee((int)$yr, cfo_jour_de_paie($fd)) / 12 : $v;""",
"""        // v37.29 : un mois MOYEN de l'année = ses semaines réelles ÷ 12 (plus × 4,3)
        // v37.30 : et chaque ligne de détail avec SON rythme
        $t = 0.0; for ($mm = 1; $mm <= 12; $mm++) $t += cfo_cout_variable_cycle($o, $mm, (int)$yr, cfo_jour_de_paie($fd), false);
        $sumVar += $t / 12;""")
sub('net mensuel : ligne par ligne', """                $v = $eff($cv, oget($cv, 'valeur'), $m);
                if (oget($cv, 'periode') === 'semaine') $v *= cfo_semaines_cycle($m, (int)$year, $jdp);   // v37.29""",
"""                $v = cfo_cout_variable_cycle($cv, $m, (int)$year, $jdp, true);   // v37.29-30 : semaines réelles, ligne par ligne""")
#  set_charge_variable / update_charge_variable : rythmes mêlés → ratio sur l'équivalent
REDIS_OLD = """                $ratio = $v / $cs; $dist = 0;
                for ($i = 0; $i < count($det) - 1; $i++) { $nm = (int)round((float)oget($det[$i],'montant') * $ratio); oset($det[$i],'montant',$nm); $dist += $nm; }
                oset($det[count($det)-1],'montant', $v - $dist);
                $log['redistribution']='proportionnelle'; $log['ratio']=round($ratio,3);"""
REDIS_NEW = """                if (cfo_details_uniformes($item)) {
                    $ratio = $v / $cs; $dist = 0;
                    for ($i = 0; $i < count($det) - 1; $i++) { $nm = (int)round((float)oget($det[$i],'montant') * $ratio); oset($det[$i],'montant',$nm); $dist += $nm; }
                    oset($det[count($det)-1],'montant', $v - $dist);
                } else {
                    // v37.30 : rythmes mêlés — même ratio pour chaque ligne, rythmes conservés
                    $ratio = cfo_redistribuer_rythmes($det, $item, (float)$v, $a, cfo_jour_de_paie($fd)) ?? ($v / $cs);
                }
                $log['redistribution']='proportionnelle'; $log['ratio']=round($ratio,3);"""
sub('set_charge_variable : rythmes', REDIS_OLD, REDIS_NEW)
REDIS2_OLD = """                    $ratio = $v / $cs; $dist = 0;
                    for ($i = 0; $i < count($det) - 1; $i++) { $nm = (int)round((float)oget($det[$i],'montant') * $ratio); oset($det[$i],'montant',$nm); $dist += $nm; }
                    oset($det[count($det)-1],'montant', $v - $dist);
                    $ch['redistribution'] = ['mode'=>'proportionnelle','ratio'=>round($ratio,3),"""
REDIS2_NEW = """                    if (cfo_details_uniformes($t)) {
                        $ratio = $v / $cs; $dist = 0;
                        for ($i = 0; $i < count($det) - 1; $i++) { $nm = (int)round((float)oget($det[$i],'montant') * $ratio); oset($det[$i],'montant',$nm); $dist += $nm; }
                        oset($det[count($det)-1],'montant', $v - $dist);
                    } else {
                        // v37.30 : rythmes mêlés — même ratio pour chaque ligne, rythmes conservés
                        $ratio = cfo_redistribuer_rythmes($det, $t, (float)$v, $a, cfo_jour_de_paie($fd)) ?? ($v / $cs);
                    }
                    $ch['redistribution'] = ['mode'=>'proportionnelle','ratio'=>round($ratio,3),"""
sub('update_charge_variable : rythmes', REDIS2_OLD, REDIS2_NEW)
sub('update_charge_variable_detail : équivalent', """            $tot = 0.0; foreach ($det as $d) $tot += (float)(oget($d,'montant',0) ?: 0);
            oset($t,'valeur',$tot);""",
"""            // v37.30 : l'équivalent dans l'unité de la catégorie (la somme si rythmes uniformes)
            $tot = cfo_valeur_equivalente($t, $a, cfo_jour_de_paie($fd));
            oset($t,'valeur',$tot);""")

for a, r, n in edits: src = src.replace(a, r, n)
io.open(F, 'w', encoding='utf-8').write(src)
print(f'✔ {len(edits)} modifications appliquées à {F}')
