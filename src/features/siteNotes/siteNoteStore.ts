import { requestResult, runMultiStoreTransaction } from "../../storage/db";
import { createId } from "../../utils/ids";
import type { Asset } from "../assets/assetTypes";
import type { Project } from "../projects/projectTypes";
import type { DrawingContent, PhotoContent, SiteNote, SiteNoteContent, SiteNoteDocument, SiteNoteSection, TextContent } from "./siteNoteTypes";

const now = () => new Date().toISOString();
const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order;

export async function getSiteNotesByProject(projectId: string): Promise<SiteNote[]> {
  return runMultiStoreTransaction(["siteNotes"] as const, "readonly", async ({ siteNotes }) => {
    const notes = await requestResult<SiteNote[]>(siteNotes.index("projectId").getAll(projectId));
    return notes.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  });
}

export async function getRecentSiteNotes(): Promise<SiteNote[]> {
  return runMultiStoreTransaction(["siteNotes"] as const, "readonly", async ({ siteNotes }) =>
    (await requestResult<SiteNote[]>(siteNotes.getAll())).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
  );
}

export async function getSiteNoteDocument(siteNoteId: string): Promise<SiteNoteDocument | undefined> {
  return runMultiStoreTransaction(["siteNotes", "siteNoteSections", "siteNoteContents"] as const, "readonly", async (stores) => {
    const note = await requestResult<SiteNote | undefined>(stores.siteNotes.get(siteNoteId));
    if (!note) return undefined;
    const sections = (await requestResult<SiteNoteSection[]>(stores.siteNoteSections.index("siteNoteId").getAll(siteNoteId))).sort(byOrder);
    const contents = (await Promise.all(sections.map((section) => requestResult<SiteNoteContent[]>(stores.siteNoteContents.index("sectionId").getAll(section.id))))).flat().sort((a, b) => a.sectionId === b.sectionId ? a.order - b.order : 0);
    return { note, sections, contents };
  });
}

export async function touchSiteNote(siteNoteId: string): Promise<void> {
  await runMultiStoreTransaction(["projects", "siteNotes"] as const, "readwrite", async (stores) => {
    const note = await requestResult<SiteNote | undefined>(stores.siteNotes.get(siteNoteId));
    if (note) await touch(stores, note, now());
  });
}

export async function createSiteNoteForProject(project: Project, title = "Site Notes"): Promise<SiteNoteDocument> {
  const timestamp = now();
  const note: SiteNote = { id: createId(), projectId: project.id, title, status: "active", createdAt: timestamp, updatedAt: timestamp };
  const section: SiteNoteSection = { id: createId(), siteNoteId: note.id, title: "New Section", order: 0, collapsed: false, createdAt: timestamp, updatedAt: timestamp };
  const content: TextContent = { id: createId(), sectionId: section.id, type: "text", text: "", order: 0, createdAt: timestamp, updatedAt: timestamp };
  await runMultiStoreTransaction(["projects", "siteNotes", "siteNoteSections", "siteNoteContents"] as const, "readwrite", (stores) => {
    stores.projects.put({ ...project, updatedAt: timestamp }); stores.siteNotes.put(note); stores.siteNoteSections.put(section); stores.siteNoteContents.put(content);
  });
  return { note, sections: [section], contents: [content] };
}

async function touch(stores: { siteNotes: IDBObjectStore; projects: IDBObjectStore }, note: SiteNote, timestamp: string) {
  stores.siteNotes.put({ ...note, updatedAt: timestamp });
  const project = await requestResult<Project | undefined>(stores.projects.get(note.projectId));
  if (project) stores.projects.put({ ...project, updatedAt: timestamp });
}

export async function addSection(note: SiteNote, sections: SiteNoteSection[]): Promise<{ section: SiteNoteSection; content: TextContent }> {
  const timestamp = now(), order = sections.length;
  const section: SiteNoteSection = { id: createId(), siteNoteId: note.id, title: "New Section", order, collapsed: false, createdAt: timestamp, updatedAt: timestamp };
  const content: TextContent = { id: createId(), sectionId: section.id, type: "text", text: "", order: 0, createdAt: timestamp, updatedAt: timestamp };
  await runMultiStoreTransaction(["projects", "siteNotes", "siteNoteSections", "siteNoteContents"] as const, "readwrite", async (stores) => {
    stores.siteNoteSections.put(section); stores.siteNoteContents.put(content); await touch(stores, note, timestamp);
  });
  return { section, content };
}

export async function updateSection(note: SiteNote, section: SiteNoteSection, patch: Partial<Pick<SiteNoteSection, "title" | "collapsed">>): Promise<SiteNoteSection> {
  const timestamp = now(), updated = { ...section, ...patch, updatedAt: timestamp };
  await runMultiStoreTransaction(["projects", "siteNotes", "siteNoteSections"] as const, "readwrite", async (stores) => { stores.siteNoteSections.put(updated); await touch(stores, note, timestamp); });
  return updated;
}

export async function reorderSections(note: SiteNote, sections: SiteNoteSection[]): Promise<SiteNoteSection[]> {
  const timestamp = now(), ordered = sections.map((section, order) => ({ ...section, order, updatedAt: timestamp }));
  await runMultiStoreTransaction(["projects", "siteNotes", "siteNoteSections"] as const, "readwrite", async (stores) => { ordered.forEach((section) => stores.siteNoteSections.put(section)); await touch(stores, note, timestamp); });
  return ordered;
}

export async function deleteSection(note: SiteNote, section: SiteNoteSection, remaining: SiteNoteSection[]): Promise<void> {
  await runMultiStoreTransaction(["projects", "siteNotes", "siteNoteSections", "siteNoteContents", "assets", "drawings", "annotations"] as const, "readwrite", async (stores) => {
    const timestamp = now(), contents = await requestResult<SiteNoteContent[]>(stores.siteNoteContents.index("sectionId").getAll(section.id));
    contents.forEach((item) => stores.siteNoteContents.delete(item.id)); stores.siteNoteSections.delete(section.id);
    remaining.forEach((item, order) => stores.siteNoteSections.put({ ...item, order, updatedAt: timestamp }));
    for (const item of contents.filter((value): value is PhotoContent => value.type === "photo")) await deleteAssetWhenUnused(stores, item.assetId);
    await touch(stores, note, timestamp);
  });
}

export async function saveText(note: SiteNote, content: TextContent, text: string): Promise<TextContent> {
  const timestamp = now(), updated = { ...content, text, updatedAt: timestamp };
  await runMultiStoreTransaction(["projects", "siteNotes", "siteNoteContents"] as const, "readwrite", async (stores) => { stores.siteNoteContents.put(updated); await touch(stores, note, timestamp); });
  return updated;
}

export async function insertText(note: SiteNote, sectionId: string, contents: SiteNoteContent[], index: number): Promise<TextContent> {
  const timestamp = now();
  const item: TextContent = { id: createId(), sectionId, type: "text", text: "", order: index, createdAt: timestamp, updatedAt: timestamp };
  await persistInsertion(note, contents, item, index);
  return item;
}

export async function insertPhoto(note: SiteNote, sectionId: string, asset: Asset, contents: SiteNoteContent[], index: number): Promise<PhotoContent> {
  const timestamp = now();
  const item: PhotoContent = { id: createId(), sectionId, type: "photo", assetId: asset.id, order: index, createdAt: timestamp, updatedAt: timestamp };
  await runMultiStoreTransaction(["projects", "siteNotes", "siteNoteContents", "assets"] as const, "readwrite", async (stores) => {
    stores.assets.put(asset); const ordered = insertAt(contents, item, index); ordered.forEach((value) => stores.siteNoteContents.put(value)); await touch(stores, note, timestamp);
  });
  return item;
}

export async function insertDrawing(note: SiteNote, sectionId: string, drawingId: string, contents: SiteNoteContent[], index: number): Promise<DrawingContent> {
  const timestamp = now();
  const item: DrawingContent = { id: createId(), sectionId, type: "drawing", drawingId, order: index, createdAt: timestamp, updatedAt: timestamp };
  await persistInsertion(note, contents, item, index);
  return item;
}

async function persistInsertion(note: SiteNote, contents: SiteNoteContent[], item: SiteNoteContent, index: number) {
  const timestamp = item.updatedAt;
  await runMultiStoreTransaction(["projects", "siteNotes", "siteNoteContents"] as const, "readwrite", async (stores) => { insertAt(contents, item, index).forEach((value) => stores.siteNoteContents.put(value)); await touch(stores, note, timestamp); });
}

export async function reorderContents(note: SiteNote, sectionId: string, contents: SiteNoteContent[]): Promise<SiteNoteContent[]> {
  const timestamp = now(), ordered = contents.map((item, order) => ({ ...item, sectionId, order, updatedAt: timestamp }));
  await runMultiStoreTransaction(["projects", "siteNotes", "siteNoteContents"] as const, "readwrite", async (stores) => { ordered.forEach((item) => stores.siteNoteContents.put(item)); await touch(stores, note, timestamp); });
  return ordered;
}

export async function moveContentToSection(note: SiteNote, item: SiteNoteContent, source: SiteNoteContent[], destinationSectionId: string, destination: SiteNoteContent[]): Promise<{ source: SiteNoteContent[]; destination: SiteNoteContent[] }> {
  const timestamp = now();
  const nextSource = source.filter((value) => value.id !== item.id).map((value, order) => ({ ...value, order, updatedAt: timestamp }));
  const moved = { ...item, sectionId: destinationSectionId, order: destination.length, updatedAt: timestamp } as SiteNoteContent;
  const nextDestination = [...destination, moved].map((value, order) => ({ ...value, order, updatedAt: timestamp }));
  await runMultiStoreTransaction(["projects", "siteNotes", "siteNoteContents"] as const, "readwrite", async (stores) => {
    [...nextSource, ...nextDestination].forEach((value) => stores.siteNoteContents.put(value)); await touch(stores, note, timestamp);
  });
  return { source: nextSource, destination: nextDestination };
}

export async function deleteContent(note: SiteNote, item: SiteNoteContent, remaining: SiteNoteContent[]): Promise<void> {
  await runMultiStoreTransaction(["projects", "siteNotes", "siteNoteContents", "assets", "drawings", "annotations"] as const, "readwrite", async (stores) => {
    const timestamp = now(); stores.siteNoteContents.delete(item.id); remaining.forEach((value, order) => stores.siteNoteContents.put({ ...value, order, updatedAt: timestamp }));
    if (item.type === "photo") await deleteAssetWhenUnused(stores, item.assetId); await touch(stores, note, timestamp);
  });
}

function insertAt(contents: SiteNoteContent[], item: SiteNoteContent, index: number) {
  return [...contents.slice(0, index), item, ...contents.slice(index)].map((value, order) => ({ ...value, order }));
}

async function deleteAssetWhenUnused(stores: Record<string, IDBObjectStore>, assetId: string) {
  const notes = await requestResult<SiteNoteContent[]>(stores.siteNoteContents.getAll());
  const drawings = await requestResult<Array<{ backgroundAssetId?: string }>>(stores.drawings.getAll());
  const annotations = await requestResult<Array<{ type: string; assetId?: string }>>(stores.annotations.getAll());
  if (!notes.some((item) => item.type === "photo" && item.assetId === assetId) && !drawings.some((item) => item.backgroundAssetId === assetId) && !annotations.some((item) => item.type === "image" && item.assetId === assetId)) stores.assets.delete(assetId);
}
