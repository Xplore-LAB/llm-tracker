import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('real PostgreSQL: member lifecycle, idempotent schema and RLS isolation', async()=>{
  const db=new PGlite();
  const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002';
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
      insert into auth.users values ('${a}');`);
    const schema=await readFile(new URL('../schema.sql',import.meta.url),'utf8');
    await db.exec(schema); await db.exec(schema);
    await db.exec(`insert into auth.users values ('${b}');`);
    assert.equal((await db.query('select count(*)::int as n from tracker_members')).rows[0].n,2);
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${a}';`);
    assert.deepEqual((await db.query('select user_id,status from tracker_members')).rows,[{user_id:a,status:'pending'}]);
    for (const query of ["update tracker_members set status='active'",'delete from tracker_members',`insert into tracker_members(user_id,status) values ('${a}','active')`]) await assert.rejects(db.exec(query), /permission denied/);
    await db.exec('reset role; set role anon;');
    await assert.rejects(db.query('select * from tracker_members'),/permission denied/);
    await db.exec('reset role;');
    for(const status of ['active','disabled']) {
      await db.exec(`update tracker_members set status='${status}' where user_id='${a}'; set role authenticated;`);
      assert.equal((await db.query('select status from tracker_members')).rows[0].status,status);
      await db.exec('reset role;');
    }
    await db.exec(`delete from auth.users where id='${a}';`);
    assert.equal((await db.query('select count(*)::int as n from tracker_members')).rows[0].n,1);
  } finally {await db.close()}
});
