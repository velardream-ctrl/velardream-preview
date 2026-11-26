import worker from './worker.mjs';
export default {fetch(request,env){
 const local=['localhost','127.0.0.1','[::1]'].includes(new URL(request.url).hostname);
 if(!local)return new Response('Local test only',{status:403});
 return worker.fetch(request,{MODE:env.MODE,DB:env.DB,deliver:(email,purpose,code)=>console.log('TEST MAIL',email,purpose,code)});
}};
