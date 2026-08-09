# Parité Zwit Web → iOS

Audit réalisé le 30 juillet 2026 à partir des routes membres et des contrats
`/api/members/*` du Web.

## Principe produit

L’application iOS ne doit pas embarquer le site dans une WebView. Elle réutilise
le même backend, les mêmes règles d’admission et les mêmes données, avec des
interfaces SwiftUI adaptées aux usages Apple : navigation native, feuilles,
retours haptiques, permissions au bon moment et contenu privé masqué en arrière-plan.

## Couverture fonctionnelle

| Domaine Web | Contrat backend | Expérience iOS |
| --- | --- | --- |
| Inscription et récupération | auth signup, recovery, password update | Écrans natifs complets |
| Consentements et onboarding Couple | consent, profile, couple-invite | Parcours natif complet |
| Admission et identité | photos, verification | Photos compressées localement et statut d’admission |
| Accueil | directory, discovery, notifications | Accueil alimenté par les données réelles |
| Recherche membres | directory, discovery | Recherche et filtres avancés |
| Fiche membre | profile, engagement | Fiche complète et historique de consultation |
| Réactions | photo-reactions, engagement | Réactions natives depuis une fiche |
| Albums | albums, album-media | Création, ajout compressé et suppression de médias |
| Partage d’albums privés | album-access | Sélection des albums et durée d’accès |
| Messagerie et Salons | conversations, messages | Conversations privées et Salons Zwit |
| Sorties | event-registrations, plans | Inscription, voyages, visites et agenda personnel |
| Établissements | venue-relationships | Fiche distincte de Maps, favoris et projets de visite |
| Maps | map, location | Carte et localisation approximative |
| Notifications | notifications, settings, push-devices | Centre interne, réglages et jeton APNs |
| Profil éditorial | profile-copy | Plume Zwit native |
| Organisateur | organizer-request | Demande et suivi natifs |
| Sécurité membre | social-actions | Blocage et signalement |
| Cycle du profil | account-actions | Pause, reprise et suppression différée |
| Suppression Apple | account-deletion | Suppression définitive dans l’application |
| Monétisation | StoreKit 2 | Socle natif prêt, produits à relier dans App Store Connect |

## Face ID

Face ID est utilisé comme verrou local de la session déjà authentifiée. Zwit
ne stocke jamais le mot de passe. L’activation exige une authentification réussie,
le contenu est recouvert dès que l’application devient inactive et le code de
l’iPhone reste le mécanisme de secours Apple.

## Notifications APNs

Le client demande l’autorisation, s’enregistre auprès d’APNs à chaque lancement
autorisé, transmet le jeton au backend et le désactive à la déconnexion. Les
notifications reçues au premier plan sont présentées et leur route ouvre Messages,
Sorties, Maps, Profil ou le centre de notifications.

Pour une livraison réelle, trois opérations externes restent obligatoires :

1. activer **Push Notifications** pour l’App ID et la target Xcode ;
2. appliquer la migration `member_push_devices` ;
3. configurer le fournisseur APNs serveur avec la clé `.p8`, le Key ID, le Team ID
   et le bundle ID. La clé privée ne doit jamais entrer dans le dépôt ni dans l’app.

## Critère de validation avant soumission

La parité n’est considérée validée qu’après un passage sur iPhone physique :
connexion, Face ID, refus puis acceptation des notifications, réception sandbox,
routage de chaque type, upload d’album, partage temporaire, agenda, fiche
établissement, blocage et suppression du compte.

