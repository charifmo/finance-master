/**
 * v33.91 — Purge du store d'arbitrage
 * L'UI a disparu en v33.90 ; on retire les refs, le computed et les exports
 * pour que le composant n'existe plus du tout.
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
const coupe = (debut, fin, label) => {
    const i0 = s.indexOf(debut);
    if (i0 < 0) throw new Error('début introuvable : ' + label);
    const i1 = s.indexOf(fin, i0);
    if (i1 < 0) throw new Error('fin introuvable : ' + label);
    s = s.slice(0, i0) + s.slice(i1);
};

// Refs historiques (v16.2)
sub(
`                    const arbitrageCash = ref(100000);
                    const arbitrageDebtRate = ref(4.5);
                    const arbitrageInvestRate = ref(7.0);
                    const arbitrageYears = ref(5);
`, '');

// Bloc complet v33.10
coupe(`                    // ═══════════════════════════════════════════════════════════════════
                    // v33.10 — ARBITRAGE : REMBOURSER vs PLACER (Mourabaha + Ibra'a)`,
      `                    // ═══════════════════════════════════════════════════════════════════
                    // v33.10 — PROJET STUDIO : MODULE EXPLOITATION`, 'bloc arbitrage');

// Exports
sub(
`                        arbitrageCash, arbitrageDebtRate, arbitrageInvestRate, arbitrageYears,
`, '');
sub(
`                        arbitrageMode, arbitrageAssetId, arbitrageIbraa, arbitrageMoisEcoules,
                        arbitrageTauxMarginal, arbitrageDeductible, arbitrageInflationOn, arbitrageResult,
`, '');

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ v33.91 store d\'arbitrage purgé');
