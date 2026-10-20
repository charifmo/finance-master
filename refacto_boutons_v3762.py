# -*- coding: utf-8 -*-
"""
v37.62 — TROIS BOUTONS FLOTTANTS : 🧠 📑 ➕.

« Laisse juste brain, journal et + » (après l'audit de la Saisie : cinq boutons flottants 🧠 📑 💾 🪄 ➕
cachaient le bout des montants du journal au téléphone).
  • 🪄 Merlin quitte le téléphone (il reste au pied de la barre latérale, sur ordinateur).
  • 💾 quitte le téléphone : il ne clignotait que pendant les 2 secondes qui précèdent l'envoi AUTOMATIQUE au
    VPS (handleDataChange → saveToServer) ; un conflit entre appareils a déjà son bandeau (« Imposer la version
    de cet appareil ») ; « Enregistrer maintenant » reste dans les Réglages.
  • 🧠 📑 ➕ sur UNE rangée, en bas à droite, au-dessus de la barre d'onglets — plus une colonne au milieu de
    l'écran posée sur les montants.
"""
import io, sys
F = 'index.html'
src = io.open(F, encoding='utf-8').read()
def sub(label, a, b, n=1):
    global src
    if src.count(a) != n: print('✖', label, ':', src.count(a), 'ancre(s),', n, 'attendue(s)'); sys.exit(1)
    src = src.replace(a, b)

sub('merlin',
"""        <button v-if="isMobile && !showSaisieQuickModal && !importBanque.ouvert" @click="toggleMerlin"
            :title="merlinActive ? 'Désactiver Merlin (Echap)' : 'Activer Merlin — Audit IA d\\'un champ'"
            :class="['merlin-wand-btn fixed z-[9998] rounded-full flex items-center justify-center border-2 transition-all hover:scale-110',
                      'bottom-20 left-4 w-12 h-12 text-xl',     // v37.54 : à gauche — à droite, il couvrait le ➕
                      merlinActive ? 'bg-gradient-to-br from-fuchsia-600 to-purple-700 text-white border-fuchsia-300' : 'bg-gradient-to-br from-slate-800 to-slate-900 text-fuchsia-300 border-purple-500/40']">
            🪄
        </button>
""",
"""        <!-- v37.62 : sur le téléphone, trois boutons flottants seulement — 🧠 📑 ➕, sur une rangée en bas à droite.
             🪄 Merlin reste au pied de la barre latérale (ordinateur) ; 💾 n'est plus utile (envoi automatique). -->
""")
sub('journal',
"""            class="fixed z-[9996] rounded-full flex items-center justify-center border-2 transition-all hover:scale-110 shadow-xl
                   bottom-[11.5rem] right-4 w-12 h-12 text-xl""",
"""            data-flottant="releve"
            class="fixed z-[9996] rounded-full flex items-center justify-center border-2 transition-all hover:scale-110 shadow-xl
                   bottom-[5.25rem] right-20 w-12 h-12 text-xl""")
sub('cfo',
"""            title="Ouvrir le CFO & Audit"
            :class="['fixed z-[9995] rounded-full flex items-center justify-center border-2 transition-all hover:scale-110 shadow-xl',
                     'bottom-60 right-4 w-12 h-12 text-xl',""",
"""            title="Ouvrir le CFO & Audit" data-flottant="cfo"
            :class="['fixed z-[9995] rounded-full flex items-center justify-center border-2 transition-all hover:scale-110 shadow-xl',
                     'bottom-[5.25rem] right-[8.5rem] w-12 h-12 text-xl',""")
sub('save',
"""        <!-- ═══ v22.20 — FAB Save VPS (mobile only, si modifié) ═══ -->
        <button v-if="isMobile && serverSyncStatus === 'modified'" @click="saveToServer"
            class="fixed bottom-[8.5rem] left-4 z-50 bg-purple-600 text-white rounded-full w-12 h-12 flex items-center justify-center shadow-2xl shadow-purple-900/50 animate-pulse text-lg"
            title="Sauver sur VPS">
            💾
        </button>
""",
"""        <!-- v37.62 : plus de 💾 flottant — vos changements partent seuls au VPS 2 s après (handleDataChange) ;
             un conflit a son bandeau ; « Enregistrer maintenant » est dans les Réglages. -->
""")
sub('plus',
"""        <button v-if="isMobile" @click="openSaisieQuickModal"
            class="fixed bottom-20 right-4 z-50""",
"""        <button v-if="isMobile" @click="openSaisieQuickModal" data-flottant="saisie"
            class="fixed bottom-20 right-4 z-50""")

io.open(F, 'w', encoding='utf-8').write(src)
print('✔ v37.62 Boutons : 🧠 📑 ➕ sur une rangée ; 🪄 et 💾 quittent le téléphone')
