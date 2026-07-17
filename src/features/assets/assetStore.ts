import { db } from "../../storage/db";
import type { Asset } from "./assetTypes";

export async function getAsset(assetId: string) {
  return db.getAsset(assetId);
}

export async function saveAsset(asset: Asset) {
  await db.putAsset(asset);
}
