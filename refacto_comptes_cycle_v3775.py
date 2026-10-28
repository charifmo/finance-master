#!/usr/bin/env python3
"""v37.75 — LE PILOTAGE DIT OÙ EN EST CHAQUE COMPTE · LA BONNE VERSION SUR LE TÉLÉPHONE.

« Cet écran n'est pas révélateur de l'état de mes comptes pour ce cycle : ajouter la somme sur chaque
  compte à l'instant pour comparer le réalisé avec ce qui est attendu, et une grande case où c'est écrit
  quel compte est concerné. »

  1. « 🏁 Fin de cycle » devient « 🏦 Vos comptes » : pour CHAQUE compte réel liquide (plus seulement
     ceux qui paient quelque chose) — aujourd'hui (le solde réel), au plus bas d'ici la fin du cycle
     (et quand), fin de cycle. Un compte qui plonge en cours de cycle et remonte avant la fin se voit.
  2. Les virements à prévoir dans une grande case blanche : combien, VERS quel compte, DEPUIS quel
     compte (ou « aucun compte ne couvre seul »), avant quelle date, et jusqu'où il descendrait sans.
     Tous les comptes concernés, plus « (+ 1 autre compte) ».

« Toujours il ne reconnaît pas [la capture Attijari]. » — rejouée sur l'appli à jour, la même capture
  est reconnue (n° lu, Compte Courant). Le téléphone affichait « sans RIB visible » : aucun n° lu,
  c'est le comportement d'avant la v37.71. Un onglet de téléphone resté ouvert garde l'ancienne appli.
  3. L'appli vérifie sa version à l'ouverture et à chaque retour sur l'onglet ; plus récente sur le
     serveur : elle se recharge seule (rien de non sauvegardé), sinon un bandeau propose de le faire.
"""
import io, sys

F = 'index.html'
src = io.open(F, encoding='utf-8').read()
def sub(label, old, new):
    global src
    c = src.count(old)
    if c != 1:
        print(f'✖ {label} : {c} ancre(s), 1 attendue'); sys.exit(1)
    src = src.replace(old, new)

# ── 1. Le solde après chaque ligne, pour le point bas du cycle ──────────────────
sub('atterrissage : solde après la ligne',
"""                                c.lignes.push({ libelle: e.libelle, montant: Number(e.montant) || 0, type: e.type, jourPrevu: e.jourPrevu });
                        });
                        const comptes = Object.keys(fin).map(k => {
                            const info = _infoCompteKey(k);""",
"""                                c.lignes.push({ libelle: e.libelle, montant: Number(e.montant) || 0, type: e.type, jourPrevu: e.jourPrevu,
                                                solde: e.soldeCompteApres != null ? Number(e.soldeCompteApres) : null });   // v37.75 : point bas
                        });
                        const comptes = Object.keys(fin).map(k => {
                            const info = _infoCompteKey(k);""")

sub('vos comptes : tous les comptes réels liquides, aujourd hui et au plus bas',
"""                            return (atterrissageCycle.value.comptes || [])
                                .filter(c => c.courant || (c.reel && (c.atterrissage < 0 || (c.sorties > 0 && !nonLiquide(c.key)))))
                                .map(c => ({
                                    key: c.key, compte: infoCompte(c.key), courant: !!c.courant,
                                    atterrissage: c.atterrissage, t0: c.t0,
                                    signe: c.atterrissage < 0 ? '−' : (c.atterrissage > 0 ? '+' : ''),
                                    valeur: Math.abs(c.atterrissage),
                                }))""",
"""                            //  v37.75 : « la somme sur chaque compte à l'instant » — chaque compte réel liquide, même
                            //  s'il ne fait que recevoir : aujourd'hui, au plus bas d'ici la fin du cycle, fin de cycle
                            const { debut: _d0, fin: _d1 } = consoT0Fenetre.value;
                            const _quand = (j) => !j ? '' : j + ' ' + _MOIS_COURTS[Number(j) >= _d0.getDate() ? _d0.getMonth() : _d1.getMonth()];
                            const _sg = (x) => x < 0 ? '−' : (x > 0 ? '+' : '');
                            return (atterrissageCycle.value.comptes || [])
                                .filter(c => c.courant || (c.reel && (c.atterrissage < 0 || !nonLiquide(c.key))))
                                .map(c => {
                                    let bas = c.t0, lBas = null;
                                    (c.lignes || []).forEach(l => { if (l.solde != null && Number.isFinite(l.solde) && Math.round(l.solde) < bas) { bas = Math.round(l.solde); lBas = l; } });
                                    return {
                                        key: c.key, compte: infoCompte(c.key), courant: !!c.courant,
                                        atterrissage: c.atterrissage, t0: c.t0,
                                        signe: c.atterrissage < 0 ? '−' : (c.atterrissage > 0 ? '+' : ''),
                                        valeur: Math.abs(c.atterrissage),
                                        signeT0: _sg(c.t0), valeurT0: Math.abs(c.t0),
                                        bas, signeBas: _sg(bas), valeurBas: Math.abs(bas), basQuand: lBas ? _quand(lBas.jourPrevu) || 'd’ici la fin' : 'aujourd’hui',
                                        mouvements: c.entrees - c.sorties,
                                    };
                                })""")

# ── 2. Les virements à prévoir, compte par compte ───────────────────────────────
sub('virements à prévoir : données',
"""                            logistique: (() => {
                                const r = radarComptes.value;""",
"""                            //  v37.75 : la grande case — chaque virement à prévoir, vers / depuis / avant le
                            virements: isCyclePasse.value ? [] : radarComptes.value.besoins.map(b => ({
                                key: b.key, compte: infoCompte(b.key), montant: b.aVirer, avantLe: b.avantLe,
                                pointBas: b.pointBas, datePointBas: b.datePointBas,
                                depuis: b.donneur ? infoCompte(b.donneur.key) : null, resteDonneur: b.donneur ? b.donneur.resteAuPlusBas : null,
                            })),
                            horizonVirements: String(radarComptes.value.horizon || '').replace(/\\.$/, ''),
                            logistique: (() => {
                                const r = radarComptes.value;""")

sub('virements à prévoir : la grande case',
"""                    <p v-if="meteo.logistique && !(meteo.decouverts && meteo.decouverts.length)" class="mt-1.5 md:mt-2 inline-block rounded-xl bg-black/20 ring-1 ring-white/15 px-2.5 py-1 md:py-1.5 text-[11px] md:text-xs font-bold text-white leading-snug" data-meteo-logistique>{{ meteo.logistique }}</p>""",
"""                    <!-- v37.75 : LES VIREMENTS À PRÉVOIR, en grand — combien, vers quel compte, depuis lequel, avant quand -->
                    <div v-if="meteo.virements && meteo.virements.length && !(meteo.decouverts && meteo.decouverts.length)" data-meteo-virements
                         class="mt-2.5 md:mt-3 rounded-2xl bg-white text-slate-900 p-3 md:p-4 shadow-lg shadow-slate-950/30">
                        <p class="text-[10px] md:text-[11px] font-black uppercase tracking-[0.18em] text-indigo-700">🏦 {{ meteo.virements.length > 1 ? meteo.virements.length + ' virements' : 'Virement' }} à prévoir — pour tenir jusqu’au {{ meteo.horizonVirements }}</p>
                        <div v-for="b in meteo.virements" :key="'vp_' + b.key" data-meteo-virement :data-compte="b.key"
                             class="mt-2.5 first-of-type:mt-2 grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 border-t border-slate-100 pt-2.5 first-of-type:border-0 first-of-type:pt-0">
                            <p class="tabular-nums leading-none whitespace-nowrap" data-meteo-virement-montant><span class="text-2xl md:text-3xl font-black tracking-tight">{{ chiffre(b.montant) }}</span> <span class="text-sm font-black text-slate-500">DH</span></p>
                            <div class="min-w-0 text-xs md:text-sm font-bold leading-snug space-y-0.5">
                                <p class="flex items-center gap-1.5 min-w-0" data-meteo-virement-vers><span class="text-slate-500 shrink-0">vers</span> <mono-compte :c="b.compte"></mono-compte> <b class="truncate">{{ b.compte.label }}</b></p>
                                <p v-if="b.depuis" class="flex items-center gap-1.5 min-w-0" data-meteo-virement-depuis><span class="text-slate-500 shrink-0">depuis</span> <mono-compte :c="b.depuis"></mono-compte> <b class="truncate">{{ b.depuis.label }}</b></p>
                                <p v-else class="text-rose-700" data-meteo-virement-depuis>depuis : aucun compte ne couvre seul ce montant — à répartir</p>
                                <p class="text-slate-600" data-meteo-virement-quand>avant le <b>{{ b.avantLe }}</b> — sans lui, {{ b.compte.tag }} descendrait à <b class="text-rose-700 whitespace-nowrap">{{ formatMad(b.pointBas) }}</b> le {{ b.datePointBas }}</p>
                            </div>
                        </div>
                    </div>""")

sub('vos comptes : la carte',
"""                    <span class="whitespace-nowrap">🏁 Fin de cycle</span>
                    <span class="truncate normal-case tracking-normal font-bold text-white/45" data-meteo-atterrissages-date>le {{ meteo.dateFin }}</span>
                </p>
                <ul class="mt-1 divide-y divide-white/[0.08]" aria-label="Atterrissage de chaque compte en fin de cycle">
                    <li v-for="c in meteo.atterrissages" :key="'att_' + c.key" data-meteo-atterrissage :data-compte="c.key" :data-signe="c.atterrissage < 0 ? 'negatif' : 'positif'"
                        :title="c.compte.label + ' : ' + formatMad(c.t0) + ' aujourd’hui → ' + formatMad(c.atterrissage) + ' le ' + meteo.dateFin"
                        class="flex items-center gap-2.5 py-1.5 md:py-2">
                        <mono-compte :c="c.compte" grand></mono-compte>
                        <span class="min-w-0 flex-1 truncate text-[13px] md:text-sm font-bold text-white/90" data-meteo-atterrissage-nom>{{ c.compte.tag }}</span>
                        <span :class="['shrink-0 tabular-nums whitespace-nowrap leading-none', c.atterrissage < 0 ? 'text-rose-300' : 'text-emerald-300']" data-meteo-atterrissage-montant>
                            <span class="text-base md:text-lg font-black">{{ c.signe }} {{ chiffre(c.valeur) }}</span>
                            <span class="ml-0.5 text-[10px] font-bold opacity-75">DH</span>
                        </span>
                    </li>
                </ul>""",
"""                    <span class="sr-only">Vos comptes</span>
                </p>
                <!-- v37.75 : pour chaque compte — aujourd'hui (réel), au plus bas d'ici la fin du cycle, fin de cycle -->
                <div class="grid grid-cols-[minmax(0,1fr)_auto_auto] md:grid-cols-[minmax(0,1fr)_repeat(3,minmax(3.6rem,auto))] items-baseline gap-x-2 md:gap-x-3 text-right text-[9px] font-black uppercase tracking-wider text-white/45" data-meteo-colonnes>
                    <span class="min-w-0 truncate text-left"><span class="text-[10px] tracking-[0.2em] text-white/55">🏦 Vos comptes</span> <span class="normal-case tracking-normal font-bold" data-meteo-atterrissages-date>le {{ meteo.dateFin }}</span></span><span>Aujourd’hui</span><span class="hidden md:block">Au plus bas</span><span>Fin cycle</span>
                </div>
                <ul class="divide-y divide-white/[0.08]" aria-label="Chaque compte : aujourd’hui, au plus bas, fin de cycle">
                    <li v-for="c in meteo.atterrissages" :key="'att_' + c.key" data-meteo-atterrissage :data-compte="c.key" :data-signe="c.atterrissage < 0 ? 'negatif' : 'positif'"
                        :title="c.compte.label + ' : ' + formatMad(c.t0) + ' aujourd’hui · au plus bas ' + formatMad(c.bas) + ' (' + c.basQuand + ') · ' + formatMad(c.atterrissage) + ' le ' + meteo.dateFin"
                        class="grid grid-cols-[minmax(0,1fr)_auto_auto] md:grid-cols-[minmax(0,1fr)_repeat(3,minmax(3.6rem,auto))] items-center gap-x-2 md:gap-x-3 py-1 md:py-2">
                        <span class="flex items-center gap-2 min-w-0">
                            <mono-compte :c="c.compte" grand></mono-compte>
                            <span class="min-w-0">
                                <span class="block truncate text-[13px] md:text-sm font-black text-white" data-meteo-atterrissage-nom>{{ c.compte.tag }}</span>
                                <span v-if="c.bas < 0" class="md:hidden block truncate text-[10px] font-black text-rose-300" data-meteo-atterrissage-bas-tel>↓ {{ c.signeBas }} {{ chiffre(c.valeurBas) }} le {{ c.basQuand }}</span>
                            </span>
                        </span>
                        <span class="text-right tabular-nums whitespace-nowrap leading-none text-white/90" data-meteo-atterrissage-t0><span class="text-[13px] md:text-sm font-black">{{ c.signeT0 }} {{ chiffre(c.valeurT0) }}</span></span>
                        <span :class="['hidden md:block text-right tabular-nums whitespace-nowrap leading-none', c.bas < 0 ? 'text-rose-300' : 'text-white/60']" data-meteo-atterrissage-bas>
                            <span class="text-[13px] md:text-sm font-black">{{ c.signeBas }} {{ chiffre(c.valeurBas) }}</span>
                            <span class="block mt-0.5 text-[9px] font-bold opacity-75" data-meteo-atterrissage-bas-quand>{{ c.basQuand }}</span>
                        </span>
                        <span :class="['text-right tabular-nums whitespace-nowrap leading-none', c.atterrissage < 0 ? 'text-rose-300' : 'text-emerald-300']" data-meteo-atterrissage-montant>
                            <span class="text-sm md:text-base font-black">{{ c.signe }} {{ chiffre(c.valeur) }}</span>
                            <span class="ml-0.5 text-[10px] font-bold opacity-75">DH</span>
                        </span>
                    </li>
                </ul>""")

# ── 3. La bonne version sur le téléphone ────────────────────────────────────────
sub('version : bandeau',
"""    <div id="app" class="min-h-screen md:h-screen w-full flex flex-col md:flex-row relative" v-cloak>
""",
"""    <div id="app" class="min-h-screen md:h-screen w-full flex flex-col md:flex-row relative" v-cloak>
        <!-- v37.75 : une version plus récente sur le serveur, et des saisies non sauvegardées — on propose -->
        <div v-if="nouvelleVersion" data-nouvelle-version class="fixed top-2 left-1/2 -translate-x-1/2 z-[10000] max-w-[calc(100vw-2rem)] flex items-center gap-3 rounded-2xl bg-indigo-700 text-white px-4 py-2.5 shadow-2xl text-xs md:text-sm font-bold">
            <span class="min-w-0">🆕 Version {{ nouvelleVersion }} disponible — enregistrez, puis rechargez.</span>
            <button type="button" @click="rechargerNouvelleVersion" class="shrink-0 rounded-lg bg-white text-indigo-700 px-3 py-1 font-black">Recharger</button>
        </div>
""")
sub('version : vérification',
"""                    onMounted(async () => {
                        // Responsive listener (v12.2)""",
"""                    //  v37.75 : un onglet de téléphone resté ouvert garde l'appli du jour où il a été ouvert — la capture
                    //  Attijari « sans RIB visible » venait d'une version d'avant la v37.71. À l'ouverture et à chaque
                    //  retour sur l'onglet, l'appli lit la version du serveur ; plus récente : rechargement seul si rien
                    //  n'est à sauvegarder (une seule tentative par version), sinon un bandeau le propose.
                    const nouvelleVersion = ref('');
                    let _versionVueA = 0;
                    const _urlVersion = (v) => location.pathname + '?v=' + encodeURIComponent(v) + location.hash;
                    const rechargerNouvelleVersion = () => { location.replace(_urlVersion(nouvelleVersion.value || String(Date.now()))); };
                    const verifierVersion = async () => {
                        if (Date.now() - _versionVueA < 60000) return null;
                        _versionVueA = Date.now();
                        try {
                            const r = await fetch(location.pathname + '?version=' + Date.now(), { cache: 'no-store' });
                            if (!r.ok) return null;
                            const m = /const CURRENT_VERSION = "([^"]+)"/.exec(await r.text());
                            if (!m || m[1] === CURRENT_VERSION) return m ? m[1] : null;
                            if (serverSyncStatus.value === 'modified') { nouvelleVersion.value = m[1]; return m[1]; }
                            let deja = false;
                            try { deja = sessionStorage.getItem('maj_auto_' + m[1]) === '1'; sessionStorage.setItem('maj_auto_' + m[1], '1'); } catch (_) {}
                            if (deja) { nouvelleVersion.value = m[1]; return m[1]; }
                            location.replace(_urlVersion(m[1]));
                            return m[1];
                        } catch (_) { return null; }
                    };
                    const _versionAuRetour = () => { if (document.visibilityState === 'visible') verifierVersion(); };
                    document.addEventListener('visibilitychange', _versionAuRetour);
                    setTimeout(verifierVersion, 4000);

                    onMounted(async () => {
                        // Responsive listener (v12.2)""")
sub('version : exposition',
"""cfoMessages, cfoInput, cfoLoading, cfoAttente, cfoSessionId,""",
"""cfoMessages, cfoInput, cfoLoading, cfoAttente, cfoSessionId, nouvelleVersion, rechargerNouvelleVersion, verifierVersion,""")
io.open(F, 'w', encoding='utf-8').write(src)
print('✔ v37.75 : vos comptes (aujourd’hui, au plus bas, fin de cycle), virements à prévoir en grand, version à jour')
