/* RUN-215 · Universal local audio converter for Velar Dream preview.
 * Input: WAV (direct PCM), FLAC (WASM), or formats supported by Web Audio.
 * Output: MP3 (lamejs), WAV PCM 16/24, FLAC 16/24 (libflacjs).
 * No audio bytes are uploaded. Do not include Firebase or analytics here.
 */
(function(root){
'use strict';
function $(id){return document.getElementById(id);}
var input=$('file'),drop=$('drop'),info=$('fileinfo'),status=$('status'),
 convert=$('convert'),cancel=$('cancel'),progress=$('progress'),download=$('download'),
 format=$('target-format'),quality=$('quality-hint'),rateSelect=$('target-rate');
var pitch=$('pitch'),tempo=$('tempo'),originalPlayer=$('original-player'),resultPlayer=$('result-player'),originalUrl=null;
var selected=null,busy=false,stopped=false,objectUrl=null,flacDecoderLoader=null,flacEncoderLoader=null;
function say(s){status.textContent=s;}
function tick(){return new Promise(function(ok){setTimeout(ok,0);});}
function mb(n){return (n/1048576).toFixed(1)+' МБ';}
function clearResult(){resultPlayer.pause();resultPlayer.removeAttribute('src');resultPlayer.load();$('result-wrap').hidden=true;if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl=null;}download.hidden=true;download.removeAttribute('href');}
function setBusy(v){busy=v;input.disabled=v;format.disabled=v;pitch.disabled=v;tempo.disabled=v;$('reset-transform').disabled=v;convert.disabled=v||!selected;cancel.disabled=!v;Array.from(document.querySelectorAll('#mp3-options input,#wav-options input,#flac-options input,#flac-options select,#rate-options select')).forEach(function(el){el.disabled=v;});}
function fmtName(x){return {mp3:'MP3',wav:'WAV',flac:'FLAC'}[x]||'аудио';}
function extName(name,ext){return (String(name||'').replace(/\.[^.]+$/,'').replace(/[\\/:*?"<>|]+/g,'_').trim()||'audio')+'.'+ext;}
function radioValue(name){var el=document.querySelector('input[name="'+name+'"]:checked');return el?Number(el.value):0;}
function sourceFormat(file){var m=/\.([^.]+)$/.exec(file&&file.name||'');return m?m[1].toLowerCase():'';}
function neutral(){return Number(pitch.value)===0&&Number(tempo.value)===100;}
function outputFormat(){return format.value==='same'?sourceFormat(selected):format.value;}
function updateChoices(){
 var same=format.value==='same',out=outputFormat(),copy=same&&neutral();
 $('mp3-options').hidden=copy||out!=='mp3';
 $('wav-options').hidden=copy||out!=='wav';
 $('flac-options').hidden=copy||out!=='flac';
 $('rate-options').hidden=copy||['wav','flac'].indexOf(out)<0;
 if(copy){quality.textContent='Оригинал будет скачан побайтово, без повторного кодирования.';return;}
 if(['mp3','wav','flac'].indexOf(out)<0){quality.textContent='Для обработки этого формата выберите MP3, WAV или FLAC.';return;}
 if(out==='mp3')quality.textContent='MP3: сжатие с потерями. 320 кбит/с — наивысшее доступное качество, но не эквивалент FLAC.';
 if(out==='wav')quality.textContent='WAV: звук без сжатия, PCM 16 или 24 бит. Файл обычно значительно больше MP3 или FLAC.';
 if(out==='flac')quality.textContent='FLAC: сжатие без потерь. Разрядность 16/24 бит и уровень сжатия влияют на размер/время, а не на качество при одинаковой разрядности.';
 if(selected&&sourceFormat(selected)===out)quality.textContent+=' Выходной формат совпадает с исходным — повторная конвертация обычно не нужна.';
 if(selected&&sourceFormat(selected)==='flac'&&out==='mp3'){
   var high=document.querySelector('input[name="bitrate"][value="320"]');if(high)high.checked=true;
 }
}
function choose(file){
 if(busy)return;
 clearResult();if(originalUrl)URL.revokeObjectURL(originalUrl);originalUrl=null;originalPlayer.pause();originalPlayer.removeAttribute('src');originalPlayer.load();$('original-wrap').hidden=true;selected=file||null;progress.hidden=true;progress.value=0;
 if(!selected){info.textContent='Файл пока не выбран.';say('Ожидание файла.');convert.disabled=true;return;}
 info.textContent=selected.name+' · '+mb(selected.size);
 if(!selected.size){selected=null;say('Пустой файл. Выберите другой.');}
 else if(selected.size>120*1048576){selected=null;say('Файл превышает предел 120 МБ для браузерной обработки.');}
 else say(selected.size>30*1048576?'Крупный файл: на старом телефоне или планшете может не хватить памяти.':'Файл выбран. Настройте выходной формат и нажмите «Конвертировать».');
 if(selected){originalUrl=URL.createObjectURL(selected);originalPlayer.src=originalUrl;$('original-wrap').hidden=false;}convert.disabled=!selected;updateChoices();
}
input.addEventListener('change',function(){choose(input.files&&input.files[0]);});
format.addEventListener('change',function(){clearResult();updateChoices();});
function changeTransform(){var p=Number(pitch.value);$('pitch-label').textContent=(p>0?'+':'')+p+' полутонов';$('tempo-label').textContent=tempo.value+'%';clearResult();updateChoices();}
pitch.addEventListener('input',changeTransform);tempo.addEventListener('input',changeTransform);$('reset-transform').addEventListener('click',function(){pitch.value=0;tempo.value=100;changeTransform();});
['dragenter','dragover'].forEach(function(n){drop.addEventListener(n,function(e){e.preventDefault();if(!busy)drop.classList.add('drag');});});
['dragleave','drop'].forEach(function(n){drop.addEventListener(n,function(e){e.preventDefault();drop.classList.remove('drag');});});
drop.addEventListener('drop',function(e){if(!busy&&e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0]){input.value='';choose(e.dataTransfer.files[0]);}});
cancel.addEventListener('click',function(){stopped=true;say('Отменяем обработку…');});
function readBytes(file){if(typeof file.arrayBuffer==='function')return file.arrayBuffer();return new Promise(function(ok,bad){var r=new FileReader();r.onload=function(){ok(r.result);};r.onerror=function(){bad(new Error('Ошибка чтения файла.'));};r.readAsArrayBuffer(file);});}
function pcm(channels,rate,sourceBits){return {sampleRate:rate,numberOfChannels:channels.length,length:channels[0].length,duration:channels[0].length/rate,sourceBits:sourceBits||null,getChannelData:function(i){return channels[i];}};}
function readWav(bytes){
 if(bytes.byteLength<44)return null;
 var d=new DataView(bytes), ascii=function(o,len){var s='';for(var i=0;i<len;i++)s+=String.fromCharCode(d.getUint8(o+i));return s;};
 if(ascii(0,4)!=='RIFF'||ascii(8,4)!=='WAVE')return null;
 var off=12,fmt=null,dataAt=-1,dataLen=0;
 while(off+8<=bytes.byteLength){
   var tag=ascii(off,4),size=d.getUint32(off+4,true),start=off+8;
   if(size>bytes.byteLength-start)throw new Error('WAV: повреждённый заголовок блока.');
   if(tag==='fmt '&&size>=16){
     var code=d.getUint16(start,true);
     if(code===65534&&size>=40)code=d.getUint16(start+24,true);
     fmt={code:code,channels:d.getUint16(start+2,true),rate:d.getUint32(start+4,true),align:d.getUint16(start+12,true),bits:d.getUint16(start+14,true)};
   }
   if(tag==='data'&&dataAt<0){dataAt=start;dataLen=size;}
   off=start+size+(size%2);
   if(fmt&&dataAt>=0)break;
 }
 if(!fmt||dataAt<0)throw new Error('WAV: не найдены аудиоданные.');
 if(fmt.channels<1||fmt.channels>2)throw new Error('Поддерживаются моно и стерео.');
 if(fmt.rate<8000||fmt.rate>384000)throw new Error('WAV: неподдерживаемая частота дискретизации.');
 var bytesPer=fmt.bits/8;
 if(fmt.bits%8||fmt.align!==fmt.channels*bytesPer||!((fmt.code===1&&[8,16,24,32].indexOf(fmt.bits)>=0)||(fmt.code===3&&fmt.bits===32)))throw new Error('Этот вариант PCM WAV пока не поддерживается.');
 var count=Math.floor(dataLen/fmt.align),channels=[];
 if(!count)throw new Error('WAV не содержит звуковых отсчётов.');
 for(var c=0;c<fmt.channels;c++)channels.push(new Float32Array(count));
 for(var f=0;f<count;f++)for(var ch=0;ch<fmt.channels;ch++){
   var at=dataAt+f*fmt.align+ch*bytesPer,v=0;
   if(fmt.code===3)v=d.getFloat32(at,true);
   else if(fmt.bits===8)v=(d.getUint8(at)-128)/128;
   else if(fmt.bits===16)v=d.getInt16(at,true)/32768;
   else if(fmt.bits===24){v=d.getUint8(at)|(d.getUint8(at+1)<<8)|(d.getUint8(at+2)<<16);if(v&0x800000)v-=0x1000000;v/=8388608;}
   else v=d.getInt32(at,true)/2147483648;
   channels[ch][f]=Number.isFinite(v)?Math.max(-1,Math.min(1,v)):0;
 }
 return pcm(channels,fmt.rate,fmt.bits);
}
function isFlac(file,bytes){if(/\.flac$/i.test(file.name||''))return true;var u=new Uint8Array(bytes,0,Math.min(4,bytes.byteLength));return u.length===4&&u[0]===102&&u[1]===76&&u[2]===97&&u[3]===67;}
function loadScript(src,test){
 return new Promise(function(ok,bad){var s=document.createElement('script');s.charset='UTF-8';s.src=src;s.onload=function(){if(test())ok();else bad(new Error('Не удалось инициализировать аудиокодировщик.'));};s.onerror=function(){bad(new Error('Не удалось загрузить библиотеку '+src));};document.head.appendChild(s);});
}
function flacDecoder(){
 if(root['flac-decoder']&&root['flac-decoder'].FLACDecoder)return Promise.resolve(root['flac-decoder'].FLACDecoder);
 if(!flacDecoderLoader)flacDecoderLoader=loadScript('vendor/flac-decoder.min.js',function(){return !!(root['flac-decoder']&&root['flac-decoder'].FLACDecoder);}).then(function(){return root['flac-decoder'].FLACDecoder;}).catch(function(e){flacDecoderLoader=null;throw e;});
 return flacDecoderLoader;
}
async function decodeFlac(bytes){
 say('Декодируем FLAC…');
 var Ctor=await flacDecoder(),decoder=new Ctor();
 try{
   await decoder.ready;if(stopped)throw new Error('Отменено.');
   var res=await decoder.decodeFile(new Uint8Array(bytes));
   if(!res||!res.channelData||!res.channelData.length||!res.samplesDecoded)throw new Error('FLAC: аудиоданные не обнаружены.');
   if(res.errors&&res.errors.length)throw new Error('FLAC содержит ошибки при чтении.');
   return pcm(res.channelData,res.sampleRate,res.bitDepth);
 }finally{if(typeof decoder.free==='function')decoder.free();}
}
function decodeNative(context,buffer){return new Promise(function(ok,bad){try{context.decodeAudioData(buffer,ok,bad);}catch(e){bad(e);}});}
async function decodeInput(file,bytes,ctx){
 if(isFlac(file,bytes))return decodeFlac(bytes);
 var wav=readWav(bytes);if(wav)return wav;
 say('Декодируем аудио…');
 try{return await decodeNative(ctx,bytes);}catch(e){throw new Error('Браузер не поддерживает этот исходный формат. Попробуйте WAV, FLAC или другой браузер.');}
}
async function resample(audio,target){
 if(target===audio.sampleRate)return audio;
 if(stopped)throw new Error('Отменено.');
 say('Изменяем частоту '+audio.sampleRate+' Гц → '+target+' Гц…');
 var count=Math.max(1,Math.round(audio.length*target/audio.sampleRate));
 try{
   var Ctor=root.OfflineAudioContext||root.webkitOfflineAudioContext;
   if(!Ctor)throw new Error('OfflineAudioContext недоступен.');
   var offline=new Ctor(audio.numberOfChannels,count,target),buf=offline.createBuffer(audio.numberOfChannels,audio.length,audio.sampleRate);
   for(var ch=0;ch<audio.numberOfChannels;ch++)buf.getChannelData(ch).set(audio.getChannelData(ch));
   var src=offline.createBufferSource();src.buffer=buf;src.connect(offline.destination);src.start(0);
   var rendered=await offline.startRendering();
   if(stopped)throw new Error('Отменено.');
   return rendered;
 }catch(e){
   if(stopped)throw new Error('Отменено.');
   say('Резервный режим изменения частоты…');
   // Windowed-sinc interpolation; lowpass cutoff for downsampling.
   var output=[],ratio=audio.sampleRate/target,cutoff=Math.min(1,target/audio.sampleRate),radius=14;
   for(var c=0;c<audio.numberOfChannels;c++)output.push(new Float32Array(count));
   for(var i=0;i<count;i++){
     if(stopped)throw new Error('Отменено.');
     var center=i*ratio,left=Math.floor(center)-radius+1,right=Math.floor(center)+radius;
     for(var k=0;k<audio.numberOfChannels;k++){
       var source=audio.getChannelData(k),acc=0,sum=0;
       for(var x=left;x<=right;x++){
         var distance=center-x;if(x<0||x>=source.length||Math.abs(distance)>=radius)continue;
         var s=distance*cutoff,w=(s===0?1:Math.sin(Math.PI*s)/(Math.PI*s))*(0.5+0.5*Math.cos(Math.PI*distance/radius));
         acc+=source[x]*w;sum+=w;
       }
       output[k][i]=sum?acc/sum:0;
     }
     if(i%16384===0){progress.value=15+Math.floor(10*i/count);await tick();}
   }
   return pcm(output,target);
 }
}
function sampleInt(v,bits){
 var factor=bits===24?8388608:32768;
 var min=-factor,max=factor-1,n=Math.round(Math.max(-1,Math.min(1,v||0))*factor);
 return Math.max(min,Math.min(max,n));
}
function makeWav(audio,bits){
 var channels=audio.numberOfChannels,step=bits/8,n=audio.length,byteSize=n*channels*step;
 if(byteSize>256*1048576)throw new Error('Получится WAV больше 256 МБ. Выберите FLAC/MP3 или сократите файл.');
 var out=new ArrayBuffer(44+byteSize),d=new DataView(out),ptr=44;
 function word(p,n){d.setUint16(p,n,true);}function dword(p,n){d.setUint32(p,n,true);}function tag(p,s){for(var j=0;j<4;j++)d.setUint8(p+j,s.charCodeAt(j));}
 tag(0,'RIFF');dword(4,36+byteSize);tag(8,'WAVE');tag(12,'fmt ');dword(16,16);word(20,1);word(22,channels);
 dword(24,audio.sampleRate);dword(28,audio.sampleRate*channels*step);word(32,channels*step);word(34,bits);tag(36,'data');dword(40,byteSize);
 var planes=[];for(var c=0;c<channels;c++)planes.push(audio.getChannelData(c));
 for(var i=0;i<n;i++)for(var k=0;k<channels;k++){
   var s=sampleInt(planes[k][i],bits);
   if(bits===16){d.setInt16(ptr,s,true);ptr+=2;}
   else{d.setUint8(ptr,s&255);d.setUint8(ptr+1,(s>>8)&255);d.setUint8(ptr+2,(s>>16)&255);ptr+=3;}
 }
 return new Blob([out],{type:'audio/wav'});
}
async function makeMp3(audio,bitrate){
 if(!root.lamejs||typeof root.lamejs.Mp3Encoder!=='function')throw new Error('MP3-кодировщик не загрузился. Проверьте интернет.');
 var rate=audio.sampleRate,channels=audio.numberOfChannels,enc=new root.lamejs.Mp3Encoder(channels,rate,bitrate);
 var l=new Int16Array(1152),r=channels===2?new Int16Array(1152):null,parts=[],left=audio.getChannelData(0),right=channels===2?audio.getChannelData(1):null;
 for(var at=0;at<audio.length;at+=1152){
   if(stopped)throw new Error('Отменено.');
   var n=Math.min(1152,audio.length-at);
   for(var i=0;i<n;i++){l[i]=sampleInt(left[at+i],16);if(r)r[i]=sampleInt(right[at+i],16);}
   var block=r?enc.encodeBuffer(l.subarray(0,n),r.subarray(0,n)):enc.encodeBuffer(l.subarray(0,n));
   if(block.length)parts.push(new Uint8Array(block));
   if((at/1152)%48===0){progress.value=30+Math.floor(65*at/audio.length);await tick();}
 }
 var tail=enc.flush();if(tail.length)parts.push(new Uint8Array(tail));
 return new Blob(parts,{type:'audio/mpeg'});
}
function loadFlacEncoder(){
 if(root.Flac&&typeof root.Flac.create_libflac_encoder==='function')return Promise.resolve(root.Flac);
 if(flacEncoderLoader)return flacEncoderLoader;
 flacEncoderLoader=loadScript('vendor/libflac-encoder.js',function(){return !!(root.Flac&&typeof root.Flac.create_libflac_encoder==='function');})
 .then(function(){
   return new Promise(function(ok,bad){
     if(root.Flac.isReady&&root.Flac.isReady())return ok(root.Flac);
     var timeout=setTimeout(function(){bad(new Error('Истекло время запуска FLAC-кодировщика.'));},15000);
     root.Flac.on('ready',function(){clearTimeout(timeout);ok(root.Flac);});
   });
 }).catch(function(e){flacEncoderLoader=null;throw e;});
 return flacEncoderLoader;
}
async function makeFlac(audio,bits,compression){
 var F=await loadFlacEncoder(),channels=audio.numberOfChannels,rate=audio.sampleRate;
 var id=F.create_libflac_encoder(rate,channels,bits,compression,0,false,0);
 if(!id)throw new Error('Не удалось создать FLAC-кодировщик с выбранной частотой.');
 var parts=[],ok=false;
 try{
   var result=F.init_encoder_stream(id,function(data){parts.push(new Uint8Array(data));});
   if(result!==0)throw new Error('Ошибка инициализации FLAC: '+result);
   var planes=[];for(var c=0;c<channels;c++)planes.push(audio.getChannelData(c));
   var size=4096,buf=new Int32Array(size*channels);
   for(var offset=0;offset<audio.length;offset+=size){
     if(stopped)throw new Error('Отменено.');
     var frames=Math.min(size,audio.length-offset);
     for(var i=0;i<frames;i++)for(var ch=0;ch<channels;ch++)buf[i*channels+ch]=sampleInt(planes[ch][offset+i],bits);
     if(!F.FLAC__stream_encoder_process_interleaved(id,buf.subarray(0,frames*channels),frames))
       throw new Error('Ошибка при записи FLAC.');
     if((offset/size)%8===0){progress.value=30+Math.floor(65*offset/audio.length);await tick();}
   }
   ok=F.FLAC__stream_encoder_finish(id);
   if(!ok)throw new Error('Не удалось завершить FLAC.');
   return new Blob(parts,{type:'audio/flac'});
 }finally{
   if(!ok)try{F.FLAC__stream_encoder_finish(id);}catch(e){}
   F.FLAC__stream_encoder_delete(id);
 }
}
async function transformAudio(audio,p,t){
 if(!p&&t===1)return audio;
 say('Изменяем тональность и темп…');
 const {SoundTouch,SimpleFilter}=await import('../singer-studio/vendor/soundtouch.js');
 const rate=audio.sampleRate,length=audio.length,expected=Math.max(1,Math.round(length/t));
 if(expected*audio.numberOfChannels*4>180*1048576)throw new Error('Слишком большой результат для браузера. Попробуйте меньший файл или компьютер.');
 const left=audio.getChannelData(0),right=audio.numberOfChannels===2?audio.getChannelData(1):left,extended=length+Math.max(65536,Math.ceil(rate*2));
 const source={extract(target,n,position){const count=Math.max(0,Math.min(n,extended-position)),real=Math.min(count,Math.max(0,length-position));for(let i=0;i<count;i++){target[i*2]=i<real?left[position+i]:0;target[i*2+1]=i<real?right[position+i]:0;}return count;}};
 const processor=new SoundTouch();processor.stretch.setParameters(rate,0,0,8);processor.tempo=t;processor.pitchSemitones=p;
 const filter=new SimpleFilter(source,processor),planes=Array.from({length:audio.numberOfChannels},()=>new Float32Array(expected)),block=new Float32Array(8192);
 let at=0;while(at<expected){if(stopped)throw new Error('Отменено.');const n=filter.extract(block,Math.min(4096,expected-at));if(!n)break;for(let i=0;i<n;i++){planes[0][at+i]=block[i*2];if(planes.length===2)planes[1][at+i]=block[i*2+1];}at+=n;if(at%32768<4096){progress.value=10+Math.floor(17*at/expected);await tick();}}
 if(at<expected)throw new Error('Не удалось полностью обработать запись.');
 return pcm(planes,rate,audio.sourceBits);
}
function publishResult(blob,name,label){objectUrl=URL.createObjectURL(blob);download.href=objectUrl;download.download=name;download.textContent='Скачать '+label+' · '+mb(blob.size);download.hidden=false;resultPlayer.src=objectUrl;$('result-wrap').hidden=false;progress.hidden=false;progress.value=100;}
function rateChoice(audio,targetFormat){
 if(targetFormat==='mp3')return 44100;
 var v=rateSelect.value;if(v==='original')return audio.sampleRate;
 return Number(v)||audio.sampleRate;
}
convert.addEventListener('click',async function(){
 if(busy||!selected)return;
 var file=selected,out=outputFormat(),ctx=null,p=Number(pitch.value),t=Number(tempo.value)/100;
 if(format.value==='same'&&neutral()){clearResult();publishResult(file,file.name,'оригинал');say('Оригинал сохранён без изменений.');return;}
 if(['mp3','wav','flac'].indexOf(out)<0){say('Выберите MP3, WAV или FLAC для обработки.');return;}
 stopped=false;clearResult();setBusy(true);progress.hidden=false;progress.value=2;
 try{
   var AudioCtx=root.AudioContext||root.webkitAudioContext;
   if(!AudioCtx)throw new Error('В этом браузере недоступна обработка аудио.');
   ctx=new AudioCtx();
   say('Читаем '+file.name+'…');
   var bytes=await readBytes(file);
   if(stopped)throw new Error('Отменено.');
   progress.value=9;var audio=await decodeInput(file,bytes,ctx);bytes=null;
   if(stopped)throw new Error('Отменено.');
   if(audio.numberOfChannels<1||audio.numberOfChannels>2)throw new Error('Пока поддерживаются моно и стерео.');
   if(!audio.sampleRate||audio.sampleRate>384000||audio.sampleRate<8000)throw new Error('Неизвестная или слишком высокая частота.');
   if(audio.duration>45*60)throw new Error('Файл длиннее 45 минут — разделите на части.');
   var sourceBits=audio.sourceBits;
   audio=await transformAudio(audio,p,t);
   var target=rateChoice(audio,out);
   if(target!==audio.sampleRate)audio=await resample(audio,target);
   if(stopped)throw new Error('Отменено.');
   progress.value=28;say('Создаём '+fmtName(out)+'…');
   var blob,description;
   if(out==='wav'){
     var wavBits=format.value==='same'&&sourceBits>16?24:radioValue('wav-bits')||16;
     blob=makeWav(audio,wavBits);description=wavBits+' бит, '+audio.sampleRate+' Гц';
   }else if(out==='flac'){
     var flacBits=format.value==='same'&&sourceBits>16?24:radioValue('flac-bits')||16,level=Number($('flac-compression').value)||0;
     blob=await makeFlac(audio,flacBits,level);
     description=flacBits+' бит, '+audio.sampleRate+' Гц, сжатие '+level;
   }else{
     var bitrate=radioValue('bitrate')||192;
     blob=await makeMp3(audio,bitrate);description=bitrate+' кбит/с, '+audio.sampleRate+' Гц';
   }
   if(stopped)throw new Error('Отменено.');
   if(!blob||!blob.size)throw new Error('Кодировщик вернул пустой файл.');
   var suffix=(p?'_pitch'+(p>0?'+':'')+p:'')+(t!==1?'_tempo'+Math.round(t*100):'');
   publishResult(blob,extName(file.name,out).replace(/\.[^.]+$/,suffix+'.'+out),fmtName(out));
   say('Готово: '+fmtName(out)+' · '+description+'. Скачайте полученный файл.');
 }catch(e){
   progress.hidden=true;say(e&&e.message==='Отменено.'?'Конвертация отменена.':'Ошибка: '+(e&&e.message?e.message:'не удалось создать файл.'));
 }finally{
   if(ctx&&typeof ctx.close==='function')try{await ctx.close();}catch(e){}
   setBusy(false);
 }
});
root.addEventListener('pagehide',function(){clearResult();if(originalUrl)URL.revokeObjectURL(originalUrl);});
updateChoices();
})(window);
