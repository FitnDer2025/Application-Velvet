# Velvet Product Changelog

Ce document retrace les décisions produit validées. Il ne remplace ni les ADR ni l'historique technique Git.

## 4 août 2026

### ADR-UX-061 — Velvet Contrôle devient un cockpit de pilotage

- La page d’accueil de Contrôle affiche un briefing réel : actions humaines attendues, décisions IA récentes, autonomie observée et état des connecteurs.
- L’interface est limitée à cinq destinations : Pilotage, À traiter, IA & modération, Communications et Gestion.
- Les démonstrateurs `localStorage`, pourcentages de disponibilité et faux agents/services sont retirés de l’interface livrée.
- La modération photo conserve l’architecture IA-first et sépare les seuils d’automatisation des médias publics et privés ; le mode Observation confie toutes les décisions à l’humain.
- Les vidéos et les cas ambigus, incertains ou techniquement non analysables restent dans la file humaine.
- Les modèles transactionnels et marketing utilisent une enveloppe Velvet fixe, sans HTML arbitraire ; le marketing reste sans diffusion tant que consentement et désinscription ne sont pas opérationnels.
- Chaque modification de politique IA ou de modèle e-mail et chaque décision automatique sont auditables sans recopier de média intime dans le journal.
- Gestion dispose d’une recherche membre par pseudonyme, e-mail ou identifiant et d’une fiche de contrôle unique par profil, regroupant les comptes liés, l’état de vérification, l’offre, les alertes et les actions auditées sans afficher les contenus privés.

### ADR-UX-060 — Compte et interfaces Web

- Membres, Velvet Pro et Velvet Control proposent désormais la même action « Changer de compte » avec révocation de session et retour à la connexion.
- Le rôle `admin` peut passer directement entre les trois interfaces Web sans se déconnecter.
- Les raccourcis ne donnent aucun droit supplémentaire : chaque destination reste protégée côté serveur.
- Les autres rôles ne voient pas le sélecteur transversal et l’application iOS reste inchangée.

## 30 juillet 2026

### Qualité perçue et navigation applicative

- La connexion, Community, Velvet Pro et Velvet Contrôle partagent désormais les mêmes surfaces translucides, rayons, ombres, rythmes et retours tactiles.
- Les symboles typographiques de navigation sont remplacés par une iconographie vectorielle fine, cohérente et lisible.
- Sur mobile, Community utilise cinq destinations principales et une feuille dédiée aux accès secondaires afin de préserver des zones tactiles confortables.
- Velvet Pro et Velvet Contrôle adoptent la même barre de navigation applicative, les zones sûres des appareils et des vues adaptées aux petits écrans.
- Le V ruban bordeaux/rose devient l’icône visible du site, de la PWA et des en-têtes, en remplacement du V doré générique.
- Le thème clair Community conserve ses tons ivoire, beige, pastel, or et bordeaux dans le nouveau système.

### Direction artistique éditoriale

- Les contenus existants sont conservés, mais leur composition adopte une hiérarchie plus éditoriale : respiration, contraste, rythme vertical et surfaces silencieuses.
- Les profils personnels et publics deviennent des pages magazine : photographie dominante, identité lisible, actions regroupées et récit continu plutôt qu'une accumulation de cartes équivalentes.
- Les aperçus de profils utilisent un cadrage photographique vertical, une identité claire et une présence discrète dans Recherche, l'actualité, les sorties et les notifications.
- Accueil, Recherche, Maps, Sorties, Établissements, Notifications, Paramètres et Conversations disposent chacun d'une densité et d'une organisation adaptées à leur usage.
- Velvet Pro et Velvet Contrôle reprennent la même exigence sur les métriques, tableaux, filtres, messageries, panneaux latéraux et écrans de pilotage.
- La composition mobile favorise les vues applicatives, les listes horizontales maîtrisées et les actions accessibles sans transformer les pages en vitrines interminables.

### ADR-MON-057 — Découverte, Signature et Velvet Pro

- Velvet Découverte conserve la recherche essentielle, trois nouvelles conversations par semaine, dix suivis, un essai IA et toutes les fonctions essentielles de sécurité.
- Velvet Signature apporte recherche avancée et sauvegardée, conversations et suivis illimités, vingt générations IA mensuelles et alertes personnalisées.
- Les femmes seules vérifiées bénéficient de Signature sans paiement ; les couples partagent un abonnement.
- Signature est préparé à 14,90 €/mois, 34,90 €/3 mois et 99,90 €/an.
- Velvet Pro est préparé à 39,90 €/mois et 399 €/an, sans commission événement au lancement.
- Les cohortes fondatrices offrent 90 jours à 250 couples, 150 hommes seuls et 30 établissements.
- Velvet Control pilote droits, campagnes, codes, suspensions, blocages et suppressions différées.
- Le prestataire de paiement reste interchangeable et aucun encaissement réel n'est ouvert avant son accord écrit et la validation juridique.

## 29 juillet 2026

### Accueil personnalisé, recherche avancée et thème clair

- L'accueil affiche les profils créés depuis minuit, les événements réels à moins de 50 km et un accès direct aux établissements.
- Le mur d'actualité est limité aux nouveaux profils, nouvelles photos publiques et événements proches correspondant à la zone et aux préférences.
- Découvrir accepte des critères multiples et cumulables : catégories recherchées, catégories qui recherchent, ville ou proximité, âges homme/femme, pratiques, morphologies et signaux complémentaires.
- Les recherches peuvent être nommées, sauvegardées et supprimées.
- Les vignettes affichent type, âges, zone publique, état de présence approximatif et historique « Déjà vu », sans horaire précis de connexion.
- Un thème clair ivoire, beige, pastel, or et bordeaux est disponible dans les paramètres de l'espace membre.

### Découverte locale, Maps et accès membre

- L'accueil distingue désormais clairement la découverte d'autres membres.
- Les établissements peuvent être filtrés par nature et dans un rayon de 5, 10, 15 ou 20 km autour d'une zone approximative consentie.
- Découvrir filtre les couples, hommes, femmes et les pratiques via une liste contrôlée.
- Maps démarre sur un rayon d'environ 50 km autour du membre, permet le zoom et le choix des catégories visibles.
- Maps devient déplaçable et synchronise en temps réel la liste des lieux avec la zone réellement visible, tout en occupant toute la largeur disponible.
- Les agendas de soirées sont limités aux clubs, spas et bars.
- Les comptes uniquement membres rejoignent directement leur espace ; le choix d'univers est réservé aux administrateurs et modérateurs.

### ADR-GOV-003 — Autonomie de livraison Codex

- Codex peut conduire les évolutions Velvet de la branche jusqu'à la fusion et au déploiement sans validation intermédiaire.
- Les contrôles pertinents restent obligatoires avant toute livraison.
- Codex prépare et teste les scripts ou migrations SQL Supabase, mais Cyril conserve exclusivement leur exécution sur l'instance distante.

## 23 juillet 2026

### Gouvernance

- Validation du pilotage continu par roadmap, métriques et changelog.
- Ajout de `ADR-STATUS.md` pour éviter la réouverture des décisions déjà prises.
- L'architecture produit de référence progresse de 64 % à 80 %.

### ADR-020 à ADR-023 — Modération, identité et activité

- Modération hybride IA-first avec revue humaine des cas sensibles.
- Pseudonymes publics et identité civile privée.
- Vérification d'identité et de majorité obligatoire.
- Velvet Activity Index, Mode Absence et indicateur de réactivité.

### ADR-024 à ADR-029 — Moteur de découverte

- Découverte hybride associant recommandations, recherche et filtres.
- Recommandations explicables et dynamiques.
- Apprentissage comportemental désactivable.
- Compatibilité réciproque et priorité à la qualité plutôt qu'à la quantité.

### ADR-030 à ADR-034 — Carte, Alchimie et confiance

- Carte premium avec localisation approximative, clustering et mode invisible.
- Velvet Alchemy Index qualitatif sans pourcentage.
- État d'esprit temporaire intégré au contexte.
- Cercle de confiance privé.
- Réputation de sécurité invisible, sans note ni classement.

### ADR-035 et ADR-036 — Souvenirs et événements intelligents

- Carnet de Souvenirs partagé avec consentement unanime.
- Cycle événementiel avant, pendant et après.
- Confirmation de présence par QR, géolocalisation ponctuelle consentie, organisateur ou communauté validée.

### ADR-038 à ADR-041 — Professionnels et voyages

- Assistant IA pour les organisateurs.
- CRM métier modulaire selon la profession.
- IA professionnelle personnalisée à partir des contenus approuvés.
- Velvet Trips comme espace communautaire complet avant, pendant et après les voyages.

### ADR-043 et ADR-044 — Gamification positive

- Récompenses centrées sur la confiance, la qualité et la participation utile.
- Exclusion des classements, scores de popularité et récompenses de volume.
- Distinctions évolutives racontant le parcours sans niveaux compétitifs.
- Exclusion des hiérarchies Bronze, Argent, Or et Diamant.

### Numéros volontairement non créés

- ADR-037 : proposition abandonnée car l'architecture professionnelle était déjà arbitrée.
- ADR-042 : proposition abandonnée car la monétisation était déjà arbitrée.

## Entretien

Chaque ADR acceptée doit ajouter une entrée datée résumant la décision et ses impacts produit majeurs.
