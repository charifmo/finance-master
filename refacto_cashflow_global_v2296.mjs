import { readFileSync, writeFileSync } from 'fs';

const filePath = 'C:/Users/HP/finance/index.html';
let html = readFileSync(filePath, 'utf8');
html = html.replace(/\r\n/g, '\n');

let ops = 0;
const check = (label, ok) => {
    if (!ok) { console.error('❌ ' + label); process.exit(1); }
    ops++;
    console.log('✅ ' + label);
};

// ═══════════════════════════════════════════════════════════════════════════
// Op 1 : pilotageTheoLignes — épargne push : ajouter jourPrevu
// ═══════════════════════════════════════════════════════════════════════════
const OLD_EP_PUSH = `if (m > 0) out.epargne.push({ nom: ep.nom || ep.label || '?', montant: m });`;
const NEW_EP_PUSH = `if (m > 0) out.epargne.push({ nom: ep.nom || ep.label || '?', montant: m, jourPrevu: ep.jourPrevu || null });`;
check('Op 1 anchor', html.includes(OLD_EP_PUSH));
html = html.replace(OLD_EP_PUSH, NEW_EP_PUSH);

// ═══════════════════════════════════════════════════════════════════════════
// Op 2 : pilotageTheoLignes — variables push details : ajouter jourPrevu (cat)
// ═══════════════════════════════════════════════════════════════════════════
const OLD_VAR_DETAIL_PUSH = `if (m > 0) out.variables.push({ nom: d.nom || cat.label || '?', montant: m });`;
const NEW_VAR_DETAIL_PUSH = `if (m > 0) out.variables.push({ nom: d.nom || cat.label || '?', montant: m, jourPrevu: cat.jourPrevu || null });`;
check('Op 2 anchor', html.includes(OLD_VAR_DETAIL_PUSH));
html = html.replace(OLD_VAR_DETAIL_PUSH, NEW_VAR_DETAIL_PUSH);

// ═══════════════════════════════════════════════════════════════════════════
// Op 3 : pilotageTheoLignes — variables push valeur (else branch)
// ═══════════════════════════════════════════════════════════════════════════
const OLD_VAR_VAL_PUSH = `if (m > 0) out.variables.push({ nom: cat.label || '?', montant: m });`;
const NEW_VAR_VAL_PUSH = `if (m > 0) out.variables.push({ nom: cat.label || '?', montant: m, jourPrevu: cat.jourPrevu || null });`;
check('Op 3 anchor', html.includes(OLD_VAR_VAL_PUSH));
html = html.replace(OLD_VAR_VAL_PUSH, NEW_VAR_VAL_PUSH);

// ═══════════════════════════════════════════════════════════════════════════
// Op 4 : pilotageTheoLignes — sort epargne + variables avant return
// ═══════════════════════════════════════════════════════════════════════════
const OLD_SORT = `                        const sortJour = (a, b) => (a.jourPrevu || 99) - (b.jourPrevu || 99);
                        out.revenus.sort(sortJour);
                        out.fixes.sort(sortJour);
                        return out;`;
const NEW_SORT = `                        const sortJour = (a, b) => (a.jourPrevu || 99) - (b.jourPrevu || 99);
                        out.revenus.sort(sortJour);
                        out.fixes.sort(sortJour);
                        out.epargne.sort(sortJour);
                        out.variables.sort(sortJour);
                        return out;`;
check('Op 4 anchor', html.includes(OLD_SORT));
html = html.replace(OLD_SORT, NEW_SORT);

// ═══════════════════════════════════════════════════════════════════════════
// Op 5 : resteAPayerDetailParCompte — épargne lignes.push : ajouter jourPrevu
// ═══════════════════════════════════════════════════════════════════════════
const OLD_EP_LIGNE_PUSH = `grp.lignes.push({ nom: ep.nom || ep.label || '?', montant: m, type: 'epargne' });`;
const NEW_EP_LIGNE_PUSH = `grp.lignes.push({ nom: ep.nom || ep.label || '?', montant: m, type: 'epargne', jourPrevu: ep.jourPrevu || null });`;
check('Op 5 anchor', html.includes(OLD_EP_LIGNE_PUSH));
html = html.replace(OLD_EP_LIGNE_PUSH, NEW_EP_LIGNE_PUSH);

// ═══════════════════════════════════════════════════════════════════════════
// Op 6 : Template tooltip lignes — badge ⏳ pour épargne
// ═══════════════════════════════════════════════════════════════════════════
const OLD_TOOLTIP_LIGNE = `{{ ligne.nom }}
                                                    </span>
          `;
// Find the full tooltip content (span after icons + nom + closing span + amount)
const TOOLTIP_IDX = html.indexOf('v-for="(ligne, li) in grp.lignes"');
const TOOLTIP_SLICE = html.slice(TOOLTIP_IDX, TOOLTIP_IDX + 900);
const OLD_NOM_SPAN = `                                                        {{ ligne.nom }}\n                                                    </span>`;
const NEW_NOM_SPAN = `                                                        {{ ligne.nom }}\n                                                        <span v-if="isFluxCetteSemaine(ligne.jourPrevu)" class="text-[8px] font-black bg-amber-500/30 text-amber-200 border border-amber-500/30 px-1 py-px rounded-full ml-0.5">⏳</span>\n                                                        <span v-if="ligne.jourPrevu" class="text-[8px] text-slate-500 font-bold ml-0.5">j.{{ligne.jourPrevu}}</span>\n                                                    </span>`;
check('Op 6 anchor', html.includes(OLD_NOM_SPAN));
html = html.replace(OLD_NOM_SPAN, NEW_NOM_SPAN);

// ═══════════════════════════════════════════════════════════════════════════
// Op 7 : Pilotage Théorique — épargne list item (badge + jour)
// ═══════════════════════════════════════════════════════════════════════════
const OLD_THEO_EP = `<li v-for="(e, i) in pilotageTheoLignes.epargne" :key="'e'+i" class="flex justify-between text-xs py-1 border-b border-slate-100 last:border-0">
                                    <span class="text-slate-700 truncate max-w-[180px]">💰 {{ e.nom }}</span>
                                    <span class="font-bold text-purple-700">{{ formatMAD(e.montant) }}</span>
                                </li>`;
const NEW_THEO_EP = `<li v-for="(e, i) in pilotageTheoLignes.epargne" :key="'e'+i" class="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-0 gap-2">
                                    <span class="text-slate-700 truncate max-w-[130px]">💰 {{ e.nom }}</span>
                                    <div class="flex items-center gap-1.5 shrink-0">
                                        <span v-if="isFluxCetteSemaine(e.jourPrevu)" class="text-[9px] font-black bg-amber-100 text-amber-700 border border-amber-300 px-1.5 py-0.5 rounded-full">⏳ Cette semaine</span>
                                        <span v-if="e.jourPrevu" class="text-[9px] text-slate-400 font-bold">📅 j.{{ e.jourPrevu }}</span>
                                        <span class="font-bold text-purple-700">{{ formatMAD(e.montant) }}</span>
                                    </div>
                                </li>`;
check('Op 7 anchor', html.includes(OLD_THEO_EP));
html = html.replace(OLD_THEO_EP, NEW_THEO_EP);

// ═══════════════════════════════════════════════════════════════════════════
// Op 8 : Pilotage Théorique — variables list item (badge + jour)
// ═══════════════════════════════════════════════════════════════════════════
const OLD_THEO_VAR = `<li v-for="(v, i) in pilotageTheoLignes.variables" :key="'v'+i" class="flex justify-between text-xs py-1 border-b border-slate-100 last:border-0">
                                    <span class="text-slate-700 truncate max-w-[180px]">{{ v.nom }}</span>
                                    <span class="font-bold text-cyan-700">{{ formatMAD(v.montant) }}</span>
                                </li>`;
const NEW_THEO_VAR = `<li v-for="(v, i) in pilotageTheoLignes.variables" :key="'v'+i" class="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-0 gap-2">
                                    <span class="text-slate-700 truncate max-w-[130px]">{{ v.nom }}</span>
                                    <div class="flex items-center gap-1.5 shrink-0">
                                        <span v-if="isFluxCetteSemaine(v.jourPrevu)" class="text-[9px] font-black bg-amber-100 text-amber-700 border border-amber-300 px-1.5 py-0.5 rounded-full">⏳ Cette semaine</span>
                                        <span v-if="v.jourPrevu" class="text-[9px] text-slate-400 font-bold">📅 j.{{ v.jourPrevu }}</span>
                                        <span class="font-bold text-cyan-700">{{ formatMAD(v.montant) }}</span>
                                    </div>
                                </li>`;
check('Op 8 anchor', html.includes(OLD_THEO_VAR));
html = html.replace(OLD_THEO_VAR, NEW_THEO_VAR);

// ═══════════════════════════════════════════════════════════════════════════
// Op 9 : Pilotage Réalisé — variables category header : ajouter badge discret
// ═══════════════════════════════════════════════════════════════════════════
const OLD_REEL_VAR_HDR = `<p class="text-[9px] text-blue-400 font-black uppercase tracking-widest mb-2 border-b border-blue-900/50 pb-1 mt-2">🧾 {{ cat.label }}</p>`;
const NEW_REEL_VAR_HDR = `<p class="text-[9px] text-blue-400 font-black uppercase tracking-widest mb-2 border-b border-blue-900/50 pb-1 mt-2 flex items-center gap-2">
                                            <span>🧾 {{ cat.label }}</span>
                                            <span v-if="isFluxCetteSemaine(cat.jourPrevu)" class="text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded-full">⏳ Cette sem.</span>
                                            <span v-if="cat.jourPrevu" class="text-[9px] text-slate-500 font-bold ml-auto">📅 j.{{ cat.jourPrevu }}</span>
                                        </p>`;
check('Op 9 anchor', html.includes(OLD_REEL_VAR_HDR));
html = html.replace(OLD_REEL_VAR_HDR, NEW_REEL_VAR_HDR);

// ═══════════════════════════════════════════════════════════════════════════
// Op 10 : Budget Structurel — Épargne form : ajouter jourPrevu
// ═══════════════════════════════════════════════════════════════════════════
const OLD_EP_FORM = `                                <div class="text-right shrink-0">
                                    <span class="text-lg font-black text-purple-700">{{ formatMAD(obj.valeur) }}`;
const NEW_EP_FORM = `                                <!-- v22.96 Cashflow-Global : jourPrevu épargne -->
                                <div class="flex items-center gap-1 mt-1">
                                    <label class="text-[9px] font-black text-indigo-700 uppercase tracking-widest whitespace-nowrap">📅 Jour :</label>
                                    <input type="number" v-model.number="obj.jourPrevu" @input="handleDataChange" min="1" max="31" placeholder="ex: 5" class="w-16 p-1 text-xs font-black text-indigo-800 border border-indigo-200 rounded bg-indigo-50 outline-none focus:ring-2 focus:ring-indigo-400 text-center"/>
                                </div>
                                <div class="text-right shrink-0">
                                    <span class="text-lg font-black text-purple-700">{{ formatMAD(obj.valeur) }}`;
check('Op 10 anchor', html.includes(OLD_EP_FORM));
html = html.replace(OLD_EP_FORM, NEW_EP_FORM);

// ═══════════════════════════════════════════════════════════════════════════
// Op 11 : Budget Structurel — Charges Variables form : ajouter jourPrevu
//          Ancre : fin du sourceCompte select + avant showDetails
// ═══════════════════════════════════════════════════════════════════════════
const OLD_VAR_FORM_ANCHOR = `                          </select>\n                            </div>\n\n                            <div v-if="item.showDetails" class="mt-4 bg-gray-5`;
const NEW_VAR_FORM_ANCHOR = `                          </select>\n                            </div>\n                            <!-- v22.96 Cashflow-Global : jourPrevu pour factures mensuelles -->\n                            <div v-if="item.periode === 'mois' && (!item.parts || !item.parts.length)" class="flex items-center gap-2 mt-1 mb-1">\n                                <label class="text-[9px] font-black text-indigo-700 uppercase tracking-widest whitespace-nowrap">📅 Jour prévu :</label>\n                                <input type="number" v-model.number="item.jourPrevu" @input="handleDataChange" min="1" max="31" placeholder="ex: 15" class="w-20 p-1.5 text-xs font-black text-indigo-800 border border-indigo-200 rounded-lg bg-indigo-50 outline-none focus:ring-2 focus:ring-indigo-400 text-center"/>\n                                <span class="text-[9px] text-slate-400 font-bold">du mois (1–31)</span>\n                            </div>\n\n                            <div v-if="item.showDetails" class="mt-4 bg-gray-5`;
check('Op 11 anchor', html.includes(OLD_VAR_FORM_ANCHOR));
html = html.replace(OLD_VAR_FORM_ANCHOR, NEW_VAR_FORM_ANCHOR);

// ═══════════════════════════════════════════════════════════════════════════
// Op 12 : Version bump → 22.96 Cashflow-Global
// ═══════════════════════════════════════════════════════════════════════════
const OLD_VER = `"22.95 Cashflow-Timing"`;
const NEW_VER = `"22.96 Cashflow-Global"`;
check('Op 12 anchor', html.includes(OLD_VER));
html = html.replace(OLD_VER, NEW_VER);

writeFileSync(filePath, html, 'utf8');
console.log(`\n🎉 Done — ${ops}/12 ops. Fichier écrit.`);
