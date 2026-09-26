import { db, requestResult, runMultiStoreTransaction } from "../../storage/db";
export type Thumbnail = { id: string; blob: Blob; width: number; height: number; version: 1 };
const inflight = new Map<string, Promise<Thumbnail | undefined>>();
export function thumbnailSize(width: number, height: number, max = 192) {
  const ratio = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}
export function getThumbnail(id: string): Promise<Thumbnail | undefined> {
  const existing = inflight.get(id); if (existing) return existing;
  const request = loadThumbnail(id).finally(() => inflight.delete(id)); inflight.set(id, request); return request;
}
async function loadThumbnail(id: string): Promise<Thumbnail | undefined> {
  const cached = await runMultiStoreTransaction(["thumbnails"] as const, "readonly", s => requestResult<Thumbnail | undefined>(s.thumbnails.get(id)));
  if (cached?.version === 1) return cached;
  const asset = await db.getAsset(id); if (!asset) return undefined;
  const url = URL.createObjectURL(asset.blob);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("This image cannot be previewed.")); image.src = url; });
    const size = thumbnailSize(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement("canvas"); canvas.width = size.width; canvas.height = size.height;
    const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Image preview unavailable.");
    ctx.drawImage(image, 0, 0, size.width, size.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Unable to create preview.")), "image/webp", .76));
    const thumb: Thumbnail = { id, blob, ...size, version: 1 };
    await runMultiStoreTransaction(["assets", "thumbnails"] as const, "readwrite", async s => {
      if (await requestResult(s.assets.getKey(id))) s.thumbnails.put(thumb);
    });
    return thumb;
  } finally { URL.revokeObjectURL(url); }
}
