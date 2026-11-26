const words=[
 ['Apua lähellä, kun sitä tarvitset.','Помощь рядом, когда она нужна.','Help nearby, when you need it.'],
 ['Testitili','Тестовая учётная запись','Test account'],['Käytä vain keksittyjä testitietoja. Vahvistuskoodi näkyy paikallisen palvelimen päätteessä.','Используйте только вымышленные данные. Код подтверждения появится в терминале локального сервера.','Use invented test details only. The verification code appears in the local server terminal.'],
 ['Testisähköposti','Тестовый email','Test email'],['Testisalasana (12+ merkkiä)','Тестовый пароль (от 12 символов)','Test password (12+ characters)'],['Muista minut','Запомнить меня','Remember me'],['Rekisteröidy','Регистрация','Register'],['Kirjaudu','Войти','Sign in'],['Koodi','Код','Code'],['Vahvista','Подтвердить','Verify'],['Pyydä palautuskoodi','Запросить код сброса','Request reset code'],['Aseta uusi salasana','Установить новый пароль','Set new password'],
 ['Oma profiili','Моя анкета','My profile'],['Kaupunki','Город','City'],['Palvelu','Услуга','Service'],['Ota testipyyntöjä päivittäin klo 9–17','Принимать тестовые заявки ежедневно с 9 до 17','Accept test requests daily from 9 to 17'],['Tallenna','Сохранить','Save'],['Tilaukset','Заказы','Orders'],['Luo tunnin testipyyntö huomiselle klo 12 (Helsinki)','Создать тестовую заявку на завтра с 12 до 13 по Хельсинки','Request one hour tomorrow at noon (Helsinki)'],['Päivitä','Обновить','Refresh'],['Hyväksy','Принять','Accept'],['Kirjaudu ulos','Выйти','Sign out'],['Valmis','Готово','Done'],['Toiminto epäonnistui','Действие не выполнено','Action failed'],['Vapaa','Открыт','Open'],['Varattu','Назначен','Assigned'],['Ei tilauksia','Заказов пока нет','No orders yet'],['Etusivu','Главная','Home'],['Omistajan hallinta','Панель владельца','Owner dashboard'],['Käyttäjät','Пользователи','Users'],['Palvelumaksu %','Комиссия %','Commission %']];
const key='apukaveri-demo-language',langs=['fi','ru','en'];
let locale=localStorage.getItem(key)||'fi',me=null,cats=[];
if(!langs.includes(locale))locale='fi';
const t=i=>words[i][langs.indexOf(locale)],el=id=>document.getElementById(id);
const field=(i,control)=>'<label>'+t(i)+control+'</label>';
const button=(i)=>'<button data-action="'+i+'">'+t(i)+'</button>';
async function api(name,data){const r=await fetch('api/'+name,data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{});if(!r.ok)throw Error(String(r.status));return r.json()}
function render(){
 document.documentElement.lang=locale;el('lang').value=locale;
 let html='<h1>'+t(0)+'</h1><a href="index.html">'+t(27)+'</a>';
 if(!me)html+='<article><h2>'+t(1)+'</h2><p>'+t(2)+'</p>'+field(3,'<input id="email" value="demo-1@example.invalid">')+field(4,'<input id="pwd" type="password" autocomplete="off">')+field(5,'<input id="remember" type="checkbox">')+'<div class="actions">'+button(6)+button(7)+'</div>'+field(8,'<input id="code">')+'<div class="actions">'+button(9)+button(10)+button(11)+'</div></article>';
 else html+='<article><h2>'+t(12)+' · '+me.id+'</h2>'+field(13,'<select id="city"><option>Kitee</option><option>Joensuu</option><option>Helsinki</option></select>')+field(14,'<select id="category"></select>')+field(15,'<input id="available" type="checkbox">')+button(16)+'</article><article><h2>'+t(17)+'</h2><div class="actions">'+button(18)+button(19)+'</div><ul id="orders"></ul></article>'+button(21);
 if(me?.owner)html+='<article><h2>'+t(28)+'</h2><p id="metrics"></p><select id="editCategory" aria-label="'+t(14)+'"></select>'+['fi','ru','en'].map(l=>'<label>'+l.toUpperCase()+'<input id="edit-'+l+'"></label>').join('')+field(30,'<input type="number" min="0" max="100" id="commission">')+'<button data-action="31">'+t(16)+'</button></article>';
 el('app').innerHTML=html;
 if(me?.owner){const select=el('editCategory');for(const c of cats)select.add(new Option(c[locale],c.id));select.onchange=()=>{const c=cats.find(c=>c.id===Number(select.value));for(const l of langs)el('edit-'+l).value=c[l];el('commission').value=c.commission};select.onchange();api('admin').then(a=>{if(el('metrics'))el('metrics').textContent=t(29)+' · '+a.users+' / '+t(17)+' · '+a.orders})}
 if(me){for(const c of cats.filter(c=>!c.restricted))el('category').add(new Option(c[locale],c.id));el('category').value=me.category||3;el('city').value=me.city;el('available').checked=!!me.available}
}
async function orders(){
 const rows=await api('orders');const ul=el('orders');ul.replaceChildren();if(!rows.length)ul.textContent=t(26);
 for(const row of rows){const li=document.createElement('li');li.textContent='#'+row.id+' · '+cats.find(c=>c.id===row.category)?.[locale]+' · '+t(row.provider?25:24)+' ';if(!row.provider&&row.customer!==me.id&&row.kind!=='listing'){const b=document.createElement('button');b.textContent=t(20);b.dataset.claim=row.id;li.append(b)}ul.append(li)}
}
async function refresh(){me=await api('me');cats=await api('categories');render();await orders()}
function tomorrow(){
 const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Helsinki'}).format(Date.now()+86400000);
 const noon=Date.parse(date+'T12:00:00Z'),hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Helsinki',hour:'2-digit'}).format(noon));
 return noon-(hour-12)*3600000;
}
el('lang').onchange=async e=>{locale=e.target.value;localStorage.setItem(key,locale);el('status').textContent='';render();if(me)await orders()};
el('app').onclick=async e=>{
 if(!e.target.matches('button'))return;
 const i=Number(e.target.dataset.action),val=id=>el(id).value;
 try{
 if(e.target.dataset.claim)await api('claim',{id:Number(e.target.dataset.claim)});
 if([6,7,10].includes(i))await api(({6:'register',7:'login',10:'recover'})[i],{email:val('email'),password:val('pwd'),remember:el('remember').checked});
 if([9,11].includes(i))await api(i===9?'verify':'reset',{code:val('code'),password:val('pwd')});
 if(i===31){await api('admin/category',{id:Number(val('editCategory')),commission:Number(val('commission')),...Object.fromEntries(langs.map(l=>[l,val('edit-'+l)]))});await refresh()}
 if(i===7)await refresh();
 if(i===16)await api('profile',{alias:'Demo '+me.id,city:val('city'),category:Number(val('category')),available:el('available').checked,schedule:{weekly:Object.fromEntries(Array.from({length:7},(_,n)=>[n,[{start:'09:00',end:'17:00'}]]))}});
 if(i===18){const start=tomorrow();await api('orders',{city:val('city'),category:Number(val('category')),kind:'urgent',start,end:start+3600000})}
 if(i===21){await api('logout',{});me=null;render()}
 if(me)await orders();el('status').textContent=t(22);
 }catch(err){el('status').textContent=t(23)+' ('+err.message+')'}
};
render();try{await refresh()}catch{}

if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
