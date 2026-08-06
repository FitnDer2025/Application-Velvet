# ADR VC-005 — Aucune relance d'Invitation Zwit

## Statut
Validé

## Décision
Une Invitation Zwit ne peut faire l'objet d'aucune relance.

Le silence est considéré comme une absence de consentement à poursuivre l'échange et doit être respecté.

## Cycle de vie
- `sent` — invitation envoyée
- `viewed` — invitation consultée
- `accepted` — invitation acceptée et Salon Zwit créé
- `declined` — invitation refusée
- `expired` — invitation expirée

## Règles produit
- Aucun bouton de relance.
- Aucun message complémentaire tant que l'invitation n'est pas acceptée.
- Aucun envoi automatique par Zwit Intelligence.
- Une invitation refusée ou expirée est clôturée.
- La durée d'expiration reste configurable et sera définie avant mise en production.

## Conséquences techniques
- Une seule invitation active par relation potentielle et par contexte.
- L'API refuse tout second message associé à une invitation non acceptée.
- Les notifications ne doivent jamais rappeler au destinataire qu'il n'a pas répondu.
