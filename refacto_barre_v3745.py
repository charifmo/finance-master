# -*- coding: utf-8 -*-
"""
v37.45 — « les boutons de la barre latérale mal placés, surtout ceux d'en bas ».

  AVANT — tout le menu défilait d'un bloc. À 1280×720, le bas sortait de l'écran :
  le statut de sauvegarde, le gros bouton « Sauver sur VPS » (alors que la sauvegarde
  est automatique depuis la v17.19), une console noire de journaux techniques, le
  bloc Google Drive, Exporter / Importer / PDF… et « Restaurer Data V10 », un bouton
  rouge qui écrase les données du serveur, à portée de clic sur chaque écran. Au-dessus,
  « Changelog » se déguisait en onglet, et les « Actions IA » n'étaient que trois émojis
  (🧠 📑 🪄) — dont le Relevé, qui n'a rien d'une IA.

  APRÈS —
    • l'en-tête tient sur deux lignes : nom + bouton « replier », puis la version, qui
      ouvre les nouveautés (le changelog n'est plus un faux onglet) ;
    • les onglets défilent seuls ; le PIED reste toujours visible ;
    • le pied : trois outils nommés (🧠 CFO, 📑 Relevé, 🪄 Merlin), l'état de la
      sauvegarde en une ligne (● Enregistré · 17:12 — un clic réenregistre), annuler /
      rétablir, et « ⋯ » : exporter, importer, PDF, Google Drive, nouveautés ;
    • journal technique, test de connexion, Google Drive et la restauration V10 (dans
      une « zone sensible ») sont rangés dans Paramètres › Sauvegarde & données.
"""
import io, sys

F = 'index.html'
src = io.open(F, encoding='utf-8').read()

def sub(label, a, b, n=1):
    global src
    c = src.count(a)
    if c != n:
        print(f'✖ {label} : {c} ancre(s), {n} attendue(s)'); sys.exit(1)
    src = src.replace(a, b)

def tranche(label, debut, fin, nouveau, inclure_fin=False):
    global src
    if src.count(debut) != 1 or src.count(fin) < 1:
        print(f'✖ {label} : ancres introuvables'); sys.exit(1)
    i = src.index(debut)
    j = src.index(fin, i) + (len(fin) if inclure_fin else 0)
    src = src[:i] + nouveau + src[j:]

# ── 1. La barre : en-tête et onglets en haut, pied fixe en bas ────────────────
sub('barre : ne défile plus d\'un bloc',
    'class="bg-slate-900 text-white flex flex-col justify-between shrink-0 shadow-2xl z-30 md:h-full md:overflow-y-auto custom-scroll border-r border-slate-800 transition-[width] duration-300 ease-in-out"',
    'class="bg-slate-900 text-white flex flex-col shrink-0 shadow-2xl z-30 md:h-full border-r border-slate-800 transition-[width] duration-300 ease-in-out relative" data-barre')
sub('barre : la partie haute se partage la hauteur',
    '''            <div>
                <!-- ═══ v32.80 : en-tête + toggle de rétractation ═══ -->''',
    '''            <div class="flex-1 min-h-0 flex flex-col">
                <!-- ═══ v32.80 : en-tête + toggle de rétractation ═══ -->''')

# ── 2. L'en-tête : deux lignes, la version ouvre les nouveautés ──────────────
tranche('en-tête', '                <!-- ═══ v32.80 : en-tête + toggle de rétractation ═══ -->',
        '                <!-- ═══ v22.00 P2 — MASTER SWITCH DUAL-MODE ═══ -->', '''                <!-- ═══ v32.80 : en-tête + toggle de rétractation ═══
                     v37.45 : deux lignes — le nom et « replier », puis la version, qui ouvre
                     les nouveautés (le changelog n'est plus un faux onglet du menu). -->
                <div :class="['shrink-0 border-b border-slate-800 bg-slate-950/40', isSidebarCollapsed ? 'px-2 py-3 flex flex-col items-center gap-2' : 'px-3 pt-3 pb-2.5']">
                    <div :class="['flex items-center', isSidebarCollapsed ? 'justify-center' : 'gap-2']">
                        <img v-if="parametres.branding.logoUrl" :src="parametres.branding.logoUrl" class="w-8 h-8 object-contain rounded-lg shadow shrink-0"/>
                        <span v-else class="text-2xl shrink-0">📈</span>
                        <h1 v-if="!isSidebarCollapsed" class="flex-1 min-w-0 text-lg font-black text-blue-400 italic uppercase tracking-tighter truncate">{{ parametres.branding.appName || 'Finance App' }}</h1>
                    </div>
                    <div v-if="!isSidebarCollapsed" class="mt-2 flex items-center gap-2">
                        <button type="button" @click="showChangelog = true" data-version-nouveautes
                                title="Nouveautés de chaque version (changelog)" aria-label="Nouveautés de la version (changelog)"
                                class="flex-1 min-w-0 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 px-2 py-1 rounded border border-blue-500/30 transition-colors">
                            <span class="truncate">v{{ CURRENT_VERSION }}</span><span aria-hidden="true" class="shrink-0">📖</span>
                        </button>
                        <button @click="toggleSidebar" title="Replier le menu" aria-label="Replier le menu"
                                class="shrink-0 w-8 h-7 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-700 text-slate-300 hover:text-white text-sm font-black leading-none">«</button>
                    </div>
                    <button v-else @click="toggleSidebar" title="Déplier le menu" aria-label="Déplier le menu"
                            class="w-10 h-8 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-700 text-slate-300 hover:text-white text-sm font-black leading-none">»</button>
                </div>
''')

# ── 3. Le sélecteur de mode : sans l'étiquette « Mode application » ──────────
sub('mode : bloc fixe', """                <div :class="['border-b border-slate-800 bg-slate-950/40', isSidebarCollapsed ? 'px-2 py-2' : 'px-3 py-3']">
                    <p v-if="!isSidebarCollapsed" class="text-[9px] text-slate-400 font-black uppercase tracking-widest text-center mb-2">Mode application</p>
                    <div :class="['rounded-xl border border-slate-700 bg-slate-900 p-1', isSidebarCollapsed ? 'flex flex-col gap-1' : 'inline-flex w-full']">""",
    """                <div :class="['shrink-0 border-b border-slate-800 bg-slate-950/40', isSidebarCollapsed ? 'px-2 py-2' : 'px-3 py-2.5']">
                    <div role="group" aria-label="Mode de l'application" :class="['rounded-xl border border-slate-700 bg-slate-900 p-1', isSidebarCollapsed ? 'flex flex-col gap-1' : 'inline-flex w-full']">""")

# ── 4. Les onglets : seuls à défiler ─────────────────────────────────────────
sub('onglets : zone qui défile', """                <nav :class="['space-y-2', isSidebarCollapsed ? 'px-2 py-3' : 'px-4 py-4']">""",
    """                <nav aria-label="Onglets" :class="['flex-1 min-h-0 overflow-y-auto custom-scroll space-y-1.5', isSidebarCollapsed ? 'px-2 py-3' : 'px-3 py-3']">""")
tranche('onglets : changelog, annuler et actions IA partent au pied',
        """                    <button @click="showChangelog = true" :title="isSidebarCollapsed ? 'Changelog' : null\"""",
        "                </nav>", "")
sub('onglets : un peu plus serrés', "'gap-3 px-4 py-3 text-left'", "'gap-3 px-3 py-2.5 text-left'", n=13)

# ── 5. Le pied, toujours visible ─────────────────────────────────────────────
BOITE = "'w-9 h-9 shrink-0 rounded-lg border text-sm font-black flex items-center justify-center transition-colors'"
BOITE_R = "'w-8 h-8 shrink-0 rounded-lg border text-sm font-black flex items-center justify-center transition-colors'"
ITEM = 'class="w-full text-left px-3 py-2 rounded-lg text-[13px] font-semibold text-slate-100 hover:bg-slate-700 flex items-center gap-2"'
PIED = f'''            <!-- ═══ v37.45 — LE PIED DU MENU, TOUJOURS VISIBLE ═══
                 Les outils nommés (ce n'étaient que trois émojis), l'état de la sauvegarde en une
                 ligne (elle est automatique : plus de gros bouton), annuler / rétablir et le menu
                 « ⋯ Données ». Journal technique, test de connexion, Google Drive et la
                 restauration V10 sont rangés dans Paramètres › Sauvegarde & données. -->
            <input type="file" ref="fileInput" @change="importerDonnees" accept=".json" class="hidden" />
            <div data-barre-pied :class="['shrink-0 border-t border-slate-800 bg-slate-950/60 relative', isSidebarCollapsed ? 'px-2 py-2 flex flex-col items-center gap-1.5' : 'p-3 space-y-2']">
                <div data-barre-outils :class="isSidebarCollapsed ? 'flex flex-col items-center gap-1.5' : 'grid grid-cols-3 gap-1.5'">
                    <button @click="showCfoModal = true" data-outil="cfo" title="Conseiller CFO : poser une question, lancer un audit" aria-label="Conseiller CFO"
                            :class="['rounded-lg border transition-colors flex items-center justify-center gap-1.5', isSidebarCollapsed ? 'w-10 h-9 text-base' : 'h-9 text-sm', showCfoModal ? 'bg-fuchsia-600 border-fuchsia-400 text-white' : 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-100']">
                        <span aria-hidden="true">🧠</span><span v-if="!isSidebarCollapsed" class="text-[11px] font-bold">CFO</span>
                    </button>
                    <button @click="ouvrirReleve()" data-outil="releve" title="Relevé de comptes : tous les flux, passés et à venir, compte par compte" aria-label="Relevé de comptes"
                            :class="['rounded-lg border transition-colors flex items-center justify-center gap-1.5 bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-100', isSidebarCollapsed ? 'w-10 h-9 text-base' : 'h-9 text-sm']">
                        <span aria-hidden="true">📑</span><span v-if="!isSidebarCollapsed" class="text-[11px] font-bold">Relevé</span>
                    </button>
                    <button @click="toggleMerlin" data-outil="merlin" :title="merlinActive ? 'Désactiver Merlin (Échap)' : 'Merlin : cliquez ensuite un chiffre, l\\'IA vous l\\'explique'" aria-label="Merlin"
                            :class="['merlin-wand-btn rounded-lg border transition-colors flex items-center justify-center gap-1.5', isSidebarCollapsed ? 'w-10 h-9 text-base' : 'h-9 text-sm', merlinActive ? 'bg-fuchsia-600 border-fuchsia-400 text-white' : 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-100']">
                        <span aria-hidden="true">🪄</span><span v-if="!isSidebarCollapsed" class="text-[11px] font-bold">Merlin</span>
                    </button>
                </div>
                <div :class="isSidebarCollapsed ? 'flex flex-col items-center gap-1.5' : 'flex items-center gap-1.5'">
                    <button @click="saveToServer()" data-sauvegarde :data-etat="serverSyncStatus" :disabled="serverSyncStatus === 'saving'" :title="etatSauvegarde.aide" :aria-label="etatSauvegarde.titre + ' — ' + etatSauvegarde.detail"
                            :class="['rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-800 transition-colors', isSidebarCollapsed ? 'w-10 h-9 flex items-center justify-center' : 'flex-1 min-w-0 h-9 flex items-center gap-2 px-2.5 text-left']">
                        <span :class="['w-2.5 h-2.5 rounded-full shrink-0', etatSauvegarde.point]" aria-hidden="true"></span>
                        <span v-if="!isSidebarCollapsed" class="min-w-0 leading-tight">
                            <span class="block text-[11px] font-bold text-slate-100 truncate">{{{{ etatSauvegarde.titre }}}}</span>
                            <span class="block text-[10px] text-slate-400 truncate">{{{{ etatSauvegarde.detail }}}}</span>
                        </span>
                    </button>
                    <div :class="isSidebarCollapsed ? 'flex gap-1' : 'contents'">
                        <button @click="undo" :disabled="!canUndo" :title="'Annuler (' + undoCount + ' disponible' + (undoCount > 1 ? 's' : '') + ')'" aria-label="Annuler"
                                :class="[isSidebarCollapsed ? {BOITE_R} : {BOITE}, canUndo ? 'bg-slate-700 hover:bg-amber-600 text-white border-slate-600' : 'bg-slate-900 text-slate-500 cursor-not-allowed border-slate-800']">↩</button>
                        <button @click="redo" :disabled="!canRedo" :title="'Rétablir (' + redoCount + ' disponible' + (redoCount > 1 ? 's' : '') + ')'" aria-label="Rétablir"
                                :class="[isSidebarCollapsed ? {BOITE_R} : {BOITE}, canRedo ? 'bg-slate-700 hover:bg-blue-600 text-white border-slate-600' : 'bg-slate-900 text-slate-500 cursor-not-allowed border-slate-800']">↪</button>
                    </div>
                    <button @click="menuDonnees = !menuDonnees" data-menu-donnees-bouton :aria-expanded="menuDonnees ? 'true' : 'false'" title="Données : exporter, importer, PDF, Google Drive, nouveautés" aria-label="Données"
                            :class="[{BOITE}, menuDonnees ? 'bg-slate-600 border-slate-500 text-white' : 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-100']">⋯</button>
                </div>
                <div v-if="menuDonnees" class="fixed inset-0 z-40" @click="menuDonnees = false" aria-hidden="true"></div>
                <div v-if="menuDonnees" data-menu-donnees role="menu" :class="['absolute z-50 rounded-xl bg-slate-800 border border-slate-600 shadow-2xl p-1.5', isSidebarCollapsed ? 'left-full bottom-2 ml-2 w-64' : 'left-3 right-3 bottom-full mb-2']">
                    <button role="menuitem" @click="menuDonnees = false; exporterDonnees()" {ITEM}><span aria-hidden="true">💾</span>Exporter les données (.json)</button>
                    <button role="menuitem" @click="menuDonnees = false; triggerImport()" {ITEM}><span aria-hidden="true">📂</span>Importer un fichier…</button>
                    <button role="menuitem" @click="menuDonnees = false; exporterPDF()" {ITEM}><span aria-hidden="true">📄</span>Exporter en PDF</button>
                    <button role="menuitem" v-if="syncStatus === 'disconnected'" @click="menuDonnees = false; authDrive()" {ITEM}><span aria-hidden="true">☁️</span>Connecter Google Drive</button>
                    <button role="menuitem" v-else @click="menuDonnees = false; saveToDrive()" {ITEM}><span aria-hidden="true">☁️</span>{{{{ syncStatus === 'saving' ? 'Synchronisation…' : (syncStatus === 'modified' ? 'Sauver sur Google Drive' : 'Google Drive à jour') }}}}</button>
                    <div class="my-1 border-t border-slate-700"></div>
                    <button role="menuitem" @click="menuDonnees = false; showChangelog = true" {ITEM}><span aria-hidden="true">📖</span>Nouveautés (changelog)</button>
                    <button role="menuitem" data-vers-reglages-donnees @click="menuDonnees = false; appMode = 'previsionnel'; activeTab = 'settings'" {ITEM}><span aria-hidden="true">🛠️</span>Sauvegarde & données…</button>
                </div>
            </div>
'''
tranche('pied du menu', "            <!-- v32.80 : pied replié → une colonne d'actions essentielles -->",
        """                        🔄 Restaurer Data V10
                    </button>
                </div>
            </div>
""", PIED, inclure_fin=True)

# ── 6. Paramètres › Sauvegarde & données ─────────────────────────────────────
sub('réglages : titre', '<h3 class="font-black uppercase tracking-widest text-gray-700 text-sm mb-5">💾 Sauvegarde Automatique</h3>',
    '<h3 class="font-black uppercase tracking-widest text-gray-700 text-sm mb-5" data-reglages-sauvegarde>💾 Sauvegarde & données</h3>')
BTN = 'class="px-4 py-2 rounded-xl border-2 border-gray-200 text-gray-800 text-xs font-black uppercase tracking-widest hover:bg-gray-50 transition-colors"'
sub('réglages : ce qui quittait le menu', """                                <p class="text-[10px] text-gray-400 mt-2 uppercase tracking-widest">Le backup JSON est envoyé automatiquement au VPS selon cet intervalle</p>
                            </div>
                        </div>
                    </section>""", f"""                                <p class="text-[10px] text-gray-400 mt-2 uppercase tracking-widest">Le backup JSON est envoyé automatiquement au VPS selon cet intervalle</p>
                            </div>
                        </div>
                        <!-- v37.45 : ce qui encombrait le bas du menu, rangé ici -->
                        <div class="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8" data-reglages-donnees>
                            <div>
                                <p class="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">Serveur (VPS)</p>
                                <p class="text-sm text-gray-800 flex items-center gap-2"><span :class="['w-2.5 h-2.5 rounded-full shrink-0', etatSauvegarde.point]" aria-hidden="true"></span><span class="font-bold">{{{{ etatSauvegarde.titre }}}}</span></p>
                                <p class="text-xs text-gray-600 mt-1">{{{{ etatSauvegarde.aide }}}} Chaque modification part d'elle-même au serveur après 2 secondes.</p>
                                <div class="flex flex-wrap gap-2 mt-3">
                                    <button @click="saveToServer()" :disabled="serverSyncStatus === 'saving'" class="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-black uppercase tracking-widest hover:bg-slate-700 transition-colors">💾 Enregistrer maintenant</button>
                                    <button @click="testConnection" {BTN}>⚡ Tester la connexion</button>
                                </div>
                                <details class="mt-3" data-journal-technique>
                                    <summary class="cursor-pointer text-xs font-bold text-gray-600">Journal technique ({{{{ serverLogs.length }}}} lignes)</summary>
                                    <div class="mt-2 bg-slate-950 rounded-lg p-2 font-mono text-[11px] max-h-48 overflow-y-auto custom-scroll">
                                        <div v-for="(log, i) in serverLogs" :key="i" :class="['leading-snug py-0.5', log.type === 'error' ? 'text-red-300' : (log.type === 'success' ? 'text-emerald-300' : (log.type === 'warn' ? 'text-orange-200' : 'text-slate-300'))]"><span class="text-slate-500">[{{{{ log.time }}}}]</span> {{{{ log.msg }}}}</div>
                                    </div>
                                </details>
                            </div>
                            <div>
                                <p class="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">Google Drive</p>
                                <div v-if="syncStatus === 'disconnected'" class="flex flex-wrap items-center gap-3">
                                    <button @click="authDrive" {BTN}>☁️ Connecter Google Drive</button>
                                    <button @click="showDriveHelp = true" class="text-xs text-blue-700 font-bold hover:underline">Configurer l'ID client</button>
                                </div>
                                <div v-else class="flex flex-wrap items-center gap-3">
                                    <button @click="saveToDrive" {BTN}>☁️ {{{{ syncStatus === 'saving' ? 'Synchronisation…' : (syncStatus === 'modified' ? 'Sauver sur Google Drive' : 'Google Drive à jour') }}}}</button>
                                    <button @click="disconnectDrive" class="text-xs text-red-700 font-bold hover:underline">Déconnecter</button>
                                </div>
                                <p class="text-xs font-black uppercase tracking-widest text-gray-500 mt-6 mb-3">Fichiers</p>
                                <div class="flex flex-wrap gap-2">
                                    <button @click="exporterDonnees" {BTN}>💾 Exporter (.json)</button>
                                    <button @click="triggerImport" {BTN}>📂 Importer…</button>
                                    <button @click="exporterPDF" {BTN}>📄 Exporter en PDF</button>
                                </div>
                            </div>
                        </div>
                        <div class="mt-8 rounded-xl border-2 border-red-200 bg-red-50 p-4" data-zone-sensible>
                            <p class="text-sm font-black text-red-800">⚠️ Zone sensible</p>
                            <p class="text-xs text-red-800 mt-1">Remplace toutes vos données, ici et sur le serveur, par la sauvegarde historique du 7 avril (V10). Exportez d'abord vos données.</p>
                            <button @click="restaurerDefaut" data-restaurer-v10 class="mt-3 px-4 py-2 rounded-xl bg-white border-2 border-red-300 text-red-700 text-xs font-black uppercase tracking-widest hover:bg-red-100 transition-colors">🔄 Restaurer les données du 7 avril (V10)</button>
                        </div>
                    </section>""")

# ── 7. L'état de la sauvegarde, en une ligne ─────────────────────────────────
sub('état de la sauvegarde', "                    const saveToServer = async (forcer = false) => {",
    """                    //  v37.45 — l'état de la sauvegarde en une ligne, pour le pied du menu.
                    const menuDonnees = ref(false);
                    const etatSauvegarde = computed(() => {
                        const s = serverSyncStatus.value;
                        const h = String(serverLastSync.value || '').replace(/:\\d{2}(?=\\D*$)/, '');
                        if (s === 'saving') return { titre: 'Envoi…', detail: 'au serveur', point: 'bg-sky-400 animate-pulse', aide: 'Enregistrement en cours sur le serveur.' };
                        if (s === 'error') return { titre: 'Échec', detail: 'réessayer', point: 'bg-rose-500', aide: 'La dernière sauvegarde a échoué : cliquez pour réessayer (le journal technique est dans Paramètres › Sauvegarde & données).' };
                        if (s === 'modified') return serveurDivergent.value
                            ? { titre: 'Bloqué', detail: 'conflit', point: 'bg-rose-500 animate-pulse', aide: 'Un autre appareil a enregistré depuis votre chargement : rien n’a été écrasé, choisissez dans le bandeau.' }
                            : { titre: 'Modifié', detail: 'envoi auto', point: 'bg-amber-400 animate-pulse', aide: 'Vos changements partent d’eux-mêmes au serveur dans quelques secondes ; cliquez pour enregistrer tout de suite.' };
                        if (s === 'synced') return { titre: 'Enregistré', detail: h || 'serveur', point: 'bg-emerald-400', aide: 'Tout est enregistré sur le serveur' + (h ? ' (' + h + ')' : '') + ' ; cliquez pour réenregistrer.' };
                        return { titre: 'Connexion…', detail: 'serveur', point: 'bg-slate-400 animate-pulse', aide: 'Chargement des données du serveur.' };
                    });
                    const saveToServer = async (forcer = false) => {""")
sub('état de la sauvegarde : exposé', "forceUpdateCalculations, handleDataChange, serverSyncStatus, serverLastSync, serverLogs, saveToServer, testConnection,",
    "forceUpdateCalculations, handleDataChange, serverSyncStatus, serverLastSync, serverLogs, saveToServer, testConnection, menuDonnees, etatSauvegarde,")

io.open(F, 'w', encoding='utf-8').write(src)
print('✔ index.html : barre latérale réorganisée (pied fixe, outils nommés, données dans Paramètres)')
