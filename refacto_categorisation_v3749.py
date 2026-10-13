# -*- coding: utf-8 -*-
"""
v37.49 — CATÉGORISATION : DES RÈGLES HORS-LIGNE COMPLÈTES, PUIS L'IA, ET LE DOUTE À VOUS.

« C'est très important que l'appli sache catégoriser. Je veux déjà des règles offline très
complètes incluant aussi la darija et le français, et s'il n'arrive pas à catégoriser il consulte
l'IA — ici même mcdo il ne sait pas le catégoriser. Dans les règles on doit avoir des catégories
autres surlignées pour moi, à catégoriser manuellement s'il y a un doute. »

  1. Le moteur v32.60 (la première couche qui répond gagne) devient un moteur à NOTES : vos
     corrections, vos libellés, un dictionnaire français · darija (latin avec chiffres, arabe) ·
     enseignes du Maroc (~ 60 thèmes), vos saisies passées. Sûr / doute / inconnu.
  2. Inconnu : l'IA (webhook du CFO, lecture seule, JSON vérifié contre vos catégories).
  3. Doute ou inconnu : « À catégoriser », surligné, rangé en un clic — et le choix devient une règle.
  4. Les règles sont visibles (📚), avec la catégorie où chaque thème arrive chez vous.
"""
import io, sys

F = 'index.html'
src = io.open(F, encoding='utf-8').read()

def sub(label, a, b, n=1):
    global src
    c = src.count(a)
    if c != n:
        print(f'✖ {F} — {label} : {c} ancre(s), {n} attendue(s)'); sys.exit(1)
    src = src.replace(a, b)

# ═══════════════════════════════════════════════════════════════════════════
# 1. LE MOTEUR
# ═══════════════════════════════════════════════════════════════════════════
DEBUT = """                    // ════════════════════════════════════════════════════════════════
                    // v32.60 Auto-Categorisation — 3 couches, 100% local
"""
FIN = """                        // ── 3. Matcher lexical d'origine ──
                        const id = _matchCategorieLexical(libelle);
                        return id ? { id, source: 'libellé' } : null;
                    };
"""
if src.count(DEBUT) != 1 or src.count(FIN) != 1:
    print('✖ bloc v32.60 introuvable'); sys.exit(1)
i = src.index(DEBUT); j = src.index(FIN, i) + len(FIN)

MOTEUR = r"""                    // ════════════════════════════════════════════════════════════════
                    // v37.49 Categorisation — VOS CORRECTIONS, VOS LIBELLÉS, UN DICTIONNAIRE
                    //   FRANÇAIS · DARIJA · ENSEIGNES, PUIS L'IA — ET LE DOUTE VOUS REVIENT.
                    //
                    //   v32.60 enchaînait trois couches et la première qui répondait gagnait :
                    //   « Marjane » partait sur Alimentation (dictionnaire) au lieu de VOTRE
                    //   ligne « Marjane » ; « mcdonald s » ne trouvait rien ; une hésitation
                    //   entre deux lignes se tranchait en silence.
                    //
                    //   Désormais chaque couche PROPOSE avec une note, et on compare :
                    //     • vos corrections — un libellé que vous avez rangé vous-même .. 80-98
                    //     • vos libellés — le mot tapé EST une de vos lignes (samak) .... 60-97
                    //     • le dictionnaire — français, darija (latin avec chiffres, arabe),
                    //       enseignes du Maroc. Il TRADUIT vers vos libellés, jamais vers un
                    //       id figé : renommer une catégorie ne crée pas de faux positif . 60-92
                    //     • l'historique des saisies automatiques ......................... 50-82
                    //   SÛR (≥ 75, sans rival à moins de 12 points) : rangé.
                    //   DOUTE : rangé au plus probable — la catégorie mère quand deux lignes
                    //   sœurs se disputent — et marqué « À catégoriser », surligné.
                    //   RIEN : l'IA (le webhook du CFO, en lecture seule) propose ; sinon
                    //   « À catégoriser ». Chaque choix fait à la main devient une règle.
                    // ════════════════════════════════════════════════════════════════
                    const _normTxt = (s) => String(s || '').toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae')
                        .normalize('NFD').replace(/[̀-ًͯ-ٰٟـ]/g, '');
                    const MOTS_VIDES = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'un', 'une', 'et', 'en', 'au', 'aux', 'pour', 'par', 'avec', 'chez',
                        'dans', 'sur', 'ma', 'mon', 'mes', 'ta', 'ton', 'ce', 'cet', 'cette', 'achat', 'achats', 'paiement', 'paye', 'payee', 'cb', 'carte',
                        'ticket', 'dh', 'dhs', 'mad', 'dirham', 'dirhams', 'and', 'for', 'of', 'dyal', 'dial', 'fi', 'men', 'mn', '3la', 'ala', 'li', 'lli',
                        'wa', 'had', 'hadi', 'hada', 'bach', 'ou']);
                    //  Le libellé sous toutes ses formes utiles : mots, phrase, forme collée
                    const _analyseLibelle = (libelle) => {
                        const bruts = _normTxt(libelle).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
                        const toks = [];
                        bruts.forEach(w => {
                            if (w.length < 2 || MOTS_VIDES.has(w) || !/\D/.test(w)) return;          // un nombre seul n'est pas un mot
                            if (!toks.includes(w)) toks.push(w);
                            //  l'article arabe : « الخضرة » est aussi « خضرة »
                            if (/^ال[؀-ۿ]{2,}$/.test(w) && !toks.includes(w.slice(2))) toks.push(w.slice(2));
                        });
                        return { bruts, toks, phrase: ' ' + bruts.join(' ') + ' ', tphrase: ' ' + toks.join(' ') + ' ', compact: bruts.join('') };
                    };
                    const _tokens = (s) => _analyseLibelle(s).toks;

                    /*  LE DICTIONNAIRE. t = thème ; v = vers quels mots de VOS libellés, dans l'ordre
                        ([a, b] = à égalité, '$mot' = le mot trouvé lui-même) ; f = force ; m = mots
                        (une expression peut avoir des espaces : elle passe avant ses mots seuls) ;
                        k = enseignes repérées même collées (« mcdonalds », « burgerking »). */
                    const DICO_CATEGORIES = [
                        { t: '🛒 Courses, supermarché', v: ['courses', 'supermarche', 'tqdya', 'alimentation', 'epicerie', 'nourriture'], f: 84,
                          m: 'courses|course|tqdya|t9dya|tqadya|tqdia|tsawq|tsaweq|tsouq|souk|sou9|swiq|marche|supermarche|hypermarche|superette|epicerie|epicier|hanout|7anout|hanut|l7anout|lhanout|baqal|ba9al|bakkal|grossiste|provisions|alimentation|nourriture|marjane|marjan|carrefour|carrefour market|acima|bim|aswak|aswak assalam|atacadao|metro|label vie|labelvie|casino|سوق|حانوت|تقدية|مرجان|كارفور|بقال|مارشي',
                          k: 'marjane|carrefour|labelvie|atacadao|aswakassalam' },
                        { t: '🥬 Légumes, fruits', v: ['khdra', 'khodra', 'legumes', 'fruits', 'tqdya', 'alimentation', 'courses'], f: 82,
                          m: 'legume|legumes|khodra|khdra|khodrawat|khdar|khodar|l5odra|lkhodra|fakya|fekia|fakia|fakiya|fruit|fruits|banane|bananes|pomme|pommes|poire|poires|raisin|fraise|fraises|pasteque|dellah|melon|tomate|tomates|maticha|matecha|tomatich|batata|btata|pomme de terre|pommes de terre|oignon|oignons|bsla|besla|carotte|carottes|courgette|courgettes|poivron|poivrons|felfla|salade|citron|citrons|خضرة|خضرا|خضر|فاكية|فواكه|بطاطا|ماطيشة|بصلة|ليمون' },
                        { t: '🥩 Viande', v: ['l7m', 'lhem', 'lham', 'viande', 'boucherie', 'tqdya', 'alimentation'], f: 85,
                          m: 'viande|viandes|boucher|boucherie|l7m|l7em|lhem|lham|l7am|lahm|gzar|gezzar|jazzar|gazar|kebda|mouton|agneau|boeuf|veau|steak|لحم|جزار|كبدة' },
                        { t: '🍢 Kefta', v: ['kfta', 'kefta', 'l7m', 'viande', 'tqdya', 'alimentation'], f: 86,
                          m: 'kfta|kefta|kafta|viande hachee|hachee|كفتة' },
                        { t: '🍗 Poulet', v: ['djaj', 'poulet', 'volaille', 'tqdya', 'alimentation'], f: 86,
                          m: 'djaj|djej|dajaj|jaj|poulet|poulets|volaille|dinde|escalope|escalopes|blanc de poulet|ferakh|frakh|دجاج|دجاجة|فروج' },
                        { t: '🐟 Poisson', v: ['samak', 'hout', '7out', 'poisson', 'tqdya', 'alimentation'], f: 86,
                          m: 'samak|hout|7out|l7out|lhout|poisson|poissons|sardine|sardines|crevette|crevettes|calamar|calamars|merlan|dorade|saumon|thon|poissonnier|حوت|سمك|سردين' },
                        { t: '🥚 Œufs', v: ['oeufs', 'oeuf', 'bid', 'tqdya', 'alimentation'], f: 86,
                          m: 'oeuf|oeufs|bid|beid|bayd|bid beldi|بيض' },
                        { t: '🥛 Lait, frais', v: ['lait', 'laitier', 'tqdya', 'alimentation'], f: 80,
                          m: 'lait|7lib|hlib|l7lib|lben|raib|raibi|yaourt|yaourts|yogourt|danone|jaouda|centrale laitiere|jben|fromage|fromages|beurre|zebda|creme|edam|gouda|parmesan|حليب|لبن|رايب|جبن|زبدة' },
                        { t: '🥖 Pain, boulangerie', v: ['pain', 'boulangerie', 'khobz', 'tqdya', 'alimentation'], f: 84,
                          m: 'pain|khobz|khubz|khbz|boulangerie|boulanger|msemen|msmen|harcha|baghrir|beghrir|batbout|croissant|croissants|viennoiserie|خبز|مسمن|حرشة|بغرير' },
                        { t: '🍰 Dessert, pâtisserie', v: ['dessert', 'patisserie', 'gateau', 'tqdya', 'alimentation'], f: 80,
                          m: 'dessert|desserts|patisserie|patissier|gateau|gateaux|halwa|7alwa|7lwa|chocolat|biscuits|biscuit|bonbons|tarte|حلوة|حلويات|كيك' },
                        { t: '🫙 Épicerie sèche, eau', v: ['epicerie', 'tqdya', 'courses', 'alimentation'], f: 80,
                          m: 'huile|zit|sucre|sokar|sokkar|sukkar|the|atay|atai|farine|dqiq|d9i9|smida|semoule|riz|rouz|pates|spaghetti|couscous|lentilles|3dess|adess|loubia|haricots|pois chiches|7mess|hummus|conserve|conserves|sel|epices|eau minerale|sidi ali|ain saiss|oulmes|bahia|sidi harazem|زيت|سكر|أتاي|اتاي|دقيق|سميدة|روز|عدس|لوبيا|حمص|ملحة' },
                        { t: '🍔 Fast-food, livraison', v: ['fast food', 'fastfood', 'snack', 'resto', 'restaurant', 'sorties', 'sortie', 'loisirs'], f: 88,
                          m: 'mcdo|macdo|mcdonald|mcdonalds|kfc|burger|burgers|burger king|quick|pizza|pizzas|pizza hut|dominos|domino|papa johns|tacos|otacos|o tacos|tacos de lyon|subway|popeyes|five guys|sandwich|sandwichs|panini|chawarma|shawarma|chawerma|snack|fast food|glovo|jumia food|kool|yassir food|ماكدونالدز|بيتزا|طاكوس|سناك',
                          k: 'mcdonald|burgerking|pizzahut|dominos|papajohns|tacosdelyon|otacos|popeyes|fiveguys|glovo|jumiafood' },
                        { t: '🍽️ Restaurant', v: ['resto', 'restaurant', 'sorties', 'sortie'], f: 84,
                          m: 'resto|restaurant|restau|brasserie|grill|sushi|traiteur|diner|dejeuner|brunch|مطعم|ريسطو' },
                        { t: '☕ Café', v: ['cafe', 'salon de the', 'sorties', 'sortie'], f: 82,
                          m: 'cafe|cafes|qahwa|9ahwa|kahwa|l9ahwa|lqahwa|kahoua|starbucks|costa|salon de the|capuccino|cappuccino|espresso|nousnous|nss nss|قهوة|مقهى',
                          k: 'starbucks' },
                        { t: '🍦 Glace', v: ['glace', 'sorties', 'sortie', 'dessert'], f: 80,
                          m: 'glace|glaces|ice cream|venezia|gelato|كلاص' },
                        { t: '🎬 Loisirs, sorties', v: ['loisirs', 'loisir', 'sorties', 'sortie'], f: 80,
                          m: 'cinema|sinima|megarama|imax|pathe|bowling|parc|zoo|plage|concert|spectacle|theatre|musee|jeux|kidzo|sortie|sorties|loisir|loisirs|fete foraine|karting|سينما|بحر' },
                        { t: '💈 Coiffeur, barber', v: ['barber', 'coiffeur', 'coiffure', 'beaute', 'sorties'], f: 88,
                          m: 'barber|barbier|coiffeur|coiffure|coiffeuse|hallaq|7allaq|7ellaq|hjjam|7jjam|hajjam|7ajjam|salon de coiffure|brushing|حلاق|حجام|كوافور' },
                        { t: '🧖 Hammam, beauté', v: ['hammam', 'beaute', 'soins', 'sorties'], f: 82,
                          m: 'hammam|7mam|7ammam|hamam|spa|massage|gommage|esthetique|estheticienne|manucure|pedicure|onglerie|epilation|maquillage|cosmetique|cosmetiques|حمام|كسالة' },
                        { t: '🏋️ Sport', v: ['sport', 'salle', 'gym', 'loisirs', 'sorties'], f: 82,
                          m: 'gym|fitness|salle de sport|city club|cityclub|basic fit|crossfit|padel|tennis|foot|football|piscine|natation|coach|رياضة',
                          k: 'cityclub|basicfit' },
                        { t: '⛽ Essence', v: ['essence', 'sans plomb', 'carburant', 'voiture'], f: 86,
                          m: 'essence|lisans|lissans|lisance|lisence|sans plomb|benzine|ليصانص|ليسانس|بنزين' },
                        { t: '⛽ Diesel', v: ['diesel', 'gasoil', 'gazoil', 'mazot', 'carburant', 'voiture'], f: 86,
                          m: 'diesel|gasoil|gazoil|gazole|mazot|mazout|mazote|مازوط|غازوال' },
                        { t: '⛽ Station-service', v: [['essence', 'diesel', 'gasoil'], 'carburant', 'voiture'], f: 80,
                          m: 'carburant|station|station service|afriquia|shell|totalenergies|winxo|petrom|ziz|oilibya|vivo energy|محطة',
                          k: 'afriquia|totalenergies|winxo|petrom|oilibya' },
                        { t: '🚿 Lavage auto', v: ['ghsil', 'lavage', 'voiture'], f: 88,
                          m: 'ghsil|ghassil|ghasil|lavage|karcher|lavage auto|غسيل|لافاج' },
                        { t: '🔧 Entretien voiture', v: ['entretien', 'reparation', 'garage', 'mecanique', 'voiture'], f: 84,
                          m: 'vidange|fidanj|fidange|pneu|pneus|bnou|garage|mecanicien|mikanisyan|mecanique|carrosserie|tolier|batterie|frein|freins|plaquettes|courroie|controle technique|visite technique|vignette|depannage|remorquage|فيدانج|ميكانيسيان' },
                        { t: '🅿️ Parking, péage', v: ['parking', 'stationnement', 'peage', 'voiture', 'transport'], f: 84,
                          m: 'parking|barking|gardien|guardien|assas|3assas|l3assas|peage|autoroute|adm|jawaz|باركينغ|عساس' },
                        { t: '🚕 Transport', v: ['transport', 'taxi', 'deplacement', 'voiture'], f: 84,
                          m: 'taxi|petit taxi|grand taxi|tram|tramway|bus|tobis|tobiss|alsa|careem|indrive|heetch|yassir|uber|bolt|train|tren|trinn|oncf|boraq|al boraq|ctm|supratours|autocar|طاكسي|طوبيس|تران|طرامواي' },
                        { t: '💊 Pharmacie', v: ['medicam', 'medicament', 'medicaments', 'pharmacie', 'sante'], f: 88,
                          m: 'pharmacie|pharma|farmasyan|fermasyan|fermasien|farmasian|dwa|dowa|doua|dwaya|medicament|medicaments|medoc|medocs|ordonnance|sirop|doliprane|paracetamol|antibiotique|صيدلية|دوا|دواء|فرماسيان' },
                        { t: '🩺 Médecin', v: ['medecin', 'docteur', 'consultation', 'sante'], f: 88,
                          m: 'medecin|docteur|tbib|tobib|tbiba|consultation|generaliste|specialiste|pediatre|gyneco|gynecologue|dermato|dermatologue|cardio|cardiologue|ophtalmo|ophtalmologue|orl|rhumato|طبيب|طبيبة|دكتور' },
                        { t: '🧠 Psy', v: ['psy', 'psychologue', 'therapie', 'sante'], f: 90,
                          m: 'psy|psychologue|psychiatre|psychotherapeute|therapie|therapeute' },
                        { t: '🦷 Dentiste', v: ['dentiste', 'dentaire', 'sante'], f: 88,
                          m: 'dentiste|dentaire|snan|orthodontiste|سنان' },
                        { t: '🔬 Analyses, imagerie', v: ['analyses', 'analyse', 'labo', 'laboratoire', 'sante'], f: 86,
                          m: 'analyse|analyses|laboratoire|labo|tahlil|ta7lil|prise de sang|radio|radiologie|scanner|irm|echographie|تحليل|تحاليل|راديو' },
                        { t: '🏥 Clinique, hôpital', v: ['clinique', 'hopital', 'sante'], f: 86,
                          m: 'clinique|klinik|hopital|sbitar|sbetar|urgences|chu|سبيطار|مصحة|مستشفى|كلينيك' },
                        { t: '👓 Optique', v: ['optique', 'lunettes', 'sante'], f: 84,
                          m: 'opticien|optique|lunettes|nadador|nadadat|nadadar|نظارات|ندادر' },
                        { t: '💪 Compléments', v: ['complement', 'complements', 'vitamines', 'sante'], f: 84,
                          m: 'complement|complements|complement alimentaire|vitamine|vitamines|omega|magnesium|whey|proteine|proteines|collagene' },
                        { t: '🦴 Kiné', v: ['kine', 'kinesitherapie', 'reeducation', 'sante'], f: 86,
                          m: 'kine|kinesitherapeute|kinesitherapie|reeducation|osteopathe|osteo' },
                        { t: '💡 Électricité', v: ['elect', 'electricite', 'electricity', 'lumiere', 'factures'], f: 88,
                          m: 'electricite|elec|elect|electricity|dow|daw|dou|ddaw|ddou|lydec|redal|amendis|onee|radeema|radeej|radeef|ضو|كهرباء' },
                        { t: '🚰 Eau', v: ['eau', 'factures'], f: 84,
                          m: 'eau|lma|elma|facture eau|الما|ماء' },
                        { t: '🔥 Gaz', v: ['gaz', 'butane', 'factures', 'tqdya'], f: 82,
                          m: 'gaz|lgaz|butane|boutagaz|bouta|bouteille de gaz|بوطا|غاز|البوطة' },
                        { t: '📱 Téléphone, recharge', v: ['tel', 'telephone', 'recharge', 'mobile', 'factures'], f: 86,
                          m: 'tel|telephone|recharge|recharger|jawal|forfait|iam|maroc telecom|orange maroc|inwi|mobile|تعبئة|تيليفون|جوال|انوي' },
                        { t: '🌐 Internet', v: ['internet', 'wifi', 'fibre', 'factures'], f: 86,
                          m: 'internet|wifi|wi fi|fibre|adsl|box|4g|5g|انترنت|الويفي' },
                        { t: '📺 Abonnements', v: ['$mot', 'abonnement', 'abonnements', 'streaming', 'factures'], f: 84,
                          m: 'netflix|spotify|deezer|anghami|youtube premium|youtube|shahid|osn|disney|disney plus|prime video|amazon prime|apple music|icloud|google one|canal plus|bein|starzplay|abonnement' },
                        { t: '🤖 IA, logiciels', v: ['$mot', 'ia', 'intelligence artificielle', 'logiciel', 'abonnement', 'factures'], f: 86,
                          m: 'chatgpt|openai|claude|anthropic|gemini|midjourney|copilot|perplexity|mistral|notion|canva|adobe|microsoft 365|office 365|ia' },
                        { t: '🏠 Loyer', v: ['loyer', 'location', 'kra', 'logement'], f: 84,
                          m: 'loyer|kra|kira|kera|lkra|location appartement|كرا|الكرا' },
                        { t: '🏦 Crédit', v: ['credit', 'emprunt', 'pret', 'echeance'], f: 80,
                          m: 'credit|traite|echeance|mensualite|pret|emprunt|mourabaha|كريدي|قرض' },
                        { t: '🏢 Syndic', v: ['syndic', 'copropriete'], f: 88,
                          m: 'syndic|sandik|copropriete|سانديك' },
                        { t: '👶 Nounou', v: ['nounou', 'nourrice', 'garde enfant'], f: 88,
                          m: 'nounou|nourrice|baby sitter|babysitter|mrebbiya|mrabiya|مربية' },
                        { t: '🧹 Femme de ménage', v: ['femme de menage', 'menage', 'aide menagere'], f: 88,
                          m: 'femme de menage|khddama|khaddama|khadama|mo3ina|m3ina|aide menagere|خدامة|معينة' },
                        { t: '🎒 École', v: ['ecole', 'scolarite', 'education', 'creche'], f: 86,
                          m: 'ecole|mdrasa|madrasa|lmdrasa|creche|garderie|scolarite|inscription|frais de scolarite|fournitures|fournitures scolaires|cartable|kotob|ktob|ktoub|livres|cahier|cahiers|transport scolaire|مدرسة|كتوب|روض' },
                        { t: '👕 Vêtements', v: ['habits', 'vetements', 'vetement', 'lbas'], f: 84,
                          m: 'habits|vetements|vetement|7wayej|hwayej|hwayj|7wayj|lbas|sbbat|sebbat|sabbat|chaussures|basket|baskets|pantalon|chemise|t shirt|tshirt|robe|veste|manteau|pyjama|zara|lc waikiki|waikiki|kiabi|defacto|bershka|pull and bear|mango|celio|massimo dutti|shein|حوايج|صباط|لباس',
                          k: 'lcwaikiki|defacto|bershka|pullandbear|massimodutti|kiabi' },
                        { t: '🍼 Bébé', v: ['bebe', 'puericulture', 'couches'], f: 74,
                          m: 'couches|couche|pampers|dodot|molfix|lingettes|biberon|lait bebe|lait infantile|nido|guigoz|bebe|حفاظات|ليكوش|بيبي' },
                        { t: '🧸 Jouets', v: ['jouets', 'jouet', 'jeux'], f: 88,
                          m: 'jouet|jouets|l3ab|l3ob|l3oba|toys|toys r us|lego|poupee|لعب|لعبة' },
                        { t: '🛋️ Maison, bricolage', v: ['maison', 'menage', 'bricolage', 'equipement', 'divers'], f: 78,
                          m: 'ikea|kitea|bricoma|mr bricolage|brico|quincaillerie|droguerie|produits menagers|javel|jafil|detergent|tide|ariel|omo|persil|liquide vaisselle|electromenager|electroplanet|biougnach|decoration|meuble|meubles|matelas|جافيل|دروغري',
                          k: 'ikea|kitea|bricoma|electroplanet|biougnach' },
                        { t: '🎁 Cadeaux, fêtes', v: ['cadeaux', 'cadeau', 'fetes', 'fete', 'exceptionnel'], f: 80,
                          m: 'cadeau|cadeaux|hdiya|hadiya|hdya|l3id|3id|aid|aid el kebir|aid kebir|hawli|7awli|kebch|kabch|mouton aid|anniversaire|mariage|3ers|3ors|aqiqa|sbou3|zakat|sadaqa|sdqa|sada9a|don|dons|mosquee|هدية|العيد|حولي|عرس|صدقة|زكاة' },
                        { t: '✈️ Voyage', v: ['voyage', 'vacances', 'exceptionnel'], f: 82,
                          m: 'voyage|vacances|hotel|riad|booking|airbnb|ram|royal air maroc|ryanair|air arabia|easyjet|transavia|billet avion|avion|vol|safar|visa|سفر|فندق|طيارة' },
                        { t: '🏧 Frais bancaires', v: ['frais bancaires', 'banque', 'frais'], f: 80,
                          m: 'frais bancaires|agios|commission|cotisation carte|tenue de compte|banque|cih|bmce|bank of africa|attijari|attijariwafa|banque populaire|cdm|credit agricole|sgma|بنك' },
                        { t: '🧾 Impôts, administration', v: ['impots', 'impot', 'taxes', 'administratif', 'exceptionnel'], f: 80,
                          m: 'impot|impots|taxe|taxes|taxe habitation|timbre|timbres|amende|dgi|tgr|legalisation|moqata3a|mo9ata3a|ضريبة|تنبر|مخالفة|المقاطعة' },
                        { t: '🛡️ Assurance', v: ['assurance', 'assur'], f: 74,
                          m: 'assurance|assurances|wafa assurance|axa|saham|sanlam|rma|allianz|atlanta|تأمين|لاسورانس' },
                        { t: '🚬 Tabac', v: ['tabac', 'cigarettes', 'sorties'], f: 80,
                          m: 'tabac|cigarette|cigarettes|garro|garo|marlboro|winston|chicha|كارو|شيشة' },
                        { t: '🐾 Animaux', v: ['animaux', 'veterinaire', 'chat', 'chien'], f: 82,
                          m: 'veterinaire|veto|croquettes|chat|chien|بيطري' },
                        { t: '👔 Pressing', v: ['pressing', 'blanchisserie', 'menage'], f: 82,
                          m: 'pressing|blanchisserie|teinturerie|بريسينغ' },
                    ];
                    const _DICO = DICO_CATEGORIES.map((r, i) => {
                        const tous = [...new Set(r.m.split('|').map(x => _analyseLibelle(x).bruts.join(' ')).filter(Boolean))];
                        return { i, theme: r.t, vers: r.v, force: r.f, tous,
                                 mots: new Set(tous.filter(x => !x.includes(' '))), phrases: tous.filter(x => x.includes(' ')),
                                 enseignes: (r.k || '').split('|').map(x => _analyseLibelle(x).compact).filter(x => x.length >= 5) };
                    });

                    //  Les catégories VIVANTES où ranger une dépense : celles que porte encore une
                    //  ligne du budget. Une catégorie renommée ou supprimée reste au registre
                    //  (« Marjane Lait »…), elle n'est jamais proposée. Ni revenus, ni « Non catégorisé ».
                    const _TYPES_DEPENSE = new Set(['charge_fixe', 'charge_fixe_part', 'charge_variable', 'charge_variable_part', 'charge_variable_detail', 'irreguliere', 'epargne']);
                    const _HORS_DEPENSE = new Set(['cat_misc', 'cat_irr_revenu_exceptionnel', 'cat_irr_assurance']);
                    const _categoriesCandidates = computed(() => {
                        calculationTick.value;
                        const vivantes = new Set(['cat_irr_depense_exceptionnelle']);
                        const noter = (x) => { if (x && x.categorieId) vivantes.add(x.categorieId); };
                        Object.values(donneesAnnuelles.value || {}).forEach(d => {
                            if (!d) return;
                            Object.values(d.chargesFixes || {}).forEach(it => { noter(it); ((it && it.parts) || []).forEach(noter); });
                            Object.values(d.chargesVariables || {}).forEach(it => { noter(it); ((it && it.parts) || []).forEach(noter); ((it && it.details) || []).forEach(noter); });
                            (d.epargne || []).forEach(noter);
                        });
                        const reg = (soldesInitiaux.value.categories || []).filter(c => c && c.id && !c.archive && _TYPES_DEPENSE.has(c.type) && !_HORS_DEPENSE.has(c.id));
                        //  Des données d'avant l'étiquetage (rien de vivant) : tout le registre
                        const liste = vivantes.size > 1 ? reg.filter(c => vivantes.has(c.id)) : reg;
                        return liste.map(c => { const A = _analyseLibelle(c.label); return { id: c.id, label: String(c.label || '').trim(), parent: c.parent || null, type: c.type, mots: A.toks, phrase: A.toks.join(' ') }; })
                                    .filter(c => c.mots.length);
                    });
                    //  Des mots de libellé qui ne disent rien de la dépense
                    const _MOTS_LABEL_FAIBLES = new Set(['reste', 'charge', 'charges', 'compte', 'part', 'divers', 'autre', 'autres', 'total', 'plus']);
                    //  Un mot du dictionnaire → vos catégories qui le portent
                    const _resoudreCible = (cible, cats) => {
                        const n = _analyseLibelle(cible).toks.join(' ');
                        if (!n) return [];
                        let hits = cats.filter(c => c.phrase === n);                                      // le libellé entier
                        if (!hits.length) hits = n.includes(' ') ? cats.filter(c => (' ' + c.phrase + ' ').includes(' ' + n + ' '))
                                                              : cats.filter(c => c.mots.includes(n));         // un mot du libellé
                        if (!hits.length && n.length >= 5 && !n.includes(' '))                            // exceptionnel → exceptionnelle
                            hits = cats.filter(c => c.mots.some(w => w.length >= 5 && (w.startsWith(n) || n.startsWith(w))));
                        return hits;
                    };
                    //  Une dépense va vers une CHARGE : toute la liste « vers » est essayée sur vos
                    //  charges d'abord ; une poche d'épargne (« Épargne courses »…) seulement à défaut.
                    const _resoudreVers = (vers, mot, cats) => {
                        for (const pool of [cats.filter(c => c.type !== 'epargne'), cats.filter(c => c.type === 'epargne')]) {
                            for (let i = 0; i < vers.length; i++) {
                                const hits = [];
                                (Array.isArray(vers[i]) ? vers[i] : [vers[i]]).forEach(x => {
                                    if (x === '$mot' && !mot) return;
                                    _resoudreCible(x === '$mot' ? mot : x, pool).forEach(c => { if (!hits.includes(c)) hits.push(c); });
                                });
                                if (hits.length) return { rang: i, hits };
                            }
                        }
                        return null;
                    };
                    //  Les thèmes du dictionnaire présents dans un libellé (une expression passe
                    //  avant ses mots seuls : « eau minerale » n'est pas une facture d'eau)
                    const _reglesDuLibelle = (A) => {
                        const out = new Map(), pris = new Set();
                        const noter = (r, mot, force) => { const o = out.get(r); if (!o || force > o.force) out.set(r, { r, mot, force }); };
                        _DICO.forEach(r => r.phrases.forEach(p => { if (A.phrase.includes(' ' + p + ' ')) { noter(r, p, r.force + 4); p.split(' ').forEach(w => pris.add(w)); } }));
                        _DICO.forEach(r => {
                            A.toks.forEach(w => { if (!pris.has(w) && r.mots.has(w)) noter(r, w, r.force); });
                            r.enseignes.forEach(e => { if (A.compact.includes(e)) noter(r, e, r.force); });
                        });
                        const res = [...out.values()];
                        res.pris = pris;
                        return res;
                    };

                    //  Ce que vos transactions déjà rangées apprennent : par libellé entier et par mot.
                    //  Un choix fait À LA MAIN (categorieSource « vous ») pèse trois fois plus.
                    const _memoireCategories = computed(() => {
                        calculationTick.value;
                        const exact = Object.create(null), mots = Object.create(null);
                        const vivantes = new Set(_categoriesCandidates.value.map(c => c.id));
                        const ajouter = (table, cle, t) => {
                            const e = table[cle] = table[cle] || Object.create(null);
                            const x = e[t.categorieId] = e[t.categorieId] || { p: 0, vous: false };
                            const vous = t.categorieSource === 'vous';
                            x.p += vous ? 3 : 1; x.vous = x.vous || vous;
                        };
                        Object.values(donneesAnnuelles.value || {}).forEach(d => (d && Array.isArray(d.transactionsReelles) ? d.transactionsReelles : []).forEach(t => {
                            if (!t || !t.categorieId || t.categorieId === 'cat_misc' || t.aVerifier || !vivantes.has(t.categorieId)) return;
                            const toks = _analyseLibelle(t.libelle).toks;
                            if (!toks.length) return;
                            ajouter(exact, toks.join(' '), t);
                            toks.forEach(w => ajouter(mots, w, t));
                        }));
                        return { exact, mots };
                    });

                    const _CAT_SEUIL_SUR = 75, _CAT_MARGE = 12;
                    //  LA décision. { id, statut : 'sur' | 'doute' | 'inconnu', source, score, candidats, raison }
                    const categoriserLibelle = (libelle) => {
                        const A = _analyseLibelle(libelle);
                        const vide = { id: null, statut: 'inconnu', source: null, score: 0, candidats: [], raison: '' };
                        if (!A.toks.length) return vide;
                        const cats = _categoriesCandidates.value;
                        const parId = new Map(cats.map(c => [c.id, c]));
                        const props = new Map();
                        const proposer = (id, score, source, raison) => {
                            if (!parId.has(id)) return;
                            const p = props.get(id) || { id, score: 0, source: null, raison: '', sources: new Set() };
                            if (score > p.score) { p.score = score; p.source = source; p.raison = raison; }
                            p.sources.add(source); props.set(id, p);
                        };
                        //  1. Vos corrections et vos saisies passées
                        const mem = _memoireCategories.value, cle = A.toks.join(' ');
                        const exact = mem.exact[cle];
                        if (exact) {
                            const total = Object.values(exact).reduce((s, x) => s + x.p, 0);
                            Object.entries(exact).forEach(([id, x]) => proposer(id, x.p / total >= 0.75 ? (x.vous ? 98 : 82) : 55,
                                x.vous ? 'vous' : 'appris', '« ' + cle + ' » déjà rangé ici'));
                        } else {
                            const votes = Object.create(null);
                            A.toks.forEach(w => Object.entries(mem.mots[w] || {}).forEach(([id, x]) => {
                                const v = votes[id] = votes[id] || { p: 0, vous: false }; v.p += x.p; v.vous = v.vous || x.vous; }));
                            const total = Object.values(votes).reduce((s, x) => s + x.p, 0);
                            Object.entries(votes).forEach(([id, x]) => proposer(id,
                                x.p / total >= 0.75 ? (x.vous ? (total >= 2 ? 88 : 80) : (total >= 2 ? 72 : 62)) : 50,
                                x.vous ? 'vous' : 'appris', 'des mots déjà rangés ici'));
                        }
                        //  2. Vos libellés : le mot tapé EST une de vos lignes — sauf s'il appartient à
                        //  une expression du dictionnaire (« eau minerale » n'est pas votre ligne « eau »)
                        const regles = _reglesDuLibelle(A);
                        const libres = A.toks.filter(w => !regles.pris.has(w));
                        cats.forEach(c => {
                            const forts = c.mots.filter(w => !_MOTS_LABEL_FAIBLES.has(w));
                            if (!forts.length) return;
                            if (c.phrase === cle) return proposer(c.id, 97, 'libellé', '« ' + c.label + ' » est une de vos lignes');
                            if (c.mots.length > 1 && A.tphrase.includes(' ' + c.phrase + ' ')) return proposer(c.id, 92, 'libellé', '« ' + c.label + ' » dans le libellé');
                            if (c.mots.length === 1 && libres.includes(c.mots[0])) return proposer(c.id, 92, 'libellé', '« ' + c.label + ' » dans le libellé');
                            const k = forts.filter(w => libres.includes(w)).length;
                            if (k) proposer(c.id, Math.min(85, 60 + 10 * (k - 1)), 'libellé', 'un mot de « ' + c.label + ' »');
                        });
                        //  3. Le dictionnaire, traduit vers vos libellés
                        regles.forEach(h => {
                            const res = _resoudreVers(h.r.vers, h.mot, cats);
                            if (!res) return;
                            const s = h.force - 2 * res.rang - (res.hits.length > 1 ? 15 : 0);
                            res.hits.forEach(c => proposer(c.id, s, 'règle', h.r.theme.replace(/^\S+\s+/, '') + ' : « ' + h.mot + ' »'));
                        });
                        if (!props.size) return vide;
                        //  Plusieurs couches d'accord : +4 chacune ; une ligne dont la catégorie mère
                        //  est aussi proposée : +4 (elles disent la même chose, plus précisément).
                        const parentDe = (id) => (parId.get(id) || {}).parent || null;
                        const famille = (a, b) => a === b || parentDe(a) === b || parentDe(b) === a;
                        const liste = [...props.values()]
                            .map(p => ({ ...p, note: Math.min(99, p.score + 4 * (p.sources.size - 1) + (parentDe(p.id) && props.has(parentDe(p.id)) ? 4 : 0)) }))
                            .sort((a, b) => b.note - a.note || (parentDe(b.id) ? 1 : 0) - (parentDe(a.id) ? 1 : 0));
                        const best = liste[0];
                        const rival = liste.find(p => !famille(p.id, best.id));
                        const proche = !!rival && rival.note >= best.note - _CAT_MARGE;
                        const sur = best.note >= _CAT_SEUIL_SUR && !proche;
                        let id = best.id;
                        //  Deux lignes sœurs se disputent : leur catégorie mère, elle, est juste
                        if (!sur && proche && parentDe(best.id) && parentDe(best.id) === parentDe(rival.id) && parId.has(parentDe(best.id))) id = parentDe(best.id);
                        const candidats = [];
                        [best, rival, ...liste].forEach(p => { if (p && !candidats.includes(p.id) && candidats.length < 3) candidats.push(p.id); });
                        return { id, statut: sur ? 'sur' : 'doute', source: best.source, score: best.note, candidats, raison: best.raison };
                    };
"""
src = src[:i] + MOTEUR + src[j:]

# ═══════════════════════════════════════════════════════════════════════════
# 2. LA SAISIE : une transaction dit d'où vient sa catégorie et si elle est à vérifier
# ═══════════════════════════════════════════════════════════════════════════
sub('ajouterTransactionReelle', """                            categorieId: data.categorieId || 'cat_misc',
                            compteId: data.compteId || saisieCompteDefaut.value,
                            source: data.source || 'manuel',
                        };
                        donneesAnnuelles.value[a].transactionsReelles.push(tx);
                        handleDataChange();
                    };""", """                            categorieId: data.categorieId || 'cat_misc',
                            compteId: data.compteId || saisieCompteDefaut.value,
                            source: data.source || 'manuel',
                        };
                        //  v37.49 : d'où vient la catégorie, et si elle reste à vérifier
                        if (data.categorieSource) tx.categorieSource = data.categorieSource;
                        if (data.aVerifier) tx.aVerifier = true;
                        donneesAnnuelles.value[a].transactionsReelles.push(tx);
                        handleDataChange();
                        return tx.id;
                    };""")
sub('refs de la saisie', """                    const saisieCatSource = ref(null);
                    const saisieCatSuggestions = ref([]);""", """                    const saisieCatSource = ref(null);
                    const saisieCatSuggestions = ref([]);
                    //  v37.49 : 'sur' | 'doute' | 'inconnu', et pourquoi
                    const saisieCatStatut = ref(null);
                    const saisieCatRaison = ref('');""")
sub('reset', """                        if (saisieCatSource) saisieCatSource.value = null;
                        if (saisieCatSuggestions) saisieCatSuggestions.value = [];""", """                        if (saisieCatSource) saisieCatSource.value = null;
                        if (saisieCatSuggestions) saisieCatSuggestions.value = [];
                        saisieCatStatut.value = null; saisieCatRaison.value = '';""")
sub('choix à la main', """                        saisieForm.value.categorieId = catId;
                        saisieCatSource.value = 'manuel';
                        saisieCatSuggestions.value = [];""", """                        saisieForm.value.categorieId = catId;
                        saisieCatSource.value = 'manuel';
                        saisieCatStatut.value = 'sur'; saisieCatRaison.value = 'Choisi par vous';
                        saisieCatSuggestions.value = [];""")
sub('watch : vide', """                        if (!s) { saisieCatSource.value = null; saisieCatSuggestions.value = []; return; }""",
"""                        if (!s) { saisieCatSource.value = null; saisieCatStatut.value = null; saisieCatRaison.value = ''; saisieCatSuggestions.value = []; return; }""")
sub('watch : le moteur', """                            // Un choix manuel de l'utilisateur n'est jamais écrasé
                            if (saisieCatSource.value === 'manuel') return;
                            const guess = _guessCategorieId(parsed.libelle);
                            if (guess) {
                                saisieForm.value.categorieId = guess.id;
                                saisieCatSource.value = guess.source;
                                saisieCatSuggestions.value = [];
                            } else {
                                saisieForm.value.categorieId = '';
                                saisieCatSource.value = null;
                                // Rien de sûr → on propose les 3 catégories les plus utilisées
                                saisieCatSuggestions.value = categoriesLesPlusUtilisees.value.slice(0, 3);
                            }""", """                            // Un choix manuel de l'utilisateur n'est jamais écrasé
                            if (saisieCatSource.value === 'manuel') return;
                            //  v37.49 : sûr → rangé ; doute → rangé au plus probable, les pistes en
                            //  puces ; inconnu → l'IA proposera après validation
                            const r = categoriserLibelle(parsed.libelle);
                            saisieForm.value.categorieId = r.id || '';
                            saisieCatSource.value = r.source;
                            saisieCatStatut.value = r.statut;
                            saisieCatRaison.value = r.raison;
                            saisieCatSuggestions.value = r.statut === 'sur' ? [] : (r.candidats.length ? r.candidats : categoriesLesPlusUtilisees.value.slice(0, 3));""")
sub('validation', """                        const dt = f.datetime || _nowLocalDateTime();
                        ajouterTransactionReelle({
                            datetime: dt,
                            date: dt.slice(0, 10),
                            mois: Number(dt.slice(5, 7)),
                            libelle: f.libelle,
                            montant: f.montant,
                            categorieId: f.categorieId || 'cat_misc',
                            compteId: f.compteId,
                        });
                        resetSaisieForm();
                        return true;
                    };""", """                        const dt = f.datetime || _nowLocalDateTime();
                        //  v37.49 : un choix à la main est sûr ; un doute ou rien de trouvé part
                        //  « À catégoriser » — et rien de trouvé est confié à l'IA, en arrière-plan
                        const manuel = saisieCatSource.value === 'manuel';
                        const statut = manuel ? 'sur' : (f.categorieId && f.categorieId !== 'cat_misc' ? (saisieCatStatut.value || 'sur') : 'inconnu');
                        const txId = ajouterTransactionReelle({
                            datetime: dt,
                            date: dt.slice(0, 10),
                            mois: Number(dt.slice(5, 7)),
                            libelle: f.libelle,
                            montant: f.montant,
                            categorieId: f.categorieId || 'cat_misc',
                            categorieSource: manuel ? 'vous' : (statut !== 'inconnu' ? (saisieCatSource.value || null) : null),
                            aVerifier: statut !== 'sur',
                            compteId: f.compteId,
                        });
                        if (txId && statut === 'inconnu') demanderCategorieIA(txId);
                        resetSaisieForm();
                        return true;
                    };

                    // ── v37.49 : L'IA, QUAND LES RÈGLES NE SAVENT PAS ───────────────────
                    //   Le webhook du CFO (celui de la Recherche Éclair), en LECTURE SEULE,
                    //   session « categorisation ». Sa réponse est un JSON {id, confiance,
                    //   raison} ; l'id est vérifié contre VOS catégories vivantes. Confiance
                    //   haute : rangé (« · IA »). Moyenne ou basse : rangé à l'essai, laissé
                    //   « À catégoriser ». Injoignable : la transaction attend, surlignée.
                    //   Une demande à la fois : dix saisies d'affilée ne font pas dix appels
                    //   simultanés.
                    const iaCategorisation = reactive({ enCours: {}, messages: {} });
                    const _txParId = (id) => {
                        for (const d of Object.values(donneesAnnuelles.value || {})) {
                            const t = (d && Array.isArray(d.transactionsReelles) ? d.transactionsReelles : []).find(x => x && x.id === id);
                            if (t) return t;
                        }
                        return null;
                    };
                    const _questionCategorieIA = (t) => {
                        const cats = _categoriesCandidates.value;
                        const nom = (id) => (cats.find(c => c.id === id) || {}).label || String(getCategorieLabel(id) || '').trim();
                        return [
                            "CLASSEMENT D'UNE DÉPENSE — LECTURE SEULE : aucun outil, aucune recherche, aucun propose_changes, aucun committer, aucun memory_writer.",
                            'Dépense : « ' + String(t.libelle || '').trim() + ' », ' + (Number(t.montant) || 0) + ' DH, le ' + String(t.date || '').slice(0, 10) + '.',
                            'Le libellé peut être en français, en darija (lettres latines avec chiffres : 3 = ع, 7 = ح, 9 = ق, 5 = خ ; ou en arabe), une enseigne ou une marque du Maroc.',
                            'Choisis UNE catégorie dans cette liste (id — libellé — catégorie mère) :',
                            ...cats.map(c => c.id + ' — ' + c.label + (c.parent ? ' — ' + nom(c.parent) : '')),
                            'Préfère la sous-catégorie précise quand elle est évidente, sinon la catégorie mère.',
                            'Réponds UNIQUEMENT par ce JSON, sans texte autour : {"id": "<un id de la liste>", "confiance": "haute" | "moyenne" | "basse", "raison": "<10 mots au plus>"}',
                            'Aucune ne convient : {"id": null, "confiance": "basse", "raison": "<pourquoi>"}',
                        ].join('\\n');
                    };
                    //  Le premier objet JSON de la réponse qui porte un « id » (HTML, ```json… tolérés)
                    const _lireJsonIA = (texte) => {
                        const t = String(texte || '').replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
                        for (const b of (t.match(/\\{[^{}]*\\}/g) || [])) {
                            try { const j = JSON.parse(b); if (j && typeof j === 'object' && 'id' in j) return j; } catch (_) {}
                        }
                        return null;
                    };
                    let _iaFile = Promise.resolve();
                    const demanderCategorieIA = (txId) => {
                        if (iaCategorisation.enCours[txId]) return _iaFile;
                        iaCategorisation.enCours[txId] = true;
                        delete iaCategorisation.messages[txId];
                        _iaFile = _iaFile.then(() => _iaUne(txId)).catch(() => {});
                        return _iaFile;
                    };
                    const _iaUne = async (txId) => {
                        try {
                            const t = _txParId(txId);
                            if (!t) return;
                            if (!_analyseLibelle(t.libelle).toks.length || t.libelle === 'Sans libellé') { iaCategorisation.messages[txId] = "Pas de libellé : rien à demander à l'IA, à vous de la ranger."; return; }
                            const res = await fetch(cfoWebhookUrl.value || MARKET_WEBHOOK, {
                                method: 'POST', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ session_id: 'categorisation', source: 'categorisation', question: _questionCategorieIA(t) }),
                            });
                            if (!res.ok) throw new Error('HTTP ' + res.status);
                            const r = _lireJsonIA(_lireReponseCFO(await res.text()).html);
                            if (!r) throw new Error('réponse sans JSON');
                            const u = _txParId(txId);
                            if (!u || u.categorieSource === 'vous') return;                          // rangée à la main entre-temps
                            if (!(r.id && _categoriesCandidates.value.some(c => c.id === r.id))) {
                                iaCategorisation.messages[txId] = "L'IA ne voit aucune de vos catégories" + (r.raison ? ' (' + String(r.raison).slice(0, 80) + ')' : '') + ' : à vous de la ranger.';
                                return;
                            }
                            const conf = ['haute', 'moyenne', 'basse'].includes(r.confiance) ? r.confiance : 'moyenne';
                            u.categorieId = r.id; u.categorieSource = 'ia'; u.iaConfiance = conf;
                            if (r.raison) u.iaRaison = String(r.raison).slice(0, 120);
                            if (conf === 'haute') delete u.aVerifier; else u.aVerifier = true;
                            calculationTick.value++;
                            handleDataChange();
                        } catch (e) {
                            iaCategorisation.messages[txId] = 'IA injoignable (' + (e && e.message || e) + ') : la transaction attend, à vous de la ranger.';
                        } finally {
                            delete iaCategorisation.enCours[txId];
                        }
                    };

                    // ── v37.49 : À CATÉGORISER — le doute et l'inconnu, surlignés ───────────
                    const SOURCES_CATEGORIE = { vous: 'vous', manuel: 'vous', appris: 'appris', 'libellé': 'votre libellé', 'règle': 'règle', ia: 'IA' };
                    const estACategoriser = (t) => !!t && (!t.categorieId || t.categorieId === 'cat_misc' || !!t.aVerifier);
                    const aCategoriser = computed(() => {
                        calculationTick.value;
                        const a = anneeAffichage.value;
                        return ((donneesAnnuelles.value[a] || {}).transactionsReelles || [])
                            .filter(estACategoriser)
                            .map(t => {
                                const r = categoriserLibelle(t.libelle);
                                const actuelle = t.categorieId && t.categorieId !== 'cat_misc' ? t.categorieId : null;
                                const propositions = actuelle ? [actuelle] : [];
                                [r.id, ...r.candidats].forEach(id => { if (id && !propositions.includes(id) && propositions.length < 4) propositions.push(id); });
                                const d = String(t.datetime || t.date || '');
                                return { id: t.id, date: d, quand: d.slice(8, 10) + '/' + d.slice(5, 7), libelle: t.libelle, montant: t.montant,
                                         actuelle, source: t.categorieSource || null, iaRaison: t.iaRaison || '', regle: r, propositions,
                                         sure: !actuelle && r.statut === 'sur' ? r.id : null };
                            })
                            .sort((x, y) => y.date.localeCompare(x.date));
                    });
                    //  Ranger à la main : la transaction sort de la liste, et le choix devient une règle
                    const rangerTransaction = (txId, catId) => {
                        const t = _txParId(txId);
                        if (!t || !catId) return;
                        t.categorieId = catId; t.categorieSource = 'vous';
                        delete t.aVerifier; delete t.iaConfiance;
                        calculationTick.value++;
                        handleDataChange();
                    };
                    const appliquerSuggestionsSures = () => {
                        let n = 0;
                        aCategoriser.value.forEach(l => {
                            const t = l.sure && _txParId(l.id);
                            if (!t) return;
                            t.categorieId = l.sure; t.categorieSource = l.regle.source || 'règle'; delete t.aVerifier; n++;
                        });
                        if (n) { calculationTick.value++; handleDataChange(); }
                        return n;
                    };
                    const demanderIAPourTout = () => aCategoriser.value
                        .filter(l => !l.sure && l.source !== 'ia' && !iaCategorisation.enCours[l.id])
                        .forEach(l => demanderCategorieIA(l.id));
                    //  Le journal : la ligne dont on change la catégorie
                    const editionCategorieTx = ref(null);
                    //  « autre… » : vos catégories VIVANTES, chaque ligne sous sa catégorie mère
                    const categoriesPourRanger = computed(() => {
                        const cats = _categoriesCandidates.value;
                        return [{ label: '🛒 Charges variables', types: ['charge_variable', 'charge_variable_part', 'charge_variable_detail'] },
                                { label: '💸 Charges fixes', types: ['charge_fixe', 'charge_fixe_part'] },
                                { label: '⚡ Exceptionnel', types: ['irreguliere'] },
                                { label: '💰 Épargne', types: ['epargne'] }].map(g => {
                            const items = [];
                            cats.filter(c => g.types.includes(c.type) && !c.parent).forEach(m => {
                                items.push({ id: m.id, label: m.label });
                                cats.filter(c => c.parent === m.id).forEach(e => items.push({ id: e.id, label: '· ' + e.label }));
                            });
                            cats.filter(c => g.types.includes(c.type) && c.parent && !cats.some(x => x.id === c.parent)).forEach(e => items.push({ id: e.id, label: e.label }));
                            return { label: g.label, items };
                        }).filter(g => g.items.length);
                    });
                    //  Les règles, visibles : chaque thème, où il arrive chez vous, ses mots ; vos règles apprises
                    const reglesCategorisation = computed(() => {
                        const cats = _categoriesCandidates.value;
                        const themes = _DICO.map(r => {
                            const res = _resoudreVers(r.vers, null, cats);
                            return { theme: r.theme, vers: res ? res.hits.map(c => c.label).join(' ou ') : null, nb: r.tous.length, mots: r.tous.join(' · ') };
                        });
                        const mem = _memoireCategories.value;
                        const vous = Object.entries(mem.exact).map(([cle, t]) => {
                            const e = Object.entries(t).filter(([, x]) => x.vous).sort((a, b) => b[1].p - a[1].p)[0];
                            return e ? { libelle: cle, vers: String(getCategorieLabel(e[0]) || '').trim() } : null;
                        }).filter(Boolean);
                        return { themes, nbMots: themes.reduce((s, t) => s + t.nb, 0), vous };
                    });""")

sub('exposition', """                        saisieCatSource, saisieCatSuggestions, choisirCategorieSaisie, categoriesLesPlusUtilisees,""",
"""                        saisieCatSource, saisieCatSuggestions, choisirCategorieSaisie, categoriesLesPlusUtilisees,
                        // v37.49 : catégorisation — règles, IA, À catégoriser
                        categoriserLibelle, saisieCatStatut, saisieCatRaison, SOURCES_CATEGORIE, iaCategorisation, demanderCategorieIA,
                        aCategoriser, estACategoriser, rangerTransaction, appliquerSuggestionsSures, demanderIAPourTout, editionCategorieTx, reglesCategorisation, categoriesPourRanger,""")

# ═══════════════════════════════════════════════════════════════════════════
# 3. LE GABARIT
# ═══════════════════════════════════════════════════════════════════════════
BADGE = """<span v-if="saisieForm.categorieId" data-saisie-cat :data-statut="saisieCatSource === 'manuel' ? 'sur' : saisieCatStatut" :title="saisieCatRaison"
                                  :class="['text-[10px] font-black px-2 py-0.5 rounded-full border', saisieCatSource === 'manuel' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : (saisieCatStatut === 'doute' ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-blue-50 text-blue-700 border-blue-200')]">
                                {{ saisieCatStatut === 'doute' && saisieCatSource !== 'manuel' ? '⚠️' : '🏷️' }} {{ getCategorieLabel(saisieForm.categorieId) || 'Misc' }}<span v-if="saisieCatSource" class="font-bold opacity-70"> · {{ SOURCES_CATEGORIE[saisieCatSource] || saisieCatSource }}</span><span v-if="saisieCatStatut === 'doute' && saisieCatSource !== 'manuel'" class="font-bold"> · à vérifier</span>
                            </span>
                            <span v-else-if="saisieForm.libelle && saisieCatStatut === 'inconnu'" data-saisie-cat-inconnue class="text-[10px] font-black px-2 py-0.5 rounded-full border bg-violet-50 text-violet-700 border-violet-200" title="Aucune règle ne connaît ce libellé">🤖 Inconnu des règles : l'IA proposera une catégorie</span>"""
sub('badge bureau', """                            <!-- v32.60 : la catégorie devinée dit d'où elle vient -->
                            <span v-if="saisieForm.categorieId"
                                  :title="saisieCatSource === 'historique' ? 'Déduit de vos saisies passées' : (saisieCatSource === 'alias' ? 'Déduit du vocabulaire courant' : (saisieCatSource === 'manuel' ? 'Choisi par vous' : 'Trouvé dans le nom de la catégorie'))"
                                  :class="['text-[10px] font-black px-2 py-0.5 rounded-full border', saisieCatSource === 'manuel' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-700 border-blue-200']">
                                🏷️ {{ getCategorieLabel(saisieForm.categorieId) || 'Misc' }}
                                <span v-if="saisieCatSource === 'historique'" class="font-bold opacity-60">· appris</span>
                                <span v-else-if="saisieCatSource === 'alias'" class="font-bold opacity-60">· deviné</span>
                                <span v-else-if="saisieCatSource === 'manuel'" class="font-bold opacity-60">· vous</span>
                            </span>""", """                            <!-- v37.49 : la catégorie proposée dit d'où elle vient, et si elle est sûre -->
                            """ + BADGE)
PUCES = """<div v-if="saisieForm.montant && saisieCatSource !== 'manuel' && saisieCatStatut !== 'sur' && saisieCatSuggestions.length" data-saisie-suggestions
                             class="flex flex-wrap items-center gap-1.5 mt-1.5">
                            <span class="text-[10px] font-bold" :class="saisieCatStatut === 'doute' ? 'text-amber-800' : 'text-gray-500'">{{ saisieCatStatut === 'doute' ? 'Doute — laquelle ?' : 'Catégorie ?' }}</span>
                            <button v-for="cid in saisieCatSuggestions" :key="'sug_' + cid" type="button" data-saisie-suggestion :data-cat="cid"
                                    @click="choisirCategorieSaisie(cid)"
                                    class="text-[10px] font-black px-2 py-0.5 rounded-full bg-gray-50 text-gray-700 border border-gray-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition-colors">
                                {{ getCategorieLabel(cid) }}
                            </button>"""
sub('puces bureau', """                        <div v-if="saisieForm.montant && !saisieForm.categorieId && saisieCatSuggestions.length"
                             class="flex flex-wrap items-center gap-1.5 mt-1.5">
                            <span class="text-[10px] font-bold text-gray-400">Catégorie ?</span>
                            <button v-for="cid in saisieCatSuggestions" :key="'sug_' + cid"
                                    @click="choisirCategorieSaisie(cid)"
                                    class="text-[10px] font-black px-2 py-0.5 rounded-full bg-gray-50 text-gray-600 border border-gray-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition-colors">
                                {{ getCategorieLabel(cid) }}
                            </button>""", """                        <!-- v37.49 : un doute ou rien de trouvé → les pistes, cliquables. Sans clic, la
                             transaction part « À catégoriser » (surlignée), la saisie n'est jamais bloquée. -->
                        """ + PUCES)
sub('select bureau', """                            <select v-model="saisieForm.categorieId"
                                    class="w-full px-2 py-2 border border-gray-200 rounded-lg text-xs font-bold outline-none focus:border-emerald-500 bg-gray-50">""",
"""                            <select v-model="saisieForm.categorieId" @change="choisirCategorieSaisie(saisieForm.categorieId)"
                                    class="w-full px-2 py-2 border border-gray-200 rounded-lg text-xs font-bold outline-none focus:border-emerald-500 bg-gray-50">""")
sub('select mobile', """                    <select v-model="saisieForm.categorieId" class="w-full px-3 py-3 border-2 border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-emerald-500 bg-gray-50">""",
"""                    <!-- v37.49 : la même étiquette que sur bureau, et les pistes en cas de doute -->
                    <div v-if="saisieForm.libelle && (saisieForm.categorieId || saisieCatStatut === 'inconnu')" data-saisie-etiquette-mobile class="flex flex-wrap items-center gap-1.5 -mt-1">
                        """ + BADGE + """
                    </div>
                    """ + PUCES.replace('mt-1.5', '-mt-1') + """
                    </div>
                    <select v-model="saisieForm.categorieId" @change="choisirCategorieSaisie(saisieForm.categorieId)" class="w-full px-3 py-3 border-2 border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-emerald-500 bg-gray-50">""")

OPTIONS = """<optgroup v-for="g in categoriesPourRanger" :key="g.label" :label="g.label">
                                                <option v-for="c in g.items" :key="c.id" :value="c.id">{{ c.label }}</option>
                                            </optgroup>"""
sub('panneau À catégoriser', """                    <div class="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                        <div class="px-4 md:px-6 py-3 md:py-4 border-b border-gray-100 bg-slate-50 flex items-center justify-between">
                            <h3 class="font-black uppercase tracking-widest text-gray-700 text-xs md:text-sm">📋 Journal</h3>""",
"""                    <!-- ═══ v37.49 : À CATÉGORISER — le doute et l'inconnu, surlignés, rangés en un clic ═══ -->
                    <div v-if="aCategoriser.length" data-a-categoriser class="bg-amber-50 rounded-2xl border-2 border-amber-300 shadow-sm overflow-hidden">
                        <div class="px-4 md:px-5 py-3 border-b border-amber-200 flex flex-wrap items-center gap-2">
                            <h3 class="font-black uppercase tracking-widest text-amber-900 text-xs md:text-sm">⚠️ À catégoriser ({{ aCategoriser.length }})</h3>
                            <span class="text-[10px] font-semibold text-amber-900">Un doute, ou rien de trouvé : un clic range la transaction, et votre choix devient une règle.</span>
                            <div class="ml-auto flex flex-wrap gap-1.5">
                                <button v-if="aCategoriser.some(l => l.sure)" type="button" data-appliquer-sures @click="appliquerSuggestionsSures()"
                                        class="text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-600 text-white hover:bg-emerald-700">✓ Appliquer les {{ aCategoriser.filter(l => l.sure).length }} suggestion(s) sûre(s)</button>
                                <button v-if="aCategoriser.some(l => !l.sure && l.source !== 'ia')" type="button" data-ia-tout @click="demanderIAPourTout()"
                                        class="text-[10px] font-black px-2.5 py-1 rounded-full bg-violet-600 text-white hover:bg-violet-700">🤖 Demander à l'IA</button>
                            </div>
                        </div>
                        <ul class="divide-y divide-amber-200">
                            <li v-for="l in aCategoriser" :key="'ac_' + l.id" data-a-categoriser-ligne :data-tx="l.id" class="px-4 md:px-5 py-2.5 flex flex-col md:flex-row md:items-center gap-2">
                                <div class="flex items-baseline gap-2 min-w-0 md:w-72 shrink-0">
                                    <span class="text-[10px] font-bold text-amber-900 tabular-nums shrink-0">{{ l.quand }}</span>
                                    <span class="text-sm font-bold text-gray-900 truncate">{{ l.libelle }}</span>
                                    <span class="text-xs font-black text-red-700 tabular-nums shrink-0">-{{ formatMAD(l.montant) }}</span>
                                </div>
                                <div class="flex-1 flex flex-wrap items-center gap-1.5">
                                    <span v-if="iaCategorisation.enCours[l.id]" data-ia-en-cours class="text-[10px] font-black text-violet-700">🤖 l'IA réfléchit…</span>
                                    <button v-for="cid in l.propositions" :key="'acp_' + l.id + '_' + cid" type="button" data-ranger :data-cat="cid" @click="rangerTransaction(l.id, cid)"
                                            :title="cid === l.actuelle ? ('Proposée' + (l.source === 'ia' ? ' par l’IA' + (l.iaRaison ? ' : ' + l.iaRaison : '') : '') + ' — cliquez pour confirmer') : (cid === l.sure ? 'Sûr d’après les règles : ' + l.regle.raison : 'Ranger ici')"
                                            :class="['text-[10px] font-black px-2 py-1 rounded-full border transition-colors', cid === l.actuelle || cid === l.sure ? 'bg-white text-amber-900 border-amber-400 ring-1 ring-amber-300 hover:bg-emerald-50 hover:text-emerald-800' : 'bg-white/70 text-gray-700 border-amber-200 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300']">
                                        {{ cid === l.actuelle || cid === l.sure ? '✓ ' : '' }}{{ getCategorieLabel(cid) }}<span v-if="cid === l.actuelle && l.source === 'ia'" class="opacity-70"> · IA</span><span v-else-if="cid === l.sure" class="opacity-70"> · sûr</span>
                                    </button>
                                    <select data-ranger-autre @change="rangerTransaction(l.id, $event.target.value)" class="text-[10px] font-bold px-1.5 py-1 rounded-full border border-amber-200 bg-white/70 text-gray-700 outline-none">
                                        <option value="">autre…</option>
                                        """ + OPTIONS.replace('\n                                                ', '\n                                            ').replace('\n                                            </optgroup>', '\n                                        </optgroup>') + """
                                    </select>
                                    <button v-if="!l.sure && !iaCategorisation.enCours[l.id]" type="button" data-ia-une @click="demanderCategorieIA(l.id)" class="text-[10px] font-bold text-violet-700 hover:underline">🤖 IA</button>
                                    <span v-if="iaCategorisation.messages[l.id]" data-ia-message class="text-[10px] font-semibold text-amber-900 w-full">{{ iaCategorisation.messages[l.id] }}</span>
                                </div>
                            </li>
                        </ul>
                    </div>

                    <div class="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                        <div class="px-4 md:px-6 py-3 md:py-4 border-b border-gray-100 bg-slate-50 flex items-center justify-between">
                            <h3 class="font-black uppercase tracking-widest text-gray-700 text-xs md:text-sm">📋 Journal</h3>""")
sub('journal : ligne surlignée', """                                    <tr v-for="tx in transactionsReellesTriees" :key="tx.id" class="border-b border-gray-100 hover:bg-emerald-50/40 transition-colors">
                                        <td class="p-2 md:p-3 font-bold text-gray-600 whitespace-nowrap text-[11px] tabular-nums">{{ (tx.datetime || tx.date || '').slice(0, 16).replace('T', ' ') }}</td>
                                        <td class="p-2 md:p-3 text-[11px] md:text-xs font-bold text-blue-700">{{ getCategorieLabel(tx.categorieId) || '(Hors)' }}</td>""",
"""                                    <tr v-for="tx in transactionsReellesTriees" :key="tx.id" :data-a-verifier="estACategoriser(tx) ? '1' : null"
                                        :class="['border-b border-gray-100 transition-colors', estACategoriser(tx) ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-emerald-50/40']">
                                        <td class="p-2 md:p-3 font-bold text-gray-600 whitespace-nowrap text-[11px] tabular-nums">{{ (tx.datetime || tx.date || '').slice(0, 16).replace('T', ' ') }}</td>
                                        <!-- v37.49 : un clic sur la catégorie la change (et le choix devient une règle) -->
                                        <td class="p-2 md:p-3 text-[11px] md:text-xs font-bold">
                                            <select v-if="editionCategorieTx === tx.id" data-journal-cat-select :value="tx.categorieId"
                                                    @change="rangerTransaction(tx.id, $event.target.value); editionCategorieTx = null" @blur="editionCategorieTx = null"
                                                    class="max-w-[12rem] text-[11px] font-bold px-1 py-0.5 border border-blue-300 rounded bg-white outline-none">
                                                """ + OPTIONS.replace('\n                                                ', '\n                                                    ').replace('\n                                            </optgroup>', '\n                                                </optgroup>') + """
                                            </select>
                                            <button v-else type="button" data-journal-cat :data-tx="tx.id" @click="editionCategorieTx = tx.id" title="Changer la catégorie"
                                                    :class="['text-left hover:underline decoration-dotted', estACategoriser(tx) ? 'text-amber-900' : 'text-blue-700']">
                                                <span v-if="estACategoriser(tx)">⚠️ </span>{{ tx.categorieId && tx.categorieId !== 'cat_misc' ? (getCategorieLabel(tx.categorieId) || '(Hors)') : 'À catégoriser' }}<span v-if="tx.categorieSource === 'ia'" class="text-[9px] font-black text-violet-700"> · IA</span>
                                            </button>
                                        </td>""")
sub('règles visibles', """                <!-- ─── Onglet CONTRÔLE ─── -->""", """                <!-- ─── Onglet CONTRÔLE ─── -->""")   # ancre unique (vérification)
sub('règles visibles (insertion)', """                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- ─── Onglet CONTRÔLE ─── -->""", """                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- v37.49 : les règles de catégorisation, visibles -->
                    <details data-regles-categorisation class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
                             :open="uiOuvert('saisie.regles', false)" @toggle="uiFixer('saisie.regles', $event.target.open)">
                        <summary class="px-4 md:px-6 py-3 cursor-pointer select-none font-black uppercase tracking-widest text-gray-700 text-xs md:text-sm">
                            📚 Règles de catégorisation <span data-regles-compte class="normal-case tracking-normal font-semibold text-gray-500">— {{ reglesCategorisation.nbMots }} mots (français, darija, enseignes), {{ reglesCategorisation.themes.length }} thèmes</span>
                        </summary>
                        <div class="px-4 md:px-6 pb-4 space-y-3 text-[11px]">
                            <p class="text-gray-600 leading-snug">Dans l'ordre : <b>vos corrections</b>, <b>vos libellés</b> (le mot tapé est une de vos lignes : samak, sqata…), <b>ce dictionnaire</b> — traduit vers vos libellés — puis vos saisies passées. Sûr : rangé. Un doute : rangé au plus probable et surligné « À catégoriser ». Rien : l'IA propose.</p>
                            <div v-if="reglesCategorisation.vous.length" data-regles-vous>
                                <p class="font-black text-gray-700 mb-1">✍️ Vos règles, apprises de vos choix</p>
                                <p class="text-gray-600 leading-relaxed"><span v-for="(r, k) in reglesCategorisation.vous" :key="'rv_' + k" class="inline-block mr-3">« {{ r.libelle }} » → <b>{{ r.vers }}</b></span></p>
                            </div>
                            <ul class="divide-y divide-gray-100">
                                <li v-for="t in reglesCategorisation.themes" :key="t.theme" data-regle-theme class="py-1.5">
                                    <span class="font-black text-gray-800">{{ t.theme }}</span>
                                    <span class="font-bold" :class="t.vers ? 'text-emerald-700' : 'text-gray-500'"> → {{ t.vers || 'aucune de vos catégories : l’IA décidera' }}</span>
                                    <p class="text-[10px] text-gray-500 leading-snug mt-0.5">{{ t.mots }}</p>
                                </li>
                            </ul>
                        </div>
                    </details>
                </div>

                <!-- ─── Onglet CONTRÔLE ─── -->""")

io.open(F, 'w', encoding='utf-8').write(src)
print('✔ index.html : catégorisation — règles hors-ligne, IA, À catégoriser')
