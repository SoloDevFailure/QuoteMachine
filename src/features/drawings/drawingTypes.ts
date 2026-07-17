export type DrawingBackgroundType = "blank" | "photo";

export type DrawingLayer = { id: string; name: string; visible: boolean; order: number };

export type DrawingBackgroundPlacement = {
  originX: number;
  originY: number;
  width: number;
  height: number;
};

export type DrawingScale = {
  mmPerWorldUnit: number;
  calibratedFrom?: {
    type: "room" | "dimension";
    id: string;
  };
  calibratedAt: string;
};

export type Drawing = {
  id: string;
  projectId: string;
  name: string;
  backgroundType: DrawingBackgroundType;
  backgroundAssetId?: string;
  backgroundPlacement?: DrawingBackgroundPlacement;
  viewportHint: {
    centerX: number;
    centerY: number;
    scale: number;
  };
  snapSettings?: SnapSettings;
  scale?: DrawingScale;
  layers?: DrawingLayer[];
  activeLayerId?: string;
  createdAt: string;
  updatedAt: string;
};

export type DrawingInput = {
  name: string;
  backgroundType?: DrawingBackgroundType;
  backgroundAssetId?: string;
  backgroundPlacement?: DrawingBackgroundPlacement;
};

export type SnapSettings = {
  snapToGrid: boolean;
  snapToExistingPoints: boolean;
  snapToReferencePoints: boolean;
};
