import { useEffect, useState } from "react";
import { BottomSheet } from "../../components/BottomSheet";
import { getAsset } from "./assetStore";
export function PhotoViewer({ assetId, onClose }: { assetId?: string; onClose: () => void }) {
  const [url, setUrl] = useState<string>(); const [error, setError] = useState<string>();
  useEffect(() => {
    let cancelled = false, objectUrl: string | undefined; setUrl(undefined); setError(undefined);
    if (assetId) getAsset(assetId).then(asset => { if (cancelled) return; if (!asset) { setError("Original photo unavailable."); return; } objectUrl = URL.createObjectURL(asset.blob); setUrl(objectUrl); }).catch(reason => setError(String(reason)));
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [assetId]);
  return <BottomSheet title="Original photo" isOpen={Boolean(assetId)} placement="center" onDismiss={onClose}><div className="original-photo-view">{url ? <img src={url} alt="Full resolution site photo"/> : <p>{error ?? "Loading original…"}</p>}</div></BottomSheet>;
}
