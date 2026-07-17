import { Circle, DoorOpen, ImagePlus, MessageSquareText, Square, SquareDashed, Waypoints } from "lucide-react";
import type { ReactNode } from "react";
import type { Annotation } from "./annotationTypes";
import { createCircleAnnotation, createDoorAnnotation, createNoteAnnotation, createRectangleAnnotation, createRoomAnnotation } from "./annotationStore";

export type PlaceableObjectType = "room" | "rectangle" | "circle" | "door" | "note" | "image" | "line" | "window";

export type PlacementInput = {
  drawingId: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DrawingObjectDefinition = {
  type: PlaceableObjectType;
  label: string;
  icon: ReactNode;
  category: "structure" | "shape" | "opening" | "fixture";
  enabled: boolean;
  createDefault: (input: PlacementInput) => Annotation;
};

export const drawingObjectDefinitions: DrawingObjectDefinition[] = [
  {
    type: "room",
    label: "Room",
    icon: <Square size={22} />,
    category: "structure",
    enabled: true,
    createDefault: (input) =>
      createRoomAnnotation({
        drawingId: input.drawingId,
        x: input.x,
        y: input.y,
        width: input.width,
        height: input.height,
        internalWidth: "",
        internalHeight: "",
      }),
  },
  {
    type: "rectangle",
    label: "Rectangle",
    icon: <SquareDashed size={22} />,
    category: "shape",
    enabled: true,
    createDefault: (input) =>
      createRectangleAnnotation({
        drawingId: input.drawingId,
        x: input.x,
        y: input.y,
        width: input.width,
        height: input.height,
      }),
  },
  {
    type: "circle",
    label: "Circle",
    icon: <Circle size={22} />,
    category: "shape",
    enabled: true,
    createDefault: (input) =>
      createCircleAnnotation({
        drawingId: input.drawingId,
        cx: input.x + input.width / 2,
        cy: input.y + input.height / 2,
        radius: Math.max(1, Math.min(input.width, input.height) / 2),
      }),
  },
  {
    type: "door",
    label: "Door",
    icon: <DoorOpen size={22} />,
    category: "opening",
    enabled: true,
    createDefault: (input) => createDoorAnnotation({ drawingId: input.drawingId, position: { x: input.x + input.width / 2, y: input.y + input.height / 2 } }),
  },
  {
    type: "note",
    label: "Note",
    icon: <MessageSquareText size={22} />,
    category: "fixture",
    enabled: true,
    createDefault: (input) => createNoteAnnotation({ drawingId: input.drawingId, anchor: { x: input.x + input.width/2, y: input.y + input.height/2 }, textPosition: { x: input.x + input.width/2, y: input.y + input.height/2 },boxWidth:input.width,boxHeight:input.height }),
  },
  {
    type: "image", label: "Image", icon: <ImagePlus size={22}/>, category:"fixture", enabled:true, createDefault:unsupportedObject,
  },
  {
    type: "line", label: "Line", icon: <Waypoints size={22}/>, category:"structure", enabled:true, createDefault:unsupportedObject,
  },
  {
    type: "window",
    label: "Window",
    icon: <Square size={22} />,
    category: "opening",
    enabled: false,
    createDefault: unsupportedObject,
  },
];

function unsupportedObject(): Annotation {
  throw new Error("This object type is not enabled yet.");
}
