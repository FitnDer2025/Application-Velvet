# Velvet Video Engine — Sora

Ce module génère les plans verticaux de la campagne sociale Velvet via l’API vidéo OpenAI.

## Prérequis

- Node.js 20 ou supérieur.
- Une clé API OpenAI disposant de l’accès vidéo et d’un moyen de paiement actif.
- Ne jamais placer la clé dans GitHub, le navigateur ou l’application mobile.

## Configuration

### macOS / Linux

```bash
export OPENAI_API_KEY="votre_cle_api"
```

### Windows PowerShell

```powershell
$env:OPENAI_API_KEY="votre_cle_api"
```

## Génération de la campagne manifeste

Depuis le dossier `tools/velvet-video-sora` :

```bash
node generate-video.mjs ./prompts/velvet-manifeste.json ./output
```

Le script :

1. crée chaque job vidéo avec `sora-2-pro` ;
2. vérifie son avancement toutes les dix secondes ;
3. télécharge chaque MP4 terminé dans `output/`.

## Format retenu

- Réseaux sociaux : vertical `720x1280`.
- Durée : six plans de huit secondes.
- Direction : premium, cinématographique, élégante, non explicite et compatible avec les règles publicitaires des réseaux sociaux.

Les logos, textes, captures réelles de Velvet, voix off et musique doivent être ajoutés au montage. Le modèle ne doit pas générer les textes finaux ni reproduire l’interface réelle : les captures du produit restent la source de vérité.

## Sécurité

- La clé API reste exclusivement dans une variable d’environnement serveur.
- Le dossier `output/` ne doit pas contenir de données personnelles ni de captures réelles non validées.
- Les personnes générées doivent toutes être clairement adultes.

## Limite de pérennité

L’API Sora est utilisable pour la campagne actuelle, mais son arrêt est annoncé au 24 septembre 2026. Le module est donc isolé pour pouvoir remplacer facilement le fournisseur vidéo sans modifier le produit Velvet.
