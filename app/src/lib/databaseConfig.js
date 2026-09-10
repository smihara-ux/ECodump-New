const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && publishableKey);
export const databaseMode = isSupabaseConfigured ? "cloud" : "demo";
export const databaseConfig = { supabaseUrl, publishableKey };
