# Velvet Project Roadmap

**Statut :** source officielle de pilotage du projet Velvet.

**Dernière mise à jour :** 30 juillet 2026

## Règles de gouvernance

- Une seule décision structurante est traitée à la fois.
- Une ADR validée est définitive et ne peut être rouverte sans ADR d'amendement.
- Chaque ADR validée déclenche la documentation, la mise à jour des référentiels et un commit Git.
- Les sujets clôturés ne doivent pas être reproposés.
- Codex fusionne et déploie de manière autonome lorsque les contrôles sont verts.
- Cyril applique exclusivement les scripts et migrations SQL sur l'instance Supabase distante.

## Légende

- 🟢 Clôturé ou suffisamment verrouillé
- 🟡 En cours / partiellement arbitré
- ⚪ À traiter

## État des domaines

| Domaine | Statut | Avancement | Commentaire |
|---|---:|---:|---|
| Vision & positionnement | 🟢 | 100 % | ADN, valeurs et positionnement premium verrouillés. |
| Branding & UX | 🟢 | 100 % | Identité visuelle et principes d'interface validés. |
| Comptes & profils | 🟢 | 95 % | Types de comptes, identité, pseudonymes et profils dynamiques définis. |
| Conversations | 🟢 | 95 % | Invitations, Salons, consentement, histoire et souvenirs définis. |
| Sécurité & modération | 🟢 | 90 % | Modération IA-first, revue humaine et vérification obligatoire définies. |
| Notifications & confidentialité | 🟢 | 95 % | Push, catégories et modes de confidentialité définis. |
| Recherche & découverte | 🟢 | 95 % | Recommandation explicable, réciproque, dynamique, carte premium et Alchimie verrouillées. |
| Événements | 🟢 | 90 % | Cycle avant/pendant/après et quatre méthodes de confirmation de présence définis. |
| Clubs | 🟡 | 70 % | Intégrés à la carte, aux événements et au socle professionnel ; détails opérationnels restants. |
| Professionnels | 🟢 | 90 % | Interface dédiée, CRM modulaire, IA métier et outils organisateur définis. |
| Voyages Velvet | 🟢 | 90 % | Espace communautaire complet avant, pendant et après le voyage. |
| Administration / back-office | 🟡 | 65 % | Accès commerciaux, campagnes, suspensions, blocages, suppression différée et audit intégrés à Control. |
| IA Velvet | 🟡 | 75 % | Recommandation, Alchimie et assistants professionnels définis ; gouvernance technique restante. |
| Monétisation | 🟢 | 95 % | Offres, prix, quotas, promotions, cohortes et adaptateur définis ; prestataire et validation juridique encore requis avant encaissement. |
| Gamification | 🟡 | 70 % | Philosophie positive et distinctions évolutives verrouillées ; règles détaillées restantes. |
| Mobile avancé | ⚪ | 50 % | Web-first et notifications validés ; fonctions natives à prioriser. |
| Analytics | ⚪ | 20 % | KPI et gouvernance des données à définir. |
| Juridique & conformité | 🟡 | 40 % | Consentement et identité cadrés ; formalisation documentaire restante. |
| Développement complet | ⚪ | 0 % | Démarrera après verrouillage suffisant de l'architecture produit. |
| Recette | ⚪ | 0 % | À préparer après première version intégrée. |
| Pré-production | ⚪ | 0 % | À préparer après recette. |
| Lancement | ⚪ | 0 % | À préparer après validation pré-production. |

## Avancement global de référence

**Architecture produit estimée : 80 %.**

Cet indicateur mesure les arbitrages structurants et non le développement logiciel.

## Lots récemment clôturés

- ADR-024 à ADR-036 : recherche, découverte, confiance, souvenirs et événements intelligents.
- ADR-038 à ADR-041 : outils professionnels, IA métier et Velvet Trips.
- ADR-043 à ADR-044 : gamification positive et distinctions évolutives.
- ADR-GOV-003 : autonomie complète de livraison Codex et frontière SQL Supabase.
- ADR-MON-057 : Découverte, Signature, Pro, cohortes fondatrices et moteur de droits piloté par Control.

ADR-037 et ADR-042 ne sont pas des décisions manquantes : leurs propositions ont été abandonnées car les sujets étaient déjà arbitrés.

## Ordre de traitement actualisé

1. Finaliser la Gamification
2. Administration / Back-office
3. IA Velvet — gouvernance et contrôles
4. Paiement — validation prestataire spécialisé et revue juridique
5. Clubs — modèle opérationnel détaillé
6. Mobile avancé
7. Analytics
8. Juridique & conformité
9. Développement complet
10. Recette
11. Pré-production
12. Lancement

## Domaine actif

**Gamification**

### Prochain objectif

Préciser l'affichage, les critères, la confidentialité et le cycle de vie des distinctions sans rouvrir ADR-043 ni ADR-044.

## Discipline de mise à jour

Ce document doit être mis à jour après chaque ADR validée.
