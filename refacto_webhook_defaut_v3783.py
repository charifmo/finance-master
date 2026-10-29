#!/usr/bin/env python3
"""v37.83 — LE CFO SE BRANCHE TOUT SEUL SUR CE TÉLÉPHONE.

« C'est quoi ce truc ? » (« Configuration requise : collez l'URL du webhook n8n ») — l'adresse du CFO n'était
  mémorisée que dans le navigateur où on l'avait collée (localStorage) : un autre navigateur, un téléphone,
  des données de site effacées, et le CFO demandait de la recoller. L'appli est servie par le même serveur que
  n8n (…/finance/) : son webhook est donc …/webhook/finance-cfo-web, à la même adresse. Sans adresse
  enregistrée, l'appli la déduit d'elle-même — plus rien à coller. Une adresse enregistrée à la main garde
  la priorité ; en local (localhost, fichier) rien n'est deviné.
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

sub('webhook par défaut',
"""                    const cfoWebhookUrl = ref(localStorage.getItem('cfo_webhook_url') || '');""",
"""                    //  v37.83 : sans adresse enregistrée, celle du serveur qui sert l'appli (…/finance/ ↔ …/webhook/finance-cfo-web)
                    const webhookCfoParDefaut = (loc) => {
                        try {
                            const l = loc || window.location;
                            if (!l || !/^https?:$/.test(l.protocol) || /^(localhost|127\\.|0\\.0\\.0\\.0|\\[::1\\])/.test(l.hostname)) return '';
                            return l.origin + '/webhook/finance-cfo-web';
                        } catch (_) { return ''; }
                    };
                    const cfoWebhookUrl = ref(localStorage.getItem('cfo_webhook_url') || webhookCfoParDefaut());""")
sub('exposition', """friseOuverte, friseCycle, dateReleve, """, """friseOuverte, friseCycle, dateReleve, webhookCfoParDefaut, """)
io.open(F, 'w', encoding='utf-8').write(src)
print('✔ v37.83 : le CFO se branche tout seul')
