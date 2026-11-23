/* RUN-217: local-first artist rehearsal workspace. No audio upload, Firebase or analytics.
   SoundTouchJS v0.3.0 LGPL-2.1 (vendor/soundtouch.js).
   Browser processing: normalize to 44.1 kHz, independent pitch & tempo via SoundTouch.
*/
import { SoundTouch, SimpleFilter } from './vendor/soundtouch.js';

const $ = id => document.getElementById(id);
const fileInput=$('source-file'),drop=$('drop'),pitch=$('pitch'),tempo=$('tempo'),
      status=$('status'),progress=$('progress'),renderBtn=$('render'),cancelBtn=$('cancel'),
      resetBtn=$('reset'),player=$('player'),download=$('download'),saveBtn=$('save');
const SAMPLE_RATE=44100, LIMIT_MB=80, LIMIT_SECONDS=12*60, PRESET_KEY='velardream-singer-presets-v1';
const state={file:null,audio:null,rendered:null,sourceUrl:null,renderUrl:null,previewUrl:null,exportUrl:null,
  working:false,aborted:false,renderPitch:null,renderTempo:null,presets:[], ctx:null};
const loadedScripts={};
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
function tell(message){status.textContent=message;}
function view(){return {pitch:Number(pitch.value),tempo:Number(tempo.value)/100};}
function hint(){
  const {pitch:p,tempo:t}=view();
  $('pitch-label').textContent=(p>0?'+':'')+p+' '+(Math.abs(p)===1?'полутон':(Math.abs(p)>=2&&Math.abs(p)<=4?'полутона':'полутонов'));
  $('tempo-label').textContent=Math.round(t*100)+'%';
}
function revokeUrl(key){if(state[key]){URL.revokeObjectURL(state[key]);state[key]=null;}}
function resetOutput(){
  revokeUrl('renderUrl');revokeUrl('previewUrl');revokeUrl('exportUrl');
  state.rendered=null;state.renderPitch=null;state.renderTempo=null;download.hidden=true;download.removeAttribute('href');
  saveBtn.disabled=true;$('listen-result').disabled=true;
}
function stopAudio(){player.pause();player.removeAttribute('src');player.load();}
function uiBusy(b){
  state.working=b;
  renderBtn.disabled=b||!state.audio;cancelBtn.disabled=!b;
  fileInput.disabled=b;saveBtn.disabled=b||!state.rendered;
  $('format').disabled=b;
}
function mobileLimit(){
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent||'')?
   {bytes:45*1048576,seconds:8*60}:{bytes:LIMIT_MB*1048576,seconds:LIMIT_SECONDS};
}
function loadScript(src,predicate){
  if(predicate())return Promise.resolve();
  if(loadedScripts[src])return loadedScripts[src];
  loadedScripts[src]=new Promise((resolve,reject)=>{
    const tag=document.createElement('script');tag.src=src;tag.charset='UTF-8';
    tag.onload=()=>predicate()?resolve():reject(new Error('Библиотека загружена, но не запустилась.'));
    tag.onerror=()=>reject(new Error('Не удалось загрузить аудиобиблиотеку.'));
    document.head.appendChild(tag);
  }).catch(error=>{delete loadedScripts[src];throw error;});
  return loadedScripts[src];
}
async function flacDecode(bytes){
  await loadScript('../mp3-converter/vendor/flac-decoder.min.js',
    ()=>Boolean(window['flac-decoder']&&window['flac-decoder'].FLACDecoder));
  const decoder=new window['flac-decoder'].FLACDecoder();
  try{
    await decoder.ready;
    if(state.aborted)throw new Error('Отменено.');
    const result=await decoder.decodeFile(new Uint8Array(bytes));
    if(!result||!result.samplesDecoded||!result.channelData?.length||result.errors?.length)
      throw new Error('FLAC содержит ошибки или пустую звуковую дорожку.');
    const channels=result.channelData;
    if(channels.length>2)throw new Error('Пока поддерживается только моно и стерео.');
    return {sampleRate:result.sampleRate,length:result.samplesDecoded,numberOfChannels:channels.length,
      getChannelData:i=>channels[i]};
  }finally{decoder.free();}
}
function nativeDecode(ctx,bytes){
  return new Promise((resolve,reject)=>{
    try{ctx.decodeAudioData(bytes.slice(0),resolve,reject);}catch(error){reject(error);}
  });
}
function normalizeAudio(channels,rate){
  const n=channels[0].length;
  return {sampleRate:rate,length:n,duration:n/rate,numberOfChannels:channels.length,
    getChannelData:i=>channels[i]};
}
async function downsample(audio){
  if(audio.sampleRate===SAMPLE_RATE)return audio;
  tell('Приводим запись к частоте 44,1 кГц для обработки…');
  const frames=Math.max(1,Math.round(audio.length*SAMPLE_RATE/audio.sampleRate));
  const Offline=window.OfflineAudioContext||window.webkitOfflineAudioContext;
  if(Offline){
    try{
      const offline=new Offline(audio.numberOfChannels,frames,SAMPLE_RATE);
      const buffer=offline.createBuffer(audio.numberOfChannels,audio.length,audio.sampleRate);
      for(let c=0;c<audio.numberOfChannels;c++)buffer.getChannelData(c).set(audio.getChannelData(c));
      const source=offline.createBufferSource();source.buffer=buffer;source.connect(offline.destination);source.start(0);
      return await offline.startRendering();
    }catch(error){if(state.aborted)throw new Error('Отменено.');}
  }
  // Slow low-pass windowed sinc fallback, to support browsers with broken OfflineAudioContext.
  const out=Array.from({length:audio.numberOfChannels},()=>new Float32Array(frames));
  const ratio=audio.sampleRate/SAMPLE_RATE,cutoff=Math.min(1,SAMPLE_RATE/audio.sampleRate),radius=14;
  for(let i=0;i<frames;i++){
    if(state.aborted)throw new Error('Отменено.');
    const center=i*ratio,base=Math.floor(center);
    for(let ch=0;ch<out.length;ch++){
      const source=audio.getChannelData(ch);let sum=0,weight=0;
      for(let k=base-radius+1;k<=base+radius;k++){
        if(k<0||k>=source.length||Math.abs(center-k)>=radius)continue;
        const distance=center-k,z=Math.PI*distance*cutoff;
        const sinc=z===0?1:Math.sin(z)/z;
        const windowWeight=0.5+0.5*Math.cos(Math.PI*distance/radius),w=sinc*windowWeight;
        sum+=source[k]*w;weight+=w;
      }
      out[ch][i]=weight?sum/weight:0;
    }
    if(i%16384===0)await tick();
  }
  return normalizeAudio(out,SAMPLE_RATE);
}
async function selectFile(file){
  if(state.working)return;
  stopAudio();
  ['sourceUrl','renderUrl','previewUrl','exportUrl'].forEach(revokeUrl);
  resetOutput();state.file=null;state.audio=null;$('listen-source').disabled=true;
  fileInput.value=fileInput.files&&fileInput.files[0]===file?fileInput.value:'';
  if(!file){$('fileinfo').textContent='Файл пока не выбран.';tell('Выберите запись, чтобы начать.');return;}
  $('fileinfo').textContent=file.name+' · '+(file.size/1048576).toFixed(1)+' МБ';
  const limit=mobileLimit();
  if(!file.size||file.size>limit.bytes){tell('Файл слишком большой для обработки на этом устройстве (лимит '+Math.round(limit.bytes/1048576)+' МБ).');return;}
  state.file=file;uiBusy(true);progress.hidden=false;progress.value=5;
  let ctx=null;
  try{
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC)throw new Error('Браузер не поддерживает Web Audio.');
    ctx=new AC();tell('Декодируем аудиозапись…');
    const bytes=typeof file.arrayBuffer==='function'?await file.arrayBuffer():
      await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Не удалось прочитать файл.'));reader.readAsArrayBuffer(file);});
    if(state.aborted)throw new Error('Отменено.');
    let audio;
    if(/\.flac$/i.test(file.name))audio=await flacDecode(bytes);
    else{
      try{audio=await nativeDecode(ctx,bytes);}
      catch(error){if(/\.flac$/i.test(file.name))audio=await flacDecode(bytes);
        else throw new Error('Этот формат не удалось прочитать. Попробуйте WAV, FLAC или MP3.');}
    }
    if(!audio||!audio.length||audio.numberOfChannels<1||audio.numberOfChannels>2)throw new Error('Поддерживается только моно и стерео.');
    if(audio.length/audio.sampleRate>limit.seconds)throw new Error('Длительность больше '+(limit.seconds/60)+' минут. Разделите запись на части.');
    if(audio.sampleRate<8000||audio.sampleRate>384000)throw new Error('Неподдерживаемая частота аудио.');
    progress.value=20;
    const prepared=await downsample(audio);
    if(state.aborted)throw new Error('Отменено.');
    state.audio=prepared;state.sourceUrl=URL.createObjectURL(file);$('listen-source').disabled=false;
    tell('Запись загружена. Выберите тональность и темп, затем примените изменения.');
  }catch(error){
    state.audio=null;state.file=null;
    tell('Ошибка: '+(error?.message||'не удалось загрузить запись.'));
  }finally{
    if(ctx&&typeof ctx.close==='function')try{await ctx.close();}catch(error){}
    progress.hidden=true;uiBusy(false);
  }
}
function renderAudio(audio,pitchSemitones,tempoFactor,report){
  if(!audio)throw new Error('Сначала загрузите запись.');
  const length=audio.length,expected=Math.max(1,Math.round(length/tempoFactor)),extended=length+65536;
  const left=audio.getChannelData(0),right=audio.numberOfChannels>1?audio.getChannelData(1):left;
  const source={
    extract(target,numFrames,position){
      const count=Math.max(0,Math.min(numFrames,extended-position));
      const real=Math.min(count,Math.max(0,length-position));
      for(let i=0;i<real;i++){target[i*2]=left[position+i];target[i*2+1]=right[position+i];}
      for(let i=real;i<count;i++){target[i*2]=0;target[i*2+1]=0;}
      return count;
    }
  };
  const processor=new SoundTouch();
  processor.stretch.setParameters(SAMPLE_RATE,0,0,8);
  processor.tempo=tempoFactor;
  processor.pitchSemitones=pitchSemitones;
  const filter=new SimpleFilter(source,processor),output=[new Float32Array(expected),new Float32Array(expected)];
  const block=new Float32Array(4096*2);
  return (async()=>{
    let at=0,zeroCount=0;
    while(at<expected){
      if(state.aborted)throw new Error('Отменено.');
      const request=Math.min(4096,expected-at),count=filter.extract(block,request);
      if(count===0){zeroCount++;if(zeroCount>=2)break;await tick();continue;}
      for(let i=0;i<count;i++){output[0][at+i]=block[i*2]||0;output[1][at+i]=block[i*2+1]||0;}
      at+=count;
      if(at%32768<4096){report(at/expected);await tick();}
    }
    if(at<expected*0.95)throw new Error('Не удалось полностью обработать фонограмму.');
    report(1);
    return normalizeAudio(output,SAMPLE_RATE);
  })();
}
function pcmInt(v,bits){
  const limit=bits===24?8388608:32768;
  return Math.max(-limit,Math.min(limit-1,Math.round(Math.max(-1,Math.min(1,Number(v)||0))*limit)));
}
function wavBlob(audio,bits){
  const count=audio.length,channels=audio.numberOfChannels,step=bits/8,size=count*channels*step;
  if(size>256*1048576)throw new Error('WAV превысит 256 МБ. Выберите MP3 или FLAC.');
  const b=new ArrayBuffer(44+size),d=new DataView(b);
  function tag(offset,text){for(let i=0;i<4;i++)d.setUint8(offset+i,text.charCodeAt(i));}
  tag(0,'RIFF');d.setUint32(4,36+size,true);tag(8,'WAVE');tag(12,'fmt ');d.setUint32(16,16,true);
  d.setUint16(20,1,true);d.setUint16(22,channels,true);d.setUint32(24,audio.sampleRate,true);
  d.setUint32(28,audio.sampleRate*channels*step,true);d.setUint16(32,channels*step,true);d.setUint16(34,bits,true);
  tag(36,'data');d.setUint32(40,size,true);
  const planes=Array.from({length:channels},(_,i)=>audio.getChannelData(i));
  let offset=44;
  for(let i=0;i<count;i++)for(let ch=0;ch<channels;ch++){
    const sample=pcmInt(planes[ch][i],bits);
    if(bits===16){d.setInt16(offset,sample,true);offset+=2;}
    else{d.setUint8(offset,sample&255);d.setUint8(offset+1,(sample>>8)&255);d.setUint8(offset+2,(sample>>16)&255);offset+=3;}
  }
  return new Blob([b],{type:'audio/wav'});
}
async function mp3Blob(audio,bitrate){
  await loadScript('https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js',
    ()=>Boolean(window.lamejs?.Mp3Encoder));
  const channels=audio.numberOfChannels,enc=new window.lamejs.Mp3Encoder(channels,audio.sampleRate,bitrate);
  const data=Array.from({length:channels},(_,i)=>audio.getChannelData(i));
  const left=new Int16Array(1152),right=new Int16Array(1152),parts=[];
  for(let at=0;at<audio.length;at+=1152){
    if(state.aborted)throw new Error('Отменено.');
    const count=Math.min(1152,audio.length-at);
    for(let i=0;i<count;i++){left[i]=pcmInt(data[0][at+i],16);right[i]=pcmInt(data[Math.min(1,channels-1)][at+i],16);}
    const chunk=channels===2?enc.encodeBuffer(left.subarray(0,count),right.subarray(0,count)):enc.encodeBuffer(left.subarray(0,count));
    if(chunk.length)parts.push(new Uint8Array(chunk));
    if((at/1152)%64===0){progress.value=30+Math.floor(68*at/audio.length);await tick();}
  }
  const tail=enc.flush();if(tail.length)parts.push(new Uint8Array(tail));
  return new Blob(parts,{type:'audio/mpeg'});
}
async function flacBlob(audio,bits){
  await loadScript('../mp3-converter/vendor/libflac-encoder.js',
    ()=>Boolean(window.Flac?.create_libflac_encoder));
  const F=window.Flac;
  if(!F.isReady())await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('FLAC-кодировщик не запустился.')),15000);
    F.on('ready',()=>{clearTimeout(timer);resolve();});
  });
  const id=F.create_libflac_encoder(audio.sampleRate,audio.numberOfChannels,bits,5,0,false,0);
  if(!id)throw new Error('Не удалось создать FLAC-кодировщик.');
  const chunks=[];let finished=false;
  try{
    const status=F.init_encoder_stream(id,data=>chunks.push(new Uint8Array(data)));
    if(status!==0)throw new Error('Ошибка инициализации FLAC: '+status);
    const chunkLength=4096,block=new Int32Array(chunkLength*audio.numberOfChannels);
    const data=Array.from({length:audio.numberOfChannels},(_,i)=>audio.getChannelData(i));
    for(let at=0;at<audio.length;at+=chunkLength){
      if(state.aborted)throw new Error('Отменено.');
      const n=Math.min(chunkLength,audio.length-at);
      for(let i=0;i<n;i++)for(let ch=0;ch<data.length;ch++)block[i*data.length+ch]=pcmInt(data[ch][at+i],bits);
      if(!F.FLAC__stream_encoder_process_interleaved(id,block.subarray(0,n*data.length),n))
        throw new Error('Не удалось кодировать FLAC.');
      if((at/chunkLength)%8===0){progress.value=30+Math.floor(68*at/audio.length);await tick();}
    }
    finished=Boolean(F.FLAC__stream_encoder_finish(id));
    if(!finished)throw new Error('Ошибка завершения FLAC.');
    return new Blob(chunks,{type:'audio/flac'});
  }finally{
    if(!finished)try{F.FLAC__stream_encoder_finish(id);}catch(error){}
    F.FLAC__stream_encoder_delete(id);
  }
}
function changeSettings(){
  hint();
  if(state.rendered&&!state.working){
    const {pitch:p,tempo:t}=view();
    if(p!==state.renderPitch||t!==state.renderTempo){
      resetOutput();tell('Настройки изменены — примените их для нового прослушивания.');
    }
  }
}
pitch.addEventListener('input',changeSettings);tempo.addEventListener('input',changeSettings);
resetBtn.addEventListener('click',()=>{pitch.value=0;tempo.value=100;changeSettings();});
fileInput.addEventListener('change',()=>{state.aborted=false;selectFile(fileInput.files?.[0]);});
['dragenter','dragover'].forEach(event=>drop.addEventListener(event,e=>{e.preventDefault();if(!state.working)drop.classList.add('drag');}));
['dragleave','drop'].forEach(event=>drop.addEventListener(event,e=>{e.preventDefault();drop.classList.remove('drag');}));
drop.addEventListener('drop',e=>{if(state.working)return;const f=e.dataTransfer?.files?.[0];if(f){fileInput.value='';state.aborted=false;selectFile(f);}});
cancelBtn.addEventListener('click',()=>{state.aborted=true;tell('Отменяем обработку…');});
renderBtn.addEventListener('click',async()=>{
  if(!state.audio||state.working)return;
  state.aborted=false;stopAudio();resetOutput();uiBusy(true);
  progress.hidden=false;progress.value=0;
  try{
    const settings=view();
    tell('Обрабатываем фонограмму…');
    state.rendered=await renderAudio(state.audio,settings.pitch,settings.tempo,fraction=>{
      progress.value=Math.min(99,Math.round(fraction*100));
    });
    if(state.aborted)throw new Error('Отменено.');
    state.renderPitch=settings.pitch;state.renderTempo=settings.tempo;
    $('listen-result').disabled=false;saveBtn.disabled=false;progress.value=100;
    tell('Готово! Можно сравнить исходную и обработанную фонограммы или сохранить файл.');
  }catch(error){resetOutput();tell('Ошибка: '+(error?.message||'не удалось обработать запись.'));}
  finally{uiBusy(false);progress.hidden=true;}
});
function playURL(url){
  if(!url)return;
  player.pause();player.src=url;player.load();
  const result=player.play();
  if(result?.catch)result.catch(()=>tell('Автовоспроизведение заблокировано. Нажмите Play в аудиоплеере.'));
}
$('listen-source').addEventListener('click',()=>{
  if(!state.audio)return;
  if(/\.flac$/i.test(state.file?.name||'')){
    if(!state.previewUrl)state.previewUrl=URL.createObjectURL(wavBlob(state.audio,16));
    playURL(state.previewUrl);return;
  }
  playURL(state.sourceUrl);
});
$('listen-result').addEventListener('click',()=>{
  if(!state.rendered)return;
  if(!state.renderUrl)state.renderUrl=URL.createObjectURL(wavBlob(state.rendered,16));
  playURL(state.renderUrl);
});
saveBtn.addEventListener('click',async()=>{
  if(!state.rendered||state.working)return;
  state.aborted=false;revokeUrl('exportUrl');download.hidden=true;uiBusy(true);
  const option=$('format').value;
  progress.hidden=false;progress.value=5;
  try{
    let blob,extension,description;
    tell('Подготавливаем файл…');
    if(option==='wav'){blob=wavBlob(state.rendered,16);extension='wav';description='WAV 16 бит';}
    else if(option==='flac'){blob=await flacBlob(state.rendered,16);extension='flac';description='FLAC 16 бит';}
    else{blob=await mp3Blob(state.rendered,320);extension='mp3';description='MP3 320 кбит/с';}
    if(state.aborted)throw new Error('Отменено.');
    if(!blob.size)throw new Error('Результат пустой.');
    state.exportUrl=URL.createObjectURL(blob);
    download.href=state.exportUrl;
    const name=(state.file?.name||'song').replace(/\.[^.]+$/,'').replace(/[\\/:*?"<>|]/g,'_');
    const pitchCode=state.renderPitch>0?'plus'+state.renderPitch:'minus'+Math.abs(state.renderPitch);
    download.download=name+'_velar_'+pitchCode+'_tempo'+Math.round(state.renderTempo*100)+'.'+extension;
    download.textContent='Скачать '+description+' · '+(blob.size/1048576).toFixed(1)+' МБ';
    download.hidden=false;progress.value=100;
    tell(description+' готов. Нажмите «Скачать» для сохранения.');
  }catch(error){tell('Ошибка: '+(error?.message||'не удалось сохранить файл.'));}
  finally{uiBusy(false);progress.hidden=true;}
});
// Only project names and pitch/tempo settings are stored locally: never the audio or user identities.
function getPresets(){
  try{const data=JSON.parse(localStorage.getItem(PRESET_KEY)||'[]');
    return Array.isArray(data)?data.filter(x=>x&&typeof x.name==='string').slice(0,12):[];
  }catch(error){return [];}
}
function persistPresets(){
  try{localStorage.setItem(PRESET_KEY,JSON.stringify(state.presets));return true;}
  catch(error){tell('Браузер не разрешил сохранить настройки. Можно продолжать без кабинета.');return false;}
}
function drawPresets(){
  const host=$('presets');if(!host)return;
  host.textContent='';
  if(!state.presets.length){const note=document.createElement('p');note.className='hint';note.textContent='Здесь появятся сохранённые настройки репетиций. Аудиофайлы не сохраняются.';host.appendChild(note);return;}
  state.presets.forEach((entry,i)=>{
    const line=document.createElement('div');line.className='preset-row';
    const text=document.createElement('span');
    text.textContent=entry.name+' · '+(entry.pitch>0?'+':'')+entry.pitch+' полутонов · '+entry.tempo+'%';
    const open=document.createElement('button');open.type='button';open.className='secondary';open.textContent='Применить';
    open.addEventListener('click',()=>{pitch.value=String(entry.pitch);tempo.value=String(entry.tempo);$('project-name').value=entry.name;changeSettings();tell('Настройки проекта восстановлены. Выберите файл и примените изменения.');});
    const remove=document.createElement('button');remove.type='button';remove.className='secondary';remove.textContent='Удалить';
    remove.addEventListener('click',()=>{state.presets.splice(i,1);persistPresets();drawPresets();});
    line.appendChild(text);line.appendChild(open);line.appendChild(remove);host.appendChild(line);
  });
}
$('save-preset')?.addEventListener('click',()=>{
  const name=String($('project-name').value||'').trim().slice(0,70);
  if(!name){tell('Укажите название проекта.');return;}
  state.presets=state.presets.filter(x=>x.name!==name);
  state.presets.unshift({name,pitch:Number(pitch.value),tempo:Number(tempo.value)});
  state.presets=state.presets.slice(0,12);
  if(persistPresets()){drawPresets();tell('Настройки проекта сохранены только на этом устройстве.');}
});
window.addEventListener('pagehide',()=>{
  stopAudio();['sourceUrl','renderUrl','previewUrl','exportUrl'].forEach(revokeUrl);
});
state.presets=getPresets();drawPresets();hint();
