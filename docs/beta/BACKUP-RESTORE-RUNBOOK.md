# Sauvegarde et restauration — recette zéro dépense

## Périmètre

Les scripts utilisent les outils PostgreSQL standards. `pg_dump` produit un dump custom sans propriétaires ni privilèges, ensuite chiffré localement en AES-256-GCM. La restauration refuse par défaut la base source et toute cible assimilée à la production.

Aucun secret, dump clair ou sauvegarde chiffrée ne doit être committé, joint à un ticket ou copié dans un espace partagé non approuvé.

## Sauvegarde

Pré-requis : `pg_dump`, une URL PostgreSQL en lecture et une clé aléatoire de 32 octets conservée séparément du fichier.

```bash
export VELVET_BACKUP_DATABASE_URL='postgresql://…'
export VELVET_BACKUP_KEY='clé-base64-ou-hex-32-octets'
export VELVET_BACKUP_OUTPUT='/chemin/velvet-YYYY-MM-DD.vbak'
npm run backup:database
```

Après création : contrôler les permissions du fichier, enregistrer sa date et son empreinte dans le registre interne, puis retirer les variables de la session. La fréquence et la durée de conservation restent à valider dans la politique RGPD ; une sauvegarde doit au minimum précéder chaque migration manuelle.

## Restauration de recette

La cible doit être une base PostgreSQL isolée, vide ou jetable, sans donnée membre réelle.

```bash
export VELVET_RESTORE_INPUT='/chemin/velvet-YYYY-MM-DD.vbak'
export VELVET_RESTORE_DATABASE_URL='postgresql://…/velvet_recipe'
export VELVET_BACKUP_KEY='clé-base64-ou-hex-32-octets'
export VELVET_RESTORE_CONFIRM='RESTORE_RECIPE_DATABASE'
npm run restore:recipe
```

Ne jamais poser `VELVET_RESTORE_PRODUCTION_CONFIRM` pendant une recette normale. Cette seconde confirmation n’est qu’un arrêt d’urgence technique ; une restauration de production exigerait une décision explicite de la direction et un plan d’incident.

## Preuves après restauration

- connexion réussie avec les rôles de recette ;
- compte, profil et consentements présents ;
- RLS toujours active sur toutes les tables contrôlées ;
- message et média privé invisibles depuis un autre compte ;
- nombre de migrations identique ;
- export puis suppression d’un compte synthétique réussis ;
- dump clair temporaire absent après le script.

Le test cryptographique automatisé prouve chiffrement, authentification et détection d’altération. La preuve « restauration PostgreSQL réelle » n’est acquise qu’après exécution de cette procédure sur une base isolée.
