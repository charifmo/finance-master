#!/usr/bin/env python3
"""v37.90 — « FAILED TO FETCH » : L'APPLI DIAGNOSTIQUE, RÉESSAIE, ET GARDE L'ÉCRAN ALLUMÉ.

« Erreur de connexion au CFO — Failed to fetch » au téléphone. Ce message du navigateur veut dire : AUCUNE réponse
  HTTP (pas une erreur du CFO — une erreur 404 ou 502 du serveur est, elle, une réponse). Trois causes possibles :
  la connexion coupée pendant l'attente (téléphone verrouillé, appli changée : Chrome suspend l'onglet et coupe
  la requête, le CFO continue pourtant côté serveur), une adresse de webhook enregistrée dans CE navigateur qui ne
  répond pas, ou pas de réseau.

  1. Pendant l'attente, l'écran reste allumé (Wake Lock, quand le navigateur le permet).
  2. Sur « Failed to fetch », l'appli enquête au lieu de laisser le message brut :
     · pas de réseau → elle le dit ;
     · le VPS a noté des étapes pour CETTE question → « le CFO a bien reçu votre question ; la connexion a été
       coupée pendant l'attente » — l'écran est relu (ce qu'il a écrit apparaît), bouton « ↻ Renvoyer » ;
     · rien reçu, et l'adresse enregistrée n'est pas celle du serveur → elle réessaie AUSSITÔT avec l'adresse du
       serveur (…/webhook/finance-cfo-web) et, si elle répond, la garde ;
     · rien reçu sur l'adresse du serveur → « n8n ne répond pas » et ce qu'il faut faire sur le VPS.
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

sub('attente : écran allumé',
"""                    const _cfoAttenteArreter = () => { clearInterval(_cfoChronoId); clearInterval(_cfoSondageId); _cfoChronoId = _cfoSondageId = null; };""",
"""                    const _cfoAttenteArreter = () => { clearInterval(_cfoChronoId); clearInterval(_cfoSondageId); _cfoChronoId = _cfoSondageId = null; _cfoEcranLibre(); };
                    //  v37.90 : pendant l'attente, l'écran reste allumé — un téléphone verrouillé suspend l'onglet et coupe la requête
                    let _cfoVerrouEcran = null;
                    const _cfoEcranAllume = async () => { try { if (navigator.wakeLock && !_cfoVerrouEcran) _cfoVerrouEcran = await navigator.wakeLock.request('screen'); } catch (_) { _cfoVerrouEcran = null; } };
                    const _cfoEcranLibre = () => { try { if (_cfoVerrouEcran) _cfoVerrouEcran.release(); } catch (_) { /* déjà libéré */ } _cfoVerrouEcran = null; };
                    /*  v37.90 — « Failed to fetch » = AUCUNE réponse HTTP. L'appli enquête : réseau ? le VPS a-t-il noté des étapes
                        pour CETTE question (reçue, puis connexion coupée) ? l'adresse enregistrée est-elle celle du serveur ? */
                    const diagnostiquerConnexionCFO = async (urlEssayee) => {
                        if (typeof navigator !== 'undefined' && navigator.onLine === false) return { cause: 'hors_ligne' };
                        let etapes = null, vps = false;
                        try {
                            const r = await fetch(CFO_ETAPES_URL + '?session_id=' + encodeURIComponent(cfoSessionId.value) + '&t=' + Date.now(), { cache: 'no-store' });
                            vps = r.ok; if (r.ok) { const j = await r.json(); etapes = (Array.isArray(j.etapes) ? j.etapes : []).filter(e => e && e.code && e.il_y_a_ms <= Date.now() - _cfoAttenteT0 + 1500); }
                        } catch (_) { vps = false; }
                        if (etapes && etapes.length) return { cause: 'coupee', etapes };
                        const defaut = webhookCfoParDefaut();
                        if (defaut && urlEssayee !== defaut) return { cause: 'adresse', defaut, vps };
                        return { cause: vps ? 'n8n' : 'serveur', vps };
                    };
                    const _cfoMessageConnexion = (d, url, question) => {
                        const lien = '<button type="button" data-cfo-renvoyer data-question="' + String(question || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;') + '" style="margin-top:6px;padding:3px 10px;border-radius:8px;background:#4f46e5;color:#fff;font-weight:800;font-size:11px">↻ Renvoyer la question</button>';
                        const t = {
                            hors_ligne: '📵 <b>Pas de réseau</b> sur cet appareil : la question n’est pas partie.',
                            coupee: '📶 <b>Le CFO a bien reçu votre question</b> (étapes notées par le VPS : ' + ((d.etapes || []).map(e => e.libelle || e.code).join(' → ')) + '), mais la connexion a été <b>coupée pendant l’attente</b> — téléphone verrouillé ou appli changée : le navigateur suspend l’onglet. Ce qu’il a écrit sur le serveur est relu à l’écran ; sa réponse écrite, elle, est perdue.',
                            n8n: '🛑 <b>Le serveur répond, mais pas le CFO (n8n)</b> à ' + url + '. Sur le VPS : <code>sudo bash install.sh cfo</code> (réinstalle et réactive le workflow).',
                            serveur: '🛑 <b>Ni le serveur ni le CFO ne répondent</b> (' + url + ') : le VPS est peut-être arrêté ou injoignable depuis ce réseau.',
                        }[d.cause] || ('❌ Pas de réponse de ' + url);
                        return '<div data-cfo-diagnostic="' + d.cause + '" style="border-left:3px solid #b91c1c;background:#fef2f2;padding:8px 12px;border-radius:8px;font-size:12px"><b style="color:#b91c1c">❌ Erreur de connexion au CFO</b><br>' + t + '<br>' + lien + '</' + 'div>';   // balise coupée exprès : la suite de lecture des réponses découpe sur la fermeture classique
                    };
                    //  « ↻ Renvoyer la question » (le bouton vit dans une bulle HTML du fil)
                    if (typeof document !== 'undefined') document.addEventListener('click', (ev) => {
                        const b = ev.target && ev.target.closest && ev.target.closest('[data-cfo-renvoyer]');
                        if (b && !cfoLoading.value) consulterCFO(b.getAttribute('data-question') || '');
                    });""")

sub('envoi : écran allumé',
"""                        cfoLoading.value = true;
                        _cfoAttenteDemarrer();   // v37.73
                        scrollCFOToBottom();
                        try {
                            const res = await fetch(cfoWebhookUrl.value, {""",
"""                        cfoLoading.value = true;
                        _cfoAttenteDemarrer();   // v37.73
                        _cfoEcranAllume();       // v37.90
                        scrollCFOToBottom();
                        const _corps = () => JSON.stringify({
                                    session_id: cfoSessionId.value,
                                    question: _avecConsigneMemoire(question),
                                    source: 'web',
                                    system_prompt: CFO_SYSTEM_PROMPT,
                                    finance_data: _buildPayloadCFO(),
                                });
                        try {
                            const res = await fetch(cfoWebhookUrl.value, {""")

sub('envoi : diagnostic sur échec réseau',
"""                        } catch (e) {
                            cfoMessages.value.push({ role: 'agent', content: '<b style="color:#b91c1c">❌ Erreur de connexion au CFO</b><br/><span style="font-size:11px;color:#6b7280">' + (e.message || e) + '</span>', time: '--:--' });""",
"""                        } catch (e) {
                            //  v37.90 : « Failed to fetch » — enquête, nouvel essai sur l'adresse du serveur si l'enregistrée ne répond pas
                            let fait = false;
                            if (e instanceof TypeError) {
                                const url = cfoWebhookUrl.value, d = await diagnostiquerConnexionCFO(url);
                                if (d.cause === 'adresse') {
                                    try {
                                        const res2 = await fetch(d.defaut, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: _corps() });
                                        const raw2 = await res2.text();
                                        cfoWebhookUrl.value = d.defaut; try { localStorage.setItem('cfo_webhook_url', d.defaut); } catch (_) { /* stockage bloqué */ }
                                        cfoMessages.value.push({ role: 'agent', time: new Date().toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'}),
                                            content: '<div data-cfo-adresse-corrigee style="border-left:3px solid #059669;background:#ecfdf5;padding:6px 10px;border-radius:8px;font-size:11px">🔧 L’adresse enregistrée dans ce navigateur (' + String(url).replace(/</g, '&lt;') + ') ne répondait pas : la question est repartie vers celle du serveur, gardée pour la suite.</div>' });
                                        cfoMessages.value.push({ role: 'agent', content: _lireReponseCFO(raw2).html, time: new Date().toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'}) });
                                        fait = true;
                                    } catch (e2) { d.cause = 'n8n'; }
                                }
                                if (!fait) { cfoMessages.value.push({ role: 'agent', content: _cfoMessageConnexion(d, cfoWebhookUrl.value, question), time: '--:--' }); fait = true; }
                            }
                            if (!fait) cfoMessages.value.push({ role: 'agent', content: '<b style="color:#b91c1c">❌ Erreur de connexion au CFO</b><br/><span style="font-size:11px;color:#6b7280">' + (e.message || e) + '</span>', time: '--:--' });""")
io.open(F, 'w', encoding='utf-8').write(src)
print('✔ v37.90 : connexion au CFO diagnostiquée, nouvel essai, écran allumé')
