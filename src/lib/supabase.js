import { createClient } from '@supabase/supabase-js';

const runtimeOrigin = typeof window !== 'undefined' ? window.location.origin : '';
const directSupabaseUrl = import.meta.env.VITE_SUPABASE_URL;
export const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const isProductionBuild = import.meta.env.PROD;
export const isLocalDevModeEnabled = !isProductionBuild && import.meta.env.VITE_ENABLE_LOCAL_MODE === 'true';
export const shouldSeedLocalDevMode = isLocalDevModeEnabled && import.meta.env.VITE_SEED_LOCAL_MODE === 'true';
export const supabaseUrl = isProductionBuild && runtimeOrigin
  ? `${runtimeOrigin}/api/supabase`
  : directSupabaseUrl;
export const supabaseDirectUrl = directSupabaseUrl;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabasePublishableKey);
export const shouldBlockWithoutSupabase = isProductionBuild && !hasSupabaseConfig;

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;
