# Création du projet Supabase Paris

## Projet

1. Créer une organisation Supabase dédiée à Velvet.
2. Créer un projet sur le forfait Free.
3. Choisir la région spécifique **West EU (Paris) — `eu-west-3`**.
4. Utiliser un mot de passe de base généré et le conserver dans un gestionnaire de mots de passe.
5. Activer la MFA sur le compte Supabase de l’administrateur.

La région d’un projet Supabase ne se change pas directement. Une erreur de région impose une migration vers un nouveau projet.

## Authentification

Dans Authentication :

- activer e-mail + mot de passe ;
- exiger la confirmation de l’e-mail ;
- fixer une durée raisonnable pour les OTP ;
- configurer les URL de redirection uniquement vers le domaine BETA ;
- activer CAPTCHA avant l’élargissement de la BETA ;
- ne pas activer les connexions sociales à ce stade ;
- imposer MFA aux rôles Control et aux administrateurs Pro dès que le parcours est disponible.

## Migrations

Appliquer dans l’ordre :

1. `0001_velvet_beta_core.sql`
2. `0002_velvet_beta_rls.sql`
3. `0003_velvet_beta_storage.sql`
4. `0004_fix_invite_crypto_schema.sql`

Puis ouvrir le Security Advisor et corriger toute alerte avant de connecter les interfaces.

## Première invitation

Le code brut n’est jamais stocké. Exemple à exécuter dans le SQL Editor en remplaçant les valeurs :

```sql
insert into public.beta_invites
  (email,code_hash,intended_role,expires_at)
values
  (
    'testeur@example.fr',
    crypt('CODE-LONG-GENERE',gen_salt('bf')),
    'member',
    now() + interval '14 days'
  );
```

Le formulaire d’inscription transmettra ce code dans `options.data.invite_code`. Le trigger refusera automatiquement une adresse absente de la liste, un code incorrect, expiré, révoqué ou déjà consommé.

Après confirmation de l’e-mail, l’activation exige quatre validations séparées et
versionnées : conditions BETA, information de confidentialité, déclaration de
majorité et consentement explicite au traitement des données sensibles choisies
par le membre.

## Variables Cloudflare

Variables publiables :

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

Variables interdites dans Cloudflare Pages et dans le navigateur :

- clé `service_role` ;
- mot de passe PostgreSQL ;
- jeton personnel Supabase ;
- secret JWT ;
- clés de chiffrement.

Les opérations administratives passent par une Edge Function ou un serveur sécurisé et lisent leurs secrets depuis le gestionnaire de secrets.

## Contrôles avant ouverture

- tentative d’inscription sans invitation refusée ;
- tentative avec mauvais e-mail refusée ;
- compte sans consentement incapable de lire les profils ;
- membre incapable de modifier le profil d’un autre membre ;
- Pro incapable d’administrer un autre établissement ;
- membre non autorisé incapable de lire un média privé ;
- utilisateur bloqué invisible dans les deux sens ;
- utilisateur externe incapable de lire une conversation ;
- rôle Membre incapable de lire l’audit Control ;
- retrait d’un accès album immédiatement effectif ;
- export et suppression d’un compte test validés.
