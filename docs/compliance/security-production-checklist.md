# Checklist sécurité de production

## Identités et accès

- [ ] Tous les comptes Control sont nominatifs.
- [ ] Tous les comptes Control ont un facteur TOTP vérifié et une session AAL2.
- [ ] Aucun secret ni compte administrateur n’est partagé.
- [ ] Les rôles sont revus avant lancement puis trimestriellement.
- [ ] Support et audit n’accèdent pas aux contenus intimes par défaut.
- [ ] Les comptes dormants et prestataires sont désactivés rapidement.
- [ ] Les procédures de récupération MFA sont documentées, contrôlées et journalisées.

## Secrets et chiffrement

- [ ] `moderation_evidence_key` existe dans Supabase Vault, avec rotation définie.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` est uniquement disponible au worker et aux fonctions strictement nécessaires.
- [ ] Les secrets Cloudflare/Supabase/Resend/paiement ne figurent ni dans GitHub ni dans les logs.
- [ ] Les champs de profil intime disposent d’un chiffrement applicatif ou d’une séparation cryptographique validée.
- [ ] Les clés ont un propriétaire, une version, une date de rotation et une procédure de révocation.
- [ ] TLS est imposé partout et les certificats sont vérifiés.

## Base et stockage

- [ ] Toutes les tables exposées ont RLS activée et des tests négatifs.
- [ ] Le rôle `anon` ne peut lire aucune donnée métier privée.
- [ ] Le bucket `velvet-media` est privé.
- [ ] Les URLs signées ont une durée minimale compatible avec l’usage.
- [ ] L’accès aux albums expirés ou révoqués est testé.
- [ ] La file `storage_deletion_queue` est surveillée.
- [ ] Un compte de test avec médias et pièces jointes a été supprimé intégralement.

## Sauvegardes

- [ ] Les sauvegardes sont chiffrées et hébergées dans une région validée.
- [ ] La rétention et la rotation sont contractuellement documentées.
- [ ] Une restauration complète a été testée.
- [ ] Les droits d’accès aux sauvegardes sont distincts des droits d’exploitation courants.
- [ ] La disparition des données supprimées après rotation est démontrable.

## Application et réseau

- [ ] En-têtes CSP, HSTS, anti-clickjacking, Referrer-Policy et Permissions-Policy vérifiés.
- [ ] Cookies `HttpOnly`, `Secure`, `SameSite=Strict` confirmés en production.
- [ ] Turnstile/rate limiting actifs sur inscription, connexion, récupération et notice DSA.
- [ ] Limites de taille, MIME réel et antivirus des fichiers validés.
- [ ] Dépendances et images de déploiement analysées.
- [ ] Environnements développement, recette et production séparés.
- [ ] Données réelles interdites en développement.

## Journalisation et détection

- [ ] Connexions privilégiées, changements de rôle, consentements, exports, modérations et purges sont journalisés.
- [ ] Les logs ne contiennent pas de jetons, mots de passe, photos, messages ou données sexuelles en clair.
- [ ] Alertes sur accès anormal, volume d’exports, échecs MFA et erreurs RLS.
- [ ] Horloges synchronisées et identifiants de requête corrélables.
- [ ] Rotation des logs alignée sur la politique validée.

## Continuité et incidents

- [ ] Astreinte, suppléants et contacts prestataires renseignés.
- [ ] Exercice de compromission administrateur réalisé.
- [ ] Exercice d’exposition d’album privé réalisé.
- [ ] Décision de notification et chronologie de 72 heures testées.
- [ ] Modèles de communication CNIL/utilisateurs préparés.
- [ ] Assurance et conseil juridique informés des procédures.

## Validation indépendante

- [ ] Revue SQL/RLS indépendante.
- [ ] Pentest web/API/stockage/authentification.
- [ ] Correction de toutes les vulnérabilités critiques et élevées.
- [ ] Retest signé.
- [ ] Go-live approuvé par technique, sécurité, RGPD et direction.
