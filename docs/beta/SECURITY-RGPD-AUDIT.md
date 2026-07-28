# Velvet BETA — audit sécurité et RGPD

Date de l’audit initial : 28 juillet 2026  
Périmètre : Velvet Membres V6, Velvet Pro, Velvet Control / Intelligence, connexion et onboarding, API et schéma PostgreSQL existants.

> Ce document est un audit technique et une préparation à la conformité. Il ne remplace pas la validation d’un avocat spécialisé, d’un DPO ni l’analyse du champ d’application du référentiel Arcom.

## Décision de publication

**Statut actuel : ouverture à de vrais testeurs bloquée.**

Les interfaces peuvent rester accessibles comme démonstrations avec des données fictives. Elles ne doivent pas encore recevoir de photos intimes, de conversations réelles, de coordonnées précises ou de données relatives à la vie sexuelle.

## Synthèse

Velvet traite par nature des données révélant la vie sexuelle et l’orientation sexuelle. Elles relèvent de l’article 9 du RGPD et exigent un consentement explicite, spécifique, libre, éclairé, traçable et révocable. La combinaison de ces données avec la géolocalisation, le profilage de compatibilité, la messagerie et la modération crée un risque élevé.

Une AIPD doit être réalisée avant le traitement réel. Une revue juridique doit également déterminer si certaines fonctionnalités ou certains contenus placent Velvet dans le champ des obligations françaises relatives aux contenus pornographiques et à la vérification de l’âge.

## Écarts bloquants — priorité P0

| Référence | Écart | Risque | Correction obligatoire |
|---|---|---|---|
| P0-01 | Profils, messages, photos et préférences enregistrés dans `localStorage` | Toute personne utilisant le navigateur peut lire les données ; absence de contrôle serveur | Supprimer le stockage local des données réelles et utiliser Supabase avec RLS |
| P0-02 | Connexion, récupération et OTP de démonstration | Contournement total de l’identité | Remplacer par Supabase Auth, confirmation d’e-mail et récupération réelles |
| P0-03 | Inscription ouverte, sans liste d’invités vérifiée côté serveur | Accès non maîtrisé à la BETA | Consommer une invitation côté serveur avant la création du compte |
| P0-04 | Absence de consentement article 9 séparé et versionné | Traitement illicite de données sensibles | Ajouter un consentement explicite distinct des CGU et conserver sa preuve |
| P0-05 | Absence de politiques RLS sur la future base Supabase | Exposition possible de l’ensemble des données | RLS obligatoire sur chaque table et chaque bucket |
| P0-06 | Albums privés sans stockage privé ni liens temporaires | Divulgation de contenus intimes | Bucket privé, contrôle par album, autorisation révocable et URL signée courte |
| P0-07 | Pas de droit d’accès, export, rectification, retrait et effacement complet | Droits RGPD inexécutables | Créer un centre de confidentialité et des traitements serveur audités |
| P0-08 | Pas de registre de traitements, AIPD ni durées de conservation validées | Non-conformité organisationnelle | Finaliser le registre, l’AIPD et la politique de conservation avant ouverture |
| P0-09 | Vérification d’âge limitée à une déclaration | Risque d’accès de mineurs | Mettre en place un parcours 18+ adapté au risque et obtenir une analyse juridique Arcom |
| P0-10 | Actions sensibles de Control uniquement simulées dans le navigateur | Fausse sécurité et absence de preuve | Exécuter toute sanction via une fonction serveur avec RBAC, double confirmation et audit |

## Écarts majeurs — priorité P1

| Référence | Écart | Correction |
|---|---|---|
| P1-01 | Images chargées depuis Unsplash | Héberger localement les médias de démonstration et interdire les appels tiers non indispensables |
| P1-02 | Nombreux `innerHTML`, attributs `onclick` et usage d’`eval` dans le wrapper V6 | Remplacer progressivement par composants DOM et écouteurs ; supprimer `eval` avant données réelles |
| P1-03 | Impossible d’appliquer une CSP stricte aux interfaces actuelles | Construire une interface BETA sans JavaScript inline puis appliquer une CSP sans `unsafe-eval` |
| P1-04 | Géolocalisation non limitée par une politique serveur | Stocker une zone approximative ; ne jamais exposer les coordonnées exactes aux membres |
| P1-05 | Pas de mécanisme d’expiration des accès aux albums | Ajouter expiration, révocation, journal d’accès et notification au propriétaire |
| P1-06 | Pas de mécanisme complet de blocage et signalement inter-applications | Ajouter blocage bilatéral, signalement, preuve minimale et traitement Control |
| P1-07 | Journaux techniques susceptibles de conserver IP et identifiants sans durée | Définir finalité, accès et purge automatique |
| P1-08 | Limiteur de requêtes API en mémoire | Utiliser une limitation distribuée ou celle de l’infrastructure avant ouverture publique |
| P1-09 | Pas de scan antivirus ni de contrôle de format des médias | Vérifier type réel, taille, métadonnées, antivirus et contenu avant publication |
| P1-10 | Absence de sauvegarde et de test de restauration sur le forfait gratuit | Mettre en place un export chiffré indépendant et tester la restauration |

## Points positifs déjà présents

- séparation des rôles Membres, Pro et Control dans le socle serveur ;
- chiffrement applicatif AES-256-GCM prévu pour les champs privés ;
- jetons courts et rotation des sessions dans l’API existante ;
- requêtes SQL paramétrées ;
- journal d’audit append-only et chaîné ;
- en-têtes de sécurité sur l’API ;
- principe de profil et d’albums privés non publics par défaut ;
- architecture de source de vérité et outbox déjà documentée.

## Bases légales proposées

La base légale doit être confirmée dans le registre et l’AIPD.

| Traitement | Base envisagée |
|---|---|
| Création du compte, fourniture du service, réservations | Exécution du contrat |
| Vie sexuelle, orientation, pratiques et recherches | Consentement explicite, article 9 |
| Géolocalisation précise facultative | Consentement spécifique |
| Modération, lutte contre la fraude et sécurité | Intérêt légitime documenté ; obligations légales selon le cas |
| Conservation de preuves de consentement et de sanctions | Obligation légale ou intérêt légitime documenté |
| Prospection Velvet | Consentement lorsque requis |
| Prospection de partenaires | Consentement séparé, jamais déduit de l’inscription |

## Règles BETA immédiates

1. BETA accessible uniquement sur invitation nominative.
2. Testeurs majeurs, e-mail confirmé et consentements versionnés.
3. Aucun média sexuellement explicite pendant la phase de validation sécurité.
4. Aucune adresse personnelle exacte visible dans les interfaces.
5. Données de démonstration clairement séparées des données des testeurs.
6. Comptes Control et Pro sensibles protégés par MFA avant usage réel.
7. Aucune clé `service_role` ou secret dans le navigateur ou GitHub.
8. Toute action de modération réelle passe par le serveur et le journal d’audit.
9. Possibilité de fermer immédiatement la BETA et de révoquer toutes les sessions.
10. Export chiffré et procédure de restauration testée avant les premières données réelles.

## Conditions de passage au vert

- [ ] identité du responsable de traitement et coordonnées de contact validées ;
- [ ] mentions légales, CGU et politique de confidentialité validées ;
- [ ] registre de traitements complété ;
- [ ] AIPD approuvée ;
- [ ] décision juridique documentée sur la vérification d’âge ;
- [ ] Supabase Paris créé et DPA accepté ;
- [ ] schéma et RLS testés par tests négatifs ;
- [ ] authentification réelle et invitations actives ;
- [ ] droits RGPD opérationnels ;
- [ ] stockage privé et révocation des albums testés ;
- [ ] sauvegarde et restauration testées ;
- [ ] scan de sécurité et revue des dépendances réussis ;
- [ ] test d’intrusion ciblé avant ouverture plus large.

