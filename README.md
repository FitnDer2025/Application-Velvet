# Zwit OS

Zwit OS est la source de vérité produit, UX, marque et technique de Velvet. Ce dépôt doit permettre à Cyril, ChatGPT et Codex de construire une plateforme premium avec un coût de développement maîtrisé, sans sacrifier la sécurité, le consentement ni la maintenabilité.

## Cap produit V1

Zwit est construit comme une double plateforme unifiée :

- **Community** : profils, découverte, albums, conversations, confiance et participation ;
- **Professionals** : établissements, organisateurs, événements, réservations, billetterie et pilotage ;
- **Admin & Trust** : vérification, modération, support, litiges et conformité ;
- **Platform Core** : identité, permissions, paiements, notifications, recherche, données et observabilité.

La production du code est **Codex-first**. Les décisions restent humaines, documentées et versionnées.

## Démarrage rapide pour CODEX

Lire dans cet ordre :

1. `AGENTS.md`
2. `CODEX.md`
3. `docs/00-GOVERNANCE/DECISION-REGISTRY.md`
4. `docs/00-GOVERNANCE/OPERATING-MODEL-CODEX-FIRST.md`
5. `PROJECT_CONTEXT.md`
6. `docs/02-PRODUCT/FEATURE-MAP.md`
7. `docs/02-PRODUCT/PRODUCT_BIBLE.md`
8. `docs/02-PRODUCT/V1-DUAL-PLATFORM-SCOPE.md`
9. `docs/01-BRAND/IMPLEMENTATION-GUIDE.md` pour toute tâche UI
10. `docs/01-BRAND/DESIGN-TOKENS.json` pour les valeurs visuelles
11. `docs/10-TECH/V1-DELIVERY-BLUEPRINT.md`
12. `docs/10-TECH/TARGET-ARCHITECTURE-V1.md`
13. `docs/11-ROADMAP/V1-SCOPE-AND-ACCEPTANCE.md`
14. `docs/11-ROADMAP/CODEX-FIRST-DELIVERY-PLAN.md`
15. Les ADR du module concerné

## Réflexe obligatoire

Avant toute nouvelle question produit ou modification fonctionnelle, vérifier le registre des décisions et les ADR. Un sujet déjà validé ne doit pas être rouvert sans ADR d’amendement.

Avant tout code, identifier :

- le besoin utilisateur ou professionnel ;
- les règles métier ;
- les données et permissions ;
- les critères d’acceptation ;
- les risques de confidentialité et consentement ;
- les tests nécessaires.

## Hiérarchie documentaire

1. `docs/00-GOVERNANCE/` — règles de décision, registre et modèle opératoire
2. `docs/00-VISION/` — vision et principes fondateurs
3. `docs/01-BRAND/` — identité, tokens et ton
4. `docs/02-PRODUCT/` — Product Bible, carte fonctionnelle et périmètre V1
5. `docs/03-ADR/` — décisions transverses
6. `docs/04-VELVET-CONVERSATIONS/` — décisions du chantier Conversations
7. `docs/04-FEATURES/` — spécifications par fonctionnalité
8. `docs/05-UX/` — parcours et règles d’interface
9. `docs/06-AI/` — Zwit Intelligence et Zwit Memory
10. `docs/07-PROFESSIONALS/` — espace professionnel
11. `docs/08-EVENTS/` — événements, sorties et voyages
12. `docs/09-BUSINESS/` — modèle économique
13. `docs/10-TECH/` — architecture et livraison
14. `docs/11-ROADMAP/` — versions, priorités et critères d’acceptation
15. `docs/12-FOUNDER-NOTES/` — notes non normatives
16. `docs/13-HISTORY/` — historique du projet

## Identité Zwit canonique

- Logo : V ruban bordeaux/rose, logotype or champagne.
- Signature : « Là où les plus belles rencontres commencent. »
- Couleurs principales : Noir Zwit `#0D0D0D`, Anthracite `#1B1B1D`, Gris Velours `#2D2D30`, Blanc cassé `#F4F4F2`, Bordeaux Zwit `#641B36`, Or Champagne `#C6A96A`.
- Direction : sombre, cinématographique, élégante, intime, inclusive et jamais vulgaire.

## Règles de vérité

- Une décision explicitement validée est normative.
- Une proposition non validée est marquée `TBD` et ne doit pas être codée comme une règle définitive.
- Une décision validée produit un ADR et un commit Git dédié.
- En cas de conflit, l’ADR le plus récent remplace l’ancien.
- Codex ne doit pas inventer une règle métier manquante : il crée un point `TBD` ou une issue.
- Toute action sensible respecte la confidentialité par défaut, le consentement et le moindre privilège.
- Codex dispose d'une autonomie complète de livraison : branche, commits, pull request, fusion et déploiement après réussite des contrôles.
- Les scripts et migrations SQL Supabase peuvent être préparés et testés par Codex, mais leur exécution distante reste exclusivement réalisée par Cyril.

## État actuel

Le dépôt contient le socle documentaire de Zwit, les décisions détaillées du chantier Zwit Conversations, les principes de marque, les profils dynamiques, le Pacte Zwit, le Trust Index, les notifications confidentielles et désormais la fondation Codex-first de la V1 double plateforme Community + Professionals.

La prochaine étape est de transformer cette fondation en backlog exécutable, puis en tranches verticales testables conformément au plan de livraison.
