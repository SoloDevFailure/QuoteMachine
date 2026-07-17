import {
  ArrowLeft,
  ChevronRight,
  Layers3,
  MoreHorizontal,
  Pencil,
} from "lucide-react";
import { useEffect, useState } from "react";
import { AppVersionStamp } from "../../components/AppVersionStamp";
import { IconButton } from "../../components/IconButton";
import { StatusPill } from "../../components/StatusPill";
import { getProjectDrawings } from "../drawings/drawingStore";
import { updateProject } from "./projectStore";
import type { Project, ProjectInput } from "./projectTypes";
import { ProjectFormSheet } from "./ProjectFormSheet";

type ProjectDashboardScreenProps = {
  project: Project;
  onBack: () => void;
  onOpenDrawings: () => void;
  onProjectChanged: () => Promise<void>;
};

export function ProjectDashboardScreen({
  project,
  onBack,
  onOpenDrawings,
  onProjectChanged,
}: ProjectDashboardScreenProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [drawingCount, setDrawingCount] = useState(0);

  useEffect(() => {
    getProjectDrawings(project.id).then((drawings) => setDrawingCount(drawings.length));
  }, [project.id]);

  async function handleUpdateProject(input: ProjectInput) {
    await updateProject(project, input);
    await onProjectChanged();
  }

  return (
    <main className="app-shell project-dashboard">
      <header className="dashboard-header">
        <IconButton icon={<ArrowLeft size={22} />} label="Back to projects" onClick={onBack} />
        <IconButton icon={<MoreHorizontal size={22} />} label="Project options" />
      </header>

      <section className="project-hero">
        <div>
          <p className="app-header__eyebrow">Project</p>
          <h1>{project.name}</h1>
          <div className="project-hero__meta">
            <StatusPill status={project.status} />
            <span>{formatUpdated(project.updatedAt)}</span>
          </div>
        </div>
        <IconButton
          icon={<Pencil size={20} />}
          label="Edit project"
          variant="primary"
          onClick={() => setIsEditOpen(true)}
        />
      </section>

      {project.clientName || project.siteAddress ? (
        <section className="project-detail-strip">
          {project.clientName ? <span>{project.clientName}</span> : null}
          {project.siteAddress ? <span>{project.siteAddress}</span> : null}
        </section>
      ) : null}

      <section className="dashboard-grid" aria-label="Project workspace">
        <button className="dashboard-tile" type="button" onClick={onOpenDrawings}>
          <span className="dashboard-tile__icon">
            <Layers3 size={22} />
          </span>
          <span>
            <strong>Drawings</strong>
            <small>
              {drawingCount === 0
                ? "Create a blank or photo-backed drawing"
                : `${drawingCount} drawing${drawingCount === 1 ? "" : "s"}`}
            </small>
          </span>
          <ChevronRight size={18} />
        </button>
      </section>

      <ProjectFormSheet
        project={project}
        isOpen={isEditOpen}
        onDismiss={() => setIsEditOpen(false)}
        onSubmit={handleUpdateProject}
      />

      <AppVersionStamp />
    </main>
  );
}

function formatUpdated(value: string) {
  return `Updated ${new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
  }).format(new Date(value))}`;
}
