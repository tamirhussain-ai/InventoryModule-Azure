/**
 * DEPRECATED — Phase 1 Azure Migration
 *
 * This file previously contained hardcoded Supabase credentials.
 * 
 * ⚠️  ACTION REQUIRED: Rotate your Supabase anon key at:
 *     https://supabase.com/dashboard/project/hohuauquoerouetafaqn/settings/api
 *     The old key was exposed publicly in the original GitHub repo.
 *
 * During Phase 1, the API URL is now set via VITE_API_URL in .env
 * Supabase credentials are no longer needed in the frontend.
 */

// These are kept temporarily so existing imports don't break during migration.
// Remove this file entirely in Phase 3.
export const projectId = '';
export const publicAnonKey = '';
