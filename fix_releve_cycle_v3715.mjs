/* ═══════════════════════════════════════════════════════════════════════
   v37.15 Releve-Cycle — Le Relevé range les flux par cycle, pas par calendrier
   ─────────────────────────────────────────────────────────────────────
   DEUX CHOSES, dont une seule était cassée :

   1) L'ORDRE du journal était DÉJÀ cyclique (_pSort/_cSort ramènent chaque
      jour à son rang depuis la paie). Mesuré : sur un cycle 27→26, le
      salaire du j.27 est bien la PREMIÈRE ligne. Rien à réparer là.

   2) LE RANGEMENT des créances assurances, lui, était calendaire : une
      créance datée du 28 septembre, avec une paie le 27, atterrissait dans
      le cycle de SEPTEMBRE alors que cette date appartient au cycle
      « 27 sep → 26 oct », donc au mois budgétaire d'OCTOBRE. C'est le bug.

   Au passage : la formule du rang dans le cycle existait en TROIS copies
   (_pSort, _cSort, _rangDansCycle). Elle n'en a plus qu'une.
   ═══════════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync } from 'node:fs';

const F = 'index.html';
let src = readFileSync(F, 'utf8');
const edits = [];
const sub = (label, anchor, replacement, expected = 1) => {
    const n = src.split(anchor).length - 1;
    if (n !== expected) { console.error(`✖ ${label} : ${n} ancre(s), ${expected} attendue(s)`); process.exit(1); }
    edits.push([anchor, replacement]);
};

// ── 1. Les deux helpers partagés, juste après jourDePaie ──────────────
sub('helpers partagés',
`                    const jourDePaie = computed(() => Number(soldesInitiaux.value.jourDePaie) || 27);
`,
`                    const jourDePaie = computed(() => Number(soldesInitiaux.value.jourDePaie) || 27);

                    /* ═══ v37.15 — LE CYCLE, PAS LE CALENDRIER ═══════════════════════
                       Un cycle de paie va du j.jdp au j.jdp-1 du mois suivant. Deux
                       questions reviennent partout dans l'application :

                         « À quelle place de ce cycle tombe ce jour ? »  → rangDansCycle
                         « Quel cycle contient cette date ? »            → cycleBudgetaireDe

                       Elles avaient jusqu'ici trois réponses, écrites à trois endroits.
                       Elles n'en ont plus qu'une.
                       ─────────────────────────────────────────────────────────────── */
                    //  Le rang, pas le numéro du jour. Sur un cycle 27→26, le j.1 vient
                    //  APRÈS le j.27 : comparer bêtement 1 et 27 classerait le j.1 « en
                    //  retard » alors qu'il est encore à venir.
                    const rangDansCycle = (jour) => {
                        const jdp = jourDePaie.value;
                        const j = Number(jour);
                        if (!Number.isFinite(j) || j < 1 || j > 31) return 99;   // sans date → en queue
                        return j >= jdp ? j - jdp : j - jdp + 31;
                    };
                    //  Le 28 septembre, avec une paie le 27, n'appartient pas au budget
                    //  de septembre : il tombe dans le cycle « 27 sep → 26 oct », donc
                    //  dans le mois budgétaire d'OCTOBRE. C'est la règle que
                    //  getDepensesCycle applique déjà aux dépenses irrégulières ; elle
                    //  vaut maintenant pour tout ce qui porte une date.
                    const cycleBudgetaireDe = (jour, mois, an) => {
                        const jdp = jourDePaie.value;
                        const j = Number(jour), m = Number(mois), a = Number(an);
                        if (!Number.isFinite(j) || !Number.isFinite(m) || !Number.isFinite(a)) return { mois: m, an: a };
                        if (jdp <= 1) return { mois: m, an: a };   // paie le 1er → cycle = mois calendaire
                        if (j < jdp) return { mois: m, an: a };
                        return m === 12 ? { mois: 1, an: a + 1 } : { mois: m + 1, an: a };
                    };
`);

// ── 2. _pSort et _cSort délèguent ─────────────────────────────────────
sub('_pSort',
`                        const _pSort = (j) => (j || 0) >= jdp ? (j || 0) - jdp : (j || 0) + (32 - jdp);`,
`                        const _pSort = (j) => rangDansCycle(j);   // v37.15 : une seule formule`);

sub('_cSort',
`                        const _cSort = (j) => (j || 0) >= jdp ? (j || 0) - jdp : (j || 0) + (32 - jdp);`,
`                        const _cSort = (j) => rangDansCycle(j);   // v37.15 : une seule formule`);

// ── 3. _rangDansCycle devient un alias ────────────────────────────────
sub('_rangDansCycle',
`                    const _rangDansCycle = (jour) => {
                        const jdp = jourDePaie.value;
                        const j = Number(jour);
                        if (!Number.isFinite(j) || j < 1 || j > 31) return 99;   // sans date → en queue
                        return j >= jdp ? j - jdp : j - jdp + 31;
                    };`,
`                    const _rangDansCycle = rangDansCycle;   // v37.15 : la formule vit désormais près de jourDePaie`);

// ── 4. LE BUG : routage calendaire des créances assurances ────────────
sub('créances assurances_tracker',
`                                let _cycleM = curM, _cycleA = curA, _jourPrevu = jdp;
                                if (c.dateRemboursement) {
                                    const _dr = new Date(c.dateRemboursement);
                                    _cycleM = _dr.getMonth() + 1; _cycleA = _dr.getFullYear(); _jourPrevu = _dr.getDate();
                                }
                                if (_cycleM !== m || _cycleA !== a) return; // filtre cycle exact`,
`                                //  v37.15 : la date de remboursement est CALENDAIRE, le
                                //  cycle est BUDGÉTAIRE. Une créance du 28 septembre avec
                                //  une paie le 27 appartient au cycle « 27 sep → 26 oct »,
                                //  soit le mois budgétaire d'octobre — pas à septembre.
                                let _cycleM = curM, _cycleA = curA, _jourPrevu = jdp;
                                if (c.dateRemboursement) {
                                    const _dr = new Date(c.dateRemboursement);
                                    _jourPrevu = _dr.getDate();
                                    const _cyb = cycleBudgetaireDe(_jourPrevu, _dr.getMonth() + 1, _dr.getFullYear());
                                    _cycleM = _cyb.mois; _cycleA = _cyb.an;
                                }
                                if (_cycleM !== m || _cycleA !== a) return; // filtre cycle exact`);

edits.forEach(([a, r]) => { src = src.replace(a, r); });
writeFileSync(F, src);
console.log(`✔ ${edits.length} modifications appliquées à ${F}`);
