export type Route =
  | { name: "projects" }
  | { name: "project"; projectId: string }
  | { name: "drawings"; projectId: string }
  | { name: "drawing"; projectId: string; drawingId: string };

export const projectsRoute = (): Route => ({ name: "projects" });

export const projectRoute = (projectId: string): Route => ({
  name: "project",
  projectId,
});

export const drawingsRoute = (projectId: string): Route => ({
  name: "drawings",
  projectId,
});

export const drawingRoute = (projectId: string, drawingId: string): Route => ({
  name: "drawing",
  projectId,
  drawingId,
});
