// Velar Mask 1.0. 44.1 kHz sine-window STFT with 50% overlap.
const size = 2048, hop = size / 2;
const windowFn = Float64Array.from({length:size}, (_,i)=>Math.sin(Math.PI*(i+.5)/size));
const offsets = [-12,-6,-3,-1,1,3,6,12];
const frequency = Float32Array.from({length:hop+1},(_,i)=>Math.log1p(i)/7);
function fft(real, imag, inverse){
  for(let i=1,j=0;i<size;i++){
    let bit=hop;
    while(j & bit){j ^= bit;bit >>= 1;}
    j ^= bit;
    if(i<j){[real[i],real[j]]=[real[j],real[i]];[imag[i],imag[j]]=[imag[j],imag[i]];}
  }
  for(let n=2;n<=size;n*=2){
    const angle=(inverse?2:-2)*Math.PI/n, c=Math.cos(angle), s=Math.sin(angle);
    for(let base=0;base<size;base+=n){
      let x=1,y=0;
      for(let k=0;k<n/2;k++){
        const i=base+k,j=i+n/2,u=real[j]*x-imag[j]*y,v=real[j]*y+imag[j]*x;
        real[j]=real[i]-u;imag[j]=imag[i]-v;real[i]+=u;imag[i]+=v;
        const next=x*c-y*s;y=x*s+y*c;x=next;
      }
    }
  }
}
function predictor(model){
  const layers=model.map(({w,b})=>({weights:Float32Array.from(b.flatMap((_,j)=>w.map(row=>row[j]))),
    bias:b,out:new Float32Array(b.length)}));
  return input=>{
    for(const layer of layers){
      let p=0;
      for(let j=0;j<layer.out.length;j++){
        let sum=layer.bias[j];
        for(let k=0;k<input.length;k++)sum+=input[k]*layer.weights[p++];
        layer.out[j]=Math.max(0,sum);
      }
      input=layer.out;
    }
    return Math.min(1,input[0]);
  };
}
let cachedModel;
onmessage=async({data:channels})=>{
  try{
    if(!cachedModel){
      postMessage({stage:'Загружаем модель…'});
      const response=await fetch('./velar-mask-v1.json',{cache:'force-cache'});
      if(!response.ok)throw Error('Не удалось загрузить модель.');
      cachedModel=await response.json();
    }
    const predict=predictor(cachedModel), output=[];
    const length=channels[0].length;
    for(let ch=0;ch<channels.length;ch++){
      const audio=channels[ch], vocals=new Float32Array(length);
      const real=new Float64Array(size), imag=new Float64Array(size);
      const log=new Float32Array(hop+1),history=new Float32Array(hop+1),features=new Float32Array(11);
      for(let at=-hop;at<length;at+=hop){
        for(let i=0;i<size;i++)real[i]=(audio[at+i]||0)*windowFn[i];
        imag.fill(0);fft(real,imag,false);
        for(let i=0;i<=hop;i++){
          const mag=Math.hypot(real[i],imag[i]);
          history[i]=.92*history[i]+.08*mag;log[i]=Math.log(mag+.001);
        }
        for(let i=0;i<=hop;i++){
          features[0]=frequency[i];features[1]=log[i]/6;features[2]=log[i]-Math.log(history[i]+.001);
          for(let j=0;j<offsets.length;j++)features[3+j]=log[Math.max(0,Math.min(hop,i+offsets[j]))]-log[i];
          const gain=predict(features);real[i]*=gain;imag[i]*=gain;
          if(i>0&&i<hop){real[size-i]*=gain;imag[size-i]*=gain;}
        }
        fft(real,imag,true);
        for(let i=Math.max(0,-at);i<Math.min(size,length-at);i++)vocals[at+i]+=real[i]*windowFn[i]/size;
        if((at/hop)%16===0)postMessage({percent:Math.floor(100*(ch+at/length)/channels.length)});
      }
      for(let i=0;i<length;i++)audio[i]-=vocals[i];
      output.push(vocals);
    }
    postMessage({vocals:output,instrumental:channels},[...channels,...output].map(x=>x.buffer));
  }catch(error){postMessage({error:error.message||'Недостаточно памяти для разделения.'});}
};
