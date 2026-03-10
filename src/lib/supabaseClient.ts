import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '/utils/supabase/info';

// Singleton Supabase client — import this everywhere in the frontend
// to avoid the "Multiple GoTrueClient instances" warning.
export const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey
);
