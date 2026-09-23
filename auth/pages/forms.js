import {getClient, accountURL, base, config} from './client.js';
import {currentMember, passwordError, readCallback, safeDestination} from './core.js';

const page = document.body.dataset.page;
const content = document.querySelector('#content');
const message = document.querySelector('#message');
const next = safeDestination(new URL(location.href).searchParams.get('next'), base);
const flowKey = 'tracker-password-flow:' + base.pathname;
const titles = {
  login: ['登录', '使用团队邮箱和密码登录。'],
  reset: ['找回密码', '输入账号邮箱，我们会发送密码重置链接。'],
  callback: ['验证邮件', '请确认继续，以完成邮件验证。'],
  password: ['设置密码', '密码至少 12 个字符，请勿与其他网站共用。'],
  profile: ['账号设置', '查看当前账号并管理登录密码。'],
  status: ['账号状态', '请检查账号状态后继续。'],
  admin: ['管理员入口', '管理员账号与成员账号独立，请前往管理控制台。'],
};
const [title, description] = titles[page] || titles.status;
document.querySelector('h1').textContent = title;
document.querySelector('#description').textContent = description;
document.title = title + ' · 大模型情报局';
function notice(text, kind = '') {
  message.hidden = false;
  message.className = 'message ' + kind;
  message.textContent = text;
}
function link(name, text, className = 'secondary') {
  const node = document.createElement('a');
  node.href = accountURL(name);
  node.textContent = text;
  node.className = className;
  return node;
}
function input(id, label, type = 'text', autocomplete = '') {
  const wrapper = document.createElement('div');
  const caption = document.createElement('label');
  caption.htmlFor = id;
  caption.textContent = label;
  const field = document.createElement('input');
  Object.assign(field, {id, name: id, type, required: true, autocomplete});
  if (type === 'email') { field.placeholder = 'name@example.com'; field.maxLength = 254; }
  wrapper.append(caption);
  if (type === 'password') {
    field.maxLength = 128;
    const row = document.createElement('div'); row.className = 'password-row';
    const button = document.createElement('button');
    Object.assign(button, {type: 'button', className: 'show-password', textContent: '显示'});
    button.setAttribute('aria-label', '显示' + label);
    button.onclick = () => {
      const show = field.type === 'password';
      field.type = show ? 'text' : 'password'; button.textContent = show ? '隐藏' : '显示';
      button.setAttribute('aria-label', (show ? '隐藏' : '显示') + label);
    };
    row.append(field, button); wrapper.append(row);
  } else wrapper.append(field);
  return wrapper;
}
function makeForm(fields, buttonText, handler) {
  const form = document.createElement('form');
  form.append(...fields.map(values => input(...values)));
  const button = document.createElement('button');
  Object.assign(button, {type: 'submit', className: 'primary', textContent: buttonText});
  form.append(button); content.append(form);
  form.onsubmit = async event => {
    event.preventDefault(); message.hidden = true;
    button.disabled = true; button.textContent = '处理中…';
    try { await handler(Object.fromEntries(new FormData(form))); }
    catch (error) { showError(error); }
    finally { button.disabled = false; button.textContent = buttonText; }
  };
  return form;
}
function showError(error) {
  const descriptions = {
    unconfigured: '账号服务尚未开通，请联系管理员。',
    'invalid-config': '账号服务配置异常，请联系管理员。',
    'mfa-required': '该账号需要额外身份验证，当前页面暂不支持，请联系管理员。',
    pending: '账号尚未获准访问，请联系管理员开通。',
    disabled: '账号已停用，请联系管理员。',
    'signed-out': '登录已失效，请重新登录。',
    'invalid-link': '链接无效或已失效，请重新申请，或联系管理员重新邀请。',
  };
  notice(descriptions[error.message] || '暂时无法完成操作，请稍后重试。', 'error');
}
async function authenticatedUser(client) {
  const {data, error} = await client.auth.getUser();
  if (error || !data.user) throw new Error('signed-out');
  if (data.user.factors?.some(factor => factor.status === 'verified')) throw new Error('mfa-required');
  return data.user;
}
function loginPage(client) {
  const form = makeForm([
    ['email', '邮箱', 'email', 'username'], ['password', '密码', 'password', 'current-password'],
  ], '登录', async values => {
    const {error} = await client.auth.signInWithPassword({email: values.email.trim(), password: values.password});
    if (error) {
      notice(error.status === 429 ? '尝试次数过多，请稍后重试。' : '登录失败，请检查邮箱和密码，或稍后重试。', 'error'); return;
    }
    await currentMember(client);
    location.replace(next);
  });
  const options = document.createElement('div'); options.className = 'form-options';
  options.append(link('reset', '忘记密码？', ''));
  form.querySelector('.primary').before(options);
  const help = document.createElement('p'); help.className = 'help';
  help.textContent = '账号由管理员邀请开通。收到邀请邮件后，请通过邮件链接设置密码。';
  content.append(help);
}
function resetPage(client) {
  makeForm([['email', '账号邮箱', 'email', 'email']], '发送重置邮件', async values => {
    const {error} = await client.auth.resetPasswordForEmail(values.email.trim(), {redirectTo: accountURL('callback')});
    if (error) throw error;
    notice('如果该邮箱对应有效账号，你将收到重置邮件。请同时检查垃圾邮件，稍后再尝试重新发送。', 'success');
  });
  content.append(link('login', '返回登录'));
}
function callbackPage(client) {
  let payload;
  try { payload = readCallback(location.href); }
  finally { history.replaceState(null, '', accountURL('callback')); }
  document.querySelector('h1').textContent = payload.type === 'invite' ? '接受团队邀请' : '重置登录密码';
  makeForm([], '继续验证', async () => {
    const {data, error} = await client.auth.verifyOtp(payload);
    if (error || !data.user || !data.session) throw new Error('invalid-link');
    sessionStorage.setItem(flowKey, JSON.stringify({userId: data.user.id, until: Date.now() + 15 * 60 * 1000}));
    location.replace(accountURL('password'));
  });
  content.append(link('login', '返回登录'));
}
async function passwordPage(client) {
  const user = await authenticatedUser(client);
  let flow;
  try { flow = JSON.parse(sessionStorage.getItem(flowKey)); } catch (_) { /* no valid recovery context */ }
  const verifiedLink = flow?.userId === user.id && flow.until > Date.now();
  const fields = verifiedLink ? [] : [['current', '当前密码', 'password', 'current-password']];
  fields.push(['password', '新密码', 'password', 'new-password'], ['confirm', '确认新密码', 'password', 'new-password']);
  makeForm(fields, '保存新密码', async values => {
    const invalid = passwordError(values.password, values.confirm);
    if (invalid) { notice(invalid, 'error'); return; }
    const fresh = await authenticatedUser(client);
    if (fresh.id !== user.id) throw new Error('signed-out');
    const {error} = await client.auth.updateUser({password: values.password,
      ...(verifiedLink ? {} : {current_password: values.current})});
    if (error) { notice('密码未更新，请检查当前密码及密码要求后重试。', 'error'); return; }
    sessionStorage.removeItem(flowKey);
    content.querySelectorAll('input').forEach(field => { field.value = ''; });
    const result = await client.auth.signOut({scope: 'global'});
    if (result.error) {
      notice('密码已更新，但退出其他会话失败。请稍后重试退出。', 'error');
      content.replaceChildren(link('profile', '返回账号设置')); return;
    }
    notice('密码已更新，请使用新密码登录。', 'success');
    content.replaceChildren(link('login', '返回登录', 'primary'));
  });
  content.append(link('profile', '返回账号设置'));
}
async function profilePage(client) {
  const member = await currentMember(client);
  for (const [name, value] of [['邮箱', member.email], ['姓名', member.display_name || '未填写'], ['账号状态', '正常']]) {
    const row = document.createElement('dl'); row.className = 'detail';
    const label = document.createElement('dt'); label.textContent = name;
    const text = document.createElement('dd'); text.textContent = value;
    row.append(label, text); content.append(row);
  }
  content.append(link('password', '修改密码', 'primary'));
  const back = document.createElement('a'); back.href = base.href; back.textContent = '返回网站'; back.className = 'secondary';
  content.append(back);
  makeForm([], '退出登录', async () => {
    const {error} = await client.auth.signOut({scope: 'local'});
    if (error) throw error;
    location.replace(accountURL('login'));
  });
}
async function start() {
  if (config.testMode) {
    const banner = document.createElement('div'); banner.className = 'test-notice';
    banner.textContent = '本地流程测试 · 使用模拟账号服务'; document.body.append(banner);
  }
  if (page === 'admin') {
    const admin = document.createElement('a');
    admin.href = 'https://supabase.com/dashboard'; admin.rel = 'noopener noreferrer';
    admin.textContent = '打开管理员控制台'; admin.className = 'primary'; content.append(admin);
    const hint = document.createElement('p'); hint.className = 'help';
    hint.textContent = '管理员可邀请、开通和停用成员。成员登录不需要管理员在线。'; content.append(hint);
    content.append(link('login', '返回成员登录')); return;
  }
  let client;
  try { client = getClient(); }
  catch (error) {
    // Render a usable-looking form, but never allow an unconfigured site to sign in.
    if (page === 'login') {
      loginPage(null);
      content.querySelectorAll('input, button').forEach(node => { node.disabled = true; });
    }
    throw error;
  }
  if (page === 'login') loginPage(client);
  else if (page === 'reset') resetPage(client);
  else if (page === 'callback') callbackPage(client);
  else if (page === 'password') await passwordPage(client);
  else if (page === 'profile') await profilePage(client);
  else {
    showError(new Error(new URL(location.href).searchParams.get('reason') || 'unavailable'));
    makeForm([], '重新检查', async () => { await currentMember(client); location.replace(next); });
    makeForm([], '退出并切换账号', async () => {
      const {error} = await client.auth.signOut({scope: 'local'});
      if (error) throw error;
      location.replace(accountURL('login'));
    });
  }
}
start().catch(error => { showError(error); if (page !== 'login') content.append(link('login', '返回登录')); });
