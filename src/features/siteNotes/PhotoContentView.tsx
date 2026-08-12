import { Expand, ImageOff } from "lucide-react";
import { useEffect, useState } from "react";
import { getAsset } from "../assets/assetStore";

export function PhotoContentView({ assetId, onOpen }: { assetId: string; onOpen: (url: string) => void }) {
  const [url, setUrl] = useState<string>();
  const [missing, setMissing] = useState(false);
  useEffect(() => { let objectUrl: string | undefined, cancelled = false; getAsset(assetId).then((asset) => { if (cancelled) return; if (!asset) { setMissing(true); return; } objectUrl = URL.createObjectURL(asset.blob); setUrl(objectUrl); }); return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); }; }, [assetId]);
  if (missing) return <div className="site-photo site-photo--missing"><ImageOff/><span>Photo unavailable</span></div>;
  if (!url) return <div className="site-photo site-photo--loading" aria-label="Loading photo"/>;
  return <button className="site-photo" type="button" onClick={() => onOpen(url)}><img src={url} alt="Site note" loading="lazy"/><span><Expand size={19}/></span></button>;
}
