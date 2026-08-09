# ADR-0001 — Une décision = un commit

## Statut
Accepté

## Contexte
Zwit est conçu comme un produit vivant, avec de nombreuses décisions fonctionnelles, UX, IA, techniques, business, sécurité et confidentialité. La conversation de travail permet d'explorer et d'arbitrer, mais GitHub doit rester la mémoire officielle et durable du projet.

## Décision
Chaque décision explicitement validée doit être documentée puis poussée dans GitHub sous la forme d'un commit atomique.

### Règles
- Une décision logique = un commit.
- Plusieurs décisions indépendantes = plusieurs commits.
- Une décision structurante doit créer ou mettre à jour un ADR.
- Les documents impactés doivent être mis à jour : Product Bible, spécification fonctionnelle, UX, Zwit Intelligence, technique, sécurité, business, roadmap et changelog selon le périmètre.
- Les échanges de réflexion restent dans la conversation ; la décision finale et ses conséquences vivent dans GitHub.
- Une décision existante ne doit pas être remise en cause silencieusement. Toute modification doit être explicite, motivée et tracée dans un nouveau commit.
- Les commits de décision utilisent une convention claire, par exemple `feat(conversations): ...`.
- Les enrichissements sans nouvelle décision utilisent un commit documentaire, par exemple `docs(product): ...`.

## Conséquences
- GitHub devient la source de vérité officielle de Velvet.
- L'historique du produit reste lisible et exploitable par les fondateurs, développeurs, designers et futurs partenaires.
- Le risque de perte, de contradiction ou de régression produit est réduit.

## Date d'adoption
22 juillet 2026
