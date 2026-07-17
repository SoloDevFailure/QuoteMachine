import type { Point } from "./viewportTypes";

export type ToolMode = "browse" | "dimension" | "placingObject" | "line";

export type DimensionDraft =
  | { step: "idle" }
  | { step: "startPlaced"; start: Point }
  | { step: "endPlaced"; start: Point; end: Point; activeHandle?: "start" | "end" }
  | { step: "offsetPlaced"; start: Point; end: Point; offset: number; activeHandle?: "start" | "end" };

export type RectDraft =
  | { step: "idle" }
  | { step: "drawing"; start: Point; end: Point };

export type LineDraft = { points: Point[]; preview?: Point };
