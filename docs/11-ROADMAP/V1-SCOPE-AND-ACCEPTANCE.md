# Maquette V1 — Périmètre et critères d'acceptation

## But de la V1
Démontrer le cœur de valeur Velvet avec une expérience cohérente, premium et testable de bout en bout, sans prétendre livrer immédiatement l'intégralité de l'écosystème.

## Parcours critique V1
1. Créer un compte.
2. Compléter son identité et son profil.
3. Créer ou rejoindre un couple lorsque pertinent.
4. Configurer recherches, limites et visibilité.
5. Découvrir des profils compatibles.
6. Envoyer une Invitation Velvet personnalisée.
7. Accepter ou refuser une invitation.
8. Ouvrir un Salon Velvet après acceptation.
9. Échanger des messages avec statuts.
10. Partager un média selon les permissions prévues.
11. Utiliser un Carnet Velvet strictement privé.
12. Bloquer ou signaler un membre.

## Must-have maquette V1

### Authentification et onboarding
- Inscription, connexion, déconnexion et récupération de mot de passe.
- Profil obligatoire suffisamment complet avant accès à Discover.
- Acceptation des conditions et consentements requis.

### Profils et couples
- Profil individuel.
- Représentation d'un couple avec membres identifiés.
- Photos publiques et privées.
- Préférences de visibilité.
- Recherches et compatibilités de base.

### Discover
- Liste ou cartes de profils.
- Filtres essentiels.
- Accès au profil détaillé.
- États vides et chargement.

### Invitations Velvet
- Message personnalisé unique.
- Aucune relance.
- Statuts Envoyée, Consultée, Acceptée, Refusée, Expirée.
- Salon créé uniquement après acceptation.

### Salons Velvet
- Ouverture sur la dernière activité ou le premier non-lu.
- Messages texte.
- Statuts Envoyé, Distribué, Lu.
- Préférence de lecture avec réciprocité.
- Salon partagé distinct du Carnet privé.
- Onglets ou accès distincts `Messages` et `Histoire`.

### Sécurité relationnelle
- Blocage immédiat.
- Signalement avec motif.
- Permissions serveur sur les médias privés.
- Journalisation des décisions de consentement critiques.

### Administration minimale
- Liste des signalements.
- Consultation limitée des informations nécessaires à la modération.
- Suspension ou désactivation d'un compte.
- Traçabilité des actions administratives.

## Hors périmètre initial, sauf arbitrage contraire
- Paiement réel et abonnements complets, désormais amendés par ADR-MON-057 : moteur de droits et raccordement préparés, encaissement bloqué jusqu'à validation du prestataire et revue juridique.
- Marketplace avancée.
- Concierge humain complet.
- Voyages complexes avec réservation.
- Recommandation IA autonome.
- Chiffrement de bout en bout propriétaire.
- Détection universelle des captures d'écran.
- Apps natives complètes si la PWA couvre la démonstration V1.

## Critères d'acceptation transverses
- Aucun accès à un contenu privé sans autorisation serveur.
- Aucun second message possible sur une invitation en attente.
- Aucun Salon créé avant acceptation.
- Aucun contenu du Carnet visible par un autre compte, y compris via API.
- Le blocage empêche immédiatement les nouvelles interactions.
- Les statuts de lecture respectent la réciprocité.
- Les erreurs utilisateur sont compréhensibles et ne révèlent pas de données sensibles.
- L'interface fonctionne sur mobile et desktop.
- Les parcours critiques disposent de tests end-to-end.

## Jeux de données de démonstration
- Comptes individuels et couples fictifs clairement identifiés comme données de démonstration.
- Invitations dans chaque état.
- Salons avec différents niveaux de maturité.
- Médias de démonstration non sensibles et juridiquement utilisables.
- Signalements et cas de modération simulés.

## Gate de passage vers production
La maquette ne devient pas production publique avant :
- audit sécurité ;
- validation RGPD et juridique ;
- politique de modération finalisée ;
- conditions d'utilisation et politique de confidentialité ;
- sauvegardes et restauration testées ;
- observabilité et alertes ;
- procédure d'incident ;
- suppression et export des données ;
- validation des stores si applications natives.
