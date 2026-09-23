// Development fixture. Not a real identity service. Excluded from Pages output.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
const project=fileURLToPath(new URL('../../../',import.meta.url));
export async function startFixture({port=0,preview=false}={}) {
  const folder=resolve(project,preview?'auth/pages-preview':'auth/pages-test-dist');
  const users=new Map(['active','pending','disabled'].map((state,i)=>[state+'@example.test',{id:`00000000-0000-4000-8000-00000000000${i+1}`,email:state+'@example.test',aud:'authenticated',role:'authenticated',created_at:new Date().toISOString(),app_metadata:{provider:'email'},user_metadata:{},status:state,password:'Example-test-password-2026'}]));
  const tokens=new Map(),refreshTokens=new Map(),links=new Map(); let mail='';
  const publicUser=user=>Object.fromEntries(Object.entries(user).filter(([key])=>!['password','status'].includes(key)));
  const token=user=>{
    const access_token=['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600,aud:'authenticated',role:'authenticated',email:user.email})).toString('base64url'),crypto.randomUUID().replaceAll('-','')].join('.');
    const refresh_token=crypto.randomUUID(); tokens.set(access_token,user); refreshTokens.set(refresh_token,user);
    return {access_token,refresh_token,token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:publicUser(user)};
  };
  const server=createServer(async(req,res)=>{
    const url=new URL(req.url,'http://127.0.0.1');
    res.setHeader('Cache-Control','no-store');
    const json=(value,status=200)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));};
    try {
      if(!preview && (url.pathname.startsWith('/auth/')||url.pathname.startsWith('/rest/'))) {
        let text='';for await(const chunk of req)text+=chunk;const body=text?JSON.parse(text):{};
        const user=tokens.get((req.headers.authorization||'').replace(/^Bearer /,''));
        if(url.pathname==='/auth/v1/token') {
          const match=url.searchParams.get('grant_type')==='refresh_token'?refreshTokens.get(body.refresh_token):users.get(body.email);
          if(!match || (body.password && body.password!==match.password)) return json({msg:'Invalid login credentials',code:'invalid_credentials'},400);
          return json(token(match));
        }
        if(url.pathname==='/auth/v1/verify') {
          const link=links.get(body.token_hash); if(!link||link.type!==body.type)return json({msg:'Token expired',code:'otp_expired'},403);
          links.delete(body.token_hash);return json(token(link.user));
        }
        if(url.pathname==='/auth/v1/recover') {
          const match=users.get(body.email);if(match){const key=crypto.randomUUID().replaceAll('-','');links.set(key,{user:match,type:'recovery'});mail='/llm-tracker/account/callback.html#token_hash='+key+'&type=recovery';}
          return json({});
        }
        if(!user)return json({msg:'Invalid token'},401);
        if(url.pathname==='/auth/v1/user' && req.method==='GET')return json(publicUser(user));
        if(url.pathname==='/auth/v1/user' && req.method==='PUT') {
          if(body.current_password && body.current_password!==user.password)return json({msg:'Invalid password'},400);
          if(body.password?.length<12)return json({msg:'Weak password'},400);
          user.password=body.password;return json(publicUser(user));
        }
        if(url.pathname==='/auth/v1/logout') {
          for(const [key,value]of tokens)if(value.id===user.id)tokens.delete(key);
          for(const [key,value]of refreshTokens)if(value.id===user.id)refreshTokens.delete(key);
          res.statusCode=204;return res.end();
        }
        if(url.pathname==='/rest/v1/tracker_members')return json([{user_id:user.id,display_name:'测试成员',status:user.status}]);
        return json({msg:'Fixture endpoint not implemented'},404);
      }
      if(!preview && url.pathname==='/__fixture/') {
        const action=url.searchParams.get('action');const active=users.get('active@example.test');
        if(action==='disable')active.status='disabled';if(action==='activate')active.status='active';
        if(action==='invite'){const key=crypto.randomUUID().replaceAll('-','');links.set(key,{user:users.get('pending@example.test'),type:'invite'});mail='/llm-tracker/account/callback.html#token_hash='+key+'&type=invite';}
        res.setHeader('Content-Type','text/html;charset=utf-8');
        return res.end(`<h1>仅限本地测试：模拟邮件与管理员</h1><p>不会发送邮件，也不代表真实 Supabase 配置完成。</p><p>测试邮箱：active@example.test / pending@example.test / disabled@example.test</p><p>初始测试密码：Example-test-password-2026</p><p>active 状态：${active.status}</p><a href="?action=invite">生成邀请</a> · <a href="?action=disable">停用 active</a> · <a href="?action=activate">恢复 active</a><p><a href="${mail||'#'}">打开最近模拟邮件</a></p><a href="/llm-tracker/account/login.html">打开登录页</a>`);
      }
      if(!url.pathname.startsWith('/llm-tracker/')){res.statusCode=404;return res.end('Not found')}
      let relative=decodeURIComponent(url.pathname.slice('/llm-tracker/'.length)); if(!relative||relative.endsWith('/'))relative+='index.html';
      const path=resolve(folder,relative);if(!path.startsWith(folder+sep)){res.statusCode=404;return res.end('Not found')}
      const data=await readFile(path);res.setHeader('Content-Type',({'.html':'text/html;charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'})[extname(path)]||'application/octet-stream');res.end(data);
    }catch(_){res.statusCode=404;res.end('Not found')}
  });
  await new Promise((done,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',done)});
  return {url:'http://127.0.0.1:'+server.address().port,close:()=>new Promise(done=>server.close(done))};
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const preview=process.argv.includes('--preview');const fixture=await startFixture({port:preview?8091:8092,preview});
  console.log((preview?'Unconfigured preview: ':'LOCAL MOCK ONLY: ')+fixture.url+'/llm-tracker/account/login.html');
}
