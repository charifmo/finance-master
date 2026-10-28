#!/usr/bin/env python3
"""v37.68 — LES EN-TÊTES DE COMPTE NE SONT PAS DES OPÉRATIONS ; LE SALAIRE AU BON COMPTE CHAQUE ANNÉE.

  1. Import bancaire : la ligne d'en-tête « Compte chèque 5 … » (l'intitulé du compte suivi de son
     solde), quand l'OCR la retrouve au milieu des opérations, était lue comme une opération — cinq
     fois déjà (dont une de 7 526,28 DH classée « Frais bancaire », qui mangeait le reste à dépenser).
     Une ligne dont le libellé commence par « Compte chèque » / « Compte courant » n'est plus une
     opération.
  2. Corrections approuvées par l'utilisateur, appliquées une fois au chargement (schéma 23) :
     a. l'opération importée qu'il a désignée est retirée (repérée par une empreinte — ni son montant
        ni son libellé ne sont écrits ici) et sa ligne du registre bancaire passe « ignorée » ;
     b. les années suivantes envoyaient le salaire et la bonification sur le Compte Courant alors
        qu'ils arrivent sur un autre compte cette année : ils suivent le compte de cette année, et
        l'« épargne » qui renvoyait du Courant vers ce compte (le trajet inverse) est retirée.
"""
import io, sys

F = 'index.html'
src = io.open(F, encoding='utf-8').read()

def sub(label, old, new, n=1):
    global src
    c = src.count(old)
    if c != n:
        print(f'✖ {label} : {c} ancre(s), {n} attendue(s)'); sys.exit(1)
    src = src.replace(old, new)

# ── 1. Import bancaire ─────────────────────────────────────────────────────
sub('import : motif en-tête',
"""                    const bqNorm = (s) => String(s || '').toLowerCase().replace(/œ/g, 'oe').normalize('NFD').replace(/\\p{M}/gu, '');""",
"""                    const bqNorm = (s) => String(s || '').toLowerCase().replace(/œ/g, 'oe').normalize('NFD').replace(/\\p{M}/gu, '');
                    //  v37.68 : « Compte chèque 5 … 7 526,28 » — l'intitulé du compte et son solde, que l'OCR retrouve
                    //  au milieu de la liste quand l'écran défile : jamais une opération.
                    const BQ_ENTETE_COMPTE = /^compte\\s*(cheque|courant)\\b/;""")

sub('import : filtre',
"""                            if (!dateOp) op.sansDateOp = true;       // v37.54 : la date comptable n'a pas été lue (jour illisible)
                            return op;
                        });""",
"""                            if (!dateOp) op.sansDateOp = true;       // v37.54 : la date comptable n'a pas été lue (jour illisible)
                            return op;
                        }).filter(o => !BQ_ENTETE_COMPTE.test(bqNorm(o.libelle).trim()));   // v37.68 : un en-tête de compte""")

# ── 2. Corrections approuvées (schéma 23) ──────────────────────────────────
sub('corrections : définition',
"""                    // ── Patch v15.1 : corrige soldeInitial→solde + inclureLiquidite ──""",
"""                    // ── v37.68 : CORRECTIONS APPROUVÉES PAR L'UTILISATEUR (schéma 23), une seule fois ──
                    //  a. les opérations importées qu'il a désignées comme fausses — par empreinte (date | ligne du
                    //     registre | montant) : rien de ses données n'est écrit dans le code ;
                    //  b. le salaire et la bonification des années suivantes suivent le compte de cette année quand
                    //     ces années les envoyaient sur le Courant ; l'« épargne » Courant → ce compte est retirée.
                    const _empreinte = (s) => { let h = 0x811c9dc5; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0; return h.toString(16).padStart(8, '0'); };
                    const OPERATIONS_RETIREES = new Set(['04ed9c20']);
                    const corrigerDonneesApprouvees = (data) => {
                        const n = { operations: 0, revenus: 0, epargnes: 0 };
                        if (!data || (data._schemaVersion || 0) >= 23) return n;
                        const A = data.donneesAnnuelles || {};
                        Object.values(A).forEach(a => {
                            if (!a || !Array.isArray(a.transactionsReelles)) return;
                            a.transactionsReelles = a.transactionsReelles.filter(t => {
                                if (!t || !OPERATIONS_RETIREES.has(_empreinte(t.date + '|' + (t.banqueHash || '') + '|' + Number(t.montant).toFixed(2)))) return true;
                                const r = a.banqueOperations && t.banqueHash && a.banqueOperations[t.banqueHash];
                                if (r) { r.s = 'ignoree'; delete r.x; r.r = 'En-tête de compte lu comme une opération (v37.68)'; }
                                n.operations++;
                                return false;
                            });
                        });
                        const si = data.soldesInitiaux || {}, an0 = Number(si.anneeActuelle) || new Date().getFullYear();
                        const cc = (data.comptes || []).find(c => c.type === 'courant' || c.type === 'liquide');
                        const estCourant = (k) => !k || k === 'courant' || (cc && String(k) === 'cpt_' + cc.id);
                        const ref = (A[an0] || {}).revenus || {};
                        ['salaire', 'bonif'].forEach(cle => {
                            const dest = ref[cle] && ref[cle].destinationCompte;
                            if (estCourant(dest)) return;
                            const id = String(dest).replace(/^cpt_/, '');
                            Object.keys(A).filter(y => Number(y) > an0).forEach(y => {
                                const r = ((A[y] || {}).revenus || {})[cle];
                                if (!r || !estCourant(r.destinationCompte)) return;
                                r.destinationCompte = dest; n.revenus++;
                                if (Array.isArray(A[y].epargne)) A[y].epargne = A[y].epargne.filter(e => {
                                    const inverse = e && estCourant(e.sourceCompte) && String(e.linkedAccountId) === id;
                                    if (inverse) n.epargnes++;
                                    return !inverse;
                                });
                            });
                        });
                        return n;
                    };

                    // ── Patch v15.1 : corrige soldeInitial→solde + inclureLiquidite ──""")

sub('corrections : appel',
"""                            purgerSourceCompteCharges(data);                    // v37.67 : schéma 22""",
"""                            purgerSourceCompteCharges(data);                    // v37.67 : schéma 22
                            const _corr = corrigerDonneesApprouvees(data);      // v37.68 : schéma 23
                            if (_corr.operations) addLog('🧹 ' + _corr.operations + ' opération(s) importée(s) par erreur retirée(s) (en-tête de compte lu comme une dépense).', 'success');
                            if (_corr.revenus) addLog('🏦 Salaire et bonification des années suivantes remis sur le compte où ils arrivent (' + _corr.revenus + ' ligne(s))' + (_corr.epargnes ? ', ' + _corr.epargnes + ' virement(s) inverse(s) retiré(s)' : '') + '.', 'success');""")

sub('export : schéma 23',
"""_schemaVersion: 22, soldesInitiaux""",
"""_schemaVersion: 23, soldesInitiaux""")

sub('exposés',
"""purgerSourceCompteCharges, _lectureCFO,""",
"""purgerSourceCompteCharges, corrigerDonneesApprouvees, OPERATIONS_RETIREES, _empreinte, _lectureCFO,""")

io.open(F, 'w', encoding='utf-8').write(src)
print('✔ v37.68 : en-têtes de compte ignorés à l\'import, corrections approuvées (schéma 23)')
