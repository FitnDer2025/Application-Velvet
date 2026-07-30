# ADR-TECH-058 — Fondation native iOS après stabilisation du socle Web

**Statut : ACCEPTED**  
**Date : 2026-07-30**  
**Décideur : Cyril GAY**

## Contexte

ADR-TECH-045 a retenu une V1 Web responsive et installable en PWA, avec un développement natif différé. La BETA Web dispose désormais d’un backend Cloudflare/Supabase, d’une authentification réelle, d’un onboarding, de profils persistés et d’un design system premium suffisamment structurés pour ouvrir le chantier iOS sans remplacer le Web comme source de vérité.

Le fondateur demande explicitement de préparer une vraie application native iOS destinée à TestFlight puis à une soumission App Store, tout en continuant à faire évoluer la plateforme Web.

## Décision

Velvet ouvre une piste iOS native en SwiftUI dans le dépôt principal.

- Le Web reste la plateforme de référence et le backend reste la source unique de vérité.
- L’application iOS consomme les mêmes API versionnées, comptes, profils, consentements et permissions.
- La première tranche couvre : design system natif, connexion, consentements, onboarding initial et accueil.
- Les évolutions de données et de règles serveur sont partagées immédiatement.
- Les changements d’interface propres à iOS suivent des versions TestFlight/App Store.
- L’application iOS n’embarque aucun secret Supabase ou Cloudflare.
- Le contrôle anti-robot reste assuré par Cloudflare Turnstile dans un composant WebKit isolé ; l’expérience applicative reste native.
- La présentation App Store et les contenus accessibles sur iOS doivent respecter les règles Apple, sans contourner la validation.

## Conséquences

- ADR-TECH-045 reste valable pour le périmètre Web et pour l’obligation de maintenir une expérience navigateur complète.
- La phrase « les applications natives iOS et Android sont exclues du périmètre V1 » est amendée pour iOS uniquement.
- Android reste différé.
- Toute API consommée par iOS doit conserver une compatibilité versionnée ou prévoir une stratégie de migration.
- Les fonctions natives sont livrées par tranches verticales, une fois leur comportement métier stabilisé côté Web.

## Hors périmètre de cette décision

- activation des paiements réels ;
- choix définitif du compte Apple individuel ou organisation ;
- soumission immédiate à l’App Store ;
- ouverture des médias sensibles sur iOS ;
- application Android.

## Retour arrière

La piste iOS est isolée dans `ios/`. Elle peut être suspendue sans affecter la BETA Web, le backend ou les migrations Supabase.
