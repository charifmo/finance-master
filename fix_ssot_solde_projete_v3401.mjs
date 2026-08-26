/**
 * v34.01 — SSOT : la Répartition du Patrimoine Projeté lit le moteur du Relevé
 * ---------------------------------------------------------------------------
 * Deux moteurs coexistaient et se contredisaient :
 *   • bilan.lignes[].detailsComptes  → info-bulle « Répartition du Patrimoine
 *     Projeté » et KPI Patrimoine Global
 *   • _buildJournalReleve            → Relevé de Comptes, ligne par ligne
 * Sur les données réelles, Compte Courant fin 2026 : −20 048 DH côté bilan
 * contre +2 107 DH côté relevé, soit 22 155 DH d'écart.
 *
 * Le relevé est le seul des deux qui soit auditable ligne à ligne : c'est lui
 * qui devient la source de vérité. Les soldes projetés par compte proviennent
 * désormais du même moteur, chaîné du cycle courant jusqu'à décembre de
 * l'année cible de projection. L'écart devient nul par construction.
 */
import fs from 'node:fs';

const FILE = new URL('./index.html', import.meta.url);
let s = fs.readFileSync(FILE, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.split('\r\n').join('\n');
const sub = (from, to, n = 1) => {
    const c = s.split(from).length - 1;
    if (c !== n) throw new Error(`Ancre (${c}/${n}) :\n${from.slice(0, 160)}`);
    s = s.split(from).join(to);
};

sub(
`                    const detailsComptesFinal = computed(() => {
                        const row = _derniereLigneCible.value;
                        return (row && row.detailsComptes) ? row.detailsComptes : {};
                    });

                    const detailsEpargneFinal = computed(() => {
                        const row = _derniereLigneCible.value;
                        return (row && row.detailsEpargne) ? row.detailsEpargne : {};
                    });`,
String.raw`                    // ── v34.01 : SSOT — soldes projetés issus du moteur du Relevé ──────
                    //   Même chaînage que le Relevé de Comptes : on part des soldes réels
                    //   d'aujourd'hui et on déroule tous les cycles jusqu'à décembre de
                    //   l'année cible. Ce que montre l'info-bulle est donc exactement la
                    //   dernière ligne du relevé, au dirham près.
                    const soldesProjetesJournal = computed(() => {
                        calculationTick.value;
                        const curM = moisBudgetaire.value.mois, curA = moisBudgetaire.value.an;
                        const cible = Math.max(Number(anneeCibleProjection.value) || curA, curA);
                        const cycles = [];
                        for (let a = curA; a <= cible; a++) {
                            for (let m = (a === curA ? curM : 1); m <= 12; m++) cycles.push(m + '-' + a);
                        }
                        return (_buildJournalReleve([], cycles) || {}).soldesFinaux || {};
                    });

                    const detailsComptesFinal = computed(() => {
                        const src = soldesProjetesJournal.value;
                        const out = {};
                        Object.keys(src).forEach(k => { if (String(k).startsWith('cpt_')) out[k] = src[k]; });
                        if (Object.keys(out).length) return out;
                        // repli : moteur bilan, si le journal n'a rien produit
                        const row = _derniereLigneCible.value;
                        return (row && row.detailsComptes) ? row.detailsComptes : {};
                    });

                    const detailsEpargneFinal = computed(() => {
                        const src = soldesProjetesJournal.value;
                        const out = {};
                        Object.keys(src).forEach(k => { if (String(k).startsWith('ep_')) out[k] = src[k]; });
                        if (Object.keys(out).length) return out;
                        const row = _derniereLigneCible.value;
                        return (row && row.detailsEpargne) ? row.detailsEpargne : {};
                    });`);

sub(
`                        detailsComptesFinal, getCompteLabel, getCompteIcone, getNomCompte,`,
`                        detailsComptesFinal, soldesProjetesJournal, getCompteLabel, getCompteIcone, getNomCompte,`);

/* Libellé : rendre le rattachement explicite dans l'info-bulle */
sub(
`                            <p class="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Répartition du Patrimoine Projeté</p>`,
`                            <p class="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Répartition du Patrimoine Projeté</p>
                            <p class="text-[8px] font-bold text-slate-500 mb-2 -mt-1">Soldes issus du Relevé de Comptes — fin {{ Math.max(anneeCibleProjection, soldesInitiaux.anneeActuelle) }}</p>`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ v34.01 appliquée');
