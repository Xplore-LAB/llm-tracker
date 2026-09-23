export function siteBase(moduleURL) {
  return new URL('../', moduleURL);
}

export function safeDestination(value, base) {
  try {
    const url = new URL(value || './', base);
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname) ||
        url.pathname.startsWith(base.pathname + 'account/') ||
        /[\\\x00-\x1f]/.test(value || '')) return base.href;
    return url.href;
  } catch (_) { return base.href; }
}

export function assertPublicConfig(config, base) {
  if (!config.url || !config.key) throw new Error('unconfigured');
  const url = new URL(config.url);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('invalid-config');
  const local = ['127.0.0.1', 'localhost'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(config.testMode && local && ['127.0.0.1', 'localhost'].includes(base.hostname))) {
    throw new Error('invalid-config');
  }
  if (config.key.startsWith('sb_secret_')) throw new Error('invalid-config');
  if (config.key.startsWith('sb_publishable_')) return;
  try {
    const claim = JSON.parse(atob(config.key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (claim.role === 'anon') return;
  } catch (_) { /* invalid legacy key */ }
  throw new Error('invalid-config');
}

export async function currentMember(client) {
  const {data: {user}, error} = await client.auth.getUser();
  if (error) {
    if (error.status === 401 || error.status === 403 || error.name === 'AuthSessionMissingError') throw new Error('signed-out');
    throw new Error('unavailable');
  }
  if (!user) throw new Error('signed-out');
  if (user.factors?.some(factor => factor.status === 'verified')) throw new Error('mfa-required');
  const {data, error: memberError} = await client.from('tracker_members')
    .select('user_id, display_name, status').eq('user_id', user.id).maybeSingle();
  if (memberError) throw new Error('unavailable');
  if (!data || data.status === 'pending') throw new Error('pending');
  if (data.status !== 'active') throw new Error('disabled');
  return {...data, email: user.email};
}

export function readCallback(href) {
  const url = new URL(href);
  const fragment = new URLSearchParams(url.hash.slice(1));
  const params = fragment.has('token_hash') ? fragment : url.searchParams;
  const type = params.get('type');
  const token_hash = params.get('token_hash');
  if (!['invite', 'recovery'].includes(type) || !token_hash || !/^[a-zA-Z0-9_-]{20,256}$/.test(token_hash)) {
    throw new Error('invalid-link');
  }
  return {type, token_hash};
}

export function passwordError(password, confirmation) {
  if (password.length < 12) return '密码至少需要 12 个字符。';
  if (password !== confirmation) return '两次输入的密码不一致。';
  return '';
}

export function rawStorage(storage) {
  // Capture before legacy-page storage methods are namespaced. Auth session
  // persistence must keep one stable key across accounts and SDK refreshes.
  return Object.fromEntries(['getItem', 'setItem', 'removeItem'].map(k => [k, storage[k].bind(storage)]));
}

export function scopeStorage(StorageClass, prefix) {
  const proto = StorageClass.prototype;
  const methods = Object.fromEntries(['getItem', 'setItem', 'removeItem', 'key'].map(k => [k, proto[k]]));
  const length = Object.getOwnPropertyDescriptor(proto, 'length').get;
  const keys = storage => Array.from({length: length.call(storage)}, (_, i) => methods.key.call(storage, i)).filter(k => k.startsWith(prefix));
  for (const name of ['getItem', 'setItem', 'removeItem']) {
    proto[name] = function(key, ...args) { return methods[name].call(this, prefix + String(key), ...args); };
  }
  proto.key = function(index) { return keys(this)[index]?.slice(prefix.length) ?? null; };
  proto.clear = function() { keys(this).forEach(key => methods.removeItem.call(this, key)); };
  Object.defineProperty(proto, 'length', {configurable: true, get() { return keys(this).length; }});
}
