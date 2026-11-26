import {DatabaseSync} from 'node:sqlite';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import worker from './worker.mjs';
export function database(file=':memory:'){
 const db=new DatabaseSync(file);
 db.exec('PRAGMA foreign_keys=ON');
 if(!db.prepare("SELECT 1 FROM sqlite_master WHERE name='accounts'").get())db.exec(readFileSync(new URL('./migrations/0001.sql',import.meta.url),'utf8'));
 return {prepare(query){return {bind(...args){const stmt=db.prepare(query);return {
 first:()=>stmt.get(...args),all:()=>({results:stmt.all(...args)}),run:()=>{const r=stmt.run(...args);return {meta:{changes:r.changes,last_row_id:Number(r.lastInsertRowid)}}}
 }}}},batch(ops){db.exec('BEGIN IMMEDIATE');try{const out=ops.map(x=>x.run());db.exec('COMMIT');return out}catch(e){db.exec('ROLLBACK');throw e}}};
}
if(import.meta.main){
 const port=Number(process.env.PORT||8787),origin='http://127.0.0.1:'+port;
 const env={MODE:'synthetic',DB:database(process.env.APUKAVERI_DB||':memory:'),deliver:(email,purpose,code)=>console.log('TEST MAIL',email,purpose,code)};
 const files={'/':'index.html','/index.html':'index.html','/account.html':'account.html','/dispatch.html':'dispatch.html','/availability.mjs':'availability.mjs','/sandbox.html':'sandbox.html','/sandbox.mjs':'sandbox.mjs','/logo.svg':'logo.svg'};
 createServer(async(input,output)=>{try{
 if(input.headers.host!==new URL(origin).host){output.writeHead(403).end();return}
 const path=new URL(input.url,origin).pathname;
 if(path.startsWith('/api/')){
 let body='';for await(const chunk of input){body+=chunk;if(body.length>16384){output.writeHead(413).end();return}}
 const r=await worker.fetch(new Request(origin+input.url,{method:input.method,headers:input.headers,...(body?{body}:{})}),env);
 output.writeHead(r.status,Object.fromEntries(r.headers));output.end(await r.text());return}
 if(!Object.hasOwn(files,path)){output.writeHead(404).end();return}
 const file=files[path],type=file.endsWith('.html')?'text/html':file.endsWith('.svg')?'image/svg+xml':'text/javascript';
 output.writeHead(200,{'Content-Type':type+'; charset=utf-8'});output.end(readFileSync(new URL('../'+file,import.meta.url)));
 }catch{output.writeHead(500).end()}}).listen(port,'127.0.0.1',()=>console.log(origin+'/sandbox.html'));
}
