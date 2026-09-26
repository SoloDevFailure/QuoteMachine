import { visibleDrawingAnnotations } from "./visibleAnnotations";
import { useEffect, useMemo, useRef, useState } from "react";
import { getDrawingAnnotations } from "../../annotations/annotationStore";
import type { Annotation, ImageAnnotation } from "../../annotations/annotationTypes";
import { getAsset } from "../../assets/assetStore";
import type { Asset } from "../../assets/assetTypes";
import { getDrawing } from "../drawingStore";
import type { Drawing } from "../drawingTypes";
import { AnnotationSvgLayer } from "../workspace/AnnotationSvgLayer";
import { BackgroundLayer } from "../workspace/BackgroundLayer";
import { getDrawingBounds } from "./drawingBounds";

type DrawingPreviewProps = {
  drawing?: Drawing;
  drawingId?: string;
  className?: string;
  label?: string;
};

export function DrawingPreview({ drawing: suppliedDrawing, drawingId, className = "", label = "Drawing preview" }: DrawingPreviewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [drawing, setDrawing] = useState(suppliedDrawing);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [size, setSize] = useState({ width: 320, height: 200 });
  const [asset, setAsset] = useState<Asset>();
  const [assetUrl, setAssetUrl] = useState<string>();
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [isMissing, setIsMissing] = useState(false);

  useEffect(() => setDrawing(suppliedDrawing), [suppliedDrawing]);
  useEffect(() => {
    if (suppliedDrawing || !drawingId) return;
    let cancelled = false;
    getDrawing(drawingId).then((loaded) => {
      if (cancelled) return;
      setDrawing(loaded);
      setIsMissing(!loaded);
    });
    return () => { cancelled = true; };
  }, [drawingId, suppliedDrawing]);

  useEffect(() => {
    if (!drawing) return;
    let cancelled = false;
    getDrawingAnnotations(drawing.id).then((items) => { if (!cancelled) setAnnotations(visibleDrawingAnnotations(drawing, items)); });
    return () => { cancelled = true; };
  }, [drawing]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const update = () => setSize({ width: Math.max(1, host.clientWidth), height: Math.max(1, host.clientHeight) });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!drawing?.backgroundAssetId) { setAsset(undefined); setAssetUrl(undefined); return; }
    let url: string | undefined;
    let cancelled = false;
    getAsset(drawing.backgroundAssetId).then((loaded) => {
      if (cancelled || !loaded) return;
      url = URL.createObjectURL(loaded.blob);
      setAsset(loaded);
      setAssetUrl(url);
    });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [drawing?.backgroundAssetId]);

  useEffect(() => {
    const urls: string[] = [];
    let cancelled = false;
    const ids = [...new Set(annotations.filter((item): item is ImageAnnotation => item.type === "image").map((item) => item.assetId))];
    Promise.all(ids.map(async (id) => {
      const loaded = await getAsset(id);
      if (!loaded) return undefined;
      const url = URL.createObjectURL(loaded.blob);
      urls.push(url);
      return [id, url] as const;
    })).then((entries) => { if (!cancelled) setImageUrls(Object.fromEntries(entries.filter(Boolean) as Array<readonly [string, string]>)); });
    return () => { cancelled = true; urls.forEach(URL.revokeObjectURL); };
  }, [annotations]);

  const transform = useMemo(() => {
    if (!drawing) return { scale: 1, translateX: size.width / 2, translateY: size.height / 2 };
    const bounds = getDrawingBounds(drawing, annotations);
    const width = Math.max(1, bounds.maxX - bounds.minX);
    const height = Math.max(1, bounds.maxY - bounds.minY);
    const padding = Math.min(18, size.width * 0.12);
    const scale = Math.min((size.width - padding * 2) / width, (size.height - padding * 2) / height);
    return {
      scale: Math.max(0.01, scale),
      translateX: size.width / 2 - ((bounds.minX + bounds.maxX) / 2) * scale,
      translateY: size.height / 2 - ((bounds.minY + bounds.maxY) / 2) * scale,
    };
  }, [annotations, drawing, size]);

  if (isMissing) return <div className={`drawing-preview drawing-preview--missing ${className}`.trim()}>Drawing unavailable</div>;

  return (
    <div ref={hostRef} className={`drawing-preview ${className}`.trim()} role="img" aria-label={label}>
      {drawing ? (
        <>
          <div className="drawing-preview__world" style={{ transform: `translate(${transform.translateX}px, ${transform.translateY}px) scale(${transform.scale})` }}>
            <BackgroundLayer drawing={drawing} asset={asset} assetUrl={assetUrl} />
          </div>
          <AnnotationSvgLayer annotations={annotations} selection={{}} mmPerWorldUnit={drawing.scale?.mmPerWorldUnit ?? 1} transform={transform} viewport={size} annotationScaleMultiplier={Math.min(1, size.width / 600)} imageUrls={imageUrls} onEditAnnotation={() => undefined} onSelectAnnotation={() => undefined} />
        </>
      ) : <span className="drawing-preview__loading">Loading preview…</span>}
    </div>
  );
}
