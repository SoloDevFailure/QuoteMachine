import { useEffect, useMemo, useState } from "react";
import { DrawingDetailScreen } from "../features/drawings/DrawingDetailScreen";
import { DrawingListScreen } from "../features/drawings/DrawingListScreen";
import { createDrawing } from "../features/drawings/drawingStore";
import { HomeScreen } from "../features/home/HomeScreen";
import { PlaceholderScreen } from "../features/home/PlaceholderScreen";
import { ProjectDashboardScreen } from "../features/projects/ProjectDashboardScreen";
import { ProjectListScreen } from "../features/projects/ProjectListScreen";
import { createProject, getProjects } from "../features/projects/projectStore";
import type { Project } from "../features/projects/projectTypes";
import { SiteNoteScreen } from "../features/siteNotes/SiteNoteScreen";
import { createSiteNoteForProject, getSiteNotesByProject, touchSiteNote } from "../features/siteNotes/siteNoteStore";
import {
  businessRoute, drawingRoute, drawingsRoute, homeRoute, parseStoredRoute, profileRoute,
  projectRoute, projectsRoute, settingsRoute, siteNoteRoute, type RootTab, type Route,
} from "./routes";

const activeRouteStorageKey = "fortestack.activeRoute";

export function App() {
  const [route, setRoute] = useState<Route>(readActiveRoute);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const activeProject = useMemo(() => "projectId" in route ? projects.find((project) => project.id === route.projectId) : undefined, [projects, route]);

  async function refreshProjects() { setProjects(await getProjects()); }
  useEffect(() => { refreshProjects().finally(() => setIsLoading(false)); }, []);
  useEffect(() => { try { localStorage.setItem(activeRouteStorageKey, JSON.stringify(route)); } catch { /* Navigation remains in memory. */ } }, [route]);
  useEffect(() => { if ("projectId" in route && !isLoading && !activeProject) setRoute(homeRoute()); }, [activeProject, isLoading, route]);
  useEffect(() => { if (route.name === "siteNotesComingSoon") setRoute(homeRoute()); }, [route.name]);

  function navigateTab(tab: RootTab) {
    setRoute(tab === "home" ? homeRoute() : tab === "business" ? businessRoute() : tab === "profile" ? profileRoute() : settingsRoute());
  }

  async function handleQuickDraw() {
    let project = projects.filter((item) => item.status !== "complete").sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0];
    if (!project) {
      project = await createProject({ name: `Quick Draw · ${new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(new Date())}`, status: "draft" });
      await refreshProjects();
    }
    const drawing = await createDrawing(project.id, { name: `Sketch · ${new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date())}`, backgroundType: "blank" });
    setRoute(drawingRoute(project.id, drawing.id));
  }

  async function handleStartSiteNotes() {
    const label = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(new Date());
    const project = await createProject({ name: `New Job · ${label}`, status: "draft" });
    const siteNote = await createSiteNoteForProject(project);
    await refreshProjects();
    setRoute(siteNoteRoute(project.id, siteNote.note.id, siteNote.sections[0]?.id));
  }

  async function openProjectSiteNotes(project: Project) {
    const existing = (await getSiteNotesByProject(project.id))[0];
    const document = existing ? undefined : await createSiteNoteForProject(project);
    setRoute(siteNoteRoute(project.id, existing?.id ?? document!.note.id, document?.sections[0]?.id));
    await refreshProjects();
  }

  if (isLoading) return <main className="app-shell app-shell--centered"><div className="brand-mark">Forte<span>Stack</span></div></main>;
  if (route.name === "home") return <HomeScreen projects={projects} onStartSiteNotes={handleStartSiteNotes} onQuickDraw={handleQuickDraw} onOpenProjects={() => setRoute(projectsRoute())} onOpenProject={(id) => setRoute(projectRoute(id))} onOpenDrawing={(projectId, drawingId) => setRoute(drawingRoute(projectId, drawingId))} onOpenSiteNote={(projectId, siteNoteId) => setRoute(siteNoteRoute(projectId, siteNoteId))} onNavigateTab={navigateTab}/>;
  if (route.name === "business" || route.name === "profile" || route.name === "settings") return <PlaceholderScreen tab={route.name} onNavigate={navigateTab}/>;
  if (route.name === "siteNotesComingSoon") return null;
  if (route.name === "siteNote" && activeProject) return <SiteNoteScreen project={activeProject} siteNoteId={route.siteNoteId} focusSectionId={route.focusSectionId} onBack={() => setRoute(projectRoute(activeProject.id))} onOpenDrawing={(drawingId, sectionId) => setRoute(drawingRoute(activeProject.id, drawingId, { siteNoteId: route.siteNoteId, sectionId }))}/>;
  if (route.name === "project" && activeProject) return <ProjectDashboardScreen project={activeProject} onBack={() => setRoute(projectsRoute())} onOpenDrawings={() => setRoute(drawingsRoute(activeProject.id))} onOpenSiteNotes={() => openProjectSiteNotes(activeProject)} onProjectChanged={refreshProjects}/>;
  if (route.name === "drawings" && activeProject) return <DrawingListScreen project={activeProject} onBack={() => setRoute(projectRoute(activeProject.id))} onOpenDrawing={(drawingId) => setRoute(drawingRoute(activeProject.id, drawingId))}/>;
  if (route.name === "drawing" && activeProject) return <DrawingDetailScreen project={activeProject} drawingId={route.drawingId} onBack={async () => { if (route.returnToSiteNoteId) { await touchSiteNote(route.returnToSiteNoteId); await refreshProjects(); setRoute(siteNoteRoute(activeProject.id, route.returnToSiteNoteId, route.returnToSectionId)); } else setRoute(drawingsRoute(activeProject.id)); }}/>; 
  return <ProjectListScreen projects={projects} onBack={() => setRoute(homeRoute())} onProjectsChanged={refreshProjects} onOpenProject={(id) => setRoute(projectRoute(id))}/>;
}

function readActiveRoute(): Route {
  try { return parseStoredRoute(JSON.parse(localStorage.getItem(activeRouteStorageKey) ?? "null")); }
  catch { return homeRoute(); }
}
