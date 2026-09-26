import type { Project } from "../features/projects/projectTypes";
import type { Annotation, ReferencePoint, StoredAnnotation } from "../features/annotations/annotationTypes";
import type { Asset } from "../features/assets/assetTypes";
import type { Drawing } from "../features/drawings/drawingTypes";
import type { SiteNote, SiteNoteContent, SiteNoteSection } from "../features/siteNotes/siteNoteTypes";
import type { ClientContact } from "../features/clients/clientTypes";

const databaseName = "fortestack";
const databaseVersion = 7;

export type StoreName = "thumbnails" | "projects" | "drawings" | "assets" | "annotations" | "referencePoints" | "siteNotes" | "siteNoteSections" | "siteNoteContents" | "clientContacts";
export type StoreRecordMap = {
  thumbnails: import("../features/assets/thumbnails").Thumbnail;
  projects: Project; drawings: Drawing; assets: Asset; annotations: StoredAnnotation;
  referencePoints: ReferencePoint; siteNotes: SiteNote; siteNoteSections: SiteNoteSection; siteNoteContents: SiteNoteContent;
  clientContacts: ClientContact;
};
export type StoreMap = { [Name in StoreName]: IDBObjectStore };

type Migration = (database: IDBDatabase, transaction: IDBTransaction) => void;

const migrations: Record<number, Migration> = {
  1(database) {
    const projects = database.createObjectStore("projects", { keyPath: "id" });
    projects.createIndex("updatedAt", "updatedAt");
    const drawings = database.createObjectStore("drawings", { keyPath: "id" });
    drawings.createIndex("projectId", "projectId");
    drawings.createIndex("updatedAt", "updatedAt");
  },
  2(database) {
    const assets = database.createObjectStore("assets", { keyPath: "id" });
    assets.createIndex("projectId", "projectId");
  },
  3(database) {
    const annotations = database.createObjectStore("annotations", { keyPath: "id" });
    annotations.createIndex("drawingId", "drawingId");
    const referencePoints = database.createObjectStore("referencePoints", { keyPath: "id" });
    referencePoints.createIndex("drawingId", "drawingId");
  },
  4(_database, transaction) {
    // Version 4 establishes explicit, sequential migrations. The existing schema
    // already has the required indexes, so no stored records need rewriting.
    for (const storeName of ["projects", "drawings", "assets", "annotations", "referencePoints"] as const) {
      if (!transaction.objectStoreNames.contains(storeName)) {
        throw new Error(`ForteStack migration 4 expected the ${storeName} store.`);
      }
    }
  },
  5(database) {
    const notes = database.createObjectStore("siteNotes", { keyPath: "id" });
    notes.createIndex("projectId", "projectId");
    notes.createIndex("updatedAt", "updatedAt");
    const sections = database.createObjectStore("siteNoteSections", { keyPath: "id" });
    sections.createIndex("siteNoteId", "siteNoteId");
    sections.createIndex("siteNoteId_order", ["siteNoteId", "order"]);
    const contents = database.createObjectStore("siteNoteContents", { keyPath: "id" });
    contents.createIndex("sectionId", "sectionId");
    contents.createIndex("sectionId_order", ["sectionId", "order"]);
  },
  7(database) {
    database.createObjectStore("thumbnails", { keyPath: "id" });
  },
  6(database) {
    const clients=database.createObjectStore("clientContacts",{keyPath:"id"});
    clients.createIndex("name","name"); clients.createIndex("updatedAt","updatedAt");
  },
};

let databasePromise: Promise<IDBDatabase> | undefined;

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      const error = new Error("IndexedDB is not available in this browser context.");
      console.error("[ForteStack] IndexedDB open failure", error.message);
      reject(error);
      return;
    }

    const request = globalThis.indexedDB.open(databaseName, databaseVersion);

    request.onupgradeneeded = (event) => {
      const database = request.result;
      const transaction = request.transaction;
      if (!transaction) throw new Error("ForteStack migration transaction is unavailable.");
      const oldVersion = event.oldVersion;
      for (let version = oldVersion + 1; version <= databaseVersion; version += 1) {
        const migrate = migrations[version];
        if (!migrate) throw new Error(`Missing ForteStack database migration ${version}.`);
        console.info(`[ForteStack] applying database migration ${version}`);
        migrate(database, transaction);
      }
    };

    request.onsuccess = () => {
      console.info("[ForteStack] IndexedDB open success", {
        name: databaseName,
        version: request.result.version,
      });
      request.result.onversionchange = () => { request.result.close(); databasePromise = undefined; };
      resolve(request.result);
    };

    request.onerror = () => {
      const error = request.error ?? new Error("IndexedDB failed to open.");
      console.error("[ForteStack] IndexedDB open failure", getErrorMessage(error));
      databasePromise = undefined;
      reject(error);
    };

    request.onblocked = () => {
      const error = new Error("IndexedDB upgrade is blocked by another open PILLAR BUILDWORKS tab.");
      console.error("[ForteStack] IndexedDB open failure", error.message);
      databasePromise = undefined;
      reject(error);
    };
  });

  return databasePromise;
}

export function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

export async function runMultiStoreTransaction<Names extends readonly StoreName[], T>(
  storeNames: Names,
  mode: IDBTransactionMode,
  action: (stores: Pick<StoreMap, Names[number]>, transaction: IDBTransaction) => Promise<T> | T,
): Promise<T> {
  const database = await openDatabase();
  const transaction = database.transaction([...storeNames], mode);
  const stores = Object.fromEntries(storeNames.map((name) => [name, transaction.objectStore(name)])) as Pick<StoreMap, Names[number]>;
  const completion = new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted."));
  });

  try {
    const result = await action(stores, transaction);
    await completion;
    return result;
  } catch (error) {
    try {
      transaction.abort();
    } catch {
      // The transaction may already have completed or aborted.
    }
    await completion.catch(() => undefined);
    throw error;
  }
}

function runTransaction<T>(
  storeName: StoreName,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  return openDatabase().then(
    (database) =>
      new Promise((resolve, reject) => {
        const transaction = database.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        const request = action(store);
        let result: T | undefined;

        if (request) {
          request.onsuccess = () => {
            result = request.result;
          };
          request.onerror = () => {
            console.error(
              "[ForteStack] IndexedDB request failure",
              storeName,
              getErrorMessage(request.error),
            );
            reject(request.error);
          };
        }

        transaction.oncomplete = () => resolve(result);
        transaction.onerror = () => {
          console.error(
            "[ForteStack] IndexedDB transaction failure",
            storeName,
            getErrorMessage(transaction.error),
          );
          reject(transaction.error);
        };
        transaction.onabort = () => {
          console.error(
            "[ForteStack] IndexedDB transaction aborted",
            storeName,
            getErrorMessage(transaction.error),
          );
          reject(transaction.error);
        };
      }),
  );
}

export const db = {
  async getProjects(): Promise<Project[]> {
    const projects = await runTransaction<Project[]>("projects", "readonly", (store) =>
      store.getAll(),
    );

    return (projects ?? []).sort(
      (first, second) =>
        new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime(),
    );
  },

  async putProject(project: Project): Promise<void> {
    try {
      await runTransaction("projects", "readwrite", (store) => store.put(project));
      console.info("[ForteStack] project write success", project.id);
    } catch (error) {
      console.error("[ForteStack] project write failure", getErrorMessage(error));
      throw error;
    }
  },

  async getDrawingsByProject(projectId: string): Promise<Drawing[]> {
    const drawings = await runTransaction<Drawing[]>("drawings", "readonly", (store) =>
      store.index("projectId").getAll(projectId),
    );

    return (drawings ?? []).sort(
      (first, second) =>
        new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime(),
    );
  },

  async getDrawing(drawingId: string): Promise<Drawing | undefined> {
    return runTransaction<Drawing>("drawings", "readonly", (store) => store.get(drawingId));
  },

  async putDrawing(drawing: Drawing): Promise<void> {
    await runTransaction("drawings", "readwrite", (store) => store.put(drawing));
  },

  async putDrawingAndTouchProject(drawing: Drawing): Promise<void> {
    await runMultiStoreTransaction(["drawings", "projects"] as const, "readwrite", async (stores) => {
      stores.drawings.put(drawing);
      const project = await requestResult<Project | undefined>(stores.projects.get(drawing.projectId));
      if (project) stores.projects.put({ ...project, updatedAt: drawing.updatedAt });
    });
  },

  async deleteDrawing(drawingId: string): Promise<void> {
    await runTransaction("drawings", "readwrite", (store) => store.delete(drawingId));
  },

  async deleteDrawingGraph(drawing: Drawing): Promise<void> {
    await runMultiStoreTransaction(
      ["projects", "drawings", "annotations", "referencePoints", "assets", "siteNoteContents", "thumbnails"] as const,
      "readwrite",
      async (stores) => {
        const annotations = await requestResult<StoredAnnotation[]>(stores.annotations.index("drawingId").getAll(drawing.id));
        const referencePoints = await requestResult<ReferencePoint[]>(stores.referencePoints.index("drawingId").getAll(drawing.id));
        const candidateAssetIds = new Set<string>();
        if (drawing.backgroundAssetId) candidateAssetIds.add(drawing.backgroundAssetId);
        for (const annotation of annotations) {
          if (annotation.type === "image") candidateAssetIds.add(annotation.assetId);
          stores.annotations.delete(annotation.id);
        }
        for (const referencePoint of referencePoints) stores.referencePoints.delete(referencePoint.id);
        stores.drawings.delete(drawing.id);

        const remainingDrawings = await requestResult<Drawing[]>(stores.drawings.index("projectId").getAll(drawing.projectId));
        const remainingAnnotations = await requestResult<StoredAnnotation[]>(stores.annotations.getAll());
        const siteNoteContents = await requestResult<SiteNoteContent[]>(stores.siteNoteContents.getAll());
        const projects = await requestResult<Project[]>(stores.projects.getAll());
        for (const item of siteNoteContents) if (item.type === "drawing" && item.drawingId === drawing.id) stores.siteNoteContents.delete(item.id);
        for (const assetId of candidateAssetIds) {
          const usedByDrawing = remainingDrawings.some((item) => item.id !== drawing.id && item.backgroundAssetId === assetId);
          const usedByAnnotation = remainingAnnotations.some((item) => item.type === "image" && item.assetId === assetId && item.drawingId !== drawing.id);
          const usedBySiteNote = siteNoteContents.some((item) => item.type === "photo" && item.assetId === assetId);
          if (!usedByDrawing && !usedByAnnotation && !usedBySiteNote && !projects.some(item => item.projectPhotoAssetId === assetId)) { stores.assets.delete(assetId); stores.thumbnails.delete(assetId); }
        }

        const project = await requestResult<Project | undefined>(stores.projects.get(drawing.projectId));
        if (project) stores.projects.put({ ...project, updatedAt: new Date().toISOString() });
      },
    );
  },

  async getAsset(assetId: string): Promise<Asset | undefined> {
    return runTransaction<Asset>("assets", "readonly", (store) => store.get(assetId));
  },

  async getAssetsByProject(projectId: string): Promise<Asset[]> {
    return (await runTransaction<Asset[]>("assets", "readonly", (store) =>
      store.index("projectId").getAll(projectId),
    )) ?? [];
  },

  async putAsset(asset: Asset): Promise<void> {
    await runTransaction("assets", "readwrite", (store) => store.put(asset));
  },

  async deleteAsset(assetId: string): Promise<void> {
    await runTransaction("assets", "readwrite", (store) => store.delete(assetId));
  },

  async getAssetReferences(assetId: string, projectId: string): Promise<{ drawingIds: string[]; annotationIds: string[]; siteNoteContentIds: string[]; projectIds: string[] }> {
    return runMultiStoreTransaction(["projects", "drawings", "annotations", "siteNoteContents"] as const, "readonly", async (stores) => {
      const drawings = await requestResult<Drawing[]>(stores.drawings.index("projectId").getAll(projectId));
      const annotations = await requestResult<StoredAnnotation[]>(stores.annotations.getAll());
      const contents = await requestResult<SiteNoteContent[]>(stores.siteNoteContents.getAll());
      const projects = await requestResult<Project[]>(stores.projects.getAll());
      return {
        projectIds: projects.filter(item => item.projectPhotoAssetId === assetId).map(item => item.id),
        drawingIds: drawings.filter((drawing) => drawing.backgroundAssetId === assetId).map((drawing) => drawing.id),
        annotationIds: annotations.filter((item) => item.type === "image" && item.assetId === assetId).map((item) => item.id),
        siteNoteContentIds: contents.filter((item) => item.type === "photo" && item.assetId === assetId).map((item) => item.id),
      };
    });
  },

  async deleteAssetIfUnreferenced(asset: Asset): Promise<boolean> {
    return runMultiStoreTransaction(["projects", "assets", "drawings", "annotations", "siteNoteContents", "thumbnails"] as const, "readwrite", async (stores) => {
      const drawings = await requestResult<Drawing[]>(stores.drawings.index("projectId").getAll(asset.projectId));
      const annotations = await requestResult<StoredAnnotation[]>(stores.annotations.getAll());
      const contents = await requestResult<SiteNoteContent[]>(stores.siteNoteContents.getAll());
      const projects = await requestResult<Project[]>(stores.projects.getAll());
      const isReferenced = projects.some(item => item.projectPhotoAssetId === asset.id) || drawings.some((drawing) => drawing.backgroundAssetId === asset.id)
        || annotations.some((item) => item.type === "image" && item.assetId === asset.id)
        || contents.some((item) => item.type === "photo" && item.assetId === asset.id);
      if (isReferenced) return false;
      stores.assets.delete(asset.id); stores.thumbnails.delete(asset.id);
      return true;
    });
  },

  async getAnnotationsByDrawing(drawingId: string): Promise<StoredAnnotation[]> {
    const annotations = await runTransaction<StoredAnnotation[]>("annotations", "readonly", (store) =>
      store.index("drawingId").getAll(drawingId),
    );

    return annotations ?? [];
  },

  async putAnnotation(annotation: Annotation): Promise<void> {
    await runTransaction("annotations", "readwrite", (store) => store.put(annotation));
  },

  async putAnnotationAndTouchParents(annotation: Annotation): Promise<void> {
    await runMultiStoreTransaction(["annotations", "drawings", "projects"] as const, "readwrite", async (stores) => {
      stores.annotations.put(annotation);
      const drawing = await requestResult<Drawing | undefined>(stores.drawings.get(annotation.drawingId));
      if (!drawing) return;
      const updatedDrawing = { ...drawing, updatedAt: annotation.updatedAt };
      stores.drawings.put(updatedDrawing);
      const project = await requestResult<Project | undefined>(stores.projects.get(drawing.projectId));
      if (project) stores.projects.put({ ...project, updatedAt: annotation.updatedAt });
    });
  },

  async deleteAnnotation(annotationId: string): Promise<void> {
    await runTransaction("annotations", "readwrite", (store) => store.delete(annotationId));
  },

  async deleteAnnotationAndCleanup(annotationId: string): Promise<void> {
    await runMultiStoreTransaction(
      ["annotations", "drawings", "projects", "assets", "siteNoteContents", "thumbnails"] as const,
      "readwrite",
      async (stores) => {
        const annotation = await requestResult<StoredAnnotation | undefined>(stores.annotations.get(annotationId));
        if (!annotation) return;
        stores.annotations.delete(annotationId);
        const timestamp = new Date().toISOString();
        const drawing = await requestResult<Drawing | undefined>(stores.drawings.get(annotation.drawingId));
        if (drawing) {
          stores.drawings.put({ ...drawing, updatedAt: timestamp });
          const project = await requestResult<Project | undefined>(stores.projects.get(drawing.projectId));
          if (project) stores.projects.put({ ...project, updatedAt: timestamp });
        }
        if (annotation.type === "image") {
          const remaining = await requestResult<StoredAnnotation[]>(stores.annotations.getAll());
          const drawings = await requestResult<Drawing[]>(stores.drawings.getAll());
          const siteNoteContents = await requestResult<SiteNoteContent[]>(stores.siteNoteContents.getAll());
          const projects = await requestResult<Project[]>(stores.projects.getAll());
          const stillReferenced = projects.some(item => item.projectPhotoAssetId === annotation.assetId) || remaining.some((item) => item.id !== annotationId && item.type === "image" && item.assetId === annotation.assetId)
            || drawings.some((item) => item.backgroundAssetId === annotation.assetId)
            || siteNoteContents.some((item) => item.type === "photo" && item.assetId === annotation.assetId);
          if (!stillReferenced) { stores.assets.delete(annotation.assetId); stores.thumbnails.delete(annotation.assetId); }
        }
      },
    );
  },

  async getReferencePointsByDrawing(drawingId: string): Promise<ReferencePoint[]> {
    const referencePoints = await runTransaction<ReferencePoint[]>(
      "referencePoints",
      "readonly",
      (store) => store.index("drawingId").getAll(drawingId),
    );

    return referencePoints ?? [];
  },

  async putReferencePoint(referencePoint: ReferencePoint): Promise<void> {
    await runTransaction("referencePoints", "readwrite", (store) => store.put(referencePoint));
  },

  async deleteReferencePoint(referencePointId: string): Promise<void> {
    await runTransaction("referencePoints", "readwrite", (store) => store.delete(referencePointId));
  },
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return String(error);
}
