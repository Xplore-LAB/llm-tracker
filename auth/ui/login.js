const form = document.querySelector('#login-form');
const submit = document.querySelector('#submit');
const error = document.querySelector('#error');
const password = document.querySelector('#password');
document.querySelector('#show-password').addEventListener('click', (event) => {
  const show = password.type === 'password';
  password.type = show ? 'text' : 'password';
  event.target.textContent = show ? '隐藏' : '显示';
  event.target.setAttribute('aria-pressed', String(show));
});
function destination() {
  try {
    const next = new URL(new URLSearchParams(location.search).get('next') || '/', location.origin);
    if (next.origin === location.origin && !next.pathname.startsWith('/auth/') && !next.pathname.startsWith('/_/')) {
      return next.pathname + next.search + next.hash;
    }
  } catch (_) { /* invalid return URL */ }
  return '/';
}
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  submit.disabled = true;
  submit.textContent = '正在登录…';
  error.textContent = '';
  try {
    const response = await fetch('/api/collections/members/auth-with-password', {
      method: 'POST', headers: {'Content-Type': 'application/json'}, credentials: 'same-origin',
      body: JSON.stringify({identity: document.querySelector('#identity').value.trim(), password: password.value}),
    });
    if (!response.ok) {
      error.textContent = response.status === 429 ? '尝试次数过多，请稍后再试。' : '账号或密码错误，或账号已被停用。';
      return;
    }
    // Session stays in an HttpOnly cookie. Do not persist the response token in JS storage.
    password.value = '';
    location.replace(destination());
  } catch (_) { error.textContent = '暂时无法连接，请检查网络后重试。'; }
  finally { submit.disabled = false; submit.textContent = '登录'; }
});
