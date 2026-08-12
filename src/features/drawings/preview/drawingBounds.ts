import type { Annotation, ImageAnnotation } from "../../annotations/annotationTypes";
import type { Drawing } from "../drawingTypes";
import type { Point } from "../workspace/viewportTypes";

export type DrawingBounds = { minX: number; minY: number; maxX: number; maxY: number };

export function getDrawingBounds(drawing: Drawing, annotations: Annotation[]): DrawingBounds {
  const points: Point[] = [];
  const addRect = (x: number, y: number, width: number, height: number) => points.push({ x, y }, { x: x + width, y: y + height });
  const background = drawing.backgroundPlacement;
  if (background) addRect(background.originX, background.originY, background.width, background.height);

  for (const item of annotations) {
    if (item.type === "room") points.push(...item.points);
    else if (item.type === "dimension") points.push(item.start, item.end);
    else if (item.type === "rectangle") addRect(item.x, item.y, item.width, item.height);
    else if (item.type === "circle") addRect(item.cx - item.radius, item.cy - item.radius, item.radius * 2, item.radius * 2);
    else if (item.type === "door") points.push(item.position);
    else if (item.type === "note") points.push(item.anchor, item.textPosition);
    else if (item.type === "image") points.push(...getImagePoints(item));
    else if (item.type === "line") points.push(...item.nodes);
  }

  if (!points.length) return { minX: -100, minY: -70, maxX: 100, maxY: 70 };
  return {
    minX: Math.min(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxX: Math.max(...points.map((point) => point.x)),
    maxY: Math.max(...points.map((point) => point.y)),
  };
}

function getImagePoints(image: ImageAnnotation): Point[] {
  return image.corners ?? [
    image.position,
    { x: image.position.x + image.width, y: image.position.y + image.height },
  ];
}
