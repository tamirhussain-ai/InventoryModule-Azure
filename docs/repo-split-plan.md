# Repo split plan (frontend + backend)

This project can now be split into two repositories using `scripts/split-repos.sh`.

## What it creates

- `inventory-frontend`
  - React/Vite app (`src/`, `index.html`, `package.json`, Vite config)
  - frontend-specific README and `.gitignore`
- `inventory-backend`
  - current server implementation from `supabase/functions/server`
  - backend README and `.gitignore`

## Usage

```bash
# from this repository root
./scripts/split-repos.sh

# optional: choose output directory
./scripts/split-repos.sh /workspace

# optional: initialize git repos with initial commit in each output repo
./scripts/split-repos.sh /workspace --init-git
```

## Suggested publish flow

1. Create empty repos in GitHub (e.g., `inventory-frontend`, `inventory-backend`).
2. Run `./scripts/split-repos.sh /workspace --init-git`.
3. Add remotes and push:

```bash
cd /workspace/inventory-frontend
git remote add origin <FRONTEND_REPO_URL>
git branch -M main
git push -u origin main

cd /workspace/inventory-backend
git remote add origin <BACKEND_REPO_URL>
git branch -M main
git push -u origin main
```
