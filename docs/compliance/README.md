# Conformité Velvet — mode d’emploi

Ce dossier transforme les obligations RGPD, sécurité et DSA en contrôles techniques et en procédures exploitables. Il ne constitue pas une validation juridique automatique.

## Statut de lancement

Velvet ne doit pas être ouvert au public tant que les éléments marqués **BLOQUANT** dans `audit-2026-07-31.md` ne sont pas clôturés et documentés.

## Documents

- `audit-2026-07-31.md` — résultat détaillé de l’audit et reste à faire.
- `processing-register.md` — registre initial des activités de traitement.
- `dpia.md` — trame d’AIPD à compléter et faire valider avant lancement.
- `data-subject-rights.md` — procédure de traitement des demandes RGPD.
- `retention-policy.md` — règles de conservation et de purge.
- `security-incident-response.md` — gestion des incidents et violations de données.
- `moderation-dsa.md` — signalement, preuve, décision, notification et recours.
- `security-production-checklist.md` — configuration de production et vérifications périodiques.

## Socle technique ajouté par la migration 0027

1. Le dernier choix de consentement est le seul choix actif.
2. Le retrait du consentement sensible rend le profil invisible.
3. La géolocalisation est effacée lors du retrait.
4. Les profils disposent de trois modes : public, privé, invisible.
5. L’accès Control et l’accès aux contenus sensibles exigent `aal2`.
6. Les rôles support et audit n’obtiennent plus automatiquement accès aux profils intimes.
7. Les signalements créent une preuve chiffrable, une empreinte et une durée de conservation.
8. Les décisions de modération produisent un motif et une trace append-only.
9. Un canal électronique DSA peut être utilisé sans compte Velvet.
10. Les incidents et violations disposent d’un registre et d’une échéance CNIL calculée à 72 heures.
11. La suppression d’un profil place les objets médias dans une file de purge vérifiable.
12. Les demandes RGPD disposent d’un historique de traitement.

## Séquence de déploiement obligatoire

1. Faire relire la migration 0027 et les procédures par le responsable technique et le référent RGPD.
2. Créer les secrets Vault et les secrets d’exécution listés dans la checklist sécurité.
3. Appliquer les migrations dans un environnement de recette neuf ou cloné sans données réelles.
4. Exécuter `npm run check` et les tests de non-régression.
5. Enrôler tous les comptes Control en MFA avant de réactiver leurs accès.
6. Tester le retrait des consentements, les trois modes de profil, le blocage et les demandes RGPD.
7. Tester un signalement complet, une décision motivée et un recours.
8. Tester la suppression d’un compte avec des photos, vidéos et pièces jointes, puis vérifier la purge physique.
9. Exécuter un exercice de violation de données avec décision documentée avant l’échéance de 72 heures.
10. Finaliser l’AIPD, le registre, les contrats de sous-traitance et les mentions légales.
11. Réaliser un test d’intrusion indépendant et corriger les risques élevés.
12. Autoriser l’ouverture uniquement après signature formelle de la revue de lancement.

## Propriété et revue

Chaque document doit porter un propriétaire nommé, une date de validation et une date de prochaine revue. Les documents sans propriétaire ou sans date de revue sont considérés comme non validés.
