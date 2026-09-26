import type { Project } from "./projectTypes";
export const projectLocation = (p: Project) => [p.suburb, p.state, p.postcode].filter(Boolean).join(" ") || p.siteAddress || "Address not added";
export const fullSiteAddress = (p: Project) => [p.siteAddress, [p.suburb, p.state, p.postcode].filter(Boolean).join(" ")].filter(Boolean).join(", ");
export const projectStatusLabel = (p: Project) => p.status === "complete" ? "Completed" : p.status === "inProgress" ? "Active" : "Draft";
