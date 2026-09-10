import { createClient } from "@supabase/supabase-js";
import {
  databaseConfig,
  databaseMode,
  isSupabaseConfigured,
} from "./databaseConfig";

const { supabaseUrl, publishableKey } = databaseConfig;

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export { databaseMode, isSupabaseConfigured };
