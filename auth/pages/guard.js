import {getClient, accountURL, base} from './client.js';
import {currentMember, scopeStorage} from './core.js';

function redirect(error) {
  const name = error.message === 'signed-out' ? 'login' : 'status';
  location.replace(accountURL(name, {reason: error.message, next: location.href}));
}
async function start() {
  const client = getClient();
  const member = await currentMember(client);
  const source = JSON.parse(document.querySelector('#tracker-source').textContent);
  const original = new TextDecoder().decode(Uint8Array.from(atob(source), c => c.charCodeAt(0)));
  scopeStorage(Storage, 'tracker:' + base.pathname + ':' + member.user_id + ':');
  // The original document stays inert until real Auth + membership checks pass.
  // It is public source, not encrypted/protected content on GitHub Pages.
  document.open();
  document.write(original);
  document.close();
  const mount = () => {
    const bar = document.createElement('aside');
    bar.setAttribute('aria-label', '当前账号');
    bar.className = 'tracker-account-bar';
    const name = document.createElement('span');
    name.textContent = member.display_name || member.email;
    const account = document.createElement('a');
    account.href = accountURL('profile');
    account.textContent = '账号设置';
    const logout = document.createElement('button');
    logout.textContent = '退出';
    logout.onclick = async () => {
      logout.disabled = true;
      try {
        const {error} = await client.auth.signOut({scope: 'local'});
        if (error) throw error;
        location.replace(accountURL('login'));
      } catch (_) { logout.disabled = false; logout.textContent = '退出失败，重试'; }
    };
    bar.append(name, account, logout);
    document.body.append(bar);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once: true});
  else mount();
  let checking = false;
  const check = async () => {
    if (checking) return;
    checking = true;
    try {
      const fresh = await currentMember(client);
      if (fresh.user_id !== member.user_id) location.reload();
    } catch (error) { document.documentElement.style.visibility = 'hidden'; redirect(error); }
    finally { checking = false; }
  };
  client.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') location.replace(accountURL('login'));
    else if (session?.user.id && session.user.id !== member.user_id) location.reload();
  });
  addEventListener('focus', check);
  addEventListener('pageshow', event => { if (event.persisted) check(); });
  setInterval(check, 60000);
}
start().catch(redirect);
