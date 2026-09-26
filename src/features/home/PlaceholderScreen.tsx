import { ArrowLeft, BriefcaseBusiness, ClipboardPenLine, Settings, UserRound } from "lucide-react";
import type { RootTab } from "../../app/routes";
import { BottomNavigation } from "../../components/BottomNavigation";
import { IconButton } from "../../components/IconButton";
import { ResponsivePage } from "../../components/ResponsivePage";

const copy = {
  business: { title: "Business", body: "Jobs, clients, completed work and business records will live here.", icon: BriefcaseBusiness },
  profile: { title: "Profile", body: "Your personal and operational profile will live here.", icon: UserRound },
  settings: { title: "Settings", body: "Workspace and application preferences will live here.", icon: Settings },
} as const;

export function PlaceholderScreen({ tab, onNavigate }: { tab: RootTab; onNavigate: (tab: RootTab) => void }) {
  const content = copy[tab as keyof typeof copy];
  if (!content) return null;
  const Icon = content.icon;
  return <ResponsivePage withNavigation className="placeholder-screen"><section className="placeholder-panel"><Icon size={34}/><p className="app-header__eyebrow">PILLAR BUILDWORKS</p><h1>{content.title}</h1><p>{content.body}</p><span>Coming in a future phase</span></section><BottomNavigation active={tab} onNavigate={onNavigate}/></ResponsivePage>;
}

export function SiteNotesPlaceholder({ onBack }: { onBack: () => void }) {
  return <ResponsivePage className="placeholder-screen"><header className="dashboard-header"><IconButton icon={<ArrowLeft size={22}/>} label="Back to Home" onClick={onBack}/></header><section className="placeholder-panel"><ClipboardPenLine size={36}/><p className="app-header__eyebrow">Next phase</p><h1>Site Notes</h1><p>The structured Site Notes workspace is the next feature. No placeholder job or note has been created.</p></section></ResponsivePage>;
}
