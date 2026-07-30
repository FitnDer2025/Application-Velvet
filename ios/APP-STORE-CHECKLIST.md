# Checklist App Store — Velvet iOS

## Avant le premier build TestFlight

- [ ] Équipe Apple et bundle ID définitif configurés.
- [ ] Icône 1024 × 1024 ajoutée, sans transparence.
- [ ] Build Xcode sans erreur sur simulateur et appareil.
- [ ] `velvet://recovery` autorisé dans Supabase et testé.
- [ ] Suppression de compte testée de bout en bout sur un compte fictif.
- [ ] Prestataire identité/majorité configuré ou écran désactivé explicitement.
- [ ] Aucun secret dans l’app, le dépôt ou les logs.
- [ ] Jeux de données uniquement fictifs pour captures et review.

## Capacités Apple

- [ ] Push Notifications et clé APNs.
- [ ] Contrat backend pour enregistrer, renouveler et révoquer les jetons APNs.
- [ ] Produits StoreKit créés et reliés au catalogue backend.
- [ ] Restauration d’achats et validation serveur des transactions.
- [ ] Texte de permission localisation relu.

## App Review

- [ ] Compte de démonstration admis fourni dans Review Notes.
- [ ] Code d’invitation de review valide et procédure expliquée.
- [ ] Contenus sensibles compatibles avec les règles Apple.
- [ ] Blocage, signalement et suppression accessibles sans passer par le Web.
- [ ] Conditions, confidentialité et sécurité accessibles avant connexion.
- [ ] Réponses « App Privacy » alignées sur `PrivacyInfo.xcprivacy`.
- [ ] Politique de modération et délai de traitement expliqués.

## Tests manuels minimaux

- [ ] Création avec invitation, confirmation e-mail et consentements.
- [ ] Mot de passe oublié et retour dans l’app.
- [ ] Onboarding individuel.
- [ ] Onboarding Couple et acceptation par le partenaire.
- [ ] Photos trop lourdes, refusées, en revue et approuvées.
- [ ] Admission verrouillée puis approuvée.
- [ ] Recherche, profil, message, blocage et signalement.
- [ ] Inscription à un événement.
- [ ] Refus de localisation et de notifications sans régression.
- [ ] Suppression du compte puis échec de reconnexion.
