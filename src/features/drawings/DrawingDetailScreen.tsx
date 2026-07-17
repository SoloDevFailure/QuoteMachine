import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { IconButton } from "../../components/IconButton";
import { getAsset } from "../assets/assetStore";
import type { Asset } from "../assets/assetTypes";
import type { Project } from "../projects/projectTypes";
import { getDrawing } from "./drawingStore";
import type { Drawing } from "./drawingTypes";
import { DrawingWorkspace } from "./workspace/DrawingWorkspace";

type DrawingDetailScreenProps = {
  project: Project;
  drawingId: string;
  onBack: () => void;
};

export function DrawingDetailScreen({ project, drawingId, onBack }: DrawingDetailScreenProps) {
  const [drawing, setDrawing] = useState<Drawing>();
  const [asset, setAsset] = useState<Asset>();
  const [assetUrl, setAssetUrl] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let nextAssetUrl: string | undefined;

    async function loadDrawing() {
      setIsLoading(true);
      const loadedDrawing = await getDrawing(drawingId);
      if (!isMounted) return;

      setDrawing(loadedDrawing);

      if (loadedDrawing?.backgroundAssetId) {
        const loadedAsset = await getAsset(loadedDrawing.backgroundAssetId);
        if (!isMounted) return;

        setAsset(loadedAsset);
        if (loadedAsset) {
          nextAssetUrl = URL.createObjectURL(loadedAsset.blob);
          setAssetUrl(nextAssetUrl);
        }
      }

      setIsLoading(false);
    }

    loadDrawing();

    return () => {
      isMounted = false;
      if (nextAssetUrl) URL.revokeObjectURL(nextAssetUrl);
    };
  }, [drawingId]);

  if (isLoading) {
    return (
      <main className="app-shell app-shell--centered">
        <p className="muted-text">Opening drawing</p>
      </main>
    );
  }

  if (!drawing) {
    return (
      <main className="app-shell">
        <header className="dashboard-header">
          <IconButton icon={<ArrowLeft size={22} />} label="Back to drawings" onClick={onBack} />
        </header>
        <section className="empty-state">
          <h2>Drawing not found</h2>
          <p>This drawing is no longer available in the local workspace.</p>
        </section>
      </main>
    );
  }

  return (
    <DrawingWorkspace
      project={project}
      drawing={drawing}
      asset={asset}
      assetUrl={assetUrl}
      onBack={onBack}
    />
  );
}
