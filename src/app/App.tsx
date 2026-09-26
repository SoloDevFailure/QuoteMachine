import { useEffect, useState } from "react";
import { useGlobalKeyboardVisibility } from "../components/useGlobalKeyboardVisibility";
import { BottomSheet } from "../components/BottomSheet";
import { Brand } from "../components/Brand";
import { DrawingDetailScreen } from "../features/drawings/DrawingDetailScreen";
import { createDrawing } from "../features/drawings/drawingStore";
import { HomeScreen } from "../features/home/HomeScreen";
import { ProjectListScreen } from "../features/projects/ProjectListScreen";
import { ProjectInfoSheet } from "../features/projects/ProjectInfoSheet";
import { getProjects } from "../features/projects/projectStore";
import type { Project } from "../features/projects/projectTypes";
import { SiteNoteScreen } from "../features/siteNotes/SiteNoteScreen";
import { createSiteNoteForProject, getSiteNotesByProject, touchSiteNote } from "../features/siteNotes/siteNoteStore";
import { flushPendingSaves, pendingSaveCount } from "../storage/pendingSaves";
import { drawingRoute, homeRoute, parseStoredRoute, projectsRoute, siteNoteRoute, type Route } from "./routes";

const activeRouteStorageKey = "fortestack.activeRoute";
export function App() {
  useGlobalKeyboardVisibility();
  const [route,setRoute] = useState<Route>(readActiveRoute), [projects,setProjects] = useState<Project[]>([]);
  const [loading,setLoading] = useState(true), [error,setError] = useState<string>(), [newJob,setNewJob] = useState(false), [quickDraw,setQuickDraw] = useState(false), [busy,setBusy] = useState(false);
  const activeProject = "projectId" in route ? projects.find(p => p.id === route.projectId) : undefined;
  async function refreshProjects() { setProjects(await getProjects()); }
  useEffect(() => { refreshProjects().catch(e => setError(String(e))).finally(() => setLoading(false)); }, []);
  useEffect(() => { try { localStorage.setItem(activeRouteStorageKey,JSON.stringify(route)); } catch {} }, [route]);
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => { if (pendingSaveCount()) { void flushPendingSaves().catch(() => undefined); event.preventDefault(); event.returnValue = ""; } };
    const hide = () => { if (document.visibilityState === "hidden") void flushPendingSaves().catch(e => setError(String(e))); };
    window.addEventListener("beforeunload",unload); document.addEventListener("visibilitychange",hide);
    return () => { window.removeEventListener("beforeunload",unload); document.removeEventListener("visibilitychange",hide); };
  }, []);
  async function act(action: () => Promise<void> | void) {
    if (busy) return; setBusy(true); setError(undefined);
    try { await flushPendingSaves(); await action(); } catch(e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  async function openProject(project: Project) {
    const note = (await getSiteNotesByProject(project.id))[0] ?? (await createSiteNoteForProject(project)).note;
    await refreshProjects(); setRoute(siteNoteRoute(project.id,note.id));
  }
  useEffect(() => {
    if (loading || error) return;
    if ("projectId" in route && !activeProject) setRoute(homeRoute());
    else if (activeProject && (route.name === "project" || route.name === "drawings")) void act(() => openProject(activeProject));
    else if (["business","profile","settings","siteNotesComingSoon"].includes(route.name)) setRoute(homeRoute());
  }, [route.name, activeProject?.id, loading]);
  function openProjectId(id: string) { const project = projects.find(p => p.id === id); if (project) void act(() => openProject(project)); }
  async function startDrawing(project: Project) {
    const note = (await getSiteNotesByProject(project.id))[0] ?? (await createSiteNoteForProject(project)).note;
    const drawing = await createDrawing(project.id,{ name:"Untitled sketch", backgroundType:"blank" });
    await refreshProjects(); setQuickDraw(false); setRoute(drawingRoute(project.id,drawing.id,{siteNoteId:note.id,sectionId:""}));
  }
  let screen;
  if (loading) screen = <main className="pillar-loading"><Brand/><p>Opening local workspace…</p></main>;
  else if (route.name === "siteNote" && activeProject) screen = <SiteNoteScreen key={route.siteNoteId} project={activeProject} siteNoteId={route.siteNoteId} focusSectionId={route.focusSectionId} onBack={() => act(async () => { await refreshProjects(); setRoute(projectsRoute()); })} onProjectChanged={refreshProjects} onSelectNote={id => setRoute(siteNoteRoute(activeProject.id,id))} onOpenDrawing={(id,sectionId) => act(() => { setRoute(drawingRoute(activeProject.id,id,{siteNoteId:route.siteNoteId,sectionId})); })}/>;
  else if (route.name === "drawing" && activeProject) screen = <DrawingDetailScreen key={route.drawingId} project={activeProject} drawingId={route.drawingId} onBack={() => act(async () => { if (route.returnToSiteNoteId) { await touchSiteNote(route.returnToSiteNoteId); await refreshProjects(); setRoute(siteNoteRoute(activeProject.id,route.returnToSiteNoteId,route.returnToSectionId)); } else await openProject(activeProject); })}/>;
  else if (route.name === "projects") screen = <ProjectListScreen projects={projects} onBack={() => setRoute(homeRoute())} onNewJob={() => setNewJob(true)} onOpenProject={openProjectId}/>;
  else screen = <HomeScreen projects={projects} onNewJob={() => setNewJob(true)} onQuickDraw={() => setQuickDraw(true)} onOpenProjects={() => setRoute(projectsRoute())} onOpenProject={openProjectId}/>;
  return <>{screen}{error ? <div className="app-error" role="alert"><strong>Could not complete that action.</strong><span>{error}</span><button onClick={() => act(refreshProjects)}>Retry</button><button onClick={() => setError(undefined)}>Dismiss</button></div> : null}
    <ProjectInfoSheet isOpen={newJob} onDismiss={() => setNewJob(false)} onSaved={async project => { await refreshProjects(); if (quickDraw) await startDrawing(project); else await openProject(project); }}/>
    <BottomSheet title="Quick Draw · choose a job" isOpen={quickDraw && !newJob} onDismiss={() => setQuickDraw(false)}><p className="form-intro">Your sketch will be saved in the job you choose.</p><div className="action-list">{projects.map(p => <button className="action-row" key={p.id} disabled={busy} onClick={() => act(() => startDrawing(p))}><span><strong>{p.name}</strong><small>{p.clientName || p.siteAddress || "Project workspace"}</small></span></button>)}<button className="primary-button" onClick={() => setNewJob(true)}>Create a new job</button></div></BottomSheet>
  </>;
}
function readActiveRoute(): Route { try { return parseStoredRoute(JSON.parse(localStorage.getItem(activeRouteStorageKey) ?? "null")); } catch { return homeRoute(); } }
