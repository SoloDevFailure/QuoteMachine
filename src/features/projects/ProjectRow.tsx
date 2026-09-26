import { ChevronRight } from "lucide-react";
import { ProjectPhoto } from "./ProjectPhoto";
import { StatusPill } from "../../components/StatusPill";
import { projectLocation } from "./projectLabels";
import type { Project } from "./projectTypes";
export function ProjectRow({ project, onOpen }: { project: Project; onOpen: () => void }) {
  return <button type="button" className="job-row" onClick={onOpen}><div className="job-row__photo"><ProjectPhoto assetId={project.projectPhotoAssetId} alt=""/></div><div className="job-row__main"><strong>{project.name}</strong><span>{project.clientName || "Client not added"}</span><small>{projectLocation(project)}</small><StatusPill status={project.status}/></div><div className="job-row__meta">{project.reference ? <strong>{project.reference}</strong> : null}<span>Updated</span><time>{new Intl.DateTimeFormat(undefined,{day:"numeric",month:"short"}).format(new Date(project.updatedAt))}</time></div><ChevronRight size={18}/></button>;
}
