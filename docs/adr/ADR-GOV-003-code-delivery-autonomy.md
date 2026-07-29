# ADR-GOV-003 — Autonomie de livraison Codex

Statut : **ACCEPTED**

Date : **2026-07-29**

## Contexte

Le fonctionnement courant de Velvet confie à Codex la production technique complète. Demander une validation intermédiaire pour chaque fusion ou déploiement ralentit inutilement les corrections et ne correspond pas au mode opératoire souhaité par le fondateur.

L'exécution de SQL sur Supabase constitue toutefois une action distincte : Cyril souhaite conserver personnellement l'application des scripts et migrations sur l'instance distante.

## Décision

Codex dispose d'une autonomie complète pour :

- créer et gérer les branches de travail ;
- implémenter et tester les changements ;
- committer et pousser le code ;
- ouvrir, mettre à jour et fusionner les pull requests ;
- construire, déployer et vérifier les environnements Velvet ;
- corriger de manière autonome les incidents de livraison dans le périmètre autorisé.

Aucune validation intermédiaire de Cyril n'est requise lorsque les contrôles pertinents sont verts et que le changement respecte les décisions produit, les règles de sécurité et le périmètre demandé.

## Exception Supabase SQL

Codex peut :

- concevoir les migrations et scripts SQL ;
- les versionner dans le dépôt ;
- les relire et les tester localement ;
- documenter leur ordre d'application et leurs contrôles.

Codex ne doit jamais exécuter ces scripts ou migrations sur l'instance Supabase distante. Cyril reste seul responsable de cette application.

Lorsqu'une livraison dépend d'un SQL non encore appliqué, Codex termine tout le travail indépendant, remet à Cyril le script exact et indique clairement que cette seule étape reste en attente.

## Garde-fous

- Les tests adaptés au changement doivent être exécutés avant fusion.
- Une erreur de test, une décision produit manquante, une permission insuffisante ou un risque destructif non prévu reste un motif d'arrêt.
- L'autonomie de livraison ne permet pas de contourner la confidentialité, le consentement, la sécurité ou les limites d'accès.
- Les changements et déploiements restent traçables par commits, pull requests et journaux techniques.

## Conséquences

- Les corrections et évolutions Velvet peuvent être livrées sans sollicitation répétitive.
- Cyril intervient uniquement lorsqu'un arbitrage produit réel est nécessaire ou pour appliquer un SQL Supabase.
- Les instructions antérieures imposant une validation humaine avant chaque fusion sont remplacées par cette ADR.
