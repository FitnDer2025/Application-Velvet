# ADR-MON-057 — Offres Velvet Découverte, Signature et Pro

- **Statut :** Acceptée
- **Date :** 2026-07-30
- **Décideur :** Cyril GAY
- **Domaine :** Monétisation / Accès / Velvet Control
- **Amende :** le hors-périmètre paiement de la recette initiale V1

## Contexte

Velvet doit préparer son ouverture commerciale sans dégrader la sécurité, les fonctions essentielles ni l’expérience des profils gratuits. L’activité et les contenus adultes imposent par ailleurs de valider par écrit l’acceptation du prestataire de paiement avant de lui transmettre des transactions réelles.

## Décision

### Membres

Deux niveaux existent :

- **Velvet Découverte**, gratuit et réellement utilisable ;
- **Velvet Signature**, accès complet payant.

Découverte comprend la recherche essentielle, trois nouvelles conversations par semaine, les conversations déjà ouvertes sans limite, dix profils suivis, un essai Velvet IA et toutes les fonctions essentielles de profil, carte, événements, albums, blocage et signalement.

Signature ajoute la recherche avancée et les recherches sauvegardées, les nouvelles conversations et suivis sans limite, les alertes de connexion des profils suivis, les alertes personnalisées et vingt générations Velvet IA par mois.

Les femmes seules dont le profil est vérifié et dont l’identité déclarée est exactement `Femme` reçoivent Signature sans paiement. Un profil Couple partage un seul abonnement. Les hommes seuls et les couples relèvent de Signature payante. Les autres identités suivent par défaut la règle payante tant qu’un arbitrage inclusif distinct n’a pas été validé.

Tarifs :

- Signature mensuel : **14,90 €** ;
- Signature trois mois : **34,90 €** ;
- Signature annuel : **99,90 €**.

### Lancement fondateur

Sans carte bancaire ni renouvellement automatique :

- 250 profils Couple : 90 jours de Signature ;
- 150 profils Homme seul : 90 jours de Signature ;
- 30 établissements : 90 jours de Velvet Pro ;
- les bêta-testeurs existants peuvent être intégrés par Velvet Control.

### Velvet Pro

Un abonnement couvre un établissement :

- **39,90 € / mois** ;
- **399 € / an** ;
- aucune commission sur les événements au lancement.

La fiche publique factuelle d’un établissement peut rester visible gratuitement. La gestion de la fiche, du CRM et des événements nécessite Velvet Pro.

### Promotions et Control

Velvet Control peut :

- attribuer ou retirer Signature et Pro ;
- suspendre temporairement, bloquer ou programmer la suppression d’un compte à J+30 ;
- créer, mettre en pause et réactiver des campagnes ;
- définir audience, durée, fenêtre de validité, plafond et limite par profil ;
- attribuer les cohortes fondatrices ;
- consulter l’historique audité.

Un code utilisé pendant une période déjà payée commence après la fin de cette période.

### Paiement

Le moteur de droits et le catalogue tarifaire sont indépendants du prestataire. Le parcours utilisera une page de paiement hébergée afin que Velvet ne conserve aucune donnée de carte.

Le raccordement réel reste bloqué tant que le prestataire compatible avec l’activité et les contenus de Velvet n’a pas donné son accord écrit. Verotel, CCBill et Segpay constituent la présélection opérationnelle ; aucun n’est retenu par cette ADR.

## Conséquences

- les droits sont calculés côté serveur et rattachés à la fiche, pas au navigateur ;
- les quotas sont transactionnels et ne peuvent pas être contournés par l’interface ;
- la migration SQL 0026 doit être exécutée par Cyril avant activation commerciale ;
- avant cette migration, la bêta conserve l’accès complet pour éviter une rupture ;
- les avantages gratuits selon le genre doivent faire l’objet d’une validation juridique avant communication publique et vente réelle ;
- la vente reste désactivée tant que le partenaire de paiement n’est pas validé.

## Critères d’acceptation

- les tarifs et plans existent dans la base ;
- Control pilote les accès, suspensions, suppressions, campagnes et cohortes ;
- Découverte conserve les fonctions essentielles de sécurité ;
- les quotas conversations, suivis et IA sont appliqués côté serveur ;
- les recherches sauvegardées sont réservées à Signature côté serveur ;
- un code promotionnel n’est affiché qu’une fois lors de sa création ;
- aucune donnée bancaire n’est stockée par Velvet ;
- l’interface ne prétend jamais qu’un paiement est disponible avant le raccordement réel.
