# Déploiement progressif

Cette évolution doit être déployée avec un principe de qualité d'abord : aucune image ne doit être moins nette dans les usages normaux de Zwit.

1. Web/PWA : compression avant upload uniquement pour les images réellement lourdes.
2. Contrôle : mesurer le poids moyen avant/après pendant la bêta.
3. Diffusion : ajouter ensuite des miniatures dédiées pour les listes et le fil.
4. Vidéo : traiter séparément le stockage et la diffusion, sans transcodage automatique dans cette première étape.

Le retour arrière consiste simplement à retirer le chargement de `zwit-media-optimizer.js`; aucun média existant ni schéma Supabase n'est modifié.
