import { ImageOff, FolderKanban } from "lucide-react";
import { useEffect, useState } from "react";
import { getThumbnail } from "./thumbnails";
export function ThumbnailImage({ assetId, alt = "" }: { assetId?: string; alt?: string }) {
  const [url, setUrl] = useState<string>(); const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false, objectUrl: string | undefined; setUrl(undefined); setFailed(false);
    if (assetId) getThumbnail(assetId).then(thumb => { if (cancelled) return; if (!thumb) { setFailed(true); return; } objectUrl = URL.createObjectURL(thumb.blob); setUrl(objectUrl); }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [assetId]);
  return url ? <img className="project-photo-thumb" src={url} alt={alt} loading="lazy"/> : failed ? <ImageOff aria-label="Image unavailable"/> : <FolderKanban aria-label={assetId ? "Loading image" : "Project"}/>;
}
