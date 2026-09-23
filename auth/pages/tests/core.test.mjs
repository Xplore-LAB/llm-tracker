import test from 'node:test';
import assert from 'node:assert/strict';
import {siteBase, safeDestination, assertPublicConfig, readCallback, passwordError, currentMember, rawStorage, scopeStorage} from '../core.js';
const base = new URL('https://xplore-lab.github.io/llm-tracker/');
test('project subpath and safe return destinations', () => {
  assert.equal(siteBase(base + 'account/guard.js').href, base.href);
  for (const value of ['https://evil.test', '//evil.test', '../other/', '/llm-tracker-x/', 'account/password.html', '\\evil.test', 'a\nb', '/llm-tracker/../private']) assert.equal(safeDestination(value, base), base.href, value);
  assert.equal(safeDestination('learn.html?q=hi#one', base), base + 'learn.html?q=hi#one');
});
test('configuration accepts public keys only, HTTPS and valid origins', () => {
  const jwt = role => 'header.' + Buffer.from(JSON.stringify({role})).toString('base64url') + '.signature';
  for (const key of ['sb_publishable_example', jwt('anon')]) assert.doesNotThrow(() => assertPublicConfig({url:'https://example.supabase.co', key}, base));
  for (const key of ['sb_secret_test', jwt('service_role'), 'not-a-key']) assert.throws(() => assertPublicConfig({url:'https://example.supabase.co', key}, base));
  for (const url of ['http://example.test','https://user:pass@example.test','https://example.test/path','https://example.test?key=value']) assert.throws(() => assertPublicConfig({url,key:'sb_publishable_example'}, base));
  assert.throws(() => assertPublicConfig({url:'http://127.0.0.1:8092',key:'sb_publishable_example',testMode:true}, base));
  assert.doesNotThrow(() => assertPublicConfig({url:'http://127.0.0.1:8092',key:'sb_publishable_example',testMode:true}, new URL('http://localhost/llm-tracker/')));
});
test('mail links require supported types and token hashes', () => {
  for (const type of ['invite','recovery']) assert.deepEqual(readCallback(base + 'account/callback.html#token_hash=abcdefghijklmnopqrstuvwxyz&type=' + type),{type,token_hash:'abcdefghijklmnopqrstuvwxyz'});
  for (const suffix of ['', '#access_token=abc&type=invite', '#token_hash=short&type=invite', '#token_hash=abcdefghijklmnopqrstuvwxyz&type=signup']) assert.throws(() => readCallback(base + 'account/callback.html' + suffix));
  assert.ok(passwordError('short','short'));
  assert.ok(passwordError('a long password','different'));
  assert.equal(passwordError('a long password','a long password'),'');
});
function client({status='active', authError=null, memberError=null, missing=false,factors=[]}={}) {
  return {auth:{getUser:async()=>({data:{user:{id:'u1',email:'member@example.test',factors}},error:authError})},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:missing?null:{user_id:'u1',status},error:memberError})})})})};
}
test('membership fails closed on expired sessions, disabled/pending users and outages', async()=>{
  await assert.rejects(currentMember(client({factors:[{status:'verified'}]})), /mfa-required/);
  assert.equal((await currentMember(client())).email,'member@example.test');
  for (const status of ['pending','disabled','unexpected']) await assert.rejects(currentMember(client({status})), new RegExp(status==='pending'?'pending':'disabled'));
  await assert.rejects(currentMember(client({missing:true})), /pending/);
  await assert.rejects(currentMember(client({memberError:{code:'network'}})), /unavailable/);
  await assert.rejects(currentMember(client({authError:{status:401}})), /signed-out/);
  await assert.rejects(currentMember(client({authError:{status:500}})), /unavailable/);
});
test('legacy storage isolation preserves the SDK session and other accounts',()=>{
  class Storage {
    constructor(){this.data=new Map()}
    get length(){return this.data.size}
    getItem(k){return this.data.get(String(k))??null}
    setItem(k,v){this.data.set(String(k),String(v))}
    removeItem(k){this.data.delete(String(k))}
    key(i){return [...this.data.keys()][i]??null}
    clear(){this.data.clear()}
  }
  const storage=new Storage(); const sdk=rawStorage(storage);
  sdk.setItem('tracker-auth:/llm-tracker/','session');
  sdk.setItem('tracker:/llm-tracker/:B:progress','B-progress');
  sdk.setItem('progress','old-anonymous');
  scopeStorage(Storage,'tracker:/llm-tracker/:A:');
  assert.equal(storage.getItem('progress'),null);
  storage.setItem('progress','A-progress');
  assert.equal(storage.length,1); assert.equal(storage.key(0),'progress');
  sdk.setItem('tracker-auth:/llm-tracker/','refreshed-session');
  storage.clear();
  assert.equal(storage.getItem('progress'),null);
  assert.equal(sdk.getItem('tracker-auth:/llm-tracker/'),'refreshed-session');
  assert.equal(sdk.getItem('tracker:/llm-tracker/:B:progress'),'B-progress');
  assert.equal(sdk.getItem('progress'),'old-anonymous');
});
