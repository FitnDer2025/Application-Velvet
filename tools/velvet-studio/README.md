# Velvet Studio

Velvet Studio est le cockpit marketing IA de Velvet. Il est conçu pour produire, organiser et décliner des campagnes photo, vidéo et texte depuis Velvet Control, sans enfermer le produit dans un fournisseur unique.

## Objectif V1

Permettre à l'équipe Velvet de créer une campagne cohérente en moins de 10 minutes :

1. choisir une cible : Membres, Pros ou Marque ;
2. choisir un objectif : acquisition, activation, événement, fonctionnalité, notoriété ;
3. sélectionner les canaux : Instagram, TikTok, Facebook, YouTube, LinkedIn ;
4. générer le concept, le script, la voix off, les plans, les textes et les hashtags ;
5. produire ou importer les médias ;
6. décliner automatiquement les formats 9:16, 1:1 et 16:9 ;
7. valider, exporter et archiver la campagne.

## Principes non négociables

- ADN Velvet respecté automatiquement : premium, élégant, discret, inclusif, jamais vulgaire.
- Consentement et confidentialité par défaut.
- Validation humaine avant publication.
- Zéro dépendance fournisseur : chaque moteur IA est remplaçable.
- Gratuit-first : priorité aux outils locaux, libres ou déjà disponibles.
- Traçabilité complète : prompt, source, version, coût, décision, validation et export.

## Modules V1

- **Cockpit** : campagnes actives, tâches, alertes et indicateurs.
- **Campaign Builder** : brief guidé et génération de concept.
- **Script & Storyboard** : scènes, timings, voix off et textes écran.
- **Media Lab** : imports, génération image/vidéo, variantes et historique.
- **Brand Guard** : contrôle automatique de la charte et du ton.
- **Render Queue** : file de production et suivi des exports.
- **Library** : campagnes, modèles, assets et formats réutilisables.
- **Analytics** : résultats par canal et apprentissage des campagnes.

## Fournisseurs

Le V1 prévoit une couche d'adaptation :

- vidéo : Sora, moteur local, fournisseur tiers ;
- image : OpenAI Images, moteur local, fournisseur tiers ;
- voix : OpenAI TTS, voix locale, voix enregistrée ;
- montage : FFmpeg / Remotion ;
- sous-titres : transcription locale ou fournisseur tiers.

Aucune clé API ne doit être exposée dans le navigateur. Les fournisseurs payants sont optionnels.

## Prototype

Ouvrir `prototype/index.html` dans un navigateur. Le prototype fonctionne sans installation et simule le parcours complet d'une campagne Velvet.

## Prochaine intégration

Cette tranche doit être raccordée au code réel de Velvet Control dès que le dépôt applicatif est disponible : authentification, stockage, rôles, assets, tâches, journal d'audit et publication.