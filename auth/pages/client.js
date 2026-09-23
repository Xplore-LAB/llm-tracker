import {createClient} from '@supabase/supabase-js';
import {config} from './config.js';
import {assertPublicConfig, rawStorage, siteBase} from './core.js';

export const base = siteBase(import.meta.url);
export const accountURL = (name, params = {}) => {
  const url = new URL('account/' + name + '.html', base);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.href;
};
let client;
export function getClient() {
  assertPublicConfig(config, base);
  if (!client) client = createClient(config.url, config.key, {
    auth: {storage: rawStorage(localStorage), storageKey: 'tracker-auth:' + base.pathname,
      persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: 'pkce'},
    global: {fetch: (url, options = {}) => fetch(url, {...options,
      signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000)})},
  });
  return client;
}
export {config};
