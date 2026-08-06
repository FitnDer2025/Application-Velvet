# ADR-UX-060 — Changement de compte et passage entre interfaces Web

**Statut : Accepté — 4 août 2026**

## Décision

- Les interfaces Web Membres, Zwit Pro et Zwit Control proposent toutes l’action « Changer de compte ».
- Cette action ferme la session active puis affiche la page de connexion ; elle ne conserve aucun accès du compte précédent.
- Le rôle `admin` dispose, sur le Web uniquement, de raccourcis directs vers Membres, Zwit Pro et Zwit Control sans nouvelle authentification.
- Les raccourcis sont construits après lecture de la session serveur. Ils ne sont jamais déduits d’un état local ni d’un simple élément visuel.
- Chaque interface conserve son contrôle d’accès serveur : le sélecteur ne crée aucun droit et une URL saisie manuellement reste soumise au RBAC.
- Les autres rôles ne voient aucun raccourci transversal. Ils conservent seulement « Changer de compte ».
- L’application iOS n’est pas modifiée par cette décision.

## Critères d’acceptation

- L’action est présente dans les trois interfaces Web et ramène à la connexion après révocation de session.
- Seul un compte portant réellement le rôle `admin` voit les trois destinations.
- L’espace courant est identifiable dans le sélecteur.
- Pro et Control refusent toujours côté serveur un rôle non autorisé.
- Le composant reste utilisable au clavier et sur mobile.
