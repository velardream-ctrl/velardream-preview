// Exercise the exact browser worker with local files instead of Worker messaging.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const model=fs.readFileSync('singer-studio/velar-mask-v1.json','utf8');
let loads=0,result;
const ctx=vm.createContext({Float32Array,Float64Array,Math,
  fetch:async()=>{loads++;return {ok:true,json:()=>JSON.parse(model)};},
  postMessage:data=>{if(data.error)throw Error(data.error);if(data.vocals)result=data;}
});
vm.runInContext(fs.readFileSync('singer-studio/separate-worker.js','utf8'),ctx);
for(const path of process.argv.slice(2)){
  const bytes=fs.readFileSync(path);
  const mix=new Float32Array(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length));
  const input=mix.slice();
  await ctx.onmessage({data:[input]});
  for(let i=0;i<mix.length;i++)assert.ok(Math.abs(mix[i]-result.vocals[0][i]-result.instrumental[0][i])<1e-6);
  for(const key of ['vocals','instrumental'])fs.writeFileSync(path+'.'+key,Buffer.from(result[key][0].buffer));
}
assert.equal(loads,1);
