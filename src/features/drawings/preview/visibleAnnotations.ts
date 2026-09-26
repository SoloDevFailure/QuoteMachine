import type { Annotation } from "../../annotations/annotationTypes";
import type { Drawing } from "../drawingTypes";
export function visibleDrawingAnnotations(drawing: Drawing, annotations: Annotation[]) {
  const layers = drawing.layers?.length ? drawing.layers : [{id:"general",name:"Layer 0",visible:true,order:0}];
  const order = new Map(layers.map(layer => [layer.id,layer.order]));
  const visible = new Set(layers.filter(layer => layer.visible).map(layer => layer.id));
  const priority: Record<Annotation["type"],number> = {image:0,room:10,rectangle:20,circle:20,door:30,line:40,dimension:50,note:60};
  return annotations.filter(item => visible.has(item.layerId) || !order.has(item.layerId)).sort((a,b) => ((order.get(a.layerId) ?? 0)-(order.get(b.layerId) ?? 0)) || priority[a.type]-priority[b.type]);
}
