#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_ROOT="${1:-${ROOT_DIR}/../inventory-split}"
FRONTEND_DIR="${OUTPUT_ROOT}/inventory-frontend"
BACKEND_DIR="${OUTPUT_ROOT}/inventory-backend"

printf "[split] Root: %s\n" "$ROOT_DIR"
printf "[split] Output: %s\n" "$OUTPUT_ROOT"

rm -rf "$FRONTEND_DIR" "$BACKEND_DIR"
mkdir -p "$FRONTEND_DIR" "$BACKEND_DIR"

# ------------------------------
# Frontend repo
# ------------------------------
cp -a "$ROOT_DIR/src" "$FRONTEND_DIR/"
cp -a "$ROOT_DIR/index.html" "$FRONTEND_DIR/"
cp -a "$ROOT_DIR/package.json" "$FRONTEND_DIR/"
cp -a "$ROOT_DIR/vite.config.ts" "$FRONTEND_DIR/"
cp -a "$ROOT_DIR/postcss.config.mjs" "$FRONTEND_DIR/"
cp -a "$ROOT_DIR/README.md" "$FRONTEND_DIR/README.upstream.md"

cat > "$FRONTEND_DIR/README.md" <<'FEOF'
# Inventory Frontend

This repository contains only the React/Vite frontend for the inventory system.

## Required environment variables

- `VITE_AZURE_API_BASE_URL`
- `VITE_AZURE_FUNCTIONS_API_KEY` (optional)

## Run

```bash
npm install
npm run dev
```
FEOF

cat > "$FRONTEND_DIR/.gitignore" <<'FEOF'
node_modules/
dist/
.env
.env.*
FEOF

# ------------------------------
# Backend repo (current server implementation)
# ------------------------------
mkdir -p "$BACKEND_DIR/supabase/functions"
cp -a "$ROOT_DIR/supabase/functions/server" "$BACKEND_DIR/supabase/functions/"

cat > "$BACKEND_DIR/README.md" <<'BEOF'
# Inventory Backend

This repository contains the backend function implementation currently located in:

- `supabase/functions/server`

## Next migration step to Azure

Port these handlers to Azure Functions (or containerized API App Service) while preserving routes currently consumed by the frontend.
BEOF

cat > "$BACKEND_DIR/.gitignore" <<'BEOF'
node_modules/
dist/
.env
.env.*
BEOF

if [[ "${2:-}" == "--init-git" ]]; then
  (
    cd "$FRONTEND_DIR"
    git init >/dev/null
    git add .
    git commit -m "Initial split: inventory frontend" >/dev/null
  )
  (
    cd "$BACKEND_DIR"
    git init >/dev/null
    git add .
    git commit -m "Initial split: inventory backend" >/dev/null
  )
  printf "[split] Initialized git repositories in both output directories.\n"
fi

printf "[split] Done.\n"
printf "  - %s\n" "$FRONTEND_DIR"
printf "  - %s\n" "$BACKEND_DIR"
