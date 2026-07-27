# Velvet — Prototype interactif Phases 2 et 3

## Objectif

Transformer la landing page de Phase 1 en démonstrateur produit navigable pour valider les premiers parcours avant migration React et connexion Supabase.

## Parcours couverts

- accueil membre personnalisé ;
- découverte de profils ;
- ouverture d'un profil détaillé ;
- demande d'accès à un album privé ;
- ouverture d'une conversation ;
- découverte et participation à un événement ;
- découverte d'un établissement ;
- aperçu des disponibilités ;
- conversations ;
- création et modification d'un profil couple ;
- réglage de localisation ;
- mode discrétion ;
- notifications simulées.

## Prévisualisation

Ouvrir `apps/web/prototype.html` ou lancer un serveur statique depuis `apps/web`.

```bash
python3 -m http.server 4173
```

Puis ouvrir `http://localhost:4173/prototype.html`.

## Nature du prototype

Les interactions sont simulées côté navigateur. Aucune donnée n'est envoyée à une base distante. Le prototype sert à valider l'architecture, les parcours, le ton et le design avant l'implémentation applicative.