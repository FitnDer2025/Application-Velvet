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
- L’application iOS consomme les mêmes API, comptes, profils, consentements et permissions.
- Le périmètre natif couvre l’authentification complète, l’onboarding individuel/Couple, l’admission, l’annuaire, les événements, la messagerie et la sécurité membre.
- Les évolutions de données et de règles serveur sont partagées immédiatement.
- Les changements d’interface propres à iOS suivent des versions TestFlight/App Store.
- L’application iOS n’embarque aucun secret Supabase, Cloudflare ou Apple.
- Cloudflare Turnstile reste isolé dans WebKit ; l’expérience applicative reste native.
- La récupération utilise le schéma contrôlé `velvet://recovery`.
- La suppression de compte est effectuée par une Function authentifiée utilisant une clé de service exclusivement côté serveur.
- APNs et StoreKit 2 ne sont activés qu’après définition de leurs contrats serveur.

## Conséquences

- ADR-TECH-045 reste valable pour le Web et l’obligation de maintenir une expérience navigateur complète.
- Android reste différé.
- Toute API consommée par iOS doit conserver une compatibilité ou prévoir une migration.
- La recherche sur le lot d’annuaire est acceptable pour la BETA ; la pagination serveur devient obligatoire au changement d’échelle.
- La clé `SUPABASE_SERVICE_ROLE_KEY` nécessaire à l’effacement n’est jamais publique et doit être configurée comme secret Cloudflare.
- Les déclarations de confidentialité Apple doivent rester synchronisées avec les données réellement collectées.

## Hors périmètre

- activation immédiate des paiements réels ;
- choix définitif du compte Apple individuel ou organisation ;
- soumission immédiate à l’App Store ;
- diffusion d’albums privés explicites sur iOS ;
- application Android.

## Retour arrière

La piste iOS est isolée dans `ios/`. Elle peut être suspendue sans affecter le client Web. Les deux adaptations backend ajoutées sont rétrocompatibles : le redirect Web reste le défaut et l’effacement exige un appel explicite authentifié.
