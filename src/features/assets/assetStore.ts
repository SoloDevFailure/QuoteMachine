import { db } from "../../storage/db";
import type { Asset } from "./assetTypes";

export async function getAsset(assetId: string) {
  return db.getAsset(assetId);
}

export async function saveAsset(asset: Asset) {
  await db.putAsset(asset);
}

export async function getProjectAssets(projectId: string) {
  return db.getAssetsByProject(projectId);
}

export async function getAssetReferences(asset: Asset) {
  return db.getAssetReferences(asset.id, asset.projectId);
}

/** Assets are project-owned and may be shared by any project feature. */
export async function deleteAssetIfUnreferenced(asset: Asset) {
  return db.deleteAssetIfUnreferenced(asset);
}
