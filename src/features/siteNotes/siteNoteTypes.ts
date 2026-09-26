export type SiteNoteStatus = "draft" | "active" | "readyForQuote";

export type SiteNote = {
  id: string;
  projectId: string;
  title: string;
  status: SiteNoteStatus;
  createdAt: string;
  updatedAt: string;
};

export type SiteNoteSection = {
  id: string;
  siteNoteId: string;
  title: string;
  order: number;
  collapsed: boolean;
  createdAt: string;
  updatedAt: string;
};

type BaseContent = {
  id: string;
  sectionId: string;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export type TextContent = BaseContent & { type: "text"; text: string };
export type PhotoContent = BaseContent & { type: "photo"; assetId: string; caption?: string };
export type DrawingContent = BaseContent & { type: "drawing"; drawingId: string; caption?: string };
export type SiteNoteContent = TextContent | PhotoContent | DrawingContent;

export type SiteNoteDocument = {
  note: SiteNote;
  sections: SiteNoteSection[];
  contents: SiteNoteContent[];
};
