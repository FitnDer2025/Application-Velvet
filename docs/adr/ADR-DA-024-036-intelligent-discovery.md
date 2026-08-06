# ADR-DA-024 à ADR-DA-036 – Découverte intelligente Zwit

Status: Accepted

## Périmètre

Ce document enregistre le lot de décisions validées pour la recherche, la recommandation, la confiance et les expériences communautaires.

## ADR-024 — Découverte hybride

Zwit combine un flux de recommandations personnalisées, une recherche manuelle et des filtres avancés. Le swipe reste facultatif et ne constitue jamais le cœur de l'expérience.

Amendement fonctionnel du 29 juillet 2026 :

- l'accueil ne conserve que trois indicateurs actionnables : profils créés depuis minuit, événements situés à moins de 50 km et lieux référencés ;
- le mur d'accueil contient uniquement les nouveaux profils, leurs nouvelles photos publiques et les événements proches compatibles avec la zone et les préférences du membre ;
- la recherche de profils combine sans limite couples, hommes, femmes, profils qui recherchent ces catégories, ville ou proximité, âges séparés homme/femme, pratiques, morphologies, présence, photos et recommandations ;
- toutes les valeurs contrôlées, notamment les pratiques, sont multisélectionnables ;
- une recherche peut être nommée, sauvegardée, rappelée et supprimée par son propriétaire ;
- les vignettes affichent le type de profil, les âges, la zone publique, le badge « Déjà vu » et seulement une présence approximative : en ligne, connecté aujourd'hui ou absent aujourd'hui ;
- aucun horodatage exact de dernière connexion ni aucune commune privée n'est exposé.

## ADR-025 — Recommandations explicables

Chaque recommandation peut présenter des raisons qualitatives compréhensibles : proximité, lieux communs, centres d'intérêt, événements, disponibilité ou philosophie partagée.

## ADR-026 — Recommandations dynamiques

Le moteur évolue continuellement selon l'activité, les modifications de profil, les événements et les compatibilités, tout en conservant un noyau stable pour éviter une expérience chaotique.

## ADR-027 — Apprentissage comportemental

Le moteur apprend des consultations, interactions, événements et usages réels. Le membre conserve la possibilité de désactiver la personnalisation comportementale.

## ADR-028 — Compatibilité réciproque

La recommandation optimise la probabilité d'une connexion mutuelle plutôt que l'attractivité unilatérale. Aucun profil n'est exclu définitivement sur la seule base du moteur.

## ADR-029 — Qualité avant quantité

Le flux présente d'abord une sélection limitée des profils les plus pertinents. L'utilisateur peut volontairement élargir ensuite son exploration.

## ADR-030 — Carte premium

Zwit propose une carte fluide de qualité comparable aux références grand public, avec clustering, zoom, filtres et affichage des membres, clubs, événements et professionnels. Les positions restent approximatives et configurables ; un mode invisible est disponible.

Amendement fonctionnel du 29 juillet 2026 :

- le cadrage initial couvre un rayon d'environ 50 km autour de la localisation approximative consentie du membre ;
- le membre peut zoomer et dézoomer ;
- il choisit séparément l'affichage des membres, clubs, spas, bars, love rooms, hôtels et autres lieux ;
- la carte peut être déplacée librement et la liste des lieux se recalcule selon le centre, le zoom, les catégories actives et le périmètre réellement visible ;
- la carte occupe toute la largeur disponible de son encadrement ;
- l'adresse publique du lieu est la source de son positionnement ; les éventuelles coordonnées présentes dans le catalogue ne sont pas utilisées par Maps ;
- le géocodage dérivé de l'adresse est mis en cache pour préserver les performances, sans écriture distante dans Supabase ;
- une adresse absente, trop vague ou non résolue n'est jamais positionnée artificiellement ;
- aucune coordonnée exacte de membre n'est exposée ni conservée par cette fonction.

## ADR-031 — Zwit Alchemy Index

Zwit n'affiche aucun pourcentage de compatibilité. Il utilise des niveaux qualitatifs tels que « Alchimie exceptionnelle », « Très belle connexion », « Belle compatibilité », « À découvrir » ou « Potentiel inattendu », accompagnés de raisons explicables.

## ADR-032 — État d'esprit du moment

Un membre peut publier temporairement une intention actuelle : discuter, sortir, voyager, rester discret ou autre état contextuel. Ce signal temporaire peut alimenter les recommandations.

## ADR-033 — Cercle de confiance

Le Cercle de confiance est un réseau privé de membres choisis. Il peut servir aux albums privés, invitations, voyages, recommandations et autres fonctions de confiance. Il n'est jamais public.

## ADR-034 — Réputation invisible

Zwit utilise des signaux internes de fiabilité, de qualité et de sécurité sans note publique, étoiles, classement ni indicateur de popularité.

## ADR-035 — Carnet de Souvenirs

Les participants peuvent créer des souvenirs partagés après une expérience. La création et le partage requièrent le consentement unanime. Il ne s'agit jamais d'un système d'avis ou de notation.

## ADR-036 — Événements intelligents

Les événements disposent d'outils avant, pendant et après : préparation, salon, suggestions, check-in, carte, échanges temporaires, souvenirs et recommandations.

La présence peut être confirmée par :

- QR officiel Zwit ;
- géolocalisation ponctuelle et consentie dans le périmètre de l'événement ;
- validation par l'organisateur ;
- validation communautaire par des participants déjà confirmés.

La géolocalisation de présence n'est jamais un suivi continu.

## Conséquences

- Le moteur de découverte doit rester explicable, respectueux de la vie privée et orienté vers la réciprocité.
- Les expériences, événements, souvenirs et cercles de confiance alimentent un cycle cohérent sans générer de classement social.
- Les paramètres de personnalisation, visibilité et localisation doivent être accessibles aux utilisateurs.
- Les recherches sauvegardées sont privées par défaut et protégées par RLS.
- Le thème clair reprend la palette Zwit validée — ivoire, beige chaud, pastel rosé, or champagne et bordeaux — sans modifier les règles de confidentialité.
