# AIPD Velvet — document de travail

**Statut : NON RÉALISÉE / À COMPLÉTER AVANT LANCEMENT**  
**Responsable : à nommer**  
**DPO ou conseil consulté : à renseigner**  
**Date de décision : à renseigner**

## 1. Pourquoi une AIPD est nécessaire

Velvet combine à grande échelle potentielle :

- données relatives à la vie sexuelle et à l’orientation ;
- photographies et vidéos intimes ;
- géolocalisation et proximité ;
- profils, préférences, recommandations et historiques d’interaction ;
- messagerie et événements ;
- modération automatisée assistée par IA ;
- risque de chantage, outing, harcèlement, usurpation et diffusion non consentie.

L’analyse doit être terminée avant tout traitement réel à grande échelle et réexaminée à chaque changement substantiel.

## 2. Description systématique du traitement

À compléter pour chaque flux :

1. source des données ;
2. interface et moment de collecte ;
3. consentement ou autre base légale ;
4. API et fonctions traversées ;
5. tables, colonnes et buckets utilisés ;
6. sous-traitants et région ;
7. utilisateurs ou rôles destinataires ;
8. algorithmes, filtres ou décisions ;
9. export, notification et sauvegarde ;
10. durée et mécanisme de suppression.

Les diagrammes doivent couvrir au minimum : inscription/consentement, profil, médias publics et privés, messagerie, localisation, découverte, événement, signalement, modération, exercice des droits, suppression et sauvegardes.

## 3. Nécessité et proportionnalité

Pour chaque donnée, répondre :

- est-elle indispensable à la finalité annoncée ?
- peut-elle être facultative, moins précise ou remplacée par une catégorie ?
- est-elle privée par défaut ?
- qui peut la voir et pour quelle raison ?
- le membre peut-il la modifier, la masquer et la supprimer facilement ?
- la recommandation peut-elle fonctionner sans profilage sensible ?
- la durée est-elle la plus courte compatible avec le besoin ?
- l’information présentée au membre est-elle compréhensible au moment du choix ?

Décisions déjà intégrées : coordonnées arrondies, opt-in localisation, profil privé par défaut, mode invisible, albums privés sans aperçu, liens signés temporaires, rôles sensibles réduits, MFA Control et retrait autonome.

## 4. Scénarios de risque à évaluer

Noter chaque scénario selon vraisemblance, gravité initiale, mesures existantes, vraisemblance résiduelle et gravité résiduelle.

| Scénario | Impacts possibles | Mesures minimales attendues |
|---|---|---|
| Accès illégitime à un profil intime | Outing, discrimination, conflit familial/professionnel | MFA, RLS, chiffrement applicatif, alertes, moindre privilège |
| Fuite d’un album privé | Atteinte à l’intimité, chantage | Bucket privé, liens courts, grants révocables, watermark optionnel, journal d’accès |
| Compte administrateur compromis | Accès massif, manipulation, suppression | TOTP/WebAuthn, comptes nominatifs, alertes, revue des rôles, accès conditionnel |
| Mauvaise règle RLS | Exposition inter-utilisateurs | Tests automatisés, revue indépendante, staging, deny-by-default |
| Diffusion sans consentement | Préjudice intime et réputationnel | Signalement immédiat, preuve chiffrée, retrait prioritaire, suspension, recours |
| Faux profil/usurpation | Harcèlement, escroquerie, atteinte à l’image | Vérification, détection, blocage, procédure de contestation |
| Mineur ou âge incertain | Risque pénal et atteinte grave | Accès 18+, prestataire de majorité, quarantaine et revue humaine |
| Géolocalisation permettant une réidentification | Filature, agression, outing | Arrondi, absence d’historique exact, seuil de densité, mode invisible |
| Recommandation révélant une préférence intime | Inférence et discrimination | Transparence, minimisation, désactivation, pas d’usage publicitaire |
| Capture de message par un agent interne | Chantage, indiscrétion | Accès exceptionnel motivé, MFA, journal, cloisonnement support/modération |
| Suppression incomplète | Conservation non voulue | File de purge, worker, confirmation, rotation des sauvegardes |
| Preuve de modération non chiffrée | Nouvelle exposition du contenu signalé | Vault, chiffrement AES, accès admin/modérateur uniquement, legal hold |
| Sous-traitant hors EEE ou compromis | Accès externe, transfert non maîtrisé | DPA, localisation, garanties de transfert, audit, minimisation |
| IA de modération erronée | Retrait injustifié ou contenu dangereux maintenu | Seuils, revue humaine, recours, métriques d’erreur, pas de biométrie |

## 5. Mesures restantes à décider

- architecture de chiffrement applicatif des champs intimes et rotation des clés ;
- seuils de densité et anti-triangulation pour la carte ;
- durée de messagerie et gestion des sauvegardes ;
- fournisseur de vérification majorité/identité et données réellement reçues ;
- observabilité, SIEM et alertes d’accès anormaux ;
- procédure d’accès exceptionnel aux conversations ;
- modalités de recours et délais de modération ;
- transfert international et clauses contractuelles ;
- assistance aux victimes de diffusion non consentie ;
- critères de consultation préalable de la CNIL en cas de risque résiduel élevé.

## 6. Consultation des parties prenantes

Documenter les avis du responsable technique, de la sécurité, du DPO/conseil, de la modération, du support, de représentants d’utilisateurs et, lorsque pertinent, d’associations spécialisées dans les violences numériques et la protection de la vie privée.

## 7. Décision et acceptation du risque

La décision finale doit indiquer :

- risques résiduels acceptés et justification ;
- mesures obligatoires avant ouverture ;
- mesures planifiées et échéances ;
- personne ayant accepté chaque risque ;
- date de prochaine revue ;
- nécessité ou non d’une consultation préalable de l’autorité.

Aucune case ne doit être considérée comme validée sans élément de preuve associé : test, configuration exportée, contrat, capture, rapport de pentest, procès-verbal d’exercice ou décision signée.
