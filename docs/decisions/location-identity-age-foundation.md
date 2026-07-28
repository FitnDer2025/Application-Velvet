# Velvet — géolocalisation et vérification identité + majorité

## Géolocalisation BETA

- La géolocalisation est facultative.
- Elle est demandée uniquement après une action explicite de l’utilisateur.
- Le téléphone fournit temporairement la position au navigateur.
- Le serveur arrondit immédiatement les coordonnées à une maille d’environ 10 km avant l’écriture en base.
- Les coordonnées GPS exactes ne sont pas enregistrées.
- La zone approximative est privée et n’est jamais ajoutée à la fiche publique.
- Elle sert à classer les clubs et spas référencés autour de l’utilisateur.
- Le consentement et son retrait sont historisés.
- L’utilisateur peut désactiver la fonction et effacer la zone enregistrée depuis Paramètres.

## Vérification finale

- La majorité et l’identité seront contrôlées ensemble par un prestataire tiers.
- Velvet ne conserve aucune pièce d’identité, identité civile ou date de naissance issue du contrôle.
- Velvet conserve seulement le prestataire, un statut, les résultats booléens nécessaires, les dates techniques et une référence hachée.
- Le badge `Profil vérifié Velvet` exige simultanément :
  - identité vérifiée ;
  - majorité vérifiée ;
  - vérification encore valide.
- Pour un profil couple, les deux partenaires doivent être vérifiés pour que le profil commun obtienne le badge.
- Le prestataire n’est pas encore raccordé dans la BETA ; aucun faux statut vérifié n’est créé.
- La vérification ne bloque actuellement ni l’accès au site ni les albums.
- Le sas obligatoire et les règles d’accès éventuelles seront décidés lors du raccordement du prestataire et de la validation juridique de la version finale.
