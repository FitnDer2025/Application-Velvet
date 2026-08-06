# ADR-DATA-046 — Comptes individuels et profils partagés

- **Statut :** Acceptée
- **Date :** 2026-07-23
- **Portée :** Zwit V1 — modèle de données, authentification, consentement et permissions

## Contexte

Zwit doit permettre à une même personne de gérer plusieurs présences publiques, notamment un profil individuel et un profil Couple, sans recourir à des identifiants partagés.

Un compte partagé entre partenaires créerait des risques importants : absence de traçabilité individuelle, ambiguïté du consentement, difficulté de révocation des accès, faiblesse de la sécurité et impossibilité de distinguer les actions de chaque partenaire.

## Décision

Chaque personne physique possède son propre compte Zwit, sa propre authentification et sa propre vérification d’identité et de majorité.

Un compte personnel peut être lié à plusieurs profils indépendants ou partagés.

Un profil Couple :

- est une entité distincte des comptes personnels ;
- est lié à deux comptes personnels vérifiés au minimum ;
- ne possède jamais d’identifiants de connexion partagés ;
- est créé ou rejoint uniquement par invitation et acceptation explicite ;
- est cogéré selon des permissions attribuées individuellement ;
- conserve la traçabilité de l’auteur de chaque action sensible ;
- permet à chaque partenaire de suspendre ou quitter sa participation sans supprimer son compte personnel.

## Principes de modélisation

```text
Account ──< ProfileMembership >── Profile
```

`Account` représente l’identité authentifiée et vérifiée.

`Profile` représente une présence publique ou professionnelle sur Velvet.

`ProfileMembership` porte notamment :

- le rôle du membre dans le profil ;
- son statut d’invitation ;
- ses permissions ;
- la date d’acceptation ;
- la date de suspension ou de départ ;
- les éléments de consentement associés.

## Conséquences

### Positives

- sécurité renforcée ;
- consentement individuel vérifiable ;
- audit précis des actions ;
- gestion correcte des séparations et départs ;
- possibilité de gérer plusieurs profils avec une seule identité ;
- base compatible avec les profils organisateurs et professionnels partagés.

### Contraintes

- les permissions doivent être gérées au niveau de l’appartenance au profil ;
- certaines actions sensibles du profil Couple pourront exiger une validation conjointe ;
- l’interface devra permettre de changer clairement de profil actif ;
- les données personnelles d’un partenaire ne devront jamais être exposées automatiquement à l’autre.

## Règles non négociables

1. Aucun mot de passe ou moyen d’authentification ne peut être partagé par conception.
2. Aucun compte ne peut être rattaché à un profil Couple sans acceptation explicite de son propriétaire.
3. Toute action sensible doit être attribuable au compte qui l’a réalisée.
4. La sortie d’un profil partagé ne supprime jamais automatiquement le compte personnel.
5. Le profil Couple ne peut rester actif avec moins de deux membres actifs vérifiés, sauf état transitoire encadré par les règles métier.
