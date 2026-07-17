import type { Asset } from "../../assets/assetTypes";
import type { Drawing } from "../drawingTypes";

type BackgroundLayerProps = {
  drawing: Drawing;
  asset?: Asset;
  assetUrl?: string;
};

export function BackgroundLayer({ drawing, asset, assetUrl }: BackgroundLayerProps) {
  if (drawing.backgroundType !== "photo" || !asset || !assetUrl || !drawing.backgroundPlacement) {
    return null;
  }

  return (
    <img
      className="workspace-photo-background"
      src={assetUrl}
      alt=""
      draggable={false}
      style={{
        left: drawing.backgroundPlacement.originX,
        top: drawing.backgroundPlacement.originY,
        width: drawing.backgroundPlacement.width,
        height: drawing.backgroundPlacement.height,
      }}
    />
  );
}
