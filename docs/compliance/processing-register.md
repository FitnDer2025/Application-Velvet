# Registre initial des activités de traitement

**Statut : brouillon à valider avant lancement.**  
**Responsable de traitement : à renseigner après immatriculation.**  
**Référent RGPD / DPO : à nommer.**  
**Dernière mise à jour : 31 juillet 2026.**

Chaque ligne doit être complétée avec les sous-traitants réels, les pays de traitement, les garanties de transfert, les durées validées et le propriétaire interne.

| Traitement | Finalités | Personnes | Données | Base envisagée | Destinataires | Conservation provisoire | Mesures principales | Propriétaire |
|---|---|---|---|---|---|---|---|---|
| Création et gestion du compte | Authentifier, gérer l’accès et la sécurité | Membres, pros, équipes | E-mail, identifiant, rôles, sessions, journaux | Contrat ; intérêt légitime sécurité | Auth, support habilité | Vie du compte + délai de suppression | Hash mot de passe Supabase, cookies HttpOnly, RLS, MFA Control | À nommer |
| Profil communautaire sensible | Présenter un profil et permettre les rencontres | Membres | Orientation, pratiques, préférences, recherche, biographie, données physiques | Consentement explicite ; contrat pour éléments non sensibles | Membres selon visibilité ; modérateurs habilités | Vie du profil + 30 jours avant purge | Visibilité public/privé/invisible, RLS, contrôle d’audience, MFA modération | À nommer |
| Photos et vidéos | Afficher les médias publics/privés et modérer | Membres et personnes représentées | Images, vidéos, métadonnées, résultats de modération | Consentement explicite ; contrat ; intérêt légitime sécurité | Membres autorisés, modérateurs | Vie du média ; preuves séparées si litige | Bucket privé, liens temporaires, contrôle humain, file de suppression | À nommer |
| Messagerie | Permettre les échanges | Membres | Messages, pièces jointes, participants, horodatages | Contrat ; consentement explicite lorsque contenu sensible volontaire | Participants ; modérateurs seulement si signalement/base légale | À définir et justifier | RLS conversation, blocage, stockage privé | À nommer |
| Géolocalisation de proximité | Afficher des résultats proches | Membres volontaires | Coordonnées arrondies, date de consentement, dernière utilisation | Consentement distinct | Service de proximité, utilisateur | Suppression au retrait ; réévaluation de la durée active | Coordonnées exactes non stockées, opt-in, effacement | À nommer |
| Recommandations et découverte | Trier et proposer profils/événements | Membres | Critères, interactions, préférences, historique limité | Consentement explicite pour données sensibles ; contrat | Utilisateur concerné | À définir dans l’AIPD | Minimisation, transparence, possibilité d’invisible | À nommer |
| Événements et inscriptions | Organiser et gérer les participations | Membres, organisateurs, pros | Identité de profil, événement, statut, places | Contrat | Organisateur/pro selon besoin, participants si choix | À définir | RLS, visibilité participants opt-in, capacité transactionnelle | À nommer |
| Vérification identité/majorité | Limiter l’accès aux adultes et attribuer un badge | Membres | Statut, fournisseur, résultat majorité/identité | Obligation légale/intérêt légitime ; à confirmer | Fournisseur, équipe habilitée | À définir avec le fournisseur | Pas de document d’identité stocké par Velvet, séparation du profil public | À nommer |
| Signalements et modération | Prévenir les abus et retirer l’illicite | Membres, personnes signalées, tiers | Signalement, contenu ou empreinte, preuve, décision, recours | Obligation légale ; intérêt légitime ; défense des droits | Modérateurs habilités, autorités si nécessaire | 5 ans proposés, à valider | Preuve chiffrée, journal append-only, MFA, accès réduit | À nommer |
| Notifications illicites DSA | Recevoir et traiter les notifications externes | Notifiants, auteurs de contenu | Contact, URL, explication, base juridique, décision | Obligation légale | Équipe DSA, conseil/autorité si nécessaire | À définir | Point de contact, référence, décision motivée, accès restreint | À nommer |
| Exercice des droits | Répondre aux demandes RGPD | Utilisateurs | Identité, demande, échanges, réponse | Obligation légale | Référent RGPD, équipes nécessaires | À définir selon preuve de traitement | Échéance, historique, vérification proportionnée | À nommer |
| Sécurité et incidents | Détecter, contenir et documenter | Tous utilisateurs | Logs, événements, IP lorsque nécessaire, incident, violation | Obligation légale ; intérêt légitime | Sécurité, direction, DPO, autorité | Logs 12 mois proposés ; incidents 5 ans proposés | Journaux restreints, MFA, alertes 72 h, sauvegardes | À nommer |
| Paiement et abonnement | Facturer les services | Membres et pros payants | Identifiant client, offre, statut, montant ; pas de carte chez Velvet | Contrat ; obligation comptable | Prestataire de paiement, finance | Selon règles comptables | Tokenisation prestataire, séparation facturation/profil | À nommer |
| Communications marketing | Informer sur Velvet ou partenaires | Personnes ayant consenti | E-mail, préférences, preuve de consentement | Consentement distinct | Velvet ; partenaires uniquement si consentement spécifique | Jusqu’au retrait + preuve restreinte | Désinscription, consentements séparés | À nommer |

## Sous-traitants à documenter

Au minimum : hébergement Cloudflare, base/authentification/stockage Supabase, e-mail transactionnel Resend, analyse média Cloudflare Workers AI, fournisseur de paiement, fournisseur de vérification identité/majorité, observabilité et support. Pour chacun : entité contractante, finalités, catégories de données, région, transferts hors EEE, DPA, mesures de sécurité, sous-traitants ultérieurs, suppression et assistance aux droits.

## Revue

Le registre doit être revu à chaque nouvelle finalité, nouveau partenaire, nouvelle catégorie de données, modification importante d’algorithme ou incident majeur, et au minimum une fois par an.
