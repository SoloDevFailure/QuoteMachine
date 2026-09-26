import { FolderKanban, House } from "lucide-react";
import type { RootTab } from "../app/routes";
export function BottomNavigation({ active, onNavigate }: { active: RootTab; onNavigate: (tab: RootTab) => void }) {
  return <nav className="pillar-bottom-nav" aria-label="Primary navigation"><button type="button" aria-current={active === "home" ? "page" : undefined} onClick={() => onNavigate("home")}><House size={20}/><span>Home</span></button><button type="button" aria-current={active === "projects" ? "page" : undefined} onClick={() => onNavigate("projects")}><FolderKanban size={20}/><span>Projects</span></button><span className="nav-signature">P / B<br/><small>FIELD WORKSPACE</small></span></nav>;
}
