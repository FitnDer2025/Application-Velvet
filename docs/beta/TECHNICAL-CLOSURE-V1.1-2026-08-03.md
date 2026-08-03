# Fermeture des blocages techniques V1.1 — 3 août 2026

## État visé

| Blocage | Preuve code/automatisation | Reste avant bêta externe |
|---|---|---|
| Identité + majorité | verrou API central, sas Web, callback HMAC, anti-rejeu, aucune pièce stockée | choisir/valider et raccorder le prestataire, activer la variable serveur |
| Export des données | téléchargement authentifié JSON, RLS, médias propriétaires temporaires, registre DSR | exécuter avec deux comptes réels de recette et valider le contenu métier/juridique |
| Dépendances et CSP | lockfile, `npm ci`, audit high, scan source, retrait de `unsafe-eval` et d’Unsplash runtime | traiter `unsafe-inline` dans un lot de durcissement ultérieur |
| Sauvegarde/restauration | format AES-256-GCM, garde-fous de cible, test d’altération, runbook | exécuter `pg_dump`/`pg_restore` sur une base de recette isolée |
| Incident | chaîne de détection, contention, restauration, notification et registre | nommer les rôles et faire un exercice sur table |
| Multi-appareils | Chromium desktop, Chromium Android et WebKit iPhone sur le build exact | exécuter les 12 parcours connectés et valider un iPhone physique/PWA |

## Limite honnête

Cette livraison ferme les défauts de code et fournit des preuves gratuites reproductibles. Elle ne transforme pas en preuve un service externe non raccordé, une restauration distante non exécutée ou un test physique non réalisé. Ces trois éléments restent des conditions de passage, pas des anomalies applicatives.
