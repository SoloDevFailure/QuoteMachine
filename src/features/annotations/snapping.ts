import type { Annotation, ReferencePoint } from "./annotationTypes";
import { getClosestPointOnRectEdge, getRectCenter, getRectCorners, getRectMidpoints } from "./shapes/rectGeometry";
import type { SnapSettings } from "../drawings/drawingTypes";
import type { Point, ViewTransform } from "../drawings/workspace/viewportTypes";

const snapRadiusPx = 24;

export type SnapResult = {
  point: Point;
  type?: "reference" | "shapeCorner" | "shapeEdge" | "endpoint" | "grid" | "alignment";
};

export function snapPoint(input: {
  point: Point;
  annotations: Annotation[];
  excludeAnnotationId?: string;
  mmPerWorldUnit?: number;
  referencePoints: ReferencePoint[];
  settings: SnapSettings;
  transform: ViewTransform;
}): SnapResult {
  const worldRadius = snapRadiusPx / input.transform.scale;
  const candidates: Array<{ point: Point; type: SnapResult["type"]; priority: number; distance: number }> = [];

  if (input.settings.snapToReferencePoints) {
    for (const referencePoint of input.referencePoints) {
      candidates.push({
        point: referencePoint.point,
        type: "reference",
        priority: 1,
        distance: distance(input.point, referencePoint.point),
      });
    }
  }

  if (input.settings.snapToExistingPoints) {
    for (const annotation of input.annotations) {
      if (annotation.id === input.excludeAnnotationId) continue;
      if (annotation.type === "room") {
        for (const point of getRectCorners(annotation)) {
          candidates.push({
            point,
            type: "shapeCorner",
            priority: 2,
            distance: distance(input.point, point),
          });
        }

        for (const point of [...getRectMidpoints(annotation), getRectCenter(annotation)]) {
          candidates.push({
            point,
            type: "shapeEdge",
            priority: 3,
            distance: distance(input.point, point),
          });
        }

        const edgePoint = getClosestPointOnRectEdge(annotation, input.point);
        if (edgePoint) {
          candidates.push({
            point: edgePoint.point,
            type: "shapeEdge",
            priority: 3,
            distance: edgePoint.distance,
          });
        }
      }

      if (annotation.type === "dimension") {
        for (const point of [annotation.start, annotation.end]) {
          candidates.push({
            point,
            type: "endpoint",
            priority: 4,
            distance: distance(input.point, point),
          });
        }
      }

      if (annotation.type === "rectangle") {
        const corners = [
          { x: annotation.x, y: annotation.y },
          { x: annotation.x + annotation.width, y: annotation.y },
          { x: annotation.x + annotation.width, y: annotation.y + annotation.height },
          { x: annotation.x, y: annotation.y + annotation.height },
        ];
        const midpoints = [
          { x: annotation.x + annotation.width / 2, y: annotation.y },
          { x: annotation.x + annotation.width, y: annotation.y + annotation.height / 2 },
          { x: annotation.x + annotation.width / 2, y: annotation.y + annotation.height },
          { x: annotation.x, y: annotation.y + annotation.height / 2 },
          { x: annotation.x + annotation.width / 2, y: annotation.y + annotation.height / 2 },
        ];

        for (const point of corners) {
          candidates.push({
            point,
            type: "shapeCorner",
            priority: 2,
            distance: distance(input.point, point),
          });
        }

        for (const point of midpoints) {
          candidates.push({
            point,
            type: "shapeEdge",
            priority: 3,
            distance: distance(input.point, point),
          });
        }

        const edgePoint = getClosestPointOnRectangle(annotation, input.point);
        candidates.push({
          point: edgePoint.point,
          type: "shapeEdge",
          priority: 3,
          distance: edgePoint.distance,
        });
      }

      if (annotation.type === "circle") {
        const points = [
          { x: annotation.cx, y: annotation.cy },
          { x: annotation.cx + annotation.radius, y: annotation.cy },
          { x: annotation.cx - annotation.radius, y: annotation.cy },
          { x: annotation.cx, y: annotation.cy + annotation.radius },
          { x: annotation.cx, y: annotation.cy - annotation.radius },
        ];

        for (const point of points) {
          candidates.push({
            point,
            type: "shapeEdge",
            priority: 3,
            distance: distance(input.point, point),
          });
        }
      }
    }
  }

  if (input.settings.snapToGrid) {
    const gridSize = getActiveConstructionGridSize({
      mmPerWorldUnit: input.mmPerWorldUnit,
      viewportScale: input.transform.scale,
    });
    const gridPoint = {
      x: Math.round(input.point.x / gridSize) * gridSize,
      y: Math.round(input.point.y / gridSize) * gridSize,
    };
    candidates.push({
      point: gridPoint,
      type: "grid",
      priority: 5,
      distance: distance(input.point, gridPoint),
    });
  }

  const match = candidates
    .filter((candidate) => candidate.distance <= worldRadius)
    .sort((first, second) => first.priority - second.priority || first.distance - second.distance)[0];

  return match ? { point: match.point, type: match.type } : { point: input.point };
}

export function getConstructionGrid(input: {
  mmPerWorldUnit?: number;
  viewportScale: number;
}) {
  const mmPerWorldUnit = input.mmPerWorldUnit && input.mmPerWorldUnit > 0 ? input.mmPerWorldUnit : 1;
  const majorWorld = 300 / mmPerWorldUnit;
  const mediumWorld = 100 / mmPerWorldUnit;
  const fineWorld = 10 / mmPerWorldUnit;
  const detailWorld = 5 / mmPerWorldUnit;
  const precisionWorld = 1 / mmPerWorldUnit;
  const majorPx = majorWorld * input.viewportScale;
  const mediumPx = mediumWorld * input.viewportScale;
  const finePx = fineWorld * input.viewportScale;
  const detailPx = detailWorld * input.viewportScale;
  const precisionPx = precisionWorld * input.viewportScale;

  return {
    majorWorld,
    mediumWorld,
    fineWorld,
    majorPx,
    mediumPx,
    finePx,
    detailWorld, precisionWorld, detailPx, precisionPx,
    showMajor: majorPx >= 10,
    showMedium: mediumPx >= 12,
    showFine: finePx >= 8,
    showDetail: detailPx >= 12,
    showPrecision: precisionPx >= 14,
  };
}

export function getActiveConstructionGridSize(input: {
  mmPerWorldUnit?: number;
  viewportScale: number;
}) {
  const grid = getConstructionGrid(input);

  if (grid.showPrecision) return grid.precisionWorld;
  if (grid.showDetail) return grid.detailWorld;
  if (grid.showFine) return grid.fineWorld;
  if (grid.showMedium) return grid.mediumWorld;
  return grid.majorWorld;
}

export function getMeasurementSnapIncrementMm(viewportScale: number) {
  if (viewportScale < 2.5) return 50;
  if (viewportScale < 4) return 10;
  if (viewportScale < 6) return 5;
  return 1;
}

function distance(first: Point, second: Point) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function getClosestPointOnRectangle(
  rectangle: Extract<Annotation, { type: "rectangle" }>,
  point: Point,
) {
  const left = rectangle.x;
  const right = rectangle.x + rectangle.width;
  const top = rectangle.y;
  const bottom = rectangle.y + rectangle.height;
  const candidates = [
    { x: clamp(point.x, left, right), y: top },
    { x: right, y: clamp(point.y, top, bottom) },
    { x: clamp(point.x, left, right), y: bottom },
    { x: left, y: clamp(point.y, top, bottom) },
  ];

  return candidates
    .map((candidate) => ({ point: candidate, distance: distance(point, candidate) }))
    .sort((first, second) => first.distance - second.distance)[0];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
