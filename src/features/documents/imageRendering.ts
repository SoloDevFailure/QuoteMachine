export async function loadImage(url:string):Promise<HTMLImageElement> {
  const image = new Image();
  await new Promise<void>((resolve,reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("An attachment could not be rendered. No incomplete PDF was created.")); image.src = url; });
  return image;
}
export async function blobDataUrl(blob:Blob):Promise<string> {
  return new Promise((resolve,reject) => { const reader=new FileReader(); reader.onload=() => resolve(String(reader.result)); reader.onerror=() => reject(reader.error); reader.readAsDataURL(blob); });
}
export async function photoForPdf(blob:Blob) {
  const url = URL.createObjectURL(blob);
  try {
    const image = await loadImage(url), scale = Math.min(1,2400/Math.max(image.naturalWidth,image.naturalHeight));
    const canvas = document.createElement("canvas"); canvas.width = Math.max(1,Math.round(image.naturalWidth*scale)); canvas.height = Math.max(1,Math.round(image.naturalHeight*scale));
    const context = canvas.getContext("2d"); if (!context) throw new Error("Image rendering unavailable.");
    context.fillStyle="#fff";context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
    return {data:canvas.toDataURL("image/jpeg",.94),width:canvas.width,height:canvas.height};
  } finally {URL.revokeObjectURL(url);}
}
