export type ProjectStatus = "draft" | "inProgress" | "complete";

export type Project = {
  id: string;
  name: string;
  clientName?: string;
  siteAddress?: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
};

export type ProjectInput = {
  name: string;
  clientName?: string;
  siteAddress?: string;
  status: ProjectStatus;
};
