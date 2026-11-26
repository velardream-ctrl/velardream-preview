// Keep account and order responses out of the offline cache.
const cacheName='apukaveri-shell-005-'+self.registration.scope;
const shell=['sandbox.html','sandbox.mjs','logo.svg','manifest.webmanifest','icon192.png','icon512.png'].map(file=>new URL(file,self.registration.scope).href);
self.addEventListener('install',event=>event.waitUntil(caches.open(cacheName).then(cache=>cache.addAll(shell))));
self.addEventListener('fetch',event=>{
 if(event.request.method==='GET'&&shell.includes(event.request.url))event.respondWith(fetch(event.request).catch(()=>caches.open(cacheName).then(cache=>cache.match(event.request))));
});
