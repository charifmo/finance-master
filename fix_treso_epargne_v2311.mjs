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
const checkCount = (label, count, expected) => {
    if (count !== expected) { console.error(`❌ ${label} — found ${count}, expected ${expected}`); process.exit(1); }
    ops++;
    console.log(`✅ ${label} (${count} occurrences)`);
};

// ═══════════════════════════════════════════════════════════════════════════════
// ██ CHANTIER 1 — BUG: tresoActuelleCourante cherche type 'courant' seulement
// ═══════════════════════════════════════════════════════════════════════════════

// Op 1 : Computed JS — étendre la recherche à type 'liquide'
const OLD_TRESO_COMPUTED = `const compteCourant = (comptes.value || []).find(c => c.type === 'courant');
                        if (compteCourant) return Number(compteCourant.solde || 0);
                        // Fallback : soldesInitiaux.courant si aucun compte 'courant' configuré
                        return Number(soldesInitiaux.value.courant || 0);`;
const NEW_TRESO_COMPUTED = `// v23.11 : type 'liquide' = compte courant principal (rôle identique à 'courant')
                        const compteCourant = (comptes.value || []).find(c => c.type === 'courant' || c.type === 'liquide');
                        if (compteCourant) return Number(compteCourant.solde || 0);
                        // Fallback si aucun compte courant/liquide configuré
                        return Number(soldesInitiaux.value.courant || 0);`;
check('Op1 tresoActuelleCourante computed', html.includes(OLD_TRESO_COMPUTED));
html = html.replace(OLD_TRESO_COMPUTED, NEW_TRESO_COMPUTED);

// Op 2 : Tooltip KPI1 — remplacer les 3 occurrences de find(c.type === 'courant') dans le template
// (v-if, label+icone, solde)
const OLD_FIND_COURANT = `comptes.find(c => c.type === 'courant')`;
const NEW_FIND_COURANT = `comptes.find(c => c.type === 'courant' || c.type === 'liquide')`;
const findCount = (html.match(/comptes\.find\(c => c\.type === 'courant'\)/g) || []).length;
checkCount('Op2 tooltip find occurrences', findCount, 4); // v-if + icone + label + solde
html = html.replaceAll(OLD_FIND_COURANT, NEW_FIND_COURANT);

// Op 3 : Message d'erreur fallback — mettre à jour le texte explicatif
const OLD_FALLBACK_MSG = `<p class="text-slate-400 text-[10px]">Aucun compte de type "courant" configuré.<br/>Configurer vos comptes dans l'onglet Saisie.</p>`;
const NEW_FALLBACK_MSG = `<p class="text-slate-400 text-[10px]">Aucun compte de type "courant" ou "liquide" trouvé.<br/>Vérifiez le type de vos comptes dans Trésorerie.</p>`;
check('Op3 fallback message', html.includes(OLD_FALLBACK_MSG));
html = html.replace(OLD_FALLBACK_MSG, NEW_FALLBACK_MSG);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ CHANTIER 2 — BUG: section Épargne absente de la Checklist
// ═══════════════════════════════════════════════════════════════════════════════

// Op 4 : Insérer la section Épargne juste avant la fermeture du contenu checklist
// Ancre : la fermeture des Flux Exceptionnels + fin du div scrollable
const OLD_CHECKLIST_END = `                                    </div>
                                </div>
                            </template>
                            <div v-else class="bg-yellow-50 p-4 rounded-xl border border-yellow-200 text-center">`;

const NEW_CHECKLIST_END = `                                        <!-- ── v23.11 : Section Épargne & Virements ── -->
                                        <div v-if="(donneesAnnuelles[soldesInitiaux.anneeActuelle]?.epargne || []).filter(ep => Number(ep.valeur || 0) > 0).length > 0" class="mt-3">
                                            <p class="text-[9px] text-purple-400 font-black uppercase tracking-widest mb-2 border-b border-purple-900/50 pb-1">💎 Épargne & Virements</p>
                                            <div class="space-y-2">
                                                <div v-for="(ep, epIdx) in (donneesAnnuelles[soldesInitiaux.anneeActuelle]?.epargne || []).filter(ep => Number(ep.valeur || 0) > 0)" :key="epIdx" class="bg-slate-800 rounded-xl p-3 border border-slate-700">
                                                    <label class="flex items-start gap-3 cursor-pointer">
                                                        <input type="checkbox"
                                                            :checked="isItemPaid(ep, Number(ep.valeur || 0))"
                                                            @change="toggleItemPaid(ep, Number(ep.valeur || 0)); handleDataChange()"
                                                            class="w-6 h-6 rounded border-slate-600 bg-slate-800 text-purple-500 shrink-0 mt-0.5"/>
                                                        <div class="flex-1 min-w-0">
                                                            <p :class="['text-sm font-bold truncate', isItemPaid(ep, Number(ep.valeur || 0)) ? 'text-slate-500 line-through' : 'text-slate-100']">
                                                                {{ ep.nom || ep.label || '?' }}
                                                            </p>
                                                            <p class="text-[10px] font-bold mt-0.5" :class="isItemPaid(ep, Number(ep.valeur || 0)) ? 'text-slate-600' : 'text-purple-400'">
                                                                {{ formatMAD(Number(ep.valeur || 0)) }}
                                                                <span v-if="ep.jourPrevu" class="text-slate-500 ml-1">· j.{{ ep.jourPrevu }}</span>
                                                            </p>
                                                        </div>
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </template>
                            <div v-else class="bg-yellow-50 p-4 rounded-xl border border-yellow-200 text-center">`;

check('Op4 checklist epargne section', html.includes(OLD_CHECKLIST_END));
html = html.replace(OLD_CHECKLIST_END, NEW_CHECKLIST_END);

// ═══════════════════════════════════════════════════════════════════════════════
// ██ Version bump
// ═══════════════════════════════════════════════════════════════════════════════
check('Version anchor', html.includes('"23.10 Prorata-T0"'));
html = html.replace('"23.10 Prorata-T0"', '"23.11 Checklist-Tréso-Fix"');

writeFileSync(filePath, html, 'utf8');
console.log(`\n🎉 Done — ${ops}/5 ops. Fichier écrit.`);
