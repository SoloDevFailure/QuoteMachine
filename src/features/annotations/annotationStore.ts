import { db } from "../../storage/db";
import { createId } from "../../utils/ids";
import type {
  Annotation,
  CircleAnnotation,
  DimensionAnnotation,
  DoorAnnotation,
  NoteAnnotation,
  ImageAnnotation,
  LineAnnotation,
  RectangleAnnotation,
  ReferencePoint,
  RoomAnnotation,
  ShapeFillStyle,
  StoredAnnotation,
} from "./annotationTypes";
import { createRoomFromRect, getRoomWalls, legacyRectToRoom } from "./shapes/rectGeometry";

function now() {
  return new Date().toISOString();
}

export async function getDrawingAnnotations(drawingId: string) {
  const annotations = await db.getAnnotationsByDrawing(drawingId);
  const normalized = annotations.map(normalizeStoredAnnotation);
  return normalized.map(annotation => {
    if (annotation.type !== "door" || typeof annotation.position !== "number") return annotation;
    const legacy = annotation as unknown as DoorAnnotation & { position:number };
    const room = normalized.find((item): item is RoomAnnotation => item.type === "room" && item.id === legacy.roomId);
    const wall = room ? getRoomWalls(room).find(item=>item.wall.id===legacy.wallId) : undefined;
    const position = wall ? {x:wall.start.x+(wall.end.x-wall.start.x)*legacy.position,y:wall.start.y+(wall.end.y-wall.start.y)*legacy.position}:{x:0,y:0};
    const rotation = wall ? Math.atan2(wall.end.y-wall.start.y,wall.end.x-wall.start.x)*180/Math.PI : 0;
    return {...legacy,position,rotation,openingAngle:90,attachedWallId:legacy.wallId};
  });
}

export async function saveAnnotation(annotation: Annotation) {
  await db.putAnnotation({
    ...annotation,
    updatedAt: now(),
  });
}

export async function deleteAnnotation(annotationId: string) {
  await db.deleteAnnotation(annotationId);
}

export function createDimensionAnnotation(input: {
  drawingId: string;
  start: DimensionAnnotation["start"];
  end: DimensionAnnotation["end"];
  offset: number;
  value: string;
  unit?: "mm" | "m";
  colour?: string;
}): DimensionAnnotation {
  const timestamp = now();

  return {
    id: createId(),
    drawingId: input.drawingId,
    type: "dimension",
    layerId: "general",
    colour: input.colour ?? "#1677ff",
    start: input.start,
    end: input.end,
    offset: input.offset,
    value: input.value,
    lineStyle:"solid",
    opacity:1,
    textOutline:true,
    textOutlineColour:"#ffffff",
    unit: input.unit ?? "mm",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function createRoomAnnotation(input: {
  drawingId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  internalWidth: string;
  internalHeight: string;
  label?: string;
  unit?: "mm" | "m";
  colour?: string;
  id?: string;
}): RoomAnnotation {
  return createRoomFromRect({
    drawingId: input.drawingId,
    rect: input,
    internalWidth: input.internalWidth,
    internalHeight: input.internalHeight,
    label: input.label,
    unit: input.unit,
    colour: input.colour,
    id: input.id ?? createId(),
  });
}

export function createRectangleAnnotation(input: {
  drawingId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fillStyle?: ShapeFillStyle;
  colour?: string;
}): RectangleAnnotation {
  const timestamp = now();

  return {
    id: createId(),
    drawingId: input.drawingId,
    type: "rectangle",
    layerId: "general",
    colour: input.colour ?? "#111111",
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    borderStyle: "solid",
    fillStyle: input.fillStyle ?? "outline",
    fillColour: "#dbeafe",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function createCircleAnnotation(input: {
  drawingId: string;
  cx: number;
  cy: number;
  radius: number;
  colour?: string;
}): CircleAnnotation {
  const timestamp = now();

  return {
    id: createId(),
    drawingId: input.drawingId,
    type: "circle",
    layerId: "general",
    colour: input.colour ?? "#111111",
    cx: input.cx,
    cy: input.cy,
    radius: input.radius,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function createDoorAnnotation(input: {
  drawingId: string;
  position: DoorAnnotation["position"];
  rotation?: number;
  openingAngle?: number;
  roomId?: string;
  wallId?: string;
  widthMm?: number;
  kind?: DoorAnnotation["kind"];
  hingeSide?: DoorAnnotation["hingeSide"];
  swingDirection?: DoorAnnotation["swingDirection"];
  colour?: string;
}): DoorAnnotation {
  const timestamp = now();

  return {
    id: createId(),
    drawingId: input.drawingId,
    type: "door",
    layerId: "general",
    colour: input.colour ?? "#111111",
    roomId: input.roomId,
    wallId: input.wallId,
    attachedWallId: input.wallId,
    position: input.position,
    rotation: input.rotation ?? 0,
    openingAngle: input.openingAngle ?? 90,
    widthMm: input.widthMm ?? 820,
    kind: input.kind ?? "hinged",
    hingeSide: input.hingeSide ?? "start",
    swingDirection: input.swingDirection ?? 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function createNoteAnnotation(input: { drawingId: string; anchor: NoteAnnotation["anchor"]; textPosition: NoteAnnotation["textPosition"]; text?: string; colour?: string; boxWidth?:number;boxHeight?:number }): NoteAnnotation {
  const timestamp = now();
  return { id: createId(), drawingId: input.drawingId, type: "note", layerId: "general", colour: input.colour ?? "#111111", anchor: input.anchor, textPosition: input.textPosition, text: input.text ?? "",boxWidth:input.boxWidth,boxHeight:input.boxHeight,hasLeader:false, createdAt: timestamp, updatedAt: timestamp };
}

export function createImageAnnotation(input:{drawingId:string;assetId:string;position:ImageAnnotation["position"];width:number;height:number;layerId:string}):ImageAnnotation {
  const timestamp=now(); return {id:createId(),drawingId:input.drawingId,type:"image",layerId:input.layerId,colour:"#111111",assetId:input.assetId,position:input.position,width:input.width,height:input.height,rotation:0,skewX:0,skewY:0,crop:{left:0,top:0,right:0,bottom:0},createdAt:timestamp,updatedAt:timestamp};
}

export function createLineAnnotation(input:{drawingId:string;layerId:string;points:Array<{x:number;y:number}>}):LineAnnotation {
  const timestamp=now();const id=createId();const nodes=input.points.map((point,index)=>({id:`${id}-node-${index}-${createId()}`,x:point.x,y:point.y,locked:false}));
  return{id,drawingId:input.drawingId,type:"line",layerId:input.layerId,colour:"#111111",nodeOrder:nodes.map(node=>node.id),nodes,segments:nodes.slice(0,-1).map((node,index)=>({id:`${id}-segment-${createId()}`,startNodeId:node.id,endNodeId:nodes[index+1].id})),thicknessMm:6,lineStyle:"solid",opacity:1,showAngles:false,showMeasurements:false,angleSides:{},createdAt:timestamp,updatedAt:timestamp};
}

export function normalizeStoredAnnotation(annotation: StoredAnnotation): Annotation {
  if (annotation.type !== "rect") return annotation;

  return legacyRectToRoom(annotation);
}

export async function getReferencePoints(drawingId: string) {
  return db.getReferencePointsByDrawing(drawingId);
}

export async function saveReferencePoint(referencePoint: ReferencePoint) {
  await db.putReferencePoint(referencePoint);
}

export function createReferencePoint(input: {
  drawingId: string;
  point: ReferencePoint["point"];
  sourceAnnotationId?: string;
}): ReferencePoint {
  const timestamp = now();

  return {
    id: createId(),
    drawingId: input.drawingId,
    point: input.point,
    sourceAnnotationId: input.sourceAnnotationId,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
