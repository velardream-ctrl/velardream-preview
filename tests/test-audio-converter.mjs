// RUN-215: static smoke test. Run with node tests/test-audio-converter.mjs.
// Browser integration, large files, old iPad and real FLAC decode must be checked manually.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const page=fs.readFileSync('mp3-converter/index.html','utf8');
const code=fs.readFileSync('mp3-converter/audio-converter.js','utf8');
const home=fs.readFileSync('index.html','utf8');
const legacy=fs.readFileSync('mp3-converter.html','utf8');
new Function('window','document','URL','Blob','FileReader','setTimeout','clearTimeout',code);
for(const name of ['mp3','wav','flac'])assert.match(page,new RegExp('<option value="'+name+'"'));
for(const id of ['mp3-options','wav-options','flac-options','target-rate','quality-hint','flac-compression','download'])
 assert.ok(page.includes('id="'+id+'"'),id);
for(const a of ['name="bitrate" value="128"','name="bitrate" value="192"','name="bitrate" value="320"','name="wav-bits" value="16"','name="wav-bits" value="24"','name="flac-bits" value="16"','name="flac-bits" value="24"'])
 assert.ok(page.includes(a),a);
assert.match(code,/function makeWav\(/);
assert.match(code,/async function makeMp3\(/);
assert.match(code,/async function makeFlac\(/);
assert.match(code,/FLAC__stream_encoder_process_interleaved/);
assert.match(code,/function readWav\(/);
assert.match(code,/function decodeInput\(/);
assert.match(code,/function resample\(/);
assert.match(code,/function loadFlacEncoder\(/);
assert.match(code,/function decodeFlac\(/);
assert.match(page,/audio-converter\.js\?v=218/);
assert.match(home,/href="mp3-converter\/"/);
assert.match(legacy,/location\.replace\('mp3-converter\/'\)/);
assert.ok(fs.statSync('mp3-converter/vendor/libflac-encoder.js').size>1_000_000);
assert.ok(fs.statSync('mp3-converter/vendor/flac-decoder.min.js').size>50_000);
assert.match(page,/Аудиоконвертер/);
assert.doesNotMatch(code,/\bfetch\s*\(|\bXMLHttpRequest\s*\(|\bFormData\s*\(/);
for(const id of ['pitch','tempo','pitch-label','tempo-label','reset-transform','original-player','result-player'])assert.ok(page.includes('id="'+id+'"'),id);
assert.match(code,/async function transformAudio/);
assert.match(code,/processor\.tempo=t/);
assert.match(code,/processor\.pitchSemitones=p/);
assert.match(code,/blob:file,name:file\.name/);
console.log('RUN-215: static multi-format converter checks passed');

assert.match(page,/<input id="file" type="file" multiple accept="[^"]*\.mp3[^"]*"/);
assert.match(page,/<input id="file-any" type="file" multiple aria-label="[^"]+">/);
assert.match(code,/anyInput\.addEventListener\('change'/);
assert.match(code,/control\.value=''/);
// Exercise the actual selection and MP3 -> WAV pipeline with a mocked Web Audio decoder.
const nodes={};
function node(){return {value:'',hidden:false,disabled:false,files:[],children:[],appendChild(n){this.children.push(n);},events:{},classList:{add(){},remove(){}},pause(){},load(){},removeAttribute(){},addEventListener(k,fn){this.events[k]=fn;}};}
const get=k=>nodes[k]||(nodes[k]=node());
get('pitch').value='0';get('tempo').value='100';get('target-format').value='wav';get('target-rate').value='original';
const samples=new Float32Array([0,0.5,-0.5,0]);
const decoded={sampleRate:44100,numberOfChannels:1,length:samples.length,duration:samples.length/44100,getChannelData(){return samples;}};
let decodeCalls=0,lastBlob;
const win={addEventListener(){},AudioContext:class{decodeAudioData(bytes,resolve){decodeCalls++;assert.equal(new Uint8Array(bytes)[0],0xff);resolve(decoded);}close(){return Promise.resolve();}}};
const doc={getElementById:get,createElement:node,querySelectorAll(){return [];},querySelector(){return {value:'16'};}};
const urls={createObjectURL(blob){lastBlob=blob;return 'blob:test';},revokeObjectURL(){}};
new Function('window','document','URL','Blob','FileReader','setTimeout','clearTimeout',code)(win,doc,urls,Blob,undefined,setTimeout,clearTimeout);
const mp3=new Blob([new Uint8Array([0xff,0xfb,0x90,0x64])],{type:'application/octet-stream'});
Object.defineProperty(mp3,'name',{value:'test.mp3'});
get('file-any').files=[mp3];get('file-any').events.change();
assert.equal(get('convert').disabled,false);assert.match(get('fileinfo').textContent,/test\.mp3/);
await get('convert').events.click();
assert.equal(decodeCalls,1);assert.equal(lastBlob.type,'audio/wav');assert.equal(get('download').download,'test.wav');
const wav=new Uint8Array(await lastBlob.arrayBuffer());
assert.equal(String.fromCharCode(...wav.slice(0,4)),'RIFF');assert.equal(String.fromCharCode(...wav.slice(8,12)),'WAVE');
assert.equal(new DataView(wav.buffer).getUint32(24,true),44100);assert.equal(new DataView(wav.buffer).getUint32(40,true),8);
console.log('PASS: unrestricted picker, MP3 selection, mocked decode and valid WAV PCM output');

const second=new Blob([new Uint8Array([0xff,0xfb,0x90,0x64])]);Object.defineProperty(second,'name',{value:'test.mp3'});
const bad=new Blob([]);Object.defineProperty(bad,'name',{value:'empty.mp3'});
get('file').files=[mp3,bad,second];get('file').events.change();
assert.match(get('fileinfo').textContent,/Выбрано: 3/);
await get('convert').events.click();
assert.equal(decodeCalls,3);
assert.match(get('batch-summary').textContent,/Готово: 2 из 3 · ошибок: 1/);
const rows=get('batch-output').children;
assert.equal(rows.length,3);
assert.equal(rows[0].children[2].download,'test.wav');
assert.match(rows[1].children[1].textContent,/Ошибка/);
assert.equal(rows[2].children[2].download,'test (2).wav');
assert.equal(get('batch-progress').value,100);
console.log('PASS: batch selection, sequential WAV conversion, per-file error isolation and unique names');
