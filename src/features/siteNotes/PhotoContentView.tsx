import { ThumbnailImage } from "../assets/ThumbnailImage";
export function PhotoContentView({ assetId, onOpen }: { assetId: string; onOpen: (assetId: string) => void }) {
  return <button className="site-photo" type="button" aria-label="Enlarge photo" onClick={() => onOpen(assetId)}><ThumbnailImage assetId={assetId} alt="Site photo"/></button>;
}
