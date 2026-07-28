# Velvet BETA — registre initial des traitements

Ce registre est un document de travail à compléter avec l’identité juridique de l’éditeur, les sous-traitants retenus, les durées définitives et les contacts RGPD.

| Traitement | Données | Finalité | Accès | Conservation proposée |
|---|---|---|---|---|
| Invitations BETA | e-mail, code haché, statut | Contrôler l’accès | Administration | 90 jours après expiration |
| Compte | e-mail, identifiant, sessions, sécurité | Fournir et sécuriser le service | Utilisateur, support restreint | Vie du compte + délai contentieux à valider |
| Profil membre | identité publique, histoire, ville approximative | Présenter le membre | Membres BETA approuvés | Vie du compte |
| Profil intime | orientation, pratiques, recherches, préférences | Compatibilité et mise en relation | Membres selon visibilité | Jusqu’au retrait ou à la suppression |
| Profil individuel | taille, poids, morphologie, goûts | Présentation volontaire | Selon visibilité choisie | Vie du profil |
| Géolocalisation | zone ou coordonnées temporaires | Proximité et carte | Système ; zone seulement aux membres | Précise : durée très courte ; zone : vie du profil |
| Photos de profil | minimum 3 photos individuelles ou 3 photos du couple et 1 portrait par partenaire ; ajouts ultérieurs libres | Admission puis carrousel public du profil | Privées pendant le contrôle, puis membres BETA approuvés | Jusqu’au retrait |
| Albums publics | nom de bibliothèque, photos approuvées | Organiser une galerie consultable | Membres BETA approuvés | Jusqu’au retrait |
| Albums privés | nom, photos, bénéficiaires, date d’accord et expiration | Partage ponctuel choisi par le propriétaire | Propriétaires et comptes autorisés pour 1, 2, 4, 8, 12, 24 h ou sans échéance | Jusqu’au retrait ; accès révocable |
| Contrôle technique des photos | profil public : nombre de personnes, visage visible, cadrage et netteté ; album privé : détection de risque sans refus de la nudité adulte ; résultat et confiance | Vérifier l’admission et empêcher la diffusion de contenus manifestement interdits | Velvet Intelligence et, en cas de doute, modération habilitée | Résultat lié au média ; fichier supprimé au retrait |
| Conversations | messages, membres, pièces jointes | Communication | Participants uniquement | Durée à valider avec option d’effacement |
| Événements | agenda, inscriptions, présence | Organisation des sorties | Membres, organisateurs, Pro | Événement + durée d’historique à valider |
| Établissements | fiche, équipe, statistiques | Velvet Pro | Pro autorisé et membres pour le public | Relation contractuelle |
| Recommandations et avis | auteur, cible, texte, note | Confiance communautaire | Selon visibilité | Jusqu’au retrait ou modération |
| Modération | signalement, éléments nécessaires, décision | Sécurité et contentieux | Modération restreinte | Durée proportionnée à valider |
| Audit et sécurité | acteur, action, date, IP tronquée si nécessaire | Traçabilité et défense | Sécurité, audit | Durée à valider par catégorie |
| Mesure d’audience | événements minimisés | Améliorer le service | Produit / direction | Agrégation rapide ; brut court |
| Marketing | e-mail, consentement, campagnes | Information commerciale | Marketing restreint | Jusqu’au retrait + preuve du retrait |

## Principes obligatoires

- Aucun champ sensible ne doit être obligatoire s’il n’est pas indispensable au service choisi.
- Le refus ou le retrait d’un consentement marketing ne doit jamais bloquer Velvet.
- Le retrait du consentement aux données intimes doit masquer ces données immédiatement et déclencher leur suppression selon le parcours défini.
- Les données réelles et les données fictives doivent être identifiables sans ambiguïté.
- La localisation exacte ne doit jamais apparaître dans une liste, un export ou un journal métier.
- Les albums privés ne doivent fournir aucune miniature avant autorisation.
- Un accès permanent à un album privé doit rester révocable à tout moment.
- Après expiration ou révocation, aucun nouveau lien média ne doit pouvoir être émis ; les liens déjà émis ont une durée technique maximale d’une minute.
- L’analyse d’admission ne doit ni identifier une personne, ni comparer des visages, ni créer de gabarit biométrique.
- Une décision incertaine doit rester en attente d’un contrôle humain et ne doit pas ouvrir automatiquement l’accès.

## Sous-traitance et analyse automatisée à confirmer

- Supabase : authentification, base et stockage privé.
- Cloudflare : hébergement de la BETA et analyse technique des photos via Workers AI.
- Avant l’ouverture à davantage de testeurs, l’identité juridique de l’éditeur, les régions de traitement, les clauses contractuelles, les durées et l’AIPD doivent être validées.
