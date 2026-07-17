import type { DrawingBackgroundPlacement } from "../drawingTypes";
import type { Point, ViewportSize, ViewTransform } from "./viewportTypes";

const minScale = 0.08;
const maxScale = 8;

export function clampScale(scale: number) {
  return Math.min(maxScale, Math.max(minScale, scale));
}

export function screenToWorld(point: Point, transform: ViewTransform): Point {
  return {
    x: (point.x - transform.translateX) / transform.scale,
    y: (point.y - transform.translateY) / transform.scale,
  };
}

export function worldToScreen(point: Point, transform: ViewTransform): Point {
  return {
    x: point.x * transform.scale + transform.translateX,
    y: point.y * transform.scale + transform.translateY,
  };
}

export function zoomAtScreenPoint(
  transform: ViewTransform,
  screenPoint: Point,
  nextScale: number,
): ViewTransform {
  const clampedScale = clampScale(nextScale);
  const worldPoint = screenToWorld(screenPoint, transform);

  return {
    scale: clampedScale,
    translateX: screenPoint.x - worldPoint.x * clampedScale,
    translateY: screenPoint.y - worldPoint.y * clampedScale,
  };
}

export function createBlankInitialTransform(viewport: ViewportSize): ViewTransform {
  return {
    scale: 1,
    translateX: viewport.width / 2,
    translateY: viewport.height / 2,
  };
}

export function createPhotoFitTransform(
  viewport: ViewportSize,
  placement: DrawingBackgroundPlacement,
): ViewTransform {
  const padding = 28;
  const availableWidth = Math.max(1, viewport.width - padding * 2);
  const availableHeight = Math.max(1, viewport.height - padding * 2);
  const fitScale = clampScale(
    Math.min(availableWidth / placement.width, availableHeight / placement.height, 1),
  );
  const centerWorld = {
    x: placement.originX + placement.width / 2,
    y: placement.originY + placement.height / 2,
  };

  return {
    scale: fitScale,
    translateX: viewport.width / 2 - centerWorld.x * fitScale,
    translateY: viewport.height / 2 - centerWorld.y * fitScale,
  };
}

export function getDistance(first: Point, second: Point) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

export function getMidpoint(first: Point, second: Point): Point {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  };
}
