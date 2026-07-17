import { db } from "../../storage/db";
import { createId } from "../../utils/ids";
import type { Drawing, DrawingInput, DrawingLayer, DrawingScale, SnapSettings } from "./drawingTypes";

function now() {
  return new Date().toISOString();
}

export async function getProjectDrawings(projectId: string) {
  return db.getDrawingsByProject(projectId);
}

export async function getDrawing(drawingId: string) {
  return db.getDrawing(drawingId);
}

export async function createDrawing(projectId: string, input: DrawingInput): Promise<Drawing> {
  const timestamp = now();
  const drawing: Drawing = {
    id: createId(),
    projectId,
    name: input.name,
    backgroundType: input.backgroundType ?? "blank",
    backgroundAssetId: input.backgroundAssetId,
    backgroundPlacement: input.backgroundPlacement,
    viewportHint: {
      centerX: input.backgroundPlacement
        ? input.backgroundPlacement.originX + input.backgroundPlacement.width / 2
        : 0,
      centerY: input.backgroundPlacement
        ? input.backgroundPlacement.originY + input.backgroundPlacement.height / 2
        : 0,
      scale: 1,
    },
    snapSettings: getDefaultSnapSettings(),
    layers: [{ id: "general", name: "Layer 0", visible: true, order: 0 }],
    activeLayerId: "general",
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await db.putDrawing(drawing);
  return drawing;
}

export async function updateDrawingLayers(drawing: Drawing, layers: DrawingLayer[], activeLayerId: string): Promise<Drawing> {
  const updated={...drawing,layers,activeLayerId,updatedAt:now()};
  await db.putDrawing(updated);
  return updated;
}

export async function updateDrawingSnapSettings(
  drawing: Drawing,
  snapSettings: SnapSettings,
): Promise<Drawing> {
  const updated: Drawing = {
    ...drawing,
    snapSettings,
    updatedAt: now(),
  };

  await db.putDrawing(updated);
  return updated;
}

export async function updateDrawingScale(
  drawing: Drawing,
  scale: DrawingScale,
): Promise<Drawing> {
  const updated: Drawing = {
    ...drawing,
    scale,
    updatedAt: now(),
  };

  await db.putDrawing(updated);
  return updated;
}

export async function clearDrawingScale(drawing: Drawing): Promise<Drawing> {
  const updated: Drawing = {
    ...drawing,
    scale: undefined,
    updatedAt: now(),
  };

  await db.putDrawing(updated);
  return updated;
}

export async function renameDrawing(drawing: Drawing, name: string): Promise<Drawing> {
  const updated: Drawing = {
    ...drawing,
    name,
    updatedAt: now(),
  };

  await db.putDrawing(updated);
  return updated;
}

export async function deleteDrawing(drawing: Drawing): Promise<void> {
  const annotations = await db.getAnnotationsByDrawing(drawing.id);
  const referencePoints = await db.getReferencePointsByDrawing(drawing.id);

  await Promise.all(annotations.map((annotation) => db.deleteAnnotation(annotation.id)));
  await Promise.all(referencePoints.map((referencePoint) => db.deleteReferencePoint(referencePoint.id)));

  if (drawing.backgroundAssetId) {
    await db.deleteAsset(drawing.backgroundAssetId);
  }

  await db.deleteDrawing(drawing.id);
}

export function getDefaultSnapSettings(): SnapSettings {
  return {
    snapToGrid: true,
    snapToExistingPoints: true,
    snapToReferencePoints: true,
  };
}
