# Recette utilisateur complète — Velvet BETA

> Complément V1.1 : `npm run recipe:browser` exécute désormais le build exact dans Chromium desktop, Chromium Android et WebKit iPhone. Cette preuve couvre le rendu, les débordements et le menu tactile. Elle ne remplace pas les scénarios connectés ci-dessous ni l’essai sur un iPhone physique installé en PWA.

Cette recette valide les parcours réels avec des comptes de test invités. Chaque
action doit être confirmée à l’écran après relecture de Supabase. Une réussite
visuelle sans persistance serveur est considérée comme un échec.

## Préparation

- appliquer toutes les migrations jusqu’à `0020_velvet_venue_catalog.sql` ;
- utiliser quatre adresses de test distinctes : membre individuel, partenaire A,
  partenaire B et professionnel ;
- générer les invitations depuis Velvet Control ;
- ne jamais utiliser de données d’identité ou de photos de personnes non
  consentantes ;
- conserver un établissement du catalogue en mode non attribué pour contrôler le
  parcours de prospection.

## Scénarios

| # | Parcours | Action principale | Résultat obligatoire |
|---|---|---|---|
| 1 | Individuel | Créer le compte, confirmer l’e-mail, compléter la fiche et ajouter au moins 3 photos | Le profil est relu après chaque sauvegarde ; la communauté reste verrouillée jusqu’à l’admission photo |
| 2 | Couple A | Créer la fiche commune, l’histoire, les recherches, les pratiques et 3 photos communes | Une seule fiche couple est créée et le partenaire A ne peut modifier que sa fiche personnelle |
| 3 | Couple B | Envoyer l’invitation nominative puis compléter la seconde fiche depuis le lien reçu | Le partenaire B rejoint le même couple et ne peut modifier que sa fiche personnelle |
| 4 | Photos | Ajouter, remplacer puis supprimer une photo ; contrôler la décision IA | Le fichier et `media_assets` restent cohérents ; aucun fichier orphelin après un échec |
| 5 | Albums | Créer un album public et un privé, ajouter plusieurs photos, accorder puis révoquer un accès limité | Le public est visible par tous les admis ; le privé ne révèle rien hors accès actif |
| 6 | Réactions | Poser puis modifier un J’aime, J’aime beaucoup ou J’adore sur une photo accessible | Une seule réaction personnelle est enregistrée et les compteurs agrégés sont identiques pour les membres autorisés |
| 7 | Conversation | Ouvrir une conversation depuis un profil et échanger dans les deux sens | Une seule conversation directe existe ; les messages survivent à une reconnexion |
| 8 | Sortie | S’inscrire, consulter les participants puis se désinscrire | La capacité ne peut pas être dépassée et le statut est relu depuis Supabase |
| 9 | Établissement | Ajouter un lieu aux favoris, déclarer une visite puis une envie d’y aller | Les trois relations sont persistées et leurs compteurs sont visibles dans le catalogue |
| 10 | Control | Générer une invitation, attribuer une fiche recensée à un compte Pro | Le code n’est jamais stocké en clair ; la fiche attribuée reste Pro inactive |
| 11 | Pro inactif | Ouvrir le compte professionnel avant abonnement | Agenda, galerie, mini-site éditable et publication restent verrouillés |
| 12 | Pro actif | Passer le compte en essai, compléter la fiche et publier une soirée | Le mini-site et la soirée deviennent visibles côté Membres ; les inscrits remontent dans le CRM Pro |

## Contrôles de séparation

- un membre ne lit ni les invitations Control ni les données privées Pro ;
- un professionnel ne modifie que ses établissements attribués ;
- attribuer une fiche recensée ne vaut ni certification ni abonnement ;
- un lieu archivé ou possiblement fermé ne s’affiche pas dans la recherche membre ;
- aucune photo du tableau d’entreprises n’est reproduite sans autorisation ;
- les coordonnées privées des membres et les coordonnées GPS exactes ne sont pas
  exposées.

## Critère de clôture

La recette est terminée lorsque les douze scénarios sont réussis sur deux
navigateurs, dont un iPhone installé en PWA, puis rejoués après déconnexion et
reconnexion pour confirmer la persistance.
