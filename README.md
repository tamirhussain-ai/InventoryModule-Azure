
  # Inventory Module

  This is a code bundle for Inventory Module. The original project is available at https://www.figma.com/design/nl9NohNTRcORsOSGLoYv3T/Inventory-Module.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.
  

## Azure configuration

To run this frontend against Azure-hosted backend services, set these Vite environment variables:

- `VITE_AZURE_API_BASE_URL` - Base URL for your Azure Functions / API Management endpoint (for example `https://<app>.azurewebsites.net/api`).
- `VITE_AZURE_FUNCTIONS_API_KEY` - Optional gateway key sent as a bearer token if your API requires it.

The app now uses this API base URL for auth, inventory, and diagnostics endpoints instead of Supabase-specific URLs.


## Split into separate repositories

Use the included script to generate a standalone frontend repo and backend repo:

```bash
./scripts/split-repos.sh /workspace --init-git
```

See `docs/repo-split-plan.md` for full publishing steps.
