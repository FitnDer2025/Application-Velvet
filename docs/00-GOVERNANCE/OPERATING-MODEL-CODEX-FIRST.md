# Operating Model — Velvet Codex-first

Statut : **ACCEPTED**

## Décision fondatrice

Velvet est construit avec une équipe volontairement réduite :

- Cyril pilote la vision, les arbitrages, les partenariats et la validation finale ;
- ChatGPT structure le produit, les règles métier, l’UX, l’architecture documentaire et les critères d’acceptation ;
- Codex produit, teste, documente et maintient le code dans GitHub.

L’objectif n’est pas de supprimer le contrôle humain, mais de réduire radicalement les coûts de production tout en conservant une discipline de développement professionnelle.

## Règles non négociables

1. Aucun développement sans besoin, règle métier et critères d’acceptation documentés.
2. Codex ne décide jamais seul d’une règle produit, juridique, de consentement ou de monétisation.
3. Toute tâche doit respecter les ADR existantes et signaler les conflits avant modification.
4. Chaque changement passe par une branche dédiée, des tests, une revue et une documentation mise à jour.
5. Une fonctionnalité sensible doit être conçue selon : confidentialité par défaut, moindre privilège, traçabilité et consentement explicite.
6. La vitesse ne justifie jamais une dette technique invisible.

## Autonomie de livraison

Codex conduit de bout en bout l'exécution technique des demandes Velvet :

- création de branche ;
- implémentation et tests ;
- commits et publication ;
- ouverture et fusion des pull requests ;
- déploiement et contrôle de la version servie.

Ces actions ne nécessitent pas de validation intermédiaire de Cyril lorsque les contrôles sont verts et que le changement respecte les décisions déjà validées.

La seule frontière opérationnelle permanente concerne Supabase : Codex prépare, documente et teste les scripts ou migrations SQL, mais ne les applique jamais sur l'instance distante. Cyril réalise lui-même cette exécution.

## Organisation des domaines

Velvet repose sur quatre domaines indépendants mais cohérents :

- **Community** : profils, découverte, albums, conversations, confiance et interactions.
- **Professionals** : établissements, organisateurs, événements, réservations, billetterie et CRM.
- **Admin & Trust** : modération, vérification, support, litiges, conformité et supervision.
- **Platform Core** : identité, permissions, paiements, notifications, recherche, données et observabilité.

## Cycle obligatoire d’une fonctionnalité

1. Problème utilisateur.
2. Décision produit ou ADR.
3. User stories et cas limites.
4. Parcours UX et états d’interface.
5. Modèle de données et permissions.
6. Contrat API.
7. Plan de tests.
8. Implémentation Codex.
9. Revue fonctionnelle et technique.
10. Mise à jour du changelog et de la documentation.

## Définition de terminé

Une fonctionnalité n’est terminée que si :

- les critères d’acceptation sont satisfaits ;
- les tests automatisés pertinents passent ;
- les états vide, chargement, erreur, refus et succès existent ;
- les permissions ont été vérifiées ;
- les données sensibles ne sont jamais exposées par défaut ;
- la documentation technique et produit est à jour ;
- aucun `TBD` bloquant n’est masqué dans le code.

## Gouvernance des coûts

Le coût de développement est maîtrisé par :

- une application web responsive avant toute application native ;
- des services managés plutôt que des infrastructures sur mesure ;
- une architecture modulaire ;
- une livraison incrémentale ;
- l’interdiction des optimisations prématurées ;
- la mesure systématique de l’usage avant élargissement du périmètre.

## Principe de prudence

Codex peut accélérer fortement la production, mais ne remplace pas :

- l’audit de sécurité externe avant ouverture publique ;
- la validation juridique et RGPD ;
- les tests avec de vrais membres et professionnels ;
- la décision humaine sur les sujets de confiance, consentement et exclusion.
