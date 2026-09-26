export type RootTab = "home" | "projects" | "business" | "profile" | "settings";

export type Route =
  | { name: "home" }
  | { name: "business" }
  | { name: "profile" }
  | { name: "settings" }
  | { name: "siteNotesComingSoon" }
  | { name: "siteNote"; projectId: string; siteNoteId: string; focusSectionId?: string }
  | { name: "projects" }
  | { name: "project"; projectId: string }
  | { name: "drawings"; projectId: string }
  | { name: "drawing"; projectId: string; drawingId: string; returnToSiteNoteId?: string; returnToSectionId?: string };

export const homeRoute = (): Route => ({ name: "home" });
export const businessRoute = (): Route => ({ name: "business" });
export const profileRoute = (): Route => ({ name: "profile" });
export const settingsRoute = (): Route => ({ name: "settings" });
export const siteNotesComingSoonRoute = (): Route => ({ name: "siteNotesComingSoon" });
export const siteNoteRoute = (projectId: string, siteNoteId: string, focusSectionId?: string): Route => ({ name: "siteNote", projectId, siteNoteId, focusSectionId });
export const projectsRoute = (): Route => ({ name: "projects" });
export const projectRoute = (projectId: string): Route => ({ name: "project", projectId });
export const drawingsRoute = (projectId: string): Route => ({ name: "drawings", projectId });
export const drawingRoute = (projectId: string, drawingId: string, context?: { siteNoteId: string; sectionId: string }): Route => ({ name: "drawing", projectId, drawingId, returnToSiteNoteId: context?.siteNoteId, returnToSectionId: context?.sectionId });

export function parseStoredRoute(value: unknown): Route {
  if (!value || typeof value !== "object" || !("name" in value)) return homeRoute();
  const route = value as Record<string, unknown>;
  if (["home", "business", "profile", "settings", "siteNotesComingSoon", "projects"].includes(String(route.name))) {
    return { name: route.name } as Route;
  }
  if ((route.name === "project" || route.name === "drawings") && typeof route.projectId === "string") {
    return { name: route.name, projectId: route.projectId };
  }
  if (route.name === "siteNote" && typeof route.projectId === "string" && typeof route.siteNoteId === "string") {
    return siteNoteRoute(route.projectId, route.siteNoteId, typeof route.focusSectionId === "string" ? route.focusSectionId : undefined);
  }
  if (route.name === "drawing" && typeof route.projectId === "string" && typeof route.drawingId === "string") {
    return drawingRoute(route.projectId, route.drawingId, typeof route.returnToSiteNoteId === "string" && typeof route.returnToSectionId === "string" ? { siteNoteId: route.returnToSiteNoteId, sectionId: route.returnToSectionId } : undefined);
  }
  return homeRoute();
}
