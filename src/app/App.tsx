import { useEffect, useMemo, useState } from "react";
import { DrawingDetailScreen } from "../features/drawings/DrawingDetailScreen";
import { DrawingListScreen } from "../features/drawings/DrawingListScreen";
import { ProjectDashboardScreen } from "../features/projects/ProjectDashboardScreen";
import { ProjectListScreen } from "../features/projects/ProjectListScreen";
import { getProjects } from "../features/projects/projectStore";
import type { Project } from "../features/projects/projectTypes";
import { drawingRoute, drawingsRoute, projectRoute, projectsRoute, type Route } from "./routes";

const activeRouteStorageKey = "fortestack.activeRoute";

export function App() {
  const [route, setRoute] = useState<Route>(readActiveRoute);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const activeProject = useMemo(() => {
    if (route.name === "projects") return undefined;
    return projects.find((project) => project.id === route.projectId);
  }, [projects, route]);

  async function refreshProjects() {
    setProjects(await getProjects());
  }

  useEffect(() => {
    refreshProjects().finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(activeRouteStorageKey, JSON.stringify(route));
    } catch {
      // Storage can be unavailable in private browsing; in-memory routing still works.
    }
  }, [route]);

  useEffect(() => {
    if (route.name !== "projects" && !isLoading && !activeProject) {
      setRoute(projectsRoute());
    }
  }, [activeProject, isLoading, route.name]);

  if (isLoading) {
    return (
      <main className="app-shell app-shell--centered">
        <div className="brand-mark">Forte<span>Stack</span></div>
      </main>
    );
  }

  if (route.name === "project" && activeProject) {
    return (
      <ProjectDashboardScreen
        project={activeProject}
        onBack={() => setRoute(projectsRoute())}
        onOpenDrawings={() => setRoute(drawingsRoute(activeProject.id))}
        onProjectChanged={refreshProjects}
      />
    );
  }

  if (route.name === "drawings" && activeProject) {
    return (
      <DrawingListScreen
        project={activeProject}
        onBack={() => setRoute(projectRoute(activeProject.id))}
        onOpenDrawing={(drawingId) => setRoute(drawingRoute(activeProject.id, drawingId))}
      />
    );
  }

  if (route.name === "drawing" && activeProject) {
    return (
      <DrawingDetailScreen
        project={activeProject}
        drawingId={route.drawingId}
        onBack={() => setRoute(drawingsRoute(activeProject.id))}
      />
    );
  }

  return (
    <ProjectListScreen
      projects={projects}
      onProjectsChanged={refreshProjects}
      onOpenProject={(projectId) => setRoute(projectRoute(projectId))}
    />
  );
}

function readActiveRoute(): Route {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(activeRouteStorageKey) ?? "null");
    if (!value || typeof value !== "object" || !("name" in value)) return projectsRoute();
    const candidate = value as Record<string, unknown>;
    if (candidate.name === "projects") return projectsRoute();
    if (candidate.name === "project" && typeof candidate.projectId === "string") return projectRoute(candidate.projectId);
    if (candidate.name === "drawings" && typeof candidate.projectId === "string") return drawingsRoute(candidate.projectId);
    if (candidate.name === "drawing" && typeof candidate.projectId === "string" && typeof candidate.drawingId === "string") {
      return drawingRoute(candidate.projectId, candidate.drawingId);
    }
  } catch {
    // Ignore malformed or unavailable persisted navigation state.
  }
  return projectsRoute();
}
