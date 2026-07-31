# Velvet iOS

Application native SwiftUI de Velvet, connectée au même backend Cloudflare/Supabase que la BETA Web.

## Périmètre présent dans la branche

- connexion, inscription avec code d’invitation et consentements ;
- récupération du mot de passe via `velvet://recovery` ;
- onboarding individuel et Couple, invitation privée du partenaire ;
- sélection Photos, compression JPEG locale, upload et états de modération ;
- admission et démarrage de la vérification externe d’identité/majorité ;
- accueil alimenté par l’annuaire et les notifications du backend ;
- découverte, recherche locale et fiches membres ;
- clubs, professionnels, lieux, événements et inscription ;
- conversations privées et Salons Velvet liés aux événements ;
- favoris côté contrat, blocage, signalement et suppression du compte ;
- notifications APNs natives (autorisation, jeton, routage et préférences),
  localisation approximative et préparation StoreKit 2 ;
- verrou local Face ID sans conservation du mot de passe ;
- parité Web documentée dans `WEB-IOS-PARITY.md` ;
- manifeste de confidentialité et validation structurelle.

Le backend reste la source de vérité. L’app ne contourne ni l’admission, ni la visibilité, ni la modération, ni les consentements.

## Parité visuelle Web / iOS

La couche membre native reprend les choix éditoriaux de
`apps/beta/static/assets/velvet-editorial-ui.css` :

- fond `#0B080A`, panneaux `#151013` / `#1B1418`, bordeaux `#7E2045`,
  or `#D9B879` et ivoire `#F6EEE6` ;
- en-tête mobile compact et navigation
  Accueil / Recherche / Maps / Messages / Profil ;
- cartes verre, filets fins, titres sérif et états vides éditoriaux ;
- cartes profils au ratio 4:5, héros de profil et tuiles sorties/lieux ;
- recherche avancée native (types, attentes, zone, âges, pratiques,
  morphologies, présence, photos et recommandations) ;
- fiche profil complète avec carrousel, personnes, récit, envies,
  disponibilités, recommandations et albums ;
- carte MapKit alimentée par `/api/members/map`, sans exposer la position
  exacte d’un membre.

## Ouvrir sur Mac

1. Cloner le dépôt et sélectionner `feat/velvet-ios-foundation`.
2. Ouvrir `ios/Velvet.xcodeproj` avec Xcode 16 ou plus récent.
3. Dans la cible **Velvet > Signing & Capabilities**, choisir l’équipe Apple.
4. Remplacer `com.velvetapplication.app` si cet identifiant n’est pas celui réservé dans Apple Developer.
5. Ajouter l’icône 1024 × 1024 dans `AppIcon.appiconset`.
6. Lancer d’abord sur un simulateur iPhone, puis sur un iPhone physique pour Photos, localisation et notifications.

L’URL de la BETA est définie dans `Config/Debug.xcconfig` et `Config/Release.xcconfig`.

## Activation backend nécessaire

- Ajouter `velvet://recovery` à la liste des redirect URLs autorisées dans Supabase Auth.
- Déployer la version adaptée de `functions/api/auth/recovery-request.js`.
- Définir `SUPABASE_SERVICE_ROLE_KEY` comme secret Cloudflare pour la suppression de compte. Cette clé ne doit jamais être placée dans Xcode, GitHub ou une variable publique.
- Vérifier les cascades et la politique de conservation avant d’activer l’effacement définitif.
- Choisir le prestataire de vérification puis définir `IDENTITY_AGE_VERIFICATION_START_URL`.

## Activation Apple nécessaire

- Notifications : la capability et l’entitlement sont préparés. Sélectionner la
  Team Apple dans Xcode, activer **Push Notifications** sur l’App ID, appliquer la
  migration `member_push_devices`, puis configurer la clé APNs `.p8` uniquement
  côté serveur. Ajouter **Background Modes > Remote notifications** seulement si
  des notifications silencieuses sont réellement nécessaires.
- StoreKit : créer les produits dans App Store Connect et ajouter une correspondance serveur `plan Velvet ↔ product ID Apple`. Aucun identifiant de produit n’est codé en dur.
- Confidentialité : aligner les réponses App Store Connect avec `Resources/PrivacyInfo.xcprivacy` et avec le comportement réel du backend.
- Récupération : tester le schéma `velvet://recovery` sur un appareil.

## Vérifications

Depuis la racine :

```bash
node ios/scripts/validate-foundation.mjs
node --test ios/tests/native-structure.test.mjs
node --check functions/api/auth/recovery-request.js
node --check functions/api/members/account-deletion.js
```

Sur Mac :

```bash
xcodebuild \
  -project ios/Velvet.xcodeproj \
  -scheme Velvet \
  -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro' \
  build
```

Voir aussi `ARCHITECTURE.md` et `APP-STORE-CHECKLIST.md`.
