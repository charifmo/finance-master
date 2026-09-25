import fs from 'node:fs';
const FILE = new URL('./index.html', import.meta.url);
let s = fs.readFileSync(FILE, 'utf8');
const CRLF = s.includes('\r\n'); if (CRLF) s = s.split('\r\n').join('\n');
const sub = (from, to, n = 1) => { const c = s.split(from).length - 1;
    if (c !== n) throw new Error(`Ancre (${c}/${n}) : ${from.slice(0,120)}`); s = s.split(from).join(to); };

/* ═══════════════════════════════════════════════════════════════════════════
   v37.9 — UNDO NE FAISAIT RIEN. TROIS CAUSES, TOUTES REPRODUITES.

   Mesuré dans un vrai navigateur (trois modifications successives du même
   champ, puis quatre Undo) :

       départ          salaire 18000   undo 0
       modif → 1000    salaire  1000   undo 1
       modif → 2000    salaire  2000   undo 3     ← +2 par modification
       modif → 3000    salaire  3000   undo 5
       undo #1..#4     salaire  3000   undo 5     ← jamais rien ne bouge

   1. CHAQUE MODIFICATION ÉTAIT ENREGISTRÉE DEUX FOIS. L'appelant mute l'état
      puis appelle handleDataChange() — qui prend un instantané ; le watcher
      profond sur donneesAnnuelles se déclenche ensuite et rappelle
      handleDataChange() — qui en prend un second, identique. L'historique
      n'était qu'une suite de doublons : reculer d'un cran retombait sur
      l'état courant. Undo « marchait » parfaitement, sans rien changer.

   2. LE VERROU ANTI-RÉENREGISTREMENT ÉTAIT RELÂCHÉ TROP TÔT. _isHistoryOp
      repassait à false sur la ligne suivant la restauration, alors que les
      watchers profonds de Vue ne se déclenchent qu'au flush suivant. L'état
      restauré était donc aussitôt réenregistré, ce qui tronquait la branche
      Redo : Redo était mort-né.

   3. L'HISTORIQUE NE COUVRAIT QUE DEUX CHAMPS sur huit — donneesAnnuelles et
      comptes. Objectifs, actifs, soldes initiaux, paramètres et Studio en
      étaient absents : mesuré, une cible d'objectif portée à 777 777 et un
      actif ajouté survivaient intacts à l'Undo. C'est grave au-delà du
      confort : le simulateur affiche « Action réversible uniquement via
      Undo » avant d'appliquer un scénario — or appliquer un scénario CRÉE
      des actifs. La promesse était fausse.
   ═══════════════════════════════════════════════════════════════════════════ */

// nextTick : indispensable pour relâcher le verrou APRÈS le flush des watchers.
sub(`        const { createApp, ref, computed, watch, onMounted, onBeforeUnmount, toRaw } = Vue;`,
    `        const { createApp, ref, computed, watch, onMounted, onBeforeUnmount, toRaw, nextTick } = Vue;`);

sub(`                    const _saveSnapshot = () => {
                        if (_isHistoryOp || _importInProgress.value) return;
                        try {
                            const snap = JSON.stringify({ da: toRaw(donneesAnnuelles.value), cpts: toRaw(comptes.value) });
                            if (_historyIdx.value < _history.value.length - 1) {
                                _history.value = _history.value.slice(0, _historyIdx.value + 1);
                            }
                            _history.value.push(snap);
                            if (_history.value.length > 10) _history.value.shift();
                            _historyIdx.value = _history.value.length - 1;
                        } catch(_) {}
                    };
`,
`                    // v37.9 : TOUT le document éditable, pas deux champs sur huit.
                    //   Même périmètre que getExportData(), moins gConfig (des
                    //   identifiants Google Drive n'ont rien à faire dans un Undo).
                    const _snapshotEtat = () => JSON.stringify({
                        da:     toRaw(donneesAnnuelles.value),
                        cpts:   toRaw(comptes.value),
                        goals:  toRaw(wealthGoals.value),
                        assets: toRaw(masterAssets.value),
                        soldes: toRaw(soldesInitiaux.value),
                        params: toRaw(parametres.value),
                        studio: toRaw(studioExpl.value),
                    });

                    const _saveSnapshot = () => {
                        if (_isHistoryOp || _importInProgress.value) return;
                        let snap;
                        try { snap = _snapshotEtat(); } catch (_) { return; }
                        // v37.9 : une seule action déclenchait DEUX enregistrements
                        //   (l'appel explicite, puis le watcher profond). L'historique
                        //   se remplissait de doublons et Undo retombait sur l'état
                        //   courant. On refuse un instantané identique au sommet — ce
                        //   qui rend la correction indépendante du moment où les
                        //   watchers se déclenchent.
                        if (_historyIdx.value >= 0 && _history.value[_historyIdx.value] === snap) return;
                        if (_historyIdx.value < _history.value.length - 1) {
                            _history.value = _history.value.slice(0, _historyIdx.value + 1);
                        }
                        _history.value.push(snap);
                        // 10 pas, c'était l'équivalent de 5 actions réelles vu les
                        // doublons. Sans doublons, 30 pas = 30 actions.
                        if (_history.value.length > 30) { _history.value.shift(); }
                        _historyIdx.value = _history.value.length - 1;
                    };

                    const _restaurerInstantane = (json) => {
                        let e; try { e = JSON.parse(json); } catch (_) { return false; }
                        _isHistoryOp = true;
                        if (e.da)     donneesAnnuelles.value = e.da;
                        if (e.cpts)   comptes.value          = e.cpts;
                        if (e.goals)  wealthGoals.value       = e.goals;
                        if (e.assets) masterAssets.value      = e.assets;
                        if (e.soldes) soldesInitiaux.value    = e.soldes;
                        if (e.params) parametres.value        = e.params;
                        if (e.studio) studioExpl.value        = e.studio;
                        // Les watchers profonds arrivent au flush suivant : relâcher le
                        // verrou ici même, synchroniquement, le laissait rouvert quand
                        // ils se déclenchaient — et la branche Redo était tronquée.
                        nextTick(() => {
                            _isHistoryOp = false;
                            forceUpdateCalculations();
                        });
                        return true;
                    };

                    const _apresHistorique = () => {
                        forceUpdateCalculations();
                        serverSyncStatus.value = 'modified';
                        clearTimeout(_autoSaveTimer);
                        _autoSaveTimer = setTimeout(() => saveToServer(), 2000);
                    };
`);

sub(`                    const undo = () => {
                        if (!canUndo.value) return;
                        _isHistoryOp = true;
                        _historyIdx.value--;
                        const snap = JSON.parse(_history.value[_historyIdx.value]);
                        donneesAnnuelles.value = snap.da;
                        comptes.value = snap.cpts;
                        _isHistoryOp = false;
                        forceUpdateCalculations();
                        serverSyncStatus.value = 'modified';
                        clearTimeout(_autoSaveTimer);
                        _autoSaveTimer = setTimeout(() => saveToServer(), 2000);
                    };

                    const redo = () => {
                        if (!canRedo.value) return;
                        _isHistoryOp = true;
                        _historyIdx.value++;
                        const snap = JSON.parse(_history.value[_historyIdx.value]);
                        donneesAnnuelles.value = snap.da;
                        comptes.value = snap.cpts;
                        _isHistoryOp = false;
                        forceUpdateCalculations();
                        serverSyncStatus.value = 'modified';
                        clearTimeout(_autoSaveTimer);
                        _autoSaveTimer = setTimeout(() => saveToServer(), 2000);
                    };
`,
`                    const undo = () => {
                        if (!canUndo.value) return;
                        _historyIdx.value--;
                        if (!_restaurerInstantane(_history.value[_historyIdx.value])) { _historyIdx.value++; return; }
                        _apresHistorique();
                    };

                    const redo = () => {
                        if (!canRedo.value) return;
                        _historyIdx.value++;
                        if (!_restaurerInstantane(_history.value[_historyIdx.value])) { _historyIdx.value--; return; }
                        _apresHistorique();
                    };
`);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(FILE, s, 'utf8');
console.log('✅ v37.9 — undo réparé');
