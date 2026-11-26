import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{covers} from '../server/worker.mjs';
import {database} from '../server/local.mjs';
test('Helsinki spring gap, repeated autumn hour, overrides and breaks',()=>{
 const sun={weekly:{0:[{start:'03:00',end:'04:00'}]}};
 const check=(a,b)=>covers(sun,Date.parse(a),Date.parse(b));
 assert(check('2026-10-25T00:00Z','2026-10-25T02:00Z'));
 assert(!check('2026-03-29T00:00Z','2026-03-29T02:00Z'));
 sun.overrides={'2026-10-25':[]};assert(!check('2026-10-25T00:00Z','2026-10-25T01:00Z'));
});
test('synthetic account, permissions, persistence, concurrent claims and reset',async()=>{
 let mail;const env={DB:database(),MODE:'synthetic',deliver:(e,p,c)=>mail=c};
 const api=(path,data,cookie='')=>worker.fetch(new Request('http://localhost/api/'+path,{method:data?'POST':'GET',headers:{Origin:'http://localhost','Content-Type':'application/json',Cookie:cookie},...(data?{body:JSON.stringify(data)}:{})}),env);
 const password='synthetic password only';
 async function signup(n){const body={email:'demo-'+n+'@example.invalid',password};
 assert.equal((await api('register',body)).status,201);assert.equal((await api('login',body)).status,401);
 assert.equal((await api('verify',{code:mail})).status,200);assert.equal((await api('verify',{code:mail})).status,400);
 return (await api('login',body)).headers.get('Set-Cookie').split(';')[0]}
 const [customer,p,q]=[await signup(1),await signup(2),await signup(3)];
 assert.equal((await api('admin',null,p)).status,403);assert.equal((await api('me')).status,401);
 env.DB.prepare('UPDATE accounts SET owner=1 WHERE id=1').bind().run();
 assert.equal((await api('admin',null,customer)).status,200);
 const schedule={weekly:Object.fromEntries(Array.from({length:7},(_,i)=>[i,[{start:'00:00',end:'24:00'}]]))};
 for(const actor of [p,q])assert.equal((await api('profile',{alias:'Demo 1',city:'Kitee',category:3,available:true,schedule},actor)).status,200);
 const start=Math.ceil(Date.now()/60000)*60000+3600000,order={kind:'urgent',city:'Kitee',category:3,start,end:start+3600000};
 assert.equal((await api('orders',{...order,category:1},customer)).status,403);
 const make=async()=> (await (await api('orders',order,customer)).json()).id;
 const id=await make();const race=await Promise.all([p,q].map(c=>api('claim',{id},c)));
 assert.deepEqual(race.map(x=>x.status).sort(),[200,409]);const winner=race[0].status===200?p:q;
 assert.equal((await api('claim',{id:await make()},winner)).status,409);
 await api('recover',{email:'demo-2@example.invalid'});
 assert.equal((await api('reset',{code:mail,password:'replacement demo password'})).status,200);
 assert.equal((await api('me',null,p)).status,401);
});
