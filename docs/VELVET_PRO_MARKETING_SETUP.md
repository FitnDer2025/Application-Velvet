# Zwit Marketing — raccordement Meta et TikTok

Zwit Marketing transforme une soirée Zwit Pro et un rendu Zwit Studio en campagne sociale validée, programmée et suivie.

## 1. Prérequis Supabase

Exécuter dans l’éditeur SQL Supabase :

```text
infra/supabase/migrations/0044_pro_marketing_hub.sql
```

La migration ajoute :

- connexions sociales chiffrées par établissement ;
- campagnes liées à l’agenda et aux rendus Studio ;
- publications programmées ;
- métriques ;
- journal d’audit ;
- politiques RLS basées sur les rôles de l’établissement.

## 2. Secrets Cloudflare

Ajouter exclusivement dans **Cloudflare → Worker Zwit → Settings → Variables and Secrets** :

```text
META_APP_ID
META_APP_SECRET
META_GRAPH_VERSION
TIKTOK_CLIENT_KEY
TIKTOK_CLIENT_SECRET
SOCIAL_TOKEN_ENCRYPTION_KEY
SOCIAL_OAUTH_STATE_SECRET
SUPABASE_SERVICE_ROLE_KEY
```

Ajouter comme variable non secrète :

```text
VELVET_PUBLIC_ORIGIN=https://<domaine-public-velvet>
```

Règles :

- `SOCIAL_TOKEN_ENCRYPTION_KEY` : valeur aléatoire longue et dédiée au chiffrement AES-GCM ;
- `SOCIAL_OAUTH_STATE_SECRET` : autre valeur aléatoire longue, utilisée pour signer les retours OAuth et les liens média temporaires ;
- ne jamais réutiliser une clé Supabase ou un secret Meta/TikTok pour ces deux valeurs ;
- ne jamais ajouter ces secrets dans GitHub, le navigateur ou les logs.

## 3. Application Meta

Créer une application Meta Business pour Zwit et configurer l’URL de redirection exacte :

```text
https://<domaine-public-velvet>/api/pro/marketing/oauth/meta/callback
```

Permissions demandées par le produit :

```text
pages_show_list
pages_read_engagement
pages_manage_posts
instagram_basic
instagram_content_publish
instagram_manage_insights
```

Le professionnel autorise Zwit, puis choisit la Page Facebook qu’il administre. Le compte Instagram professionnel associé à cette Page est détecté et mémorisé.

Zwit ne stocke jamais le mot de passe Meta. Les jetons sont chiffrés côté Worker et ne sont jamais renvoyés au navigateur.

Avant une ouverture commerciale, finaliser :

- vérification de l’entreprise Zwit dans Meta Business ;
- politique de confidentialité publique ;
- suppression des données et révocation des accès ;
- démonstration vidéo du parcours d’autorisation ;
- examen des permissions utilisées ;
- test avec une Page Facebook et un compte Instagram professionnel appartenant à Velvet.

## 4. Application TikTok

Créer une application développeur TikTok et configurer l’URL de redirection exacte :

```text
https://<domaine-public-velvet>/api/pro/marketing/oauth/tiktok/callback
```

Scopes utilisés :

```text
user.info.basic
video.publish
video.upload
```

Le mode par défaut de Zwit est **l’envoi en brouillon TikTok**. La publication directe reste désactivée tant que l’application et le client de publication ne sont pas audités.

Avant l’ouverture commerciale, finaliser :

- vérification de l’URL et du domaine Zwit ;
- audit de la Content Posting API ;
- présentation claire du compte destinataire ;
- aperçu du contenu avant envoi ;
- choix explicite de la confidentialité ;
- déclaration du contenu commercial ;
- validation du comportement de publication photo et vidéo.

## 5. Planificateur Cloudflare

Le Worker exécute :

```text
*/5 * * * *
```

À chaque passage, il réclame les publications échues, verrouille chaque ligne avant envoi, tente la diffusion, mémorise la réponse de la plateforme et applique au maximum trois tentatives.

Une publication n’est jamais affichée comme publiée sans confirmation du fournisseur.

## 6. Domaine média

Meta et TikTok doivent pouvoir télécharger temporairement l’affiche ou la vidéo depuis le domaine public Velvet.

Le endpoint suivant est public uniquement avec une signature HMAC courte durée :

```text
/api/pro/marketing/media
```

Le fichier source reste dans le bucket privé `velvet-pro-studio`. Le lien temporaire expire et ne permet pas de parcourir les autres créations.

## 7. Parcours de recette

1. Créer une soirée dans Zwit Pro.
2. Créer et valider une affiche dans Studio IA.
3. Ouvrir **Marketing**.
4. Connecter Meta et/ou TikTok.
5. Sélectionner la soirée et l’affiche.
6. Générer puis relire les textes.
7. Vérifier le contrôle de conformité.
8. Valider humainement la campagne.
9. Programmer une publication unique ou la séquence J-21 / J-10 / J-3 / Jour J.
10. Vérifier le statut dans Publications.
11. Vérifier les liens et métriques renvoyés par la plateforme.
12. Révoquer chaque connexion et confirmer que le token chiffré est supprimé.

## 8. Critères de production

Le module n’est prêt pour une diffusion publique que lorsque :

- la migration 0044 est appliquée ;
- tous les secrets sont présents dans Cloudflare ;
- le domaine public définitif est configuré ;
- les audits Meta et TikTok sont acceptés ;
- les publications de recette sont confirmées sur des comptes Zwit ;
- les erreurs et révocations ont été testées ;
- les textes et visuels respectent les règles de chaque plateforme ;
- le suivi des métriques ne présente aucune donnée inventée.
