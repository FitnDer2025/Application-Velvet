# Politique de conservation et d’effacement

**Statut : paramètres provisoires à valider dans le registre et l’AIPD.**

## Principes

- aucune conservation « au cas où » ;
- une finalité, un propriétaire, une durée et une méthode de purge pour chaque catégorie ;
- séparation entre données actives, archives restreintes, preuves sous legal hold et sauvegardes ;
- effacement logique immédiat lorsque nécessaire, puis effacement physique vérifié ;
- toute exception doit être motivée, datée, limitée et revue.

## Paramètres techniques initiaux

| Catégorie | Actif | Après clôture | Purge |
|---|---:|---:|---|
| Compte, profil, préférences | durée du compte | 30 jours d’annulation | DB + file Storage + sous-traitants |
| Coordonnées de proximité | besoin actif uniquement | immédiat au retrait | mise à null et preuve de retrait |
| Preuves de consentement | durée utile | 5 ans proposés | archive restreinte puis suppression |
| Signalements et preuves | dossier actif | 5 ans proposés | archive chiffrée, sauf legal hold |
| Journaux sécurité | 12 mois proposés | aucune archive ordinaire | rotation automatique |
| Sauvegardes | 35 jours proposés | aucune | rotation prestataire |
| Incidents/violations | dossier actif | 5 ans proposés | archive restreinte |

## Suppression de compte

1. le profil devient invisible après les confirmations requises ;
2. un délai interne de 30 jours permet l’annulation ;
3. à échéance, les chemins de chaque média et pièce jointe sont placés dans `storage_deletion_queue` ;
4. les lignes applicatives sont supprimées ;
5. les signalements nécessaires sont pseudonymisés et séparés ;
6. le worker supprime chaque objet du bucket et marque `completed` ;
7. les échecs sont réessayés avec backoff et apparaissent dans Control ;
8. la disparition des sauvegardes suit leur cycle de rotation documenté.

## Legal hold

Un gel ne peut concerner que les données nécessaires à un litige, une enquête, un incident ou une obligation légale identifiée. Il doit contenir le motif, l’autorité de décision, la date de début, la date de revue, le périmètre exact et la personne autorisée à lever le gel.

## Revue

- contrôle quotidien des purges en échec ;
- rapprochement mensuel entre comptes purgés et objets Storage ;
- test trimestriel de restauration et de suppression ;
- revue annuelle des durées ou plus tôt en cas de changement de finalité, de jurisprudence, de contrat ou d’incident.
