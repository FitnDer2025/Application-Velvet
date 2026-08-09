# Déploiement Cloudflare Workers + Static Assets — Zwit BETA

Les nouveaux comptes Cloudflare sont orientés vers Workers avec Static Assets
plutôt que vers l’ancien formulaire Pages. Cette architecture publie les mêmes
fichiers statiques sur le réseau Cloudflare et exécute la protection
d’authentification avant les routes privées.

## Configuration Git recommandée

- dépôt : `Velvet-Application/Application-Velvet` ;
- branche de production BETA : une branche dédiée à créer après validation ;
- commande de build : `npm run build:beta` ;
- commande de déploiement : `npx wrangler deploy` ;
- dossier d’assets : `apps/beta/dist` ;
- répertoire racine : racine du dépôt ;
- nom du projet : `velvet-beta`.

Le dossier `functions/` contient la passerelle d’authentification Cloudflare et
`apps/beta/worker/index.js` l’expose dans le Worker. Le jeton
de renouvellement Supabase est conservé dans un cookie `HttpOnly`, `Secure` et
`SameSite=Strict` ; il n’est jamais écrit dans `localStorage`.

## Routes

- `/` : connexion et onboarding ;
- `/membres/` : Zwit Membres V6 verrouillée ;
- `/pro/` : Zwit Pro ;
- `/control/` : Zwit Control et Intelligence ;
- `/legal/` : documents BETA.

## Sécurité

- Le site est désindexé.
- Les en-têtes empêchent l’intégration dans un autre site.
- La politique CSP actuelle reste transitoire car les prototypes utilisent du JavaScript inline et `eval`.
- Aucune clé Supabase administrative ne doit être configurée dans Pages.
- Seules `SUPABASE_URL` et la clé publiable peuvent être exposées au navigateur après activation des politiques RLS.
- Les routes `/membres/`, `/pro/` et `/control/` sont protégées côté serveur et contrôlées par rôle.

## Action manuelle nécessaire

La création du projet Cloudflare demande une connexion au compte de Cyril et l’autorisation d’accéder au dépôt GitHub. Après connexion :

1. Workers & Pages → Create application → Continue with GitHub ;
2. sélectionner le dépôt ;
3. reporter les paramètres ci-dessus ;
4. ne pas ouvrir publiquement l’URL avant que l’authentification réelle soit active.
