# Runbook — Agents IA de test interne Velvet

## Portée

Ce dispositif est réservé au projet Supabase et au déploiement Cloudflare de développement ou staging. Il est interdit sur une base utilisée par des bêta-testeurs externes ou en production.

## 1. Appliquer la migration

Exécuter dans le projet Supabase interne :

```text
infra/supabase/migrations/0027_internal_ai_test_agents.sql
```

Cyril ou un administrateur autorisé conserve l’exécution distante des migrations Supabase.

## 2. Variables Cloudflare Pages

Configurer uniquement dans l’environnement interne :

```text
VELVET_ENVIRONMENT=staging
VELVET_INTERNAL_TEST_AGENTS=enabled
SUPABASE_URL=...
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Pour les réponses générées :

```text
OPENAI_API_KEY=...
VELVET_TEST_AGENT_MODEL=...
```

Sans ces deux dernières variables, les agents utilisent des réponses de secours naturelles afin de permettre la recette fonctionnelle.

## 3. Variables du worker

Conserver les variables actuelles du worker et ajouter :

```text
VELVET_ENVIRONMENT=staging
VELVET_INTERNAL_TEST_AGENTS=enabled
VELVET_TEST_AGENT_CYCLE_MS=60000
VELVET_TEST_AGENT_BATCH_SIZE=4
OPENAI_API_KEY=...
VELVET_TEST_AGENT_MODEL=...
```

La cadence minimale du cycle est d’une minute. Chaque personnalité possède ensuite son propre délai d’activité.

## 4. API Control

Toutes les requêtes exigent une session Velvet Admin ou Direction.

### Lire l’état

```http
GET /api/control/test-agents
```

### Créer ou actualiser les six agents

```http
POST /api/control/test-agents
Content-Type: application/json

{"action":"seed"}
```

L’administrateur qui lance l’action est automatiquement ajouté à la liste blanche.

### Activer le moteur

```http
POST /api/control/test-agents
Content-Type: application/json

{"action":"set_enabled","enabled":true}
```

### Forcer un prochain passage

```http
POST /api/control/test-agents
Content-Type: application/json

{"action":"run_now"}
```

### Ajouter un autre développeur ou testeur interne

```http
POST /api/control/test-agents
Content-Type: application/json

{"action":"add_viewer","userId":"UUID_DU_COMPTE"}
```

### Suspendre un agent

```http
POST /api/control/test-agents
Content-Type: application/json

{"action":"set_agent_status","agentId":"UUID_AGENT","status":"paused"}
```

### Arrêter immédiatement tous les agents

```http
POST /api/control/test-agents
Content-Type: application/json

{"action":"set_enabled","enabled":false}
```

### Nettoyage définitif

```http
POST /api/control/test-agents
Content-Type: application/json

{"action":"cleanup"}
```

Cette action désactive le moteur, supprime les données métier et les médias synthétiques, puis supprime les comptes Supabase Auth.

## 5. Contrôle avant ouverture externe

Dans Control, le contrôle `internal_test_agents_present` doit afficher :

```text
passed — 0 profil concerné
```

Une valeur différente de zéro interdit la publication externe.

## 6. Retour arrière

1. Positionner `VELVET_INTERNAL_TEST_AGENTS=disabled` dans Cloudflare et le worker.
2. Appeler `set_enabled=false`.
3. Appeler `cleanup`.
4. Vérifier le contrôle de publication.
5. La colonne et les tables techniques peuvent rester vides ; leur suppression nécessite une migration descendante séparée et n’est pas requise pour neutraliser le dispositif.
