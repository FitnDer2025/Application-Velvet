# AGENTS.md — Contrat d'exécution Velvet

Ce fichier s'applique à l'ensemble du dépôt.

## Mission

Construire Velvet comme un réseau social premium français dédié aux rencontres libres, en respectant strictement les décisions produit, l'identité visuelle et les règles de sécurité documentées.

## Avant toute modification

1. Lire `README.md` puis `CODEX.md`.
2. Lire `docs/00-GOVERNANCE/DECISION-REGISTRY.md`.
3. Lire `docs/02-PRODUCT/FEATURE-MAP.md`.
4. Lire les ADR et spécifications du module concerné.
5. Vérifier qu'aucune décision existante ne traite déjà le sujet.

## Hiérarchie de vérité

1. ADR validé le plus récent.
2. Registre des décisions.
3. Product Bible et spécifications fonctionnelles.
4. Design system et tokens.
5. Blueprint technique et roadmap.
6. Notes fondateur, uniquement comme contexte.

En cas de contradiction, ne pas arbitrer silencieusement. Documenter le conflit avec `TBD-PRODUCT` et ouvrir une issue.

## Interdictions

- Ne pas inventer de règle métier.
- Ne pas remplacer les couleurs, le logo ou le ton Velvet par un style générique.
- Ne pas introduire de cliché visuel libertin, de nudité explicite ou d'imagerie vulgaire dans l'interface.
- Ne pas exposer de données intimes dans les logs, analytics, notifications ou erreurs.
- Ne pas contourner les permissions, le consentement ou la confidentialité côté serveur.
- Ne pas considérer une maquette comme une décision si elle contredit un ADR.

## Exigences UI

- Mobile-first.
- Interface sombre, cinématographique, élégante et lisible.
- Utiliser exclusivement les tokens de `docs/01-BRAND/DESIGN-TOKENS.json`.
- Les composants doivent couvrir les états : default, hover/focus, pressed, disabled, loading, empty, error.
- Les animations restent discrètes et utiles ; la fluidité prime sur l'effet.
- Le logo officiel est le V ruban bordeaux/rose avec le mot VELVET en or champagne.

## Exigences produit

- Personne d'abord, pratique ensuite.
- Confidentialité par défaut.
- Consentement explicite et révocable.
- Aucun classement social agressif ni gamification humiliante.
- Les profils Couple peuvent représenter trois identités liées : Couple et partenaires individuels activables.
- Les notifications doivent respecter les modes Standard, Discret et Invisible.
- La vidéo de présentation reste facultative.
- Les contenus épinglés sont contrôlés par le membre.

## Definition of Done

Une modification n'est livrable que si :

- les critères d'acceptation sont couverts ;
- les permissions serveur sont testées ;
- les états UX complets existent ;
- les tests pertinents passent ;
- les textes respectent le ton Velvet ;
- aucun secret ni donnée sensible n'est ajouté ;
- la documentation et le registre des décisions sont à jour.

## Format attendu des changements

- Une intention cohérente par commit.
- Messages Conventional Commits.
- Toute nouvelle décision produit nécessite un ADR dédié.
- Toute inconnue non bloquante est marquée `TBD` ; toute inconnue bloquante devient une issue.

## Autonomie de livraison

- Codex peut créer les branches, committer, pousser, ouvrir et fusionner les pull requests, puis déployer les environnements Velvet sans demander une validation intermédiaire à Cyril.
- Cette autonomie s'applique uniquement après réussite des contrôles pertinents et dans le respect des ADR, de la sécurité et du périmètre demandé.
- Codex peut préparer, versionner et tester les scripts ou migrations SQL Supabase, mais ne doit jamais les exécuter sur l'instance Supabase distante.
- Toute action SQL Supabase à appliquer est remise clairement à Cyril, qui reste seul responsable de son exécution.
