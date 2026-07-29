# Instructions de développement pour CODEX

## Mission

Construire Velvet à partir de la documentation versionnée dans ce dépôt, sans remplacer une décision produit par une supposition technique. Velvet doit rester élégant, confidentiel, inclusif, sûr et simple à utiliser.

La V1 est une **double plateforme cohérente** :

- un domaine **Community** pour les membres ;
- un domaine **Professionals** pour les établissements, organisateurs et événements ;
- un domaine **Admin & Trust** commun ;
- un **Platform Core** partagé.

Codex est le moteur principal de production du code, mais ne prend jamais seul une décision produit, juridique, de consentement, de sécurité ou de monétisation.

## Lecture obligatoire avant une tâche

1. `AGENTS.md`
2. `docs/00-GOVERNANCE/DECISION-REGISTRY.md`
3. `docs/00-GOVERNANCE/OPERATING-MODEL-CODEX-FIRST.md`
4. `docs/02-PRODUCT/FEATURE-MAP.md`
5. `docs/02-PRODUCT/V1-DUAL-PLATFORM-SCOPE.md`
6. `docs/01-BRAND/IMPLEMENTATION-GUIDE.md` pour toute tâche UI
7. `docs/01-BRAND/DESIGN-TOKENS.json` pour toute valeur visuelle
8. Les ADR et spécifications du domaine concerné
9. `docs/10-TECH/V1-DELIVERY-BLUEPRINT.md`
10. `docs/10-TECH/TARGET-ARCHITECTURE-V1.md`
11. `docs/11-ROADMAP/V1-SCOPE-AND-ACCEPTANCE.md`
12. `docs/11-ROADMAP/CODEX-FIRST-DELIVERY-PLAN.md`

## Source de vérité

Ordre de priorité :

1. ADR validé le plus récent
2. Registre des décisions
3. Product Bible
4. Spécifications UX et fonctionnelles
5. Périmètre V1 double plateforme
6. Design system et tokens
7. Blueprint et architecture technique V1
8. Roadmap et critères d'acceptation
9. Notes fondateur, uniquement comme contexte

## Contrôle anti-régression produit

Avant de proposer une question, une règle ou une fonctionnalité :

- rechercher ses mots-clés dans le registre des décisions ;
- rechercher dans les ADR ;
- vérifier qu'elle n'a pas déjà été validée sous un autre nom ;
- traiter une idée compatible comme une extension, pas comme un nouvel arbitrage ;
- rédiger un ADR d'amendement lorsqu'elle contredit une décision existante.

Ne jamais rouvrir silencieusement un sujet validé.

## Règles impératives

- Ne jamais inventer une règle métier manquante.
- Marquer tout manque par `TBD` et créer une issue si cela bloque.
- Ne pas modifier un comportement validé sans nouvel ADR.
- Préserver la confidentialité par défaut et appliquer le principe du moindre privilège.
- Implémenter les contrôles de consentement côté serveur.
- Ne jamais simuler une capacité indisponible sur une plateforme.
- Toute action sensible doit être traçable et testable.
- Ne jamais committer de secret, média intime réel ou donnée personnelle de production.
- Les données de démonstration doivent être manifestement fictives.
- Ne jamais exposer les données Community à un professionnel au-delà du strict besoin opérationnel documenté.
- Ne jamais mélanger les privilèges Member, Professional, Staff et Admin.
- Livrer de manière autonome les changements validés par les tests : branche, commits, pull request, fusion et déploiement ne nécessitent pas de validation intermédiaire de Cyril.
- Ne jamais exécuter de script ou migration SQL sur l'instance Supabase distante ; les préparer, les tester et les remettre à Cyril pour application.

## Fidélité visuelle

- Utiliser les tokens canoniques, jamais des couleurs approximatives.
- Logo : V ruban bordeaux/rose, VELVET en or champagne.
- Ne pas générer un V doré générique.
- Respecter les espaces publics plus ouverts et les espaces privés plus profonds.
- Éviter toute imagerie vulgaire, explicite ou stéréotypée.
- Prioriser la lisibilité, les visages, la complicité et les photographies raffinées.
- Toute maquette doit montrer les états de chargement, vide, erreur, désactivé et succès lorsque pertinent.

## Workflow attendu

1. Lire les sources obligatoires.
2. Résumer les décisions applicables dans le plan de travail.
3. Produire un plan d'implémentation court et vérifiable.
4. Identifier données, permissions, migrations, API et événements analytics concernés.
5. Identifier explicitement les impacts Community, Professionals, Admin et Platform Core.
6. Créer ou mettre à jour les tests avant la livraison.
7. Implémenter une tranche verticale utilisable, pas une collection de fichiers isolés.
8. Vérifier les critères d'acceptation et les cas limites.
9. Documenter toute nouvelle variable d'environnement, migration ou limitation.
10. Mettre à jour la documentation et le registre lorsqu'une décision évolue.
11. Ouvrir une pull request avec risques, tests exécutés, captures si UI et plan de retour arrière.
12. Fusionner et déployer de manière autonome lorsque les contrôles sont verts.
13. Lorsqu'un SQL Supabase est requis, arrêter uniquement son exécution distante et remettre à Cyril le script exact avec son ordre d'application.

## Qualité minimale

- Typage strict.
- Validation des entrées côté client et serveur.
- Gestion explicite des erreurs.
- Tests unitaires sur les règles métier.
- Tests d'intégration sur authentification, consentement, invitations, conversations, permissions, médias, réservations et paiements.
- Tests end-to-end sur les parcours critiques V1.
- Journalisation structurée sans données intimes en clair.
- Accessibilité et responsive mobile-first.
- Sécurité des téléchargements et des URLs signées.
- Idempotence des actions critiques lorsque nécessaire.
- Row Level Security et tests négatifs d'autorisation.
- Migrations reproductibles et jeu de données fictif.

## Definition of Done

Une fonctionnalité n'est terminée que si :

- le code est testé ;
- les états vide, chargement, erreur, refus et succès existent ;
- les permissions serveur sont vérifiées ;
- les tests négatifs prouvent qu'un autre rôle ne peut pas accéder aux données ;
- les événements analytics nécessaires sont documentés ;
- les textes sensibles respectent le ton Velvet ;
- les critères d'acceptation sont couverts ;
- l'accessibilité de base est vérifiée ;
- aucune donnée intime n'apparaît dans les logs ou notifications ;
- la documentation est mise à jour ;
- le changement est réversible ou son plan de migration est documenté.

## Modules déjà normés

Le chantier `Velvet Conversations` dispose d'ADR détaillés dans `docs/04-VELVET-CONVERSATIONS/`. Les décisions de marque, profils, consentement, confiance, découverte, professionnels et notifications sont indexées dans le registre.

## Arbitrages

En cas de contradiction ou d'ambiguïté, ne pas choisir silencieusement. Documenter le conflit, identifier les documents concernés et demander un arbitrage produit.
