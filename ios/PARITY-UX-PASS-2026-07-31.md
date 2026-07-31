# Velvet iOS — passe UX et parité du 31 juillet 2026

## Objectif

Rapprocher l’application native de la version Web sans transformer SwiftUI en simple copie visuelle du site. Les fonctions restent natives, mais chaque information et action majeure doit être accessible sur les deux plateformes.

## Changements livrés

### Chrome iOS

- bandeau Velvet réduit à 46 points ;
- commandes cloche et menu dans des bulles translucides ;
- dock inférieur flottant, arrondi et transparent ;
- mode immersif automatique dans une conversation.

### Recherche

- grille native à trois colonnes ;
- neuf profils chargés initialement, puis neuf supplémentaires ;
- vignettes plus compactes ;
- libellé explicite `Couple`, `Femme seule`, `Homme seul`, profil trans ou non-binaire ;
- conservation des filtres de type, attirance, localisation, âge, pratiques, morphologie, présence, photos, recommandations et date de création.

### Messagerie

- retrait du libellé redondant `Échange privé` ;
- conversation immersive inspirée des conventions iMessage ;
- retour correctement aligné ;
- avatar et nom ouvrant la fiche membre ;
- bulles reçues et envoyées, saisie multiligne et bouton d’envoi dédié ;
- badge non lu conservé.

### Mon profil

- les photos de profil restent exclusivement dans la galerie principale ;
- seuls les véritables albums apparaissent dans l’onglet Albums ;
- Studio du profil, Velvet IA, édition et paramètres déplacés dans le menu principal ;
- édition native des textes, pratiques, valeurs, lieux et informations personnelles ;
- génération Velvet IA intégrée à l’éditeur.

### Profil d’un autre membre

- galerie complète ;
- présentation, histoire, parcours et recherche ;
- pratiques et valeurs ;
- fiches individuelles et informations visibles ;
- photos individuelles ;
- albums publics ou explicitement autorisés ;
- recommandations ;
- réactions photo ;
- message, partage d’album privé, blocage et signalement.

## Principe de parité

La parité ne signifie pas reproduire au pixel près le Web. Elle signifie :

1. même donnée métier disponible ;
2. même action essentielle accessible ;
3. même règle de confidentialité ;
4. interaction adaptée aux conventions Apple ;
5. absence de fonction cachée sans point d’entrée natif.

## Contrôle automatique

Le fichier `apps/beta/test/ios-premium-parity-pass.test.mjs` vérifie la présence structurelle des nouveaux parcours. La compilation réelle et le comportement tactile restent à valider sous Xcode sur simulateur et iPhone physique.
