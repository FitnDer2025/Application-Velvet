# ADR-AI-059 — Agents IA de test strictement internes

**Statut : ACCEPTED**  
**Date : 2026-08-01**  
**Décideur produit : Cyril GAY**  
**Domaines : Community, Admin & Trust, Platform Core, Zwit Intelligence**

## Contexte

La recette interne de Zwit exige des interactions réelles entre plusieurs profils pour vérifier la découverte, les visites de profil, les favoris, les réactions aux photos, les conversations, les notifications et les états de lecture. Une équipe humaine réduite ne permet pas de reproduire en continu la diversité des comportements nécessaires.

Cyril valide la création de profils fictifs pilotés par IA uniquement dans l’environnement interne de développement. Ces profils ne doivent jamais être visibles par des bêta-testeurs externes ni par des utilisateurs réels et doivent être supprimés avant toute ouverture externe.

## Décision

Zwit dispose d’agents IA de test qui utilisent les mêmes tables métier que les membres afin de produire une recette représentative, avec les limites suivantes :

1. Ils fonctionnent uniquement dans un environnement explicitement identifié comme `development`, `staging`, `preview`, `internal` ou `test`.
2. Le runtime exige en plus `VELVET_INTERNAL_TEST_AGENTS=enabled`.
3. L’environnement `production` est refusé dans le code, même si la variable d’activation est présente.
4. Les agents et leurs profils portent des marqueurs internes persistants, non exposés dans l’interface membre.
5. Seuls les comptes inscrits dans la liste blanche interne, les rôles Admin/Direction et les autres agents peuvent voir ces profils ou interagir avec eux.
6. Un agent ne peut consulter, favoriser, réagir ou écrire qu’à un profil appartenant à cette cohorte interne.
7. Les comptes fictifs ne sont jamais créés à partir de données personnelles de production.
8. Les visuels utilisés sont synthétiques ou correctement licenciés et représentent uniquement des adultes sans ambiguïté.
9. Les messages générés restent non explicites, respectueux du consentement et ne proposent aucun échange de coordonnées hors plateforme.
10. Toutes les actions sont traçables sans journaliser le contenu intime des conversations.

## Fonctionnalités couvertes

Les agents peuvent :

- consulter un profil interne ;
- ajouter un profil aux favoris ;
- enregistrer un ressenti privé ;
- réagir à une photo publique autorisée ;
- ouvrir une conversation directe ;
- répondre aux messages selon une personnalité et une cadence propres ;
- alimenter les notifications et les états de lecture via les mécanismes existants.

La première cohorte contient six personnalités contrastées : couples expérimentés ou débutants, femmes seules, homme seul prudent ou sociable, avec des fréquences et styles de réponse différents.

## Architecture

### Données

- `member_profiles.is_internal_test_agent`
- `internal_test_agent_settings`
- `internal_test_agent_viewers`
- `internal_test_agents`
- `internal_test_agent_conversation_state`
- `internal_test_agent_runs`

### Orchestration

- Une API Control permet de créer, activer, suspendre, relancer et supprimer les agents.
- Le worker existant exécute périodiquement les agents actifs.
- La génération IA utilise un modèle configuré par `VELVET_TEST_AGENT_MODEL` et une clé serveur. Une réponse de secours déterministe permet de tester les parcours sans fournisseur IA configuré.

### Sécurité

- RLS et fonction `can_view_profile` isolent les profils internes dans les deux sens.
- Un trigger empêche la création d’une conversation hors cohorte.
- Les RPC de création et de suppression sont réservées au `service_role`.
- Les contrôles Admin/Direction restent authentifiés avec la session Velvet.
- Aucune clé secrète n’est stockée dans le dépôt.

## Arrêt et suppression

Deux niveaux sont obligatoires :

1. **Kill switch** : `enabled=false` arrête immédiatement les prochaines actions.
2. **Cleanup** : supprime les conversations, interactions, profils, médias, objets de stockage et comptes Auth des agents.

Le contrôle de préparation à la publication `internal_test_agents_present` échoue tant qu’un profil marqué comme agent interne existe, y compris si l’agent est en pause ou retiré.

## Conséquences

### Positives

- Recette sociale possible sans mobiliser en permanence plusieurs personnes.
- Tests de notifications, réactions et conversations plus représentatifs.
- Personnalités reproductibles pour identifier les régressions.
- Nettoyage et blocage de publication intégrés au produit.

### Contraintes

- La migration Supabase doit être appliquée uniquement sur le projet interne ou staging.
- Le worker doit disposer de son accès PostgreSQL et des variables internes.
- Les réponses IA ont un coût variable lorsqu’un fournisseur est activé.
- Ces agents ne remplacent pas la recette humaine, notamment sur la qualité perçue, le consentement et les cas sociaux sensibles.

## Critères d’acceptation

- Un membre non autorisé ne voit aucun agent dans l’annuaire, la carte ou la messagerie.
- Un agent ne peut pas cibler un profil hors liste blanche.
- Le runtime refuse toujours `production`.
- L’arrêt global empêche tout nouveau traitement.
- Le nettoyage retire les profils et leurs objets de stockage.
- Le contrôle de publication échoue tant qu’un profil agent subsiste.
- Les tests unitaires couvrent l’activation d’environnement, le prompt, l’extraction de réponse et la cadence.
