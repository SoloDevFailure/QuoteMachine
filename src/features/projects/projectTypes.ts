export type ProjectStatus = "draft" | "inProgress" | "complete";

export type Project = {
  id: string;
  name: string;
  clientName?: string;
  siteAddress?: string;
  projectPhotoAssetId?: string;
  clientContactId?: string;
  clientPhone?: string;
  clientEmail?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
  reference?: string;
  jobNotes?: string;
  clientCompany?: string;
  clientAlternatePhone?: string;
  billingAddress?: string;
  clientNotes?: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
};

export type ProjectInput = Omit<Project, "id" | "createdAt" | "updatedAt">;
