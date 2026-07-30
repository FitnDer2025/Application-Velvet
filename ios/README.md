# Velvet iOS

Fondation native SwiftUI de Velvet, connectée au backend de la BETA Web.

## Périmètre livré

- projet Xcode iPhone, cible iOS 17+ ;
- design system synchronisé avec `docs/01-BRAND/DESIGN-TOKENS.json` ;
- authentification par e-mail et mot de passe ;
- prise en charge de Cloudflare Turnstile dans un composant WebKit isolé ;
- consentements explicites ;
- onboarding initial individuel ou couple ;
- accueil natif et navigation à cinq destinations ;
- session HTTP conservée par les cookies sécurisés du backend existant ;
- états chargement, erreur, vide et succès.

## Ouvrir sur Mac

1. Cloner le dépôt et sélectionner la branche `feat/velvet-ios-foundation`.
2. Ouvrir `ios/Velvet.xcodeproj` dans Xcode 16 ou plus récent.
3. Sélectionner la cible `Velvet`.
4. Dans **Signing & Capabilities**, choisir l'équipe Apple.
5. Remplacer `PRODUCT_BUNDLE_IDENTIFIER` avant la première inscription App Store.
6. Lancer sur un simulateur iPhone ou un iPhone physique.

L'URL BETA est définie dans :

- `Config/Debug.xcconfig`
- `Config/Release.xcconfig`

Elle pointe actuellement vers `https://velvet-beta.sh96hv64dj.workers.dev`.

## Limites de cette première tranche

- l'inscription sur invitation, la récupération du mot de passe et l'envoi de photos seront ajoutés dans les tranches suivantes ;
- l'onboarding pose l'identité initiale, mais le parcours Couple complet, l'invitation du partenaire et l'admission photo restent pilotés par le backend et la version Web ;
- les onglets Découvrir, Événements et Messages posent la navigation native mais seront alimentés dans les prochaines tranches ;
- aucune clé Supabase, aucun secret Cloudflare et aucune donnée personnelle ne sont intégrés à l'application.
- l'icône officielle 1024 × 1024 doit être ajoutée dans `AppIcon.appiconset` avant l'archive App Store ; le logo d'interface officiel est déjà inclus.

## Architecture

```text
Velvet/
├── App/               état global et routage
├── Core/              API, session et modèles
├── DesignSystem/      couleurs, métriques et composants Velvet
├── Features/
│   ├── Authentication
│   ├── Onboarding
│   └── Home
└── Resources/         catalogue d'assets
```

Le backend reste la source de vérité. L'application ne contourne jamais les permissions, la modération, l'admission ou les consentements serveur.
