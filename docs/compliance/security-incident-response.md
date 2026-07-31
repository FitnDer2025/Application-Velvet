# Procédure de gestion des incidents et violations de données

## Déclenchement

Tout soupçon d’accès illégitime, fuite, perte, altération, suppression non autorisée, malware, erreur RLS, lien média exposé, compte privilégié compromis ou indisponibilité majeure crée immédiatement un incident dans le registre.

## Rôles à nommer avant lancement

- incident lead et suppléant ;
- responsable technique ;
- sécurité ;
- référent RGPD/DPO ;
- direction décisionnaire ;
- communication ;
- conseil juridique/assurance ;
- interlocuteurs des sous-traitants.

## Chronologie

### 0 à 1 heure

1. ouvrir l’incident et conserver l’heure de détection ;
2. protéger les preuves sans modifier les sources ;
3. limiter l’accès, révoquer les sessions ou clés compromises ;
4. contenir le flux sans détruire les éléments utiles ;
5. alerter l’incident lead et le référent RGPD.

### 1 à 6 heures

1. déterminer les systèmes, données et personnes potentiellement concernés ;
2. vérifier si des données sensibles ou de localisation sont impliquées ;
3. évaluer vraisemblance et gravité ;
4. contacter les sous-traitants ;
5. décider si l’événement constitue une violation de données personnelles ;
6. documenter les mesures prises et les inconnues.

### Avant 24 heures

1. qualifier le niveau de risque : improbable, risque, risque élevé ;
2. décider provisoirement de la notification CNIL et des personnes ;
3. préparer les informations disponibles, même incomplètes ;
4. valider le plan de remédiation et de communication ;
5. vérifier l’échéance calculée `detected_at + 72 hours`.

### Avant 72 heures

Lorsque la notification est requise, transmettre les éléments disponibles à l’autorité compétente et compléter ensuite si nécessaire. Lorsque la notification n’est pas réalisée, inscrire le raisonnement précis et les preuves qui soutiennent cette décision.

En cas de risque élevé, informer les personnes concernées sans retard injustifié avec des mots compréhensibles, les conséquences probables, les mesures prises et les actions de protection recommandées.

## Contenu du registre

- référence et titre ;
- date/heure de détection et source ;
- systèmes et données ;
- nombre approximatif de personnes ;
- sensibilité des données ;
- cause et vecteur ;
- impacts possibles ;
- mesures de confinement ;
- niveau de risque et justification ;
- décision de notification ;
- dates et preuves des notifications ;
- actions correctives ;
- clôture et retour d’expérience.

## Après l’incident

- rotation des secrets ;
- correction et revue de code ;
- vérification des logs et des accès privilégiés ;
- mise à jour AIPD/registre/procédures ;
- information des partenaires concernés ;
- test de la correction ;
- réunion de retour d’expérience sans recherche de culpabilité ;
- suivi des actions jusqu’à preuve de clôture.

## Exercices

Un exercice sur table est obligatoire avant lancement, puis au minimum deux fois par an. Un scénario doit porter sur l’exposition d’un album privé et un autre sur la compromission d’un compte administrateur.
