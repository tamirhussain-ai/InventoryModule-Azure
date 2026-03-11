# Phase 1 Setup Guide — Azure Entra ID Authentication

## Step 1: Register Your App in Azure Portal

1. Go to [portal.azure.com](https://portal.azure.com)
2. Search for **"App registrations"** → **New registration**
3. Fill in:
   - **Name:** `SHC Inventory System`
   - **Supported account types:** `Accounts in this organizational directory only` (your university)
   - **Redirect URI:** 
     - Type: `Single-page application (SPA)`
     - URI: `http://localhost:5173` (for dev)
4. Click **Register**

## Step 2: Note Your IDs

After registration, on the Overview page, copy:
- **Application (client) ID** → `VITE_AZURE_CLIENT_ID`
- **Directory (tenant) ID** → `VITE_AZURE_TENANT_ID`

## Step 3: Add Production Redirect URI

1. In your app registration → **Authentication**
2. Under **Single-page application**, add your production URL:
   - `https://your-app.azurestaticapps.net`
3. Save

## Step 4: Configure Your .env File

```bash
cp .env.example .env
```

Then fill in your actual values:
```
VITE_AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
VITE_AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
VITE_API_URL=https://hohuauquoerouetafaqn.supabase.co/functions/v1/make-server-5ec3cec0
VITE_REDIRECT_URI=http://localhost:5173
```

## Step 5: Install Dependencies and Run

```bash
npm install
npm run dev
```

## Step 6: ⚠️ Rotate Your Supabase Key

Your old Supabase anon key was exposed in the public GitHub repo.
Rotate it immediately at:
https://supabase.com/dashboard/project/hohuauquoerouetafaqn/settings/api

---

## What Changed in Phase 1

| Before | After |
|--------|-------|
| Email + password login | Microsoft SSO popup |
| Supabase Auth tokens | Azure Entra ID tokens |
| Hardcoded keys in repo | Environment variables |
| Signup/ForgotPassword pages | Not needed (Microsoft handles this) |
| `@supabase/supabase-js` | `@azure/msal-browser` |

## What Stays the Same in Phase 1

- All pages and features work as before
- Backend API still running on Supabase (Phase 3 will move this)
- Database still on Supabase (Phase 2 will move this)
- Role assignment still managed in the app by admins

---

## Next Phases

- **Phase 2:** Migrate database to Azure PostgreSQL Flexible Server
- **Phase 3:** Migrate backend to Azure App Service (Node.js), host frontend on Azure Static Web Apps
