// RUN-217 — singer studio smoke/regression tests (node tests/test-singer-studio.mjs).
// No browser or server needed. Source tone tests verify independently adjusted
// pitch and duration in the vendored SoundTouchJS library.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const page=fs.readFileSync('singer-studio/index.html','utf8');
const js=fs.readFileSync('singer-studio/studio.js','utf8');
const lib=fs.readFileSync('singer-studio/vendor/soundtouch.js','utf8');
const preview=fs.readFileSync('index.html','utf8');
const mandatoryIds=[
  'source-file','pitch','tempo','pitch-label','tempo-label','render','reset',
  'cancel','listen-source','listen-result','player','format','save',
  'download','artist-name','save-profile','artist-greeting','project-name','save-preset','presets'
];
mandatoryIds.forEach(id=>assert.ok(page.includes('id="'+id+'"'),id));
assert.match(page,/<h1>Мастерская артиста<\/h1>/);
assert.match(preview,/href="singer-studio\/"/);
assert.match(page,/type="module" src="studio.js\?v=218"/);
for(const value of ['mp3192','mp3320','wav16','wav24','flac16','flac24'])
  assert.ok(page.includes('<option value="'+value+'"'),value);
assert.match(js,/option==='wav24'/);
assert.match(js,/option==='flac24'/);
assert.match(js,/option==='mp3192'/);
assert.match(page,/AI-сепарация/);
assert.match(page,/id="stem-edit"/);
assert.match(js,/import \{ SoundTouch, SimpleFilter \}/);
assert.match(js,/function renderAudio\(/);
assert.match(js,/function wavBlob\(/);
assert.match(js,/async function mp3Blob\(/);
assert.match(js,/async function flacBlob\(/);
assert.match(js,/localStorage\.setItem\(PRESET_KEY/);
assert.match(js,/localStorage\.setItem\(PROFILE_KEY/);
assert.doesNotMatch(js,/\bfetch\s*\(|\bXMLHttpRequest\s*\(|\bFormData\s*\(/);
new Function(js.replace("import { SoundTouch, SimpleFilter } from './vendor/soundtouch.js';",''));

const cleaned=lib.replace(/export \{[\s\S]*?\};\s*\/\/# sourceMappingURL[\s\S]*$/, '');
const {SoundTouch,SimpleFilter}=new Function(cleaned+';return {SoundTouch,SimpleFilter};')();
const rate=44100,frames=rate*2;
const data=new Float32Array(frames);
for(let i=0;i<frames;i++)data[i]=0.1*Math.sin(2*Math.PI*440*i/rate);
function process(shift,speed){
  const source={extract(out,n,pos){
    const count=Math.min(n,Math.max(0,frames+65536-pos));
    const real=Math.min(count,Math.max(0,frames-pos));
    for(let i=0;i<real;i++){out[2*i]=data[pos+i];out[2*i+1]=data[pos+i];}
    for(let i=real;i<count;i++){out[2*i]=0;out[2*i+1]=0;}
    return count;
  }};
  const sound=new SoundTouch();
  sound.stretch.setParameters(rate,0,0,8);
  sound.tempo=speed;
  sound.pitchSemitones=shift;
  const filter=new SimpleFilter(source,sound);
  const target=Math.round(frames/speed),block=new Float32Array(8192);
  const output=new Float32Array(target);
  let at=0;
  while(at<target){
    const count=filter.extract(block,Math.min(4096,target-at));
    assert.ok(count>0,'Filter stalled before completing track');
    for(let i=0;i<count;i++)output[at+i]=block[2*i];
    at+=count;
  }
  let crossings=0;
  const start=3000,end=Math.min(30000,output.length);
  for(let i=start+1;i<end;i++)if(output[i-1]<=0&&output[i]>0)crossings++;
  return {length:output.length,hz:crossings/(end-start)*rate};
}
for(const {shift,speed} of [
  {shift:0,speed:1},
  {shift:-2,speed:1},
  {shift:3,speed:0.8},
  {shift:0,speed:1.2}
]){
  const out=process(shift,speed);
  assert.equal(out.length,Math.round(frames/speed));
  const expected=440*Math.pow(2,shift/12);
  assert.ok(Math.abs(out.hz-expected)<8,'Pitch differs from expected: '+out.hz+' / '+expected);
}
assert.ok(fs.statSync('singer-studio/vendor/LICENSE-SOUNDTOUCH.txt').size>20000);
console.log('RUN-217: singer studio pitch/tempo, interface, privacy and attribution checks — PASS');
