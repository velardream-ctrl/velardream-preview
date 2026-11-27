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
assert.match(page,/audio-converter\.js\?v=216/);
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
assert.match(code,/publishResult\(file,file\.name/);
console.log('RUN-215: static multi-format converter checks passed');
