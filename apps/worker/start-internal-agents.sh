#!/usr/bin/env bash
set -euo pipefail

WORKER_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$WORKER_DIR/../.." && pwd)"
ENV_FILE="$WORKER_DIR/.env.internal.local"
EXAMPLE_FILE="$WORKER_DIR/.env.internal.example"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 24 ou plus récent est requis."
  exit 1
fi

NODE_MAJOR="$(node --version | sed 's/^v//' | cut -d. -f1)"
if [ "$NODE_MAJOR" -lt 24 ]; then
  echo "Version Node détectée : $(node --version). Node.js 24 ou plus récent est requis."
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  cp "$EXAMPLE_FILE" "$ENV_FILE"
  echo "Le fichier apps/worker/.env.internal.local vient d’être créé."
  echo "Complète DATABASE_URL et, facultativement, OPENAI_API_KEY, puis relance ce script."
  if command -v open >/dev/null 2>&1; then
    open -e "$ENV_FILE"
  fi
  exit 1
fi

if ! grep -Eq '^DATABASE_URL=.+' "$ENV_FILE"; then
  echo "DATABASE_URL est vide dans apps/worker/.env.internal.local."
  if command -v open >/dev/null 2>&1; then
    open -e "$ENV_FILE"
  fi
  exit 1
fi

cd "$REPO_ROOT"

if [ ! -d "$REPO_ROOT/node_modules" ]; then
  echo "Installation locale des dépendances Velvet…"
  npm install
fi

echo
echo "Moteur Velvet IA interne démarré."
echo "Laisse cette fenêtre ouverte pendant tes tests. Ctrl+C pour arrêter."
echo

node --env-file="$ENV_FILE" apps/worker/src/worker.mjs
