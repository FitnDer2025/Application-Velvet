# ADR-0042 — Invitation Zwit et ouverture guidée du Salon

- **Statut :** Accepté
- **Date :** 2026-07-22
- **Domaine :** Zwit Conversations

## Contexte

Zwit souhaite éviter les prises de contact pauvres, impersonnelles ou trop directes tout en conservant une expérience fluide et naturelle.

Une ouverture totalement libre favorise les messages génériques, les copier-coller et les sollicitations peu qualitatives. À l'inverse, une procédure trop rigide risquerait de casser la spontanéité.

## Décision

Zwit adopte une approche combinant **demande de contact préalable** et **conversation guidée après acceptation**.

### 1. Invitation Zwit

Avant l'ouverture d'un Salon Zwit complet, l'expéditeur envoie une invitation personnalisée comprenant :

- un message rédigé par l'utilisateur ;
- une intention facultative, par exemple : faire connaissance, échanger, proposer une sortie ou se retrouver à un événement ;
- éventuellement l'accès à une photo ou à un album explicitement sélectionné.

Le destinataire peut :

- accepter ;
- décliner discrètement ;
- consulter le profil ;
- demander l'ouverture d'un album ;
- répondre sans encore ouvrir un Salon complet.

Le Salon Zwit n'est créé qu'après acceptation.

### 2. Ouverture guidée du Salon

Après acceptation, la conversation devient libre.

Zwit Intelligence peut proposer des accroches et formulations basées sur :

- le profil ;
- les intentions compatibles ;
- les pratiques communes ;
- un événement partagé ;
- un élément précis de l'annonce ;
- les limites ou préférences rendues visibles.

L'IA ne doit jamais envoyer automatiquement un message à la place de l'utilisateur. Elle peut uniquement aider à formuler. L'utilisateur conserve toujours le contrôle final et déclenche lui-même l'envoi.

## Principes UX

- L'invitation doit rester courte, élégante et rapide à envoyer.
- L'utilisateur doit être encouragé à personnaliser son approche sans subir un formulaire lourd.
- Le refus doit pouvoir être discret et sans justification obligatoire.
- La création du Salon doit être perçue comme le début d'un espace partagé, et non comme une simple autorisation technique.

## Impacts Zwit Intelligence

- Génération d'idées d'accroche contextualisées.
- Détection des copier-coller répétitifs et des sollicitations génériques.
- Aide à la reformulation selon le ton souhaité.
- Aucun envoi automatique.

## Impacts techniques

- Création d'un objet `invitation` distinct d'une `conversation`.
- États minimum : `pending`, `accepted`, `declined`, `expired`, `withdrawn`.
- Le Salon et sa timeline ne sont créés qu'au passage à l'état `accepted`.
- Les médias joints à l'invitation doivent être explicitement autorisés et révocables selon les règles de consentement Velvet.

## Conséquences

Cette décision améliore la qualité des premiers contacts, réduit le bruit et protège l'authenticité des échanges sans empêcher la spontanéité.