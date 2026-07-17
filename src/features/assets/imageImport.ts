import { createId } from "../../utils/ids";
import type { Asset } from "./assetTypes";

export async function createImageAsset(projectId: string, file: File): Promise<Asset> {
  const dimensions = await readImageDimensions(file);

  return {
    id: createId(),
    projectId,
    type: "image",
    mimeType: file.type || "image/jpeg",
    blob: file,
    width: dimensions.width,
    height: dimensions.height,
    createdAt: new Date().toISOString(),
  };
}

function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("The selected image could not be read."));
    };

    image.src = url;
  });
}
