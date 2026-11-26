// Store only a normalized thumbnail. Source files and their metadata stay on the device.
export async function uploadThumbnail(file){
 if(!['image/png','image/jpeg','image/webp'].includes(file?.type)||file.size>5*1024*1024)throw Error('PNG / JPEG / WebP · 5 MB');
 const bitmap=await createImageBitmap(file);
 try{const canvas=document.createElement('canvas');canvas.width=canvas.height=48;
 const ctx=canvas.getContext('2d'),side=Math.min(bitmap.width,bitmap.height);
 ctx.drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,48,48);
 return btoa(String.fromCharCode(...ctx.getImageData(0,0,48,48).data));
 }finally{bitmap.close()}
}
export function displayThumbnail(canvas,pixels){
 const ctx=canvas.getContext('2d');ctx.clearRect(0,0,48,48);
 if(pixels)ctx.putImageData(new ImageData(Uint8ClampedArray.from(atob(pixels),c=>c.charCodeAt(0)),48,48),0,0);
}
