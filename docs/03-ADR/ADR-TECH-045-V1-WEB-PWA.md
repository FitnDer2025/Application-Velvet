# ADR-TECH-045 — Zwit V1 en application web responsive installable (PWA)

- **Statut :** Acceptée
- **Date :** 2026-07-23
- **Décideur :** Cyril GAY
- **Domaine :** Architecture technique / Distribution V1

## Contexte

Zwit doit livrer une V1 unifiée comprenant l'environnement communautaire et l'espace professionnel, avec une équipe extrêmement réduite reposant sur Cyril, ChatGPT et Codex. Le choix de distribution doit limiter le coût, accélérer les itérations et conserver une expérience mobile convaincante.

Trois options ont été étudiées :

1. application web responsive uniquement ;
2. application web responsive installable en PWA ;
3. application web accompagnée immédiatement d'applications iOS et Android natives.

## Décision

La V1 de Zwit sera une **application web responsive mobile-first, installable en Progressive Web App (PWA)**.

Les applications natives iOS et Android ne font pas partie du périmètre V1.

## Conséquences attendues

- une base de code principale pour ordinateur, tablette et mobile ;
- installation depuis un navigateur compatible ;
- manifeste d'application, icônes et comportement standalone ;
- stratégie de cache contrôlée et page hors connexion minimale ;
- notifications push activées uniquement sur les navigateurs et systèmes réellement compatibles ;
- aucun écran ne doit prétendre offrir une capacité indisponible sur la plateforme utilisée ;
- architecture préparée pour permettre ultérieurement une application native ou un emballage natif sans l'imposer à la V1.

## Contraintes d'implémentation

- approche mobile-first et responsive ;
- HTTPS obligatoire hors environnement local ;
- service worker versionné et révocable ;
- aucune donnée intime ou média privé mis en cache hors politique explicite ;
- les médias sensibles doivent utiliser des accès sécurisés et temporaires ;
- les notifications doivent respecter les modes Standard, Discret et Invisible ;
- l'installation PWA reste facultative et ne bloque jamais l'usage web ;
- les parcours critiques doivent être testés au minimum sur Chrome Android, Safari iOS et un navigateur desktop moderne.

## Hors périmètre V1

- publication sur l'App Store ;
- publication sur Google Play ;
- fonctionnalités exclusivement natives ;
- géolocalisation permanente en arrière-plan ;
- stockage local de médias privés pour consultation hors ligne.

## Critères d'acceptation

- Zwit est entièrement utilisable dans un navigateur mobile et desktop ;
- l'application peut être installée sur les plateformes PWA compatibles ;
- le mode standalone conserve navigation, authentification et retour sécurisé ;
- aucune donnée sensible n'est exposée dans le cache applicatif ;
- les limitations de notifications ou d'installation sont communiquées honnêtement ;
- les tests end-to-end couvrent au moins un parcours critique en mode navigateur et en mode installé.

## Justification

Cette décision offre le meilleur équilibre entre qualité d'expérience, vitesse d'exécution, maîtrise du développement par Codex et limitation du capital engagé. Elle permet de valider Zwit avant de financer deux applications natives distinctes.
