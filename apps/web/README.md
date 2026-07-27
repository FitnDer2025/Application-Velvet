# Velvet Web — Phase 1

Première version réelle et responsive de la landing page Velvet.

## Lancer le site localement

Depuis la racine du dépôt :

```bash
cd apps/web
python3 -m http.server 4173
```

Puis ouvrir :

```text
http://localhost:4173
```

Aucune dépendance n'est nécessaire pour cette première version.

## Contenu

- landing page premium desktop et mobile ;
- navigation responsive ;
- manifeste de marque ;
- confiance et confidentialité ;
- univers établissements, événements et voyages ;
- formulaire d'invitation simulé ;
- animations d'apparition respectant `prefers-reduced-motion` ;
- variables visuelles synchronisées avec les tokens Velvet.

## Étape suivante

Transformer cette base en application React/PWA, connecter le formulaire à Supabase et ajouter les premiers parcours d'inscription, de découverte et de profil.
