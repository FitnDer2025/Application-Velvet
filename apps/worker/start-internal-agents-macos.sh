#!/usr/bin/env bash
set -euo pipefail

WORKER_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$WORKER_DIR/../.." && pwd)"
ENV_FILE="$WORKER_DIR/.env.internal.local"
EXAMPLE_FILE="$WORKER_DIR/.env.internal.example"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 22.20.0 ou plus récent est requis."
  exit 1
fi

NODE_VERSION="$(node --version | sed 's/^v//')"
NODE_MAJOR="${NODE_VERSION%%.*}"
NODE_REST="${NODE_VERSION#*.}"
NODE_MINOR="${NODE_REST%%.*}"

if [ "$NODE_MAJOR" -lt 22 ] || { [ "$NODE_MAJOR" -eq 22 ] && [ "$NODE_MINOR" -lt 20 ]; }; then
  echo "Version Node détectée : v$NODE_VERSION. Node.js 22.20.0 ou plus récent est requis."
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  cp "$EXAMPLE_FILE" "$ENV_FILE"
  echo "Le fichier apps/worker/.env.internal.local vient d’être créé."
  echo "Complète DATABASE_URL et OPENAI_API_KEY, puis relance la commande."
  open -e "$ENV_FILE"
  exit 1
fi

if ! grep -Eq '^DATABASE_URL=.+$' "$ENV_FILE"; then
  echo "DATABASE_URL est vide dans apps/worker/.env.internal.local."
  open -e "$ENV_FILE"
  exit 1
fi

cd "$REPO_ROOT"

if [ ! -d "$REPO_ROOT/node_modules" ]; then
  echo "Installation locale des dépendances Velvet…"
  npm_config_engine_strict=false npm install
fi

echo
printf '\033[32mMoteur Velvet IA interne démarré.\033[0m\n'
echo "Laisse cette fenêtre Terminal ouverte pendant tes tests."
echo "Appuie sur Ctrl+C pour arrêter les agents."
echo

exec node --env-file="$ENV_FILE" apps/worker/src/worker.mjs
