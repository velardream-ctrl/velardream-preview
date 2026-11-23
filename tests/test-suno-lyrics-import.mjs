// RUN-220 — browser-only Suno lyric preparation, no credentials or database writes.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
const req=createRequire(import.meta.url);
const tool=req('../suno-lyrics-import/prepare.js');
const html=fs.readFileSync('suno-lyrics-import/index.html','utf8');
const code=fs.readFileSync('suno-lyrics-import/prepare.js','utf8');
assert.match(html,/id="suno-file"/);
assert.match(html,/id="catalog-file"/);
assert.match(html,/id="existing-file"/);
assert.match(html,/id="download"/);
assert.doesNotMatch(code, /\bfetch\s*\(|XMLHttpRequest\s*\(|FormData\s*\(/);
const songs={songs:[
 {id:'S-1',title:'Joulun valo',display_name:'Velar',metadata:{prompt:'[Verse 1]\nSnow\n[Chorus]\nLight'}},
 {id:'S-2',title:'Joulun valo',display_name:'Velar',lyrics:'A second version'},
 {id:'S-1',title:'Joulun valo',display_name:'Velar',lyrics:'Duplicate'},
 {id:'S-3',title:'Another Song',lyrics:'My song words'},
 {id:'S-4',title:'Empty',lyrics:''}
]};
const catalog=[{title:'Joulun valo',artist:'Velar',sourceRow:53,upc:'123',id:'catalog1'}];
let result=tool.prepare(songs,catalog,[]);
assert.deepEqual(result.counts,{total:5,matched:2,review:1,skip:1,invalid:1});
assert.equal(result.rows[0].catalogRow,'53');
assert.equal(result.rows[0].text,'[Verse 1]\nSnow\n[Chorus]\nLight');
assert.notEqual(result.rows[0].version,result.rows[1].version);
assert.equal(result.rows[2].status,'skip');
assert.equal(result.rows[3].status,'review');
assert.equal(result.rows[4].status,'invalid');
// With an existing lyric, same title + version + language must not overwrite.
result=tool.prepare(songs,catalog,[{title:'Joulun valo',language:'Не указан',version:'Suno · S-1',text:'User edits'}]);
assert.equal(result.rows[0].status,'skip');
assert.equal(result.rows[1].status,'matched');
// Multiple exact titles must require manual resolution.
result=tool.prepare({songs:[{id:'X',title:'Same',lyrics:'Text'}]},
 [{title:'Same',id:'one'},{title:'Same',id:'two'}],[]);
assert.equal(result.rows[0].status,'review');
assert.equal(result.rows[0].reason,'Несколько песен с таким названием в каталоге');
assert.equal(tool.prepare({songs:[{id:'E',title:'Joulun valo',metadata:{prompt:'Line one'}}]},catalog,[]).counts.matched,1);
console.log('RUN-220 — test of Suno lyric preparation and duplicate protection: PASS');
