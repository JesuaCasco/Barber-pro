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

const RETRYABLE_SUPABASE_ERROR_PATTERNS = [
  'dns_hostname_not_found',
  'err_name_not_resolved',
  'failed to fetch',
  'load failed',
  'fetch failed',
  'an error occurred with this application',
];

const wait = (ms) => new Promise((resolve) => {
  window.setTimeout(resolve, ms);
});

const isRetryableSupabaseProxyError = (value) => {
  const normalized = String(value || '').toLowerCase();
  return RETRYABLE_SUPABASE_ERROR_PATTERNS.some((pattern) => normalized.includes(pattern));
};

const isRetryableSupabaseProxyResponse = async (response) => {
  if (!response || response.ok) return false;

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('text/html')) {
    const fallbackText = await response.clone().text().catch(() => '');
    return isRetryableSupabaseProxyError(fallbackText);
  }

  const html = await response.clone().text().catch(() => '');
  return isRetryableSupabaseProxyError(html);
};

export const supabaseProxyFetch = async (input, init) => {
  const maxAttempts = isProductionBuild ? 2 : 1;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(input, init);

      if (await isRetryableSupabaseProxyResponse(response)) {
        lastError = new Error('DNS_HOSTNAME_NOT_FOUND');
      } else {
        return response;
      }
    } catch (error) {
      lastError = error;
      if (!isRetryableSupabaseProxyError(error?.message || error)) {
        throw error;
      }
    }

    if (attempt < maxAttempts) {
      await wait(250 * attempt);
    }
  }

  throw lastError || new Error('DNS_HOSTNAME_NOT_FOUND');
};

export const hasSupabaseConfig = Boolean(supabaseUrl && supabasePublishableKey);
export const shouldBlockWithoutSupabase = isProductionBuild && !hasSupabaseConfig;

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      global: {
        fetch: supabaseProxyFetch,
      },
    })
  : null;
