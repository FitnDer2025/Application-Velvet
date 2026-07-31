# Procédure de réponse aux demandes RGPD

## Canal

Le membre utilise en priorité le centre de confidentialité. Une adresse RGPD dédiée doit être publiée avant lancement pour les personnes ne pouvant plus accéder à leur compte.

## Étapes

1. **Réception** — créer une demande horodatée avec son type et ses précisions.
2. **Accusé de réception** — confirmer la réception et rappeler le délai indicatif.
3. **Vérification d’identité** — uniquement si nécessaire et de manière proportionnée ; ne jamais demander plus que ce qui est utile.
4. **Qualification** — accès, portabilité, rectification, effacement, limitation, opposition ou retrait de consentement.
5. **Gel ciblé** — empêcher une modification ou purge qui compromettrait la demande, sans étendre inutilement la conservation.
6. **Collecte** — rechercher les données dans Auth, base métier, stockage, e-mail, paiement, support, logs et sous-traitants.
7. **Analyse des tiers** — protéger les données d’autres personnes et les secrets de sécurité.
8. **Réponse** — fournir une réponse compréhensible et, pour l’accès/portabilité, un export sécurisé.
9. **Exécution** — corriger, limiter, supprimer ou enregistrer l’opposition selon la décision.
10. **Clôture** — inscrire la réponse, les actions, la date et le motif d’un éventuel refus.

## Délais

La date `due_at` est créée à un mois. Une prolongation ne peut être utilisée qu’avec un motif documenté, une nouvelle échéance et une information adressée à la personne avant l’expiration du délai initial.

## Effacement

L’effacement comprend : compte Auth, profils, préférences, médias, messages et pièces jointes selon les droits applicables, abonnements push, sessions, objets de stockage et données chez les sous-traitants. Les preuves de consentement, signalements, incidents, obligations comptables ou éléments nécessaires à la défense des droits sont séparés, pseudonymisés, restreints et conservés seulement pendant la durée validée.

## Export

L’export doit être généré côté serveur, chiffré, accessible via un lien court et à usage limité, puis supprimé automatiquement. Il doit contenir une notice expliquant les catégories, finalités, destinataires, sources, durées et droits.

## Contrôles

- revue quotidienne des demandes ouvertes ;
- alerte à J-7 et J-2 ;
- contrôle hebdomadaire `overdue_data_subject_requests` ;
- échantillonnage trimestriel des dossiers clos ;
- exercice annuel de demande d’accès et d’effacement complet.

## Responsabilités à nommer

- propriétaire du processus ;
- suppléant ;
- technicien export/purge ;
- valideur juridique ;
- canal d’escalade sécurité en cas d’usurpation ou de données d’un tiers.
