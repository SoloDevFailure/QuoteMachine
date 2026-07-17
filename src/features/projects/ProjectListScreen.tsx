import { FolderKanban, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { AppHeader } from "../../components/AppHeader";
import { AppVersionStamp } from "../../components/AppVersionStamp";
import { EmptyState } from "../../components/EmptyState";
import { IconButton } from "../../components/IconButton";
import { StatusPill } from "../../components/StatusPill";
import { createProject } from "./projectStore";
import type { Project, ProjectInput } from "./projectTypes";
import { ProjectFormSheet } from "./ProjectFormSheet";

type ProjectListScreenProps = {
  projects: Project[];
  onProjectsChanged: () => Promise<void>;
  onOpenProject: (projectId: string) => void;
};

export function ProjectListScreen({
  projects,
  onProjectsChanged,
  onOpenProject,
}: ProjectListScreenProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return projects;

    return projects.filter((project) =>
      [project.name, project.clientName, project.siteAddress]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedQuery)),
    );
  }, [projects, query]);

  async function handleCreateProject(input: ProjectInput) {
    const project = await createProject(input);
    await onProjectsChanged();
    onOpenProject(project.id);
  }

  return (
    <main className="app-shell">
      <AppHeader
        title="Projects"
        eyebrow="ForteStack"
        action={
          <IconButton
            icon={<Plus size={24} />}
            label="Create project"
            variant="primary"
            onClick={() => setIsCreateOpen(true)}
          />
        }
      />

      <section className="search-field">
        <Search size={18} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search projects"
          aria-label="Search projects"
        />
      </section>

      {projects.length === 0 ? (
        <EmptyState
          title="Start with a project"
          body="Create the job workspace first. Drawings, photos and measurements will live inside it."
          action={
            <button className="primary-button" type="button" onClick={() => setIsCreateOpen(true)}>
              New project
            </button>
          }
        />
      ) : (
        <section className="project-list" aria-label="Projects">
          {filteredProjects.map((project) => (
            <button
              className="project-card"
              key={project.id}
              type="button"
              onClick={() => onOpenProject(project.id)}
            >
              <span className="project-card__icon">
                <FolderKanban size={22} />
              </span>
              <span className="project-card__body">
                <strong>{project.name}</strong>
                <span>{project.clientName || project.siteAddress || "Project workspace"}</span>
              </span>
              <StatusPill status={project.status} />
            </button>
          ))}
        </section>
      )}

      <ProjectFormSheet
        isOpen={isCreateOpen}
        onDismiss={() => setIsCreateOpen(false)}
        onSubmit={handleCreateProject}
      />

      <AppVersionStamp />
    </main>
  );
}
