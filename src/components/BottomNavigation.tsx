import { BriefcaseBusiness, House, Settings, UserRound } from "lucide-react";
import type { RootTab } from "../app/routes";

const items = [
  { id: "home", label: "Home", icon: House },
  { id: "business", label: "Business", icon: BriefcaseBusiness },
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

export function BottomNavigation({ active, onNavigate }: { active: RootTab; onNavigate: (tab: RootTab) => void }) {
  return <nav className="bottom-navigation" aria-label="Primary navigation">{items.map(({ id, label, icon: Icon }) => <button key={id} className={active === id ? "is-active" : ""} type="button" aria-current={active === id ? "page" : undefined} onClick={() => onNavigate(id)}><Icon size={24}/><span>{label}</span></button>)}</nav>;
}
