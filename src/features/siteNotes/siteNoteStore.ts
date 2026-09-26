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

export async function finishSiteNote(note:SiteNote):Promise<SiteNote>{const updated={...note,status:"readyForQuote" as const,updatedAt:now()};await runMultiStoreTransaction(["projects","siteNotes"] as const,"readwrite",async stores=>{stores.siteNotes.put(updated);const project=await requestResult<Project|undefined>(stores.projects.get(note.projectId));if(project)stores.projects.put({...project,updatedAt:updated.updatedAt})});return updated}

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
  const storedNote = await requestResult<SiteNote | undefined>(stores.siteNotes.get(note.id));
  if (storedNote) stores.siteNotes.put({ ...storedNote, updatedAt: timestamp });
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
  const timestamp = now();
  let updated = { ...section, ...patch, updatedAt: timestamp };
  await runMultiStoreTransaction(["projects", "siteNotes", "siteNoteSections"] as const, "readwrite", async (stores) => { const stored = await requestResult<SiteNoteSection | undefined>(stores.siteNoteSections.get(section.id)); if (!stored) throw new Error("Section no longer exists."); updated = { ...stored, ...patch, updatedAt: timestamp }; stores.siteNoteSections.put(updated); await touch(stores, note, timestamp); });
  return updated;
}

export async function reorderSections(note: SiteNote, sections: SiteNoteSection[]): Promise<SiteNoteSection[]> {
  const timestamp = now(), ordered = sections.map((section, order) => ({ ...section, order, updatedAt: timestamp }));
  await runMultiStoreTransaction(["projects", "siteNotes", "siteNoteSections"] as const, "readwrite", async (stores) => { await putSectionOrder(stores.siteNoteSections, ordered); await touch(stores, note, timestamp); });
  return ordered;
}

export async function deleteSection(note: SiteNote, section: SiteNoteSection, remaining: SiteNoteSection[]): Promise<void> {
  await runMultiStoreTransaction(["projects", "siteNotes", "siteNoteSections", "siteNoteContents", "assets", "drawings", "annotations", "thumbnails"] as const, "readwrite", async (stores) => {
    const timestamp = now(), contents = await requestResult<SiteNoteContent[]>(stores.siteNoteContents.index("sectionId").getAll(section.id));
    contents.forEach((item) => stores.siteNoteContents.delete(item.id)); stores.siteNoteSections.delete(section.id);
    await putSectionOrder(stores.siteNoteSections, remaining.map((item, order) => ({ ...item, order, updatedAt: timestamp })));
    for (const item of contents.filter((value): value is PhotoContent => value.type === "photo")) await deleteAssetWhenUnused(stores, item.assetId);
    await touch(stores, note, timestamp);
  });
}

export async function saveText(note: SiteNote, content: TextContent, text: string): Promise<TextContent> {
  const timestamp = now();
  let updated = { ...content, text, updatedAt: timestamp };
  await runMultiStoreTransaction(["projects", "siteNotes", "siteNoteContents"] as const, "readwrite", async (stores) => { const stored = await requestResult<TextContent | undefined>(stores.siteNoteContents.get(content.id)); if (!stored) throw new Error("Note no longer exists."); updated = { ...stored, text, updatedAt: timestamp }; stores.siteNoteContents.put(updated); await touch(stores, note, timestamp); });
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
    stores.assets.put(asset); const ordered = insertAt(contents, item, index); await putContentOrder(stores.siteNoteContents, ordered); await touch(stores, note, timestamp);
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
  await runMultiStoreTransaction(["projects", "siteNotes", "siteNoteContents"] as const, "readwrite", async (stores) => { await putContentOrder(stores.siteNoteContents, insertAt(contents, item, index)); await touch(stores, note, timestamp); });
}

export async function reorderContents(note: SiteNote, sectionId: string, contents: SiteNoteContent[]): Promise<SiteNoteContent[]> {
  const timestamp = now(), ordered = contents.map((item, order) => ({ ...item, sectionId, order, updatedAt: timestamp }));
  await runMultiStoreTransaction(["projects", "siteNotes", "siteNoteContents"] as const, "readwrite", async (stores) => { await putContentOrder(stores.siteNoteContents, ordered); await touch(stores, note, timestamp); });
  return ordered;
}

export async function moveContentToSection(note: SiteNote, item: SiteNoteContent, source: SiteNoteContent[], destinationSectionId: string, destination: SiteNoteContent[]): Promise<{ source: SiteNoteContent[]; destination: SiteNoteContent[] }> {
  const timestamp = now();
  const nextSource = source.filter((value) => value.id !== item.id).map((value, order) => ({ ...value, order, updatedAt: timestamp }));
  const moved = { ...item, sectionId: destinationSectionId, order: destination.length, updatedAt: timestamp } as SiteNoteContent;
  const nextDestination = [...destination, moved].map((value, order) => ({ ...value, order, updatedAt: timestamp }));
  await runMultiStoreTransaction(["projects", "siteNotes", "siteNoteContents"] as const, "readwrite", async (stores) => {
    await putContentOrder(stores.siteNoteContents, [...nextSource, ...nextDestination]); await touch(stores, note, timestamp);
  });
  return { source: nextSource, destination: nextDestination };
}

export async function deleteContent(note: SiteNote, item: SiteNoteContent, remaining: SiteNoteContent[]): Promise<void> {
  await runMultiStoreTransaction(["projects", "siteNotes", "siteNoteContents", "assets", "drawings", "annotations", "thumbnails"] as const, "readwrite", async (stores) => {
    const timestamp = now(); stores.siteNoteContents.delete(item.id); await putContentOrder(stores.siteNoteContents, remaining.map((value, order) => ({ ...value, order, updatedAt: timestamp })));
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
  const projects = await requestResult<Project[]>(stores.projects.getAll());
  if (!projects.some(item => item.projectPhotoAssetId === assetId) && !notes.some((item) => item.type === "photo" && item.assetId === assetId) && !drawings.some((item) => item.backgroundAssetId === assetId) && !annotations.some((item) => item.type === "image" && item.assetId === assetId)) { stores.assets.delete(assetId); stores.thumbnails.delete(assetId); }
}

// Reordering must never write stale text/title snapshots over a just-flushed edit.
async function putContentOrder(store: IDBObjectStore, ordered: SiteNoteContent[]) {
  for (const item of ordered) {
    const stored = await requestResult<SiteNoteContent | undefined>(store.get(item.id));
    store.put({ ...(stored ?? item), sectionId: item.sectionId, order: item.order, updatedAt: now() });
  }
}
async function putSectionOrder(store: IDBObjectStore, ordered: SiteNoteSection[]) {
  for (const section of ordered) {
    const stored = await requestResult<SiteNoteSection | undefined>(store.get(section.id));
    if (stored) store.put({ ...stored, order: section.order, updatedAt: now() });
  }
}
