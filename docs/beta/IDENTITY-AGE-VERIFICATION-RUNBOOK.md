# Vérification identité + majorité — contrat V1.1

## Décision

L’accès communautaire est refusé lorsque `IDENTITY_AGE_VERIFICATION_REQUIRED=true` tant que le compte ne possède pas simultanément `identity_verified=true`, `majority_verified=true`, un statut `verified` et une échéance valide. Le verrou est appliqué dans `memberSession`, donc avant l’annuaire, les messages, les lieux, les médias et les actions sociales.

Profil, paramètres, déconnexion, démarrage de la vérification et export des données restent accessibles afin qu’une personne puisse régulariser sa situation ou exercer ses droits.

Zwit ne crée jamais de statut vérifié en interne et ne conserve ni pièce d’identité, ni identité civile, ni date de naissance, ni référence brute du prestataire.

## Variables serveur

| Variable | Usage |
|---|---|
| `IDENTITY_AGE_VERIFICATION_REQUIRED` | `true` pour rendre le verrou bloquant |
| `IDENTITY_AGE_VERIFICATION_PROVIDER` | Identifiant stable du prestataire |
| `IDENTITY_AGE_VERIFICATION_START_URL` | URL HTTPS du parcours hébergé par le prestataire |
| `IDENTITY_AGE_VERIFICATION_CALLBACK_SECRET` | Secret HMAC partagé, stocké uniquement côté serveur |
| `SUPABASE_SERVICE_ROLE_KEY` | Écriture serveur du résultat et de l’audit |
| `VELVET_RUNTIME_MODE` | `internal_recipe` uniquement pendant la recette fermée |
| `VELVET_INTERNAL_RECIPE_USER_IDS` | UUID autorisés, séparés par des virgules, jamais committés |

L’exception de recette n’est active que si le mode vaut exactement `internal_recipe` et si l’UUID du compte est présent dans l’allowlist. Elle ne crée pas de badge et ne modifie pas le statut de vérification.

## Callback signé

Le prestataire renvoie : `state`, `result`, `identity_verified`, `majority_verified`, `reference`, `expires_at`, `event_id`, `issued_at`. La signature HMAC-SHA-256 est transmise dans `X-Velvet-Verification-Signature` ou, si le prestataire ne sait pas poser d’en-tête, dans `signature`.

La chaîne canonique est constituée des huit valeurs encodées avec `encodeURIComponent`, dans cet ordre, séparées par un saut de ligne. Le callback refuse :

- une signature invalide ;
- un événement vieux de plus de dix minutes ;
- un état inconnu, expiré ou déjà consommé ;
- un prestataire différent de celui de la session ;
- un succès sans les deux confirmations ;
- une échéance passée ou supérieure à deux ans.

La référence et l’identifiant d’événement sont hachés avant journalisation.

## Activation externe

1. Valider juridiquement le parcours 18+ et le sous-traitant.
2. Configurer les secrets serveur et réaliser un callback signé de bout en bout sur l’environnement de recette.
3. Vérifier succès, refus, expiration, répétition et altération de signature.
4. Retirer `VELVET_RUNTIME_MODE=internal_recipe` et l’allowlist.
5. Activer `IDENTITY_AGE_VERIFICATION_REQUIRED=true`.
6. Exécuter la recette avec un profil individuel et les deux partenaires d’un couple.

Sans prestataire raccordé, la recette interne reste possible par allowlist ; aucune ouverture externe n’est autorisée.
