/* RUN-220: safe batch preparation from owner-authorized Suno MCP/API export.
   No Suno cookies, private API, scraping or Firestore writes. No network requests.
   The output is a REVIEW PACKAGE, NOT a Firestore import.
 */
(function (global) {
'use strict';
function str(x){return typeof x==='string'?x.trim():'';}
function canon(s){return str(s).normalize('NFKC').toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/[‘’'"“”]/g,'').replace(/\s+/g,' ').trim();}
function entries(document){
 if(Array.isArray(document))return document;
 for(const a of [document?.songs,document?.tracks,document?.items,document?.clips,document?.data?.songs,document?.data?.items,document?.data?.clips,document?.library?.songs])
  if(Array.isArray(a))return a;
 return [];
}
function lyricsOf(item){
 const m=item?.metadata||{};
 // Explicitly known common content fields only; unknown Suno MCP response schemas
 // require a reviewed adapter instead of guessing and mixing prompts with actual lyrics.
 return str(item?.lyrics)||str(item?.song_lyrics)||str(item?.text)||str(m.lyrics)||str(m.prompt)||'';
}
function sourceId(item){
 return str(item?.id)||str(item?.clip_id)||str(item?.song_id)||str(item?.uuid);
}
function titleOf(item){
 return str(item?.title)||str(item?.name)||str(item?.metadata?.title);
}
function artistOf(item){
 return str(item?.artist)||str(item?.display_name)||str(item?.metadata?.artist);
}
function normalizeSource(item,index) {
 const title=titleOf(item),body=lyricsOf(item),sourceIdValue=sourceId(item);
 if(!title)return {status:'invalid',reason:'Нет названия песни',index:index};
 if(!body)return {status:'invalid',reason:'Не найден текст песни',index:index,title:title};
 if(body.length>200000)return {status:'invalid',reason:'Слишком длинный текст — требует проверки',index:index,title:title};
 const url=str(item?.url)||str(item?.song_url)||'';
 const language=str(item?.language)||str(item?.metadata?.language)||'Не указан';
 const version='Suno'+(sourceIdValue?' · '+sourceIdValue.slice(0,80):' · запись '+(index+1));
 return {status:'ready',title:title,artist:artistOf(item),sourceId:sourceIdValue,
  language:language,version:version,text:body.replace(/\r\n?/g,'\n'),sourceUrl:/^https:\/\/suno\.com\//.test(url)?url:'',
  sourceIndex:index};
}
function normalizeCatalog(song){
 return {title:str(song?.title),artist:str(song?.artist),catalogRow:String(song?.sourceRow??song?.catalogRow??''),
   upc:str(song?.upc),id:str(song?.id)};
}
function candidates(row,catalog) {
 const title=canon(row.title);
 if(!title)return [];
 const same=catalog.filter(s=>canon(s.title)===title);
 // When artists are known on both sides, use exact match. If ambiguous, require review.
 const withArtists=same.filter(s=>row.artist&&s.artist&&canon(s.artist)===canon(row.artist));
 if(withArtists.length===1)return withArtists;
 if(row.artist&&same.some(s=>s.artist))return withArtists;
 return same;
}
function prepare(source,site,existing) {
 const src=entries(source),catalog=entries(site).map(normalizeCatalog).filter(x=>x.title),
   already=entries(existing).map(x=>({title:canon(x.title),language:canon(x.language),version:canon(x.version||'Основная'),text:str(x.text),sunoid:str(x.sunoId)}));
 const rows=src.map((r,i)=>{
  const item=normalizeSource(r,i);if(item.status!=='ready')return item;
  const found=candidates(item,catalog);
  if(found.length>1)return {...item,status:'review',reason:'Несколько песен с таким названием в каталоге'};
  if(found.length===0)return {...item,status:'review',reason:'Песня не найдена в каталоге'};
  const song=found[0];
  if(already.some(x=>x.sunoid&&item.sourceId&&x.sunoid===item.sourceId))return {...item,status:'skip',reason:'Suno ID уже импортирован'};
  if(already.some(x=>x.title===canon(song.title)&&x.language===canon(item.language)&&x.version===canon(item.version)))return {...item,status:'skip',reason:'Версия уже есть'};
  return {...item,title:song.title,artist:song.artist||item.artist,
   upc:song.upc,catalogRow:song.catalogRow,matchedCatalogId:song.id,status:'matched',reason:'Совпадение по названию'+(item.artist&&song.artist?' и артисту':'')};
 });
 // Duplicate Suno records/IDs inside the new batch: keep first occurrence only.
 const seen=new Set();
 rows.forEach((x)=>{
  if(x.status!=='matched')return;
  const key=x.sourceId?'id:'+x.sourceId:'v:'+canon(x.title)+'|'+canon(x.language)+'|'+canon(x.version);
  if(seen.has(key)){x.status='skip';x.reason='Повтор в загруженном файле';}
  else seen.add(key);
 });
 const counts={total:rows.length,matched:rows.filter(x=>x.status==='matched').length,
  review:rows.filter(x=>x.status==='review').length,skip:rows.filter(x=>x.status==='skip').length,
  invalid:rows.filter(x=>x.status==='invalid').length};
 return {format:'vmm-suno-lyrics-review-v1',createdAt:new Date().toISOString(),
  warning:'Только проект сверки. Нельзя загружать напрямую в studio/import.js или Firestore без проверки администратором.',
  counts:counts,rows:rows};
}
const api={entries,normalizeSource,prepare,canon};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
global.VELAR_SUNO_LYRICS_PREPARE=api;
})(typeof window!=='undefined'?window:globalThis);
