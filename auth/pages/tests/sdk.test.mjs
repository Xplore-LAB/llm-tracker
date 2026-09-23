import test from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {startFixture} from './fixture.mjs';
import {currentMember} from '../core.js';
test('official SDK transport: password login, reset, invitation, password change and signout (mock server)',async()=>{
  const fixture=await startFixture();
  const client=createClient(fixture.url,'sb_publishable_fixture',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const mail=async action=>{
    const html=await(await fetch(fixture.url+'/__fixture/'+(action?'?action='+action:''))).text();
    const href=html.match(/href="([^"]+)">打开最近模拟邮件/)[1];
    return Object.fromEntries(new URLSearchParams(new URL(href,fixture.url).hash.slice(1)));
  };
  try {
    assert.ok((await client.auth.signInWithPassword({email:'active@example.test',password:'bad'})).error);
    assert.equal((await client.auth.signInWithPassword({email:'active@example.test',password:'Example-test-password-2026'})).error,null);
    assert.equal((await currentMember(client)).status,'active');
    assert.ok((await client.auth.updateUser({password:'Updated-test-password-2026',current_password:'wrong'})).error);
    assert.equal((await client.auth.updateUser({password:'Updated-test-password-2026',current_password:'Example-test-password-2026'})).error,null);
    assert.equal((await client.auth.signOut({scope:'global'})).error,null);
    assert.ok((await client.auth.signInWithPassword({email:'active@example.test',password:'Example-test-password-2026'})).error);
    assert.equal((await client.auth.resetPasswordForEmail('active@example.test')).error,null);
    const recovery=await mail();assert.equal(recovery.type,'recovery');
    assert.equal((await client.auth.verifyOtp(recovery)).error,null);
    assert.equal((await client.auth.updateUser({password:'Recovered-test-password-2026'})).error,null);
    assert.ok((await client.auth.verifyOtp(recovery)).error,'links must be single use');
    await fetch(fixture.url+'/__fixture/?action=disable');
    await assert.rejects(currentMember(client),/disabled/);
    await fetch(fixture.url+'/__fixture/?action=activate');
    assert.equal((await currentMember(client)).status,'active');
    await client.auth.signOut();
    assert.equal((await client.auth.signInWithPassword({email:'active@example.test',password:'Recovered-test-password-2026'})).error,null);
    const invitation=await mail('invite');assert.equal(invitation.type,'invite');
    assert.equal((await client.auth.verifyOtp(invitation)).error,null);
    await assert.rejects(currentMember(client),/pending/);
    assert.equal((await client.auth.updateUser({password:'Invited-test-password-2026'})).error,null);
    await client.auth.signOut();
    await assert.rejects(currentMember(client),/signed-out/);
  } finally {await client.auth.signOut();await fixture.close()}
});
