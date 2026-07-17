import type { DimensionAnnotation } from "../annotationTypes";
import type { Point } from "../../drawings/workspace/viewportTypes";

export function getDimensionGeometry(dimension: Pick<DimensionAnnotation, "start" | "end" | "offset">) {
  const direction = getUnitVector(dimension.start, dimension.end);
  const normal = { x: -direction.y, y: direction.x };
  const dimensionStart = add(dimension.start, scale(normal, dimension.offset));
  const dimensionEnd = add(dimension.end, scale(normal, dimension.offset));
  const label = midpoint(dimensionStart, dimensionEnd);

  return {
    direction,
    normal,
    dimensionStart,
    dimensionEnd,
    label,
  };
}

export function getDimensionOffset(start: Point, end: Point, offsetPoint: Point) {
  const direction = getUnitVector(start, end);
  const normal = { x: -direction.y, y: direction.x };
  return dot(subtract(offsetPoint, start), normal);
}

export function getUnitVector(start: Point, end: Point): Point {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;

  return {
    x: dx / length,
    y: dy / length,
  };
}

export function add(first: Point, second: Point): Point {
  return {
    x: first.x + second.x,
    y: first.y + second.y,
  };
}

export function subtract(first: Point, second: Point): Point {
  return {
    x: first.x - second.x,
    y: first.y - second.y,
  };
}

export function scale(point: Point, factor: number): Point {
  return {
    x: point.x * factor,
    y: point.y * factor,
  };
}

export function dot(first: Point, second: Point) {
  return first.x * second.x + first.y * second.y;
}

export function midpoint(first: Point, second: Point): Point {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  };
}
