# -*- coding: utf-8 -*-
"""
v37.47 — le net mensuel de secours du CFO (cfo_compute_monthly_net_courant, utilisé pour
l'épargne « % du reliquat ») suit la même règle que la colonne NET du « Surplus détaillé » :
le PÉRIMÈTRE DE FONCTIONNEMENT (compte courant, compte des charges fixes, compte des
charges variables, comptes qui reçoivent un revenu — ou le choix coché sur chaque compte),
l'épargne = ce qui quitte ce périmètre (ligne d'épargne ou virement) moins ce qui y revient ;
un mouvement entre deux comptes du périmètre s'annule.
"""
import io, sys

F = 'cfo_intent_engine.php'
src = io.open(F, encoding='utf-8').read()

def sub(label, a, b, n=1):
    global src
    c = src.count(a)
    if c != n:
        print(f'✖ {F} — {label} : {c} ancre(s), {n} attendue(s)'); sys.exit(1)
    src = src.replace(a, b)

sub('périmètre', """    $isC = function ($k) use ($courantKey, $idsComptes) { return cfo_norm_key_c($k, $courantKey, $idsComptes) === $courantKey; };

    $fxSrc  = cfo_norm_key_c(oget($si, 'compteChargesFixes', 'courant'), $courantKey, $idsComptes);
    $varSrc = cfo_norm_key_c(oget($si, 'compteChargesVariables', 'courant'), $courantKey, $idsComptes);""",
"""    $fxSrc  = cfo_norm_key_c(oget($si, 'compteChargesFixes', 'courant'), $courantKey, $idsComptes);
    $varSrc = cfo_norm_key_c(oget($si, 'compteChargesVariables', 'courant'), $courantKey, $idsComptes);

    // v37.47 : le PÉRIMÈTRE DE FONCTIONNEMENT (comme l'application) — auto : courant, compte des
    //   charges fixes, des charges variables, comptes qui reçoivent un revenu ; ou forcé par
    //   comptes[].fonctionnement (true / false).
    $auto = [$courantKey => true, $fxSrc => true, $varSrc => true];
    foreach ((array)(oget($fd, 'donneesAnnuelles') ?: []) as $an) {
        if (!is_object($an)) continue;
        foreach (ovals(oget($an, 'revenus', onew())) as $r) $auto[cfo_norm_key_c(oget($r, 'destinationCompte') ?: 'courant', $courantKey, $idsComptes)] = true;
    }
    $perimetre = [];
    $listeComptes = array_filter((oget($fd, 'comptes') ?: []), 'is_object');
    if (!$listeComptes) $perimetre[$courantKey] = true;
    foreach ($listeComptes as $c) {
        $k = 'cpt_' . oget($c, 'id');
        $f = oget($c, 'fonctionnement');
        if ($f === true || ($f !== false && isset($auto[$k]))) $perimetre[$k] = true;
    }
    $isC = function ($k) use ($courantKey, $idsComptes, $perimetre) { return isset($perimetre[cfo_norm_key_c($k ?: 'courant', $courantKey, $idsComptes)]); };
    // +1 : quitte le périmètre (épargne) · −1 : y revient (reprise) · 0 : reste dedans ou dehors
    $sens = function ($src, $dest) use ($isC) { $a = $isC($src ?: 'courant'); $b = $isC($dest ?: 'courant'); return $a === $b ? 0 : ($a ? 1 : -1); };""")
sub('épargne classée', """    $epArr = [];
    foreach ($epPool as $o) { if (is_object($o) && $isC(oget($o, 'sourceCompte'))) $epArr[] = $o; }""",
"""    $epArr = [];
    foreach ($epPool as $o) {
        if (!is_object($o)) continue;
        $lie = oget($o, 'linkedAccountId');
        $dest = ($lie !== null && $lie !== '') ? $lie : 'ep_' . oget($o, 'id');
        $s = $sens(oget($o, 'sourceCompte') ?: 'courant', $dest);
        if ($s !== 0) $epArr[] = [$o, $s];
    }""")
sub('fixes', """        if ($fxSrc === $courantKey) {
            foreach (ovals(oget($y, 'chargesFixes', onew())) as $f) {""", """        if ($isC($fxSrc)) {
            foreach (ovals(oget($y, 'chargesFixes', onew())) as $f) {""")
sub('variables', """        if ($varSrc === $courantKey) {
            foreach (ovals(oget($y, 'chargesVariables', onew())) as $cv) {""", """        if ($isC($varSrc)) {
            foreach (ovals(oget($y, 'chargesVariables', onew())) as $cv) {""")
sub('virements → épargne', """        // v37.37 : virements internes — une sortie s'ils QUITTENT le Courant (le virement qui
        //   alimente le compte des charges fixes), une entrée s'ils y ARRIVENT. Pas de l'épargne.
        foreach ((oget($y, 'virementsInternes') ?: []) as $vi) {
            if (!is_object($vi) || (int)oget($vi, 'mois') !== $m) continue;
            $mt = abs((float)(oget($vi, 'montant', 0) ?: 0));
            if ($mt <= 0) continue;
            $sort = $isC(oget($vi, 'sourceCompte') ?: 'courant');
            $arrive = $isC(oget($vi, 'destinationCompte') ?: 'courant');
            if ($sort === $arrive) continue;
            if ($sort) $sortants += $mt; else $entrants += $mt;
        }
        $ep = 0.0;
        foreach ($epArr as $o) $ep += $eff($o, oget($o, 'valeur'), $m);

        $solde = 0.0;
        if ($isCurrent) $solde = $courantCpt ? (float)(oget($courantCpt, 'solde', 0) ?: 0) : (float)(oget($si, 'courant', 0) ?: 0);""",
"""        // v37.47 : l'épargne = ce qui quitte le périmètre (ligne d'épargne ou virement interne)
        //   moins ce qui y revient ; entre deux comptes du périmètre (Courant → Assafa), rien.
        $ep = 0.0;
        foreach ($epArr as [$o, $s]) { $v = $eff($o, oget($o, 'valeur'), $m); if ($v > 0) $ep += $s * $v; }
        foreach ((oget($y, 'virementsInternes') ?: []) as $vi) {
            if (!is_object($vi) || (int)oget($vi, 'mois') !== $m) continue;
            $mt = abs((float)(oget($vi, 'montant', 0) ?: 0));
            if ($mt <= 0) continue;
            $ep += $sens(oget($vi, 'sourceCompte') ?: 'courant', oget($vi, 'destinationCompte') ?: 'courant') * $mt;
        }

        $solde = 0.0;
        if ($isCurrent) {
            if ($listeComptes) { foreach ($listeComptes as $c) if (isset($perimetre['cpt_' . oget($c, 'id')])) $solde += (float)(oget($c, 'solde', 0) ?: 0); }
            else $solde = (float)(oget($si, 'courant', 0) ?: 0);
        }""")

io.open(F, 'w', encoding='utf-8').write(src)
print('✔ cfo_intent_engine.php : net mensuel du CFO au périmètre de fonctionnement')
