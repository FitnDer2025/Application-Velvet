# Velvet Studio — Architecture V1

## Positionnement

Velvet Studio est un module de Velvet Control. Il produit les contenus marketing de Velvet, Velvet Pro et des campagnes de marque à partir d'un brief structuré, tout en imposant la charte, le ton et les règles de sécurité.

## Architecture logique

```text
Velvet Control
  └── Velvet Studio UI
      ├── Campaign Builder
      ├── Script & Storyboard
      ├── Media Lab
      ├── Brand Guard
      ├── Render Queue
      ├── Library
      └── Analytics

Velvet Studio API
  ├── Campaign Service
  ├── Prompt Orchestrator
  ├── Provider Router
  ├── Asset Service
  ├── Brand Compliance Service
  ├── Render Service
  ├── Publication Export Service
  └── Audit Service

Provider adapters
  ├── Image provider
  ├── Video provider
  ├── Voice provider
  ├── Subtitle provider
  └── Local FFmpeg/Remotion renderer
```

## Stratégie gratuit-first

Ordre de sélection des moteurs :

1. import d'assets réels de Velvet ;
2. moteur local disponible ;
3. quota gratuit d'un fournisseur configuré ;
4. fournisseur payant explicitement autorisé ;
5. production manuelle guidée.

Le routeur doit afficher avant lancement : fournisseur, quota estimé, coût maximal et données transmises.

## États d'une campagne

- `draft`
- `brief_ready`
- `concept_ready`
- `assets_pending`
- `rendering`
- `review_required`
- `approved`
- `exported`
- `archived`

Aucune campagne ne passe de `review_required` à `approved` sans action humaine journalisée.

## Brand Guard

Contrôles obligatoires :

- palette officielle ;
- logo et zone de protection ;
- signature officielle ;
- vocabulaire premium et non vulgaire ;
- absence de promesse mensongère ;
- respect du consentement, de la discrétion et de l'inclusion ;
- conformité des visuels aux plateformes ;
- cohérence entre fonctionnalité montrée et fonctionnalité réellement disponible.

## Sécurité

- clés fournisseurs uniquement côté serveur ;
- chiffrement des secrets ;
- assets privés non envoyés à un fournisseur sans autorisation ;
- journal d'audit immutable ;
- suppression configurable des fichiers sources ;
- rôle minimal requis : `marketing_editor` ;
- approbation finale : `marketing_approver` ou `direction`.

## Livrables V1

- campagne 9:16, 1:1 ou 16:9 ;
- script voix off ;
- storyboard ;
- textes écran ;
- légende par réseau ;
- hashtags ;
- sous-titres SRT ;
- package d'assets ;
- rapport Brand Guard ;
- journal de génération.

## Critères d'acceptation

1. Une campagne complète peut être préparée sans fournisseur payant.
2. Aucun secret n'est accessible depuis le navigateur.
3. Chaque asset conserve sa provenance et son historique.
4. Le système bloque l'export en cas de non-conformité critique.
5. Le rendu est déclinable dans les trois formats principaux.
6. Toutes les décisions IA sont compréhensibles dans Velvet Control.
7. La publication automatique reste désactivée en V1.