# Velvet Product Changelog

Ce document retrace les décisions produit validées. Il ne remplace ni les ADR ni l'historique technique Git.

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
