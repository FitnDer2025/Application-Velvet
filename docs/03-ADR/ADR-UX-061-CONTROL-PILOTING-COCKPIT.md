# ADR-UX-061 — Zwit Contrôle comme cockpit de pilotage réel

Statut : **ACCEPTED**

Date : 2026-08-04

## Décision

Zwit Contrôle n'est plus présenté comme une suite de démonstrateurs, de recettes locales ou de services IA simulés. Il devient un cockpit opérationnel unique, alimenté par les données réellement accessibles au rôle connecté.

L'ouverture de Zwit Contrôle montre en priorité :

1. les actions humaines qui attendent une décision ;
2. les dernières décisions prises par les automatisations Zwit ;
3. l'état réel des automatismes et connecteurs ;
4. les alertes et indicateurs utiles au pilotage.

## Navigation

La navigation principale est limitée à cinq destinations :

- **Pilotage** : briefing immédiat, priorités, activité IA et santé des automatismes ;
- **À traiter** : file humaine unifiée pour médias, signalements, organisateurs, vérifications et conformité ;
- **IA & modération** : historique explicable, file média et réglage de l'autonomie ;
- **Communications** : modèles transactionnels et marketing dans un cadre visuel Zwit fixe ;
- **Gestion** : membres, professionnels, invitations, accès et offres.

Les écrans de release, services, agents ou permissions qui ne reflètent qu'un état `localStorage` sont retirés de l'interface livrée.

### Recherche et fiche membre

- La rubrique **Gestion > Membres** propose une recherche par pseudonyme, e-mail, identifiant de compte ou identifiant de profil.
- Un résultat représente un profil Zwit et regroupe ses comptes personnels liés, notamment les deux accès distincts d'un profil Couple.
- La fiche de contrôle réunit uniquement les données opérationnelles nécessaires : état du compte, vérification, admission, visibilité, offre, signalements ouverts, médias en revue, comptes liés et historique d'audit associé.
- Les actions d'accès, de suspension, de blocage et de suppression différée restent réservées à `admin` et `direction` et conservent leur journalisation serveur.
- La fiche n'affiche aucun album privé, contenu intime ou document d'identité ; l'accès à un média reste limité à la file de modération autorisée.

## Modération IA

- L'ADR-DA-020 reste applicable : les cas nets sont traités automatiquement et les cas ambigus ou sensibles sont routés vers l'humain.
- Les photos de profil et d'albums peuvent être validées ou refusées automatiquement.
- Les vidéos restent en revue humaine tant qu'une analyse vidéo fiable n'est pas branchée.
- Les seuils d'autonomie des médias publics et privés sont réglables uniquement par `admin` ou `direction`.
- Le mode **Observation** force tous les nouveaux résultats vers la file humaine sans désactiver l'analyse.
- Les signaux de mineur possible, violence, contrainte, illégalité ou incertitude restent toujours soumis aux règles de sécurité et ne peuvent pas être neutralisés par un réglage d'interface.
- Chaque décision IA nouvelle est enregistrée dans le journal d'audit sans média, donnée biométrique ni contenu intime en clair.

## Communications

- Les e-mails utilisent une enveloppe Zwit canonique non modifiable : Noir Zwit, Bordeaux Zwit, Or Champagne et logo officiel.
- Le contenu éditable est limité au sujet, pré-en-tête, titre, corps, appel à l'action et pied de message.
- Aucun HTML arbitraire n'est accepté depuis Zwit Contrôle.
- Les modèles transactionnels actifs peuvent être consommés par les parcours serveur compatibles, avec retour automatique au modèle versionné dans le code en cas d'indisponibilité.
- Les modèles marketing restent soumis au consentement marketing, au retrait simple et à la configuration effective d'un prestataire d'envoi.

## Permissions et traçabilité

- `admin` et `direction` pilotent les politiques IA et activent les modèles d'e-mail.
- `admin`, `direction` et `moderator` examinent les médias.
- Les autres rôles Control voient uniquement les informations nécessaires à leur mission.
- Toute décision sensible ou modification de configuration est journalisée côté serveur.
- Les aperçus de médias privés restent servis par URL signée courte et réservée aux rôles de modération autorisés.

## Conséquences

- Zwit Contrôle doit rester utile même lorsqu'aucune action n'est en attente : l'état vide devient un signal explicite, pas une démonstration fictive.
- L'interface indique honnêtement les automatismes branchés, les fonctions en observation et les connecteurs non configurés.
- La migration de données peut être livrée séparément du code, mais l'interface doit conserver un mode dégradé lisible tant qu'elle n'est pas appliquée.
