# Zwit — efficacité média sans dégradation visible

## Objectif

Réduire la consommation de Supabase Storage et de bande passante sans modifier l’expérience visible ni la qualité perçue de Zwit.

## Politique appliquée

- les petites images déjà optimisées (<= 900 Ko et <= 2560 px) restent strictement inchangées ;
- les images plus grandes sont redimensionnées au maximum à 2560 px sur leur plus grand côté ;
- l’encodage utilise une qualité élevée, comprise entre 0,94 et 0,88 selon le poids obtenu ;
- une image optimisée n’est retenue que si elle apporte un gain réel, si elle dépasse la taille maximale serveur, ou si sa très haute définition excède le besoin d’affichage de Zwit ;
- si le navigateur ne peut pas optimiser proprement, le fichier original est conservé ;
- les vidéos ne sont jamais modifiées par cette couche ;
- aucune modification n’est apportée à la modération, aux droits d’accès, aux albums ou aux URL signées.

## Effet attendu

Pour des photos smartphone modernes de plusieurs mégaoctets, l’objectif réaliste est de ramener la majorité des fichiers dans une plage d’environ 0,7 à 1,5 Mo, tout en conservant assez de définition pour un affichage Retina plein écran sur mobile et desktop.

## Prochaine étape

Le gain de stockage est immédiat sur les nouveaux médias Web/PWA. La seconde étape, indépendante, consistera à introduire de vraies miniatures côté diffusion afin de réduire fortement l’egress sur les listes et le fil d’actualité, sans charger l’original tant que l’utilisateur n’ouvre pas la photo.
