import { renderToStaticMarkup } from "react-dom/server";
import { getDrawing } from "../drawings/drawingStore";
import { getDrawingAnnotations } from "../annotations/annotationStore";
import { getAsset } from "../assets/assetStore";
import { AnnotationSvgLayer } from "../drawings/workspace/AnnotationSvgLayer";
import { getDrawingBounds } from "../drawings/preview/drawingBounds";
import { visibleDrawingAnnotations } from "../drawings/preview/visibleAnnotations";
import { blobDataUrl, loadImage } from "./imageRendering";

// Uses the existing renderers, in a read-only host. No editor is mounted and no geometry is saved.
export async function renderDrawingForPdf(id:string) {
  const drawing = await getDrawing(id); if (!drawing) throw new Error("A linked drawing is missing. Restore it or remove its notebook link before exporting.");
  const annotations = visibleDrawingAnnotations(drawing,await getDrawingAnnotations(id));
  const imageUrls:Record<string,string>={};
  for (const item of annotations) if (item.type === "image" && !imageUrls[item.assetId]) {
    const asset=await getAsset(item.assetId);if(!asset)throw new Error(`Image missing in drawing: ${drawing.name}`); imageUrls[item.assetId]=await blobDataUrl(asset.blob);
  }
  const width=1100,height=1350,padding=90;
  const bounds=getDrawingBounds(drawing,annotations);
  const scale=Math.min((width-padding*2)/Math.max(1,bounds.maxX-bounds.minX),(height-padding*2)/Math.max(1,bounds.maxY-bounds.minY));
  const transform={scale,translateX:width/2-(bounds.minX+bounds.maxX)/2*scale,translateY:height/2-(bounds.minY+bounds.maxY)/2*scale};
  const host=document.createElement("div");host.className="drawing-export-host";host.style.cssText="position:fixed;left:-20000px;top:0;width:1100px;height:1350px;background:white;color:#111;pointer-events:none";
  host.innerHTML=renderToStaticMarkup(<AnnotationSvgLayer annotations={annotations} selection={{}} mmPerWorldUnit={drawing.scale?.mmPerWorldUnit ?? 1} transform={transform} viewport={{width,height}} imageUrls={imageUrls} annotationScaleMultiplier={2.2} onEditAnnotation={() => undefined} onSelectAnnotation={() => undefined}/>);
  document.body.append(host);
  try {
    const svg=host.querySelector("svg")!;svg.setAttribute("xmlns","http://www.w3.org/2000/svg");
    if(drawing.backgroundType === "photo" && drawing.backgroundAssetId && drawing.backgroundPlacement) {
      const asset=await getAsset(drawing.backgroundAssetId);if(!asset)throw new Error("Drawing background missing.");
      const image=document.createElementNS("http://www.w3.org/2000/svg","image"),p=drawing.backgroundPlacement;
      image.setAttribute("href",await blobDataUrl(asset.blob));image.setAttribute("x",String(p.originX*scale+transform.translateX));image.setAttribute("y",String(p.originY*scale+transform.translateY));image.setAttribute("width",String(p.width*scale));image.setAttribute("height",String(p.height*scale));svg.prepend(image);
    }
    // Fit the actual rendered labels/offset dimensions, not only the underlying geometry.
    const box=svg.getBBox(),margin=28;
    const minX=Math.min(0,box.x-margin),minY=Math.min(0,box.y-margin),maxX=Math.max(width,box.x+box.width+margin),maxY=Math.max(height,box.y+box.height+margin);
    svg.setAttribute("viewBox",`${minX} ${minY} ${maxX-minX} ${maxY-minY}`);
    for(const node of [svg,...svg.querySelectorAll("*")]) {
      const computed=getComputedStyle(node);
      const properties=["fill","fill-opacity","stroke","stroke-width","stroke-opacity","stroke-dasharray","stroke-linecap","stroke-linejoin","font-family","font-size","font-weight","text-anchor","dominant-baseline","paint-order","opacity","vector-effect","visibility","display"];
      (node as SVGElement).style.cssText += properties.map(key=>`${key}:${computed.getPropertyValue(key)}`).join(";");
    }
    const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)],{type:"image/svg+xml"}));
    try {
      const image=await loadImage(url),canvas=document.createElement("canvas");canvas.width=2200;canvas.height=2700;
      const context=canvas.getContext("2d");if(!context)throw new Error("Drawing rendering unavailable.");
      context.fillStyle="#fff";context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
      return {data:canvas.toDataURL("image/png"),width:canvas.width,height:canvas.height};
    } finally {URL.revokeObjectURL(url);}
  } finally {host.remove();}
}
