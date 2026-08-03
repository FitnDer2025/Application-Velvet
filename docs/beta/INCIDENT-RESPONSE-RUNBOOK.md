# Réponse aux incidents V1.1

## Déclenchement

Ouvrir un incident pour toute fuite ou suspicion de fuite, contournement RLS, clé exposée, accès anormal à un média, compte compromis, perte de données, indisponibilité prolongée ou échec de restauration.

Le responsable d’incident est désigné nominativement avant la bêta externe. Une personne distincte consigne la chronologie. Les canaux opérationnels ne doivent jamais contenir pièce d’identité, contenu intime, jeton, cookie, mot de passe, URL signée ou dump.

## Chaîne de traitement

1. **Détecter et dater** — heure UTC, environnement, symptôme, source et périmètre supposé.
2. **Contenir** — fermer la fonction touchée, révoquer les sessions ou secrets concernés, préserver les journaux et éviter toute destruction de preuve.
3. **Qualifier** — données, personnes, durée, cause probable, possibilité d’exfiltration et impact sur la sécurité physique ou la vie privée.
4. **Éradiquer** — corriger sur une branche dédiée, ajouter un test de non-régression, faire relire le changement sensible.
5. **Restaurer** — reprendre par étapes, surveiller les erreurs et vérifier les contrôles RLS et médias.
6. **Décider les notifications** — appliquer les délais et critères réglementaires en vigueur après validation du responsable RGPD/conseil ; conserver la preuve de la décision, y compris si aucune notification n’est requise.
7. **Clore** — analyse de cause, actions, responsables, échéances et exercice de suivi.

## Premières actions par scénario

| Scénario | Contention immédiate |
|---|---|
| Secret serveur exposé | Révoquer/faire tourner le secret, rechercher son usage, redéployer |
| Contournement RLS | Fermer la route ou mettre le service en maintenance, conserver les requêtes |
| Média privé accessible | Révoquer les URL/sessions, fermer le bucket ou la route concernée |
| Compte compromis | Révoquer les sessions, imposer la récupération, contrôler les actions sensibles |
| Perte/corruption | Geler les écritures concernées, sauvegarder l’état, restaurer uniquement en recette avant décision |
| Fournisseur compromis | Désactiver l’intégration et ses callbacks, révoquer les secrets, borner les données échangées |

## Registre minimal

Identifiant, dates UTC, déclarant, responsable, sévérité, environnements, catégories de données, nombre estimé de personnes, décisions, secrets révoqués, correctif/commit, preuves de recette, notifications et retour d’expérience. Le registre contient des références opaques, pas les données sensibles elles-mêmes.
