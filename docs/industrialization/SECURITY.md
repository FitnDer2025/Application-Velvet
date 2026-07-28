# Velvet — socle de sécurité

## Principes

Velvet manipule des données intimes. La confidentialité n’est pas une option visuelle : elle doit être garantie par le serveur, la base, les clés et les procédures.

## Protections déjà intégrées au socle

- mots de passe scrypt avec sel et pepper ;
- jetons d’accès EdDSA courts ;
- refresh tokens opaques, hachés et renouvelés ;
- séparation stricte des audiences Membres, Pro et Control ;
- autorisations RBAC côté serveur ;
- chiffrement AES-256-GCM des champs privés ;
- requêtes SQL paramétrées ;
- limites de taille des corps JSON ;
- limitation de fréquence générale et renforcée sur l’authentification ;
- CORS sur liste blanche ;
- cookies HttpOnly et SameSite ;
- en-têtes HTTP restrictifs ;
- journal d’audit append-only et chaîné ;
- identifiant de requête pour chaque opération ;
- absence de secrets dans le dépôt.

## Avant une ouverture publique

Les points suivants restent obligatoires :

1. hébergement UE et contrats de sous-traitance RGPD ;
2. secret manager et rotation automatique des clés ;
3. HTTPS de bout en bout et certificats gérés ;
4. rate limiting distribué dans Redis ;
5. protection anti-bot et détection d’abus ;
6. MFA pour Control et les comptes Pro sensibles ;
7. validation d’email et récupération de compte ;
8. stockage média privé avec URL signée et analyse antivirus ;
9. sauvegardes PostgreSQL chiffrées et tests de restauration ;
10. réplication externe du journal d’audit ;
11. SAST, analyse des dépendances et secret scanning ;
12. tests d’intrusion indépendants ;
13. registre de traitements, durées de conservation et parcours RGPD ;
14. politique de gestion des incidents et notification CNIL ;
15. revue juridique du contrôle d’âge et des contenus.

## Classification minimale

| Niveau | Exemples | Traitement |
|---|---|---|
| Public | nom d’un établissement publié | base standard, cache autorisé |
| Membres | bio, ville approximative, sorties | accès authentifié |
| Privé | poids, préférences, localisation exacte | chiffrement applicatif |
| Très sensible | identité vérifiée, signalements, éléments de preuve | chiffrement, RBAC renforcé, audit obligatoire |

## Règle de non-régression

Une nouvelle fonctionnalité ne peut pas :

- exposer une donnée privée par défaut ;
- accepter un rôle transmis par le navigateur ;
- stocker un refresh token en clair ;
- contourner l’audit d’une action sensible ;
- dupliquer une entité déjà détenue par la source de vérité ;
- rendre une sanction définitive automatique sans règle explicitement validée.
