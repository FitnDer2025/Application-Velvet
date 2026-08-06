# ADR-0052 - Animations au service de l'expérience

Décision validée.

Les animations Zwit servent la fluidité et la compréhension. Elles ne doivent pas compliquer inutilement le développement ni ralentir l'application.

## Règle d'arbitrage

Une animation est intégrée uniquement si :
- Elle apporte une valeur perceptible à l'expérience.
- Elle reste simple à maintenir.
- Elle fonctionne sur Web, iOS et Android sans multiplier les implémentations spécifiques.
- Elle reste fluide sur des appareils de milieu de gamme.

## Priorités

### Niveau 1 - Obligatoire
- Transitions douces entre les écrans
- Apparition progressive des cartes
- Micro-retours des boutons
- Ouverture des menus
- Animation du logo au lancement

### Niveau 2 - Recommandé si simple
- Ouverture élégante des albums
- Apparition des réactions
- Animation légère des badges
- Transitions entre onglets

### Niveau 3 - Optionnel ou post-V1
- Effets de profondeur avancés
- 3D
- Effets lumineux complexes
- Transitions cinématographiques

La fluidité, la performance et la simplicité priment toujours sur l'effet visuel.