export type Asset = {
  id: string;
  projectId: string;
  type: "image";
  mimeType: string;
  blob: Blob;
  width: number;
  height: number;
  createdAt: string;
};
