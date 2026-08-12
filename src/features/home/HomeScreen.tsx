import { ChevronRight, ClipboardPenLine, FolderKanban, PencilLine } from "lucide-react";
import { useEffect, useState } from "react";
import { BottomNavigation } from "../../components/BottomNavigation";
import { ResponsivePage } from "../../components/ResponsivePage";
import type { RootTab } from "../../app/routes";
import { defaultBusinessBranding, type BusinessBranding } from "../branding/businessBranding";
import { DrawingPreview } from "../drawings/preview/DrawingPreview";
import type { Project } from "../projects/projectTypes";
import { getRecentItems, type RecentItem } from "./recentItems";

type HomeScreenProps = {
  projects: Project[];
  branding?: BusinessBranding;
  onStartSiteNotes: () => void;
  onQuickDraw: () => void;
  onOpenProjects: () => void;
  onOpenProject: (projectId: string) => void;
  onOpenDrawing: (projectId: string, drawingId: string) => void;
  onOpenSiteNote: (projectId: string, siteNoteId: string) => void;
  onNavigateTab: (tab: RootTab) => void;
};

export function HomeScreen({ projects, branding = defaultBusinessBranding, onStartSiteNotes, onQuickDraw, onOpenProjects, onOpenProject, onOpenDrawing, onOpenSiteNote, onNavigateTab }: HomeScreenProps) {
  const [recent, setRecent] = useState<RecentItem[]>([]);
  useEffect(() => { getRecentItems(projects).then(setRecent); }, [projects]);
  const activeCount = projects.filter((project) => project.status !== "complete").length;

  return <ResponsivePage withNavigation className="home-screen">
    <header className="brand-header">
      <div className="brand-header__logo" aria-hidden="true"><span>F</span></div>
      <h1>{branding.companyName}</h1>
      <div className="brand-header__rule"><span/></div>
      <p>Powered by <strong>ForteStack</strong></p>
    </header>

    <section className="home-actions" aria-label="Quick actions">
      <ActionCard className="home-action--primary" icon={<ClipboardPenLine/>} title="Start Site Notes" subtitle="New job / quote" onClick={onStartSiteNotes}/>
      <div className="home-actions__small">
        <ActionCard icon={<PencilLine/>} title="Quick Draw" subtitle="Start a new sketch" onClick={onQuickDraw}/>
        <ActionCard icon={<FolderKanban/>} title="Current Projects" subtitle={activeCount ? `${activeCount} active job${activeCount === 1 ? "" : "s"}` : "View active jobs"} onClick={onOpenProjects}/>
      </div>
    </section>

    <section className="recent-section">
      <div className="section-heading"><h2>Recent</h2>{projects.length ? <button type="button" onClick={onOpenProjects}>View all</button> : null}</div>
      {recent.length ? <div className="recent-grid">{recent.map((item) => <button className="recent-card" key={`${item.type}-${item.id}`} type="button" onClick={() => item.type === "drawing" ? onOpenDrawing(item.projectId, item.id) : item.type === "siteNote" ? onOpenSiteNote(item.projectId, item.id) : onOpenProject(item.projectId)}>
        <div className="recent-card__preview">{item.type === "drawing" ? <DrawingPreview drawing={item.drawing} label={`Preview of ${item.name}`}/> : <FolderKanban size={32}/>}</div>
        <div className="recent-card__body"><strong>{item.name}</strong><span>{item.type === "drawing" ? "Drawing" : item.type === "siteNote" ? "Site Notes" : "Project"} · {formatRelative(item.updatedAt)}</span><small>{item.context}</small></div>
        <ChevronRight className="recent-card__chevron" size={20}/>
      </button>)}</div> : <div className="home-empty"><PencilLine size={28}/><div><strong>Your recent work will appear here</strong><span>Start a quick drawing or open a project.</span></div></div>}
    </section>
    <BottomNavigation active="home" onNavigate={onNavigateTab}/>
  </ResponsivePage>;
}

function ActionCard({ icon, title, subtitle, onClick, className = "" }: { icon: React.ReactNode; title: string; subtitle: string; onClick: () => void; className?: string }) {
  return <button className={`home-action ${className}`.trim()} type="button" onClick={onClick}><span className="home-action__icon">{icon}</span><span className="home-action__copy"><strong>{title}</strong><small>{subtitle}</small></span><ChevronRight className="home-action__chevron" size={24}/></button>;
}

function formatRelative(value: string) {
  const elapsed = Date.now() - Date.parse(value);
  const minutes = Math.max(0, Math.floor(elapsed / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(new Date(value));
}
