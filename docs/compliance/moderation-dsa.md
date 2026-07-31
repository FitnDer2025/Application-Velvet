# Procédure de modération et DSA

## Canaux de signalement

- menu in-app pour les profils ;
- point de contact électronique `/legal/report/` utilisable sans compte ;
- adresse DSA dédiée à publier avant ouverture ;
- canal interne sécurité pour les urgences et incidents.

## Réception

Chaque notification reçoit une référence, une date, un emplacement exact, une explication, la base juridique lorsqu’elle est connue et une déclaration de bonne foi. Les données du notifiant sont accessibles uniquement aux personnes qui en ont besoin.

## Triage

| Priorité | Exemples | Action initiale cible |
|---|---|---|
| P0 | mineur possible, violence, contrainte, menace immédiate, diffusion intime non consentie manifeste | isolation immédiate, conservation de preuve, escalade sécurité/juridique |
| P1 | harcèlement grave, usurpation, chantage, doxxing, récidive | revue prioritaire, limitation ou suspension conservatoire |
| P2 | faux profil, contenu interdit, contournement de blocage | revue normale et décision motivée |
| P3 | désaccord, qualité, conflit non illicite | médiation, rejet motivé ou orientation support |

Les délais internes précis doivent être définis par l’équipe et intégrés aux engagements publics uniquement lorsqu’ils sont tenables.

## Preuve

La preuve contient une empreinte, un instantané chiffré lorsque nécessaire, l’identité de l’auteur de la capture, l’horodatage, la durée de conservation et un éventuel legal hold. Elle ne doit jamais être copiée dans un outil de chat, un ticket non chiffré ou un poste personnel.

## Décision

Le modérateur habilité choisit une action : limitation de visibilité, retrait, suspension, fermeture, restauration, rejet ou escalade. Il saisit obligatoirement :

- les faits retenus ;
- la règle ou base juridique ;
- la justification ;
- la portée et la durée ;
- les éléments automatisés éventuellement utilisés ;
- les voies de recours ;
- les personnes à notifier.

La décision et chaque action sont inscrites dans `moderation_actions`. Les contenus sensibles ne sont consultables que par `admin` ou `moderator` sous MFA AAL2.

## Information des personnes

Sauf interdiction légale ou risque concret pour une personne, l’auteur du contenu reçoit les motifs essentiels et la voie de recours. Le notifiant reçoit une information adaptée sur l’issue sans divulgation excessive de données personnelles ou de mesures de sécurité.

## Recours

Le recours est enregistré dans `moderation_appeals`, attribué à une personne habilitée et réexaminé sur la base du contenu, des règles et des éléments nouveaux. La décision peut être confirmée ou renversée et doit être motivée.

## Autorités et urgence

La transmission à une autorité est décidée par les personnes habilitées selon la loi applicable. Velvet préserve la preuve, limite les destinataires et documente chaque transmission. Le service ne se substitue pas aux urgences.

## Transparence

Avant ouverture publique, Velvet doit définir les indicateurs permettant de produire les rapports de transparence applicables : nombre de notifications, catégories, délais, décisions, recours, usage d’outils automatisés, erreurs et suspensions.

## Qualité

- double revue des P0/P1 lorsque le temps le permet ;
- contrôle mensuel d’un échantillon de décisions ;
- mesure des faux positifs et faux négatifs de l’IA ;
- formation consentement, violences numériques, données sensibles et biais ;
- interdiction des comptes partagés ;
- revue trimestrielle des droits des modérateurs.
