# Guide d'implémentation visuelle Zwit

**Statut : VALIDÉ**

## Signature de marque

- Nom : **ZWIT**
- Signature : **Là où les plus belles rencontres commencent.**
- Logo principal : V formé par un ruban de velours bordeaux/rose sur fond noir.
- Logotype : lettres espacées en or champagne.
- Ne jamais remplacer le logo par un V doré générique.

## Direction artistique

Zwit est sombre, cinématographique, chaleureux et premium. L'expérience doit évoquer le velours, une lumière tamisée, le champagne et l'intimité élégante, jamais l'explicite ou le vulgaire.

### À faire

- Fonds noir Zwit et anthracite.
- Accents bordeaux pour les actions et états actifs.
- Or champagne utilisé avec parcimonie pour la marque, les titres éditoriaux et les détails premium.
- Photographies naturelles, sensuelles, raffinées, avec visages et complicité.
- Cartes légèrement arrondies, bordures fines, ombres douces.
- Espaces généreux et hiérarchie claire.

### À éviter

- Violet néon, rose fluorescent ou dégradés génériques de dating app.
- Surcharge dorée.
- Imagerie pornographique, poses artificielles ou clichés libertins.
- Interfaces de casino, classements agressifs, compteurs anxiogènes.
- Multiplication des animations ou sons.

## Architecture visuelle

### Composition éditoriale

- Chaque écran possède un seul niveau de lecture principal ; toutes les cartes ne doivent jamais avoir le même poids.
- Les groupes d'informations proches peuvent partager une même surface et être séparés par des filets fins plutôt que par une succession d'encadrements.
- Les titres utilisent de grands écarts de taille et des espacements généreux, tandis que les textes fonctionnels restent compacts.
- Les ombres indiquent la profondeur ou une surface flottante ; elles ne sont pas appliquées systématiquement à tous les blocs.
- Les actions principales sont regroupées près de l'identité ou de l'objet auquel elles s'appliquent.
- Sur mobile, les métriques et raccourcis peuvent défiler horizontalement par ensembles courts afin de préserver une hauteur utile immédiate.

### Profils membres

- La photographie occupe la majorité du premier écran et conserve un cadrage digne d'une couverture éditoriale.
- L'identité, la zone publique, le type de profil et les âges restent immédiatement lisibles.
- Le récit du profil forme un flux continu ; les sections sont séparées par le rythme, la typographie et des filets, sans répétition de cartes autonomes.
- Les fiches personnelles, la localisation, les disponibilités et les lieux préférés forment une colonne contextuelle compacte sur grand écran.
- Sur mobile, la photographie précède l'identité et les actions sans texte superposé sur les zones essentielles du visage.
- Les commandes de sécurité restent accessibles mais visuellement secondaires tant qu'elles ne sont pas ouvertes.

### Espaces publics

Découverte, événements, clubs et voyages conservent une sensation plus ouverte : images lumineuses, détails champagne, respiration importante.

### Espaces privés

Profils privés, albums, Salon Zwit, Carnet Zwit et paramètres de confidentialité utilisent des surfaces anthracite plus profondes, avec accents bordeaux et contraste renforcé.

## Cartes Zwit

Toutes les cartes partagent une base commune :

- photo dominante ;
- rayon large mais maîtrisé ;
- bordure subtile ;
- informations essentielles seulement ;
- réaction ou action principale identifiable ;
- micro-interaction d'enfoncement légère au toucher.

Déclinaisons : Femme, Homme, Couple, autre identité, événement, club, voyage et conversation.

### Carte Couple

- Photo commune dominante.
- Deux portraits secondaires identifiant les partenaires.
- État visible des identités : Couple actif, partenaire actif individuellement ou désactivé.
- Le design reste compatible avec toutes les compositions de couple ; les libellés ne doivent pas imposer un modèle hétérosexuel.

## Typographie

- Interface : Poppins ou Montserrat.
- Accents éditoriaux : Playfair Display ou Lora.
- Les titres éditoriaux sont rares ; les écrans opérationnels restent très lisibles.
- Ne jamais empaqueter ou redistribuer des fichiers de polices sans licence appropriée.

## Icônes

- Bibliothèque standard en lignes fines pour les actions courantes.
- Icônes Zwit spécifiques pour les concepts différenciants.
- Traits élégants, peu détaillés, cohérents à petite taille.
- Une même grille de 24 × 24, une épaisseur de trait stable et des extrémités arrondies sont utilisées dans Community, Professionals et Admin & Trust.
- Les glyphes typographiques et symboles décoratifs ne remplacent pas une icône fonctionnelle dans la navigation.

## Navigation applicative mobile

- Zwit conserve cinq destinations principales au maximum dans la barre inférieure.
- Les destinations secondaires sont regroupées dans une feuille de navigation accessible depuis l’en-tête.
- L’en-tête et la barre inférieure utilisent des surfaces translucides lisibles, respectent les zones sûres iOS/Android et ne masquent jamais le contenu.
- Chaque destination change de vue sans transformer l’interface en longue page vitrine ; le défilement reste propre au contenu de la vue active.
- Les espaces Community, Professionals et Admin & Trust utilisent le même langage de navigation, avec des destinations adaptées au rôle.
- Le logo de navigation et l’icône PWA utilisent exclusivement le V ruban bordeaux/rose sur Noir Velvet.

## Mouvement

- Animation d'ouverture : le ruban forme le V, puis le mot ZWIT apparaît.
- Durée cible : 2 à 3 secondes, ignorée ou raccourcie après les premiers lancements.
- Une seule signature sonore, synchronisée avec l'ouverture.
- Les autres animations servent la compréhension, jamais la décoration.

## Accessibilité

- Contraste vérifié pour tous les textes et actions.
- Taille tactile minimale de 44 × 44 px.
- Ne pas transmettre une information uniquement par la couleur.
- Respecter la réduction des animations du système.
- Prévoir textes alternatifs, sous-titres vidéo et navigation clavier sur le web.

## Référence technique

Les valeurs canoniques sont dans `DESIGN-TOKENS.json`. Toute implémentation doit générer ses variables CSS, thèmes natifs ou constantes depuis ce fichier, ou rester strictement synchronisée avec lui.
