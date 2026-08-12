import type { Drawing } from "../drawings/drawingTypes";
import { getProjectDrawings } from "../drawings/drawingStore";
import type { Project } from "../projects/projectTypes";
import { getRecentSiteNotes } from "../siteNotes/siteNoteStore";
import type { SiteNote } from "../siteNotes/siteNoteTypes";

export type RecentItem =
  | { type: "drawing"; id: string; projectId: string; name: string; context: string; updatedAt: string; drawing: Drawing }
  | { type: "project"; id: string; projectId: string; name: string; context: string; updatedAt: string; project: Project }
  | { type: "siteNote"; id: string; projectId: string; name: string; context: string; updatedAt: string; siteNote: SiteNote };

export async function getRecentItems(projects: Project[], limit = 4): Promise<RecentItem[]> {
  const drawingGroups = await Promise.all(projects.map(async (project) => ({ project, drawings: await getProjectDrawings(project.id) })));
  const drawingItems: RecentItem[] = drawingGroups.flatMap(({ project, drawings }) => drawings.map((drawing) => ({ type: "drawing", id: drawing.id, projectId: project.id, name: drawing.name, context: project.name, updatedAt: drawing.updatedAt, drawing })));
  const projectsWithoutDrawings: RecentItem[] = drawingGroups.filter(({ drawings }) => drawings.length === 0).map(({ project }) => ({ type: "project", id: project.id, projectId: project.id, name: project.name, context: "Project", updatedAt: project.updatedAt, project }));
  const projectMap = new Map(projects.map((project) => [project.id, project]));
  const noteItems: RecentItem[] = (await getRecentSiteNotes()).filter((note) => projectMap.has(note.projectId)).map((siteNote) => ({ type: "siteNote", id: siteNote.id, projectId: siteNote.projectId, name: projectMap.get(siteNote.projectId)!.name, context: "Site Notes", updatedAt: siteNote.updatedAt, siteNote }));
  return [...noteItems, ...drawingItems, ...projectsWithoutDrawings].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, limit);
}
