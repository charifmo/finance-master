import { compileJS } from './ref_js.mjs';
import fs from 'node:fs';
const fixture = fs.readFileSync('./fixture.json','utf8');
const cases = JSON.parse(fs.readFileSync('./cases.json','utf8'));
const out = {};
for (const c of cases) {
  const fd = JSON.parse(fixture);
  let r;
  try { r = compileJS(c.calls, fd, null); }
  catch (e) { r = { status:'throw', error: String(e.message) }; }
  out[c.nom] = { resultat: r, etat: r._financeData || null };
  if (out[c.nom].resultat) delete out[c.nom].resultat._financeData;
}
fs.writeFileSync('./out_js.json', JSON.stringify(out, null, 1));
console.log('JS  -> out_js.json  (' + Object.keys(out).length + ' cas)');
