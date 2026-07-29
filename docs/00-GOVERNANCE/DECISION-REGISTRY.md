# Registre des décisions Velvet

**Objectif :** empêcher la réouverture involontaire de sujets déjà arbitrés et orienter rapidement l'équipe vers les sources normatives.

## Règles

- Toute décision explicitement validée est considérée comme acquise.
- Une nouvelle proposition ne remplace une décision existante qu'avec un nouvel ADR indiquant clairement ce qu'elle modifie.
- Ce registre est un index ; l'ADR reste la source normative.
- Avant toute nouvelle question produit, consulter ce registre, `ADR-STATUS.md`, puis les ADR.
- Chaque ADR acceptée doit être documentée, répercutée dans la roadmap, les métriques et le changelog, puis commitée.

## Décisions validées — synthèse

### Marque et interface

- Identité sombre, cinématographique et premium.
- Logo officiel : V ruban bordeaux/rose, logotype or champagne.
- Architecture visuelle hybride entre espaces publics ouverts et espaces privés intimes.
- Photographie centrée sur les personnes ; albums traités comme des galeries artistiques.
- Animations pragmatiques ; fluidité prioritaire.

### Comptes, identité et profils

- Trois types de comptes : Membre, Organisateur privé, Professionnel.
- Vérification d'identité et de majorité obligatoire avant accès complet.
- Identité civile privée ; pseudonyme comme identité publique.
- Nom d'affichage libre et `@username` unique et stable.
- Profils Couple dynamiques avec identité commune et partenaires activables individuellement.

### Modération, activité et confidentialité

- Modération hybride avec première vérification par IA et revue humaine des cas sensibles.
- Aucun affichage public de dernière connexion exacte.
- Velvet Activity Index synthétique, Mode Absence et tendance de réactivité.
- Notifications push configurables et modes Standard, Discret et Invisible.

### Conversations, consentement et confiance

- Cycle produit : Découverte → Conversation → Confiance → Expériences → Souvenirs → Relation durable.
- Invitation Velvet obligatoire avant création du Salon.
- Pacte Velvet personnel et contextuel par Salon.
- Velvet Trust Index multifacteur sans score public de popularité.

### Recherche et découverte — ADR-024 à ADR-036

- Découverte hybride : recommandations, recherche manuelle et filtres avancés ; swipe facultatif.
- Recommandations explicables, dynamiques et personnalisables.
- Apprentissage comportemental désactivable.
- Compatibilité réciproque plutôt qu'attractivité unilatérale.
- Qualité avant quantité dans le flux initial.
- Carte premium avec clustering, filtres, localisation approximative et mode invisible.
- Velvet Alchemy Index qualitatif, sans pourcentage.
- État d'esprit temporaire du membre intégré au contexte.
- Cercle de confiance privé.
- Réputation de sécurité strictement invisible.
- Carnet de Souvenirs partagé uniquement avec consentement unanime.
- Événements intelligents avec préparation, check-in et suivi post-événement.
- Présence confirmable par QR, géolocalisation ponctuelle consentie, organisateur ou communauté validée.

### Professionnels et voyages — ADR-038 à ADR-041

- Assistant IA dédié aux organisateurs avant, pendant et après les événements.
- CRM métier modulaire avec socle commun et extensions par profession.
- IA métier personnalisée à partir des contenus validés du professionnel.
- Velvet Trips comme espace communautaire avant, pendant et après un voyage.
- Les professionnels n'accèdent jamais à la recherche privée des profils ni aux données non autorisées.

### Monétisation

- Le modèle freemium, les essais, promotions, codes administrateur et mécanismes de parrainage ont déjà été arbitrés.
- ADR-042 n'a pas été créée afin de ne pas rouvrir ce sujet.

### Gamification — ADR-043 et ADR-044

- Gamification positive centrée sur la confiance, la qualité et la participation utile.
- Aucun classement public, score de popularité ou récompense fondée sur le volume de matchs et messages.
- Distinctions évolutives racontant le parcours du membre sans niveaux compétitifs.
- Aucun système Bronze, Argent, Or ou Diamant.
- Les distinctions ne remplacent jamais la modération ni les indicateurs internes de sécurité.

### Distribution technique V1 — ADR-TECH-045

- Velvet V1 est une application web responsive mobile-first installable en PWA.
- Les applications natives iOS et Android sont exclues du périmètre V1.
- L'installation reste facultative et l'usage complet doit rester possible depuis un navigateur.
- Les limitations propres aux navigateurs et systèmes doivent être affichées honnêtement.
- Aucune donnée intime ni média privé ne doit être mis en cache sans politique explicite.

### Gouvernance et pilotage

- Une seule question produit structurante à la fois.
- Une ADR acceptée est définitive sauf amendement explicite.
- `PROJECT-ROADMAP.md` est la source officielle de l'état du projet.
- `PRODUCT-METRICS.md` porte les estimations d'avancement.
- `CHANGELOG-PRODUCT.md` conserve l'historique daté.
- `ADR-STATUS.md` permet de vérifier rapidement les sujets déjà couverts.
- Codex livre de manière autonome les changements Velvet jusqu'à leur fusion et leur déploiement.
- Cyril conserve exclusivement l'exécution distante des scripts et migrations SQL Supabase.

## ADR récentes

- `ADR-DA-020` : modération hybride IA puis humain.
- `ADR-DA-021` : pseudonymes et identifiants publics.
- `ADR-DA-022` : vérification obligatoire de l'identité et de la majorité.
- `ADR-DA-023` : Velvet Activity Index.
- `ADR-DA-024-036` : découverte intelligente, alchimie, confiance, souvenirs et événements.
- `ADR-PRO-038-041` : IA organisateur, CRM métier, IA professionnelle et voyages.
- `ADR-GAM-043-044` : gamification positive et distinctions évolutives.
- `ADR-TECH-045` : application web responsive installable en PWA pour la V1.
- `ADR-GOV-001` : documentation et commit immédiats après acceptation.
- `ADR-GOV-002` : pilotage continu par roadmap, métriques et changelog.
- `ADR-GOV-003` : autonomie complète de livraison Codex, avec exécution SQL Supabase réservée à Cyril.

## Numéros non créés

- `ADR-037` : proposition abandonnée car le sujet professionnel était déjà arbitré.
- `ADR-042` : proposition abandonnée car la monétisation était déjà arbitrée.

## Entretien

Une évolution structurante sans mise à jour des documents de pilotage est incomplète.
