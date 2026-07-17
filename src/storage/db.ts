import type { Project } from "../features/projects/projectTypes";
import type { Annotation, ReferencePoint, StoredAnnotation } from "../features/annotations/annotationTypes";
import type { Asset } from "../features/assets/assetTypes";
import type { Drawing } from "../features/drawings/drawingTypes";

const databaseName = "fortestack";
const databaseVersion = 3;

type StoreName = "projects" | "drawings" | "assets" | "annotations" | "referencePoints";

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

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains("projects")) {
        const store = database.createObjectStore("projects", { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt");
      }

      if (!database.objectStoreNames.contains("drawings")) {
        const store = database.createObjectStore("drawings", { keyPath: "id" });
        store.createIndex("projectId", "projectId");
        store.createIndex("updatedAt", "updatedAt");
      }

      if (!database.objectStoreNames.contains("assets")) {
        const store = database.createObjectStore("assets", { keyPath: "id" });
        store.createIndex("projectId", "projectId");
      }

      if (!database.objectStoreNames.contains("annotations")) {
        const store = database.createObjectStore("annotations", { keyPath: "id" });
        store.createIndex("drawingId", "drawingId");
      }

      if (!database.objectStoreNames.contains("referencePoints")) {
        const store = database.createObjectStore("referencePoints", { keyPath: "id" });
        store.createIndex("drawingId", "drawingId");
      }
    };

    request.onsuccess = () => {
      console.info("[ForteStack] IndexedDB open success", {
        name: databaseName,
        version: request.result.version,
      });
      resolve(request.result);
    };

    request.onerror = () => {
      const error = request.error ?? new Error("IndexedDB failed to open.");
      console.error("[ForteStack] IndexedDB open failure", getErrorMessage(error));
      databasePromise = undefined;
      reject(error);
    };

    request.onblocked = () => {
      const error = new Error("IndexedDB upgrade is blocked by another open ForteStack tab.");
      console.error("[ForteStack] IndexedDB open failure", error.message);
      databasePromise = undefined;
      reject(error);
    };
  });

  return databasePromise;
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

  async deleteDrawing(drawingId: string): Promise<void> {
    await runTransaction("drawings", "readwrite", (store) => store.delete(drawingId));
  },

  async getAsset(assetId: string): Promise<Asset | undefined> {
    return runTransaction<Asset>("assets", "readonly", (store) => store.get(assetId));
  },

  async putAsset(asset: Asset): Promise<void> {
    await runTransaction("assets", "readwrite", (store) => store.put(asset));
  },

  async deleteAsset(assetId: string): Promise<void> {
    await runTransaction("assets", "readwrite", (store) => store.delete(assetId));
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

  async deleteAnnotation(annotationId: string): Promise<void> {
    await runTransaction("annotations", "readwrite", (store) => store.delete(annotationId));
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
