# ADR VC-006 — Statuts des invitations et des messages

## Statut
Validé

## Invitations Zwit
États visibles :
- `sent` — Envoyée
- `viewed` — Consultée
- `accepted` — Acceptée
- `declined` — Refusée
- `expired` — Expirée

Aucune heure précise de consultation n'est affichée.

## Messages d'un Salon Zwit
États visibles :
- `sent` — Envoyé
- `delivered` — Distribué
- `read` — Lu

Aucune heure précise de lecture n'est affichée.

## Confidentialité et réciprocité
Chaque membre peut désactiver le partage de ses statuts de lecture.

Règle de réciprocité : un membre qui masque ses propres statuts de lecture ne peut plus consulter ceux des autres.

## Règles d'interface
- Les statuts restent visuellement sobres.
- Aucun rappel ou mécanisme de pression n'est déclenché après lecture.
- Le statut d'une conversation collective doit refléter les lectures par participant sans exposer d'horodatage précis.

## Exigences techniques
- Les changements d'état doivent être idempotents.
- `read` ne peut être enregistré qu'après `delivered`.
- Les préférences de confidentialité s'appliquent côté serveur, pas uniquement dans l'interface.
