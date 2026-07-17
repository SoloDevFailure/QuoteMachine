import type { Point } from "../drawings/workspace/viewportTypes";

export type AnnotationType = "dimension" | "room" | "rectangle" | "circle" | "door" | "note" | "image" | "line";

export type BaseAnnotation = {
  id: string;
  drawingId: string;
  type: string;
  layerId: string;
  colour: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
};

export type DimensionAnnotation = BaseAnnotation & {
  type: "dimension";
  start: Point;
  end: Point;
  offset: number;
  value: string;
  unit: "mm" | "m";
  lineStyle?:"solid"|"dashed"|"dotted";
  opacity?:number;
  textOutline?:boolean;
  textOutlineColour?:"#000000"|"#ffffff";
};

export type ShapeBorderStyle = "solid" | "broken";
export type ShapeFillStyle = "outline" | "hidden" | "solid" | "diagonalCross" | "crossHatch";

export type RectangleAnnotation = BaseAnnotation & {
  type: "rectangle";
  x: number;
  y: number;
  width: number;
  height: number;
  borderStyle?: ShapeBorderStyle;
  fillStyle: ShapeFillStyle;
  fillColour?: string;
};

export type CircleAnnotation = BaseAnnotation & {
  type: "circle";
  cx: number;
  cy: number;
  radius: number;
};

export type DoorKind = "hinged" | "cavity";

export type DoorAnnotation = BaseAnnotation & {
  type: "door";
  roomId?: string;
  wallId?: string;
  attachedWallId?: string;
  position: Point;
  rotation: number;
  openingAngle: number;
  widthMm: number;
  kind: DoorKind;
  hingeSide: "start" | "end";
  swingDirection: 1 | -1;
};

export type NoteAnnotation = BaseAnnotation & {
  type: "note";
  anchor: Point;
  textPosition: Point;
  text: string;
  rotation?: number;
  boxWidth?:number;
  boxHeight?:number;
  hasLeader?:boolean;
};

export type ImageAnnotation = BaseAnnotation & {
  type: "image";
  assetId: string;
  position: Point;
  width: number;
  height: number;
  rotation: number;
  skewX: number;
  skewY: number;
  crop: { left:number; top:number; right:number; bottom:number };
  corners?: [Point,Point,Point,Point];
  cropRect?: {x:number;y:number;width:number;height:number};
};

export type LineNode = { id:string; x:number; y:number; locked:boolean };
export type LineSegment = { id:string; startNodeId:string; endNodeId:string; measurementAngle?:number; measurementDistancePx?:number };
export type LineAnnotation = BaseAnnotation & {
  type:"line";
  nodeOrder:string[];
  nodes:LineNode[];
  segments:LineSegment[];
  thicknessMm:number;
  lineStyle:"solid"|"dashed"|"dotted";
  opacity:number;
  showAngles:boolean;
  showMeasurements?:boolean;
  angleSides:Record<string,"acute"|"obtuse">;
};

export type RoomPoint = {
  id: string;
  x: number;
  y: number;
};

export type RoomWall = {
  id: string;
  fromPointId: string;
  toPointId: string;
  label?: "top" | "right" | "bottom" | "left";
  visible: boolean;
  joinedToRoomId?: string;
  joinedToWallId?: string;
  joinedSegments?: RoomWallJoin[];
};

export type RoomWallJoin = {
  from: number;
  to: number;
  joinedToRoomId: string;
  joinedToWallId: string;
};

export type RoomAnnotation = BaseAnnotation & {
  type: "room";
  label?: string;
  fillColour?: string;
  points: RoomPoint[];
  walls: RoomWall[];
  internalWidth: string;
  internalHeight: string;
  unit: "mm" | "m";
};

export type LegacyRectShapeAnnotation = BaseAnnotation & {
  type: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  internalWidth: string;
  internalHeight: string;
  unit: "mm" | "m";
};

export type Annotation = DimensionAnnotation | RoomAnnotation | RectangleAnnotation | CircleAnnotation | DoorAnnotation | NoteAnnotation | ImageAnnotation | LineAnnotation;
export type StoredAnnotation = Annotation | LegacyRectShapeAnnotation;

export type ReferencePoint = {
  id: string;
  drawingId: string;
  point: Point;
  label?: string;
  sourceAnnotationId?: string;
  createdAt: string;
  updatedAt: string;
};
