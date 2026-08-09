# ADR VC-007 — Notification de capture d'écran

## Statut
Validé

## Décision
Lorsqu'une capture d'écran d'un Salon Zwit est détectable de manière fiable par la plateforme, les autres participants sont informés qu'une capture a été réalisée.

## Principes
- Notification informative et non accusatrice.
- Aucun blocage systématique de la capture.
- Aucune sanction automatique.
- Zwit ne prétend jamais détecter une capture lorsque la plateforme ne fournit pas cette information.
- Les limitations sont explicites selon iOS, Android et Web.

## Interface
Événement système dans le Salon :

> Une capture d'écran de cette conversation a été détectée.

Le nom de l'auteur n'est affiché que si la plateforme permet une attribution fiable et si cette capacité est validée juridiquement et techniquement.

## Exigences techniques
- Utiliser uniquement les API officielles de la plateforme.
- Ne pas employer de mécanisme de surveillance caché.
- Journaliser le type de signal et la plateforme à des fins d'audit, avec une durée de conservation minimale.
- Prévoir un feature flag par plateforme.
- Sur le Web, considérer la fonctionnalité comme non garantie.

## Critère d'acceptation
Aucune notification ne doit être générée sans signal système fiable.
