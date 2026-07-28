# Déploiement Cloudflare Pages — Velvet BETA

## Configuration Git recommandée

- dépôt : `Velvet-Application/Application-Velvet` ;
- branche de production BETA : une branche dédiée à créer après validation ;
- commande de build : `npm run build:beta` ;
- dossier de sortie : `apps/beta/dist` ;
- répertoire racine : racine du dépôt ;
- nom du projet : `velvet-beta`.

## Routes

- `/` : connexion et onboarding ;
- `/membres/` : Velvet Membres V6 verrouillée ;
- `/pro/` : Velvet Pro ;
- `/control/` : Velvet Control et Intelligence ;
- `/legal/` : documents BETA.

## Sécurité

- Le site est désindexé.
- Les en-têtes empêchent l’intégration dans un autre site.
- La politique CSP actuelle reste transitoire car les prototypes utilisent du JavaScript inline et `eval`.
- Aucune clé Supabase administrative ne doit être configurée dans Pages.
- Seules `SUPABASE_URL` et la clé publiable peuvent être exposées au navigateur après activation des politiques RLS.

## Action manuelle nécessaire

La création du projet Cloudflare demande une connexion au compte de Cyril et l’autorisation d’accéder au dépôt GitHub. Après connexion :

1. Workers & Pages → Create application → Pages → Connect to Git ;
2. sélectionner le dépôt ;
3. reporter les paramètres ci-dessus ;
4. ne pas ouvrir publiquement l’URL avant que l’authentification réelle soit active.

