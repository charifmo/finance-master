/*  LE LANCEUR — passer d'une appli à l'autre (Finance, Santé, puis Psy, Voyage…).
    La liste vient de apps.json (une ligne par appli) ; sans lui, Finance et Santé.
    N'importe quel élément [data-lanceur] ouvre le panneau ; [data-lanceur-page] affiche les tuiles sur place
    (accueil.html) ; [data-lanceur-barre] affiche la rangée d'icônes en haut du menu de chaque appli. Aucune dépendance : marche dans Finance (Vue), Santé (Vue) et toute nouvelle appli. */
(function () {
    'use strict';
    if (window.Lanceur) return;
    var cs = document.currentScript;
    var base = new URL((cs && cs.dataset && cs.dataset.base) || './', location.href);
    var DEFAUT = [
        { id: 'finance', nom: 'Finance', icone: '💰', description: 'Budget, comptes, épargne, CFO', url: './' },
        { id: 'sante', nom: 'Santé', icone: '🩺', description: 'Bilans, nutrition, activité, CMO', url: 'sante/' }
    ];
    var applis = null;
    var charger = function () {
        if (applis) return Promise.resolve(applis);
        return fetch(new URL('apps.json', base).href, { cache: 'no-cache' })
            .then(function (r) { return r.ok ? r.json() : null; })
            .catch(function () { return null; })
            .then(function (j) { var L = j && Array.isArray(j.applis) ? j.applis.filter(function (a) { return a && a.id && a.nom; }) : null; applis = L && L.length ? L : DEFAUT; return applis; });
    };
    var adresse = function (a) { return a.url && !a.bientot ? new URL(a.url, base) : null; };
    var courante = function (L) {
        var meilleure = null, n = -1;
        L.forEach(function (a) { var u = adresse(a); if (u && location.pathname.indexOf(u.pathname) === 0 && u.pathname.length > n) { meilleure = a; n = u.pathname.length; } });
        return meilleure;
    };
    var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    var tuiles = function (L) {
        var cur = courante(L);
        return L.map(function (a) {
            var u = adresse(a), ici = cur && cur.id === a.id;
            var style = 'display:flex;flex-direction:column;gap:4px;padding:16px;border-radius:16px;text-decoration:none;min-height:110px;'
                + (u ? 'background:#fff;color:#0f172a;border:2px solid ' + (ici ? '#0ea5e9' : '#e2e8f0') + ';box-shadow:0 1px 3px rgba(15,23,42,.08)' : 'background:#f1f5f9;color:#94a3b8;border:2px dashed #cbd5e1');
            var corps = '<span style="font-size:30px;line-height:1">' + esc(a.icone || '•') + '</span>'
                + '<span style="font-weight:900;font-size:16px">' + esc(a.nom) + (ici ? ' <span style="font-size:10px;color:#0284c7;font-weight:800">· ICI</span>' : '') + (u ? '' : ' <span style="font-size:10px;font-weight:800">· bientôt</span>') + '</span>'
                + '<span style="font-size:12px;font-weight:600;color:' + (u ? '#64748b' : '#94a3b8') + '">' + esc(a.description || '') + '</span>';
            return u ? '<a data-lanceur-appli="' + esc(a.id) + '"' + (ici ? ' data-lanceur-ici' : '') + ' href="' + esc(u.href) + '" style="' + style + '">' + corps + '</a>'
                     : '<div data-lanceur-appli="' + esc(a.id) + '" data-lanceur-bientot aria-disabled="true" style="' + style + '">' + corps + '</div>';
        }).join('');
    };
    //  La rangée d'icônes, en haut du menu sombre de chaque appli : toutes les applis, celle où l'on est entourée
    var rangee = function (L) {
        var cur = courante(L);
        return L.map(function (a) {
            var u = adresse(a), ici = cur && cur.id === a.id;
            var style = 'display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:10px;font-size:18px;line-height:1;text-decoration:none;'
                + (ici ? 'background:#334155;box-shadow:inset 0 0 0 2px #38bdf8' : (u ? 'background:rgba(51,65,85,.45);cursor:pointer' : 'background:transparent;opacity:.35;filter:grayscale(1)'));
            var titre = esc(a.nom) + (u ? (ici ? ' (ici)' : '') : ' — bientôt');
            return u ? '<a data-lanceur-appli="' + esc(a.id) + '"' + (ici ? ' data-lanceur-ici aria-current="page"' : '') + ' href="' + esc(u.href) + '" title="' + titre + '" aria-label="' + titre + '" style="' + style + '">' + esc(a.icone || '•') + '</a>'
                     : '<span data-lanceur-appli="' + esc(a.id) + '" data-lanceur-bientot title="' + titre + '" aria-label="' + titre + '" style="' + style + '">' + esc(a.icone || '•') + '</span>';
        }).join('');
    };
    var GRILLE = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px';
    var panneau = null;
    var fermer = function () { if (panneau) { panneau.remove(); panneau = null; } };
    var ouvrir = function () {
        return charger().then(function (L) {
            fermer();
            panneau = document.createElement('div');
            panneau.setAttribute('data-lanceur-panneau', '');
            panneau.setAttribute('role', 'dialog');
            panneau.setAttribute('aria-label', 'Mes applis');
            panneau.style.cssText = 'position:fixed;inset:0;z-index:10050;background:rgba(15,23,42,.6);backdrop-filter:blur(4px);display:flex;align-items:flex-end;justify-content:center;font-family:system-ui,-apple-system,"Segoe UI",sans-serif';
            panneau.innerHTML = '<div style="background:#f8fafc;width:100%;max-width:640px;border-radius:24px 24px 0 0;padding:20px 16px 28px;max-height:85vh;overflow-y:auto">'
                + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px"><span style="flex:1;font-weight:900;font-size:18px;color:#0f172a">🧩 Mes applis</span>'
                + '<button type="button" data-lanceur-fermer aria-label="Fermer" style="border:0;background:#e2e8f0;border-radius:10px;padding:6px 12px;font-weight:900;cursor:pointer">✕</button></div>'
                + '<div style="' + GRILLE + '">' + tuiles(L) + '</div></div>';
            panneau.addEventListener('click', function (e) { if (e.target === panneau || (e.target.closest && e.target.closest('[data-lanceur-fermer]'))) fermer(); });
            document.body.appendChild(panneau);
            return panneau;
        });
    };
    document.addEventListener('click', function (e) {
        var b = e.target && e.target.closest && e.target.closest('[data-lanceur]');
        if (b) { e.preventDefault(); ouvrir(); }
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fermer(); });
    //  Les emplacements (page d'accueil, rangée du menu) se remplissent dès qu'ils apparaissent — y compris quand
    //  l'appli (Vue) redessine son menu et les recrée vides
    var enAttente = false;
    var surPlace = function () {
        enAttente = false;
        var pages = Array.prototype.filter.call(document.querySelectorAll('[data-lanceur-page]'), function (c) { return !c.childElementCount; });
        var rangees = Array.prototype.filter.call(document.querySelectorAll('[data-lanceur-barre]'), function (c) { return !c.childElementCount; });
        if (!pages.length && !rangees.length) return;
        charger().then(function (L) {
            pages.forEach(function (c) { c.style.cssText += ';' + GRILLE; c.innerHTML = tuiles(L); });
            rangees.forEach(function (c) { c.style.cssText += ';display:flex;flex-wrap:wrap;gap:6px'; c.innerHTML = rangee(L); });
        });
    };
    var plusTard = function () { if (!enAttente) { enAttente = true; (window.requestAnimationFrame || setTimeout)(surPlace); } };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', surPlace); else surPlace();
    if (window.MutationObserver) new MutationObserver(plusTard).observe(document.documentElement, { childList: true, subtree: true });
    window.Lanceur = { ouvrir: ouvrir, fermer: fermer, applis: charger };
})();
