(() => {
  'use strict';
  const user = Object.freeze(window.trackerUser);
  const prefix = 'tracker:' + user.id + ':';
  const methods = Object.fromEntries(['getItem', 'setItem', 'removeItem', 'key', 'clear'].map(k => [k, Storage.prototype[k]]));
  const length = Object.getOwnPropertyDescriptor(Storage.prototype, 'length').get;
  const ownKeys = storage => Array.from({length: length.call(storage)}, (_, i) => methods.key.call(storage, i)).filter(k => k.startsWith(prefix));
  // Existing pages use Storage methods, including obfuscated bracket calls.
  for (const name of ['getItem', 'setItem', 'removeItem']) {
    Storage.prototype[name] = function(key, ...args) {
      return methods[name].call(this, prefix + String(key), ...args);
    };
  }
  Storage.prototype.key = function(i) { return ownKeys(this)[i]?.slice(prefix.length) ?? null; };
  Storage.prototype.clear = function() { ownKeys(this).forEach(k => methods.removeItem.call(this, k)); };
  Object.defineProperty(Storage.prototype, 'length', {configurable: true, get() { return ownKeys(this).length; }});

  async function checkSession() {
    try {
      const response = await fetch('/api/tracker/me', {cache: 'no-store'});
      if (response.status === 401 || response.status === 403) location.replace('/auth/login');
      else if (response.ok && (await response.json()).id !== user.id) location.reload();
    } catch (_) { /* an offline browser must not erase existing local records */ }
  }
  addEventListener('pageshow', checkSession);
  addEventListener('focus', checkSession);
  setInterval(checkSession, 60000);
  document.addEventListener('DOMContentLoaded', () => {
    const bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:99999;display:flex;align-items:center;gap:12px;padding:10px 14px;background:#fff;color:#254435;border:1px solid #cddbd0;border-radius:10px;box-shadow:0 3px 16px #0001;font:12px system-ui';
    const label = document.createElement('span');
    label.textContent = user.name || user.username;
    const logout = document.createElement('button');
    logout.textContent = '退出登录';
    logout.title = '退出后，此账号在其他设备上的登录也将失效';
    logout.style.cssText = 'border:0;background:#e9f1eb;color:#254435;border-radius:5px;padding:6px 9px;cursor:pointer';
    logout.onclick = async () => {
      logout.disabled = true;
      try {
        const response = await fetch('/api/tracker/logout', {method: 'POST'});
        if (!response.ok) throw new Error('logout');
        location.replace('/auth/login');
      } catch (_) { logout.disabled = false; logout.textContent = '退出失败，重试'; }
    };
    bar.append(label, logout);
    document.body.append(bar);
  });
})();
