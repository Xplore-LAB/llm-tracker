import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const env={...process.env,TRACKER_SUPABASE_URL:'',TRACKER_SUPABASE_PUBLISHABLE_KEY:'',PYTHONPYCACHEPREFIX:tmpdir()+'/tracker-test-pycache'};
delete env.TRACKER_AUTH_ENABLED;
const build=(args=[],extra={})=>spawnSync('python3',['auth/build_pages.py',...args],{cwd:root,env:{...env,...extra},encoding:'utf8'});
test('login production rejects missing/privileged credentials and misspelled switches',()=>{
  assert.notEqual(build(['--mode','login']).status,0);
  assert.notEqual(build([],{TRACKER_AUTH_ENABLED:'tru'}).status,0);
  assert.notEqual(build([],{TRACKER_AUTH_ENABLED:'true'}).status,0);
  assert.notEqual(build(['--mode','login'],{TRACKER_SUPABASE_URL:'https://example.supabase.co',TRACKER_SUPABASE_PUBLISHABLE_KEY:'sb_secret_DO_NOT_SHIP'}).status,0);
});
test('login Pages artifact covers every entry and excludes backend and shared state',()=>{
  const result=build(['--preview','--mode','login']); assert.equal(result.status,0,result.stderr);
  const out=root+'/auth/pages-preview/';
  const manifest=JSON.parse(readFileSync(out+'build-manifest.json'));
  assert.equal(manifest.pages.length,23); assert.equal(manifest.accountPages,7); assert.equal(manifest.configured,false);
  for(const page of manifest.pages){
    const html=readFileSync(out+page,'utf8');
    const encoded=JSON.parse(html.match(/<script id="tracker-source" type="application\/json">(.*?)<\/script>/s)[1]);
    const source=Buffer.from(encoded,'base64').toString();
    assert.ok(source.includes('toolbar.css')); assert.ok(!source.includes('https://llm-tracker-api.llm-tracker-api.workers.dev'));
    assert.ok(/type="module" src="(?:\.\.\/)*account\/guard.js"/.test(html), page);
    if(source.includes('function syncFavsURL(){')) assert.ok(source.includes('function syncFavsURL(){return null;'));
  }
  for(const page of ['login','reset','callback','password','profile','status','admin']) assert.ok(readFileSync(out+'account/'+page+'.html','utf8').includes(`data-page="${page}"`));
  const files=readdirSync(out,{recursive:true}).map(String);
  for(const name of files) assert.doesNotMatch(name,/(^|\/)(auth|pb_data|pb_hooks|node_modules|tests|package\.json|local-accounts\.txt|favorites\.json|llm-proxy-server\.js)(\/|$)/);
  assert.ok(readFileSync(out+'account/third-party-notices.txt','utf8').includes('Copyright (c) 2020 Supabase'));
  assert.ok(readFileSync(out+'account/config.js','utf8').includes('"testMode": false'));
});

test('default production is public, unchanged site files and no authentication dependency',()=>{
  const result=build([],{TRACKER_SUPABASE_URL:'not-needed',TRACKER_SUPABASE_PUBLISHABLE_KEY:'sb_secret_IGNORED_IN_PUBLIC'});
  assert.equal(result.status,0,result.stderr);
  const out=root+'/auth/pages-dist/';
  const manifest=JSON.parse(readFileSync(out+'build-manifest.json'));
  assert.equal(manifest.mode,'public'); assert.equal(manifest.accountPages,0);
  assert.equal(existsSync(out+'account'),false);
  assert.equal(existsSync(out+'auth'),false);
  for(const page of [...manifest.pages,'favorites.json','robots.txt']) assert.deepEqual(readFileSync(out+page),readFileSync(root+'/'+page),page);
  assert.ok(!readFileSync(out+'index.html','utf8').includes('account/guard.js'));
});
test('switch public → login → public replaces artifacts without stale account pages',()=>{
  for(const mode of ['false','true','false']) {
    const result=build(['--preview'],{TRACKER_AUTH_ENABLED:mode});
    assert.equal(result.status,0,result.stderr);
    const out=root+'/auth/pages-preview/';
    const manifest=JSON.parse(readFileSync(out+'build-manifest.json'));
    assert.equal(manifest.mode,mode==='true'?'login':'public');
    assert.equal(existsSync(out+'account/login.html'),mode==='true');
    assert.equal(readFileSync(out+'index.html','utf8').includes('id="tracker-source"'),mode==='true');
  }
});
